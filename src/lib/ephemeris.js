/**
 * Ephemeris — Sun & Earth alt/az at a lunar south-pole site.
 *
 * Stack (SOURCES.md §C): astronomy-engine v2.1.19 (MIT) for the geocentric
 * ephemeris + a small custom selenographic transform using the IAU lunar
 * rotation model (NAIF PCK pck00010.tpc constants, incl. the 13-term
 * nutation series). Do NOT use astronomy-engine's Horizon() for the Moon —
 * it takes Earth-equatorial RA/Dec only and returns nonsense on the Moon.
 *
 * Validation (vitest, src/lib/ephemeris.test.js): sub-Earth point vs
 * astronomy-engine's own Libration() ≤ 0.03° across 7 dates (max
 * angular separation 0.0288° — SOURCES.md §G2 re-measurement); the §C3
 * reference values (full Moon, Malapert Nov 14/15, new Moon, CR1) all
 * reproduce to ≤ 0.01°. Without the nutation terms the error is up to
 * 1.6° — nutation is mandatory, not optional.
 *
 * Claimed accuracy in the UI: ±0.1° geometry. The ephemeris itself
 * has no terrain model — the terrain-aware horizon is applied to its
 * alt/az output in data.js, never here.
 */
import * as Astronomy from 'astronomy-engine';

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

/** Nutation-precession angles E1..E13 (degrees, linear in days since
 *  J2000), from NAIF pck00010.tpc BODY3_NUT_PREC_ANGLES (fetched live
 *  2026-11-14; rates in the file are degrees/century, converted here to
 *  degrees/day). IAU WGCCRE 2009 report values. */
const NUT_ANGLES = [
  [125.045, -0.0529921], [250.089, -0.1059842], [260.008, 13.0120009],
  [176.625, 13.3407154], [357.529, 0.9856003], [311.589, 26.4057084],
  [134.963, 13.0649930], [276.617, 0.3287146], [34.226, 1.7484877],
  [15.134, -0.1589763], [119.743, 0.0036096], [239.961, 0.1643573],
  [25.053, 12.9590088],
];
/** Nutation coefficients (degrees) from pck00010.tpc BODY301_NUT_PREC_RA /
 *  _DEC / _PM. SPICE convention: RA and PM take sin(Ei), Dec takes cos(Ei). */
const C_RA = [-3.8787, -0.1204, 0.0700, -0.0172, 0.0, 0.0072, 0.0, 0.0, 0.0, -0.0052, 0.0, 0.0, 0.0043];
const C_DEC = [1.5419, 0.0239, -0.0278, 0.0068, 0.0, -0.0029, 0.0009, 0.0, 0.0, 0.0008, 0.0, 0.0, -0.0009];
const C_PM = [3.5610, 0.1208, -0.0642, 0.0158, 0.0252, -0.0066, -0.0047, -0.0046, 0.0028, 0.0052, 0.0040, 0.0019, -0.0044];

/**
 * Moon body-fixed basis in the ICRF/J2000 equatorial frame at `date`.
 * Returns {x, y, z}: unit vectors of the body-fixed axes (x = prime
 * meridian at the equator, z = rotation pole).
 */
export function moonRotation(date) {
  const d = date.getTime() / 86400000 - 10957.5; // days since J2000
  const T = d / 36525; // Julian centuries since J2000
  const E = NUT_ANGLES.map(([e0, rate]) => (e0 + rate * d) * D2R);
  let ra = 269.9949 + 0.0031 * T;
  let dec = 66.5392 + 0.0130 * T;
  let W = 38.3213 + 13.17635815 * d - 1.4e-12 * d * d;
  for (let i = 0; i < 13; i++) {
    ra += C_RA[i] * Math.sin(E[i]);
    dec += C_DEC[i] * Math.cos(E[i]);
    W += C_PM[i] * Math.sin(E[i]);
  }
  const raR = ra * D2R;
  const decR = dec * D2R;
  const WR = W * D2R;
  const P = [Math.cos(decR) * Math.cos(raR), Math.cos(decR) * Math.sin(raR), Math.sin(decR)];
  const n = [-Math.sin(raR), Math.cos(raR), 0]; // ascending node
  // v = P x n: in the body equatorial plane, 90 deg from the node.
  const v = [P[1] * n[2] - P[2] * n[1], P[2] * n[0] - P[0] * n[2], P[0] * n[1] - P[1] * n[0]];
  const x = [
    Math.cos(WR) * n[0] + Math.sin(WR) * v[0],
    Math.cos(WR) * n[1] + Math.sin(WR) * v[1],
    Math.cos(WR) * n[2] + Math.sin(WR) * v[2],
  ];
  const y = [P[1] * x[2] - P[2] * x[1], P[2] * x[0] - P[0] * x[2], P[0] * x[1] - P[1] * x[0]];
  return { x, y, z: P };
}

function toBody(vec, R) {
  return [
    vec[0] * R.x[0] + vec[1] * R.x[1] + vec[2] * R.x[2],
    vec[0] * R.y[0] + vec[1] * R.y[1] + vec[2] * R.y[2],
    vec[0] * R.z[0] + vec[1] * R.z[1] + vec[2] * R.z[2],
  ];
}

function norm(v) {
  const l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l];
}

/** Alt/az (deg, az from north, eastward) of a body-fixed unit direction
 *  as seen by an observer at selenographic lat/lon (deg, lon east +). */
export function altAzFromBodyDir(bodyDir, latDeg, lonDeg) {
  const la = latDeg * D2R;
  const lo = lonDeg * D2R;
  const up = [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
  const east = [-Math.sin(lo), Math.cos(lo), 0];
  const north = [-Math.sin(la) * Math.cos(lo), -Math.sin(la) * Math.sin(lo), Math.cos(la)];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const alt = Math.asin(Math.max(-1, Math.min(1, dot(bodyDir, up)))) * R2D;
  let az = Math.atan2(dot(bodyDir, east), dot(bodyDir, north)) * R2D;
  if (az < 0) az += 360;
  return { alt, az };
}

/**
 * Sun and Earth alt/az at a lunar site, plus the Moon's illuminated
 * fraction. `date` is a Date (UTC); lat/lon in degrees (lon east +).
 * Returns { sun: {alt, az}, earth: {alt, az}, illumination }.
 */
export function sunEarthAt(date, latDeg, lonDeg) {
  const R = moonRotation(date);
  const moonGeo = Astronomy.GeoVector(Astronomy.Body.Moon, date, true);
  const sunGeo = Astronomy.GeoVector(Astronomy.Body.Sun, date, true);
  const moon = [moonGeo.x, moonGeo.y, moonGeo.z];
  const sun = [sunGeo.x, sunGeo.y, sunGeo.z];
  const sunSel = norm([sun[0] - moon[0], sun[1] - moon[1], sun[2] - moon[2]]);
  const earthSel = norm([-moon[0], -moon[1], -moon[2]]);
  return {
    sun: altAzFromBodyDir(toBody(sunSel, R), latDeg, lonDeg),
    earth: altAzFromBodyDir(toBody(earthSel, R), latDeg, lonDeg),
    illumination: Astronomy.Illumination(Astronomy.Body.Moon, date).phase_fraction,
  };
}

/** Sub-Earth point (selenographic lat/lon, deg) from our own transform —
 *  the independent check is Astronomy.Libration() (elat/elon). */
export function subEarthPoint(date) {
  const R = moonRotation(date);
  const moonGeo = Astronomy.GeoVector(Astronomy.Body.Moon, date, true);
  const b = toBody(norm([-moonGeo.x, -moonGeo.y, -moonGeo.z]), R);
  return { lat: Math.asin(Math.max(-1, Math.min(1, b[2]))) * R2D, lon: Math.atan2(b[1], b[0]) * R2D };
}

/** Moon illuminated fraction (0..1) at `date`. */
export function moonIllumination(date) {
  return Astronomy.Illumination(Astronomy.Body.Moon, date).phase_fraction;
}

/** Sub-Earth point straight from astronomy-engine (independent check). */
export function librationSubEarth(date) {
  const lib = Astronomy.Libration(date);
  return { lat: lib.elat, lon: lib.elon };
}
