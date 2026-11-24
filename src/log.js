// ------------------------------------------------------------------ Team Log
function hubStatus(l) {
  const d = doc.log.hubs[l.num];
  if (!d) return "";
  const qs = l.questions.every((q, i) => (d.answers[i] || "").trim());
  const dl = l.deliverables.every((x) => SEPARATE[`${l.num}-${x.n}`] || (d.deliv[x.n]?.images || []).length);
  const any = d.sessions.length || d.commands.trim() || d.problems.length || Object.values(d.answers).some((a) => a.trim()) || Object.values(d.deliv).some((x) => (x.images || []).length);
  return qs && dl && d.sessions.length ? "done" : any ? "part" : "";
}
function coverStatus() {
  const c = doc.log.cover;
  if (doc.meta.company && c.rack && c.roster.some((r) => r.name)) return doc.log.agreement.agreed.trim() ? "done" : "part";
  return doc.meta.company ? "part" : "";
}
const rackNum = () => { const r = String(doc.log.cover.rack || "").trim(); return /^[1-8]$/.test(r) ? r : ""; };
const rackValue = (pat) => rackNum() ? pat.replace(/\bR\b/g, rackNum()) : "";
function rackStatus() {
  if (!rackNum()) return "";
  return doc.log.rack.checkedTeammate.trim() ? "done" : "part";
}

function railLog() {
  const items = [h("h3", {}, "Start"),
    stepBtn("log", "cover", "Cover and agreement", "Company, roster, agreement", coverStatus()),
    stepBtn("log", "rack", "Rack sheet", "Every address for your rack", rackStatus()),
    h("h3", {}, "Cyber Hubs")];
  for (const l of LABS) items.push(stepBtn("log", l.num, `${l.num} ${l.title}`, null, hubStatus(l), l.num));
  return items;
}

function viewLog() {
  const s = state.log;
  if (s === "cover") return logCover();
  if (s === "rack") return logRack();
  const l = LABS.find((x) => x.num === s); return l ? logHub(l) : logCover();
}

function logCover() {
  const c = doc.log.cover, a = doc.log.agreement;
  return [
    h("h2", {}, "Cover and team agreement"),
    h("p", { class: "sub" }, "The front of your Team Log, and the cover of every report this app makes. Cyber Hub 00 asks for all of it."),
    h("div", { class: "card" },
      h("div", { class: "grid2" },
        field("Company name", doc.meta, "company", { req: true, oninput: () => ($("brand-co").textContent = doc.meta.company || "Cyber Hub"), hint: "It also titles your network diagram." }),
        field("Tagline", doc.meta, "tagline", { placeholder: "One line that says what your company does" }),
        field("Rack number", c, "rack", { req: true, placeholder: "1 to 8", hint: "Your rack sheet fills in from this.", oninput: () => renderRail() }),
        field("Semester", c, "semester", { placeholder: "Spring 2027" }),
        field("How we communicate", c, "chat", { wide: true, placeholder: "Two methods, for example a group chat and email" })),
      h("label", {}, "Logo"), logoWell(), h("p", { class: "hintline" }, "It goes on every report and in the corner of your network diagram. You can also add it from the Diagram tab.")),
    h("h3", {}, "Team roster"),
    rowsTable(c.roster, [["name", "Name", { w: "45%" }], ["email", "Email", { type: "email" }]], { addLabel: "Add member", onchange: fillWho }),
    h("h3", {}, "Team agreement"),
    h("div", { class: "card" },
      field("How we make decisions", a, "decisions", { area: true }),
      field("If someone misses a lab", a, "missed", { area: true }),
      field("How fast we reply between labs", a, "reply"),
      field("Agreed by", a, "agreed", { hint: "Every team member types their name to agree.", req: true })),
  ];
}
function logoWell() {
  const box = h("div", { class: "tools" });
  const draw = () => box.replaceChildren(
    doc.meta.logo ? h("img", { src: doc.meta.logo, alt: "Company logo", style: "max-height:56px;max-width:200px;border:1px solid var(--border);border-radius:6px;background:#fff;padding:4px" }) : h("span", { class: "hintline" }, "No logo yet."),
    h("button", { class: "small", onclick: async () => { const f = await pickFile("image/*"); if (!f) return; try { doc.meta.logo = await readLogo(f); commit(); draw(); reloadDiagram(); } catch (e) { toast(e.message, true); } } }, doc.meta.logo ? "Change logo" : "Upload logo"),
    doc.meta.logo ? h("button", { class: "small ghost", onclick: () => { doc.meta.logo = ""; commit(); draw(); reloadDiagram(); } }, "Remove") : null);
  draw(); return box;
}

function logRack() {
  const r = doc.log.rack;
  const rows = RACK_ROWS.map(([k, label, pat]) => ({ label, pat, value: rackValue(pat) }));
  return [
    h("h2", {}, "Rack sheet"),
    h("p", { class: "sub" }, "Every address for your rack, from the rack number on the cover. Work from this sheet instead of working addresses out mid-lab. A teammate checks it against Reference: Rack Schema and VLAN Plan."),
    rackNum() ? null : h("p", { class: "note warn" }, "Type your rack number (1 to 8) on the cover, and this sheet fills in.",
      " ", h("a", { href: "#", onclick: (e) => { e.preventDefault(); state.log = "cover"; renderAll(); } }, "Go to the cover")),
    rowsTable(rows, [["label", "Device or network", { fixed: true, w: "36%" }], ["pat", "Pattern", { fixed: true, cls: "pattern", w: "24%" }], ["value", "Your rack", { fixed: true, cls: "mono" }]], { fixedRows: true }),
    h("div", { class: "card grid2" }, field("Checked by (teammate)", r, "checkedTeammate"), field("Checked by (instructor)", r, "checkedInstructor")),
  ];
}

function logHub(l) {
  const d = hubData(l.num);
  const out = [h("h2", {}, `Cyber Hub ${l.num}: ${l.title}`),
    h("p", { class: "sub" }, "Add a session entry every time you work on this Cyber Hub, even when it takes more than one lab.")];
  out.push(h("h3", {}, "Sessions"),
    rowsTable(d.sessions, [["date", "Date", { type: "date", w: "150px" }], ["who", "Who did what", { area: true, placeholder: "Each person's contribution" }]],
      { addLabel: "Add session", blank: () => ({ date: today(), who: me() ? me() + ": " : "" }) }));
  out.push(h("h3", {}, "Commands and settings"),
    field("", d, "commands", { area: true, rows: 5, placeholder: "Every command you ran or setting you changed, and why" }));
  if (l.num === "05") {
    if (!d.extra.checkpoint) d.extra.checkpoint = CHECKPOINT_05.map(([t, e]) => ({ test: t, expected: e, result: "" }));
    out.push(h("h3", {}, "Connectivity checkpoint"),
      rowsTable(d.extra.checkpoint, [["test", "From your laptop, try", { fixed: true }], ["expected", "Expected", { fixed: true }], ["result", "Result", { placeholder: "What happened" }]], { fixedRows: true }));
  }
  if (l.num === "12") {
    if (!d.extra.roe) d.extra.roe = { target: "", assessing: "", scope: "", session: "", agreed: "" };
    const r = d.extra.roe;
    out.push(h("h3", {}, "Rules of engagement"), h("div", { class: "card grid2" },
      field("Target team", r, "target"), field("Assessing team", r, "assessing"),
      field("Scope", r, "scope", { wide: true, placeholder: "Subnets and addresses agreed" }),
      field("Session", r, "session", { placeholder: "Date and times" }), field("Agreed by", r, "agreed", { placeholder: "One name from each team" })));
  }
  out.push(h("h3", {}, "Problems and fixes"),
    rowsTable(d.problems, [["broke", "What broke", { area: true }], ["checked", "What you checked", { area: true }], ["fixed", "What fixed it", { area: true }]], { addLabel: "Add problem" }));
  if (l.questions.length) {
    out.push(h("h3", {}, "Before you continue"), h("div", { class: "card" }, l.questions.map((q, i) => h("div", { class: "qa" },
      h("p", { class: "q" }, q), field("", d.answers, String(i), { area: true, placeholder: "Your answer" })))));
  }
  out.push(h("h3", {}, "Deliverables"));
  for (const x of l.deliverables) {
    const sep = SEPARATE[`${l.num}-${x.n}`];
    if (!d.deliv[x.n]) d.deliv[x.n] = { images: [], note: "", link: "" };
    const dv = d.deliv[x.n];
    out.push(h("div", { class: "deliv" },
      h("header", {}, h("b", {}, `Deliverable ${x.n}: ${x.title}`), h("span", {}, x.kind)),
      h("div", { class: "in" },
        h("p", {}, x.instr),
        x.checks.length ? h("ul", { class: "checks" }, x.checks.map(([k, v]) => h("li", {}, h("b", {}, k + ": "), v))) : null,
        sep ? (sep[0] === "link" ? field("Link", dv, "link", { placeholder: "https://" }) : h("p", { class: "note" + (sep[0] === "none" ? " warn" : "") }, sep[1]))
            : [imageWell(dv.images, { prompt: x.kind === "Photo" ? "Add the photo" : "Add the screenshot", label: x.title })])));
  }
  out.push(h("div", { class: "tools" }, h("button", { class: "primary", onclick: () => exportDoc("log-hub", l.num) }, `Export Cyber Hub ${l.num} as PDF`)));
  return out;
}
