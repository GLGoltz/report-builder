# Report Builder

The Cyber Hub teams' Team Log, network diagram, Vulnerability Assessment Report (VAR) and System Security Plan (SSP),
written as forms. The app lays out every PDF, so students never format a document.
Live at https://glgoltz.github.io/report-builder/

- **Build:** `node build.mjs` writes `index.html` and `diagram.html` (the Diagram tab, from `src/diagram/`). Commit them.
- **Course data:** `labs.json` holds each Cyber Hub's think questions and deliverables. Regenerate it from the course
  pages with `python3 ../report-builder/tools/labs.py`, run from the cyber-hub repo.
- **Saving:** IndexedDB in the browser, a version history, an optional automatic backup file (Chrome and Edge), and
  team files (`.cyberhub`) the team keeps in Google Drive. Nothing is sent to a server, and there are no accounts.
- **Hard rule:** the app ships no answers. The only expected values are the addressing plan's patterns students already
  have on the Rack Schema page. See `REPORT_BUILDER_SPEC.md`, section 2.
- **Cyber Hub 15 sign-off:** `src/signoff.js`. The instructor password is never in the repo; `node tools/signoff-hash.mjs "new password"` makes a new hash.
- **Tests:** `test/run.js` (Playwright) drives the app with the sample Nmap and Greenbone files in `test/`. Serve the
  folder first: `python3 -m http.server 8765`, then `node test/run.js` from `test/`.
- **Visual sweep:** `test/audit-ui.js` (every view at three widths: sideways scroll, clipped text, cut-off
  placeholders, overlapping text), `test/audit-diagram.js` (labels inside their boxes, no covered ×),
  `test/audit-print.js <folder>` (PDF exports) and `test/audit-pages.js <files>` (course pages and guides). Run them
  after layout changes.
- **Accessibility:** `test/audit-a11y.js` (every Report Builder view and the diagram) and `test/audit-a11y-pages.js <files>`
  run axe-core's WCAG 2.1 AA rules. Install axe-core anywhere and pass its path: `AXE=.../axe.min.js node test/audit-a11y.js`.
