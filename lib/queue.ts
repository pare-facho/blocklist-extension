import type { FeedEntry, QueueTask, Subscription } from "./types.ts";
import { taskKey } from "./types.ts";

// The X accounts the extension should currently act on: enabled lists plus the
// user's own list, minus the kept ones. Keyed like the queue tasks.
export function listedOnX(subscriptions: Subscription[], manual: FeedEntry[], allow: FeedEntry[]): Map<string, FeedEntry> {
  const kept = new Set(allow.filter((e) => e.site === "x").map((e) => taskKey("x", e.handle)));
  const listed = new Map<string, FeedEntry>();
  for (const e of [...subscriptions.filter((s) => s.enabled).flatMap((s) => s.entries), ...manual]) {
    if (e.site !== "x") continue;
    const key = taskKey("x", e.handle);
    if (!kept.has(key) && !listed.has(key)) listed.set(key, e);
  }
  return listed;
}

// Brings the queue in line with the lists: new accounts get a block task, accounts
// that left every list lose their pending block or get an unblock task if the
// extension had blocked them, and accounts that come back are blocked again.
// Blocks the user made by hand are never touched: only "done" tasks turn into unblocks.
export function reconcileQueue(queue: QueueTask[], listed: Map<string, FeedEntry>, now: string): { queue: QueueTask[]; toUnblock: number } {
  const next: QueueTask[] = [];
  const known = new Set<string>();
  let toUnblock = 0;
  for (const task of queue) {
    if (task.site !== "x") continue; // only X has a blocker; other sites came from older builds
    known.add(task.key);
    if (listed.has(task.key)) {
      if (task.status === "unblocking") next.push({ ...task, status: "done", attempts: 0, lastError: undefined });
      else if (task.status === "unblocked") next.push({ ...task, status: "pending", attempts: 0, lastError: undefined, doneAt: undefined });
      else next.push(task);
    } else if (task.status === "done") {
      toUnblock++;
      next.push({ ...task, status: "unblocking", attempts: 0, lastError: undefined });
    } else if (task.status !== "pending") {
      next.push(task);
    }
  }
  for (const [key, e] of listed) {
    if (known.has(key)) continue;
    next.push({ key, site: "x", handle: e.handle, id: e.id, origin: "list", status: "pending", attempts: 0, createdAt: now });
  }
  return { queue: next, toUnblock };
}
