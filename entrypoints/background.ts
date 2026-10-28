import { browser, defineBackground } from "#imports";
import { DEFAULT_FEED_URL } from "../lib/defaults.ts";
import { fetchFeed } from "../lib/feed.ts";
import { t } from "../lib/i18n.ts";
import { buildBlockSet } from "../lib/matcher.ts";
import type { BackgroundMessage, BlockResult, ContentMessage, OptionsMessage } from "../lib/messages.ts";
import { backOff, canBlockNow, prunePace, recordBlock } from "../lib/pacing.ts";
import { listedOnX, reconcileQueue } from "../lib/queue.ts";
import { allowItem, appendLog, getSettings, manualItem, paceItem, queueItem, seededItem, subscriptionsItem } from "../lib/storage.ts";
import { taskKey, type QueueTask, type Site, type Subscription } from "../lib/types.ts";

const ALARM_REFRESH = "refresh-feeds";
const ALARM_TICK = "block-tick";
const MAX_ATTEMPTS = 3;
const RETRY_LATER_MS = 15 * 60 * 1000;
const TICK_MINUTES = 0.5; // the shortest period Chrome allows for an alarm
const TICK_BUDGET_MS = 25_000; // what one alarm may spend before handing over to the next

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    void scheduleAlarms();
    void ensureDefaultFeed();
  });
  browser.runtime.onStartup.addListener(() => void scheduleAlarms());
  // The toolbar icon opens the settings page (browserAction on Firefox MV2, action on Chrome MV3).
  (browser.action ?? browser.browserAction).onClicked.addListener(() => void browser.runtime.openOptionsPage());

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_REFRESH) void refreshAllFeeds();
    if (alarm.name === ALARM_TICK) void runTicks();
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
  await browser.alarms.create(ALARM_TICK, { delayInMinutes: TICK_MINUTES, periodInMinutes: TICK_MINUTES });
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
  // Always resync: blocking may have been switched on since the lists last changed.
  await syncQueue();
  if (changed) await notifyContentScripts();
}

// ---- queue -----------------------------------------------------------------

// Lines the queue up with the lists: blocks to do for new accounts, unblocks for
// accounts the extension blocked that left every list. Only when blocking is on:
// users who just want to hide posts never get a queue.
async function syncQueue() {
  const settings = await getSettings();
  if (!settings.blockingEnabled) return;
  const [subs, manual, allow] = await Promise.all([subscriptionsItem.getValue(), manualItem.getValue(), allowItem.getValue()]);
  const { queue, toUnblock } = reconcileQueue(await queueItem.getValue(), listedOnX(subs, manual, allow), new Date().toISOString());
  await queueItem.setValue(queue);
  if (toUnblock > 0) await appendLog(t("logDelisted", toUnblock));
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

// Logs why no block can happen right now, once per cause, so the activity log
// explains a queue that does not move (no x.com tab, tab not answering).
let lastBlocker: string | undefined;
async function noteBlocker(kind: "noTab" | "tabSilent", detail = ""): Promise<string> {
  const reason = kind === "noTab" ? t("logNoTab") : t("logTabSilent", detail);
  if (lastBlocker !== kind) {
    lastBlocker = kind;
    await appendLog(reason);
  }
  return reason;
}

let ticking = false;

// One alarm: block accounts one after the other, waiting out the random gap in
// between, until the pacing says no or the alarm period is nearly over.
async function runTicks(): Promise<void> {
  if (ticking) return;
  ticking = true;
  const started = Date.now();
  try {
    for (;;) {
      const result = await tick();
      if (!result.ran) return;
      const pace = await paceItem.getValue();
      const next = pace.nextAllowedAt ? Date.parse(pace.nextAllowedAt) : Date.now();
      if (next - started > TICK_BUDGET_MS) return;
      await new Promise((resolve) => setTimeout(resolve, Math.max(0, next - Date.now())));
    }
  } finally {
    ticking = false;
  }
}

// One tick: if pacing allows, act on the oldest waiting X task through an open x.com
// tab. Unblocks go first: an account that left the lists should not stay blocked.
async function tick(preferredTabId?: number): Promise<{ ran: boolean; reason?: string }> {
  const settings = await getSettings();
  if (!settings.blockingEnabled) return { ran: false, reason: "blocking is off" };
  if (settings.paused) return { ran: false, reason: "paused" };

  const now = Date.now();
  let pace = prunePace(await paceItem.getValue(), now);
  const decision = canBlockNow(settings, pace, now);
  if (!decision.ok) return { ran: false, reason: decision.reason };

  const queue = await queueItem.getValue();
  const task = queue.find((t) => t.status === "unblocking" && t.site === "x") ?? queue.find((t) => t.status === "pending" && t.site === "x");
  if (!task) return { ran: false, reason: "queue is empty" };
  const unblock = task.status === "unblocking";

  const tabs = await browser.tabs.query({ url: "https://x.com/*" });
  const tab = tabs.find((t) => t.id === preferredTabId) ?? tabs[0];
  if (!tab?.id) return { ran: false, reason: await noteBlocker("noTab") };

  const msg: BackgroundMessage = { type: unblock ? "x:unblock" : "x:block", handle: task.handle, id: task.id };
  let result: BlockResult;
  try {
    result = (await browser.tabs.sendMessage(tab.id, msg)) as BlockResult;
  } catch (err) {
    return { ran: false, reason: await noteBlocker("tabSilent", (err as Error).message) };
  }
  lastBlocker = undefined;

  task.attempts++;
  if (result.ok) {
    task.status = unblock ? "unblocked" : "done";
    task.doneAt = new Date().toISOString();
    task.id = result.id ?? task.id;
    task.lastError = undefined;
    pace = recordBlock(settings, pace, now);
    await appendLog(t(unblock ? "logUnblocked" : "logBlocked", task.handle));
  } else if (result.kind === "rateLimited") {
    task.attempts--; // not the task's fault
    pace = backOff(pace, result.retryAt ?? now + RETRY_LATER_MS);
    await appendLog(t("logRateLimit", new Date(pace.nextAllowedAt ?? now).toLocaleTimeString()));
  } else if (result.kind === "notLoggedIn") {
    task.attempts--;
    pace = backOff(pace, now + RETRY_LATER_MS);
    await appendLog(t("logNotLoggedIn"));
  } else if (result.kind === "notFound" && unblock) {
    // The account is gone (or already unblocked): nothing left to undo.
    task.status = "unblocked";
    task.doneAt = new Date().toISOString();
    task.lastError = undefined;
    await appendLog(t("logUnblocked", task.handle));
  } else if (result.kind === "notFound") {
    task.status = "skipped";
    task.lastError = t("errNotFound");
    await appendLog(t("logSkipped", task.handle));
  } else {
    task.lastError = result.error;
    // A failed unblock stays "done": the block is still in place and will be retried at the next list refresh.
    if (task.attempts >= MAX_ATTEMPTS) task.status = unblock ? "done" : "failed";
    pace = backOff(pace, now + RETRY_LATER_MS);
    await appendLog(t(unblock ? "logUnblockFailed" : "logFailed", task.handle, task.attempts, MAX_ATTEMPTS, result.error));
  }
  await paceItem.setValue(pace);
  await queueItem.setValue(queue);
  return { ran: result.ok, reason: result.ok ? undefined : result.kind };
}

export type { QueueTask };
