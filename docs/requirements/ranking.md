# Ranking: points, Battle Packs, badges and live moves

Approved by Abhi on 2026-10-26. Full reasoning: the review doc "CSS Dojo: is the leaderboard worth competing for?".

## Rules

- **Points per challenge** = `max * ((score - 50) / 50)^2`, with max by belt: white 200, yellow 400, green 600, brown 800, black 1000. 100 gives the full max, 90 gives 64%, 50 or less gives 0.
- **The Wall (all-time)** = sum of your best points over every Battle Pack challenge (library board). One list ranked by points; your highest belt is shown as a badge.
- **Ties** go to whoever reached the score first.
- **Opening solutions locks your points** on that challenge. You can keep playing, but later Submits no longer change your points or rank there. Solutions are not gated at 90 any more: the lock replaces the gate.
- **Battle Packs**: numbered and themed, 6 challenges of one belt, defined in `challenges/packs.json`. They release any time. Upcoming packs show a countdown and hide their belt and challenges. A pack is live for 28 days unless it sets `endsAt`, then it is finished: its board freezes as final standings, the pack stays playable and still counts on the Wall.
- **Belts** are unchanged: solve 5 of a belt (90+), in order.
- **Daily kata** has no leaderboard. A streak day needs any Submit on that day's kata that changed the starter code, solved or not.
- **Badges**: the 18 in `shared/src/ranking.ts` (`BADGES`). Sparring is shown but not earnable yet.
- **Notifications** (bell + toast): someone passed you (at most one per board per hour), badge earned, belt earned, a pack you follow opens.
- **Live events** (header LIVE line): new #1 on a challenge, top 3 changing on a live pack, belt earned, pack opened. "Moved" events only show in Recent moves.

## API (all under `/api`, shapes in `shared/src/api.ts`)

| Method and path | Returns |
| --- | --- |
| GET /me | MeView, now with points, wallRank, wallPlayers, unread, streakDetail |
| GET /kata/days?month=YYYY-MM | KataMonth |
| GET /packs | PackSummary[] (newest first; a pack is identified by its number) |
| GET /packs/:number | PackDetail (adds board top 50 and moves) |
| POST /packs/:number/notify `{on}` | `{ notify }` |
| GET /boards/wall?page=N | WallView (50 rows a page) |
| GET /boards/pack/:number | PackBoardRow[] |
| GET /boards/challenge/:id | ChallengeBoardRow[] |
| GET /boards/streaks | StreakRow[] |
| GET /events?board=wall or pack:N | EventView[]; without board, big moments only for the LIVE line |
| GET /notifications | NotificationsView |
| POST /notifications/read `{ids?}` | `{ unread }`; no ids marks all |
| GET /challenges/:id/progress | ChallengeProgress, now with points, maxPoints, locked |
| GET /challenges/:id/solutions | SolutionsView (`top` empty until opened) |
| POST /challenges/:id/solutions/open | SolutionsView, after locking |
| GET /submissions/:id?wait=1 | SubmissionView, now with `ranking` (SubmitRanking) |
| GET /profile/:handle | ProfileView, now with points, wallRank, badges, kata, checks |
| GET /settings, PATCH /settings | SettingsView |

Details settled with the screens thread after the first draft:

- `SubmitRanking.wall` is null on kata Submits, which give no points.
- `SolutionsView.reference` is our reference answer, null until you open solutions. `GET /challenges/:id/solutions` returns `locked: false` and an empty `top` until then.
- `ProfileView.packs` lists opened packs the player is ranked on, with rank and player count.
- `SettingsView.provider` and `providerAccount` (the account email) back "Signed in with". `PATCH /settings` takes `{ handle?, notify?: { passed?, packOpen?, badge?, live? } }`.
- Links in notifications and events are client routes: `/c/:id`, `/packs/:number`, `/leaderboard`, `/me`.
- Challenges in a pack that has not opened yet are hidden from `/challenges` and return 404 everywhere a player could reach them. The `/gallery` review page still lists them.

`/leaderboard/:id` and `/rankings` stay until the client moves to `/boards/*`, then they are removed.

## Not backed by data (keep out of the screens)

- Profile "technique checks" must list the real checks (hover-changes, focus-visible, text-contrast-aa, target-size, semantic-control, real-text). Checks never require a technique such as flexbox or grid.
- "Where your points go" can show shape and colour only; there is no separate edges measure.
- Weekly email needs an email service (a new dependency, not approved yet).

## Running the database tests

```sh
createdb cssdojo_test
DATABASE_URL=postgres://localhost/cssdojo_test bun run db:migrate
DATABASE_URL=postgres://localhost/cssdojo_test bun run db:seed
TEST_DATABASE_URL=postgres://localhost/cssdojo_test bun run test
```

CI has no database, so these tests skip there.
