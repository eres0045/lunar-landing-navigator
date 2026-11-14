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

/** Parse the shipped GLB (same pattern as the wiring test above). */
async function parseShippedGlb() {
  const buf = readFileSync(join(process.cwd(), 'public/models/lrv/lunar_roving_vehicle.glb'));
  const bytes = new Uint8Array(buf);
  return new GLTFLoader().parseAsync(bytes.buffer, '');
}

/** The high-gain dish mesh in the shipped GLB: hangs high (min y > 1.0 m)
 * at the front (max z > 1.5 m) and reaches the model's top (y ≈ 1.86 m). */
function findDishBox(lrv) {
  let dish = null;
  lrv.traverse((o) => {
    if (!o.isMesh) return;
    const b = new THREE.Box3().setFromObject(o);
    if (b.min.y > 1.0 && b.max.y > 1.8 && b.max.z > 1.5) dish = b;
  });
  return dish;
}

/** Project a rover-local point through the driver camera at the given
 * aspect, using the app's real camera (PerspectiveCamera, 50° vertical
 * FOV — LunarScene.jsx). Returns the NDC vector. Used only for the
 * code-built fallback (simple box/circle geometry, where a corner or a
 * sampled disc point IS a real surface point). For the GLB it is
 * WRONG: a bbox corner is a phantom point — see clippedVisibleArea. */
function projectDriverCam(point, aspect, pose) {
  const cam = new THREE.PerspectiveCamera(50, aspect, 0.1, 5000);
  cam.position.copy(pose.camera);
  cam.lookAt(pose.lookAt);
  cam.updateMatrixWorld(true);
  return point.clone().project(cam);
}

/** Clipped visible screen area (NDC²; the frame is 4 NDC²) of a mesh's
 * REAL triangles through the driver camera, plus the area-weighted
 * centroid NDC y (negative = bottom of the frame). Clips in CLIP SPACE
 * (homogeneous, before the perspective divide): clipping in NDC is
 * wrong because vertices behind the camera mirror in NDC and fabricate
 * phantom area. This is the metric the pose was searched against —
 * a bbox corner can project in-frame while every real vertex is
 * off-frame (the 2026-11-15 lesson: the fender's bbox corner
 * (−0.77, 0.81, 1.57) projected to NDC (0.46, −0.81) yet the fender
 * had ZERO visible area from (−0.7, 1.2, 0.6)). */
function clippedVisibleArea(mesh, aspect, pose) {
  const cam = new THREE.PerspectiveCamera(50, aspect, 0.1, 5000);
  cam.position.copy(pose.camera);
  cam.lookAt(pose.lookAt);
  cam.updateMatrixWorld(true);
  const mvp = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
  mesh.updateWorldMatrix(true, false);
  const pos = mesh.geometry.attributes.position;
  const idx = mesh.geometry.index;
  const v = [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()];
  const tmp = new THREE.Vector3();
  const planes = [
    (p) => p.x + p.w, (p) => p.w - p.x,
    (p) => p.y + p.w, (p) => p.w - p.y,
    (p) => p.z + p.w, (p) => p.w - p.z,
  ];
  let area = 0, weightedY = 0;
  const clipArea = (a, b, c) => {
    let poly = [a.clone(), b.clone(), c.clone()];
    for (const f of planes) {
      if (poly.length === 0) break;
      const out = [];
      for (let i = 0; i < poly.length; i++) {
        const cur = poly[i], prev = poly[(i + poly.length - 1) % poly.length];
        const fc = f(cur), fp = f(prev);
        if (fc >= 0) {
          if (fp < 0) { const t = fp / (fp - fc); out.push(new THREE.Vector4().lerpVectors(prev, cur, t)); }
          out.push(cur);
        } else if (fp >= 0) { const t = fp / (fp - fc); out.push(new THREE.Vector4().lerpVectors(prev, cur, t)); }
      }
      poly = out;
    }
    if (poly.length < 3) return { area: 0, cy: 0 };
    const ndc = poly.map((p) => [p.x / p.w, p.y / p.w]);
    let aSum = 0, ySum = 0;
    for (let i = 1; i < ndc.length - 1; i++) {
      const aTri = Math.abs((ndc[i][0] - ndc[0][0]) * (ndc[i + 1][1] - ndc[0][1]) - (ndc[i + 1][0] - ndc[0][0]) * (ndc[i][1] - ndc[0][1])) / 2;
      aSum += aTri;
      ySum += aTri * ((ndc[0][1] + ndc[i][1] + ndc[i + 1][1]) / 3);
    }
    return { area: aSum, cy: aSum > 0 ? ySum / aSum : 0 };
  };
  const tri = (a, b, c) => {
    for (let k = 0; k < 3; k++) {
      tmp.fromBufferAttribute(pos, [a, b, c][k]).applyMatrix4(mesh.matrixWorld);
      v[k].set(tmp.x, tmp.y, tmp.z, 1).applyMatrix4(mvp);
    }
    const r = clipArea(v[0], v[1], v[2]);
    area += r.area;
    weightedY += r.area * r.cy;
  };
  if (idx) { for (let i = 0; i < idx.count; i += 3) tri(idx.getX(i), idx.getX(i + 1), idx.getX(i + 2)); }
  else { for (let i = 0; i < pos.count; i += 3) tri(i, i + 1, i + 2); }
  return { area, centroidY: area > 0 ? weightedY / area : 0 };
}

/** Count the dish mesh's REAL vertices in frame (clip-space test) and
 * return their NDC bounding box (null when none are in frame). */
function dishVertsInFrame(lrv, aspect, pose) {
  const cam = new THREE.PerspectiveCamera(50, aspect, 0.1, 5000);
  cam.position.copy(pose.camera);
  cam.lookAt(pose.lookAt);
  cam.updateMatrixWorld(true);
  const mvp = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
  const dish = lrv.getObjectByName('Object_9_7');
  dish.updateWorldMatrix(true, false);
  const pos = dish.geometry.attributes.position;
  const v = new THREE.Vector3();
  const c = new THREE.Vector4();
  let n = 0;
  const range = { minX: 1e9, maxX: -1e9, minY: 1e9, maxY: -1e9 };
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(dish.matrixWorld);
    c.set(v.x, v.y, v.z, 1).applyMatrix4(mvp);
    if (c.w <= 0) continue;
    const nx = c.x / c.w, ny = c.y / c.w, nz = c.z / c.w;
    if (Math.abs(nx) <= 1 && Math.abs(ny) <= 1 && nz >= -1 && nz <= 1) {
      n++;
      range.minX = Math.min(range.minX, nx); range.maxX = Math.max(range.maxX, nx);
      range.minY = Math.min(range.minY, ny); range.maxY = Math.max(range.maxY, ny);
    }
  }
  return { count: n, ndc: n ? range : null };
}

/** Aspects the app is actually used at: phone portrait + desktop. */
const DRIVER_CAM_ASPECTS = { phone: 390 / 844, desktop1610: 1.6, desktop169: 16 / 9 };

describe('driverCameraPose (driver cam clears the high-gain dish)', () => {
  it('pins the computed pose: right seat, eye at the seat, pitched down', () => {
    // (−0.75, 1.2, 0.0), look 30 m ahead at −2.0 m (6.1° down) — the
    // vertex-area search (scripts/_pose-vertex.mjs) found the camera
    // must sit AT the seat (forward 0.0), not 0.6 m ahead of it: at
    // 0.6 m the fender is 0.13–0.97 m away and every real vertex is
    // clipped (ZERO visible area). −0.75 is the seat's outer edge
    // (seat spans x −0.73…−0.11). The look target is below the terrain
    // — it is a direction (the downward pitch), not a ground point.
    expect(DRIVER_CAM.lateralM).toBe(-0.75);
    expect(DRIVER_CAM.forwardM).toBe(0.0);
    expect(DRIVER_CAM.heightM).toBe(1.2);
    expect(DRIVER_CAM.lookAheadM).toBe(30);
    expect(DRIVER_CAM.lookHeightM).toBe(-2.0);
  });

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

  it('keeps the REAL dish out of the frame on phone (real vertices, not bbox corners)', async () => {
    // The dish bbox (x +0.16…+0.91, y 1.17…1.86, z 0.85…1.55) comes
    // from the shipped GLB itself. Its CORNERS are phantom points, so
    // this test counts the dish mesh's REAL vertices in frame
    // (clip-space): on a 390×844 phone none is in frame. On a wide
    // desktop frame the dish's inner edge intrudes at the TOP-LEFT
    // edge only (NDC x ≤ −0.7, never the central half) — documented,
    // not a failure: the phone is the verified viewport and the dish
    // never fills the centre on any aspect.
    const gltf = await parseShippedGlb();
    const lrv = gltf.scene.getObjectByName('lrv');
    const dish = findDishBox(lrv);
    expect(dish).toBeTruthy();
    expect(dish.min.x).toBeCloseTo(0.16, 1);
    expect(dish.max.x).toBeCloseTo(0.91, 1);
    expect(dish.max.y).toBeCloseTo(1.86, 1);
    expect(dish.max.z).toBeCloseTo(1.55, 1);
    const pose = driverCameraPose(new THREE.Vector3(0, 0, 0), 0);
    const phone = dishVertsInFrame(lrv, DRIVER_CAM_ASPECTS.phone, pose);
    expect(phone.count).toBe(0);
    for (const aspect of [DRIVER_CAM_ASPECTS.desktop1610, DRIVER_CAM_ASPECTS.desktop169]) {
      const d = dishVertsInFrame(lrv, aspect, pose);
      if (d.count > 0) {
        // At the left edge only, never in the central half.
        expect(d.ndc.maxX).toBeLessThan(-0.6);
        expect(Math.abs(d.ndc.minX)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('shows the REAL front fender + wheel at the bottom of the frame (clipped vertex area)', async () => {
    // Clipped screen area of the REAL triangles (clip-space, not a
    // bbox corner — see clippedVisibleArea): the driver's-side
    // (right, −X) front fender and wheel must have substantial visible
    // area on a 390×844 phone, centred in the bottom half. The old
    // pose (−0.7, 1.2, 0.6) had ZERO area for every front part — that
    // is what this test guards against. The left (far-side) fender
    // stays off-frame on phone (it is the far side).
    const gltf = await parseShippedGlb();
    const lrv = gltf.scene.getObjectByName('lrv');
    const pose = driverCameraPose(new THREE.Vector3(0, 0, 0), 0);
    const fender = clippedVisibleArea(lrv.getObjectByName('cover_R_F'), DRIVER_CAM_ASPECTS.phone, pose);
    const wheel = clippedVisibleArea(lrv.getObjectByName('wheel_fr'), DRIVER_CAM_ASPECTS.phone, pose);
    expect(fender.area).toBeGreaterThan(0.5);
    expect(wheel.area).toBeGreaterThan(1.0);
    expect(fender.area + wheel.area).toBeGreaterThan(3.0);
    expect(fender.centroidY).toBeLessThan(-0.3);
    expect(wheel.centroidY).toBeLessThan(-0.3);
    const farFender = clippedVisibleArea(lrv.getObjectByName('cover_L_F'), DRIVER_CAM_ASPECTS.phone, pose);
    expect(farFender.area).toBeLessThan(0.05);
    // And on desktop the front is visible too (not just the phone).
    const fenderD = clippedVisibleArea(lrv.getObjectByName('cover_R_F'), DRIVER_CAM_ASPECTS.desktop169, pose);
    const wheelD = clippedVisibleArea(lrv.getObjectByName('wheel_fr'), DRIVER_CAM_ASPECTS.desktop169, pose);
    expect(fenderD.area + wheelD.area).toBeGreaterThan(0.5);
  });

  it('does not put the CODE-BUILT fallback dish dead-centre in frame', () => {
    // The fallback rover's dish is a centred disc (r 0.28 m at
    // (0, 1.59, 1.30), tilted −0.5 rad). Sampled ON the disc: its
    // centre is off-frame on phone, and at the TOP-LEFT edge on
    // desktop (max|NDC| ≈ 0.89 at 16:9 — the new pose sits further
    // back, so the centred dish enters the wide desktop frame);
    // no sampled point falls in the central half of the frame on any
    // aspect — the dish never fills the centre. Its front-right
    // fender still lands in the lower half of the frame.
    const { group } = createRoverGroup();
    group.updateMatrixWorld(true);
    let dishMesh = null;
    let fenderMesh = null;
    group.traverse((o) => {
      if (!o.isMesh) return;
      if (o.geometry?.type === 'CircleGeometry') dishMesh = o;
      const p = o.geometry?.parameters;
      if (p && p.width === 0.34 && p.height === 0.03 && p.depth === 0.95
        && o.position.x < 0 && o.position.z > 0) fenderMesh = o;
    });
    expect(dishMesh).toBeTruthy();
    expect(fenderMesh).toBeTruthy();
    const pose = driverCameraPose(new THREE.Vector3(0, 0, 0), 0);
    const centre = new THREE.Vector3();
    dishMesh.getWorldPosition(centre);
    const q = dishMesh.getWorldQuaternion(new THREE.Quaternion());
    const xDir = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
    const yDir = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    const r = dishMesh.geometry.parameters.radius;
    for (const aspect of Object.values(DRIVER_CAM_ASPECTS)) {
      const nc = projectDriverCam(centre, aspect, pose);
      // Never in the central half of the frame (off-frame on phone,
      // at the top-left edge on desktop). Edge of frame at worst is
      // the bar for the fallback (its dish is centred by construction).
      expect(Math.max(Math.abs(nc.x), Math.abs(nc.y))).toBeGreaterThan(0.5);
      for (let i = 0; i < 16; i++) {
        const th = (i / 16) * Math.PI * 2;
        const pt = centre.clone()
          .addScaledVector(xDir, r * Math.cos(th))
          .addScaledVector(yDir, r * Math.sin(th));
        const n = projectDriverCam(pt, aspect, pose);
        // Never in the central half of the frame.
        expect(Math.abs(n.x) < 0.5 && Math.abs(n.y) < 0.5).toBe(false);
      }
    }
    const fb = new THREE.Box3().setFromObject(fenderMesh);
    const innerFront = new THREE.Vector3(fb.max.x, fb.max.y, fb.max.z);
    for (const aspect of Object.values(DRIVER_CAM_ASPECTS)) {
      const n = projectDriverCam(innerFront, aspect, pose);
      expect(Math.abs(n.x)).toBeLessThanOrEqual(1);
      expect(n.y).toBeLessThanOrEqual(0);
      expect(n.y).toBeGreaterThanOrEqual(-1);
    }
  });

  it('does not mutate the rover position', () => {
    const pos = new THREE.Vector3(1, 2, 3);
    driverCameraPose(pos, 0.7);
    expect(pos.toArray()).toEqual([1, 2, 3]);
  });
});
