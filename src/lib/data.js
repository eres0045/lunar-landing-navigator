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
 * model, ±0.1° geometry, flat horizon — no terrain shadowing).
 *
 * Verdicts are flat-horizon GEOMETRIC rules, stated plainly in the UI:
 *   POWER: Sun alt > 0° SUNLIT · −2°..0° LOW SUN · < −2° DARK
 *   COMM:  Earth alt > 0° VISIBLE · ≤ 0° BELOW HORIZON
 */
import { sunEarthAt, moonIllumination } from './ephemeris.js';

export const DISCLAIMER =
  'Computed Sun/Earth positions, ±0.1° geometry. Flat-horizon model — no terrain shadowing: real ridges and crater rims can hide the Sun/Earth near the horizon. Planning aid only, not for flight decisions.';

export const POWER_RULE =
  'POWER rule (flat-horizon geometry): Sun above 0° = SUNLIT · Sun −2° to 0° = LOW SUN · Sun below −2° = DARK.';
export const COMM_RULE =
  'COMM rule (flat-horizon geometry): Earth above 0° = VISIBLE · Earth at or below 0° = BELOW HORIZON.';

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
];

export const TYPE_LABEL = {
  'artemis-region': 'Artemis III region',
  psr: 'PSR centre',
  'illumination-study': 'Illumination-study spot',
};

export function getSite(id) {
  return SITES.find((s) => s.id === id) || SITES[2]; // default Malapert
}

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

/** POWER verdict from Sun altitude (flat-horizon geometric rule). */
export function powerVerdict(sunAlt) {
  if (sunAlt > 0) return { key: 'SUNLIT', label: 'SUNLIT', color: '#34d399', detail: 'Sun above the horizon — solar power available.' };
  if (sunAlt >= -2) return { key: 'LOW SUN', label: 'LOW SUN', color: '#fbbf24', detail: 'Sun within 2° of the horizon — weak, grazing light; power marginal.' };
  return { key: 'DARK', label: 'DARK', color: '#94a3b8', detail: 'Sun more than 2° below the horizon — no direct solar power.' };
}

/** COMM verdict from Earth altitude (flat-horizon geometric rule). */
export function commVerdict(earthAlt) {
  if (earthAlt > 0) return { key: 'VISIBLE', label: 'VISIBLE', color: '#38bdf8', detail: 'Earth above the horizon — direct-to-Earth link possible.' };
  return { key: 'BELOW HORIZON', label: 'BELOW HORIZON', color: '#f87171', detail: 'Earth below the horizon — no direct-to-Earth link (relay needed).' };
}

/** Full verdict pack for one site at one instant. */
export function siteVerdict(date, site) {
  const pos = sunEarthAt(date, site.lat, site.lon);
  return {
    site,
    date: date instanceof Date ? date : new Date(date),
    sun: pos.sun,
    earth: pos.earth,
    illumination: pos.illumination,
    power: powerVerdict(pos.sun.alt),
    comm: commVerdict(pos.earth.alt),
  };
}

/** Side-by-side comparison of several sites at one instant. */
export function compareSites(date, siteIds) {
  return siteIds.map((id) => siteVerdict(date, getSite(id)));
}

/**
 * Rank all 13 sites for one instant: best first by POWER (Sun alt), then
 * COMM (Earth alt). Returns verdict packs with a 1-based rank.
 */
export function rankSites(date) {
  const packs = SITES.map((s) => siteVerdict(date, s));
  packs.sort((a, b) => b.sun.alt - a.sun.alt || b.earth.alt - a.earth.alt);
  return packs.map((p, i) => ({ ...p, rank: i + 1 }));
}

/**
 * Landing-window finder. Samples every hour from `startDate` for
 * `days` days at one site and returns:
 *  - per-day Sun-lit hours and Earth-visible hours (flat horizon),
 *  - the longest continuous SUNLIT run (start + length),
 *  - the longest continuous Earth-VISIBLE run,
 *  - days ranked best-first (Sun-lit hours, then Earth-visible hours).
 * Sampling is hourly, so hours are whole-hour counts — labelled as such.
 */
export function findWindows(startDate, site, days = 14) {
  const start = startDate instanceof Date ? startDate : new Date(startDate);
  const totalHours = days * 24;
  const samples = [];
  for (let h = 0; h < totalHours; h++) {
    const d = new Date(start.getTime() + h * 3600e3);
    const pos = sunEarthAt(d, site.lat, site.lon);
    samples.push({ date: d, sunAlt: pos.sun.alt, earthAlt: pos.earth.alt });
  }
  const dayRows = [];
  for (let day = 0; day < days; day++) {
    const chunk = samples.slice(day * 24, (day + 1) * 24);
    dayRows.push({
      date: chunk[0].date,
      sunlitHours: chunk.filter((s) => s.sunAlt > 0).length,
      earthHours: chunk.filter((s) => s.earthAlt > 0).length,
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
    dayRows,
    rankedDays,
    bestSunRun: longestRun((s) => s.sunAlt > 0),
    bestEarthRun: longestRun((s) => s.earthAlt > 0),
    totalSunlitHours: samples.filter((s) => s.sunAlt > 0).length,
    totalEarthHours: samples.filter((s) => s.earthAlt > 0).length,
  };
}

/** Published illumination context (SOURCES.md §B4) — the only embeddable
 *  per-site illumination numbers that exist. Everything else the app
 *  shows is computed live and labelled "computed, flat horizon". */
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
  'Drive mode runs on the real LRO LOLA elevation model: one 1200 m × 1200 m grid per site, sampled from LDEM_85S_10M (10 m/px, 10 sites) or LDEM_80S_20M (20 m/px: Cabeus, Mons Mouton Plateau, Nobile Rim 2), LRO-L-LOLA-4-GDR-V1.0, NASA public domain. Heights are metres above the 1737.4 km reference sphere, shown relative to the landing point (landing point = 0 m); the rover follows them by bilinear interpolation, and the ground mesh is displaced from the same grid with elevation-tint + slope shading computed from the real heights — no imagery texture (none was obtainable: no LROC texture could be fetched, so nothing fake is substituted). Limits: 10–20 m resolution — no sub-10 m boulders or small craters are resolved, the scattered drive-scene rocks are decorative with no collision, and Sun/Earth verdicts still use the flat-horizon model (no terrain shadowing). Full provenance, per-site relief and verification: public/terrain/PROVENANCE.md.';

export const ROVER_NOTE =
  'Drive mode uses the real Apollo LRV mesh: Deutsches Museum | Digital, "Mondfahrzeug (Lunar Rover)", CC-BY-SA 4.0, via NASA Space ROS (space-ros/simulation#32) — DAE → Blender decimate (body 0.2×, wheels 0.2×, covers 0.5×; 371,237 → 97,340 tris) → GLB, textures 2048px PNG → 1024px JPEG, scaled to the published LRV dimensions (3.1 m long, 1.83 m track, 0.818 m wheels, ground at y=0). ShareAlike applies to the adapted mesh. The code-built rover remains as the fallback if the GLB fails to load. Full pipeline: ROVER.md.';

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
  'Validation: the sub-Earth point from this transform matches astronomy-engine’s own Libration() to ≤0.027° across 7 dates; the reference values in the table below reproduce to ≤0.01°.',
  'What is NOT modelled: terrain shadowing (no per-site horizon mask exists for all 9 regions — see Sources), lunar parallax beyond the geocentric vectors, and refraction (none on the Moon).',
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
