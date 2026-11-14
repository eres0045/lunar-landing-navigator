/**
 * driveCamera tests — the 360° chase-cam orbit math.
 * theta = 0 must reproduce the original fixed chase framing exactly.
 */
import { describe, it, expect } from 'vitest';
import { DRIVE_CAM, DEFAULT_DRIVE_ORBIT, driveChaseCamera } from './driveCamera.js';

const POS = { x: 10, y: 5, z: -20 };

describe('driveChaseCamera', () => {
  it('theta = 0 reproduces the original fixed chase framing (heading north)', () => {
    const { camera, lookAt } = driveChaseCamera(POS, 0, DEFAULT_DRIVE_ORBIT);
    // 7 m behind (south of the rover), 3.2 m above the ground.
    expect(camera.x).toBeCloseTo(10, 9);
    expect(camera.y).toBeCloseTo(5 + DRIVE_CAM.heightM, 9);
    expect(camera.z).toBeCloseTo(-20 - DRIVE_CAM.distanceM, 9);
    // Looking 5 m ahead (north), 1 m up.
    expect(lookAt.x).toBeCloseTo(10, 9);
    expect(lookAt.y).toBeCloseTo(5 + DRIVE_CAM.lookHeightM, 9);
    expect(lookAt.z).toBeCloseTo(-20 + DRIVE_CAM.lookAheadM, 9);
  });

  it('theta = 0 reproduces the framing for an east heading too', () => {
    const { camera, lookAt } = driveChaseCamera(POS, Math.PI / 2, DEFAULT_DRIVE_ORBIT);
    // Heading east: behind = west, ahead = east.
    expect(camera.x).toBeCloseTo(10 - DRIVE_CAM.distanceM, 9);
    expect(camera.z).toBeCloseTo(-20, 9);
    expect(lookAt.x).toBeCloseTo(10 + DRIVE_CAM.lookAheadM, 9);
    expect(lookAt.z).toBeCloseTo(-20, 9);
  });

  it('theta = π puts the camera in front, looking back through the rover', () => {
    const { camera, lookAt } = driveChaseCamera(POS, 0, { theta: Math.PI, elevM: 0, distM: 0 });
    expect(camera.x).toBeCloseTo(10, 9);
    expect(camera.z).toBeCloseTo(-20 + DRIVE_CAM.distanceM, 9);
    // Look target swings 5 m behind the rover, so it stays centred.
    expect(lookAt.z).toBeCloseTo(-20 - DRIVE_CAM.lookAheadM, 9);
  });

  it('theta = π/2 is a side view looking at the rover itself', () => {
    const { camera, lookAt } = driveChaseCamera(POS, 0, { theta: Math.PI / 2, elevM: 0, distM: 0 });
    expect(camera.x).toBeCloseTo(10 - DRIVE_CAM.distanceM, 9);
    expect(camera.z).toBeCloseTo(-20, 9);
    expect(lookAt.x).toBeCloseTo(10, 9);
    expect(lookAt.z).toBeCloseTo(-20, 9);
  });

  it('elevM raises/lowers the camera and clamps to [1, 10] m above ground', () => {
    const up = driveChaseCamera(POS, 0, { theta: 0, elevM: 2, distM: 0 });
    expect(up.camera.y).toBeCloseTo(5 + DRIVE_CAM.heightM + 2, 9);
    const tooHigh = driveChaseCamera(POS, 0, { theta: 0, elevM: 100, distM: 0 });
    expect(tooHigh.camera.y).toBeCloseTo(5 + DRIVE_CAM.maxHeightM, 9);
    const tooLow = driveChaseCamera(POS, 0, { theta: 0, elevM: -100, distM: 0 });
    expect(tooLow.camera.y).toBeCloseTo(5 + DRIVE_CAM.minHeightM, 9);
  });

  it('distM zooms the camera in/out and clamps to [4, 12] m', () => {
    const far = driveChaseCamera(POS, 0, { theta: 0, elevM: 0, distM: 100 });
    const farDist = Math.hypot(far.camera.x - POS.x, far.camera.z - POS.z);
    expect(farDist).toBeCloseTo(DRIVE_CAM.maxDistanceM, 9);
    const near = driveChaseCamera(POS, 0, { theta: 0, elevM: 0, distM: -100 });
    const nearDist = Math.hypot(near.camera.x - POS.x, near.camera.z - POS.z);
    expect(nearDist).toBeCloseTo(DRIVE_CAM.minDistanceM, 9);
  });

  it('defaults to theta = 0 when no orbit is given', () => {
    const a = driveChaseCamera(POS, 0);
    const b = driveChaseCamera(POS, 0, DEFAULT_DRIVE_ORBIT);
    expect(a).toEqual(b);
  });
});
