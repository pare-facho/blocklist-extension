// One pipeline run: fetch the site's lists, look up new X ids, write the feed.
//
//   node tools/feed/run.ts [--out feed/blocklist.json] [--cache tools/feed/cache/x-ids.json]
//
// Safe to run every hour: only handles not yet in the cache are looked up.
// Both files are committed: the cache so lookups persist, the feed so every
// change to the list is visible in git history.

import { parseArgs } from "node:util";
import { readFile } from "node:fs/promises";
import { loadSourceEntries, applyCorrections, type Corrections } from "./source.ts";
import { readCache, writeCache, resolveMissingIds } from "./xids.ts";
import { toFeedEntries, readPreviousFeed, buildFeed, writeFeed, shrinksTooMuch } from "./build.ts";

const { values } = parseArgs({
  options: {
    out: { type: "string", default: "feed/blocklist.json" },
    cache: { type: "string", default: "tools/feed/cache/x-ids.json" },
    corrections: { type: "string", default: "tools/feed/corrections.json" },
    quiet: { type: "boolean", default: false },
  },
});

const log = values.quiet ? () => {} : (msg: string) => console.log(msg);

async function readCorrections(path: string): Promise<Corrections> {
  try {
    const { _comment, ...bySite } = JSON.parse(await readFile(path, "utf8"));
    return bySite;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw err;
  }
}

const entries = applyCorrections(await loadSourceEntries(), await readCorrections(values.corrections));
log(`source: ${entries.length} entries (${entries.filter((e) => e.site === "x").length} on X)`);

const cache = await readCache(values.cache);
const stats = await resolveMissingIds(
  entries.filter((e) => e.site === "x").map((e) => e.handle),
  cache,
  log,
);
await writeCache(values.cache, cache);
log(`ids: looked up ${stats.looked}, found ${stats.found}, missing ${stats.missing}, failed ${stats.failed}`);

const feedEntries = toFeedEntries(entries, cache);
const previous = await readPreviousFeed(values.out);
const previousCount = previous?.entries.length ?? 0;
if (shrinksTooMuch(previousCount, feedEntries.length) && process.env.FEED_ALLOW_SHRINK !== "1") {
  console.error(
    `feed: refusing to publish ${feedEntries.length} entries, down from ${previousCount}: ` +
      "the source lost too many accounts at once. Set FEED_ALLOW_SHRINK=1 to accept it.",
  );
  process.exit(2);
}
const feed = buildFeed(feedEntries, previous, new Date());
await writeFeed(values.out, feed);

const withId = feedEntries.filter((e) => e.site === "x" && e.id).length;
const xTotal = feedEntries.filter((e) => e.site === "x").length;
log(`feed: ${feedEntries.length} entries written to ${values.out} (X with id: ${withId}/${xTotal}), updated ${feed.updated}`);
if (stats.failed > 0) process.exitCode = 1;
