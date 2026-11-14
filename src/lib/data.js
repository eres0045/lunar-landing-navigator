/**
 * Data layer — Lunar Landing Site Navigator.
 *
 * Sites: the 9 current (Oct 2024) Artemis III regions + 4 published
 * extra points, exactly as sourced in SOURCES.md §B. Coordinates are the
 * region-centre approximations published with NASA's Oct 28, 2024
 * announcement (Bian et al. 2025, Table 4, attributing NASA 2024 — a
 * pre-print, NOT peer-reviewed) and the published PSR / illumination-
 * study points. Nothing here is invented; extras are labelled by type.
 *
 * Ephemeris: src/lib/ephemeris.js (astronomy-engine + IAU lunar rotation
 * model, ±0.1° geometry).
 *
 * Verdicts use the TERRAIN-AWARE horizon (src/lib/horizon.js): the
 * real local horizon from the LOLA DEM — local 10/20 m grid within
 * 600 m, regional 30 m DEM out to ~10 km at the 13 south-pole sites
 * (~360 m at Apollo 15), 2 m eye height. The profiles are BUNDLED
 * (src/data/horizons.json, imported below) and are the DEFAULT for
 * every verdict function — no fetch, no async, no flicker. A caller
 * that explicitly passes null selects the flat 0° horizon instead
 * (kept for tests / reference only). Verdict rules, stated plainly
 * in the UI:
 *   POWER: Sun alt > local horizon SUNLIT · within 2° below LOW SUN ·
 *     more than 2° below DARK
 *   COMM:  Earth alt > local horizon VISIBLE · at or below BELOW HORIZON
 */
import { sunEarthAt, moonIllumination } from './ephemeris.js';
import { horizonAt, isAboveHorizon } from './horizon.js';
import horizonsDoc from '../data/horizons.json';
import cr1ValidationDoc from '../data/cr1-validation.json';

export const DISCLAIMER =
  'Computed Sun/Earth positions, ±0.1° geometry. POWER/COMM verdicts use the real local horizon from the LOLA DEM (2 m eye height; terrain within ~10 km at the 13 south-pole sites, ~360 m at Apollo 15) — terrain beyond that range is not in the horizon, so verdicts near the horizon can still differ from reality. The Drive 3D view renders real-time shadows from the DEM mesh (Sun direction from the same ephemeris) as a view aid — those rendered shadows are not a verdict input. Planning aid only, not for flight decisions.';

export const POWER_RULE =
  'POWER rule (terrain-aware horizon from the real LOLA DEM, 2 m eye height, terrain within ~10 km): Sun above the local horizon = SUNLIT · Sun within 2° below the local horizon = LOW SUN · Sun more than 2° below = DARK. Explicit null selects the flat 0° rule instead (reference only).';
export const COMM_RULE =
  'COMM rule (terrain-aware horizon from the real LOLA DEM, 2 m eye height, terrain within ~10 km): Earth above the local horizon = VISIBLE · Earth at or below the local horizon = BELOW HORIZON. Explicit null selects the flat 0° rule instead (reference only).';

/** The 13 sites. `type`: 'artemis-region' (Table 1 region centre),
 *  'psr' (published PSR centre), 'illumination-study' (published study
 *  spot). `note` is shown in the UI so a point is never mistaken for a
 *  region centre. */
export const SITES = [
  { id: 'cabeus', name: 'Peak Near Cabeus B', lat: -83.661, lon: -69.014, type: 'artemis-region', note: 'Artemis III region centre (NASA Oct 2024).' },
  { id: 'haworth', name: 'Haworth', lat: -86.753, lon: -22.836, type: 'artemis-region', note: 'Artemis III region centre (NASA Oct 2024).' },
  { id: 'malapert', name: 'Malapert Massif', lat: -85.99, lon: -0.125, type: 'artemis-region', note: 'Artemis III region centre (NASA Oct 2024).' },
  { id: 'mouton-plateau', name: 'Mons Mouton Plateau', lat: -84.232, lon: 29.926, type: 'artemis-region', note: 'Artemis III region centre (NASA Oct 2024).' },
  { id: 'mouton', name: 'Mons Mouton', lat: -85.423, lon: 31.586, type: 'artemis-region', note: 'Artemis III region centre (NASA Oct 2024).' },
  { id: 'nobile1', name: 'Nobile Rim 1', lat: -85.431, lon: 37.241, type: 'artemis-region', note: 'Artemis III region centre (NASA Oct 2024).' },
  { id: 'nobile2', name: 'Nobile Rim 2', lat: -83.963, lon: 58.654, type: 'artemis-region', note: 'Artemis III region centre (NASA Oct 2024).' },
  { id: 'gerlache2', name: 'de Gerlache Rim 2', lat: -88.225, lon: -65.421, type: 'artemis-region', note: 'Artemis III region centre (NASA Oct 2024). Region centre, not the PSR centre (−88.161°, −54.064°) — different published points.' },
  { id: 'slater', name: 'Slater Plain', lat: -87.149, lon: 126.134, type: 'artemis-region', note: 'Artemis III region centre (NASA Oct 2024).' },
  {
    id: 'connecting-ridge', name: 'Connecting Ridge CR1', lat: -89.4395, lon: -137.1934, type: 'illumination-study',
    note: 'Illumination-study spot (Gläser et al. 2014), 2 m above ground — NOT a region centre.',
    published: 'Published 20-year average (Gläser et al. 2014): 88.1% illuminated at 2 m, longest darkness 4.58 days; 92.5% at 10 m.',
  },
  { id: 'shoemaker', name: 'Shoemaker PSR', lat: -88.0517, lon: 45.488, type: 'psr', note: 'Centre of the water-ice-bearing PSR in Shoemaker crater (Lemelin et al. 2021) — NOT a region centre.' },
  { id: 'sverdrup', name: 'Sverdrup PSR', lat: -88.2432, lon: -143.9156, type: 'psr', note: 'PSR centre “Sverdrup 1” (Lemelin et al. 2021) — NOT a region centre.' },
  { id: 'faustini', name: 'Faustini Rim A PSR', lat: -87.146, lon: 84.075, type: 'psr', note: 'PSR centre (PSJ 2024 Table 2; PMC exosphere Table A2 agree exactly) — NOT a region centre.' },
  {
    id: 'apollo15', name: 'Apollo 15 — Hadley Rille', lat: 26.132, lon: 3.634, type: 'apollo-landing',
    note: 'Apollo 15 landing site (Hadley Rille, 26.13°N, 3.63°E) — an equatorial historic site, NOT a south-pole/Artemis site. Drive terrain is the real LROC NAC DTM (2 m/px, 514 m square); heights are relative (absolute datum unknown) and the staged heightmap’s north alignment is unverified.',
  },
];

export const TYPE_LABEL = {
  'artemis-region': 'Artemis III region',
  psr: 'PSR centre',
  'illumination-study': 'Illumination-study spot',
  'apollo-landing': 'Apollo landing site',
};

export function getSite(id) {
  return SITES.find((s) => s.id === id) || SITES[2]; // default Malapert
}

/**
 * The bundled terrain-aware horizon profile for a site id (from
 * src/data/horizons.json, generated by app/tools/compute-horizons.mjs
 * from the real LOLA DEMs). Returns null for unknown ids — callers
 * treat null as the flat 0° horizon. This is what makes every
 * verdict terrain-aware by default: the verdict functions below
 * default their horizon argument to horizonForSite(site.id).
 */
export function horizonForSite(siteId) {
  return horizonsDoc.profiles[siteId] ?? null;
}

/**
 * CR1 Sun-up validation (app/tools/compute-cr1-validation.mjs, offline):
 * the app's own ephemeris + horizon engine run over one full 18.6-year
 * precession cycle at Connecting Ridge CR1, vs Gläser et al. 2014's
 * published 88.1% over 20 years. FINDING: computed 80.2% vs published
 * 88.1% — a 7.9-point gap NOT explained by the solar-disc definition
 * (82.5% any-part-up / 77.4% full-disc-up) or by sampling (10-minute
 * sampling agrees to 0.01 points). Likely terrain-model / window
 * differences; the engine was NOT adjusted to match. See the doc's
 * `method` / `published.note` and the Evidence modal badge.
 */
export const CR1_VALIDATION = cr1ValidationDoc;

export function fmt(n, digits = 2) {
  if (n == null || Number.isNaN(n)) return '—';
  return Number(n).toFixed(digits);
}

/** Signed degrees with explicit +/−, e.g. "+5.53°", "−0.49°". */
export function fmtSigned(n, digits = 2) {
  if (n == null || Number.isNaN(n)) return '—';
  const sign = n < 0 ? '−' : '+';
  return `${sign}${Math.abs(n).toFixed(digits)}°`;
}

/**
 * POWER verdict from Sun altitude + azimuth.
 * With a null horizon profile: the flat-horizon geometric rule
 * (Sun > 0° SUNLIT · −2°..0° LOW SUN · < −2° DARK), exactly as before.
 * With a profile: the same rule against the LOCAL horizon —
 * SUNLIT iff Sun alt > horizon(sunAz), LOW SUN iff within 2° below
 * it, DARK below that. `sunAz` is required when a profile is given.
 */
export function powerVerdict(sunAlt, sunAz, horizonProfile) {
  if (horizonProfile) {
    if (!Number.isFinite(sunAz)) throw new Error('powerVerdict: sunAz is required with a horizon profile');
    const h = horizonAt(horizonProfile, sunAz);
    const alt = fmtSigned(sunAlt);
    const hor = fmtSigned(h);
    const az = fmtSigned(sunAz, 0);
    if (sunAlt > h) return { key: 'SUNLIT', label: 'SUNLIT', color: '#34d399', detail: `Sun ${alt} is above the local horizon (${hor} at az ${az}) — solar power available.` };
    if (sunAlt >= h - 2) return { key: 'LOW SUN', label: 'LOW SUN', color: '#fbbf24', detail: `Sun ${alt} is within 2° below the local horizon (${hor} at az ${az}) — weak, grazing light; power marginal.` };
    return { key: 'DARK', label: 'DARK', color: '#94a3b8', detail: `Sun ${alt} is more than 2° below the local horizon (${hor} at az ${az}) — no direct solar power.` };
  }
  if (sunAlt > 0) return { key: 'SUNLIT', label: 'SUNLIT', color: '#34d399', detail: 'Sun above the horizon — solar power available.' };
  if (sunAlt >= -2) return { key: 'LOW SUN', label: 'LOW SUN', color: '#fbbf24', detail: 'Sun within 2° of the horizon — weak, grazing light; power marginal.' };
  return { key: 'DARK', label: 'DARK', color: '#94a3b8', detail: 'Sun more than 2° below the horizon — no direct solar power.' };
}

/**
 * COMM verdict from Earth altitude + azimuth.
 * With a null horizon profile: the flat-horizon rule (Earth > 0° VISIBLE ·
 * ≤ 0° BELOW HORIZON), exactly as before. With a profile: VISIBLE iff
 * Earth alt > horizon(earthAz). `earthAz` is required with a profile.
 */
export function commVerdict(earthAlt, earthAz, horizonProfile) {
  if (horizonProfile) {
    if (!Number.isFinite(earthAz)) throw new Error('commVerdict: earthAz is required with a horizon profile');
    const h = horizonAt(horizonProfile, earthAz);
    const alt = fmtSigned(earthAlt);
    const hor = fmtSigned(h);
    const az = fmtSigned(earthAz, 0);
    if (earthAlt > h) return { key: 'VISIBLE', label: 'VISIBLE', color: '#38bdf8', detail: `Earth ${alt} is above the local horizon (${hor} at az ${az}) — direct-to-Earth link possible.` };
    return { key: 'BELOW HORIZON', label: 'BELOW HORIZON', color: '#f87171', detail: `Earth ${alt} is at or below the local horizon (${hor} at az ${az}) — no direct-to-Earth link (relay needed).` };
  }
  if (earthAlt > 0) return { key: 'VISIBLE', label: 'VISIBLE', color: '#38bdf8', detail: 'Earth above the horizon — direct-to-Earth link possible.' };
  return { key: 'BELOW HORIZON', label: 'BELOW HORIZON', color: '#f87171', detail: 'Earth below the horizon — no direct-to-Earth link (relay needed).' };
}

/** Full verdict pack for one site at one instant. Defaults to the
 *  site's bundled horizon profile (terrain-aware); pass null
 *  explicitly for the flat-horizon pack. The pack carries the local
 *  horizon degrees used (sunHorizonDeg / earthHorizonDeg, null when
 *  flat). */
export function siteVerdict(date, site, horizonProfile = horizonForSite(site.id)) {
  const pos = sunEarthAt(date, site.lat, site.lon);
  return {
    site,
    date: date instanceof Date ? date : new Date(date),
    sun: pos.sun,
    earth: pos.earth,
    illumination: pos.illumination,
    sunHorizonDeg: horizonProfile ? horizonAt(horizonProfile, pos.sun.az) : null,
    earthHorizonDeg: horizonProfile ? horizonAt(horizonProfile, pos.earth.az) : null,
    power: powerVerdict(pos.sun.alt, pos.sun.az, horizonProfile),
    comm: commVerdict(pos.earth.alt, pos.earth.az, horizonProfile),
  };
}

/** Side-by-side comparison of several sites at one instant.
 *  With no `horizonsById` map every site gets its bundled profile
 *  (the default). With a map, a site missing from it gets null —
 *  the flat horizon — so a caller can mix terrain-aware and flat
 *  packs deliberately. */
export function compareSites(date, siteIds, horizonsById) {
  return siteIds.map((id) => {
    const site = getSite(id);
    return horizonsById
      ? siteVerdict(date, site, horizonsById[id] ?? null)
      : siteVerdict(date, site);
  });
}

/**
 * Rank all sites for one instant: best first by POWER margin above
 * the local horizon (Sun alt minus local horizon), then COMM margin
 * (Earth alt minus local horizon). With no `horizonsById` map every
 * site gets its bundled profile; with a map, a site missing from it
 * is ranked flat (null). Returns verdict packs with a 1-based rank.
 */
export function rankSites(date, horizonsById) {
  const packs = SITES.map((s) => (horizonsById
    ? siteVerdict(date, s, horizonsById[s.id] ?? null)
    : siteVerdict(date, s)));
  const sunMargin = (p) => p.sun.alt - (p.sunHorizonDeg ?? 0);
  const earthMargin = (p) => p.earth.alt - (p.earthHorizonDeg ?? 0);
  packs.sort((a, b) => sunMargin(b) - sunMargin(a) || earthMargin(b) - earthMargin(a));
  return packs.map((p, i) => ({ ...p, rank: i + 1 }));
}

/**
 * Landing-window finder. Samples every hour from `startDate` for
 * `days` days at one site and returns:
 *  - per-day Sun-lit hours and Earth-visible hours (against the LOCAL
 *    horizon — the site's bundled profile by default; null = flat 0°),
 *  - the longest continuous SUNLIT run (start + length),
 *  - the longest continuous Earth-VISIBLE run,
 *  - days ranked best-first (Sun-lit hours, then Earth-visible hours).
 * Sampling is hourly, so hours are whole-hour counts — labelled as such.
 */
export function findWindows(startDate, site, days = 14, horizonProfile = horizonForSite(site.id)) {
  const start = startDate instanceof Date ? startDate : new Date(startDate);
  const totalHours = days * 24;
  const sunLit = (s) => (horizonProfile ? isAboveHorizon(s.sunAlt, s.sunAz, horizonProfile) : s.sunAlt > 0);
  const earthVis = (s) => (horizonProfile ? isAboveHorizon(s.earthAlt, s.earthAz, horizonProfile) : s.earthAlt > 0);
  const samples = [];
  for (let h = 0; h < totalHours; h++) {
    const d = new Date(start.getTime() + h * 3600e3);
    const pos = sunEarthAt(d, site.lat, site.lon);
    samples.push({ date: d, sunAlt: pos.sun.alt, sunAz: pos.sun.az, earthAlt: pos.earth.alt, earthAz: pos.earth.az });
  }
  const dayRows = [];
  for (let day = 0; day < days; day++) {
    const chunk = samples.slice(day * 24, (day + 1) * 24);
    dayRows.push({
      date: chunk[0].date,
      sunlitHours: chunk.filter(sunLit).length,
      earthHours: chunk.filter(earthVis).length,
      maxSunAlt: Math.max(...chunk.map((s) => s.sunAlt)),
      minEarthAlt: Math.min(...chunk.map((s) => s.earthAlt)),
      maxEarthAlt: Math.max(...chunk.map((s) => s.earthAlt)),
    });
  }
  const longestRun = (pred) => {
    let best = { start: null, hours: 0 };
    let cur = { start: null, hours: 0 };
    for (const s of samples) {
      if (pred(s)) {
        if (cur.hours === 0) cur.start = s.date;
        cur.hours += 1;
        if (cur.hours > best.hours) best = { ...cur };
      } else {
        cur = { start: null, hours: 0 };
      }
    }
    return best;
  };
  const rankedDays = [...dayRows].sort(
    (a, b) => b.sunlitHours - a.sunlitHours || b.earthHours - a.earthHours,
  );
  return {
    site,
    start,
    days,
    horizon: horizonProfile
      ? { siteId: horizonProfile.siteId, rangeM: horizonProfile.rangeM, eyeHeightM: horizonProfile.eyeHeightM }
      : null,
    dayRows,
    rankedDays,
    bestSunRun: longestRun(sunLit),
    bestEarthRun: longestRun(earthVis),
    totalSunlitHours: samples.filter(sunLit).length,
    totalEarthHours: samples.filter(earthVis).length,
  };
}

/**
 * Sun/Earth paths over the real horizon for one site + one UTC day —
 * the chart data for the Evidence modal's "visual proof" chart (the
 * Sun visibly rising/setting behind a real ridge). Pure: same engine
 * as the verdicts (ephemeris.js + the bundled LOLA DEM profile).
 *
 * Returns { site, dayStart, horizon, sun, earth, crossings, rangeM,
 * eyeHeightM }:
 * - horizon: 360 points { az 0..359, elev } straight from the profile
 *   (null profile = flat 0° horizon, for reference only).
 * - sun / earth: 25 hourly points { time, alt, az, margin } from
 *   00:00 to 24:00 UTC; margin = alt − horizon at that azimuth
 *   (alt itself when the profile is null). Earth's path over a day is
 *   a short arc (az moves ~1.3° at Malapert) — plotted anyway, labelled.
 * - crossings: every rise/set where the Sun's margin changes sign
 *   between hourly samples, linearly interpolated in time and azimuth
 *   (unwrap-aware); { time, type: 'rise' | 'set', az, elev }. A day
 *   can have zero crossings (Sun above or below the horizon all day).
 */
export function buildSunPathChart(day, site, horizonProfile = horizonForSite(site.id)) {
  const start = day instanceof Date ? day : new Date(day);
  const dayStart = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const horizon = [];
  for (let az = 0; az < 360; az++) {
    horizon.push({ az, elev: horizonProfile ? horizonAt(horizonProfile, az) : 0 });
  }
  const sample = (body) => {
    const pts = [];
    for (let h = 0; h <= 24; h++) {
      const t = new Date(dayStart.getTime() + h * 3600e3);
      const pos = sunEarthAt(t, site.lat, site.lon);
      const b = body === 'sun' ? pos.sun : pos.earth;
      pts.push({
        time: t,
        alt: b.alt,
        az: b.az,
        margin: horizonProfile ? b.alt - horizonAt(horizonProfile, b.az) : b.alt,
      });
    }
    return pts;
  };
  const sun = sample('sun');
  const earth = sample('earth');
  const crossings = [];
  for (let i = 1; i < sun.length; i++) {
    const a = sun[i - 1];
    const b = sun[i];
    if (a.margin === 0 || b.margin === 0 || Math.sign(a.margin) === Math.sign(b.margin)) continue;
    const f = a.margin / (a.margin - b.margin);
    const time = new Date(a.time.getTime() + f * 3600e3);
    let dAz = b.az - a.az;
    if (dAz > 180) dAz -= 360;
    if (dAz < -180) dAz += 360;
    const az = (a.az + f * dAz + 360) % 360;
    crossings.push({
      time,
      type: b.margin > 0 ? 'rise' : 'set',
      az,
      elev: horizonProfile ? horizonAt(horizonProfile, az) : 0,
    });
  }
  return {
    site,
    dayStart,
    horizon,
    sun,
    earth,
    crossings,
    rangeM: horizonProfile ? horizonProfile.rangeM : null,
    eyeHeightM: horizonProfile ? horizonProfile.eyeHeightM : null,
  };
}

/** Published illumination context (SOURCES.md §B4) — the only embeddable
 *  per-site illumination numbers that exist. Everything else the app
 *  shows is computed live and labelled "computed" (against the real
 *  local horizon from the LOLA DEM by default; explicit null = flat
 *  0° horizon, for reference only). */
export const PUBLISHED_ILLUMINATION = [
  {
    site: 'Connecting Ridge CR1',
    text: '88.1% illuminated over 20 years at 2 m above ground; longest continuous darkness 4.58 days; 92.5% at 10 m.',
    source: 'Gläser et al. 2014, EPSC Abstracts (DLR)',
    url: 'https://elib.dlr.de/id/eprint/94242/contents',
  },
  {
    site: 'South-pole site #1 (Mazarico et al.)',
    text: '89% illuminated over a full 18.6-year precession cycle (240 m/pix).',
    source: 'Mazarico et al. 2011, Icarus 211, 1066–1081',
    url: 'https://ntrs.nasa.gov/api/citations/20205009660/downloads/Mike%20Barker_%20Paper_%20Improved%20Lola.pdf',
  },
];

export const TERRAIN_NOTE =
  'Drive mode runs on the real LRO LOLA elevation model: one 1200 m × 1200 m grid per site, sampled from LDEM_85S_10M (10 m/px, 10 sites) or LDEM_80S_20M (20 m/px: Cabeus, Mons Mouton Plateau, Nobile Rim 2), LRO-L-LOLA-4-GDR-V1.0, NASA public domain. Heights are metres above the 1737.4 km reference sphere, shown relative to the landing point (landing point = 0 m); the rover follows them by bilinear interpolation, and the ground mesh is displaced from the same grid. 8 of the 13 sites also carry the real LROC NAC 1 m/px ground imagery (controlled south-pole mosaic, Lunaserv WMS) mapped onto the same 1.2 km box, with DEM elevation-tint + slope shading as an overlay — Cabeus and Nobile Rim 2 have no NAC coverage (they sit north of the mosaic edge, ≈ −84°) and the Shoemaker, Sverdrup and Faustini PSR floors are genuinely black (permanently shadowed, no sunlit imagery exists), so those sites keep DEM shading only and no other site’s imagery is ever stretched onto them. The NAC mosaic has one baked Sun angle, so texture shadows do not move with the app’s live Sun. Lighting: the Sun’s direction comes from the real ephemeris and the Drive scene renders real-time shadows from the DEM mesh (sharp, no atmosphere); brightness is adjusted for readability — the real surface at LOW SUN is nearly dark — with a faint labelled Earthshine fill. Limits: 10–20 m resolution — no sub-10 m boulders or small craters are resolved, the scattered drive-scene rocks are decorative with no collision, and the Sun/Earth verdicts use the terrain-aware horizon from the same DEM (local grid within 600 m + regional 30 m DEM out to ~10 km at the south-pole sites, 2 m eye height; terrain beyond that range is not in the horizon). Full provenance, per-site relief and verification: public/terrain/PROVENANCE.md.';

export const ROVER_NOTE =
  'Drive mode uses the real Apollo LRV mesh: Deutsches Museum | Digital, "Mondfahrzeug (Lunar Rover)", CC-BY-SA 4.0, via NASA Space ROS (space-ros/simulation#32) — DAE → Blender decimate (body 0.2×, wheels 0.2×, covers 0.5×; 375,237 → 97,340 tris) → GLB, textures 2048px PNG → 1024px JPEG, scaled to the published LRV dimensions (3.1 m long, 1.83 m track, 0.818 m wheels, ground at y=0). ShareAlike applies to the adapted mesh. While the GLB loads, no rover is shown — the terrain, sky and HUD stay live and the rover appears the moment the model is ready. The code-built rover is mounted only if the GLB fails to load. The GLB is preloaded in the background from app mount, so it is usually ready before Drive mode is entered; the HUD reports loading / real / fallback. Driver cam sits in the right seat, opposite the high-gain dish (0.6 m right of centre, 0.65 m ahead, eye height 1.45 m — the dish, front face z ≈ +1.55 m, mast top 1.86 m on the real mesh, stays out of frame). Wheel dust and track marks in Drive mode are illustrative effects, not regolith physics. Full pipeline: ROVER.md.';

/** Sources behind the app (SOURCES.md §A5 + §B + §C). */
export const SOURCES = [
  { label: 'Apollo LRV model — Deutsches Museum | Digital, "Mondfahrzeug (Lunar Rover)", CC-BY-SA 4.0, via NASA Space ROS (space-ros/simulation#32)', url: 'https://sketchfab.com/3d-models/mondfahrzeug-lunar-rover-acb3f8645a69493cb211a62b40d66aab' },
  { label: 'NASA — Artemis III landing regions update (Oct 28, 2024): the 9 current regions', url: 'https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/' },
  { label: 'Bian et al. 2025, Table 4 — region-centre coordinates as tabulated from NASA 2024 (pre-print, not peer-reviewed)', url: 'https://www.preprints.org/frontend/manuscript/571f3d7ec0e372983396865e64096f66/download_pub' },
  { label: 'Gläser et al. 2014 — Connecting Ridge illumination (DLR EPSC Abstracts)', url: 'https://elib.dlr.de/id/eprint/94242/contents' },
  { label: 'Lemelin et al. 2021 — PSR centres (Shoemaker, Sverdrup)', url: 'https://iopscience.iop.org/article/10.3847/PSJ/abf3c5' },
  { label: 'PSJ 2024, Table 2 — Faustini Rim A PSR centre', url: 'https://iopscience.iop.org/article/10.3847/PSJ/ad1b50/pdf' },
  { label: 'Mazarico et al. 2011, Icarus 211 — polar illumination over 18.6 years', url: 'https://ntrs.nasa.gov/api/citations/20205009660/downloads/Mike%20Barker_%20Paper_%20Improved%20Lola.pdf' },
  { label: 'NAIF PCK pck00010.tpc — IAU lunar pole / rotation / nutation constants', url: 'https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00010.tpc' },
  { label: 'astronomy-engine v2.1.19 (MIT) — geocentric ephemeris', url: 'https://github.com/cosinekitty/astronomy#readme' },
  { label: 'IAU WGCCRE 2009 report — lunar rotation model (claimed accurate to 0.1°)', url: 'https://pubs.usgs.gov/publication/70157540' },
  { label: 'LRO LOLA GDR LDEM_85S_10M (10 m/px, lat −85°…−90°) — Drive terrain for 10 sites', url: 'https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/IMG/LDEM_85S_10M.IMG' },
  { label: 'LRO LOLA GDR LDEM_80S_20M (20 m/px, lat −80°…−90°) — Drive terrain for Cabeus, Mons Mouton Plateau, Nobile Rim 2', url: 'https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/IMG/LDEM_80S_20M.IMG' },
  { label: 'LROC NAC controlled south-pole mosaic, 1 m/px (luna_nac_pole_control_south, Lunaserv WMS) — Drive ground imagery for 8 of 13 sites', url: 'http://wms.im-ldi.com/lroc/wms' },
  { label: 'LROC WAC global mosaic, 100 m/px — regional south-pole imagery (fallback where NAC has no coverage)', url: 'http://wms.im-ldi.com/lroc/wms' },
  { label: 'NASA LRO Data Products — mission data hub', url: 'https://science.nasa.gov/mission/lro/data-products/' },
  { label: 'NASA Lunar Surface Data Book (ACD-50044 Rev A, May 2023) — LOLA illumination analysis', url: 'https://ntrs.nasa.gov/api/citations/20230007818/downloads/ACD-50044%20Lunar%20Surface%20Data%20Book%20Rev%20A.pdf' },
  { label: 'Challenge statement: “Lunar Landing Site Navigator” (CLPS Lunar Mission Browser, CH-04), NASA Space Apps 2026', url: 'https://edeon.sonoma.edu/nasaspaceapps-26/' },
];

/** Method text for the Evidence modal. */
export const METHOD = [
  'Geocentric Sun and Moon vectors come from astronomy-engine v2.1.19 (MIT), which implements a modern lunar theory (arcminute-level).',
  'The selenocentric Sun vector is Sun minus Moon (geocentric); the selenocentric Earth vector is minus the Moon vector.',
  'Both are rotated into Moon body-fixed coordinates with the IAU lunar rotation model: pole RA 269.9949°, Dec 66.5392°, prime meridian W = 38.3213° + 13.17635815°/day, plus the 13-term nutation series from NAIF PCK pck00010.tpc.',
  'Altitude/azimuth use the observer’s local up / north / east at the site’s selenographic lat/lon (lon east-positive, −180…+180°). Azimuth is measured from north, eastward.',
  'Validation: the sub-Earth point from this transform matches astronomy-engine’s own Libration() to ≤0.03° across 7 dates; the reference values in the table below reproduce to ≤0.01°.',
  'What is NOT modelled: terrain beyond the horizon range — the verdict horizon uses terrain within ~10 km of each south-pole site (local 10/20 m DEM within 600 m + regional 30 m DEM beyond) and ~360 m at Apollo 15, so more distant massifs are not in the horizon; lunar parallax beyond the geocentric vectors; and refraction (none on the Moon). The Drive 3D view separately renders real-time shadows from the DEM mesh, but those are a view aid, not a verdict input.',
];

/** §C3 reference values, as asserted in src/lib/ephemeris.test.js. */
export const REFERENCE_VALUES = [
  { id: 'R1', test: 'Moon illumination, full Moon 2026-11-24 14:53 UTC', expected: '> 99.5% (computed 99.81%)', check: 'Full Moon Nov 24, 2026, 14:53 UTC (USNO-based tables; 1-minute spread across sources).' },
  { id: 'R2', test: 'Malapert, full Moon 2026-11-24 14:53 UTC', expected: 'Sun +5.53° az 357.6° · Earth +10.47° az 357.6°', check: 'Polar bound 90 − 85.99 + 1.54 = 5.55°; Earth alt ≈ 90 − |−85.99 − (−6.44 sub-Earth lat)| = 10.44°.' },
  { id: 'R3', test: 'Malapert, 2026-11-14 12:00 UTC', expected: 'Sun −0.49° az 120.7° · Earth +0.13° az 358.2°', check: 'Edge case: Sun just below horizon, Earth just above it.' },
  { id: 'R4', test: 'Malapert, 2026-11-15 12:00 UTC', expected: 'Sun +0.28° az 108.5° · Earth +1.30° az 356.8°', check: 'The day-1 → day-2 flip: Sun rises above the horizon.' },
  { id: 'R5', test: 'Malapert, new Moon 2026-11-09 07:02 UTC', expected: 'Illumination 0.19% · Sun −2.46° · Earth −2.48°', check: 'New Moon Nov 9, 2026, 07:02 UTC. Near side dark at new Moon.' },
  { id: 'R6', test: 'Malapert Sun-alt sweep, Nov 2026 (6-hourly)', expected: 'min −2.47° · max +5.53°', check: 'Inside the polar bound ±5.55°.' },
  { id: 'R7', test: 'Earth-alt range, daily noon, Nov 2026', expected: 'Malapert −2.53°…+10.50° · Slater Plain −8.08°…+4.70°', check: 'Earth SETS at the highest-latitude sites — Slater Plain Earth is below the horizon part of the month.' },
  { id: 'R8', test: 'Connecting Ridge CR1, 2026-11-14 12:00 UTC', expected: 'Sun +1.44° az 257.7° · Earth −4.27° az 135.3°', check: 'Earth below horizon at the most poleward site.' },
];

export { moonIllumination };
