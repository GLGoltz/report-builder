// Visual sweep of the Report Builder: every view at three widths. Flags horizontal page scroll, clipped text,
// cut-off placeholders, text that collides with other text, and controls pushed outside their container.
const { chromium } = require('playwright');
const SHOT = process.argv[2];
const CHECK = () => {
  const bad = [], vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && !e.closest('[hidden],#print,.offstage,.sr'); };
  const name = (e) => (e.id ? '#' + e.id : e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).join('.') : '')) + ' "' + (e.textContent || e.placeholder || '').trim().slice(0, 40) + '"';
  const de = document.documentElement;
  if (de.scrollWidth > de.clientWidth + 1) bad.push('page scrolls sideways: ' + de.scrollWidth + ' > ' + de.clientWidth);
  const modalOpen0 = !document.getElementById('modal').hidden;
  for (const e of document.querySelectorAll('body *')) {
    if (modalOpen0 && !e.closest('#modal')) continue;
    if (!vis(e) || ['svg', 'path', 'IFRAME'].includes(e.tagName)) continue;
    const s = getComputedStyle(e);
    // text clipped by overflow hidden / ellipsis
    if (e.tagName !== 'CAPTION' && (s.overflowX === 'hidden' || s.textOverflow === 'ellipsis') && e.scrollWidth > e.clientWidth + 2 && e.textContent.trim() && !['INPUT', 'TEXTAREA', 'SELECT'].includes(e.tagName)) bad.push('clipped text: ' + name(e));
    // placeholder cut off in an empty input
    if ((e.tagName === 'INPUT' && !e.value && e.placeholder && !['checkbox', 'file', 'date'].includes(e.type)) || (e.tagName === 'TEXTAREA' && !e.value && e.placeholder && e.clientHeight < 30)) {
      const c = document.createElement('canvas').getContext('2d'); c.font = s.font;
      const w = c.measureText(e.placeholder).width, room = e.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight);
      if (w > room + 1) bad.push(`placeholder cut off (${Math.round(w)} > ${Math.round(room)}): ` + name(e));
    }
    // a child sticking out of a box that clips or has a border
    if (e.children.length === 0 && e.tagName !== 'CAPTION' && e.textContent.trim() && e.parentElement) {
      const p = e.parentElement, pr = p.getBoundingClientRect(), r = e.getBoundingClientRect(), ps = getComputedStyle(p);
      if ((ps.borderLeftWidth !== '0px' || ps.backgroundColor !== 'rgba(0, 0, 0, 0)') && (r.right > pr.right + 1.5 || r.left < pr.left - 1.5) && ps.overflowX !== 'auto') bad.push('sticks out of its box: ' + name(e));
    }
  }
  // text-on-text collisions between leaf elements
  const modalOpen = !document.getElementById('modal').hidden;
  const floating = (e) => e.closest('#toast,.menu-list,.toast') || (modalOpen && !e.closest('#modal'));
  const leaves = [...document.querySelectorAll('body *')].filter((e) => vis(e) && !floating(e) && e.textContent.trim() && ![...e.children].some((c) => c.textContent.trim()) && !e.closest('svg'));
  const R = leaves.map((e) => [e, e.getBoundingClientRect()]);
  for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) {
    const [a, ra] = R[i], [b, rb] = R[j];
    if (a.contains(b) || b.contains(a)) continue;
    const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left), oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
    if (ox > 3 && oy > 3) bad.push(`overlap: ${name(a)} / ${name(b)}`);
  }
  return [...new Set(bad)];
};
(async () => {
  const b = await chromium.launch(); const all = {};
  const p = await b.newPage({ viewport: { width: 1366, height: 900 } });
  await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(500);
  // the welcome, at three widths
  for (const w of [1366, 820, 390]) { await p.setViewportSize({ width: w, height: 900 }); await p.waitForTimeout(150); all[`welcome @${w}`] = await p.evaluate(CHECK); if (SHOT && w === 390) await p.screenshot({ path: `${SHOT}/welcome-390.png` }); }
  await p.setViewportSize({ width: 1366, height: 900 }); await p.click('#m-acts >> text=I understand');
  // seed realistic content
  await p.evaluate(() => { doc.meta.company = 'Northwind Security Consulting Group'; Object.assign(doc.log.cover, { rack: '4', semester: 'Spring 2027', chat: 'Discord server #northwind, and a group text for urgent issues' });
    doc.log.cover.roster = [['Ana Ramos-Villanueva', 'aramos@student.chaffey.edu'], ['Jay Lee', 'jlee@student.chaffey.edu'], ['Priya Natarajan', 'pnatarajan@student.chaffey.edu'], ['Marcus Okafor-Williams', 'mokafor@student.chaffey.edu']].map(([n, e]) => ({ name: n, email: e }));
    doc.log.agreement.missed = 'They read the Team Log before the next lab and the person who typed walks them through it.';
    const d = hubData('05'); d.sessions.push({ date: today(), who: 'Ana configured the DHCP pool; Jay tested from XG10' }); d.problems.push({ broke: 'Laptop on XG10 got a 169.254 address', theory: 'Port in the wrong VLAN', checked: 'show vlan', fixed: 'Set XG10 access VLAN 20', verify: 'ipconfig shows 10.4.20.101', status: 'resolved', images: [] });
    commit(); });
  let [fc] = await Promise.all([p.waitForEvent('filechooser'), (async () => { await p.click('[data-tab=var]'); await p.click('.step:has-text("Hosts found")'); await p.click('text=Import Nmap results'); })()]);
  await fc.setFiles('nmap-internal.xml'); await p.waitForTimeout(200); await p.click('#m-acts >> text=Internal view');
  await p.click('.step:has-text("Triage")');
  [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('text=Import Greenbone report')]); await fc.setFiles('greenbone.xml'); await p.waitForTimeout(200);
  await p.locator('.flist .frow').first().click(); await p.click('#panel >> text=Make a finding'); await p.waitForTimeout(200); await p.evaluate(() => { const t = document.getElementById('toast'); if (t) t.remove(); });
  await p.evaluate(() => { doc.var.cover.clientRack = '6'; commit(); });
  // walk every view
  for (const tab of ['log', 'var', 'ssp', 'ref']) {
    await p.click(`[data-tab=${tab}]`); await p.waitForTimeout(150);
    const steps = await p.locator('#rail .step').count();
    for (let i = 0; i < steps; i++) {
      await p.setViewportSize({ width: 1366, height: 900 });
      const st = p.locator('#rail .step').nth(i); const label = (await st.innerText()).split('\n')[0].trim();
      await st.click(); await p.waitForTimeout(120);
      for (const w of [1366, 820, 390]) {
        await p.setViewportSize({ width: w, height: 900 }); await p.waitForTimeout(80);
        const r = await p.evaluate(CHECK); if (r.length) all[`${tab} / ${label} @${w}`] = r;
        if (SHOT && r.length) await p.screenshot({ path: `${SHOT}/${tab}-${i}-${w}.png`, fullPage: true });
      }
    }
  }
  // the menu open
  await p.setViewportSize({ width: 390, height: 900 }); await p.click('#b-file'); await p.waitForTimeout(100);
  const m = await p.evaluate(CHECK); if (m.length) all['menu @390'] = m;
  for (const [k, v] of Object.entries(all)) if (v.length) console.log(k + '\n  ' + v.join('\n  '));
  console.log('views with issues:', Object.values(all).filter((v) => v.length).length);
  await b.close();
})();
