// Reads the public lists of two sites and turns them into flat lists of X accounts:
// - the Blockfacho site (accounts.js and /api/accounts);
// - onbloquelextremedroite.fr, whose entity catalog groups each person's accounts on
//   several networks; only the X accounts of its "block" list are taken.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

export const SITE_ORIGIN = "https://onbloquelextremedroite.fun";
export const FR_ORIGIN = "https://www.onbloquelextremedroite.fr";

export type SourceEntry = {
  site: string;
  handle: string;
  name: string;
  category: string;
  reason?: string;
  source?: string;
};

const USER_AGENT = "blocklist-feed/0.1";

export async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "user-agent": USER_AGENT }, redirect: "follow" });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.text();
}

// accounts.js is "const accounts = [ ... ];" — a JSON array behind a JS prefix.
export function parseAccountsJs(text: string): Array<Record<string, string>> {
  return parseJsAssignment(text, "accounts");
}

function parseJsAssignment(text: string, name: string) {
  const m = text.match(new RegExp(`const\\s+${name}\\s*=\\s*([\\[{][\\s\\S]*?[\\]}])\\s*;`));
  if (!m) throw new Error(`could not find "const ${name} = ..." in file`);
  return JSON.parse(m[1]);
}

// Last path segment of a profile URL, lower-cased.
export function handleFromProfileUrl(url: string): string | undefined {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return undefined;
  }
  const segment = u.pathname.split("/").filter(Boolean).pop();
  if (!segment) return undefined;
  return segment.replace(/^@/, "").toLowerCase();
}

export function entriesFromAccountsJs(accounts: Array<Record<string, string>>): SourceEntry[] {
  return accounts
    .filter((a) => a.handle)
    .map((a) => ({
      site: "x",
      handle: a.handle.toLowerCase(),
      name: a.name,
      category: a.category,
      reason: a.reason || undefined,
      source: a.source || undefined,
    }));
}

type ApiEntry = {
  type: string;
  platform?: string;
  profile_url?: string;
  name?: string;
  category?: string;
  reason?: string;
};

// /api/accounts holds visitor proposals approved by the site owner. Only X accounts are
// taken; "removal" entries point at an account to drop; we honour them.
export function entriesFromApi(data: { entries?: ApiEntry[] }): {
  added: SourceEntry[];
  removed: Set<string>;
} {
  const added: SourceEntry[] = [];
  const removed = new Set<string>();
  // A removal's target_id is either a handle or the id of another API entry.
  const handleById = new Map<string, string>();
  for (const e of data.entries ?? []) {
    const id = (e as { id?: string }).id;
    const handle = e.profile_url ? handleFromProfileUrl(e.profile_url) : undefined;
    if (id && handle) handleById.set(String(id), handle);
  }
  for (const e of data.entries ?? []) {
    if (e.type === "removal") {
      const target = (e as { target_id?: string }).target_id;
      if (target) removed.add((handleById.get(String(target)) ?? String(target)).toLowerCase());
      continue;
    }
    if (e.type !== "new" || e.platform !== "x" || !e.profile_url) continue;
    const handle = handleFromProfileUrl(e.profile_url);
    if (!handle) continue;
    added.push({
      site: e.platform,
      handle,
      name: e.name ?? handle,
      category: e.category ?? "Autres",
      reason: e.reason || undefined,
      source: e.profile_url,
    });
  }
  return { added, removed };
}

export function dedupe(entries: SourceEntry[]): SourceEntry[] {
  const seen = new Map<string, SourceEntry>();
  for (const e of entries) {
    const key = `${e.site}:${e.handle}`;
    if (!seen.has(key)) seen.set(key, e);
  }
  return [...seen.values()];
}

export type Corrections = Record<string, Record<string, string>>;

// Replaces handles that are wrong on the source site (see corrections.json).
// Applied after removals so a removal keyed by the published handle still works.
export function applyCorrections(entries: SourceEntry[], corrections: Corrections): SourceEntry[] {
  return entries.map((e) => {
    const fixed = corrections[e.site]?.[e.handle];
    return fixed ? { ...e, handle: fixed.toLowerCase() } : e;
  });
}

type CatalogAccount = { platform?: string; handle?: string; name?: string; url?: string };
type CatalogEntity = { list?: string; name?: string; category?: string; accounts?: CatalogAccount[] };

const FR_CATEGORIES: Record<string, string> = {
  political: "Politique",
  person: "Personnalité",
  media: "Média",
  org: "Organisation",
};

export function entriesFromEntityCatalog(catalog: { entities?: CatalogEntity[] }): SourceEntry[] {
  const out: SourceEntry[] = [];
  for (const entity of catalog.entities ?? []) {
    if (entity.list !== "block") continue;
    for (const a of entity.accounts ?? []) {
      if (a.platform !== "x" || !a.handle) continue;
      const handle = a.handle.replace(/^@/, "").toLowerCase();
      out.push({
        site: "x",
        handle,
        name: a.name || entity.name || handle,
        category: FR_CATEGORIES[entity.category ?? ""] ?? "Autres",
        source: a.url || undefined,
      });
    }
  }
  return dedupe(out);
}

export async function loadFrEntries(origin = FR_ORIGIN): Promise<SourceEntry[]> {
  return entriesFromEntityCatalog(JSON.parse(await fetchText(`${origin}/entity-catalog.json`)));
}

export async function loadSourceEntries(origin = SITE_ORIGIN): Promise<SourceEntry[]> {
  const [accountsJs, apiJson] = await Promise.all([fetchText(`${origin}/accounts.js`), fetchText(`${origin}/api/accounts`)]);
  const xEntries = entriesFromAccountsJs(parseAccountsJs(accountsJs));
  const api = entriesFromApi(JSON.parse(apiJson));
  const all = dedupe([...xEntries, ...api.added]);
  return all.filter((e) => !api.removed.has(e.handle));
}

// Each source is kept as a snapshot next to the id cache. When a site cannot be read
// (outage, or it blocks the job), its last snapshot is used so the other source can still
// be published and the accounts of the failing one stay in the list.
export type SourceResult = { entries: SourceEntry[]; error?: string };

export async function loadWithSnapshot(path: string, load: () => Promise<SourceEntry[]>): Promise<SourceResult> {
  try {
    const entries = await load();
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(entries, null, 2) + "\n");
    return { entries };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    try {
      return { entries: JSON.parse(await readFile(path, "utf8")), error };
    } catch {
      throw new Error(`${error}; no snapshot at ${path}`);
    }
  }
}
