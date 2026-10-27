import type { BlockSet } from "./matcher.ts";
import type { Site } from "./types.ts";

// Content script -> background
export type ContentMessage =
  | { type: "blockset"; site: Site }
  | { type: "quickBlock"; site: Site; handle: string; id?: string; name?: string }
  | { type: "undoQuickBlock"; site: Site; handle: string };

// Options page -> background
export type OptionsMessage =
  | { type: "subscribe"; url: string }
  | { type: "refreshFeeds" }
  | { type: "tick" };

// Background -> content script
export type BackgroundMessage =
  | { type: "blocksetChanged" }
  | { type: "x:block"; handle: string; id?: string };

export type BlockResult =
  | { ok: true; id?: string; handle: string }
  | { ok: false; kind: "rateLimited"; retryAt?: number }
  | { ok: false; kind: "notLoggedIn" }
  | { ok: false; kind: "notFound" }
  | { ok: false; kind: "error"; error: string };

export type Message = ContentMessage | OptionsMessage | BackgroundMessage;
export type { BlockSet };
