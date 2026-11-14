/**
 * Terrain — real LRO LOLA elevation for Drive mode (Step 2).
 *
 * PURE module: no three.js, no DOM, fully unit-testable.
 *
 * Data: one sampled grid per site in `public/terrain/<siteId>.json`
 * (LRO LOLA GDR LDEM_85S_10M at 10 m/px, LDEM_80S_20M at 20 m/px;
 * NASA public domain — full provenance in
 * `public/terrain/PROVENANCE.md` and `TERRAIN.md`).
 *
 * Grid schema (see PROVENANCE.md): heights are ABSOLUTE metres above
 * the 1737.4 km reference sphere, row-major, row 0 = north edge,
 * north = originNorthM − row*spacingM, east = originEastM + col*spacingM.
 * The rover frame expects height above the LOCAL mean surface, so every
 * lookup here returns grid height MINUS the site's centerHeightM
 * (landing point = 0). Outside the ±600 m grid the lookup clamps to the
 * edge value — it never returns NaN and never throws.
 */
import { latLonToLocal } from './rover.js';

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

/** Validate the minimum a grid needs for lookup; throws on bad data. */
export function validateGrid(grid) {
  if (!grid || typeof grid !== 'object') throw new Error('terrain grid is not an object');
  const { rows, cols, spacingM, heights } = grid;
  if (!Number.isFinite(rows) || !Number.isFinite(cols) || rows < 2 || cols < 2) {
    throw new Error(`terrain grid ${grid.siteId}: bad rows/cols`);
  }
  if (!Number.isFinite(spacingM) || spacingM <= 0) throw new Error(`terrain grid ${grid.siteId}: bad spacingM`);
  if (!Array.isArray(heights) || heights.length !== rows) throw new Error(`terrain grid ${grid.siteId}: heights rows mismatch`);
  for (const row of heights) {
    if (!Array.isArray(row) || row.length !== cols) throw new Error(`terrain grid ${grid.siteId}: heights cols mismatch`);
  }
  if (!Number.isFinite(grid.centerHeightM)) throw new Error(`terrain grid ${grid.siteId}: bad centerHeightM`);
  if (!Number.isFinite(grid.centerLat) || !Number.isFinite(grid.centerLon)) {
    throw new Error(`terrain grid ${grid.siteId}: bad centre lat/lon`);
  }
  return grid;
}

/**
 * Build a lookup over one site grid.
 * Returns { grid, heightAtLocal, relativeHeightAtLocal,
 *   relativeHeightAtLatLon, heightFn, minRelM, maxRelM }.
 * All heights are RELATIVE metres (landing point = 0) except
 * `heightAtLocal`, which returns the absolute DEM value.
 */
export function createTerrainLookup(grid) {
  validateGrid(grid);
  const { rows, cols, spacingM, originNorthM, originEastM, centerHeightM, heights } = grid;
  const minRelM = grid.minHeightM - centerHeightM;
  const maxRelM = grid.maxHeightM - centerHeightM;

  /** Absolute DEM height (m above the 1737.4 km sphere) at local metres. */
  function heightAtLocal(northM, eastM) {
    // Non-finite inputs (NaN / ±Infinity) fall back to the centre —
    // the lookup never throws and never returns NaN.
    if (!Number.isFinite(northM)) northM = 0;
    if (!Number.isFinite(eastM)) eastM = 0;
    let rf = (originNorthM - northM) / spacingM;
    let cf = (eastM - originEastM) / spacingM;
    rf = clamp(rf, 0, rows - 1);
    cf = clamp(cf, 0, cols - 1);
    const r0 = Math.min(Math.floor(rf), rows - 2);
    const c0 = Math.min(Math.floor(cf), cols - 2);
    const fr = rf - r0;
    const fc = cf - c0;
    const h00 = heights[r0][c0];
    const h01 = heights[r0][c0 + 1];
    const h10 = heights[r0 + 1][c0];
    const h11 = heights[r0 + 1][c0 + 1];
    const hN = h00 * (1 - fc) + h01 * fc;
    const hS = h10 * (1 - fc) + h11 * fc;
    return hN * (1 - fr) + hS * fr;
  }

  /** Height above the local mean surface (landing point = 0) at local metres. */
  function relativeHeightAtLocal(northM, eastM) {
    return heightAtLocal(northM, eastM) - centerHeightM;
  }

  /** Relative height at a selenographic lat/lon (deg). */
  function relativeHeightAtLatLon(latDeg, lonDeg) {
    const { northM, eastM } = latLonToLocal(grid.centerLat, grid.centerLon, latDeg, lonDeg);
    return relativeHeightAtLocal(northM, eastM);
  }

  /** Plug-in for rover.js `setSurfaceHeightAt(lat, lon)`. */
  function heightFn(latDeg, lonDeg) {
    return relativeHeightAtLatLon(latDeg, lonDeg);
  }

  return {
    grid,
    heightAtLocal,
    relativeHeightAtLocal,
    relativeHeightAtLatLon,
    heightFn,
    minRelM,
    maxRelM,
    reliefM: maxRelM - minRelM,
  };
}

/**
 * Per-vertex colours for the DEM mesh, computed ONLY from the real
 * heights: elevation tint (low = darker, high = lighter) combined with
 * slope shading (steeper = darker). No synthetic noise — nothing here
 * invents sub-10 m detail. Returns a Float32Array of rows*cols*3 RGB
 * values in [0, 1], in the same row-major order as the grid.
 *
 * With `forTexture: true` the mesh also carries a real NAC imagery
 * texture, so the colours only add a gentle relief cue (near-white
 * base, elevation 0.88–1.0, slope darkening capped at 0.25) instead
 * of the stronger tint used on the bare DEM (base lunar grey,
 * elevation 0.72–1.0, slope cap 0.35).
 */
export function terrainVertexColors(grid, { forTexture = false } = {}) {
  validateGrid(grid);
  const { rows, cols, spacingM, centerHeightM, heights } = grid;
  const minRel = grid.minHeightM - centerHeightM;
  const maxRel = grid.maxHeightM - centerHeightM;
  const span = Math.max(maxRel - minRel, 1);
  const colors = new Float32Array(rows * cols * 3);
  // Base lunar grey (slightly warm). The real lunar albedo is ~0.12,
  // but a bare 0.12 base under the 3.2 Sun + 0.7/0.8 fill reads as
  // near-black even in full Sun; 0.30 is the readability compromise
  // that keeps high-Sun sites (Apollo 15, Sun +61°) a mid lunar grey
  // instead of blown-out white (the old 0.56 base rendered at mean
  // 173/255 there). With a real NAC texture on the mesh the base is
  // near-white so the imagery stays readable and only the relief cue
  // shows through.
  const base = forTexture ? [1, 1, 1] : [0.30, 0.29, 0.28];
  const elevLo = forTexture ? 0.88 : 0.72;
  const slopeCap = forTexture ? 0.25 : 0.35;
  const slopeRate = forTexture ? 1.0 : 1.2;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const h = heights[r][c] - centerHeightM;
      const hN = heights[Math.max(r - 1, 0)][c];
      const hS = heights[Math.min(r + 1, rows - 1)][c];
      const hW = heights[r][Math.max(c - 1, 0)];
      const hE = heights[r][Math.min(c + 1, cols - 1)];
      const slope = Math.hypot(hS - hN, hE - hW) / (2 * spacingM);
      // Elevation tint: elevLo (lowest) → 1.0 (highest).
      const elev = elevLo + (1 - elevLo) * ((h - minRel) / span);
      // Slope shading: flat = 1.0, a 20% grade ≈ 0.76 (0.80 textured).
      const shade = 1 - Math.min(slopeCap, slope * slopeRate);
      const i = (r * cols + c) * 3;
      colors[i] = base[0] * elev * shade;
      colors[i + 1] = base[1] * elev * shade;
      colors[i + 2] = base[2] * elev * shade;
    }
  }
  return colors;
}

/**
 * UV for one DEM grid vertex (r, c): the ground texture is the real
 * LROC NAC mosaic over the exact same ±600 m box, linear in lon/lat,
 * row 0 = north edge, col 0 = west edge — so u runs west→east and
 * v runs south→north (three.js v=1 is the top of the image = north).
 */
export function terrainUV(grid, r, c) {
  validateGrid(grid);
  const { rows, cols } = grid;
  return { u: c / (cols - 1), v: 1 - r / (rows - 1) };
}

/**
 * Real NAC ground-texture status per site (LROC NAC controlled
 * south-pole mosaic, 1 m/px — see public/terrain/PROVENANCE.md and
 * raw-lroc/PROVENANCE.md). 8 sites have a usable texture; Cabeus and
 * Nobile Rim 2 sit north of the mosaic edge (≈ −84°) so no NAC exists
 * for them anywhere checked; Shoemaker, Sverdrup and Faustini are
 * permanently shadowed craters whose mosaic is genuinely black.
 * Never stretch another site's imagery onto these sites.
 */
export const NAC_TEXTURED_SITES = new Set([
  'haworth', 'malapert', 'mouton-plateau', 'mouton',
  'nobile1', 'gerlache2', 'slater', 'connecting-ridge',
]);
const PSR_SITES = new Set(['shoemaker', 'sverdrup', 'faustini']);

export function textureStatusForSite(siteId) {
  if (siteId === 'apollo15') {
    return {
      status: 'nac-dtm',
      label: 'Real LROC NAC DTM terrain, 2 m/px',
      note: 'Drive terrain is the real LROC NAC DTM of the Apollo 15 landing site (514 m square, 2 m/px, NASA public domain) — the finest terrain in the app. Heights are relative (absolute datum unknown); north alignment of the staged heightmap is unverified. No ground imagery — DEM shading only.',
    };
  }
  if (NAC_TEXTURED_SITES.has(siteId)) {
    return {
      status: 'nac',
      label: 'Real LROC NAC imagery, 1 m/px',
      note: 'Ground texture is the real LROC NAC controlled south-pole mosaic (1 m/px, NASA public domain) over this exact 1.2 km box. The mosaic has one baked Sun angle, so texture shadows do not move with the app’s live Sun.',
    };
  }
  if (PSR_SITES.has(siteId)) {
    return {
      status: 'psr',
      label: 'Permanently shadowed — no sunlit imagery exists',
      note: 'This is a permanently shadowed crater floor: the real NAC mosaic is genuinely black here because the Sun never reaches it. DEM shading only — the black mosaic is never brightened.',
    };
  }
  return {
    status: 'no-coverage',
    label: 'No NAC coverage — DEM shading only',
    note: 'No LROC NAC mosaic coverage exists for this site (it sits north of the mosaic edge, ≈ −84°). DEM shading only — no other site’s imagery is stretched onto it.',
  };
}

// ---- Lazy loading (one grid per site, cached) -----------------------

const gridCache = new Map();

/**
 * Fetch one site's grid JSON (lazy — never all 13 up front).
 * `base` is import.meta.env.BASE_URL ('./' on GitHub Pages, '/' locally).
 * The promise is cached per site; a failed load is evicted so a retry
 * can succeed. Throws on HTTP error or invalid grid.
 */
export async function loadTerrainGrid(siteId, base) {
  if (gridCache.has(siteId)) return gridCache.get(siteId);
  const b = base ?? (typeof import.meta !== 'undefined' && import.meta.env
    ? import.meta.env.BASE_URL || '/'
    : '/');
  const p = fetch(`${b}terrain/${siteId}.json`)
    .then((res) => {
      if (!res.ok) throw new Error(`terrain ${siteId}: HTTP ${res.status}`);
      return res.json();
    })
    .then((grid) => validateGrid(grid))
    .catch((err) => {
      gridCache.delete(siteId);
      throw err;
    });
  gridCache.set(siteId, p);
  return p;
}

/** Test helper: clear the load cache. */
export function clearTerrainCache() {
  gridCache.clear();
}
