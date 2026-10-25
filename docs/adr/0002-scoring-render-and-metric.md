# 0002. Scoring: pinned Chromium, 70% visual and 30% outcome checks

Status: accepted, 2026-10-25

## Context
Scores must be stable across machines, hard to game, and reward behaviour (hover, focus, contrast), not only pixels.

## Decision
- Render in a pinned Playwright Chromium at 2x DPR, 400x300, with JavaScript and network off and only bundled fonts.
- Fresh browser context per Submit, 5 s limit, code capped at 50 KB and sanitized.
- Visual per frame: `100 * shape^2 * edge * (1 - deltaE/20)` over the region either image paints, with one-device-pixel drift forgiven.
- Outcome checks run on the live DOM: hooks present, hover changes, focus visible, text contrast AA, target size, semantic control, real text.
- Total = 0.7 visual + 0.3 checks. Solved at 90.
- Every challenge has a golden set of answers with expected score ranges, run in CI.

## Consequences
- Tuning the metric means re-running the golden set; CI catches regressions.
- A layout that looks right but has no hover or focus state cannot reach 90.
