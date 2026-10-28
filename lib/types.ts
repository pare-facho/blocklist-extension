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

// What happens to a listed account's post once it is collapsed and on screen. Both go
// through X's own post menu, with the user's session; the extension never calls X itself.
// "notInterested": "Not interested in this post", on every post X serves. Nothing is
//                  blocked or muted, so X keeps serving the account and each new post
//                  sends a new signal.
// "mute":          "Mute", once per account. X then stops showing the account.
export type Action = "notInterested" | "mute";
export const ACTIONS: readonly Action[] = ["notInterested", "mute"];

export type Settings = {
  feedRefreshHours: number;
  action: Action;
};

export const DEFAULT_SETTINGS: Settings = {
  feedRefreshHours: 6,
  action: "notInterested",
};

// Timestamps of the actions done on X, for the pacing rules (see pacing.ts).
export type PaceState = {
  actedAt: string[];
  nextAllowedAt?: string;
};

// One action the extension made (or tried) on X, kept so it is never repeated and so
// the settings page can show it. "notInterested" entries carry the post id.
export type ActedEntry = {
  site: Site;
  handle: string;
  action: Action;
  postId?: string;
  at: string;
  result: "done" | "failed";
  detail?: string;
};
