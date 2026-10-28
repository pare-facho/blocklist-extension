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
  feedRefreshHours: number;
};

export const DEFAULT_SETTINGS: Settings = {
  feedRefreshHours: 6,
};
