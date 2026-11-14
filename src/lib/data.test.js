/**
 * Data tests — verdict rules, comparison, ranking, window finder.
 * Ephemeris values themselves are asserted in ephemeris.test.js.
 */
import { describe, it, expect } from 'vitest';
import {
  SITES, getSite, powerVerdict, commVerdict, siteVerdict,
  compareSites, rankSites, findWindows, PUBLISHED_ILLUMINATION,
} from './data.js';

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

describe('siteVerdict — the day-1 → day-2 flip at Malapert', () => {
  it('Nov 14 12:00Z: LOW SUN + VISIBLE; Nov 15 12:00Z: SUNLIT + VISIBLE', () => {
    const d1 = siteVerdict(new Date('2026-11-14T12:00:00Z'), getSite('malapert'));
    expect(d1.power.key).toBe('LOW SUN');
    expect(d1.comm.key).toBe('VISIBLE');
    const d2 = siteVerdict(new Date('2026-11-15T12:00:00Z'), getSite('malapert'));
    expect(d2.power.key).toBe('SUNLIT');
    expect(d2.comm.key).toBe('VISIBLE');
  });
  it('full Moon Nov 24: Malapert SUNLIT, Sun ≈ +5.5°', () => {
    const v = siteVerdict(new Date('2026-11-24T14:53:00Z'), getSite('malapert'));
    expect(v.power.key).toBe('SUNLIT');
    expect(v.sun.alt).toBeCloseTo(5.53, 1);
    expect(v.illumination).toBeGreaterThan(0.995);
  });
  it('CR1 Nov 14: SUNLIT but Earth BELOW HORIZON — the poleward comms gap', () => {
    const v = siteVerdict(new Date('2026-11-14T12:00:00Z'), getSite('connecting-ridge'));
    expect(v.power.key).toBe('SUNLIT');
    expect(v.comm.key).toBe('BELOW HORIZON');
  });
});

describe('compare + rank', () => {
  it('compareSites returns one pack per requested site, in order', () => {
    const packs = compareSites(new Date('2026-11-14T12:00:00Z'), ['malapert', 'slater', 'connecting-ridge']);
    expect(packs).toHaveLength(3);
    expect(packs[0].site.id).toBe('malapert');
    expect(packs[2].site.id).toBe('connecting-ridge');
  });
  it('rankSites ranks all 14, best Sun first, ranks 1..14', () => {
    const ranked = rankSites(new Date('2026-11-24T14:53:00Z'));
    expect(ranked).toHaveLength(14);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i].sun.alt).toBeLessThanOrEqual(ranked[i - 1].sun.alt + 1e-9);
    }
    // Apollo 15 is equatorial (26°N), so at full Moon its Sun sits far
    // higher (+61.7°) than any south-pole site (max +5.5°) — it tops
    // the ranking by geometry, not by Artemis relevance.
    expect(ranked[0].site.id).toBe('apollo15');
    expect(ranked[0].sun.alt).toBeCloseTo(61.7, 0);
    // At full Moon the sub-solar longitude sits opposite Slater Plain
    // (126°E), so Slater — not the most poleward site — has the lowest
    // Sun. Sun altitude depends on longitude, not just latitude.
    expect(ranked[13].site.id).toBe('slater');
    expect(ranked[13].sun.alt).toBeCloseTo(-0.26, 1);
  });
});

describe('window finder', () => {
  it('Malapert 14 days from Nov 14: day rows, totals and a long SUNLIT run', () => {
    const w = findWindows(new Date('2026-11-14T00:00:00Z'), getSite('malapert'), 14);
    expect(w.dayRows).toHaveLength(14);
    expect(w.totalSunlitHours).toBeGreaterThan(100);
    expect(w.totalSunlitHours).toBeLessThanOrEqual(14 * 24);
    expect(w.bestSunRun.hours).toBeGreaterThan(100);
    expect(w.bestSunRun.start).toBeInstanceOf(Date);
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
