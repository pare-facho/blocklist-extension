import { browser, defineContentScript } from "#imports";
import { isListed, type BlockSet } from "../lib/matcher.ts";
import type { BackgroundMessage, BlockResult, ContentMessage } from "../lib/messages.ts";
import { blockOnX } from "../lib/x-api.ts";

// Hides posts from listed accounts as they appear, adds a one-click block button,
// and performs the real block when the background asks for it.

const HIDDEN_ATTR = "data-blocklist-hidden";
const BUTTON_CLASS = "blocklist-quick";
const UNDO_MS = 5000;

export default defineContentScript({
  matches: ["https://x.com/*"],
  runAt: "document_idle",
  main() {
    let set: BlockSet = { handles: [], ids: [] };

    const send = (msg: ContentMessage) => browser.runtime.sendMessage(msg);
    const reload = async () => {
      set = (await send({ type: "blockset", site: "x" })) as BlockSet;
      scan();
    };

    browser.runtime.onMessage.addListener((msg: BackgroundMessage) => {
      if (msg.type === "blocksetChanged") return reload();
      if (msg.type === "x:block") return blockOnX({ handle: msg.handle, id: msg.id }) as Promise<BlockResult>;
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

    function scan() {
      for (const article of document.querySelectorAll<HTMLElement>('article[data-testid="tweet"]')) {
        const author = authorOf(article);
        if (!author) continue;
        if (isListed(set, author)) hide(article, author.handle);
        else addButton(article, author.handle);
      }
    }

    function hide(article: HTMLElement, handle: string) {
      const cell = article.closest<HTMLElement>('[data-testid="cellInnerDiv"]') ?? article;
      if (cell.getAttribute(HIDDEN_ATTR)) return;
      cell.setAttribute(HIDDEN_ATTR, handle);
      cell.style.display = "none";
    }

    function addButton(article: HTMLElement, handle: string) {
      const nameBox = article.querySelector<HTMLElement>('[data-testid="User-Name"]');
      if (!nameBox || nameBox.querySelector(`.${BUTTON_CLASS}`)) return;
      const btn = document.createElement("button");
      btn.className = BUTTON_CLASS;
      btn.type = "button";
      btn.title = `Block @${handle} (one click, undo for 5 s)`;
      btn.textContent = "⛔";
      btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        void quickBlock(article, handle);
      });
      nameBox.appendChild(btn);
    }

    async function quickBlock(article: HTMLElement, handle: string) {
      const cell = article.closest<HTMLElement>('[data-testid="cellInnerDiv"]') ?? article;
      await send({ type: "quickBlock", site: "x", handle });
      cell.style.display = "none";
      cell.setAttribute(HIDDEN_ATTR, handle);

      const bar = document.createElement("div");
      bar.className = "blocklist-undo";
      bar.append(`@${handle} added to your block list. `);
      const undo = document.createElement("button");
      undo.type = "button";
      undo.textContent = "Undo";
      bar.appendChild(undo);
      cell.insertAdjacentElement("beforebegin", bar);
      const timer = window.setTimeout(() => bar.remove(), UNDO_MS);
      undo.addEventListener("click", async () => {
        window.clearTimeout(timer);
        bar.remove();
        await send({ type: "undoQuickBlock", site: "x", handle });
        cell.removeAttribute(HIDDEN_ATTR);
        cell.style.display = "";
      });
    }
  },
});

// The author handle is the "@name" link inside the post header.
function authorOf(article: HTMLElement): { handle: string } | undefined {
  const nameBox = article.querySelector('[data-testid="User-Name"]');
  if (!nameBox) return undefined;
  for (const a of nameBox.querySelectorAll<HTMLAnchorElement>('a[href^="/"]')) {
    const handle = a.getAttribute("href")?.match(/^\/([A-Za-z0-9_]{1,15})$/)?.[1];
    if (handle && a.textContent?.trim().startsWith("@")) return { handle: handle.toLowerCase() };
  }
  return undefined;
}

function injectStyle() {
  const style = document.createElement("style");
  style.textContent = `
    .${BUTTON_CLASS} { background: none; border: 0; cursor: pointer; font-size: 12px; margin-left: 6px; opacity: .35; }
    .${BUTTON_CLASS}:hover { opacity: 1; }
    .blocklist-undo { padding: 8px 16px; font: 13px system-ui, sans-serif; color: #536471; border-bottom: 1px solid #eff3f4; }
    .blocklist-undo button { margin-left: 6px; cursor: pointer; }
  `;
  document.head.appendChild(style);
}
