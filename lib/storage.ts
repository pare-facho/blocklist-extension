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
// true once the default list has been subscribed (or removed by the user)
export const seededItem = storage.defineItem<boolean>("local:seeded", { fallback: false });

const LOG_MAX = 200;

export async function appendLog(line: string): Promise<void> {
  const log = await logItem.getValue();
  log.push(`${new Date().toISOString()} ${line}`);
  await logItem.setValue(log.slice(-LOG_MAX));
}

// Settings saved before 0.2.0 kept the gap in minutes; nothing else changed.
type LegacySettings = Partial<Settings> & { minGapMinutes?: number; maxGapMinutes?: number };

export async function getSettings(): Promise<Settings> {
  const { minGapMinutes, maxGapMinutes, ...saved } = (await settingsItem.getValue()) as LegacySettings;
  const migrated: Partial<Settings> = {};
  if (saved.minGapSeconds === undefined && minGapMinutes !== undefined) migrated.minGapSeconds = minGapMinutes * 60;
  if (saved.maxGapSeconds === undefined && maxGapMinutes !== undefined) migrated.maxGapSeconds = maxGapMinutes * 60;
  return { ...DEFAULT_SETTINGS, ...saved, ...migrated };
}
