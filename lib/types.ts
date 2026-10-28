export const SITES = ["x", "threads", "instagram"] as const;
export type Site = (typeof SITES)[number];

export function isSite(value: string): value is Site {
  return (SITES as readonly string[]).includes(value);
}

// One account on one network, as published in a feed (format "blocklist/1").
export type FeedEntry = {
  site: string;
  handle: string;
  id?: string;
  name?: string;
  category?: string;
  reason?: string;
  source?: string;
};

export type Feed = {
  format: "blocklist/1";
  name: string;
  description?: string;
  homepage?: string;
  updated: string;
  entries: FeedEntry[];
};

export type Subscription = {
  id: string;
  url: string;
  name: string;
  enabled: boolean;
  entries: FeedEntry[];
  etag?: string;
  updated?: string;
  lastFetched?: string;
  lastError?: string;
};

export type Settings = {
  blockingEnabled: boolean;
  paused: boolean;
  perHour: number;
  perDay: number;
  minGapSeconds: number;
  maxGapSeconds: number;
  feedRefreshHours: number;
};

export const DEFAULT_SETTINGS: Settings = {
  blockingEnabled: true,
  paused: false,
  perHour: 300,
  perDay: 1000,
  minGapSeconds: 5,
  maxGapSeconds: 15,
  feedRefreshHours: 6,
};

// pending: block to do · done: blocked by the extension · unblocking: the account left
// every list, unblock to do · unblocked: unblock done · failed/skipped: block given up.
export type TaskStatus = "pending" | "done" | "failed" | "skipped" | "unblocking" | "unblocked";

export type QueueTask = {
  key: string; // `${site}:${handle}`
  site: Site;
  handle: string;
  id?: string;
  origin: "list" | "quick";
  status: TaskStatus;
  attempts: number;
  createdAt: string;
  doneAt?: string;
  lastError?: string;
};

// Timestamps of successful blocks in the last 24 h, plus the earliest moment the next one may run.
export type PaceState = {
  blockedAt: string[];
  nextAllowedAt?: string;
};

export function taskKey(site: Site, handle: string): string {
  return `${site}:${handle.toLowerCase()}`;
}
