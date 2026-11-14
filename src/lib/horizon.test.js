/**
 * Horizon tests — terrain-aware horizon from the real LOLA DEM.
 *
 * Synthetic DEMs with KNOWN horizons pin the geometry (azimuth
 * convention, ray marching, max-elevation rule); the real Malapert
 * grid pins the shipped profiles to the DEM.
 */
import { describe, it, expect } from 'vitest';
import { computeHorizonProfile, horizonAt, isAboveHorizon } from './horizon.js';
import malapertGrid from '../../public/terrain/malapert.json';
import malapertRegional from '../../../raw-dem/regional/malapert.json';
import horizonsDoc from '../data/horizons.json';

/** Build a 121x121 @ 10 m synthetic grid (centre height 1000 m). */
function syntheticGrid(heightFn) {
  const rows = 121;
  const cols = 121;
  const heights = [];
  let min = Infinity;
  let max = -Infinity;
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      const northM = 600 - r * 10;
      const eastM = -600 + c * 10;
      const h = heightFn(northM, eastM);
      row.push(h);
      if (h < min) min = h;
      if (h > max) max = h;
    }
    heights.push(row);
  }
  return {
    siteId: 'synthetic',
    siteName: 'Synthetic',
    centerLat: -85,
    centerLon: 0,
    spacingM: 10,
    rows,
    cols,
    halfSizeM: 600,
    originNorthM: 600,
    originEastM: -600,
    rowConvention: 'row 0 = north edge',
    heights,
    datum: 'synthetic',
    centerHeightM: 1000,
    minHeightM: min,
    maxHeightM: max,
    noDataNodes: 0,
    source: 'synthetic',
    resolutionM: 10,
    license: 'synthetic',
  };
}

describe('computeHorizonProfile — synthetic DEMs with known horizons', () => {
  it('flat plain: horizon ~0 deg everywhere (eye 2 m depresses the far edge by atan(2/600) = 0.19 deg)', () => {
    const p = computeHorizonProfile(syntheticGrid(() => 1000));
    expect(p.bins).toBe(360);
    expect(p.minDeg).toBeGreaterThanOrEqual(-0.25);
    expect(p.maxDeg).toBeLessThanOrEqual(0);
    expect(p.meanDeg).toBeCloseTo(-0.17, 1);
  });

  it('ridge due NORTH spikes bin 0 only — azimuth convention is north = bin 0, east = bin 90', () => {
    // A 100 m ridge along the whole north edge (rows 0..10, north 500..600 m).
    const p = computeHorizonProfile(syntheticGrid((n) => (n >= 500 ? 1100 : 1000)));
    expect(p.elevationsDeg[0]).toBeGreaterThan(5);
    expect(p.elevationsDeg[0]).toBeLessThan(15);
    // The same ridge must NOT appear at east / south / west.
    for (const bin of [90, 180, 270]) {
      expect(p.elevationsDeg[bin]).toBeLessThan(0.5);
      expect(p.elevationsDeg[bin]).toBeGreaterThan(-0.5);
    }
    // Neighbours of north see the ridge edge-on; due east sees flat ground.
    expect(p.elevationsDeg[0]).toBeGreaterThan(p.elevationsDeg[90] + 5);
    expect(p.maxAzDeg).toBe(0);
  });

  it('crater-rim ring: roughly uniform positive horizon in every direction', () => {
    const p = computeHorizonProfile(syntheticGrid((n, e) => {
      const r = Math.hypot(n, e);
      return r >= 400 && r <= 500 ? 1050 : 1000;
    }));
    expect(p.minDeg).toBeGreaterThan(1);
    expect(p.maxDeg - p.minDeg).toBeLessThan(3);
    expect(p.meanDeg).toBeGreaterThan(3);
  });

  it('step / plateau to the EAST spikes near azimuth 90, flat to the west', () => {
    const p = computeHorizonProfile(syntheticGrid((_n, e) => (e >= 100 ? 1080 : 1000)));
    expect(p.elevationsDeg[90]).toBeGreaterThan(20);
    expect(p.elevationsDeg[270]).toBeLessThan(0.5);
    expect(p.maxAzDeg).toBe(90);
  });

  it('eye height matters in the near field: a 2 m eye always lowers the horizon, by up to ~4 deg at Malapert', () => {
    // The brief's <0.5 deg bound does NOT hold on the real Malapert DEM
    // and is refuted here, not asserted: at Malapert the horizon in
    // most bins is set by terrain tens of metres away (local slopes
    // ~6 deg), where 2 m of eye height is a large fraction of the
    // rise — worst bin 47: eye 2 m -> 6.15 deg (set at 35 m), eye 0 m
    // -> 10.22 deg (set at 20 m), diff 4.07 deg; 256/360 bins differ
    // by >= 0.5 deg. What IS true: raising the eye can only lower
    // (or keep) the horizon in every bin, and the shift stays small
    // in absolute terms (< 5 deg). That monotonicity is the check.
    const p2 = computeHorizonProfile(malapertGrid, { farGrid: malapertRegional });
    const p0 = computeHorizonProfile(malapertGrid, { eyeHeightM: 0, farGrid: malapertRegional });
    let maxDiff = 0;
    for (let b = 0; b < 360; b++) {
      expect(p2.elevationsDeg[b]).toBeLessThanOrEqual(p0.elevationsDeg[b] + 1e-9);
      maxDiff = Math.max(maxDiff, p0.elevationsDeg[b] - p2.elevationsDeg[b]);
    }
    expect(maxDiff).toBeGreaterThan(0.5);
    expect(maxDiff).toBeLessThan(5);
  });
});

describe('computeHorizonProfile — real Malapert DEM', () => {
  it('blended profile: max 7.42 deg @ az 75, mean +1.51, range 9990 m', () => {
    const p = computeHorizonProfile(malapertGrid, { farGrid: malapertRegional });
    expect(p.siteId).toBe('malapert');
    expect(p.rangeM).toBe(9990);
    expect(p.localRangeM).toBe(600);
    expect(p.farRangeM).toBe(9990);
    expect(p.maxDeg).toBeCloseTo(7.42, 1);
    expect(p.maxAzDeg).toBe(75);
    expect(p.meanDeg).toBeCloseTo(1.51, 1);
    expect(p.minDeg).toBeLessThan(0);
  });

  it('the regional DEM actually matters: at least one bin differs > 0.5 deg from local-only', () => {
    const blended = computeHorizonProfile(malapertGrid, { farGrid: malapertRegional });
    const localOnly = computeHorizonProfile(malapertGrid);
    expect(localOnly.rangeM).toBeCloseTo(600 * Math.SQRT2, 0);
    let maxDiff = 0;
    for (let b = 0; b < 360; b++) {
      maxDiff = Math.max(maxDiff, Math.abs(blended.elevationsDeg[b] - localOnly.elevationsDeg[b]));
    }
    expect(maxDiff).toBeGreaterThan(0.5);
  });

  it('shipped horizons.json matches recomputation from the raw grids within 0.01 deg per bin', () => {
    const shipped = horizonsDoc.profiles.malapert;
    expect(shipped.bins).toBe(360);
    expect(shipped.eyeHeightM).toBe(2);
    expect(shipped.rangeM).toBe(9990);
    const recomputed = computeHorizonProfile(malapertGrid, { farGrid: malapertRegional });
    expect(recomputed.elevationsDeg).toHaveLength(360);
    for (let b = 0; b < 360; b++) {
      expect(Math.abs(recomputed.elevationsDeg[b] - shipped.elevationsDeg[b])).toBeLessThan(0.01);
    }
    expect(Math.abs(recomputed.maxDeg - shipped.maxDeg)).toBeLessThan(0.01);
    expect(Math.abs(recomputed.meanDeg - shipped.meanDeg)).toBeLessThan(0.01);
  });

  it('shipped file has all 14 sites, 360 bins each, Apollo 15 local-only', () => {
    expect(Object.keys(horizonsDoc.profiles)).toHaveLength(14);
    for (const [id, p] of Object.entries(horizonsDoc.profiles)) {
      expect(p.elevationsDeg).toHaveLength(360);
      expect(p.eyeHeightM).toBe(2);
      if (id === 'apollo15') {
        expect(p.farRangeM).toBeNull();
        expect(p.rangeM).toBeCloseTo(257 * Math.SQRT2, 0);
      } else {
        expect(p.rangeM).toBe(9990);
      }
    }
  });
});

describe('horizonAt / isAboveHorizon', () => {
  const profile = { bins: 4, elevationsDeg: [0, 10, 20, 30] };
  it('interpolates linearly between bins and wraps at 360', () => {
    expect(horizonAt(profile, 0)).toBe(0);
    expect(horizonAt(profile, 90)).toBe(10);
    expect(horizonAt(profile, 45)).toBe(5);
    expect(horizonAt(profile, 360)).toBe(0);
    expect(horizonAt(profile, -90)).toBe(30); // -90 deg wraps to 270 deg = bin 3
    expect(horizonAt(profile, 270)).toBe(30);
    expect(horizonAt(profile, 359)).toBeCloseTo(0.33, 1);
  });
  it('isAboveHorizon is a strict > against the interpolated horizon', () => {
    expect(isAboveHorizon(11, 90, profile)).toBe(true);
    expect(isAboveHorizon(10, 90, profile)).toBe(false);
    expect(isAboveHorizon(9, 90, profile)).toBe(false);
  });
  it('throws on a bad profile instead of silently returning a number', () => {
    expect(() => horizonAt(null, 0)).toThrow();
    expect(() => horizonAt({ bins: 4 }, 0)).toThrow();
  });
});
