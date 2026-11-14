# Drive Terrain — Real LRO LOLA DEM + LROC NAC

Drive mode runs on **real elevation data**, not a flat plane. Every site
has a 1200 m × 1200 m sampled height grid from the Lunar Reconnaissance
Orbiter Laser Altimeter (LOLA) — plus Apollo 15, which runs on a real
LROC NAC DTM at 2 m/px — and the rover follows it: height, pitch, and
roll all come from the DEM.

## Datasets (NASA public domain — US government work)

| Product | Resolution | Coverage | Sites | Source |
|---|---|---|---|---|
| `LDEM_85S_10M` (LRO-L-LOLA-4-GDR-V1.0) | 10 m/px, polar stereographic | lat −85°…−90° | malapert, haworth, mouton, nobile1, gerlache2, slater, connecting-ridge, shoemaker, sverdrup, faustini | https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/IMG/LDEM_85S_10M.IMG |
| `LDEM_80S_20M` (LRO-L-LOLA-4-GDR-V1.0) | 20 m/px, polar stereographic | lat −80°…−90° | cabeus, mouton-plateau, nobile2 | https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/IMG/LDEM_80S_20M.IMG |
| LROC NAC DTM `APOLLO15_E261N0036` (via NASA Space ROS, space-ros/simulation#32) | 2 m/px, 514×514 m | Apollo 15 landing site, 26.13°N 3.63°E | apollo15 | https://github.com/space-ros/simulation/pull/32 |

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

- `public/terrain/<siteId>.json` — one grid per site (14: 13 LOLA + Apollo 15), 1.2 MB LOLA + 0.45 MB Apollo 15.
- `public/terrain/checks.json` — 5 independent check values per LOLA site
  (centre + 500 m N/E/S/W), sampled straight from the raw DEM at exact
  lat/lon (not from the grids). All 65 match their grid nodes exactly.
  Apollo 15 has no independent check — its heights come from the DTM
  greyscale directly (relative 0–49 m, absolute datum unknown).
- `public/terrain/nac/<siteId>.jpg` — real LROC NAC ground texture for
  8 sites (1024×1024, ~1.5 MB total), plus `manifest.json` with the
  per-site bounding box. See "Ground texture" below.
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

## Ground texture — real LROC NAC imagery (8 of 13 south-pole sites)

The ground mesh carries a real LROC NAC mosaic texture where coverage
exists, mapped to the exact ±600 m DEM box (UV = grid position, so the
imagery sits on the real terrain it pictures). Source: LROC controlled
1 m/px south-pole mosaic (`luna_nac_pole_control_south`), fetched via
the LROC WMS at `http://wms.im-ldi.com/lroc/wms` (LROC moved to
`im-ldi.com`; the old `wms.lroc.asu.edu` host is dead). Each image is
1024×1024 over the 1200 m box (~1.17 m/px), JPEG quality 82.

- **Textured:** haworth, malapert, mouton-plateau, mouton, nobile1,
  gerlache2, slater, connecting-ridge.
- **Exposure lift (documented, not hidden):** the south-pole NAC
  mosaic is genuinely dark — the raw 1024×1024 crops average
  17–90/255 (low Sun over the pole). The shipped JPEGs carry a
  uniform gamma 0.45 lift applied at conversion (2026-11-14), which
  raises Malapert's mean 41.5 → 105.8 and Haworth's 17.2 → 70.3.
  Pixel values stay the real NAC mosaic, relatively preserved —
  like raising exposure on a photo, not synthetic texture. The lift
  is recorded in `nac/manifest.json` (`exposure`).
- **No NAC coverage** (mosaic edge ≈ −84°): cabeus, nobile2 — DEM
  shading only.
- **Permanently shadowed floors** (real data — the mosaic is black
  there because no sunlight reaches the floor): shoemaker, sverdrup,
  faustini — DEM shading only, labelled "Permanently shadowed — no
  sunlit imagery exists". The black pixels are NOT brightened.
- **Apollo 15:** no ground imagery — DEM shading only. Its terrain
  is the real 2 m/px NAC DTM, the finest in the app.

The texture is a surface albedo image taken at one Sun angle; it is
NOT re-lit by the app's Sun — the real-time DEM shadow map (see
"Lighting") is what moves with the date. The vertex colours under the
texture are a near-white elevation tint (0.88–1.0) so the imagery
stays readable instead of being double-darkened. Full route log and
per-site verdicts: project-root `raw-lroc/PROVENANCE.md` (NOT shipped).

## Lighting — real Sun direction + DEM shadows

- The Drive-mode Sun is a directional light at the **real ephemeris
  Sun azimuth/elevation for the selected date** (same numbers the
  POWER verdict uses). Pitch-black sky (no atmosphere, no haze);
  ambient light is dim in Drive mode (0.18) so the scene reads as
  night-side lunar surface at LOW SUN dates.
- **Real-time DEM shadows:** the Sun casts shadows (`PCFShadowMap`,
  2048 map over ±160 m, bias −0.0002) — real ridges cast real shadows
  along the Sun azimuth in the Drive view. This is a view aid only:
  POWER/COMM verdicts still use the flat-horizon geometric model
  (see "Honest limits").
- **Earthshine + readability fill:** a hemisphere fill (0.8) plus
  ambient 0.7 in Drive mode stand in for Earthshine + scattered
  light and keep the surface readable. At the poles the Sun sits at
  0–6°, so flat ground gets ~10% of direct Sun and most of the near
  field sits in long DEM shadows — with the old 0.18/0.3 fill the
  ground rendered black (mean 3.8/255 in a probe screenshot) and the
  real NAC texture was invisible. The raised fill is a display
  choice, labelled "brightness adjusted for readability" in the HUD;
  it does not fake a Sun and does not feed the verdicts.

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
  again if the fetch fails). **Winding (fixed 2026-11-14):** the
  index order was `(a, d, b)` / `(b, d, e)`, which wound every
  triangle facing DOWN (mean vertex-normal y −0.99) — the Sun never
  lit the ground and the terrain rendered black at every site since
  Step 2. The order is now `(a, b, d)` / `(b, e, d)` (mean normal y
  +0.99), test-guarded. **Albedo:** the bare-DEM base is 0.30 (the
  real lunar albedo is ~0.12; 0.30 is the readability compromise
  that keeps high-Sun sites a mid grey instead of blown-out white).
- **Shading** — vertex colours from `terrainVertexColors`:
  elevation tint (low = darker, high = lighter) combined with slope
  shading (steeper = darker), computed ONLY from the real heights.
  No synthetic noise, no fake texture. Where a NAC texture is present
  (`forTexture`), the base is near-white (0.88–1.0) with a 0.25 slope
  cap so the real imagery shows through instead of being
  double-darkened. Toggleable in the Drive HUD ("DEM shading",
  default on); off restores the uniform lunar grey.
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
| apollo15 | +45.35 (relative) | 49.0 |

Worked example (Malapert, verified in tests): driving north 500 m
from the landing point raises the rover by +17.7 m (4825.3 − 4807.6);
east 500 m raises it +33.3 m; south 500 m drops it −64.5 m.

## Verification

- **Unit tests** (`app/src/lib/terrain.test.js`, 34 tests): all 65
  check values reproduce from the lookup to < 0.5 m; Malapert spot
  values; bilinear midpoints bounded by neighbours; edge clamping;
  rover height/pitch on the real DEM (500 m north drive → +17.7 m);
  mesh vertex count and heights (121×121 at 10 m, 61×61 at 20 m,
  257×257 at Apollo 15); UV corners + geometry UV attribute;
  per-site texture status (8 textured, 2 no-coverage, 3 PSR black,
  Apollo 15 `nac-dtm`); NAC manifest matches the textured set;
  `forTexture` colour floor ≥ 0.66; **winding regression — mean
  vertex-normal y > 0.9** (the Nov 14 down-facing-normal bug).
- **Live probe** (`app/scripts/visuals-probe.mjs`, untracked): enters
  Drive mode on the live site, screenshots chase + driver cams at
  the default date and at a high-Sun date, zero console errors, zero
  failed requests. (Replaces the older `terrain-probe.mjs`.)

## Honest limits

- **Resolution 10–20 m at the south pole (2 m at Apollo 15).**
  Boulders, small craters, and texture below ~10–20 m are NOT
  resolved at the south-pole sites — do not claim sub-10 m detail
  there. Any finer visual roughness would be illustrative, not
  measured; none is added. Apollo 15's 2 m DTM resolves features
  down to ~4–6 m.
- **Imagery texture covers 8 of 13 south-pole sites.** cabeus and
  nobile2 have no NAC coverage (mosaic edge); shoemaker, sverdrup,
  and faustini are permanently shadowed (black in the real mosaic —
  not brightened, not faked). Apollo 15 has DEM shading only.
  The orbit view's Moon sphere texture is still illustrative and
  labelled as such.
- **Rocks are decorative** (no collision) and the rover physics is
  still the kinematic approximation in ROVER.md (no slip, suspension,
  or regolith dynamics).
- **No terrain shadowing in the verdicts.** Sun/Earth POWER/COMM
  verdicts still use the flat-horizon geometric model — real ridges
  can hide the Sun or Earth near the horizon. The Drive view renders
  real-time DEM shadows as a view aid, but those shadows do NOT feed
  the verdicts. Terrain-aware shadowing in the verdicts is Step 3 work.
- The 5 m product (`LDEM_87S_5M`) covers only lat ≤ −87.5°, so it
  does NOT cover Malapert (−85.99°) or 9 of the 13 sites — 10 m is
  the finest uniform product covering the default site.
