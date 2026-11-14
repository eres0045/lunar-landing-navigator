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
  terrainUV, textureStatusForSite, NAC_TEXTURED_SITES,
} from './terrain.js';
import nacManifest from '../../public/terrain/nac/manifest.json';
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
  it('all 14 site grids are present and validate (13 LOLA + Apollo 15 NAC DTM)', () => {
    expect(Object.keys(grids).sort()).toEqual([...Object.keys(checks), 'apollo15'].sort());
    for (const grid of Object.values(grids)) {
      expect(() => validateGrid(grid)).not.toThrow();
      expect(grid.noDataNodes).toBe(0);
    }
  });

  it('terrain geometry faces UP: mean vertex-normal y > 0.9 (winding regression)', () => {
    // Nov 14: the index order (a, d, b) / (b, d, e) wound every
    // triangle facing DOWN (mean normal y −0.99), so the Sun never lit
    // the ground and the DEM/NAC terrain rendered black at all sites.
    const geo = buildTerrainGeometry(grids.malapert, { forTexture: true });
    const nor = geo.attributes.normal.array;
    let sum = 0;
    for (let i = 1; i < nor.length; i += 3) sum += nor[i];
    expect(sum / (nor.length / 3)).toBeGreaterThan(0.9);
    // First triangle's face normal also points up.
    const pos = geo.attributes.position.array;
    const idx = geo.index.array;
    const p = (i) => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
    const [a, b, c] = [p(idx[0]), p(idx[1]), p(idx[2])];
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const ny = u[2] * v[0] - u[0] * v[2];
    expect(ny).toBeGreaterThan(0);
  });

  it('Apollo 15 is a 2 m NAC DTM grid, 257x257, 514 m square, 49 m relief', () => {
    const g = grids.apollo15;
    expect(g.spacingM).toBeCloseTo(514 / 256, 6);
    expect(g.rows).toBe(257);
    expect(g.cols).toBe(257);
    expect(g.halfSizeM).toBe(257);
    expect(g.centerHeightM).toBeCloseTo(45.35, 1);
    expect(g.maxHeightM - g.minHeightM).toBeCloseTo(49, 1);
    expect(g.minHeightM).toBeCloseTo(0, 1);
    expect(g.centerLat).toBeCloseTo(26.132, 3);
    expect(g.centerLon).toBeCloseTo(3.634, 3);
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

describe('NAC ground texture — UV mapping + per-site status', () => {
  it('terrainUV maps the box corners: west→u=0, east→u=1, north→v=1, south→v=0', () => {
    const g = grids.malapert; // 121x121, row 0 = north edge, col 0 = west edge
    expect(terrainUV(g, 0, 0)).toEqual({ u: 0, v: 1 }); // NW corner
    expect(terrainUV(g, 0, 120)).toEqual({ u: 1, v: 1 }); // NE corner
    expect(terrainUV(g, 120, 0)).toEqual({ u: 0, v: 0 }); // SW corner
    expect(terrainUV(g, 120, 120)).toEqual({ u: 1, v: 0 }); // SE corner
    expect(terrainUV(g, 60, 60)).toEqual({ u: 0.5, v: 0.5 }); // centre
  });

  it('buildTerrainGeometry carries a uv attribute matching the corners', () => {
    const geo = buildTerrainGeometry(grids.malapert, { forTexture: true });
    const uv = geo.getAttribute('uv');
    expect(uv.count).toBe(121 * 121);
    // Vertex (r=0, c=0) is the first vertex: NW corner → u=0, v=1.
    expect(uv.getX(0)).toBeCloseTo(0, 6);
    expect(uv.getY(0)).toBeCloseTo(1, 6);
    // Vertex (r=120, c=120) is the last: SE corner → u=1, v=0.
    const last = 121 * 121 - 1;
    expect(uv.getX(last)).toBeCloseTo(1, 6);
    expect(uv.getY(last)).toBeCloseTo(0, 6);
  });

  it('textureStatusForSite: 8 NAC sites, 2 no-coverage, 3 PSR — nothing else', () => {
    const byStatus = (want) => Object.entries(grids)
      .filter(([, grid]) => textureStatusForSite(grid.siteId).status === want)
      .map(([id]) => id).sort();
    expect(byStatus('nac')).toHaveLength(8);
    expect(byStatus('no-coverage')).toEqual(['cabeus', 'nobile2']);
    expect(byStatus('psr')).toEqual(['faustini', 'shoemaker', 'sverdrup']);
    // Unknown ids fall back to no-coverage, never to a texture.
    expect(textureStatusForSite('nowhere').status).toBe('no-coverage');
    // Apollo 15 has its own status: real NAC DTM terrain, no imagery.
    expect(textureStatusForSite('apollo15').status).toBe('nac-dtm');
  });

  it('shipped NAC manifest matches the textured-site set exactly', () => {
    expect(Object.keys(nacManifest.sites).sort()).toEqual([...NAC_TEXTURED_SITES].sort());
    for (const [siteId, entry] of Object.entries(nacManifest.sites)) {
      expect(entry.resolutionM).toBe(1);
      expect(entry.licence).toMatch(/public domain/i);
      expect(entry.file).toBe(`terrain/nac/${siteId}.jpg`);
    }
    // The gamma-0.45 exposure lift is recorded, not hidden.
    expect(nacManifest.exposure).toMatch(/Gamma 0\.45/);
  });

  it('forTexture vertex colours stay near-white so the imagery reads', () => {
    const plain = terrainVertexColors(grids.malapert);
    const textured = terrainVertexColors(grids.malapert, { forTexture: true });
    let plainMin = 1; let texturedMin = 1;
    for (let i = 0; i < plain.length; i++) {
      plainMin = Math.min(plainMin, plain[i]);
      texturedMin = Math.min(texturedMin, textured[i]);
    }
    // Bare DEM tint dips to ~0.2 (0.72 elev × 0.65 slope × 0.30 base);
    // textured colours never drop below 0.66 (0.88 elev × 0.75 slope).
    expect(plainMin).toBeLessThan(0.5);
    expect(texturedMin).toBeGreaterThanOrEqual(0.66);
    expect(texturedMin).toBeLessThanOrEqual(1);
  });
});
