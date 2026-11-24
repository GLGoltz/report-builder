// ------------------------------------------------------------------ app shell
// The rail is navigation only: the circles show the step's number, not progress (Gabriel's call, Nov 24 2026).
// The status functions still feed the export's "still empty" list.
function stepBtn(tab, key, title, sub, status, num) {
  return h("button", { class: "step", "aria-current": String(state[tab] === key), onclick: () => { state[tab] = key; state.sel = null; renderAll(); $("work").scrollTop = 0; } },
    h("span", { class: "n", "aria-hidden": "true" }, num || "•"),
    h("span", {}, h("b", {}, title), sub ? h("small", {}, sub) : null));
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
  const dg = state.tab === "diagram", f = $("dframe");
  document.querySelector(".main").classList.toggle("diagram", dg);
  $("rail").hidden = dg; $("work").hidden = dg;
  if (f) f.classList.toggle("offstage", !dg);
  if (dg) { $("panel").hidden = true; renderSaveBar(); fillWho(); reloadDiagram(); return; }
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
  const age = Date.now() - (lastBackup || sessionStart), edited = !!doc.meta.updated && dirtySinceBackup;
  if (backupState === "on") {
    b.replaceChildren(h("span", { class: "bk ok" }, h("i"), lastBackup ? `Automatic backup on, last written ${ago(lastBackup)}` : "Automatic backup on"));
  } else if (backupState === "paused") {
    b.replaceChildren(h("span", { class: "bkwarn" }, "Automatic backup is paused.", h("button", { class: "small", onclick: resumeBackup }, "Resume backups")));
  } else if (edited && (!lastBackup || age > 20 * 60e3)) {
    const msg = lastBackup ? `Last backup ${ago(lastBackup)}. Save a new team file so nothing is lost.` : "Not backed up yet. Save a team file so a lost laptop can't lose your work.";
    b.replaceChildren(h("span", { class: "bkwarn" + (age > 60 * 60e3 ? " red" : "") }, msg, h("button", { class: "small", onclick: backupNow }, "Back up now")));
  } else {
    b.replaceChildren(h("span", { class: "bk ok" }, h("i"), lastBackup ? `Backed up ${ago(lastBackup)}` : "Nothing to back up yet"), lastBackup ? h("button", { class: "small", onclick: backupNow }, "Back up now") : null);
  }
}
setInterval(renderSaveBar, 60e3);
setInterval(() => writeBackup(false), BACKUP_EVERY);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") { save(); writeBackup(false); } });
window.addEventListener("beforeunload", (e) => {
  if (dirtySinceBackup && backupState !== "on" && doc.meta.updated && Date.now() - (lastBackup || 0) > 20 * 60e3) { e.preventDefault(); e.returnValue = ""; }
});

// ---- who's typing
function fillWho() { }
// ---- tabs and menus
for (const b of document.querySelectorAll("[data-tab]")) b.addEventListener("click", () => { state.tab = b.dataset.tab; state.sel = null; renderAll(); $("work").scrollTop = 0; });
const menu = $("filemenu"), mbtn = $("b-file");
mbtn.addEventListener("click", (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; mbtn.setAttribute("aria-expanded", String(!menu.hidden)); });
document.addEventListener("click", () => { menu.hidden = true; mbtn.setAttribute("aria-expanded", "false"); });
$("b-export").addEventListener("click", () => {
  if (state.tab === "diagram") return exportDoc("diagram");
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
// ---- welcome: shown once per browser (and again when WELCOME_V changes), and from the menu
const WELCOME_KEY = "cyberhub-reports-welcome", WELCOME_V = "1";
// The Canvas style guide's callout box: colored left rule, tinted background, colored title.
const callout = (kind, title, ...kids) => h("div", { class: "callout " + kind, role: kind === "danger" ? "note" : null }, h("p", { class: "ct" }, title), ...kids);
function welcomeBody() {
  const sec = (t, ...kids) => h("div", { class: "wsec" }, h("h3", {}, t), ...kids);
  return [
    h("p", { class: "wlead" }, "This is where your team keeps its whole project: the Team Log, your network diagram, and the two reports you write for a client. You fill in the forms; the app lays out every PDF you submit."),
    sec("Why it works this way", h("p", {}, "Security teams don't format reports by hand. Assessors fill in finding cards in a reporting platform, compliance teams answer control by control, and the tool produces the document. You'll work the same way.")),
    sec("What's in each tab", h("ul", {},
      h("li", {}, h("b", {}, "Team Log: "), "your cover, signed team agreement, and a section for every Cyber Hub: sessions, commands, troubleshooting tickets, answers and deliverables. It's your team's record as much as something you hand in."),
      h("li", {}, h("b", {}, "Diagram: "), "the network you've built, updated whenever a page says so, with the addressing plan for your rack beside it. Every Cyber Hub export includes it."),
      h("li", {}, h("b", {}, "VAR: "), "the vulnerability assessment you write about another team's rack in Cyber Hub 12."),
      h("li", {}, h("b", {}, "SSP: "), "your own system security plan, in Cyber Hub 13."))),
    callout("caution", "Saving: read this", h("ul", {},
      h("li", {}, "Your work saves as you type, but only in this browser on this laptop."),
      h("li", {}, h("b", {}, "Back up at the end of every session: "), "Save and export, then Save team file. Put the file in your team's Google Drive folder. That file is your real copy."),
      h("li", {}, "At the start of a session on a different laptop, open the newest team file with Open team file."),
      h("li", {}, "In Chrome or Edge, Set up automatic backup keeps a file up to date for you. A red warning at the top means you haven't backed up."),
      h("li", {}, "One person types each session. Teammates can draft on their own laptops and the typist adds their work with Add from a teammate's file."))),
    callout("danger", "Handle it like real client work", h("p", {}, "Your VAR describes how to break into another team's network. Share it only with that team's members, never with \"anyone with the link\".")),
  ];
}
function showWelcome(first) {
  ask(first ? "Welcome to the Report Builder" : "About the Report Builder", welcomeBody(),
    first ? [["I understand", () => { try { localStorage.setItem(WELCOME_KEY, WELCOME_V); } catch {} }, "primary"]] : [["Close", null, "primary"]]);
  $("modal").querySelector(".card").classList.add("wide");
}
$("b-help").addEventListener("click", () => showWelcome(false));
$("b-helpbar").addEventListener("click", () => showWelcome(false));

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
    for (const id of b.shots || []) { a.shots = a.shots || []; if (!a.shots.includes(id)) { a.shots.push(id); n.images++; } }
    for (const k in b.answers) if (!(a.answers[k] || "").trim() && (b.answers[k] || "").trim()) { a.answers[k] = b.answers[k]; n.answers++; }
    for (const k in b.deliv) { const ad = a.deliv[k] || (a.deliv[k] = { images: [], note: "", link: "" }); for (const id of b.deliv[k].images || []) if (!ad.images.includes(id)) { ad.images.push(id); n.images++; } if (!ad.note && b.deliv[k].note) ad.note = b.deliv[k].note; if (!ad.link && b.deliv[k].link) ad.link = b.deliv[k].link; }
    if (!a.commands.trim() && b.commands) a.commands = b.commands; else if (b.commands && !a.commands.includes(b.commands)) a.commands += "\n\n" + b.commands;
  }
  if (o.diagram && !doc.diagram) { doc.diagram = o.diagram; n.diagram = 1; }
  for (const r of o.ssp.poam) if (!doc.ssp.poam.some((y) => y.source && y.source === r.source && y.weakness === r.weakness)) { doc.ssp.poam.push(r); n.poam++; }
  commit(); renderAll();
  const parts = Object.entries({ findings: "findings", hosts: "hosts", triage: "scanner results", sessions: "sessions", problems: "problems", answers: "answers", images: "screenshots", poam: "POA&M rows", diagram: "diagram" }).filter(([k]) => n[k]).map(([k, t]) => `${n[k]} ${t}`);
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
  dirtySinceBackup = !!doc.meta.updated && doc.meta.updated > lastBackup;
  if (location.hash === "#diagram") state.tab = "diagram";
  // The Diagram tab's page loads once the document is here, and stays loaded (off screen) so exports can draw it.
  document.querySelector(".main").prepend(h("iframe", { id: "dframe", src: "diagram.html", title: "Network diagram", class: "offstage" }));
  renderAll();
  let seen = ""; try { seen = localStorage.getItem(WELCOME_KEY) || ""; } catch {}
  if (seen !== WELCOME_V) showWelcome(true);
})();
