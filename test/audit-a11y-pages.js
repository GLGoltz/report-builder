// axe-core WCAG 2.1 AA check of course pages and guides. AXE=/path/to/axe.min.js node test/audit-a11y-pages.js files...
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path'); const AXE = fs.readFileSync(process.env.AXE, 'utf8');
(async () => { const b = await chromium.launch(); const seen = new Map();
  for (const f of process.argv.slice(2)) { const p = await b.newPage(); let html = fs.readFileSync(f, 'utf8');
    if (!/<html/i.test(html)) html = `<!doctype html><html lang="en"><head><title>t</title></head><body><main>${html}</main></body></html>`;
    await p.setContent(html); await p.evaluate(AXE);
    const v = await p.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] })).violations.map((x) => [x.id + ' (' + x.impact + '): ' + x.help, x.nodes.slice(0, 2).map((n) => n.html.slice(0, 140)).join(' | ')]));
    for (const [k, ex] of v) { if (!seen.has(k)) seen.set(k, [ex, []]); seen.get(k)[1].push(path.basename(f)); } await p.close(); }
  for (const [k, [ex, w]] of seen) console.log(k + '\n   e.g. ' + ex + '\n   in ' + w.length + ': ' + w.slice(0, 5).join(', '));
  console.log('distinct issues:', seen.size); await b.close(); })();
