# Pare-Facho

*[Version française](README.md)*

A Chrome and Firefox extension that hides and blocks on X the far-right accounts listed by
the French website [On bloque l'extrême droite](https://onbloquelextremedroite.fun/).
The site's list is subscribed at install and refreshed every hour. You can remove it, add
other lists, and add or remove accounts yourself.

## Install

**Firefox**: install it from the official page
[addons.mozilla.org/firefox/addon/pare-facho](https://addons.mozilla.org/firefox/addon/pare-facho/)
by clicking "Add to Firefox".

**Chrome, Edge, Brave**: the extension is being reviewed by Google. Until then you can
install it by hand in five steps:

1. Download this file:
   [pare-facho-chrome.zip](https://github.com/pare-facho/blocklist-extension/releases/latest/download/pare-facho-chrome.zip).
2. Unzip it (double-click the file). You get a folder named `pare-facho-chrome`. Keep it:
   the browser uses it.
3. In the browser, type `chrome://extensions` in the address bar and press Enter.
4. Turn on "Developer mode" (switch at the top right).
5. Click "Load unpacked" and choose the unzipped folder.

That is all. Open [x.com](https://x.com) and leave the tab open: listed accounts disappear
from your screen right away, and the blocks run in the background. The extension's icon
(in the extensions menu, top right) opens the settings page, with status and history.

Prefer a secondary account (see [Before you install](#before-you-install)).

## What it does

1. **Hide now.** On x.com, posts from listed accounts disappear from your screen as they
   render: timeline, replies, search. Nothing changes on X, only your display.
2. **Block in the background.** The extension blocks listed accounts one at a time, at an
   adjustable pace (defaults: at most 300 per hour, 1000 per day, with a random 5 to 15
   second gap between two). It sends the same request the X website sends when you click
   "Block" yourself, with your own session. It opens no page and only runs while a
   logged-in x.com tab is open. Blocks then apply everywhere, including the mobile app.
   Blocking can be turned off in the settings if you only want hiding.
3. **Unblock what leaves the lists.** If an account disappears from all your lists (added
   by mistake, or a tampered list), the extension unblocks it the same way, provided it was
   the one that blocked it. Blocks you made yourself are never undone.
4. **A ⛔ button on every post.** One click: the post is hidden, the account is added to
   your list and queued for blocking. Five seconds to undo.
5. **Status and history.** The settings page shows listed, blocked and remaining accounts,
   when the next block is due, the history, and the full list with search. Any account can
   be **kept** (never hidden nor blocked) or, if it comes from your own list, **removed**.

All data stays in your browser. Nothing is sent to anyone. See [PRIVACY.md](PRIVACY.md).

## Before you install

- Automated actions are against X's terms of use. The moderate pace lowers the risk for
  your account; it does not remove it. Use a secondary account if you can.
- The extension depends on X's pages and internal addresses. When X changes, it may stop
  working until it is updated.
- On X, a blocked person can still see your public posts. They can no longer reply, like
  or message you, and you no longer see them.

## For list authors

A list is a JSON file served over HTTPS at a fixed address, with the header
`Access-Control-Allow-Origin: *`. In the extension, it is added by its address.

```json
{
  "format": "blocklist/1",
  "name": "List name",
  "description": "What it is for",
  "homepage": "https://example.org/",
  "updated": "2026-10-27T10:00:00Z",
  "entries": [
    { "site": "x", "id": "12345678", "handle": "example", "name": "Display name", "reason": "short text" },
    { "site": "instagram", "handle": "example" }
  ]
}
```

- `id` is the account's permanent numeric identifier. Give it when you have it: handles
  change, the id never does.
- `site`: `x`, `threads` or `instagram`. Other values are accepted and ignored. Only X is
  blocked for now.
- `updated` must change on every modification.
- Removing an entry removes the hiding, and the extension unblocks the account if it was
  the one that blocked it.
- Maximum size: 5 MB.

Naming people in a public list, especially for their political opinions, is sensitive
personal data under the GDPR. That is the list author's responsibility.

## The default list

`tools/feed/` reads the public files of the *On bloque l'extrême droite* website, resolves
each X account's permanent numeric id (no account, no API key: through the public
`x.com/intent/user` redirect) and writes `feed/blocklist.json`. A
[GitHub Actions workflow](.github/workflows/feed.yml) runs it hourly and publishes the
result at `https://pare-facho.github.io/blocklist-extension/blocklist.json`. The git
history shows every addition and removal. If the source loses more than a tenth of its
accounts at once (site under maintenance, partial download, tampered list), the list is not
published and the previous one stays online.

```
node tools/feed/run.ts   # one pass
```

Resolved ids are kept in `tools/feed/cache/x-ids.json`. `tools/feed/corrections.json`
fixes handles that are outdated on the source site.

## Development

Node 22 or newer.

```
npm install            # installs WXT and TypeScript
npm test               # unit tests (feed, format, block queue, pacing, translations)
npm run check          # type check
npm run build          # Chrome build in .output/chrome-mv3
npm run build:firefox  # Firefox build in .output/firefox-mv2
npm run zip            # store zips
```

To try a build in Firefox without the store: `about:debugging#/runtime/this-firefox`,
"Load Temporary Add-on", pick the zip. The add-on is removed when Firefox closes.

Layout: `entrypoints/` (background, X content script, settings page), `lib/` (shared logic,
tested under Node), `public/_locales/` (translations: French by default, English),
`tools/feed/` (list pipeline), [SPEC.md](SPEC.md) (specification).

Translations live in `public/_locales/<lang>/messages.json`. A test checks that every
language has the same keys.

## Licence

[GPL-3.0](LICENSE).
