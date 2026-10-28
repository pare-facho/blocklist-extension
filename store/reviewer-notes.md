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

## What changed in 0.4.0

Versions up to 0.3.x could also block the listed accounts through X's own web
endpoints, at a paced rate. That feature is gone: the extension now only hides
posts inside the page. It sends no request to x.com. The "blocking" settings,
the queue and the history were removed, and the stored data of older versions
is cleaned up at update.

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
3. Open https://x.com (logged in or not): posts and reposts from listed accounts are
   hidden, and every other post gets a ⛔ button that hides its author and adds them
   to "My list" (undo for 5 seconds).
4. In the settings page, "Keep" on an account brings its posts back.

## Permissions

- `storage`: lists, settings and activity log, locally.
- `alarms`: the periodic list refresh (every 6 hours).
- `https://x.com/*`: hide posts in the page and add the button. No request is sent.
- `https://pare-facho.github.io/*`: download the default list.
- optional `https://*/*`: requested per list address when the user subscribes, to download it.

No analytics, no telemetry, no remote server of our own.
