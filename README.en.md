# Pare-Facho

*[Version française](README.md)*

A Chrome and Firefox extension that hides on X the posts of the far-right accounts listed
by the French website [On bloque l'extrême droite](https://onbloquelextremedroite.fun/).
The site's list is subscribed at install and refreshed regularly. You can remove it, add
other lists, and add or remove accounts yourself.

The extension collapses those posts and, when the post reaches your screen, acts through
X's own menu, with your session, at a human pace. Two settings: "Not interested" on every
post (default), or mute the account. Nothing is blocked. The section
[What weighs on their reach](#what-weighs-on-their-reach) explains why.

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

1. **Collapse.** On x.com, posts from listed accounts are replaced by a line
   "⛔ @account · post hidden" as they render: timeline, replies, search, profiles. Reposts
   made by a listed account are collapsed too. A "Show" button reveals the post anyway.
2. **Act from the feed.** When the collapsed line is on screen, the extension opens the
   post's "⋯" menu and picks, depending on the setting:
   - **"Not interested in this post"** (default), on every served post. Nothing is blocked
     or muted: X keeps serving you the account, and each new post sends a new signal. X
     shows its own "Undo" in place of the post.
   - **"Mute"**, once per account. X then stops showing you the account; the account is
     not told. Undo in X's settings ("Muted accounts").

   These are X's own clicks and requests, with your session. Pace: at most 30 actions per
   hour and 150 per day, a 15 to 45 second pause between two, one at a time, never in the
   background, never from a profile page. What the extension did is listed in the settings.
3. **A ⛔ button on every post.** One click: the account is added to your list, the post is
   collapsed and handled like a listed account's. Five seconds to undo.
4. **Your lists, your control.** The settings page shows the subscribed lists, your own
   list, the full list with search, and the activity log. Any account can be **kept**
   (never hidden) or, if it comes from your own list, **removed**.

All data stays in your browser. Nothing is sent to anyone but X, and only as your own
clicks in its menu. See [PRIVACY.md](PRIVACY.md).

**Be aware.** X forbids bulk automated actions. The extension only acts on posts X has
shown you, one by one, at a human pace, and never on the whole list in the background
(which is what the 0.3 versions did, removed in 0.4). It is still your account that acts:
the choice is yours. The menu labels are recognised in ten X interface languages (English,
French, Spanish, German, Italian, Portuguese, Dutch, Polish, Arabic, Turkish); in another
language, posts are only collapsed.

## What weighs on their reach

X published the ranking code of its "For you" feed (repository
[xai-org/x-algorithm](https://github.com/xai-org/x-algorithm)). What the extension does
follows from it.

- **The ranking only learns from actions made on a post it served you in your feed.** The
  negative signals that train the model are all "from the post": not interested, mute,
  block, report. A block or a mute made from a profile page does not exist in that
  training data. That is why the extension never acts from a profile or in the background.
- **The weight of each action** in a post's final score (published default values; they
  multiply the predicted probability of the action, not a raw count): report −234, mute
  −58.8, not interested −52.3, block −31.2; a like is worth +0.66. A report is an abuse
  claim with a reason: the extension does not automate it.
- **"Not interested" repeats, mute and block do not.** After a mute or a block, X removes
  the account from your feed: you send one signal per account, ever. After "not
  interested", X keeps serving the account, and every served post gets a new signal; each
  post's "not interested" count is also a feature stored with it. Two marked posts already
  weigh more than one mute. The extension does not pick "Show fewer posts from…", which
  would make the account disappear from your feed.
- **Limits.** The model is personalised: the effect concentrates on people whose feed
  looks like yours. The weights are those of the published code; production values may
  differ. X watches sequences of actions to detect automation: the pace above stays a
  person's.

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
    { "site": "x", "handle": "another_example" }
  ]
}
```

- `id` is the account's permanent numeric identifier. Give it when you have it: handles
  change, the id never does.
- `site`: `x`. Other values are accepted and ignored: the extension deals with X only.
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
npm test               # unit tests (feed, format, matching, menu labels, translations)
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
