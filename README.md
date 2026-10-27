# blocklist-extension

Tools to hide and slowly block accounts from lists you choose, on X, Threads and
Instagram. Two parts:

- **Feed pipeline** (`tools/feed/`): reads the public lists of
  [onbloquelextremedroite.fun](https://onbloquelextremedroite.fun/), resolves X
  handles to permanent user ids, and publishes one JSON feed:
  `https://lnilluv.github.io/blocklist-extension/blocklist.json`
  (format `blocklist/1`, see [SPEC.md](SPEC.md)). It runs hourly on GitHub Actions.
- **Browser extension** (in progress): subscribes to such feeds, hides posts from
  listed accounts right away, and blocks them in the background at a slow pace.

## Feed pipeline

```
node tools/feed/run.ts        # fetch, resolve new ids, write feed/blocklist.json
npm test                      # unit tests
```

Requires Node 22+. No API key or login: ids come from X's public
`intent/user` redirect. Lookups are cached in `tools/feed/cache/x-ids.json`.

The extension ships with no list. The lists and their contents are the
responsibility of the people who publish them.
