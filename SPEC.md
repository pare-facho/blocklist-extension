# Pare-Facho browser extension — specification (revision 3, 2026-10-28)

## Goal

A Chrome + Firefox extension that collapses, on X, the posts of accounts from lists the
user chooses and, by default, blocks those accounts from the user's own feed so that X's
ranking receives a negative signal about them. The block is made the way a person makes
it: through X's own post menu, on a post that is on screen, with the user's session, at a
human pace. A "Hide only" mode changes only what the user sees.

Revision 1 (2026-10-27) blocked the listed accounts through X's web endpoints from a
background queue, whether or not their posts were seen. Revision 2 (0.4.0) removed that.
Revision 3 (0.5.0) reintroduces blocking in a different form, because X's open ranking
code counts a block made on a served post as a negative training label for the author,
while a hidden post counts for nothing: blocks happen only from posts rendered on screen,
through X's own interface, one at a time, under fixed caps (30 per hour, 150 per day, 15 to
45 seconds apart). The feed format keeps its name (`blocklist/1`).

## Requirements

1. **Lists**
   - Manual list: the user adds accounts by hand (a handle, an @handle or a profile URL),
     or with the ⛔ button on a post.
   - Subscribed lists: the user adds a feed URL. The extension re-downloads it on a schedule
     (every 6 hours, manual refresh button) and applies additions and removals.
   - The extension ships with the "On bloque l'extrême droite" list subscribed by default
     (removable, never re-added once removed). It never sends the user's lists anywhere.
   - Per-list on/off switch and "keep" list (accounts the user never wants hidden).
2. **Collapse and block**
   - Posts and replies from listed accounts are collapsed to a one-line strip as soon as
     they render, everywhere on x.com (timeline, replies, search, profiles). The strip
     offers "Show" and, before a block, "Don't block".
   - Reposts made by a listed account are collapsed too, whoever wrote the original post
     (hidden only: the block targets the post's author).
   - In "block" mode (default), once a collapsed post is on screen the extension opens the
     post's own menu, chooses "Block" and confirms, after a short reading pause and within
     the pace caps. X's page sends the request; the extension never calls X itself. Each
     account is tried once; the result is listed in the settings.
   - In "Hide only" mode nothing is sent to X. No block, no mute, no report.
3. **One-click button**
   - A small ⛔ icon on every post. One click = hide now + add the author to the manual
     list. Short undo (5 s).
4. **Settings page**
   - Counts: accounts hidden, accounts blocked by the extension, accounts in the user's own
     list, accounts kept. Blocked accounts are listed with their time.
   - Subscribed lists with their size and dates; own list and keep list as text;
     full searchable list with Keep / Remove per account; activity log.
5. **Platforms**: X (x.com). Threads and Instagram are possible later slices (each site is
   a separate content script: detect posts, read the author handle, hide).
6. **Browsers**: Chrome and Firefox from one codebase (WebExtensions; Manifest V3 on
   Chrome, V2 on Firefox).

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

- `id` is preferred (handles change; ids do not). `handle` alone is accepted.
- Removing an entry from the feed removes the hide rule at the next refresh.
- Fetch rules: `ETag`/`If-None-Match`, size cap 5 MB, refresh every 6 h by default,
  manual refresh button. Feeds over plain HTTP are rejected.
- Also accepted in the manual list: plain text with one handle per line.

## Risks and limits (stated, not hidden)

- Hiding breaks when X changes its page layout. Expect maintenance.
- Hiding only works in the browser where the extension is installed. The mobile apps
  show everything.
- Lists naming people by political opinion are sensitive personal data under GDPR (art. 9).
  The extension does not publish lists. List authors carry that responsibility.

## Out of scope

- Muting or reporting accounts, and any block that is not made from a post on screen
  (background queues, whole-list blocking).
- Shared or crowd-sourced list editing inside the extension.
- Facebook, YouTube, Bluesky, Mastodon (Bluesky and Mastodon have native list import).
- Safari.

## Success condition

With a test list of 3 accounts: their posts and their reposts disappear from the X
timeline within one page load; the ⛔ icon hides a fourth account and adds it to "My list";
"Keep" brings an account back; the same build installs and passes the same check in
Chrome and Firefox.

## Stack

- WXT (Vite-based, Chrome + Firefox from one codebase), TypeScript, no UI framework.
  Storage: `browser.storage.local`.
- Permissions: `storage`, `alarms` (list refresh), host permissions for x.com and the
  default list's host; other feed hosts are requested one by one at subscribe time.
