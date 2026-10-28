# Pare-Facho

*[Version française](README.md)*

A browser extension (Chrome and Firefox) that **hides** and **step by step blocks** the accounts
on lists you choose to subscribe to. First target: X. Threads and Instagram are planned.

The project started to make use of the list published by
[On bloque l'extrême droite](https://onbloquelextremedroite.fun/): it is **subscribed by
default** at install (refreshed hourly from this repository). You can remove it, add other
lists, and remove or add accounts yourself.

> **Beta.** The code is public and tested automatically, but the extension is not yet on
> the stores. Install it by hand (see below) and prefer a secondary account.

## What it does

1. **Hide now.** On x.com, posts from listed accounts disappear from your screen as they
   render: timeline, replies, search. Nothing changes on X, only your display.
2. **Block step by step, in the background (on by default, can be turned off).** While enabled, the
   extension blocks listed accounts one at a time, at an adjustable pace (defaults: at most 300 per
   hour, 1000 per day, with a random 5–15 second gap). It sends exactly the request the X
   website sends when you click "Block" yourself, with your own session. It opens no page,
   clicks nothing, and only runs while a logged-in x.com tab is open. Real blocks then
   apply everywhere, including the mobile app.
   If an account leaves all your lists (added by mistake, or a tampered list), the
   extension unblocks it the same way, provided it was the one that blocked it: blocks
   you made yourself are never undone.
3. **A ⛔ button on every post.** One click: the post is hidden, the account is added to
   *my list* and queued for blocking. Five seconds to undo.
4. **Status and history.** The settings page shows how many accounts are listed, blocked,
   remaining, when the next block is due, the history of recent blocks, and the full list
   with search. Any account can be **kept** (never hidden nor blocked) or, if it comes from
   your own list, **removed**.

All data stays in your browser. See [PRIVACY.md](PRIVACY.md).

## Install (beta)

Download the zip from the
[latest release](https://github.com/pare-facho/blocklist-extension/releases).

- **Chrome / Edge / Brave**: unzip. Open `chrome://extensions`, enable "Developer mode",
  click "Load unpacked" and pick the unzipped folder.
- **Firefox**: open `about:debugging#/runtime/this-firefox`, click "Load Temporary Add-on"
  and pick the zip. (A temporary add-on is removed when Firefox closes; publishing on
  addons.mozilla.org will fix that.)

Then open the extension's settings and add a list, for example:

```
https://pare-facho.github.io/blocklist-extension/blocklist.json
```

This list is generated every hour from the *On bloque l'extrême droite* website (see
[The feed](#the-feed)).

## Risks, stated plainly

- Automated actions are against the terms of X and the other networks. The pacing lowers
  the risk for your account; it is not a guarantee. **Use a secondary account if
  you can.**
- Hiding depends on the structure of X's pages; blocking depends on its internal
  addresses. When X changes, the extension may stop working until it is updated.
- Since late 2024, someone you block on X can still see your public posts. They can no
  longer reply, like or message you, and you no longer see them.

## For list authors: the format

A list is a JSON file served over HTTPS at a fixed address, with the header
`Access-Control-Allow-Origin: *`.

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

- `id` is the account's permanent numeric identifier: give it when you have it; handles
  change, the id never does.
- `site`: `x`, `threads` or `instagram`. Other values are accepted and ignored.
- `updated` must change on every modification. Removing an entry removes the hiding; a
  block already done is not undone.
- Maximum size: 5 MB.

Naming people in a public list, especially for their political opinions, is sensitive
personal data under the GDPR. That is the list author's responsibility, not the
extension's.

## The feed

`tools/feed/` reads the public files of the *On bloque l'extrême droite* website, resolves
each X account's permanent numeric id (no account, no API key: through the public
`x.com/intent/user` redirect), and writes `feed/blocklist.json`. A
[GitHub Actions workflow](.github/workflows/feed.yml) runs it hourly and publishes the
result on GitHub Pages. The git history shows every addition and removal.

```
node tools/feed/run.ts   # one pass
```

Resolved ids are kept in `tools/feed/cache/x-ids.json`. `tools/feed/corrections.json`
fixes handles that are outdated on the source site.

## Development

Node 22 or newer.

```
npm install            # installs WXT and TypeScript
npm test               # unit tests (feed, format, pacing, translations)
npm run check          # type check
npm run build          # Chrome build in .output/chrome-mv3
npm run build:firefox  # Firefox build in .output/firefox-mv2
npm run zip            # store zips
```

Layout: `entrypoints/` (background, X content script, settings page), `lib/` (shared logic,
tested under Node), `public/_locales/` (translations: French by default, English),
`tools/feed/` (feed pipeline), [SPEC.md](SPEC.md) (specification).

Translations live in `public/_locales/<lang>/messages.json`. A test checks that every
language has the same keys.

## Licence

[GPL-3.0](LICENSE).
