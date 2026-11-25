// Network Diagram: the Report Builder's Diagram tab (diagram.html, shown in a frame by index.html).
//
// Inside the Report Builder it loads and saves through window.parent.rbDiagram, so the diagram travels in the
// team file with history and backups. Opened on its own with a share link, it is a viewer that saves nothing.
//
// Everything drawn comes from what the team typed. The one exception is the Addressing table's Planned column
// (Gabriel's call, Nov 24 2026): the addressing plan from Reference: Rack Schema and VLAN Plan, filled in from
// the rack number on the Team Log cover (HOST.rack()). It flags entries that differ from the plan, so the
// diagram works like an IPAM record beside the as-built. Students still type every address themselves, and
// the canvas, the checks and the exports show only what they typed.
"use strict";
(() => {
const SCHEMA = 2;
const KEY = "cyberhub-diagram";
const LOGO_MAX = 40000; // characters of data URL; the logo rides in the share link, so it stays small
const VB = { w: 1540, h: 900 };
const HOST = (() => { try { return window.parent !== window && window.parent.rbDiagram ? window.parent.rbDiagram : null; } catch { return null; } })();
if (HOST) document.documentElement.classList.add("embedded");
const SW_PORTS = ["XG1","XG2","XG3","XG4","XG5","XG6","XG7","XG8","XG9","XG10","XG11","XG12","OOB"];
const FW_IFS = ["wan1", "internal", "dmz", "guest Wi-Fi"];
const SERVICES = ["ALL", "PING", "HTTP", "HTTPS", "SSH", "FTP", "DNS"];
const KINDS = {
  isp: "Provider", firewall: "Firewall", switch: "Switch", hypervisor: "Hypervisor", nas: "NAS",
  pi: "Raspberry Pi", laptop: "Laptop", vm: "Virtual machine",
};
const ENDPOINT = new Set(["hypervisor", "nas", "pi", "laptop", "vm"]);

const $ = (id) => document.getElementById(id);
const svg = $("svg"), panel = $("panel"), tableView = $("v-table");
const NS = "http://www.w3.org/2000/svg";

// ------------------------------------------------------------------ document
// Every rack has the same devices, so the set is fixed: nothing is added, deleted or moved.
let uid = 0;
const newId = (p) => p + Date.now().toString(36) + (uid++).toString(36);
const ep = () => ({ hostname: "", address: "", mask: "", gateway: "", dhcp: false });
const vm = (id, name) => ({ id, kind: "vm", host: "hv", name, ...ep(), vlanTag: "" });
function blankDoc() {
  return {
    v: SCHEMA, meta: { company: "", updated: null },
    devices: [
      { id: "isp", kind: "isp", name: "Provider (instructor rack)", address: "", mask: "" },
      { id: "isplap", kind: "laptop", name: "Internet laptop", ...ep() },
      { id: "fw", kind: "firewall", name: "Firewall", hostname: "",
        interfaces: FW_IFS.map((n) => ({ name: n, address: "", mask: "", ...(n === "guest Wi-Fi" ? { ssid: "" } : {}) })),
        routes: [], vips: [], policies: [] },
      { id: "guest", kind: "laptop", name: "Guest laptop", ...ep() },
      { id: "sw", kind: "switch", name: "Core switch", hostname: "", oob: { address: "", mask: "" }, svis: [], routes: [], dhcpPools: [],
        ports: SW_PORTS.map((n) => ({ name: n, mode: "", pvid: "", tagged: [], shutdown: false })) },
      { id: "hv", kind: "hypervisor", name: "Hypervisor", ...ep() },
      vm("vmweb", "Web server"), vm("vmftp", "FTP server"), vm("vmscan", "Scanner"),
      { id: "nas", kind: "nas", name: "NAS", ...ep() },
      { id: "admin", kind: "laptop", name: "Admin laptop", ...ep() },
      { id: "pi", kind: "pi", name: "Vulnerable Pi", ...ep() },
      { id: "lap", kind: "laptop", name: "Team laptop", ...ep() },
    ],
    links: [],
  };
}
let doc = blankDoc();
const dev = (id) => doc.devices.find((d) => d.id === id);
const vmsOf = (id) => doc.devices.filter((d) => d.kind === "vm" && d.host === id);
const ISP_PORTS = ["Uplink", "Internet Wi-Fi"];
// The one network port on each single-port device, named as the device names it
const NIC = { hv: "NIC 1", nas: "LAN 1", pi: "eth0", admin: "Ethernet", lap: "Ethernet", isplap: "Wi-Fi", guest: "Wi-Fi" };
const portsFor = (d) => d.kind === "switch" ? SW_PORTS : d.kind === "firewall" ? FW_IFS : d.kind === "isp" ? ISP_PORTS : [];
const nicOf = (d) => NIC[d.id] || "NIC";

// Bring an older or hand-edited document into the fixed device set, keeping what the team entered.
function normalize(x) {
  if (!x || typeof x !== "object" || !Array.isArray(x.devices)) throw new Error("not a diagram");
  const d = blankDoc();
  const logo = typeof x.meta?.logo === "string" && /^data:image\/(png|jpeg|webp);base64,/.test(x.meta.logo) && x.meta.logo.length <= LOGO_MAX ? x.meta.logo : "";
  const vc = {};
  if (x.meta?.vlanColors && typeof x.meta.vlanColors === "object") for (const [k, v] of Object.entries(x.meta.vlanColors)) if (/^\d{1,4}$/.test(k) && Number.isInteger(v) && v >= 0 && v < 64) vc[k] = v;
  d.meta = { company: String(x.meta?.company ?? ""), updated: x.meta?.updated ?? null, ...(logo ? { logo } : {}), ...(Object.keys(vc).length ? { vlanColors: vc } : {}) };
  const old = new Map(x.devices.filter((v) => v && v.id).map((v) => [String(v.id), v]));
  d.devices = d.devices.map((base) => {
    const v = old.get(base.id);
    if (!v || v.kind !== base.kind) return base;
    const o = { ...base };
    o.name = String(v.name || base.name);
    for (const k of ["hostname", "address", "mask", "gateway", "vlanTag"]) if (k in base && v[k] != null) o[k] = String(v[k]);
    if ("dhcp" in base) o.dhcp = !!v.dhcp;
    if (base.kind === "switch") {
      for (const k of ["svis", "routes", "dhcpPools"]) o[k] = Array.isArray(v[k]) ? v[k] : [];
      o.oob = { address: String(v.oob?.address || ""), mask: String(v.oob?.mask || "") };
      const have = new Map((v.ports || []).map((p) => [p.name, p]));
      o.ports = base.ports.map((p) => { const q = have.get(p.name) || {}; return { ...p, mode: q.mode || "", pvid: String(q.pvid || ""), tagged: Array.isArray(q.tagged) ? q.tagged : [], shutdown: !!q.shutdown }; });
    }
    if (base.kind === "firewall") {
      for (const k of ["routes", "vips", "policies"]) o[k] = Array.isArray(v[k]) ? v[k] : [];
      const have = new Map((v.interfaces || []).map((p) => [p.name, p]));
      o.interfaces = base.interfaces.map((i) => { const q = have.get(i.name) || {}; return { ...i, address: q.address || "", mask: q.mask || "", ...("ssid" in i ? { ssid: q.ssid || "" } : {}) }; });
    }
    return o;
  });
  const ids = new Set(d.devices.filter((v) => v.kind !== "vm").map((v) => v.id));
  d.links = (Array.isArray(x.links) ? x.links : []).filter((l) => l && ids.has(l.a?.device) && ids.has(l.b?.device) && l.a.device !== l.b.device)
    .map((l) => {
      // Saves from before the instructor-rack upstream used LAN, LAN 1 and LAN 2 on the ISP router.
      const OLD = { "LAN 1": "Uplink", "LAN 2": "Internet Wi-Fi", "Internet": "Internet Wi-Fi" };
      const fix = (e, o) => ({ device: e.device, port: e.device === "isp" ? (OLD[e.port] || (ISP_PORTS.includes(e.port) ? e.port : o.device === "fw" ? "Uplink" : "Internet Wi-Fi")) : String(e.port || "") });
      return { id: String(l.id || newId("l")), a: fix(l.a, l.b), b: fix(l.b, l.a) };
    });
  return d;
}

// ------------------------------------------------------------------ address helpers (format only, never values)
const isIP = (s) => /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.test(s) && s.split(".").every((n) => +n <= 255);
function maskToPrefix(m) {
  m = String(m).trim().replace(/^\//, "");
  if (/^\d{1,2}$/.test(m) && +m <= 32) return String(+m);
  if (isIP(m)) {
    const bits = m.split(".").map((n) => (+n).toString(2).padStart(8, "0")).join("");
    if (/^1*0*$/.test(bits)) return String(bits.indexOf("0") === -1 ? 32 : bits.indexOf("0"));
  }
  return null;
}
const isCIDR = (s) => { const [a, p, ...r] = String(s).split("/"); return !r.length && isIP(a) && p !== undefined && maskToPrefix(p) !== null; };
const withPrefix = (a, m) => a ? a + (m ? "/" + m : "") : "";

// ------------------------------------------------------------------ history and saving
let hist = [], hi = -1, sharedJSON = null, saveFailed = false;
const snapshot = () => JSON.stringify(doc);
const contentOf = (j) => { try { const o = JSON.parse(j); delete o.meta.updated; return JSON.stringify(o); } catch { return j; } };
function commit() {
  assignVlanColors();
  const s = snapshot();
  if (hist[hi] === s) return;
  hist = hist.slice(0, hi + 1); hist.push(s);
  if (hist.length > 120) hist.shift();
  hi = hist.length - 1;
  doc.meta.updated = new Date().toISOString();
  save(); updateButtons();
}
function save() {
  if (HOST) { try { saveFailed = !HOST.save(JSON.parse(JSON.stringify(doc))); } catch { saveFailed = true; } }
  else { $("saved").textContent = "You're viewing a shared diagram. Any changes you make here won't be saved."; return; }
  const s = $("saved");
  s.classList.toggle("warn", saveFailed);
  // If the browser refuses (storage blocked or full), the share link still holds everything: offer it right here.
  if (saveFailed) s.textContent = "Your diagram couldn't be saved. Use Back up now at the top of the Report Builder.";
  else s.textContent = "Saved with your team file at " + new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
function updateButtons() {
  $("b-undo").disabled = hi <= 0; $("b-redo").disabled = hi >= hist.length - 1;
  $("b-share").querySelector(".dot").hidden = sharedJSON === null ? !hasContent() : contentOf(sharedJSON) === contentOf(snapshot());
}
function restore(j) { doc = JSON.parse(j); doc.meta.updated = new Date().toISOString(); save(); if (sel && !findSel()) sel = null; renderAll(); updateButtons(); }
const undo = () => { if (hi > 0) restore(hist[--hi]); };
const redo = () => { if (hi < hist.length - 1) restore(hist[++hi]); };
const hasContent = (o = doc) => o.links.length > 0 || o.devices.some((d) => d.address || d.gateway || d.dhcp || d.svis?.length ||
  d.interfaces?.some((i) => i.address) || d.oob?.address || d.ports?.some((p) => p.mode || p.shutdown) || d.policies?.length);

// ------------------------------------------------------------------ selection
let sel = null; // {type:'dev'|'link', id}
const findSel = () => sel && (sel.type === "dev" ? dev(sel.id) : doc.links.find((l) => l.id === sel.id));
function select(s) { sel = s; renderSvg(); renderPanel(); }

// ------------------------------------------------------------------ VLAN colors
// Each VLAN number gets the next free color the first time it appears and keeps it, so colors never shuffle as
// a team adds VLANs. Colors are only ever derived from what the team entered.
const VPAL = ["#0d9488", "#ea580c", "#7c3aed", "#db2777", "#ca8a04", "#16a34a", "#0891b2", "#dc2626", "#4f46e5", "#92400e", "#65a30d", "#475569"];
const vnum = (v) => { const s = String(v ?? "").trim(); return /^\d{1,4}$/.test(s) && +s >= 1 && +s <= 4094 ? String(+s) : ""; };
function portVlans(p) {
  if (!p || p.shutdown) return [];
  if (p.mode === "access") return [vnum(p.pvid)].filter(Boolean);
  if (p.mode === "trunk") return [...new Set([vnum(p.pvid), ...(p.tagged || []).map(vnum)].filter(Boolean))];
  return [];
}
const ip2n = (a) => a.split(".").reduce((n, o) => n * 256 + +o, 0);
function inSub(addr, base, mask) {
  const p = maskToPrefix(mask);
  if (!isIP(addr) || !isIP(base) || p === null) return false;
  const k = 2 ** (32 - +p);
  return Math.floor(ip2n(addr) / k) === Math.floor(ip2n(base) / k);
}
function netOf(addr, mask) {
  const p = maskToPrefix(mask);
  if (!isIP(addr) || p === null) return "";
  const k = 2 ** (32 - +p), n = Math.floor(ip2n(addr) / k) * k;
  return [24, 16, 8, 0].map((sh) => Math.floor(n / 2 ** sh) % 256).join(".") + "/" + p;
}
function vlansInUse() {
  const sw = dev("sw"), set = new Set();
  sw.ports.forEach((p) => portVlans(p).forEach((v) => set.add(v)));
  sw.svis.forEach((v) => vnum(v.vlan) && set.add(vnum(v.vlan)));
  doc.devices.forEach((d) => d.kind === "vm" && vnum(d.vlanTag) && set.add(vnum(d.vlanTag)));
  return [...set].sort((a, b) => a - b);
}
// Hands out colors to new VLANs. Returns true if the document changed.
function assignVlanColors() {
  const vc = doc.meta.vlanColors || {}, used = new Set(Object.values(vc));
  let changed = false;
  for (const v of vlansInUse()) if (!(v in vc)) {
    let i = 0; while (used.has(i) && i < VPAL.length) i++;
    if (i >= VPAL.length) i = Object.keys(vc).length % VPAL.length;
    vc[v] = i; used.add(i); changed = true;
  }
  if (changed) doc.meta.vlanColors = vc;
  return changed;
}
const vcolor = (v) => { const i = doc.meta.vlanColors?.[v]; return i === undefined ? "#64748b" : VPAL[i % VPAL.length]; };
// The VLANs a cable carries: those of the switch port at either end.
function linkVlans(l) {
  for (const e of [l.a, l.b]) if (e.device === "sw" && e.port) return portVlans(dev("sw").ports.find((p) => p.name === e.port));
  return [];
}
// A device's own VLAN: the access port it plugs into, else the SVI subnet its address falls in.
function devVlan(d) {
  if (d.kind === "vm") return vnum(d.vlanTag);
  if (!["laptop", "nas", "pi", "hypervisor"].includes(d.kind) || ["isplap", "guest"].includes(d.id)) return "";
  const l = doc.links.find((x) => (x.a.device === d.id && x.b.device === "sw") || (x.b.device === d.id && x.a.device === "sw"));
  if (l) { const v = linkVlans(l); if (v.length === 1) return v[0]; }
  if (d.address) { const s = dev("sw").svis.find((v) => vnum(v.vlan) && inSub(d.address, v.address, v.mask)); if (s) return vnum(s.vlan); }
  return "";
}

// ------------------------------------------------------------------ drawing
// The layout follows the lab's traffic path, top to bottom: provider, firewall, core switch, then the hosts.
// The switch and firewall are drawn with their real ports, and cables plug into the port they were recorded on.
const el = (tag, attrs = {}, parent) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) n.setAttribute(k, v);
  if (parent) parent.appendChild(n);
  return n;
};
const text = (parent, x, y, cls, s, anchor) => { const t = el("text", { x, y, class: cls, "text-anchor": anchor }, parent); t.textContent = s; return t; };

function valueLines(d) {
  const L = [];
  if (d.kind === "isp") { if (d.address) L.push(withPrefix(d.address, d.mask)); }
  else if (d.kind === "firewall") { for (const i of d.interfaces) if (i.address) L.push(`${i.name} ${withPrefix(i.address, i.mask)}`); }
  else if (d.kind === "switch") {
    if (d.oob?.address) L.push(`OOB ${withPrefix(d.oob.address, d.oob.mask)}`);
    const s = d.svis.filter((v) => v.address || v.vlan);
    s.slice(0, 6).forEach((v) => L.push(`VLAN ${v.vlan || "?"} ${withPrefix(v.address, v.mask)}`.trim()));
    if (s.length > 6) L.push(`+${s.length - 6} more VLAN interfaces`);
    d.routes.filter((r) => r.dest).slice(0, 2).forEach((r) => L.push(`${r.dest} via ${r.nextHop || "?"}`));
    if (d.routes.length > 2) L.push(`+${d.routes.length - 2} more routes`);
  } else if (ENDPOINT.has(d.kind)) {
    if (d.hostname && d.kind !== "vm") L.push(d.hostname);
    if (d.address) L.push(withPrefix(d.address, d.mask)); else if (d.dhcp) L.push("DHCP");
    if (d.gateway) L.push("gw " + d.gateway);
  }
  return L;
}

// Geometry
const VM_H = 42, PORT_W = 60, PORT_H = 54, PITCH = 66, OOB_GAP = 16, TAB_W = 64, TAB_H = 22;
// Everything sits on one grid: five columns 240 wide with 40 between them, inside a 40 margin. The provider and
// firewall span two columns, the two laptops beside them sit in the fourth, the hints, legend and logo in the fifth,
// the switch spans all five, and each host takes one column, so every gap in the drawing is the same.
const M = 40, COL = 240, GAP = 40, CPITCH = COL + GAP, CW = 5 * COL + 4 * GAP;
const colX = (i) => M + i * CPITCH;
const SW_W = CW, SW_TEXT_W = SW_W - (20 + 12 * PITCH + OOB_GAP + PORT_W + 26);
const HOST_W = COL, HOST_PITCH = CPITCH, FW_W = 2 * COL + GAP, SIDE_W = COL;
const HOSTS = ["hv", "nas", "admin", "pi", "lap"];
function boxSize(d) {
  const lines = valueLines(d).length;
  if (d.kind === "switch") return { w: SW_W, h: Math.max(130, 46 + lines * 19) };
  if (d.kind === "firewall") return { w: FW_W, h: Math.max(110, 66 + lines * 19) };
  let h = 42 + lines * 19 + (lines ? 8 : 0);
  if (d.kind === "hypervisor") h += vmsOf(d.id).length * (VM_H + 6) + 6;
  return { w: d.kind === "isp" ? FW_W : d.id === "isplap" || d.id === "guest" ? SIDE_W : HOST_W, h: Math.max(h, 80) };
}
const rectOf = (d) => { const { w, h } = boxSize(d); return { x: d.x, y: d.y, w, h }; };
const center = (d) => { const r = rectOf(d); return [r.x + r.w / 2, r.y + r.h / 2]; };
function portRect(sw, name) {
  const i = SW_PORTS.indexOf(name);
  if (i < 0) return null;
  const { h } = boxSize(sw);
  const x = sw.x + 20 + i * PITCH + (name === "OOB" ? OOB_GAP : 0);
  return { x, y: sw.y + (h - PORT_H) / 2, w: PORT_W, h: PORT_H, cx: x + PORT_W / 2 };
}
// Firewall interface tabs and the provider's Uplink and Internet Wi-Fi tabs sit on the box edges
function tabRect(d, name) {
  const { w, h } = boxSize(d);
  if (d.kind === "isp") {
    if (name === "Uplink") return { x: d.x + 30, y: d.y + h - TAB_H / 2, w: TAB_W, h: TAB_H, side: "bottom" };
    if (name === "Internet Wi-Fi") return { x: d.x + w - 50, y: d.y + h / 2 - TAB_H / 2, w: 100, h: TAB_H, side: "right" };
    return null;
  }
  if (ENDPOINT.has(d.kind) && d.kind !== "vm") {
    const tw = 74;
    if (d.id === "isplap" || d.id === "guest") return { x: d.x - tw + 32, y: d.y + h / 2 - TAB_H / 2, w: tw, h: TAB_H, side: "left" };
    return { x: d.x + w / 2 - tw / 2, y: d.y - TAB_H / 2, w: tw, h: TAB_H, side: "top" };
  }
  if (d.kind !== "firewall") return null;
  if (name === "wan1") return { x: d.x + 30, y: d.y - TAB_H / 2, w: TAB_W, h: TAB_H, side: "top" };
  if (name === "internal") return { x: d.x + 30, y: d.y + h - TAB_H / 2, w: TAB_W, h: TAB_H, side: "bottom" };
  if (name === "dmz") return { x: d.x + 30 + PITCH, y: d.y + h - TAB_H / 2, w: TAB_W, h: TAB_H, side: "bottom" };
  if (name === "guest Wi-Fi") return { x: d.x + w - 45, y: d.y + h / 2 - TAB_H / 2, w: 90, h: TAB_H, side: "right" };
  return null;
}

// Rows are spaced for a typical finished rack, not for what has been typed so far, so the drawing keeps the same
// size while a team fills it in: no jumping boxes, and a scroll bar either always or never at a given window size.
const ROOM = { isp: 80, firewall: 66 + 4 * 19, switch: 46 + 7 * 19 };
const roomOf = (d) => Math.max(boxSize(d).h, ROOM[d.kind] || 0);
const LANES = 5;   // cable lanes kept free between the switch and the hosts
const ROW_GAP = 64;   // the same vertical gap between the provider, the firewall and the switch
function layout() {
  const put = (id, x, y) => { const d = dev(id); if (d) { d.x = x; d.y = y; } };
  const isp = dev("isp"), fw = dev("fw");
  put("isp", colX(0), 36);
  put("fw", colX(0), isp.y + roomOf(isp) + ROW_GAP);
  const besides = (id, ref) => { const d = dev(id); d.x = colX(3); d.y = ref.y + (boxSize(ref).h - boxSize(d).h) / 2; };
  besides("isplap", isp); besides("guest", fw);
  put("sw", colX(0), fw.y + roomOf(fw) + ROW_GAP);
  HOSTS.forEach((id, i) => put(id, colX(i), 0));
  routeAll();
}

// ------------------------------------------------------------------ cable routing
// Each cable leaves its port straight out, then runs at right angles around every box. Cables from the switch down
// to the hosts get their own horizontal lane, so they never overlap.
let routes = new Map(); // link id -> {pts, ends:[anchor, anchor]}
function anchor(d, port, other) {
  const r = rectOf(d), [ox, oy] = center(other);
  if (d.kind === "switch") {
    const pr = portRect(d, port);
    if (pr) return oy < d.y ? { x: pr.cx, y: pr.y, side: "top", inner: d.y, port: true } : { x: pr.cx, y: pr.y + pr.h, side: "bottom", inner: d.y + r.h, port: true };
  }
  const t = tabRect(d, portsFor(d).length ? port : nicOf(d));
  if (t) {
    if (t.side === "top") return { x: t.x + t.w / 2, y: t.y, side: "top", port: true };
    if (t.side === "bottom") return { x: t.x + t.w / 2, y: t.y + t.h, side: "bottom", port: true };
    if (t.side === "left") return { x: t.x, y: t.y + t.h / 2, side: "left", port: true };
    return { x: t.x + t.w, y: t.y + t.h / 2, side: "right", port: true };
  }
  if (oy < r.y) return { x: r.x + r.w / 2, y: r.y, side: "top" };
  if (oy > r.y + r.h) return { x: r.x + r.w / 2, y: r.y + r.h, side: "bottom" };
  return ox < r.x ? { x: r.x, y: r.y + r.h / 2, side: "left" } : { x: r.x + r.w, y: r.y + r.h / 2, side: "right" };
}
const DIR = { top: [0, -1], bottom: [0, 1], left: [-1, 0], right: [1, 0] };
const STUB = 18, CLEAR = 12;
// The point where a cable has left its device: past the box edge (a switch port's cable crosses the switch's face first)
function stubEnd(a) {
  const [dx, dy] = DIR[a.side];
  if (a.inner !== undefined) return { x: a.x, y: a.inner + dy * STUB };
  return { x: a.x + dx * STUB, y: a.y + dy * STUB };
}
function blocks() {
  return doc.devices.filter((d) => d.kind !== "vm").map((d) => { const r = rectOf(d); return { x0: r.x - CLEAR, y0: r.y - CLEAR, x1: r.x + r.w + CLEAR, y1: r.y + r.h + CLEAR }; });
}
const segHits = (ax, ay, bx, by, b) => {
  const x0 = Math.min(ax, bx), x1 = Math.max(ax, bx), y0 = Math.min(ay, by), y1 = Math.max(ay, by);
  return x0 < b.x1 - 0.5 && x1 > b.x0 + 0.5 && y0 < b.y1 - 0.5 && y1 > b.y0 + 0.5;
};
// Shortest right-angle path between two free points, avoiding the boxes, preferring few bends.
function astar(s, t, sDir, B) {
  const xs = [...new Set([s.x, t.x, 8, VB.w - 8, ...B.flatMap((b) => [b.x0, b.x1])].map((v) => Math.round(v)))].sort((a, b) => a - b);
  const ys = [...new Set([s.y, t.y, 8, VB.h - 8, ...B.flatMap((b) => [b.y0, b.y1])].map((v) => Math.round(v)))].sort((a, b) => a - b);
  const inside = (x, y) => B.some((b) => x > b.x0 + 0.5 && x < b.x1 - 0.5 && y > b.y0 + 0.5 && y < b.y1 - 0.5);
  const key = (i, j, d) => (i * ys.length + j) * 4 + d;
  const si = xs.indexOf(Math.round(s.x)), sj = ys.indexOf(Math.round(s.y)), ti = xs.indexOf(Math.round(t.x)), tj = ys.indexOf(Math.round(t.y));
  const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const startD = D4.findIndex(([a, b]) => a === sDir[0] && b === sDir[1]);
  const dist = new Map(), prev = new Map(), heap = [];
  const push = (c, k) => { heap.push([c, k]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  const k0 = key(si, sj, startD < 0 ? 0 : startD); dist.set(k0, 0); push(0, k0);
  while (heap.length) {
    const [c, k] = pop();
    if (c > (dist.get(k) ?? Infinity)) continue;
    const d = k % 4, ij = (k - d) / 4, i = Math.floor(ij / ys.length), j = ij % ys.length;
    if (i === ti && j === tj) {
      const pts = []; let cur = k;
      while (cur !== undefined) { const cd = cur % 4, cij = (cur - cd) / 4; pts.push({ x: xs[Math.floor(cij / ys.length)], y: ys[cij % ys.length] }); cur = prev.get(cur); }
      return pts.reverse();
    }
    D4.forEach(([dx, dy], nd) => {
      if (dx === -D4[d][0] && dy === -D4[d][1]) return;
      const ni = i + dx, nj = j + dy;
      if (ni < 0 || nj < 0 || ni >= xs.length || nj >= ys.length) return;
      const ax = xs[i], ay = ys[j], bx = xs[ni], by = ys[nj];
      if (inside(bx, by) || B.some((b) => segHits(ax, ay, bx, by, b))) return;
      const nc = c + Math.abs(bx - ax) + Math.abs(by - ay) + (nd !== d ? 40 : 0);
      const nk = key(ni, nj, nd);
      if (nc < (dist.get(nk) ?? Infinity)) { dist.set(nk, nc); prev.set(nk, k); push(nc, nk); }
    });
  }
  return [s, { x: s.x, y: t.y }, t];
}
function simplify(pts) {
  const out = [];
  for (const p of pts) {
    if (out.length && Math.abs(out.at(-1).x - p.x) < 0.5 && Math.abs(out.at(-1).y - p.y) < 0.5) continue;
    if (out.length >= 2) { const a = out.at(-2), b = out.at(-1); if ((Math.abs(a.x - b.x) < 0.5 && Math.abs(b.x - p.x) < 0.5) || (Math.abs(a.y - b.y) < 0.5 && Math.abs(b.y - p.y) < 0.5)) out.pop(); }
    out.push(p);
  }
  return out;
}
function routeAll() {
  routes = new Map();
  const sw = dev("sw"), swR = rectOf(sw), hostSet = new Set(HOSTS);
  // 1. Hosts row: below the switch, leaving room for one lane per crossing cable.
  const down = [];
  for (const l of doc.links) {
    const [s, o] = l.a.device === "sw" ? [l.a, l.b] : l.b.device === "sw" ? [l.b, l.a] : [null, null];
    if (!s || !hostSet.has(o.device)) continue;
    const pr = portRect(sw, s.port), od = dev(o.device);
    const from = pr ? pr.cx : swR.x + swR.w / 2, to = od.x + HOST_W / 2;
    down.push({ l, from, to, lo: Math.min(from, to), hi: Math.max(from, to), left: to < from });
  }
  const order = [...down.filter((c) => c.left).sort((a, b) => a.to - b.to), ...down.filter((c) => !c.left).sort((a, b) => b.to - a.to)];
  const used = [];
  for (const c of order) c.lane = undefined;
  for (const c of order) {
    if (Math.abs(c.from - c.to) < 1) { c.lane = -1; continue; }
    // An inner cable sits below every outer cable it overlaps, which keeps the fan-out free of crossings.
    const over = order.filter((u) => u !== c && u.lane >= 0 && c.lo < u.hi + 14 && u.lo < c.hi + 14);
    const k = over.length ? Math.max(...over.map((u) => u.lane)) + 1 : 0;
    (used[k] ||= []).push(c); c.lane = k;
  }
  const laneY = (k) => swR.y + roomOf(sw) + STUB + 10 + k * 16;
  const hostY = laneY(Math.max(LANES - 1, used.length - 1)) + 38;
  HOSTS.forEach((id) => { dev(id).y = hostY; });
  // The tallest host is the hypervisor with its three VMs and three lines of settings.
  const hvFull = 42 + 3 * 19 + 8 + vmsOf("hv").length * (VM_H + 6) + 6;
  const bottom = Math.max(hostY + hvFull, ...doc.devices.filter((d) => d.kind !== "vm").map((d) => d.y + boxSize(d).h));
  VB.w = SWX_END(); VB.h = bottom + 40;
  // 2. Route every cable.
  const B = blocks();
  for (const l of doc.links) {
    const A = dev(l.a.device), Bd = dev(l.b.device);
    if (!A || !Bd) continue;
    const pa = anchor(A, l.a.port, Bd), pb = anchor(Bd, l.b.port, A);
    const sa = stubEnd(pa), sb = stubEnd(pb);
    const lane = down.find((c) => c.l === l);
    let mid;
    if (lane && lane.lane >= 0 && pa.side !== pb.side) {
      const y = laneY(lane.lane);
      mid = [sa, { x: sa.x, y }, { x: sb.x, y }, sb];
    } else if (lane) mid = [sa, sb];
    else mid = astar(sa, sb, DIR[pa.side], B);
    routes.set(l.id, { pts: simplify([pa, ...mid, pb]), ends: [pa, pb] });
  }
  svg.setAttribute("viewBox", `0 0 ${VB.w} ${VB.h}`);
}
const SWX_END = () => M + CW + M;
function pathOf(pts) {
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i], a = pts[i - 1], b = pts[i + 1];
    const r = Math.min(12, Math.hypot(p.x - a.x, p.y - a.y) / 2, Math.hypot(b.x - p.x, b.y - p.y) / 2);
    const ux = Math.sign(p.x - a.x), uy = Math.sign(p.y - a.y), vx = Math.sign(b.x - p.x), vy = Math.sign(b.y - p.y);
    d += ` L${p.x - ux * r},${p.y - uy * r} Q${p.x},${p.y} ${p.x + vx * r},${p.y + vy * r}`;
  }
  const z = pts.at(-1);
  return d + ` L${z.x},${z.y}`;
}
const isWifi = (l) => [l.a, l.b].some((e) => e.port === "guest Wi-Fi" || e.port === "Internet Wi-Fi");
function portMode(p) {
  if (p.shutdown) return ["off", ""];
  if (p.mode === "access") return ["access", p.pvid || ""];
  if (p.mode === "trunk") { const v = [p.pvid, p.tagged.join(",")].filter(Boolean).join("|"); return ["trunk", v.length > 9 ? v.slice(0, 8) + "…" : v]; }
  return ["", ""];
}
// A plug where a cable meets a port or a device
function plug(g, a, wifi) {
  if (wifi) { el("circle", { cx: a.x, cy: a.y, r: 4.5, class: "d-plug" }, g); return; }
  const [dx, dy] = DIR[a.side], v = dx === 0;
  const w = v ? 16 : 11, h = v ? 11 : 16;
  el("rect", { x: a.x - w / 2 + dx * 3, y: a.y - h / 2 + dy * 3, width: w, height: h, rx: 2.5, class: "d-plug" }, g);
}

function drawInto(root, ui) {
  layout();
  const lw = COL, lh = 110, lx = colX(4), ly = 36;
  if (doc.meta.logo) {
    const g = el("g", ui ? { "data-logo": "1", class: "logo-slot", tabindex: 0, role: "button", "aria-label": "Company logo. Select to change or remove it." } : {}, root);
    el("image", { href: doc.meta.logo, x: lx, y: ly, width: lw, height: lh, preserveAspectRatio: "xMaxYMin meet", class: "d-logo" }, g);
    if (ui) el("rect", { x: lx, y: ly, width: lw, height: lh, class: "logo-hit" }, g);
  } else if (ui) {
    // A placeholder only on screen; exports leave the corner empty until a logo is added.
    const g = el("g", { "data-logo": "1", class: "logo-slot empty", tabindex: 0, role: "button", "aria-label": "Upload your company logo" }, root);
    el("rect", { x: lx, y: ly, width: lw, height: lh, rx: 8, class: "logo-ph" }, g);
    if (HOST) {
      text(g, lx + lw / 2, ly + 46, "logo-ph-t", "Your logo", "middle");
      text(g, lx + lw / 2, ly + 66, "logo-ph-s", "Add it on the", "middle");
      text(g, lx + lw / 2, ly + 82, "logo-ph-s", "Team Log cover", "middle");
    } else {
      text(g, lx + lw / 2, ly + 51, "logo-ph-t", "Upload logo", "middle");
      text(g, lx + lw / 2, ly + 71, "logo-ph-s", "PNG or JPG", "middle");
    }
  }
  const connected = new Set(doc.links.flatMap((l) => [l.a, l.b]).filter((e) => e.port).map((e) => e.device + "|" + e.port));
  const gd = el("g", {}, root), gl = el("g", {}, root);
  // The × buttons go on their own top layer, so a neighbouring port, tab or cable can never cover one.
  const ux = [];
  for (const d of doc.devices) {
    if (d.kind === "vm") continue;
    const { w, h } = boxSize(d);
    // The hypervisor holds its VMs, which are buttons of their own, so its keyboard target is its box alone:
    // a button inside a button can't be reached properly by screen readers.
    const nests = d.kind === "hypervisor";
    const a11y = ui ? { tabindex: 0, role: "button", "aria-label": `${d.name}, ${KINDS[d.kind]}` } : {};
    const g = el("g", { class: "dev k-" + d.kind + (ui && sel?.type === "dev" && sel.id === d.id ? " sel" : ""), "data-dev": d.id,
      transform: `translate(${d.x},${d.y})`, ...(nests ? {} : a11y) }, gd);
    el("rect", { width: w, height: h, rx: 10, class: "d-box" + (d.kind === "isp" ? " fixed" : "") }, nests && ui ? el("g", { class: "hvfocus", ...a11y }, g) : g);
    const lines = valueLines(d);
    if (d.kind === "switch") {
      const tx = w - SW_TEXT_W + 6;
      el("line", { x1: tx - 14, y1: 14, x2: tx - 14, y2: h - 14, class: "d-div" }, g);
      text(g, tx, 30, "d-name", d.name, "start");
      lines.forEach((s, i) => text(g, tx, 52 + i * 19, "d-val", s, "start"));
      for (const p of d.ports) {
        const r = portRect(d, p.name), [mode, vl] = portMode(p), on = connected.has(d.id + "|" + p.name);
        const pg = el("g", { class: "port" + (p.shutdown ? " off" : "") + (on ? " on" : ""), ...(ui ? { "data-port": p.name, "data-pdev": d.id } : {}) }, g);
        el("rect", { x: r.x - d.x, y: r.y - d.y, width: r.w, height: r.h, rx: 5, class: "d-port" }, pg);
        const pv = portVlans(p);
        if (pv.length) {
          pg.setAttribute("data-vl", pv.join(" "));
          const bw = (r.w - 8) / pv.length;
          pv.forEach((v, i) => el("rect", { x: r.x - d.x + 4 + i * bw, y: r.y - d.y + r.h - 2.5, width: bw - (pv.length > 1 ? 1 : 0), height: 5, rx: 1.5, fill: vcolor(v) }, pg));
        }
        if (ui && on) ux.push([r.x + r.w - 2, r.y + 2, d.id, p.name, `${d.name} ${p.name}`]);
        text(pg, r.cx - d.x, r.y - d.y + 19, "d-pname", p.name, "middle");
        if (mode) text(pg, r.cx - d.x, r.y - d.y + 33, "d-pmode", mode, "middle");
        if (vl) text(pg, r.cx - d.x, r.y - d.y + 46, "d-pvl" + (vl.length > 6 ? " sm" : ""), vl, "middle");
      }
      continue;
    }
    const alone = !lines.length && d.kind !== "hypervisor";
    const dv = devVlan(d);
    if (dv) {
      g.setAttribute("data-vl", dv);
      const pw = 16 + dv.length * 7.5;
      el("rect", { x: w - pw - 8, y: 8, width: pw, height: 17, rx: 8.5, fill: vcolor(dv) }, g);
      text(g, w - pw / 2 - 8, 20.5, "d-vpill", dv, "middle");
    }
    text(g, w / 2, alone ? h / 2 + 6 : 30, "d-name", d.name, "middle");
    lines.forEach((s, i) => text(g, w / 2, 53 + i * 19, "d-val", s, "middle"));
    if (d.kind === "hypervisor") {
      let y = 44 + lines.length * 19 + (lines.length ? 8 : 0) + 2;
      for (const v of vmsOf(d.id)) {
        const vg = el("g", { class: "vm" + (ui && sel?.type === "dev" && sel.id === v.id ? " sel" : ""), "data-vm": v.id,
          ...(ui ? { tabindex: 0, role: "button", "aria-label": `${v.name}, virtual machine` } : {}) }, g);
        el("rect", { x: 12, y, width: w - 24, height: VM_H, rx: 6, class: "d-vm" }, vg);
        const tv = vnum(v.vlanTag);
        if (tv) { vg.setAttribute("data-vl", tv); el("rect", { x: 13, y: y + 1, width: 5, height: VM_H - 2, rx: 2, fill: vcolor(tv) }, vg); }
        const det = [v.vlanTag ? "tag " + v.vlanTag : "", withPrefix(v.address, v.mask) || (v.dhcp ? "DHCP" : "")].filter(Boolean).join("  ");
        text(vg, 24, y + (det ? 17 : 26), "d-vmname", v.name, "start");
        if (v.hostname) text(vg, w - 22, y + (det ? 17 : 26), "d-vmhost", v.hostname, "end");
        if (det) text(vg, 24, y + 34, "d-val", det, "start");
        y += VM_H + 6;
      }
    }
    const single = !portsFor(d).length, tabs = single ? [nicOf(d)] : portsFor(d);
    for (const name of tabs) {
      const t = tabRect(d, name), on = single ? doc.links.some((l) => l.a.device === d.id || l.b.device === d.id) : connected.has(d.id + "|" + name);
      const tg = el("g", { class: "port" + (on ? " on" : ""), ...(ui ? { "data-port": name, "data-pdev": d.id } : {}) }, g);
      el("rect", { x: t.x - d.x, y: t.y - d.y, width: t.w, height: t.h, rx: 4, class: "d-tab" }, tg);
      text(tg, t.x - d.x + t.w / 2, t.y - d.y + 15, "d-tabname", name, "middle");
      if (ui && on) ux.push([t.x + t.w - 1, t.y + 1, d.id, single ? "" : name, `${d.name} ${name}`]);
    }
  }
  for (const l of doc.links) {
    const r = routes.get(l.id);
    if (!r) continue;
    const path = pathOf(r.pts), wifi = isWifi(l);
    const lv = wifi ? [] : linkVlans(l);
    const busy = ui && sel && (sel.type === "link" ? sel.id === l.id : [l.a.device, l.b.device].includes(sel.id) || [l.a.device, l.b.device].includes(dev(sel.id)?.host));
    const g = el("g", { class: "lk" + (ui && sel?.type === "link" && sel.id === l.id ? " sel" : "") + (ui && l.id === freshLink ? " fresh" : "") + (busy ? " busy" : ""),
      "data-link": l.id, ...(lv.length ? { "data-vl": lv.join(" ") } : {}) }, gl);
    if (!wifi) el("path", { d: path, class: "d-case" }, g);
    if (lv.length === 1) el("path", { d: path, class: "d-link", style: `stroke:${vcolor(lv[0])}` }, g);
    else if (lv.length > 1) {
      // A trunk: one dash per VLAN, repeating along the cable.
      const seg = 12, gap = seg * (lv.length - 1);
      lv.forEach((v, i) => el("path", { d: path, class: "d-link stripe", style: `stroke:${vcolor(v)};stroke-dasharray:${seg} ${gap};stroke-dashoffset:${-i * seg};stroke-linecap:butt` }, g));
    } else el("path", { d: path, class: "d-link" + (wifi ? " wifi" : "") }, g);
    if (ui) el("path", { d: path, class: "d-flow" }, g);
    r.ends.forEach((a) => plug(g, a, wifi));
    if (ui) el("path", { d: path, class: "hit" }, g);
  }
  if (ux.length) { const gu = el("g", { class: "unplugs" }, root); for (const a of ux) unplugBtn(gu, ...a); }
  drawLegend(root, ui);
}
function unplugBtn(g, cx, cy, devId, port, label) {
  const b = el("g", { class: "unplug", "data-unplug": devId + "|" + port, tabindex: 0, role: "button", "aria-label": "Remove the cable from " + label }, g);
  el("circle", { cx, cy, r: 7 }, b);
  el("path", { d: `M${cx - 2.6},${cy - 2.6}L${cx + 2.6},${cy + 2.6}M${cx + 2.6},${cy - 2.6}L${cx - 2.6},${cy + 2.6}` }, b);
}
function drawLegend(root, ui) {
  const vs = vlansInUse();
  if (!vs.length) return;
  // Under the logo, in the fifth column, below the one-line hint.
  const x = colX(4), y0 = 36 + 110 + 64, step = vs.length > 9 ? 17 : 21;
  const g = el("g", { class: "legend" }, root);
  text(g, x, y0, "d-legh", "VLANs", "start");
  vs.forEach((v, i) => {
    const y = y0 + 12 + i * step, svi = dev("sw").svis.find((s) => vnum(s.vlan) === v);
    const r = el("g", { class: "leg", "data-leg": v, ...(ui ? { tabindex: 0, role: "button", "aria-label": `VLAN ${v}. Hover to highlight it.` } : {}) }, g);
    el("rect", { x, y, width: 14, height: 14, rx: 3, fill: vcolor(v) }, r);
    text(r, x + 22, y + 11.5, "d-legt", "VLAN " + v + (svi && svi.address ? "   " + netOf(svi.address, svi.mask) : ""), "start");
  });
}
function renderSvg() {
  svg.replaceChildren();
  drawInto(svg, true);
  if (view === "table") renderTable();
  const gx = colX(4);
  const tips = hasContent() ? ["Solid: cable.  Dashed: Wi-Fi."]
    : ["Solid: cable.  Dashed: Wi-Fi.", "", "Drag from a labeled port to", "another device to add a cable.", "", "Select a device to enter", "its settings."];
  const g = el("g", {}, svg);
  tips.forEach((s, i) => text(g, gx, 36 + 110 + 30 + i * 22, "ghint", s));
}

// ------------------------------------------------------------------ canvas interaction
const toSvg = (e) => { const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; return p.matrixTransform(svg.getScreenCTM().inverse()); };
let drag = null;
function dropTarget(e) {
  const t = document.elementFromPoint(e.clientX, e.clientY);
  const p = t?.closest?.("[data-port]"), g = t?.closest?.("[data-dev]");
  if (!g) return null;
  const d = dev(g.dataset.dev);
  return { device: d.id, port: p && portsFor(d).length ? p.dataset.port : "" };
}
function logoClick() {
  if (HOST) { HOST.gotoCover?.(); return; }   // in the Report Builder the logo is added once, on the Team Log cover
  if (!doc.meta.logo) { $("logofile").click(); return; }
  ask("Company logo", [h("img", { src: doc.meta.logo, alt: "Your company logo", class: "logoprev" })],
    [["Cancel"], ["Remove logo", () => { delete doc.meta.logo; commit(); renderAll(); }, "danger"], ["Change logo", () => $("logofile").click(), "primary"]]);
}
svg.addEventListener("click", (e) => { if (e.target.closest("[data-logo]")) logoClick(); });
function unplug(key) {
  const [id, port] = key.split("|"), d = dev(id);
  const hit = (e) => e.device === id && (!port || !portsFor(d).length || e.port === port);
  const gone = doc.links.filter((l) => hit(l.a) || hit(l.b));
  if (!gone.length) return;
  doc.links = doc.links.filter((l) => !gone.includes(l));
  if (sel?.type === "link" && gone.some((l) => l.id === sel.id)) sel = null;
  commit(); renderSvg(); renderPanel();
  toast(gone.length > 1 ? "Cables removed. Use Undo to bring them back." : "Cable removed. Use Undo to bring it back.");
}
svg.addEventListener("click", (e) => { const u = e.target.closest("[data-unplug]"); if (u) unplug(u.dataset.unplug); });
svg.addEventListener("keydown", (e) => { const u = e.target.closest?.("[data-unplug]"); if (u && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); unplug(u.dataset.unplug); } });
function focusVlan(v) {
  svg.classList.toggle("vfocus", !!v);
  svg.querySelectorAll("[data-vl]").forEach((n) => n.classList.toggle("hl", !!v && n.dataset.vl.split(" ").includes(v)));
  svg.querySelectorAll("[data-leg]").forEach((n) => n.classList.toggle("hl", n.dataset.leg === v));
}
svg.addEventListener("pointerover", (e) => { const l = e.target.closest?.("[data-leg]"); if (l) focusVlan(l.dataset.leg); });
svg.addEventListener("pointerout", (e) => { const l = e.target.closest?.("[data-leg]"); if (l && !l.contains(e.relatedTarget)) focusVlan(null); });
svg.addEventListener("focusin", (e) => { const l = e.target.closest?.("[data-leg]"); if (l) focusVlan(l.dataset.leg); });
svg.addEventListener("focusout", (e) => { if (e.target.closest?.("[data-leg]")) focusVlan(null); });
svg.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && e.target.closest?.("[data-logo]")) { e.preventDefault(); logoClick(); } });
svg.addEventListener("pointerdown", (e) => {
  if (e.target.closest("[data-logo]") || e.target.closest("[data-unplug]")) { e.stopPropagation(); return; }
  const port = e.target.closest("[data-port]"), vmEl = e.target.closest("[data-vm]"), box = e.target.closest("[data-dev]");
  if (vmEl) { select({ type: "dev", id: vmEl.dataset.vm }); return; }
  // Cables start only at a port. A click on a port or a box selects the device.
  if (box && !port) { select({ type: "dev", id: box.dataset.dev }); return; }
  if (port) {
    const pd = dev(port.dataset.pdev);
    const from = { device: pd.id, port: portsFor(pd).length ? port.dataset.port : "" };
    const p = toSvg(e);
    drag = { from, sx: e.clientX, sy: e.clientY, line: el("line", { x1: p.x, y1: p.y, x2: p.x, y2: p.y, class: "temp", style: "display:none" }, svg) };
    svg.setPointerCapture(e.pointerId); e.preventDefault(); return;
  }
  const lk = e.target.closest("[data-link]");
  if (lk) { select({ type: "link", id: lk.dataset.link }); return; }
  if (sel) select(null);
});
svg.addEventListener("pointermove", (e) => {
  if (!drag) return;
  if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 6) return;
  const p = toSvg(e);
  drag.line.style.display = "";
  drag.line.setAttribute("x2", p.x); drag.line.setAttribute("y2", p.y);
  svg.querySelectorAll(".drop").forEach((n) => n.classList.remove("drop"));
  const t = document.elementFromPoint(e.clientX, e.clientY);
  const target = t?.closest?.("[data-port]") || t?.closest?.("[data-dev]");
  if (target && (target.dataset.dev || target.dataset.pdev) !== drag.from.device) target.classList.add("drop");
});
const endDrag = (e) => {
  if (!drag) return;
  const dr = drag; drag = null;
  dr.line.remove();
  if (e.type === "pointercancel") { renderSvg(); return; }
  if (Math.hypot(e.clientX - dr.sx, e.clientY - dr.sy) < 6) { select({ type: "dev", id: dr.from.device }); return; }
  const to = dropTarget(e);
  if (to && to.device !== dr.from.device) addLink(dr.from, to); else renderSvg();
};
svg.addEventListener("pointerup", endDrag);
svg.addEventListener("pointercancel", endDrag);
svg.addEventListener("keydown", (e) => {
  const g = e.target.closest?.("[data-vm]") || e.target.closest?.("[data-dev]");
  if (!g || (e.key !== "Enter" && e.key !== " ")) return;
  const id = g.dataset.vm || g.dataset.dev;
  e.preventDefault(); select({ type: "dev", id });
  const t = svg.querySelector(g.dataset.vm ? `[data-vm="${id}"]` : `[data-dev="${id}"]`);
  (t?.hasAttribute("tabindex") ? t : t?.querySelector(".hvfocus"))?.focus();
});
// A port, or a device with a single network port, holds one cable. A new cable replaces the old one.
function occupied(end, except) {
  const d = dev(end.device);
  if (!d) return [];
  const single = !portsFor(d).length;
  if (!single && !end.port) return [];
  return doc.links.filter((l) => l !== except && [l.a, l.b].some((x) => x.device === end.device && (single || x.port === end.port)));
}
let freshLink = null, freshT;
function addLink(a, b) {
  const auto = (e) => { const d = dev(e.device); if (portsFor(d).length && !e.port) { const free = portsFor(d).find((p) => !occupied({ device: d.id, port: p }).length); if (d.kind === "isp" && free) e.port = free; } };
  auto(a); auto(b);
  const gone = [...new Set([...occupied(a), ...occupied(b)])];
  doc.links = doc.links.filter((l) => !gone.includes(l));
  const l = { id: newId("l"), a: { ...a }, b: { ...b } };
  doc.links.push(l); freshLink = l.id; clearTimeout(freshT); freshT = setTimeout(() => { freshLink = null; }, 900);
  commit(); select({ type: "link", id: l.id });
  const needPort = (e) => portsFor(dev(e.device)).length && !e.port;
  toast(gone.length ? "The old cable was replaced. Use Undo to bring it back." : needPort(a) || needPort(b) ? "Cable added. Choose the port it plugs into." : "Cable recorded.");
}
function setPort(l, end, port) {
  end.port = port;
  const gone = occupied(end, l);
  if (gone.length) { doc.links = doc.links.filter((x) => !gone.includes(x)); toast("Replaced the old cable on " + port + ". Undo brings it back."); }
  commit(); renderSvg();
}

// ------------------------------------------------------------------ form helpers
const h = (tag, props = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else if (k === "class") n.className = v;
    else if (k === "value") n.value = v;
    else if (k in n && typeof v !== "string") n[k] = v;
    else n.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) n.append(c);
  return n;
};
// A text field bound to obj[key]. kind: 'ip' | 'cidr' | 'mask' | 'num' | 'list' | undefined
function inp(obj, key, { kind, ph, label } = {}) {
  const val = kind === "list" ? (obj[key] || []).join(", ") : (obj[key] ?? "");
  const hint = h("span", { class: "hint", hidden: true });
  const check = (s) => {
    let bad = "";
    if (s && kind === "ip" && !isIP(s) && !isCIDR(s)) bad = "Not an IPv4 address";
    if (s && kind === "cidr" && !isCIDR(s) && !isIP(s)) bad = "Use an address with a prefix, like a.b.c.d/nn";
    if (s && kind === "mask" && maskToPrefix(s) === null) bad = "Use a prefix like 24, or a dotted mask";
    if (s && kind === "num" && !/^\d+$/.test(s)) bad = "Use a number";
    if (s && kind === "list" && !/^\s*\d+(\s*,\s*\d+)*\s*$/.test(s)) bad = "Use numbers separated by commas";
    hint.hidden = !bad; hint.textContent = bad;
  };
  const i = h("input", { value: val, placeholder: ph || "", "aria-label": label || key,
    spellcheck: false, autocomplete: "off", inputmode: kind === "num" || kind === "list" ? "numeric" : kind ? "decimal" : undefined,
    oninput: (e) => { set(e.target.value, false); check(e.target.value.trim()); renderSvg(); },
    onchange: (e) => {
      let s = e.target.value.trim();
      if (kind === "ip" && s.includes("/") && "mask" in obj) { const [a, p] = s.split("/"); if (isIP(a) && maskToPrefix(p) !== null) { obj.mask = maskToPrefix(p); s = a; } }
      if (kind === "mask" && maskToPrefix(s) !== null) s = maskToPrefix(s);
      set(s, true); e.target.value = kind === "list" ? (obj[key] || []).join(", ") : obj[key];
      check(s); commit(); renderSvg(); if (kind === "ip" && "mask" in obj) rerenderForms();
    } });
  function set(s, final) {
    if (kind === "list") { const v = s.split(",").map((x) => x.trim()).filter(Boolean); obj[key] = final ? [...new Set(v)] : v; }
    else obj[key] = final ? s.trim() : s;
  }
  check(String(val));
  if (kind === "mask") return h("span", { style: "display:block" }, h("span", { class: "pfx" }, h("span", { class: "slash", "aria-hidden": "true" }, "/"), i), hint);
  return h("span", { style: "display:block" }, i, hint);
}
const field = (label, input) => h("label", { class: "f" }, h("span", {}, label), input);
function chk(obj, key, label) {
  return h("label", { class: "check" }, h("input", { type: "checkbox", checked: !!obj[key],
    onchange: (e) => { obj[key] = e.target.checked; commit(); renderSvg(); } }), label);
}
function multi(obj, key, options) {
  return h("div", { class: "checks" }, options.map((o) => h("label", { class: "check" }, h("input", { type: "checkbox",
    checked: (obj[key] || []).includes(o), onchange: (e) => {
      const s = new Set(obj[key] || []); e.target.checked ? s.add(o) : s.delete(o); obj[key] = options.filter((x) => s.has(x)); commit(); renderSvg();
    } }), o)));
}
function selectBox(obj, key, options, label, blank = "Not set", after) {
  return h("select", { "aria-label": label, onchange: (e) => { obj[key] = e.target.value; commit(); renderSvg(); after?.(); } },
    h("option", { value: "" }, blank), options.map((o) => h("option", { value: o, selected: obj[key] === o }, o)));
}
// Editable rows. cols: [{key, label, kind, ph, w}]
function rows(arr, cols, make, label) {
  const t = h("table", { class: "t" },
    h("thead", {}, h("tr", {}, cols.map((c) => h("th", { style: c.w ? `width:${c.w}` : "" }, c.label)), h("th", {}))),
    h("tbody", {}, arr.map((r, i) => h("tr", {},
      cols.map((c) => h("td", {}, c.render ? c.render(r) : inp(r, c.key, { kind: c.kind, ph: c.ph, label: `${label} ${i + 1} ${c.label}` }))),
      h("td", {}, h("button", { class: "rowx small", title: "Remove row", "aria-label": `Remove ${label} ${i + 1}`,
        onclick: () => { arr.splice(i, 1); commit(); renderSvg(); rerenderForms(); } }, "✕"))))));
  return [t, h("button", { class: "small", onclick: () => { arr.push(make()); commit(); rerenderForms(); } }, "Add " + label)];
}
const rerenderForms = () => renderPanel();
const sec = (s) => h("div", { class: "sec" }, s);
const addrRow = (o, label = "") => h("div", { class: "row2" },
  field("Address", inp(o, "address", { kind: "ip", ph: "a.b.c.d", label: (label + " address").trim() })),
  field("Mask", inp(o, "mask", { kind: "mask", ph: "nn", label: (label + " mask").trim() })));

// ------------------------------------------------------------------ editors
function editor(d) {
  const out = [];
  if (ENDPOINT.has(d.kind)) {
    out.push(field("Hostname", inp(d, "hostname", { ph: "hostname", label: "Hostname" })), addrRow(d), field("Gateway", inp(d, "gateway", { kind: "ip", ph: "a.b.c.d", label: "Gateway" })));
    if (d.kind === "vm") out.push(field("VLAN tag", inp(d, "vlanTag", { kind: "num", ph: "none", label: "VLAN tag" })));
    out.push(chk(d, "dhcp", "Gets its address by DHCP"));
    if (d.kind === "hypervisor") out.push(h("p", { class: "muted" }, "Select a virtual machine inside the hypervisor to enter its settings."));
  }
  if (d.kind === "isp") out.push(addrRow(d));
  if (d.kind === "switch" || d.kind === "firewall") out.push(field("Hostname", inp(d, "hostname", { ph: "hostname", label: "Hostname" })));
  if (d.kind === "switch") {
    out.push(sec("Out-of-band (OOB) port"), addrRow(d.oob, "OOB"));
    out.push(sec("VLAN interfaces (SVIs)"), ...rows(d.svis, [{ key: "vlan", label: "VLAN", kind: "num", w: "20%" }, { key: "address", label: "Address", kind: "ip", ph: "a.b.c.d" }, { key: "mask", label: "Mask", kind: "mask", w: "20%", ph: "nn" }], () => ({ vlan: "", address: "", mask: "" }), "VLAN interface"));
    out.push(sec("Static routes"), ...rows(d.routes, [{ key: "dest", label: "Destination", kind: "cidr", ph: "a.b.c.d/nn" }, { key: "nextHop", label: "Next hop", kind: "ip", ph: "a.b.c.d" }], () => ({ dest: "", nextHop: "" }), "route"));
    out.push(sec("Ports"));
    out.push(h("table", { class: "t ports" }, h("thead", {}, h("tr", {}, ["Port", "Mode", "Untagged", "Tagged", "Off"].map((c) => h("th", {}, c)))),
      h("tbody", {}, d.ports.map((p) => h("tr", {}, h("td", { class: "n" }, p.name),
        h("td", {}, selectBox(p, "mode", ["access", "trunk"], `${p.name} mode`, "—", rerenderForms)),
        h("td", {}, inp(p, "pvid", { kind: "num", ph: "VLAN", label: `${p.name} untagged VLAN` })),
        h("td", {}, p.mode === "trunk" ? inp(p, "tagged", { kind: "list", ph: "VLANs", label: `${p.name} tagged VLANs` }) : ""),
        h("td", {}, h("input", { type: "checkbox", "aria-label": `${p.name} shut down`, checked: p.shutdown,
          onchange: (e) => { p.shutdown = e.target.checked; commit(); renderSvg(); } })))))));
    out.push(sec("DHCP pools"), ...rows(d.dhcpPools, [{ key: "vlan", label: "VLAN", kind: "num", w: "16%" }, { key: "start", label: "Start", kind: "ip", ph: "a.b.c.d" }, { key: "end", label: "End", kind: "ip", ph: "a.b.c.d" }, { key: "router", label: "Router", kind: "ip", ph: "a.b.c.d" }], () => ({ vlan: "", start: "", end: "", router: "" }), "pool"));
  }
  if (d.kind === "firewall") {
    out.push(sec("Interfaces"));
    for (const i of d.interfaces) out.push(h("div", { class: "card-b" }, h("h3", {}, i.name), addrRow(i, i.name),
      i.name === "guest Wi-Fi" ? field("SSID", inp(i, "ssid", { ph: "Network name", label: "SSID" })) : null));
    out.push(sec("Static routes"), ...rows(d.routes, [{ key: "dest", label: "Destination", kind: "cidr", ph: "a.b.c.d/nn" }, { key: "gateway", label: "Gateway", kind: "ip", ph: "a.b.c.d" },
      { key: "interface", label: "Interface", w: "28%", render: (r) => selectBox(r, "interface", FW_IFS, "Route interface", "—") }], () => ({ dest: "", gateway: "", interface: "" }), "route"));
    out.push(sec("Virtual IPs (port forwards)"), ...rows(d.vips, [{ key: "name", label: "Name", ph: "Name" }, { key: "external", label: "External", kind: "ip", ph: "a.b.c.d" }, { key: "port", label: "Port", kind: "num", w: "16%" }, { key: "mapped", label: "Mapped to", kind: "ip", ph: "a.b.c.d" }], () => ({ name: "", external: "", port: "", mapped: "" }), "virtual IP"));
    out.push(sec("Policies"));
    d.policies.forEach((p, n) => {
      out.push(h("div", { class: "card-b" },
        h("h3", {}, h("span", {}, `Policy ${n + 1}`), h("button", { class: "small danger", onclick: () => { d.policies.splice(n, 1); commit(); renderSvg(); rerenderForms(); } }, "Remove")),
        field("Name", inp(p, "name", { ph: "Policy name", label: `Policy ${n + 1} name` })),
        h("div", { class: "row2" }, field("From", selectBox(p, "from", FW_IFS, "From interface", "—")), field("To", selectBox(p, "to", FW_IFS, "To interface", "—"))),
        h("div", { class: "row2" }, field("Source", inp(p, "source", { kind: "cidr", ph: "any", label: "Source" })), field("Destination", inp(p, "dest", { kind: "cidr", ph: "any", label: "Destination" }))),
        h("span", { class: "f" }, h("span", {}, "Services")), multi(p, "services", SERVICES),
        h("div", { class: "checks" }, chk(p, "nat", "NAT"), chk(p, "log", "Logging"))));
    });
    out.push(h("button", { class: "small", onclick: () => { d.policies.push({ name: "", from: "", to: "", source: "", dest: "", services: [], nat: false, log: false }); commit(); rerenderForms(); } }, "Add policy"));
  }
  return out;
}
function portSelect(l, end) {
  const D = dev(end.device), ports = portsFor(D);
  if (!ports.length) return h("span", { class: "muted" }, "Its network port");
  return h("select", { "aria-label": D.name + " port", onchange: (ev) => { setPort(l, end, ev.target.value); rerenderForms(); } },
    h("option", { value: "" }, "Choose…"), ports.map((p) => h("option", { value: p, selected: end.port === p }, p)));
}
function linkEditor(l) {
  const A = dev(l.a.device), B = dev(l.b.device);
  return [field(A.name, portSelect(l, l.a)), field(B.name, portSelect(l, l.b)),
    h("p", { class: "muted" }, "Enter switch port settings on the switch itself. If you choose a port that already has a cable, the new cable will replace it.")];
}
function help() {
  ask("How to use the Network Diagram", [
    h("p", {}, "Use this diagram to record the network your team has built on the rack. Each Cyber Hub page ends with an “Update your network diagram” box that tells you what to add from that lab."),
    sec("Record a cable"),
    h("p", {}, "Drag from a labeled port, such as a switch port or a firewall interface, and drop it on the device at the other end. If you drop it on a specific port, that port is recorded too. If a port already has a cable, the new one replaces it, and you can use Undo to bring the old one back."),
    sec("Enter settings"),
    h("p", {}, "Select a device, or a virtual machine inside the hypervisor, to enter its settings. The Addressing table tab lists every interface and cable you've entered next to the addressing plan for your rack."),
    sec("See your VLANs"),
    h("p", {}, "Each VLAN gets its own color the first time you use it. Ports, cables, VMs and devices are colored by their VLAN, and trunk cables are striped with every VLAN they carry. Hover over a VLAN in the legend to highlight everything on it."),
    sec("Remove a cable"),
    h("p", {}, "Select the small × on a port that has a cable, or select the cable and choose Delete cable. You can use Undo to bring it back."),
    sec("Your logo"),
    h("p", {}, HOST ? "You can add or change your logo on the Team Log cover." : "Select Upload logo in the top corner of the diagram and choose a PNG or JPG. Select your logo again to change or remove it."),
    sec("Save and share"),
    h("p", {}, "Your diagram saves with the rest of your team file and is included in every Cyber Hub export. If your instructor asks for a link, use Copy share link to make a view-only copy."),
    sec("The addressing plan"),
    h("p", {}, "The Planned column in the Addressing table shows the addressing plan for your rack. Anything you enter that doesn't match the plan is marked in amber. Your diagram and exports only show what you entered."),
    h("p", { class: "muted" }, "Matching the plan doesn't mean it works. Always test on the rack."),
  ], [["Close"]]);
}

function renderPanel() {
  const top = panel.scrollTop;
  const s = findSel();
  const kids = [];
  // The editor only takes room while something is selected; the drawing has the full width otherwise.
  const open = !!s;
  if (panel.hidden === open) { panel.hidden = !open; document.body.classList.toggle("panel-open", open); }
  if (!s) { panel.replaceChildren(); return; }
  kids.push(h("button", { class: "pclose", "aria-label": "Close the editor (Esc)", title: "Close (Esc)", onclick: () => select(null) }, "×"));
  if (sel.type === "dev") {
    kids.push(h("h2", {}, s.name), h("p", { class: "kind" }, s.kind === "vm" ? "Virtual machine on the hypervisor" : KINDS[s.kind]));
    kids.push(...editor(s));
  } else {
    kids.push(h("h2", {}, "Cable"), h("p", { class: "kind" }, `${dev(s.a.device)?.name} to ${dev(s.b.device)?.name}`));
    kids.push(...linkEditor(s));
    kids.push(h("div", { class: "foot" }, h("button", { class: "danger", onclick: () => { doc.links = doc.links.filter((x) => x !== s); commit(); select(null); } }, "Delete cable")));
  }
  panel.replaceChildren(...kids);
  panel.scrollTop = top;
}

// ------------------------------------------------------------------ addressing table
// A read-only listing of what the team entered, laid out like a professional addressing table.
function prefixToMask(p) {
  const n = +p;
  if (!/^\d{1,2}$/.test(String(p)) || n > 32) return "";
  const bits = "1".repeat(n).padEnd(32, "0");
  return [0, 8, 16, 24].map((i) => parseInt(bits.slice(i, i + 8), 2)).join(".");
}
// The addressing plan, as Reference: Rack Schema and VLAN Plan shows it. R is the rack number.
// [address, prefix, gateway] for a fixed address, or { dhcp: "range" } for a DHCP client.
const PLAN = {
  "isp|Uplink": ["10.R.200.1", 24], "fw|wan1": ["10.R.200.2", 24], "fw|internal": ["10.R.100.1", 24],
  "fw|dmz": ["10.R.40.1", 24], "fw|guest Wi-Fi": ["10.R.50.1", 24], "sw|OOB": ["192.168.1.254", 24],
  "sw|VLAN 10": ["10.R.10.254", 24], "sw|VLAN 20": ["10.R.20.254", 24], "sw|VLAN 30": ["10.R.30.254", 24],
  "sw|VLAN 100": ["10.R.100.254", 24],
  hv: ["10.R.10.10", 24, "10.R.10.254"], vmweb: ["10.R.40.10", 24, "10.R.40.1"], vmftp: ["10.R.40.11", 24, "10.R.40.1"],
  vmscan: ["10.R.10.20", 24, "10.R.10.254"], nas: ["10.R.30.10", 24, "10.R.30.254"], admin: ["10.R.10.5", 24, "10.R.10.254"],
  pi: { dhcp: "10.R.20.100 to .199" }, lap: { dhcp: "10.R.20.100 to .199" },
  isplap: { dhcp: "198.51.100.0/24" }, guest: { dhcp: "10.R.50.0/24" },
};
const PLAN_SVIS = ["10", "20", "30", "100"];
const rackNo = () => { try { const r = String(HOST?.rack?.() || ""); return /^[1-8]$/.test(r) ? r : ""; } catch { return ""; } };
const fillR = (v, r) => String(v).replace(/\bR\b/g, r || "R");
function planFor(key, r) {
  const p = PLAN[key];
  if (!p) return null;
  if (p.dhcp) return { dhcp: true, text: "DHCP, " + fillR(p.dhcp, r) };
  return { ip: fillR(p[0], r), prefix: String(p[1]), gw: p[2] ? fillR(p[2], r) : "", text: fillR(p[0], r) + "/" + p[1] };
}
// Which cells differ from the plan. Only entries the team has made are compared.
function planDiffs(row, plan) {
  const out = {};
  if (!plan || !rackNo()) return out;
  const o = row.o || {};
  if (plan.dhcp) { if (o.address && !o.dhcp) out.ip = plan.text; return out; }
  if (o.dhcp && !o.address) out.ip = plan.text;
  if (o.address && o.address.trim() !== plan.ip) out.ip = plan.text;
  if (o.address && o.mask && String(o.mask).replace("/", "").trim() !== plan.prefix) out.mask = "/" + plan.prefix + " (" + prefixToMask(plan.prefix) + ")";
  if (row.gw && plan.gw && row.gw.trim() !== plan.gw) out.gw = plan.gw;
  return out;
}
function addressRows() {
  const R = [], r = rackNo();
  const ip = (o) => o.address || (o.dhcp ? "DHCP" : "");
  const mask = (o) => (o.address && o.mask ? prefixToMask(o.mask) : "");
  const add = (d, iface, vlan, o, gw, key) => {
    const row = { d, o, host: d.hostname || "", iface, vlan: vlan || "", ip: ip(o), mask: mask(o), gw: gw || "", plan: planFor(key, r) };
    row.diff = planDiffs(row, row.plan);
    R.push(row);
  };
  const isp = dev("isp"), fw = dev("fw"), sw = dev("sw");
  add(isp, "Uplink", "", isp, "", "isp|Uplink");
  for (const i of fw.interfaces) add(fw, i.name, "", i, "", "fw|" + i.name);
  add(sw, "OOB", "", sw.oob, "", "sw|OOB");
  // Every planned VLAN interface gets a row, entered or not, plus any the team added that the plan doesn't have.
  const vl = [...new Set([...PLAN_SVIS, ...sw.svis.map((v) => String(v.vlan || "?"))])].sort((a, b) => (+a || 0) - (+b || 0));
  for (const v of vl) {
    const e = sw.svis.find((x) => String(x.vlan || "?") === v);
    add(sw, "VLAN " + v, v, e || {}, "", "sw|VLAN " + v);
    const row = R[R.length - 1];
    if (!row.plan) { row.plan = { none: true, text: "Not in the plan" }; if (rackNo() && e && e.address) row.diff.ip = "No VLAN interface"; }
  }
  for (const id of ["hv", "vmweb", "vmftp", "vmscan", "nas", "admin", "pi", "lap", "isplap", "guest"]) {
    const d = dev(id);
    add(d, d.kind === "vm" ? "net0" : nicOf(d), d.kind === "vm" ? d.vlanTag : "", d, d.gateway, id);
  }
  return R;
}
function connectionRows() {
  const sw = dev("sw"), order = (l) => {
    const s = l.a.device === "sw" ? l.a : l.b.device === "sw" ? l.b : null;
    return s ? SW_PORTS.indexOf(s.port) : 100 + doc.devices.findIndex((d) => d.id === l.a.device);
  };
  return [...doc.links].sort((x, y) => order(x) - order(y)).map((l) => {
    let [a, b] = [l.a, l.b];
    if (b.device === "sw" || (a.device !== "sw" && b.device === "fw")) [a, b] = [b, a];
    const A = dev(a.device), B = dev(b.device);
    const p = A.kind === "switch" ? A.ports.find((q) => q.name === a.port) : null;
    const name = (D, e) => portsFor(D).length ? (e.port || "") : nicOf(D);
    return { A, B, pa: name(A, a), pb: name(B, b), mode: p ? (p.shutdown ? "shut down" : p.mode) : "",
      vlans: p && !p.shutdown ? (p.mode === "trunk" ? [p.pvid && p.pvid + " untagged", p.tagged.length && p.tagged.join(", ") + " tagged"].filter(Boolean).join("; ") : p.pvid) : "" };
  });
}
const dash = (v) => (v ? v : h("span", { class: "blank" }, "—"));
function tableEl(caption, cols, rowsData, cells, idOf, cls = "") {
  return h("table", { class: "topo " + cls }, h("caption", {}, caption),
    h("thead", {}, h("tr", {}, cols.map((c) => h("th", { scope: "col" }, c)))),
    h("tbody", {}, rowsData.map((r, i) => {
      const prev = rowsData[i - 1], first = !prev || idOf(prev) !== idOf(r);
      return h("tr", { class: first ? "grp" : "", onclick: () => select({ type: "dev", id: (r.d || r.A).id }) }, cells(r, first).map((c, j) => h(j === 0 ? "th" : "td", j === 0 ? { scope: "row" } : {}, c)));
    })));
}
async function copyTable(t) {
  const html = '<table border="1" cellpadding="4" style="border-collapse:collapse;font-family:Arial;font-size:10pt">' + t.innerHTML.replace(/<caption>.*?<\/caption>/, "") + "</table>";
  const plain = [...t.querySelectorAll("tr")].map((r) => [...r.children].map((c) => c.textContent.trim()).join("\t")).join("\n");
  try {
    await navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([html], { type: "text/html" }), "text/plain": new Blob([plain], { type: "text/plain" }) })]);
  } catch {
    const r = document.createRange(); r.selectNode(t); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    document.execCommand("copy"); s.removeAllRanges();
  }
  toast("Table copied.");
}
function renderTable() {
  const top = tableView.scrollTop;
  const A = addressRows(), C = connectionRows();
  const rk = rackNo();
  const planCell = (r) => {
    if (!r.plan) return dash("");
    const t = h("span", { class: "plan" + (rk ? "" : " pattern") + (r.plan.none ? " none" : "") }, r.plan.text);
    return r.plan.gw ? [t, h("span", { class: "plan-gw" }, "gateway " + r.plan.gw)] : t;
  };
  const flagged = (v, d) => d ? h("span", { class: "differs", title: "The plan says " + d }, v || "—", h("span", { class: "sr" }, ". Differs from the plan, which says " + d)) : dash(v);
  const at = tableEl("Addressing table", ["Device", "Hostname", "Interface", "VLAN", "Planned", "IP address", "Subnet mask", "Default gateway"], A,
    (r, first) => [first ? r.d.name : "", first && r.d.kind !== "isp" ? dash(r.host) : "", r.iface, dash(r.vlan), planCell(r),
      flagged(r.ip, r.diff.ip), flagged(r.mask, r.diff.mask), flagged(r.gw, r.diff.gw)], (r) => r.d.id, "addr");
  const nd = A.reduce((n, r) => n + Object.keys(r.diff).length, 0);
  const planNote = !HOST ? null
    : !rk ? h("p", { class: "plannote" }, "Add your rack number on the Team Log cover to see the plan for your rack.")
    : nd ? h("p", { class: "plannote warn" }, `${nd} ${nd === 1 ? "entry differs" : "entries differ"} from the plan and marked in amber. Either the rack or your diagram is wrong, so check the device and fix whichever one is off.`)
    : h("p", { class: "plannote" }, "Everything you've entered matches the plan. That doesn't mean it works, so test it on the rack.");
  const ct = C.length ? tableEl("Connections", ["Device", "Port", "Connects to", "Port", "Mode", "VLANs"], C,
    (r, first) => [r.A.name, dash(r.pa), r.B.name, dash(r.pb), dash(r.mode), dash(r.vlans)], (r) => r.A.id + r.pa, "conn")
    : h("p", { class: "muted" }, "No cables recorded yet.");
  const head = (title, note, t) => h("div", { class: "thead" }, h("div", {}, h("h2", {}, title), h("p", { class: "muted" }, note)),
    t.tagName === "TABLE" ? h("button", { class: "small", onclick: () => copyTable(t) }, "Copy table") : null);
  tableView.replaceChildren(
    head("Addressing table", "Every interface you've entered, next to the plan for your rack. Select a row to edit that device.", at), planNote, at,
    head("Connections", "Every cable you've recorded, with each switch port's mode and VLANs.", ct), ct);
  tableView.scrollTop = top;
}
let view = "canvas";
function setView(v) {
  view = v;
  $("t-canvas").setAttribute("aria-selected", v === "canvas"); $("t-table").setAttribute("aria-selected", v === "table");
  $("v-canvas").hidden = v !== "canvas"; tableView.hidden = v !== "table";
  renderSvg(); renderPanel();
}
let introDone = false;
function renderAll() {
  if (!introDone) { introDone = true; svg.classList.add("intro"); setTimeout(() => svg.classList.remove("intro"), 1200); } $("company").value = doc.meta.company || ""; renderSvg(); renderPanel(); }

// ------------------------------------------------------------------ logo
// Shrunk to a small image so the share link stays short enough to paste.
async function readLogo(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    for (const [mw, mh, type, q] of [[300, 160, "image/webp", 0.85], [300, 160, "image/png"], [220, 120, "image/webp", 0.7], [220, 120, "image/jpeg", 0.8], [160, 86, "image/jpeg", 0.7]]) {
      const k = Math.min(1, mw / img.naturalWidth, mh / img.naturalHeight);
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
      const ctx = c.getContext("2d");
      if (type === "image/jpeg") { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); }
      ctx.drawImage(img, 0, 0, c.width, c.height);
      const d = c.toDataURL(type, q);
      if (d.startsWith("data:" + type) && d.length <= LOGO_MAX / 2) return d;
    }
    return null;
  } finally { URL.revokeObjectURL(url); }
}

// ------------------------------------------------------------------ share links
const b64u = (bytes) => { let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
const unb64u = (s) => { const b = atob(s.replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(b, (c) => c.charCodeAt(0)); };
async function pipe(bytes, Stream, fmt) { return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new Stream(fmt))).arrayBuffer()); }
// Positions are fixed, so they are not stored.
const portable = (o) => ({ ...o, devices: o.devices.map(({ x, y, ...rest }) => rest) });
async function encode(o) {
  const bytes = new TextEncoder().encode(JSON.stringify(portable(o)));
  if (typeof CompressionStream === "function") { try { return "z." + b64u(await pipe(bytes, CompressionStream, "deflate-raw")); } catch {} }
  return "j." + b64u(bytes);
}
async function decode(s) {
  const [k, data] = [s.slice(0, 2), s.slice(2)];
  let bytes = unb64u(data);
  if (k === "z.") bytes = await pipe(bytes, DecompressionStream, "deflate-raw");
  else if (k !== "j.") throw new Error("unknown link");
  return JSON.parse(new TextDecoder().decode(bytes));
}
async function shareURL() { return location.origin + location.pathname.replace(/[^/]*$/, "diagram.html") + "#d=" + await encode(doc); }
async function share() {
  const url = await shareURL();
  sharedJSON = snapshot(); updateButtons();
  try { await navigator.clipboard.writeText(url); toast("Share link copied. Anyone with this link can view this version of your diagram."); }
  catch {
    ask("Copy your share link", [h("p", {}, "Select the link and copy it."), h("textarea", { readonly: true, value: url, onfocus: (e) => e.target.select() })], [["Done"]]);
    setTimeout(() => $("m-body").querySelector("textarea")?.select(), 0);
  }
}

// ------------------------------------------------------------------ export
async function renderPng() {
  layout();
  const pad = 20, W = VB.w + pad * 2, HD = 70, H = VB.h + HD + pad;
  const out = document.createElementNS(NS, "svg");
  out.setAttribute("xmlns", NS); out.setAttribute("width", W); out.setAttribute("height", H); out.setAttribute("viewBox", `0 0 ${W} ${H}`);
  const css = [...document.styleSheets].flatMap((s) => { try { return [...s.cssRules]; } catch { return []; } })
    .map((r) => r.cssText).filter((t) => /^\.(d-|port\.)/.test(t)).join("\n").replace(/var\(--navy\)/g, "#003366");
  el("style", {}, out).textContent = css;
  el("rect", { width: W, height: H, fill: "#ffffff" }, out);
  text(out, 30, 34, "d-title", (doc.meta.company || "Company") + " network diagram");
  text(out, 30, 54, "d-sub", "Updated " + new Date(doc.meta.updated || Date.now()).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }));
  const g = el("g", { transform: `translate(${pad},${HD})` }, out);
  drawInto(g, false);
  const src = new XMLSerializer().serializeToString(out);
  const img = new Image();
  const url = URL.createObjectURL(new Blob([src], { type: "image/svg+xml" }));
  try {
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    const c = document.createElement("canvas"); c.width = W * 2; c.height = H * 2;
    const ctx = c.getContext("2d"); ctx.scale(2, 2); ctx.drawImage(img, 0, 0);
    return c;
  } finally { URL.revokeObjectURL(url); }
}
async function exportPng() {
  try {
    const c = await renderPng(); const blob = await new Promise((r) => c.toBlob(r, "image/png"));
    download(blob, fileBase() + ".png"); toast("PNG downloaded.");
  } catch { toast("This browser couldn't create the PNG. Try Print, then Save as PDF instead."); }
}
// Used by the Report Builder: the diagram as an image for the PDFs and the SSP, the share link, and a reload.
window.rbPNG = async () => { const c = await renderPng(); return c.toDataURL("image/png"); };
window.rbShareURL = shareURL;
window.rbDoc = () => JSON.parse(JSON.stringify(doc));
window.rbHasContent = () => hasContent(doc);
function hostLoad() { doc = normalize(HOST.load() || blankDoc()); sel = null; assignVlanColors(); hist = [snapshot()]; hi = 0; renderAll(); updateButtons(); }
window.rbReload = () => { if (HOST) hostLoad(); };
const fileBase = () => ((doc.meta.company || "network").replace(/[^\w-]+/g, "-").replace(/^-|-$/g, "") || "network") + "-diagram-" + new Date().toISOString().slice(0, 10);
function download(blob, name) { const a = h("a", { href: URL.createObjectURL(blob), download: name }); document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }

// ------------------------------------------------------------------ small UI
let toastT;
function toast(s) { const t = $("toast"); t.textContent = s; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 3800); }
function ask(title, body, buttons) {
  const m = $("modal"), prev = document.activeElement;
  $("m-title").textContent = title; $("m-body").replaceChildren(...body);
  const close = () => { m.hidden = true; prev?.focus?.(); };
  $("m-acts").replaceChildren(...buttons.map(([label, fn, cls]) => h("button", { class: cls || (fn ? "primary" : ""), onclick: () => { close(); fn?.(); } }, label)));
  m.hidden = false; $("m-acts").lastChild?.focus({ preventScroll: true }); m.querySelector(".card").scrollTop = 0;
  m.onkeydown = (e) => { if (e.key === "Escape") close(); };
  m.onclick = (e) => { if (e.target === m) close(); };
}
function load(o, why) {
  doc = normalize(o); sel = null; hist = []; hi = -1; commit(); renderAll(); if (why) toast(why);
}

// ------------------------------------------------------------------ wiring
$("t-canvas").onclick = () => setView("canvas");
$("t-table").onclick = () => setView("table");
$("b-undo").onclick = undo; $("b-redo").onclick = redo;
$("b-help").onclick = help;
$("b-share").onclick = share; $("b-png").onclick = exportPng;
$("logofile").addEventListener("change", async (e) => {
  const f = e.target.files[0]; e.target.value = "";
  if (!f) return;
  let d = null;
  try { d = await readLogo(f); } catch {}
  if (!d) { toast("That file couldn't be used as a logo. Try a PNG or JPG image."); return; }
  doc.meta.logo = d; commit(); renderAll(); toast("Your logo has been added.");
});
const more = $("more");
$("b-more").onclick = (e) => { e.stopPropagation(); more.hidden = !more.hidden; $("b-more").setAttribute("aria-expanded", !more.hidden); };
document.addEventListener("click", () => { more.hidden = true; $("b-more").setAttribute("aria-expanded", false); });
$("b-json").onclick = () => download(new Blob([JSON.stringify(portable(doc), null, 1)], { type: "application/json" }), fileBase() + ".json");
$("b-open").onclick = () => $("file").click();
$("file").onchange = async (e) => {
  const f = e.target.files[0]; e.target.value = "";
  if (!f) return;
  try { const o = JSON.parse(await f.text()); normalize(o); ask("Open " + f.name + "?", [h("p", {}, "This will replace the diagram on screen. If you want to keep it, copy its share link first.")], [["Cancel"], ["Open", () => load(o, "Opened " + f.name)]]); }
  catch { toast("That file isn't a diagram backup."); }
};
$("b-print").onclick = () => { setView("canvas"); setTimeout(() => print(), 50); };
$("b-reset").onclick = () => ask("Reset the diagram?", [h("p", {}, "This will clear every cable and setting."), h("p", { class: "muted" }, "You can undo this, and earlier versions are kept in History.")],
  [["Cancel"], ["Reset", () => { const co = doc.meta.company, lg = doc.meta.logo; doc = blankDoc(); doc.meta.company = co; if (lg) doc.meta.logo = lg; sel = null; sharedJSON = null; commit(); renderAll(); }, "danger"]]);
$("company").addEventListener("input", (e) => { doc.meta.company = e.target.value; });
$("company").addEventListener("change", commit);
document.addEventListener("keydown", (e) => {
  if (e.target.closest?.("input,textarea,select")) return;
  const k = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && k === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); }
  if ((e.ctrlKey || e.metaKey) && k === "y") { e.preventDefault(); redo(); }
  if (e.key === "Escape" && sel) select(null);
});
window.addEventListener("hashchange", () => start());

async function start() {
  if (HOST) { hostLoad(); $("saved").textContent = "Saves with your team file."; return; }
  if (!location.hash.startsWith("#d=") && window.parent === window) { location.replace("./#diagram"); return; }
  let local = null;
  try { const s = localStorage.getItem(KEY); if (s) local = normalize(JSON.parse(s)); } catch {}
  const m = location.hash.match(/^#d=(.+)$/);
  if (m) {
    let linked;
    try { linked = normalize(await decode(m[1])); } catch { history.replaceState(null, "", location.pathname + location.search); toast("That share link is incomplete or damaged."); }
    if (linked) {
      history.replaceState(null, "", location.pathname + location.search);
      sharedJSON = JSON.stringify(linked);
      const differs = local && contentOf(JSON.stringify(local)) !== contentOf(JSON.stringify(linked));
      if (differs && hasContent(local)) {
        doc = local; renderAll(); commit();
        ask("Which diagram do you want?", [h("p", {}, "This browser already holds a different diagram" + (local.meta.company ? ` (${local.meta.company})` : "") + "."),
          h("p", {}, "Opening the link will replace it. If you want to keep the one in this browser, cancel and copy its share link first.")],
          [["Keep this browser's diagram", () => { sharedJSON = null; updateButtons(); }], ["Open the link", () => { load(linked, "Opened the shared diagram."); sharedJSON = snapshot(); updateButtons(); }]]);
        return;
      }
      load(linked, "Opened the shared diagram."); sharedJSON = snapshot(); updateButtons();
      return;
    }
  }
  doc = local || blankDoc(); sel = null; hist = []; hi = -1; commit(); renderAll();
}
start();
})();
