const { chromium } = require('playwright');
const OUT = process.argv[2];
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 900 } });
  await p.addInitScript(() => { try { localStorage.setItem('cyberhub-reports-welcome', '1'); } catch {} });
  await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(500);
  await p.evaluate(() => { doc.meta.company = 'Northwind Security Consulting Group'; Object.assign(doc.log.cover, { rack: '4', semester: 'Spring 2027', chat: 'Discord and a group text' });
    doc.log.cover.roster = [['Ana Ramos-Villanueva', 'aramos@student.chaffey.edu'], ['Jay Lee', 'jlee@student.chaffey.edu'], ['Priya Natarajan', 'pnatarajan@student.chaffey.edu'], ['Marcus Okafor-Williams', 'mokafor@student.chaffey.edu']].map(([n, e]) => ({ name: n, email: e }));
    for (const n of ['Ana Ramos-Villanueva', 'Jay Lee']) doc.log.agreement.signatures[n] = { sig: n, date: today() };
    const r = restoreData(); r.resets.forEach((x, i) => { x.done = true; x.checked = i % 2 ? 'Default login prompt with no hostname, checked on the console' : 'Proxmox shows no VMs'; x.who = 'Jay Lee'; }); r.drawer.forEach((x) => x.present = true); r.drawer[1].note = 'One USB-C port is loose';
    r.sign = { by: 'Gabriel Goltz', date: today(), code: '4F2A9-1C3D7', seal: 'x' };
    hubData('15').sessions.push({ date: today(), who: 'Everyone reset the rack' }); commit(); });
  for (const [k, fn] of [['log', 'logCoverHTML()+LABS.map(hubHTML).join("")'], ['var', 'varHTML()'], ['ssp', 'sspHTML()']]) {
    await p.evaluate((fn) => { document.getElementById('print').innerHTML = `<div class="doc">${eval(fn)}</div>`; }, fn);
    await p.emulateMedia({ media: 'print' });
    const bad = await p.evaluate(() => { const d = document.querySelector('#print .doc'), W = d.getBoundingClientRect(); const out = [];
      for (const e of d.querySelectorAll('*')) { const r = e.getBoundingClientRect(); if (r.width && (r.right > W.right + 1 || r.left < W.left - 1)) out.push(e.tagName + '.' + e.className + ' "' + e.textContent.slice(0, 40) + '"'); }
      return [...new Set(out)].slice(0, 20); });
    console.log(k, bad.length ? bad : 'no overflow');
    await p.pdf({ path: `${OUT}/${k}.pdf`, format: 'Letter', printBackground: true });
    await p.emulateMedia({ media: 'screen' });
  }
  await b.close();
})();
