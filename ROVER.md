# Drive Mode — Rover Notes

Drive mode drops the camera to the surface at the selected site and lets
you drive a rover across it. The rover is the **real Apollo LRV mesh** —
the Deutsches Museum "Mondfahrzeug (Lunar Rover)", CC-BY-SA 4.0, converted
from the NASA Space ROS COLLADA files to a decimated GLB (pipeline below).
The **code-built rover** (three.js primitives, same published dimensions)
remains as the fallback: it is mounted ONLY if the GLB fails to load or
is missing a pivot. It no longer drives while the GLB loads (Step 3,
2026-11-15): on a cold load into Drive mode — the default boot — the
stand-in flashed on screen for ~2 s before the swap, its big centred
dish filling the chase view (live probe, `step3-live-early-canvas.png`).
While the GLB loads, no rover is shown; the terrain, sky, HUD and the
drive camera (which follows the physics state, not the mesh) stay live,
and the rover appears the moment its model is ready.

## Apollo LRV dimensions — verified published figures

Every figure below was checked against a NASA/published source on
2026-11-14. Where sources disagree, the disagreement is stated, not
smoothed over.

| Dimension | Value used | Source |
|---|---|---|
| Overall frame length | **3.1 m** | NASA NSSDCA, "The Apollo Lunar Roving Vehicle" — "The frame was 3.1 meters long" (https://nssdc.gsfc.nasa.gov/planetary/lunar/apollo_lrv.html). Also NASA SP-4214 ch. 13: "measured 3.1 meters long". |
| Wheelbase | **2.29 m** | Boeing LRV Operations Handbook LS006-002-2H, Fig. 1-1 (three-view drawing): 90 in = 2.29 m, as transcribed at https://www.thisdayinaviation.com/31-july-1971/. NASA NSSDCA rounds this to 2.3 m. The model uses the precise 2.29 m. |
| Track width | **1.83 m** | Same handbook Fig. 1-1: 72 in = 1.83 m. |
| Overall width | **~1.8 m** | NASA SP-4214 ch. 13 (https://solarviews.com/history/SP-4214/ch13-3.html): "1.8 meters wide". The model uses the 1.83 m track for wheel placement; the two figures agree to within 3 cm. |
| Height (max) | **1.14 m** | NASA NSSDCA: "The maximum height was 1.14 meters." |
| Wheel diameter | **0.818 m** | NASA NSSDCA: "an 81.8 cm diameter, 23 cm wide tire made of zinc coated woven 0.083 cm diameter steel strands". |
| Wheel width | **0.23 m** | NASA NSSDCA, same sentence as above. |
| Ground clearance (fully loaded) | **0.36 m** | NASA NSSDCA: "Fully loaded the LRV had a ground clearance of 36 cm." |
| Mass (vehicle, unloaded) | **210 kg** | NASA NSSDCA: "The Lunar Roving Vehicle had a mass of 210 kg and was designed to hold a payload of an additional 490 kg." |
| Steering radius | **3.1 m** | NASA NSSDCA: "Both sets of wheels would turn in opposite directions, giving a steering radius of 3.1 meters". |
| Top speed (designed) | **13 km/h (8 mph)** | Design figure: 8 mph. (Wikipedia's LRV article, citing the design spec, and Astronomy magazine's LRV spec roundup both give 8 mph / 13 km/h; Astronomy gives "about 9 mph (14 kph)".) This is the Drive mode default max speed. |
| Top speed (achieved) | **18 km/h (11.2 mph, Apollo 17)** | Apollo 17 achieved 11.2 mph (18 km/h). The Drive HUD's max-speed slider goes up to 18 km/h so the driver can use the achieved figure — it is labelled as achieved, not designed. |
| Speed — NOT used | — | NASA SP-4214 ch. 13 says "speeds up to 17 kilometers per hour (11 miles per hour)". That 17 km/h sits between the 13 km/h design figure and the 18 km/h Apollo 17 record; the model uses 13 km/h as the conservative design cap and 18 km/h as the slider ceiling, and does not claim 17 km/h as a spec. |

Sources disagree slightly on length (3.0 m frame vs 3.1 m overall) and
top speed (13 / 14 / 17 / 18 km/h depending on design vs achieved vs
rounded). The model takes the NSSDCA figures as primary and the
handbook's precise wheelbase/track, and says so above.

## Real model — DONE (2026-11-14)

- **Source:** NASA Space ROS PR space-ros/simulation#32 (fork
  JasperGrant/simulation, branch summer_sprint, commit
  0551f2cca567bb90811c7c214bcc542fc7a8e60d), the Deutsches Museum
  "Mondfahrzeug" mesh converted to COLLADA — files
  `lunar_roving_vehicle.dae`, `wheel_left.dae`, `wheel_right.dae`,
  `wheel_cover_L/R_F/B.dae`, 7 × 2048×2048 PNG textures. Kept in
  `../raw-lrv/` (102 MB of sources — NOT shipped to the site).
- **Licence: CC-BY-SA 4.0** — attribution to **Deutsches Museum |
  Digital** is REQUIRED, plus credit to **Jasper Grant / NASA Space
  ROS**. ShareAlike applies to the adapted mesh. The attribution is
  in the Drive HUD, the panel credits, and the Evidence modal
  ("Drive rover — real Apollo LRV model"), and in the SOURCES list.
- **Pipeline (Blender 4.2.0, `~/workspace/tmp-lrv/lrv-build/convert.py`):**
  DAE import → decimate (Blender Decimate modifier) → scale to the
  published LRV dimensions → assemble → GLB export.
  - Decimate: body 0.2× (271,486 → 54,297 tris), each wheel 0.2×
    (~44,000 → ~8,800 tris), each wheel cover 0.5× (~3,600–4,150 →
    ~1,785–2,074 tris). Imported parts totalled 375,237 tris before
    decimation (Sketchfab lists 464,143 faces for the source model);
    **the shipped GLB is 97,340 tris**.
  - Scale: body length 2.964 → 3.1 m, width 1.553 → 1.83 m; wheel
    radius 0.358 → 0.409 m (diameter 0.818 m) — the verified NSSDCA
    figures in the table above.
  - Textures: 7 × 2048×2048 PNG → **1024×1024 JPEG**, packed into the
    GLB. Shipped file: `public/models/lrv/lunar_roving_vehicle.glb`,
    6,361,612 bytes.
  - Node tree (verified by re-importing the GLB into Blender):
    EMPTY `lrv` (root, origin, ground y=0) → MESH `body` (54,297 tris,
    8 materials) + EMPTY `steer_front` (0, 0.409, +1.145) → `cover_L_F`,
    `cover_R_F`, `wheel_fl`, `wheel_fr` + EMPTY `steer_rear`
    (0, 0.409, −1.145) → `cover_L_B`, `cover_R_B`, `wheel_rl`,
    `wheel_rr`. Forward = +Z, up = +Y — the same convention as the
    code-built rover. Wheel meshes are centred on their axle and their
    local X axis IS the axle, so `rotation.x` spins them about it.
  - Assembled bbox: X width ~2.14 m, Y height 0–1.86 m, Z length
    ~3.15 m (the 1.86 m height is the mast/antenna; the NSSDCA 1.14 m
    is the chassis max — the museum mesh includes the tall antenna).
- **Swap-in:** `loadRealRover(url)` in `RoverModel.jsx` loads the GLB
  and `wireRealRover(scene)` wires it into the `{ group, wheels,
  steerGroups }` shape the animation loop already uses — no physics,
  HUD, terrain, or control changes. `LunarScene.jsx` mounts NO rover
  until a model is ready — the real GLB when it arrives, the code-built
  rover only on ANY failure (404, corrupt file, network error, or a
  missing node — `wireRealRover` throws naming the node). The mount is
  guarded if Drive mode is exited before the load finishes.
- **Preload (2026-11-14) + no-flash fix (Step 3, 2026-11-15):** the fetch starts on app mount, not on
  Drive entry — `App.jsx` calls `preloadRealRover(url)`, which caches
  the load promise per URL, so by the time the user opens Drive mode
  from orbit view the 6.4 MB GLB is usually parsed. On a COLD load the
  default boot IS Drive mode, so there is no orbit dwell time: the GLB
  still takes ~3–4 s (live probe: requested 2.7 s, done 4.3 s after
  navigation start), and the old code-built stand-in was visible for
  that window. Since Step 3 no rover at all is mounted while loading —
  the code-built rover mounts only on load failure — so the stand-in
  never flashes. `loadRealRover`
  reuses the same cached promise, so re-mounts never re-fetch. The
  HUD reports the model state (`drive-rover-model`): loading / real /
  fallback — no rover is ever shown silently as the wrong model.
- **Driver cam (2026-11-14, reworked twice 2026-11-15):** the first driver cam (1.6 m ahead,
  1.5 m up) sat 5 cm in front of the dish and below its top, so the
  dish filled the frame. Measured from the shipped GLB: dish front
  face z ≈ +1.55 m, mast top y ≈ 1.86 m, dish on the rover's LEFT
  (x +0.16…+0.91 m — and the GLB's own node names confirm the sign:
  `cover_R_F` / `wheel_fr` sit at −X, so with forward +Z the rover's
  RIGHT side is −X; a camera at +0.6 would sit on the dish side).
  The second pose (0.6 m right of centre, 0.65 m ahead, eye 1.45 m)
  cleared the dish but saw NO rover at all — every front-fender /
  wheel top point projected to NDC y ≈ −1.4, below the frame bottom
  (live screenshots `step3-live-driver-lowsun2.png` /
  `step3-live-driver-highsun2.png`). The ROVER.md claim written for
  that pose — "the front fenders/wheels and console sit at the bottom
  of the frame" — was FALSE and is struck here. A high eye "looking
  over the dish" (e.g. +0.6, 1.95, 0.9) is worse, not better: it
  puts the dish's top corner INSIDE a desktop frame (NDC −0.68) and
  still shows no fender.
- **Driver cam, second rework (2026-11-15):** the first rework's pose
  (−0.7, 1.2, 0.6), look 30 m ahead at 0.6 m up, was chosen from the
  fender's bounding-box corner (−0.77, 0.81, 1.57 → NDC 0.46, −0.81,
  "bottom quarter") — but that corner is a phantom point: no fender
  vertex is there. The real fender vertices sit 30–45° below
  horizontal from the seat, outside the 25° vertical half-FOV, so
  the whole fender / wheel / body projected to ZERO clipped screen
  area and the live driver view (phone, Malapert low-Sun and Apollo 15
  high-Sun) showed no rover at all — confirmed three independent ways:
  clip-space projected area, a raycast that hits the fender at 0.6 m
  while the framebuffer at its screen spot reads ground colour, and
  a green marker box / torus / sphere placed at the same spot rendering
  fine (so it is the pose, not the renderer, materials, or geometry).
  The correct metric is the CLIPPED screen area of the actual vertices
  (clip-space Sutherland–Hodgman; NDC-space clipping fabricates phantom
  area from vertices behind the camera). Vertex-area search
  (`scripts/_pose-vertex.mjs`) shows the eye must sit AT the seat,
  not 0.6 m ahead of it: at 0.6 m the fender is 0.13–0.97 m away and
  every real vertex is clipped. `driverCameraPose()` in `RoverModel.jsx`
  now uses (−0.75, 1.2, 0.0), look 30 m ahead at −2.0 m up (a 6.1°
  downward pitch; the look target is below the terrain — it is a
  direction, not a ground point): eye 1.2 m (a seated astronaut: seat
  0.56 m + ~0.65 m), at the outer edge of the right seat (seat spans
  x −0.73…−0.11 m). On a 390×844 phone the right-front fender +
  right-front wheel have 4.08 NDC² of clipped visible area (frame =
  4 NDC²) and the dish has 0 vertices in frame — completely clear.
  Live phone probe: ~34k rover pixels, 89% in the bottom quarter,
  all on the right half (the driver's-side front), 0 in the top third.
  The left (far-side) fender stays off-frame. On a wide desktop frame
  the dish's inner edge intrudes at the TOP-LEFT edge only (34 vertices
  in frame at 16:9, NDC x −0.97…−0.75, y 0.30…0.93) — at the frame
  edge, never central — and the front is visible there too (1.38 NDC²).
  The same pose roughly clears the code-built rover's centred dish:
  its centre is off-frame on phone and at the top-left edge on desktop
  (max|NDC| ≈ 0.89 at 16:9) — never in the central half — and its
  front-right fender lands in the lower half. Tests assert the pose
  against the shipped GLB's own vertices (clipped area + dish vertices
  in frame) and the fallback disc sampled on its surface.
  The chase↔driver toggle also SNAPS the camera to the new pose instead
  of lerping — the straight lerp path runs through the rover body
  and the dish, so at low frame rates the view clipped through the
  dish mid-transition; the look direction still eases. Caveat: on
  rough terrain the rover rolls toward the dish side, which could bring
  a dish edge further into a wide desktop frame; on phone the dish is
  fully clear (0 vertices in frame).
- **Dust + tracks (2026-11-14):** `RoverEffects.js` — wheel dust
  (a fixed 48-sprite pool spawned at the rear wheel contact points
  while |speed| > 0.5 m/s, ~6 particles per metre driven, ballistic
  fall at lunar 1.62 m/s², fading over ~1.2 s) and wheel tracks (one
  dark ribbon per side at the wheel lines, sampled every 0.75 m,
  capped at 400 samples ≈ 300 m, following the DEM heights). Both
  are ILLUSTRATIVE — labelled in the HUD and Evidence, not regolith
  physics — and cheap: no per-frame allocation, two pre-allocated
  ribbon meshes.
- **Tests:** `src/components/RoverModel.test.jsx` — wiring from a fake
  scene, throws on a missing wheel/steer/`lrv` node, the shipped GLB
  itself parsed + wired (tri count + bbox asserted), and the fallback
  path (load failure → code-built rover).

No freely downloadable Apollo LRV or VIPER model exists from any
official NASA source (NASA 3D Resources catalogue has neither;
Smithsonian holds the LRV test unit as CC0 object/images only, no 3D
scan; the only VIPER model found is paid). That is why the rover was
code-built until this model arrived via Space ROS.

## Architecture

- **Local meter-scale frame.** The global scene is unit-sphere scale
  (1 unit = 1,737 km), so 1 m ≈ 5.8e-7 units and float32 precision
  breaks if the rover moves in world units. In Drive mode the Moon
  sphere, site markers, and LRO are hidden and a tangent-plane frame
  centred on the site is rendered instead: a ~500 m ground disc
  (x = east, y = up, z = north), terrain-following distance rings at
  50/100/200 m, a landing-point ring at the origin, deterministic
  scattered rocks, and the rover at the origin. The ground is the real
  LOLA DEM heightfield (1200 m square, Step 2 — see TERRAIN.md), not
  the flat disc Step 1 shipped. Sun directional light + Sun disc and
  the Earth globe are placed by alt/az **direction** from the site
  using the same ephemeris (`sunEarthAt` at the rover's live lat/lon),
  at local distances in metres. The starfield is kept. Camera
  near/far switch to meter scale (0.1 / 5000) in Drive mode.
- **Physics** — `app/src/lib/rover.js` (pure, no three.js). Kinematic
  bicycle model: state `{northM, eastM, headingRad, speedMs,
  steerRad}`, heading rate = speed/wheelbase · tan(steer), heading
  wraps 0–360°, wheel spin = speed / wheel radius. `step(state,
  input, dt)` with throttle/reverse/steering/brake. `createRover(site)`
  factory. `localToLatLon` / `latLonToLocal` use R = 1,737,400 m.
- **Terrain plug-in** — `surfaceHeightAt(lat, lon)` in
  `app/src/lib/rover.js` is fed by the real LOLA DEM since Step 2
  (see TERRAIN.md): `LunarScene` lazy-loads the site's grid from
  `public/terrain/<siteId>.json` and calls `setSurfaceHeightAt(fn)`
  with a bilinear lookup (relative to the landing point).
  `slopeAt` finite-differences it, so the rover's height, pitch, and
  roll follow the real relief — no other code changes.
  `resetSurfaceHeightAt()` restores the smooth sphere (used by tests
  and as the fallback if a grid fails to load).
- **GLB swap** — `loadRealRover(url)` in
  `app/src/components/RoverModel.jsx` loads the real-LRV GLB via
  three's GLTFLoader and `wireRealRover(scene)` wires its wheel/steer
  pivots into `{ group, wheels, steerGroups }` — the same shape the
  code-built group exposes (front/rear steer pivots yaw with steering;
  wheels spin with speed). The GLB is mounted when it arrives (no rover
  is shown while it loads — Step 3); any load/wiring failure mounts the
  code-built rover instead (see above).
- **Controls** — WASD / arrow keys (W/↑ forward, S/↓ reverse, A/D or
  ←/→ steer), Space = brake, Esc = back to orbit. On-screen
  hold-to-drive buttons (▲ ▼ ◀ ▶ ⏹) via pointerdown/up. Keys are
  ignored when focus is in an input/select/textarea or a modal is
  open. Camera: chase cam (behind/above, follows heading) + driver
  cam toggle. Max-speed slider: 5–18 km/h, default 13 km/h.
- **HUD** — live speed (km/h + m/s), heading, lat/lon (4 decimals),
  distance from landing point, Sun/Earth elevation at the rover's
  **current** position (`sunEarthAt` on the live lat/lon, not the
  site's), and live POWER/COMM verdicts. State is exposed in the DOM
  (`data-testid="drive-hud"`, `drive-speed`, `drive-heading`,
  `drive-lat`, `drive-lon`, `drive-distance`, `drive-sun-alt`,
  `drive-earth-alt`, `drive-power`, `drive-comm`) so a Playwright
  probe can assert position actually changes after driving.

## Honest limits

- Rover physics is a **kinematic approximation, not regolith
  dynamics**: no wheel slip, no suspension travel, no sinkage, no
  lunar-gravity (1/6 g) effects, no slope-dependent traction.
  Acceleration (1.2 m/s²), braking (3.0 m/s²), reverse limit
  (1.5 m/s), and steering rate are **chosen for a drivable feel,
  not NASA figures** — they are labelled `DRIVE_TUNING` in
  `rover.js` and stated as approximations here.
- Terrain is now the **real LRO LOLA DEM** (Step 2, see TERRAIN.md):
  one 1200 m × 1200 m grid per site (10 m/px for 10 sites, 20 m/px
  for Cabeus / Mons Mouton Plateau / Nobile Rim 2), bilinear lookup
  via `surfaceHeightAt`, ground mesh displaced from the same grid.
  The rover's height, pitch, and roll follow the real relief
  (Malapert: +17.7 m after 500 m north). Still NOT resolved: anything
  below ~10–20 m (boulders, small craters); the scattered rocks are
  decorative (no collision).
- The rover is now the **real LRV mesh** (see above), not a
  primitive approximation — but it is still a museum mesh, not the
  flight vehicle: details and proportions are the Deutsches Museum
  model's, scaled to the published dimensions. The code-built rover
  (simplified primitives: seats, mast, antenna, fenders) is the
  load-failure fallback ONLY — it is never shown while the GLB loads
  (Step 3: the old stand-in flashed for ~2 s on cold load).
- Wheel dust and track marks are **illustrative effects**, not
  regolith physics: no dust-ballistics model beyond a 1.62 m/s² fall,
  no sinkage, no track depth — they show where the wheels have been,
  not what the regolith did.
- The real LRV steers front AND rear wheels in opposite directions;
  the model does the same (rear pivot gets −steerRad).
- Sun/Earth verdicts in Drive mode use the real local horizon from the
  LOLA DEM measured at the landing point — the same terrain-aware
  verdicts as orbit mode. As the rover drives away from the landing
  point, that horizon is an approximation of the rover's own horizon
  (the HUD says so).
