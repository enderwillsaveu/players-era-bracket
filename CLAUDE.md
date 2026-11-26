# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An unofficial live bracket site for the Players Era men's college basketball tournaments in Las Vegas (the 8-team event and the 16-team, two-arena event). Data comes from ESPN's public, keyless, undocumented site API. It can change without notice, and multi-day `dates=` ranges on the scoreboard endpoint return 400, so fetch one day at a time.

## Commands

- `npm run dev`: Node API on :3000 (restarts on `server/` changes) plus the Vite dev server on :5173, which proxies `/api` to the API. Set `PORT` to move the API; the proxy follows it.
- `npm run build`: builds the React app into `dist/`.
- `npm start`: production. Serves `dist/` and `/api` from one Node process. Needs `npm run build` first.
- `npm test`: runs `node --test` over `test/**/*.test.js`.
- Single test: `node --test --test-name-pattern="poll plan" test/bracket.test.js`

Deep links work for manual checks: `/?team=TENN&event=pe8&view=teams&game=<espnEventId>`.

## Architecture

The repo has two halves with different module systems. `server/` is CommonJS with zero runtime dependencies (`package.json` has `"type": "commonjs"`). `web/` is ESM, React 19 + `motion`, and Vite builds it (the config is `vite.config.mjs`, with `root: 'web'`).

**Data flow:** `server/tournament.js` fetches the ESPN scoreboard for every date in `server/config.js`. It normalizes the games (`server/normalize.js`), keeps those whose note headline prefix matches a configured event name, and builds bracket structures (`server/bracket.js`). One shared in-memory cache sits in front of ESPN, and its TTL depends on game state. The response includes `pollMs` (15s live, 30s near tip, 2m idle, 10m done), and the client polls at that rate (`web/src/lib/usePolling.js`). Polling pauses while the tab is hidden and backs off on errors. When ESPN fails, the last good data is served with `stale: true`.

**Bracket inference (`server/bracket.js`) is the core logic.** ESPN doesn't say which game feeds which, so the structure is inferred from the fixed 8-team template (QF → winners' SF and consolation SF → Final / 3rd / 5th / 7th):

- Round games (no placement label) sorted by tip time: the first 4 are QFs, the rest are round two.
- QF pairing comes from which QFs' teams meet in round two. A round-two game is a winners' semi if its teams won their QF.
- Placement games are identified by their note label ("Bracket Final", "Third Place Game", ...). In a one-bracket event, "Championship" is that bracket's final. In a two-bracket event it's the separate title game.
- Two-bracket events are split by venue, then corrected by team membership.
- Every slot has `sides` ordered to match its `feeders`, so the client's bracket lines connect correctly. A TBD side gets a `projected` team once its feeder game is final.

`test/fixtures/games-2026-11-25.json` is a real normalized snapshot (PE8 complete, PE16 after round one). Tests simulate later rounds by mutating copies of it.

**Client:** `App.jsx` owns the polling, the selected event/view/team (in localStorage), and the change feed that diffs consecutive polls to fire toasts and title confetti. The bracket lines are SVG paths that `Connectors.jsx` computes from DOM positions using `data-card` / `data-anchor` attributes. It must use a passive `useEffect`, because a child's layout effect runs before the parent container's ref is attached. Team colors come from ESPN and are often too dark for the dark UI. `lib/colors.js` `palette()` picks legible accents, and the components consume them as `--t` / `--ta` / `--ta2` CSS variables. Picking a team rewrites the root `--brand` / `--accent` / `--accent-2` variables to theme the whole site.

## Updating for a new season

Edit `server/config.js`: event `name` (must match ESPN's note headline prefix), `dates` (US Eastern calendar days) and `brackets`. Nothing else is year-specific.
