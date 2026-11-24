// Drag a cable in the Diagram tab and check it is visible straight away, with and without reduced motion.
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); let bad = 0;
 for (const rm of ['no-preference', 'reduce']) {
  const p = await b.newPage({ viewport: { width: 1500, height: 1000 }, reducedMotion: rm });
  await p.goto('http://localhost:8765/index.html#diagram'); await p.waitForTimeout(1200);
  const f = p.frames().find(x => x.url().includes('diagram.html'));
  const port = await f.locator('[data-port="wan1"]').first().boundingBox();
  const dst = await f.locator('[data-dev="isp"]').first().boundingBox();
  const off = { x: 0, y: 0 };
  await p.mouse.move(off.x + port.x + port.width / 2, off.y + port.y + port.height / 2); await p.mouse.down();
  await p.mouse.move(off.x + dst.x + 60, off.y + dst.y + 20, { steps: 8 }); await p.mouse.up();
  await p.waitForTimeout(120);
  const r = await f.evaluate(() => { const l = document.querySelector('.lk .d-link'); if (!l) return 'no link'; const cs = getComputedStyle(l); return [cs.strokeDashoffset, cs.strokeDasharray, cs.opacity].join(' '); });
  await p.waitForTimeout(1000);
  const r2 = await f.evaluate(() => { const l = document.querySelector('.lk .d-link'); const cs = getComputedStyle(l); return [cs.strokeDashoffset, cs.strokeDasharray].join(' '); });
  console.log(rm, '| just after:', r, '| 1 s later:', r2);
  if (rm === 'reduce' && !/^0(px)? /.test(r)) bad++;
  if (!/^0(px)? /.test(r2)) bad++;
 }
 console.log(bad ? 'CABLE HIDDEN' : 'CABLE VISIBLE'); await b.close(); })();
