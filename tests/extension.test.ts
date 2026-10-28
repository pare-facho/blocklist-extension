import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFeed, parseManualLines, FeedFormatError, fetchFeed } from "../lib/feed.ts";
import { buildBlockSet, isListed } from "../lib/matcher.ts";
import { canBlockNow, recordBlock, backOff, prunePace } from "../lib/pacing.ts";
import { DEFAULT_SETTINGS, type Subscription } from "../lib/types.ts";

const goodFeed = {
  format: "blocklist/1",
  name: "Test list",
  updated: "2026-10-28T00:00:00Z",
  entries: [
    { site: "x", id: "123", handle: "@SomeOne", name: "Some One" },
    { site: "instagram", handle: "other" },
    { site: "facebook", handle: "ignored-site" },
  ],
};

test("parseFeed accepts a valid feed and normalises handles", () => {
  const feed = parseFeed(goodFeed);
  assert.equal(feed.name, "Test list");
  assert.deepEqual(feed.entries[0], { site: "x", id: "123", handle: "someone", name: "Some One" });
  assert.equal(feed.entries.length, 3, "unknown sites are kept");
});

test("parseFeed rejects malformed feeds with a message naming the problem", () => {
  assert.throws(() => parseFeed({ ...goodFeed, format: "rss" }), (e: Error) => e instanceof FeedFormatError && /format/.test(e.message));
  assert.throws(() => parseFeed({ ...goodFeed, updated: "yesterday" }), /updated/);
  assert.throws(() => parseFeed({ ...goodFeed, entries: [{ site: "x" }] }), /entry 0 \(x\): "handle"/);
  assert.throws(() => parseFeed({ ...goodFeed, entries: [{ site: "x", handle: "a", id: 12 }] }), /"id" must be a string of digits/);
  assert.throws(() => parseFeed("nope"), /not a JSON object/);
});

test("fetchFeed does a conditional GET, refuses http and oversized bodies", async () => {
  const calls: Array<{ url: string; headers: Record<string, string> }> = [];
  const fake = (async (url: string, init?: RequestInit) => {
    calls.push({ url, headers: init?.headers as Record<string, string> });
    if (calls.length === 1) return new Response(JSON.stringify(goodFeed), { status: 200, headers: { etag: '"v1"' } });
    return new Response(null, { status: 304 });
  }) as unknown as typeof fetch;

  const first = await fetchFeed("https://example.org/list.json", undefined, fake);
  assert.equal(first.status, "ok");
  assert.equal(first.status === "ok" && first.etag, '"v1"');
  const second = await fetchFeed("https://example.org/list.json", '"v1"', fake);
  assert.equal(second.status, "unchanged");
  assert.equal(calls[1].headers["if-none-match"], '"v1"');

  await assert.rejects(fetchFeed("http://example.org/list.json", undefined, fake), /https/);
  const big = (async () => new Response("x".repeat(10), { status: 200, headers: { "content-length": String(6 * 1024 * 1024) } })) as unknown as typeof fetch;
  await assert.rejects(fetchFeed("https://example.org/big.json", undefined, big), /5 MB/);
});

test("parseManualLines accepts handles, @handles and profile links, dedupes", () => {
  const entries = parseManualLines("@Alpha\nalpha\nhttps://x.com/Beta/with_replies\n# comment\n\n  gamma  ", "x");
  assert.deepEqual(entries.map((e) => e.handle), ["alpha", "beta", "gamma"]);
});

test("buildBlockSet merges enabled lists and manual entries, minus the allow list", () => {
  const subs: Subscription[] = [
    { id: "1", url: "https://a", name: "A", enabled: true, entries: [{ site: "x", handle: "one", id: "1" }, { site: "x", handle: "two" }] },
    { id: "2", url: "https://b", name: "B", enabled: false, entries: [{ site: "x", handle: "three" }] },
  ];
  const set = buildBlockSet("x", subs, [{ site: "x", handle: "four" }, { site: "instagram", handle: "five" }], [{ site: "x", handle: "two" }]);
  assert.deepEqual(set.handles.sort(), ["four", "one"]);
  assert.deepEqual(set.ids, ["1"]);
  assert.equal(isListed(set, { handle: "ONE" }), true);
  assert.equal(isListed(set, { handle: "two" }), false, "allow list wins");
  assert.equal(isListed(set, { handle: "three" }), false, "disabled list ignored");
  assert.equal(isListed(set, { handle: "renamed", id: "1" }), true, "id matches after a rename");
});

test("pacing enforces the random gap, hourly and daily limits", () => {
  const settings = { ...DEFAULT_SETTINGS, perHour: 2, perDay: 3, minGapSeconds: 300, maxGapSeconds: 300 };
  const t0 = Date.parse("2026-10-28T10:00:00Z");
  const min = 60 * 1000;

  let pace = { blockedAt: [] as string[] };
  assert.equal(canBlockNow(settings, pace, t0).ok, true);

  pace = recordBlock(settings, pace, t0, () => 0.5);
  assert.equal(pace.nextAllowedAt, new Date(t0 + 5 * min).toISOString());
  const gap = canBlockNow(settings, pace, t0 + 1 * min);
  assert.equal(gap.ok, false);
  assert.equal(!gap.ok && gap.reason, "waiting for the random gap");

  pace = recordBlock(settings, pace, t0 + 5 * min, () => 0.5);
  const hourly = canBlockNow(settings, pace, t0 + 10 * min);
  assert.equal(!hourly.ok && hourly.reason, "hourly limit (2) reached");
  assert.equal(!hourly.ok && hourly.retryAt, t0 + 60 * min);

  pace = recordBlock(settings, pace, t0 + 61 * min, () => 0.5);
  const daily = canBlockNow(settings, pace, t0 + 130 * min);
  assert.equal(!daily.ok && daily.reason, "daily limit (3) reached");

  const later = t0 + 26 * 60 * min; // last block was at t0 + 61 min
  assert.equal(prunePace(pace, later).blockedAt.length, 0);
  assert.equal(canBlockNow(settings, prunePace(pace, later), later).ok, true);
});

test("backOff never moves nextAllowedAt earlier", () => {
  const t0 = Date.parse("2026-10-28T10:00:00Z");
  const pace = { blockedAt: [], nextAllowedAt: new Date(t0 + 60_000).toISOString() };
  assert.equal(backOff(pace, t0).nextAllowedAt, pace.nextAllowedAt);
  assert.equal(backOff(pace, t0 + 120_000).nextAllowedAt, new Date(t0 + 120_000).toISOString());
});
