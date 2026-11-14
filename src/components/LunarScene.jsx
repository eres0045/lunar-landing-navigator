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
 * are not registered to the marker grid). Drive-mode terrain is the REAL
 * LRO LOLA DEM (10–20 m/px, per-site grid in public/terrain/) — the
 * ground mesh is displaced from it and the rover follows it via
 * `surfaceHeightAt`; 8 of the 13 sites also carry the REAL LROC NAC
 * 1 m/px ground imagery (public/terrain/nac/) mapped onto the same
 * box — Cabeus and Nobile Rim 2 have no NAC coverage, and the three
 * PSR floors are genuinely black (permanently shadowed), so those
 * sites keep DEM shading only. Lighting: the Sun direction comes from
 * the real ephemeris and the Drive scene renders real-time shadows
 * from the DEM mesh (PCF shadow map); brightness is adjusted for
 * readability — the real surface at LOW SUN is nearly dark — and the
 * NAC mosaic has one baked Sun angle, so texture shadows do not move
 * with the live Sun. No sub-10 m boulders/craters are resolved; the
 * scattered rocks are decorative (no collision). The LRO model is NASA
 * public domain; it orbits as a prop and is skipped silently if it
 * fails to load.
 *
 * Camera: drag to orbit, wheel to zoom, presets fly to a framing.
 * jsdom has no WebGL, so the component renders a fallback message there.
 */
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { sunEarthAt } from '../lib/ephemeris.js';
import { SITES } from '../lib/data.js';
import { createRover, step as roverStep, roverLatLon, setSurfaceHeightAt, resetSurfaceHeightAt } from '../lib/rover.js';
import { loadTerrainGrid, createTerrainLookup, textureStatusForSite } from '../lib/terrain.js';
import { buildTerrainGeometry, terrainRingPoints, loadGroundTexture } from './terrainMesh.js';
import { createRoverGroup, loadRealRover, driverCameraPose } from './RoverModel.jsx';
import { DustSystem, TrackTrail } from './RoverEffects.js';

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

/** Local alt/az at a site → direction in the DRIVE tangent-plane
 *  frame (x = east, y = up, z = north), metres. Directions only —
 *  the Sun/Earth are placed along these at local distances. */
export function altAzToLocal(altDeg, azDeg) {
  const alt = altDeg * D2R;
  const az = azDeg * D2R;
  return new THREE.Vector3(
    Math.cos(alt) * Math.sin(az),
    Math.sin(alt),
    Math.cos(alt) * Math.cos(az),
  );
}

/** Deterministic PRNG so the drive-scene rocks are stable per load. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const CAMERA_PRESETS = {
  wide: { label: 'Wide', theta: 0.6, phi: 1.35, radius: 4.6 },
  pole: { label: 'South Pole', theta: 2.4, phi: 2.55, radius: 3.1 },
  site: { label: 'Selected site', theta: null, phi: null, radius: 2.1 },
  earth: { label: 'Earth view', theta: null, phi: null, radius: 4.6 },
};

const POWER_COLOR = { SUNLIT: 0x34d399, 'LOW SUN': 0xfbbf24, DARK: 0x94a3b8 };

export default function LunarScene({
  date, site, verdicts, cameraCmd, onSelectSite,
  driveMode = false, driveCam = 'chase', driveInputRef, roverStateRef, maxSpeedKmh = 13,
  terrainShading = true, onTerrainStatus, onRoverModelStatus,
}) {
  const mountRef = useRef(null);
  const [webglOk, setWebglOk] = useState(false);
  const stateRef = useRef(null);
  const driveApiRef = useRef(null);
  const propsRef = useRef({ date, site, verdicts, driveMode, driveCam, terrainShading });
  propsRef.current = { date, site, verdicts, driveMode, driveCam, terrainShading };

  // (Re)create the rover when Drive mode is entered or the site
  // changes under it; a max-speed change only retunes the cap.
  useEffect(() => {
    if (!driveMode || !roverStateRef) return;
    const cur = roverStateRef.current;
    if (!cur || cur.siteId !== site.id) {
      roverStateRef.current = createRover(site, { maxSpeedKmh });
    } else {
      cur.maxSpeedMs = (maxSpeedKmh * 1000) / 3600;
      cur.maxSpeedKmh = maxSpeedKmh;
    }
  }, [driveMode, site, maxSpeedKmh, roverStateRef]);

  // Terrain: lazy-load this site's real LOLA DEM grid, plug it into the
  // rover physics (setSurfaceHeightAt) and rebuild the Drive ground
  // mesh from it. On failure the scene stays on the flat disc and the
  // rover on the smooth sphere — the app keeps working, and the HUD
  // says so (status reported via onTerrainStatus).
  useEffect(() => {
    let cancelled = false;
    const base = import.meta.env.BASE_URL || '/';
    onTerrainStatus?.({ siteId: site.id, state: 'loading' });
    loadTerrainGrid(site.id, base)
      .then((grid) => {
        if (cancelled) return;
        const lookup = createTerrainLookup(grid);
        setSurfaceHeightAt(lookup.heightFn);
        driveApiRef.current?.applyTerrain(grid, lookup);
        onTerrainStatus?.({
          siteId: site.id, state: 'loaded',
          resolutionM: grid.resolutionM, source: grid.source,
          reliefM: grid.maxHeightM - grid.minHeightM,
          centerHeightM: grid.centerHeightM,
          halfSizeM: grid.halfSizeM ?? 600,
          sourceShort: grid.siteId === 'apollo15' ? 'LROC NAC DTM' : 'LRO LOLA DEM',
          texture: textureStatusForSite(site.id),
        });
      })
      .catch(() => {
        if (cancelled) return;
        resetSurfaceHeightAt();
        driveApiRef.current?.clearTerrain();
        onTerrainStatus?.({ siteId: site.id, state: 'error' });
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site]);

  // DEM shading toggle (elevation tint + slope shading on/off).
  useEffect(() => {
    driveApiRef.current?.setShading(terrainShading);
  }, [terrainShading]);

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
    // Real-time shadows: the Drive Sun casts the DEM terrain's and the
    // rover's shadows (PCF, sharp-edged — the Moon has no atmosphere
    // to soften them). Only Drive objects opt in (castShadow below).
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    // Pitch-black sky — space has no atmosphere and no haze.
    scene.background = new THREE.Color(0x000000);
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
    // The Sun casts real-time shadows in Drive mode (shadow camera
    // ±160 m around the rover, following the light target); the shadow
    // map is sized for the 1.2 km drive area, not the whole Moon.
    const sunLight = new THREE.DirectionalLight(0xfff2d9, 3.2);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    sunLight.shadow.camera.left = -160;
    sunLight.shadow.camera.right = 160;
    sunLight.shadow.camera.top = 160;
    sunLight.shadow.camera.bottom = -160;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 1200;
    sunLight.shadow.bias = -0.0002;
    sunLight.shadow.normalBias = 0.6;
    scene.add(sunLight);
    scene.add(sunLight.target);
    // Ambient fill: full strength in orbit view, dimmed in Drive mode
    // so the Sun + shadows carry the contrast (the Moon's real fill is
    // Earthshine + starlight — faint, labelled in the HUD/Evidence).
    const ambientLight = new THREE.AmbientLight(0x334155, 0.55);
    scene.add(ambientLight);
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

    // ---- Drive mode: LOCAL meter-scale scene ----------------------
    // The global scene is unit-sphere scale (1 m ≈ 5.8e-7 units), so
    // float32 precision breaks if the rover moves in world units.
    // Drive mode therefore HIDES the Moon sphere/markers/LRO and
    // renders a tangent-plane frame centred on the site: the real LOLA
    // DEM heightfield (1200 m square; flat 500 m disc until it loads),
    // the real Apollo LRV model at the origin (code-built rover until
    // the GLB arrives, and permanently if it fails to load), Sun/Earth
    // placed by alt/az DIRECTION from the site (same ephemeris,
    // distances in metres). The rover moves in metres in this frame.
    const driveGroup = new THREE.Group();
    driveGroup.visible = false;
    scene.add(driveGroup);
    // Earthshine + readability fill for the Drive scene. At the poles
    // the Sun sits at 0–6°, so flat ground gets ~10% of direct Sun and
    // long DEM shadows cover most of the near field — with a faint fill
    // the surface reads as pure black and the real NAC texture is
    // invisible. The fill is raised (0.8) so the ground stays readable;
    // it is a display choice, labelled "brightness adjusted for
    // readability" in the HUD/Evidence — it does not fake a Sun.
    driveGroup.add(new THREE.HemisphereLight(0x8fa3c7, 0x2a2a33, 0.8));
    // Drive ground: a flat 500 m disc until this site's real LOLA DEM
    // loads (applyTerrain swaps in the displaced 1200 m heightfield —
    // one vertex per grid node, same heights the rover drives on).
    // The ground both casts (ridge shadows) and receives shadows.
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x8f8d88, roughness: 1, metalness: 0 });
    const ground = new THREE.Mesh(new THREE.CircleGeometry(500, 64), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.castShadow = true;
    ground.receiveShadow = true;
    driveGroup.add(ground);
    // Distance rings (50 / 100 / 200 m) so motion is judgeable — drawn
    // as terrain-following line loops so they are never buried by the
    // DEM relief (a flat ring would sink under a 130 m rise).
    const ringLines = [];
    const makeRingLine = (radius, color, lift) => {
      const geo = new THREE.BufferGeometry().setFromPoints(terrainRingPoints(null, radius, 128, lift));
      const line = new THREE.LineLoop(geo, new THREE.LineBasicMaterial({ color }));
      driveGroup.add(line);
      ringLines.push({ line, radius, lift });
      return line;
    };
    for (const r of [50, 100, 200]) makeRingLine(r, 0x6b7280, 0.25);
    // Landing-point ring at the origin (the rover starts here).
    makeRingLine(1.4, 0x34d399, 0.3);
    makeRingLine(1.7, 0x34d399, 0.3);
    // Scattered rocks (deterministic) for motion reference; their y is
    // re-seated on the DEM when terrain loads (still decorative — no
    // collision, labelled as such in the HUD).
    const rockRand = mulberry32(20261114);
    const rockGeo = new THREE.DodecahedronGeometry(1, 0);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x6e6c68, roughness: 1, metalness: 0 });
    const rockSpecs = [];
    for (let i = 0; i < 140; i++) {
      const rock = new THREE.Mesh(rockGeo, rockMat);
      rock.castShadow = true;
      rock.receiveShadow = true;
      const a = rockRand() * Math.PI * 2;
      const d = 8 + rockRand() * 240;
      const s = 0.2 + rockRand() * 1.3;
      const east = Math.cos(a) * d;
      const north = Math.sin(a) * d;
      rock.scale.setScalar(s);
      rock.position.set(east, s * 0.25, north);
      rock.rotation.set(rockRand() * 3, rockRand() * 3, rockRand() * 3);
      driveGroup.add(rock);
      rockSpecs.push({ mesh: rock, north, east, s });
    }
    // Drive-scene API for the terrain effect above: swap the ground
    // mesh, re-seat rings + rocks on the DEM, toggle DEM shading.
    let terrainActive = false;
    let terrainLookup = null; // feeds the wheel-track ribbon heights
    let terrainSiteId = null; // guards the async texture load (below)
    const updateRingLines = (lookup) => {
      for (const { line, radius, lift } of ringLines) {
        line.geometry.dispose();
        line.geometry = new THREE.BufferGeometry().setFromPoints(
          terrainRingPoints(lookup, radius, 128, lift),
        );
      }
    };
    const seatRocks = (lookup) => {
      for (const { mesh, north, east, s } of rockSpecs) {
        mesh.position.y = (lookup ? lookup.relativeHeightAtLocal(north, east) : 0) + s * 0.25;
      }
    };
    driveApiRef.current = {
      applyTerrain(grid, lookup) {
        terrainActive = true;
        terrainLookup = lookup;
        terrainSiteId = grid.siteId;
        const hasTexture = textureStatusForSite(grid.siteId).status === 'nac';
        ground.geometry.dispose();
        ground.geometry = buildTerrainGeometry(grid, { forTexture: hasTexture });
        ground.rotation.x = 0; // heightfield is already in (east, up, north)
        this.setShading(propsRef.current.terrainShading);
        // Real NAC ground imagery for this site, loaded lazily — the
        // mesh already carries the matching uv; sites without a texture
        // (no NAC coverage / PSR black) keep DEM shading only.
        groundMat.map = null;
        groundMat.needsUpdate = true;
        if (hasTexture) {
          loadGroundTexture(grid.siteId, base).then((tex) => {
            // Only apply if this grid is still the active one (the
            // user may have switched sites while the image loaded).
            if (!tex || !terrainActive || terrainSiteId !== grid.siteId) return;
            groundMat.map = tex;
            groundMat.needsUpdate = true;
          });
        }
        updateRingLines(lookup);
        seatRocks(lookup);
      },
      clearTerrain() {
        terrainActive = false;
        terrainLookup = null;
        terrainSiteId = null;
        groundMat.map = null;
        ground.geometry.dispose();
        ground.geometry = new THREE.CircleGeometry(500, 64);
        ground.rotation.x = -Math.PI / 2;
        this.setShading(false);
        updateRingLines(null);
        seatRocks(null);
      },
      setShading(on) {
        // Shading = vertex colours from the real DEM (elevation tint +
        // slope shading). Off = the old uniform lunar grey. Only
        // applies while the DEM mesh is active.
        groundMat.vertexColors = terrainActive && on;
        groundMat.color.set(terrainActive && on ? 0xffffff : 0x8f8d88);
        groundMat.needsUpdate = true;
      },
    };
    // Wheel dust + wheel tracks (illustrative effects — see
    // RoverEffects.js). The track ribbon follows the DEM through the
    // live terrain lookup; dust settles on the rover's ground height.
    const dust = new DustSystem();
    driveGroup.add(dust.group);
    const tracks = new TrackTrail({
      heightAtLocal: (northM, eastM) => (terrainLookup
        ? terrainLookup.relativeHeightAtLocal(northM, eastM)
        : 0),
    });
    driveGroup.add(tracks.group);

    // Real Apollo LRV model (GLB, public/models/lrv/) — the fetch was
    // already started on app mount by `preloadRealRover` (App.jsx),
    // so this usually resolves instantly from the cache; the
    // code-built rover drives until it arrives, and stays if the load
    // fails or the GLB is missing a pivot. The swap only re-points
    // the `roverParts` binding the animation loop already reads every
    // frame, so drive physics, HUD, terrain, and controls are
    // untouched. `roverLoadAlive` guards the swap if Drive mode / the
    // scene is torn down before the load finishes. The HUD reports
    // the model state via onRoverModelStatus ('loading' / 'real' /
    // 'fallback') so the stand-in is never shown silently.
    let roverParts = createRoverGroup();
    // The rover casts and receives shadows in Drive mode (its own
    // shadow on the DEM is part of the honest lighting).
    const applyRoverShadows = (parts) => {
      parts.group.traverse((o) => {
        if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
      });
    };
    applyRoverShadows(roverParts);
    driveGroup.add(roverParts.group);
    let roverLoadAlive = true;
    onRoverModelStatus?.('loading');
    loadRealRover(`${base}models/lrv/lunar_roving_vehicle.glb`)
      .then((real) => {
        if (!roverLoadAlive) return;
        driveGroup.remove(roverParts.group);
        roverParts = real;
        applyRoverShadows(real);
        driveGroup.add(real.group);
        onRoverModelStatus?.('real');
      })
      .catch((err) => {
        // 404, corrupt file, slow/failed network, or a missing node —
        // the code-built rover keeps driving; nothing else changes.
        console.warn('[rover] real LRV model unavailable — keeping the code-built rover:', err);
        onRoverModelStatus?.('fallback');
      });

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
    let elapsed = 0;
    let lastDriveMode = false;
    let lastTrackSiteId = null;
    let lastDriveCam = null; // snap the camera on chase<->driver toggle (below)
    const driveLook = new THREE.Vector3(0, 1, 5);
    const animate = () => {
      if (dead) return;
      raf = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.25);
      elapsed += dt;
      const t = elapsed;
      const { date, site, verdicts, driveMode, driveCam } = propsRef.current;

      if (driveMode !== lastDriveMode) {
        lastDriveMode = driveMode;
        camera.near = driveMode ? 0.1 : 0.1;
        camera.far = driveMode ? 5000 : 200;
        camera.updateProjectionMatrix();
      }

      if (driveMode) {
        // ---- Drive frame: hide the orbit scene, show the local one.
        moon.visible = false;
        ring.visible = false;
        lroGroup.visible = false;
        for (const m of markers.values()) m.visible = false;
        driveGroup.visible = true;
        // Raise ambient fill in Drive mode: at polar Sun angles the
        // flat ground gets ~10% of direct Sun and sits mostly in long
        // DEM shadows, so the 0.18 orbit-style fill leaves the real
        // surface black. 0.7 keeps the NAC texture + DEM shading
        // readable; the Sun + shadows still carry the contrast.
        ambientLight.intensity = 0.7;

        const rover = roverStateRef?.current;
        const input = driveInputRef?.current || {};
        if (rover) {
          roverStep(rover, input, dt);
          // A new site means new terrain — the old trail belongs to
          // the previous site's ground, so drop it.
          if (rover.siteId !== lastTrackSiteId) {
            lastTrackSiteId = rover.siteId;
            tracks.reset();
          }
          // Local frame: x = east, y = up, z = north.
          roverParts.group.position.set(rover.eastM, rover.heightM, rover.northM);
          roverParts.group.rotation.order = 'YXZ';
          roverParts.group.rotation.y = rover.headingRad;
          roverParts.group.rotation.x = -rover.pitchRad;
          roverParts.group.rotation.z = rover.rollRad;
          for (const w of Object.values(roverParts.wheels)) w.rotation.x = rover.wheelAngleRad;
          roverParts.steerGroups.front.rotation.y = rover.steerRad;
          roverParts.steerGroups.rear.rotation.y = -rover.steerRad;
          // Dust at the rear wheels + tracks along the driven path
          // (illustrative — labelled as such in the HUD/Evidence).
          dust.update(dt, rover);
          tracks.update(rover);

          // Chase cam (behind/above, follows heading) or driver cam.
          const fwd = new THREE.Vector3(Math.sin(rover.headingRad), 0, Math.cos(rover.headingRad));
          const pos = roverParts.group.position;
          let camTarget;
          let lookTarget;
          if (driveCam === 'driver') {
            // driverCameraPose: ahead of the mast/dish and just above
            // it, so the antenna is behind the camera — a driver's
            // view over the rover's front. See RoverModel.jsx.
            const pose = driverCameraPose(pos, rover.headingRad);
            camTarget = pose.camera;
            lookTarget = pose.lookAt;
          } else {
            camTarget = pos.clone().addScaledVector(fwd, -7).add(new THREE.Vector3(0, 3.2, 0));
            lookTarget = pos.clone().addScaledVector(fwd, 5).add(new THREE.Vector3(0, 1, 0));
          }
          camera.position.lerp(camTarget, driveCam === 'driver' ? 0.5 : 0.12);
          // On a chase<->driver toggle, SNAP the camera to the new pose
          // instead of lerping: the straight lerp path runs through the
          // rover body and the high-gain dish, so at low frame rates
          // the view clips through the dish for a visible moment.
          // The look direction still eases (driveLook lerp below), so
          // the toggle feels smooth without ever going through metal.
          if (lastDriveCam === null) {
            lastDriveCam = driveCam;
          } else if (driveCam !== lastDriveCam) {
            lastDriveCam = driveCam;
            camera.position.copy(camTarget);
          }
          driveLook.lerp(lookTarget, 0.2);
          camera.lookAt(driveLook);
        }

        // Sun/Earth in the LOCAL frame, from the ephemeris at the
        // rover's current lat/lon (directions only; distances in m).
        const livePos = rover
          ? sunEarthAt(date, roverLatLon(rover).lat, roverLatLon(rover).lon)
          : sunEarthAt(date, site.lat, site.lon);
        const sunLocal = altAzToLocal(livePos.sun.alt, livePos.sun.az);
        const earthLocal = altAzToLocal(livePos.earth.alt, livePos.earth.az);
        sunLight.position.copy(sunLocal).multiplyScalar(300);
        sunLight.target.position.copy(roverParts.group.position);
        sunLight.target.updateMatrixWorld();
        sunDisc.position.copy(sunLocal).multiplyScalar(400);
        sunDisc.scale.setScalar(4); // ~0.26° angular radius at 400 m
        sunDisc.visible = livePos.sun.alt > -8;
        earth.position.copy(earthLocal).multiplyScalar(350);
        earth.scale.setScalar(40); // ~2.3° across at 350 m
        earth.visible = livePos.earth.alt > -8;
        earth.rotation.y = t * 0.02;

        renderer.render(scene, camera);
        return;
      }

      // ---- Orbit frame (unchanged behaviour).
      moon.visible = true;
      ring.visible = true;
      lroGroup.visible = true;
      for (const m of markers.values()) m.visible = true;
      driveGroup.visible = false;
      ambientLight.intensity = 0.55;
      sunDisc.scale.setScalar(1);
      earth.scale.setScalar(1);
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
      const pos = sunEarthAt(date, site.lat, site.lon);
      const sunDir = altAzToWorld(site.lat, site.lon, pos.sun.alt, pos.sun.az);
      const earthDir = altAzToWorld(site.lat, site.lon, pos.earth.alt, pos.earth.az);
      sunLight.position.copy(sunDir).multiplyScalar(8);
      sunLight.target.position.set(0, 0, 0);
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
      roverLoadAlive = false;
      cancelAnimationFrame(raf);
      el.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', updateCameraAspect);
      stateRef.current = null;
      driveApiRef.current = null;
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
