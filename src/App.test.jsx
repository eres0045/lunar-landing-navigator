/**
 * App tests — Lunar Landing Site Navigator.
 *
 * jsdom has no WebGL, so LunarScene shows its no-WebGL fallback — the
 * panel, verdict line and modals are all App-level and fully testable
 * here. Ephemeris MATH is asserted in src/lib/ephemeris.test.js and
 * src/lib/data.test.js; these tests assert the UI shows those values.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import App, { bootViewFromSearch } from './App.jsx';

describe('App — lunar navigator (jsdom has no WebGL)', () => {
  // These tests were written assuming the orbit overview on load, so
  // they boot with the ?view=orbit override. The default (Drive boot)
  // is covered by the 'App boot' block below.
  beforeEach(() => {
    window.history.pushState({}, '', '/?view=orbit');
  });
  it('renders the title chip, the panel and the Malapert Nov 14 verdict line on load', () => {
    render(<App />);
    expect(screen.getByText('🌙 Lunar Landing Site Navigator')).toBeTruthy();
    expect(screen.getByText('🌙 Navigator')).toBeTruthy();
    // Default: Malapert, Nov 14 12:00 UTC — terrain-aware: Sun −0.49°
    // vs +2.65° local horizon = DARK, Earth +0.13° vs +3.80° = BELOW
    // HORIZON (the flat rule used to say LOW SUN + VISIBLE).
    expect(screen.getByText(/Malapert Massif · 2026-11-14 12:00 UTC/)).toBeTruthy();
    // DARK / BELOW HORIZON appear twice: the verdict line and the badge.
    expect(screen.getAllByText(/DARK/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/BELOW HORIZON/).length).toBeGreaterThanOrEqual(2);
    // −0.49° appears in the Sun line AND in the terrain-aware detail
    // ("Sun −0.49° is more than 2° below the local horizon…").
    expect(screen.getAllByText(/−0\.49°/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/The 3D Moon scene needs WebGL/)).toBeTruthy();
    // The planning-aid disclaimer is always visible.
    expect(screen.getByText(/Planning aid only, not for flight decisions\./)).toBeTruthy();
    // The verdict rules are stated plainly (terrain-aware horizon since Step 3).
    expect(screen.getByText(/POWER rule \(terrain-aware horizon from the real LOLA DEM/)).toBeTruthy();
    expect(screen.getByText(/COMM rule \(terrain-aware horizon from the real LOLA DEM/)).toBeTruthy();
  });

  it('terrain-aware by default: the panel states the local horizon degrees behind each verdict', () => {
    render(<App />);
    // Power detail: Sun −0.49° more than 2° below the +2.65° local horizon.
    expect(screen.getByText(/more than 2° below the local horizon \(\+2\.65° at az \+121°\)/)).toBeTruthy();
    // Comm detail: Earth +0.13° at or below the +3.80° local horizon.
    expect(screen.getByText(/at or below the local horizon \(\+3\.80° at az \+358°\)/)).toBeTruthy();
  });

  it('site picker lists all 14 sites, grouped, with the extras labelled by type', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: /Peak Near Cabeus B/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Slater Plain/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Connecting Ridge CR1/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Shoemaker PSR/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Sverdrup PSR/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Faustini Rim A PSR/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Apollo 15 — Hadley Rille/ })).toBeTruthy();
    expect(screen.getByText(/Apollo landing site/)).toBeTruthy();
    // Apollo 15 is NORTHERN (26.13°N) — the picker must not label it °S.
    expect(screen.getByText(/26\.1320°N/)).toBeTruthy();
    expect(screen.getByText(/Illumination-study spot/)).toBeTruthy();
    // 3 site buttons + the intro line ("labelled PSR centres / study spots").
    expect(screen.getAllByText(/PSR centre/).length).toBe(4);
  });

  it('full-Moon chip: Malapert SUNLIT, Sun ≈ +5.53°, Moon 99.8% illuminated', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Full Moon · Nov 24 14:53 UTC/ }));
    expect(screen.getByText(/Malapert Massif · 2026-11-24 14:53 UTC/)).toBeTruthy();
    expect(screen.getAllByText(/SUNLIT/).length).toBeGreaterThanOrEqual(2);
    // +5.53° appears in the Sun line AND in the terrain-aware detail.
    expect(screen.getAllByText(/\+5\.53°/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/99\.8%/)).toBeTruthy();
  });

  it('switching to Connecting Ridge shows DARK + BELOW HORIZON and the published 88.1% figure', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Connecting Ridge CR1/ }));
    expect(screen.getByText(/Connecting Ridge CR1 · 2026-11-14 12:00 UTC/)).toBeTruthy();
    // Terrain-aware: Sun +1.44° vs +4.97° local horizon = DARK
    // (the flat rule said SUNLIT); Earth stays BELOW HORIZON.
    expect(screen.getAllByText(/DARK/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/BELOW HORIZON/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/88\.1% illuminated at 2 m/)).toBeTruthy();
    expect(screen.getByText(/92\.5% at 10 m/)).toBeTruthy();
  });

  it('new-Moon chip: Malapert SUNLIT against the terrain horizon, Moon 0.2% illuminated', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /New Moon · Nov 9 07:02 UTC/ }));
    // Sun −2.46° sits ABOVE the −4.10° local horizon to the south,
    // so the terrain-aware verdict is SUNLIT (flat said DARK).
    expect(screen.getAllByText(/SUNLIT/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/0\.2%/)).toBeTruthy();
  });

  it('camera presets exist and switch — South Pole, then Wide back', () => {
    render(<App />);
    const pole = screen.getByRole('button', { name: 'Camera view: South Pole' });
    const wide = screen.getByRole('button', { name: 'Camera view: Wide' });
    expect(wide.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(pole);
    expect(pole.getAttribute('aria-pressed')).toBe('true');
    expect(wide.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(wide);
    expect(wide.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Zoom out' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeTruthy();
  });

  it('panel collapses to header + verdict line, and expands again', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Collapse navigator controls' }));
    expect(screen.queryByLabelText('Date and time (UTC)')).toBeNull();
    expect(screen.queryByRole('button', { name: /Slater Plain/ })).toBeNull();
    expect(screen.getByText(/DARK/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Expand navigator controls' }));
    expect(screen.getByLabelText('Date and time (UTC)')).toBeTruthy();
  });

  it('panel hides entirely via the ✕ button and comes back via the restore pill', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Hide navigator panel' }));
    expect(screen.queryByLabelText('Date and time (UTC)')).toBeNull();
    expect(screen.queryByText(/DARK/)).toBeNull();
    expect(screen.getByText('🌙 Lunar Landing Site Navigator')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Show navigator controls' }));
    expect(screen.getByLabelText('Date and time (UTC)')).toBeTruthy();
  });

  it('compare modal opens with the default 4 sites at Nov 14 12:00 UTC', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Open site comparison' }));
    const dialog = await screen.findByRole('dialog', { name: 'Compare sites' });
    expect(within(dialog).getByText(/Compare sites — 2026-11-14 12:00 UTC/)).toBeTruthy();
    // Each compared site appears twice in the dialog: the toggle chip
    // and the table row.
    expect(within(dialog).getAllByText('Malapert Massif').length).toBe(2);
    expect(within(dialog).getAllByText('Connecting Ridge CR1').length).toBe(2);
    expect(within(dialog).getAllByText('Slater Plain').length).toBe(2);
    // Terrain-aware rows at Nov 14: Malapert DARK + BELOW HORIZON,
    // CR1 DARK + BELOW HORIZON, Slater DARK + BELOW HORIZON,
    // de Gerlache Rim 2 DARK + VISIBLE (its Earth horizon dips).
    const rows = within(dialog).getAllByRole('row');
    expect(rows.length).toBeGreaterThanOrEqual(5); // header + 4 sites
    expect(within(dialog).getAllByText('DARK')).toHaveLength(4);
    expect(within(dialog).getAllByText('BELOW HORIZON')).toHaveLength(3);
    expect(within(dialog).getAllByText('VISIBLE')).toHaveLength(1);
    // The compare copy states the real local horizon, not flat.
    expect(within(dialog).getByText(/real local horizon from the LOLA DEM/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close site comparison' }));
    expect(screen.queryByRole('dialog', { name: 'Compare sites' })).toBeNull();
  });

  it('window finder modal shows the longest SUNLIT stretch for Malapert from Nov 14', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Open landing window finder' }));
    const dialog = await screen.findByRole('dialog', { name: 'Landing window finder' });
    expect(within(dialog).getByText(/Landing windows — Malapert Massif/)).toBeTruthy();
    expect(within(dialog).getByText(/Longest continuous SUNLIT stretch:/)).toBeTruthy();
    expect(within(dialog).getByText(/Longest continuous Earth-VISIBLE stretch:/)).toBeTruthy();
    expect(within(dialog).getByText(/Best days — ranked by Sun-lit hours/)).toBeTruthy();
    // Terrain-aware totals for Malapert, 14 days from Nov 14 12:00 UTC
    // (the app's start instant): 148 Sun-lit h · 270 Earth-visible h
    // of 336 h (flat was 308/326; a 00:00 start gives 136/258).
    expect(within(dialog).getByText(/148 Sun-lit h/)).toBeTruthy();
    expect(within(dialog).getByText(/270 Earth-visible h/)).toBeTruthy();
    // The intro line (and the disclaimer below) state the real local
    // horizon — getAllByText because the phrase appears twice.
    expect(within(dialog).getAllByText(/real local horizon from the LOLA DEM/).length).toBeGreaterThanOrEqual(1);
    // 30-day toggle exists.
    expect(within(dialog).getByRole('button', { name: '30 days' })).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close landing window finder' }));
    expect(screen.queryByRole('dialog', { name: 'Landing window finder' })).toBeNull();
  });

  it('mission brief modal ranks all 14 sites for the chosen date', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Open mission brief' }));
    const dialog = await screen.findByRole('dialog', { name: 'Mission brief' });
    expect(within(dialog).getByText(/Mission brief — all 14 sites, 2026-11-14 12:00 UTC/)).toBeTruthy();
    for (const name of ['Malapert Massif', 'Slater Plain', 'Connecting Ridge CR1', 'de Gerlache Rim 2']) {
      expect(within(dialog).getByText(name)).toBeTruthy();
    }
    // Terrain-aware ranking at Nov 14: Nobile Rim 1 is rank 1 (Sun
    // margin +14.27° above its local horizon), Apollo 15 rank 14.
    const rows = within(dialog).getAllByRole('row');
    expect(rows[1].textContent).toMatch(/Nobile Rim 1/);
    expect(rows[1].textContent).toMatch(/SUNLIT/);
    expect(within(dialog).getByText(/Sun margin above the local horizon/)).toBeTruthy();
    expect(within(dialog).getByText(/88\.1% illuminated over 20 years/)).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Print mission brief' })).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close mission brief' }));
    expect(screen.queryByRole('dialog', { name: 'Mission brief' })).toBeNull();
  });

  it('evidence modal shows the method, the R1–R8 reference table and the sources', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Open evidence' }));
    const dialog = await screen.findByRole('dialog', { name: 'Evidence' });
    expect(within(dialog).getByText(/Evidence — Malapert Massif · 2026-11-14 12:00 UTC/)).toBeTruthy();
    expect(within(dialog).getAllByText(/astronomy-engine v2\.1\.19/).length).toBeGreaterThanOrEqual(2);
    expect(within(dialog).getByText(/13-term nutation series/)).toBeTruthy();
    expect(within(dialog).getByText(/Moon illumination, full Moon 2026-11-24 14:53 UTC/)).toBeTruthy();
    expect(within(dialog).getByText(/Connecting Ridge CR1, 2026-11-14 12:00 UTC/)).toBeTruthy();
    expect(within(dialog).getAllByText(/NAIF PCK pck00010\.tpc/).length).toBeGreaterThanOrEqual(2);
    expect(within(dialog).getByText(/Planning aid only, not for flight decisions\./)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close evidence' }));
    expect(screen.queryByRole('dialog', { name: 'Evidence' })).toBeNull();
  });

  it('evidence modal shows the Sun-path chart over the real horizon (Nov 14: Sun never rises)', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Open evidence' }));
    const dialog = await screen.findByRole('dialog', { name: 'Evidence' });
    const chart = within(dialog).getByTestId('horizon-chart');
    expect(chart).toBeTruthy();
    expect(within(dialog).getByText(/real LOLA DEM horizon \(range 9990 m, 2 m eye\)/)).toBeTruthy();
    expect(within(dialog).getByText(/Sun stays below the horizon all day — no rise\/set\./)).toBeTruthy();
    expect(chart.getAttribute('aria-label')).toMatch(/Sun and Earth paths over the real horizon at Malapert Massif on 2026-11-14/);
  });

  it('evidence modal shows the CR1 validation badge (computed 80.2% vs published 88.1%)', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Open evidence' }));
    const dialog = await screen.findByRole('dialog', { name: 'Evidence' });
    const badge = within(dialog).getByTestId('cr1-validation-badge');
    expect(badge.textContent).toMatch(/Computed 80\.2% Sun-up over 18\.6 years/);
    expect(badge.textContent).toMatch(/2026-01-01 → 2044-08-07/);
    expect(badge.textContent).toMatch(/vs published 88\.1% over 20 years/);
    expect(badge.textContent).toMatch(/different windows and methods; a check, not an equality claim/);
    expect(badge.textContent).toMatch(/7\.9-point gap/);
    expect(badge.textContent).toMatch(/652\/721 h/);
  });

  it('evidence chart shows the Nov 22 sunrise crossing at Malapert', async () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Date and time (UTC)'), { target: { value: '2026-11-22T12:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Open evidence' }));
    const dialog = await screen.findByRole('dialog', { name: 'Evidence' });
    expect(within(dialog).getByText(/Evidence — Malapert Massif · 2026-11-22 12:00 UTC/)).toBeTruthy();
    const chart = within(dialog).getByTestId('horizon-chart');
    expect(chart.getAttribute('aria-label')).toMatch(/rise 07:5\d UTC/);
    expect(within(dialog).getByText(/rise 07:5\d UTC \(az \d+°\)/)).toBeTruthy();
  });

  it('Esc closes the Evidence modal', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Open evidence' }));
    await screen.findByRole('dialog', { name: 'Evidence' });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Evidence' })).toBeNull();
  });

  it('Drive mode: entry button opens the HUD with live rover state, exit returns to orbit', () => {
    render(<App />);
    expect(screen.queryByTestId('drive-hud')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Drive on the surface' }));
    const hud = screen.getByTestId('drive-hud');
    expect(hud).toBeTruthy();
    expect(screen.getByTestId('drive-speed').textContent).toContain('0.0 km/h');
    expect(screen.getByTestId('drive-heading').textContent).toContain('0.0°');
    // Malapert default position, 4 decimals.
    expect(screen.getByTestId('drive-lat').textContent).toContain('-85.9900°');
    expect(screen.getByTestId('drive-lon').textContent).toContain('-0.1250°');
    expect(screen.getByTestId('drive-distance').textContent).toContain('0.0 m');
    // Rover-model status line: jsdom has no WebGL, so the scene never
    // reports back and the HUD honestly says the real model is still
    // loading (rover appears when ready — no stand-in is mounted).
    expect(screen.getByTestId('drive-rover-model').textContent)
      .toContain('Rover model: loading real Apollo LRV…');
    // Terrain-aware Drive verdicts at the landing point: Malapert
    // Nov 14 is DARK + BELOW HORIZON, with the local horizon degrees
    // shown and the landing-point approximation stated, not hidden.
    expect(screen.getByTestId('drive-power').textContent).toContain('DARK');
    expect(screen.getByTestId('drive-comm').textContent).toContain('BELOW HORIZON');
    expect(screen.getByTestId('drive-sun-horizon').textContent).toContain('+2.65°');
    expect(screen.getByTestId('drive-earth-horizon').textContent).toContain('+3.80°');
    expect(within(hud).getByText(/measured at the landing point/)).toBeTruthy();
    expect(within(hud).getByText(/approximation of the rover.s own horizon/)).toBeTruthy();
    // The illustrative-effects label is stated in the HUD.
    expect(within(hud).getByText(/Wheel dust and tracks are illustrative, not a regolith simulation\./)).toBeTruthy();
    // Camera toggle + max-speed control + touch buttons exist.
    expect(screen.getByTestId('drive-camera-toggle')).toBeTruthy();
    expect(screen.getByLabelText('Maximum drive speed in kilometres per hour')).toBeTruthy();
    expect(screen.getByTestId('drive-btn-forward')).toBeTruthy();
    expect(screen.getByTestId('drive-btn-brake')).toBeTruthy();
    expect(screen.getByTestId('drive-btn-reverse')).toBeTruthy();
    // The panel and its tools are still reachable in Drive mode.
    expect(screen.getByRole('button', { name: 'Open site comparison' })).toBeTruthy();
    // Exit via the HUD button.
    fireEvent.click(screen.getByRole('button', { name: 'Exit drive mode' }));
    expect(screen.queryByTestId('drive-hud')).toBeNull();
  });

  it('Drive mode: Esc exits back to orbit', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Drive on the surface' }));
    expect(screen.getByTestId('drive-hud')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('drive-hud')).toBeNull();
  });

  it('Drive mode: camera toggle switches chase/driver', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Drive on the surface' }));
    const toggle = screen.getByTestId('drive-camera-toggle');
    expect(toggle.textContent).toContain('Chase cam');
    fireEvent.click(toggle);
    expect(toggle.textContent).toContain('Driver cam');
  });

  it('Drive mode: HUD minimise toggle hides the telemetry, expand brings it back', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Drive on the surface' }));
    expect(screen.getByTestId('drive-speed')).toBeTruthy();
    const toggle = screen.getByTestId('drive-hud-toggle');
    expect(toggle.getAttribute('aria-label')).toBe('Minimise drive panel');
    fireEvent.click(toggle);
    expect(screen.queryByTestId('drive-speed')).toBeNull();
    expect(screen.getByTestId('drive-hud')).toBeTruthy();
    expect(toggle.getAttribute('aria-label')).toBe('Expand drive panel');
    fireEvent.click(toggle);
    expect(screen.getByTestId('drive-speed')).toBeTruthy();
  });

  it('Drive mode: floating touch buttons stay visible when the HUD is minimised', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Drive on the surface' }));
    // Floating controls exist alongside the HUD…
    expect(screen.getByTestId('drive-touch-controls')).toBeTruthy();
    expect(screen.getByTestId('drive-btn-forward')).toBeTruthy();
    expect(screen.getByTestId('drive-btn-left')).toBeTruthy();
    expect(screen.getByTestId('drive-btn-right')).toBeTruthy();
    // …and survive the minimise that hides the telemetry (the phone
    // bug: the old D-pad lived inside the collapsible HUD body).
    fireEvent.click(screen.getByTestId('drive-hud-toggle'));
    expect(screen.queryByTestId('drive-speed')).toBeNull();
    expect(screen.getByTestId('drive-touch-controls')).toBeTruthy();
    expect(screen.getByTestId('drive-btn-forward')).toBeTruthy();
    expect(screen.getByTestId('drive-btn-brake')).toBeTruthy();
    expect(screen.getByTestId('drive-btn-reverse')).toBeTruthy();
    // Holding a button is a press, not a click — pointerdown/up.
    fireEvent.pointerDown(screen.getByTestId('drive-btn-forward'));
    fireEvent.pointerUp(screen.getByTestId('drive-btn-forward'));
  });

  it('Drive mode: reset-view button exists and resets without crashing', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Drive on the surface' }));
    const reset = screen.getByTestId('drive-reset-view');
    expect(reset.textContent).toContain('Reset view');
    fireEvent.click(reset);
    expect(screen.getByTestId('drive-hud')).toBeTruthy();
  });
});

describe('App boot — Drive mode by default (?view=orbit for the overview)', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/');
  });

  it('bootViewFromSearch: orbit only on ?view=orbit, drive otherwise', () => {
    expect(bootViewFromSearch('')).toBe('drive');
    expect(bootViewFromSearch('?view=drive')).toBe('drive');
    expect(bootViewFromSearch('?view=orbit')).toBe('orbit');
    expect(bootViewFromSearch('?view=foo')).toBe('drive');
    expect(bootViewFromSearch('?site=malapert&view=orbit')).toBe('orbit');
  });

  it('default boot (no query) opens Drive mode with live rover state', () => {
    render(<App />);
    const hud = screen.getByTestId('drive-hud');
    expect(hud).toBeTruthy();
    // jsdom viewport is 1024 wide, so the HUD starts expanded here.
    expect(screen.getByTestId('drive-speed').textContent).toContain('0.0 km/h');
    expect(screen.getByTestId('drive-heading').textContent).toContain('0.0°');
    expect(screen.getByTestId('drive-lat').textContent).toContain('-85.9900°');
    expect(screen.getByTestId('drive-lon').textContent).toContain('-0.1250°');
    expect(screen.getByTestId('drive-touch-controls')).toBeTruthy();
    expect(screen.getByTestId('drive-btn-forward')).toBeTruthy();
    // The navigator panel is still there underneath.
    expect(screen.getByText('🌙 Navigator')).toBeTruthy();
  });

  it('?view=orbit boots the orbit overview (no Drive HUD)', () => {
    window.history.pushState({}, '', '/?view=orbit');
    render(<App />);
    expect(screen.queryByTestId('drive-hud')).toBeNull();
    expect(screen.queryByTestId('drive-touch-controls')).toBeNull();
    expect(screen.getByText('🌙 Navigator')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Drive on the surface' })).toBeTruthy();
  });

  it('?view=drive boots Drive mode, same as no query', () => {
    window.history.pushState({}, '', '/?view=drive');
    render(<App />);
    expect(screen.getByTestId('drive-hud')).toBeTruthy();
    expect(screen.getByTestId('drive-touch-controls')).toBeTruthy();
  });

  it('from ?view=orbit, the Drive entry button still enters Drive mode', () => {
    window.history.pushState({}, '', '/?view=orbit');
    render(<App />);
    expect(screen.queryByTestId('drive-hud')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Drive on the surface' }));
    expect(screen.getByTestId('drive-hud')).toBeTruthy();
  });

  it('from a Drive boot, Back to orbit exits and site comparison is one tap away', async () => {
    render(<App />);
    expect(screen.getByTestId('drive-hud')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Exit drive mode' }));
    expect(screen.queryByTestId('drive-hud')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open site comparison' }));
    const dialog = await screen.findByRole('dialog', { name: 'Compare sites' });
    expect(within(dialog).getByText(/Compare sites — 2026-11-14 12:00 UTC/)).toBeTruthy();
  });
});
