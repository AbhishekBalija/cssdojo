# Project context (handoff)

Snapshot of decisions and state as of 2026-10-27. Written so a local agent that cannot see the planning chats knows what is settled. If code and this file disagree, trust the code and fix this file.

## Product

- **Goal:** a public, CSSBattle-like site where players rebuild small, real UI pieces (buttons, toggles, cards, tooltips), not landing pages and not code golf.
- **Score:** 70% visual match + 30% outcome checks, 0 to 100, solved at 90. No character count.
- **Who it is for:** job-ready CSS learners. Free, no payments. Guests can play; sign in to save (guest progress merges on sign-in).
- **Brand:** CSS Dojo. Difficulty = belts (white, yellow, green, brown, black). Daily challenge = kata. Versus = sparring (after launch).
- **Look:** minimal graphite, calm three-pane play screen, monochrome UI, one lilac accent that only marks "you". Fonts Onest, Martian Mono, Instrument Serif italic (target names only). Tokens in `client/src/tokens.css`. No AI-generated assets, references studied but never copied.

## Spec documents

| Doc | Link |
| --- | --- |
| PRD v1 | https://claude.ai/artifact/2ZhxQvVb8R3qyEwDDSEPMv |
| Challenge format and scoring | https://claude.ai/artifact/K5BX1R8DAWsYZJWFf4DeWp |
| Locked decisions and MVP brief | https://claude.ai/artifact/F6ECy1yKpHLw4SGidVVvLq |
| Ranking review (approved plan in "Final check") | https://claude.ai/artifact/V2JG7f3XoY3yKFQwNFxpDm |
| Front screens mockup (v49, approved) | https://claude.ai/artifact/VXBNLC4XxDqZsEeLQszugQ |
| Interaction polish catalogue | https://claude.ai/artifact/UH1mQeTB6eLJThCposQc7X |
| Screenshots of built screens | https://claude.ai/artifact/XvGA3CnGLDQM1Bqo7zSMKx |
| QA bug list (2026-10-27) | https://claude.ai/artifact/TAMyFNBT9e6Vu5Si1hgqgw |

In-repo summaries: `docs/requirements/` (mvp.md, ranking.md), `docs/adr/`, `docs/guides/`, `motion/approved-polish.md`.

## Stack

- Bun workspace: `client` (Vite, React, Tailwind, shadcn-style, lucide, CodeMirror), `server` (Hono, zod, Drizzle, Better Auth with GitHub + Google), `shared` (zod types), `scorer` (Playwright with pinned Chromium, pixelmatch).
- Postgres on Neon. Scoring jobs go through a Postgres queue (ADR 0003). API and scorer ship in one Docker container for now; the scorer stays a separate package so it can split out later.
- Commands: `bun run dev`, `bun run ci` (lint + typecheck + test), `bun run golden`, `bun run targets`, `bun run e2e`, `bun run db:migrate`.

## Hosting

- **Client:** Vercel, https://cssdojo-tau.vercel.app (main app link). Proxies `/api` and `/static` to the API so cookies are first-party.
- **API + scorer:** Render free web service `cssdojo-api`, https://cssdojo-api.onrender.com. Pages on that host redirect to Vercel. The old Render static site `cssdojo.onrender.com` is redundant.
- **DB:** Neon (`DATABASE_URL`).
- Both deploy from `feature/mvp` today; switch to `main` after the release PR merges.
- Prod has no test login (`ENABLE_TEST_LOGIN=false`). OAuth callbacks are on the Vercel origin.

## Branch model

- `feature/mvp` is the long-lived MVP branch. Task and fix branches open PRs into it.
- `main` is nearly empty until release PR **#15** (`feature/mvp` into `main`) merges. The first release is **v1.0.0**, not v0.1.0. A fresh clone of `main` looks empty for this reason.
- Never push to `main`. Abhi merges, tags and releases.

## Locked decisions

### Scoring and challenges
- Each challenge is a folder in `challenges/` (challenge.json, starter.html, reference.html, note.md, golden/). 30 library challenges + 14 kata today.
- Frames: rest, hover, focus. The 320px narrow frame was dropped.
- Per frame: `100 * S^2 * (1 - meanDeltaE / 20)` on the component region, rendered at 2x in pinned Chromium with JS and network off. Colour term was made gentler (C^2 with C = 1 - dE/12).
- **Checks are outcome-only.** No check may require a property, selector or layout method. Hints say what is wrong, never how to fix it. The technique is the player's choice.
- Starter code must score low: checks need hooks placed like the target, the golden starter maxes at 15.
- **Value scale:** target values snap to a Tailwind-like spacing scale (`scorer/src/value-scale.ts`), enforced by a lint test.
- **Icons ship ready:** every icon or glyph (ticks, arrows, separators, SVGs) is inline in the starter. Players only size, colour and place it. Component shapes (toggle thumb, ticket notches, tab underline) stay CSS. Enforced in `challenges.test.ts`.
- Live target = canvas replay of frames recorded at publish. No target CSS is shipped to the browser.
- Help: hints on failed checks, technique note after 3 submits, solutions open any time but opening them locks your points on that challenge.

### Ranking (CSSBattle-shaped)
- **Battle Packs:** numbered sets of 6 challenges. Release any time with an "Opens in" countdown and Notify me. Live 4 weeks by default (per-pack override), then Finished but still playable and still counts. Each pack has its own board.
- **Points:** by belt, white 200 / yellow 400 / green 600 / brown 800 / black 1000, curve `max * ((score - 50) / 50)^2`. All-time = sum of best points.
- **Leaderboard:** one All-time list by points (the Wall), belt shown as a badge, not grouped by belt. Tabs: All-time, Battle Pack, By challenge, Streaks.
- **Belts:** earned with 5 solves (90+) of that belt. Belt is a level badge, no effect on points.
- **Ties:** whoever reached the score first.
- **Daily kata:** for fun and streaks only. No leaderboard, no points, and it does **not** count toward belts. Any Submit on today's kata that changed the starter keeps the streak. Kata resets at 00:00 UTC.
- Achievements: 18 badges, header bell, toasts. Live moves: header LIVE announcer, Recent moves strip, "X passed you" at most once per board per hour. No floating pills.

### Interaction polish
- Rules: purpose first, under ~300ms, ease-out, transform/opacity only, respect reduced motion, content never waits.
- Kept: live line, toasts, countdown, press, focus, tiles, tabs, copy, checks, rolling score, diff (hold D), onion skin (hold G), states playback, crosshair, theme fade, loading.
- Tweaked: leaderboard rows 280ms; streak tag swings only when it grows (no idle loop); belt and lamp use the real v49 assets; confetti full screen on first solves; sound off by default.
- Dropped: submit label progress (toast after scoring instead). Page change = 120ms fade.
- Countdown shows seconds whenever under a day is left, so the clock never looks stuck (Abhi's call, replaces "seconds only in the last hour").

## Open PRs (into `feature/mvp` unless noted)

| PR | What | Notes |
| --- | --- | --- |
| #15 | Release `feature/mvp` into `main` (v1.0.0) | Merge last, once Abhi's bug pass is done. Then switch Render to `main`, Abhi tags v1.0.0 (`docs/releases/v1.0.0.md`). |

Merged since the last update: #20 to #27 (env loading, starter icons, target layouts, QA sweep, Mismatch score map, test database, light theme shadows and countdown seconds).

## Known open items

- **Render cold start:** the free API sleeps and takes about 80s on the first hit.
- **Abhi's bug pass:** Abhi is checking the app by hand before release and will report fixes one by one.
- **Abhi's local work:** unpushed branch `fix/tsconfig-baseurl` (drops deprecated `baseUrl`). Ask before pushing it.
- **Release notes** in `docs/releases/v1.0.0.md` were written before ranking and the front screens; refresh the highlights from CHANGELOG before tagging.
- Phone pages scroll sideways (`.d-mtn svg` at `right: -24px`): #23 moved it flush right, not yet re-checked on a phone.
- **Launch target: early January 2027.** Before then: an always-on API (no cold start), a custom domain (fixes the Safari/Firefox cookie), and Google OAuth published.
- Safari/Firefox block the cross-site cookie on `onrender.com`; the Vercel proxy avoids it, a custom domain fixes it for good (ADR 0005).
- Google OAuth consent screen may still be in Testing (add test users or publish).
- `cssdojo.com` looked free on 2026-10-25; trademark check and purchase pending.
- After launch: sparring (versus), 16 more kata, seasons once there are 50+ challenges, splitting the scorer service, Sentry, custom domain.
