import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseAccountsJs,
  handleFromProfileUrl,
  entriesFromAccountsJs,
  entriesFromApi,
  dedupe,
  applyCorrections,
  entriesFromEntityCatalog,
  loadWithSnapshot,
} from "../tools/feed/source.ts";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { userIdFromLocation } from "../tools/feed/xids.ts";
import { toFeedEntries, buildFeed, shrinksTooMuch } from "../tools/feed/build.ts";

const accountsJs = `const accounts = [
  { "name": "Example One", "handle": "ExampleOne", "category": "RN", "reason": "r1", "source": "https://s/1" },
  { "name": "Example Two", "handle": "example_two", "category": "Autres", "reason": "", "source": "" }
];
`;

test("parses accounts.js", () => {
  const accounts = parseAccountsJs(accountsJs);
  assert.equal(accounts.length, 2);
  assert.equal(accounts[0].handle, "ExampleOne");
});

test("handles come from the last path segment, lower-cased", () => {
  assert.equal(handleFromProfileUrl("https://x.com/Some_User/with_replies"), "with_replies");
  assert.equal(handleFromProfileUrl("https://x.com/Some_User"), "some_user");
  assert.equal(handleFromProfileUrl("https://x.com/@Name"), "name");
  assert.equal(handleFromProfileUrl("not a url"), undefined);
});

test("builds entries from the two sources, keeps X only and dedupes", () => {
  const x = entriesFromAccountsJs(parseAccountsJs(accountsJs));
  assert.deepEqual(x[0], {
    site: "x", handle: "exampleone", name: "Example One", category: "RN", reason: "r1", source: "https://s/1",
  });
  assert.equal(x[1].reason, undefined);

  const api = entriesFromApi({
    entries: [
      { type: "new", platform: "x", profile_url: "https://x.com/ExampleOne", name: "dup", category: "RN" },
      { type: "new", platform: "x", profile_url: "https://x.com/third", name: "Third", category: "Autres", reason: "" },
      { type: "removal", target_id: "example_two" },
      { type: "new", platform: "x" },
      { type: "new", platform: "other", profile_url: "https://other.example/someone", name: "Elsewhere" },
    ],
  });
  assert.equal(api.added.length, 2);
  assert.deepEqual([...api.removed], ["example_two"]);

  const all = dedupe([...x, ...api.added]).filter((e) => !api.removed.has(e.handle));
  assert.deepEqual(all.map((e) => `${e.site}:${e.handle}`), ["x:exampleone", "x:third"]);
  assert.equal(all[0].name, "Example One", "first occurrence wins");
});

test("corrections replace a published handle, per site, case-insensitively", () => {
  const fixed = applyCorrections(
    [
      { site: "x", handle: "oldname", name: "A", category: "RN" },
      { site: "other", handle: "oldname", name: "A", category: "RN" },
      { site: "x", handle: "untouched", name: "B", category: "RN" },
    ],
    { x: { oldname: "NewName" } },
  );
  assert.deepEqual(fixed.map((e) => `${e.site}:${e.handle}`), ["x:newname", "other:oldname", "x:untouched"]);
});

test("reads the user id from the intent redirect", () => {
  const loc = "https://x.com/github?_intent=%7B%22type%22%3A%22follow%22%2C%22userId%22%3A%2213334762%22%2C%22screenName%22%3A%22github%22%7D";
  assert.deepEqual(userIdFromLocation(loc), { id: "13334762", screenName: "github" });
  assert.equal(userIdFromLocation("https://x.com/github"), undefined);
  assert.equal(userIdFromLocation("https://x.com/github?_intent=%7B%22userId%22%3A%22abc%22%7D"), undefined);
  // Since Nov 2026 the redirect only names the account.
  assert.deepEqual(userIdFromLocation("/GDarmanin?_intent=follow"), { screenName: "GDarmanin" });
});

test("feed entries carry ids from the cache and 'updated' only moves on change", () => {
  const entries = toFeedEntries(
    [
      { site: "x", handle: "exampleone", name: "Example One", category: "RN" },
      { site: "x", handle: "gone", name: "Gone", category: "RN" },
    ],
    {
      exampleone: { id: "1", screenName: "ExampleOne", checkedAt: "2026-10-28T00:00:00Z" },
      gone: { missing: true, checkedAt: "2026-10-28T00:00:00Z" },
    },
  );
  assert.equal(entries.find((e) => e.handle === "exampleone")?.id, "1");
  assert.equal(entries.find((e) => e.handle === "gone")?.id, undefined);

  const t1 = new Date("2026-10-28T10:00:00Z");
  const t2 = new Date("2026-10-28T11:00:00Z");
  const first = buildFeed(entries, undefined, t1);
  assert.equal(first.updated, t1.toISOString());
  const same = buildFeed(entries, first, t2);
  assert.equal(same.updated, t1.toISOString());
  const changed = buildFeed(entries.slice(1), first, t2);
  assert.equal(changed.updated, t2.toISOString());
});

test("a list that loses more than a tenth of its entries is not published", () => {
  assert.equal(shrinksTooMuch(618, 452), true);
  assert.equal(shrinksTooMuch(618, 600), false);
  assert.equal(shrinksTooMuch(618, 700), false);
  assert.equal(shrinksTooMuch(0, 0), false);
});

test("API removals may point at another entry's id", () => {
  const api = entriesFromApi({
    entries: [
      { id: "a1", type: "new", platform: "x", profile_url: "https://x.com/SomeOne", name: "S" },
      { id: "r1", type: "removal", target_id: "a1" },
      { id: "r2", type: "removal", target_id: "Other" },
    ],
  } as never);
  assert.deepEqual([...api.removed].sort(), ["other", "someone"]);
});

test("the .fr catalog gives the X accounts of its block list only", () => {
  const entries = entriesFromEntityCatalog({
    entities: [
      {
        list: "block",
        name: "Person One",
        category: "political",
        accounts: [
          { platform: "instagram", handle: "one_ig", url: "https://www.instagram.com/one_ig/" },
          { platform: "x", handle: "@One_X", name: "One", url: "https://x.com/One_X" },
        ],
      },
      { list: "support", name: "Person Two", category: "media", accounts: [{ platform: "x", handle: "two" }] },
      { list: "block", name: "Group", category: "unknown", accounts: [{ platform: "x", handle: "group" }] },
    ],
  });
  assert.deepEqual(entries, [
    { site: "x", handle: "one_x", name: "One", category: "Politique", source: "https://x.com/One_X" },
    { site: "x", handle: "group", name: "Group", category: "Autres", source: undefined },
  ]);
});

test("a source that cannot be read falls back to its last snapshot", async () => {
  const path = join(await mkdtemp(join(tmpdir(), "feed-")), "s.json");
  const one = [{ site: "x", handle: "a", name: "A", category: "Autres" }];
  assert.deepEqual(await loadWithSnapshot(path, async () => one), { entries: one });
  assert.deepEqual(JSON.parse(await readFile(path, "utf8")), one);

  const down = await loadWithSnapshot(path, async () => {
    throw new Error("HTTP 403");
  });
  assert.deepEqual(down, { entries: one, error: "HTTP 403" });

  await assert.rejects(
    loadWithSnapshot(path + ".none", async () => {
      throw new Error("HTTP 403");
    }),
    /no snapshot/,
  );
});
