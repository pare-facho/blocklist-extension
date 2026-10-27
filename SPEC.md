# Blocklist browser extension — specification (draft 1, 2026-10-27)

## Goal

A Chrome + Firefox extension that hides and blocks accounts from lists the user chooses,
on X, Threads and Instagram, without putting the user's account at risk.

## Requirements

1. **Lists**
   - Manual list: the user adds accounts by hand (paste a handle or a profile URL).
   - Subscribed lists: the user adds a feed URL. The extension re-downloads it on a schedule
     and applies additions and removals.
   - The extension ships with **no list**. It never sends the user's lists anywhere.
   - Per-list on/off switch and "allow list" (accounts the user never wants blocked).
2. **Hide now, block later**
   - Posts, replies and comments from listed accounts are hidden immediately in the page.
   - The real block is queued and executed slowly in the background (see pacing).
3. **Pacing (account protection)**
   - Defaults: at most 10 blocks per hour and 60 per day, with a random gap of 3–15 minutes
     between two blocks. Configurable. Blocks run only while the browser is open and the user
     is logged in on that site.
   - On any rate-limit or error response the queue pauses with back-off; nothing is dropped.
   - Per-site daily counter visible in the options page.
4. **One-click block button**
   - A small icon on every post/comment. One click = hide now + add to the manual list +
     queue the block. Short undo (5 s).
5. **Platforms**: X (x.com) first, then Threads (threads.com), then Instagram.
   Each site is a separate adapter: detect posts, read author id/handle, hide, block.
6. **Browsers**: Chrome and Firefox from one codebase (WebExtensions, Manifest V3).

## Feed format (subscribed lists)

Plain JSON over HTTPS. Reason: RSS/Atom are for articles, not account lists; CSV has no
room for metadata. JSON is easy to host anywhere (GitHub, a static site, Nextcloud).

```json
{
  "format": "blocklist/1",
  "name": "Example list",
  "description": "What this list is for",
  "updated": "2026-10-27T10:00:00Z",
  "entries": [
    { "site": "x",         "id": "12345678",   "handle": "example",  "reason": "optional short text" },
    { "site": "threads",   "handle": "example" },
    { "site": "instagram", "id": "987654321",  "handle": "example" }
  ]
}
```

- `id` is preferred (handles change; ids do not). `handle` alone is accepted; the
  extension resolves it to an id the first time it meets the account.
- Removing an entry from the feed removes the hide rule. It does **not** unblock
  automatically (the user may have blocked for other reasons); unblocking is a manual action.
- Fetch rules: `ETag`/`If-None-Match`, size cap (e.g. 5 MB), refresh every 6 h by default,
  manual refresh button. Reject feeds over plain HTTP.
- Also accepted on import (manual list only): plain text with one handle per line, and
  X's own `block.js` archive export.

## Account identity

- X: numeric user id, obtained from the page's data or by resolving the handle through the
  site's own web endpoints with the user's session.
- Threads / Instagram: numeric user id from page data where available; otherwise handle.

## Blocking mechanism (per site)

- **X**: the site's own web endpoints, using the logged-in session (same approach as
  existing tools). Known to work; can change without notice.
- **Threads / Instagram**: Meta's web endpoints are undocumented and change often. First
  approach: drive the site's own block menu (open the post menu, click "Block", confirm),
  which is what existing Threads quick-block tools do. Try the web endpoint later if the
  menu route proves too fragile. These two sites carry more risk and are later slices.

## Risks and limits (stated, not hidden)

- All three sites forbid automation in their terms. Pacing lowers the risk; it is not a
  guarantee. The options page says this plainly.
- Hiding breaks when a site changes its page layout; blocking breaks when it changes its
  web endpoints. Expect maintenance.
- Lists naming people by political opinion are sensitive personal data under GDPR (art. 9).
  The extension does not publish lists. List authors carry that responsibility.
- Blocks happen only while the browser is open. Mobile apps get the benefit of real blocks,
  not of hiding.

## Out of scope (for now)

- Reporting accounts to the platform.
- Shared or crowd-sourced list editing inside the extension.
- Facebook, YouTube, Bluesky, Mastodon (Bluesky and Mastodon have native list import).
- Safari.

## Slices

1. **Skeleton + X hide**: WXT + TypeScript project, options page, manual list, feed
   subscription, hide posts on X. Chrome + Firefox builds.
2. **X block queue**: paced background blocking, counters, pause/resume, one-click button.
3. **Threads** adapter (hide + block).
4. **Instagram** adapter (hide + block).
5. Store listings (Chrome Web Store, Firefox Add-ons).

## Success condition

With a test list of 3 accounts: their posts disappear from the X timeline within one page
load; the three blocks appear in X's "Blocked accounts" page over the following hour at
the configured pace; the one-click icon blocks a fourth account; the same build installs
and passes the same check in Chrome and Firefox.

## Stack

- WXT (Vite-based, Chrome + Firefox from one codebase), TypeScript, no UI framework
  beyond what WXT scaffolds. Storage: `browser.storage.local` + IndexedDB for the queue.
- Permissions: `storage`, `alarms`, host permissions only for the three sites and the
  user's feed URLs (requested at subscribe time).
