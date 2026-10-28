import type { HideSet } from "./matcher.ts";
import type { Action, Site } from "./types.ts";

// What a content script needs to run: the accounts to hide, what to do with them,
// and the accounts already blocked (never tried twice).
export type SiteState = { set: HideSet; action: Action; blocked: string[] };

// Content script -> background
export type ContentMessage =
  | { type: "state"; site: Site }
  | { type: "quickHide"; site: Site; handle: string; id?: string; name?: string }
  | { type: "undoQuickHide"; site: Site; handle: string }
  // asks for a slot in the pacing rules before acting on X; the slot is reserved when ok
  | { type: "mayAct"; site: Site; handle: string }
  // reports what happened with a reserved slot
  | { type: "acted"; site: Site; handle: string; slot: string; result: "blocked" | "failed" | "gone"; detail?: string };

export type MayActReply = { ok: true; slot: string } | { ok: false; reason: "day" | "hour" | "gap"; retryAt: number };

// Options page -> background
export type OptionsMessage = { type: "subscribe"; url: string } | { type: "refreshFeeds" } | { type: "settingsChanged" };

// Background -> content script
export type BackgroundMessage = { type: "stateChanged" };

export type Message = ContentMessage | OptionsMessage | BackgroundMessage;
export type { HideSet };
