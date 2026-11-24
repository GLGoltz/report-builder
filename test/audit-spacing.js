// Spacing sweep: in every Report Builder view, finds content that touches the edge of a bordered or shaded box
// (cards, callouts, wells, panels). Full-width header bars inside a card are allowed.
const { chromium } = require('playwright');
const CHECK = () => {
  const out = [], vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && !e.closest('[hidden],#print,.offstage,.sr,svg,iframe'); };
  const name = (e) => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/).join('.') : '');
  for (const box of document.querySelectorAll('body *')) {
    if (!vis(box) || ['TABLE', 'TR', 'TD', 'TH', 'THEAD', 'TBODY', 'INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'IMG', 'LABEL', 'A', 'SPAN', 'B', 'CODE', 'SMALL', 'LI', 'P', 'H2', 'H3', 'OPTION', 'FIGURE'].includes(box.tagName)) continue;
    const s = getComputedStyle(box);
    const framed = parseFloat(s.borderLeftWidth) > 0 || parseFloat(s.borderTopWidth) > 0 || (s.backgroundColor !== 'rgba(0, 0, 0, 0)' && s.backgroundColor !== getComputedStyle(box.parentElement).backgroundColor);
    if (!framed || box === document.body || box.matches('.bar,.savebar,.main,#rail,#work,.modal,.tablewrap,.tbox,html')) continue;
    const B = box.getBoundingClientRect();
    const bl = B.left + parseFloat(s.borderLeftWidth), br = B.right - parseFloat(s.borderRightWidth), bt = B.top + parseFloat(s.borderTopWidth), bb = B.bottom - parseFloat(s.borderBottomWidth);
    for (const c of box.children) {
      if (!vis(c)) continue; const cs = getComputedStyle(c);
      if (cs.position === 'absolute' || cs.position === 'fixed') continue;
      const R = c.getBoundingClientRect();
      // a full-bleed header or table is a design choice; content that touches one side only is not
      const fullBleed = Math.abs(R.left - bl) < 1 && Math.abs(R.right - br) < 1 && (c.matches('[class*="-h"],header,.ch,thead,table,.tbox,.tablewrap') || ['TABLE', 'HEADER', 'IMG'].includes(c.tagName));
      if (fullBleed) continue;
      const g = [['left', R.left - bl], ['right', br - R.right], ['top', R.top - bt], ['bottom', bb - R.bottom]].filter(([, d]) => d < 6 && d > -1);
      if (g.length) out.push(`${name(box)} > ${name(c)} touches ${g.map(([k]) => k).join('/')}`);
    }
  }
  return [...new Set(out)];
};
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1366, height: 900 } }); const all = {};
  await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(500);
  all['welcome'] = await p.evaluate(CHECK); await p.click('#m-acts >> text=I understand');
  await p.evaluate(() => { doc.meta.company = 'Northwind'; doc.log.cover.roster[0].name = 'Ana Ramos';
    for (const n of ['05', '12', '15']) { const d = hubData(n); d.sessions.push({ date: today(), who: 'x' }); }
    hubData('05').problems.push({ broke: 'x', log: [{ date: today(), hypothesis: 'a', test: 'b', result: 'c', outcome: 'Ruled out' }], fixed: '', verify: '', status: 'open', images: [] }); commit(); });
  let [fc] = await Promise.all([p.waitForEvent('filechooser'), (async () => { await p.click('[data-tab=var]'); await p.click('.step:has-text("Hosts found")'); await p.click('text=Import Nmap results'); })()]);
  await fc.setFiles('nmap-internal.xml'); await p.waitForTimeout(200); await p.click('#m-acts >> text=Internal view');
  await p.click('.step:has-text("Triage")'); [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('text=Import Greenbone report')]); await fc.setFiles('greenbone.xml'); await p.waitForTimeout(200);
  await p.locator('.flist .frow').first().click(); await p.click('#panel >> text=Make a finding'); await p.waitForTimeout(200);
  for (const w of [1366, 390]) { await p.setViewportSize({ width: w, height: 900 });
    for (const tab of ['log', 'var', 'ssp']) { await p.click(`[data-tab=${tab}]`); await p.waitForTimeout(100);
      const n = await p.locator('#rail .step').count();
      for (let i = 0; i < n; i++) { const st = p.locator('#rail .step').nth(i); const label = (await st.innerText()).split('\n').slice(0, 2).join(' '); await st.click(); await p.waitForTimeout(100);
        const r = await p.evaluate(CHECK); if (r.length) all[`${tab} / ${label} @${w}`] = r; } } }
  await p.setViewportSize({ width: 1366, height: 900 }); await p.click('#b-file'); all['menu'] = await p.evaluate(CHECK);
  const agg = new Map(); for (const [k, v] of Object.entries(all)) for (const x of v) { if (!agg.has(x)) agg.set(x, []); agg.get(x).push(k); }
  for (const [x, w] of agg) console.log(x + '   [' + w.length + ': ' + w.slice(0, 3).join('; ') + ']');
  console.log('distinct:', agg.size); await b.close(); })();
