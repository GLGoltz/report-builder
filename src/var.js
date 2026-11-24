// ------------------------------------------------------------------ VAR (Cyber Hub 12)
const V = () => doc.var;
const realFindings = () => V().findings.filter((f) => f.status !== "false-positive");
const scoreOf = (f) => cvss(f.v);
function tally(list = realFindings()) {
  const n = { crit: 0, high: 0, med: 0, low: 0, none: 0 };
  for (const f of list) n[sevOf(scoreOf(f))[1]]++;
  return n;
}
function sevBadge(s, cls = "") { const [n, c] = sevOf(s); return h("span", { class: "sev " + cls, style: `background:var(--${c})` }, h("b", {}, s.toFixed(1)), h("small", {}, n)); }
const statusName = (k) => (VALIDATION.find(([x]) => x === k) || [, k])[1];
const viewName = (k) => (VIEWS.find(([x]) => x === k) || [, ""])[1];
function fid(f) { return "F-" + String(sortedFindings().indexOf(f) + 1).padStart(2, "0"); }
function sortedFindings() { return [...V().findings].sort((a, b) => (a.status === "false-positive") - (b.status === "false-positive") || scoreOf(b) - scoreOf(a)); }

const VAR_STEPS = [
  ["cover", "Cover", "Companies, dates, team"],
  ["scope", "Scope and rules", "Targets and limits"],
  ["method", "Method", "Tools and settings"],
  ["hosts", "Hosts found", "Nmap results"],
  ["triage", "Triage", "Scanner results"],
  ["findings", "Findings", "Weaknesses"],
  ["recs", "Fix priority", "Remediation order"],
  ["summary", "Summary", "Executive audience"],
  ["review", "Review and export", "Check and submit"],
];
function varStatus(k) {
  const v = V(), c = v.cover;
  switch (k) {
    case "cover": return c.client && doc.meta.company && c.team ? "done" : (c.client || c.team) ? "part" : "";
    case "scope": return v.scope.every((r) => r.range) && v.roe.agreedOn ? "done" : v.scope.some((r) => r.range) ? "part" : "";
    case "method": return v.method.every((r) => r.tool) ? "done" : v.method.some((r) => r.tool) ? "part" : "";
    case "hosts": return v.hosts.length && v.compare.trim() ? "done" : v.hosts.length ? "part" : "";
    case "triage": { const t = v.triage; return !t.length ? "" : t.every((x) => x.state !== "new") ? "done" : "part"; }
    case "findings": return v.findings.length && v.findings.every(findingProblems.length0) ? "done" : v.findings.length ? "part" : "";
    case "recs": return v.recs.length && realFindings().every((f) => v.recs.some((r) => r.findings.includes(f.id))) ? "done" : v.recs.length ? "part" : "";
    case "summary": return v.summary.trim() ? "done" : "";
    default: return "";
  }
}
function findingProblems(f) {
  const p = [];
  if (!f.title.trim()) p.push("a title");
  if (!f.hosts.length) p.push("affected hosts");
  if (f.status !== "false-positive") { if (!f.what.trim()) p.push("what it is"); if (!f.fix.trim()) p.push("a recommended fix"); if (scoreOf(f) === 0) p.push("a CVSS score"); }
  if (!f.evidence.trim() && !f.images.length) p.push("evidence");
  if (f.status === "confirmed" && !f.confirm.trim()) p.push("how you confirmed it");
  return p;
}
findingProblems.length0 = (f) => findingProblems(f).length === 0;

function railVar() { return [h("h3", {}, "VAR · Cyber Hub 12"), ...VAR_STEPS.map(([k, t, s], i) => stepBtn("var", k, t + (k === "findings" ? ` (${V().findings.length})` : k === "triage" && V().triage.some((x) => x.state === "new") ? ` (${V().triage.filter((x) => x.state === "new").length})` : ""), s, varStatus(k), String(i + 1)))]; }

function viewVar() {
  const k = state.var;
  return ({ cover: varCover, scope: varScope, method: varMethod, hosts: varHosts, triage: varTriage, findings: varFindings, recs: varRecs, summary: varSummary, review: varReview }[k] || varCover)();
}

function varCover() {
  const c = V().cover;
  return [h("h2", {}, "Cover"), h("p", { class: "sub" }, "You write this report as a consultancy for a client. Your company name and logo come from your Team Log cover."),
    h("div", { class: "card grid2" },
      h("div", { class: "field" }, h("label", {}, "Prepared by (your company)"), h("div", {}, doc.meta.company || h("span", { class: "hintline" }, "Set it on the Team Log cover."))),
      h("div", { class: "field" }, h("label", {}, "Logo"), doc.meta.logo ? h("img", { src: doc.meta.logo, alt: "", style: "max-height:40px" }) : h("span", { class: "hintline" }, "Upload it on the Team Log cover.")),
      field("Client company", c, "client", { req: true }), field("Client's rack", c, "clientRack", { placeholder: "1 to 8", hint: "The scope's addresses fill in from this.", oninput: () => { fillScope(); commit(); } }),
      field("Assessment dates", c, "dates", { placeholder: "Nov 16 to Nov 20, 2026" }), field("Report version", c, "version", { hint: "1.0 for the copy you give the client." }),
      field("Assessment team", c, "team", { wide: true, area: true, req: true, placeholder: "Name, role" }),
      field("Client contact", c, "contact", { wide: true, placeholder: "Name", hint: "The client team member who agreed to the rules of engagement." }))];
}
// The standard scope fills in from the client's rack: the same three targets every assessment covers.
// A range the team typed themselves is left alone; only empty or earlier auto-filled ranges change.
const SCOPE_AUTO = { "Data subnet": "10.R.20.0/24", "DMZ subnet": "10.R.40.0/24", "Firewall WAN address": "10.R.200.2" };
function fillScope() {
  const v = V(), r = String(v.cover.clientRack || "").trim();
  if (!/^[1-8]$/.test(r)) return;
  for (const row of v.scope) {
    const pat = SCOPE_AUTO[row.target];
    if (!pat) continue;
    const re = new RegExp("^" + pat.replace(/\./g, "\\.").replace("R", "[1-8]") + "$");
    if (!row.range.trim() || re.test(row.range.trim())) row.range = pat.replace("R", r);
  }
}
function varScope() {
  const v = V();
  fillScope();
  return [h("h2", {}, "Scope and rules of engagement"), h("p", { class: "sub" }, "Exactly what you were allowed to test. The three standard targets fill in from the client's rack on the cover. Check them against the rules of engagement you agreed, and add anything else you agreed to test."),
    h("h3", {}, "In scope"),
    rowsTable(v.scope, [["target", "Target"], ["range", "Address or range", { cls: "mono", placeholder: "10.R.20.0/24" }], ["notes", "Notes"]], { addLabel: "Add target" }),
    h("h3", {}, "Out of scope"), field("", v, "outScope", { area: true, placeholder: "Excluded networks and systems" }),
    h("h3", {}, "Rules of engagement"), h("div", { class: "card grid2" },
      field("Agreed on", v.roe, "agreedOn", { type: "date" }), field("Agreed by", v.roe, "agreedBy", { placeholder: "One name per team" }),
      field("Assessment window", v.roe, "window", { placeholder: "Start and end times" }),
      field("Restrictions", v.roe, "restrictions", { wide: true, area: true, placeholder: "Prohibited activities" }))];
}
function varMethod() {
  return [h("h2", {}, "Method"), h("p", { class: "sub" }, "What you did, in order, so another assessor could repeat it. Give the exact options you used."),
    rowsTable(V().method, [["step", "Step", { w: "20%" }], ["tool", "Tool and settings", { area: true, placeholder: "nmap -sn 10.3.20.0/24" }], ["purpose", "Purpose", { area: true }]], { addLabel: "Add step" })];
}

// ---- hosts and Nmap import
function varHosts() {
  const v = V();
  return [h("h2", {}, "Hosts found"), h("p", { class: "sub" }, "Every live host from your internal and external views. Save each Nmap scan as XML by adding -oX to the command, for example nmap -sV -oX internal.xml 10.3.20.0/24, then import it here."),
    h("div", { class: "tools" }, h("button", { class: "primary", onclick: importNmap }, "Import Nmap results")),
    rowsTable(v.hosts, [["ip", "Address", { cls: "mono", w: "130px" }], ["role", "Role"], ["ports", "Open ports", { cls: "mono" }],
      ["view", "View", { options: ["Internal", "External", "Both"], w: "110px" }], ["notes", "Notes", { area: true }]], { addLabel: "Add host", blank: () => ({ ip: "", role: "", ports: "", view: "Internal", notes: "" }) }),
    h("h3", {}, "Comparing the two views"),
    field("", v, "compare", { area: true, rows: 4, placeholder: "Which services can anyone on the internet reach through the WAN address, and which only an insider on the Data VLAN? Which group should the client fix first, and why?" })];
}
async function importNmap() {
  const f = await pickFile(".xml,text/xml"); if (!f) return;
  let hosts;
  try { hosts = parseNmap(await f.text()); } catch (e) { return toast(e.message, true); }
  if (!hosts.length) return toast("That scan found no live hosts.", true);
  ask("Which view was this scan?", [h("p", {}, `${f.name} has ${hosts.length} live host${hosts.length > 1 ? "s" : ""}.`)],
    [["Cancel"], ["External view", () => mergeHosts(hosts, "External")], ["Internal view", () => mergeHosts(hosts, "Internal"), "primary"]]);
}
function parseNmap(text) {
  const x = new DOMParser().parseFromString(text, "application/xml");
  if (x.querySelector("parsererror") || !x.querySelector("nmaprun")) throw new Error("That isn't an Nmap XML file. Run Nmap with -oX filename.xml.");
  const out = [];
  for (const hst of x.querySelectorAll("host")) {
    if (hst.querySelector("status")?.getAttribute("state") === "down") continue;
    const ip = hst.querySelector('address[addrtype="ipv4"]')?.getAttribute("addr") || hst.querySelector("address")?.getAttribute("addr");
    if (!ip) continue;
    const ports = [...hst.querySelectorAll("ports > port")].filter((p) => p.querySelector("state")?.getAttribute("state") === "open").map((p) => {
      const s = p.querySelector("service"); const nm = s ? [s.getAttribute("name"), s.getAttribute("product"), s.getAttribute("version")].filter(Boolean).join(" ") : "";
      return { port: p.getAttribute("portid") + "/" + p.getAttribute("protocol"), service: nm };
    });
    const name = hst.querySelector("hostname")?.getAttribute("name") || "";
    out.push({ ip, name, ports });
  }
  return out;
}
async function mergeHosts(list, view) {
  await snapshot("Before an Nmap import");
  let added = 0, updated = 0;
  for (const n of list) {
    const ports = n.ports.map((p) => p.port.replace("/tcp", "")).join(", ");
    const svc = n.ports.filter((p) => p.service).map((p) => `${p.port} ${p.service}`).join("; ");
    const ex = V().hosts.find((x) => x.ip === n.ip);
    if (ex) {
      const all = new Set([...ex.ports.split(/,\s*/).filter(Boolean), ...ports.split(/,\s*/).filter(Boolean)]);
      ex.ports = [...all].join(", "); if (ex.view !== view) ex.view = "Both";
      if (svc && !ex.notes.includes(svc)) ex.notes = (ex.notes ? ex.notes + "\n" : "") + svc; updated++;
    } else { V().hosts.push({ ip: n.ip, role: n.name, ports, view, notes: svc }); added++; }
  }
  V().hosts.sort((a, b) => ipNum(a.ip) - ipNum(b.ip));
  commit(); renderAll(); toast(`Added ${added} host${added === 1 ? "" : "s"}${updated ? `, updated ${updated}` : ""}. Fill in each host's role.`);
}
const ipNum = (ip) => (ip || "").split(".").reduce((a, b) => a * 256 + (+b || 0), 0);

// ---- triage and Greenbone import
function varTriage() {
  const v = V(); const showLog = state.showLog;
  const list = v.triage.filter((t) => showLog || t.threat !== "Log");
  const hidden = v.triage.length - list.length;
  return [h("h2", {}, "Triage"), h("p", { class: "sub" }, "Greenbone's raw results, grouped by test. Nothing here goes in the report until you decide: make it a finding, add it to one, or dismiss it with a reason. Download the report from Greenbone as XML: Scans, Reports, open your scan, then the download icon."),
    h("div", { class: "tools" }, h("button", { class: "primary", onclick: importGreenbone }, "Import Greenbone report"),
      hidden || showLog ? h("label", { class: "who", style: "margin-left:6px" }, h("input", { type: "checkbox", checked: showLog || null, style: "width:auto", onchange: (e) => { state.showLog = e.target.checked; renderAll(); } }), `Show informational (Log) results${hidden ? ` (${hidden})` : ""}`) : null),
    list.length ? h("div", { class: "flist" }, list.map((t) => h("button", { class: "frow" + (t.state === "new" ? "" : " dim"), "aria-current": String(state.sel === t.id), onclick: () => { state.sel = t.id; renderAll(); } },
      sevBadge(t.score || 0), h("span", { style: "min-width:0" }, h("span", { class: "t" }, t.name), h("span", { class: "m" }, `${t.hosts.join(", ")}${t.port ? " · " + t.port : ""}`)),
      h("span", { class: "pill " + (t.state === "new" ? "new" : "") }, t.state === "new" ? "To decide" : t.state === "dismissed" ? "Dismissed" : "In " + (V().findings.find((f) => f.id === t.finding) ? fid(V().findings.find((f) => f.id === t.finding)) : "a finding")))))
      : h("p", { class: "empty" }, "No results yet. Import your Greenbone report, or skip this step and add findings by hand.")];
}
function triagePanel(t) {
  const fs = V().findings;
  return [h("h2", {}, "Scanner result", h("button", { class: "small ghost", onclick: () => { state.sel = null; renderAll(); } }, "Close")),
    h("p", { style: "margin:0 0 6px;color:var(--ink);font-weight:600" }, t.name),
    h("div", { class: "tools" }, sevBadge(t.score || 0), h("span", { class: "pill" }, t.threat), t.qod ? h("span", { class: "pill" }, "QoD " + t.qod + "%") : null),
    h("p", { class: "hintline" }, "Hosts: " + t.hosts.join(", ") + (t.port ? " · Port " + t.port : "")),
    t.vector ? h("p", { class: "hintline" }, "Greenbone's vector: ", h("code", {}, t.vector)) : null,
    t.summary ? [h("label", { style: "margin-top:10px" }, "What Greenbone says"), h("div", { class: "ref" }, t.summary)] : null,
    t.solution ? [h("label", { style: "margin-top:10px" }, "Greenbone's suggested fix"), h("div", { class: "ref" }, t.solution)] : null,
    h("h3", { style: "font-size:13px;margin:16px 0 8px" }, "Your decision"),
    t.state === "new" ? [
      h("div", { class: "tools" }, h("button", { class: "primary", onclick: () => promote(t) }, "Make a finding")),
      fs.length ? h("div", { class: "field" }, h("label", { for: "joinsel" }, "Or add these hosts to a finding"),
        h("div", { class: "tools" }, h("select", { id: "joinsel" }, fs.map((f) => h("option", { value: f.id }, fid(f) + " " + (f.title || "Untitled")))),
          h("button", { onclick: () => joinFinding(t, $("joinsel").value) }, "Add"))) : null,
      h("div", { class: "field" }, h("label", { for: "dismiss" }, "Or dismiss it"),
        h("div", { class: "tools" }, h("input", { id: "dismiss", placeholder: "Reason" }),
          h("button", { onclick: () => { const r = $("dismiss").value.trim(); if (!r) return toast("Give a reason, so the team knows why it was dropped.", true); t.state = "dismissed"; t.reason = r; commit(); nextTriage(); } }, "Dismiss")))]
      : [h("p", { class: "note" }, t.state === "dismissed" ? "Dismissed: " + t.reason : "Part of a finding."), h("button", { onclick: () => { t.state = "new"; if (t.finding) { const f = fs.find((x) => x.id === t.finding); if (f) f.sources = (f.sources || []).filter((s) => s !== t.id); } t.finding = null; commit(); renderAll(); } }, "Undo the decision")]];
}
function nextTriage() { const n = V().triage.find((x) => x.state === "new" && (state.showLog || x.threat !== "Log")); state.sel = n ? n.id : null; renderAll(); }
async function importGreenbone() {
  const f = await pickFile(".xml,text/xml"); if (!f) return;
  let res; try { res = parseGreenbone(await f.text()); } catch (e) { return toast(e.message, true); }
  await snapshot("Before a Greenbone import");
  let added = 0;
  for (const r of res) {
    const ex = V().triage.find((t) => t.oid === r.oid && t.port === r.port);
    if (ex) { for (const hst of r.hosts) if (!ex.hosts.includes(hst)) ex.hosts.push(hst); }
    else { V().triage.push({ id: newId("t"), state: "new", finding: null, reason: "", ...r }); added++; }
  }
  V().triage.sort((a, b) => (b.score || 0) - (a.score || 0));
  commit(); state.var = "triage"; renderAll();
  toast(`Imported ${res.length} result group${res.length === 1 ? "" : "s"}${added < res.length ? ` (${res.length - added} already here)` : ""}.`);
}
function parseGreenbone(text) {
  const x = new DOMParser().parseFromString(text, "application/xml");
  if (x.querySelector("parsererror")) throw new Error("That file couldn't be read as XML. Download the report from Greenbone in the XML format.");
  const results = x.querySelectorAll("results > result");
  if (!results.length) throw new Error("No results found. Download the report from Greenbone in the XML format, not PDF or CSV.");
  const kid = (el, sel) => el.querySelector(":scope > " + sel);
  const groups = new Map();
  for (const r of results) {
    const nvt = kid(r, "nvt"); const host = kid(r, "host")?.childNodes[0]?.nodeValue?.trim() || kid(r, "host")?.textContent.trim() || "";
    const oid = nvt?.getAttribute("oid") || kid(r, "name")?.textContent || "";
    const port = (kid(r, "port")?.textContent || "").trim();
    const name = (kid(r, "name")?.textContent || nvt?.querySelector("name")?.textContent || "Unnamed result").trim();
    const score = parseFloat(kid(r, "severity")?.textContent || nvt?.querySelector("cvss_base")?.textContent || "0") || 0;
    const threat = (kid(r, "threat")?.textContent || (score >= 7 ? "High" : score >= 4 ? "Medium" : score > 0 ? "Low" : "Log")).trim();
    const vec = [...(nvt?.querySelectorAll("severities severity") || [])].map((s) => s.querySelector("value")?.textContent || "").find((v) => /^CVSS:3/.test(v)) || "";
    const tags = Object.fromEntries((nvt?.querySelector("tags")?.textContent || "").split("|").map((p) => { const i = p.indexOf("="); return [p.slice(0, i), p.slice(i + 1)]; }));
    const solution = (nvt?.querySelector("solution")?.textContent || tags.solution || "").trim();
    const summary = [tags.summary, tags.insight, tags.impact].filter(Boolean).join("\n\n") || (kid(r, "description")?.textContent || "").trim();
    const qod = kid(r, "qod")?.querySelector("value")?.textContent || "";
    const key = oid + "|" + port;
    if (!groups.has(key)) groups.set(key, { oid, name, port, score, threat, vector: vec, solution, summary: summary.slice(0, 2000), qod, hosts: [] });
    const g = groups.get(key); if (host && !g.hosts.includes(host)) g.hosts.push(host);
  }
  return [...groups.values()];
}
function promote(t) {
  const f = blankFinding();
  f.title = t.name; f.hosts = [...t.hosts]; f.port = t.port; f.ref = { score: t.score, vector: t.vector, name: t.name };
  f.evidence = `Greenbone reported "${t.name}"${t.qod ? ` (quality of detection ${t.qod}%)` : ""}.`;
  f.sources = [t.id];
  for (const hst of t.hosts) if (!V().hosts.some((x) => x.ip === hst)) V().hosts.push({ ip: hst, role: "", ports: (t.port || "").replace(/\/tcp$/, ""), view: "Internal", notes: "Added from Greenbone" });
  V().findings.push(f); t.state = "promoted"; t.finding = f.id;
  commit(); state.var = "findings"; state.sel = f.id; renderAll();
  toast("Finding created. Rewrite the title in plain language, score it and add your own evidence.");
}
function joinFinding(t, id) {
  const f = V().findings.find((x) => x.id === id); if (!f) return;
  for (const hst of t.hosts) if (!f.hosts.includes(hst)) f.hosts.push(hst);
  f.sources = [...(f.sources || []), t.id]; t.state = "promoted"; t.finding = f.id; commit(); nextTriage();
}

// ---- findings
function blankFinding() {
  return { id: newId("f"), title: "", hosts: [], port: "", view: "internal", v: blankVector(), status: "not-verified",
    what: "", why: "", evidence: "", images: [], confirm: "", fix: "", ref: null, sources: [] };
}
function varFindings() {
  const v = V(), n = tally();
  return [h("h2", {}, "Findings"), h("p", { class: "sub" }, "One card per weakness. IDs follow severity, most serious first, so they can change as you score. Pick a card to edit it."),
    h("div", { class: "tally" }, [["crit", "Critical"], ["high", "High"], ["med", "Medium"], ["low", "Low"]].map(([c, t]) => h("span", {}, h("i", { style: `background:var(--${c})` }), `${n[c]} ${t}`)),
      h("span", { style: "color:var(--muted)" }, "False positives don't count")),
    h("div", { class: "tools" }, h("button", { class: "primary", onclick: () => { const f = blankFinding(); v.findings.push(f); state.sel = f.id; commit(); renderAll(); setTimeout(() => $("f-title")?.focus(), 30); } }, "Add finding"),
      v.triage.some((t) => t.state === "new") ? h("button", { onclick: () => { state.var = "triage"; state.sel = null; renderAll(); } }, `Triage (${v.triage.filter((t) => t.state === "new").length} to decide)`) : null),
    v.findings.length ? h("div", { class: "flist" }, sortedFindings().map((f) => {
      const p = findingProblems(f);
      return h("button", { class: "frow", "aria-current": String(state.sel === f.id), onclick: () => { state.sel = f.id; renderAll(); } },
        sevBadge(scoreOf(f)), h("span", { style: "min-width:0" }, h("span", { class: "t" }, `${fid(f)} ${f.title || "Untitled finding"}`),
          h("span", { class: "m" }, p.length ? "Still needs " + p.join(", ") : `${f.hosts.join(", ")} · ${viewName(f.view)}`)),
        h("span", { class: "pill " + f.status }, statusName(f.status)));
    })) : h("p", { class: "empty" }, "No findings yet. Add one, or make them from your Greenbone results in Triage.")];
}
function findingPanel(f) {
  const s = scoreOf(f), hostIps = [...new Set([...V().hosts.map((x) => x.ip), ...f.hosts])].filter(Boolean);
  const metric = ([k, t, o]) => h("div", { class: "metric" }, h("span", {}, t), h("div", { class: "opts", role: "group", "aria-label": t },
    o.map(([val, l]) => h("button", { "aria-pressed": String(f.v[k] === val), onclick: () => { f.v[k] = val; commit(); renderAll(); } }, l))));
  return [h("h2", {}, `Finding ${fid(f)}`, h("span", {},
      h("button", { class: "small ghost", onclick: () => ask("Delete this finding?", [h("p", {}, f.title || "Untitled finding")], [["Cancel"], ["Delete", async () => { await snapshot("Before deleting a finding"); V().findings = V().findings.filter((x) => x !== f); V().recs.forEach((r) => (r.findings = r.findings.filter((x) => x !== f.id))); V().triage.forEach((t) => { if (t.finding === f.id) { t.finding = null; t.state = "new"; } }); state.sel = null; commit(); renderAll(); }, "danger"]]) }, "Delete"),
      h("button", { class: "small ghost", onclick: () => { state.sel = null; renderAll(); } }, "Close"))),
    field("Title", f, "title", { id: "f-title", req: true, placeholder: "Short title", hint: "Name the weakness, not the scanner's alert: \"Anonymous FTP login allowed\".", oninput: refreshList }),
    h("div", { class: "field" }, h("label", {}, "Affected hosts"), hostIps.length ? h("div", { class: "chips" }, hostIps.map((ip) => {
      const host = V().hosts.find((x) => x.ip === ip);
      return h("button", { class: "chip", "aria-pressed": String(f.hosts.includes(ip)), onclick: () => { f.hosts = f.hosts.includes(ip) ? f.hosts.filter((x) => x !== ip) : [...f.hosts, ip]; commit(); renderAll(); } }, host?.role ? host.role + " " : "", h("code", {}, ip));
    })) : h("p", { class: "hintline" }, "Add hosts in Hosts found first.")),
    h("div", { class: "grid2" }, field("Port and protocol", f, "port", { placeholder: "TCP 21" }),
      h("div", { class: "field" }, h("label", {}, "View"), seg(VIEWS, f.view, (x) => { f.view = x; commit(); renderAll(); }))),
    h("div", { class: "field" }, h("label", {}, "Severity (CVSS 3.1 base score)"), h("div", { class: "cvss" },
      h("div", { class: "cvss-head" }, sevBadge(s), h("code", {}, vector(f.v))),
      CVSS_METRICS.map(metric),
      f.ref && (f.ref.score || f.ref.vector) ? h("p", { class: "hintline" }, `Greenbone scored it ${(+f.ref.score || 0).toFixed(1)}${f.ref.vector ? "" : "."} `,
        f.ref.vector && parseVector(f.ref.vector) ? h("button", { class: "small", onclick: () => { f.v = parseVector(f.ref.vector); commit(); renderAll(); } }, "Start from Greenbone's vector") : null,
        " Score it for this client's network: can it be reached from outside, and what's really at risk?") : null)),
    h("div", { class: "field" }, h("label", {}, "Validation"), seg(VALIDATION, f.status, (x) => { f.status = x; commit(); renderAll(); }),
      f.status === "confirmed" && !f.confirm.trim() ? h("p", { class: "hintline", style: "color:var(--err)" }, "Say how you confirmed it below, or it can't count as confirmed.") : h("p", { class: "hintline" }, "Check the three most serious findings by hand, without changing anything on the target.")),
    field("Description", f, "what", { area: true, req: true, placeholder: "Plain-language description" }),
    field("Impact", f, "why", { area: true, placeholder: "Attacker capability against this client" }),
    field("Evidence", f, "evidence", { area: true, req: true, hint: "The scanner result, command or output, so the client can see it for themselves." }),
    h("div", { class: "field" }, h("label", {}, "Screenshots"), imageWell(f.images, { label: "Evidence screenshots" })),
    field("Validation", f, "confirm", { area: true, placeholder: "Check performed, or why none was possible", oninput: refreshList }),
    field("Remediation", f, "fix", { area: true, req: true, placeholder: "Specific steps for this client" })];
}
function refreshList() { const l = document.querySelector(".work .flist"); if (!l || state.tab !== "var" || state.var !== "findings") return; const w = $("work"); const y = w.scrollTop; w.replaceChildren(...varFindings().flat()); w.scrollTop = y; renderRail(); }

// ---- recommendations
function varRecs() {
  const v = V(); const fs = sortedFindings().filter((f) => f.status !== "false-positive");
  const covered = new Set(v.recs.flatMap((r) => r.findings)); const left = fs.filter((f) => !covered.has(f.id));
  const move = (i, d) => { const j = i + d; if (j < 0 || j >= v.recs.length) return; [v.recs[i], v.recs[j]] = [v.recs[j], v.recs[i]]; commit(); renderAll(); };
  return [h("h2", {}, "Fix priority"), h("p", { class: "sub" }, "The order you'd tell the client to fix things in. Group findings that share one fix, and put the most risk removed for the least effort first. The client builds its POA&M from this list in Cyber Hub 13."),
    h("div", { class: "tools" }, left.length ? h("button", { class: "primary", onclick: () => { for (const f of left) v.recs.push({ id: newId("rec"), findings: [f.id], action: f.fix, effort: "Medium" }); commit(); renderAll(); } }, `Add ${left.length} finding${left.length === 1 ? "" : "s"} not yet covered`) : h("span", { class: "hintline" }, fs.length ? "Every finding is covered." : "Add findings first.")),
    v.recs.length ? h("div", { class: "flist" }, v.recs.map((r, i) => h("div", { class: "card", style: "margin:0" },
      h("div", { class: "tools", style: "justify-content:space-between" }, h("b", { style: "font:600 15px var(--mono);color:var(--navy)" }, "Priority " + (i + 1)),
        h("span", {}, h("button", { class: "small", disabled: i === 0 || null, "aria-label": "Move up", onclick: () => move(i, -1) }, "↑"), " ",
          h("button", { class: "small", disabled: i === v.recs.length - 1 || null, "aria-label": "Move down", onclick: () => move(i, 1) }, "↓"), " ",
          h("button", { class: "small ghost", onclick: () => { v.recs.splice(i, 1); commit(); renderAll(); } }, "Remove"))),
      h("div", { class: "field" }, h("label", {}, "Findings it fixes"), h("div", { class: "chips" }, fs.map((f) => h("button", { class: "chip", "aria-pressed": String(r.findings.includes(f.id)),
        onclick: () => { r.findings = r.findings.includes(f.id) ? r.findings.filter((x) => x !== f.id) : [...r.findings, f.id]; commit(); renderAll(); } }, fid(f), " ", h("span", { style: "font-weight:400" }, (f.title || "").slice(0, 40)))))),
      h("div", { class: "grid2" }, field("Remediation", r, "action", { area: true, wide: false }), field("Effort", r, "effort", { options: EFFORT })))))
      : h("p", { class: "empty" }, "No recommendations yet.")];
}

function varSummary() {
  const v = V(), n = tally(), top = v.recs.slice(0, 3);
  return [h("h2", {}, "Executive summary"), h("p", { class: "sub" }, "Three to five sentences for the client's leaders: what you assessed, the overall risk, and what to fix first. Leave out tool names and port numbers."),
    h("div", { class: "tally" }, [["crit", "Critical"], ["high", "High"], ["med", "Medium"], ["low", "Low"]].map(([c, t]) => h("span", {}, h("i", { style: `background:var(--${c})` }), `${n[c]} ${t}`))),
    field("", v, "summary", { area: true, rows: 6, req: true, aria: "Executive summary" }),
    h("h3", {}, "Top three priorities"), top.length ? h("ol", {}, top.map((r) => h("li", {}, r.action || h("span", { class: "hintline" }, "No action written yet")))) : h("p", { class: "hintline" }, "These come from Fix priority.")];
}

function varMissing() {
  const v = V(), m = [];
  if (!doc.meta.company) m.push(["cover", "Your company name (Team Log cover)"]);
  if (!v.cover.client) m.push(["cover", "The client company"]);
  if (!v.cover.team.trim()) m.push(["cover", "The assessment team"]);
  if (v.scope.some((r) => !r.range)) m.push(["scope", "An address for every in-scope target"]);
  if (!v.roe.agreedOn) m.push(["scope", "When the rules of engagement were agreed"]);
  if (v.method.some((r) => !r.tool)) m.push(["method", "The tool and settings for every method step"]);
  if (!v.hosts.length) m.push(["hosts", "The hosts you found"]);
  if (!v.compare.trim()) m.push(["hosts", "The comparison of the internal and external views"]);
  const tn = v.triage.filter((t) => t.state === "new" && t.threat !== "Log").length; if (tn) m.push(["triage", `${tn} scanner result${tn === 1 ? "" : "s"} not yet decided`]);
  if (!v.findings.length) m.push(["findings", "At least one finding"]);
  for (const f of v.findings) { const p = findingProblems(f); if (p.length) m.push(["findings", `${fid(f)} needs ${p.join(", ")}`, f.id]); }
  if (realFindings().some((f) => !v.recs.some((r) => r.findings.includes(f.id)))) m.push(["recs", "A recommendation for every finding"]);
  if (!v.summary.trim()) m.push(["summary", "The executive summary"]);
  return m;
}
function varReview() {
  const m = varMissing();
  return [h("h2", {}, "Review and export"), h("p", { class: "sub" }, "Export the PDF to submit in Canvas and give to the client. Then send the client your findings file, so they can import it into their POA&M."),
    m.length ? h("div", { class: "note warn" }, h("b", {}, "Still missing"), h("ul", { class: "missing-list" }, m.map(([k, t, id]) => h("li", {}, h("a", { href: "#", onclick: (e) => { e.preventDefault(); state.var = k; state.sel = id || null; renderAll(); } }, t)))))
      : h("p", { class: "note ok" }, "Everything the template asks for is filled in."),
    h("div", { class: "tools" }, h("button", { class: "primary", onclick: () => exportDoc("var") }, "Export VAR as PDF"),
      h("button", { onclick: sendFindings }, "Send findings to the client"))];
}
function sendFindings() {
  const v = V();
  const out = { format: "cyberhub-findings", v: 1, from: doc.meta.company, client: v.cover.client, date: today(),
    findings: sortedFindings().map((f) => ({ id: fid(f), title: f.title, hosts: f.hosts, severity: sevOf(scoreOf(f))[0], cvss: scoreOf(f), status: statusName(f.status), fix: f.fix,
      priority: v.recs.findIndex((r) => r.findings.includes(f.id)) + 1 || null })) };
  const name = ((doc.meta.company || "assessor") + "-findings-for-" + (v.cover.client || "client")).replace(/[^\w-]+/g, "-");
  download(name + ".cyberhub-findings", JSON.stringify(out, null, 1));
  toast("Findings file downloaded. Share it with the client team with the PDF.");
}
