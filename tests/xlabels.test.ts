import { test } from "node:test";
import assert from "node:assert/strict";
import { MUTE_LABELS, NOT_INTERESTED_LABELS, matchesLabel, normalizeLabel } from "../lib/xlabels.ts";

test("menu labels match whatever the case, spacing and apostrophe X renders", () => {
  assert.equal(matchesLabel("Not interested in this post", NOT_INTERESTED_LABELS), true);
  assert.equal(matchesLabel("  Ce post ne m’intéresse pas\n", NOT_INTERESTED_LABELS), true, "curly apostrophe");
  assert.equal(matchesLabel("KEIN INTERESSE AN DIESEM POST", NOT_INTERESTED_LABELS), true);
  assert.equal(matchesLabel("Not interested", NOT_INTERESTED_LABELS), false, "the ad variant is not the post item");
  assert.equal(matchesLabel("Mute", MUTE_LABELS), true);
  assert.equal(matchesLabel("Mute @someone", MUTE_LABELS), true, "label followed by the handle");
  assert.equal(matchesLabel("Mute this conversation", MUTE_LABELS), false);
  assert.equal(matchesLabel("Masquer", MUTE_LABELS), true);
  assert.equal(matchesLabel("Unmute", MUTE_LABELS), false);
  assert.equal(normalizeLabel("A  b’c"), "a b'c");
});

test("the two label sets never overlap and have no duplicates", () => {
  const all = [...NOT_INTERESTED_LABELS, ...MUTE_LABELS].map(normalizeLabel);
  assert.equal(new Set(all).size, all.length);
});
