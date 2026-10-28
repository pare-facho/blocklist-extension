// Drives X's own post menu the way a person does: open the "More" menu of a post,
// choose "Block", confirm. Everything goes through X's page and X's requests, with
// the user's session; the extension itself never calls X.
//
// The hooks are X's stable test ids, not the visible labels, so the language of
// the X interface does not matter:
//   [data-testid="caret"]                      the "More" button of a post
//   [data-testid="Dropdown"]                   the open menu
//   [role="menuitem"][data-testid="block"]     "Block @handle"
//   [data-testid="confirmationSheetDialog"]    the confirmation sheet (role "alertdialog")
//   [data-testid="confirmationSheetConfirm"]   its "Block" button

export type BlockOutcome =
  | { ok: true }
  | { ok: false; reason: "gone" | "noMenu" | "noBlockItem" | "noConfirm" | "notClosed" };

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

// Blocks the author of `article` through the post's own menu. Resolves once X has
// closed the confirmation, which is when its block request has been sent.
export async function blockFromPost(article: HTMLElement): Promise<BlockOutcome> {
  if (!article.isConnected) return { ok: false, reason: "gone" };
  const caret = article.querySelector<HTMLElement>('[data-testid="caret"]');
  if (!caret) return { ok: false, reason: "noMenu" };
  caret.click();
  const item = await waitFor(() => menu()?.querySelector<HTMLElement>('[role="menuitem"][data-testid="block"]'), 2500);
  if (!item) {
    const opened = Boolean(menu());
    await closeOverlays();
    return { ok: false, reason: opened ? "noBlockItem" : "noMenu" };
  }
  await sleep(between(500, 1100));
  item.click();
  const confirm = await waitFor(confirmButton, 2500);
  if (!confirm) {
    await closeOverlays();
    return { ok: false, reason: "noConfirm" };
  }
  await sleep(between(400, 900));
  confirm.click();
  const closed = await waitFor(() => !confirmButton(), 3000);
  if (!closed) {
    await closeOverlays();
    return { ok: false, reason: "notClosed" };
  }
  return { ok: true };
}
