# Store listing — Pare-Facho (English)

## Name
Pare-Facho

## Summary (Chrome: 132 characters max)
Block the far right: collapses the posts of listed far-right accounts and blocks them, from your feed. X for now.

## Long description

Pare-Facho collapses on X the posts of far-right accounts, based on lists you choose, and blocks those accounts from your feed, with your session, as if you clicked yourself.

What it does:

• Collapse. Posts from listed accounts are replaced by a line "⛔ @account · post hidden" in your timeline, replies, search and profiles. Reposts made by a listed account are collapsed too. A "Show" button reveals the post.

• Block from the feed (default). When the collapsed line is on screen, the extension opens the post's menu, picks "Block" and confirms, as you would by hand. At most 30 blocks per hour and 150 per day, 15 to 45 seconds between two, one at a time, never in the background. "Don't block" on the line, or "Hide only" in the settings, to send nothing to X.

• A ⛔ button on every post: one click to add the account to your list (and block it, in block mode). Five seconds to undo.

• Your lists, your control. The list of the "On bloque l'extrême droite" website is subscribed by default and refreshed automatically; you can remove it, subscribe to other addresses, add your own accounts, and "keep" any account so it is never hidden.

• Settings page: mode (block or hide only), accounts hidden and blocked, subscribed lists, full list with search, activity log.

Privacy: no data collected, no server. Everything stays in your browser. The extension's only connections are the list downloads (the default one and those you add); blocks are sent by X's own page, with your session.

Be aware: hiding only works in this browser; the mobile app shows everything. When X changes its layout, the extension may stop hiding until it is updated.

Free software (GPL-3.0). Source code: https://github.com/pare-facho/blocklist-extension

## Category
Chrome: Social & Communication. Firefox: Social & Communication.

## Default language
French (English available).

## Privacy policy (URL)
https://github.com/pare-facho/blocklist-extension/blob/main/PRIVACY.md

## Homepage / support
https://github.com/pare-facho/blocklist-extension
https://github.com/pare-facho/blocklist-extension/issues

## Single purpose (Chrome)
Hide on X the posts of the accounts found in lists chosen by the user.

## Permission justification (Chrome)
- storage: save lists, settings and activity log, locally.
- alarms: re-download the lists periodically.
- Host access to x.com: collapse posts from listed accounts in the page, show the ⛔ button and, in block mode, click "Block" in X's own menu. The extension itself sends no request to X.
- Host access to pare-facho.github.io: download the default list and its updates.
- Optional host access to other sites (optional host permission https://*/*): requested only, and case by case, when the user adds a list address, to download it.
- No remote code: all code is in the package.

## Data collection (Chrome form)
No data collected or transmitted. No sale, no use outside the purpose, no creditworthiness use.

## Screenshots (to provide, 1280×800 or 640×400)
1. X timeline with the ⛔ button visible on a post.
2. Settings page: status + subscribed lists.
3. Settings page: full list with search and Keep / Remove buttons.
