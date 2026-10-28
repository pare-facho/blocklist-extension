import { test } from "node:test";
import assert from "node:assert/strict";
import { listedOnX, reconcileQueue } from "../lib/queue.ts";
import type { QueueTask, Subscription } from "../lib/types.ts";

const now = "2026-10-28T12:00:00Z";
const task = (handle: string, status: QueueTask["status"], extra: Partial<QueueTask> = {}): QueueTask => ({
  key: `x:${handle}`, site: "x", handle, origin: "list", status, attempts: 1, createdAt: "2026-10-27T00:00:00Z", doneAt: "2026-10-27T01:00:00Z", ...extra,
});
const subs: Subscription[] = [
  { id: "1", url: "https://a", name: "A", enabled: true, entries: [{ site: "x", handle: "alpha", id: "1" }, { site: "x", handle: "beta" }, { site: "instagram", handle: "gamma" }] },
  { id: "2", url: "https://b", name: "B", enabled: false, entries: [{ site: "x", handle: "delta" }] },
];

test("listedOnX takes enabled lists and the own list, minus kept accounts, X only", () => {
  const listed = listedOnX(subs, [{ site: "x", handle: "own" }], [{ site: "x", handle: "beta" }]);
  assert.deepEqual([...listed.keys()].sort(), ["x:alpha", "x:own"]);
  assert.equal(listed.get("x:alpha")?.id, "1");
});

test("reconcileQueue adds blocks for new accounts and leaves finished tasks alone", () => {
  const listed = listedOnX(subs, [], []);
  const { queue, toUnblock } = reconcileQueue([task("alpha", "done"), task("beta", "failed"), task("old", "skipped")], listed, now);
  assert.equal(toUnblock, 0);
  assert.deepEqual(queue.map((q) => [q.handle, q.status]), [["alpha", "done"], ["beta", "failed"], ["old", "skipped"]]);
});

test("reconcileQueue turns an extension block into an unblock once the account left every list", () => {
  const listed = listedOnX(subs, [], []);
  const { queue, toUnblock } = reconcileQueue([task("gone", "done", { attempts: 2 })], listed, now);
  assert.equal(toUnblock, 1);
  assert.deepEqual(queue.filter((q) => q.handle === "gone").map((q) => [q.status, q.attempts]), [["unblocking", 0]]);
});

test("reconcileQueue drops a pending block and keeps failed ones when the account left the lists", () => {
  const { queue } = reconcileQueue([task("gone", "pending"), task("gone2", "failed"), task("gone3", "unblocked")], new Map(), now);
  assert.deepEqual(queue.map((q) => [q.handle, q.status]), [["gone2", "failed"], ["gone3", "unblocked"]]);
});

test("reconcileQueue cancels an unblock or blocks again when the account is listed again", () => {
  const listed = listedOnX(subs, [], []);
  const { queue } = reconcileQueue([task("alpha", "unblocking"), task("beta", "unblocked")], listed, now);
  assert.deepEqual(queue.map((q) => [q.handle, q.status, q.attempts]), [["alpha", "done", 0], ["beta", "pending", 0]]);
});

test("reconcileQueue unblocks a kept account and drops tasks from other sites", () => {
  const listed = listedOnX(subs, [], [{ site: "x", handle: "alpha" }]);
  const insta: QueueTask = { ...task("gamma", "pending"), site: "instagram", key: "instagram:gamma" };
  const { queue, toUnblock } = reconcileQueue([task("alpha", "done"), insta], listed, now);
  assert.equal(toUnblock, 1);
  assert.deepEqual(queue.map((q) => [q.handle, q.status]), [["alpha", "unblocking"], ["beta", "pending"]]);
});
