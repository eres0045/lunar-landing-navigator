/**
 * RoverModel — the code-built lunar rover for Drive mode.
 *
 * The rover is built from three.js primitives, modelled on the Apollo
 * LRV's REAL published dimensions (src/lib/rover.js LRV — NASA NSSDCA
 * + Boeing LRV Operations Handbook; cited per-dimension in ROVER.md).
 * It is labelled in-app as code-built, NOT the flight vehicle.
 *
 * Model space: forward = +Z, up = +Y, metres. Wheel centres sit at
 * ±track/2 in X and ±wheelbase/2 in Z; wheel radius = 0.409 m, so the
 * chassis underside sits at the 0.36 m ground clearance.
 *
 * `createRoverGroup()` returns { group, wheels, steerGroups }:
 *  - wheels: { fl, fr, rl, rr } — spin these with
 *    mesh.rotation.x = state.wheelAngleRad;
 *  - steerGroups: { front, rear } — yaw these with
 *    group.rotation.y = state.steerRad (front; the real LRV steers
 *    front AND rear, in opposite directions — rear gets -steerRad).
 *
 * `loadRoverModel(url)` is the generic GLB hook for the future
 * swap-in: the Sketchfab "Mondfahrzeug (Lunar Rover)" by Deutsches
 * Museum (CC-BY-SA 4.0, 464,143 faces — needs simplification first;
 * see ROVER.md). A GLB loaded through it replaces the code-built
 * group with NO changes to drive physics, HUD, or terrain — the
 * caller only has to wire the returned scene's wheel/steer pivots
 * (or drive it as one rigid group). The download is currently
 * blocked from this side (Sketchfab 401), so this is a hook point
 * only — nothing calls it yet.
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
 * Generic GLB loader — the future Mondfahrzeug swap-in hook.
 * Returns the loaded scene (caller adds it to the drive scene and
 * wires its wheel/steer pivots, or drives it as one rigid group).
 * Not called anywhere yet: the Sketchfab download is blocked (401)
 * and the candidate model needs mesh simplification first (ROVER.md).
 */
export async function loadRoverModel(url) {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(url);
  return gltf.scene;
}
