// Builds the feed file (format "blocklist/1", see SPEC.md) from source entries
// and the id cache. "updated" only moves when the entries actually change.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { SourceEntry } from "./source.ts";
import type { IdCache } from "./xids.ts";

export type FeedEntry = {
  site: string;
  id?: string;
  handle: string;
  name: string;
  category: string;
  reason?: string;
  source?: string;
};

export type Feed = {
  format: "blocklist/1";
  name: string;
  description: string;
  homepage: string;
  updated: string;
  entries: FeedEntry[];
};

export function toFeedEntries(entries: SourceEntry[], ids: IdCache): FeedEntry[] {
  return entries
    .map((e) => {
      const cached = e.site === "x" ? ids[e.handle] : undefined;
      const entry: FeedEntry = { site: e.site, handle: e.handle, name: e.name, category: e.category };
      if (cached && "id" in cached) {
        entry.id = cached.id;
        if (cached.screenName) entry.handle = cached.screenName.toLowerCase();
      }
      if (e.reason) entry.reason = e.reason;
      if (e.source) entry.source = e.source;
      return entry;
    })
    .sort((a, b) => a.site.localeCompare(b.site) || a.handle.localeCompare(b.handle));
}

export async function readPreviousFeed(path: string): Promise<Feed | undefined> {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw err;
  }
}

export function buildFeed(entries: FeedEntry[], previous: Feed | undefined, now: Date): Feed {
  const unchanged = previous && JSON.stringify(previous.entries) === JSON.stringify(entries);
  return {
    format: "blocklist/1",
    name: "Blockfacho — on bloque l’extrême droite",
    description: "Comptes d’extrême droite recensés par onbloquelextremedroite.fun",
    homepage: "https://onbloquelextremedroite.fun/",
    updated: unchanged ? previous.updated : now.toISOString(),
    entries,
  };
}

export async function writeFeed(path: string, feed: Feed): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(feed, null, 2) + "\n");
}
