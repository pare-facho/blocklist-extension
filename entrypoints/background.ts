import { browser, defineBackground } from "#imports";
import { DEFAULT_FEED_URL } from "../lib/defaults.ts";
import { fetchFeed } from "../lib/feed.ts";
import { t } from "../lib/i18n.ts";
import { buildBlockSet } from "../lib/matcher.ts";
import type { BackgroundMessage, BlockResult, ContentMessage, OptionsMessage } from "../lib/messages.ts";
import { backOff, canBlockNow, prunePace, recordBlock } from "../lib/pacing.ts";
import { allowItem, appendLog, getSettings, manualItem, paceItem, queueItem, seededItem, subscriptionsItem } from "../lib/storage.ts";
import { isSite, taskKey, type QueueTask, type Site, type Subscription } from "../lib/types.ts";

const ALARM_REFRESH = "refresh-feeds";
const ALARM_TICK = "block-tick";
const MAX_ATTEMPTS = 3;
const RETRY_LATER_MS = 15 * 60 * 1000;

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    void scheduleAlarms();
    void ensureDefaultFeed();
  });
  browser.runtime.onStartup.addListener(() => void scheduleAlarms());

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_REFRESH) void refreshAllFeeds();
    if (alarm.name === ALARM_TICK) void tick();
  });

  browser.runtime.onMessage.addListener((message: ContentMessage | OptionsMessage, sender) => {
    switch (message.type) {
      case "blockset":
        return blockSetFor(message.site);
      case "quickBlock":
        return quickBlock(message);
      case "undoQuickBlock":
        return undoQuickBlock(message.site, message.handle);
      case "subscribe":
        return subscribe(message.url);
      case "refreshFeeds":
        return refreshAllFeeds();
      case "tick":
        return tick(sender.tab?.id);
    }
  });
});

async function scheduleAlarms() {
  const settings = await getSettings();
  await browser.alarms.create(ALARM_REFRESH, { delayInMinutes: 1, periodInMinutes: settings.feedRefreshHours * 60 });
  await browser.alarms.create(ALARM_TICK, { delayInMinutes: 1, periodInMinutes: 1 });
}

async function blockSetFor(site: Site) {
  const [subs, manual, allow] = await Promise.all([subscriptionsItem.getValue(), manualItem.getValue(), allowItem.getValue()]);
  return buildBlockSet(site, subs, manual, allow);
}

async function notifyContentScripts() {
  const tabs = await browser.tabs.query({ url: "https://x.com/*" });
  const msg: BackgroundMessage = { type: "blocksetChanged" };
  await Promise.all(tabs.map((t) => t.id && browser.tabs.sendMessage(t.id, msg).catch(() => {})));
}

// ---- feeds -----------------------------------------------------------------

async function subscribe(url: string): Promise<{ ok: true; name: string; count: number } | { ok: false; error: string }> {
  try {
    const result = await fetchFeed(url);
    if (result.status !== "ok") return { ok: false, error: "no content" };
    const subs = await subscriptionsItem.getValue();
    const existing = subs.find((s) => s.url === url);
    const sub: Subscription = {
      id: existing?.id ?? crypto.randomUUID(),
      url,
      name: result.feed.name,
      enabled: existing?.enabled ?? true,
      entries: result.feed.entries,
      etag: result.etag,
      updated: result.feed.updated,
      lastFetched: new Date().toISOString(),
    };
    await subscriptionsItem.setValue([...subs.filter((s) => s.url !== url), sub]);
    await appendLog(t("logSubscribed", sub.name, sub.entries.length));
    await syncQueue();
    await notifyContentScripts();
    return { ok: true, name: sub.name, count: sub.entries.length };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

// Subscribes to the default list once. Retried at each refresh until the first
// download succeeds (the install may happen offline); never re-added once the
// user has removed it.
async function ensureDefaultFeed() {
  if (await seededItem.getValue()) return;
  const result = await subscribe(DEFAULT_FEED_URL);
  if (result.ok) await seededItem.setValue(true);
}

async function refreshAllFeeds() {
  await ensureDefaultFeed();
  const subs = await subscriptionsItem.getValue();
  let changed = false;
  for (const sub of subs) {
    if (!sub.enabled) continue;
    try {
      const result = await fetchFeed(sub.url, sub.etag);
      sub.lastFetched = new Date().toISOString();
      sub.lastError = undefined;
      if (result.status === "ok") {
        sub.name = result.feed.name;
        sub.entries = result.feed.entries;
        sub.etag = result.etag;
        sub.updated = result.feed.updated;
        changed = true;
        await appendLog(t("logFeedRefreshed", sub.name, sub.entries.length));
      }
    } catch (err) {
      sub.lastError = (err as Error).message;
      await appendLog(t("logFeedFailed", sub.name, sub.lastError));
    }
  }
  await subscriptionsItem.setValue(subs);
  if (changed) {
    await syncQueue();
    await notifyContentScripts();
  }
}

// ---- queue -----------------------------------------------------------------

// Adds every listed account that is not yet in the queue. Only when blocking is on:
// users who just want to hide posts never get a queue.
async function syncQueue() {
  const settings = await getSettings();
  if (!settings.blockingEnabled) return;
  const queue = await queueItem.getValue();
  const known = new Set(queue.map((t) => t.key));
  const [subs, manual, allow] = await Promise.all([subscriptionsItem.getValue(), manualItem.getValue(), allowItem.getValue()]);
  const allowed = new Set(allow.map((e) => `${e.site}:${e.handle}`));
  const now = new Date().toISOString();
  for (const e of [...subs.filter((s) => s.enabled).flatMap((s) => s.entries), ...manual]) {
    if (!isSite(e.site)) continue;
    const key = taskKey(e.site, e.handle);
    if (known.has(key) || allowed.has(key)) continue;
    known.add(key);
    queue.push({ key, site: e.site, handle: e.handle, id: e.id, origin: "list", status: "pending", attempts: 0, createdAt: now });
  }
  await queueItem.setValue(queue);
}

async function quickBlock(msg: { site: Site; handle: string; id?: string; name?: string }) {
  const handle = msg.handle.toLowerCase();
  const manual = await manualItem.getValue();
  if (!manual.some((e) => e.site === msg.site && e.handle === handle)) {
    manual.push({ site: msg.site, handle, id: msg.id, name: msg.name });
    await manualItem.setValue(manual);
  }
  const queue = await queueItem.getValue();
  const key = taskKey(msg.site, handle);
  if (!queue.some((t) => t.key === key)) {
    queue.push({ key, site: msg.site, handle, id: msg.id, origin: "quick", status: "pending", attempts: 0, createdAt: new Date().toISOString() });
    await queueItem.setValue(queue);
  }
  await appendLog(t("logQuickBlock", handle));
  await notifyContentScripts();
  return { ok: true };
}

async function undoQuickBlock(site: Site, handle: string) {
  handle = handle.toLowerCase();
  const key = taskKey(site, handle);
  await manualItem.setValue((await manualItem.getValue()).filter((e) => !(e.site === site && e.handle === handle)));
  await queueItem.setValue((await queueItem.getValue()).filter((t) => !(t.key === key && t.status === "pending")));
  await appendLog(t("logQuickUndo", handle));
  await notifyContentScripts();
  return { ok: true };
}

// One tick: if pacing allows, block the oldest pending X account through an open x.com tab.
async function tick(preferredTabId?: number): Promise<{ ran: boolean; reason?: string }> {
  const settings = await getSettings();
  if (!settings.blockingEnabled) return { ran: false, reason: "blocking is off" };
  if (settings.paused) return { ran: false, reason: "paused" };

  const now = Date.now();
  let pace = prunePace(await paceItem.getValue(), now);
  const decision = canBlockNow(settings, pace, now);
  if (!decision.ok) return { ran: false, reason: decision.reason };

  const queue = await queueItem.getValue();
  const task = queue.find((t) => t.status === "pending" && t.site === "x");
  if (!task) return { ran: false, reason: "queue is empty" };

  const tabs = await browser.tabs.query({ url: "https://x.com/*" });
  const tab = tabs.find((t) => t.id === preferredTabId) ?? tabs[0];
  if (!tab?.id) return { ran: false, reason: "no x.com tab open" };

  const msg: BackgroundMessage = { type: "x:block", handle: task.handle, id: task.id };
  let result: BlockResult;
  try {
    result = (await browser.tabs.sendMessage(tab.id, msg)) as BlockResult;
  } catch (err) {
    return { ran: false, reason: `x.com tab did not answer: ${(err as Error).message}` };
  }

  task.attempts++;
  if (result.ok) {
    task.status = "done";
    task.doneAt = new Date().toISOString();
    task.id = result.id ?? task.id;
    task.lastError = undefined;
    pace = recordBlock(settings, pace, now);
    await appendLog(t("logBlocked", task.handle));
  } else if (result.kind === "rateLimited") {
    task.attempts--; // not the task's fault
    pace = backOff(pace, result.retryAt ?? now + RETRY_LATER_MS);
    await appendLog(t("logRateLimit", new Date(pace.nextAllowedAt ?? now).toLocaleTimeString()));
  } else if (result.kind === "notLoggedIn") {
    task.attempts--;
    pace = backOff(pace, now + RETRY_LATER_MS);
    await appendLog(t("logNotLoggedIn"));
  } else if (result.kind === "notFound") {
    task.status = "skipped";
    task.lastError = t("errNotFound");
    await appendLog(t("logSkipped", task.handle));
  } else {
    task.lastError = result.error;
    if (task.attempts >= MAX_ATTEMPTS) task.status = "failed";
    pace = backOff(pace, now + RETRY_LATER_MS);
    await appendLog(t("logFailed", task.handle, task.attempts, MAX_ATTEMPTS, result.error));
  }
  await paceItem.setValue(pace);
  await queueItem.setValue(queue);
  return { ran: result.ok, reason: result.ok ? undefined : result.kind };
}

export type { QueueTask };
