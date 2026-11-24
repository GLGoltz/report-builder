// ------------------------------------------------------------------ Team Log
function hubStatus(l) {
  const d = doc.log.hubs[l.num];
  if (!d) return "";
  const qs = l.questions.every((q, i) => (d.answers[i] || "").trim());
  const dl = l.deliverables.every((x) => SEPARATE[`${l.num}-${x.n}`] || (d.deliv[x.n]?.images || []).length);
  const any = d.sessions.length || d.commands.trim() || d.problems.length || (d.shots || []).length || Object.values(d.answers).some((a) => a.trim()) || Object.values(d.deliv).some((x) => (x.images || []).length);
  return qs && dl && d.sessions.length ? "done" : any ? "part" : "";
}
function coverStatus() {
  const c = doc.log.cover;
  if (doc.meta.company && c.rack && c.roster.some((r) => r.name)) return unsigned().length ? "part" : "done";
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
        field("Rack number", c, "rack", { req: true, placeholder: "1 to 8", hint: "Your rack sheet fills in from this.", oninput: () => renderRail() }),
        field("Semester", c, "semester", { placeholder: "Spring 2027" })),
      h("label", {}, "Logo"), logoWell(), h("p", { class: "hintline" }, "It goes on every report and in the corner of your network diagram.")),
    h("h3", {}, "Team roster"),
    rowsTable(c.roster, [["name", "Name", { w: "45%" }], ["email", "Email", { type: "email" }]], { addLabel: "Add member", onchange: () => renderAll() }),
    h("h3", {}, "Team agreement"),
    h("div", { class: "card" },
      field("How we communicate", c, "chat", { req: true, placeholder: "Two methods, for example a group chat and email" }),
      field("If someone misses a lab", a, "missed", { area: true, req: true }),
      signBlock()),
  ];
}
// Each member signs by typing their full name as it appears on the roster. The date records itself.
const members = () => doc.log.cover.roster.map((r) => r.name.trim()).filter(Boolean);
const unsigned = () => members().filter((n) => !doc.log.agreement.signatures?.[n]?.date);
function signBlock() {
  const a = doc.log.agreement; a.signatures = a.signatures || {};
  const names = members();
  if (!names.length) return h("p", { class: "hintline" }, "Add your team to the roster above, then each member signs here.");
  return h("div", { class: "field" }, h("label", {}, "Signatures", h("span", { class: "req" }, " *")),
    h("p", { class: "hintline", style: "margin:0 0 8px" }, "Each member signs by typing their full name, exactly as it appears on the roster."),
    h("div", { class: "signs" }, names.map((n) => {
      const s = a.signatures[n] || (a.signatures[n] = { sig: "", date: "" });
      const id = newId("sg");
      const stamp = h("span", { class: "signdate" });
      const show = () => { stamp.textContent = s.date ? "Signed " + new Date(s.date + "T12:00").toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) : ""; };
      const inp = h("input", { id, class: "signin" + (s.date ? " signed" : ""), placeholder: n, autocomplete: "off", oninput: (e) => {
        s.sig = e.target.value; const ok = s.sig.trim().toLowerCase() === n.toLowerCase();
        s.date = ok ? (s.date || today()) : ""; e.target.classList.toggle("signed", ok); show(); commit(); renderRail(); } });
      inp.value = s.sig || ""; show();
      return h("div", { class: "signrow" }, h("label", { for: id }, n), inp, stamp);
    })));
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
      { addLabel: "Add session", blank: () => ({ date: today(), who: "" }) }));
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
  out.push(h("h3", {}, "Problems and fixes"), h("p", { class: "sub" }, "Your own troubleshooting record. When something like it breaks again, this is where you'll look first."), problemList(d.problems));
  if (!d.shots) d.shots = [];
  out.push(h("h3", {}, "Other screenshots and notes"), h("p", { class: "sub" }, "Anything worth keeping that isn't a deliverable: a settings page, an error, a before-and-after."),
    imageWell(d.shots, { prompt: "Add a screenshot", label: "Other screenshots" }), field("", d, "notes", { area: true, placeholder: "Notes for your team" }));
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

// Problems are cards, so each can carry its own screenshots.
function problemList(list) {
  const box = h("div", { class: "plist" });
  const draw = () => box.replaceChildren(
    ...list.map((p, i) => { if (!p.images) p.images = [];
      return h("div", { class: "pcard" },
        h("div", { class: "pcard-h" }, h("b", {}, `Problem ${i + 1}`), h("button", { class: "small ghost", onclick: () => ask("Remove this problem?", [h("p", {}, p.broke || "Untitled problem")], [["Cancel"], ["Remove", () => { list.splice(i, 1); commit(); draw(); }, "danger"]]) }, "Remove")),
        h("div", { class: "grid2" }, field("What broke", p, "broke", { area: true, wide: true, placeholder: "What you saw, and when" }),
          field("What you checked", p, "checked", { area: true }), field("What fixed it", p, "fixed", { area: true })),
        h("label", {}, "Screenshots"), imageWell(p.images, { prompt: "Add a screenshot", label: "Problem screenshots" })); }),
    h("button", { class: "small", onclick: () => { list.push({ broke: "", checked: "", fixed: "", images: [] }); commit(); draw(); box.querySelectorAll("textarea")[box.querySelectorAll("textarea").length - 3]?.focus(); } }, "+ Add problem"));
  draw(); return box;
}
