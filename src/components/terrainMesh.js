/**
 * terrainMesh — three.js geometry built from a real LOLA DEM grid.
 *
 * The mesh is the full 1200 m × 1200 m grid square, one vertex per grid
 * node, in the Drive frame (x = east, y = up, z = north), heights
 * relative to the landing point (grid height − centerHeightM). Vertex
 * colours come from terrain.js (elevation tint + slope shading from
 * the real heights only).
 */
import * as THREE from 'three';
import { terrainVertexColors } from '../lib/terrain.js';

/**
 * Build the displaced heightfield mesh geometry for a site grid.
 * Returns a BufferGeometry with position / color / normal + index.
 * Vertex (r, c) sits at east = originEastM + c*spacingM,
 * north = originNorthM − r*spacingM, y = relative height.
 */
export function buildTerrainGeometry(grid) {
  const { rows, cols, spacingM, originNorthM, originEastM, centerHeightM, heights } = grid;
  const count = rows * cols;
  const positions = new Float32Array(count * 3);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = (r * cols + c) * 3;
      positions[i] = originEastM + c * spacingM; // x = east
      positions[i + 1] = heights[r][c] - centerHeightM; // y = up (relative)
      positions[i + 2] = originNorthM - r * spacingM; // z = north
    }
  }
  const index = [];
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = r * cols + c;
      const b = a + 1;
      const d = a + cols;
      const e = d + 1;
      // Winding chosen so the front face points up (+y).
      index.push(a, d, b, b, d, e);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(terrainVertexColors(grid), 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

/**
 * Points for a terrain-following circle (distance ring / landing ring)
 * in the Drive frame: `segments` points around radius `radiusM`, each
 * lifted `liftM` above the DEM surface (or flat at `liftM` when no
 * lookup is available yet). Returns an array of THREE.Vector3.
 */
export function terrainRingPoints(lookup, radiusM, segments = 128, liftM = 0.3) {
  const pts = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const east = Math.cos(a) * radiusM;
    const north = Math.sin(a) * radiusM;
    const y = (lookup ? lookup.relativeHeightAtLocal(north, east) : 0) + liftM;
    pts.push(new THREE.Vector3(east, y, north));
  }
  return pts;
}
