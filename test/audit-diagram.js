// Fill a diagram the way a finished team would, with long but realistic values, then check every SVG label stays
// inside its box, no × is covered, and no two labels collide.
const { chromium } = require('playwright');
const R = 4;
const full = () => {
  const P = (d, port) => ({ device: d, port });
  const L = (id, a, b) => ({ id, a, b });
  return { v: 2, meta: { company: "Northwind Security Consulting" }, devices: [
    { id: "isp", kind: "isp", address: `10.${R}.200.1`, mask: "24" },
    { id: "isplap", kind: "laptop", hostname: "nw-ext-laptop-01", address: "198.51.100.137", mask: "24", gateway: "198.51.100.1" },
    { id: "fw", kind: "firewall", hostname: "nw-fgt60e-perimeter", interfaces: [
      { name: "wan1", address: `10.${R}.200.2`, mask: "24" }, { name: "internal", address: `10.${R}.100.1`, mask: "24" },
      { name: "dmz", address: `10.${R}.40.1`, mask: "24" }, { name: "guest Wi-Fi", address: `10.${R}.50.1`, mask: "24", ssid: "Northwind-Guest-WiFi" }],
      routes: [{ dest: `10.${R}.0.0/16`, nextHop: `10.${R}.100.254` }, { dest: "0.0.0.0/0", nextHop: `10.${R}.200.1` }],
      vips: [{ name: "VIP-HTTP" }, { name: "VIP-FTP" }], policies: [{ name: "Internal_to_DMZ" }] },
    { id: "guest", kind: "laptop", hostname: "visitor-laptop", dhcp: true },
    { id: "sw", kind: "switch", hostname: "nw-core-sw01", oob: { address: "192.168.1.254", mask: "24" },
      svis: [10, 20, 30, 100].map((v) => ({ vlan: String(v), address: `10.${R}.${v}.254`, mask: "24" })),
      routes: [{ dest: "0.0.0.0/0", nextHop: `10.${R}.100.1` }], dhcpPools: [{}],
      ports: ["XG1","XG2","XG3","XG4","XG5","XG6","XG7","XG8","XG9","XG10","XG11","XG12","OOB"].map((n) => {
        const m = { XG1: ["access", "100"], XG2: ["access", "40"], XG3: ["trunk", "10", ["20", "40"]], XG4: ["access", "30"], XG5: ["access", "10"], XG9: ["access", "20"], XG10: ["access", "20"], XG11: ["access", "20"], XG12: ["access", "20"] }[n];
        if (["XG6","XG7","XG8"].includes(n)) return { name: n, mode: "access", pvid: "999", tagged: [], shutdown: true };
        return m ? { name: n, mode: m[0], pvid: m[1], tagged: m[2] || [], shutdown: false } : { name: n, mode: "", pvid: "", tagged: [], shutdown: false };
      }) },
    { id: "hv", kind: "hypervisor", hostname: "nw-pve-host01", address: `10.${R}.10.10`, mask: "24", gateway: `10.${R}.10.254` },
    { id: "vmweb", kind: "vm", host: "hv", hostname: "nw-web01", address: `10.${R}.40.10`, mask: "24", gateway: `10.${R}.40.1`, vlanTag: "40" },
    { id: "vmftp", kind: "vm", host: "hv", hostname: "nw-ftp01", address: `10.${R}.40.11`, mask: "24", gateway: `10.${R}.40.1`, vlanTag: "40" },
    { id: "vmscan", kind: "vm", host: "hv", hostname: "nw-scanner", address: `10.${R}.10.20`, mask: "24", gateway: `10.${R}.10.254`, vlanTag: "" },
    { id: "nas", kind: "nas", hostname: "nw-nas-ds220", address: `10.${R}.30.10`, mask: "24", gateway: `10.${R}.30.254` },
    { id: "admin", kind: "laptop", hostname: "nw-admin-lt01", address: `10.${R}.10.5`, mask: "24", gateway: `10.${R}.10.254` },
    { id: "pi", kind: "pi", hostname: "vuln-pi", dhcp: true },
    { id: "lap", kind: "laptop", hostname: "nw-team-lt03", dhcp: true },
  ], links: [
    L("l1", P("isp", "Uplink"), P("fw", "wan1")), L("l2", P("isp", "Internet Wi-Fi"), P("isplap", "")),
    L("l3", P("fw", "internal"), P("sw", "XG1")), L("l4", P("fw", "dmz"), P("sw", "XG2")), L("l5", P("fw", "guest Wi-Fi"), P("guest", "")),
    L("l6", P("sw", "XG3"), P("hv", "")), L("l7", P("sw", "XG4"), P("nas", "")), L("l8", P("sw", "XG5"), P("admin", "")),
    L("l9", P("sw", "XG9"), P("pi", "")), L("l10", P("sw", "XG10"), P("lap", "")), L("l11", P("sw", "OOB"), P("lap", "")),
  ] };
};
(async () => {
  const b = await chromium.launch(); const out = [];
  for (const [label, logo] of [["no logo", false], ["logo", true]]) {
    const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
    await p.addInitScript(() => { try { localStorage.setItem('cyberhub-reports-welcome', '1'); } catch {} });
    await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(400);
    await p.evaluate(([d, logo]) => { doc.diagram = d; doc.meta.company = d.meta.company; doc.log.cover.rack = "4";
      if (logo) { const c = document.createElement('canvas'); c.width = 300; c.height = 120; const x = c.getContext('2d'); x.fillStyle = '#036'; x.fillRect(0, 0, 300, 120); doc.meta.logo = c.toDataURL('image/png'); }
      commit(); }, [full(), logo]);
    await p.click('[data-tab=diagram]'); await p.waitForTimeout(900);
    const f = p.frames().find((x) => x.url().includes('diagram.html'));
    const issues = await f.evaluate(() => {
      const svg = document.querySelector('svg'); const bad = [];
      const box = (e) => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; };
      const inside = (a, c, pad = 0.5) => a.l >= c.l - pad && a.r <= c.r + pad && a.t >= c.t - pad && a.b <= c.b + pad;
      const hit = (a, c) => a.l < c.r - 0.5 && a.r > c.l + 0.5 && a.t < c.b - 0.5 && a.b > c.t + 0.5;
      // 1. every label inside its own shape (the nearest group's first rect)
      for (const t of svg.querySelectorAll('text')) {
        if (!t.textContent.trim()) continue;
        let g = t.parentElement, shape = null;
        while (g && g !== svg) { shape = [...g.children].find((c) => c.tagName === 'rect'); if (shape) break; g = g.parentElement; }
        if (!shape || t.closest('.legend')) continue;
        if (!inside(box(t), box(shape))) bad.push(`text "${t.textContent}" spills out of its ${shape.getAttribute('class') || 'box'}`);
      }
      // 2. no × covered: test the point under each ×'s centre
      for (const u of svg.querySelectorAll('.unplug')) {
        const r = u.querySelector('circle').getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2;
        const top = document.elementFromPoint(x, y);
        if (!top || !u.contains(top)) bad.push(`× for ${u.getAttribute('data-unplug')} is covered by ${top?.getAttribute('class') || top?.tagName}`);
      }
      // 3. labels from different groups don't collide
      const T = [...svg.querySelectorAll('text')].filter((t) => t.textContent.trim()).map((t) => [t, box(t)]);
      for (let i = 0; i < T.length; i++) for (let j = i + 1; j < T.length; j++) {
        if (T[i][0].parentElement === T[j][0].parentElement && T[i][0].closest('.legend')) continue;
        if (hit(T[i][1], T[j][1])) bad.push(`"${T[i][0].textContent}" overlaps "${T[j][0].textContent}"`);
      }
      return bad;
    });
    out.push([label, issues]);
    
    // the table view
    await f.click('#t-table'); await p.waitForTimeout(300);
    const tbl = await f.evaluate(() => [...document.querySelectorAll('.tableview *')].filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX !== 'visible' && getComputedStyle(e).overflowX !== 'auto').map((e) => e.tagName + '.' + e.className));
    out.push([label + ' table overflow', tbl]);

    await p.close();
  }
  for (const [k, v] of out) console.log(k + ':', v.length ? '\n  ' + v.join('\n  ') : 'none');
  await b.close();
})();
