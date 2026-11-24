// ------------------------------------------------------------------ Team Log
const NO_TICKETS = ["00", "14"];
function hubStatus(l) {
  const d = doc.log.hubs[l.num];
  if (!d) return "";
  const qs = l.questions.every((q, i) => (d.answers[i] || "").trim());
  const dl = l.deliverables.every((x) => SEPARATE[`${l.num}-${x.n}`] || (d.deliv[x.n]?.images || []).length);
  const any = d.sessions.length || d.commands.trim() || d.problems.length || (d.shots || []).length || Object.values(d.answers).some((a) => a.trim()) || Object.values(d.deliv).some((x) => (x.images || []).length);
  const rs = l.num === "15" ? restoreStatusSync(restoreData()) : "signed";
  return qs && dl && d.sessions.length && rs === "signed" ? "done" : any || rs !== "open" ? "part" : "";
}
function coverStatus() {
  const c = doc.log.cover;
  if (doc.meta.company && c.rack && c.roster.some((r) => r.name)) return unsigned().length ? "part" : "done";
  return doc.meta.company ? "part" : "";
}
const rackNum = () => { const r = String(doc.log.cover.rack || "").trim(); return /^[1-8]$/.test(r) ? r : ""; };

function railLog() {
  const items = [h("h3", {}, "Start"),
    stepBtn("log", "cover", "Cover and agreement", "Company, roster, agreement", coverStatus()),
    h("h3", {}, "Cyber Hubs")];
  for (const l of LABS) items.push(stepBtn("log", l.num, `${l.num} ${l.title}`, null, hubStatus(l), l.num));
  return items;
}

function viewLog() {
  const s = state.log;
  if (s === "cover") return logCover();
  const l = LABS.find((x) => x.num === s); return l ? logHub(l) : logCover();
}

function logCover() {
  const c = doc.log.cover, a = doc.log.agreement;
  // The signature lines follow the roster as names are typed, not only after leaving the page.
  const signs = h("div", {}); let t = 0;
  const drawSigns = () => { signs.replaceChildren(signBlock()); };
  const later = () => { clearTimeout(t); t = setTimeout(() => { drawSigns(); renderRail(); }, 400); };
  drawSigns();
  return [
    h("h2", {}, "Cover and team agreement"),
    h("p", { class: "sub" }, "The front of your Team Log, and the cover of every report this app makes. Cyber Hub 00 asks for all of it."),
    h("div", { class: "card" },
      h("div", { class: "grid2" },
        field("Company name", doc.meta, "company", { req: true, oninput: () => ($("brand-co").textContent = doc.meta.company || "Cyber Hub"), hint: "It also titles your network diagram." }),
        field("Rack number", c, "rack", { req: true, placeholder: "1 to 8", hint: "The addressing plan in the Diagram tab fills in from this.", oninput: () => renderRail() }),
        field("Semester", c, "semester", { placeholder: "Spring 2027" })),
      h("label", {}, "Logo"), logoWell(),
        h("p", { class: "hintline" }, "It goes on every report and in the corner of your network diagram. Best: a PNG, cropped close to the logo, at least 600 pixels wide. Wide logos read better than square ones. A logo maker's square with a plain background works too: the app trims the margin and makes the background transparent.")),
    h("h3", {}, "Team roster"),
    rowsTable(c.roster, [["name", "Name", { w: "45%", oninput: later }], ["email", "Email", { type: "email" }]], { addLabel: "Add member", onchange: () => renderAll() }),
    h("h3", {}, "Team agreement"),
    h("div", { class: "card" },
      field("Communication channels", c, "chat", { req: true, placeholder: "For example, a group chat and email", hint: "Two methods, so a message still gets through if one is down." }),
      field("Absence policy", a, "missed", { area: true, req: true }),
      signs),
  ];
}
// Each member signs with one click next to their roster name. The date records itself, and Undo takes it back.
const members = () => doc.log.cover.roster.map((r) => r.name.trim()).filter(Boolean);
const unsigned = () => members().filter((n) => !doc.log.agreement.signatures?.[n]?.date);
function signBlock() {
  const a = doc.log.agreement; a.signatures = a.signatures || {};
  const names = members();
  const head = h("label", {}, "Signatures", h("span", { class: "req" }, " *"));
  if (!names.length) return h("div", { class: "field" }, head, h("p", { class: "note" }, "A signature line appears here for each name on the roster above."));
  const box = h("div", { class: "signs" });
  const draw = () => box.replaceChildren(...names.map((n) => {
    const s = a.signatures[n] || (a.signatures[n] = { sig: "", date: "" });
    const set = (on) => { s.sig = on ? n : ""; s.date = on ? today() : ""; commit(); draw(); renderRail(); };
    return h("div", { class: "signrow" + (s.date ? " signed" : "") }, h("span", { class: "signname" }, n),
      s.date ? [h("span", { class: "sigmark" }, n), h("span", { class: "signdate" }, "Signed " + fmtDate(s.date)),
          h("button", { class: "small ghost", "aria-label": `Undo ${n}'s signature`, onclick: () => set(false) }, "Undo")]
        : [h("button", { class: "small", "aria-label": `Sign as ${n}`, onclick: () => set(true) }, "Click to sign"), h("span", {}), h("span", {})]);
  }));
  draw();
  return h("div", { class: "field" }, head, h("p", { class: "hintline", style: "margin:0 0 8px" }, "Each member signs next to their own name."), box);
}
function logoWell() {
  const box = h("div", { class: "logowell" });
  let last = null;   // the file just uploaded, so the team can keep it exactly as it was
  const use = async (f, raw) => {
    try { const r = await readLogoX(f, raw); doc.meta.logo = r.data; last = r.changed && !raw ? f : null; commit(); draw(); reloadDiagram();
      if (last) toast("Logo added. The app trimmed the empty margin and removed the plain background."); }
    catch (e) { toast(e.message, true); }
  };
  const draw = () => box.replaceChildren(
    doc.meta.logo ? h("div", { class: "logoprev" }, h("img", { src: doc.meta.logo, alt: "Company logo" })) : h("span", { class: "hintline" }, "No logo yet."),
    h("div", { class: "tools" },
      h("button", { class: "small", onclick: async () => { const f = await pickFile("image/png,image/jpeg,image/webp"); if (f) use(f, false); } }, doc.meta.logo ? "Change logo" : "Upload logo"),
      last ? h("button", { class: "small ghost", onclick: () => use(last, true) }, "Keep the original instead") : null,
      doc.meta.logo ? h("button", { class: "small ghost", onclick: () => { doc.meta.logo = ""; last = null; commit(); draw(); reloadDiagram(); } }, "Remove") : null));
  draw(); return box;
}

function logHub(l) {
  const d = hubData(l.num);
  const out = [h("h2", {}, `Cyber Hub ${l.num}: ${l.title}`),
    h("p", { class: "sub" }, "One session entry per lab worked on this Cyber Hub.")];
  out.push(h("h3", {}, "Sessions"),
    rowsTable(d.sessions, [["date", "Date", { type: "date", w: "150px" }], ["who", "Contributions", { area: true, placeholder: "Name: task" }]],
      { addLabel: "Add session", blank: () => ({ date: today(), who: "" }) }));
  // Cyber Hub 00 is setup and paperwork, so it has no commands; 00 and 14 have nothing to troubleshoot.
  if (l.num !== "00") out.push(h("h3", {}, "Configuration changes"),
    field("", d, "commands", { area: true, rows: 5, placeholder: "Command or setting, and its purpose" }));
  if (l.num === "15") out.push(...restoreSection());
  if (l.num === "05") {
    if (!d.extra.checkpoint) d.extra.checkpoint = CHECKPOINT_05.map(([t, e]) => ({ test: t, expected: e, result: "" }));
    out.push(h("h3", {}, "Connectivity checkpoint"),
      rowsTable(d.extra.checkpoint, [["test", "Test", { fixed: true }], ["expected", "Expected", { fixed: true }], ["result", "Result", { area: true, placeholder: "Result" }]], { fixedRows: true }));
  }
  if (l.num === "12") {
    if (!d.extra.roe) d.extra.roe = { target: "", assessing: "", scope: "", session: "", agreed: "" };
    const r = d.extra.roe;
    out.push(h("h3", {}, "Rules of engagement"), h("div", { class: "card grid2" },
      field("Target team", r, "target"), field("Assessing team", r, "assessing"),
      field("Scope", r, "scope", { wide: true, placeholder: "Agreed subnets and addresses" }),
      field("Session", r, "session", { placeholder: "Date and time window" }), field("Agreed by", r, "agreed", { placeholder: "One name per team" })));
  }
  if (!NO_TICKETS.includes(l.num)) out.push(h("h3", {}, "Troubleshooting tickets"), h("p", { class: "sub" }, "One ticket per problem, following the method on ", h("a", { href: "#ref/troubleshooting" }, "Reference: Troubleshooting"), ". Log every hypothesis, including the ones ruled out."), problemList(d.problems, l.num));
  if (!d.shots) d.shots = [];
  out.push(h("h3", {}, "Additional evidence"), h("p", { class: "sub" }, "Screenshots and notes beyond the deliverables."),
    imageWell(d.shots, { prompt: "Add a screenshot", label: "Additional evidence" }), field("", d, "notes", { area: true, placeholder: "Notes" }));
  if (l.questions.length) {
    out.push(h("h3", {}, "Before you continue"), h("div", { class: "card" }, l.questions.map((q, i) => h("div", { class: "qa" },
      h("p", { class: "q" }, q), field("", d.answers, String(i), { area: true, placeholder: "Answer", aria: "Answer: " + q })))));
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
        sep ? (sep[0] === "link" ? field("Slides link", dv, "link", { placeholder: "https://docs.google.com/presentation/…", hint: "Share the slides with the instructor (Viewer) first." }) : h("p", { class: "note" + (sep[0] === "none" ? " warn" : "") }, sep[1]))
            : [imageWell(dv.images, { prompt: x.kind === "Photo" ? "Add the photo" : "Add the screenshot", label: x.title })])));
  }
  out.push(h("div", { class: "tools" }, h("button", { class: "primary", onclick: () => exportDoc("log-hub", l.num) }, `Export Cyber Hub ${l.num} as PDF`)));
  return out;
}

// Troubleshooting tickets: the course's method (Reference: Troubleshooting) in a help-desk ticket's shape.
// Older entries used broke/checked/fixed; those keys still hold the issue, tests and resolution.
const TICKET_STATUS = [["open", "Open"], ["resolved", "Resolved"]];
const OUTCOMES = ["Untested", "Ruled out", "Confirmed"];
function ticketId(num, i) { return `T-${num}-${String(i + 1).padStart(2, "0")}`; }
// A ticket keeps every hypothesis the team tested, ruled out or confirmed, as a work log, the way a help desk
// ticket keeps its work notes. Older tickets had one Probable cause and one Tests box; they become the first entry.
function ticketLog(p) {
  if (!Array.isArray(p.log)) {
    p.log = (p.theory || p.checked) ? [{ date: "", hypothesis: p.theory || "", test: p.checked || "", result: "", outcome: "Untested" }] : [];
    delete p.theory; delete p.checked;
  }
  return p.log;
}
function workLog(p, redraw) {
  const log = ticketLog(p);
  const rows = log.map((e, j) => h("div", { class: "wl-entry o-" + (e.outcome || "Untested").replace(" ", "-").toLowerCase() },
    h("div", { class: "wl-h" }, h("b", {}, `Entry ${j + 1}`), e.date ? h("span", { class: "hintline" }, fmtDate(e.date)) : null,
      h("select", { "aria-label": `Entry ${j + 1} outcome`, onchange: (ev) => { e.outcome = ev.target.value; commit(); redraw(); } }, OUTCOMES.map((o) => h("option", { value: o, selected: (e.outcome || "Untested") === o ? "" : null }, o))),
      !e.hypothesis && !e.test && !e.result ? h("button", { class: "small ghost", "aria-label": `Remove empty entry ${j + 1}`, onclick: () => { log.splice(j, 1); commit(); redraw(); } }, "Remove") : null),
    h("div", { class: "grid3" },
      field("Hypothesis", e, "hypothesis", { area: true, rows: 2, placeholder: "Probable cause" }),
      field("Test", e, "test", { area: true, rows: 2, placeholder: "Command or check" }),
      field("Result", e, "result", { area: true, rows: 2, placeholder: "Output or observation" }))));
  return h("div", { class: "wlog" }, h("label", {}, "Work log"),
    rows.length ? rows : h("p", { class: "hintline" }, "No entries yet. Add one for each hypothesis you test. Keep the ones you rule out."),
    h("button", { class: "small", onclick: () => { log.push({ date: today(), hypothesis: "", test: "", result: "", outcome: "Untested" }); commit(); redraw(); } }, "+ Add entry"));
}
function problemList(list, num) {
  const box = h("div", { class: "plist" });
  const draw = () => box.replaceChildren(
    ...list.map((p, i) => { if (!p.images) p.images = []; if (!p.status) p.status = "open"; ticketLog(p);
      return h("div", { class: "pcard" + (p.status === "resolved" ? " resolved" : "") },
        h("div", { class: "pcard-h" }, h("b", {}, `Ticket ${ticketId(num, i)}`), h("span", { class: "tstat" }, p.status === "resolved" ? "Resolved" : "Open"),
          h("button", { class: "small ghost", onclick: () => ask("Delete this ticket?", [h("p", {}, p.broke || "Untitled ticket")], [["Cancel"], ["Delete", () => { list.splice(i, 1); commit(); draw(); }, "danger"]]) }, "Delete")),
        field("Issue", p, "broke", { area: true, wide: true, placeholder: "Symptom, location, start time" }),
        workLog(p, draw),
        h("div", { class: "grid2" },
          field("Resolution", p, "fixed", { area: true, placeholder: "Change made" }),
          field("Verification", p, "verify", { area: true, placeholder: "Test and result" })),
        h("div", { class: "pcard-f" }, h("label", {}, "Screenshots"), imageWell(p.images, { prompt: "Add a screenshot", label: "Ticket screenshots" }),
          h("div", { class: "field" }, h("label", {}, "Status"), seg(TICKET_STATUS, p.status, (x) => { p.status = x; commit(); draw(); renderRail(); })))); }),
    h("button", { class: "small", onclick: () => { list.push({ broke: "", log: [], fixed: "", verify: "", status: "open", images: [] }); commit(); draw(); box.querySelectorAll(".pcard")[list.length - 1]?.querySelector("textarea")?.focus(); } }, "+ Open a ticket"));
  draw(); return box;
}
