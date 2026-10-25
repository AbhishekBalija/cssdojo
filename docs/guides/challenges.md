# Writing a challenge

A challenge is one folder in `challenges/`, named exactly like its `id`.

```
challenges/y-008-segmented-control/
  challenge.json   metadata (validated by shared/src/challenge.ts)
  starter.html     what the player starts with: the HTML with the required hooks, minimal CSS
  reference.html   our solution: HTML + one <style> block. Renders the target.
  note.md          optional nudge + several different ways to build it. Never one "right" technique.
  golden/*.html    known answers with the score range they must land in
```

## Rules

- **Original designs only.** Study real UI made by real developers (design systems, Dribbble/inspora/rareui shots, product UIs), take one or two small specific details, and redesign it in our own way. Never copy one source. Record each source in `inspiration` with a real URL and a note on what you took and what you changed.
- **No AI images, no images at all.** Pure HTML and CSS. `url()`, `<img>`, `<svg><image>`, `data:` and `@import` are stripped. Inline `<svg>` with paths is allowed.
- **Canvas** is 400 x 300 CSS px. Use a full-bleed background on a wrapper (`.stage { height: 300px; ... }` with `body { margin: 0 }`).
- **Fonts:** only `"Onest"`, `"Martian Mono"`, `"Instrument Serif"` (bundled). Always give a generic fallback.
- **Look:** flat poster style. One small real component centred on a calm background, its own 2 to 5 colour palette (not the app's graphite UI). Readable sizes (text 12px+).
- **Frames:** `rest` always. Add `hover` and/or `focus` only when the brief is about them (interactive pieces). White belt: 1 to 2 frames. Brown and black: all 3.
- **Hooks:** the elements the player must keep (class selectors). The starter contains them already. `states.hover` / `states.focus` name the hook that receives the mouse / the Tab focus. A focus hook must be keyboard-focusable (button, a[href], input...).
- **Checks** (pick those that match the brief; the reference must pass all of them):
  - `hooks-present` (always)
  - `hover-changes`: hover frame differs visibly from rest
  - `focus-visible`: Tab reaches the focus hook and a ring/change with 3:1 contrast appears around it (at least about a 1px ring all round)
  - `text-contrast-aa`: all text 4.5:1 (3:1 for 24px+ or 18.66px+ bold)
  - `target-size`: interactive hooks at least 24 x 24
  - `semantic-control`: interactive hooks keep the reference's native role (button, link, checkbox, textbox...), inputs labelled
  - `real-text`: every word in the target is real text in the answer
- **Belts:** white = one element, few properties. Yellow = a small group (badge + text, simple card). Green = layout of several parts (list row, input with label and helper). Brown = several parts with states (tabs, toggle, pricing row). Black = intricate details (layered shadows, notches, pseudo-elements, precise type).
- **Golden answers** (at least 3, more is better). First line: `<!-- golden max=89.9 reason="..." -->` (add `min=` for answers that must score high).
  - `empty.html`: the starter, `max` around 40
  - one or more near misses (a 1 to 4px size/radius/spacing error, a slightly wrong colour), `max=89.9`
  - one missing state per state frame (no hover style / no focus ring), `max=89.9`
  - ideally one "different technique, same look" answer with `min=99.5 max=100`

Validate with `CHALLENGES_DIR=<dir> bun run golden [id-filter]`. A challenge is done when the reference scores exactly 100 and every golden answer is in range.
