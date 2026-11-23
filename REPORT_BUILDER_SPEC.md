# Report Builder: specification

A web app where each Cyber Hub team keeps its Team Log and writes its Vulnerability Assessment Report (VAR) and
System Security Plan (SSP) by filling in forms. The app lays out every document, so students never format anything.
It replaces the three Google Docs templates.

Live at `https://glgoltz.github.io/report-builder/` once published. Sibling of the Network Diagram app
(`glgoltz.github.io/network-diagram/`), with the same look, build and hosting.

## 1. Why

Industry doesn't hand-format these documents. Assessors fill in finding cards in a reporting platform (PlexTrac,
SysReptor, Dradis) and the platform produces the report. Compliance teams answer control by control in a GRC tool
or in NIST's OSCAL format, and the plan is an export. Change records are structured tickets. The Report Builder
gives students the same way of working on a small scale, and gives the instructor documents that all look the same,
so grading is about content.

## 2. Hard rules

1. **No answers in the app.** As with the diagram app, nothing in the code holds a team's expected addresses,
   settings, findings or control answers. It holds only what the course pages already show: lab titles, think
   questions, deliverable titles, the rack sheet's address patterns, the SSP's control list and requirements.
2. **Nothing leaves the browser.** No server, no accounts, no analytics. Work is saved in the browser and in files
   the team keeps. Imported scan files are read in the browser and never uploaded.
3. **Students do the thinking.** Imports bring raw data in. Every finding, answer and control statement is written,
   checked and placed by the team.
4. **Never lose work silently.** Every save failure is shown, with a way out.

## 3. Hosting and access

- Static GitHub Pages site from the public repo `GLGoltz/report-builder`, branch `main`, root folder. `index.html`
  is built from `src/` by `node build.mjs`; commit both.
- About 150 KB. GitHub's limits (1 GB site, 100 GB a month) are not a concern. Student work never goes to GitHub.
- Students open it from a link on the Canvas pages, on any laptop with a current browser.
- Both apps live on `glgoltz.github.io`, so they share browser storage on the same laptop. The Report Builder reads
  the diagram's saved copy (key `cyberhub-diagram` in `localStorage`) for the company name, logo and addressing
  table. It never writes to it.

## 4. Saving, history and backups

| Layer | What it does | Protects against |
| --- | --- | --- |
| IndexedDB autosave | Saves on every change (debounced 600 ms) to the database `cyberhub-reports` | Closing the tab, a crash |
| Persistent storage | Asks once with `navigator.storage.persist()` | The browser clearing data when the disk is full |
| History | A snapshot at most every 5 minutes of editing, before every import, merge, restore or delete, kept 14 days | Someone deleting or overwriting work |
| Automatic backup file | Chrome and Edge: Set up backup picks a file once; the app rewrites it every 3 minutes while there are changes, and when the page is hidden | Cleared browser data, a lost or reimaged laptop |
| Back up now | Every browser: downloads a dated team file | The same, where automatic backup isn't available |
| Backup age in the save bar | Grey under 20 minutes, amber to 60, red after. Leaving the page with no backup for 20 minutes asks first | Forgetting |

- `localStorage` is left to the diagram app. Its 5 MB is shared by every app on `glgoltz.github.io`.
- Images are shrunk when added: longest side 1600 px, WebP at quality 0.82, JPEG where WebP encoding isn't
  supported. A typical screenshot is 80 to 200 KB.
- A failed write shows a red save bar: "Couldn't save in this browser. Back up now so nothing is lost." with the
  Back up now button.
- The automatic backup's file handle is kept in IndexedDB. After a restart the browser may need one click
  ("Resume backups") before writing again.

## 5. Team files and sharing

The team file is one JSON file, extension `.cyberhub`, holding the whole workspace and every image it uses.

- **Save team file** and **Back up now** download it as `<Company>-reports-YYYY-MM-DD-HHMM.cyberhub`. Teams keep it
  in their shared Google Drive folder.
- **Open team file** replaces this browser's workspace after a snapshot. If this browser holds newer work than the
  file, the app says so and asks which to keep.
- **Add from a teammate's file** merges another copy: VAR hosts, triage items and findings it doesn't already have,
  Team Log sessions, problems and screenshots, and SSP POA&M rows. Nothing already here is overwritten.
- **Who's typing** (a name picked from the roster, remembered per browser) is recorded on Team Log entries and in the
  file as `savedBy`.
- **Send findings to the client** (VAR) downloads a small `.cyberhub-findings` file with the findings and fix order
  only. The client team imports it into its SSP's POA&M in Cyber Hub 13.

## 6. Documents

### 6.1 Team Log

One log for the semester. Sections, in order:

- **Cover:** company name and tagline (from the diagram if present), logo, rack number, semester, diagram share
  link, two team communication methods, roster (name, email).
- **Team agreement:** decisions, missed labs, reply time, and each member's name typed to agree.
- **Rack sheet:** the 17 rows of the current template (device or network, pattern, your rack), plus Checked by
  teammate and Checked by instructor.
- **One section per Cyber Hub, 00 to 15**, generated from `labs.json` (taken from the course pages):
  sessions (date, who did what), commands and settings, problems and fixes (what broke, what you checked, what fixed
  it), each Before you continue question with an answer box, and each deliverable with its instruction and a place
  for its screenshots or photo. Cyber Hub 05 adds the connectivity checkpoint table; Cyber Hub 12 adds the rules of
  engagement. Deliverables that are separate documents (the VAR, the SSP, the private answer key, the briefing
  slides) say where they go instead of taking an upload. The private answer key never goes in the app.
- **Progress:** the rail shows each Cyber Hub as empty, started or complete (every question answered and every
  deliverable has an image).

Exports: one Cyber Hub (what each page asks teams to submit), the cover and rack sheet (Cyber Hub 00), or the whole
log (final submission).

### 6.2 VAR (Cyber Hub 12)

Steps in the rail:

1. **Cover:** assessor company and logo (from the diagram), client company and rack, dates, version, assessment
   team with roles, client contact.
2. **Scope and rules:** in-scope targets (prefilled rows Data subnet, DMZ subnet, firewall WAN with `10.R` patterns
   as placeholders), out of scope, rules of engagement (agreed on, by, window, restrictions).
3. **Method:** host discovery, external scan, vulnerability scan, validation, each with tool, settings and purpose.
4. **Hosts found:** address, role, open ports, seen from (internal, external or both), notes. **Import Nmap
   results** reads `nmap -oX` files and asks which view the scan was. Then a box comparing the two views.
5. **Triage:** **Import Greenbone report** reads the report's XML download. Results are grouped by vulnerability
   test across hosts; informational (Log) results are hidden unless shown. Each group can become a finding, join an
   existing finding or be dismissed with a reason. Nothing reaches the report without a person's decision.
6. **Findings:** one card each, with ID (F-01…), title, affected hosts and port, seen from, CVSS 3.1 calculator
   (base metrics, live score and severity; Greenbone's own score is shown for reference, with an option to start
   from its vector), validation status, what it is, why it matters to this client, evidence with screenshots, how
   it was confirmed, and recommended fix. A finding can't be marked Confirmed until "How we confirmed it" is filled
   in.
7. **Fix priority:** recommendations, each covering one or more findings, with action and effort. Built from the
   findings by severity, then reordered and grouped by the team.
8. **Summary:** counts by severity (automatic, false positives excluded), executive summary text, and the top three
   recommendations (automatic).
9. **Review and export:** the finished report, a list of what's missing, Export PDF and Send findings to the client.

The report follows the template's structure: cover, executive summary, scope and rules, method, hosts, findings
summary table, finding details, recommendations, severity scale appendix. False positives appear in the summary
table and a short "Ruled out" list, not as full findings.

### 6.3 SSP (Cyber Hub 13)

1. **System identification:** name, purpose, location, status, users, internet connection.
2. **System description.**
3. **Network diagram:** an image upload (Export PNG in the diagram app), with a reminder of what it must show.
4. **Inventory:** device, model, role, address, OS or firmware. **Start from my diagram** adds a row for every
   device with an address in the diagram. The addressing table from the diagram is included below as read-only
   rows, refreshed with **Update from diagram**.
5. **Ports, protocols and services:** host, port and protocol, service, who can reach it, why it's needed.
6. **Security controls:** the twelve NIST SP 800-53 controls in the template, each with its requirement, a "How we
   meet it" box with the template's guidance as its prompt, and a status (Implemented, Partial, Planned, Accepted
   risk).
7. **Accepted risks:** risk, why it remains, what limits it, accepted by, date. Starts with the shared class
   password row.
8. **POA&M:** ID, weakness, source, severity, planned fix, owner, target date, status, how the fix was verified.
   **Import the VAR findings** reads the assessors' `.cyberhub-findings` file and adds one row per finding.
9. **Assessment history:** the three template rows.
10. **Approval:** system owner, date, and a typed signature.

## 7. Exports

- Export PDF opens the document in a print layout and calls the browser's print dialog, where students choose
  Save as PDF. US Letter, 0.75 in margins, page numbers in the footer, cover on its own page, a running header with
  the document and company names.
- Each export starts with a check list of empty required parts. It doesn't block the export.

## 8. Look

Same family as the diagram app: navy `#003366`, slate neutrals, system fonts, white panels on `#f8fafc`. Severity
colors: Critical `#7f1d1d`, High `#b91c1c`, Medium `#b45309`, Low `#1d4ed8`. Light theme only, like the diagram app.
Works at phone width, though students will mostly use laptops.

## 9. Course page changes

Made in course release 0.11.0 (November 23, 2026):

- Cyber Hub 00 Part 4: open the Report Builder instead of copying the Team Log template; fill in the cover; Set up
  backup; save the team file to the team's Drive folder.
- Each page's submit line: "Export this Cyber Hub from the Report Builder as a PDF."
- Cyber Hub 12 Part 6 and Cyber Hub 13 Part 5: write the VAR and SSP in the Report Builder.
- Instructor Guide: the Templates table points to the app; how to open a team's file to check evidence.

## 10. Open questions

- Which browsers students use is unknown, so the app assumes a mix: Chrome and Edge get automatic backups, every
  browser gets Back up now. Every student has Google Workspace and plenty of Drive space, so team files live there.
- Whether to allow starting a finding's CVSS from Greenbone's vector, or require students to score from scratch.
