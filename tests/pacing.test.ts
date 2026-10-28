import { test } from "node:test";
import assert from "node:assert/strict";
import { PACE, canActNow, recordAction, releaseSlot, prunePace } from "../lib/pacing.ts";
import type { PaceState } from "../lib/types.ts";

const T0 = Date.parse("2026-10-28T12:00:00Z");
const at = (offsetMs: number) => new Date(T0 + offsetMs).toISOString();

test("a fresh state may act; a recorded action opens a random gap inside the configured range", () => {
  assert.deepEqual(canActNow({ actedAt: [] }, T0), { ok: true });
  const low = recordAction({ actedAt: [] }, T0, () => 0);
  const high = recordAction({ actedAt: [] }, T0, () => 0.999);
  assert.equal(Date.parse(low.nextAllowedAt!) - T0, PACE.minGapSeconds * 1000);
  assert.ok(Date.parse(high.nextAllowedAt!) - T0 < PACE.maxGapSeconds * 1000);
  const d = canActNow(low, T0 + 1000);
  assert.equal(d.ok, false);
  assert.equal(!d.ok && d.reason, "gap");
  assert.deepEqual(canActNow(low, T0 + PACE.minGapSeconds * 1000), { ok: true });
});

test("hourly and daily caps are enforced with a retry time", () => {
  const hour: PaceState = { actedAt: Array.from({ length: PACE.perHour }, (_, i) => at(-i * 60_000)) };
  const h = canActNow(hour, T0);
  assert.equal(!h.ok && h.reason, "hour");
  assert.equal(!h.ok && h.retryAt, Date.parse(hour.actedAt.at(-1)!) + 3_600_000);

  const day: PaceState = { actedAt: Array.from({ length: PACE.perDay }, (_, i) => at(-i * 5 * 60_000)) };
  const d = canActNow(day, T0);
  assert.equal(!d.ok && d.reason, "day");
});

test("old timestamps are pruned and an unused slot can be released", () => {
  const pruned = prunePace({ actedAt: [at(-25 * 3_600_000), at(-60_000)] }, T0);
  assert.deepEqual(pruned.actedAt, [at(-60_000)]);
  const reserved = recordAction({ actedAt: [] }, T0);
  const slot = reserved.actedAt[0];
  const released = releaseSlot(reserved, slot);
  assert.deepEqual(released, { actedAt: [], nextAllowedAt: undefined });
  assert.deepEqual(canActNow(released, T0), { ok: true });
});
