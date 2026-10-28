# Store listing — Pare-Facho (English)

## Name
Pare-Facho

## Summary (Chrome: 132 characters max)
Block the far right: collapses the posts of listed far-right accounts on X and tells X you are not interested in them.

## Long description

Pare-Facho collapses on X the posts of far-right accounts, based on lists you choose, and acts from your feed through X's own menu, with your session, as if you clicked yourself: "Not interested in this post" on every post (default), or "Mute" the account. Nothing is blocked.

What it does:

• Collapse. Posts from listed accounts are replaced by a line "⛔ @account · post hidden" in your timeline, replies, search and profiles. Reposts made by a listed account are collapsed too. A "Show" button reveals the post.

• Act from the feed. When the collapsed line is on screen, the extension opens the post's menu and picks "Not interested in this post" (default) or "Mute", as you would by hand. At most 30 actions per hour and 150 per day, 15 to 45 seconds between two, one at a time, never in the background, never from a profile. The settings page explains what each option weighs on the account's reach, from the ranking code X published.

• A ⛔ button on every post: one click to add the account to your list. Five seconds to undo.

• Your lists, your control. The list of the "On bloque l'extrême droite" website is subscribed by default and refreshed automatically; you can remove it, subscribe to other addresses, add your own accounts, and "keep" any account so it is never hidden.

• Settings page: mode (not interested or mute), counters, subscribed lists, full list with search, what the extension did, activity log.

Privacy: no data collected, no server. Everything stays in your browser. The extension's only connections are the list downloads (the default one and those you add); actions are sent by X's own page, with your session.

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
Collapse on X the posts of the accounts found in lists chosen by the user, and mark them "not interested" (or mute the account) from the feed.

## Permission justification (Chrome)
- storage: save lists, settings and activity log, locally.
- alarms: re-download the lists periodically.
- Host access to x.com: collapse posts from listed accounts in the page, show the ⛔ button and click "Not interested in this post" or "Mute" in X's own menu. The extension itself sends no request to X.
- Host access to pare-facho.github.io: download the default list and its updates.
- Optional host access to other sites (optional host permission https://*/*): requested only, and case by case, when the user adds a list address, to download it.
- No remote code: all code is in the package.

## Data collection (Chrome form)
No data collected or transmitted. No sale, no use outside the purpose, no creditworthiness use.

## Screenshots (1280×800, folder store/screenshots)
1. `1-strips.png`: on X, the posts of a listed account collapsed to one line (⛔ @account · post hidden) with the Show button.
2. `2-status.png`: settings page, status and mode choice with the explanation.
3. `3-lists.png`: settings page, subscribed lists and my list.
4. `4-full-list.png`: settings page, full list with search and Keep / Remove buttons.
