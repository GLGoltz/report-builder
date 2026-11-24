// ------------------------------------------------------------------ core: document, storage, files, UI helpers
const SCHEMA = 1;
const DB_NAME = "cyberhub-reports";
const ME_KEY = "cyberhub-reports-me";        // who's typing, per browser
const HISTORY_DAYS = 14, HISTORY_EVERY = 5 * 60e3, BACKUP_EVERY = 3 * 60e3;

const $ = (id) => document.getElementById(id);
let uid = 0;
const newId = (p) => p + Date.now().toString(36) + (uid++).toString(36);
const today = () => new Date().toISOString().slice(0, 10);

function blankDoc() {
  return {
    v: SCHEMA,
    meta: { company: "", tagline: "", logo: "", updated: 0, savedBy: "" },
    diagram: null,      // the Diagram tab's document (src/diagram), saved here so it travels in the team file
    log: {
      cover: { rack: "", semester: "", diagramLink: "", chat: "", roster: [{ name: "", email: "" }, { name: "", email: "" }, { name: "", email: "" }, { name: "", email: "" }] },
      agreement: { missed: "", signatures: {} },   // signatures: roster name -> { sig, date }
      rack: { values: {}, checkedTeammate: "", checkedInstructor: "" },
      hubs: {},
    },
    var: {
      cover: { client: "", clientRack: "", dates: "", version: "1.0", team: "", contact: "" },
      scope: [
        { target: "Data subnet", range: "", notes: "Internal scan from a Data port" },
        { target: "DMZ subnet", range: "", notes: "Scanned by your hosted appliance" },
        { target: "Firewall WAN address", range: "", notes: "External scan from CyberHub-Internet" },
      ],
      outScope: "", roe: { agreedOn: "", agreedBy: "", window: "", restrictions: "" },
      method: [
        { step: "Host discovery", tool: "", purpose: "Find live hosts in scope" },
        { step: "External scan", tool: "", purpose: "See what anyone on the internet can reach" },
        { step: "Vulnerability scan", tool: "", purpose: "Find known weaknesses on each host" },
        { step: "Validation", tool: "", purpose: "Confirm the most serious findings by hand" },
      ],
      hosts: [], compare: "", triage: [], findings: [], recs: [], summary: "",
    },
    ssp: {
      ident: { name: "", purpose: "", location: "", status: "Operational", users: "", internet: "" },
      description: "", diagram: "", inventory: [], addressing: [], addressingFrom: "",
      ports: [], controls: {},
      risks: [{ id: newId("r"), risk: "Shared class password", why: "The lab needs one password for every device", limits: "The racks reach only the lab network, never the internet", by: "", date: "" }],
      poam: [],
      history: [
        { id: newId("a"), date: "", activity: "Baseline scan of the DMZ", by: "", result: "" },
        { id: newId("a"), date: "", activity: "Outside vulnerability assessment", by: "", result: "" },
        { id: newId("a"), date: "", activity: "Re-scan after fixes", by: "", result: "" },
      ],
      approval: { owner: "", date: "", signature: "" },
    },
  };
}

function hubData(num) {
  const H = doc.log.hubs;
  if (!H[num]) H[num] = { sessions: [], commands: "", problems: [], answers: {}, deliv: {}, extra: {} };
  return H[num];
}

// Bring a loaded document up to the current shape, keeping everything the team entered.
function normalize(x) {
  if (!x || typeof x !== "object" || !x.log || !x.var || !x.ssp) throw new Error("This isn't a Report Builder file.");
  const b = blankDoc();
  const fill = (t, s) => { for (const k in s) { if (!(k in t)) t[k] = s[k]; else if (s[k] && typeof s[k] === "object" && !Array.isArray(s[k]) && t[k] && typeof t[k] === "object") fill(t[k], s[k]); } return t; };
  return fill(x, b);
}

let doc = blankDoc();
let images = {};          // id -> data URL, the images this workspace uses
const state = { tab: "log", log: "cover", var: "cover", ssp: "ident", sel: null };

// ---------------------------------------------------------------- IndexedDB
let db = null;
function openDB() {
  return new Promise((res, rej) => {
    if (!("indexedDB" in window)) return rej(new Error("no indexedDB"));
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => { const d = r.result; for (const s of ["kv", "images", "history"]) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
function idb(store, mode, fn) {
  return new Promise((res, rej) => {
    if (!db) return rej(new Error("no database"));
    const tx = db.transaction(store, mode), st = tx.objectStore(store);
    let out; const r = fn(st); if (r) r.onsuccess = () => { out = r.result; };
    tx.oncomplete = () => res(out); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error);
  });
}
const kvGet = (k) => idb("kv", "readonly", (s) => s.get(k));
const kvSet = (k, v) => idb("kv", "readwrite", (s) => s.put(v, k));
const imgPut = (id, v) => idb("images", "readwrite", (s) => s.put(v, id));
const imgAll = () => new Promise((res, rej) => {
  const out = {}; const tx = db.transaction("images", "readonly"); const c = tx.objectStore("images").openCursor();
  c.onsuccess = () => { const cur = c.result; if (cur) { out[cur.key] = cur.value; cur.continue(); } };
  tx.oncomplete = () => res(out); tx.onerror = () => rej(tx.error);
});

// ---------------------------------------------------------------- saving
let saveTimer = null, saveFailed = false, dirtySinceBackup = false, lastSnap = 0;
function commit() {
  doc.meta.updated = Date.now();
  dirtySinceBackup = true;
  clearTimeout(saveTimer); saveTimer = setTimeout(save, 600);
  renderSaveBar();
}
async function save() {
  try {
    await kvSet("doc", JSON.stringify(doc));
    saveFailed = false;
    if (Date.now() - lastSnap > HISTORY_EVERY) await snapshot("Editing");
  } catch (e) { saveFailed = true; }
  renderSaveBar();
}
async function snapshot(label) {
  if (!db) return;
  lastSnap = Date.now();
  try {
    await idb("history", "readwrite", (s) => s.put({ at: lastSnap, label, by: me(), json: JSON.stringify(doc) }, lastSnap));
    const cutoff = Date.now() - HISTORY_DAYS * 864e5;
    await idb("history", "readwrite", (s) => s.delete(IDBKeyRange.upperBound(cutoff)));
  } catch {}
}
const historyList = () => idb("history", "readonly", (s) => s.getAll());

function imageRefs(d) {
  const ids = new Set(); const walk = (o) => { if (!o) return; if (Array.isArray(o)) o.forEach(walk); else if (typeof o === "object") for (const k in o) walk(o[k]); else if (typeof o === "string" && /^img[0-9a-z]{8,}$/.test(o)) ids.add(o); };
  walk(d); return ids;
}

// ---------------------------------------------------------------- images
const IMG_MAX = 1600;
function readImage(file) {
  return new Promise((res, rej) => {
    if (!file || !/^image\//.test(file.type)) return rej(new Error("That isn't an image."));
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => {
      const k = Math.min(1, IMG_MAX / Math.max(im.width, im.height));
      const c = document.createElement("canvas"); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
      const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      let d = c.toDataURL("image/webp", 0.82);
      if (!d.startsWith("data:image/webp")) d = c.toDataURL("image/jpeg", 0.85);
      res(d);
    };
    im.onerror = () => { URL.revokeObjectURL(url); rej(new Error("That image couldn't be read.")); };
    im.src = url;
  });
}
async function addImage(file) {
  const data = await readImage(file);
  const id = newId("img");
  images[id] = data;
  try { await imgPut(id, data); } catch { saveFailed = true; renderSaveBar(); }
  return id;
}

// ---------------------------------------------------------------- team files
const FILE_FORMAT = "cyberhub-reports";
function fileBase() {
  const co = (doc.meta.company || "team").replace(/[^\w-]+/g, "-").replace(/^-|-$/g, "") || "team";
  const d = new Date(), p = (n) => String(n).padStart(2, "0");
  return `${co}-reports-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}
function teamFileJSON() {
  const used = imageRefs(doc), imgs = {};
  for (const id of used) if (images[id]) imgs[id] = images[id];
  return JSON.stringify({ format: FILE_FORMAT, v: SCHEMA, savedAt: Date.now(), savedBy: me(), doc, images: imgs });
}
function download(name, text, type = "application/json") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
async function backupNow() {
  download(fileBase() + ".cyberhub", teamFileJSON());
  await markBackedUp("download");
  toast("Team file downloaded. Put it in your team's Drive folder.");
}
function parseTeamFile(text) {
  let x; try { x = JSON.parse(text); } catch { throw new Error("That file isn't a Report Builder team file."); }
  if (x.format !== FILE_FORMAT) throw new Error(x.format === "cyberhub-findings" ? "That's a findings file. Import it from the SSP's POA&M step." : "That file isn't a Report Builder team file.");
  return { doc: normalize(x.doc), images: x.images || {}, savedAt: x.savedAt || 0, savedBy: x.savedBy || "" };
}
async function loadTeamFile(f) {
  await snapshot("Before opening a team file");
  doc = f.doc; images = { ...images, ...f.images };
  for (const id in f.images) try { await imgPut(id, f.images[id]); } catch {}
  commit(); await save(); renderAll();
}

// ---------------------------------------------------------------- automatic backup (File System Access)
let backupHandle = null, backupState = "none", lastBackup = 0;
const canAutoBackup = () => "showSaveFilePicker" in window;
async function setupBackup() {
  try {
    backupHandle = await window.showSaveFilePicker({ suggestedName: fileBase().replace(/-\d{4}-\d\d-\d\d-\d{4}$/, "") + "-backup.cyberhub",
      types: [{ description: "Report Builder team file", accept: { "application/json": [".cyberhub"] } }] });
    await kvSet("backupHandle", backupHandle).catch(() => {});
    backupState = "on"; await writeBackup(true);
    toast("Automatic backup is on. The app keeps that file up to date.");
  } catch (e) { if (e.name !== "AbortError") toast(e.name === "SecurityError" ? "Backup can't be set up inside another page. Open glgoltz.github.io/report-builder on its own." : "Backup couldn't be set up: " + e.message, true); }
  renderSaveBar();
}
async function resumeBackup() {
  if (!backupHandle) return setupBackup();
  try { if ((await backupHandle.requestPermission({ mode: "readwrite" })) === "granted") { backupState = "on"; await writeBackup(true); } }
  catch { backupState = "none"; }
  renderSaveBar();
}
async function writeBackup(force) {
  if (backupState !== "on" || !backupHandle || (!force && !dirtySinceBackup)) return;
  try {
    const w = await backupHandle.createWritable(); await w.write(teamFileJSON()); await w.close();
    await markBackedUp("auto");
  } catch (e) { backupState = "paused"; renderSaveBar(); }
}
async function markBackedUp() { lastBackup = Date.now(); dirtySinceBackup = false; try { await kvSet("lastBackup", lastBackup); } catch {} renderSaveBar(); }
async function restoreBackupHandle() {
  if (!canAutoBackup()) return;
  try {
    backupHandle = await kvGet("backupHandle");
    if (!backupHandle) return;
    const p = await backupHandle.queryPermission({ mode: "readwrite" });
    backupState = p === "granted" ? "on" : "paused";
  } catch { backupHandle = null; }
}

// ---------------------------------------------------------------- the Diagram tab
// The diagram lives in doc.diagram. Company and logo live once, in doc.meta, and are handed to the diagram.
const LOGO_MAX = 40000;   // the diagram's limit: its share link carries the logo
window.rbDiagram = {
  gotoCover() { state.tab = "log"; state.log = "cover"; renderAll(); toast("Add your logo here. It appears on the diagram by itself."); },
  load() { const d = doc.diagram ? JSON.parse(JSON.stringify(doc.diagram)) : null; if (!d) return null;
    d.meta = { ...(d.meta || {}), company: doc.meta.company || "" }; if (doc.meta.logo) d.meta.logo = doc.meta.logo; else delete d.meta.logo; return d; },
  save(d) {
    doc.diagram = d;
    if (typeof d.meta?.company === "string" && d.meta.company) doc.meta.company = d.meta.company;
    doc.meta.logo = d.meta?.logo || "";
    commit(); return !saveFailed;
  },
};
const dframe = () => $("dframe")?.contentWindow;
function reloadDiagram() { try { dframe()?.rbReload?.(); } catch {} }
async function diagramPNG() {
  try { const w = dframe(); if (!w?.rbPNG || !w.rbHasContent?.()) return ""; return await w.rbPNG(); } catch { return ""; }
}
function readDiagram() { try { const d = dframe()?.rbDoc?.(); if (d) return d; } catch {} return doc.diagram; }
// Logos are kept small enough for the diagram's share link.
function readLogo(file) {
  return new Promise((res, rej) => {
    if (!file || !/^image\//.test(file.type)) return rej(new Error("That isn't an image."));
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => {
      URL.revokeObjectURL(url);
      for (const side of [400, 320, 256, 200, 160, 128]) for (const q of [0.85, 0.7, 0.55]) {
        const k = Math.min(1, side / Math.max(im.width, im.height));
        const c = document.createElement("canvas"); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
        c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
        let d = c.toDataURL("image/webp", q); if (!d.startsWith("data:image/webp")) d = c.toDataURL("image/png");
        if (d.length <= LOGO_MAX) return res(d);
      }
      rej(new Error("That logo is too detailed to shrink. Try a simpler PNG."));
    };
    im.onerror = () => { URL.revokeObjectURL(url); rej(new Error("That image couldn't be read.")); };
    im.src = url;
  });
}
function diagramAddressing(d) {
  const rows = [];
  if (!d || !Array.isArray(d.devices)) return rows;
  const add = (dev, host, ifn, vlan, a, m, gw) => { if (a) rows.push({ device: dev, hostname: host || "", iface: ifn, vlan: vlan || "", address: a, mask: m || "", gateway: gw || "" }); };
  for (const x of d.devices) {
    if (x.kind === "firewall") (x.interfaces || []).forEach((i) => add(x.name, x.hostname, i.name, "", i.address, i.mask, ""));
    else if (x.kind === "switch") {
      if (x.oob) add(x.name, x.hostname, "OOB", "", x.oob.address, x.oob.mask, "");
      (x.svis || []).forEach((s) => add(x.name, x.hostname, "VLAN " + (s.vlan || "?"), s.vlan, s.address, s.mask, ""));
    } else if (x.kind === "isp") add(x.name, "", "Uplink", "", x.address, x.mask, "");
    else add(x.name, x.hostname, x.kind === "vm" ? "net0" : "NIC", x.vlanTag || "", x.dhcp ? "DHCP" : x.address, x.mask, x.gateway);
  }
  return rows;
}

// ---------------------------------------------------------------- who's typing
function me() { try { return localStorage.getItem(ME_KEY) || ""; } catch { return ""; } }
function setMe(n) { try { localStorage.setItem(ME_KEY, n); } catch {} }

// ---------------------------------------------------------------- CVSS 3.1 base score
const CW = { AV: { N: .85, A: .62, L: .55, P: .2 }, AC: { L: .77, H: .44 }, UI: { N: .85, R: .62 }, CIA: { H: .56, L: .22, N: 0 } };
function roundup(x) { const i = Math.round(x * 100000); return i % 10000 === 0 ? i / 100000 : (Math.floor(i / 10000) + 1) / 10; }
function cvss(v) {
  if (!v) return 0;
  const iss = 1 - (1 - CW.CIA[v.C]) * (1 - CW.CIA[v.I]) * (1 - CW.CIA[v.A]);
  const imp = v.S === "U" ? 6.42 * iss : 7.52 * (iss - .029) - 3.25 * Math.pow(iss - .02, 15);
  const pr = { N: .85, L: v.S === "C" ? .68 : .62, H: v.S === "C" ? .5 : .27 }[v.PR];
  const ex = 8.22 * CW.AV[v.AV] * CW.AC[v.AC] * pr * CW.UI[v.UI];
  if (imp <= 0) return 0;
  return v.S === "U" ? roundup(Math.min(imp + ex, 10)) : roundup(Math.min(1.08 * (imp + ex), 10));
}
const sevOf = (s) => s === 0 ? ["None", "none"] : s < 4 ? ["Low", "low"] : s < 7 ? ["Medium", "med"] : s < 9 ? ["High", "high"] : ["Critical", "crit"];
const vector = (v) => "CVSS:3.1/" + CVSS_METRICS.map(([k]) => k + ":" + v[k]).join("/");
function parseVector(s) {
  const m = /CVSS:3\.[01]\/(.*)/.exec(s || ""); if (!m) return null;
  const v = {}; m[1].split("/").forEach((p) => { const [k, x] = p.split(":"); v[k] = x; });
  return CVSS_METRICS.every(([k, , o]) => o.some(([x]) => x === v[k])) ? Object.fromEntries(CVSS_METRICS.map(([k]) => [k, v[k]])) : null;
}
const blankVector = () => ({ AV: "N", AC: "L", PR: "N", UI: "N", S: "U", C: "N", I: "N", A: "N" });

// ---------------------------------------------------------------- DOM helpers
function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const k in attrs || {}) {
    const v = attrs[k]; if (v == null || v === false) continue;
    if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (k === "class") e.className = v;
    else if (k === "html") e.innerHTML = v;
    else if (k === "value") e.value = v;
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false) e.append(c instanceof Node ? c : String(c));
  return e;
}
// replaceChildren would print null and false as text; skip them, as h() does.
{ const rc = Element.prototype.replaceChildren; Element.prototype.replaceChildren = function (...k) { return rc.apply(this, k.flat(Infinity).filter((x) => x != null && x !== false)); }; }
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Bound inputs: read and write a property of an object, commit on input.
function field(label, obj, key, o = {}) {
  const id = o.id || newId("f");
  const tag = o.area ? "textarea" : o.options ? "select" : "input";
  const inp = h(tag, { id, placeholder: o.placeholder || "", rows: o.area ? (o.rows || 3) : null, type: o.type || null,
    oninput: (e) => { obj[key] = e.target.value; commit(); o.oninput && o.oninput(e); },
    onchange: o.options ? (e) => { obj[key] = e.target.value; commit(); o.onchange && o.onchange(e); } : null });
  if (o.options) for (const op of o.options) { const [v, t] = Array.isArray(op) ? op : [op, op]; inp.append(h("option", { value: v }, t)); }
  inp.value = obj[key] ?? "";
  if (o.area) autosize(inp);
  return h("div", { class: "field" + (o.wide ? " wide" : "") },
    label ? h("label", { for: id }, label, o.req ? h("span", { class: "req", title: "Needed for the report" }, " *") : null) : null,
    inp, o.hint ? h("p", { class: "hintline" }, o.hint) : null);
}
function autosize(t) { const f = () => { t.style.height = "auto"; t.style.height = Math.min(600, t.scrollHeight + 2) + "px"; }; t.addEventListener("input", f); requestAnimationFrame(f); }

// Editable table: rows are objects; cols are [key, label, opts]
function rowsTable(rows, cols, o = {}) {
  const body = h("tbody");
  const draw = () => {
    body.replaceChildren(...rows.map((r, i) => h("tr", {},
      cols.map(([k, , co = {}]) => h("td", { class: co.cls || "" }, co.fixed ? h("span", { class: "fixed" }, r[k]) : cellInput(r, k, co))),
      h("td", { class: "rowacts" }, o.fixedRows ? null : h("button", { class: "small ghost", title: "Remove this row", "aria-label": "Remove row", onclick: () => { rows.splice(i, 1); commit(); draw(); o.onchange && o.onchange(); } }, "✕")))));
  };
  draw();
  const add = o.fixedRows ? null : h("button", { class: "small", onclick: () => { rows.push(o.blank ? o.blank() : Object.fromEntries(cols.map(([k]) => [k, ""]))); commit(); draw(); const last = body.lastElementChild?.querySelector("input,textarea,select"); last && last.focus(); o.onchange && o.onchange(); } }, "+ " + (o.addLabel || "Add row"));
  return h("div", { class: "tablewrap" }, h("div", { class: "tbox" }, h("table", { class: "edit" },
    h("thead", {}, h("tr", {}, cols.map(([, l, co = {}]) => h("th", { style: co.w ? `width:${co.w}` : null }, l)), h("th", { class: "rowacts" }))), body)), add);
}
function cellInput(r, k, co) {
  if (co.options) {
    const s = h("select", { "aria-label": co.label || k, onchange: (e) => { r[k] = e.target.value; commit(); } }, co.options.map((x) => h("option", { value: x }, x)));
    s.value = r[k] || co.options[0]; if (!r[k]) r[k] = s.value; return s;
  }
  const t = h(co.area ? "textarea" : "input", { "aria-label": co.label || k, placeholder: co.placeholder || "", type: co.type || null, rows: co.area ? 1 : null,
    oninput: (e) => { r[k] = e.target.value; commit(); } });
  t.value = r[k] ?? ""; if (co.area) autosize(t); return t;
}

// Image well: thumbnails plus add by click, drop or paste
function imageWell(list, o = {}) {
  const wrap = h("div", { class: "well", tabindex: "0", "aria-label": (o.label || "Images") + ". Click, drop or paste an image." });
  const draw = () => {
    wrap.replaceChildren(
      ...list.map((id, i) => h("figure", { class: "thumb" }, images[id] ? h("img", { src: images[id], alt: "" }) : h("span", { class: "missing" }, "Image missing"),
        h("button", { class: "small ghost x", "aria-label": "Remove image", onclick: (e) => { e.stopPropagation(); list.splice(i, 1); commit(); draw(); } }, "✕"))),
      h("button", { class: "small addimg", onclick: () => pick() }, list.length ? "+ Add" : (o.prompt || "Add a screenshot")), h("span", { class: "wellhint" }, "or drop or paste it here"));
  };
  const take = async (files) => {
    for (const f of files) { try { list.push(await addImage(f)); commit(); } catch (e) { toast(e.message, true); } }
    draw();
  };
  const pick = () => { const i = h("input", { type: "file", accept: "image/*", multiple: true, onchange: (e) => take([...e.target.files]) }); i.click(); };
  wrap.addEventListener("dragover", (e) => { e.preventDefault(); wrap.classList.add("over"); });
  wrap.addEventListener("dragleave", () => wrap.classList.remove("over"));
  wrap.addEventListener("drop", (e) => { e.preventDefault(); wrap.classList.remove("over"); take([...e.dataTransfer.files]); });
  wrap.addEventListener("paste", (e) => { const f = [...(e.clipboardData?.files || [])]; if (f.length) { e.preventDefault(); take(f); } });
  draw(); return wrap;
}

function seg(options, value, onpick, o = {}) {
  return h("div", { class: "seg3", role: "group", "aria-label": o.label || null }, options.map(([v, t]) =>
    h("button", { class: "small", "aria-pressed": String(value === v), onclick: () => onpick(v) }, t)));
}

let toastTimer;
function toast(msg, bad) { const t = $("toast"); t.textContent = msg; t.className = "toast" + (bad ? " bad" : ""); t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 4200); }

function ask(title, body, acts) {
  $("m-title").textContent = title;
  $("m-body").replaceChildren(...[].concat(body));
  $("m-acts").replaceChildren(...acts.map(([t, fn, cls]) => h("button", { class: cls || "", onclick: () => { closeModal(); fn && fn(); } }, t)));
  $("modal").hidden = false; ($("m-acts").lastElementChild || $("m-acts")).focus();
}
function closeModal() { $("modal").hidden = true; }
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("modal").hidden) closeModal(); });

function pickFile(accept) {
  return new Promise((res) => { const i = h("input", { type: "file", accept, onchange: (e) => res(e.target.files[0] || null) }); i.click(); });
}
const ago = (t) => { const m = Math.round((Date.now() - t) / 60e3); return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`; };
const fmtTime = (t) => new Date(t).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
