import { browser, defineContentScript } from "#imports";
import { t } from "../lib/i18n.ts";
import { isListed } from "../lib/matcher.ts";
import type { BackgroundMessage, ContentMessage, MayActReply, SiteState } from "../lib/messages.ts";
import { blockFromPost } from "../lib/xui.ts";

// Collapses the posts of listed accounts as they appear (their own posts and their
// reposts) and, in "block" mode, blocks the author through X's own post menu once
// the collapsed post is on screen. Also adds a one-click button on every other post
// that adds its author to the user's list.

const HIDDEN_ATTR = "data-blocklist-hidden";
const STRIP_CLASS = "blocklist-strip";
const BUTTON_CLASS = "blocklist-quick";
const UNDO_MS = 5000;
// A person reads a little before acting: wait once the strip is on screen.
const READ_MIN_MS = 1500;
const READ_MAX_MS = 4000;
const RETRY_POLL_MS = 60_000;

type StripStatus = "hidden" | "soon" | "waiting" | "blocking" | "blocked" | "failed" | "shown";

export default defineContentScript({
  matches: ["https://x.com/*"],
  runAt: "document_idle",
  main() {
    let state: SiteState = { set: { handles: [], ids: [] }, action: "hide", blocked: [] };
    const blocked = new Set<string>();
    // handles the user asked to leave alone, or that failed, for this page load
    const skipped = new Set<string>();
    const pending = new Set<string>();
    let busy = false;

    const send = (msg: ContentMessage) => browser.runtime.sendMessage(msg);
    const reload = async () => {
      state = (await send({ type: "state", site: "x" })) as SiteState;
      for (const h of state.blocked) blocked.add(h);
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
          if (handle) void consider(cell, handle);
        }
      },
      { threshold: 0.5 },
    );

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
        const cell = collapse(article, listedAuthor ? author.handle : (reposter as string));
        // Blocking from the menu targets the post's author, so a listed reposter's repost is only hidden.
        if (listedAuthor && state.action === "block" && !blocked.has(author.handle) && !skipped.has(author.handle)) {
          setStatus(cell, "soon");
          onScreen.observe(cell);
        }
      }
    }

    // Hides the post inside its cell and shows a one-line strip in its place.
    function collapse(article: HTMLElement, handle: string): HTMLElement {
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
        skipped.add(handle);
        onScreen.unobserve(cell);
        article.style.display = "";
        setStatus(cell, "shown");
      });
      const keep = document.createElement("button");
      keep.type = "button";
      keep.className = "keep";
      keep.textContent = t("stripNoBlock");
      keep.addEventListener("click", () => {
        skipped.add(handle);
        onScreen.unobserve(cell);
        setStatus(cell, "hidden");
      });
      strip.append(label, status, show, keep);
      cell.append(strip);
      setStatus(cell, blocked.has(handle) ? "blocked" : "hidden");
      return cell;
    }

    function setStatus(cell: HTMLElement, status: StripStatus) {
      const strip = cell.querySelector<HTMLElement>(`.${STRIP_CLASS}`);
      if (!strip) return;
      strip.dataset.status = status;
      strip.querySelector<HTMLElement>(".status")!.textContent = t(`strip_${status}`);
      const keep = strip.querySelector<HTMLElement>(".keep")!;
      keep.style.display = status === "soon" || status === "waiting" ? "" : "none";
      const show = strip.querySelector<HTMLElement>("button.show")!;
      show.style.display = status === "shown" || status === "blocked" || status === "blocking" ? "none" : "";
    }

    // The collapsed post is on screen: read a moment, ask for a slot, then block.
    async function consider(cell: HTMLElement, handle: string) {
      if (pending.has(handle) || blocked.has(handle) || skipped.has(handle)) return;
      pending.add(handle);
      try {
        await sleep(READ_MIN_MS + Math.random() * (READ_MAX_MS - READ_MIN_MS));
        for (;;) {
          if (!cell.isConnected || skipped.has(handle) || blocked.has(handle)) return;
          if (busy) {
            await sleep(1000);
            continue;
          }
          const reply = (await send({ type: "mayAct", site: "x", handle })) as MayActReply;
          if (reply.ok) return await act(cell, handle, reply.slot);
          setStatus(cell, "waiting");
          await sleep(Math.min(Math.max(reply.retryAt - Date.now(), 1000), RETRY_POLL_MS));
        }
      } finally {
        pending.delete(handle);
      }
    }

    async function act(cell: HTMLElement, handle: string, slot: string) {
      const article = cell.querySelector<HTMLElement>('article[data-testid="tweet"]');
      if (!article || !cell.isConnected) {
        await send({ type: "acted", site: "x", handle, slot, result: "gone" });
        return;
      }
      busy = true;
      setStatus(cell, "blocking");
      try {
        const outcome = await blockFromPost(article);
        if (outcome.ok) {
          blocked.add(handle);
          setStatus(cell, "blocked");
          await send({ type: "acted", site: "x", handle, slot, result: "blocked" });
        } else {
          skipped.add(handle);
          setStatus(cell, outcome.reason === "gone" ? "hidden" : "failed");
          await send({ type: "acted", site: "x", handle, slot, result: outcome.reason === "gone" ? "gone" : "failed", detail: outcome.reason });
        }
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
      btn.title = t(state.action === "block" ? "quickTitleBlock" : "quickTitle", handle);
      btn.textContent = "⛔";
      btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        void quickHide(article, handle);
      });
      nameBox.appendChild(btn);
    }

    // Adds the author to the user's list; the next scan collapses the post and, in
    // block mode, blocks the account like any listed one. Undo is offered for a moment.
    async function quickHide(article: HTMLElement, handle: string) {
      const cell = article.closest<HTMLElement>('[data-testid="cellInnerDiv"]') ?? article;
      skipped.add(handle);
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
        skipped.delete(handle);
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
    .${STRIP_CLASS}[data-status="blocked"] .status { color: #00ba7c; }
    .${STRIP_CLASS}[data-status="failed"] .status { color: #f4212e; }
    .${STRIP_CLASS} button { background: none; border: 1px solid rgba(128,128,128,.5); border-radius: 999px; color: inherit; font: inherit; font-size: 12px; padding: 1px 8px; cursor: pointer; }
    .blocklist-undo { padding: 8px 16px; font: 13px system-ui, sans-serif; color: #71767b; border-bottom: 1px solid rgba(128,128,128,.25); }
    .blocklist-undo button { margin-left: 6px; cursor: pointer; }
  `;
  document.head.appendChild(style);
}
