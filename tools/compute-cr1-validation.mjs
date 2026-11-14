#!/usr/bin/env node
/**
 * Compute the Connecting Ridge CR1 Sun-up fraction over one full
 * 18.6-year precession cycle, from the app's own ephemeris + horizon
 * engine — the offline cross-check for Gläser et al. 2014's published
 * 88.1% illuminated over 20 years at 2 m above ground.
 *
 * Rule (identical to the app's POWER verdict): the Sun is "up" when
 * Sun alt > local horizon at the Sun's azimuth, using the CR1 profile
 * from app/src/data/horizons.json (real LOLA DEM, 2 m eye height,
 * range 9990 m). Sampled HOURLY — one sunEarthAt call per hour.
 *
 * Window: 18.6 Julian years from 2026-01-01T00:00:00Z (the illumination
 * repeats with the 18.6-year nodal precession, so one full cycle is
 * the physically complete window). 18.6 × 365.25 × 24 = 163,047.6 h;
 * samples are the 163,048 hourly instants starting at the window start.
 *
 * Also computes a 30-day cross-check window (2026-11-01 → 2026-12-01)
 * that the vitest suite recomputes live from the engine and asserts
 * equals this script's number exactly (data.test.js) — so the shipped
 * constant can never drift from the engine silently.
 *
 * Regenerate any time with: node app/tools/compute-cr1-validation.mjs
 * (run from the project root; ~15 s). Output:
 * app/src/data/cr1-validation.json, imported by app/src/lib/data.js
 * (CR1_VALIDATION) and shown in the Evidence modal as a "computed vs
 * published" badge. The badge label states the windows and methods
 * differ — this is a check, not an equality claim. If the computed
 * number ever disagrees badly with 88.1%, DO NOT tune the engine to
 * match; report it as a finding.
 *
 * FINDING (first run, 2026-11-15): computed 80.2% over 18.6 years vs
 * published 88.1% over 20 years — a 7.9-point gap. Sensitivity checks
 * in this script rule out the two obvious explanations: the solar-disc
 * definition moves the number only to 82.5% (any part up) / 77.4%
 * (full disc up), and 10-minute sampling agrees with hourly to 0.01
 * points on the 30-day window. The remaining candidates are terrain-
 * model differences (Gläser's ray-traced horizon vs this app's 10 km-
 * range DEM horizon) and window/epoch differences — recorded here, not
 * tuned away. The engine was NOT adjusted to match.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { sunEarthAt } from '../src/lib/ephemeris.js';
import { horizonAt } from '../src/lib/horizon.js';
import horizonsDoc from '../src/data/horizons.json' with { type: 'json' };

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT_PATH = path.join(ROOT, 'app', 'src', 'data', 'cr1-validation.json');

const CR1 = horizonsDoc.profiles['connecting-ridge'];
if (!CR1) throw new Error('compute-cr1-validation: no connecting-ridge profile in horizons.json');

// --- 18.6-year cycle window -------------------------------------------
const CYCLE_START = new Date('2026-01-01T00:00:00Z');
const CYCLE_YEARS = 18.6;
const CYCLE_HOURS = Math.floor(CYCLE_YEARS * 365.25 * 24); // 163,047
// Samples: hours 0..CYCLE_HOURS inclusive (163,048 instants).
const CYCLE_SAMPLES = CYCLE_HOURS + 1;
const CYCLE_END = new Date(CYCLE_START.getTime() + CYCLE_HOURS * 3600e3);

// --- 30-day cross-check window (recomputed live in the test suite) -----
const CHECK_START = new Date('2026-11-01T00:00:00Z');
const CHECK_HOURS = 30 * 24; // 720
const CHECK_SAMPLES = CHECK_HOURS + 1;
const CHECK_END = new Date(CHECK_START.getTime() + CHECK_HOURS * 3600e3);

function sunUpFraction(start, samples, label) {
  let up = 0;
  // Sensitivity (same samples, no extra ephemeris calls): the Sun's
  // disc radius is 0.27 deg. "Disc-top" counts the Sun as up when ANY
  // part of the disc clears the horizon (alt > horizon - 0.27 deg);
  // "full-disc" requires the whole disc above (alt > horizon + 0.27).
  // These bound the definitional uncertainty of "illuminated".
  let discTop = 0;
  let fullDisc = 0;
  const t0 = Date.now();
  for (let h = 0; h < samples; h++) {
    const d = new Date(start.getTime() + h * 3600e3);
    const pos = sunEarthAt(d, -89.4395, -137.1934); // Connecting Ridge CR1
    const margin = pos.sun.alt - horizonAt(CR1, pos.sun.az);
    if (margin > 0) up += 1;
    if (margin > -0.27) discTop += 1;
    if (margin > 0.27) fullDisc += 1;
    if (h > 0 && h % 20000 === 0) console.log(`  ${label}: ${h}/${samples} h (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  }
  console.log(`  ${label}: centre ${up}/${samples} = ${(100 * up / samples).toFixed(2)}% · disc-top ${(100 * discTop / samples).toFixed(2)}% · full-disc ${(100 * fullDisc / samples).toFixed(2)}% (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  return {
    samples, sunUpHours: up, fraction: up / samples,
    discTopFraction: discTop / samples, fullDiscFraction: fullDisc / samples,
  };
}

// Hourly-vs-finer sampling check on the 30-day window: 10-minute
// sampling must agree with hourly to ~0.1 points, or the hourly
// number is sampling noise, not a measurement.
function samplingCheck() {
  const s30 = new Date('2026-11-01T00:00:00Z');
  const n10 = 30 * 24 * 6;
  let up10 = 0;
  for (let i = 0; i <= n10; i++) {
    const pos = sunEarthAt(new Date(s30.getTime() + i * 600e3), -89.4395, -137.1934);
    if (pos.sun.alt > horizonAt(CR1, pos.sun.az)) up10 += 1;
  }
  return { stepMinutes: 10, samples: n10 + 1, sunUpHours: up10, fraction: up10 / (n10 + 1) };
}

console.log('CR1 Sun-up validation — terrain-aware rule (Sun alt > local horizon, 2 m eye)');
const cycle = sunUpFraction(CYCLE_START, CYCLE_SAMPLES, '18.6-year cycle');
const check = sunUpFraction(CHECK_START, CHECK_SAMPLES, '30-day cross-check');
const sampling = samplingCheck();
console.log(`  30-day 10-min sampling check: ${sampling.sunUpHours}/${sampling.samples} = ${(100 * sampling.fraction).toFixed(2)}% (hourly was ${(100 * check.fraction).toFixed(2)}%)`);

const doc = {
  generated: new Date().toISOString(),
  generator: 'app/tools/compute-cr1-validation.mjs',
  site: { id: 'connecting-ridge', name: 'Connecting Ridge CR1', lat: -89.4395, lon: -137.1934 },
  method:
    'Hourly samples; Sun is up when Sun alt > local horizon at the Sun azimuth '
    + '(isAboveHorizon, same rule as the POWER verdict), CR1 profile from '
    + 'app/src/data/horizons.json (real LOLA DEM, 2 m eye height, range 9990 m). '
    + 'Ephemeris: app/src/lib/ephemeris.js (astronomy-engine + IAU lunar rotation model).',
  cycle: {
    start: CYCLE_START.toISOString(),
    end: CYCLE_END.toISOString(),
    years: CYCLE_YEARS,
    samples: cycle.samples,
    sunUpHours: cycle.sunUpHours,
    fraction: cycle.fraction,
    percent: Math.round(cycle.fraction * 1000) / 10,
    // Sensitivity (same samples): counting the Sun as up when ANY part
    // of its 0.27 deg-radius disc clears the horizon gives 82.5%;
    // requiring the whole disc gives 77.4%. The disc definition moves
    // the number by ~±2.5 points at most — it does NOT close the gap
    // to the published 88.1%.
    discTopPercent: Math.round(cycle.discTopFraction * 1000) / 10,
    fullDiscPercent: Math.round(cycle.fullDiscFraction * 1000) / 10,
  },
  crossCheck30d: {
    start: CHECK_START.toISOString(),
    end: CHECK_END.toISOString(),
    samples: check.samples,
    sunUpHours: check.sunUpHours,
    fraction: check.fraction,
    percent: Math.round(check.fraction * 1000) / 10,
    samplingCheck10min: {
      stepMinutes: sampling.stepMinutes,
      samples: sampling.samples,
      sunUpHours: sampling.sunUpHours,
      percent: Math.round(sampling.fraction * 1000) / 10,
    },
  },
  published: {
    percent: 88.1,
    window: '20 years',
    source: 'Gläser et al. 2014, EPSC Abstracts (DLR)',
    url: 'https://elib.dlr.de/id/eprint/94242/contents',
    note: 'Accumulated illumination at 2 m above ground, spot 1 (89.4395°S, 222.8066°E). Different window and method from the computed number — a check, not an equality claim.',
  },
};

writeFileSync(OUT_PATH, JSON.stringify(doc, null, 1));
console.log(`\nWROTE ${OUT_PATH}`);
console.log(`Cycle: ${doc.cycle.percent}% Sun-up over ${CYCLE_YEARS} years vs published ${doc.published.percent}% over 20 years`);
