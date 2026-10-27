import { storage } from "#imports";
import { DEFAULT_SETTINGS, type FeedEntry, type PaceState, type QueueTask, type Settings, type Subscription } from "./types.ts";

// Everything stays in the browser's local extension storage. Nothing is synced or sent.
export const subscriptionsItem = storage.defineItem<Subscription[]>("local:subscriptions", { fallback: [] });
export const manualItem = storage.defineItem<FeedEntry[]>("local:manual", { fallback: [] });
export const allowItem = storage.defineItem<FeedEntry[]>("local:allow", { fallback: [] });
export const settingsItem = storage.defineItem<Settings>("local:settings", { fallback: DEFAULT_SETTINGS });
export const queueItem = storage.defineItem<QueueTask[]>("local:queue", { fallback: [] });
export const paceItem = storage.defineItem<PaceState>("local:pace", { fallback: { blockedAt: [] } });
export const logItem = storage.defineItem<string[]>("local:log", { fallback: [] });

const LOG_MAX = 200;

export async function appendLog(line: string): Promise<void> {
  const log = await logItem.getValue();
  log.push(`${new Date().toISOString()} ${line}`);
  await logItem.setValue(log.slice(-LOG_MAX));
}

export async function getSettings(): Promise<Settings> {
  return { ...DEFAULT_SETTINGS, ...(await settingsItem.getValue()) };
}
