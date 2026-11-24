// ------------------------------------------------------------------ printed documents
const T = (s) => (s && String(s).trim()) ? esc(s) : '<span class="blank">Not filled in</span>';
const tbl = (cols, rows, cls = "") => `<table class="${cls}"><thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.map((r) => `<tr>${r.map((c) => `<td${c && c.mono ? ' class="mono"' : ""}>${c && c.html != null ? c.html : T(c && c.mono ? c.v : c)}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${cols.length}"><span class="blank">None</span></td></tr>`}</tbody></table>`;
const form = (rows) => `<table class="form"><tbody>${rows.map(([k, v, raw]) => `<tr><th>${esc(k)}</th><td>${raw ? v : T(v)}</td></tr>`).join("")}</tbody></table>`;
const mono = (v) => ({ mono: true, v });
const img = (id, cap) => images[id] ? `<figure><img src="${images[id]}" alt="">${cap ? `<figcaption>${esc(cap)}</figcaption>` : ""}</figure>` : "";
const sevTag = (s) => { const [n, c] = sevOf(s); return `<span class="sevtag" style="background:var(--${c})">${n} ${s.toFixed(1)}</span>`; };

function coverPage(kind, title, sub, rows, conf, clientLogo) {
  return `<section class="page cov"><div class="band"></div>
    <div class="logos">${doc.meta.logo ? `<img src="${doc.meta.logo}" alt="">` : `<span></span>`}${clientLogo || ""}</div>
    <div class="kick">Cyber Hub 1.0 · ${esc(kind)}</div><h1>${esc(title)}</h1>${sub ? `<p class="for">${esc(sub)}</p>` : ""}
    <dl>${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${T(v)}</dd>`).join("")}</dl>
    <p class="conf">${esc(conf)}</p></section>`;
}

// ---- Team Log
function logCoverHTML() {
  const c = doc.log.cover, a = doc.log.agreement;
  const sg = a.signatures || {};
  return coverPage("Team Log", doc.meta.company || "Team Log", "", [["Rack", c.rack], ["Semester", c.semester], ["Team", c.roster.map((x) => x.name.trim()).filter(Boolean).join(", ")]], "Team Log")
    + `<h1 class="s">Team</h1>${tbl(["Team member", "Email"], c.roster.filter((x) => x.name || x.email).map((x) => [x.name, x.email]))}`
    + `<h2 class="s">Team agreement</h2>${form([["Communication channels", c.chat], ["Absence policy", a.missed]])}`
    + tbl(["Team member", "Signature", "Date"], c.roster.map((x) => x.name.trim()).filter(Boolean).map((n) => [n, sg[n]?.date ? { html: `<span class="sig">${esc(sg[n].sig)}</span>` } : "", sg[n]?.date || ""]));
}
function restoreHTML() {
  const r = restoreData(), st = restoreStatusSync(r), yes = (v) => (v ? "Yes" : "No");
  let s = `<h2 class="s">Reset record</h2>${tbl(["Device", "Reset method", "Complete", "Proof", "Performed by"], r.resets.map((x) => [x.device, x.how, yes(x.done), x.checked, x.who]), "restore")}`;
  s += `<h2 class="s">Utility drawer</h2>${tbl(["Item", "Present", "Notes"], r.drawer.map((x) => [x.item, yes(x.present), x.note]))}`;
  s += `<h2 class="s">Instructor sign-off</h2>`;
  s += r.sign ? `<div class="card"><div class="ch"><b>Verified by ${esc(r.sign.by)}</b><span class="tag">${st === "changed" ? "Changed after signing" : "Signed"}</span></div>${form([["Date", r.sign.date], ["Sign-off code", r.sign.code]])}</div>`
    : `<p class="blank">Not signed off yet.</p>`;
  return s;
}
function hubHTML(l) {
  const d = doc.log.hubs[l.num] || { sessions: [], commands: "", problems: [], answers: {}, deliv: {}, extra: {} };
  let s = `<h1 class="s" style="break-before:page">Cyber Hub ${l.num}: ${esc(l.title)}</h1>`;
  s += `<h2 class="s">Sessions</h2>${tbl(["Date", "Contributions"], d.sessions.map((x) => [x.date, x.who]))}`;
  if (l.num !== "00") s += `<h2 class="s">Configuration changes</h2><p>${T(d.commands)}</p>`;
  if (l.num === "15") s += restoreHTML();
  if (d.extra.checkpoint) s += `<h2 class="s">Connectivity checkpoint</h2>${tbl(["Test", "Expected", "Result"], d.extra.checkpoint.map((x) => [x.test, x.expected, x.result]))}`;
  if (d.extra.roe) { const r = d.extra.roe; s += `<h2 class="s">Rules of engagement</h2>${form([["Target team", r.target], ["Assessing team", r.assessing], ["Scope", r.scope], ["Session", r.session], ["Agreed by", r.agreed]])}`; }
  if (!NO_TICKETS.includes(l.num)) s += `<h2 class="s">Troubleshooting tickets</h2>` + (d.problems.length ? d.problems.map((x, i) => `<div class="card"><div class="ch"><b>Ticket ${ticketId(l.num, i)}</b><span class="tag">${x.status === "resolved" ? "Resolved" : "Open"}</span></div>${form([["Issue", x.broke]])}<p class="lbl">Work log</p>${tbl(["#", "Date", "Hypothesis", "Test", "Result", "Outcome"], ticketLog(x).map((e, j) => [String(j + 1), e.date, e.hypothesis, e.test, e.result, e.outcome || "Untested"]), "worklog")}${form([["Resolution", x.fixed], ["Verification", x.verify]])}${(x.images || []).map((id) => img(id, "")).join("")}</div>`).join("") : `<p class="blank">No tickets.</p>`);
  if ((d.shots || []).length || (d.notes || "").trim()) s += `<h2 class="s">Additional evidence</h2>${(d.notes || "").trim() ? `<p>${esc(d.notes)}</p>` : ""}${(d.shots || []).map((id) => img(id, "")).join("")}`;
  if (l.questions.length) s += `<h2 class="s">Before you continue</h2>` + l.questions.map((q, i) => `<p><b>${esc(q)}</b></p><p>${T(d.answers[i])}</p>`).join("");
  if (l.deliverables.length) s += `<h2 class="s">Deliverables</h2>`;
  for (const x of l.deliverables) {
    const sep = SEPARATE[`${l.num}-${x.n}`], dv = d.deliv[x.n] || { images: [], note: "", link: "" };
    let body;
    if (sep) body = sep[0] === "link" ? `<p>${T(dv.link)}</p>` : `<p class="blank">${esc(sep[1])}</p>`;
    else body = dv.images.length ? dv.images.map((id, i) => img(id, `Cyber Hub ${l.num}, deliverable ${x.n}${dv.images.length > 1 ? ` (${i + 1})` : ""}`)).join("") : `<p class="blank">No ${x.kind.toLowerCase()} added yet.</p>`;
    s += `<div class="card"><div class="ch"><b>Deliverable ${x.n}: ${esc(x.title)}</b><span class="tag">${esc(x.kind)}</span></div><div class="cb">${body}</div></div>`;
  }
  return s;
}

// ---- VAR
function varHTML() {
  const v = V(), c = v.cover, fs = sortedFindings(), real = fs.filter((f) => f.status !== "false-positive"), fp = fs.filter((f) => f.status === "false-positive"), n = tally();
  const total = Math.max(1, real.length);
  let s = coverPage("Vulnerability Assessment Report", c.client ? `${c.client}` : "Vulnerability Assessment Report", c.clientRack ? `Rack ${c.clientRack}` : "",
    [["Prepared for", c.client + (c.clientRack ? `, Rack ${c.clientRack}` : "")], ["Prepared by", doc.meta.company], ["Assessment dates", c.dates], ["Report version", c.version], ["Assessment team", c.team], ["Client contact", c.contact]],
    "Confidential: for the client and instructor only");
  s += `<h1 class="s">1. Executive summary</h1><p>${T(v.summary)}</p>`;
  s += `<table class="counts"><thead><tr><th style="border-top-color:var(--crit)">Critical</th><th style="border-top-color:var(--high)">High</th><th style="border-top-color:var(--med)">Medium</th><th style="border-top-color:var(--low)">Low</th><th>Total</th></tr></thead><tbody><tr><td>${n.crit}</td><td>${n.high}</td><td>${n.med}</td><td>${n.low}</td><td>${real.length}</td></tr></tbody></table>`;
  s += `<div class="bar5">${[["crit", n.crit], ["high", n.high], ["med", n.med], ["low", n.low]].filter((x) => x[1]).map(([k, x]) => `<i style="background:var(--${k});width:${x / total * 100}%"></i>`).join("")}</div>`;
  s += `<p><b>Top priorities</b></p><ol>${v.recs.slice(0, 3).map((r) => `<li>${T(r.action)}</li>`).join("") || "<li><span class='blank'>None yet</span></li>"}</ol>`;
  s += `<h1 class="s">2. Scope and rules of engagement</h1><h2 class="s">In scope</h2>${tbl(["Target", "Address or range", "Notes"], v.scope.map((r) => [r.target, mono(r.range), r.notes]))}`;
  s += `<h2 class="s">Out of scope</h2><p>${T(v.outScope)}</p><h2 class="s">Rules of engagement</h2>${form([["Agreed on", v.roe.agreedOn], ["Agreed by", v.roe.agreedBy], ["Assessment window", v.roe.window], ["Restrictions", v.roe.restrictions]])}`;
  s += `<h1 class="s">3. Method</h1>${tbl(["Step", "Tool and settings", "Purpose"], v.method.map((r) => [r.step, r.tool, r.purpose]))}`;
  s += `<h1 class="s">4. Hosts found</h1>${tbl(["Address", "Role", "Open ports", "View", "Notes"], v.hosts.map((r) => [mono(r.ip), r.role, mono(r.ports), r.view, r.notes]))}<h2 class="s">Comparing the two views</h2><p>${T(v.compare)}</p>`;
  s += `<h1 class="s">5. Findings summary</h1>${tbl(["ID", "Finding", "Hosts", "Severity", "Status"], fs.map((f) => [fid(f), f.title, mono(f.hosts.join(", ")), { html: sevTag(scoreOf(f)) }, statusName(f.status)]))}`;
  s += `<h1 class="s" style="break-before:page">6. Finding details</h1>`;
  for (const f of real) {
    s += `<div class="card"><div class="ch"><div><b>${fid(f)} ${T(f.title)}</b><code>${vector(f.v)}</code></div>${sevTag(scoreOf(f))}</div>${form([
      ["Host and port", [f.hosts.join(", "), f.port].filter(Boolean).join(", ")], ["View", viewName(f.view)], ["Status", statusName(f.status)],
      ["Description", f.what], ["Impact", f.why], ["Evidence", f.evidence], ["Validation", f.confirm], ["Remediation", f.fix]])}
      ${f.images.map((id, i) => img(id, `${fid(f)} evidence${f.images.length > 1 ? ` ${i + 1}` : ""}`)).join("")}</div>`;
  }
  if (fp.length) s += `<h2 class="s">Ruled out</h2>` + fp.map((f) => `<p><b>${fid(f)} ${T(f.title)}</b>: false positive. ${esc(f.confirm || f.evidence)}</p>`).join("");
  s += `<h1 class="s">7. Recommendations in priority order</h1>${tbl(["Priority", "Findings", "Remediation", "Effort"], v.recs.map((r, i) => [String(i + 1), r.findings.map((id) => { const f = v.findings.find((x) => x.id === id); return f ? fid(f) : ""; }).filter(Boolean).join(", "), r.action, r.effort]))}`;
  s += `<h1 class="s">Appendix: Severity scale</h1><p>Severity is the CVSS 3.1 base score set by the assessors for this network. Greenbone's own scores were used as a starting point.</p>${tbl(["Severity", "CVSS score"], [["Critical", "9.0 to 10.0"], ["High", "7.0 to 8.9"], ["Medium", "4.0 to 6.9"], ["Low", "0.1 to 3.9"]])}`;
  return s;
}

// ---- SSP
function sspHTML() {
  const s = S(), i = s.ident;
  let o = coverPage("System Security Plan", doc.meta.company || "System Security Plan", i.name, [["System", i.name], ["Location", i.location], ["Status", i.status], ["System owner", s.approval.owner], ["Approved", s.approval.date]], "Confidential: internal use only");
  o += `<h1 class="s">1. System identification</h1>${form([["System name", i.name], ["Purpose", i.purpose], ["Location", i.location], ["Operational status", i.status], ["Users", i.users], ["Internet connection", i.internet]])}`;
  o += `<h1 class="s">2. System description</h1><p>${T(s.description)}</p>`;
  o += `<h1 class="s">3. Network diagram</h1>${s.diagram ? img(s.diagram, "Network diagram, exported from the Network Diagram app") : `<p class="blank">No diagram added.</p>`}`;
  o += `<h1 class="s">4. Hardware and software inventory</h1>${tbl(["Device", "Model", "Role", "Address", "OS or firmware"], s.inventory.map((r) => [r.device, r.model, r.role, mono(r.address), r.os]))}`;
  if (s.addressing.length) o += `<h2 class="s">Addressing table</h2>${tbl(["Device", "Hostname", "Interface", "VLAN", "IP address", "Mask", "Gateway"], s.addressing.map((r) => [r.device, r.hostname, r.iface, r.vlan, mono(r.address), mono(r.mask), mono(r.gateway)]))}`;
  o += `<h1 class="s">5. Ports, protocols and services</h1>${tbl(["Host", "Port and protocol", "Service", "Exposure", "Business need"], s.ports.map((r) => [mono(r.host), r.port, r.service, r.who, r.why]))}`;
  o += `<h1 class="s" style="break-before:page">6. Security controls</h1>`;
  for (const [id, name, req] of CONTROLS) { const c = s.controls[id] || {}; o += `<h2 class="s">${id} ${esc(name)}</h2>${form([["Requirement", req], ["Implementation", c.how], ["Status", c.status]])}`; }
  o += `<h1 class="s">7. Accepted risks</h1>${tbl(["Risk", "Justification", "Mitigating factors", "Accepted by", "Date"], s.risks.map((r) => [r.risk, r.why, r.limits, r.by, r.date]))}`;
  o += `<h1 class="s">8. Plan of Action and Milestones (POA&amp;M)</h1>${tbl(["ID", "Weakness", "Source", "Severity", "Response", "Plan", "Owner", "Target date", "Status", "Verified by"], s.poam.map((r) => [r.pid, r.weakness, r.source, r.severity, r.response, r.fix, r.owner, r.date, r.status, r.verified]))}`;
  o += `<h1 class="s">9. Assessment history</h1>${tbl(["Date", "Activity", "Performed by", "Result"], s.history.map((r) => [r.date, r.activity, r.by, r.result]))}`;
  o += `<h1 class="s">10. Approval</h1><p>By signing, the system owner confirms this plan describes the system as built and accepts the risks in Section 7.</p>${form([["System owner", s.approval.owner], ["Signature", s.approval.signature ? `<span class="sig">${esc(s.approval.signature)}</span>` : T(""), true], ["Date", s.approval.date]])}`;
  return o;
}

// ---- the network diagram, drawn by the Diagram tab
let diagramImg = "";
function diagramHTML(note) {
  return `<h1 class="s" style="break-before:page">Network diagram</h1>` + (diagramImg
    ? `<figure><img src="${diagramImg}" alt="Network diagram"><figcaption>${esc(note)}</figcaption></figure>`
    : `<p class="blank">The diagram is empty. Fill it in on the Diagram tab.</p>`);
}

// ---- export
async function exportDoc(kind, arg) {
  diagramImg = await diagramPNG();
  if (doc.log.hubs["15"]?.extra?.restore?.sign) await sealOk(restoreData());
  let html, missing = [], title;
  const co = doc.meta.company || "Team";
  if (kind === "log-hub") {
    const l = LABS.find((x) => x.num === arg);
    title = `${co} Team Log, Cyber Hub ${l.num}`;
    html = (l.num === "00" ? logCoverHTML() : `<p class="runhead">${esc(co)} · Team Log</p>`) + hubHTML(l).replace('style="break-before:page"', "")
      + diagramHTML(`The diagram as of this export, Cyber Hub ${l.num}.`);
    if (!diagramImg && l.num !== "00") missing.push("Your network diagram (Diagram tab)");
    const d = doc.log.hubs[l.num];
    if (!d || !d.sessions.length) missing.push("A session entry");
    l.questions.forEach((q, i) => { if (!(d?.answers[i] || "").trim()) missing.push("An answer to: " + q.slice(0, 70) + (q.length > 70 ? "…" : "")); });
    l.deliverables.forEach((x) => { if (!SEPARATE[`${l.num}-${x.n}`] && !(d?.deliv[x.n]?.images || []).length) missing.push(`Deliverable ${x.n}: ${x.title}`); });
  } else if (kind === "log") {
    title = `${co} Team Log`;
    html = logCoverHTML() + diagramHTML("The diagram as of this export.") + LABS.map(hubHTML).join("");
    LABS.forEach((l) => { const st = hubStatus(l); if (st !== "done") missing.push(`Cyber Hub ${l.num} is ${st ? "incomplete" : "empty"}`); });
  } else if (kind === "var") { title = `${co} VAR for ${V().cover.client || "client"}`; html = varHTML(); missing = varMissing().map((x) => x[1]); }
  else if (kind === "diagram") {
    title = `${co} network diagram`;
    html = `<p class="runhead">${esc(co)}</p>` + diagramHTML("Exported " + new Date().toLocaleDateString()).replace(' style="break-before:page"', "");
    if (!diagramImg) missing.push("The diagram itself");
  }
  else { title = `${co} System Security Plan`; html = sspHTML(); missing = sspMissing().map((x) => x[1]); }
  const go = () => {
    $("print").innerHTML = `<div class="doc">${html}</div>`;
    const old = document.title; document.title = title;
    const imgs = [...$("print").querySelectorAll("img")];
    Promise.all(imgs.map((i) => i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; }))).then(() => {
      setTimeout(() => { try { window.print(); } catch {} document.title = old; }, 50);
    });
  };
  const tip = h("p", { class: "hintline" }, "In the print window, set Destination to Save as PDF. Turn off Headers and footers under More settings.");
  if (missing.length) ask("Some parts are still empty", [h("p", {}, "You can export anyway. These will show as \"Not filled in\":"), h("ul", { class: "missing-list" }, missing.slice(0, 12).map((m) => h("li", {}, m)), missing.length > 12 ? h("li", {}, `and ${missing.length - 12} more`) : null), tip], [["Go back"], ["Export anyway", go, "primary"]]);
  else ask("Export as PDF", [h("p", {}, "Your browser's print window opens next."), tip], [["Cancel"], ["Continue", go, "primary"]]);
}
