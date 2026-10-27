import type { FeedEntry, Subscription } from "./types.ts";

// What a content script needs to decide "is this author on a list": handles and ids
// for one site, after the allow list is removed. Serializable for messaging.
export type BlockSet = { handles: string[]; ids: string[] };

export function buildBlockSet(
  site: string,
  subscriptions: Subscription[],
  manual: FeedEntry[],
  allow: FeedEntry[],
): BlockSet {
  const allowHandles = new Set(allow.filter((e) => e.site === site).map((e) => e.handle));
  const allowIds = new Set(allow.filter((e) => e.site === site && e.id).map((e) => e.id as string));
  const handles = new Set<string>();
  const ids = new Set<string>();
  const sources = [...subscriptions.filter((s) => s.enabled).flatMap((s) => s.entries), ...manual];
  for (const e of sources) {
    if (e.site !== site) continue;
    if (allowHandles.has(e.handle) || (e.id && allowIds.has(e.id))) continue;
    handles.add(e.handle);
    if (e.id) ids.add(e.id);
  }
  return { handles: [...handles], ids: [...ids] };
}

export function isListed(set: BlockSet, author: { handle?: string; id?: string }): boolean {
  if (author.id && set.ids.includes(author.id)) return true;
  if (author.handle && set.handles.includes(author.handle.toLowerCase())) return true;
  return false;
}
