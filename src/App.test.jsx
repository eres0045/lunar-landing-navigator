/**
 * App tests — Lunar Landing Site Navigator.
 *
 * jsdom has no WebGL, so LunarScene shows its no-WebGL fallback — the
 * panel, verdict line and modals are all App-level and fully testable
 * here. Ephemeris MATH is asserted in src/lib/ephemeris.test.js and
 * src/lib/data.test.js; these tests assert the UI shows those values.
 */
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import App from './App.jsx';

describe('App — lunar navigator (jsdom has no WebGL)', () => {
  it('renders the title chip, the panel and the Malapert Nov 14 verdict line on load', () => {
    render(<App />);
    expect(screen.getByText('🌙 Lunar Landing Site Navigator')).toBeTruthy();
    expect(screen.getByText('🌙 Navigator')).toBeTruthy();
    // Default: Malapert, Nov 14 12:00 UTC — Sun −0.49° LOW SUN, Earth +0.13° VISIBLE.
    expect(screen.getByText(/Malapert Massif · 2026-11-14 12:00 UTC/)).toBeTruthy();
    // LOW SUN / VISIBLE appear twice: the verdict line and the badge.
    expect(screen.getAllByText(/LOW SUN/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/VISIBLE/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/−0\.49°/)).toBeTruthy();
    expect(screen.getByText(/The 3D Moon scene needs WebGL/)).toBeTruthy();
    // The flat-horizon caveat is always visible.
    expect(screen.getByText(/Planning aid only, not for flight decisions\./)).toBeTruthy();
    // The verdict rules are stated plainly.
    expect(screen.getByText(/POWER rule \(flat-horizon geometry\)/)).toBeTruthy();
    expect(screen.getByText(/COMM rule \(flat-horizon geometry\)/)).toBeTruthy();
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
    expect(screen.getByText(/\+5\.53°/)).toBeTruthy();
    expect(screen.getByText(/99\.8%/)).toBeTruthy();
  });

  it('switching to Connecting Ridge shows SUNLIT + BELOW HORIZON and the published 88.1% figure', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Connecting Ridge CR1/ }));
    expect(screen.getByText(/Connecting Ridge CR1 · 2026-11-14 12:00 UTC/)).toBeTruthy();
    expect(screen.getAllByText(/SUNLIT/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/BELOW HORIZON/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/88\.1% illuminated at 2 m/)).toBeTruthy();
    expect(screen.getByText(/92\.5% at 10 m/)).toBeTruthy();
  });

  it('new-Moon chip: Malapert DARK, Moon 0.2% illuminated', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /New Moon · Nov 9 07:02 UTC/ }));
    expect(screen.getAllByText(/DARK/).length).toBeGreaterThanOrEqual(2);
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
    expect(screen.getByText(/LOW SUN/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Expand navigator controls' }));
    expect(screen.getByLabelText('Date and time (UTC)')).toBeTruthy();
  });

  it('panel hides entirely via the ✕ button and comes back via the restore pill', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Hide navigator panel' }));
    expect(screen.queryByLabelText('Date and time (UTC)')).toBeNull();
    expect(screen.queryByText(/LOW SUN/)).toBeNull();
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
    // Malapert row: LOW SUN + VISIBLE; CR1 row: SUNLIT + BELOW HORIZON.
    const rows = within(dialog).getAllByRole('row');
    expect(rows.length).toBeGreaterThanOrEqual(5); // header + 4 sites
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
    // loading (code-built rover driving meanwhile).
    expect(screen.getByTestId('drive-rover-model').textContent)
      .toContain('Rover model: loading real Apollo LRV…');
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
});
