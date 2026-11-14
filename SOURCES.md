# SOURCES — NASA Space Apps 2026: Lunar Landing Site Navigator

**Researched:** 2026-11-14 (IST, by the research worker). **Submission window closes Nov 15, 2026, 23:59 IST.**
**Context:** Ronit's Team SPICA ("Flame in Freefall") was already SUBMITTED Nov 14, 16:37 IST. This is research for a second, separate project. Do not touch the SPICA repo/dir. Do not submit anything or create any team/account on the basis of this file.

**How to use this file (build worker):** the primary site list is §B Table 1 (the 9 current Artemis regions). The ephemeris recipe + unit-test reference values are §C. The second-project rule answer is §D. Anything marked UNVERIFIED must not go into the app as fact.

**Longitude convention used throughout:** degrees east, range −180…+180 (east positive). Where a source gives 0…360°E, the converted value is shown (e.g. 222.8066°E = −137.1934°).

---

## A. The challenge — official statement + resources

### A1. Identity of the challenge

- **Display title:** "Lunar Landing Site Navigator"
- **Official API title (the name in NASA's own challenge data):** "CLPS Lunar Mission Browser", challenge CH-04.
  - The Algiers local-event mirror states its challenge list was "fetched from the official NASA Space Apps API on 2026-10-10" and lists this challenge as "CLPS Lunar Mission Browser" with the identical description text. Multiple other local-event mirrors (Kandy, Seoul, Ulaanbaatar, UAE) also use "CLPS Lunar Mission Browser" as the title. The Sonoma/Rohnert Park mirror and HackAthlone use the display title "Lunar Landing Site Navigator". Both names refer to the same challenge — use "Lunar Landing Site Navigator" as the project title and note the API name in the submission's data/sources section.
  - https://nasa-space-app-algiers.vercel.app/
  - https://www.nasaspaceapps.lk/challenges
  - https://nasaspaceappskr.org/2026/en/
  - https://www.spaceappsulaanbaatar.com/challenges
  - https://nasaspaceapps.ae/challenges
- **Difficulty:** Intermediate / Advanced. **Subjects:** Human Exploration · Moon · Software · Space Exploration.
  - https://edeon.sonoma.edu/nasaspaceapps-26/
  - https://hackathlone.com/challenges

### A2. Official summary (verbatim, confirmed identically across 4+ independent mirrors)

> "Missions to the Moon's south pole face extreme lighting and communication constraints, and planning them takes careful coordination between science and engineering teams. Tools for determining Sun and Earth positions at candidate landing sites exist, but their complicated interfaces make it difficult to evaluate critical information with efficiency. Your challenge is to create an intuitive tool or application that lets mission planners, educators, and the public compare landing sites and dates quickly, visualizing Sun and Earth positions relative to the horizon to assess power generation potential and direct-to-Earth communication windows."

Sources for the verbatim text:
- https://edeon.sonoma.edu/nasaspaceapps-26/
- https://hackathlone.com/challenges
- https://nasa-space-app-algiers.vercel.app/
- https://nasaspaceapps.ae/challenges

### A3. What the tool must do (from the summary + Seoul/Ulaanbaatar paraphrases)

1. Compare candidate landing sites **and dates** near the lunar south pole, quickly.
2. Visualise **Sun and Earth positions relative to the horizon** at each site/date.
3. From that, let the user assess **power-generation potential** (Sun) and **direct-to-Earth communication windows** (Earth).
4. Audience: mission planners, educators, and the public — i.e. it must be intuitive, not a raw ephemeris interface.
5. Seoul mirror paraphrase: "Compare candidate landing sites and dates near the lunar south pole by showing the positions of the Sun and Earth and estimating power and communications windows." — https://nasaspaceappskr.org/2026/en/

### A4. ⚠️ Full statement / official data-resource links — NOT directly verified

**The official challenge page could NOT be read from this VM.** `browser.open` on `https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/` failed twice on 2026-11-14 (network/DNS error, no HTTP status returned). The challenges index on the same domain failed the same way. Do not treat this as "the site is down" — it is a VM-egress limitation; the parent should re-check the live page.

What the mirrors establish about timing:
- Challenge summaries published Sep 17, 2026; **full challenge statements published Oct 28, 2026**; "Data and resources for every challenge" out Fri Nov 13, 2026.
  - https://hackathlone.com/challenges
  - https://nasa-space-app-algiers.vercel.app/
  - https://github.com/rikepilb/crafterwiki/blob/HEAD/hack-plan/nasa-space-apps-2026/01-recon.md
- An independent 2026 entrant's public build notes confirm the full statement date (Oct 28, 2026) and describe the same task (compare south-pole sites/dates; Sun/Earth vs local terrain horizon; illumination fraction; solar-power potential; DTE windows), with canonical dev sites Shackleton Connecting Ridge, Malapert Massif, Mons Mouton.
  - https://github.com/hamzaslam1996/lunarwindow/blob/HEAD/CLAUDE.md

**Therefore: the challenge's own "Objectives" and "Data/Resources" sections (beyond the summary above) are UNVERIFIED in this pass.** The resource list in §A5 is NOT the official challenge resource list — it is a set of real NASA/planetary resources verified live on 2026-11-14 that the app can legitimately cite as its data sources. The parent/build worker should cross-check them against the official challenge page when it is reachable.

### A5. Verified-live data resources the app can cite (all checked 2026-11-14)

| Resource | What it is | URL |
|---|---|---|
| NASA LRO Data Products | LRO mission data hub; links QuickMap, LROC products, "Where is LRO?" | https://science.nasa.gov/mission/lro/data-products/ |
| LROC Featured Sites | Interactive LRO Camera sites incl. 21st-century landing sites | http://lroc.sese.asu.edu/featured_sites |
| LPI Lunar Data Guides | Moon Trek, QuickMap, lunar images/maps (Lunar & Planetary Institute) | https://www.lpi.usra.edu/exploration/education/hsResearch/lunar_data/ |
| NASA Lunar Surface Data Book (ACD-50044, Rev A, May 2023) | LRO/LOLA/LROC data sources, illumination maps, LOLA illumination analysis, Earthshine maps (NTRS PDF) | https://ntrs.nasa.gov/api/citations/20230007818/downloads/ACD-50044%20Lunar%20Surface%20Data%20Book%20Rev%20A.pdf |
| NASA Artemis III landing-regions update (Oct 28, 2024) | The 9 current candidate regions (see §B) | https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/ |
| NAIF PCK pck00010.tpc | IAU lunar pole/rotation/nutation constants used by the ephemeris (§C); fetched via curl from this VM 2026-11-14 | https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00010.tpc |
| astronomy-engine (npm, MIT) | JS ephemeris library used by the ephemeris (§C); v2.1.19, install verified from this VM | https://github.com/cosinekitty/astronomy#readme |

UNVERIFIED (not re-checked from this VM in this pass — do not cite as a link until checked): JPL Horizons ephemeris system; LROC QuickMap direct URL; Moon Trek direct URL; USGS Astrogeology Moon map service. The LRO Data Products page above is the verified gateway to QuickMap.

---

## B. Candidate landing sites with published coordinates

### B1. The two NASA lists (read this first — the 13 became 9)

- **Aug 19, 2022 — 13 candidate regions** (NASA). Each ~15×15 km, all within 6° of the south pole; each contains sites with continuous sunlight through a 6.5-day surface stay. Names: Faustini Rim A, Peak Near Shackleton, Connecting Ridge, Connecting Ridge Extension, de Gerlache Rim 1, de Gerlache Rim 2, de Gerlache-Kocher Massif, Haworth, Malapert Massif, Leibnitz Beta Plateau, Nobile Rim 1, Nobile Rim 2, Amundsen Rim.
  - https://scitechdaily.com/NASA-identifies-lunar-landing-sites-for-next-Americans-on-moon/
  - https://www.gktoday.in/nasas-moon-landing-sites-for-artemis-iii-mission/?amp=1
  - **NASA published no centre coordinates for the 13 regions** — they are areas, not points. Any single lat/lon for a 2022 region is a representative point from later literature, not a NASA-published centre. Label such points accordingly.
- **Oct 28, 2024 — 9 refined regions (NASA Release 24-136, current list).** Five kept from 2022, four added; assessed for science value and mission availability. In no priority order: Peak near Cabeus B, Haworth, Malapert Massif, Mons Mouton Plateau, Mons Mouton, Nobile Rim 1, Nobile Rim 2, de Gerlache Rim 2, Slater Plain.
  - https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/
  - https://www.prnewswire.com/news-releases/nasa-provides-update-on-artemis-iii-moon-landing-regions-302288659.html
  - Down-selection documented in: George et al., "Artemis III Site Selection Update: Down-Selection from 13 to 9 Candidate Regions", 57th LPSC (2026) abstract 1901 — https://epizodyspace.ru/bibl/inostr-yazyki/Lunar_and_Planetary_Science/2026/George_et_al_Artemis_III_Site_Selection_Update_57th_LPSC_no_1901_(2026).pdf (surface stay varies ~5.75–6.25 days depending on mission epoch).
- **2026 re-plan note:** NASA's Feb 2026 architecture update makes Artemis III a low-Earth-orbit rendezvous test (2027) and moves the first crewed landing to Artemis IV (target 2028). The 9 regions "remain the only published reference set" for the landing.
  - https://arxiv.org/html/2610.34554v1
  - https://orbitcodex.com/knowledge-base/lunar-south-pole
  - https://thespaceroad.com/articles/why-artemis-is-going-to-the-moon-south-pole/

### B2. Table 1 — PRIMARY SITE LIST: the 9 current (Oct 2024) Artemis regions

Coordinates are the "approximate coordinates" published with NASA's Oct 28, 2024 announcement, as tabulated in Bian et al. 2025, Table 4. **Caveat: the Bian et al. paper is a pre-print (Preprints.org, posted Nov 20, 2025, doi 10.20944/preprints202511.1488.v1) — NOT peer-reviewed.** Its Table 4 explicitly attributes the coordinates to "NASA, 2024". Treat these as region-centre approximations, not landing ellipses.

| # | Region (NASA Oct 2024 name) | Lat (°) | Lon (°E) | Source |
|---|---|---|---|---|
| 1 | Peak Near Cabeus B | −83.661 | −69.014 | https://www.preprints.org/frontend/manuscript/571f3d7ec0e372983396865e64096f66/download_pub (Table 4) |
| 2 | Haworth | −86.753 | −22.836 | same |
| 3 | Malapert Massif | −85.990 | −0.125 | same |
| 4 | Mons Mouton Plateau | −84.232 | 29.926 | same |
| 5 | Mons Mouton | −85.423 | 31.586 | same |
| 6 | Nobile Rim 1 | −85.431 | 37.241 | same |
| 7 | Nobile Rim 2 | −83.963 | 58.654 | same |
| 8 | de Gerlache Rim 2 | −88.225 | −65.421 | same |
| 9 | Slater Plain | −87.149 | 126.134 | same |

Region list (names only) cross-checked against NASA's own release:
- https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/

### B3. Table 2 — EXTRA SITES (published points, label by type in the UI)

Use these to reach ~13 sites. **Each is a specific published point (PSR centre, illumination-study spot, or crater feature) — NOT a region centre.** Say so in the app.

| Site | Lat (°) | Lon (°E) | What the point is | Source |
|---|---|---|---|---|
| Connecting Ridge CR1 (spot 1) | −89.4395 | 222.8066 (= −137.1934) | Illumination-study spot, 2 m above ground (Gläser et al. 2014); see §B4 for its published illumination % | https://elib.dlr.de/id/eprint/94242/contents |
| Shoemaker PSR | −88.0517 | 45.4880 | Centre of the water-ice-bearing PSR in Shoemaker crater (Lemelin et al. 2021, Table 2). Crater centre itself is −88.026, 45.279 (PMC exosphere PSR table) | https://iopscience.iop.org/article/10.3847/PSJ/abf3c5 ; https://pmc.ncbi.nlm.nih.gov/articles/PMC8098081/ |
| Sverdrup PSR ("Sverdrup 1") | −88.2432 | −143.9156 | PSR centre (Lemelin et al. 2021). Crater centre −88.249, 216.455°E (= −143.545°) per PMC table | https://iopscience.iop.org/article/10.3847/PSJ/abf3c5 ; https://pmc.ncbi.nlm.nih.gov/articles/PMC8098081/ |
| Faustini Rim A PSR | −87.146 | 84.075 | PSR centre; two independent papers agree exactly (PSJ 2024 Table 2; PMC exosphere Table A2) — verified live 2026-11-14/15 (Step 3 log): PSJ 2024 Table 2 row SP_871460_0840750, 663.959 km², rank 3; PMC Table A2 rank 3, 663.93 km², same centre. Note: Lemelin et al. 2021 Table 2 lists a "Faustini" PSR at −87.1557, 84.0797 — ~0.01° (~300 m) from the PSJ/PMC point, a different centroid of the same ~664 km² PSR; the app uses the PSJ 2024/PMC point. | https://iopscience.iop.org/article/10.3847/PSJ/ad1b50/pdf ; https://pmc.ncbi.nlm.nih.gov/articles/PMC8098081/ |
| Wiechert J PSR | −85.0288 | −140.3766 | PSR centre (Lemelin et al. 2021) | https://iopscience.iop.org/article/10.3847/PSJ/abf3c5 |
| Haworth PSR | −87.5109 | −2.2324 | PSR centre (Lemelin et al. 2021). Differs from the Haworth *region* centre in Table 1 (−86.753, −22.836) — different points, both published | https://iopscience.iop.org/article/10.3847/PSJ/abf3c5 |
| Amundsen Rim PSR | −84.238 | 66.938 | PSR centre in the Amundsen Rim 2022 region (PSJ 2024, Table 2) | https://iopscience.iop.org/article/10.3847/PSJ/ad1b50/pdf |
| Nobile Rim 2 PSR | −83.813 | 57.177 | PSR centre (PSJ 2024, Table 2); near the Table 1 region centre (−83.963, 58.654) | https://iopscience.iop.org/article/10.3847/PSJ/ad1b50/pdf |
| de Gerlache Rim 2 PSR | −88.161 | 305.936 (= −54.064) | PSR centre (PSJ 2024, Table 2). ~11° of longitude from the Table 1 region centre (−88.225, −65.421) — same named region, different published points; flag in UI | https://iopscience.iop.org/article/10.3847/PSJ/ad1b50/pdf |
| Malapert Massif PSR | −86.357 | 1.286 | PSR centre (PSJ 2024, Table 2); near the Table 1 region centre | https://iopscience.iop.org/article/10.3847/PSJ/ad1b50/pdf |

**Recommended app list (13):** the 9 Table 1 regions + Connecting Ridge CR1 + Shoemaker PSR + Sverdrup PSR + Faustini Rim A PSR. (Wiechert J / Haworth PSR / Amundsen PSR are spares.)

### B4. Published per-site illumination numbers (EMBEDDABLE — the big win)

No published per-site horizon-mask/illumination table exists for all 9 regions. But these published numbers CAN be embedded:

- **Connecting Ridge CR1 (Gläser et al. 2014, EPSC Abstracts, DLR)** — accumulated illumination over 20 years: spot 1 (89.4395°S, 222.8066°E, 2 m above ground) **88.1%** illuminated, longest continuous darkness **4.58 days**, longest continuous light 233.87 days; spot 2 (2 m) 87.9%; spot 3 (10 m) **92.5%**; spot 4 (10 m) 91.9%. "A lander or rover landing at CR1 will benefit from excellent illumination conditions."
  - https://elib.dlr.de/id/eprint/94242/contents
  - Paper-internal note (Step 3 log, 2026-11-14/15): the methods text says the simulation period "is 19 years exceeding the lunar precessional cycle of 18.6 years", while the figure captions say "over 20 years". The app follows the figure captions ("20 years").
- **Mazarico et al. 2011 (Icarus 211, 1066–1081)** — average illumination over a full 18.6-year precession cycle at 240 m/pix; the south-pole site #1 is illuminated **89% of the time**. (Cited in the LRO status deck; the paper itself is the canonical illumination reference.)
  - https://ntrs.nasa.gov/api/citations/20205009660/downloads/Mike%20Barker_%20Paper_%20Improved%20Lola.pdf (Barker et al., builds on Mazarico et al. 2011)
  - https://docslib.org/download/7352121/lro-is-nominal-instruments-are-nominal-lro-operations-team-and-instrument-operations-teams-are-exceptional-3-039-days-of-lunar-science-103-lunar-days (LRO deck citing Mazarico Table 3: "site #1 in the South is illuminated 89% of the time")
- **General polar bound (use in UI copy):** the Moon's axial tilt is only 1.54°, so at the poles the Sun never rises more than 1.54° above the horizon or drops more than 1.54° below it.
  - http://explainingscience.org/2025/06/26/artemis/
  - (Axial tilt 1.5424° to the ecliptic is also the standard tabulated value.)

### B5. Discrepancies / do-not-use

- **Malapert longitude:** Table 1 says −0.125° (Bian/NASA 2024). A low-quality content-farm page claims Malapert at 2.93°E (and Peak Near Shackleton at 89.78°S, 129.20°E; Connecting Ridge at 89.45°S, 137.31°W). **Do not use the farm's numbers.** The Peak Near Shackleton coordinate (89.78°S, 129.20°E) is therefore UNVERIFIED — do not include that site unless cross-checked elsewhere.
  - Farm page (do not cite as a source): https://hot.sitemirror.store/artemis-3-lunar-landing-site-coordinates/
- **de Gerlache Rim 2:** region centre (−88.225, −65.421) vs PSR centre (−88.161, −54.064) vs Flahaut et al. ROI "North de Gerlache" (−87.9, −65.1). All published, different points. Use the Table 1 centre as the site and note the PSR separately if shown.
  - https://oro.open.ac.uk/66918/10/R2_all%20changes%20acceptedv21%20%28002%29.pdf (Flahaut et al. 2020 ROI paper)
- **Sverdrup:** crater centre −88.249, 216.455°E (PMC) vs PSR "Sverdrup 1" −88.2432, −143.9156 (Lemelin). 216.455°E = −143.545°; the two points are ~0.4° apart — consistent within feature size, but they are different features (crater vs PSR). Label correctly.
- **Shackleton rim / Connecting Ridge Extension / de Gerlache Rim 1 / de Gerlache-Kocher Massif / Leibnitz Beta Plateau:** 2022-region names with **no sourced centre coordinate in this pass**. Do not add them as sites without a sourced point. (Leibnitz Beta Plateau PSR centre −85.219, 33.82 exists in PSJ 2024 Table 2 — a PSR point, usable as a labelled PSR site if wanted.)

---

## C. Ephemeris approach (RECOMMENDED — verified on this VM, 2026-11-14)

### C1. Recommendation

**Use astronomy-engine v2.1.19 (MIT) for the geocentric ephemeris + a small custom selenographic transform using the IAU lunar rotation model (NAIF PCK constants incl. nutation). Do NOT implement Meeus from scratch and do NOT use astronomy-engine's `Horizon()` for the Moon.**

Why:
- `npm install astronomy-engine@2.1.19` works from this VM (registry reachable; installed and ran in `/tmp/astro-test` on 2026-11-14). Node v24.22.1, npm 10.9.4. Zero-dependency, MIT, browser + Node builds.
  - Docs/homepage: https://github.com/cosinekitty/astronomy#readme
  - Tarball: https://registry.npmjs.org/astronomy-engine/-/astronomy-engine-2.1.19.tgz
- **Critical API gotcha (verified):** in v2.1.19, `Astronomy.Horizon(date, observer, ra, dec, refraction)` takes **Earth-equatorial RA/Dec** — there is no Body overload. Feeding it the Sun's RA/Dec gives altitudes in Earth's equatorial frame, which are meaningless on the Moon (test: it returned Sun alt 23.4° at Malapert, where the true value is within ±5.5°). The app must do its own horizon transform in selenographic coordinates. `GeoVector`, `Ecliptic`, `Illumination`, and `Libration` work as documented.
- The custom transform is ~60 lines: IAU pole (RA 269.9949°, Dec 66.5392°) + prime meridian W = 38.3213° + 13.17635815°/day + the 13-term nutation series (coefficients in the PCK file), build the body-fixed basis, rotate the selenocentric Sun/Earth vectors, then standard alt/az from the observer's local up/north/east.
  - Constants source (fetched via curl from this VM 2026-11-14): https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00010.tpc — `BODY301_POLE_RA = (269.9949, 0.0031, 0)`, `BODY301_POLE_DEC = (66.5392, 0.0130, 0)`, `BODY301_PM = (38.3213, 13.17635815, -1.4D-12)`, plus `BODY301_NUT_PREC_RA/DEC/PM` 13-term coefficient lists.
  - IAU WGCCRE reports: https://pubs.usgs.gov/publication/70031053 (2006, doi 10.1007/s10569-007-9072-y) and https://pubs.usgs.gov/publication/70157540 (2009, doi 10.1007/s10569-010-9320-4). The PCK notes the IAU orientation models are claimed accurate to 0.1°.
  - ⚠️ The 13 nutation *angles* (E1…E13, linear functions of days since J2000) were taken from the IAU WGCCRE 2009 report as reproduced in standard references — **VERIFIED 2026-11-14/15 (Step 3 log): all 13 base values and rates re-read from the live PCK file (`BODY3_NUT_PREC_ANGLES`, rates in deg/century ÷ 36525) and match `ephemeris.js` exactly (base diff 0.0000, rate diff ≤3.6e-15 deg/day).** The PCK is now the primary source for the angle table; cite it, not this file.

### C2. Verification performed on this VM (2026-11-14, `/tmp/astro-test`)

The transform was validated against an **independent** check: astronomy-engine's own `Libration(date)` (sub-Earth point, computed by the library's internal lunar theory).

| Check | Result |
|---|---|
| Sub-Earth point (my IAU+nutation transform) vs `Astronomy.Libration()` | Worst angular separation **0.029°** across the 7 test instants (2026-06-15T00:00Z, 2026-11-09T07:02Z, 2026-11-14T12:00Z, 2026-11-15T12:00Z, 2026-11-24T14:53Z, 2026-12-01T00:00Z, 2027-01-20T00:00Z): latitude ≤0.028° (max 0.0272° at 2026-12-01), longitude ≤0.013° (max 0.0127°). Re-measured 2026-11-14/15 (Step 3 log) — the earlier "0.027°" figure understated the worst case by 0.002°. The test tolerance (≤0.03° per component) still holds. |
| Mean-pole model WITHOUT nutation (earlier attempt) | Latitude error up to **1.6°** — nutation terms are mandatory, not optional. |
| `npm view astronomy-engine` | version 2.1.19, license MIT, registry reachable. `npm install astronomy-engine@2.1.19` succeeded. |
| Full-Moon illumination cross-check | 99.81% at 2026-11-24T14:53Z; 0.19% at new Moon 2026-11-09T07:02Z. |

**Expected accuracy to claim in the UI:** Sun/Earth alt-az **±0.1° geometry** (validated 0.03° vs the library's own model; absolute accuracy limited by astronomy-engine's lunar theory, arcminute-level). **Required UI caveat (verbatim suggestion):** "Computed Sun/Earth positions, ±0.1° geometry. Flat-horizon model — no terrain shadowing: real ridges and crater rims can hide the Sun/Earth near the horizon. Planning aid only, not for flight decisions."

### C3. Reference values for unit tests (ALL computed on this VM 2026-11-14 with the §C1 stack)

Times are UTC. Observer: Malapert Massif (−85.990, −0.125) unless stated. Azimuth: degrees from north, eastward. These are COMPUTED values (label them so in tests), each with an independent cross-check in the right-hand column.

| # | Test | Expected value (computed) | Independent cross-check |
|---|---|---|---|
| R1 | Moon illumination at full Moon, 2026-11-24T14:53:00Z | **99.81%** (`Illumination(Moon)`) | Full Moon Nov 24, 2026, 14:53 UTC per USNO-based tables (see §C4). Some sources give 14:54 — 1-minute spread; assert illumination >99.5%, not the exact minute. |
| R2 | Malapert, 2026-11-24T14:53:00Z (full Moon) | Sun alt **+5.53°**, az 357.6°; Earth alt **+10.47°**, az 357.6° | Sun alt ≈ theoretical polar max 90−85.99+1.54 = **5.55°** (axial-tilt bound, §B4). Earth alt ≈ 90−\|−85.99−(−6.44 sub-Earth lat)\| = **10.44°** (sub-Earth lat −6.44° from `Libration()` at that instant). Both agree to ~0.03°. |
| R3 | Malapert, 2026-11-14T12:00:00Z (hackathon day 1) | Sun alt **−0.49°**, az 120.7°; Earth alt **+0.13°**, az 358.2° | Edge case: Sun just below horizon, Earth just above it. Good boundary test (sign flips within hours). |
| R4 | Malapert, 2026-11-15T12:00:00Z (hackathon day 2) | Sun alt **+0.28°**, az 108.5°; Earth alt **+1.30°**, az 356.8° | Sun just above horizon — the day-1→day-2 flip. |
| R5 | Malapert, new Moon 2026-11-09T07:02:00Z | Illumination **0.19%**; Sun alt **−2.46°** (dark); Earth alt **−2.48°** (below horizon) | New Moon Nov 9, 2026, 07:02 UTC (see §C4). Near side dark at new Moon — Sun and Earth both down is the correct qualitative behaviour at this date. |
| R6 | Sun-alt sweep, Malapert, Nov 2026 (6-hourly) | min **−2.47°**, max **+5.53°** | Must stay inside the polar bound ±(90−85.99+1.54) = **±5.55°**. Assert `−5.6 < alt < +5.6` over any month. |
| R7 | Earth-alt range, daily noon, Nov 2026 | Malapert **−2.53°…+10.50°**; de Gerlache Rim 2 **−5.89°…+7.30°**; Slater Plain **−8.08°…+4.70°**; Peak near Cabeus B **−4.62°…+9.13°**; Nobile Rim 1 **−2.75°…+9.98°** | Theory: 90−\|lat\| ± ~7° libration (e.g. Malapert 4.01 ± 7). **Key app insight: Earth SETS at the highest-latitude sites** (Slater Plain Earth is below the horizon part of the month). Assert min < 0 < max for Slater Plain. |
| R8 | Connecting Ridge CR1 (−89.4395, −137.1934), 2026-11-14T12:00:00Z | Sun alt **+1.44°**, az 257.7°; Earth alt **−4.27°**, az 135.3° | Earth below horizon at the most poleward site — consistent with the independent (third-party) EXAX audit finding Earth hidden ~35% of the time at Connecting Ridge. https://www.exax.de/site-south.html (third-party audit, not NASA — cite as corroboration only). |

### C4. Reference facts behind the tests (independently sourced)

- **Full Moon Nov 2026: Tuesday Nov 24, 2026, 14:53 UTC** (Beaver Moon; supermoon). Sources agree on the date; the minute is 14:53 (USNO table via universaltimedate; also 14:53 in two other tables) vs 14:54 (spaceweathertracker, cyclecalcs, supernova-tribune). Treat 14:53–14:54 as a 1-minute uncertainty band.
  - https://www.universaltimedate.com/articles/november-2026-moon-phases
  - https://www.spaceweathertracker.com/calendar/november-2026
  - https://www.cyclecalcs.com/full-moon-calendar.html
- **New Moon Nov 2026: Nov 9, 2026, 07:02 UTC** (USNO-based tables; one source, playeye.io, gives 07:03 — a 1-minute spread, same as the full Moon's 14:53 vs 14:54; tests assert illumination only, not the exact minute).
  - https://www.spaceweathertracker.com/calendar/november-2026
  - https://www.universaltimedate.com/articles/november-2026-moon-phases
  - https://starwalk.space/en/news/full-moon-november
  - https://spaceandtelescope.com/moon-phase-today/
- **Earth's near-fixed position + libration:** the Moon is tidally locked, so Earth does not rise or set as seen from most of the near side — it hangs near a fixed point set by the observer's coordinates (directly overhead at 0°N 0°E, on the horizon ~90° away), wobbling with libration. Total libration effect **~±7°** (Rice Univ.); longitude libration max **7°45′**, latitude libration **±7°41′**, so Earth traces an approximate **18°-diameter oval** in the lunar sky over a month (Safonova et al.).
  - https://sparky.rice.edu/~hartigan/public-night/libration.html
  - https://arxiv.org/pdf/1410.3266 (Safonova et al., LUCI lunar-UV paper)
  - https://lunaracre.com/can-you-buy-land-on-the-moon (plain-language statement of the fixed-point geometry; commercial site, corroboration only)
- **Moon axial tilt 1.54°** (see §B4).

### C5. Terrain shadowing — out of scope unless noted

Real terrain shadowing (per-site horizon masks ray-marched from LOLA DEMs) is **out of scope for a one-day build**: no published embeddable per-site horizon/illumination table exists for all 9 regions. The closest published per-site numbers are the Gläser CR1 values (§B4) — embed those for Connecting Ridge only, labelled as published 20-year averages. A full DEM approach would need LOLA polar DEMs + SPICE (DE440 + moon_pa) + ray-marching; an independent entrant's public notes describe exactly that stack (SPICE via spiceypy, LOLA GeoTIFFs) as a multi-phase build — not a one-day job.
- https://github.com/hamzaslam1996/lunarwindow/blob/HEAD/CLAUDE.md
- Goldstone radar DEM horizon-mask precedent (shows the method exists, not a usable table): https://tda.jpl.nasa.gov/progress_report/42-176/176C.pdf
- LOLA illumination analysis background: https://ntrs.nasa.gov/api/citations/20230007818/downloads/ACD-50044%20Lunar%20Surface%20Data%20Book%20Rev%20A.pdf

---

## D. Second team / second project rule (2026)

### D1. Answer in one paragraph

**Under the 2026 rules, one participant = one team = one challenge. Ronit is already on Team SPICA (submitted Nov 14), so he CANNOT also be on a second team or submit a second project under his own account in this event.** A second project would need a different person as the team owner/member (e.g. Anshul or Udita as a solo team in the same Universal Event), with Ronit not listed as a member — and even then, presenting Ronit's build as that person's project would be an authorship problem (see §D3). **Do not block the build on this** — build the app; decide the submission route with the parent afterwards.

### D2. Evidence

2026 local-event FAQs restating the official rules (three independent 2026 sources, same wording):

- Calgary (Eventbrite, official local event): "A Local Event team can be just one person, and teams can have up to six members. All teammates must be registered for the Calgary event, and **you can only be on one team, working on one challenge**."
  - https://www.eventbrite.com/e/nasa-space-apps-challenge-calgary-2026-tickets-2003695688743
- iCodejr (Dubai, 2026): "**You can be on one team, and each team works on one challenge.** Everyone joins the same Local Event."
  - https://icodejr-space-apps-2026.vercel.app/
- Thessaloniki/Piraeus team-formation FAQ (Instagram, Sep 20, 2026): "**members can only join one team. Each team may select only one challenge** and all members must register for the same Local Event."
  - https://www.instagram.com/p/DdgSn4gmzwq/
- Independent 2026 rules summary: "One person, one team. One team, one challenge." / "Teams are capped at six members, all registered for the same event."
  - https://github.com/rikepilb/crafterwiki/blob/HEAD/hack-plan/nasa-space-apps-2026/01-recon.md
  - https://github.com/rikepilb/spaceapps-flightdeck/blob/HEAD/plugins/spaceapps-harness/skills/spaceapps-brief/SKILL.md (as returned by search; the skill file itself was not opened — treat as secondary)

Contrast — the OLD rule (superseded, do not rely on it): the official 2017 FAQ said "Can I join more than one team? **Yes, participants can join one team per challenge**" and "A person can be a full participant on one team per challenge." That is the pre-2026 rule; the 2026 local-event FAQs above state the stricter one-team rule.
- https://2017.spaceappschallenge.org/frequently-asked-questions

Related mechanics (official site, via search snippets — the site itself was unreachable from this VM, see §D3 caveat):
- Teams are 1–6 participants; all members must be registered for the same Local Event (Universal Event in Ronit's case); you can choose or change your team up until the hackathon closes on Nov 15; projects are submitted through the team's project page; submission window Nov 14, 09:00 – Nov 15, 23:59 local time.
  - https://www.spaceappschallenge.org/2026/?utm_source=chatgpt.com (official 2026 page, via search result)
  - https://astroverse.in/nasa-hackathon (2026 rules summary: "A team can have between 1 and 6 participants… All members of a team must be registered for the same Local Event")

### D3. What a second submission would need — and the caveats

1. **A different account holder as team lead:** the second team would have to be created/owned by someone other than Ronit (Anshul or Udita), in the same Universal Event, with Ronit NOT a member. No second account for Ronit (creating a duplicate account to evade the one-team rule would breach the rules and risk disqualification of both projects — do not do it).
2. **Authorship problem (parent's judgment call, not resolved here):** if Ronit (or his agent) builds the whole app, submitting it under another person's name misrepresents who did the work. The honest routes are: (a) the other person genuinely leads/builds it with Ronit advising, or (b) don't submit it as a Space Apps project at all — ship it as a public portfolio/educational tool. This file takes no position beyond flagging it; do not engineer around it.
3. **Leaving SPICA is not a viable path:** SPICA is already submitted (Nov 14, 16:37 IST, Ronit + Anshul). Team changes are allowed until the hackathon closes, but abandoning a submitted project to join a different team would leave SPICA's submission in limbo and is not recommended; the one-team rule is about concurrent membership in any case.
4. **⚠️ Verification caveat:** the official 2026 Project Submission Guide and Judging & Awards Guide text itself was **NOT re-read from spaceappschallenge.org in this pass** — the domain is unreachable from this VM (see §A4). The one-team rule above rests on three independent 2026 local-event FAQs restating official rules, which is strong but not the guide text itself. **The parent must confirm the exact wording on the live official site (Participant FAQs: https://www.spaceappschallenge.org/resources/participant-faqs/ — URL as cited in the 2026 recon notes, not re-verified live) before acting on §D.** Do not submit anything on the basis of this section alone.

---

## E. Gaps and UNVERIFIED items (do not present as fact)

1. **Official challenge Objectives + Data/Resources sections** — not read (site unreachable from VM). See §A4.
2. **Official 2026 Submission Guide / Judging & Awards Guide wording** on second teams — not read directly. See §D3.4.
3. **Peak Near Shackleton coordinate** (89.78°S, 129.20°E) — only on a low-quality farm page; UNVERIFIED, excluded from the site list.
4. **Centre coordinates for the 13 (2022) regions** — NASA never published point centres; only the 9 (2024) approximate centres are sourced (§B2).
5. **Nutation angles E1…E13** in §C1 — ~~from the IAU WGCCRE 2009 report as reproduced in standard references; validated empirically to 0.027° against astronomy-engine, but not re-read from the primary report in this pass~~ **CLOSED 2026-11-14/15 (Step 3 log): all 13 angles re-read from the live PCK file and match `ephemeris.js` exactly.**
6. **Per-site illumination % for the 9 regions** — no published table found; only CR1 (Gläser) and the Mazarico 89% figure exist. Do not invent percentages for the other sites; the app should compute Sun-up fraction from its own ephemeris and label it "computed, flat horizon".
7. **Full-Moon minute** — 14:53 vs 14:54 UTC Nov 24, 2026 (1-minute spread across sources). Tests should assert illumination >99.5%, not the exact minute. **Same 1-minute spread for the new Moon** (07:02 vs 07:03; Step 3 log).
8. **LROC QuickMap / Moon Trek / JPL Horizons direct links** — not re-verified live in this pass; use the LRO Data Products gateway (§A5) as the cited entry point.

---

## F. Source index (every URL used)

Challenge & event: https://edeon.sonoma.edu/nasaspaceapps-26/ · https://hackathlone.com/challenges · https://nasa-space-app-algiers.vercel.app/ · https://www.nasaspaceapps.lk/challenges · https://nasaspaceappskr.org/2026/en/ · https://www.spaceappsulaanbaatar.com/challenges · https://nasaspaceapps.ae/challenges · https://www.spaceappschallenge.org/2026/?utm_source=chatgpt.com · https://astroverse.in/nasa-hackathon · https://github.com/rikepilb/crafterwiki/blob/HEAD/hack-plan/nasa-space-apps-2026/01-recon.md · https://github.com/hamzaslam1996/lunarwindow/blob/HEAD/CLAUDE.md

Artemis regions: https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/ · https://www.prnewswire.com/news-releases/nasa-provides-update-on-artemis-iii-moon-landing-regions-302288659.html · https://www.preprints.org/frontend/manuscript/571f3d7ec0e372983396865e64096f66/download_pub · https://scitechdaily.com/NASA-identifies-lunar-landing-sites-for-next-Americans-on-moon/ · https://www.gktoday.in/nasas-moon-landing-sites-for-artemis-iii-mission/?amp=1 · https://epizodyspace.ru/bibl/inostr-yazyki/Lunar_and_Planetary_Science/2026/George_et_al_Artemis_III_Site_Selection_Update_57th_LPSC_no_1901_(2026).pdf · https://arxiv.org/html/2610.34554v1 · https://orbitcodex.com/knowledge-base/lunar-south-pole · https://thespaceroad.com/articles/why-artemis-is-going-to-the-moon-south-pole/

Illumination & PSRs: https://iopscience.iop.org/article/10.3847/PSJ/ad1b50/pdf · https://beta.iopscience.iop.org/article/10.3847/PSJ/ac88c2/pdf · https://elib.dlr.de/id/eprint/94242/contents · https://iopscience.iop.org/article/10.3847/PSJ/abf3c5 · http://luna1.diviner.ucla.edu/~dap/pubs/107.pdf · https://pmc.ncbi.nlm.nih.gov/articles/PMC8098081/ · https://ntrs.nasa.gov/api/citations/20205009660/downloads/Mike%20Barker_%20Paper_%20Improved%20Lola.pdf · https://docslib.org/download/7352121/lro-is-nominal-instruments-are-nominal-lro-operations-team-and-instrument-operations-teams-are-exceptional-3-039-days-of-lunar-science-103-lunar-days · https://tda.jpl.nasa.gov/progress_report/42-176/176C.pdf · https://oro.open.ac.uk/66918/10/R2_all%20changes%20acceptedv21%20%28002%29.pdf · http://explainingscience.org/2025/06/26/artemis/ · https://www.exax.de/site-south.html (third-party, corroboration only)

Data resources: https://science.nasa.gov/mission/lro/data-products/ · http://lroc.sese.asu.edu/featured_sites · https://www.lpi.usra.edu/exploration/education/hsResearch/lunar_data/ · https://ntrs.nasa.gov/api/citations/20230007818/downloads/ACD-50044%20Lunar%20Surface%20Data%20Book%20Rev%20A.pdf

Ephemeris: https://github.com/cosinekitty/astronomy#readme · https://registry.npmjs.org/astronomy-engine/-/astronomy-engine-2.1.19.tgz · https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00010.tpc · https://pubs.usgs.gov/publication/70031053 · https://pubs.usgs.gov/publication/70157540 · https://sparky.rice.edu/~hartigan/public-night/libration.html · https://arxiv.org/pdf/1410.3266 · https://www.universaltimedate.com/articles/november-2026-moon-phases · https://www.spaceweathertracker.com/calendar/november-2026 · https://www.cyclecalcs.com/full-moon-calendar.html

Second-team rule: https://www.eventbrite.com/e/nasa-space-apps-challenge-calgary-2026-tickets-2003695688743 · https://icodejr-space-apps-2026.vercel.app/ · https://www.instagram.com/p/DdgSn4gmzwq/ · https://2017.spaceappschallenge.org/frequently-asked-questions (old rule, superseded) · https://github.com/rikepilb/spaceapps-flightdeck/blob/HEAD/plugins/spaceapps-harness/skills/spaceapps-brief/SKILL.md

Not cited as a source (low quality, discrepancy note only): https://hot.sitemirror.store/artemis-3-lunar-landing-site-coordinates/

---

## G. Step 3 verification log (2026-11-14/15)

Re-verification pass by the Step 3 research worker. Method: recomputation with the app's own `ephemeris.js` (node, astronomy-engine from `app/node_modules`), independent recomputation of the DEM checks from the raw excerpts in `raw-dem/windows/*.bin` (python, `extract_dem.py` mapping), direct file checks on the NAC JPEGs / raw PNGs / shipped GLB, and live fetches of every cited source below. Nothing under `app/src/` was edited. Full test suite re-run at the end: **150/150 green** (`npx vitest run`, 8 files).

### G1. Ephemeris — R1–R8 recomputed (all reproduce to the table's printed precision)

Observer Malapert (−85.990, −0.125) unless stated. Values below are the recomputed numbers; the table value is in brackets.

| # | Recomputed | Table | Max deviation |
|---|---|---|---|
| R1 | illumination 99.81% | 99.81% | 0.00 |
| R2 | Sun alt +5.5262°, az 357.6419°; Earth alt +10.4723°, az 357.6389° | Sun +5.53° az 357.6°; Earth +10.47° az 357.6° | alt 0.0038°, az 0.0419° |
| R3 | Sun −0.4902° az 120.6910°; Earth +0.1320° az 358.2171° | Sun −0.49° az 120.7°; Earth +0.13° az 358.2° | alt 0.0020°, az 0.0171° |
| R4 | Sun +0.2822° az 108.5366°; Earth +1.3029° az 356.8299° | Sun +0.28° az 108.5°; Earth +1.30° az 356.8° | alt 0.0029°, az 0.0366° |
| R5 | illumination 0.19%; Sun −2.4599°; Earth −2.4832° | 0.19%; Sun −2.46°; Earth −2.48° | alt 0.0032° |
| R6 | Sun sweep Nov 2026 (6-hourly): min −2.4674°, max +5.5299° | min −2.47°, max +5.53° | 0.0026° |
| R7 | Earth noon ranges: Malapert −2.5280…+10.4962°; de Gerlache −5.8925…+7.3027°; Slater −8.0842…+4.6985°; Cabeus −4.6239…+9.1287°; Nobile 1 −2.7496…+9.9838° | Malapert −2.53…+10.50°; de Gerlache −5.89…+7.30°; Slater −8.08…+4.70°; Cabeus −4.62…+9.13°; Nobile 1 −2.75…+9.98° | alt 0.0042° |
| R8 | CR1 Sun +1.4370° az 257.7130°; Earth −4.2742° az 135.2533° | Sun +1.44° az 257.7°; Earth −4.27° az 135.3° | alt 0.0042°, az 0.0467° |

**Overall max deviation: altitude 0.0042°, azimuth 0.0467°.** The azimuth deviations are exactly what the table's 0.1° azimuth rounding allows (max possible 0.05°). Two altitude values sit 0.0002° above a strict 0.004° bar (Slater R7 min −8.0842 vs −8.08; R8 Earth −4.2742 vs −4.27) — both are the table's 2-decimal rounding, not errors. **Verdict: R1–R8 VERIFIED; no data.js correction needed** (`REFERENCE_VALUES` strings match the rounded table).

Cross-checks re-run: sub-Earth latitude at full Moon (2026-11-24T14:53Z) from `Libration()` = −6.4430° (SOURCES §C3 says −6.44° ✓); polar bound 5.55° holds (R2 Sun 5.5262° < 5.56° ✓).

### G2. Libration cross-check — 0.027° claim CORRECTED

At the 7 exact test instants (2026-06-15T00:00Z, 2026-11-09T07:02Z, 2026-11-14T12:00Z, 2026-11-15T12:00Z, 2026-11-24T14:53Z, 2026-12-01T00:00Z, 2027-01-20T00:00Z):

| Instant | Ours (lat, lon) | Libration() (lat, lon) | \|Δlat\| | \|Δlon\| | Ang. sep. |
|---|---|---|---|---|---|
| 2026-06-15T00:00Z | −6.1700, +0.1590 | −6.1461, +0.1478 | 0.0239° | 0.0113° | 0.0264° |
| 2026-11-09T07:02Z | +6.4828, +4.0231 | +6.5066, +4.0116 | 0.0239° | 0.0115° | 0.0265° |
| 2026-11-14T12:00Z | +3.8760, −1.9120 | +3.8962, −1.9246 | 0.0202° | 0.0126° | 0.0238° |
| 2026-11-15T12:00Z | +2.7010, −3.2978 | +2.7210, −3.3105 | 0.0200° | 0.0127° | 0.0237° |
| 2026-11-24T14:53Z | −6.4656, −2.4616 | −6.4430, −2.4719 | 0.0227° | 0.0103° | 0.0249° |
| 2026-12-01T00:00Z | +1.3455, +6.6781 | +1.3727, +6.6685 | **0.0272°** | 0.0096° | **0.0288°** |
| 2027-01-20T00:00Z | −5.6695, −3.5007 | −5.6451, −3.5134 | 0.0244° | 0.0127° | 0.0275° |

**Max |Δlat| 0.0272°, max |Δlon| 0.0127°, max angular separation 0.0288°.** The §C2 claim "worst 0.027° / latitude ≤0.027°" understated the worst case by 0.0002° (lat) / 0.0018° (separation). **Fixed in place in §C2** (now "worst angular separation 0.029°; latitude ≤0.028°, longitude ≤0.013°"). The vitest tolerance (≤0.03° per component) still holds and the suite passes. **data.js correction still needed (parent):** `METHOD` says "matches … Libration() to ≤0.027°" — change to "≤0.03°". Same wording sits in the `ephemeris.js` header comment.

### G3. Moon phases — VERIFIED from 6+ independent sources each

- **Full Moon Nov 24, 2026, 14:53 UTC:** confirmed by universaltimedate.com (USNO primary phase table), starwalk.space, spaceandtelescope.com, pogodnik.com, cosmosdaily.co, goodtiming.chat. 14:54 appears in some tables (spaceweathertracker, cyclecalcs — per §C4); the 1-minute spread stands.
  - https://www.universaltimedate.com/articles/november-2026-moon-phases
  - https://starwalk.space/en/news/full-moon-november
  - https://spaceandtelescope.com/moon-phase-today/
  - https://pogodnik.com/en/moon_calendar
  - https://cosmosdaily.co/studies/november-2026-astrology
  - https://goodtiming.chat/blog/november-2026-astrology-calendar
- **New Moon Nov 9, 2026, 07:02 UTC:** confirmed by the same set (universaltimedate, starwalk, spaceandtelescope, pogodnik, cosmosdaily, goodtiming). **New finding: one source (playeye.io) gives 07:03 — the new Moon has the same 1-minute spread as the full Moon.** §C4 and §E.7 updated in place to record this. Tests assert illumination only, so no test change is needed.
  - https://www.playeye.io/blog/new-moon-full-moon-meaning-by-sign.html (07:03 — the outlier)

### G4. IAU constants vs live NAIF PCK — VERIFIED EXACTLY (gap §E.5 CLOSED)

Fetched live 2026-11-14: `https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00010.tpc` (HTTP 200, 126,143 bytes, direct curl from this VM — no proxy needed).
- `BODY301_POLE_RA = (269.9949, 0.0031, 0)`, `BODY301_POLE_DEC = (66.5392, 0.0130, 0)`, `BODY301_PM = (38.3213, 13.17635815, -1.4D-12)` — **identical to `ephemeris.js`**.
- `BODY301_NUT_PREC_RA/DEC/PM` — all 39 coefficients **identical to `ephemeris.js` `C_RA`/`C_DEC`/`C_PM`**.
- `BODY3_NUT_PREC_ANGLES` — all 13 (base, rate/century): base diff 0.0000; rate converted to deg/day (÷36525) matches `ephemeris.js` `NUT_ANGLES` to ≤3.6e-15 deg/day. **This closes §E.5**: the angles are now verified directly from the PCK, not from a reproduced table. §C1 ⚠️ note and §E.5 fixed in place.

### G5. Site coordinates — ALL VERIFIED LIVE

**Table 1 (9 regions) vs Bian et al. 2025 Table 4 — VERIFIED EXACTLY.** Preprint PDF fetched live (browser.open, 2026-11-14): Table 4 rows — 1 Peak Near Cabeus B −69.014, −83.661; 2 Haworth −22.836, −86.753; 3 Malapert Massif −0.125, −85.990; 4 Mons Mouton Plateau 29.926, −84.232; 5 Mons Mouton 31.586, −85.423; 6 Nobile Rim 1 37.241, −85.431; 7 Nobile Rim 2 58.654, −83.963; 8 de Gerlache Rim 2 −65.421, −88.225; 9 Slater Plain 126.134, −87.149. Every value matches SOURCES §B2 / `data.js` to all printed digits. Paper confirmed as Preprints.org, posted 20 Nov 2025, doi 10.20944/preprints202511.1488.v1, NOT PEER-REVIEWED (banner on every page).
- https://www.preprints.org/frontend/manuscript/571f3d7ec0e372983396865e64096f66/download_pub

**Region NAMES vs NASA Release 24-136 — VERIFIED EXACTLY.** Release page fetched live 2026-11-14: the nine names in "no priority order" are Peak near Cabeus B, Haworth, Malapert Massif, Mons Mouton Plateau, Mons Mouton, Nobile Rim 1, Nobile Rim 2, de Gerlache Rim 2, Slater Plain — identical to §B2 / `data.js`.
- https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/

**Extra sites — VERIFIED LIVE:**
- **Connecting Ridge CR1** (Gläser et al. 2014, DLR EPSC abstract, fetched live): spot 1 89.4395°S, 222.8066°E, 2 m, 88.1% illuminated; longest continuous darkness 4.58 d, longest light 233.87 d; spot 2 87.9%; spot 3 (10 m) 92.5%; spot 4 (10 m) 91.9%. All match §B4 / `data.js`. Paper-internal inconsistency noted in §B4: methods text says the simulation period "is 19 years", figure captions say "over 20 years"; the app follows the figures.
  - https://elib.dlr.de/id/eprint/94242/contents
- **Shoemaker PSR** (Lemelin et al. 2021, PSJ Table 2, fetched live): ID 85, −88.0517, 45.4880, 134 M3 detections — matches §B3 / `data.js` exactly. **Sverdrup 1** (same table): ID 127, −88.2432, −143.9156, 93 detections — matches exactly. Same table also verifies the spares: Haworth PSR −87.5109, −2.2324 (80 detections); Wiechert J −85.0288, −140.3766 (17); Faustini (Lemelin) −87.1557, 84.0797 (34) — see note below.
  - https://iopscience.iop.org/article/10.3847/PSJ/abf3c5
- **Faustini Rim A PSR** (Mahanti et al. 2024, PSJ Table 2, fetched live): SP_871460_0840750, −87.146, 84.075, 663.959 km², area rank 3 of 2384 — matches §B3 / `data.js` exactly. **PMC exosphere Table A2 (Prem et al. 2020, fetched live): Faustini Crater −87.146, 84.075, 663.93 km², rank 3 — the "two independent papers agree exactly" claim is CONFIRMED** (areas 663.959 vs 663.93 km² differ only by rounding). Same PSJ Table 2 also verifies: de Gerlache Rim_2 PSR −88.161, 305.936 (8.19 km²); Nobile Rim_2 PSR −83.813, 57.177; Amundsen Rim −84.238, 66.938; Malapert Massif PSR −86.357, 1.286; Leibnitz Beta plateau −85.219, 33.82. PMC Table A2 also verifies: Shoemaker crater centre −88.026, 45.279 (1075.518 km²); Sverdrup Crater −88.249, 216.455°E = −143.545° (548.791 km²).
  - https://iopscience.iop.org/article/10.3847/PSJ/ad1b50/pdf
  - https://pmc.ncbi.nlm.nih.gov/articles/PMC8098081/
- **Note (not an error):** Lemelin's "Faustini" PSR centre (−87.1557, 84.0797) is ~0.01° (~300 m) from the PSJ 2024/PMC point (−87.146, 84.075) the app uses — different centroids of the same ~664 km² PSR. The app's choice is the one two sources agree on exactly. Recorded in §B3.
- **Apollo 15 (data.js only, not in SOURCES §B):** 26.1322°N, 3.6339°E confirmed by multiple sources (incl. Smithsonian NASM: 26.13222°N, 3.63386°E); `data.js` 26.132, 3.634 ✓.
  - https://airandspace.si.edu/explore/stories/apollo-missions/apollo-15

**Per-site verdicts (b):** 9/9 Table 1 verified; CR1 verified; Shoemaker verified; Sverdrup verified; Faustini verified. **Zero mismatches, zero could-not-verify-live.**

### G6. DEM spot values — 64/65 EXACT, 1 within 0.1 m (rounding-boundary artefact, NOT an error)

Recomputed all 65 `checks.json` values independently from the raw row-band excerpts in `raw-dem/windows/*.bin`, using the `extract_dem.py` mapping (polar stereographic, `HEIGHT = DN × 0.5`, bilinear). **64/65 match exactly to 0.1 m.** The one exception:
- `mouton-plateau` S500: `checks.json` 5208.1 m vs recomputed 5208.2 m. Unrounded bilinear value is 5208.1503 m when sampled at `checks.json`'s 6-decimal lat/lon (−84.248489, 29.926) and 5208.1497 m at the exact formula lat/lon (−84.2484889431084, 29.926) — the value sits exactly on the 5208.15 rounding boundary, so a 0.0017 m lat/lon rounding flips the 0.1 m digit. The underlying heights agree to ~0.001 m and the shipped grid node itself is 5208.1 m. **No correction needed** to `checks.json` or any grid; recorded here so the parent is not surprised by a 64/65 count.

### G7. NAC texture manifest — VERIFIED (files, bboxes, means, gamma lift)

All 8 files in `app/public/terrain/nac/manifest.json` exist and are valid JPEGs, 1024×1024 RGB:
- haworth 187,112 B, mean 70.2 (manifest 70.3); malapert 233,067 B, 105.8 (105.8); mouton-plateau 220,554 B, 146.1 (146.1); mouton 256,329 B, 132.2 (132.1); nobile1 191,155 B, 119.7 (119.7); gerlache2 210,354 B, 158.2 (158.1); slater 194,852 B, 88.2 (88.1); connecting-ridge 223,911 B, 122.6 (122.7). All within 0.1 of the manifest.
- **Bboxes:** recomputed the ±600 m box from each site's `data.js` coordinates (R = 1,737,400 m): every manifest bbox centre is offset 0.0 m from its site centre; bbox edges match the recomputed box to ≤0.00016° (≈0.05 m at Connecting Ridge). **VERIFIED.**
- **Gamma 0.45 lift VERIFIED:** applying γ = 0.45 per-pixel to the raw `raw-lroc/nac1m/*.png` files reproduces the shipped JPEG means to 0.0–0.1 (e.g. Malapert raw 41.5 → lifted 105.9 vs shipped 105.8; Haworth 17.1 → 70.3 vs 70.2). The `exposure` note in the manifest is accurate.
- **Coverage claims — verified from the STAGED raw files, NOT from a fresh live WMS check:** raw PNG pixel stats recomputed locally — cabeus mean 255.0, white_frac 1.000 (all-white, no coverage); nobile2 identical (255.0, white 1.000); shoemaker mean 3.9, black_frac 0.849; sverdrup mean 2.4, black_frac 1.000; faustini mean 2.8, black_frac 0.997. The mosaic-edge claim (~−84°) is consistent with the staged data: cabeus (−83.661°) and nobile2 (−83.963°) are white while mouton-plateau (−84.232°) has real data, so the edge lies between −83.963° and −84.232°.
- **Live WMS check ATTEMPTED AND FAILED — do not claim one:** direct curl `http://wms.im-ldi.com/lroc/wms?SERVICE=WMS&REQUEST=GetCapabilities` → HTTP 000 (connection failure, 0 bytes); same via the local CONNECT forwarder (127.0.0.1:18080, started and killed per AGENTS.md) → 000; `browser.open` on the same URL → fetch timeout. This is a VM-egress limitation, not evidence the service is down — the Nov 14 provenance log (`raw-lroc/PROVENANCE.md` §1 route 2, 351 layers incl. `luna_nac_pole_control_south`, plus per-site request URLs/bboxes in `raw-lroc/nac1m/manifest.json`) is the standing evidence for the WMS route. The forwarder process was killed after use (verified 0 running).

### G8. LRV model attribution — VERIFIED (page, PR, commit, GLB)

- **Sketchfab page live** (fetched 2026-11-14): "Mondfahrzeug (Lunar Rover)" by Deutsches Museum | Digital (@deutsches-museum), "License: CC Attribution-ShareAlike", Triangles 464.1k, Vertices 244.1k, 1453 downloads, published Mar 1, 2021, Deutsches Museum Inv.-Nr. 2019-407. Matches ROVER.md (464,143 faces) and the CC-BY-SA 4.0 attribution in `data.js`/`ROVER.md`. ✓
  - https://sketchfab.com/3d-models/mondfahrzeug-lunar-rover-acb3f8645a69493cb211a62b40d66aab
- **NASA Space ROS PR #32 live** (GitHub API, 2026-11-14): state **open**, title "NASA Challenge_[@JasperGrant]_[Apollo 15 Lunar Roving Vehicle Simulation]", head `JasperGrant:summer_sprint` @ `0551f2cca567bb90811c7c214bcc542fc7a8e60d`, base `space-ros:main`, created 2024-09-10T23:58:19Z. ✓
  - https://api.github.com/repos/space-ros/simulation/pulls/32
- **JasperGrant fork commit `0551f2cc` reachable** (GitHub API): merge commit "Merge branch 'summer_sprint' … into summer_sprint", author Jasper Grant, 2024-09-11T00:06:55Z. Fork confirmed: `JasperGrant/simulation`, fork of `space-ros/simulation`. ✓
  - https://api.github.com/repos/JasperGrant/simulation/commits/0551f2cca567bb90811c7c214bcc542fc7a8e60d
- **Shipped GLB parses** (`app/public/models/lrv/lunar_roving_vehicle.glb`, 6,361,612 bytes, glTF 2.0, Khronos Blender I/O v4.2.57; 7 meshes, 12 nodes, 14 materials, 7 images): assembled world bbox (node translations applied) X 2.141 m, Y 0–1.862 m, Z 3.144 m — matches ROVER.md (~2.14 m wide, 0–1.86 m high, ~3.15 m long); body local Z extent 3.099 m ≈ 3.1 m published length; wheel local size 0.251 m wide × 0.818 m diameter (diameter matches NSSDCA 0.818 m; width 0.251 m vs NSSDCA 0.23 m — the museum mesh is ~2 cm wider, a mesh-vs-spec difference, not a data error). **Triangle count: 97,340 as rendered** (three.js scene traversal — the two wheel meshes are shared by front/rear nodes, so each is counted twice: 79,689 unique-geometry tris + 8,796 + 8,855 for the shared wheels = 97,340) — the "97,340 tris" claim matches the test's counting method; unique geometry is 79,689 tris. Node names verified: `lrv`, `body`, `steer_front`, `steer_rear`, `wheel_fl/fr/rl/rr`, `cover_L/R_F/B`; steer pivots at (0, 0.409, ±1.145). The vitest shipped-GLB test (parse + wire + tri/bbox asserts) passes as part of the 150/150 suite. ✓

### G9. Corrections made to SOURCES.md in this pass (in place, not just in this log)

1. §C2: Libration worst-case 0.027° → 0.029° (angular separation); latitude ≤0.027° → ≤0.028° (see G2).
2. §C1 ⚠️ note + §E.5: nutation angles E1–E13 now verified directly from the live PCK — the "NOT re-read from a primary source" caveat is struck (see G4).
3. §C4 + §E.7: new Moon 1-minute spread recorded (07:02 vs 07:03; see G3).
4. §B4 (Gläser): paper-internal 19-vs-20-year inconsistency noted; app follows the figure captions.
5. §B3 (Faustini): Lemelin's differing Faustini centroid (~0.01° off) noted; app uses the PSJ 2024/PMC point.

### G10. data.js corrections the parent must apply (I may not edit app/src/)

1. **`data.js` `METHOD` (and `ephemeris.js` header comment):** "matches astronomy-engine's own Libration() to ≤0.027° across 7 dates" → **"≤0.03°"** (recomputed worst per-component 0.0272° lat / 0.0127° lon; worst angular separation 0.0288°). The vitest assertion (≤0.03°) already uses the correct bound; only the prose is stale. No value in `SITES`, `REFERENCE_VALUES`, `PUBLISHED_ILLUMINATION`, or any verdict changes.
2. **No other data.js correction.** All 13 site coordinates, all R1–R8 reference strings, the CR1 illumination text (88.1% / 4.58 d / 92.5%), the NAC/terrain notes, and the LRV attribution note in `data.js` were verified against live sources or recomputation and need no change.

### G11. Open gaps / explicitly NOT verified live in this pass

- **LROC WMS live reachability (2026-11-14/15):** GetCapabilities failed three ways from this VM (direct curl 000, proxy-forwarder curl 000, browser.open timeout). Coverage claims rest on the staged Nov 14 files + provenance log, not a fresh live check. Unreachable ≠ verified; re-check from a non-VM network if a live confirmation is needed before submission.
- **Mazarico et al. 2011 89% figure:** not re-fetched live in this pass (cited via the Barker NTRS PDF / LRO deck in §B4); the app quotes it as published context only. No reason to doubt it, but it was not re-verified this pass.
- **EXAX third-party audit (R8 cross-check, §C3):** not re-checked live; it is corroboration only and the app does not depend on it.
- **Apollo 15 DTM north alignment / absolute datum:** unchanged from PROVENANCE.md — still unverified, still labelled as such in `data.js`.
