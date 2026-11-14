# Terrain data — provenance & how to use it

**Delivered 2026-11-14.** Real LRO LOLA digital elevation data for all 13
navigator sites. Nothing here is synthesized.

## Datasets (both NASA public domain — US government work)

| Product | Resolution | Coverage | Sites | Source URL |
|---|---|---|---|---|
| `LDEM_85S_10M` (LRO-L-LOLA-4-GDR-V1.0) | 10 m/px, polar stereographic | lat −85°…−90° | malapert, haworth, mouton, nobile1, gerlache2, slater, connecting-ridge, shoemaker, sverdrup, faustini | https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/IMG/LDEM_85S_10M.IMG |
| `LDEM_80S_20M` (LRO-L-LOLA-4-GDR-V1.0) | 20 m/px, polar stereographic | lat −80°…−90° | cabeus, mouton-plateau, nobile2 | https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/IMG/LDEM_80S_20M.IMG |

Both are LOLA Gridded Data Records (binned + interpolated altimetry,
2009-07-13 → 2017-02-02, GRAIL-900C geodetic frame), mirrored from the
NASA PDS Geosciences Node at MIT (`imbrium.mit.edu`). The PDS node itself
(`pds-geosciences.wustl.edu`) was returning its "site currently unavailable"
page on 2026-11-14, so the MIT mirror was used; the files are the identical
PDS3 products (labels match the PDS catalog: 30336×30336 / 30400×30400,
LSB int16, `HEIGHT = DN × 0.5`, `OFFSET = 1737400 m`).
Labels kept in `../../raw-dem/*.LBL`. Raw row-band excerpts fetched for
sampling are in `../../raw-dem/windows/` (110 MB total, NOT shipped to the
site). Reproduction script: `../../raw-dem/extract_dem.py`.

## Files in this directory (1.2 MB total)

- `<siteId>.json` — one per site (13). Sampled height grid, 1200 m × 1200 m
  square centred on the site (±600 m, covers the 500 m drive circle + margin).
- `checks.json` — 5 independent check values per site (centre + 500 m N/E/S/W),
  sampled straight from the raw DEM at exact lat/lon (not from the grids),
  for unit tests. All 65 values match their grid nodes to ≤ 0.0 m after
  rounding (verified programmatically).

## Grid schema (`<siteId>.json`)

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

10 m sites: 121×121 nodes. 20 m sites: 61×61 nodes. Heights are absolute
(metres above the 1737.4 km sphere); subtract `centerHeightM` for relative
heights. Bilinear-interpolate the grid for `surfaceHeightAt`; grid nodes were
sampled from the raw DEM by bilinear interpolation using the app's own
`localToLatLon` (rover.js equirectangular tangent plane), so lookup is
self-consistent.

## Pixel mapping (polar stereographic, VERIFIED — do not "fix")

```
rho = 2 * 1737400 * tan((90 + lat) / 2)      # metres from the pole
line0   = (OFFSET - 1) - rho * cos(lon) / SCALE
sample0 = (OFFSET - 1) + rho * sin(lon) / SCALE
# OFFSET = 15167.5, SCALE = 10 for LDEM_85S_10M
# OFFSET = 15199.5, SCALE = 20 for LDEM_80S_20M
```

## Verification (all passed)

1. **Orientation test (Malapert):** 10 m product value 4807.5 m vs
   independent cylindrical `LDEM_128` (237 m/px) anchor 4812.5 m → Δ 5 m.
   The mirror-image mapping gave −2734 m (different terrain) and was rejected.
   Longitude-sign check: pixel at lon +0.125° reads 4842.0 m vs LDEM_128
   4841.0 m at the same lon (Δ 1 m) — the east/west orientation is confirmed,
   not mirrored.
2. **Per-site cross-check:** every site centre from its polar product vs
   `LDEM_128` at the same lat/lon — all 13 agree within 13 m (most ≤ 6 m).
   Largest: Sverdrup +13.0 m, Nobile Rim 1 −11.9 m (expected: 10–20 m pixels
   vs a 237 m mean pixel on slopes).
3. **No-data:** zero no-data nodes in any grid (products are interpolated).
4. **Schema/self-consistency:** all 13 JSONs parse; `rows`×`cols` match the
   `heights` array; all 65 check values equal their grid nodes exactly.

## Per-site numbers (centre height, relief over the 1.2 km square)

| Site | Product | Centre (m) | Min–Max (m) | Relief (m) |
|---|---|---|---|---|
| malapert | 10 m | +4807.6 | 4720.1–4850.0 | 129.9 |
| haworth | 10 m | +1635.5 | 1504.5–1654.3 | 149.8 |
| mouton | 10 m | +6398.4 | 6240.1–6463.8 | 223.7 |
| mouton-plateau | 20 m | +5076.3 | 4834.9–5256.8 | 421.9 |
| nobile1 | 10 m | +5956.1 | 5761.9–6023.0 | 261.1 |
| nobile2 | 20 m | +972.1 | 925.1–1073.7 | 148.6 |
| cabeus | 20 m | +4265.3 | 4101.1–4442.7 | 341.6 |
| gerlache2 | 10 m | −60.8 | −230.4–75.9 | 306.3 |
| slater | 10 m | +21.9 | −32.6–125.3 | 157.9 |
| connecting-ridge | 10 m | +1958.6 | 1868.1–1980.7 | 112.6 |
| shoemaker | 10 m | −3936.4 | −3957.8–3927.5 | 30.3 |
| sverdrup | 10 m | −2880.5 | −2937.2–−2864.7 | 72.5 |
| faustini | 10 m | −2726.7 | −2814.8–−2699.5 | 115.3 |

## Honest resolution implication

- 10 m/px = 100 samples across the 1 km drive square; 20 m/px = 50.
  Real relief over the drive area is gentle at Malapert (130 m over
  1.2 km, ~6° mean slopes, steepest at Mons Mouton Plateau, 422 m).
  The rover will feel real undulation and slopes, not a flat plane.
- What LOLA does **not** resolve: boulders, small craters and texture below
  ~10–20 m. Do not claim sub-10 m detail; any finer visual roughness in the
  3D scene must be labelled as illustrative, not measured.
- The 5 m product (`LDEM_87S_5M`) covers only lat ≤ −87.5°, so it does NOT
  cover Malapert (−85.99°) or 9 of the 13 sites — 10 m is the finest
  uniform product covering the default site.

## What was NOT obtained (updated 2026-11-14)

- **LROC imagery texture — OBTAINED 2026-11-14 (this bullet was
  "none" before).** The old LROC WMS host is dead, but LROC moved to
  `im-ldi.com`: the WMS at `http://wms.im-ldi.com/lroc/wms` answers
  GetCapabilities (351 layers) including `luna_nac_pole_control_south`,
  the controlled 1 m/px south-pole mosaic. 8 of 13 south-pole sites
  were staged as 1024×1024 JPEGs over the exact ±600 m DEM box
  (`public/terrain/nac/`, manifest with per-site bbox). No coverage:
  cabeus, nobile2 (mosaic edge ≈ −84°). Black PSR floors: shoemaker,
  sverdrup, faustini — real data, permanent shadow, not brightened.
  Full route log: project-root `raw-lroc/PROVENANCE.md`. USGS
  Astrogeology still returns Cloudflare 403 from this VM.
- **Apollo 15 NAC DTM — OBTAINED 2026-11-14.** The Space ROS PR
  (space-ros/simulation#32) ships a real LROC NAC DTM heightmap of
  the Apollo 15 landing site: 257×257 px, 514×514 m, 2 m/px, 49 m
  relief (`public/terrain/apollo15.json`). Heights are relative
  (grey 0–255 → 0–49 m, Gazebo convention; absolute datum unknown);
  north alignment of the staged heightmap is unverified. The
  package's diffuse/normal textures have no stated provenance and
  were NOT shipped. Apollo 15 is a separate 14th site, clearly
  labelled as an equatorial historic site, never as Artemis terrain.
- **Full 1.8 GB DEM files:** deliberately NOT downloaded. Only the row
  bands covering each site were fetched via HTTP Range requests (verified
  `Accept-Ranges: bytes`, 206 responses; file sizes match labels exactly:
  1,840,545,792 bytes for `LDEM_85S_10M.IMG`).
