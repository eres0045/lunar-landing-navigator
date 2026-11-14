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
 */
export function terrainVertexColors(grid) {
  validateGrid(grid);
  const { rows, cols, spacingM, centerHeightM, heights } = grid;
  const minRel = grid.minHeightM - centerHeightM;
  const maxRel = grid.maxHeightM - centerHeightM;
  const span = Math.max(maxRel - minRel, 1);
  const colors = new Float32Array(rows * cols * 3);
  // Base lunar grey (slightly warm), matching the old flat ground.
  const base = [0.56, 0.55, 0.53];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const h = heights[r][c] - centerHeightM;
      const hN = heights[Math.max(r - 1, 0)][c];
      const hS = heights[Math.min(r + 1, rows - 1)][c];
      const hW = heights[r][Math.max(c - 1, 0)];
      const hE = heights[r][Math.min(c + 1, cols - 1)];
      const slope = Math.hypot(hS - hN, hE - hW) / (2 * spacingM);
      // Elevation tint: 0.72 (lowest) → 1.0 (highest).
      const elev = 0.72 + 0.28 * ((h - minRel) / span);
      // Slope shading: flat = 1.0, a 20% grade ≈ 0.76.
      const shade = 1 - Math.min(0.35, slope * 1.2);
      const i = (r * cols + c) * 3;
      colors[i] = base[0] * elev * shade;
      colors[i + 1] = base[1] * elev * shade;
      colors[i + 2] = base[2] * elev * shade;
    }
  }
  return colors;
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
