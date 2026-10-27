import { browser } from "#imports";

// Thin wrapper over the browser's own translation API. Strings live in
// public/_locales/<lang>/messages.json; French is the fallback language.
export function t(key: string, ...substitutions: Array<string | number>): string {
  // The API's type only knows the built-in "@@" keys; ours come from messages.json.
  const getMessage = browser.i18n.getMessage as (name: string, subs?: string[]) => string;
  return getMessage(key, substitutions.map(String)) || key;
}

// Fills elements marked with data-i18n (text), data-i18n-placeholder and data-i18n-title.
export function applyI18n(root: ParentNode = document): void {
  for (const el of root.querySelectorAll<HTMLElement>("[data-i18n]")) el.textContent = t(el.dataset.i18n!);
  for (const el of root.querySelectorAll<HTMLInputElement>("[data-i18n-placeholder]")) {
    el.placeholder = t(el.dataset.i18nPlaceholder!);
  }
  for (const el of root.querySelectorAll<HTMLElement>("[data-i18n-title]")) el.title = t(el.dataset.i18nTitle!);
  const title = document.querySelector("title[data-i18n]");
  if (title) document.title = t(title.getAttribute("data-i18n")!);
}
