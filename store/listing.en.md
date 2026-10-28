# Store listing — Pare-Facho (English)

## Name
Pare-Facho

## Summary (Chrome: 132 characters max)
Block the far right: hides and step by step blocks listed far-right accounts, whether you follow them or not. X for now.

## Long description

Pare-Facho hides and blocks far-right accounts on X, based on lists you choose.

What it does:

• Hide now. Posts from listed accounts disappear from your timeline, replies and search as they render. Nothing changes on X, only your screen.

• Block step by step, in the background (on by default, can be turned off). The extension blocks listed accounts one at a time, at a pace you set (defaults: at most 30 per hour, 1000 per day, with a random 5–15 second gap between two). It sends the same request the X website sends when you click "Block" yourself, with your own session. It opens no page and only runs while a logged-in x.com tab is open. If an account leaves all your lists (added by mistake, or a tampered list), the extension unblocks it the same way, provided it was the one that blocked it.

• A ⛔ button on every post: one click to hide, add the account to your list and queue it for blocking. Five seconds to undo.

• Your lists, your control. The list of the "On bloque l'extrême droite" website is subscribed by default and refreshed automatically; you can remove it, subscribe to other addresses, add your own accounts, and "keep" any account so it is never hidden nor blocked.

• Status and history: accounts listed, blocked, remaining, next block, full list with search.

Privacy: no data collected, no server. Everything stays in your browser. The only connections are downloading the lists (the default one and those you add) and the blocks you ask for on x.com.

Be aware: automated actions are against X's terms of use. A moderate pace lowers the risk for your account; it does not remove it. Prefer a secondary account.

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
Hide and block on X the accounts found in lists chosen by the user.

## Permission justification (Chrome)
- storage: save lists, settings, block queue and history, locally.
- alarms: check lists periodically and run the blocks in the background, at the configured pace.
- Host access to x.com: hide posts from listed accounts in the page, show the ⛔ button, and send block and unblock requests with the user's session.
- Host access to pare-facho.github.io: download the default list and its updates.
- Optional host access to other sites (optional host permission https://*/*): requested only, and case by case, when the user adds a list address, to download it.
- No remote code: all code is in the package.

## Data collection (Chrome form)
No data collected or transmitted. No sale, no use outside the purpose, no creditworthiness use.

## Screenshots (to provide, 1280×800 or 640×400)
1. X timeline with the ⛔ button visible on a post.
2. Settings page: status + subscribed lists.
3. Settings page: full list with search and Keep / Remove buttons.
4. Settings page: history.
