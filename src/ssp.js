// ------------------------------------------------------------------ SSP (Cyber Hub 13)
const S = () => doc.ssp;
const SSP_STEPS = [
  ["ident", "System identification", "Name, purpose, users"],
  ["desc", "System description", "Parts and traffic flow"],
  ["diagram", "Network diagram", "Exported from the app"],
  ["inventory", "Inventory", "Hardware and software"],
  ["ports", "Ports and services", "What listens, and why"],
  ["controls", "Security controls", "Twelve NIST controls"],
  ["risks", "Accepted risks", "What remains, and why"],
  ["poam", "POA&M", "Every weakness and its fix"],
  ["history", "Assessment history", "Scans and assessments"],
  ["approval", "Approval", "System owner signs"],
  ["review", "Review and export", "Check and submit"],
];
function sspStatus(k) {
  const s = S();
  switch (k) {
    case "ident": { const n = ["name", "purpose", "location", "users", "internet"].filter((x) => s.ident[x].trim()).length; return n === 5 ? "done" : n ? "part" : ""; }
    case "desc": return s.description.trim().length > 200 ? "done" : s.description.trim() ? "part" : "";
    case "diagram": return s.diagram ? "done" : "";
    case "inventory": return s.inventory.length && s.inventory.every((r) => r.model && r.os) ? "done" : s.inventory.length ? "part" : "";
    case "ports": return s.ports.length && s.ports.every((r) => r.why) ? "done" : s.ports.length ? "part" : "";
    case "controls": { const n = CONTROLS.filter(([id]) => (s.controls[id]?.how || "").trim()).length; return n === CONTROLS.length ? "done" : n ? "part" : ""; }
    case "risks": return s.risks.length >= 3 && s.risks.every((r) => r.by && r.date) ? "done" : s.risks.some((r) => r.by) ? "part" : "";
    case "poam": return s.poam.length && s.poam.every((r) => r.response && (r.fix || "").trim() && r.status) ? "done" : s.poam.length ? "part" : "";
    case "history": return s.history.every((r) => r.date && r.result) ? "done" : s.history.some((r) => r.date) ? "part" : "";
    case "approval": return s.approval.owner && s.approval.signature && s.approval.date ? "done" : "";
    default: return "";
  }
}
function railSsp() { return [h("h3", {}, "SSP · Cyber Hub 13"), ...SSP_STEPS.map(([k, t, sub], i) => stepBtn("ssp", k, t, sub, sspStatus(k), String(i + 1)))]; }
function viewSsp() {
  return ({ ident: sspIdent, desc: sspDesc, diagram: sspDiagram, inventory: sspInventory, ports: sspPorts, controls: sspControls, risks: sspRisks, poam: sspPoam, history: sspHistory, approval: sspApproval, review: sspReview }[state.ssp] || sspIdent)();
}

function sspIdent() {
  const i = S().ident;
  if (!i.name && doc.meta.company) i.name = `${doc.meta.company} network${doc.log.cover.rack ? ", Rack " + doc.log.cover.rack : ""}`;
  if (!i.location && doc.log.cover.rack) i.location = "CIS lab, Rack " + doc.log.cover.rack;
  return [h("h2", {}, "System identification"), h("p", { class: "sub" }, "Describe only what is actually configured on your rack. An auditor should be able to check every sentence of this plan."),
    h("div", { class: "card grid2" },
      field("System name", i, "name", { req: true }), field("Location", i, "location", { req: true }),
      field("Purpose", i, "purpose", { wide: true, area: true, req: true, placeholder: "What the network does for the company, in one or two sentences" }),
      field("Operational status", i, "status", { options: ["Operational", "Under development", "Under major change"] }),
      field("Users", i, "users", { wide: true, area: true, req: true, placeholder: "Staff on the Data VLAN, guests, public visitors to the website" }),
      field("Internet connection", i, "internet", { wide: true, area: true, req: true, placeholder: "The uplink to your provider, the instructor rack, and that the lab has no connection to the real internet" }))];
}
function sspDesc() {
  return [h("h2", {}, "System description"), h("p", { class: "sub" }, "Two or three paragraphs: the main parts of the network, what each is for, and how traffic moves between them. Name the VLANs and which device routes each one."),
    field("", S(), "description", { area: true, rows: 12 })];
}
function sspDiagram() {
  const s = S();
  const box = h("div");
  const draw = () => box.replaceChildren(
    s.diagram && images[s.diagram] ? h("figure", { class: "card", style: "margin:0 0 10px" }, h("img", { src: images[s.diagram], alt: "Network diagram", style: "max-width:100%;display:block" })) : h("p", { class: "empty" }, "No diagram yet."),
    h("div", { class: "tools" }, h("button", { class: "primary", onclick: async () => {
        const png = await diagramPNG(); if (!png) return toast("Your diagram is empty. Fill it in on the Diagram tab first.", true);
        const id = newId("img"); images[id] = png; try { await imgPut(id, png); } catch { saveFailed = true; }
        s.diagram = id; commit(); draw(); renderRail(); toast("Added your current diagram. Do this again whenever you change it."); } }, s.diagram ? "Update to my current diagram" : "Add my diagram"),
      h("button", { onclick: async () => { const f = await pickFile("image/png,image/*"); if (!f) return; try { s.diagram = await addImageFull(f); commit(); draw(); renderRail(); } catch (e) { toast(e.message, true); } } }, "Upload an image instead"),
      s.diagram ? h("button", { class: "ghost", onclick: () => { s.diagram = ""; commit(); draw(); renderRail(); } }, "Remove") : null));
  draw();
  return [h("h2", {}, "Network diagram"), h("p", { class: "sub" }, "Add my diagram takes a picture of your Diagram tab as it is now. Before you add it, check that every device has its address and hostname and every switch port shows its VLANs."), box];
}
// The diagram needs more pixels than a screenshot to stay readable when printed.
async function addImageFull(file) {
  const data = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error("That image couldn't be read.")); r.readAsDataURL(file); });
  if (!/^data:image\//.test(data)) throw new Error("That isn't an image.");
  const id = newId("img"); images[id] = data.length > 4e6 ? await readImage(file) : data;
  try { await imgPut(id, images[id]); } catch { saveFailed = true; }
  return id;
}

function sspInventory() {
  const s = S(), dg = readDiagram(), rows = diagramAddressing(dg);
  return [h("h2", {}, "Hardware and software inventory"), h("p", { class: "sub" }, "Every device, including the virtual machines and the Pi, with its model, role and OS or firmware version."),
    h("div", { class: "tools" },
      rows.length ? h("button", { onclick: () => { const have = new Set(s.inventory.map((r) => r.device)); const seen = new Set(); let n = 0;
        for (const r of rows) { if (have.has(r.device) || seen.has(r.device)) continue; seen.add(r.device); s.inventory.push({ device: r.device, model: "", role: "", address: r.address, os: "" }); n++; }
        commit(); renderAll(); toast(n ? `Added ${n} device${n === 1 ? "" : "s"} from your diagram. Fill in model, role and OS.` : "Every device in your diagram is already listed."); } }, "Start from my diagram") : null,
      h("span", { class: "hintline" }, rows.length ? "Uses the addresses on your Diagram tab." : "Fill in the Diagram tab first, then come back.")),
    rowsTable(s.inventory, [["device", "Device"], ["model", "Model"], ["role", "Role", { area: true }], ["address", "Address", { cls: "mono" }], ["os", "OS or firmware"]], { addLabel: "Add device" }),
    h("h3", {}, "Addressing table"),
    h("p", { class: "sub" }, s.addressingFrom ? `From your Diagram tab, ${s.addressingFrom}. It isn't edited here: fix the diagram, then update.` : "Copied from your Diagram tab, so the plan and the diagram can't disagree."),
    h("div", { class: "tools" }, h("button", { onclick: () => { if (!rows.length) return toast("Your Diagram tab has no addresses yet. Fill it in first.", true); s.addressing = rows; s.addressingFrom = fmtTime(Date.now()); commit(); renderAll(); } }, s.addressing.length ? "Update from diagram" : "Copy from my diagram")),
    s.addressing.length ? h("div", { class: "tbox" }, h("table", { class: "edit" }, h("thead", {}, h("tr", {}, ["Device", "Hostname", "Interface", "VLAN", "IP address", "Mask", "Gateway"].map((t) => h("th", {}, t)))),
      h("tbody", {}, s.addressing.map((r) => h("tr", {}, [r.device, r.hostname, r.iface, r.vlan, r.address, r.mask, r.gateway].map((x, i) => h("td", { class: i >= 4 ? "mono" : "" }, h("span", { class: "fixed" }, x || ""))))))) ) : null];
}
function sspPorts() {
  return [h("h2", {}, "Ports, protocols and services"), h("p", { class: "sub" }, "Every listening service in use. Anything without a reason belongs under CM-7 Least functionality."),
    rowsTable(S().ports, [["host", "Host", { cls: "mono" }], ["port", "Port and protocol", { placeholder: "TCP 80" }], ["service", "Service"], ["who", "Who can reach it", { area: true }], ["why", "Why it's needed", { area: true }]], { addLabel: "Add service" })];
}
function sspControls() {
  const s = S();
  return [h("h2", {}, "Security controls"), h("p", { class: "sub" }, "The control IDs come from NIST SP 800-53, the catalog federal systems use. For each one, describe how your rack meets it, then give its status."),
    CONTROLS.map(([id, name, req, guide]) => {
      if (!s.controls[id]) s.controls[id] = { how: "", status: "" };
      const c = s.controls[id];
      return h("div", { class: "ctrl" }, h("h3", {}, `${id} ${name}`), h("p", { class: "rq" }, req),
        field("How we meet it", c, "how", { area: true, rows: 3, placeholder: guide, oninput: () => renderRail() }),
        h("div", { class: "field" }, h("label", {}, "Status"), seg(CONTROL_STATUS.map((x) => [x, x]), c.status, (x) => { c.status = x; commit(); renderAll(); })));
    })];
}
function sspRisks() {
  return [h("h2", {}, "Accepted risks"), h("p", { class: "sub" }, "Weaknesses you're choosing to keep, with the reason and what limits the damage. Keep the example row and add at least two of your own."),
    rowsTable(S().risks, [["risk", "Risk", { area: true }], ["why", "Why it remains", { area: true }], ["limits", "What limits it", { area: true }], ["by", "Accepted by"], ["date", "Date", { type: "date", w: "140px" }]],
      { addLabel: "Add risk", blank: () => ({ id: newId("r"), risk: "", why: "", limits: "", by: "", date: "" }) })];
}
function sspPoam() {
  const s = S();
  const cols = [["pid", "ID", { w: "60px" }], ["weakness", "Weakness", { area: true }], ["source", "Source"], ["severity", "Severity", { options: ["", "Critical", "High", "Medium", "Low"] }],
    ["rec", "Assessors' recommendation", { fixed: true, cls: "ref-col" }], ["response", "Response", { options: RESPONSES, label: "Response" }],
    ["fix", "Your plan", { area: true, placeholder: "What you'll do, or why you accept it" }], ["owner", "Owner"], ["date", "Target date", { type: "date" }], ["status", "Status", { options: ["Open", "Closed"] }], ["verified", "How the fix was verified", { area: true }]];
  return [h("h2", {}, "Plan of Action and Milestones (POA&M)"), h("p", { class: "sub" }, "One row for every finding in the VAR you received and every weakness on your answer key. For each, choose a response and write your own plan: the assessors' recommendation is there for reference, not to copy. Rows you accept also go in Accepted risks. Closed rows say how the fix was verified."),
    h("div", { class: "tools" }, h("button", { class: "primary", onclick: importFindings }, "Import the VAR findings"), h("span", { class: "hintline" }, "Uses the findings file the assessing team sent you.")),
    rowsTable(s.poam, cols, { addLabel: "Add row", blank: () => ({ pid: "P-" + String(s.poam.length + 1).padStart(2, "0"), weakness: "", source: "", severity: "", rec: "", response: "", fix: "", owner: "", date: "", status: "Open", verified: "" }) })];
}
async function importFindings() {
  const f = await pickFile(".cyberhub-findings,application/json"); if (!f) return;
  let x; try { x = JSON.parse(await f.text()); } catch { return toast("That file couldn't be read.", true); }
  if (x.format !== "cyberhub-findings") return toast("That isn't a findings file. Ask the assessing team for the file from Send findings to the client.", true);
  await snapshot("Before importing VAR findings");
  const s = S(); let n = 0;
  for (const fd of x.findings || []) {
    if (fd.status === "False positive") continue;
    const src = `VAR ${fd.id}`;
    if (s.poam.some((r) => r.source === src)) continue;
    s.poam.push({ pid: "P-" + String(s.poam.length + 1).padStart(2, "0"), weakness: `${fd.title} (${(fd.hosts || []).join(", ")})`, source: src, severity: fd.severity || "", rec: fd.fix || "", response: "", fix: "", owner: "", date: "", status: "Open", verified: "" });
    n++;
  }
  commit(); renderAll(); toast(n ? `Added ${n} row${n === 1 ? "" : "s"} from ${x.from || "the assessors"}'s VAR. Choose a response and write your plan for each.` : "Those findings are already in your POA&M.");
}
function sspHistory() {
  return [h("h2", {}, "Assessment history"), h("p", { class: "sub" }, "Every scan and assessment of your system, with its result."),
    rowsTable(S().history, [["date", "Date", { type: "date", w: "140px" }], ["activity", "Activity", { area: true }], ["by", "Performed by"], ["result", "Result", { area: true, placeholder: "Number of findings by severity, findings closed and still open" }]],
      { addLabel: "Add activity", blank: () => ({ id: newId("a"), date: "", activity: "", by: "", result: "" }) })];
}
function sspApproval() {
  const a = S().approval;
  return [h("h2", {}, "Approval"), h("p", { class: "sub" }, "By signing, the system owner confirms this plan describes the system as built and accepts the risks in it."),
    h("div", { class: "card grid2" }, field("System owner", a, "owner", { placeholder: "Name and role", req: true }), field("Date", a, "date", { type: "date", req: true }),
      field("Signature", a, "signature", { wide: true, placeholder: "The owner types their full name", req: true }))];
}
function sspMissing() {
  const m = [];
  for (const [k, t] of SSP_STEPS) if (k !== "review" && sspStatus(k) !== "done") m.push([k, t + (sspStatus(k) ? " is incomplete" : " is empty")]);
  return m;
}
function sspReview() {
  const m = sspMissing();
  return [h("h2", {}, "Review and export"), h("p", { class: "sub" }, "Export the PDF and submit it by its due date in Canvas."),
    m.length ? h("div", { class: "note warn" }, h("b", {}, "Still missing"), h("ul", { class: "missing-list" }, m.map(([k, t]) => h("li", {}, h("a", { href: "#", onclick: (e) => { e.preventDefault(); state.ssp = k; renderAll(); } }, t)))))
      : h("p", { class: "note ok" }, "Every section is filled in."),
    h("div", { class: "tools" }, h("button", { class: "primary", onclick: () => exportDoc("ssp") }, "Export SSP as PDF"))];
}
