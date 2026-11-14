/**
 * Ephemeris tests — assert the SOURCES.md §C3 reference values (computed
 * on this VM 2026-11-14 with the same stack) and validate the custom
 * transform against astronomy-engine's own Libration() sub-Earth point.
 * Tolerances are tight on purpose: the research validation reproduced
 * these values to ≤0.01°; the UI claims ±0.1° geometry.
 */
import { describe, it, expect } from 'vitest';
import { sunEarthAt, subEarthPoint, librationSubEarth, moonIllumination } from './ephemeris.js';

const MALAPERT = [-85.990, -0.125];
const CR1 = [-89.4395, -137.1934];

describe('ephemeris — SOURCES.md §C3 reference values', () => {
  it('R1: full Moon Nov 24 2026 14:53 UTC illumination > 99.5%', () => {
    const illum = moonIllumination(new Date('2026-11-24T14:53:00Z'));
    expect(illum).toBeGreaterThan(0.995);
    expect(illum).toBeCloseTo(0.9981, 3);
  });

  it('R2: Malapert at full Moon — Sun +5.53° az 357.6°, Earth +10.47° az 357.6°', () => {
    const r = sunEarthAt(new Date('2026-11-24T14:53:00Z'), ...MALAPERT);
    expect(r.sun.alt).toBeCloseTo(5.53, 1);
    expect(r.sun.az).toBeCloseTo(357.6, 0);
    expect(r.earth.alt).toBeCloseTo(10.47, 1);
    expect(r.earth.az).toBeCloseTo(357.6, 0);
    // Cross-check: polar bound 90 − 85.99 + 1.54 = 5.55°.
    expect(r.sun.alt).toBeLessThan(5.56);
  });

  it('R3: Malapert Nov 14 12:00Z — Sun −0.49° az 120.7°, Earth +0.13° az 358.2°', () => {
    const r = sunEarthAt(new Date('2026-11-14T12:00:00Z'), ...MALAPERT);
    expect(r.sun.alt).toBeCloseTo(-0.49, 1);
    expect(r.sun.az).toBeCloseTo(120.7, 0);
    expect(r.earth.alt).toBeCloseTo(0.13, 1);
    expect(r.earth.az).toBeCloseTo(358.2, 0);
  });

  it('R4: Malapert Nov 15 12:00Z — Sun +0.28° az 108.5°, Earth +1.30° az 356.8°', () => {
    const r = sunEarthAt(new Date('2026-11-15T12:00:00Z'), ...MALAPERT);
    expect(r.sun.alt).toBeCloseTo(0.28, 1);
    expect(r.sun.az).toBeCloseTo(108.5, 0);
    expect(r.earth.alt).toBeCloseTo(1.30, 1);
    expect(r.earth.az).toBeCloseTo(356.8, 0);
  });

  it('R5: Malapert at new Moon Nov 9 07:02 UTC — illumination 0.19%, Sun −2.46°, Earth −2.48°', () => {
    const r = sunEarthAt(new Date('2026-11-09T07:02:00Z'), ...MALAPERT);
    expect(r.illumination).toBeCloseTo(0.0019, 3);
    expect(r.sun.alt).toBeCloseTo(-2.46, 1);
    expect(r.earth.alt).toBeCloseTo(-2.48, 1);
  });

  it('R6: Malapert Sun-alt sweep Nov 2026 stays inside the ±5.55° polar bound', () => {
    let mn = 99;
    let mx = -99;
    for (let h = 0; h < 30 * 24; h += 6) {
      const d = new Date(Date.UTC(2026, 10, 1) + h * 3600e3);
      const a = sunEarthAt(d, ...MALAPERT).sun.alt;
      mn = Math.min(mn, a);
      mx = Math.max(mx, a);
    }
    expect(mn).toBeCloseTo(-2.47, 1);
    expect(mx).toBeCloseTo(5.53, 1);
    expect(mn).toBeGreaterThan(-5.6);
    expect(mx).toBeLessThan(5.6);
  });

  it('R7: Earth SETS at high-latitude sites — Slater Plain daily-noon Earth alt spans negative to positive', () => {
    const ranges = {};
    for (const [name, site] of Object.entries({
      malapert: MALAPERT,
      deGerlache: [-88.225, -65.421],
      slater: [-87.149, 126.134],
      cabeus: [-83.661, -69.014],
      nobile1: [-85.431, 37.241],
    })) {
      let lo = 99;
      let hi = -99;
      for (let day = 1; day <= 30; day++) {
        const a = sunEarthAt(new Date(Date.UTC(2026, 10, day, 12)), ...site).earth.alt;
        lo = Math.min(lo, a);
        hi = Math.max(hi, a);
      }
      ranges[name] = [lo, hi];
    }
    expect(ranges.malapert[0]).toBeCloseTo(-2.53, 0);
    expect(ranges.malapert[1]).toBeCloseTo(10.50, 0);
    expect(ranges.deGerlache[0]).toBeCloseTo(-5.89, 0);
    expect(ranges.deGerlache[1]).toBeCloseTo(7.30, 0);
    expect(ranges.slater[0]).toBeCloseTo(-8.08, 0);
    expect(ranges.slater[1]).toBeCloseTo(4.70, 0);
    expect(ranges.cabeus[0]).toBeCloseTo(-4.62, 0);
    expect(ranges.cabeus[1]).toBeCloseTo(9.13, 0);
    expect(ranges.nobile1[0]).toBeCloseTo(-2.75, 0);
    expect(ranges.nobile1[1]).toBeCloseTo(9.98, 0);
    // The key app insight: Earth is below the horizon part of the month
    // at Slater Plain.
    expect(ranges.slater[0]).toBeLessThan(0);
    expect(ranges.slater[1]).toBeGreaterThan(0);
  });

  it('R8: Connecting Ridge CR1 Nov 14 12:00Z — Sun +1.44° az 257.7°, Earth −4.27° az 135.3°', () => {
    const r = sunEarthAt(new Date('2026-11-14T12:00:00Z'), ...CR1);
    expect(r.sun.alt).toBeCloseTo(1.44, 1);
    expect(r.sun.az).toBeCloseTo(257.7, 0);
    expect(r.earth.alt).toBeCloseTo(-4.27, 1);
    expect(r.earth.az).toBeCloseTo(135.3, 0);
  });
});

describe('ephemeris — transform vs astronomy-engine Libration()', () => {
  it('sub-Earth point matches Libration() to ≤ 0.03° across 7 dates (research: 0.027°)', () => {
    for (const iso of [
      '2026-06-15T00:00:00Z', '2026-11-09T07:02:00Z', '2026-11-14T12:00:00Z',
      '2026-11-15T12:00:00Z', '2026-11-24T14:53:00Z', '2026-12-01T00:00:00Z',
      '2027-01-20T00:00:00Z',
    ]) {
      const date = new Date(iso);
      const mine = subEarthPoint(date);
      const lib = librationSubEarth(date);
      expect(Math.abs(mine.lat - lib.lat)).toBeLessThanOrEqual(0.03);
      expect(Math.abs(mine.lon - lib.lon)).toBeLessThanOrEqual(0.03);
    }
  });
});
