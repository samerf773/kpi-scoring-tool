# KPI Scoring Tool

Branch KPI scorecards for **Happy** and **Happy Extra**: enter each branch's Receiving Audit and the weighted KPI score, ranking, heatmap and charts update straight away. Targets, weights and grade rules follow the KPI Scoring Tool workbook (end of October 2026).

Live site: https://samerf773.github.io/kpi-scoring-tool/

## Signing in

Two accounts exist: `mohammad_atwi` and `anthony_ziade`. Only salted PBKDF2 hashes are stored, in `users.json`.

To change a password:

```
node set-password.mjs mohammad_atwi "new password"
npm install
npm run build
```

Commit `users.json` and `index.html`.

## Logo

Put the logo at `assets/logo.png`. It appears on the sign-in screen and in the page header. Without the file it is simply left out.

## Limits to know about

- **The login is a front-end gate.** GitHub Pages serves static files, so the page's code, including the October branch figures in `src/seed.json`, can be read by anyone who opens the source. For private data, keep the repo private or move the data behind a real backend.
- **Entries are saved in each person's own browser** (local storage). Two users on different devices do not see each other's changes.

## Development

```
npm install
npm run build   # writes index.html
```

Source is in `src/` (React, bundled by esbuild). `src/score.js` holds the scoring rules.
