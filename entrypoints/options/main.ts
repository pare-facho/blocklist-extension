import { browser } from "#imports";
import { parseManualLines } from "../../lib/feed.ts";
import { applyI18n, t } from "../../lib/i18n.ts";
import type { OptionsMessage } from "../../lib/messages.ts";
import { allowItem, getSettings, logItem, manualItem, subscriptionsItem } from "../../lib/storage.ts";
import type { FeedEntry, Subscription } from "../../lib/types.ts";

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const send = (msg: OptionsMessage) => browser.runtime.sendMessage(msg);
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, string | boolean> = {}): HTMLElementTagNameMap[K] =>
  Object.assign(document.createElement(tag), props);
const when = (iso?: string) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" }) : t("never"));

function flash(sel: string, text: string, error = false) {
  const node = $(sel);
  node.textContent = text;
  node.classList.toggle("error", error);
  window.setTimeout(() => (node.textContent = ""), 4000);
}

// Snapshot of everything the page shows; re-read on every storage change.
type State = {
  subs: Subscription[];
  manual: FeedEntry[];
  allow: FeedEntry[];
};

async function loadState(): Promise<State> {
  const [subs, manual, allow] = await Promise.all([subscriptionsItem.getValue(), manualItem.getValue(), allowItem.getValue()]);
  return { subs, manual, allow };
}

// ---- status board ----------------------------------------------------------

function renderStatus(state: State) {
  const accounts = allAccounts(state);
  $("#stat-listed").textContent = String(accounts.filter((a) => !a.kept).length);
  $("#stat-own").textContent = String(accounts.filter((a) => a.own).length);
  $("#stat-kept").textContent = String(accounts.filter((a) => a.kept).length);
}

// ---- subscriptions ---------------------------------------------------------

function renderSubscriptions(subs: Subscription[]) {
  const box = $("#subscriptions");
  box.replaceChildren();
  if (subs.length === 0) box.append(el("p", { className: "muted", textContent: t("listsNone") }));
  for (const sub of subs) {
    const row = el("div", { className: "sub" });
    const toggle = el("input", { type: "checkbox", checked: sub.enabled, title: t("listsEnabled") });
    toggle.addEventListener("change", async () => {
      sub.enabled = toggle.checked;
      await subscriptionsItem.setValue(subs);
      await send({ type: "refreshFeeds" });
    });
    const bySite = new Map<string, number>();
    for (const e of sub.entries) bySite.set(e.site, (bySite.get(e.site) ?? 0) + 1);
    const counts = [...bySite].map(([s, n]) => `${s}: ${n}`).join(", ");
    const meta = el("span", { className: "meta", textContent: t("listsMeta", counts, sub.updated?.slice(0, 10) ?? "?", when(sub.lastFetched)) });
    const link = el("a", { href: sub.url, textContent: t("listsSource"), target: "_blank", rel: "noopener" });
    const remove = el("button", { type: "button", textContent: t("listsRemove"), className: "small" });
    remove.addEventListener("click", async () => {
      await subscriptionsItem.setValue(subs.filter((s) => s.id !== sub.id));
      await send({ type: "refreshFeeds" });
    });
    row.append(toggle, el("span", { className: "name", textContent: sub.name }), meta, link, remove);
    if (sub.lastError) row.append(el("span", { className: "error", textContent: sub.lastError }));
    box.append(row);
  }
}

$("#subscribe-form").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const url = $<HTMLInputElement>("#subscribe-url").value.trim();
  if (!url.startsWith("https://")) return flash("#subscribe-status", t("subscribeHttps"), true);
  // Permission for the feed's host is requested here because it needs a user click.
  const origin = new URL(url).origin + "/*";
  const granted = await browser.permissions.request({ origins: [origin] }).catch(() => false);
  if (!granted) return flash("#subscribe-status", t("subscribePermission"), true);
  flash("#subscribe-status", t("subscribeDownloading"));
  const res = (await send({ type: "subscribe", url })) as { ok: true; name: string; count: number } | { ok: false; error: string };
  if (res.ok) {
    $<HTMLInputElement>("#subscribe-url").value = "";
    flash("#subscribe-status", t("subscribeAdded", res.name, res.count));
  } else {
    flash("#subscribe-status", t("subscribeFailed", res.error), true);
  }
});

$("#refresh-now").addEventListener("click", () => send({ type: "refreshFeeds" }));

// ---- own list and exceptions -----------------------------------------------

const toLines = (entries: FeedEntry[]) => entries.filter((e) => e.site === "x").map((e) => e.handle).join("\n");

async function saveXEntries(item: typeof manualItem, text: string) {
  const others = (await item.getValue()).filter((e) => e.site !== "x");
  await item.setValue([...others, ...parseManualLines(text, "x")]);
  await send({ type: "refreshFeeds" });
}

$("#own-add-form").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const input = $<HTMLInputElement>("#own-add");
  const [entry] = parseManualLines(input.value, "x");
  if (!entry) return;
  const manual = await manualItem.getValue();
  if (!manual.some((e) => e.site === "x" && e.handle === entry.handle)) {
    await manualItem.setValue([...manual, entry]);
    await send({ type: "refreshFeeds" });
  }
  input.value = "";
  flash("#own-add-status", t("ownAdded", entry.handle));
});

$("#manual-save").addEventListener("click", async () => {
  await saveXEntries(manualItem, $<HTMLTextAreaElement>("#manual").value);
  flash("#manual-status", t("saved"));
});

$("#allow-save").addEventListener("click", async () => {
  await saveXEntries(allowItem, $<HTMLTextAreaElement>("#allow").value);
  flash("#allow-status", t("saved"));
});

// ---- full list -------------------------------------------------------------

type Account = { handle: string; name?: string; list: string; own: boolean; kept: boolean };

function allAccounts(state: State): Account[] {
  const kept = new Set(state.allow.filter((e) => e.site === "x").map((e) => e.handle));
  const out = new Map<string, Account>();
  for (const sub of state.subs) {
    if (!sub.enabled) continue;
    for (const e of sub.entries) {
      if (e.site !== "x" || out.has(e.handle)) continue;
      out.set(e.handle, { handle: e.handle, name: e.name, list: sub.name, own: false, kept: kept.has(e.handle) });
    }
  }
  for (const e of state.manual) {
    if (e.site !== "x" || out.has(e.handle)) continue;
    out.set(e.handle, { handle: e.handle, name: e.name, list: t("ownListName"), own: true, kept: kept.has(e.handle) });
  }
  return [...out.values()].sort((a, b) => a.handle.localeCompare(b.handle));
}

let currentState: State | undefined;

function renderAll(state: State) {
  const q = $<HTMLInputElement>("#search").value.trim().toLowerCase();
  const accounts = allAccounts(state);
  const shown = q ? accounts.filter((a) => a.handle.includes(q) || a.name?.toLowerCase().includes(q)) : accounts;
  $("#all-count").textContent = t("allShowing", shown.length, accounts.length);
  const body = $("#all-table tbody");
  body.replaceChildren();
  for (const a of shown.slice(0, 500)) {
    const tr = el("tr", { className: a.kept ? "kept" : "" });
    const link = el("a", { href: `https://x.com/${a.handle}`, textContent: `@${a.handle}`, target: "_blank", rel: "noopener" });
    tr.append(el("td"), el("td", { textContent: a.name ?? "" }), el("td", { textContent: a.list }), el("td", { textContent: a.kept ? t("stKept") : t("stHidden") }));
    tr.firstElementChild!.append(link);
    const actions = el("td", { className: "actions" });
    const keep = el("button", { type: "button", className: "small", textContent: a.kept ? t("actUnkeep") : t("actKeep") });
    keep.addEventListener("click", async () => {
      const allow = await allowItem.getValue();
      const next = a.kept ? allow.filter((e) => !(e.site === "x" && e.handle === a.handle)) : [...allow, { site: "x", handle: a.handle }];
      await allowItem.setValue(next);
      await send({ type: "refreshFeeds" });
    });
    actions.append(keep);
    if (a.own) {
      const remove = el("button", { type: "button", className: "small", textContent: t("actRemove") });
      remove.addEventListener("click", async () => {
        await manualItem.setValue((await manualItem.getValue()).filter((e) => !(e.site === "x" && e.handle === a.handle)));
        await send({ type: "refreshFeeds" });
      });
      actions.append(" ", remove);
    }
    tr.append(actions);
    body.append(tr);
  }
}

$("#search").addEventListener("input", () => currentState && renderAll(currentState));

// ---- initial render and live updates ---------------------------------------

async function render() {
  const state = (currentState = await loadState());
  renderSubscriptions(state.subs);
  $<HTMLTextAreaElement>("#manual").value = toLines(state.manual);
  $<HTMLTextAreaElement>("#allow").value = toLines(state.allow);
  renderAll(state);
  renderStatus(state);
}

applyI18n();
void getSettings().then((s) => ($("#refresh-every").textContent = t("refreshEvery", s.feedRefreshHours)));
void render();
browser.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.log) $("#log").textContent = ((changes.log.newValue as string[] | undefined) ?? []).slice().reverse().join("\n");
  if (changes.subscriptions || changes.manual || changes.allow) void render();
});
void logItem.getValue().then((log) => ($("#log").textContent = log.slice().reverse().join("\n")));
