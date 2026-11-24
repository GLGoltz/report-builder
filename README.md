# Report Builder

The Cyber Hub teams' Team Log, network diagram, Vulnerability Assessment Report (VAR) and System Security Plan (SSP),
written as forms. The app lays out every PDF, so students never format a document.
Live at https://glgoltz.github.io/report-builder/

- **Build:** `node build.mjs` writes `index.html` and `diagram.html` (the Diagram tab, from `src/diagram/`). Commit them.
- **Course data:** `labs.json` holds each Cyber Hub's think questions and deliverables. Regenerate it from the course
  pages with `python3 ../report-builder/tools/labs.py`, run from the cyber-hub repo.
- **Saving:** IndexedDB in the browser, a version history, an optional automatic backup file (Chrome and Edge), and
  team files (`.cyberhub`) the team keeps in Google Drive. Nothing is sent to a server, and there are no accounts.
- **Hard rule:** the app ships no answers or expected values. See `REPORT_BUILDER_SPEC.md`, section 2.
- **Tests:** `test/run.js` (Playwright) drives the app with the sample Nmap and Greenbone files in `test/`. Serve the
  folder first: `python3 -m http.server 8765`, then `node test/run.js` from `test/`.
