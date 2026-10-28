import { browser, defineContentScript } from "#imports";
import { t } from "../lib/i18n.ts";
import { isListed } from "../lib/matcher.ts";
import type { BackgroundMessage, ContentMessage, MayActReply, SiteState } from "../lib/messages.ts";
import { muteFromPost, notInterestedFromPost, overlayOpen } from "../lib/xui.ts";

// Collapses the posts of listed accounts as they appear (their own posts and their
// reposts) and, once a collapsed post is on screen, acts on it through X's own post
// menu: "Not interested in this post" on every post, or "Mute" once per account,
// depending on the setting. Also adds a one-click button on every other post that adds
// its author to the user's list.

const HIDDEN_ATTR = "data-blocklist-hidden";
const KEY_ATTR = "data-blocklist-key";
const STRIP_CLASS = "blocklist-strip";
const BUTTON_CLASS = "blocklist-quick";
const UNDO_MS = 5000;
// A person reads a little before acting: wait once the strip is on screen.
const READ_MIN_MS = 1500;
const READ_MAX_MS = 4000;
const RETRY_POLL_MS = 60_000;

type StripStatus = "hidden" | "soon" | "waiting" | "acting" | "done" | "failed" | "shown";

export default defineContentScript({
  matches: ["https://x.com/*"],
  runAt: "document_idle",
  main() {
    let state: SiteState = { set: { handles: [], ids: [] }, action: "notInterested", muted: [], notInterested: [] };
    const muted = new Set<string>();
    // posts already marked "not interested", by post id
    const marked = new Set<string>();
    // targets to leave alone for this page load (shown by the user, failed, or not possible here)
    const skipped = new Set<string>();
    const pending = new Set<string>();
    let busy = false;

    const send = (msg: ContentMessage) => browser.runtime.sendMessage(msg);
    const reload = async () => {
      state = (await send({ type: "state", site: "x" })) as SiteState;
      for (const h of state.muted) muted.add(h);
      for (const id of state.notInterested) marked.add(id);
      scan();
    };

    browser.runtime.onMessage.addListener((msg: BackgroundMessage) => {
      if (msg.type === "stateChanged") return reload();
    });

    injectStyle();
    void reload();

    let scheduled: number | undefined;
    new MutationObserver(() => {
      scheduled ??= window.setTimeout(() => {
        scheduled = undefined;
        scan();
      }, 150);
    }).observe(document.body, { childList: true, subtree: true });

    const onScreen = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const cell = e.target as HTMLElement;
          const handle = cell.getAttribute(HIDDEN_ATTR);
          const key = cell.getAttribute(KEY_ATTR);
          if (handle && key) void consider(cell, handle, key);
        }
      },
      { threshold: 0.5 },
    );

    // "Not interested in this post" only exists in the Home timeline; elsewhere the post is
    // just hidden, and X's menu is left alone. "Mute" is in the menu everywhere.
    const canActHere = () => state.action === "mute" || location.pathname === "/home";

    // The target of the action: the account in "mute" mode, the post in "not interested" mode.
    const keyFor = (article: HTMLElement, handle: string) => (state.action === "mute" ? handle : postIdOf(article));
    const alreadyDone = (handle: string, key: string) => (state.action === "mute" ? muted.has(handle) : marked.has(key));

    function scan() {
      for (const article of document.querySelectorAll<HTMLElement>('article[data-testid="tweet"]')) {
        const author = authorOf(article);
        if (!author) continue;
        const reposter = reposterOf(article);
        const listedAuthor = isListed(state.set, author);
        const listedReposter = Boolean(reposter && isListed(state.set, { handle: reposter }));
        if (!listedAuthor && !listedReposter) {
          addButton(article, author.handle);
          continue;
        }
        // The menu acts on the post's author, so a listed reposter's repost is only hidden.
        const key = listedAuthor ? keyFor(article, author.handle) : undefined;
        const cell = collapse(article, listedAuthor ? author.handle : (reposter as string), key);
        if (key && canActHere() && !alreadyDone(author.handle, key) && !skipped.has(key)) {
          cell.setAttribute(KEY_ATTR, key);
          setStatus(cell, "soon");
          onScreen.observe(cell);
        }
      }
    }

    // Hides the post inside its cell and shows a one-line strip in its place.
    function collapse(article: HTMLElement, handle: string, key?: string): HTMLElement {
      const cell = article.closest<HTMLElement>('[data-testid="cellInnerDiv"]') ?? article;
      article.style.display = "none";
      if (cell.getAttribute(HIDDEN_ATTR) === handle && cell.querySelector(`.${STRIP_CLASS}`)) return cell;
      cell.setAttribute(HIDDEN_ATTR, handle);
      cell.querySelector(`.${STRIP_CLASS}`)?.remove();
      const strip = document.createElement("div");
      strip.className = STRIP_CLASS;
      const label = document.createElement("span");
      label.className = "label";
      label.textContent = t("stripHidden", handle);
      const status = document.createElement("span");
      status.className = "status";
      const show = document.createElement("button");
      show.type = "button";
      show.className = "show";
      show.textContent = t("stripShow");
      show.addEventListener("click", () => {
        if (key) skipped.add(key);
        onScreen.unobserve(cell);
        article.style.display = "";
        setStatus(cell, "shown");
      });
      strip.append(label, status, show);
      cell.append(strip);
      setStatus(cell, key && alreadyDone(handle, key) ? "done" : "hidden");
      return cell;
    }

    function setStatus(cell: HTMLElement, status: StripStatus) {
      const strip = cell.querySelector<HTMLElement>(`.${STRIP_CLASS}`);
      if (!strip) return;
      strip.dataset.status = status;
      strip.querySelector<HTMLElement>(".status")!.textContent = t(status === "done" ? `strip_done_${state.action}` : `strip_${status}`);
      const show = strip.querySelector<HTMLElement>("button.show")!;
      show.style.display = status === "shown" || status === "done" || status === "acting" ? "none" : "";
    }

    // The collapsed post is on screen: read a moment, ask for a slot, then act.
    async function consider(cell: HTMLElement, handle: string, key: string) {
      if (pending.has(key) || alreadyDone(handle, key) || skipped.has(key)) return;
      pending.add(key);
      try {
        await sleep(READ_MIN_MS + Math.random() * (READ_MAX_MS - READ_MIN_MS));
        for (;;) {
          if (!cell.isConnected || skipped.has(key) || alreadyDone(handle, key)) return;
          if (!canActHere()) {
            setStatus(cell, "hidden");
            return;
          }
          // Another action is running, or the person has a menu open: not now.
          if (busy || overlayOpen()) {
            await sleep(1000);
            continue;
          }
          const reply = (await send({ type: "mayAct", site: "x", handle })) as MayActReply;
          if (reply.ok) return await act(cell, handle, key, reply.slot);
          setStatus(cell, "waiting");
          await sleep(Math.min(Math.max(reply.retryAt - Date.now(), 1000), RETRY_POLL_MS));
        }
      } finally {
        pending.delete(key);
      }
    }

    async function act(cell: HTMLElement, handle: string, key: string, slot: string) {
      const action = state.action;
      const postId = action === "notInterested" ? key : undefined;
      const article = cell.querySelector<HTMLElement>('article[data-testid="tweet"]');
      if (!article || !cell.isConnected) {
        await send({ type: "acted", site: "x", handle, action, postId, slot, result: "gone" });
        return;
      }
      busy = true;
      setStatus(cell, "acting");
      try {
        const outcome = action === "mute" ? await muteFromPost(article) : await notInterestedFromPost(article);
        if (outcome.ok) {
          (action === "mute" ? muted : marked).add(key);
          setStatus(cell, "done");
          await send({ type: "acted", site: "x", handle, action, postId, slot, result: "done" });
          return;
        }
        skipped.add(key);
        // A menu without the item (X changed it, or a timeline without "Not interested"):
        // the post stays hidden, nothing is logged.
        const quiet = outcome.reason === "gone" || (outcome.reason === "noItem" && action === "notInterested");
        setStatus(cell, quiet ? "hidden" : "failed");
        await send({ type: "acted", site: "x", handle, action, postId, slot, result: quiet ? "gone" : "failed", detail: outcome.reason });
      } finally {
        busy = false;
        onScreen.unobserve(cell);
      }
    }

    function addButton(article: HTMLElement, handle: string) {
      const nameBox = article.querySelector<HTMLElement>('[data-testid="User-Name"]');
      if (!nameBox || nameBox.querySelector(`.${BUTTON_CLASS}`)) return;
      const btn = document.createElement("button");
      btn.className = BUTTON_CLASS;
      btn.type = "button";
      btn.title = t("quickTitle", handle);
      btn.textContent = "⛔";
      btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        void quickHide(article, handle);
      });
      nameBox.appendChild(btn);
    }

    // Adds the author to the user's list; the next scan collapses the post and acts on
    // it like any listed account's. Undo is offered for a moment.
    async function quickHide(article: HTMLElement, handle: string) {
      const cell = article.closest<HTMLElement>('[data-testid="cellInnerDiv"]') ?? article;
      const key = keyFor(article, handle);
      if (key) skipped.add(key);
      await send({ type: "quickHide", site: "x", handle });
      const bar = document.createElement("div");
      bar.className = "blocklist-undo";
      bar.append(`${t("quickAdded", handle)} `);
      const undo = document.createElement("button");
      undo.type = "button";
      undo.textContent = t("undo");
      bar.appendChild(undo);
      cell.prepend(bar);
      const timer = window.setTimeout(() => {
        bar.remove();
        if (key) skipped.delete(key);
        scan();
      }, UNDO_MS);
      undo.addEventListener("click", async () => {
        window.clearTimeout(timer);
        bar.remove();
        await send({ type: "undoQuickHide", site: "x", handle });
      });
    }
  },
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const HANDLE_PATH = /^\/([A-Za-z0-9_]{1,15})$/;

// The author handle is the "@name" link inside the post header.
function authorOf(article: HTMLElement): { handle: string } | undefined {
  const nameBox = article.querySelector('[data-testid="User-Name"]');
  if (!nameBox) return undefined;
  for (const a of nameBox.querySelectorAll<HTMLAnchorElement>('a[href^="/"]')) {
    const handle = a.getAttribute("href")?.match(HANDLE_PATH)?.[1];
    if (handle && a.textContent?.trim().startsWith("@")) return { handle: handle.toLowerCase() };
  }
  return undefined;
}

// The post id is in the permalink that wraps the post's time.
function postIdOf(article: HTMLElement): string | undefined {
  const link = article.querySelector("time")?.closest<HTMLAnchorElement>('a[href*="/status/"]');
  return link?.getAttribute("href")?.match(/\/status\/(\d+)/)?.[1];
}

// A repost shows "<name> reposted" above the post, linking to the reposter's profile.
function reposterOf(article: HTMLElement): string | undefined {
  const context = article.querySelector<HTMLElement>('[data-testid="socialContext"]');
  if (!context) return undefined;
  const link = context.closest<HTMLAnchorElement>('a[href^="/"]') ?? context.querySelector<HTMLAnchorElement>('a[href^="/"]');
  return link?.getAttribute("href")?.match(HANDLE_PATH)?.[1]?.toLowerCase();
}

function injectStyle() {
  const style = document.createElement("style");
  style.textContent = `
    .${BUTTON_CLASS} { background: none; border: 0; cursor: pointer; font-size: 12px; margin-left: 6px; opacity: .35; }
    .${BUTTON_CLASS}:hover { opacity: 1; }
    .${STRIP_CLASS} { display: flex; gap: 10px; align-items: center; padding: 6px 16px; font: 13px system-ui, sans-serif; color: #71767b; border-bottom: 1px solid rgba(128,128,128,.25); }
    .${STRIP_CLASS} .label { font-weight: 600; }
    .${STRIP_CLASS} .status { flex: 1; }
    .${STRIP_CLASS}[data-status="done"] .status { color: #00ba7c; }
    .${STRIP_CLASS}[data-status="failed"] .status { color: #f4212e; }
    .${STRIP_CLASS} button { background: none; border: 1px solid rgba(128,128,128,.5); border-radius: 999px; color: inherit; font: inherit; font-size: 12px; padding: 1px 8px; cursor: pointer; }
    .blocklist-undo { padding: 8px 16px; font: 13px system-ui, sans-serif; color: #71767b; border-bottom: 1px solid rgba(128,128,128,.25); }
    .blocklist-undo button { margin-left: 6px; cursor: pointer; }
  `;
  document.head.appendChild(style);
}
