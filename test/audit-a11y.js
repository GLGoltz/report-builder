// Accessibility sweep (WCAG 2.1 AA rules from axe-core) over every Report Builder view, the welcome and the diagram.
// Needs axe-core: AXE=/path/to/axe.min.js node test/audit-a11y.js
const { chromium } = require('playwright'); const fs = require('fs');
const AXE = fs.readFileSync(process.env.AXE, 'utf8');
const run = async (frame) => { await frame.evaluate(AXE); return frame.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] })).violations.map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.slice(0, 3).map((n) => n.target.join(' ') + ' ' + n.html.slice(0, 120)).join(' | ')}${v.nodes.length > 3 ? ` +${v.nodes.length - 3}` : ''}`)); };
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1366, height: 900 } }); const all = {};
  await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(500);
  all['welcome'] = await run(p.mainFrame()); await p.click('#m-acts >> text=I understand');
  await p.evaluate(() => { doc.log.cover.roster[0].name = 'Ana Ramos'; const d = hubData('05'); d.problems.push({ broke: 'x', log: [{ date: today(), hypothesis: 'a', test: 'b', result: 'c', outcome: 'Ruled out' }], fixed: '', verify: '', status: 'open', images: [] }); commit(); });
  for (const tab of ['log', 'var', 'ssp', 'ref']) {
    await p.click(`[data-tab=${tab}]`); await p.waitForTimeout(150);
    const n = await p.locator('#rail .step').count();
    for (let i = 0; i < n; i++) { const st = p.locator('#rail .step').nth(i); const label = (await st.innerText()).split('\n')[0]; await st.click(); await p.waitForTimeout(120); const v = await run(p.mainFrame()); if (v.length) all[`${tab}: ${label}`] = v; }
  }
  await p.click('[data-tab=diagram]'); await p.waitForTimeout(800);
  const f = p.frames().find((x) => x.url().includes('diagram.html')); all['diagram'] = await run(f);
  await f.click('#t-table'); await p.waitForTimeout(200); all['diagram table'] = await run(f);
  const seen = new Map();
  for (const [k, v] of Object.entries(all)) for (const x of v) { const id = x.split(' — ')[0]; if (!seen.has(id)) seen.set(id, [x, []]); seen.get(id)[1].push(k); }
  for (const [id, [x, where]] of seen) console.log(x + '\n    in: ' + where.slice(0, 6).join('; ') + (where.length > 6 ? ` +${where.length - 6}` : ''));
  console.log('distinct issues:', seen.size); await b.close();
})();
