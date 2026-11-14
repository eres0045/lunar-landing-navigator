#!/usr/bin/env node
/**
 * Build the shipped terrain-aware horizon profiles.
 *
 * Reads the local DEM grids (app/public/terrain/<siteId>.json) and,
 * for the 13 south-pole sites, the regional 30 m windows
 * (raw-dem/regional/<siteId>.json — fetched + verified by
 * raw-dem/fetch_regional.py from LDEM_75S_30M), computes one horizon
 * profile per site with src/lib/horizon.js, and writes
 * app/src/data/horizons.json — the BUNDLED canonical copy, imported
 * by app/src/lib/data.js (horizonForSite). No fetch at runtime, no
 * verdict flicker: every verdict is terrain-aware by default.
 *
 * Apollo 15 has no regional window (equatorial — the polar product
 * does not cover it), so its profile is local-only out to its grid
 * corner (~363 m).
 *
 * Regenerate any time with: node app/tools/compute-horizons.mjs
 * (run from the project root). The round-trip test in
 * app/src/lib/horizon.test.js recomputes Malapert from the raw grids
 * and fails if the shipped file ever drifts from the DEM by > 0.01 deg
 * per bin.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { computeHorizonProfile, DEFAULT_EYE_HEIGHT_M, DEFAULT_BINS } from '../src/lib/horizon.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TERRAIN_DIR = path.join(ROOT, 'app', 'public', 'terrain');
const REGIONAL_DIR = path.join(ROOT, 'raw-dem', 'regional');
const OUT_PATH = path.join(ROOT, 'app', 'src', 'data', 'horizons.json');

const EYE_HEIGHT_M = DEFAULT_EYE_HEIGHT_M; // 2 m — lander / rover eye height
const BINS = DEFAULT_BINS; // 360 — 1 deg per bin, 0 deg = north, eastward

const gridFiles = readdirSync(TERRAIN_DIR)
  .filter((f) => f.endsWith('.json') && f !== 'checks.json' && f !== 'horizons.json')
  .sort();
const regionalFiles = new Set(readdirSync(REGIONAL_DIR).filter((f) => f.endsWith('.json')));

const profiles = {};
const sources = new Set();
for (const file of gridFiles) {
  const grid = JSON.parse(readFileSync(path.join(TERRAIN_DIR, file), 'utf8'));
  sources.add(grid.source);
  let farGrid = null;
  if (regionalFiles.has(file)) {
    farGrid = JSON.parse(readFileSync(path.join(REGIONAL_DIR, file), 'utf8'));
    sources.add(farGrid.source);
  }
  const p = computeHorizonProfile(grid, { eyeHeightM: EYE_HEIGHT_M, bins: BINS, farGrid });
  profiles[p.siteId] = {
    siteId: p.siteId,
    bins: p.bins,
    eyeHeightM: p.eyeHeightM,
    rangeM: p.rangeM,
    localRangeM: p.localRangeM,
    farRangeM: p.farRangeM,
    elevationsDeg: p.elevationsDeg.map((e) => Math.round(e * 1e4) / 1e4),
    minDeg: Math.round(p.minDeg * 1e4) / 1e4,
    maxDeg: Math.round(p.maxDeg * 1e4) / 1e4,
    meanDeg: Math.round(p.meanDeg * 1e4) / 1e4,
    maxAzDeg: p.maxAzDeg,
  };
  console.log(
    `${p.siteId.padEnd(16)} range ${String(p.rangeM).padStart(5)} m`
    + ` (local ${p.localRangeM} m${p.farRangeM ? ` + regional ${p.farRangeM} m` : ''})`
    + `  horizon min ${p.minDeg.toFixed(2)} deg  max ${p.maxDeg.toFixed(2)} deg @ az ${p.maxAzDeg} deg  mean ${p.meanDeg.toFixed(2)} deg`,
  );
}

const doc = {
  generated: new Date().toISOString(),
  generator: 'app/tools/compute-horizons.mjs',
  eyeHeightM: EYE_HEIGHT_M,
  bins: BINS,
  method:
    'Per azimuth bin (0 deg = north, eastward, 1 deg bins): march a ray from the site centre outward, '
    + 'bilinear-sampling the DEM, horizon elevation = max over samples of '
    + 'atan2(h_sample - h_observer - d^2/(2R), d), h_observer = centre height + 2 m eye height, '
    + 'R = 1737400 m (lunar curvature drop included). Local 10/20 m DEM inside 600 m, '
    + 'regional 30 m DEM (LDEM_75S_30M) beyond, out to 9990 m at the 13 south-pole sites; '
    + 'Apollo 15 is local-only. Terrain beyond the range is NOT in the horizon.',
  sources: [...sources].sort(),
  rangeNote:
    'Horizon from terrain within 9990 m of each south-pole site (600 m local DEM + 30 m regional DEM), '
    + '363 m at Apollo 15 (local grid corner). More distant massifs are not in the horizon; '
    + 'verdicts near the horizon can still differ from reality.',
  profiles,
};

writeFileSync(OUT_PATH, JSON.stringify(doc, null, 1));
console.log(`\nWROTE ${OUT_PATH} (${Object.keys(profiles).length} profiles)`);
