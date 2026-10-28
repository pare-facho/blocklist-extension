import { browser, defineBackground } from "#imports";
import { DEFAULT_FEED_URL } from "../lib/defaults.ts";
import { fetchFeed } from "../lib/feed.ts";
import { t } from "../lib/i18n.ts";
import { buildHideSet } from "../lib/matcher.ts";
import type { BackgroundMessage, ContentMessage, MayActReply, OptionsMessage, SiteState } from "../lib/messages.ts";
import { canActNow, recordAction, releaseSlot } from "../lib/pacing.ts";
import {
  allowItem,
  appendActed,
  appendLog,
  getActed,
  getSettings,
  manualItem,
  OBSOLETE_KEYS,
  pacingItem,
  seededItem,
  subscriptionsItem,
} from "../lib/storage.ts";
import type { Action, Site, Subscription } from "../lib/types.ts";

const ALARM_REFRESH = "refresh-feeds";

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener((details) => {
    void browser.storage.local.remove(OBSOLETE_KEYS);
    void scheduleRefresh();
    void ensureDefaultFeed();
    // 0.5 acts on X from the page where 0.4 only hid: show the settings once so the change is seen.
    if (details.reason === "update" && details.previousVersion && details.previousVersion < "0.5") void browser.runtime.openOptionsPage();
  });
  browser.runtime.onStartup.addListener(() => void scheduleRefresh());
  // The toolbar icon opens the settings page (browserAction on Firefox MV2, action on Chrome MV3).
  (browser.action ?? browser.browserAction).onClicked.addListener(() => void browser.runtime.openOptionsPage());

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_REFRESH) void refreshAllFeeds();
  });

  browser.runtime.onMessage.addListener((message: ContentMessage | OptionsMessage) => {
    switch (message.type) {
      case "state":
        return stateFor(message.site);
      case "quickHide":
        return quickHide(message);
      case "undoQuickHide":
        return undoQuickHide(message.site, message.handle);
      case "mayAct":
        return mayAct();
      case "acted":
        return acted(message);
      case "subscribe":
        return subscribe(message.url);
      case "refreshFeeds":
        return refreshAllFeeds();
      case "settingsChanged":
        return notifyContentScripts();
    }
  });
});

async function scheduleRefresh() {
  const settings = await getSettings();
  await browser.alarms.create(ALARM_REFRESH, { delayInMinutes: 1, periodInMinutes: settings.feedRefreshHours * 60 });
}

async function stateFor(site: Site): Promise<SiteState> {
  const [subs, manual, allow, settings, acted] = await Promise.all([
    subscriptionsItem.getValue(),
    manualItem.getValue(),
    allowItem.getValue(),
    getSettings(),
    getActed(),
  ]);
  const done = acted.filter((e) => e.site === site && e.result === "done");
  return {
    set: buildHideSet(site, subs, manual, allow),
    action: settings.action,
    muted: done.filter((e) => e.action === "mute").map((e) => e.handle),
    notInterested: done.flatMap((e) => (e.action === "notInterested" && e.postId ? [e.postId] : [])).slice(-3000),
  };
}

async function notifyContentScripts() {
  const tabs = await browser.tabs.query({ url: "https://x.com/*" });
  const msg: BackgroundMessage = { type: "stateChanged" };
  await Promise.all(tabs.map((t) => t.id && browser.tabs.sendMessage(t.id, msg).catch(() => {})));
}

// ---- acting on X -----------------------------------------------------------
// The background is the single arbiter of the pacing rules across all x.com tabs:
// a tab asks for a slot, gets it reserved, and reports how it went.

let paceLock: Promise<unknown> = Promise.resolve();
function withPace<T>(fn: () => Promise<T>): Promise<T> {
  const run = paceLock.then(fn, fn);
  paceLock = run.catch(() => {});
  return run;
}

function mayAct(): Promise<MayActReply> {
  return withPace(async () => {
    const now = Date.now();
    const pace = await pacingItem.getValue();
    const decision = canActNow(pace, now);
    if (!decision.ok) return decision;
    const next = recordAction(pace, now);
    await pacingItem.setValue(next);
    return { ok: true, slot: next.actedAt[next.actedAt.length - 1] as string };
  });
}

async function acted(msg: { site: Site; handle: string; action: Action; postId?: string; slot: string; result: "done" | "failed" | "gone"; detail?: string }) {
  const handle = msg.handle.toLowerCase();
  const at = new Date().toISOString();
  if (msg.result === "done") {
    await appendActed({ site: msg.site, handle, action: msg.action, postId: msg.postId, at, result: "done" });
    await appendLog(t(msg.action === "mute" ? "logMuted" : "logNotInterested", handle));
    // Other tabs must learn a muted account at once; a marked post is seen in one tab only.
    if (msg.action === "mute") await notifyContentScripts();
    return { ok: true };
  }
  // Nothing was sent: give the slot back so the pace is not spent on a miss.
  await withPace(async () => pacingItem.setValue(releaseSlot(await pacingItem.getValue(), msg.slot)));
  if (msg.result === "failed") {
    await appendActed({ site: msg.site, handle, action: msg.action, postId: msg.postId, at, result: "failed", detail: msg.detail });
    await appendLog(t("logFailed", handle, msg.detail ?? ""));
  }
  return { ok: true };
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
        await appendLog(t("logFeedRefreshed", sub.name, sub.entries.length));
      }
    } catch (err) {
      sub.lastError = (err as Error).message;
      await appendLog(t("logFeedFailed", sub.name, sub.lastError));
    }
  }
  await subscriptionsItem.setValue(subs);
  // The options page also sends "refreshFeeds" after editing the lists, so always re-send the set.
  await notifyContentScripts();
}

// ---- own list ----------------------------------------------------------------

async function quickHide(msg: { site: Site; handle: string; id?: string; name?: string }) {
  const handle = msg.handle.toLowerCase();
  const manual = await manualItem.getValue();
  if (!manual.some((e) => e.site === msg.site && e.handle === handle)) {
    manual.push({ site: msg.site, handle, id: msg.id, name: msg.name });
    await manualItem.setValue(manual);
  }
  await appendLog(t("logQuickHide", handle));
  await notifyContentScripts();
  return { ok: true };
}

async function undoQuickHide(site: Site, handle: string) {
  handle = handle.toLowerCase();
  await manualItem.setValue((await manualItem.getValue()).filter((e) => !(e.site === site && e.handle === handle)));
  await appendLog(t("logQuickUndo", handle));
  await notifyContentScripts();
  return { ok: true };
}
