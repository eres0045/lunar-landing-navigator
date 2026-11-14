# Drive Terrain — Real LRO LOLA DEM

Drive mode runs on **real elevation data**, not a flat plane. Every site
has a 1200 m × 1200 m sampled height grid from the Lunar Reconnaissance
Orbiter Laser Altimeter (LOLA), and the rover follows it — height,
pitch, and roll all come from the DEM.

## Datasets (NASA public domain — US government work)

| Product | Resolution | Coverage | Sites | Source |
|---|---|---|---|---|
| `LDEM_85S_10M` (LRO-L-LOLA-4-GDR-V1.0) | 10 m/px, polar stereographic | lat −85°…−90° | malapert, haworth, mouton, nobile1, gerlache2, slater, connecting-ridge, shoemaker, sverdrup, faustini | https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/IMG/LDEM_85S_10M.IMG |
| `LDEM_80S_20M` (LRO-L-LOLA-4-GDR-V1.0) | 20 m/px, polar stereographic | lat −80°…−90° | cabeus, mouton-plateau, nobile2 | https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/IMG/LDEM_80S_20M.IMG |

Both are LOLA Gridded Data Records (binned + interpolated altimetry,
2009-07-13 → 2017-02-02, GRAIL-900C geodetic frame), mirrored from the
NASA PDS Geosciences Node at MIT (`imbrium.mit.edu`); the PDS node
itself was returning its "site currently unavailable" page on
2026-11-14, so the MIT mirror was used. The files are the identical
PDS3 products (labels match the PDS catalog: 30336×30336 /
30400×30400, LSB int16, `HEIGHT = DN × 0.5`, `OFFSET = 1737400 m`).

Full provenance, pixel mapping, and the verification log live in
`public/terrain/PROVENANCE.md` — read that first for anything about
how the grids were sampled.

## Files shipped with the app

- `public/terrain/<siteId>.json` — one grid per site (13), 1.2 MB total.
- `public/terrain/checks.json` — 5 independent check values per site
  (centre + 500 m N/E/S/W), sampled straight from the raw DEM at exact
  lat/lon (not from the grids). All 65 match their grid nodes exactly.
- `public/terrain/PROVENANCE.md` — provenance, schema, mapping
  formula, verification log.

Raw excerpts, labels, and the reproduction script live in the project
root `raw-dem/` (110 MB) and are **NOT shipped** — do not add them to
the repo.

## Grid schema

```json
{
  "siteId": "malapert", "siteName": "Malapert Massif",
  "centerLat": -85.99, "centerLon": -0.125,
  "spacingM": 10, "rows": 121, "cols": 121, "halfSizeM": 600,
  "originNorthM": 600, "originEastM": -600,
  "rowConvention": "row 0 = north edge; north = originNorthM - row*spacingM; east = originEastM + col*spacingM",
  "heights": [[...]],            // row-major, metres
  "datum": "metres above reference sphere radius 1737400 m (LOLA GDR: HEIGHT = DN * 0.5)",
  "centerHeightM": 4807.6, "minHeightM": 4720.1, "maxHeightM": 4850.0,
  "noDataNodes": 0,
  "source": "LRO LOLA GDR LDEM_85S_10M (LRO-L-LOLA-4-GDR-V1.0)",
  "sourceUrl": "https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/IMG/LDEM_85S_10M.IMG",
  "resolutionM": 10, "license": "NASA public domain (US government work)"
}
```

10 m sites: 121×121 nodes. 20 m sites: 61×61 nodes.

## How it plugs in

- **Lookup** — `app/src/lib/terrain.js` (pure, no three.js).
  `createTerrainLookup(grid)` bilinear-interpolates the grid for any
  `(northM, eastM)` and exposes `relativeHeightAtLatLon(lat, lon)`.
  Grid heights are ABSOLUTE metres above the 1737.4 km sphere; the
  lookup returns height MINUS the site's `centerHeightM`, so the
  landing point is 0 m — that is what the rover frame expects.
  Outside the ±600 m grid the lookup clamps to the edge value; it
  never returns NaN and never throws (non-finite inputs fall back to
  the centre). `loadTerrainGrid(siteId)` lazy-fetches one grid at a
  time (cached per site) from `terrain/<siteId>.json`.
- **Physics** — `app/src/lib/rover.js` is unchanged except that
  `surfaceHeightAt` is now fed by the DEM via `setSurfaceHeightAt`
  (loaded per site by `LunarScene`). `slopeAt` finite-differences it,
  so the rover's height, pitch, and roll follow automatically — no
  other physics changes.
- **Mesh** — `app/src/components/terrainMesh.js` builds a
  `BufferGeometry` from the same grid: the full 1200 m × 1200 m
  square, one vertex per grid node, x = east, y = relative height,
  z = north, same meter scale as the rover. The 500 m drive circle
  sits inside it with margin. `LunarScene.jsx` swaps the flat disc
  for this mesh once the grid loads (flat disc until then; flat disc
  again if the fetch fails).
- **Shading** — vertex colours from `terrainVertexColors`:
  elevation tint (low = darker, high = lighter) combined with slope
  shading (steeper = darker), computed ONLY from the real heights.
  No synthetic noise, no fake texture. Toggleable in the Drive HUD
  ("DEM shading", default on); off restores the uniform lunar grey.
- **Rings & rocks** — the 50/100/200 m distance rings and the
  landing ring are terrain-following line loops (a flat ring would be
  buried by up to 130 m of relief); the deterministic rocks are
  re-seated on the DEM when it loads. Rocks are still decorative —
  no collision.
- **HUD** — shows the live terrain source ("real LRO LOLA DEM,
  10 m/px · relief 130 m"), elevation vs the landing point, and
  pitch/roll (`data-testid="drive-height"`, `"drive-pitch"`).

## Per-site relief (over the 1.2 km square)

| Site | Centre (m) | Relief (m) |
|---|---|---|
| malapert | +4807.6 | 129.9 |
| haworth | +1635.5 | 149.8 |
| mouton | +6398.4 | 223.7 |
| mouton-plateau | +5076.3 | 421.9 |
| nobile1 | +5956.1 | 261.1 |
| nobile2 | +972.1 | 148.6 |
| cabeus | +4265.3 | 341.6 |
| gerlache2 | −60.8 | 306.3 |
| slater | +21.9 | 157.9 |
| connecting-ridge | +1958.6 | 112.6 |
| shoemaker | −3936.4 | 30.3 |
| sverdrup | −2880.5 | 72.5 |
| faustini | −2726.7 | 115.3 |

Worked example (Malapert, verified in tests): driving north 500 m
from the landing point raises the rover by +17.7 m (4825.3 − 4807.6);
east 500 m raises it +33.3 m; south 500 m drops it −64.5 m.

## Verification

- **Unit tests** (`app/src/lib/terrain.test.js`, 27 tests): all 65
  check values reproduce from the lookup to < 0.5 m; Malapert spot
  values; bilinear midpoints bounded by neighbours; edge clamping;
  rover height/pitch on the real DEM (500 m north drive → +17.7 m);
  mesh vertex count and heights (121×121 at 10 m, 61×61 at 20 m).
- **Live probe** (`app/scripts/terrain-probe.mjs`, untracked): enters
  Drive mode on the live site, drives north, asserts the HUD elevation
  rises, screenshots the terrain, zero console errors, zero failed
  requests.

## Honest limits

- **Resolution 10–20 m.** Boulders, small craters, and texture below
  ~10–20 m are NOT resolved — do not claim sub-10 m detail. Any finer
  visual roughness would be illustrative, not measured; none is added.
- **No imagery texture.** No LROC texture was obtainable (USGS 403,
  LROC WMS dead, QuickMap tiles unreachable — see PROVENANCE.md), so
  the scene shades the real DEM live instead of using a fake texture.
  The orbit view's Moon sphere texture is still illustrative and
  labelled as such.
- **Rocks are decorative** (no collision) and the rover physics is
  still the kinematic approximation in ROVER.md (no slip, suspension,
  or regolith dynamics).
- **No terrain shadowing.** Sun/Earth POWER/COMM verdicts still use
  the flat-horizon geometric model — real ridges can hide the Sun or
  Earth near the horizon. Terrain-aware shadowing is Step 3 work.
- The 5 m product (`LDEM_87S_5M`) covers only lat ≤ −87.5°, so it
  does NOT cover Malapert (−85.99°) or 9 of the 13 sites — 10 m is
  the finest uniform product covering the default site.
