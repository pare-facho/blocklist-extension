// Resolves X handles to permanent numeric user ids.
//
// "https://x.com/intent/user?screen_name=<handle>" answers with a redirect whose
// target URL carries the user id. No login, no API key. A missing or suspended
// handle answers 404. Results are cached on disk so a run only looks up new handles.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

export type IdCacheEntry =
  | { id: string; screenName: string; checkedAt: string }
  | { missing: true; checkedAt: string };

export type IdCache = Record<string, IdCacheEntry>;

const USER_AGENT = "blocklist-feed/0.1";
const RETRY_MISSING_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
const DELAY_BETWEEN_LOOKUPS_MS = 400;

export function userIdFromLocation(location: string): { id: string; screenName: string } | undefined {
  let u: URL;
  try {
    u = new URL(location, "https://x.com");
  } catch {
    return undefined;
  }
  const intent = u.searchParams.get("_intent");
  if (!intent) return undefined;
  try {
    const parsed = JSON.parse(intent);
    if (typeof parsed.userId === "string" && /^\d+$/.test(parsed.userId)) {
      return { id: parsed.userId, screenName: String(parsed.screenName ?? "") };
    }
  } catch {
    // not JSON: fall through
  }
  return undefined;
}

export async function lookupXId(handle: string): Promise<{ id: string; screenName: string } | "missing"> {
  const url = `https://x.com/intent/user?screen_name=${encodeURIComponent(handle)}`;
  const res = await fetch(url, { headers: { "user-agent": USER_AGENT }, redirect: "manual" });
  if (res.status === 404) return "missing";
  if (res.status >= 300 && res.status < 400) {
    const found = userIdFromLocation(res.headers.get("location") ?? "");
    if (found) return found;
  }
  throw new Error(`lookup ${handle}: unexpected HTTP ${res.status}`);
}

export async function readCache(path: string): Promise<IdCache> {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw err;
  }
}

export async function writeCache(path: string, cache: IdCache): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const sorted = Object.fromEntries(Object.entries(cache).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(path, JSON.stringify(sorted, null, 2) + "\n");
}

function needsLookup(entry: IdCacheEntry | undefined, now: number): boolean {
  if (!entry) return true;
  if ("id" in entry) return false;
  return now - Date.parse(entry.checkedAt) > RETRY_MISSING_AFTER_MS;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Fills the cache for every handle that is unknown or whose "missing" mark is stale.
// Lookups are sequential with a short pause: this is a courtesy, not a documented limit.
export async function resolveMissingIds(
  handles: string[],
  cache: IdCache,
  log: (msg: string) => void = () => {},
): Promise<{ looked: number; found: number; missing: number; failed: number }> {
  const now = Date.now();
  const todo = [...new Set(handles.map((h) => h.toLowerCase()))].filter((h) => needsLookup(cache[h], now));
  const stats = { looked: 0, found: 0, missing: 0, failed: 0 };
  for (const handle of todo) {
    stats.looked++;
    try {
      const result = await lookupXId(handle);
      const checkedAt = new Date().toISOString();
      if (result === "missing") {
        cache[handle] = { missing: true, checkedAt };
        stats.missing++;
        log(`missing  ${handle}`);
      } else {
        cache[handle] = { ...result, checkedAt };
        stats.found++;
        log(`found    ${handle} -> ${result.id}`);
      }
    } catch (err) {
      stats.failed++;
      log(`failed   ${handle}: ${(err as Error).message}`);
    }
    await sleep(DELAY_BETWEEN_LOOKUPS_MS);
  }
  return stats;
}
