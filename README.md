# Lunar Landing Site Navigator

Compare Artemis south-pole landing sites by Sun and Earth position — power
potential and direct-to-Earth communication windows, for any date.

NASA Space Apps 2026 — Lunar Landing Site Navigator challenge.
Second project (Team SPICA / Flame in Freefall already submitted).

Stack: Vite + React 19 + Tailwind v4, plain `three` (no react-three-fiber).

```sh
npm test        # vitest
npm run build   # vite build
npm run preview # serve the production build on :4173
```

Live: https://eres0045.github.io/lunar-landing-navigator/

**Boot:** the link opens directly in Drive mode — the rover driving
view at Malapert Massif, Nov 14 12:00 UTC. "Back to orbit" in the
Drive HUD (or Esc) exits to the navigator overview, where site
comparison, landing windows, mission brief and Evidence are one tap
away. To open the orbit overview directly instead, use
`?view=orbit` — e.g.
https://eres0045.github.io/lunar-landing-navigator/?view=orbit
