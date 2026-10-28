import type { PaceState } from "./types.ts";

// How fast the extension may act on X with the user's session. The numbers are
// fixed: they keep the rhythm of a person who blocks as they scroll, which is
// also what keeps the account out of the automated-activity filters.
export const PACE = {
  perHour: 30,
  perDay: 150,
  minGapSeconds: 15,
  maxGapSeconds: 45,
};

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export type PaceDecision = { ok: true } | { ok: false; reason: "day" | "hour" | "gap"; retryAt: number };

// Drops timestamps older than a day so the state stays small.
export function prunePace(pace: PaceState, now: number): PaceState {
  return { ...pace, actedAt: pace.actedAt.filter((t) => now - Date.parse(t) < DAY) };
}

export function canActNow(pace: PaceState, now: number): PaceDecision {
  const times = pace.actedAt.map((t) => Date.parse(t)).sort((a, b) => a - b);
  const lastDay = times.filter((t) => now - t < DAY);
  const lastHour = times.filter((t) => now - t < HOUR);
  if (lastDay.length >= PACE.perDay) return { ok: false, reason: "day", retryAt: (lastDay[0] ?? now) + DAY };
  if (lastHour.length >= PACE.perHour) return { ok: false, reason: "hour", retryAt: (lastHour[0] ?? now) + HOUR };
  const next = pace.nextAllowedAt ? Date.parse(pace.nextAllowedAt) : 0;
  if (now < next) return { ok: false, reason: "gap", retryAt: next };
  return { ok: true };
}

// After an action: remember it and draw the next random gap.
export function recordAction(pace: PaceState, now: number, random = Math.random): PaceState {
  const gapMs = (PACE.minGapSeconds + random() * (PACE.maxGapSeconds - PACE.minGapSeconds)) * 1000;
  return prunePace(
    { actedAt: [...pace.actedAt, new Date(now).toISOString()], nextAllowedAt: new Date(now + gapMs).toISOString() },
    now,
  );
}

// A reserved slot that was not used (the post left the screen): free it again.
export function releaseSlot(pace: PaceState, reservedAt: string): PaceState {
  const i = pace.actedAt.lastIndexOf(reservedAt);
  if (i < 0) return pace;
  return { actedAt: pace.actedAt.filter((_, j) => j !== i), nextAllowedAt: undefined };
}
