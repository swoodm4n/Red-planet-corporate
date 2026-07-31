# Subdivision Manager Registration

A multi-step, in-character registration wizard for Red Planet Corporate. A
prospective player answers questions about their subdivision and receives a
downloadable/printable "Certificate of Subdivision Registration" — an
in-universe Mars Colonial Authority document.

## Files

- **`RegistrationCertificate.jsx`** — the component itself. A standalone
  React functional component (hooks-based), zero npm dependencies beyond
  `react`. Default export: `RegistrationCertificate`. All styles are inlined
  in a single scoped `<style>` block; every class name is prefixed `rpc-` so
  it won't collide with a host app's CSS.
- **`starter-sheet-demo.html`** — a zero-build-step test/demo harness. Loads
  React, ReactDOM, and Babel Standalone from CDN `<script>` tags and inlines
  a functionally-identical copy of the component in a
  `<script type="text/babel">` block (not loaded via `src=`, since fetching a
  local `.jsx` file over `file://` is blocked by CORS). Just double-click it
  to open in a browser — no local server, no build step, no install.
- **`registration-standalone-offline.html`** — a fully offline-capable
  single file: no React, no CDN, no network requests of any kind. The same
  wizard/certificate logic reimplemented in plain JS/DOM, with the Oswald
  and Courier Prime fonts embedded directly as base64 `@font-face` data URIs.
  This is the one to use anywhere you can't guarantee internet access at
  render time (a phone with no signal, an air-gapped machine, hosting on a
  platform that blocks outbound requests) — save it and open it, nothing
  else has to load. Keep it in sync with the other two if you edit the
  design or fields; it's a separate implementation, not a shared bundle.

## Using it in a real React app

```jsx
import RegistrationCertificate from './RegistrationCertificate';

export default function App() {
  return <RegistrationCertificate />;
}
```

Drop `RegistrationCertificate.jsx` anywhere in your source tree (Vite, CRA,
Next.js — any standard React setup works). It has no props, manages its own
state internally, and needs nothing else wired up. If you already load
Google Fonts via `<link>` tags elsewhere (Oswald / Courier Prime), the
component will pick them up automatically; if not, it falls back cleanly to
system fonts (`'Arial Narrow', sans-serif` / `'Courier New', monospace`).

## Using it standalone (no React project at all)

Just open `starter-sheet-demo.html` directly in a browser (double-click it,
or `file:///path/to/starter-sheet-demo.html`). Everything it needs — React,
ReactDOM, Babel — loads from CDN over HTTPS; nothing needs to be installed
or built locally.

If you'd rather serve it (e.g. to test under `http://` instead of `file://`):

```bash
cd registration
python3 -m http.server 8000
# then open http://localhost:8000/starter-sheet-demo.html
```

**If you edit the component, update both files** — `starter-sheet-demo.html`
intentionally keeps its own inlined copy of the same code for the
zero-build-step use case described above.

## What it does

1. A short wizard (3 field-input steps + a review step) collects: Subdivision
   Name, Manager Name, Parent Corporation, Primary Specialization,
   Preferred Starting Facility, Cooperation Policy, Official Mission
   Statement, Corporate Objectives & Personal Aspirations, and an optional
   Subdivision History / Corporate Culture blurb.
2. On submit, it generates a stable per-subdivision Corporate ID
   (`MCI-XXXXXX`, derived via a deterministic hash of the subdivision name +
   the submission timestamp — computed once and stored, not re-randomized
   on re-render) and an in-universe issue date (`Terran Date 2159.DDD`,
   where `DDD` is the real-world day-of-year at submission time).
3. It renders a full-page "Certificate of Subdivision Registration" with all
   entered data, an inline SVG seal (circular curved text via
   `<textPath>`), and a "DOWNLOAD CERTIFICATE (PRINT / SAVE AS PDF)" button
   that calls `window.print()`. A dedicated `@media print` stylesheet hides
   all wizard/UI chrome and prints only the certificate at
   US-Letter-friendly proportions, so "Save as PDF" from the browser print
   dialog works with no external dependencies.

## Design system notes (for future consistency)

This is a **certificate-class document**, visually distinct from the
archived site's green CRT-terminal aesthetic (`archive/index.html`) — that
look is retired and should not be reused here.

- **Palette:** cream/parchment background (`#F2E8D5` / `#EDE1C8`), navy ink
  (`#1B2A4A`) as the primary accent/text color, muted brass/gold
  (`#B8860B`) for seal and ornamental details.
- **Fonts:** Oswald (headers, geometric/extended sans) + Courier Prime
  (body/form text, typewriter-slab monospace), loaded via Google Fonts
  `<link>` tag, with system-font fallbacks (`'Arial Narrow', sans-serif` /
  `'Courier New', monospace`) so it still renders reasonably offline.
- **Document ID scheme:** `MCA-REG-2159` identifies the registration
  *document/form type* (appears in header/footer chrome on both the wizard
  and the certificate). `MCI-XXXXXX` is the generated *per-subdivision*
  Corporate ID printed on the certificate itself. Keep these two prefixes
  distinct in any future documents.
- **Contrast on purpose:** the wizard itself is deliberately plain/
  high-contrast/grid-based (an "systems register" look — no ornament), while
  the certificate output is ornate (double-frame border, guilloche-style
  frame pattern, engraved seal). Same universe, different document class.
