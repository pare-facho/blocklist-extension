import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

// Every language must define the same keys with the same placeholders, so no
// user ever sees a raw key or a broken "$1".
test("all locales define the same message keys and placeholders", async () => {
  const dir = new URL("../public/_locales/", import.meta.url);
  const langs = await readdir(dir);
  assert.ok(langs.includes("fr") && langs.includes("en"));
  const shape = async (lang: string) => {
    const doc = JSON.parse(await readFile(new URL(`${lang}/messages.json`, dir), "utf8")) as Record<string, { message: string; placeholders?: Record<string, unknown> }>;
    return Object.fromEntries(Object.entries(doc).map(([k, v]) => [k, Object.keys(v.placeholders ?? {}).sort().join(",")]));
  };
  const ref = await shape("fr");
  for (const lang of langs) {
    assert.deepEqual(await shape(lang), ref, `locale "${lang}" differs from "fr"`);
  }
});
