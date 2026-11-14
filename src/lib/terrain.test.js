/**
 * terrain.test.js — real LOLA DEM lookups (src/lib/terrain.js).
 *
 * Asserts the bilinear lookup against the 65 independent check values
 * in public/terrain/checks.json (sampled straight from the raw DEM,
 * not from the grids), the edge-clamp behaviour, rover terrain
 * following on the real Malapert DEM, and the mesh geometry.
 */
import { describe, it, expect, afterEach } from 'vitest';
import {
  createTerrainLookup, terrainVertexColors, validateGrid,
} from './terrain.js';
import { buildTerrainGeometry } from '../components/terrainMesh.js';
import {
  createRover, step, setSurfaceHeightAt, resetSurfaceHeightAt,
  slopeAt, latLonToLocal,
} from './rover.js';
import checks from '../../public/terrain/checks.json';

// All 13 grids, imported as data (vite handles the JSON).
const gridModules = import.meta.glob('../../public/terrain/*.json', { eager: true });
const grids = {};
for (const [path, mod] of Object.entries(gridModules)) {
  const grid = mod.default;
  if (grid && grid.siteId && Array.isArray(grid.heights)) grids[grid.siteId] = grid;
}

const SITE = { id: 'malapert', lat: -85.99, lon: -0.125 };

afterEach(() => resetSurfaceHeightAt());

describe('grid loading sanity', () => {
  it('all 13 site grids are present and validate', () => {
    expect(Object.keys(grids).sort()).toEqual(Object.keys(checks).sort());
    for (const grid of Object.values(grids)) {
      expect(() => validateGrid(grid)).not.toThrow();
      expect(grid.noDataNodes).toBe(0);
    }
  });

  it('Malapert is a 10 m grid, 121x121, centre 4807.6 m', () => {
    const g = grids.malapert;
    expect(g.spacingM).toBe(10);
    expect(g.rows).toBe(121);
    expect(g.cols).toBe(121);
    expect(g.centerHeightM).toBeCloseTo(4807.6, 1);
    expect(g.heights[60][60]).toBeCloseTo(4807.6, 1);
  });
});

describe('lookup vs the 65 independent check values', () => {
  it.each(Object.entries(checks))('%s: centre + 500 m N/E/S/W match the raw DEM', (siteId, site) => {
    const lookup = createTerrainLookup(grids[siteId]);
    expect(site.points).toHaveLength(5);
    for (const p of site.points) {
      const rel = lookup.relativeHeightAtLatLon(p.lat, p.lon);
      // Check lat/lon are rounded to 6 decimals (~0.03 m) and grid
      // nodes to 0.1 m, so 0.5 m is a tight but safe tolerance.
      expect(rel + grids[siteId].centerHeightM).toBeCloseTo(p.heightM, 0);
      expect(Math.abs(rel + grids[siteId].centerHeightM - p.heightM)).toBeLessThan(0.5);
    }
  });

  it('Malapert spot values (relative to the landing point)', () => {
    const lookup = createTerrainLookup(grids.malapert);
    expect(lookup.relativeHeightAtLocal(0, 0)).toBeCloseTo(0, 6);
    expect(lookup.relativeHeightAtLocal(500, 0)).toBeCloseTo(17.7, 1); // N500
    expect(lookup.relativeHeightAtLocal(0, 500)).toBeCloseTo(33.3, 1); // E500
    expect(lookup.relativeHeightAtLocal(-500, 0)).toBeCloseTo(-64.5, 1); // S500
    expect(lookup.relativeHeightAtLocal(0, -500)).toBeCloseTo(-14.2, 1); // W500
  });

  it('bilinear midpoints fall between their neighbours, never NaN', () => {
    const lookup = createTerrainLookup(grids.malapert);
    for (let n = -600; n <= 600; n += 25) {
      for (let e = -600; e <= 600; e += 25) {
        const h = lookup.relativeHeightAtLocal(n, e);
        expect(Number.isFinite(h)).toBe(true);
        expect(h).toBeGreaterThanOrEqual(lookup.minRelM - 1e-9);
        expect(h).toBeLessThanOrEqual(lookup.maxRelM + 1e-9);
      }
    }
    // A 5 m offset from a node is between the node and its neighbour.
    const hNode = lookup.relativeHeightAtLocal(0, 0);
    const hMid = lookup.relativeHeightAtLocal(5, 0);
    const hNext = lookup.relativeHeightAtLocal(10, 0);
    expect(hMid).toBeGreaterThanOrEqual(Math.min(hNode, hNext) - 1e-9);
    expect(hMid).toBeLessThanOrEqual(Math.max(hNode, hNext) + 1e-9);
  });
});

describe('edge clamping', () => {
  it('outside the ±600 m grid the lookup clamps to the edge value', () => {
    const lookup = createTerrainLookup(grids.malapert);
    expect(lookup.relativeHeightAtLocal(0, 5000)).toBeCloseTo(lookup.relativeHeightAtLocal(0, 600), 9);
    expect(lookup.relativeHeightAtLocal(5000, 0)).toBeCloseTo(lookup.relativeHeightAtLocal(600, 0), 9);
    expect(lookup.relativeHeightAtLocal(-5000, -5000)).toBeCloseTo(lookup.relativeHeightAtLocal(-600, -600), 9);
    // A far-north lat/lon clamps to the north edge at the same east offset.
    const far = latLonToLocal(grids.malapert.centerLat, grids.malapert.centerLon, -80, 0);
    expect(lookup.relativeHeightAtLatLon(-80, 0))
      .toBeCloseTo(lookup.relativeHeightAtLocal(600, Math.max(-600, Math.min(600, far.eastM))), 6);
  });

  it('never NaN or throw for far-out inputs', () => {
    const lookup = createTerrainLookup(grids.malapert);
    for (const [n, e] of [[1e6, 0], [0, -1e6], [NaN, 0], [0, Infinity]]) {
      let h;
      expect(() => { h = lookup.relativeHeightAtLocal(n, e); }).not.toThrow();
      expect(Number.isFinite(h)).toBe(true);
    }
  });
});

describe('rover terrain following on the real Malapert DEM', () => {
  it('the rover sits at 0 at the landing point and +17.7 m at N500', () => {
    const lookup = createTerrainLookup(grids.malapert);
    setSurfaceHeightAt(lookup.heightFn);
    const r = createRover(SITE);
    expect(r.heightM).toBeCloseTo(0, 6);
    r.northM = 500;
    step(r, {}, 0.01);
    expect(r.heightM).toBeCloseTo(17.7, 1);
    // Local 1 m slope at N500 happens to dip (pitch ≈ −0.04) even
    // though the 500 m mean gradient is +0.035 — pitch follows the
    // LOCAL slope, so only assert it is finite and sane here.
    expect(Number.isFinite(r.pitchRad)).toBe(true);
    expect(Math.abs(r.pitchRad)).toBeLessThan(0.35);
  });

  it('at the Malapert landing point the rover pitches/rolls with the local slope', () => {
    // Grid central differences at the centre node: north slope +0.075,
    // east slope +0.105 — facing north that is nose-up pitch + east roll.
    const lookup = createTerrainLookup(grids.malapert);
    setSurfaceHeightAt(lookup.heightFn);
    const r = createRover(SITE);
    step(r, {}, 0.01);
    expect(r.pitchRad).toBeGreaterThan(0.05);
    expect(r.pitchRad).toBeLessThan(0.12);
    expect(r.rollRad).toBeGreaterThan(0.05);
    expect(r.rollRad).toBeLessThan(0.18);
  });

  it('driving north 500 m from the Malapert centre raises the rover ~+17.7 m', () => {
    const lookup = createTerrainLookup(grids.malapert);
    setSurfaceHeightAt(lookup.heightFn);
    const r = createRover(SITE, { maxSpeedKmh: 18 });
    // Full throttle at 18 km/h (5 m/s): 500 m in ~100 s of sim time.
    // Drive in 0.25 s steps (the step() clamp) — 400 steps.
    for (let i = 0; i < 420; i++) step(r, { throttle: 1 }, 0.25);
    expect(r.northM).toBeGreaterThan(490);
    expect(r.northM).toBeLessThan(560);
    // Height follows the DEM exactly at the rover's actual position,
    // and is well above the landing point after 500 m north.
    expect(r.heightM).toBeCloseTo(lookup.relativeHeightAtLocal(r.northM, r.eastM), 2);
    expect(r.heightM).toBeGreaterThan(15);
    expect(Math.abs(r.pitchRad)).toBeLessThan(0.35);
  });

  it('slopeAt on the DEM is non-zero and consistent with the grid', () => {
    const lookup = createTerrainLookup(grids.malapert);
    setSurfaceHeightAt(lookup.heightFn);
    const s = slopeAt(-85.99, -0.125);
    expect(Number.isFinite(s.alongNorth)).toBe(true);
    expect(Number.isFinite(s.alongEast)).toBe(true);
    // Mean north gradient over 500 m is +17.7/500 ≈ +0.035; the local
    // 1 m finite difference at the centre should be the same order.
    expect(Math.abs(s.alongNorth)).toBeLessThan(0.3);
    expect(Math.abs(s.alongEast)).toBeLessThan(0.3);
  });

  it('latLonToLocal round-trips the check points to their grid nodes', () => {
    const g = grids.malapert;
    for (const p of checks.malapert.points) {
      const { northM, eastM } = latLonToLocal(g.centerLat, g.centerLon, p.lat, p.lon);
      expect(northM).toBeCloseTo(p.northM, 0);
      expect(eastM).toBeCloseTo(p.eastM, 0);
    }
  });
});

describe('DEM mesh geometry', () => {
  it('builds one vertex per grid node with matching relative heights', () => {
    const g = grids.malapert;
    const geo = buildTerrainGeometry(g);
    const pos = geo.getAttribute('position');
    expect(pos.count).toBe(121 * 121);
    // Centre vertex (row 60, col 60): (0, 0, 0).
    const ci = (60 * 121 + 60) * 3;
    expect(pos.array[ci]).toBeCloseTo(0, 6);
    expect(pos.array[ci + 1]).toBeCloseTo(0, 6);
    expect(pos.array[ci + 2]).toBeCloseTo(0, 6);
    // North-east corner (row 0, col 120): east +600, north +600,
    // height = grid value − centre.
    const ni = (0 * 121 + 120) * 3;
    expect(pos.array[ni]).toBeCloseTo(600, 6);
    expect(pos.array[ni + 2]).toBeCloseTo(600, 6);
    expect(pos.array[ni + 1]).toBeCloseTo(g.heights[0][120] - g.centerHeightM, 6);
    // Normals exist and the bounding sphere covers the square.
    expect(geo.getAttribute('normal').count).toBe(121 * 121);
    expect(geo.boundingSphere.radius).toBeGreaterThan(840);
    // Colours: one RGB per vertex, all in [0, 1], not all equal
    // (elevation tint + slope shading actually vary).
    const col = geo.getAttribute('color');
    expect(col.count).toBe(121 * 121);
    let min = 1;
    let max = 0;
    for (let i = 0; i < col.array.length; i++) {
      expect(col.array[i]).toBeGreaterThanOrEqual(0);
      expect(col.array[i]).toBeLessThanOrEqual(1);
      min = Math.min(min, col.array[i]);
      max = Math.max(max, col.array[i]);
    }
    expect(max - min).toBeGreaterThan(0.05);
  });

  it('terrainVertexColors is pure real-data shading (rows*cols*3)', () => {
    const colors = terrainVertexColors(grids['mouton-plateau']);
    expect(colors.length).toBe(61 * 61 * 3);
    for (let i = 0; i < colors.length; i++) {
      expect(colors[i]).toBeGreaterThanOrEqual(0);
      expect(colors[i]).toBeLessThanOrEqual(1);
    }
  });

  it('a 20 m grid builds a 61x61 mesh', () => {
    const geo = buildTerrainGeometry(grids.cabeus);
    expect(geo.getAttribute('position').count).toBe(61 * 61);
  });
});
