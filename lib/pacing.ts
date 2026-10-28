import type { PaceState, Settings } from "./types.ts";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export type PaceDecision = { ok: true } | { ok: false; reason: string; retryAt: number };

// Drops timestamps older than a day so the state stays small.
export function prunePace(pace: PaceState, now: number): PaceState {
  return { ...pace, blockedAt: pace.blockedAt.filter((t) => now - Date.parse(t) < DAY) };
}

export function canBlockNow(settings: Settings, pace: PaceState, now: number): PaceDecision {
  const times = pace.blockedAt.map((t) => Date.parse(t)).sort((a, b) => a - b);
  const lastDay = times.filter((t) => now - t < DAY);
  const lastHour = times.filter((t) => now - t < HOUR);
  if (lastDay.length >= settings.perDay) {
    return { ok: false, reason: `daily limit (${settings.perDay}) reached`, retryAt: (lastDay[0] ?? now) + DAY };
  }
  if (lastHour.length >= settings.perHour) {
    return { ok: false, reason: `hourly limit (${settings.perHour}) reached`, retryAt: (lastHour[0] ?? now) + HOUR };
  }
  const next = pace.nextAllowedAt ? Date.parse(pace.nextAllowedAt) : 0;
  if (now < next) return { ok: false, reason: "waiting for the random gap", retryAt: next };
  return { ok: true };
}

// After a successful block: remember it and draw the next random gap.
export function recordBlock(settings: Settings, pace: PaceState, now: number, random = Math.random): PaceState {
  const min = Math.max(0, settings.minGapSeconds);
  const max = Math.max(min, settings.maxGapSeconds);
  const gapMs = (min + random() * (max - min)) * 1000;
  return prunePace(
    { blockedAt: [...pace.blockedAt, new Date(now).toISOString()], nextAllowedAt: new Date(now + gapMs).toISOString() },
    now,
  );
}

// After the site answered "too many requests": back off until it says we may retry.
export function backOff(pace: PaceState, until: number): PaceState {
  const current = pace.nextAllowedAt ? Date.parse(pace.nextAllowedAt) : 0;
  return { ...pace, nextAllowedAt: new Date(Math.max(current, until)).toISOString() };
}
