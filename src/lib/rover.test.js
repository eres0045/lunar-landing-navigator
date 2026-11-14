/**
 * rover.test.js — Drive-mode physics (src/lib/rover.js).
 *
 * Pure kinematic bicycle model: forward/reverse motion, steering
 * sign + magnitude, heading wrap, braking, wheel spin, terrain
 * following via the surfaceHeightAt plug-in, and the local
 * tangent-plane lat/lon conversion (100 m north ≈ +0.0033° lat).
 */
import { describe, it, expect, afterEach } from 'vitest';
import {
  LRV, WHEEL_RADIUS_M, DRIVE_TUNING,
  createRover, step, localToLatLon, latLonToLocal,
  surfaceHeightAt, setSurfaceHeightAt, resetSurfaceHeightAt,
  slopeAt, distanceFromStart, headingDeg, speedKmh, roverLatLon,
} from './rover.js';

const SITE = { id: 'malapert', lat: -85.99, lon: -0.125 };

function drive(state, input, seconds, dt = 1 / 60) {
  const n = Math.round(seconds / dt);
  for (let i = 0; i < n; i++) step(state, input, dt);
  return state;
}

afterEach(() => resetSurfaceHeightAt());

describe('LRV constants — verified published dimensions', () => {
  it('matches NASA NSSDCA / LRV Operations Handbook figures', () => {
    expect(LRV.lengthM).toBeCloseTo(3.1, 5);
    expect(LRV.wheelbaseM).toBeCloseTo(2.29, 5);
    expect(LRV.trackM).toBeCloseTo(1.83, 5);
    expect(LRV.wheelDiameterM).toBeCloseTo(0.818, 5);
    expect(LRV.wheelWidthM).toBeCloseTo(0.23, 5);
    expect(LRV.groundClearanceM).toBeCloseTo(0.36, 5);
    expect(LRV.heightM).toBeCloseTo(1.14, 5);
    expect(LRV.massKg).toBe(210);
    expect(LRV.topSpeedKmh).toBe(13);
    expect(LRV.achievedTopSpeedKmh).toBe(18);
    expect(WHEEL_RADIUS_M).toBeCloseTo(0.409, 5);
  });
});

describe('createRover', () => {
  it('starts at the site, stopped, facing north, on the surface', () => {
    const r = createRover(SITE);
    expect(r.northM).toBe(0);
    expect(r.eastM).toBe(0);
    expect(r.speedMs).toBe(0);
    expect(r.headingRad).toBe(0);
    expect(r.heightM).toBe(0);
    expect(r.maxSpeedMs).toBeCloseTo((13 * 1000) / 3600, 5);
  });
});

describe('forward motion', () => {
  it('full throttle moves north along heading 0 and gains speed', () => {
    const r = createRover(SITE);
    drive(r, { throttle: 1 }, 2);
    expect(r.speedMs).toBeGreaterThan(0);
    expect(r.northM).toBeGreaterThan(1);
    expect(r.eastM).toBeCloseTo(0, 9);
    expect(distanceFromStart(r.northM, r.eastM)).toBeCloseTo(r.northM, 9);
  });

  it('heading 90° (east) moves east, not north', () => {
    const r = createRover(SITE);
    r.headingRad = Math.PI / 2;
    drive(r, { throttle: 1 }, 2);
    expect(r.eastM).toBeGreaterThan(1);
    expect(r.northM).toBeCloseTo(0, 6);
  });

  it('speed never exceeds the configured max speed', () => {
    const r = createRover(SITE);
    drive(r, { throttle: 1 }, 30);
    expect(r.speedMs).toBeLessThanOrEqual(r.maxSpeedMs + 1e-9);
    expect(speedKmh(r)).toBeCloseTo(13, 1);
  });

  it('a lower max-speed cap is honoured', () => {
    const r = createRover(SITE, { maxSpeedKmh: 5 });
    drive(r, { throttle: 1 }, 30);
    expect(speedKmh(r)).toBeCloseTo(5, 1);
  });
});

describe('reverse', () => {
  it('reverse moves backwards along the heading', () => {
    const r = createRover(SITE);
    drive(r, { reverse: 1 }, 2);
    expect(r.speedMs).toBeLessThan(0);
    expect(r.northM).toBeLessThan(-0.5);
  });

  it('reverse speed is capped at the reverse limit', () => {
    const r = createRover(SITE);
    drive(r, { reverse: 1 }, 30);
    expect(r.speedMs).toBeGreaterThanOrEqual(-DRIVE_TUNING.maxReverseMs - 1e-9);
  });
});

describe('steering — bicycle model', () => {
  it('right steer while moving forward turns the heading clockwise (eastward)', () => {
    const r = createRover(SITE);
    r.speedMs = 2;
    const before = r.headingRad;
    drive(r, { throttle: 0.5, steer: 1 }, 1);
    expect(r.headingRad).toBeGreaterThan(before);
  });

  it('left steer turns the heading counter-clockwise', () => {
    const r = createRover(SITE);
    r.speedMs = 2;
    drive(r, { throttle: 0.5, steer: -1 }, 1);
    expect(headingDeg(r)).toBeGreaterThan(270);
  });

  it('heading rate matches speed/wheelbase * tan(steer)', () => {
    const r = createRover(SITE);
    r.speedMs = 2;
    // Hold steer input at 0.5 (target steer 0.3 rad); the steer angle
    // ramps to target in ~0.08 s, then the heading rate settles at
    // speed/wheelbase * tan(0.3) ≈ 0.27 rad/s.
    drive(r, { throttle: 0.5, steer: 0.5 }, 0.5);
    const rate = (2 / LRV.wheelbaseM) * Math.tan(0.3);
    expect(r.headingRad).toBeGreaterThan(rate * 0.3);
    expect(r.headingRad).toBeLessThan(rate * 0.6);
  });

  it('no steering input at speed keeps the heading', () => {
    const r = createRover(SITE);
    r.speedMs = 2;
    drive(r, { throttle: 0.5 }, 1);
    expect(r.headingRad).toBeCloseTo(0, 9);
  });

  it('steering at a standstill does not change the heading', () => {
    const r = createRover(SITE);
    drive(r, { steer: 1 }, 1);
    expect(r.headingRad).toBe(0);
  });
});

describe('heading wrap', () => {
  it('heading wraps 0–360° past north', () => {
    const r = createRover(SITE);
    r.headingRad = 6.27; // just below 2π
    r.speedMs = 3;
    r.steerRad = 0.5;
    // dt is clamped to 0.25 s inside step(); one step still turns
    // ~0.22 rad — enough to cross 2π and wrap.
    step(r, { throttle: 1, steer: 1 }, 1);
    expect(r.headingRad).toBeGreaterThanOrEqual(0);
    expect(r.headingRad).toBeLessThan(2 * Math.PI);
    expect(r.headingRad).toBeLessThan(0.5); // wrapped, just past north
    expect(headingDeg(r)).toBeGreaterThanOrEqual(0);
    expect(headingDeg(r)).toBeLessThan(360);
  });

  it('headingDeg reports east as 90°', () => {
    const r = createRover(SITE);
    r.headingRad = Math.PI / 2;
    expect(headingDeg(r)).toBeCloseTo(90, 9);
  });
});

describe('braking and drag', () => {
  it('brake brings a moving rover to a full stop', () => {
    const r = createRover(SITE);
    drive(r, { throttle: 1 }, 3);
    expect(r.speedMs).toBeGreaterThan(2);
    drive(r, { brake: true }, 3);
    expect(r.speedMs).toBe(0);
  });

  it('braking from reverse also stops', () => {
    const r = createRover(SITE);
    drive(r, { reverse: 1 }, 2);
    drive(r, { brake: true }, 2);
    expect(r.speedMs).toBe(0);
  });

  it('coasting decays speed via drag but does not reverse', () => {
    const r = createRover(SITE);
    drive(r, { throttle: 1 }, 1);
    const v = r.speedMs;
    drive(r, {}, 1);
    expect(r.speedMs).toBeGreaterThanOrEqual(0);
    expect(r.speedMs).toBeLessThan(v);
  });
});

describe('wheel rotation', () => {
  it('wheel angle advances at speed / wheelRadius', () => {
    const r = createRover(SITE);
    r.speedMs = 2;
    // dt is clamped to 0.25 s: spin ≈ (2 / 0.409) * 0.25 ≈ 1.22 rad.
    step(r, {}, 1);
    expect(r.wheelAngleRad).toBeGreaterThan(1.0);
    expect(r.wheelAngleRad).toBeLessThan(1.25);
  });

  it('wheel angle is stationary when the rover is stopped', () => {
    const r = createRover(SITE);
    step(r, {}, 1);
    expect(r.wheelAngleRad).toBe(0);
  });

  it('reversing spins the wheels backwards', () => {
    const r = createRover(SITE);
    r.speedMs = -1;
    // dt clamped to 0.25 s: spin ≈ −0.66 rad, wrapped into (π, 2π).
    step(r, { reverse: 1 }, 1);
    expect(r.wheelAngleRad).toBeGreaterThan(Math.PI);
    expect(r.wheelAngleRad).toBeLessThan(2 * Math.PI);
  });
});

describe('terrain following (surfaceHeightAt plug-in)', () => {
  it('surfaceHeightAt returns 0 on the smooth sphere by default', () => {
    expect(surfaceHeightAt(-85.99, -0.125)).toBe(0);
    expect(slopeAt(-85.99, -0.125).alongNorth).toBe(0);
    expect(slopeAt(-85.99, -0.125).alongEast).toBe(0);
  });

  it('an injected height function moves the rover height + pitch/roll', () => {
    // A plane rising 1 m per 100 m to the north: slope 0.01.
    setSurfaceHeightAt((lat, lon) => {
      const { northM } = latLonToLocal(SITE.lat, SITE.lon, lat, lon);
      return 0.01 * northM + 5;
    });
    const r = createRover(SITE);
    expect(r.heightM).toBeCloseTo(5, 6);
    step(r, {}, 0.01);
    expect(r.heightM).toBeCloseTo(5, 6);
    // Facing north on a north-rising plane: pitch ≈ atan(0.01), no roll.
    expect(r.pitchRad).toBeCloseTo(Math.atan(0.01), 3);
    expect(r.rollRad).toBeCloseTo(0, 3);
    // Facing east, the same plane is across the rover: roll, no pitch.
    r.headingRad = Math.PI / 2;
    step(r, {}, 0.01);
    expect(r.pitchRad).toBeCloseTo(0, 3);
    expect(r.rollRad).toBeCloseTo(-Math.atan(0.01), 3);
  });

  it('driving up the injected slope raises the rover height', () => {
    setSurfaceHeightAt((lat, lon) => {
      const { northM } = latLonToLocal(SITE.lat, SITE.lon, lat, lon);
      return 0.05 * northM;
    });
    const r = createRover(SITE);
    drive(r, { throttle: 1 }, 3);
    expect(r.northM).toBeGreaterThan(2);
    expect(r.heightM).toBeCloseTo(0.05 * r.northM, 2);
  });
});

describe('localToLatLon', () => {
  it('100 m north ≈ +0.0033° latitude', () => {
    const p = localToLatLon(SITE.lat, SITE.lon, 100, 0);
    expect(p.lat - SITE.lat).toBeCloseTo(0.0033, 3);
    expect(p.lon).toBeCloseTo(SITE.lon, 9);
  });

  it('round-trips through latLonToLocal', () => {
    const p = localToLatLon(SITE.lat, SITE.lon, 123.4, -56.7);
    const back = latLonToLocal(SITE.lat, SITE.lon, p.lat, p.lon);
    expect(back.northM).toBeCloseTo(123.4, 6);
    expect(back.eastM).toBeCloseTo(-56.7, 6);
  });

  it('roverLatLon follows the rover state', () => {
    const r = createRover(SITE);
    r.northM = 100;
    r.eastM = 50;
    const p = roverLatLon(r);
    expect(p.lat).toBeCloseTo(SITE.lat + 0.0033, 3);
    expect(p.lon).toBeGreaterThan(SITE.lon);
  });
});
