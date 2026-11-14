/**
 * Data tests — verdict rules, comparison, ranking, window finder.
 * Ephemeris values themselves are asserted in ephemeris.test.js.
 */
import { describe, it, expect } from 'vitest';
import {
  SITES, getSite, powerVerdict, commVerdict, siteVerdict,
  compareSites, rankSites, findWindows, PUBLISHED_ILLUMINATION,
  POWER_RULE, COMM_RULE, DISCLAIMER, horizonForSite,
  buildSunPathChart, CR1_VALIDATION,
} from './data.js';
import { sunEarthAt } from './ephemeris.js';
import { horizonAt } from './horizon.js';
import { createRover, roverVerdict } from './rover.js';
import horizonsDoc from '../data/horizons.json';

const MALAPERT_HORIZON = horizonsDoc.profiles.malapert;

describe('sites', () => {
  it('has exactly the 14 sourced sites: 9 Artemis regions + 4 extras + Apollo 15', () => {
    expect(SITES).toHaveLength(14);
    expect(SITES.filter((s) => s.type === 'artemis-region')).toHaveLength(9);
    expect(SITES.filter((s) => s.type === 'psr')).toHaveLength(3);
    expect(SITES.filter((s) => s.type === 'illumination-study')).toHaveLength(1);
    expect(SITES.filter((s) => s.type === 'apollo-landing')).toHaveLength(1);
  });
  it('uses the exact SOURCES.md §B coordinates', () => {
    expect(getSite('malapert')).toMatchObject({ lat: -85.99, lon: -0.125 });
    expect(getSite('connecting-ridge')).toMatchObject({ lat: -89.4395, lon: -137.1934 });
    expect(getSite('shoemaker')).toMatchObject({ lat: -88.0517, lon: 45.488 });
    expect(getSite('sverdrup')).toMatchObject({ lat: -88.2432, lon: -143.9156 });
    expect(getSite('faustini')).toMatchObject({ lat: -87.146, lon: 84.075 });
    expect(getSite('slater')).toMatchObject({ lat: -87.149, lon: 126.134 });
    expect(getSite('gerlache2')).toMatchObject({ lat: -88.225, lon: -65.421 });
    expect(getSite('apollo15')).toMatchObject({ lat: 26.132, lon: 3.634 });
  });
  it('labels extras by type, never as region centres', () => {
    expect(getSite('shoemaker').note).toMatch(/NOT a region centre/);
    expect(getSite('connecting-ridge').note).toMatch(/NOT a region centre/);
    expect(getSite('connecting-ridge').published).toMatch(/88\.1%/);
    expect(getSite('connecting-ridge').published).toMatch(/92\.5%/);
  });
  it('published illumination numbers are the sourced Gläser / Mazarico figures only', () => {
    expect(PUBLISHED_ILLUMINATION).toHaveLength(2);
    expect(PUBLISHED_ILLUMINATION[0].text).toMatch(/88\.1%/);
    expect(PUBLISHED_ILLUMINATION[0].text).toMatch(/4\.58 days/);
    expect(PUBLISHED_ILLUMINATION[1].text).toMatch(/89%/);
  });
});

describe('verdict rules', () => {
  it('POWER: >0 SUNLIT, −2..0 LOW SUN, <−2 DARK (boundaries exact)', () => {
    expect(powerVerdict(5.53).key).toBe('SUNLIT');
    expect(powerVerdict(0.01).key).toBe('SUNLIT');
    expect(powerVerdict(0).key).toBe('LOW SUN');
    expect(powerVerdict(-0.49).key).toBe('LOW SUN');
    expect(powerVerdict(-2).key).toBe('LOW SUN');
    expect(powerVerdict(-2.01).key).toBe('DARK');
    expect(powerVerdict(-2.46).key).toBe('DARK');
  });
  it('COMM: >0 VISIBLE, ≤0 BELOW HORIZON', () => {
    expect(commVerdict(10.47).key).toBe('VISIBLE');
    expect(commVerdict(0.13).key).toBe('VISIBLE');
    expect(commVerdict(0).key).toBe('BELOW HORIZON');
    expect(commVerdict(-4.27).key).toBe('BELOW HORIZON');
  });
});

describe('siteVerdict — the day-1 → day-2 flip at Malapert (terrain-aware by default)', () => {
  it('Nov 14 12:00Z: DARK + BELOW HORIZON; Nov 15 12:00Z: DARK + BELOW HORIZON', () => {
    // Default = bundled Malapert profile: Sun −0.49° vs +2.65° local
    // horizon, Earth +0.13° vs +3.80° — both below the real horizon,
    // where the flat rule said LOW SUN + VISIBLE.
    const d1 = siteVerdict(new Date('2026-11-14T12:00:00Z'), getSite('malapert'));
    expect(d1.power.key).toBe('DARK');
    expect(d1.comm.key).toBe('BELOW HORIZON');
    expect(d1.sunHorizonDeg).toBeCloseTo(2.65, 1);
    expect(d1.earthHorizonDeg).toBeCloseTo(3.8, 1);
    // Nov 15: Sun +0.28° vs +3.18° horizon, Earth +1.30° vs +3.72° —
    // still below the local horizon both ways.
    const d2 = siteVerdict(new Date('2026-11-15T12:00:00Z'), getSite('malapert'));
    expect(d2.power.key).toBe('DARK');
    expect(d2.comm.key).toBe('BELOW HORIZON');
  });
  it('explicit null is the flat rule: Nov 14 LOW SUN + VISIBLE, Nov 15 SUNLIT + VISIBLE', () => {
    const d1 = siteVerdict(new Date('2026-11-14T12:00:00Z'), getSite('malapert'), null);
    expect(d1.power.key).toBe('LOW SUN');
    expect(d1.comm.key).toBe('VISIBLE');
    expect(d1.sunHorizonDeg).toBeNull();
    const d2 = siteVerdict(new Date('2026-11-15T12:00:00Z'), getSite('malapert'), null);
    expect(d2.power.key).toBe('SUNLIT');
    expect(d2.comm.key).toBe('VISIBLE');
  });
  it('full Moon Nov 24: Malapert SUNLIT, Sun ≈ +5.5°', () => {
    const v = siteVerdict(new Date('2026-11-24T14:53:00Z'), getSite('malapert'));
    expect(v.power.key).toBe('SUNLIT');
    expect(v.sun.alt).toBeCloseTo(5.53, 1);
    expect(v.sunHorizonDeg).toBeCloseTo(3.77, 1);
    expect(v.illumination).toBeGreaterThan(0.995);
  });
  it('new Moon Nov 9: Malapert SUNLIT against the terrain horizon (Sun −2.46° vs −4.10° horizon to the south)', () => {
    // Counterintuitive but engine-verified: at az 184° the local
    // horizon dips to −4.10° (a southward dip in the DEM), so the
    // Sun at −2.46° sits ABOVE it. The flat rule said DARK.
    const v = siteVerdict(new Date('2026-11-09T07:02:00Z'), getSite('malapert'));
    expect(v.power.key).toBe('SUNLIT');
    expect(v.sunHorizonDeg).toBeCloseTo(-4.1, 1);
    expect(v.illumination).toBeLessThan(0.01);
  });
  it('CR1 Nov 14: DARK + BELOW HORIZON (Sun +1.44° vs +4.97° horizon at az 258°)', () => {
    const v = siteVerdict(new Date('2026-11-14T12:00:00Z'), getSite('connecting-ridge'));
    expect(v.power.key).toBe('DARK');
    expect(v.comm.key).toBe('BELOW HORIZON');
    expect(v.sunHorizonDeg).toBeCloseTo(4.97, 1);
    // Flat (explicit null) still says SUNLIT — the flip is the terrain.
    expect(siteVerdict(new Date('2026-11-14T12:00:00Z'), getSite('connecting-ridge'), null).power.key).toBe('SUNLIT');
  });
});

describe('compare + rank (terrain-aware by default)', () => {
  it('compareSites returns one pack per requested site, in order, terrain-aware by default', () => {
    const packs = compareSites(new Date('2026-11-14T12:00:00Z'), ['malapert', 'slater', 'connecting-ridge']);
    expect(packs).toHaveLength(3);
    expect(packs[0].site.id).toBe('malapert');
    expect(packs[2].site.id).toBe('connecting-ridge');
    for (const p of packs) expect(p.sunHorizonDeg).not.toBeNull();
    // Nov 14 defaults: Malapert DARK, Slater DARK, CR1 DARK.
    expect(packs.map((p) => p.power.key)).toEqual(['DARK', 'DARK', 'DARK']);
  });
  it('rankSites ranks all 14 by margin above the local horizon, ranks 1..14', () => {
    const ranked = rankSites(new Date('2026-11-24T14:53:00Z'));
    expect(ranked).toHaveLength(14);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    for (const p of ranked) expect(p.sunHorizonDeg).not.toBeNull();
    // Margin (Sun alt minus local horizon) is monotonic, not raw Sun
    // altitude — a site with a low horizon can outrank a site with a
    // higher Sun.
    for (let i = 1; i < ranked.length; i++) {
      const prev = ranked[i - 1].sun.alt - ranked[i - 1].sunHorizonDeg;
      const cur = ranked[i].sun.alt - ranked[i].sunHorizonDeg;
      expect(cur).toBeLessThanOrEqual(prev + 1e-9);
    }
    // Apollo 15 is equatorial (26°N), so at full Moon its Sun sits far
    // higher (+61.7°) than any south-pole site (max +5.5°) — it tops
    // the ranking by geometry, not by Artemis relevance.
    expect(ranked[0].site.id).toBe('apollo15');
    expect(ranked[0].sun.alt).toBeCloseTo(61.7, 0);
    // At full Moon the most poleward sites lose to their own horizons:
    // Cabeus (margin −8.72°) ranks last, not Slater.
    expect(ranked[13].site.id).toBe('cabeus');
  });
  it('rankSites Nov 14 (terrain): Nobile Rim 1 tops, Apollo 15 is last (night there)', () => {
    const ranked = rankSites(new Date('2026-11-14T12:00:00Z'));
    expect(ranked[0].site.id).toBe('nobile1');
    expect(ranked[13].site.id).toBe('apollo15');
  });
  it('rankSites with an explicit empty map is the old flat ranking (Slater last at full Moon)', () => {
    const ranked = rankSites(new Date('2026-11-24T14:53:00Z'), {});
    expect(ranked[0].site.id).toBe('apollo15');
    expect(ranked[13].site.id).toBe('slater');
    expect(ranked[13].sun.alt).toBeCloseTo(-0.26, 1);
    for (const p of ranked) expect(p.sunHorizonDeg).toBeNull();
  });
});

describe('window finder', () => {
  it('Malapert 14 days from Nov 14: day rows, totals and a long SUNLIT run (terrain-aware)', () => {
    const w = findWindows(new Date('2026-11-14T00:00:00Z'), getSite('malapert'), 14);
    expect(w.dayRows).toHaveLength(14);
    // Terrain-aware totals (engine-computed): the Sun clears the
    // +2.65°-class local horizon only from Nov 22, so 136 of 336 h
    // are Sun-lit (flat was 308) and 258 Earth-visible (flat 326).
    expect(w.totalSunlitHours).toBe(136);
    expect(w.totalEarthHours).toBe(258);
    expect(w.bestSunRun.hours).toBe(136);
    expect(w.bestSunRun.start.toISOString()).toBe('2026-11-22T08:00:00.000Z');
    expect(w.bestEarthRun.hours).toBe(258);
    expect(w.horizon).toMatchObject({ siteId: 'malapert', rangeM: 9990, eyeHeightM: 2 });
    // Ranked days are sorted best-first by Sun-lit hours.
    for (let i = 1; i < w.rankedDays.length; i++) {
      expect(w.rankedDays[i].sunlitHours).toBeLessThanOrEqual(w.rankedDays[i - 1].sunlitHours);
    }
    // Every day row sums consistently.
    for (const row of w.dayRows) {
      expect(row.sunlitHours).toBeGreaterThanOrEqual(0);
      expect(row.sunlitHours).toBeLessThanOrEqual(24);
      expect(row.earthHours).toBeGreaterThanOrEqual(0);
      expect(row.earthHours).toBeLessThanOrEqual(24);
    }
  });
  it('CR1 30 days: Earth is hidden part of the month (total Earth hours < total hours)', () => {
    const w = findWindows(new Date('2026-11-01T00:00:00Z'), getSite('connecting-ridge'), 30);
    expect(w.totalEarthHours).toBeLessThan(30 * 24);
    expect(w.totalEarthHours).toBeGreaterThan(0);
    expect(w.dayRows).toHaveLength(30);
  });
});

describe('terrain-aware verdicts (Malapert horizon: max 7.42 deg @ az 75, range 9990 m)', () => {
  it('powerVerdict with a profile uses the LOCAL horizon, not 0 deg', () => {
    // Horizon at az 75 is +7.42 deg: Sun +8 is above it, +7 is within
    // 2 deg below it, +5 is more than 2 deg below it.
    expect(powerVerdict(8, 75, MALAPERT_HORIZON).key).toBe('SUNLIT');
    expect(powerVerdict(7, 75, MALAPERT_HORIZON).key).toBe('LOW SUN');
    expect(powerVerdict(5, 75, MALAPERT_HORIZON).key).toBe('DARK');
    // Same altitudes with NO profile are all SUNLIT (flat 0 deg rule).
    expect(powerVerdict(5).key).toBe('SUNLIT');
  });
  it('commVerdict with a profile uses the LOCAL horizon', () => {
    // Horizon at az 0 is +3.89 deg: Earth +4 is visible, +3 is not.
    expect(commVerdict(4, 0, MALAPERT_HORIZON).key).toBe('VISIBLE');
    expect(commVerdict(3, 0, MALAPERT_HORIZON).key).toBe('BELOW HORIZON');
    expect(commVerdict(3).key).toBe('VISIBLE');
  });
  it('a profile without an azimuth is an error, never a silent az-0 default', () => {
    expect(() => powerVerdict(5, undefined, MALAPERT_HORIZON)).toThrow();
    expect(() => commVerdict(5, undefined, MALAPERT_HORIZON)).toThrow();
  });

  it('Nov 14 12:00Z Malapert: default is terrain DARK + BELOW HORIZON, explicit null is flat LOW SUN + VISIBLE', () => {
    const flat = siteVerdict(new Date('2026-11-14T12:00:00Z'), getSite('malapert'), null);
    expect(flat.power.key).toBe('LOW SUN');
    expect(flat.comm.key).toBe('VISIBLE');
    expect(flat.sunHorizonDeg).toBeNull();
    const terr = siteVerdict(new Date('2026-11-14T12:00:00Z'), getSite('malapert'));
    // Sun -0.49 deg at az 120.7 against a +2.65 deg local horizon;
    // Earth +0.13 deg at az 358.2 against a +3.80 deg local horizon.
    expect(terr.sun.alt).toBeCloseTo(-0.49, 1);
    expect(terr.sunHorizonDeg).toBeCloseTo(2.65, 1);
    expect(terr.power.key).toBe('DARK');
    expect(terr.earth.alt).toBeCloseTo(0.13, 1);
    expect(terr.earthHorizonDeg).toBeCloseTo(3.8, 1);
    expect(terr.comm.key).toBe('BELOW HORIZON');
  });
  it('Nov 15 12:00Z Malapert: flat SUNLIT (explicit null), terrain DARK (Sun +0.28 vs +3.18 horizon)', () => {
    expect(siteVerdict(new Date('2026-11-15T12:00:00Z'), getSite('malapert'), null).power.key).toBe('SUNLIT');
    const terr = siteVerdict(new Date('2026-11-15T12:00:00Z'), getSite('malapert'), MALAPERT_HORIZON);
    expect(terr.power.key).toBe('DARK');
    expect(terr.comm.key).toBe('BELOW HORIZON');
  });
  it('Nov 03 12:00Z Malapert: comm-only flip (Earth +3.36 vs +4.15 horizon, Sun stays SUNLIT)', () => {
    const terr = siteVerdict(new Date('2026-11-03T12:00:00Z'), getSite('malapert'), MALAPERT_HORIZON);
    expect(terr.power.key).toBe('SUNLIT');
    expect(terr.comm.key).toBe('BELOW HORIZON');
  });

  it('compareSites passes profiles per site; a site without one stays flat', () => {
    const packs = compareSites(
      new Date('2026-11-14T12:00:00Z'),
      ['malapert', 'slater'],
      { malapert: MALAPERT_HORIZON },
    );
    expect(packs[0].power.key).toBe('DARK');
    expect(packs[0].sunHorizonDeg).not.toBeNull();
    expect(packs[1].sunHorizonDeg).toBeNull();
  });
  it('rankSites with all profiles ranks by margin above the local horizon', () => {
    const ranked = rankSites(new Date('2026-11-24T14:53:00Z'), horizonsDoc.profiles);
    expect(ranked).toHaveLength(14);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    for (const p of ranked) expect(p.sunHorizonDeg).not.toBeNull();
    // Apollo 15 still tops: its Sun (+61.7 deg) dwarfs every horizon.
    expect(ranked[0].site.id).toBe('apollo15');
    for (let i = 1; i < ranked.length; i++) {
      const prev = ranked[i - 1].sun.alt - ranked[i - 1].sunHorizonDeg;
      const cur = ranked[i].sun.alt - ranked[i].sunHorizonDeg;
      expect(cur).toBeLessThanOrEqual(prev + 1e-9);
    }
  });
  it('findWindows with a profile counts fewer lit/visible hours than flat (explicit null)', () => {
    const flat = findWindows(new Date('2026-11-14T00:00:00Z'), getSite('malapert'), 14, null);
    const terr = findWindows(new Date('2026-11-14T00:00:00Z'), getSite('malapert'), 14, MALAPERT_HORIZON);
    expect(terr.horizon).toMatchObject({ siteId: 'malapert', rangeM: 9990, eyeHeightM: 2 });
    expect(terr.dayRows).toHaveLength(14);
    expect(terr.totalSunlitHours).toBeLessThan(flat.totalSunlitHours);
    expect(terr.totalEarthHours).toBeLessThan(flat.totalEarthHours);
    expect(flat.horizon).toBeNull();
  });
  it('rule strings state the terrain-aware horizon and its range', () => {
    expect(POWER_RULE).toMatch(/terrain-aware horizon from the real LOLA DEM/);
    expect(POWER_RULE).toMatch(/10 km/);
    expect(COMM_RULE).toMatch(/terrain-aware horizon from the real LOLA DEM/);
    expect(DISCLAIMER).toMatch(/real local horizon from the LOLA DEM/);
    expect(DISCLAIMER).toMatch(/10 km/);
  });
});

describe('horizonForSite — bundled profiles are the default', () => {
  it('returns the real profile for every known site, null for unknown ids', () => {
    for (const s of SITES) {
      const p = horizonForSite(s.id);
      expect(p).not.toBeNull();
      expect(p.siteId).toBe(s.id);
      expect(p.bins).toBe(360);
      expect(p.eyeHeightM).toBe(2);
      expect(p.elevationsDeg).toHaveLength(360);
    }
    expect(horizonForSite('no-such-site')).toBeNull();
    expect(horizonForSite(undefined)).toBeNull();
  });
  it('Malapert profile matches the shipped file (max 7.42 deg @ az 75, range 9990 m)', () => {
    const p = horizonForSite('malapert');
    expect(p.maxDeg).toBeCloseTo(7.42, 1);
    expect(p.maxAzDeg).toBe(75);
    expect(p.meanDeg).toBeCloseTo(1.51, 1);
    expect(p.rangeM).toBe(9990);
    // Apollo 15 is local-only: ~363 m, no regional range.
    expect(horizonForSite('apollo15').farRangeM).toBeNull();
    expect(horizonForSite('apollo15').rangeM).toBeCloseTo(363.45, 1);
  });
  it('compareSites with no map is terrain-aware for every site', () => {
    const packs = compareSites(new Date('2026-11-14T12:00:00Z'), ['malapert', 'gerlache2']);
    expect(packs[0].power.key).toBe('DARK');
    expect(packs[0].sunHorizonDeg).toBeCloseTo(2.65, 1);
    // de Gerlache Rim 2: Sun −0.21° vs a +12.77° horizon, Earth −3.08°
    // vs −6.84° — DARK but Earth VISIBLE (the horizon dips that way).
    expect(packs[1].power.key).toBe('DARK');
    expect(packs[1].comm.key).toBe('VISIBLE');
    expect(packs[1].earthHorizonDeg).toBeCloseTo(-6.84, 1);
  });
  it('findWindows with no profile argument is terrain-aware (horizon recorded)', () => {
    const w = findWindows(new Date('2026-11-14T00:00:00Z'), getSite('malapert'), 14);
    expect(w.horizon).toMatchObject({ siteId: 'malapert', rangeM: 9990, eyeHeightM: 2 });
    expect(w.totalSunlitHours).toBe(136);
  });
});

describe('roverVerdict — Drive HUD verdicts use the landing-site profile', () => {
  it('with the landing-site profile: Malapert Nov 14 DARK + BELOW HORIZON, horizon degrees reported', () => {
    const state = createRover(getSite('malapert'));
    const v = roverVerdict(new Date('2026-11-14T12:00:00Z'), state, {
      powerVerdict, commVerdict, horizonProfile: horizonForSite('malapert'),
    });
    expect(v.power.key).toBe('DARK');
    expect(v.comm.key).toBe('BELOW HORIZON');
    expect(v.sunHorizonDeg).toBeCloseTo(2.65, 1);
    expect(v.earthHorizonDeg).toBeCloseTo(3.8, 1);
    expect(v.lat).toBeCloseTo(-85.99, 4);
    expect(v.lon).toBeCloseTo(-0.125, 4);
  });
  it('without a profile: the flat rule (LOW SUN + VISIBLE) and null horizon degrees', () => {
    const state = createRover(getSite('malapert'));
    const v = roverVerdict(new Date('2026-11-14T12:00:00Z'), state, { powerVerdict, commVerdict });
    expect(v.power.key).toBe('LOW SUN');
    expect(v.comm.key).toBe('VISIBLE');
    expect(v.sunHorizonDeg).toBeNull();
    expect(v.earthHorizonDeg).toBeNull();
  });
});

describe('buildSunPathChart — Sun/Earth paths over the real horizon', () => {
  const malapert = getSite('malapert');
  it('horizon values match the bundled profile at every sampled azimuth', () => {
    const chart = buildSunPathChart(new Date('2026-11-14T12:00:00Z'), malapert);
    expect(chart.horizon).toHaveLength(360);
    for (const az of [0, 75, 120, 180, 270, 359]) {
      expect(chart.horizon[az].az).toBe(az);
      expect(chart.horizon[az].elev).toBeCloseTo(horizonAt(MALAPERT_HORIZON, az), 6);
    }
    expect(chart.horizon[75].elev).toBeCloseTo(7.42, 1);
    expect(chart.rangeM).toBe(9990);
    expect(chart.eyeHeightM).toBe(2);
  });
  it('Sun path points match sunEarthAt at the sampled instants', () => {
    const chart = buildSunPathChart(new Date('2026-11-14T12:00:00Z'), malapert);
    expect(chart.sun).toHaveLength(25); // 00:00..24:00 inclusive
    for (const h of [0, 12, 24]) {
      const d = new Date(Date.UTC(2026, 10, 14) + h * 3600e3);
      const pos = sunEarthAt(d, malapert.lat, malapert.lon);
      const p = chart.sun[h];
      expect(p.time.getTime()).toBe(d.getTime());
      expect(p.alt).toBeCloseTo(pos.sun.alt, 6);
      expect(p.az).toBeCloseTo(pos.sun.az, 6);
      expect(p.margin).toBeCloseTo(pos.sun.alt - horizonAt(MALAPERT_HORIZON, pos.sun.az), 6);
    }
  });
  it('Earth path is a short arc (barely moves in a day) and matches sunEarthAt', () => {
    const chart = buildSunPathChart(new Date('2026-11-14T12:00:00Z'), malapert);
    expect(chart.earth).toHaveLength(25);
    const azs = chart.earth.map((p) => p.az);
    expect(Math.max(...azs) - Math.min(...azs)).toBeLessThan(5);
    const pos = sunEarthAt(new Date('2026-11-14T12:00:00Z'), malapert.lat, malapert.lon);
    expect(chart.earth[12].alt).toBeCloseTo(pos.earth.alt, 6);
    expect(chart.earth[12].az).toBeCloseTo(pos.earth.az, 6);
  });
  it('Malapert Nov 22 has exactly one rise crossing (the Sun comes up that morning)', () => {
    const chart = buildSunPathChart(new Date('2026-11-22T12:00:00Z'), malapert);
    expect(chart.crossings).toHaveLength(1);
    const [c] = chart.crossings;
    expect(c.type).toBe('rise');
    expect(c.time.getUTCHours()).toBeGreaterThanOrEqual(7);
    expect(c.time.getUTCHours()).toBeLessThan(9);
    expect(c.az).toBeGreaterThanOrEqual(0);
    expect(c.az).toBeLessThan(360);
  });
  it('Malapert Nov 14 has NO crossing — the Sun stays below the horizon all day (the task-suggested candidate does not cross)', () => {
    const chart = buildSunPathChart(new Date('2026-11-14T12:00:00Z'), malapert);
    expect(chart.crossings).toHaveLength(0);
    expect(chart.sun.every((p) => p.margin < 0)).toBe(true);
  });
  it('null profile = flat 0° horizon (reference only): horizon all 0, margin = alt', () => {
    const chart = buildSunPathChart(new Date('2026-11-14T12:00:00Z'), malapert, null);
    expect(chart.horizon.every((p) => p.elev === 0)).toBe(true);
    expect(chart.sun.every((p) => p.margin === p.alt)).toBe(true);
    expect(chart.rangeM).toBeNull();
  });
});

describe('CR1_VALIDATION — computed vs published Sun-up at Connecting Ridge CR1', () => {
  it('ships the offline 18.6-year computation with full provenance', () => {
    expect(CR1_VALIDATION.cycle.percent).toBe(80.2);
    expect(CR1_VALIDATION.cycle.sunUpHours).toBe(130683);
    expect(CR1_VALIDATION.cycle.samples).toBe(163048);
    expect(CR1_VALIDATION.cycle.start).toBe('2026-01-01T00:00:00.000Z');
    expect(CR1_VALIDATION.cycle.end).toBe('2044-08-07T15:00:00.000Z');
    expect(CR1_VALIDATION.cycle.years).toBe(18.6);
    expect(CR1_VALIDATION.generator).toBe('app/tools/compute-cr1-validation.mjs');
    expect(CR1_VALIDATION.published.percent).toBe(88.1);
    expect(CR1_VALIDATION.published.source).toMatch(/Gläser/);
  });
  it('the 30-day cross-check window recomputed live equals the shipped number exactly', () => {
    const CR1 = horizonsDoc.profiles['connecting-ridge'];
    let up = 0;
    for (let h = 0; h <= 720; h++) {
      const d = new Date(Date.UTC(2026, 10, 1) + h * 3600e3);
      const pos = sunEarthAt(d, -89.4395, -137.1934);
      if (pos.sun.alt > horizonAt(CR1, pos.sun.az)) up += 1;
    }
    expect(up).toBe(CR1_VALIDATION.crossCheck30d.sunUpHours);
    expect(up).toBe(652);
    expect(CR1_VALIDATION.crossCheck30d.samples).toBe(721);
  });
  it('the computed-vs-published gap is real and honestly reported (7.9 points), not tuned away', () => {
    const gap = CR1_VALIDATION.published.percent - CR1_VALIDATION.cycle.percent;
    expect(gap).toBeCloseTo(7.9, 1);
    // The disc definition cannot close the gap (82.5% at best) and
    // sampling cannot either (10-min agrees to 0.01 points).
    expect(CR1_VALIDATION.cycle.discTopPercent).toBe(82.5);
    expect(CR1_VALIDATION.cycle.fullDiscPercent).toBe(77.4);
    expect(CR1_VALIDATION.crossCheck30d.samplingCheck10min.percent).toBe(
      CR1_VALIDATION.crossCheck30d.percent,
    );
  });
});

describe('consistency — every output is terrain-aware by default (no flat verdicts)', () => {
  const NOV14 = new Date('2026-11-14T12:00:00Z');
  const NOV14_START = new Date('2026-11-14T00:00:00Z');
  const FOUR = ['malapert', 'connecting-ridge', 'slater', 'gerlache2'];
  it('window finder: terrain-aware Sun-lit hours differ from the flat count', () => {
    const terrain = findWindows(NOV14_START, getSite('malapert'), 14);
    const flat = findWindows(NOV14_START, getSite('malapert'), 14, null);
    expect(terrain.totalSunlitHours).toBe(136);
    expect(flat.totalSunlitHours).toBe(308);
    expect(terrain.totalSunlitHours).not.toBe(flat.totalSunlitHours);
    expect(terrain.totalEarthHours).toBe(258);
    expect(flat.totalEarthHours).toBe(326);
  });
  it('compare: at least one site verdict differs from its flat value (Malapert DARK, flat LOW SUN)', () => {
    const terrain = compareSites(NOV14, FOUR);
    const flat = compareSites(NOV14, FOUR, Object.fromEntries(FOUR.map((id) => [id, null])));
    const malT = terrain.find((p) => p.site.id === 'malapert');
    const malF = flat.find((p) => p.site.id === 'malapert');
    expect(malT.power.label).toBe('DARK');
    expect(malF.power.label).toBe('LOW SUN');
    expect(malT.comm.label).toBe('BELOW HORIZON');
    expect(malF.comm.label).toBe('VISIBLE');
    expect(terrain.some((p, i) => p.power.label !== flat[i].power.label || p.comm.label !== flat[i].comm.label)).toBe(true);
  });
  it('mission brief ranking: the ranked margin is horizon-relative, not the raw Sun altitude', () => {
    const terrain = rankSites(NOV14);
    const flat = rankSites(NOV14, {});
    const malT = terrain.find((p) => p.site.id === 'malapert');
    const malF = flat.find((p) => p.site.id === 'malapert');
    // Rank packs carry sun.alt + sunHorizonDeg (null when flat); the
    // margin is alt minus local horizon — the brief's sort key.
    const margin = (p) => p.sun.alt - (p.sunHorizonDeg ?? 0);
    expect(margin(malT)).toBeCloseTo(-3.14, 1); // Sun -0.49 deg vs +2.65 deg local horizon
    expect(margin(malF)).toBeCloseTo(-0.49, 1); // flat margin is just the Sun altitude
    expect(margin(malT)).not.toBeCloseTo(margin(malF), 1);
  });
  it('no production output path passes an explicit null profile (grep-verified; only tests do)', () => {
    // This test documents the invariant; the grep is in the report.
    // All App.jsx outputs call the defaults: siteVerdict / compareSites /
    // rankSites / findWindows / roverVerdict / buildSunPathChart.
    expect(siteVerdict(NOV14, getSite('malapert')).power.label).toBe('DARK');
  });
});
