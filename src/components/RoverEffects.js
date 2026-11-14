/**
 * RoverEffects — wheel dust + wheel tracks for Drive mode.
 *
 * Both effects are ILLUSTRATIVE, not regolith physics: the rover
 * physics is a kinematic approximation (no slip, no sinkage — see
 * ROVER.md), so the dust is a visual puff at the rear wheels and the
 * tracks are dark ribbons laid along the driven path. The HUD and
 * Evidence say so. They are cheap on purpose: a fixed pool of
 * sprites for dust (no per-frame allocation) and two pre-allocated
 * ribbon meshes for the tracks, capped at a few hundred samples.
 *
 * Pure-logic classes around three.js objects — no renderer, no DOM —
 * so they are unit-testable in jsdom (see RoverEffects.test.js).
 * `heightAtLocal(northM, eastM)` plugs the real DEM in (the track
 * ribbon follows the terrain); it defaults to flat ground.
 */
import * as THREE from 'three';
import { LRV } from '../lib/rover.js';

/** Soft radial sprite texture, built from raw bytes — no canvas/DOM. */
function makeDustTexture(size = 64) {
  const data = new Uint8Array(size * size * 4);
  const c = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - c + 0.5, y - c + 0.5) / c; // 0 centre → 1 edge
      const a = Math.max(0, 1 - d);
      const i = (y * size + x) * 4;
      data[i] = 154; // regolith grey
      data[i + 1] = 151;
      data[i + 2] = 143;
      data[i + 3] = Math.round(a * a * 255);
    }
  }
  const tex = new THREE.DataTexture(data, size, size);
  tex.needsUpdate = true;
  return tex;
}

export const DUST = {
  /** Fixed sprite pool — no allocation while driving. */
  maxParticles: 48,
  /** A puff lives this long before fading out entirely. */
  lifeSec: 1.2,
  /** Particles spawned per metre driven (at 3.6 m/s ≈ 22/s). */
  spawnPerMetre: 6,
  /** Speed below which the wheels kick up nothing. */
  minSpeedMs: 0.5,
  /** Lunar gravity — dust falls on ballistic arcs, no air to hang in. */
  gravityMs2: 1.62,
  /** Peak sprite opacity. */
  baseOpacity: 0.5,
};

/**
 * Dust kicked up at the REAR wheel contact points while driving.
 * `update(dt, rover)` with rover `{ speedMs, headingRad, northM,
 * eastM, heightM }` (the physics state — local frame x = east,
 * z = north, y = up). Returns the live particle count.
 */
export class DustSystem {
  constructor({ maxParticles = DUST.maxParticles, rng = Math.random } = {}) {
    this.maxParticles = maxParticles;
    this.rng = rng;
    this.group = new THREE.Group();
    this.group.name = 'rover-dust';
    this.texture = makeDustTexture();
    this.particles = [];
    this.sprites = [];
    for (let i = 0; i < maxParticles; i++) {
      const mat = new THREE.SpriteMaterial({
        map: this.texture, transparent: true, opacity: 0, depthWrite: false,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.visible = false;
      this.group.add(sprite);
      this.sprites.push(sprite);
      this.particles.push({
        pos: new THREE.Vector3(), vel: new THREE.Vector3(),
        life: 0, maxLife: DUST.lifeSec, size: 0.5,
      });
    }
    this.spawnAcc = 0;
    this.cursor = 0;
  }

  get activeCount() {
    let n = 0;
    for (const p of this.particles) if (p.life > 0) n++;
    return n;
  }

  /** Rear wheel contact points in the local frame (x = east, z = north). */
  wheelContactPoints({ headingRad, northM, eastM, heightM }) {
    const fwd = { east: Math.sin(headingRad), north: Math.cos(headingRad) };
    const right = { east: Math.cos(headingRad), north: -Math.sin(headingRad) };
    const halfTrack = LRV.trackM / 2;
    const halfBase = LRV.wheelbaseM / 2;
    return [-1, 1].map((side) => ({
      east: eastM + right.east * (side * halfTrack) + fwd.east * (-halfBase),
      north: northM + right.north * (side * halfTrack) + fwd.north * (-halfBase),
      up: heightM,
    }));
  }

  spawn(rover) {
    const p = this.particles[this.cursor];
    this.cursor = (this.cursor + 1) % this.maxParticles;
    const points = this.wheelContactPoints(rover);
    const at = points[Math.floor(this.rng() * points.length)];
    const fwd = { east: Math.sin(rover.headingRad), north: Math.cos(rover.headingRad) };
    const right = { east: Math.cos(rover.headingRad), north: -Math.sin(rover.headingRad) };
    const dir = Math.sign(rover.speedMs) || 1; // dust trails behind the motion
    p.pos.set(at.east, at.up + 0.1, at.north);
    // Kicked backwards relative to the motion, up, and slightly out.
    p.vel.set(
      -fwd.east * dir * (0.4 + this.rng() * 0.8) + right.east * (this.rng() - 0.5) * 0.6,
      0.3 + this.rng() * 0.7,
      -fwd.north * dir * (0.4 + this.rng() * 0.8) + right.north * (this.rng() - 0.5) * 0.6,
    );
    // A share of the rover's own velocity, so the puff starts with the wheel.
    p.vel.x += fwd.east * rover.speedMs * 0.2;
    p.vel.z += fwd.north * rover.speedMs * 0.2;
    p.life = DUST.lifeSec * (0.8 + this.rng() * 0.4);
    p.maxLife = p.life;
    p.size = 0.35 + this.rng() * 0.35;
  }

  update(dt, rover) {
    const speed = Math.abs(rover.speedMs);
    if (speed > DUST.minSpeedMs) {
      this.spawnAcc += dt * speed * DUST.spawnPerMetre;
      while (this.spawnAcc >= 1) {
        this.spawnAcc -= 1;
        this.spawn(rover);
      }
    }
    for (let i = 0; i < this.maxParticles; i++) {
      const p = this.particles[i];
      const sprite = this.sprites[i];
      if (p.life <= 0) {
        sprite.visible = false;
        continue;
      }
      p.life -= dt;
      if (p.life <= 0) {
        sprite.visible = false;
        continue;
      }
      p.vel.y -= DUST.gravityMs2 * dt;
      p.pos.addScaledVector(p.vel, dt);
      // Settle on the ground instead of sinking through it.
      if (p.pos.y < rover.heightM) {
        p.pos.y = rover.heightM;
        p.vel.y = 0;
        p.vel.multiplyScalar(0.9);
      }
      const fade = p.life / p.maxLife;
      sprite.visible = true;
      sprite.position.copy(p.pos);
      const grow = 1 + (1 - fade) * 1.5;
      sprite.scale.setScalar(p.size * grow);
      sprite.material.opacity = DUST.baseOpacity * fade;
    }
    return this.activeCount;
  }
}

export const TRACKS = {
  /** Longest trail kept — 400 samples × 0.75 m ≈ 300 m of driving. */
  maxSamples: 400,
  /** New sample only after the rover moved this far (m). */
  sampleDistanceM: 0.75,
  /** Ribbon lift above the terrain, so it is never z-buried. */
  liftM: 0.06,
};

/**
 * Wheel tracks: one dark ribbon per side, laid along the driven path
 * at the wheel lines (±track/2, one wheel-width wide each), following
 * the terrain via `heightAtLocal(northM, eastM)`.
 * `update(rover)` appends a sample when the rover moved far enough;
 * returns true when a sample was added.
 */
export class TrackTrail {
  constructor({
    maxSamples = TRACKS.maxSamples,
    sampleDistanceM = TRACKS.sampleDistanceM,
    heightAtLocal = () => 0,
  } = {}) {
    this.maxSamples = maxSamples;
    this.sampleDistanceM = sampleDistanceM;
    this.heightAtLocal = heightAtLocal;
    this.group = new THREE.Group();
    this.group.name = 'rover-tracks';
    this.samples = [];
    this.strips = [];
    for (const side of [-1, 1]) {
      const geo = new THREE.BufferGeometry();
      const positions = new Float32Array(maxSamples * 2 * 3);
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const index = [];
      for (let i = 0; i < maxSamples - 1; i++) {
        const a = i * 2;
        const b = i * 2 + 1;
        const c = i * 2 + 2;
        const d = i * 2 + 3;
        index.push(a, b, c, b, d, c);
      }
      geo.setIndex(index);
      geo.setDrawRange(0, 0);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x4a4741, transparent: true, opacity: 0.55,
        side: THREE.DoubleSide, depthWrite: false,
        polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false; // positions change; never cull wrongly
      this.group.add(mesh);
      this.strips.push({ mesh, side, positions });
    }
  }

  get count() {
    return this.samples.length;
  }

  update({ northM, eastM, headingRad }) {
    const last = this.samples[this.samples.length - 1];
    if (last && Math.hypot(northM - last.northM, eastM - last.eastM) < this.sampleDistanceM) {
      return false;
    }
    this.samples.push({ northM, eastM, headingRad });
    if (this.samples.length > this.maxSamples) this.samples.shift();
    this.rebuild();
    return true;
  }

  rebuild() {
    const n = this.samples.length;
    const halfWidth = LRV.wheelWidthM / 2;
    const halfTrack = LRV.trackM / 2;
    for (const { mesh, side, positions } of this.strips) {
      for (let i = 0; i < n; i++) {
        const s = this.samples[i];
        // Right vector in (east, north) for this heading.
        const rx = Math.cos(s.headingRad);
        const rz = -Math.sin(s.headingRad);
        const cx = s.eastM + rx * (side * halfTrack);
        const cz = s.northM + rz * (side * halfTrack);
        const y = this.heightAtLocal(s.northM, s.eastM) + TRACKS.liftM;
        const o = i * 6;
        positions[o] = cx - rx * halfWidth;
        positions[o + 1] = y;
        positions[o + 2] = cz - rz * halfWidth;
        positions[o + 3] = cx + rx * halfWidth;
        positions[o + 4] = y;
        positions[o + 5] = cz + rz * halfWidth;
      }
      mesh.geometry.attributes.position.needsUpdate = true;
      mesh.geometry.setDrawRange(0, n < 2 ? 0 : (n - 1) * 6);
    }
  }

  reset() {
    this.samples = [];
    for (const { mesh } of this.strips) {
      mesh.geometry.setDrawRange(0, 0);
    }
  }
}
