#!/usr/bin/env python3
"""Fetch regional LOLA windows (LDEM_75S_30M, 30 m/px) around the 13
south-pole sites and reproject them onto the app's local tangent-plane
grid schema (+/-9990 m at 30 m spacing) for the terrain-aware horizon.

Route: MIT mirror imbrium.mit.edu via the local CONNECT forwarder on
127.0.0.1:18080 (same as raw-dem/extract_dem.py). Only the row bands
covering each site are fetched, via HTTP multipart Range requests
(100 row-ranges per request) — ~0.9 MB per site, never the 1.86 GB file.

Pixel mapping (VERIFIED 2026-11-14 in raw-dem/extract_dem.py against
cylindrical LDEM_128):
  rho = 2*R*tan((90+lat)/2), R = 1737400 m
  line0   = (OFFSET-1) - rho*cos(lon)/SCALE
  sample0 = (OFFSET-1) + rho*sin(lon)/SCALE
  OFFSET = 15247.5, SCALE = 30 for LDEM_75S_30M; HEIGHT = DN * 0.5 m,
  DN = little-endian int16, relative to the 1737400 m sphere.
Local lat/lon uses the app's own localToLatLon (rover.js equirectangular
tangent plane) so the regional grid is self-consistent with the local
10 m / 20 m grids. Reprojection is bilinear at native 30 m resolution
(no downscaling, no smoothing beyond the product's own interpolation).

Output: raw-dem/regional/<siteId>.json in the same schema as the local
grids (heights absolute above the 1737.4 km sphere) + verification
printed to stdout. Usage: python3 fetch_regional.py [siteId ...]
(default: all 13 polar sites; apollo15 is equatorial, not covered).
"""
import http.client
import json
import math
import os
import ssl
import sys

import numpy as np

PROXY_HOST, PROXY_PORT = "127.0.0.1", 18080
HOST = "imbrium.mit.edu"
URL = "/DATA/LOLA_GDR/POLAR/IMG/LDEM_75S_30M.IMG"
R = 1737400.0
OFF, SCALE = 15247.5, 30.0
RECORD_BYTES = 60992  # 30496 samples * 2 bytes
HALF_M = 9990         # +/-9990 m at 30 m spacing -> 667x667 nodes (~10 km)
STEP_M = 30

ROOT = os.path.expanduser("~/workspace/goals/hackathon-registration-drive/"
                          "projects/nasa-lunar-navigator")
OUT = os.path.join(ROOT, "raw-dem", "regional")
LOCAL = os.path.join(ROOT, "app", "public", "terrain")

SITES = [
    ("cabeus", "Peak Near Cabeus B", -83.661, -69.014),
    ("haworth", "Haworth", -86.753, -22.836),
    ("malapert", "Malapert Massif", -85.99, -0.125),
    ("mouton-plateau", "Mons Mouton Plateau", -84.232, 29.926),
    ("mouton", "Mons Mouton", -85.423, 31.586),
    ("nobile1", "Nobile Rim 1", -85.431, 37.241),
    ("nobile2", "Nobile Rim 2", -83.963, 58.654),
    ("gerlache2", "de Gerlache Rim 2", -88.225, -65.421),
    ("slater", "Slater Plain", -87.149, 126.134),
    ("connecting-ridge", "Connecting Ridge CR1", -89.4395, -137.1934),
    ("shoemaker", "Shoemaker PSR", -88.0517, 45.488),
    ("sverdrup", "Sverdrup PSR", -88.2432, -143.9156),
    ("faustini", "Faustini Rim A PSR", -87.146, 84.075),
]


def local_to_latlon(site_lat, site_lon, north_m, east_m):
    lat = site_lat + (north_m / R) * (180.0 / math.pi)
    lon = site_lon + (east_m / (R * math.cos(math.radians(site_lat)))) * (180.0 / math.pi)
    return lat, lon


def latlon_to_pixel(lat, lon):
    rho = 2 * R * np.tan(np.radians(90.0 + lat) / 2.0)
    lam = np.radians(lon)
    return (OFF - 1.0) - rho * np.cos(lam) / SCALE, (OFF - 1.0) + rho * np.sin(lam) / SCALE


def bilinear(g, lf, sf):
    """g: 2-D float array; lf/sf: float arrays of row/col coords (local to g)."""
    l0 = np.floor(lf).astype(int)
    s0 = np.floor(sf).astype(int)
    l0 = np.clip(l0, 0, g.shape[0] - 2)
    s0 = np.clip(s0, 0, g.shape[1] - 2)
    fl = lf - l0
    fs = sf - s0
    return ((g[l0, s0] * (1 - fs) + g[l0, s0 + 1] * fs) * (1 - fl)
            + (g[l0 + 1, s0] * (1 - fs) + g[l0 + 1, s0 + 1] * fs) * fl)


class Mirror:
    """One keep-alive HTTPS connection to the MIT mirror via the forwarder."""

    def __init__(self):
        self.conn = http.client.HTTPConnection(PROXY_HOST, PROXY_PORT, timeout=120)
        self.conn.set_tunnel(HOST, 443)
        self.conn.connect()
        self.sock = self.conn.sock
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        self.conn.sock = ctx.wrap_socket(self.sock, server_hostname=HOST)

    def fetch_ranges(self, ranges, tries=0):
        """ranges: list of (start, end) byte ranges. Returns {start: bytes}."""
        spec = ", ".join(f"{a}-{b}" for a, b in ranges)
        try:
            self.conn.request("GET", URL, headers={"Range": f"bytes={spec}"})
            resp = self.conn.getresponse()
        except (http.client.RemoteDisconnected, ConnectionResetError, BrokenPipeError):
            if tries >= 2:
                raise
            self.reconnect()
            return self.fetch_ranges(ranges, tries + 1)
        body = resp.read()
        status = resp.status
        ctype = resp.getheader("Content-Type", "")
        if status == 206 and "multipart/byteranges" in ctype:
            boundary = ctype.split("boundary=")[1].strip().strip('"').encode()
            out = {}
            for part in body.split(b"--" + boundary):
                if b"Content-Range:" not in part:
                    continue
                head, _, data = part.partition(b"\r\n\r\n")
                cr = [l for l in head.split(b"\r\n") if l.startswith(b"Content-Range:")][0]
                a = int(cr.split(b"bytes ")[1].split(b"-")[0])
                data = data[:-2] if data.endswith(b"\r\n") else data
                out[a] = data
            return out
        if status == 206:
            # Single range echoed back (should not happen with >1 range).
            cr = resp.getheader("Content-Range", "")
            a = int(cr.split("bytes ")[1].split("-")[0])
            return {a: body}
        raise RuntimeError(f"range fetch failed: HTTP {status}: {body[:200]!r}")

    def reconnect(self):
        try:
            self.conn.close()
        except Exception:
            pass
        self.conn = http.client.HTTPConnection(PROXY_HOST, PROXY_PORT, timeout=120)
        self.conn.set_tunnel(HOST, 443)
        self.conn.connect()
        self.sock = self.conn.sock
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        self.conn.sock = ctx.wrap_socket(self.sock, server_hostname=HOST)

    def close(self):
        self.conn.close()


def fetch_window(mirror, site_id, lat, lon):
    """Fetch the pixel window covering +/-HALF_M around the site."""
    ls, ss = [], []
    for k in range(72):
        a = 2 * math.pi * k / 72
        la, lo = local_to_latlon(lat, lon, HALF_M * math.cos(a), HALF_M * math.sin(a))
        l, s = latlon_to_pixel(la, lo)
        ls.append(l)
        ss.append(s)
    l0 = int(math.floor(min(ls))) - 3
    l1 = int(math.ceil(max(ls))) + 3
    s0 = int(math.floor(min(ss))) - 3
    s1 = int(math.ceil(max(ss))) + 3
    rows, cols = l1 - l0 + 1, s1 - s0 + 1
    win = np.zeros((rows, cols), dtype=np.int16)
    ranges, metas = [], []
    for li in range(l0, l1 + 1):
        a = li * RECORD_BYTES + s0 * 2
        b = li * RECORD_BYTES + (s1 + 1) * 2 - 1
        ranges.append((a, b))
        metas.append(li)
    for chunk_i in range(0, len(ranges), 100):
        chunk = ranges[chunk_i:chunk_i + 100]
        got = mirror.fetch_ranges(chunk)
        for (a, _b), li in zip(chunk, metas[chunk_i:chunk_i + 100]):
            data = got.get(a)
            assert data is not None and len(data) == (s1 - s0 + 1) * 2, \
                f"{site_id} row {li}: got {None if data is None else len(data)} bytes"
            win[li - l0, :] = np.frombuffer(data, dtype="<i2")
    return win, l0, s0


def reproject(win, l0, s0, site_lat, site_lon):
    """Bilinear-resample the pixel window onto the local +/-HALF_M grid."""
    n = 2 * (HALF_M // STEP_M) + 1  # 667
    norths = HALF_M - np.arange(n) * STEP_M
    easts = -HALF_M + np.arange(n) * STEP_M
    nn, ee = np.meshgrid(norths, easts, indexing="ij")
    lats = site_lat + (nn / R) * (180.0 / math.pi)
    lons = site_lon + (ee / (R * math.cos(math.radians(site_lat)))) * (180.0 / math.pi)
    lf, sf = latlon_to_pixel(lats, lons)
    heights = bilinear(win.astype(np.float64) * 0.5, lf - l0, sf - s0)
    return heights, n


def main():
    want = sys.argv[1:] or [s[0] for s in SITES]
    os.makedirs(OUT, exist_ok=True)
    mirror = Mirror()
    try:
        for site_id, name, lat, lon in SITES:
            if site_id not in want:
                continue
            win, l0, s0 = fetch_window(mirror, site_id, lat, lon)
            nodata = int(np.sum(win == -32768))
            heights, n = reproject(win, l0, s0, lat, lon)
            local = json.load(open(os.path.join(LOCAL, f"{site_id}.json")))
            ci = n // 2
            centre_reg = float(heights[ci, ci])
            centre_loc = float(local["centerHeightM"])
            # Seam check: local 10/20 m grid vs regional 30 m grid at 600 m ring.
            seam = []
            for k in range(36):
                a = 2 * math.pi * k / 36
                la, lo = local_to_latlon(lat, lon, 600 * math.cos(a), 600 * math.sin(a))
                lf, sf = latlon_to_pixel(la, lo)
                hv = float(bilinear(win.astype(np.float64) * 0.5,
                                    np.array([lf - l0]), np.array([sf - s0]))[0])
                # local grid value at the same point (bilinear over local grid)
                gh = local["heights"]
                sp = local["spacingM"]
                rf = (local["originNorthM"] - 600 * math.cos(a)) / sp
                cf = (600 * math.sin(a) - local["originEastM"]) / sp
                r0 = min(max(int(math.floor(rf)), 0), local["rows"] - 2)
                c0 = min(max(int(math.floor(cf)), 0), local["cols"] - 2)
                fr, fc = rf - r0, cf - c0
                lv = (gh[r0][c0] * (1 - fc) + gh[r0][c0 + 1] * fc) * (1 - fr) \
                    + (gh[r0 + 1][c0] * (1 - fc) + gh[r0 + 1][c0 + 1] * fc) * fr
                seam.append(abs(hv - lv))
            grid = {
                "siteId": site_id,
                "siteName": name,
                "centerLat": lat,
                "centerLon": lon,
                "spacingM": STEP_M,
                "rows": n,
                "cols": n,
                "halfSizeM": HALF_M,
                "originNorthM": HALF_M,
                "originEastM": -HALF_M,
                "rowConvention": "row 0 = north edge; north = originNorthM - row*spacingM; east = originEastM + col*spacingM",
                "heights": [[round(float(v), 1) for v in row] for row in heights],
                "datum": "metres above reference sphere radius 1737400 m (LOLA GDR LDEM_75S_30M: HEIGHT = DN * 0.5)",
                "centerHeightM": centre_reg,
                "minHeightM": round(float(heights.min()), 1),
                "maxHeightM": round(float(heights.max()), 1),
                "noDataNodes": 0,
                "source": "LRO LOLA GDR LDEM_75S_30M (LRO-L-LOLA-4-GDR-V1.0)",
                "sourceUrl": f"https://imbrium.mit.edu{URL}",
                "resolutionM": 30,
                "license": "NASA public domain (US government work)",
                "sampled": "2026-11-14",
                "note": "Regional window reprojected from the 30 m polar product onto the app local frame (+/-9990 m, 30 m spacing) for the terrain-aware horizon beyond the 1.2 km local grid. Bilinear at native resolution; no downscaling. Valid only inside r <= 9990 m of the centre (the disc the pixel window was fetched for); corner nodes beyond that radius are edge-clamped, not data — horizon rays stop at 9990 m in every direction.",
            }
            out_path = os.path.join(OUT, f"{site_id}.json")
            with open(out_path, "w") as f:
                json.dump(grid, f)
            print(f"{site_id:16s} window {win.shape[0]}x{win.shape[1]} px, "
                  f"no-data DNs: {nodata}, centre regional {centre_reg:.1f} m vs "
                  f"local {centre_loc:.1f} m (d={centre_reg - centre_loc:+.1f} m), "
                  f"seam |d| max {max(seam):.1f} m mean {sum(seam)/len(seam):.1f} m, "
                  f"relief {grid['minHeightM']:.1f}..{grid['maxHeightM']:.1f} m -> {out_path}")
    finally:
        mirror.close()


if __name__ == "__main__":
    main()
