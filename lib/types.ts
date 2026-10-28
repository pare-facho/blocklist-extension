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

// What happens to a listed account's post when it shows on screen:
// "block": the post is collapsed and the account is blocked through X's own menu;
// "hide": the post is collapsed, nothing is sent to X.
export type Action = "block" | "hide";

export type Settings = {
  feedRefreshHours: number;
  action: Action;
};

export const DEFAULT_SETTINGS: Settings = {
  feedRefreshHours: 6,
  action: "block",
};

// Timestamps of the actions done on X, for the pacing rules (see pacing.ts).
export type PaceState = {
  actedAt: string[];
  nextAllowedAt?: string;
};

// One account the extension acted on, kept so it is never tried twice and so the
// settings page can show it.
export type ActedEntry = {
  site: Site;
  handle: string;
  at: string;
  result: "blocked" | "failed";
  detail?: string;
};
