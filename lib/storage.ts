import { storage } from "#imports";
import { ACTIONS, DEFAULT_SETTINGS, type ActedEntry, type FeedEntry, type PaceState, type Settings, type Subscription } from "./types.ts";

// Everything stays in the browser's local extension storage. Nothing is synced or sent.
export const subscriptionsItem = storage.defineItem<Subscription[]>("local:subscriptions", { fallback: [] });
export const manualItem = storage.defineItem<FeedEntry[]>("local:manual", { fallback: [] });
export const allowItem = storage.defineItem<FeedEntry[]>("local:allow", { fallback: [] });
export const settingsItem = storage.defineItem<Settings>("local:settings", { fallback: DEFAULT_SETTINGS });
export const logItem = storage.defineItem<string[]>("local:log", { fallback: [] });
// true once the default list has been subscribed (or removed by the user)
export const seededItem = storage.defineItem<boolean>("local:seeded", { fallback: false });
// actions made (or tried) from a post on screen, newest last
export const actedItem = storage.defineItem<ActedEntry[]>("local:acted", { fallback: [] });
export const pacingItem = storage.defineItem<PaceState>("local:pacing", { fallback: { actedAt: [] } });

// Keys written by versions up to 0.3.x, which blocked from a background queue.
export const OBSOLETE_KEYS = ["queue", "pace"];

const LOG_MAX = 200;
const ACTED_MAX = 5000;

export async function appendLog(line: string): Promise<void> {
  const log = await logItem.getValue();
  log.push(`${new Date().toISOString()} ${line}`);
  await logItem.setValue(log.slice(-LOG_MAX));
}

const sameTarget = (a: ActedEntry, b: ActedEntry) => a.site === b.site && a.handle === b.handle && a.action === b.action && a.postId === b.postId;

export async function appendActed(entry: ActedEntry): Promise<void> {
  const acted = (await actedItem.getValue()).filter((e) => !sameTarget(e, entry));
  acted.push(entry);
  await actedItem.setValue(acted.slice(-ACTED_MAX));
}

// Entries written by earlier builds (another action set) are ignored, not migrated.
export async function getActed(): Promise<ActedEntry[]> {
  return (await actedItem.getValue()).filter((e) => ACTIONS.includes(e.action) && (e.result === "done" || e.result === "failed"));
}

// Settings saved by older versions may lack fields or carry removed ones; only the known ones are kept.
export async function getSettings(): Promise<Settings> {
  const saved = (await settingsItem.getValue()) as Partial<Settings>;
  return {
    feedRefreshHours: saved.feedRefreshHours ?? DEFAULT_SETTINGS.feedRefreshHours,
    action: saved.action && ACTIONS.includes(saved.action) ? saved.action : DEFAULT_SETTINGS.action,
  };
}
