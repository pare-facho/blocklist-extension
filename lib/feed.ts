import type { Feed, FeedEntry } from "./types.ts";

export const MAX_FEED_BYTES = 5 * 1024 * 1024;

export class FeedFormatError extends Error {}

export function normalizeHandle(raw: string): string {
  return raw.trim().replace(/^@/, "").toLowerCase();
}

// Validates a parsed JSON document against the blocklist/1 format.
// Unknown sites are kept (the extension ignores them); malformed entries are rejected
// with a message that names the entry, so list authors can fix their export.
export function parseFeed(doc: unknown): Feed {
  if (!doc || typeof doc !== "object") throw new FeedFormatError("the file is not a JSON object");
  const d = doc as Record<string, unknown>;
  if (d.format !== "blocklist/1") throw new FeedFormatError(`unknown format "${String(d.format)}", expected "blocklist/1"`);
  if (typeof d.name !== "string" || !d.name.trim()) throw new FeedFormatError('"name" is missing');
  if (typeof d.updated !== "string" || Number.isNaN(Date.parse(d.updated))) {
    throw new FeedFormatError('"updated" is missing or not an ISO date');
  }
  if (!Array.isArray(d.entries)) throw new FeedFormatError('"entries" is missing or not an array');

  const entries: FeedEntry[] = d.entries.map((raw, i) => {
    if (!raw || typeof raw !== "object") throw new FeedFormatError(`entry ${i} is not an object`);
    const e = raw as Record<string, unknown>;
    if (typeof e.site !== "string" || !e.site) throw new FeedFormatError(`entry ${i}: "site" is missing`);
    if (typeof e.handle !== "string" || !normalizeHandle(e.handle)) {
      throw new FeedFormatError(`entry ${i} (${e.site}): "handle" is missing`);
    }
    if (e.id !== undefined && (typeof e.id !== "string" || !/^\d+$/.test(e.id))) {
      throw new FeedFormatError(`entry ${i} (${e.site}/${e.handle}): "id" must be a string of digits`);
    }
    const entry: FeedEntry = { site: e.site.toLowerCase(), handle: normalizeHandle(e.handle) };
    if (typeof e.id === "string") entry.id = e.id;
    for (const k of ["name", "category", "reason", "source"] as const) {
      if (typeof e[k] === "string") entry[k] = e[k] as string;
    }
    return entry;
  });

  return {
    format: "blocklist/1",
    name: d.name.trim(),
    description: typeof d.description === "string" ? d.description : undefined,
    homepage: typeof d.homepage === "string" ? d.homepage : undefined,
    updated: d.updated,
    entries,
  };
}

export type FetchFeedResult =
  | { status: "unchanged" }
  | { status: "ok"; feed: Feed; etag?: string };

// Conditional GET so an unchanged feed costs one small request.
export async function fetchFeed(url: string, etag?: string, fetchImpl: typeof fetch = fetch): Promise<FetchFeedResult> {
  if (!url.startsWith("https://")) throw new FeedFormatError("feed address must start with https://");
  const headers: Record<string, string> = { accept: "application/json" };
  if (etag) headers["if-none-match"] = etag;
  const res = await fetchImpl(url, { headers, cache: "no-cache" });
  if (res.status === 304) return { status: "unchanged" };
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const length = Number(res.headers.get("content-length") ?? 0);
  if (length > MAX_FEED_BYTES) throw new FeedFormatError("feed is larger than 5 MB");
  const text = await res.text();
  if (text.length > MAX_FEED_BYTES) throw new FeedFormatError("feed is larger than 5 MB");
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch {
    throw new FeedFormatError("the file is not valid JSON");
  }
  return { status: "ok", feed: parseFeed(doc), etag: res.headers.get("etag") ?? undefined };
}

// Manual list input: one handle or profile URL per line.
export function parseManualLines(text: string, site: string): FeedEntry[] {
  const out: FeedEntry[] = [];
  const seen = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    let h = line.trim();
    if (!h || h.startsWith("#")) continue;
    try {
      const u = new URL(h);
      h = u.pathname.split("/").filter(Boolean)[0] ?? "";
    } catch {
      // plain handle
    }
    h = normalizeHandle(h);
    if (!h || seen.has(h)) continue;
    seen.add(h);
    out.push({ site, handle: h });
  }
  return out;
}
