/**
 * RoverModel — the lunar rover for Drive mode.
 *
 * Drive mode now uses the REAL Apollo LRV mesh: the Deutsches Museum
 * "Mondfahrzeug (Lunar Rover)" (CC-BY-SA 4.0), converted from the NASA
 * Space ROS COLLADA files to a decimated GLB (see ROVER.md for the
 * pipeline, face counts, and attribution). It is loaded asynchronously
 * by `loadRealRover(url)` and wired by `wireRealRover(scene)`.
 *
 * The CODE-BUILT rover below (three.js primitives, modelled on the
 * Apollo LRV's REAL published dimensions — src/lib/rover.js LRV, NASA
 * NSSDCA + Boeing LRV Operations Handbook; cited per-dimension in
 * ROVER.md) remains as the fallback: it is mounted only if the GLB
 * fails to load or is missing a pivot — never while the GLB loads
 * (Step 3: the stand-in used to flash on cold load).
 *
 * Model space (both rovers): forward = +Z, up = +Y, metres. Wheel
 * centres sit at ±track/2 in X and ±wheelbase/2 in Z; wheel radius =
 * 0.409 m, so the chassis underside sits at the 0.36 m ground clearance.
 *
 * `createRoverGroup()` and `wireRealRover(scene)` return the SAME shape
 * `{ group, wheels, steerGroups }`:
 *  - wheels: { fl, fr, rl, rr } — spin these with
 *    mesh.rotation.x = state.wheelAngleRad (the real model's wheel
 *    meshes are centred on their axle and their local X axis IS the
 *    axle, so rotation.x spins them exactly like the code-built ones);
 *  - steerGroups: { front, rear } — yaw these with
 *    group.rotation.y = state.steerRad (front; the real LRV steers
 *    front AND rear, in opposite directions — rear gets -steerRad).
 *
 * The animation loop in LunarScene.jsx uses only that shape, so the
 * swap changes no drive physics, HUD, terrain, or controls.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { LRV, WHEEL_RADIUS_M } from '../lib/rover.js';

const DARK_METAL = 0x4b5563;
const CHASSIS = 0x9ca3af;
const SEAT_WEB = 0x6b7280;
const WHEEL_GREY = 0x374151;
const CHEVRON = 0x9ca3af;
const ANTENNA_DISH = 0xe5e7eb;

function mesh(geo, color, opts = {}) {
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    color, roughness: opts.roughness ?? 0.85, metalness: opts.metalness ?? 0.35,
  }));
  if (opts.pos) m.position.set(...opts.pos);
  if (opts.rot) m.rotation.set(...opts.rot);
  m.castShadow = true;
  return m;
}

/** One wire-mesh-look wheel: dark torus tyre + hub + chevron blocks. */
function createWheel() {
  const wheel = new THREE.Group();
  // Tyre: torus standing in the YZ plane (axle along X).
  const tyre = mesh(
    new THREE.TorusGeometry(WHEEL_RADIUS_M - 0.03, 0.045, 10, 28),
    WHEEL_GREY, { roughness: 0.95, metalness: 0.15 },
  );
  tyre.rotation.y = Math.PI / 2;
  wheel.add(tyre);
  // Mesh-look disc (open cylinder shell, wireframe-ish via low opacity).
  const drum = mesh(
    new THREE.CylinderGeometry(WHEEL_RADIUS_M - 0.02, WHEEL_RADIUS_M - 0.02, LRV.wheelWidthM * 0.7, 20, 1, true),
    0x6b7280, { roughness: 0.9, metalness: 0.4 },
  );
  drum.rotation.z = Math.PI / 2;
  wheel.add(drum);
  // Hub + bump-stop ring.
  const hub = mesh(
    new THREE.CylinderGeometry(0.14, 0.14, LRV.wheelWidthM + 0.02, 16),
    DARK_METAL, { roughness: 0.6, metalness: 0.6 },
  );
  hub.rotation.z = Math.PI / 2;
  wheel.add(hub);
  // Titanium chevrons: small blocks around the tread.
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const ch = mesh(new THREE.BoxGeometry(LRV.wheelWidthM + 0.02, 0.02, 0.06), CHEVRON,
      { roughness: 0.5, metalness: 0.7 });
    ch.position.set(0, Math.sin(a) * (WHEEL_RADIUS_M - 0.01), Math.cos(a) * (WHEEL_RADIUS_M - 0.01));
    ch.rotation.x = a;
    wheel.add(ch);
  }
  return wheel;
}

export function createRoverGroup() {
  const group = new THREE.Group();
  group.name = 'code-built-lrv';
  const halfTrack = LRV.trackM / 2;
  const halfBase = LRV.wheelbaseM / 2;
  const deckY = LRV.groundClearanceM + 0.08; // chassis deck height

  // --- Chassis: three-part frame (front / centre / rear), aluminium tube look.
  const frame = new THREE.Group();
  frame.add(mesh(new THREE.BoxGeometry(1.1, 0.07, LRV.lengthM), CHASSIS, { pos: [0, deckY, 0] }));
  // Side rails.
  for (const x of [-0.5, 0.5]) {
    frame.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, LRV.lengthM, 10), DARK_METAL,
      { pos: [x, deckY + 0.02, 0], rot: [Math.PI / 2, 0, 0] }));
  }
  group.add(frame);

  // --- Floor panels + two seats (tubular frame + nylon webbing).
  for (const x of [-0.42, 0.42]) {
    group.add(mesh(new THREE.BoxGeometry(0.62, 0.03, 0.85), SEAT_WEB, { pos: [x, deckY + 0.12, -0.15] }));
    // Seat back.
    const back = mesh(new THREE.BoxGeometry(0.62, 0.55, 0.03), SEAT_WEB, { pos: [x, deckY + 0.38, -0.58] });
    back.rotation.x = -0.12;
    group.add(back);
    // Armrest between the seats (shared, added once — guard by x sign).
    if (x < 0) {
      group.add(mesh(new THREE.BoxGeometry(0.08, 0.04, 0.6), DARK_METAL, { pos: [0, deckY + 0.28, -0.15] }));
    }
  }
  // Footrests.
  for (const x of [-0.42, 0.42]) {
    group.add(mesh(new THREE.BoxGeometry(0.4, 0.02, 0.3), DARK_METAL, { pos: [x, deckY + 0.05, 0.75] }));
  }

  // --- Fenders (dust guards) above each wheel.
  const fenderGeo = new THREE.BoxGeometry(0.34, 0.03, 0.95);
  for (const [x, z] of [[-halfTrack, halfBase], [halfTrack, halfBase], [-halfTrack, -halfBase], [halfTrack, -halfBase]]) {
    group.add(mesh(fenderGeo, CHASSIS, { pos: [x, deckY + WHEEL_RADIUS_M + 0.12, z] }));
  }

  // --- Hand controller (T-shaped, between the seats) + control module.
  group.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.35, 8), DARK_METAL, { pos: [0, deckY + 0.3, 0.35] }));
  group.add(mesh(new THREE.BoxGeometry(0.3, 0.03, 0.04), DARK_METAL, { pos: [0, deckY + 0.48, 0.35] }));
  group.add(mesh(new THREE.BoxGeometry(0.5, 0.12, 0.25), DARK_METAL, { pos: [0, deckY + 0.22, 0.62] }));

  // --- Mast + high-gain antenna (front centre) + low-gain whip.
  group.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 8), DARK_METAL, { pos: [0, deckY + 0.75, halfBase + 0.15] }));
  const dish = mesh(new THREE.CircleGeometry(0.28, 20), ANTENNA_DISH,
    { pos: [0, deckY + 1.15, halfBase + 0.15], roughness: 0.4, metalness: 0.6 });
  dish.rotation.x = -0.5;
  dish.material.side = THREE.DoubleSide;
  group.add(dish);
  group.add(mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.6, 6), DARK_METAL,
    { pos: [0.55, deckY + 0.9, -halfBase], rot: [0, 0, 0.15] }));

  // --- Batteries (two boxes under the seats) + rear pallet.
  group.add(mesh(new THREE.BoxGeometry(0.9, 0.22, 0.5), DARK_METAL, { pos: [0, deckY - 0.05, -0.35] }));
  group.add(mesh(new THREE.BoxGeometry(1.0, 0.05, 0.5), CHASSIS, { pos: [0, deckY + 0.06, -halfBase - 0.35] }));

  // --- Wheels on steer pivots (front + rear both steer on the real LRV).
  const steerGroups = { front: new THREE.Group(), rear: new THREE.Group() };
  steerGroups.front.position.set(0, 0, halfBase);
  steerGroups.rear.position.set(0, 0, -halfBase);
  const wheels = {};
  const defs = [
    ['fl', steerGroups.front, -halfTrack], ['fr', steerGroups.front, halfTrack],
    ['rl', steerGroups.rear, -halfTrack], ['rr', steerGroups.rear, halfTrack],
  ];
  for (const [key, parent, x] of defs) {
    const w = createWheel();
    w.position.set(x, WHEEL_RADIUS_M, 0);
    parent.add(w);
    wheels[key] = w;
  }
  group.add(steerGroups.front);
  group.add(steerGroups.rear);

  return { group, wheels, steerGroups };
}

/**
 * Generic GLB loader — returns the loaded scene. Throws on load/parse
 * failure (404, corrupt file, network error); the caller falls back
 * to the code-built rover.
 */
export async function loadRoverModel(url) {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(url);
  return gltf.scene;
}

/**
 * Wire the loaded real-LRV GLB scene into the `{ group, wheels,
 * steerGroups }` shape the animation loop uses — the same shape
 * `createRoverGroup()` returns, so the loop works unchanged.
 *
 * Expected node tree (verified by re-importing the GLB into Blender):
 *   EMPTY `lrv` (root, at origin, ground y=0)
 *     MESH `body`
 *     EMPTY `steer_front` — MESH `cover_L_F`, `cover_R_F`, `wheel_fl`, `wheel_fr`
 *     EMPTY `steer_rear`  — MESH `cover_L_B`, `cover_R_B`, `wheel_rl`, `wheel_rr`
 *
 * Throws a clear error naming the missing node if any expected node
 * is absent — the caller catches it and keeps the code-built rover.
 */
export function wireRealRover(scene) {
  const group = scene.getObjectByName('lrv');
  if (!group) {
    throw new Error('wireRealRover: GLB scene has no node named "lrv"');
  }
  const wheels = {};
  for (const key of ['fl', 'fr', 'rl', 'rr']) {
    const wheel = scene.getObjectByName(`wheel_${key}`);
    if (!wheel) {
      throw new Error(`wireRealRover: GLB scene has no wheel node "wheel_${key}"`);
    }
    wheels[key] = wheel;
  }
  const steerGroups = {};
  for (const key of ['front', 'rear']) {
    const pivot = scene.getObjectByName(`steer_${key}`);
    if (!pivot) {
      throw new Error(`wireRealRover: GLB scene has no steer node "steer_${key}"`);
    }
    steerGroups[key] = pivot;
  }
  return { group, wheels, steerGroups };
}

/**
 * Load the real LRV GLB and wire it, in one step. Resolves to the
 * `{ group, wheels, steerGroups }` shape; rejects on load failure OR
 * on a missing node (via wireRealRover) — either way the caller falls
 * back to the code-built rover.
 *
 * The load is CACHED per URL (see `preloadRealRover`): the first call
 * starts the fetch + parse, every later call for the same URL returns
 * the same promise, so re-mounts and Drive re-entries never re-fetch
 * or re-parse the 6.4 MB GLB.
 */
export function loadRealRover(url) {
  return preloadRealRover(url);
}

/**
 * Start loading the real LRV GLB in the background and cache the
 * promise per URL. Call this EARLY — on app mount, while the user is
 * still in orbit view — so the model is usually parsed and ready
 * before Drive mode is ever entered, and the code-built rover never
 * flashes on screen. Returns the shared promise (resolves to the
 * wired `{ group, wheels, steerGroups }` shape); a rejection is
 * cached too, so a failed load stays failed and the caller keeps the
 * code-built fallback. `resetRealRoverCache()` clears the cache
 * (tests only).
 */
const realRoverCache = new Map();
export function preloadRealRover(url) {
  if (!realRoverCache.has(url)) {
    realRoverCache.set(url, loadRoverModel(url).then((scene) => wireRealRover(scene)));
  }
  return realRoverCache.get(url);
}

/** Clear the preload cache (tests only — never in the app). */
export function resetRealRoverCache() {
  realRoverCache.clear();
}

/**
 * Driver-camera pose for Drive mode, measured against the REAL GLB
 * (not the code-built rover) — computed, not guessed (2026-11-15,
 * reworked after the first pose failed live):
 * the high-gain dish sits on the rover's LEFT side (x +0.16…+0.91 m,
 * front face z ≈ +1.55 m, mast top y ≈ 1.86 m — measured from the
 * shipped GLB; see the RoverModel tests, which assert these bounds
 * from the file itself). Sign convention, verified from the GLB's own
 * node names (`cover_R_F` / `wheel_fr` sit at −X): forward is +Z, so
 * the rover's RIGHT side is −X and the right (driver's) seat is at
 * negative x. A camera at +0.6 would sit on the DISH side.
 *
 * LESSON (2026-11-15): a bounding-box corner is NOT a surface point.
 * The first rework posed the camera from the fender's bbox corner
 * (−0.77, 0.81, 1.57 → NDC 0.46, −0.81, "bottom quarter"), but that
 * corner is a phantom — no fender vertex is there. The real fender
 * vertices sit 30–45° below horizontal from the seat, outside the
 * 25° vertical half-FOV, so the whole fender/wheel/body projected to
 * ZERO clipped screen area and the live driver view showed no rover
 * at all. The correct metric is the CLIPPED screen area of the
 * actual vertices (clip-space Sutherland–Hodgman, never NDC-space:
 * vertices behind the camera mirror in NDC and fabricate phantom
 * area). The pose below is the result of that vertex-based search.
 *
 * The old pose (−0.7, 1.2, 0.6), look 30 m ahead at 0.6 m up, has
 * ZERO clipped visible area for every front part (fenders, wheels,
 * body) on a 390×844 phone — the camera was 0.6 m ahead of centre,
 * only 0.13–0.97 m from the fender, so the fender's vertices splayed
 * to extreme NDC and were all clipped. Moving the eye back to the
 * seat (forward 0.0 m, i.e. the rover centre, where the seat sits)
 * and pitching down puts the front in frame.
 *
 * Chosen pose (−0.75, 1.2, 0.0), look 30 m ahead at −2.0 m up
 * (a 6.1° downward pitch; the look target is below the terrain — it
 * is a direction, not a point on the ground):
 *  - eye 1.2 m (a seated astronaut's eye height: seat 0.56 m +
 *    ~0.65 m), at the outer edge of the right seat (seat spans
 *    x −0.73…−0.11 m; −0.75 sits just at that edge);
 *  - right-front fender + right-front wheel clipped visible area
 *    4.08 NDC² on a 390×844 phone (frame = 4 NDC²), dish 0 vertices
 *    in frame on phone — the dish is completely clear;
 *  - live phone probe: ~34k rover pixels, 89% in the bottom quarter,
 *    all on the right half (the driver's-side front), 0 in the top
 *    third — the front reads at the bottom of the frame and the
 *    forward terrain fills the top;
 *  - on a wide desktop frame the dish's inner edge intrudes at the
 *    TOP-LEFT edge only (34 vertices in frame at 16:9, NDC x
 *    −0.97…−0.75, y 0.30…0.93) — at the frame edge, never central —
 *    and the front is visible there too (1.38 NDC²).
 * It also roughly clears the code-built rover's centred dish: the
 * dish centre is off-frame on phone (NDC −4.51) and desktop
 * (−1.30); only the disc's lower edge can intrude at the left edge
 * of a wide desktop frame (closest sampled point NDC −0.81 at
 * 16:10, −0.73 at 16:9) — never central — and its front-right
 * fender lands in the lower half (NDC y −0.41). That rover only
 * appears if the GLB fails to load.
 *
 * Returns `{ camera, lookAt }` as new THREE.Vector3s; `roverPos` is
 * never mutated. `headingRad` is clockwise from north (0 = north),
 * the same convention as the rover physics. Lateral is measured
 * along the rover's right vector (negative = the seat opposite the
 * dish); forward along the heading.
 */
export const DRIVER_CAM = {
  /** Metres to the right of the rover centre (negative = opposite the dish). */
  lateralM: -0.75,
  /** Metres ahead of the rover centre (0 = the seat, at the rover centre). */
  forwardM: 0.0,
  /** Camera (eye) height above the ground. */
  heightM: 1.2,
  /** Look target: metres ahead of the rover centre. */
  lookAheadM: 30,
  /** Look target height above the ground (below the terrain: a 6.1° downward pitch). */
  lookHeightM: -2.0,
};

export function driverCameraPose(roverPos, headingRad) {
  const fwd = new THREE.Vector3(Math.sin(headingRad), 0, Math.cos(headingRad));
  const right = new THREE.Vector3(Math.cos(headingRad), 0, -Math.sin(headingRad));
  return {
    camera: roverPos.clone()
      .addScaledVector(fwd, DRIVER_CAM.forwardM)
      .addScaledVector(right, DRIVER_CAM.lateralM)
      .add(new THREE.Vector3(0, DRIVER_CAM.heightM, 0)),
    lookAt: roverPos.clone().addScaledVector(fwd, DRIVER_CAM.lookAheadM)
      .add(new THREE.Vector3(0, DRIVER_CAM.lookHeightM, 0)),
  };
}
