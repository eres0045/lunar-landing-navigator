/**
 * RoverModel tests — the real-LRV GLB wiring + the code-built fallback.
 *
 * `wireRealRover` takes a loaded GLB scene and returns the
 * `{ group, wheels, steerGroups }` shape the animation loop uses, so
 * the tests build a fake scene with the same node names/shapes as the
 * real GLB (verified by re-importing it into Blender) and assert the
 * wiring — plus that a missing node throws, so the caller falls back.
 *
 * The fallback path is tested end to end at this level: a GLB load
 * failure rejects, and the caller then uses `createRoverGroup()` —
 * the code-built rover — unchanged. One test also parses the SHIPPED
 * GLB itself (public/models/lrv/lunar_roving_vehicle.glb) and wires
 * it, so a bad asset can never pass the suite silently.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createRoverGroup, loadRoverModel, wireRealRover, loadRealRover,
  preloadRealRover, resetRealRoverCache, driverCameraPose, DRIVER_CAM,
} from './RoverModel.jsx';

/** Fake scene with the real GLB's node tree (names + nesting).
 * `missing` lists node names to leave out; a missing steer pivot
 * orphans its wheels onto `lrv` (still findable by name) so the
 * throw under test is about the pivot, not the wheels. */
function fakeRealRoverScene({ missing = [] } = {}) {
  const scene = new THREE.Group();
  scene.name = 'Scene';
  const lrv = new THREE.Group();
  lrv.name = 'lrv';
  const front = new THREE.Group();
  front.name = 'steer_front';
  front.position.set(0, 0.409, 1.145);
  const rear = new THREE.Group();
  rear.name = 'steer_rear';
  rear.position.set(0, 0.409, -1.145);
  for (const [key, parent] of [['fl', front], ['fr', front], ['rl', rear], ['rr', rear]]) {
    if (missing.includes(`wheel_${key}`)) continue;
    const wheel = new THREE.Mesh(
      new THREE.BoxGeometry(0.23, 0.818, 0.818),
      new THREE.MeshBasicMaterial(),
    );
    wheel.name = `wheel_${key}`;
    // If this wheel's steer pivot is the missing node, orphan the
    // wheel onto `lrv` so the wiring failure is the pivot's, not the wheel's.
    const pivotMissing = missing.includes(parent.name);
    (pivotMissing ? lrv : parent).add(wheel);
  }
  if (!missing.includes('steer_front')) lrv.add(front);
  if (!missing.includes('steer_rear')) lrv.add(rear);
  if (!missing.includes('lrv')) scene.add(lrv);
  return scene;
}

describe('wireRealRover', () => {
  it('wires group, wheels, and steerGroups from the GLB node names', () => {
    const scene = fakeRealRoverScene();
    const parts = wireRealRover(scene);
    // Same shape createRoverGroup() returns, so the loop works unchanged.
    expect(Object.keys(parts).sort()).toEqual(['group', 'steerGroups', 'wheels']);
    expect(parts.group).toBe(scene.getObjectByName('lrv'));
    expect(Object.keys(parts.wheels).sort()).toEqual(['fl', 'fr', 'rl', 'rr']);
    for (const key of ['fl', 'fr', 'rl', 'rr']) {
      expect(parts.wheels[key]).toBe(scene.getObjectByName(`wheel_${key}`));
    }
    expect(parts.steerGroups.front).toBe(scene.getObjectByName('steer_front'));
    expect(parts.steerGroups.rear).toBe(scene.getObjectByName('steer_rear'));
    // Wheels sit under their steer pivots (yawing a pivot steers them).
    expect(parts.wheels.fl.parent).toBe(parts.steerGroups.front);
    expect(parts.wheels.rr.parent).toBe(parts.steerGroups.rear);
  });

  it('throws naming the missing node when a wheel is absent', () => {
    const scene = fakeRealRoverScene({ missing: ['wheel_rr'] });
    expect(() => wireRealRover(scene)).toThrow(/wheel_rr/);
  });

  it('throws when a steer pivot is absent', () => {
    const scene = fakeRealRoverScene({ missing: ['steer_rear'] });
    expect(() => wireRealRover(scene)).toThrow(/steer_rear/);
  });

  it('throws when the lrv root is absent', () => {
    const scene = fakeRealRoverScene({ missing: ['lrv'] });
    expect(() => wireRealRover(scene)).toThrow(/"lrv"/);
  });

  it('wires the SHIPPED GLB itself (parse + wire, no browser needed)', async () => {
    // import.meta.url is not a file: URL under vitest, so resolve
    // from the process working directory (the app root). Copy the
    // bytes into this realm's Uint8Array: GLTFLoader.parse checks
    // `data instanceof ArrayBuffer`, which is false for a Node
    // Buffer's backing store under jsdom.
    const buf = readFileSync(join(process.cwd(), 'public/models/lrv/lunar_roving_vehicle.glb'));
    const bytes = new Uint8Array(buf);
    const gltf = await new GLTFLoader().parseAsync(bytes.buffer, '');
    const parts = wireRealRover(gltf.scene);
    expect(parts.group.name).toBe('lrv');
    expect(Object.keys(parts.wheels).sort()).toEqual(['fl', 'fr', 'rl', 'rr']);
    expect(parts.steerGroups.front.name).toBe('steer_front');
    expect(parts.steerGroups.rear.name).toBe('steer_rear');
    // Sanity: the real model is ~97k tris and ~3.1 m long, ground at y=0.
    let tris = 0;
    gltf.scene.traverse((o) => {
      if (o.isMesh) {
        const geo = o.geometry;
        tris += (geo.index ? geo.index.count : geo.attributes.position.count) / 3;
      }
    });
    expect(tris).toBeGreaterThan(90000);
    expect(tris).toBeLessThan(110000);
    const bbox = new THREE.Box3().setFromObject(parts.group);
    expect(bbox.max.z - bbox.min.z).toBeCloseTo(3.15, 1);
    expect(bbox.min.y).toBeCloseTo(0, 1);
  });
});

describe('fallback path (GLB load failure → code-built rover)', () => {
  // NOTE: three's FileLoader dedups in-flight loads by URL and a
  // synchronous Request-construction failure (relative URL under
  // jsdom) leaves that entry stranded, so a second load of the SAME
  // URL would hang forever. The tests therefore use absolute URLs
  // on a dead port (connection refused → genuine fetch rejection,
  // which cleans the entry up) and a different URL per test.
  const dead = (name) => `http://127.0.0.1:1/models/lrv/${name}.glb`;

  it('loadRoverModel rejects on a missing GLB', async () => {
    await expect(loadRoverModel(dead('missing-a'))).rejects.toThrow();
  });

  it('loadRealRover rejects when the GLB cannot be loaded', async () => {
    await expect(loadRealRover(dead('missing-b'))).rejects.toThrow();
  });

  it('the caller falls back to the code-built rover on load failure', async () => {
    // This mirrors the LunarScene swap: try the real model, fall back
    // to createRoverGroup() on ANY failure (load or wiring).
    let parts;
    try {
      parts = await loadRealRover(dead('missing-c'));
    } catch {
      parts = createRoverGroup();
    }
    expect(parts.group.name).toBe('code-built-lrv');
    expect(Object.keys(parts.wheels).sort()).toEqual(['fl', 'fr', 'rl', 'rr']);
    expect(parts.steerGroups.front).toBeTruthy();
    expect(parts.steerGroups.rear).toBeTruthy();
  });

  it('the caller also falls back when the GLB wires badly (missing node)', () => {
    let parts;
    try {
      parts = wireRealRover(fakeRealRoverScene({ missing: ['wheel_fl'] }));
    } catch {
      parts = createRoverGroup();
    }
    expect(parts.group.name).toBe('code-built-lrv');
  });
});

describe('preloadRealRover cache (background load while in orbit view)', () => {
  // Same dead-port pattern as the fallback tests: connection refused
  // rejects genuinely and cleans the FileLoader entry up.
  const dead = (name) => `http://127.0.0.1:1/models/lrv/${name}.glb`;

  afterEach(() => resetRealRoverCache());

  it('returns the SAME promise for repeat calls with the same URL', () => {
    const a = preloadRealRover(dead('cache-a'));
    const b = preloadRealRover(dead('cache-a'));
    expect(a).toBe(b);
    // The shared promise rejects (dead port) — silence it here.
    a.catch(() => {});
  });

  it('loadRealRover reuses the preloaded promise for the same URL', () => {
    const preloaded = preloadRealRover(dead('cache-b'));
    expect(loadRealRover(dead('cache-b'))).toBe(preloaded);
    preloaded.catch(() => {});
  });

  it('a cached rejection stays rejected (failed load → fallback, not a hang)', async () => {
    const p = preloadRealRover(dead('cache-c'));
    await expect(p).rejects.toThrow();
    await expect(preloadRealRover(dead('cache-c'))).rejects.toThrow();
  });

  it('resetRealRoverCache starts a fresh load', () => {
    const a = preloadRealRover(dead('cache-d'));
    a.catch(() => {});
    resetRealRoverCache();
    const b = preloadRealRover(dead('cache-d'));
    expect(b).not.toBe(a);
    b.catch(() => {});
  });
});

describe('driverCameraPose (driver cam clears the high-gain dish)', () => {
  it('sits in the right seat (opposite the dish), eye height, looking far ahead', () => {
    const pos = new THREE.Vector3(0, 0, 0);
    const { camera, lookAt } = driverCameraPose(pos, 0); // heading north
    expect(camera.x).toBeCloseTo(DRIVER_CAM.lateralM, 6);
    expect(camera.y).toBeCloseTo(DRIVER_CAM.heightM, 6);
    expect(camera.z).toBeCloseTo(DRIVER_CAM.forwardM, 6);
    expect(lookAt.x).toBeCloseTo(0, 6);
    expect(lookAt.y).toBeCloseTo(DRIVER_CAM.lookHeightM, 6);
    expect(lookAt.z).toBeCloseTo(DRIVER_CAM.lookAheadM, 6);
  });

  it('follows the heading (east = +X in the local frame)', () => {
    const pos = new THREE.Vector3(10, 2, -5);
    const { camera, lookAt } = driverCameraPose(pos, Math.PI / 2);
    // Heading east: forward = +X, right = −Z, so the seat offset is in −Z.
    expect(camera.x).toBeCloseTo(10 + DRIVER_CAM.forwardM, 6);
    expect(camera.y).toBeCloseTo(2 + DRIVER_CAM.heightM, 6);
    expect(camera.z).toBeCloseTo(-5 - DRIVER_CAM.lateralM, 6);
    expect(lookAt.x).toBeCloseTo(10 + DRIVER_CAM.lookAheadM, 6);
    expect(lookAt.z).toBeCloseTo(-5, 6);
  });

  it('keeps the REAL dish far outside the view: every dish-bbox corner is >40° off the forward axis', async () => {
    // The dish is the mesh whose bbox hangs high (min y > 1.0 m) at
    // the front (max z > 1.5 m) and reaches the model's top (y ≈ 1.86 m)
    // — measured from the shipped GLB itself. The camera's horizontal
    // half-field of view is ~37° at 16:10 (50° vertical FOV), so 40°+
    // is clear with margin even on wider screens.
    const buf = readFileSync(join(process.cwd(), 'public/models/lrv/lunar_roving_vehicle.glb'));
    const bytes = new Uint8Array(buf);
    const gltf = await new GLTFLoader().parseAsync(bytes.buffer, '');
    const lrv = gltf.scene.getObjectByName('lrv');
    let dish = null;
    lrv.traverse((o) => {
      if (!o.isMesh) return;
      const b = new THREE.Box3().setFromObject(o);
      if (b.min.y > 1.0 && b.max.y > 1.8 && b.max.z > 1.5) dish = b;
    });
    expect(dish).toBeTruthy();
    const { camera } = driverCameraPose(new THREE.Vector3(0, 0, 0), 0);
    const fwd = new THREE.Vector3(0, 0, 1);
    const corners = [];
    for (const x of [dish.min.x, dish.max.x]) {
      for (const y of [dish.min.y, dish.max.y]) {
        for (const z of [dish.min.z, dish.max.z]) corners.push(new THREE.Vector3(x, y, z));
      }
    }
    for (const c of corners) {
      const dir = c.clone().sub(camera).normalize();
      const angleDeg = (Math.acos(Math.max(-1, Math.min(1, dir.dot(fwd)))) * 180) / Math.PI;
      expect(angleDeg).toBeGreaterThan(40);
    }
  });

  it('does not mutate the rover position', () => {
    const pos = new THREE.Vector3(1, 2, 3);
    driverCameraPose(pos, 0.7);
    expect(pos.toArray()).toEqual([1, 2, 3]);
  });
});
