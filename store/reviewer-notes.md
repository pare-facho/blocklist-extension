# Notes for store reviewers

## Source code and reproducible build

Source: https://github.com/pare-facho/blocklist-extension (GPL-3.0). The
`pare-facho-<version>-sources.zip` attached to each GitHub release is the exact
tree the packages were built from.

Build requirements: Node.js 22, npm 10.

```sh
npm ci
npm run zip            # Chrome:  .output/pare-facho-<version>-chrome.zip
npm run zip:firefox    # Firefox: .output/pare-facho-<version>-firefox.zip
```

The build tool is WXT 0.21 (TypeScript bundling, no minification beyond what
esbuild does; no obfuscation). No remote code is loaded at runtime.

## What changed in 0.5.0

Posts from listed accounts are collapsed to a one-line strip instead of being
removed. In the default "block" mode, when a collapsed post is on screen the
content script drives X's own page: it clicks the post's "More" button
(`data-testid="caret"`), the "Block" menu item (`data-testid="block"`) and the
confirmation button (`data-testid="confirmationSheetConfirm"`), with a short
random pause between steps. X's own code then sends the block with the user's
session. The extension makes no request to x.com itself (see `lib/xui.ts`).

Pacing is fixed in `lib/pacing.ts`: at most 30 blocks per hour and 150 per day,
15 to 45 seconds between two, one at a time, only for posts actually rendered on
screen, never from a background queue (that was the 0.3 design, removed in 0.4).
The strip offers "Don't block" per post and the settings page a "Hide only" mode
that sends nothing. Users updating from 0.4 get the settings page opened once,
with the change explained at the top.

## Two Firefox channels, same code

While the listed version waits for review, the same build is also submitted on
the self-distributed channel so that the signed `.xpi` can be linked from the
README (`pare-facho-firefox.xpi` on the GitHub release). AMO does not accept the
same version number on both channels, so the self-distributed build carries a
fourth component (listed `0.4.0`, self-distributed `0.4.0.1`); the manifest
version is the only difference.

## How to test

1. Open the extension settings page.
2. The default list (`https://pare-facho.github.io/blocklist-extension/blocklist.json`)
   is subscribed automatically at install; the status board shows the number of
   accounts hidden. Other lists can be added by address (host permission prompt).
3. Open https://x.com logged in: posts and reposts from listed accounts are collapsed
   to a strip "⛔ @handle · post hidden". In block mode the strip reads "blocking in a
   moment", then "blocked ✓" once X has confirmed; the account appears under "Accounts
   blocked by the extension" in the settings and in X's own "Blocked accounts" page.
   Every other post gets a ⛔ button that adds its author to "My list" (undo for 5
   seconds), after which the same happens to it.
4. Choose "Hide only" in the settings: strips still appear, nothing is sent.
5. In the settings page, "Keep" on an account brings its posts back.

## Permissions

- `storage`: lists, settings and activity log, locally.
- `alarms`: the periodic list refresh (every 6 hours).
- `https://x.com/*`: collapse posts in the page, add the button and, in block mode, click
  X's own "Block" menu. The extension sends no request of its own.
- `https://pare-facho.github.io/*`: download the default list.
- optional `https://*/*`: requested per list address when the user subscribes, to download it.

No analytics, no telemetry, no remote server of our own.
