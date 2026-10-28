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

## How to test

1. Open the extension settings page.
2. In "Subscribed lists", add `https://pare-facho.github.io/blocklist-extension/blocklist.json`
   and accept the host permission prompt. The status board shows the number of
   accounts listed.
3. Open https://x.com while logged in: posts from listed accounts are hidden
   and every post gets a ⛔ button that adds its author to "My list".
4. Real blocking is off by default. When enabled in "Blocking", the extension
   sends the same block request as the X website, one account at a time, at the
   configured pace, only while an x.com tab is open.

## Permissions

- `storage`, `alarms`: local state and the periodic tick.
- `https://x.com/*`: hide posts, add the button, send block requests with the user's session.
- optional `https://*/*`: requested per list address when the user subscribes, to download it.

No analytics, no telemetry, no remote server of our own.
