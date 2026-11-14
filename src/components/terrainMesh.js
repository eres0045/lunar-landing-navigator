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
import { terrainVertexColors, terrainUV, textureStatusForSite } from '../lib/terrain.js';

/**
 * Build the displaced heightfield mesh geometry for a site grid.
 * Returns a BufferGeometry with position / color / normal / uv + index.
 * Vertex (r, c) sits at east = originEastM + c*spacingM,
 * north = originNorthM − r*spacingM, y = relative height.
 * The uv maps the real LROC NAC ground texture (same ±600 m box,
 * linear in lon/lat) onto the mesh; `forTexture` softens the vertex
 * colours so the imagery stays readable (see terrain.js).
 */
export function buildTerrainGeometry(grid, { forTexture = false } = {}) {
  const { rows, cols, spacingM, originNorthM, originEastM, centerHeightM, heights } = grid;
  const count = rows * cols;
  const positions = new Float32Array(count * 3);
  const uvs = new Float32Array(count * 2);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = (r * cols + c) * 3;
      positions[i] = originEastM + c * spacingM; // x = east
      positions[i + 1] = heights[r][c] - centerHeightM; // y = up (relative)
      positions[i + 2] = originNorthM - r * spacingM; // z = north
      const { u, v } = terrainUV(grid, r, c);
      uvs[(r * cols + c) * 2] = u;
      uvs[(r * cols + c) * 2 + 1] = v;
    }
  }
  const index = [];
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = r * cols + c;
      const b = a + 1;
      const d = a + cols;
      const e = d + 1;
      // Winding chosen so the front face points up (+y): (a, b, d) and
      // (b, e, d) — the earlier order (a, d, b) / (b, d, e) put the
      // normals DOWN (mean normal y was −0.99), so the Sun never lit
      // the ground and the terrain rendered black at every site.
      index.push(a, b, d, b, e, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(terrainVertexColors(grid, { forTexture }), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

// ---- Lazy ground-texture loading (one NAC image per site, cached) --

const textureCache = new Map();

/**
 * Fetch one site's real NAC ground texture (public/terrain/nac/<id>.jpg,
 * lazy — never all 8 up front). Resolves the THREE.Texture, or null
 * when the site has no texture (no NAC coverage / PSR black) or the
 * fetch fails — the caller keeps DEM shading in that case. The promise
 * is cached per site; a failed load is evicted so a retry can succeed.
 */
export function loadGroundTexture(siteId, base) {
  if (textureStatusForSite(siteId).status !== 'nac') return Promise.resolve(null);
  if (textureCache.has(siteId)) return textureCache.get(siteId);
  const b = base ?? '/';
  const p = new Promise((resolve) => {
    new THREE.TextureLoader().load(
      `${b}terrain/nac/${siteId}.jpg`,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        resolve(tex);
      },
      undefined,
      () => resolve(null),
    );
  }).catch(() => {
    textureCache.delete(siteId);
    return null;
  });
  textureCache.set(siteId, p);
  return p;
}

/** Test helper: clear the texture load cache. */
export function clearGroundTextureCache() {
  textureCache.clear();
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
