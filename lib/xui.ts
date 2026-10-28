// Drives X's own post menu the way a person does: open the "More" menu of a post and
// pick an item. Everything goes through X's page and X's requests, with the user's
// session; the extension itself never calls X.
//
// Hooks: X's stable test ids where they exist, the item's visible label otherwise
// (see xlabels.ts for the labels, in every language X ships them in):
//   [data-testid="caret"]                      the "More" button of a post
//   [data-testid="Dropdown"]                   the open menu
//   [role="menuitem"]                          its items ("Not interested in this post", "Mute", …)
//   [data-testid="confirmationSheetDialog"]    a confirmation sheet, if X asks for one
//   [data-testid="confirmationSheetConfirm"]   its confirm button

import { MUTE_LABELS, NOT_INTERESTED_LABELS, matchesLabel } from "./xlabels.ts";

export type MenuOutcome =
  | { ok: true }
  | { ok: false; reason: "gone" | "noMenu" | "noItem" | "notClosed" };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const between = (min: number, max: number) => min + Math.random() * (max - min);

export async function waitFor<T>(probe: () => T | null | undefined | false, timeoutMs: number): Promise<T | undefined> {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const found = probe();
    if (found) return found;
    if (Date.now() >= end) return undefined;
    await sleep(100);
  }
}

const menu = () => document.querySelector<HTMLElement>('[data-testid="Dropdown"]');
const confirmButton = () => document.querySelector<HTMLElement>('[data-testid="confirmationSheetConfirm"]');
const dialog = () => document.querySelector<HTMLElement>('[data-testid="confirmationSheetDialog"], [role="alertdialog"], [role="dialog"]');

// True while a menu or a sheet is open on the page, which means the person is using
// one: the extension must not open its own menu over it.
export const overlayOpen = () => Boolean(menu() || dialog());

// X closes a menu or a sheet on a pointer press outside it. A bare click() on the
// backdrop is ignored, so the full press sequence is sent.
function pressOutside(): void {
  const open = menu() ?? dialog();
  const layers = document.querySelector("#layers");
  const backdrop =
    layers &&
    [...layers.querySelectorAll<HTMLElement>("div")].find((d) => {
      if (open && (d === open || d.contains(open))) return false;
      const r = d.getBoundingClientRect();
      return r.width > window.innerWidth * 0.9 && r.height > window.innerHeight * 0.9;
    });
  const target = backdrop ?? document.body;
  for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"] as const) {
    const init = { bubbles: true, cancelable: true, composed: true, button: 0, buttons: type.endsWith("down") ? 1 : 0, clientX: 2, clientY: 300 };
    target.dispatchEvent(type.startsWith("pointer") ? new PointerEvent(type, init) : new MouseEvent(type, init));
  }
}

export async function closeOverlays(): Promise<void> {
  for (let i = 0; i < 2 && (menu() || dialog()); i++) {
    pressOutside();
    await sleep(400);
  }
}

// Opens the menu of `article` and clicks the item whose label is in `labels`. If X then
// asks for a confirmation, confirms. Resolves once X has closed everything, which is
// when its request has been sent.
async function pickFromMenu(article: HTMLElement, labels: readonly string[]): Promise<MenuOutcome> {
  if (!article.isConnected) return { ok: false, reason: "gone" };
  const caret = article.querySelector<HTMLElement>('[data-testid="caret"]');
  if (!caret) return { ok: false, reason: "noMenu" };
  const findItem = () => {
    const items = menu()?.querySelectorAll<HTMLElement>('[role="menuitem"]');
    return items && [...items].find((i) => matchesLabel(i.innerText, labels));
  };
  let item: HTMLElement | undefined;
  // While X is still rendering, a click on the caret can do nothing; one more try.
  for (let attempt = 0; attempt < 2 && !item; attempt++) {
    if (attempt) await sleep(between(800, 1500));
    if (!article.isConnected) return { ok: false, reason: "gone" };
    caret.click();
    item = await waitFor(findItem, 2500);
    if (!item && menu()) break;
  }
  if (!item) {
    const opened = Boolean(menu());
    await closeOverlays();
    return { ok: false, reason: opened ? "noItem" : "noMenu" };
  }
  await sleep(between(500, 1100));
  item.click();
  const next = await waitFor(() => (confirmButton() ? "confirm" : menu() ? null : "closed"), 2500);
  if (next === "confirm") {
    await sleep(between(400, 900));
    confirmButton()?.click();
  }
  const closed = await waitFor(() => !menu() && !confirmButton(), 3000);
  if (!closed) {
    await closeOverlays();
    return { ok: false, reason: "notClosed" };
  }
  return { ok: true };
}

// "Not interested in this post": X replaces the post by its own feedback cell, with Undo.
export const notInterestedFromPost = (article: HTMLElement) => pickFromMenu(article, NOT_INTERESTED_LABELS);

// "Mute": X mutes the post's author at once (no confirmation on the web client today).
export const muteFromPost = (article: HTMLElement) => pickFromMenu(article, MUTE_LABELS);
