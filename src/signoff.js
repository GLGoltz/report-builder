// ------------------------------------------------------------------ Cyber Hub 15: restoration record and sign-off
// Like a decommissioning record (NIST SP 800-88's certificate of sanitization): every device reset, how the team
// checked it, the drawer inventory, then an instructor's sign-off.
//
// The instructor signs with a password only the instructors know. This file holds a salted PBKDF2 hash of it
// (half of the derived bits), so the app can tell the right password from a typo but can't reveal it. The other
// half of the derived bits never leaves the instructor's browser: it keys an HMAC of the record, shown as the
// sign-off code. A student can't make a valid code, and an instructor can check any code with Check a sign-off.
// If the record changes after signing, the app says so. To change the password: node tools/signoff-hash.mjs.
const SIGNOFF = { salt: "4a0f3c38c2e47c05bca82d13991b02a0", iter: 600000, check: "dc83abbb7a6782d980462b7e8f126f4a0d790228ebb822dc928f202eb44e160a" };

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const normPw = (s) => String(s).normalize("NFKC").toLowerCase().replace(/[\s\-_.]+/g, "");
async function signoffKey(pw) {
  const enc = new TextEncoder();
  const base = await crypto.subtle.importKey("raw", enc.encode(normPw(pw)), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc.encode(SIGNOFF.salt), iterations: SIGNOFF.iter }, base, 512);
  if (hex(bits.slice(0, 32)) !== SIGNOFF.check) return null;
  return crypto.subtle.importKey("raw", bits.slice(32), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}
function restoreData() {
  const d = hubData("15");
  const r = d.extra.restore || (d.extra.restore = {});
  // Rebuild the rows only when the lists change (a new drawer list, say), keeping what the team entered.
  // Otherwise keep the same objects, because the page's checkboxes hold on to them.
  const same = (a, keys) => Array.isArray(a) && a.length === keys.length && a.every((x, i) => x && x[keys === DRAWER ? "item" : "device"] === keys[i]);
  const devs = RESETS.map(([d]) => d);
  if (!same(r.resets, devs)) r.resets = RESETS.map(([dev, how]) => { const o = (r.resets || []).find((x) => x.device === dev) || {}; return { device: dev, how, done: !!o.done, checked: o.checked || "", who: o.who || "" }; });
  else r.resets.forEach((x, i) => { x.how = RESETS[i][1]; });
  if (!same(r.drawer, DRAWER)) r.drawer = DRAWER.map((item) => { const o = (r.drawer || []).find((x) => x.item === item) || {}; return { item, present: !!o.present, note: o.note || "" }; });
  r.sign = r.sign || null;
  return r;
}
// What the signature covers: the team, the rack and every tick, plus who signed and when.
function restoreCanon(r, sign) {
  return JSON.stringify({ company: doc.meta.company || "", rack: String(doc.log.cover.rack || ""), team: members(),
    resets: r.resets.map((x) => [x.device, x.done]), drawer: r.drawer.map((x) => [x.item, x.present]), by: sign.by, date: sign.date });
}
async function sha(s) { return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))); }
async function makeCode(key, canon) {
  const h = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(canon))).slice(0, 10).toUpperCase();
  return h.slice(0, 5) + "-" + h.slice(5);
}
const restoreComplete = (r) => r.resets.every((x) => x.done) && r.drawer.every((x) => x.present);
let sealState = { key: "", ok: true };
async function sealOk(r) {
  if (!r.sign) return true;
  const c = restoreCanon(r, r.sign);
  if (sealState.key === c) return sealState.ok;
  sealState = { key: c, ok: (await sha(c)) === r.sign.seal };
  return sealState.ok;
}
function restoreStatusSync(r) { return r.sign && sealState.key === restoreCanon(r, r.sign) ? (sealState.ok ? "signed" : "changed") : r.sign ? "signed" : "open"; }

function restoreSection() {
  const r = restoreData();
  const signBox = h("div", { class: "card signoff" });
  const refresh = () => { drawSign(); renderRail(); };
  const tick = (row, key) => h("label", { class: "tickbox" }, h("input", { type: "checkbox", checked: row[key] || null, "aria-label": key === "done" ? row.device + " reset" : row.item + " in the drawer",
    onchange: (e) => { row[key] = e.target.checked; commit(); refresh(); } }));
  const txt = (row, key, ph, label) => { const t = h("textarea", { rows: 1, placeholder: ph, "aria-label": label, oninput: (e) => { row[key] = e.target.value; commit(); } }); t.value = row[key]; autosize(t); return t; };
  const resetTable = h("div", { class: "tablewrap" }, h("div", { class: "tbox" }, h("table", { class: "edit restore" },
    h("thead", {}, h("tr", {}, h("th", { style: "width:17%" }, "Device"), h("th", { style: "width:24%" }, "Reset method"), h("th", { style: "width:9%;text-align:center" }, "Complete"), h("th", {}, "Proof"), h("th", { style: "width:16%" }, "Performed by"))),
    h("tbody", {}, r.resets.map((x) => h("tr", {}, h("td", {}, h("span", { class: "fixed" }, x.device)), h("td", {}, h("span", { class: "fixed" }, x.how)), h("td", { class: "ctr" }, tick(x, "done")),
      h("td", {}, txt(x, "checked", "Proof", x.device + ": proof")), h("td", {}, txt(x, "who", "Name", x.device + ": performed by"))))))));
  const drawerTable = h("div", { class: "tablewrap" }, h("div", { class: "tbox" }, h("table", { class: "edit restore" },
    h("thead", {}, h("tr", {}, h("th", { style: "width:41%" }, "Item"), h("th", { style: "width:12%;text-align:center" }, "Present"), h("th", {}, "Notes"))),
    h("tbody", {}, r.drawer.map((x) => h("tr", {}, h("td", {}, h("span", { class: "fixed" }, x.item)), h("td", { class: "ctr" }, tick(x, "present")),
      h("td", {}, txt(x, "note", "Missing or damaged", x.item + ": notes"))))))));

  function drawSign() {
    const done = restoreComplete(r);
    if (r.sign) {
      const st = h("p", { class: "hintline" }, "Checking…");
      sealOk(r).then((ok) => { st.replaceWith(ok ? h("p", { class: "hintline" }, "The record hasn't changed since it was signed.")
        : h("p", { class: "note warn" }, "The record changed after it was signed. Ask the instructor to check the rack and sign again.")); renderRail(); });
      signBox.replaceChildren(h("div", { class: "signed-by" }, h("span", { class: "seal", "aria-hidden": "true" }, "✓"),
          h("div", {}, h("b", {}, `Verified by ${r.sign.by}`), h("div", {}, `${fmtDate(r.sign.date)} · Sign-off code `, h("code", {}, r.sign.code)))),
        st, h("div", { class: "tools" }, h("button", { class: "small", onclick: () => checkDialog(r) }, "Check a sign-off (instructors)"),
          h("button", { class: "small ghost", onclick: () => ask("Remove the sign-off?", [h("p", {}, "The instructor will need to check the rack and sign again.")],
            [["Cancel"], ["Remove", () => { r.sign = null; commit(); refresh(); }, "danger"]]) }, "Remove sign-off")));
      return;
    }
    const name = h("input", { id: "so-name", autocomplete: "off", placeholder: "Instructor's name" });
    const pw = h("input", { id: "so-pw", type: "password", autocomplete: "off", placeholder: "Instructor password" });
    const msg = h("p", { class: "hintline", role: "status" });
    const go = async () => {
      if (!name.value.trim()) { msg.textContent = "Type the instructor's name."; name.focus(); return; }
      msg.textContent = "Checking…";
      let key = null; try { key = await signoffKey(pw.value); } catch { msg.textContent = "This browser can't sign. Open the Report Builder from its usual address in Chrome or Edge."; return; }
      if (!key) { msg.textContent = "That password isn't right."; pw.value = ""; pw.focus(); return; }
      const sign = { by: name.value.trim(), date: today() };
      const canon = restoreCanon(r, sign);
      sign.code = await makeCode(key, canon); sign.seal = await sha(canon);
      r.sign = sign; sealState = { key: canon, ok: true }; commit(); refresh(); toast("Signed off.");
    };
    pw.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
    signBox.replaceChildren(
      done ? h("p", {}, "Your record is complete. Your instructor will check the rack and the drawer, then sign here.")
           : h("p", { class: "note" }, "Complete every row first. Your instructor will check the rack and the drawer before signing."),
      h("div", { class: "grid2" }, h("div", { class: "field" }, h("label", { for: "so-name" }, "Instructor"), name), h("div", { class: "field" }, h("label", { for: "so-pw" }, "Password"), pw)),
      h("div", { class: "tools" }, h("button", { class: "primary", disabled: done ? null : "", onclick: go }, "Sign off")), msg);
  }
  drawSign();
  return [h("h3", {}, "Reset record"),
    h("p", { class: "sub" }, "Check off each device once it's been reset and verified, and record your proof."), resetTable,
    h("h3", {}, "Utility drawer"),
    h("p", { class: "sub" }, "Check off each item as it goes back in the drawer, and note anything that's missing or damaged."), drawerTable,
    h("h3", {}, "Instructor sign-off"), signBox];
}
function checkDialog(r) {
  const pw = h("input", { type: "password", autocomplete: "off", placeholder: "Instructor password", "aria-label": "Instructor password" });
  const out = h("p", { role: "status" });
  const run = async () => {
    out.textContent = "Checking…";
    const key = await signoffKey(pw.value).catch(() => null);
    if (!key) { out.textContent = "That password isn't right."; return; }
    const ok = (await makeCode(key, restoreCanon(r, r.sign))) === r.sign.code;
    out.className = ok ? "note" : "note warn";
    out.textContent = ok ? `Genuine. ${r.sign.by} signed this record on ${fmtDate(r.sign.date)}, and nothing has changed since.` : "Not genuine. Either this code wasn't made with the instructor password, or the record was changed after it was signed.";
  };
  pw.addEventListener("keydown", (e) => { if (e.key === "Enter") run(); });
  ask("Check a sign-off", [h("p", {}, "For instructors only. Enter the instructor password to confirm that an instructor signed off on this exact record."), pw, out],
    [["Close"], ["Check", run, "primary", true]]);
}
function fmtDate(d) { return d ? new Date(d + "T12:00").toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) : ""; }
