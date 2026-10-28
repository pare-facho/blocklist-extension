import { browser, defineContentScript } from "#imports";
import { t } from "../lib/i18n.ts";
import { isListed, type HideSet } from "../lib/matcher.ts";
import type { BackgroundMessage, ContentMessage } from "../lib/messages.ts";

// Hides posts from listed accounts as they appear (their own posts and their reposts)
// and adds a one-click button that hides an author and adds them to the user's list.

const HIDDEN_ATTR = "data-blocklist-hidden";
const BUTTON_CLASS = "blocklist-quick";
const UNDO_MS = 5000;

export default defineContentScript({
  matches: ["https://x.com/*"],
  runAt: "document_idle",
  main() {
    let set: HideSet = { handles: [], ids: [] };

    const send = (msg: ContentMessage) => browser.runtime.sendMessage(msg);
    const reload = async () => {
      set = (await send({ type: "hideset", site: "x" })) as HideSet;
      scan();
    };

    browser.runtime.onMessage.addListener((msg: BackgroundMessage) => {
      if (msg.type === "hidesetChanged") return reload();
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
        const reposter = reposterOf(article);
        if (isListed(set, author) || (reposter && isListed(set, { handle: reposter }))) hide(article, author.handle);
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
      btn.title = t("quickTitle", handle);
      btn.textContent = "⛔";
      btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        void quickHide(article, handle);
      });
      nameBox.appendChild(btn);
    }

    async function quickHide(article: HTMLElement, handle: string) {
      const cell = article.closest<HTMLElement>('[data-testid="cellInnerDiv"]') ?? article;
      await send({ type: "quickHide", site: "x", handle });
      cell.style.display = "none";
      cell.setAttribute(HIDDEN_ATTR, handle);

      const bar = document.createElement("div");
      bar.className = "blocklist-undo";
      bar.append(`${t("quickAdded", handle)} `);
      const undo = document.createElement("button");
      undo.type = "button";
      undo.textContent = t("undo");
      bar.appendChild(undo);
      cell.insertAdjacentElement("beforebegin", bar);
      const timer = window.setTimeout(() => bar.remove(), UNDO_MS);
      undo.addEventListener("click", async () => {
        window.clearTimeout(timer);
        bar.remove();
        await send({ type: "undoQuickHide", site: "x", handle });
        cell.removeAttribute(HIDDEN_ATTR);
        cell.style.display = "";
      });
    }
  },
});

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
    .blocklist-undo { padding: 8px 16px; font: 13px system-ui, sans-serif; color: #536471; border-bottom: 1px solid #eff3f4; }
    .blocklist-undo button { margin-left: 6px; cursor: pointer; }
  `;
  document.head.appendChild(style);
}
