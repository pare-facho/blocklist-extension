# Pare-Facho browser extension — specification (revision 4, 2026-10-28)

## Goal

A Chrome + Firefox extension that collapses, on X, the posts of accounts from lists the
user chooses and acts on those posts the way a person does, through X's own post menu, on
a post that is on screen, with the user's session, at a human pace, so that X's ranking
receives negative signals about those accounts. Two modes, chosen in the settings:
"Not interested in this post" on every served post (default) or "Mute" once per account.
Nothing is blocked or reported.

Revision 1 (2026-10-27) blocked the listed accounts through X's web endpoints from a
background queue, whether or not their posts were seen. Revision 2 (0.4.0) removed that.
Revision 3 reintroduced an action from the feed as a block. Revision 4 (0.5.0) replaces
the block by the two actions above, because X's published ranking code
(xai-org/x-algorithm) shows that: only actions on posts served in the Home timeline are
training labels; a block or mute made from a profile page is not one; per action, mute
(−58.8) and not interested (−52.3) weigh more than block (−31.2); and only "not
interested" can be repeated, since mute and block remove the account from the user's
feed. Actions happen only from posts rendered on screen, through X's own interface, one at
a time, under fixed caps (30 per hour, 150 per day, 15 to 45 seconds apart). The feed
format keeps its name (`blocklist/1`).

## Requirements

1. **Lists**
   - Manual list: the user adds accounts by hand (a handle, an @handle or a profile URL),
     or with the ⛔ button on a post.
   - Subscribed lists: the user adds a feed URL. The extension re-downloads it on a schedule
     (every 6 hours, manual refresh button) and applies additions and removals.
   - The extension ships with the "On bloque l'extrême droite" list subscribed by default
     (removable, never re-added once removed). It never sends the user's lists anywhere.
   - Per-list on/off switch and "keep" list (accounts the user never wants hidden).
2. **Collapse and act**
   - Posts and replies from listed accounts are collapsed to a one-line strip as soon as
     they render, everywhere on x.com (timeline, replies, search, profiles). The strip
     offers "Show".
   - Reposts made by a listed account are collapsed too, whoever wrote the original post
     (hidden only: the menu acts on the post's author).
   - Once a collapsed post is on screen, after a short reading pause and within the pace
     caps, the extension opens the post's own menu and picks the item of the chosen mode,
     found by its label in the ten interface languages X ships it in. X's page sends the
     request; the extension never calls X itself.
   - "Not interested" mode (default): one action per served post; the post id is kept so
     the same post is never marked twice; "Show fewer posts from…" is never chosen. The
     item only exists in the Home timeline: elsewhere the post stays hidden, silently.
   - "Mute" mode: one action per account, kept so it is never tried twice.
   - What was done, and what failed, is listed in the settings. No block, no report.
3. **One-click button**
   - A small ⛔ icon on every post. One click = hide now + add the author to the manual
     list. Short undo (5 s).
4. **Settings page**
   - Counts: accounts listed, "not interested" sent, accounts muted, accounts in the
     user's own list. Actions are listed with their time. The page explains, in the
     user's language, what each mode does to the account's reach and why.
   - Subscribed lists with their size and dates; own list and keep list as text;
     full searchable list with Keep / Remove per account; activity log.
5. **Platform**: X (x.com) only.
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
    { "site": "x", "id": "12345678", "handle": "example", "reason": "optional short text" },
    { "site": "x", "handle": "another_example" }
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

- Blocking or reporting accounts, and any action that is not made from a post on screen
  (profile pages, background queues, whole-list actions).
- Shared or crowd-sourced list editing inside the extension.
- Other networks: the extension deals with X only. Feed entries for other sites are
  accepted and ignored.
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
