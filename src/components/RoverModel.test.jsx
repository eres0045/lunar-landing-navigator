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
