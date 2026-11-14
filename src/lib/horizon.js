/**
 * Terrain-aware horizon — Step 3 of the Lunar Landing Site Navigator.
 *
 * PURE module: no three.js, no DOM, fully unit-testable.
 *
 * The horizon is the silhouette of the real terrain as seen from the
 * landing site: for each azimuth, the maximum elevation angle of the
 * terrain along that ray. The Sun (or Earth) is above the local
 * horizon — and therefore visible / powering the site — only when its
 * altitude exceeds that angle.
 *
 * Data: the local DEM grid per site (app/public/terrain/<siteId>.json,
 * 121x121 @ 10 m or 61x61 @ 20 m, +/-600 m) plus, for the 13
 * south-pole sites, a regional grid (raw-dem/regional/<siteId>.json,
 * 667x667 @ 30 m, +/-9990 m, reprojected from LDEM_75S_30M at native
 * resolution — see app/tools/fetch_regional.py). Apollo 15 has no
 * regional window (equatorial; the polar product does not cover it),
 * so its horizon is local-only out to ~360 m.
 *
 * Conventions (must match the ephemeris and the DEM frame):
 *  - Azimuth 0 deg = north, eastward (az 90 deg = east) — the same
 *    convention as ephemeris.js altAzFromBodyDir.
 *  - Local frame: northM = d * cos(az), eastM = d * sin(az).
 *  - DEM frame: row 0 = north edge, north = originNorthM - row*spacingM,
 *    east = originEastM + col*spacingM (terrain.js createTerrainLookup).
 *
 * Observer: the eye sits `eyeHeightM` (default 2 m — a lander / rover
 * eye height) above the grid-centre surface.
 *
 * Geometry: heights are metres above the 1737.4 km reference sphere,
 * so over the ray the sphere drops away from the observer's tangent
 * plane by d^2 / (2R). The elevation angle to a sample at distance d
 * is atan2(h_sample - h_observer - d^2/(2R), d). At 600 m the drop is
 * 0.10 m (0.01 deg — negligible); at 10 km it is 28.8 m (0.16 deg —
 * included, not ignored). The Moon has no atmosphere, so there is no
 * refraction correction.
 *
 * RANGE LIMIT (honest): the horizon only sees terrain inside the
 * grids — +/-600 m of the 10/20 m local DEM, then the 30 m regional
 * DEM out to ~10 km at the south-pole sites (~360 m at Apollo 15).
 * More distant massifs are NOT in the horizon; verdicts near the
 * horizon can still differ from reality. This limit is recorded in
 * every profile (`rangeM`) and in the rule strings (data.js).
 */
import { createTerrainLookup, validateGrid } from './terrain.js';
import { MOON_RADIUS_M } from './rover.js';

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

/** Default eye height above the local surface, metres. */
export const DEFAULT_EYE_HEIGHT_M = 2;

/** Default azimuth bins: 1 deg per bin, 0 deg = north, eastward. */
export const DEFAULT_BINS = 360;

/**
 * Compute the horizon elevation profile for one site grid.
 *
 * For each azimuth bin, march a ray from the grid centre outward to
 * the grid edge (local grid, then the regional `farGrid` beyond it),
 * sampling heights bilinearly, and take the maximum elevation angle.
 * Samples are clamped to the grid edge — the ray never reads beyond
 * the data that exists.
 *
 * `grid`: local DEM grid in the terrain.js schema (heights absolute
 * above the 1737.4 km sphere). `farGrid` (optional): regional grid in
 * the same schema, same centre, larger halfSizeM — sampled beyond the
 * local grid's edge. Its heights are absolute above the same sphere,
 * so they compare directly with the local grid.
 *
 * Returns { siteId, bins, eyeHeightM, rangeM, localRangeM,
 *   farRangeM, elevationsDeg, minDeg, maxDeg, meanDeg, maxAzDeg }.
 * `rangeM` is the farthest terrain distance considered along any ray
 * (local grid corner when local-only; the far disc radius when a
 * regional grid is blended in); `localRangeM` is the local grid's
 * half-size (600 m at the pole sites). `elevationsDeg` is a plain
 * number array (JSON-safe).
 */
export function computeHorizonProfile(grid, { eyeHeightM = DEFAULT_EYE_HEIGHT_M, bins = DEFAULT_BINS, farGrid = null } = {}) {
  validateGrid(grid);
  if (farGrid) validateGrid(farGrid);
  if (!Number.isFinite(eyeHeightM) || eyeHeightM < 0) {
    throw new Error(`horizon ${grid.siteId}: bad eyeHeightM ${eyeHeightM}`);
  }
  if (!Number.isFinite(bins) || bins < 4 || Math.floor(bins) !== bins) {
    throw new Error(`horizon ${grid.siteId}: bad bins ${bins}`);
  }
  const local = createTerrainLookup(grid);
  const far = farGrid ? createTerrainLookup(farGrid) : null;
  const hObserver = grid.centerHeightM + eyeHeightM;
  const localHalf = grid.halfSizeM;
  const farHalf = far ? farGrid.halfSizeM : 0;
  // Range: the local grid is valid to its square corners (sampled
  // from the full square — see raw-dem/extract_dem.py), so a
  // local-only ray runs to the square edge. The regional grid is
  // valid only inside the r <= farHalf disc it was fetched for (its
  // corner nodes beyond that radius are edge-clamped, not data), so
  // a blended ray stops at farHalf in EVERY direction.
  const rangeM = far ? farHalf : localHalf * Math.SQRT2;
  const localStep = grid.spacingM / 2;
  const farStep = far ? farGrid.spacingM / 2 : localStep;

  const elevationsDeg = new Array(bins);
  for (let b = 0; b < bins; b++) {
    const az = (b / bins) * 360 * D2R;
    const cosAz = Math.cos(az);
    const sinAz = Math.sin(az);
    const maxComp = Math.max(Math.abs(cosAz), Math.abs(sinAz));
    // Distance from the centre to the square edge along this ray.
    const dLocalEdge = localHalf / maxComp;
    const dMax = far ? farHalf : dLocalEdge;
    let best = -Infinity;
    // March in local-step increments while inside the local grid,
    // far-step increments beyond it; always sample the seam and the
    // exact edge point so the maximum cannot hide between steps.
    let d = localStep;
    while (d <= dMax) {
      const step = d <= dLocalEdge ? localStep : farStep;
      sample(d);
      if (d + step > dMax) break;
      d += step;
    }
    sample(dLocalEdge);
    sample(dMax);
    elevationsDeg[b] = best;

    function sample(dist) {
      if (dist <= 0) return;
      const northM = dist * cosAz;
      const eastM = dist * sinAz;
      const h = dist <= dLocalEdge
        ? local.heightAtLocal(northM, eastM)
        : far.heightAtLocal(northM, eastM);
      // Sphere drop below the observer's tangent plane: d^2 / (2R).
      const elev = Math.atan2(h - hObserver - (dist * dist) / (2 * MOON_RADIUS_M), dist) * R2D;
      if (elev > best) best = elev;
    }
  }

  let minDeg = Infinity;
  let maxDeg = -Infinity;
  let sum = 0;
  let maxAzDeg = 0;
  for (let b = 0; b < bins; b++) {
    const e = elevationsDeg[b];
    sum += e;
    if (e < minDeg) minDeg = e;
    if (e > maxDeg) {
      maxDeg = e;
      maxAzDeg = (b / bins) * 360;
    }
  }
  return {
    siteId: grid.siteId,
    bins,
    eyeHeightM,
    rangeM,
    localRangeM: localHalf,
    farRangeM: far ? farHalf : null,
    elevationsDeg,
    minDeg,
    maxDeg,
    meanDeg: sum / bins,
    maxAzDeg,
  };
}

/**
 * Horizon elevation (deg) at an azimuth, linearly interpolated
 * between adjacent bins and wrapping at 360 deg. `profile` is a
 * computeHorizonProfile result or a plain object with the same shape
 * (as loaded from horizons.json — elevationsDeg a plain array).
 */
export function horizonAt(profile, azDeg) {
  if (!profile || !profile.elevationsDeg || !profile.bins) {
    throw new Error('horizonAt: bad profile');
  }
  const n = profile.bins;
  const e = profile.elevationsDeg;
  let az = azDeg % 360;
  if (az < 0) az += 360;
  const pos = (az / 360) * n;
  const i0 = Math.floor(pos) % n;
  const i1 = (i0 + 1) % n;
  const frac = pos - Math.floor(pos);
  return e[i0] * (1 - frac) + e[i1] * frac;
}

/** True iff a body at altitude `altDeg`, azimuth `azDeg` is above the
 *  local horizon in `profile` (strictly greater, as in the flat rule). */
export function isAboveHorizon(altDeg, azDeg, profile) {
  return altDeg > horizonAt(profile, azDeg);
}
