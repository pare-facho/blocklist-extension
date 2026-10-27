import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseAccountsJs,
  parseSocialsJs,
  handleFromProfileUrl,
  entriesFromAccountsJs,
  entriesFromSocialsJs,
  entriesFromApi,
  dedupe,
  applyCorrections,
} from "../tools/feed/source.ts";
import { userIdFromLocation } from "../tools/feed/xids.ts";
import { toFeedEntries, buildFeed } from "../tools/feed/build.ts";

const accountsJs = `const accounts = [
  { "name": "Example One", "handle": "ExampleOne", "category": "RN", "reason": "r1", "source": "https://s/1" },
  { "name": "Example Two", "handle": "example_two", "category": "Autres", "reason": "", "source": "" }
];
`;

const socialsJs = `const socials = {
  "exampleone": {
    "sources": { "instagram": "https://s/ig" },
    "instagram": "https://www.instagram.com/example.one",
    "facebook": "https://www.facebook.com/profile.php?id=42"
  }
};
`;

test("parses accounts.js and socials.js", () => {
  const accounts = parseAccountsJs(accountsJs);
  assert.equal(accounts.length, 2);
  const socials = parseSocialsJs(socialsJs);
  assert.equal(socials.exampleone.instagram, "https://www.instagram.com/example.one");
});

test("handles come from the last path segment, lower-cased", () => {
  assert.equal(handleFromProfileUrl("https://x.com/Some_User/with_replies"), "with_replies");
  assert.equal(handleFromProfileUrl("https://x.com/Some_User"), "some_user");
  assert.equal(handleFromProfileUrl("https://www.tiktok.com/@name"), "name");
  assert.equal(handleFromProfileUrl("https://www.facebook.com/profile.php?id=42"), "id:42");
  assert.equal(handleFromProfileUrl("not a url"), undefined);
});

test("builds entries from the three sources and dedupes", () => {
  const x = entriesFromAccountsJs(parseAccountsJs(accountsJs));
  assert.deepEqual(x[0], {
    site: "x", handle: "exampleone", name: "Example One", category: "RN", reason: "r1", source: "https://s/1",
  });
  assert.equal(x[1].reason, undefined);

  const social = entriesFromSocialsJs(parseSocialsJs(socialsJs), x);
  assert.deepEqual(social.map((e) => [e.site, e.handle]), [["instagram", "example.one"], ["facebook", "id:42"]]);
  assert.equal(social[0].source, "https://s/ig");
  assert.equal(social[0].name, "Example One");

  const api = entriesFromApi({
    entries: [
      { type: "new", platform: "x", profile_url: "https://x.com/ExampleOne", name: "dup", category: "RN" },
      { type: "new", platform: "x", profile_url: "https://x.com/third", name: "Third", category: "Autres", reason: "" },
      { type: "removal", target_id: "example_two" },
      { type: "new", platform: "x" },
    ],
  });
  assert.equal(api.added.length, 2);
  assert.deepEqual([...api.removed], ["example_two"]);

  const all = dedupe([...x, ...social, ...api.added]).filter((e) => !api.removed.has(e.handle));
  assert.deepEqual(all.map((e) => `${e.site}:${e.handle}`), ["x:exampleone", "instagram:example.one", "facebook:id:42", "x:third"]);
  assert.equal(all[0].name, "Example One", "first occurrence wins");
});

test("corrections replace a published handle, per site, case-insensitively", () => {
  const fixed = applyCorrections(
    [
      { site: "x", handle: "oldname", name: "A", category: "RN" },
      { site: "instagram", handle: "oldname", name: "A", category: "RN" },
      { site: "x", handle: "untouched", name: "B", category: "RN" },
    ],
    { x: { oldname: "NewName" } },
  );
  assert.deepEqual(fixed.map((e) => `${e.site}:${e.handle}`), ["x:newname", "instagram:oldname", "x:untouched"]);
});

test("reads the user id from the intent redirect", () => {
  const loc = "https://x.com/github?_intent=%7B%22type%22%3A%22follow%22%2C%22userId%22%3A%2213334762%22%2C%22screenName%22%3A%22github%22%7D";
  assert.deepEqual(userIdFromLocation(loc), { id: "13334762", screenName: "github" });
  assert.equal(userIdFromLocation("https://x.com/github"), undefined);
  assert.equal(userIdFromLocation("https://x.com/github?_intent=%7B%22userId%22%3A%22abc%22%7D"), undefined);
});

test("feed entries carry ids from the cache and 'updated' only moves on change", () => {
  const entries = toFeedEntries(
    [
      { site: "x", handle: "exampleone", name: "Example One", category: "RN" },
      { site: "x", handle: "gone", name: "Gone", category: "RN" },
      { site: "instagram", handle: "example.one", name: "Example One", category: "RN" },
    ],
    {
      exampleone: { id: "1", screenName: "ExampleOne", checkedAt: "2026-10-28T00:00:00Z" },
      gone: { missing: true, checkedAt: "2026-10-28T00:00:00Z" },
    },
  );
  assert.equal(entries.find((e) => e.handle === "exampleone")?.id, "1");
  assert.equal(entries.find((e) => e.handle === "gone")?.id, undefined);
  assert.equal(entries.find((e) => e.site === "instagram")?.id, undefined);

  const t1 = new Date("2026-10-28T10:00:00Z");
  const t2 = new Date("2026-10-28T11:00:00Z");
  const first = buildFeed(entries, undefined, t1);
  assert.equal(first.updated, t1.toISOString());
  const same = buildFeed(entries, first, t2);
  assert.equal(same.updated, t1.toISOString());
  const changed = buildFeed(entries.slice(1), first, t2);
  assert.equal(changed.updated, t2.toISOString());
});
