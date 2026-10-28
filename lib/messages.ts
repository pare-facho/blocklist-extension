import type { HideSet } from "./matcher.ts";
import type { Site } from "./types.ts";

// Content script -> background
export type ContentMessage =
  | { type: "hideset"; site: Site }
  | { type: "quickHide"; site: Site; handle: string; id?: string; name?: string }
  | { type: "undoQuickHide"; site: Site; handle: string };

// Options page -> background
export type OptionsMessage = { type: "subscribe"; url: string } | { type: "refreshFeeds" };

// Background -> content script
export type BackgroundMessage = { type: "hidesetChanged" };

export type Message = ContentMessage | OptionsMessage | BackgroundMessage;
export type { HideSet };
