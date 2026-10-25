# MVP requirements (v0.1.0)

## Players
- A guest can open any challenge, edit HTML and CSS, preview it live and submit.
- Each Submit returns a score (0 to 100, one decimal), the visual and checks parts, and a hint for every failed check.
- Signing in with GitHub or Google keeps progress. Guest progress made in the same browser is merged on sign-in.
- The daily kata changes at 00:00 UTC. Playing on consecutive days builds a streak.
- Belts white, yellow, green, brown, black. Earned by solving (90+) five challenges of that belt, in order.
- Leaderboard per challenge: best score, ties broken by solve time (first open to best Submit).
- Phones can browse; the editor shows a "best on desktop" note.

## Scoring
- Rendered server-side in pinned Chromium at 2x, JavaScript and network off, bundled fonts only.
- Frames: rest, plus hover and focus when the challenge needs them. 400 x 300.
- Visual per frame = 100 x S^2 x (1 - meanDeltaE / 20) over the component region. Total = 0.7 visual + 0.3 checks.
- Checks judge the result, never the technique.
- Limits: 50 KB code, 5 s render, 30 submits per hour for guests and 120 for signed-in players.

## Content
- 30 challenges and 14 daily kata, each original, with its inspiration recorded.
- Kata loop back to day 1 after day 14 until more exist.

## Out of scope
Sparring (versus), payments, the CSS course, the remaining 16 kata.
