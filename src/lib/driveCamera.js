/**
 * Drive camera — chase-cam pose for Drive mode (pure math, no three.js).
 *
 * The chase camera sits behind the rover at a fixed distance and height
 * and looks ahead of it. The driver can orbit it 360° around the rover
 * by dragging the scene: `theta` is the azimuth offset from directly
 * behind (0 = behind, π/2 = side, π = in front), `elevM` raises or
 * lowers the camera, `distM` zooms it in/out (wheel on desktop).
 *
 * Coordinates are the drive tangent-plane frame: x = east, y = up,
 * z = north. Heading is clockwise from north (0 = north).
 * roverPos: { x, y, z } in metres; headingRad in radians.
 * Returns { camera: { x, y, z }, lookAt: { x, y, z } } in metres.
 *
 * theta = 0 reproduces the original fixed chase framing exactly
 * (7 m behind, 3.2 m up, looking 5 m ahead) — see the tests.
 */
export const DRIVE_CAM = {
  /** Horizontal distance behind the rover at rest, m. */
  distanceM: 7,
  /** Camera height above the ground at rest, m. */
  heightM: 3.2,
  /** How far ahead of the rover the camera looks at theta = 0, m. */
  lookAheadM: 5,
  /** Look-target height above the ground, m. */
  lookHeightM: 1,
  /** Camera height limits, m. */
  minHeightM: 1.0,
  maxHeightM: 10,
  /** Camera distance limits, m. */
  minDistanceM: 4,
  maxDistanceM: 12,
};

export const DEFAULT_DRIVE_ORBIT = { theta: 0, elevM: 0, distM: 0 };

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function driveChaseCamera(roverPos, headingRad, orbit = {}) {
  const theta = orbit.theta ?? 0;
  const height = clamp(
    DRIVE_CAM.heightM + (orbit.elevM ?? 0),
    DRIVE_CAM.minHeightM,
    DRIVE_CAM.maxHeightM,
  );
  const dist = clamp(
    DRIVE_CAM.distanceM + (orbit.distM ?? 0),
    DRIVE_CAM.minDistanceM,
    DRIVE_CAM.maxDistanceM,
  );
  // Camera azimuth: heading + π puts it behind the rover; theta orbits
  // it around (π/2 = side view, π = front view).
  const az = headingRad + Math.PI + theta;
  const camera = {
    x: roverPos.x + Math.sin(az) * dist,
    y: roverPos.y + height,
    z: roverPos.z + Math.cos(az) * dist,
  };
  // Look target: 5 m ahead at theta = 0, swinging to the rover itself
  // at a side view and 5 m behind it from the front, so the rover
  // stays centred while orbiting.
  const lookAhead = DRIVE_CAM.lookAheadM * Math.cos(theta);
  const lookAt = {
    x: roverPos.x + Math.sin(headingRad) * lookAhead,
    y: roverPos.y + DRIVE_CAM.lookHeightM,
    z: roverPos.z + Math.cos(headingRad) * lookAhead,
  };
  return { camera, lookAt };
}
