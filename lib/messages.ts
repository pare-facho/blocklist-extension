import type { HideSet } from "./matcher.ts";
import type { Action, Site } from "./types.ts";

// What a content script needs to run: the accounts to hide, what to do with them, the
// accounts already muted and the posts already marked "not interested" (never twice).
export type SiteState = { set: HideSet; action: Action; muted: string[]; notInterested: string[] };

// Content script -> background
export type ContentMessage =
  | { type: "state"; site: Site }
  | { type: "quickHide"; site: Site; handle: string; id?: string; name?: string }
  | { type: "undoQuickHide"; site: Site; handle: string }
  // asks for a slot in the pacing rules before acting on X; the slot is reserved when ok
  | { type: "mayAct"; site: Site; handle: string }
  // reports what happened with a reserved slot ("gone": nothing was sent, the slot is given back)
  | { type: "acted"; site: Site; handle: string; action: Action; postId?: string; slot: string; result: "done" | "failed" | "gone"; detail?: string };

export type MayActReply = { ok: true; slot: string } | { ok: false; reason: "day" | "hour" | "gap"; retryAt: number };

// Options page -> background
export type OptionsMessage = { type: "subscribe"; url: string } | { type: "refreshFeeds" } | { type: "settingsChanged" };

// Background -> content script
export type BackgroundMessage = { type: "stateChanged" };

export type Message = ContentMessage | OptionsMessage | BackgroundMessage;
export type { HideSet };
