# Drive Mode — Rover Notes

Drive mode drops the camera to the surface at the selected site and lets
you drive a rover across it. The rover is **code-built from three.js
primitives, modelled on the Apollo Lunar Roving Vehicle (LRV)** — it is
labelled as such in the Drive HUD and is NOT the flight vehicle.

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

## Future swap-in candidate (NOT downloaded — do not retry)

- **Sketchfab "Mondfahrzeug (Lunar Rover)"** by Deutsches Museum |
  Digital — https://sketchfab.com/3d-models/mondfahrzeug-lunar-rover-acb3f8645a69493cb211a62b40d66aab
- Licence: **CC-BY-SA 4.0** (as listed on Sketchfab).
- **464,143 faces** — needs mesh simplification before web use.
- Status: the Sketchfab download is **blocked from this side**
  (three different attempts, all HTTP 401). **Do not retry the
  download and do not ask anyone to re-enter a token.** When a GLB
  becomes available by another route, simplify it first, then swap it
  in through `loadRoverModel(url)` (see below).

No freely downloadable Apollo LRV or VIPER model exists from any
official NASA source (NASA 3D Resources catalogue has neither;
Smithsonian holds the LRV test unit as CC0 object/images only, no 3D
scan; the only VIPER model found is paid). That is why the rover is
code-built.

## Architecture

- **Local meter-scale frame.** The global scene is unit-sphere scale
  (1 unit = 1,737 km), so 1 m ≈ 5.8e-7 units and float32 precision
  breaks if the rover moves in world units. In Drive mode the Moon
  sphere, site markers, and LRO are hidden and a tangent-plane frame
  centred on the site is rendered instead: a ~500 m ground disc
  (x = east, y = up, z = north), distance rings at 50/100/200 m, a
  landing-point ring at the origin, deterministic scattered rocks,
  and the rover at the origin. Sun directional light + Sun disc and
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
  `app/src/lib/rover.js` is the ONE place Step 2's real DEM plugs in.
  It returns 0 today (smooth sphere). `slopeAt` finite-differences
  it, so the rover's height, pitch, and roll follow automatically
  once a DEM is supplied via `setSurfaceHeightAt(fn)` — no other code
  changes. `resetSurfaceHeightAt()` restores the smooth sphere.
- **GLB swap hook** — `loadRoverModel(url)` in
  `app/src/components/RoverModel.jsx` loads any GLB via three's
  GLTFLoader. The code-built group exposes `{ group, wheels,
  steerGroups }` (front/rear steer pivots yaw with steering; wheels
  spin with speed). A swapped-in GLB replaces the group with no
  changes to drive physics, HUD, or terrain — only its wheel/steer
  pivots need wiring (or drive it as one rigid group).
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
- Terrain is still a **smooth sphere** until Step 2: no craters,
  ridges, or slopes; the ground disc is flat and the rocks are
  decorative (no collision).
- The rover is **code-built, not the real vehicle**: proportions
  follow the verified LRV dimensions, but details (seats, mast,
  antenna, fenders) are simplified primitives.
- The real LRV steers front AND rear wheels in opposite directions;
  the model does the same (rear pivot gets −steerRad).
- Sun/Earth verdicts in Drive mode use the flat-horizon geometric
  rules, same as orbit mode — no terrain shadowing.
