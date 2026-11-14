/**
 * RoverEffects tests — wheel dust + wheel tracks (illustrative).
 *
 * Both classes are pure logic around three.js objects (no renderer,
 * no DOM), so these run in jsdom. The dust uses an injected
 * deterministic rng (`() => 0.5`) so spawn positions/velocities are
 * repeatable; the tracks use a flat or stepped height function.
 */
import { DustSystem, TrackTrail, DUST, TRACKS } from './RoverEffects.js';
import { LRV } from '../lib/rover.js';

/** Parked rover at the origin, flat ground. */
const parked = (over = {}) => ({
  speedMs: 0, headingRad: 0, northM: 0, eastM: 0, heightM: 0, ...over,
});
/** Driving north at ~13 km/h. */
const driving = (over = {}) => parked({ speedMs: 3.6, ...over });

function stepDust(dust, rover, seconds, dt = 1 / 60) {
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) dust.update(dt, rover);
}

describe('DustSystem', () => {
  it('starts empty — no live particles, all sprites hidden', () => {
    const dust = new DustSystem({ rng: () => 0.5 });
    expect(dust.activeCount).toBe(0);
    for (const s of dust.sprites) expect(s.visible).toBe(false);
    expect(dust.sprites).toHaveLength(DUST.maxParticles);
  });

  it('kicks up nothing while parked', () => {
    const dust = new DustSystem({ rng: () => 0.5 });
    stepDust(dust, parked(), 2);
    expect(dust.activeCount).toBe(0);
  });

  it('kicks up dust while driving, and it fades out after stopping', () => {
    const dust = new DustSystem({ rng: () => 0.5 });
    stepDust(dust, driving(), 1);
    expect(dust.activeCount).toBeGreaterThan(0);
    expect(dust.activeCount).toBeLessThanOrEqual(DUST.maxParticles);
    stepDust(dust, parked(), 2);
    expect(dust.activeCount).toBe(0);
    for (const s of dust.sprites) expect(s.visible).toBe(false);
  });

  it('also kicks up dust in reverse', () => {
    const dust = new DustSystem({ rng: () => 0.5 });
    stepDust(dust, driving({ speedMs: -1.5 }), 1);
    expect(dust.activeCount).toBeGreaterThan(0);
  });

  it('spawns at the rear wheel contact points', () => {
    const dust = new DustSystem({ rng: () => 0.5 });
    const rover = driving({ northM: 10, eastM: 5, headingRad: 0 });
    dust.update(0.25, rover); // spawns several particles at once
    expect(dust.activeCount).toBeGreaterThan(0);
    const wheels = dust.wheelContactPoints(rover);
    for (const p of dust.particles) {
      if (p.life <= 0) continue;
      // Within ~1 m of a rear wheel (spawn point + one step of drift).
      const near = wheels.some((w) => Math.hypot(p.pos.x - w.east, p.pos.z - w.north) < 1.5);
      expect(near).toBe(true);
    }
    // Rear wheels sit half a wheelbase BEHIND the rover centre.
    expect(wheels[0].north).toBeCloseTo(10 - LRV.wheelbaseM / 2, 6);
    expect(Math.abs(wheels[0].east - 5)).toBeCloseTo(LRV.trackM / 2, 6);
  });

  it('particles never sink below the ground, even on high terrain', () => {
    const dust = new DustSystem({ rng: () => 0.5 });
    const rover = driving({ heightM: 5 });
    stepDust(dust, rover, 2);
    for (const p of dust.particles) {
      if (p.life > 0) expect(p.pos.y).toBeGreaterThanOrEqual(5 - 1e-9);
    }
  });

  it('dust trails behind the motion (velocity points backwards)', () => {
    const dust = new DustSystem({ rng: () => 0.5 });
    const rover = driving({ headingRad: 0 }); // driving north
    dust.update(0.25, rover);
    for (const p of dust.particles) {
      if (p.life <= 0) continue;
      // Northward motion → dust kicked south (negative z), plus up.
      expect(p.vel.z).toBeLessThan(0.5);
      expect(p.vel.y).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('TrackTrail', () => {
  it('lays no further track without movement (first update is the initial sample)', () => {
    const trail = new TrackTrail();
    expect(trail.update(parked())).toBe(true); // initial sample at the start
    expect(trail.count).toBe(1);
    expect(trail.update(parked())).toBe(false);
    expect(trail.update(parked({ northM: 0.5 }))).toBe(false);
    expect(trail.count).toBe(1);
  });

  it('samples only after the rover moved the sample distance', () => {
    const trail = new TrackTrail();
    expect(trail.update(parked({ northM: 0 }))).toBe(true); // first sample
    expect(trail.update(parked({ northM: 0.5 }))).toBe(false);
    expect(trail.update(parked({ northM: 0.74 }))).toBe(false);
    expect(trail.update(parked({ northM: 0.8 }))).toBe(true);
    expect(trail.count).toBe(2);
  });

  it('lays two strips at the wheel lines, one wheel-width wide', () => {
    const trail = new TrackTrail();
    trail.update(parked({ northM: 0, eastM: 0, headingRad: 0 }));
    trail.update(parked({ northM: 1, eastM: 0, headingRad: 0 }));
    expect(trail.count).toBe(2);
    // Side −1 strip: centred at x = −track/2, ± wheelWidth/2.
    const left = trail.strips[0].positions;
    expect(left[0]).toBeCloseTo(-LRV.trackM / 2 - LRV.wheelWidthM / 2, 6);
    expect(left[3]).toBeCloseTo(-LRV.trackM / 2 + LRV.wheelWidthM / 2, 6);
    // Side +1 strip: centred at x = +track/2.
    const right = trail.strips[1].positions;
    expect(right[0]).toBeCloseTo(LRV.trackM / 2 - LRV.wheelWidthM / 2, 6);
    expect(right[3]).toBeCloseTo(LRV.trackM / 2 + LRV.wheelWidthM / 2, 6);
    // Lifted just above the flat ground, and the strip draws 1 segment.
    expect(left[1]).toBeCloseTo(TRACKS.liftM, 6);
    expect(trail.strips[0].mesh.geometry.drawRange.count).toBe(6);
  });

  it('follows the terrain height function', () => {
    const trail = new TrackTrail({ heightAtLocal: () => 3 });
    trail.update(parked({ northM: 0, eastM: 0, headingRad: 0 }));
    trail.update(parked({ northM: 1, eastM: 0, headingRad: 0 }));
    expect(trail.strips[0].positions[1]).toBeCloseTo(3 + TRACKS.liftM, 6);
  });

  it('caps the trail at maxSamples', () => {
    const trail = new TrackTrail({ maxSamples: 5 });
    for (let i = 0; i < 20; i++) {
      trail.update(parked({ northM: i * 1, eastM: 0, headingRad: 0 }));
    }
    expect(trail.count).toBe(5);
    // Draw range never exceeds the cap.
    expect(trail.strips[0].mesh.geometry.drawRange.count).toBeLessThanOrEqual((5 - 1) * 6);
  });

  it('reset clears the trail', () => {
    const trail = new TrackTrail();
    trail.update(parked({ northM: 0, eastM: 0, headingRad: 0 }));
    trail.update(parked({ northM: 1, eastM: 0, headingRad: 0 }));
    expect(trail.count).toBe(2);
    trail.reset();
    expect(trail.count).toBe(0);
    expect(trail.strips[0].mesh.geometry.drawRange.count).toBe(0);
    expect(trail.update(parked({ northM: 0, eastM: 0, headingRad: 0 }))).toBe(true);
  });
});
