# Pare-Facho

*[Version française](README.md)*

A Chrome and Firefox extension that hides on X the posts of the far-right accounts listed
by the French website [On bloque l'extrême droite](https://onbloquelextremedroite.fun/).
The site's list is subscribed at install and refreshed regularly. You can remove it, add
other lists, and add or remove accounts yourself.

The extension does not touch your account: it blocks, mutes or reports nobody. It only
changes what shows on your screen.

## Install

### Firefox

The extension is waiting for Mozilla's review. Until the official page
([addons.mozilla.org/firefox/addon/pare-facho](https://addons.mozilla.org/firefox/addon/pare-facho/))
is live, you can install the Mozilla-signed build in two steps:

1. In Firefox, click this link:
   [pare-facho-firefox.xpi](https://github.com/pare-facho/blocklist-extension/releases/latest/download/pare-facho-firefox.xpi).
2. Firefox first asks for permission to install from GitHub: click "Continue to
   Installation" (or "Allow"), then "Add" in the "Add Pare-Facho?" dialog.

Alternatively, download the `.xpi` file, then drag it onto a Firefox window, or open
`about:addons`, click the gear icon and choose "Install Add-on From File…".

This build is signed by Mozilla, so it works in regular Firefox and stays installed. A
`.zip` or an unsigned `.xpi` is refused by Firefox ("the add-on could not be verified"): do
not use `pare-facho-firefox.zip` to install, it only exists for code review.

### Chrome, Edge, Brave

The extension is being reviewed by Google. Until then you can install it by hand in five
steps:

1. Download this file:
   [pare-facho-chrome.zip](https://github.com/pare-facho/blocklist-extension/releases/latest/download/pare-facho-chrome.zip).
2. Unzip it (double-click the file). You get a folder named `pare-facho-chrome`. Keep it:
   the browser uses it.
3. In the browser, type `chrome://extensions` in the address bar and press Enter
   (`edge://extensions` in Edge, `brave://extensions` in Brave).
4. Turn on "Developer mode" (switch at the top right).
5. Drag the unzipped folder onto that page, or click "Load unpacked" and choose the folder.

The `.zip` file itself cannot be dropped: unzip it first.

That is all. Open [x.com](https://x.com): listed accounts disappear from your screen. The
extension's icon (in the extensions menu, top right) opens the settings page.

## What it does

1. **Hide.** On x.com, posts from listed accounts disappear from your screen as they
   render: timeline, replies, search, profiles. Reposts made by a listed account are hidden
   too. Nothing changes on X, only your display.
2. **A ⛔ button on every post.** One click: the post is hidden and the account is added to
   your list. Five seconds to undo.
3. **Your lists, your control.** The settings page shows the subscribed lists, your own
   list, the full list with search, and the activity log. Any account can be **kept**
   (never hidden) or, if it comes from your own list, **removed**.

All data stays in your browser. Nothing is sent to anyone. See [PRIVACY.md](PRIVACY.md).

Up to version 0.3 the extension could also block the listed accounts, step by step, with
your session. That feature was removed in version 0.4: automated actions are against X's
terms of use and exposed your account. Blocks made by an older version stay in place; you
can undo them in X's settings ("Blocked accounts").

## Before you install

- The extension depends on X's pages. When X changes its layout, it may stop hiding until
  it is updated.
- Hiding only works in the browser where the extension is installed. The mobile app shows
  everything.

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
  supported for now.
- `updated` must change on every modification.
- Removing an entry removes the hiding at the next refresh.
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
npm test               # unit tests (feed, format, matching, translations)
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
