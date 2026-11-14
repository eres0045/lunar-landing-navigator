/**
 * App — Lunar Landing Site Navigator (NASA Space Apps 2026, CH-04).
 *
 * Full-screen 3D Moon south-pole scene with ONE transparent glass
 * control panel: site picker (13 published sites), date/time picker,
 * live Sun/Earth positions + POWER / COMM verdicts, and four tools —
 * Compare, Window finder, Mission brief, Evidence. Same visual language
 * as the SPICA fire lab (dark space scene, glass panel, emerald accents),
 * rebuilt for the Moon.
 *
 * All numbers come from src/lib/data.js + src/lib/ephemeris.js
 * (astronomy-engine + IAU lunar rotation model, ±0.1° geometry,
 * flat horizon — no terrain shadowing). Nothing is invented.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  SITES, TYPE_LABEL, getSite, fmt, fmtSigned, siteVerdict,
  compareSites, rankSites, findWindows, SOURCES, METHOD,
  REFERENCE_VALUES, PUBLISHED_ILLUMINATION, DISCLAIMER,
  POWER_RULE, COMM_RULE, powerVerdict, commVerdict, TERRAIN_NOTE,
  ROVER_NOTE,
} from './lib/data.js';
import {
  LRV, createRover, roverVerdict, headingDeg,
  speedKmh, distanceFromStart,
} from './lib/rover.js';
import LunarScene, { CAMERA_PRESETS } from './components/LunarScene.jsx';

const DATE_CHIPS = [
  { label: 'Nov 14 · 12:00 UTC', value: '2026-11-14T12:00' },
  { label: 'Nov 15 · 12:00 UTC', value: '2026-11-15T12:00' },
  { label: 'Full Moon · Nov 24 14:53 UTC', value: '2026-11-24T14:53' },
  { label: 'New Moon · Nov 9 07:02 UTC', value: '2026-11-09T07:02' },
];

function formatDateUTC(date) {
  return `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

function VerdictBadge({ verdict }) {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-xs font-bold"
      style={{ color: verdict.color, border: `1px solid ${verdict.color}66`, backgroundColor: `${verdict.color}22` }}
    >
      {verdict.label}
    </span>
  );
}

export default function App() {
  const [siteId, setSiteId] = useState('malapert');
  const [dateInput, setDateInput] = useState('2026-11-14T12:00');
  const date = useMemo(() => new Date(`${dateInput}:00Z`), [dateInput]);
  const site = getSite(siteId);

  // All 13 sites at the chosen instant — drives the marker colours and
  // the brief; the selected pack is picked out of it (one ephemeris pass).
  const ranked = useMemo(() => rankSites(date), [date]);
  const verdict = ranked.find((p) => p.site.id === siteId) || siteVerdict(date, site);

  const [panelOpen, setPanelOpen] = useState(
    () => (typeof window === 'undefined' ? true : window.innerWidth >= 1024),
  );
  const [panelHidden, setPanelHidden] = useState(false);

  // ---- Draggable panel (desktop) ------------------------------------
  const [panelPos, setPanelPos] = useState(null);
  const panelRef = useRef(null);
  const panelDrag = useRef(null);
  const onPanelDragStart = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    if (typeof window !== 'undefined' && window.innerWidth < 1024) return;
    if (e.target.closest('button') || e.target.closest('input') || e.target.closest('select')) return;
    const rect = panelRef.current?.getBoundingClientRect();
    const origin = panelPos ?? (rect ? { x: rect.left, y: rect.top } : { x: 16, y: 16 });
    panelDrag.current = { startX: e.clientX, startY: e.clientY, origin };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPanelDragMove = (e) => {
    const d = panelDrag.current;
    if (!d) return;
    const x = Math.max(-180, Math.min(window.innerWidth - 90, d.origin.x + e.clientX - d.startX));
    const y = Math.max(0, Math.min(window.innerHeight - 60, d.origin.y + e.clientY - d.startY));
    setPanelPos({ x, y });
  };
  const onPanelDragEnd = () => { panelDrag.current = null; };

  // ---- Camera ---------------------------------------------------------
  const [camCmd, setCamCmd] = useState({ seq: 0, kind: null });
  const [activePreset, setActivePreset] = useState('wide');
  const sendCamCmd = (kind, preset) => setCamCmd((c) => ({ seq: c.seq + 1, kind, preset }));
  const applyCameraPreset = (name) => {
    if (!CAMERA_PRESETS[name]) return;
    setActivePreset(name);
    sendCamCmd('preset', name);
  };
  const onZoom = (dir) => {
    setActivePreset(null);
    sendCamCmd(dir === 'in' ? 'zoom-in' : 'zoom-out');
  };

  // ---- Drive mode -----------------------------------------------------
  // Physics runs in LunarScene's animation loop (it owns the rover
  // group); App owns the input + HUD and reads the live state through
  // these shared refs. The HUD polls the ref so the numbers update
  // without re-rendering the 3D scene.
  const [driveMode, setDriveMode] = useState(false);
  const [driveCam, setDriveCam] = useState('chase');
  const [maxSpeedKmh, setMaxSpeedKmh] = useState(LRV.topSpeedKmh);
  // Real LOLA DEM terrain for the selected site (loaded lazily by
  // LunarScene); the HUD reports which terrain is under the rover.
  const [terrainStatus, setTerrainStatus] = useState({ siteId: site.id, state: 'loading' });
  const [terrainShading, setTerrainShading] = useState(true);
  const terrainLine = terrainStatus.state === 'loaded'
    ? `Terrain: real LRO LOLA DEM, ${terrainStatus.resolutionM} m/px · relief ${Math.round(terrainStatus.reliefM)} m over the 1.2 km square`
    : terrainStatus.state === 'loading'
      ? 'Terrain: loading real LOLA DEM…'
      : 'Terrain: flat — DEM unavailable (smooth-sphere fallback)';
  const driveInputRef = useRef({ throttle: 0, reverse: 0, steer: 0, brake: false });
  const roverStateRef = useRef(null);
  const [hud, setHud] = useState(null);
  const exitDrive = () => {
    driveInputRef.current = { throttle: 0, reverse: 0, steer: 0, brake: false };
    setDriveMode(false);
  };
  const enterDrive = () => {
    if (!roverStateRef.current || roverStateRef.current.siteId !== site.id) {
      roverStateRef.current = createRover(site, { maxSpeedKmh });
    }
    setDriveMode(true);
  };
  useEffect(() => {
    if (!driveMode) { setHud(null); return undefined; }
    const tick = () => {
      const r = roverStateRef.current;
      if (!r) {
        setHud({ lat: site.lat, lon: site.lon, speedMs: 0, heading: 0, distanceM: 0,
          heightM: 0, pitchDeg: 0, rollDeg: 0,
          sunAlt: verdict.sun.alt, earthAlt: verdict.earth.alt,
          power: verdict.power, comm: verdict.comm });
        return;
      }
      const v = roverVerdict(date, r, { powerVerdict, commVerdict });
      setHud({
        lat: v.lat, lon: v.lon, speedMs: r.speedMs, heading: headingDeg(r),
        distanceM: distanceFromStart(r.northM, r.eastM),
        heightM: r.heightM, pitchDeg: (r.pitchRad * 180) / Math.PI,
        rollDeg: (r.rollRad * 180) / Math.PI,
        sunAlt: v.sun.alt, earthAlt: v.earth.alt, power: v.power, comm: v.comm,
      });
    };
    tick();
    const id = setInterval(tick, 150);
    return () => clearInterval(id);
  }, [driveMode, date, site, verdict]);

  // ---- Modals ---------------------------------------------------------
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareIds, setCompareIds] = useState(['malapert', 'connecting-ridge', 'slater', 'gerlache2']);
  const [windowsOpen, setWindowsOpen] = useState(false);
  const [windowDays, setWindowDays] = useState(14);
  const [briefOpen, setBriefOpen] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const anyModal = compareOpen || windowsOpen || briefOpen || evidenceOpen;
  useEffect(() => {
    if (!anyModal) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setCompareOpen(false); setWindowsOpen(false); setBriefOpen(false); setEvidenceOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [anyModal]);

  // Keyboard driving: WASD / arrows + Space brake + Esc exit. Keys
  // never fight the panel — ignored in inputs/selects/textareas and
  // while any modal is open.
  useEffect(() => {
    if (!driveMode) return undefined;
    const isEditable = (t) => t && /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName);
    const applyKey = (e, down) => {
      const inp = driveInputRef.current;
      switch (e.key) {
        case 'w': case 'W': case 'ArrowUp': inp.throttle = down ? 1 : 0; break;
        case 's': case 'S': case 'ArrowDown': inp.reverse = down ? 1 : 0; break;
        case 'a': case 'A': case 'ArrowLeft': inp.steer = down ? -1 : (inp.steer < 0 ? 0 : inp.steer); break;
        case 'd': case 'D': case 'ArrowRight': inp.steer = down ? 1 : (inp.steer > 0 ? 0 : inp.steer); break;
        case ' ': inp.brake = down; break;
        default: return false;
      }
      return true;
    };
    const onDown = (e) => {
      if (isEditable(e.target) || anyModal) return;
      if (e.key === 'Escape') { exitDrive(); return; }
      if (applyKey(e, true)) e.preventDefault();
    };
    const onUp = (e) => {
      if (isEditable(e.target) || anyModal) return;
      applyKey(e, false);
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, [driveMode, anyModal]);

  const comparison = useMemo(
    () => (compareOpen ? compareSites(date, compareIds) : []),
    [compareOpen, date, compareIds],
  );
  const windows = useMemo(
    () => (windowsOpen ? findWindows(date, site, windowDays) : null),
    [windowsOpen, date, site, windowDays],
  );
  const toggleCompareSite = (id) => {
    setCompareIds((prev) => (prev.includes(id)
      ? prev.filter((x) => x !== id)
      : [...prev, id]));
  };

  const artemisSites = SITES.filter((s) => s.type === 'artemis-region');
  const extraSites = SITES.filter((s) => s.type !== 'artemis-region');

  return (
    <div className="fixed inset-0 overflow-hidden bg-black text-slate-100">
      <div className="absolute inset-0">
        <LunarScene
          date={date}
          site={site}
          verdicts={ranked}
          cameraCmd={camCmd}
          onSelectSite={setSiteId}
          driveMode={driveMode}
          driveCam={driveCam}
          driveInputRef={driveInputRef}
          roverStateRef={roverStateRef}
          maxSpeedKmh={maxSpeedKmh}
          terrainShading={terrainShading}
          onTerrainStatus={setTerrainStatus}
        />
      </div>

      <div className="glass-text pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/10 bg-white/[0.07] px-3 py-1 text-xs font-bold tracking-wide text-slate-100 backdrop-blur-md">
        🌙 Lunar Landing Site Navigator
      </div>

      {/* Drive HUD — live rover state while in Drive mode. */}
      {driveMode && hud && (
        <div data-testid="drive-hud" className="absolute right-3 top-12 z-20 w-[280px] rounded-2xl border border-white/20 bg-slate-900/85 p-3 shadow-2xl backdrop-blur-md">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-100">🚀 Driving — {site.name}</h2>
            <button type="button" onClick={exitDrive} aria-label="Back to orbit"
              className="shrink-0 rounded-md border border-white/15 bg-white/[0.08] px-2 py-0.5 text-xs font-bold text-slate-200">✕ Back to orbit</button>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
            Real Apollo LRV model: Deutsches Museum | Digital, CC-BY-SA 4.0, via NASA Space ROS.
            Physics is a kinematic approximation. <span data-testid="drive-terrain">{terrainLine}</span>
          </p>
          <div className="mt-2 space-y-1 rounded-lg border border-white/10 bg-white/[0.05] p-2 text-[13px] leading-snug">
            <p>Speed: <span data-testid="drive-speed" className="font-bold tabular-nums">{fmt(speedKmh({ speedMs: hud.speedMs }), 1)} km/h</span>
              {' '}({fmt(hud.speedMs, 2)} m/s)</p>
            <p>Heading: <span data-testid="drive-heading" className="font-bold tabular-nums">{fmt(hud.heading, 1)}°</span></p>
            <p>Position: <span data-testid="drive-lat" className="font-bold tabular-nums">{fmt(hud.lat, 4)}°</span>
              {' '}<span data-testid="drive-lon" className="font-bold tabular-nums">{fmt(hud.lon, 4)}°</span></p>
            <p>Distance from landing point: <span data-testid="drive-distance" className="font-bold tabular-nums">{fmt(hud.distanceM, 1)} m</span></p>
            <p>Elevation vs landing point: <span data-testid="drive-height" className="font-bold tabular-nums">{fmt(hud.heightM, 1)} m</span></p>
            <p>Pitch / roll: <span data-testid="drive-pitch" className="font-bold tabular-nums">{fmt(hud.pitchDeg, 1)}°</span>{' / '}
              <span data-testid="drive-roll" className="font-bold tabular-nums">{fmt(hud.rollDeg, 1)}°</span></p>
            <p>☀️ Sun: <span data-testid="drive-sun-alt" className="font-bold tabular-nums">{fmtSigned(hud.sunAlt)}</span>{' '}
              <span data-testid="drive-power" className="font-bold" style={{ color: hud.power.color }}>{hud.power.label}</span></p>
            <p>🌍 Earth: <span data-testid="drive-earth-alt" className="font-bold tabular-nums">{fmtSigned(hud.earthAlt)}</span>{' '}
              <span data-testid="drive-comm" className="font-bold" style={{ color: hud.comm.color }}>{hud.comm.label}</span></p>
          </div>
          <div className="mt-2">
            <label htmlFor="drive-max-speed" className="text-xs font-semibold text-slate-300">
              Max speed: {maxSpeedKmh} km/h (LRV design 13 · Apollo 17 achieved 18)
            </label>
            <input id="drive-max-speed" type="range" min="5" max="18" step="1" value={maxSpeedKmh}
              aria-label="Maximum drive speed in kilometres per hour"
              onChange={(e) => setMaxSpeedKmh(Number(e.target.value))}
              className="mt-1 w-full accent-emerald-400" />
          </div>
          <div className="mt-2 flex gap-1.5">
            <button type="button" onClick={() => setDriveCam((c) => (c === 'chase' ? 'driver' : 'chase'))}
              aria-label="Toggle drive camera" data-testid="drive-camera-toggle"
              className="flex-1 rounded-lg border border-white/15 bg-white/[0.05] px-2 py-1.5 text-xs font-semibold text-slate-200">
              📷 {driveCam === 'chase' ? 'Chase cam → Driver cam' : 'Driver cam → Chase cam'}
            </button>
            <button type="button" onClick={() => setTerrainShading((v) => !v)}
              aria-label="Toggle DEM terrain shading" data-testid="drive-terrain-shading"
              className="flex-1 rounded-lg border border-white/15 bg-white/[0.05] px-2 py-1.5 text-xs font-semibold text-slate-200">
              ⛰️ DEM shading: {terrainShading ? 'on' : 'off'}
            </button>
          </div>
          <div className="mt-2 flex gap-1.5">
            <button type="button" onClick={exitDrive} aria-label="Exit drive mode"
              className="flex-1 rounded-lg border border-emerald-400/40 bg-emerald-400/20 px-2 py-1.5 text-xs font-semibold text-emerald-200">
              ← Back to orbit (Esc)
            </button>
          </div>
          {/* Touch controls — hold to drive. */}
          <div className="mt-2 grid grid-cols-3 gap-1.5" role="group" aria-label="Touch drive controls">
            <span />
            <button type="button" data-testid="drive-btn-forward" aria-label="Hold to drive forward"
              onPointerDown={(e) => { e.preventDefault(); driveInputRef.current.throttle = 1; }}
              onPointerUp={() => { driveInputRef.current.throttle = 0; }}
              onPointerLeave={() => { driveInputRef.current.throttle = 0; }}
              onPointerCancel={() => { driveInputRef.current.throttle = 0; }}
              className="rounded-lg border border-white/15 bg-white/[0.08] px-2 py-2 text-lg font-bold text-slate-100 active:bg-emerald-400/40">▲</button>
            <span />
            <button type="button" data-testid="drive-btn-left" aria-label="Hold to steer left"
              onPointerDown={(e) => { e.preventDefault(); driveInputRef.current.steer = -1; }}
              onPointerUp={() => { driveInputRef.current.steer = 0; }}
              onPointerLeave={() => { driveInputRef.current.steer = 0; }}
              onPointerCancel={() => { driveInputRef.current.steer = 0; }}
              className="rounded-lg border border-white/15 bg-white/[0.08] px-2 py-2 text-lg font-bold text-slate-100 active:bg-emerald-400/40">◀</button>
            <button type="button" data-testid="drive-btn-brake" aria-label="Hold to brake"
              onPointerDown={(e) => { e.preventDefault(); driveInputRef.current.brake = true; }}
              onPointerUp={() => { driveInputRef.current.brake = false; }}
              onPointerLeave={() => { driveInputRef.current.brake = false; }}
              onPointerCancel={() => { driveInputRef.current.brake = false; }}
              className="rounded-lg border border-white/15 bg-white/[0.08] px-2 py-2 text-lg font-bold text-slate-100 active:bg-rose-400/40">⏹</button>
            <button type="button" data-testid="drive-btn-right" aria-label="Hold to steer right"
              onPointerDown={(e) => { e.preventDefault(); driveInputRef.current.steer = 1; }}
              onPointerUp={() => { driveInputRef.current.steer = 0; }}
              onPointerLeave={() => { driveInputRef.current.steer = 0; }}
              onPointerCancel={() => { driveInputRef.current.steer = 0; }}
              className="rounded-lg border border-white/15 bg-white/[0.08] px-2 py-2 text-lg font-bold text-slate-100 active:bg-emerald-400/40">▶</button>
            <span />
            <button type="button" data-testid="drive-btn-reverse" aria-label="Hold to reverse"
              onPointerDown={(e) => { e.preventDefault(); driveInputRef.current.reverse = 1; }}
              onPointerUp={() => { driveInputRef.current.reverse = 0; }}
              onPointerLeave={() => { driveInputRef.current.reverse = 0; }}
              onPointerCancel={() => { driveInputRef.current.reverse = 0; }}
              className="rounded-lg border border-white/15 bg-white/[0.08] px-2 py-2 text-lg font-bold text-slate-100 active:bg-emerald-400/40">▼</button>
            <span />
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
            Keys: W/↑ forward · S/↓ reverse · A/D or ←/→ steer · Space brake · Esc exit.
          </p>
        </div>
      )}

      {panelHidden ? (
        <button type="button" onClick={() => setPanelHidden(false)}
          aria-label="Show navigator controls"
          className="glass-text absolute bottom-3 left-3 z-20 rounded-full border border-white/20 bg-white/[0.07] px-3 py-1.5 text-xs font-semibold text-slate-100 backdrop-blur-md">
          🌙 Show controls
        </button>
      ) : (
      <div ref={panelRef} style={panelPos ? { left: panelPos.x, top: panelPos.y, bottom: 'auto' } : undefined} className="glass-text absolute inset-x-0 bottom-0 z-20 max-h-[46vh] overflow-y-auto rounded-t-2xl border-t border-white/20 bg-white/[0.07] shadow-2xl backdrop-blur-md lg:inset-x-auto lg:bottom-4 lg:left-4 lg:top-4 lg:max-h-[calc(100vh-32px)] lg:w-[300px] lg:rounded-2xl lg:border">
        <div className="p-3">
          <div
            className="flex cursor-grab select-none items-center justify-between active:cursor-grabbing"
            title="Drag to move the panel · double-click to dock it back"
            onPointerDown={onPanelDragStart}
            onPointerMove={onPanelDragMove}
            onPointerUp={onPanelDragEnd}
            onPointerCancel={onPanelDragEnd}
            onDoubleClick={() => setPanelPos(null)}
          >
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200">🌙 Navigator <span className="text-[10px] normal-case tracking-normal text-slate-500">· draggable</span></h2>
            <span className="flex gap-1">
              <button type="button"
                onClick={() => setPanelOpen((v) => !v)}
                aria-expanded={panelOpen}
                aria-label={panelOpen ? 'Collapse navigator controls' : 'Expand navigator controls'}
                className="rounded-md border border-white/15 bg-white/[0.08] px-2 py-0.5 text-xs font-bold text-slate-200 backdrop-blur-md">
                {panelOpen ? '▾' : '▸'}
              </button>
              <button type="button"
                onClick={() => setPanelHidden(true)}
                aria-label="Hide navigator panel"
                title="Hide panel — enjoy the full visual"
                className="rounded-md border border-white/15 bg-white/[0.08] px-2 py-0.5 text-xs font-bold text-slate-200 backdrop-blur-md">
                ✕
              </button>
            </span>
          </div>

          {/* Live verdict line — always visible, even when collapsed. */}
          <p className="mt-2 rounded-lg border border-white/10 bg-white/[0.08] px-2 py-1.5 text-[13px] font-semibold leading-snug" aria-live="polite">
            {site.name} · {formatDateUTC(date)} →{' '}
            <span style={{ color: verdict.power.color }}>{verdict.power.label}</span>
            {' · Earth '}
            <span style={{ color: verdict.comm.color }}>{verdict.comm.label}</span>
          </p>

          {panelOpen && (
            <>
              {/* Camera */}
              <h3 className="mt-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Camera</h3>
              <div className="mt-1.5 flex items-center gap-1.5" role="group" aria-label="Camera zoom">
                <button type="button" onClick={() => onZoom('out')} aria-label="Zoom out"
                  className="rounded-lg border border-white/15 bg-white/[0.05] px-3 py-1 text-sm font-bold text-slate-200 hover:border-white/30">−</button>
                <button type="button" onClick={() => onZoom('in')} aria-label="Zoom in"
                  className="rounded-lg border border-white/15 bg-white/[0.05] px-3 py-1 text-sm font-bold text-slate-200 hover:border-white/30">+</button>
                <span className="text-[11px] text-slate-400">Zoom — drag the Moon to orbit, click a marker to pick a site</span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label="Camera views">
                {Object.entries(CAMERA_PRESETS).map(([name, preset]) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => applyCameraPreset(name)}
                    aria-pressed={activePreset === name}
                    aria-label={`Camera view: ${preset.label}`}
                    className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
                      activePreset === name ? 'border-emerald-300/60 bg-emerald-400/80 text-slate-950' : 'border-white/15 bg-white/[0.05] text-slate-200 hover:border-white/30'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Drive mode */}
              <button type="button" onClick={enterDrive} aria-label="Drive on the surface"
                className="mt-2 block w-full rounded-lg border border-rose-400/40 bg-rose-400/10 px-3 py-2 text-left text-sm font-semibold text-rose-200 hover:border-rose-300">
                🚀 Drive on the surface — explore {site.name} by rover
                <span className="block text-xs font-normal text-slate-400">Real Apollo LRV model · WASD / arrows to drive, Space to brake, Esc to return to orbit</span>
              </button>

              {/* Site picker */}
              <h3 className="mt-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Landing site — 13 published points</h3>
              <p className="mt-1 text-[11px] leading-tight text-slate-400">Artemis III region centres (NASA Oct 2024). Extras are labelled PSR centres / study spots, not region centres.</p>
              <div className="mt-1.5 space-y-1">
                {artemisSites.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSiteId(s.id)}
                    aria-pressed={siteId === s.id}
                    className={`block w-full rounded-lg border px-3 py-1 text-left text-sm font-semibold ${
                      siteId === s.id ? 'border-emerald-400 bg-white/[0.16] text-emerald-200' : 'border-white/10 bg-white/[0.05] text-slate-200 hover:border-white/30'
                    }`}
                  >
                    {s.name}
                    <span className="block text-xs font-normal text-slate-400">{fmt(Math.abs(s.lat), 3)}°S · {fmt(s.lon, 3)}°E · {TYPE_LABEL[s.type]}</span>
                  </button>
                ))}
              </div>
              <div className="mt-1.5 space-y-1">
                {extraSites.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSiteId(s.id)}
                    aria-pressed={siteId === s.id}
                    className={`block w-full rounded-lg border px-3 py-1 text-left text-sm font-semibold ${
                      siteId === s.id ? 'border-sky-400 bg-white/[0.16] text-sky-200' : 'border-white/10 bg-white/[0.05] text-slate-200 hover:border-white/30'
                    }`}
                  >
                    {s.name}
                    <span className="block text-xs font-normal text-slate-400">{fmt(Math.abs(s.lat), 4)}°S · {fmt(s.lon, 4)}°E · {TYPE_LABEL[s.type]}</span>
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">{site.note}</p>
              {site.published && (
                <p className="mt-1 rounded-lg border border-emerald-400/30 bg-emerald-400/[0.08] p-2 text-[11px] leading-relaxed text-emerald-100">{site.published}</p>
              )}

              {/* Date / time */}
              <h3 className="mt-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Date &amp; time (UTC)</h3>
              <input
                type="datetime-local"
                aria-label="Date and time (UTC)"
                value={dateInput}
                onChange={(e) => { if (e.target.value) setDateInput(e.target.value); }}
                className="mt-1.5 w-full rounded-lg border border-white/15 bg-white/[0.08] px-2 py-1.5 text-sm text-slate-100 [color-scheme:dark]"
              />
              <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label="Quick dates">
                {DATE_CHIPS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setDateInput(c.value)}
                    aria-pressed={dateInput === c.value}
                    className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                      dateInput === c.value ? 'border-emerald-300/60 bg-emerald-400/80 text-slate-950' : 'border-white/15 bg-white/[0.05] text-slate-200 hover:border-white/30'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              {/* Live numbers */}
              <h3 className="mt-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Sun &amp; Earth at {site.name}</h3>
              <div className="mt-1.5 space-y-1 rounded-lg border border-white/10 bg-white/[0.05] p-2 text-[13px] leading-snug">
                <p>☀️ Sun: altitude <span className="font-bold tabular-nums">{fmtSigned(verdict.sun.alt)} </span>· azimuth <span className="font-bold tabular-nums">{fmt(verdict.sun.az, 1)}°</span> <VerdictBadge verdict={verdict.power} /></p>
                <p className="text-xs text-slate-400">{verdict.power.detail}</p>
                <p>🌍 Earth: altitude <span className="font-bold tabular-nums">{fmtSigned(verdict.earth.alt)}</span> · azimuth <span className="font-bold tabular-nums">{fmt(verdict.earth.az, 1)}°</span> <VerdictBadge verdict={verdict.comm} /></p>
                <p className="text-xs text-slate-400">{verdict.comm.detail}</p>
                <p>🌕 Moon illuminated: <span className="font-bold tabular-nums">{fmt(verdict.illumination * 100, 1)}%</span></p>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">{POWER_RULE}</p>
              <p className="text-[11px] leading-relaxed text-slate-400">{COMM_RULE}</p>

              {/* Tools */}
              <button type="button" onClick={() => setCompareOpen(true)} aria-label="Open site comparison"
                className="mt-3 block w-full rounded-lg border border-sky-400/40 bg-sky-400/10 px-3 py-2 text-left text-sm font-semibold text-sky-200 hover:border-sky-300">
                🔭 Compare sites — side by side at this date
                <span className="block text-xs font-normal text-slate-400">Sun / Earth / POWER / COMM for up to 13 sites</span>
              </button>
              <button type="button" onClick={() => setWindowsOpen(true)} aria-label="Open landing window finder"
                className="mt-2 block w-full rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-3 py-2 text-left text-sm font-semibold text-emerald-200 hover:border-emerald-300">
                📅 Landing windows — best days from this date
                <span className="block text-xs font-normal text-slate-400">Sun-lit + Earth-visible hours, 14 or 30 days, hourly sampling</span>
              </button>
              <button type="button" onClick={() => setBriefOpen(true)} aria-label="Open mission brief"
                className="mt-2 block w-full rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-left text-sm font-semibold text-amber-200 hover:border-amber-300">
                📋 Mission brief — all 13 sites ranked for this date
                <span className="block text-xs font-normal text-slate-400">Best Sun first, then best Earth — printable</span>
              </button>
              <button type="button" onClick={() => setEvidenceOpen(true)} aria-label="Open evidence"
                className="mt-2 block w-full rounded-lg border border-violet-400/40 bg-violet-400/10 px-3 py-2 text-left text-sm font-semibold text-violet-200 hover:border-violet-300">
                🔬 Evidence — the math, inputs &amp; sources
                <span className="block text-xs font-normal text-slate-400">How every number is computed, and what is NOT modelled</span>
              </button>

              <p className="mt-2 text-[11px] leading-relaxed text-slate-400">{DISCLAIMER}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                Moon texture is illustrative; markers sit at the published coordinates on the sphere grid.
                Drive terrain is the real LRO LOLA DEM (10–20 m/px, NASA public domain) — see Evidence.
                No sub-10 m boulders or craters are resolved; the scattered drive-scene rocks are decorative, with no collision.
                LRO model: NASA, public domain. Moon texture: three.js example, NASA lunar imagery. Sun texture: Solar System Scope, CC BY 4.0. Earth: NASA Blue Marble.
                Rover model: Deutsches Museum | Digital, CC-BY-SA 4.0, via NASA Space ROS — see Evidence.
              </p>
            </>
          )}
        </div>
      </div>
      )}

      {/* Compare modal */}
      {compareOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-3" role="dialog" aria-modal="true" aria-label="Compare sites">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/20 bg-slate-900/95 p-4 shadow-2xl backdrop-blur-md">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-base font-bold text-slate-100">Compare sites — {formatDateUTC(date)}</h2>
              <button type="button" onClick={() => setCompareOpen(false)} aria-label="Close site comparison"
                className="shrink-0 rounded-md border border-white/15 bg-white/[0.08] px-2 py-0.5 text-xs font-bold text-slate-200">✕</button>
            </div>
            <p className="mt-1 text-xs text-slate-400">Tick sites to compare. Sun/Earth altitudes are computed live, flat horizon, ±0.1° geometry.</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {SITES.map((s) => (
                <button key={s.id} type="button" onClick={() => toggleCompareSite(s.id)}
                  aria-pressed={compareIds.includes(s.id)}
                  className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${compareIds.includes(s.id) ? 'border-sky-300/60 bg-sky-400/80 text-slate-950' : 'border-white/15 bg-white/[0.05] text-slate-300'}`}>
                  {s.name}
                </button>
              ))}
            </div>
            {comparison.length > 0 ? (
              <table className="mt-3 w-full text-left text-[13px] leading-snug">
                <thead>
                  <tr className="text-slate-500"><th className="py-1 pr-2">Site</th><th className="py-1 pr-2">Sun alt / az</th><th className="py-1 pr-2">Earth alt / az</th><th className="py-1 pr-2">POWER</th><th className="py-1">COMM</th></tr>
                </thead>
                <tbody>
                  {comparison.map((p) => (
                    <tr key={p.site.id} className="border-t border-white/10">
                      <td className="py-1 pr-2 font-semibold text-slate-100">{p.site.name}</td>
                      <td className="py-1 pr-2 tabular-nums text-slate-200">{fmtSigned(p.sun.alt)} / {fmt(p.sun.az, 1)}°</td>
                      <td className="py-1 pr-2 tabular-nums text-slate-200">{fmtSigned(p.earth.alt)} / {fmt(p.earth.az, 1)}°</td>
                      <td className="py-1 pr-2 font-bold" style={{ color: p.power.color }}>{p.power.label}</td>
                      <td className="py-1 font-bold" style={{ color: p.comm.color }}>{p.comm.label}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="mt-3 text-sm text-slate-300">No sites selected — tick at least one site above.</p>
            )}
            <p className="mt-3 text-[11px] leading-relaxed text-slate-400">{POWER_RULE} {COMM_RULE}</p>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => setCompareOpen(false)}
                className="rounded-lg border border-white/15 bg-white/[0.05] px-3 py-1.5 text-sm font-semibold text-slate-200">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Window finder modal */}
      {windowsOpen && windows && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-3" role="dialog" aria-modal="true" aria-label="Landing window finder">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/20 bg-slate-900/95 p-4 shadow-2xl backdrop-blur-md">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-base font-bold text-slate-100">Landing windows — {site.name}</h2>
              <button type="button" onClick={() => setWindowsOpen(false)} aria-label="Close landing window finder"
                className="shrink-0 rounded-md border border-white/15 bg-white/[0.08] px-2 py-0.5 text-xs font-bold text-slate-200">✕</button>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              From {formatDateUTC(windows.start)} · hourly sampling, flat horizon. Whole-hour counts.
            </p>
            <div className="mt-2 flex gap-1.5" role="group" aria-label="Window length">
              {[14, 30].map((d) => (
                <button key={d} type="button" onClick={() => setWindowDays(d)} aria-pressed={windowDays === d}
                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${windowDays === d ? 'border-emerald-300/60 bg-emerald-400/80 text-slate-950' : 'border-white/15 bg-white/[0.05] text-slate-200'}`}>
                  {d} days
                </button>
              ))}
            </div>
            <div className="mt-3 space-y-1 rounded-lg border border-white/10 bg-white/[0.05] p-3 text-[13px] leading-snug">
              <p>☀️ Longest continuous SUNLIT stretch: <span className="font-bold">{windows.bestSunRun.hours} h</span>
                {windows.bestSunRun.start ? ` from ${formatDateUTC(windows.bestSunRun.start)}` : ' — none in this window'}</p>
              <p>🌍 Longest continuous Earth-VISIBLE stretch: <span className="font-bold">{windows.bestEarthRun.hours} h</span>
                {windows.bestEarthRun.start ? ` from ${formatDateUTC(windows.bestEarthRun.start)}` : ' — none in this window'}</p>
              <p>Totals over {windows.days} days: <span className="font-bold tabular-nums">{windows.totalSunlitHours} Sun-lit h</span> · <span className="font-bold tabular-nums">{windows.totalEarthHours} Earth-visible h</span> of {windows.days * 24} h.</p>
            </div>
            <h3 className="mt-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Best days — ranked by Sun-lit hours, then Earth-visible hours</h3>
            <table className="mt-1 w-full text-left text-[13px] leading-snug">
              <thead>
                <tr className="text-slate-500"><th className="py-1 pr-2">Day (UTC)</th><th className="py-1 pr-2">Sun-lit h</th><th className="py-1 pr-2">Earth-visible h</th><th className="py-1">Max Sun alt</th></tr>
              </thead>
              <tbody>
                {windows.rankedDays.slice(0, 7).map((row) => (
                  <tr key={row.date.toISOString()} className="border-t border-white/10">
                    <td className="py-1 pr-2 font-semibold text-slate-100">{row.date.toISOString().slice(0, 10)}</td>
                    <td className="py-1 pr-2 tabular-nums text-slate-200">{row.sunlitHours}</td>
                    <td className="py-1 pr-2 tabular-nums text-slate-200">{row.earthHours}</td>
                    <td className="py-1 tabular-nums text-slate-200">{fmtSigned(row.maxSunAlt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-[11px] leading-relaxed text-slate-400">{DISCLAIMER}</p>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => setWindowsOpen(false)}
                className="rounded-lg border border-white/15 bg-white/[0.05] px-3 py-1.5 text-sm font-semibold text-slate-200">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Mission brief modal */}
      {briefOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-3" role="dialog" aria-modal="true" aria-label="Mission brief">
          <div className="brief-print max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/20 bg-slate-900/95 p-4 shadow-2xl backdrop-blur-md">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-base font-bold text-slate-100">Mission brief — all 13 sites, {formatDateUTC(date)}</h2>
              <button type="button" onClick={() => setBriefOpen(false)} aria-label="Close mission brief"
                className="no-print shrink-0 rounded-md border border-white/15 bg-white/[0.08] px-2 py-0.5 text-xs font-bold text-slate-200">✕</button>
            </div>
            <p className="mt-1 text-xs text-slate-400">Ranked best first by Sun altitude (power), then Earth altitude (comms). Flat-horizon geometry, ±0.1°.</p>
            <table className="mt-2 w-full text-left text-[13px] leading-snug">
              <thead>
                <tr className="text-slate-500"><th className="py-1 pr-2">#</th><th className="py-1 pr-2">Site</th><th className="py-1 pr-2">Sun alt</th><th className="py-1 pr-2">Earth alt</th><th className="py-1 pr-2">POWER</th><th className="py-1">COMM</th></tr>
              </thead>
              <tbody>
                {ranked.map((p) => (
                  <tr key={p.site.id} className="border-t border-white/10">
                    <td className="py-1 pr-2 tabular-nums text-slate-300">{p.rank}</td>
                    <td className="py-1 pr-2 font-semibold text-slate-100">{p.site.name}
                      <span className="block text-xs font-normal text-slate-400">{TYPE_LABEL[p.site.type]}</span>
                    </td>
                    <td className="py-1 pr-2 tabular-nums text-slate-200">{fmtSigned(p.sun.alt)}</td>
                    <td className="py-1 pr-2 tabular-nums text-slate-200">{fmtSigned(p.earth.alt)}</td>
                    <td className="py-1 pr-2 font-bold" style={{ color: p.power.color }}>{p.power.label}</td>
                    <td className="py-1 font-bold" style={{ color: p.comm.color }}>{p.comm.label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h3 className="mt-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Published illumination context</h3>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-[12px] text-slate-300">
              {PUBLISHED_ILLUMINATION.map((p) => (
                <li key={p.site}><span className="font-semibold text-slate-100">{p.site}:</span> {p.text} <span className="text-slate-400">({p.source})</span></li>
              ))}
              <li>The Moon’s axial tilt is only 1.54°, so at the poles the Sun never rises more than ~1.54° above the local mean horizon or drops more than ~1.54° below it — the polar Sun-alt range is set by site latitude plus libration.</li>
            </ul>
            <p className="mt-3 text-[11px] leading-relaxed text-slate-400">{DISCLAIMER}</p>
            <div className="no-print mt-3 flex gap-2">
              <button type="button" onClick={() => window.print()} aria-label="Print mission brief"
                className="rounded-lg border border-amber-400/40 bg-amber-400/20 px-3 py-1.5 text-sm font-semibold text-amber-200">🖨 Print brief</button>
              <button type="button" onClick={() => setBriefOpen(false)}
                className="rounded-lg border border-white/15 bg-white/[0.05] px-3 py-1.5 text-sm font-semibold text-slate-200">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Evidence modal */}
      {evidenceOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-3" role="dialog" aria-modal="true" aria-label="Evidence">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/20 bg-slate-900/95 p-4 shadow-2xl backdrop-blur-md">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-base font-bold text-slate-100">Evidence — {site.name} · {formatDateUTC(date)}</h2>
              <button type="button" onClick={() => setEvidenceOpen(false)} aria-label="Close evidence"
                className="shrink-0 rounded-md border border-white/15 bg-white/[0.08] px-2 py-0.5 text-xs font-bold text-slate-200">✕</button>
            </div>
            <p className="mt-1 text-[13px] font-semibold leading-snug">
              Sun {fmtSigned(verdict.sun.alt)} az {fmt(verdict.sun.az, 1)}° → <span style={{ color: verdict.power.color }}>{verdict.power.label}</span>
              {' · '}Earth {fmtSigned(verdict.earth.alt)} az {fmt(verdict.earth.az, 1)}° → <span style={{ color: verdict.comm.color }}>{verdict.comm.label}</span>
              {' · '}Moon illuminated {fmt(verdict.illumination * 100, 1)}%
            </p>
            <h3 className="mt-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Inputs</h3>
            <p className="mt-1 text-[13px] leading-snug text-slate-300">
              Site: {site.name} — {fmt(Math.abs(site.lat), 4)}°S, {fmt(site.lon, 4)}°E ({TYPE_LABEL[site.type]}). {site.note}
              <br />Date/time: {formatDateUTC(date)} (UTC, as entered).
            </p>
            <h3 className="mt-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Method</h3>
            <ol className="mt-1 list-decimal space-y-1 pl-5 text-[13px] leading-snug text-slate-300">
              {METHOD.map((m) => <li key={m.slice(0, 40)}>{m}</li>)}
            </ol>
            <h3 className="mt-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Validation — reference values this build asserts in tests</h3>
            <table className="mt-1 w-full text-left text-[12px] leading-snug">
              <thead>
                <tr className="text-slate-500"><th className="py-1 pr-2">#</th><th className="py-1 pr-2">Test</th><th className="py-1 pr-2">Expected (computed)</th><th className="py-1">Cross-check</th></tr>
              </thead>
              <tbody>
                {REFERENCE_VALUES.map((r) => (
                  <tr key={r.id} className="border-t border-white/10">
                    <td className="py-1 pr-2 font-semibold text-slate-100">{r.id}</td>
                    <td className="py-1 pr-2 text-slate-200">{r.test}</td>
                    <td className="py-1 pr-2 tabular-nums text-slate-200">{r.expected}</td>
                    <td className="py-1 text-slate-300">{r.check}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h3 className="mt-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Drive terrain — real LRO LOLA DEM</h3>
            <p className="mt-1 text-[13px] leading-snug text-slate-300">{TERRAIN_NOTE}</p>
            <h3 className="mt-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Drive rover — real Apollo LRV model</h3>
            <p className="mt-1 text-[13px] leading-snug text-slate-300">{ROVER_NOTE}</p>
            <h3 className="mt-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Sources</h3>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-[12px] text-slate-300">
              {SOURCES.map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noreferrer" className="font-semibold text-sky-300 underline hover:text-sky-200">{s.label}</a>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] leading-relaxed text-slate-400">{DISCLAIMER}</p>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => setEvidenceOpen(false)}
                className="rounded-lg border border-white/15 bg-white/[0.05] px-3 py-1.5 text-sm font-semibold text-slate-200">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
