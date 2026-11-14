/**
 * Rover — Drive-mode physics for the Lunar Landing Site Navigator.
 *
 * PURE module: no three.js, no DOM, fully unit-testable.
 *
 * Vehicle: the Apollo Lunar Roving Vehicle (LRV). Dimensions are the
 * published figures, cited per-dimension in ROVER.md (NASA NSSDCA
 * "The Apollo Lunar Roving Vehicle" + Boeing LRV Operations Handbook
 * LS006-002-2H, Fig. 1-1, via This Day in Aviation's transcription).
 *
 * Model: a kinematic bicycle model in a local tangent-plane frame
 * centred on the landing site — northM/eastM in metres, headingRad
 * clockwise from north (0 = north, π/2 = east). This is an
 * APPROXIMATION, not regolith dynamics: no slip, no suspension, no
 * lunar-gravity effects, constant acceleration/braking rates chosen
 * for a drivable feel (labelled as approximations in ROVER.md).
 *
 * Terrain: `surfaceHeightAt(lat, lon)` is the ONE plug-in point for
 * Step 2's real DEM. Today the Moon is a smooth sphere, so it returns
 * 0 everywhere. `slopeAt` finite-differences it, so pitch/roll follow
 * automatically once a DEM plugs in here — no other code changes.
 */
import { sunEarthAt } from './ephemeris.js';
import { horizonAt } from './horizon.js';

export const MOON_RADIUS_M = 1_737_400;

/** Apollo LRV — verified published dimensions (see ROVER.md). */
export const LRV = {
  /** Frame length, m — NASA NSSDCA: 3.1 m. */
  lengthM: 3.1,
  /** Overall width, m — NASA SP-4214 ch. 13: 1.8 m; track 1.83 m
   *  (LRV Operations Handbook Fig. 1-1). Model uses the 1.83 m track. */
  widthM: 1.83,
  /** Wheelbase, m — handbook Fig. 1-1: 90 in = 2.29 m (NSSDCA rounds 2.3 m). */
  wheelbaseM: 2.29,
  /** Track width (centre-to-centre), m — handbook Fig. 1-1: 72 in = 1.83 m. */
  trackM: 1.83,
  /** Wheel diameter, m — NASA NSSDCA: 81.8 cm. */
  wheelDiameterM: 0.818,
  /** Wheel width, m — NASA NSSDCA: 23 cm. */
  wheelWidthM: 0.23,
  /** Ground clearance, fully loaded, m — NASA NSSDCA: 36 cm. */
  groundClearanceM: 0.36,
  /** Max height, m — NASA NSSDCA: 1.14 m. */
  heightM: 1.14,
  /** Vehicle mass (unloaded), kg — NASA NSSDCA: 210 kg. */
  massKg: 210,
  /** Steering radius, m — NASA NSSDCA: 3.1 m (front+rear steer). */
  steeringRadiusM: 3.1,
  /** Designed top speed, km/h — 8 mph (13 km/h). Apollo 17 achieved
   *  18 km/h (11.2 mph); the drive HUD lets the driver raise the cap
   *  to that achieved figure, but 13 km/h is the design limit. */
  topSpeedKmh: 13,
  /** Fastest speed actually achieved (Apollo 17), km/h. */
  achievedTopSpeedKmh: 18,
};

export const WHEEL_RADIUS_M = LRV.wheelDiameterM / 2;

/** Driving feel — APPROXIMATIONS, not NASA figures (see ROVER.md). */
export const DRIVE_TUNING = {
  /** Full-throttle acceleration, m/s². */
  accelMs2: 1.2,
  /** Reverse acceleration, m/s². */
  reverseAccelMs2: 0.8,
  /** Max reverse speed, m/s (≈ 5.4 km/h). */
  maxReverseMs: 1.5,
  /** Braking deceleration (Space / brake button), m/s². */
  brakeMs2: 3.0,
  /** Natural rolling drag when no input, m/s². */
  dragMs2: 0.4,
  /** Max front-wheel steer angle, rad (≈ 34°). */
  maxSteerRad: 0.6,
  /** How fast the steer angle follows the input, 1/s. */
  steerRatePerSec: 4,
};

/**
 * Terrain plug-in — Step 2 replaces this with a real DEM lookup.
 * Signature: (latDeg, lonDeg) => height in metres above the local
 * mean surface. Today: smooth sphere, always 0.
 */
let heightFn = () => 0;

/** Override the terrain height function (Step 2 DEM, or tests). */
export function setSurfaceHeightAt(fn) {
  heightFn = typeof fn === 'function' ? fn : () => 0;
}

/** Restore the smooth-sphere terrain. */
export function resetSurfaceHeightAt() {
  heightFn = () => 0;
}

/** Height (m) of the surface at a selenographic lat/lon. */
export function surfaceHeightAt(latDeg, lonDeg) {
  return heightFn(latDeg, lonDeg);
}

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

function wrapAngle(rad) {
  let a = rad % (2 * Math.PI);
  if (a < 0) a += 2 * Math.PI;
  return a;
}

/** Local tangent-plane metres → selenographic lat/lon (deg). */
export function localToLatLon(siteLatDeg, siteLonDeg, northM, eastM) {
  const lat = siteLatDeg + (northM / MOON_RADIUS_M) * R2D;
  const cosLat = Math.cos(siteLatDeg * D2R);
  const lon = siteLonDeg + (eastM / (MOON_RADIUS_M * cosLat)) * R2D;
  return { lat, lon };
}

/** Selenographic lat/lon → local tangent-plane metres from a site. */
export function latLonToLocal(siteLatDeg, siteLonDeg, latDeg, lonDeg) {
  const northM = (latDeg - siteLatDeg) * D2R * MOON_RADIUS_M;
  const eastM = (lonDeg - siteLonDeg) * D2R * MOON_RADIUS_M * Math.cos(siteLatDeg * D2R);
  return { northM, eastM };
}

/**
 * Surface slope at a lat/lon, by finite differences of surfaceHeightAt.
 * Returns { alongNorth, alongEast } — rise per metre (dimensionless
 * gradient) in the north and east directions. Step is 1 m.
 */
export function slopeAt(latDeg, lonDeg, stepM = 1) {
  const dLat = (stepM / MOON_RADIUS_M) * R2D;
  const cosLat = Math.cos(latDeg * D2R);
  const dLon = (stepM / (MOON_RADIUS_M * cosLat)) * R2D;
  const hN = surfaceHeightAt(latDeg + dLat, lonDeg);
  const hS = surfaceHeightAt(latDeg - dLat, lonDeg);
  const hE = surfaceHeightAt(latDeg, lonDeg + dLon);
  const hW = surfaceHeightAt(latDeg, lonDeg - dLon);
  return {
    alongNorth: (hN - hS) / (2 * stepM),
    alongEast: (hE - hW) / (2 * stepM),
  };
}

/** Straight-line distance (m) from the landing point. */
export function distanceFromStart(northM, eastM) {
  return Math.hypot(northM, eastM);
}

/** Fresh rover state at a site. Heading 0 = facing north. */
export function createRover(site, opts = {}) {
  const maxSpeedKmh = opts.maxSpeedKmh ?? LRV.topSpeedKmh;
  return {
    siteLat: site.lat,
    siteLon: site.lon,
    siteId: site.id,
    northM: 0,
    eastM: 0,
    headingRad: 0,
    speedMs: 0,
    steerRad: 0,
    wheelAngleRad: 0,
    heightM: surfaceHeightAt(site.lat, site.lon),
    pitchRad: 0,
    rollRad: 0,
    maxSpeedMs: (maxSpeedKmh * 1000) / 3600,
    maxSpeedKmh,
  };
}

/**
 * One physics step (mutates and returns `state`).
 *
 * input: { throttle 0..1 (forward), reverse 0..1, steer -1..1
 *          (positive = turn right / clockwise), brake bool }
 * dt: seconds (clamped to 0..0.25 — the bicycle model is stable at
 * that step, and the clamp keeps software-rendered / low-fps frames
 * from losing most of the simulated time).
 *
 * Bicycle model: heading rate = speed / wheelbase * tan(steer).
 * Wheel spin: d(wheelAngle) = speed / wheelRadius * dt.
 */
export function step(state, input = {}, dt = 1 / 60) {
  const dtc = Math.max(0, Math.min(dt, 0.25));
  const t = DRIVE_TUNING;
  const throttle = Math.max(0, Math.min(1, input.throttle ?? 0));
  const reverse = Math.max(0, Math.min(1, input.reverse ?? 0));
  const steerIn = Math.max(-1, Math.min(1, input.steer ?? 0));

  // Steering follows the input with a finite rate (no instant snap).
  const targetSteer = steerIn * t.maxSteerRad;
  const maxDelta = t.steerRatePerSec * dtc;
  state.steerRad += Math.max(-maxDelta, Math.min(maxDelta, targetSteer - state.steerRad));

  // Longitudinal: throttle / reverse / brake / drag.
  if (input.brake) {
    const dec = t.brakeMs2 * dtc;
    state.speedMs = Math.abs(state.speedMs) <= dec ? 0 : state.speedMs - Math.sign(state.speedMs) * dec;
  } else {
    if (throttle > 0) state.speedMs += t.accelMs2 * throttle * dtc;
    if (reverse > 0) state.speedMs -= t.reverseAccelMs2 * reverse * dtc;
    if (throttle === 0 && reverse === 0 && state.speedMs !== 0) {
      const dec = t.dragMs2 * dtc;
      state.speedMs = Math.abs(state.speedMs) <= dec ? 0 : state.speedMs - Math.sign(state.speedMs) * dec;
    }
  }
  state.speedMs = Math.max(-t.maxReverseMs, Math.min(state.maxSpeedMs, state.speedMs));

  // Bicycle-model heading + position (heading clockwise from north).
  if (state.speedMs !== 0 && state.steerRad !== 0) {
    state.headingRad = wrapAngle(
      state.headingRad + (state.speedMs / LRV.wheelbaseM) * Math.tan(state.steerRad) * dtc,
    );
  }
  state.northM += state.speedMs * Math.cos(state.headingRad) * dtc;
  state.eastM += state.speedMs * Math.sin(state.headingRad) * dtc;

  // Wheel spin.
  state.wheelAngleRad = wrapAngle(state.wheelAngleRad + (state.speedMs / WHEEL_RADIUS_M) * dtc);

  // Terrain following: height + pitch/roll from the surface at the
  // rover's CURRENT lat/lon (so a Step 2 DEM moves the rover).
  const pos = roverLatLon(state);
  state.heightM = surfaceHeightAt(pos.lat, pos.lon);
  const slope = slopeAt(pos.lat, pos.lon);
  // Slope along the heading (nose-up positive) and across it.
  const along = slope.alongNorth * Math.cos(state.headingRad)
    + slope.alongEast * Math.sin(state.headingRad);
  const across = -slope.alongNorth * Math.sin(state.headingRad)
    + slope.alongEast * Math.cos(state.headingRad);
  state.pitchRad = Math.atan(along);
  state.rollRad = Math.atan(across);

  return state;
}

/** Rover's current selenographic position. */
export function roverLatLon(state) {
  return localToLatLon(state.siteLat, state.siteLon, state.northM, state.eastM);
}

/** Heading in degrees, 0–360, clockwise from north. */
export function headingDeg(state) {
  return wrapAngle(state.headingRad) * R2D;
}

/** Speed in km/h. */
export function speedKmh(state) {
  return state.speedMs * 3.6;
}

/**
 * Live Sun/Earth + POWER/COMM at the rover's CURRENT position
 * (not the landing site's) — the Drive HUD calls this.
 * `horizonProfile` is the LANDING-SITE profile (the rover's own
 * horizon as it drives is approximated by it — the HUD says so).
 * With a profile the verdicts are terrain-aware; with null they
 * are the flat 0° rule. Returns { lat, lon, sun, earth, power,
 * comm, sunHorizonDeg, earthHorizonDeg } (horizon degrees null
 * when flat).
 */
export function roverVerdict(date, state, { powerVerdict, commVerdict, horizonProfile = null }) {
  const { lat, lon } = roverLatLon(state);
  const pos = sunEarthAt(date, lat, lon);
  return {
    lat,
    lon,
    sun: pos.sun,
    earth: pos.earth,
    sunHorizonDeg: horizonProfile ? horizonAt(horizonProfile, pos.sun.az) : null,
    earthHorizonDeg: horizonProfile ? horizonAt(horizonProfile, pos.earth.az) : null,
    power: powerVerdict(pos.sun.alt, pos.sun.az, horizonProfile),
    comm: commVerdict(pos.earth.alt, pos.earth.az, horizonProfile),
  };
}
