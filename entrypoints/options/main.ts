import { browser } from "#imports";
import { parseManualLines } from "../../lib/feed.ts";
import { applyI18n, t } from "../../lib/i18n.ts";
import type { OptionsMessage } from "../../lib/messages.ts";
import { allowItem, getSettings, logItem, manualItem, paceItem, queueItem, settingsItem, subscriptionsItem } from "../../lib/storage.ts";
import type { FeedEntry, QueueTask, Subscription } from "../../lib/types.ts";

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
  queue: QueueTask[];
};

async function loadState(): Promise<State> {
  const [subs, manual, allow, queue] = await Promise.all([
    subscriptionsItem.getValue(),
    manualItem.getValue(),
    allowItem.getValue(),
    queueItem.getValue(),
  ]);
  return { subs, manual, allow, queue };
}

// ---- status board ----------------------------------------------------------

async function renderStatus(state: State) {
  const settings = await getSettings();
  const pace = await paceItem.getValue();
  const listed = allAccounts(state).filter((a) => !a.kept).length;
  const xQueue = state.queue.filter((q) => q.site === "x");
  const done = xQueue.filter((q) => q.status === "done").length;
  const pending = xQueue.filter((q) => q.status === "pending").length;
  const dayAgo = Date.now() - 24 * 3600 * 1000;
  const today = pace.blockedAt.filter((iso) => Date.parse(iso) > dayAgo).length;

  $("#stat-listed").textContent = String(listed);
  $("#stat-blocked").textContent = String(done);
  $("#stat-remaining").textContent = String(settings.blockingEnabled ? pending : listed - done);
  $("#stat-today").textContent = String(today);
  let next = t("nextNone");
  if (settings.blockingEnabled && !settings.paused && pending > 0) {
    const at = pace.nextAllowedAt ? Date.parse(pace.nextAllowedAt) : 0;
    next = at > Date.now() ? new Date(at).toLocaleTimeString(undefined, { timeStyle: "short" }) : t("nextNow");
  }
  $("#stat-next").textContent = next;
  $("#state-line").textContent = !settings.blockingEnabled ? t("stateOff") : settings.paused ? t("statePaused") : t("stateOn");
  const active = settings.blockingEnabled && !settings.paused;
  $("#tab-notice").hidden = !active;
  const xTabs = active ? await browser.tabs.query({ url: "https://x.com/*" }) : [];
  $("#no-tab").hidden = !active || xTabs.length > 0;
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
    remove.addEventListener("click", async () => subscriptionsItem.setValue(subs.filter((s) => s.id !== sub.id)));
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

type Account = { handle: string; name?: string; list: string; own: boolean; kept: boolean; task?: QueueTask };

function allAccounts(state: State): Account[] {
  const kept = new Set(state.allow.filter((e) => e.site === "x").map((e) => e.handle));
  const tasks = new Map(state.queue.filter((q) => q.site === "x").map((q) => [q.handle, q]));
  const out = new Map<string, Account>();
  for (const sub of state.subs) {
    if (!sub.enabled) continue;
    for (const e of sub.entries) {
      if (e.site !== "x" || out.has(e.handle)) continue;
      out.set(e.handle, { handle: e.handle, name: e.name, list: sub.name, own: false, kept: kept.has(e.handle), task: tasks.get(e.handle) });
    }
  }
  for (const e of state.manual) {
    if (e.site !== "x" || out.has(e.handle)) continue;
    out.set(e.handle, { handle: e.handle, name: e.name, list: t("ownListName"), own: true, kept: kept.has(e.handle), task: tasks.get(e.handle) });
  }
  return [...out.values()].sort((a, b) => a.handle.localeCompare(b.handle));
}

function statusLabel(a: Account): string {
  if (a.kept) return t("stKept");
  switch (a.task?.status) {
    case "done": return t("stBlocked");
    case "pending": return t("stWaiting");
    case "failed": return t("stFailed");
    case "skipped": return t("stSkipped");
    default: return t("stHiddenOnly");
  }
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
    tr.append(el("td"), el("td", { textContent: a.name ?? "" }), el("td", { textContent: a.list }), el("td", { textContent: statusLabel(a) }));
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
        await queueItem.setValue((await queueItem.getValue()).filter((q) => !(q.site === "x" && q.handle === a.handle && q.status === "pending")));
        await send({ type: "refreshFeeds" });
      });
      actions.append(" ", remove);
    }
    tr.append(actions);
    body.append(tr);
  }
}

$("#search").addEventListener("input", () => currentState && renderAll(currentState));

// ---- settings --------------------------------------------------------------

async function renderSettings() {
  const s = await getSettings();
  $<HTMLInputElement>("#blocking-enabled").checked = s.blockingEnabled;
  $<HTMLInputElement>("#paused").checked = s.paused;
  $<HTMLInputElement>("#per-hour").value = String(s.perHour);
  $<HTMLInputElement>("#per-day").value = String(s.perDay);
  $<HTMLInputElement>("#gap-min").value = String(s.minGapSeconds);
  $<HTMLInputElement>("#gap-max").value = String(s.maxGapSeconds);
  $("#refresh-every").textContent = t("refreshEvery", s.feedRefreshHours);
}

$("#settings-save").addEventListener("click", async () => {
  const s = await getSettings();
  const num = (sel: string, fallback: number) => {
    const v = Number($<HTMLInputElement>(sel).value);
    return Number.isFinite(v) && v >= 0 ? v : fallback;
  };
  const next = {
    ...s,
    blockingEnabled: $<HTMLInputElement>("#blocking-enabled").checked,
    paused: $<HTMLInputElement>("#paused").checked,
    perHour: Math.max(1, num("#per-hour", s.perHour)),
    perDay: Math.max(1, num("#per-day", s.perDay)),
    minGapSeconds: num("#gap-min", s.minGapSeconds),
    maxGapSeconds: num("#gap-max", s.maxGapSeconds),
  };
  if (next.maxGapSeconds < next.minGapSeconds) next.maxGapSeconds = next.minGapSeconds;
  await settingsItem.setValue(next);
  // Turning blocking on fills the queue from the lists.
  await send({ type: "refreshFeeds" });
  flash("#settings-status", t("saved"));
});

// ---- history ---------------------------------------------------------------

function renderHistory(queue: QueueTask[]) {
  const count = (st: QueueTask["status"]) => queue.filter((q) => q.status === st).length;
  $("#history-summary").textContent = t("historySummary", count("pending"), count("done"), count("failed"), count("skipped"));
  const finished = queue.filter((q) => q.status !== "pending").sort((a, b) => (b.doneAt ?? b.createdAt).localeCompare(a.doneAt ?? a.createdAt));
  $("#history-empty").hidden = finished.length > 0;
  const body = $("#history-table tbody");
  body.replaceChildren();
  const label = { done: t("stBlocked"), failed: t("stFailed"), skipped: t("stSkipped"), pending: t("stWaiting") };
  for (const q of finished.slice(0, 100)) {
    const tr = el("tr");
    tr.append(el("td", { textContent: `@${q.handle}` }), el("td", { textContent: label[q.status] }), el("td", { textContent: when(q.doneAt ?? q.createdAt) }), el("td", { textContent: q.lastError ?? "" }));
    body.append(tr);
  }
}

$("#retry-failed").addEventListener("click", async () => {
  const queue = await queueItem.getValue();
  for (const q of queue) if (q.status === "failed") Object.assign(q, { status: "pending", attempts: 0, lastError: undefined });
  await queueItem.setValue(queue);
});

$("#clear-history").addEventListener("click", async () => {
  await queueItem.setValue((await queueItem.getValue()).filter((q) => q.status === "pending"));
});

// ---- initial render and live updates ---------------------------------------

async function render() {
  const state = (currentState = await loadState());
  renderSubscriptions(state.subs);
  $<HTMLTextAreaElement>("#manual").value = toLines(state.manual);
  $<HTMLTextAreaElement>("#allow").value = toLines(state.allow);
  renderAll(state);
  renderHistory(state.queue.filter((q) => q.site === "x")); // only X has a blocker so far
  await renderStatus(state);
}

applyI18n();
void renderSettings();
void render();
browser.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.log) $("#log").textContent = ((changes.log.newValue as string[] | undefined) ?? []).slice().reverse().join("\n");
  if (changes.subscriptions || changes.manual || changes.allow || changes.queue || changes.pace || changes.settings) void render();
});
void logItem.getValue().then((log) => ($("#log").textContent = log.slice().reverse().join("\n")));
