import { browser, defineBackground } from "#imports";
import { DEFAULT_FEED_URL } from "../lib/defaults.ts";
import { fetchFeed } from "../lib/feed.ts";
import { t } from "../lib/i18n.ts";
import { buildHideSet } from "../lib/matcher.ts";
import type { BackgroundMessage, ContentMessage, OptionsMessage } from "../lib/messages.ts";
import { allowItem, appendLog, getSettings, manualItem, OBSOLETE_KEYS, seededItem, subscriptionsItem } from "../lib/storage.ts";
import type { Site, Subscription } from "../lib/types.ts";

const ALARM_REFRESH = "refresh-feeds";

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    void browser.storage.local.remove(OBSOLETE_KEYS);
    void scheduleRefresh();
    void ensureDefaultFeed();
  });
  browser.runtime.onStartup.addListener(() => void scheduleRefresh());
  // The toolbar icon opens the settings page (browserAction on Firefox MV2, action on Chrome MV3).
  (browser.action ?? browser.browserAction).onClicked.addListener(() => void browser.runtime.openOptionsPage());

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_REFRESH) void refreshAllFeeds();
  });

  browser.runtime.onMessage.addListener((message: ContentMessage | OptionsMessage) => {
    switch (message.type) {
      case "hideset":
        return hideSetFor(message.site);
      case "quickHide":
        return quickHide(message);
      case "undoQuickHide":
        return undoQuickHide(message.site, message.handle);
      case "subscribe":
        return subscribe(message.url);
      case "refreshFeeds":
        return refreshAllFeeds();
    }
  });
});

async function scheduleRefresh() {
  const settings = await getSettings();
  await browser.alarms.create(ALARM_REFRESH, { delayInMinutes: 1, periodInMinutes: settings.feedRefreshHours * 60 });
}

async function hideSetFor(site: Site) {
  const [subs, manual, allow] = await Promise.all([subscriptionsItem.getValue(), manualItem.getValue(), allowItem.getValue()]);
  return buildHideSet(site, subs, manual, allow);
}

async function notifyContentScripts() {
  const tabs = await browser.tabs.query({ url: "https://x.com/*" });
  const msg: BackgroundMessage = { type: "hidesetChanged" };
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
