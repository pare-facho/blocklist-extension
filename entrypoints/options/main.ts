import { browser } from "#imports";
import { parseManualLines } from "../../lib/feed.ts";
import type { OptionsMessage } from "../../lib/messages.ts";
import { allowItem, getSettings, logItem, manualItem, queueItem, settingsItem, subscriptionsItem } from "../../lib/storage.ts";
import type { FeedEntry, QueueTask, Subscription } from "../../lib/types.ts";

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const send = (msg: OptionsMessage) => browser.runtime.sendMessage(msg);

function flash(sel: string, text: string, error = false) {
  const el = $(sel);
  el.textContent = text;
  el.classList.toggle("error", error);
  window.setTimeout(() => (el.textContent = ""), 4000);
}

// ---- subscriptions ---------------------------------------------------------

function renderSubscriptions(subs: Subscription[]) {
  const box = $("#subscriptions");
  box.replaceChildren();
  if (subs.length === 0) {
    box.append(Object.assign(document.createElement("p"), { className: "muted", textContent: "No list yet." }));
  }
  for (const sub of subs) {
    const row = document.createElement("div");
    row.className = "sub";
    const toggle = Object.assign(document.createElement("input"), { type: "checkbox", checked: sub.enabled, title: "Enabled" });
    toggle.addEventListener("change", async () => {
      sub.enabled = toggle.checked;
      await subscriptionsItem.setValue(subs);
    });
    const name = Object.assign(document.createElement("span"), { className: "name", textContent: sub.name });
    const bySite = new Map<string, number>();
    for (const e of sub.entries) bySite.set(e.site, (bySite.get(e.site) ?? 0) + 1);
    const counts = [...bySite].map(([s, n]) => `${s}: ${n}`).join(", ");
    const meta = Object.assign(document.createElement("span"), {
      className: "meta",
      textContent: `${counts} · list updated ${sub.updated?.slice(0, 10) ?? "?"} · checked ${sub.lastFetched?.slice(0, 16).replace("T", " ") ?? "never"}`,
    });
    const link = Object.assign(document.createElement("a"), { href: sub.url, textContent: "source", target: "_blank", rel: "noopener" });
    const remove = Object.assign(document.createElement("button"), { type: "button", textContent: "Remove" });
    remove.addEventListener("click", async () => {
      await subscriptionsItem.setValue(subs.filter((s) => s.id !== sub.id));
    });
    row.append(toggle, name, meta, link, remove);
    if (sub.lastError) row.append(Object.assign(document.createElement("span"), { className: "error", textContent: sub.lastError }));
    box.append(row);
  }
}

$("#subscribe-form").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const url = $<HTMLInputElement>("#subscribe-url").value.trim();
  if (!url.startsWith("https://")) return flash("#subscribe-status", "The address must start with https://", true);
  // Permission for the feed's host is requested here because it needs a user click.
  const origin = new URL(url).origin + "/*";
  const granted = await browser.permissions.request({ origins: [origin] }).catch(() => false);
  if (!granted) return flash("#subscribe-status", "Permission to read that address was refused", true);
  flash("#subscribe-status", "Downloading…");
  const res = (await send({ type: "subscribe", url })) as { ok: true; name: string; count: number } | { ok: false; error: string };
  if (res.ok) {
    $<HTMLInputElement>("#subscribe-url").value = "";
    flash("#subscribe-status", `Added "${res.name}" with ${res.count} entries`);
  } else {
    flash("#subscribe-status", `Could not add list: ${res.error}`, true);
  }
});

$("#refresh-now").addEventListener("click", async () => {
  await send({ type: "refreshFeeds" });
});

// ---- manual and allow lists ------------------------------------------------

const toLines = (entries: FeedEntry[]) => entries.filter((e) => e.site === "x").map((e) => e.handle).join("\n");

$("#manual-save").addEventListener("click", async () => {
  const keepOtherSites = (await manualItem.getValue()).filter((e) => e.site !== "x");
  await manualItem.setValue([...keepOtherSites, ...parseManualLines($<HTMLTextAreaElement>("#manual").value, "x")]);
  flash("#manual-status", "Saved");
});

$("#allow-save").addEventListener("click", async () => {
  const keepOtherSites = (await allowItem.getValue()).filter((e) => e.site !== "x");
  await allowItem.setValue([...keepOtherSites, ...parseManualLines($<HTMLTextAreaElement>("#allow").value, "x")]);
  flash("#allow-status", "Saved");
});

// ---- settings --------------------------------------------------------------

async function renderSettings() {
  const s = await getSettings();
  $<HTMLInputElement>("#blocking-enabled").checked = s.blockingEnabled;
  $<HTMLInputElement>("#paused").checked = s.paused;
  $<HTMLInputElement>("#per-hour").value = String(s.perHour);
  $<HTMLInputElement>("#per-day").value = String(s.perDay);
  $<HTMLInputElement>("#gap-min").value = String(s.minGapMinutes);
  $<HTMLInputElement>("#gap-max").value = String(s.maxGapMinutes);
  $("#refresh-hours").textContent = String(s.feedRefreshHours);
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
    minGapMinutes: num("#gap-min", s.minGapMinutes),
    maxGapMinutes: num("#gap-max", s.maxGapMinutes),
  };
  if (next.maxGapMinutes < next.minGapMinutes) next.maxGapMinutes = next.minGapMinutes;
  await settingsItem.setValue(next);
  // Turning blocking on fills the queue from the lists.
  await send({ type: "refreshFeeds" });
  flash("#settings-status", "Saved");
});

// ---- queue and log ---------------------------------------------------------

function renderQueue(queue: QueueTask[]) {
  const count = (st: QueueTask["status"]) => queue.filter((t) => t.status === st).length;
  $("#queue-summary").textContent = `${count("pending")} waiting · ${count("done")} blocked · ${count("failed")} failed · ${count("skipped")} skipped`;
  const body = $("#queue-table tbody");
  body.replaceChildren();
  const recent = [...queue].sort((a, b) => (b.doneAt ?? b.createdAt).localeCompare(a.doneAt ?? a.createdAt)).slice(0, 50);
  for (const t of recent) {
    const tr = document.createElement("tr");
    for (const text of [`@${t.handle} (${t.site})`, t.status, (t.doneAt ?? t.createdAt).slice(0, 16).replace("T", " "), t.lastError ?? ""]) {
      tr.append(Object.assign(document.createElement("td"), { textContent: text }));
    }
    body.append(tr);
  }
}

$("#retry-failed").addEventListener("click", async () => {
  const queue = await queueItem.getValue();
  for (const t of queue) if (t.status === "failed") Object.assign(t, { status: "pending", attempts: 0, lastError: undefined });
  await queueItem.setValue(queue);
});

$("#clear-done").addEventListener("click", async () => {
  await queueItem.setValue((await queueItem.getValue()).filter((t) => t.status === "pending"));
});

// ---- initial render and live updates ---------------------------------------

async function renderAll() {
  renderSubscriptions(await subscriptionsItem.getValue());
  $<HTMLTextAreaElement>("#manual").value = toLines(await manualItem.getValue());
  $<HTMLTextAreaElement>("#allow").value = toLines(await allowItem.getValue());
  await renderSettings();
  renderQueue(await queueItem.getValue());
  $("#log").textContent = (await logItem.getValue()).slice().reverse().join("\n");
}

subscriptionsItem.watch((subs) => renderSubscriptions(subs ?? []));
queueItem.watch((q) => renderQueue(q ?? []));
logItem.watch((log) => ($("#log").textContent = (log ?? []).slice().reverse().join("\n")));
void renderAll();
