// ------------------------------------------------------------------ app shell
function stepBtn(tab, key, title, sub, status, num) {
  return h("button", { class: "step " + (status || ""), "aria-current": String(state[tab] === key), onclick: () => { state[tab] = key; state.sel = null; renderAll(); $("work").scrollTop = 0; } },
    h("span", { class: "n", "aria-hidden": "true" }, status === "done" ? "✓" : num || "•"),
    h("span", {}, h("b", {}, title), sub ? h("small", {}, sub) : null, status ? h("span", { class: "sr" }, status === "done" ? " (complete)" : " (started)") : null));
}
function renderRail() {
  const r = $("rail"), y = r.scrollTop;
  r.replaceChildren(...(state.tab === "log" ? railLog() : state.tab === "var" ? railVar() : railSsp()).flat());
  r.scrollTop = y;
}
function renderWork() {
  const w = $("work");
  const parts = state.tab === "log" ? viewLog() : state.tab === "var" ? viewVar() : viewSsp();
  w.replaceChildren(...[].concat(parts).flat(Infinity).filter(Boolean));
  if (state.tab === "log") w.append(h("div", { class: "tools", style: "margin-top:24px" }, h("button", { onclick: () => exportDoc("log") }, "Export the whole Team Log as PDF")));
}
function renderPanel() {
  const p = $("panel");
  let content = null;
  if (state.tab === "var" && state.var === "findings" && state.sel) { const f = V().findings.find((x) => x.id === state.sel); if (f) content = findingPanel(f); }
  if (state.tab === "var" && state.var === "triage" && state.sel) { const t = V().triage.find((x) => x.id === state.sel); if (t) content = triagePanel(t); }
  if (!content) { p.hidden = true; return; }
  const y = p.scrollTop; p.hidden = false; p.replaceChildren(...[].concat(content).flat(Infinity).filter(Boolean)); p.scrollTop = y;
}
function renderAll() {
  for (const b of document.querySelectorAll("[data-tab]")) b.setAttribute("aria-selected", String(b.dataset.tab === state.tab));
  $("brand-co").textContent = doc.meta.company || "Cyber Hub";
  const wy = $("work").scrollTop;
  renderRail(); renderWork(); renderPanel(); renderSaveBar(); fillWho();
  $("work").scrollTop = wy;
}

// ---- save bar
function renderSaveBar() {
  const bar = $("savebar"), s = $("saved"), b = $("backup");
  bar.classList.toggle("bad", saveFailed);
  if (!db) s.textContent = "This browser can't save here. Use Save team file to keep your work.";
  else if (saveFailed) s.textContent = "Couldn't save in this browser. Back up now so nothing is lost.";
  else s.textContent = doc.meta.updated ? `Saved in this browser ${fmtTime(doc.meta.updated).replace(/^.*?, /, "at ")}` : "Saves in this browser as you type.";
  const age = Date.now() - (lastBackup || sessionStart), cls = backupState === "on" && !dirtySinceBackup ? "ok" : age < 20 * 60e3 || !doc.meta.updated ? "" : age < 60 * 60e3 ? "amber" : "red";
  const label = backupState === "on" ? (lastBackup ? `Automatic backup on, last written ${ago(lastBackup)}` : "Automatic backup on")
    : backupState === "paused" ? "Automatic backup paused" : lastBackup ? `Backed up ${ago(lastBackup)}` : "Not backed up yet";
  b.replaceChildren(h("span", { class: "bk " + cls }, h("i"), label),
    backupState === "paused" ? h("button", { onclick: resumeBackup }, "Resume backups") : null,
    backupState !== "on" ? h("button", { onclick: backupNow }, "Back up now") : null);
}
setInterval(renderSaveBar, 60e3);
setInterval(() => writeBackup(false), BACKUP_EVERY);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") { save(); writeBackup(false); } });
window.addEventListener("beforeunload", (e) => {
  if (dirtySinceBackup && backupState !== "on" && doc.meta.updated && Date.now() - (lastBackup || 0) > 20 * 60e3) { e.preventDefault(); e.returnValue = ""; }
});

// ---- who's typing
function fillWho() {
  const sel = $("who"), names = doc.log.cover.roster.map((r) => r.name.trim()).filter(Boolean), cur = me();
  const opts = [["", names.length ? "Pick your name" : "Add your roster first"], ...names.map((n) => [n, n])];
  if (cur && !names.includes(cur)) opts.push([cur, cur]);
  sel.replaceChildren(...opts.map(([v, t]) => h("option", { value: v }, t))); sel.value = cur;
}
$("who").addEventListener("change", (e) => { setMe(e.target.value); doc.meta.savedBy = e.target.value; commit(); });

// ---- tabs and menus
for (const b of document.querySelectorAll("[data-tab]")) b.addEventListener("click", () => { state.tab = b.dataset.tab; state.sel = null; renderAll(); $("work").scrollTop = 0; });
const menu = $("filemenu"), mbtn = $("b-file");
mbtn.addEventListener("click", (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; mbtn.setAttribute("aria-expanded", String(!menu.hidden)); });
document.addEventListener("click", () => { menu.hidden = true; mbtn.setAttribute("aria-expanded", "false"); });
$("b-export").addEventListener("click", () => {
  if (state.tab === "var") return exportDoc("var");
  if (state.tab === "ssp") return exportDoc("ssp");
  const l = LABS.find((x) => x.num === state.log);
  ask("Export the Team Log", [h("p", {}, "Each Cyber Hub page asks for that Cyber Hub's section. The final submission takes the whole log.")],
    [["Cancel"], ["Whole log", () => exportDoc("log")], l ? [`Cyber Hub ${l.num}`, () => exportDoc("log-hub", l.num), "primary"] : ["Cyber Hub 00", () => exportDoc("log-hub", "00"), "primary"]]);
});
$("b-save").addEventListener("click", backupNow);
$("b-open").addEventListener("click", async () => {
  const f = await pickFile(".cyberhub,application/json"); if (!f) return;
  let x; try { x = parseTeamFile(await f.text()); } catch (e) { return toast(e.message, true); }
  const newer = doc.meta.updated > x.savedAt + 60e3 && imageRefs(doc).size + JSON.stringify(doc.log).length > 2000;
  ask("Open this team file?", [h("p", {}, `${f.name}, saved ${x.savedAt ? fmtTime(x.savedAt) : "at an unknown time"}${x.savedBy ? " by " + x.savedBy : ""}.`),
    newer ? h("p", { class: "note warn" }, `This browser has work from ${fmtTime(doc.meta.updated)}, newer than the file. Opening the file replaces it. A copy stays in History.`) : h("p", {}, "It replaces what's in this browser. A copy of the current work stays in History.")],
    [["Cancel"], ["Add it to mine instead", () => mergeFile(x)], ["Open it", () => loadTeamFile(x).then(() => toast("Team file opened.")), "primary"]]);
});
$("b-merge").addEventListener("click", async () => {
  const f = await pickFile(".cyberhub,application/json"); if (!f) return;
  try { mergeFile(parseTeamFile(await f.text())); } catch (e) { toast(e.message, true); }
});
$("b-history").addEventListener("click", showHistory);
$("b-setup").addEventListener("click", () => {
  const framed = (() => { try { return window.self !== window.top; } catch { return true; } })();
  if (framed) return ask("Open the app on its own page", [h("p", {}, "Automatic backup can't run inside another page, such as a preview. Open the Report Builder at its own address, then set it up there:"), h("p", {}, h("code", {}, "https://glgoltz.github.io/report-builder/"))], [["OK", null, "primary"]]);
  if (!canAutoBackup()) return ask("Automatic backup isn't available here", [h("p", {}, "This browser can't write a backup file by itself. Chrome and Edge on a Windows, Mac or Chromebook laptop can; phones, tablets, Firefox, Safari and Brave can't."), h("p", {}, "Use Back up now in the save bar at the end of each session, and upload the file to your team's Google Drive folder.")], [["OK", null, "primary"]]);
  ask("Set up automatic backup", [h("p", {}, "Pick where the backup file goes. The app rewrites that one file every few minutes while you work, and when you leave the page."),
    h("p", {}, "If this laptop has Google Drive for desktop, pick your team's Drive folder and the backup reaches Drive by itself. Otherwise pick Documents, and upload the file to Drive at the end of the session.")],
    [["Cancel"], ["Choose the file", setupBackup, "primary"]]);
});
$("b-help").addEventListener("click", () => ask("How saving works", [
  h("p", {}, h("b", {}, "In this browser: "), "everything saves as you type, on this laptop only."),
  h("p", {}, h("b", {}, "History: "), "a copy every few minutes, kept for two weeks. Use it to undo a big mistake."),
  h("p", {}, h("b", {}, "The team file: "), "Save team file downloads everything, screenshots included, as one file. Keep it in your team's Google Drive folder. Whoever types next time opens it with Open team file."),
  h("p", {}, h("b", {}, "Working in parallel: "), "each person can draft on their own laptop. The scribe then uses Add from a teammate's file to bring in their findings, sessions and screenshots."),
  h("p", {}, h("b", {}, "Automatic backup: "), "in Chrome or Edge, Set up automatic backup keeps a file up to date for you.")], [["OK", null, "primary"]]));

// ---- history
async function showHistory() {
  let list = []; try { list = (await historyList()).sort((a, b) => b.at - a.at); } catch {}
  if (!list.length) return ask("History", [h("p", {}, "No saved versions yet. The app keeps one every few minutes while you work.")], [["OK", null, "primary"]]);
  ask("History", [h("p", {}, "Restoring replaces the current work. The current work is saved in History first, so you can come back."),
    h("ul", { class: "hist" }, list.slice(0, 120).map((x) => h("li", {}, h("span", {}, h("b", {}, fmtTime(x.at)), " · ", x.label, x.by ? " · " + x.by : ""),
      h("button", { class: "small", onclick: async () => { closeModal(); await snapshot("Before restoring"); try { doc = normalize(JSON.parse(x.json)); commit(); await save(); renderAll(); toast("Restored the version from " + fmtTime(x.at) + "."); } catch { toast("That version couldn't be restored.", true); } } }, "Restore"))))],
  [["Close"]]);
}

// ---- merge a teammate's file: add what's missing, overwrite nothing
async function mergeFile(x) {
  await snapshot("Before adding a teammate's file");
  const o = x.doc; let n = { hosts: 0, triage: 0, findings: 0, sessions: 0, problems: 0, images: 0, poam: 0, answers: 0 };
  for (const id in x.images) if (!images[id]) { images[id] = x.images[id]; try { await imgPut(id, x.images[id]); } catch {} }
  const V2 = doc.var;
  for (const hst of o.var.hosts) if (!V2.hosts.some((y) => y.ip === hst.ip)) { V2.hosts.push(hst); n.hosts++; }
  for (const t of o.var.triage) if (!V2.triage.some((y) => y.id === t.id || (y.oid === t.oid && y.port === t.port))) { V2.triage.push(t); n.triage++; }
  for (const f of o.var.findings) if (!V2.findings.some((y) => y.id === f.id)) { V2.findings.push(f); n.findings++; }
  for (const num in o.log.hubs) {
    const a = hubData(num), b = o.log.hubs[num];
    for (const s of b.sessions) if (!a.sessions.some((y) => y.date === s.date && y.who === s.who)) { a.sessions.push(s); n.sessions++; }
    for (const p of b.problems) if (!a.problems.some((y) => y.broke === p.broke && y.fixed === p.fixed)) { a.problems.push(p); n.problems++; }
    for (const k in b.answers) if (!(a.answers[k] || "").trim() && (b.answers[k] || "").trim()) { a.answers[k] = b.answers[k]; n.answers++; }
    for (const k in b.deliv) { const ad = a.deliv[k] || (a.deliv[k] = { images: [], note: "", link: "" }); for (const id of b.deliv[k].images || []) if (!ad.images.includes(id)) { ad.images.push(id); n.images++; } if (!ad.note && b.deliv[k].note) ad.note = b.deliv[k].note; if (!ad.link && b.deliv[k].link) ad.link = b.deliv[k].link; }
    if (!a.commands.trim() && b.commands) a.commands = b.commands; else if (b.commands && !a.commands.includes(b.commands)) a.commands += "\n\n" + b.commands;
  }
  for (const r of o.ssp.poam) if (!doc.ssp.poam.some((y) => y.source && y.source === r.source && y.weakness === r.weakness)) { doc.ssp.poam.push(r); n.poam++; }
  commit(); renderAll();
  const parts = Object.entries({ findings: "findings", hosts: "hosts", triage: "scanner results", sessions: "sessions", problems: "problems", answers: "answers", images: "screenshots", poam: "POA&M rows" }).filter(([k]) => n[k]).map(([k, t]) => `${n[k]} ${t}`);
  toast(parts.length ? "Added " + parts.join(", ") + "." : "Nothing new in that file.");
}

// ---- start
const sessionStart = Date.now();
(async function init() {
  try { db = await openDB(); } catch { db = null; }
  if (db) {
    try { const s = await kvGet("doc"); if (s) doc = normalize(JSON.parse(s)); } catch {}
    try { images = await imgAll(); } catch {}
    try { lastBackup = (await kvGet("lastBackup")) || 0; } catch {}
    await restoreBackupHandle();
    try { if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist(); } catch {}
  }
  if (!doc.meta.company) { const dg = readDiagram(); if (dg?.meta?.company) { doc.meta.company = dg.meta.company; if (dg.meta.logo) doc.meta.logo = dg.meta.logo; } }
  dirtySinceBackup = !!doc.meta.updated && doc.meta.updated > lastBackup;
  renderAll();
})();
