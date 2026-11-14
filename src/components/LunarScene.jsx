/**
 * LunarScene — the interactive 3D Moon south-pole scene (plain `three`,
 * no react-three-fiber).
 *
 * The Moon is a textured sphere (public/textures/moon-1024.jpg) with the
 * south pole down (−Y). The 13 candidate sites are marked at their REAL
 * published coordinates on the sphere's coordinate grid; marker colour
 * is the live POWER verdict at the chosen date (green SUNLIT, amber LOW
 * SUN, grey DARK). The Sun directional light + visible Sun disc and the
 * Earth globe are placed from the COMPUTED Sun/Earth azimuth/elevation
 * at the selected site and date — move the date and the lighting moves.
 *
 * Honesty notes: the Moon texture is illustrative (its crater features
 * are not registered to the marker grid); the terrain is a smooth sphere,
 * not a DEM — there is no terrain shadowing in this app, by design (see
 * the flat-horizon caveat in the panel). The LRO model is NASA public
 * domain; it orbits as a prop and is skipped silently if it fails to load.
 *
 * Camera: drag to orbit, wheel to zoom, presets fly to a framing.
 * jsdom has no WebGL, so the component renders a fallback message there.
 */
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { sunEarthAt } from '../lib/ephemeris.js';
import { SITES } from '../lib/data.js';

const D2R = Math.PI / 180;

/** Selenographic lat/lon (deg, lon east +) → unit vector on the sphere
 *  (Y = north pole). */
export function siteToVec(latDeg, lonDeg) {
  const la = latDeg * D2R;
  const lo = lonDeg * D2R;
  return new THREE.Vector3(
    Math.cos(la) * Math.sin(lo),
    Math.sin(la),
    Math.cos(la) * Math.cos(lo),
  );
}

/** Local alt/az at a site → world direction. up = site position, north =
 *  the pole projected onto the local tangent plane, east = north × up. */
export function altAzToWorld(latDeg, lonDeg, altDeg, azDeg) {
  const up = siteToVec(latDeg, lonDeg);
  const pole = new THREE.Vector3(0, 1, 0);
  const north = pole.clone().addScaledVector(up, -pole.dot(up)).normalize();
  const east = new THREE.Vector3().crossVectors(north, up).normalize();
  const alt = altDeg * D2R;
  const az = azDeg * D2R;
  return up.clone().multiplyScalar(Math.sin(alt))
    .addScaledVector(north, Math.cos(alt) * Math.cos(az))
    .addScaledVector(east, Math.cos(alt) * Math.sin(az))
    .normalize();
}

export const CAMERA_PRESETS = {
  wide: { label: 'Wide', theta: 0.6, phi: 1.35, radius: 4.6 },
  pole: { label: 'South Pole', theta: 2.4, phi: 2.55, radius: 3.1 },
  site: { label: 'Selected site', theta: null, phi: null, radius: 2.1 },
  earth: { label: 'Earth view', theta: null, phi: null, radius: 4.6 },
};

const POWER_COLOR = { SUNLIT: 0x34d399, 'LOW SUN': 0xfbbf24, DARK: 0x94a3b8 };

export default function LunarScene({ date, site, verdicts, cameraCmd, onSelectSite }) {
  const mountRef = useRef(null);
  const [webglOk, setWebglOk] = useState(false);
  const stateRef = useRef(null);
  const propsRef = useRef({ date, site, verdicts });
  propsRef.current = { date, site, verdicts };

  // Camera commands from the panel (zoom + presets), applied once each.
  useEffect(() => {
    const s = stateRef.current;
    if (!s || !cameraCmd || !cameraCmd.seq) return;
    const { kind, preset } = cameraCmd;
    if (kind === 'zoom-in') s.desired.radius = Math.max(1.7, s.desired.radius * 0.82);
    else if (kind === 'zoom-out') s.desired.radius = Math.min(9, s.desired.radius * 1.22);
    else if (kind === 'preset' && preset) {
      const p = CAMERA_PRESETS[preset];
      if (!p) return;
      if (preset === 'site') {
        const v = siteToVec(propsRef.current.site.lat, propsRef.current.site.lon);
        s.desired.theta = Math.atan2(v.x, v.z);
        s.desired.phi = Math.acos(Math.max(-1, Math.min(1, v.y)));
        s.desired.radius = 2.1;
        s.desired.look = new THREE.Vector3(0, 0, 0);
      } else if (preset === 'earth') {
        // Camera off the Earth–Moon line, looking at the bisector of the
        // Moon-centre and Earth directions, so both bodies sit in frame.
        // The 0.9 sideways offset gives ~25° Moon–Earth separation —
        // wider than the Moon's 13.8° angular radius from 4.2 units, so
        // Earth is never hidden behind the disc.
        const pos = sunEarthAt(propsRef.current.date, propsRef.current.site.lat, propsRef.current.site.lon);
        const e = altAzToWorld(propsRef.current.site.lat, propsRef.current.site.lon, pos.earth.alt, pos.earth.az);
        const up = siteToVec(propsRef.current.site.lat, propsRef.current.site.lon);
        const perp = new THREE.Vector3().crossVectors(e, up);
        if (perp.lengthSq() < 0.01) perp.set(1, 0, 0); else perp.normalize();
        const camDir = e.clone().multiplyScalar(-1).addScaledVector(perp, 0.9).normalize();
        const camPos = camDir.clone().multiplyScalar(4.2);
        const toMoon = camPos.clone().negate().normalize();
        const toEarth = e.clone().multiplyScalar(6).sub(camPos).normalize();
        const lookDir = toMoon.clone().add(toEarth).normalize();
        s.desired.theta = Math.atan2(camDir.x, camDir.z);
        s.desired.phi = Math.acos(Math.max(-1, Math.min(1, camDir.y)));
        s.desired.radius = 4.2;
        s.desired.look = camPos.clone().addScaledVector(lookDir, 5);
      } else {
        s.desired.look = new THREE.Vector3(0, 0, 0);
        s.desired.theta = p.theta;
        s.desired.phi = p.phi;
        s.desired.radius = p.radius;
      }
    }
  }, [cameraCmd]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      return undefined; // jsdom / no-WebGL: the fallback div stays.
    }
    const base = import.meta.env.BASE_URL || '/';
    setWebglOk(true);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(mount.clientWidth || 800, mount.clientHeight || 600);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020617);
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
    const updateCameraAspect = () => {
      const w = mount.clientWidth || 800;
      const h = mount.clientHeight || 600;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    updateCameraAspect();

    // Starfield.
    const starGeo = new THREE.BufferGeometry();
    const starPos = [];
    for (let i = 0; i < 2500; i++) {
      const v = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
      if (v.lengthSq() < 0.01) continue;
      v.normalize().multiplyScalar(90);
      starPos.push(v.x, v.y, v.z);
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.35, sizeAttenuation: false })));

    // Moon.
    const texLoader = new THREE.TextureLoader();
    const moonMat = new THREE.MeshStandardMaterial({
      map: texLoader.load(`${base}textures/moon-1024.jpg`),
      roughness: 1,
      metalness: 0,
    });
    const moon = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), moonMat);
    scene.add(moon);

    // Sun: directional light + visible disc. Earth: small textured globe.
    const sunLight = new THREE.DirectionalLight(0xfff2d9, 3.2);
    scene.add(sunLight);
    scene.add(sunLight.target);
    scene.add(new THREE.AmbientLight(0x334155, 0.55));
    const sunDisc = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 24, 16),
      new THREE.MeshBasicMaterial({ color: 0xffdf80 }),
    );
    scene.add(sunDisc);
    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 32, 24),
      new THREE.MeshStandardMaterial({
        map: texLoader.load(`${base}textures/earth-atmos-2048.jpg`),
        // Night-lights emissive so the dark side stays faintly visible
        // (at full Moon, Earth as seen from the Moon is in "new Earth"
        // phase — its sunlit side faces away — and would otherwise be
        // an invisible black disc).
        emissiveMap: texLoader.load(`${base}textures/earth-lights-2048.png`),
        emissive: 0xffffff,
        emissiveIntensity: 0.5,
        roughness: 0.9,
      }),
    );
    scene.add(earth);

    // Site markers.
    const markers = new Map();
    const markerGeo = new THREE.SphereGeometry(0.022, 12, 10);
    for (const s of SITES) {
      const m = new THREE.Mesh(markerGeo, new THREE.MeshBasicMaterial({ color: 0x34d399 }));
      m.position.copy(siteToVec(s.lat, s.lon)).multiplyScalar(1.012);
      m.userData.siteId = s.id;
      scene.add(m);
      markers.set(s.id, m);
    }
    // Selected-site ring, oriented to the surface normal.
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.055, 0.006, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    scene.add(ring);

    // LRO prop (NASA public domain) in a slow inclined orbit; failure
    // is tolerated — the scene works without it.
    const lroGroup = new THREE.Group();
    scene.add(lroGroup);
    new GLTFLoader().load(
      `${base}models/nasa-lro-A.glb`,
      (gltf) => {
        const model = gltf.scene;
        model.scale.setScalar(0.06);
        lroGroup.add(model);
      },
      undefined,
      () => { /* keep the scene without LRO */ },
    );

    // Camera orbit state (spherical around the Moon centre).
    const orbit = {
      theta: 0.6, phi: 1.35, radius: 4.6,
      look: new THREE.Vector3(0, 0, 0),
      desired: { theta: 0.6, phi: 1.35, radius: 4.6, look: new THREE.Vector3(0, 0, 0) },
    };
    stateRef.current = orbit;

    // Drag to orbit, wheel to zoom, click a marker to select the site.
    let dragging = false;
    let downX = 0;
    let downY = 0;
    let moved = 0;
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const onPointerDown = (e) => {
      dragging = true; moved = 0; downX = e.clientX; downY = e.clientY;
      // Dragging re-centres the view on the Moon.
      orbit.desired.look = new THREE.Vector3(0, 0, 0);
    };
    const onPointerMove = (e) => {
      if (!dragging) return;
      const dx = e.clientX - downX;
      const dy = e.clientY - downY;
      moved += Math.abs(dx) + Math.abs(dy);
      downX = e.clientX;
      downY = e.clientY;
      orbit.desired.theta -= dx * 0.005;
      orbit.desired.phi = Math.max(0.15, Math.min(Math.PI - 0.15, orbit.desired.phi - dy * 0.005));
    };
    const onPointerUp = (e) => {
      dragging = false;
      if (moved > 6) return; // it was a drag, not a click
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects([...markers.values()], false);
      if (hits.length > 0 && onSelectSite) onSelectSite(hits[0].object.userData.siteId);
    };
    const onWheel = (e) => {
      e.preventDefault();
      orbit.desired.radius = Math.max(1.7, Math.min(9, orbit.desired.radius * (e.deltaY > 0 ? 1.12 : 0.89)));
    };
    const el = renderer.domElement;
    el.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    el.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('resize', updateCameraAspect);

    let raf = 0;
    let dead = false;
    const clock = new THREE.Clock();
    const animate = () => {
      if (dead) return;
      raf = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      // Ease the camera toward the desired framing.
      orbit.theta += (orbit.desired.theta - orbit.theta) * 0.08;
      orbit.phi += (orbit.desired.phi - orbit.phi) * 0.08;
      orbit.radius += (orbit.desired.radius - orbit.radius) * 0.08;
      orbit.look.lerp(orbit.desired.look, 0.08);
      camera.position.set(
        orbit.radius * Math.sin(orbit.phi) * Math.sin(orbit.theta),
        orbit.radius * Math.cos(orbit.phi),
        orbit.radius * Math.sin(orbit.phi) * Math.cos(orbit.theta),
      );
      camera.lookAt(orbit.look);

      // Live Sun/Earth from the ephemeris at the selected site + date.
      const { date, site, verdicts } = propsRef.current;
      const pos = sunEarthAt(date, site.lat, site.lon);
      const sunDir = altAzToWorld(site.lat, site.lon, pos.sun.alt, pos.sun.az);
      const earthDir = altAzToWorld(site.lat, site.lon, pos.earth.alt, pos.earth.az);
      sunLight.position.copy(sunDir).multiplyScalar(8);
      sunDisc.position.copy(sunDir).multiplyScalar(14);
      sunDisc.visible = pos.sun.alt > -8;
      earth.position.copy(earthDir).multiplyScalar(6);
      earth.visible = pos.earth.alt > -8;
      earth.rotation.y = t * 0.02;

      // Marker colours follow the live POWER verdicts.
      for (const v of verdicts || []) {
        const m = markers.get(v.site.id);
        if (m) m.material.color.setHex(POWER_COLOR[v.power.key] ?? 0x94a3b8);
      }
      const sel = markers.get(site.id);
      if (sel) {
        const n = siteToVec(site.lat, site.lon);
        ring.position.copy(n).multiplyScalar(1.015);
        ring.lookAt(n.clone().multiplyScalar(2));
        ring.visible = true;
        sel.scale.setScalar(1.6);
      } else {
        ring.visible = false;
      }
      for (const [id, m] of markers) if (id !== site.id) m.scale.setScalar(1);

      // LRO slow orbit.
      const a = t * 0.05;
      lroGroup.position.set(Math.cos(a) * 1.9, Math.sin(a * 0.7) * 0.7, Math.sin(a) * 1.9);
      lroGroup.rotation.y = t * 0.1;

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      el.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', updateCameraAspect);
      stateRef.current = null;
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={mountRef} className="absolute inset-0" data-testid="lunar-scene">
      {!webglOk && (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <p className="max-w-sm text-sm leading-relaxed text-slate-300">
          The 3D Moon scene needs WebGL — your browser could not create a WebGL context.
          All Sun/Earth numbers in the panel are still computed live.
        </p>
      </div>
      )}
    </div>
  );
}
