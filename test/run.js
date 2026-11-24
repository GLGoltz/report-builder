const crypto = require('crypto');
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1400, height: 950 } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  const U = 'http://localhost:8765/index.html';
  await p.goto(U);
  await p.waitForTimeout(500);
  const t = async (label) => console.log('✓', label);
  if (!(await p.isVisible('#m-acts >> text=I understand'))) errs.push('no welcome'); else t('welcome on first open');
  await p.click('#m-acts >> text=I understand');
  await p.getByLabel('Company name').fill('Northwind Security');
  if ((await p.textContent('#brand-co')) !== 'Northwind Security') errs.push('company'); else t('company');
  // seed the Diagram tab through the Report Builder's own hook
  await p.evaluate(() => { doc.diagram = { v: 2, meta: {}, links: [], devices: [
    { id: 'fw', kind: 'firewall', hostname: 'nw-fw', interfaces: [{ name: 'wan1', address: '10.4.200.2', mask: '24' }, { name: 'dmz', address: '10.4.40.1', mask: '24' }] },
    { id: 'sw', kind: 'switch', hostname: 'nw-sw', oob: { address: '192.168.1.254', mask: '24' }, svis: [{ vlan: '20', address: '10.4.20.254', mask: '24' }] },
    { id: 'vmweb', kind: 'vm', hostname: 'web', address: '10.4.40.10', mask: '24', gateway: '10.4.40.1', vlanTag: '40' }] }; commit(); reloadDiagram(); });
  await p.click('[data-tab=diagram]'); await p.waitForTimeout(500);
  const fr = p.frameLocator('#dframe');
  const vis = await p.evaluate(() => { const f = $('dframe'); const r = f.getBoundingClientRect(); return [f.classList.contains('offstage'), Math.round(r.width) > 600, document.getElementById('work').hidden]; });
  if (vis.join() !== 'false,true,true') errs.push('diagram tab layout ' + vis); else t('diagram tab shows');
  if (await fr.locator('.brand').isVisible()) errs.push('diagram brand should be hidden'); 
  const fd = await p.evaluate(() => { const d = readDiagram(); return [d.devices.length, d.meta.company, d.devices.find(x => x.id === 'vmweb').address]; });
  if (fd[1] !== 'Northwind Security' || fd[2] !== '10.4.40.10' || fd[0] < 10) errs.push('diagram load ' + fd); else t('diagram loads with company ' + fd);
  // the diagram saving back: undo/redo path via its own save
  await p.evaluate(() => dframe().rbReload());
  const png = await p.evaluate(async () => (await diagramPNG()).length); if (png < 20000) errs.push('diagram png ' + png); else t('diagram png ' + png);
  await p.click('[data-tab=log]');
  // roster
  const rosterInputs = p.locator('table.edit').first().locator('input');
  await rosterInputs.nth(0).fill('Ana Ramos'); await rosterInputs.nth(2).fill('Jay Lee');
  await p.click('[data-tab=var]'); await p.click('[data-tab=log]');
  // signatures: typing the roster name signs and dates it
  const sig = p.locator('input.signin[placeholder="Jay Lee"]'); await sig.fill('jay lee');
  const sg = await p.evaluate(() => [doc.log.agreement.signatures['Jay Lee'].date === today(), coverStatus()]);
  if (!sg[0]) errs.push('signature ' + sg); else t('signature dated, cover ' + sg[1]);
  if ((await p.locator('table.edit').first().locator('tbody tr').count()) !== 4) errs.push('roster should start with 4 rows'); else t('roster of 4');
  // the rack number fills the diagram's addressing plan, and entries that differ are flagged
  if (await p.isVisible('.step:has-text("Rack sheet")')) errs.push('rack sheet should be gone');
  await p.fill('input[placeholder="1 to 8"]', '4');
  await p.evaluate(() => { doc.diagram.devices.find(d => d.id === 'vmweb').gateway = '10.4.40.254'; commit(); });
  await p.click('[data-tab=diagram]'); await p.waitForTimeout(400); await fr.locator('#t-table').click(); await p.waitForTimeout(200);
  const pl = await fr.locator('table.addr').evaluate((tb) => { const rows = [...tb.querySelectorAll('tbody tr')];
    const web = rows.find(r => r.textContent.includes('10.4.40.10/24'));
    return [rows.length, !!web, web ? web.querySelectorAll('.differs').length : -1, tb.querySelector('.plan.pattern') ? 'pattern' : 'filled', document.querySelector('.plannote').textContent.slice(0, 20)]; });
  if (pl[1] !== true || pl[2] !== 1 || pl[3] !== 'filled' || !pl[4].startsWith('1 entry differs')) errs.push('addressing plan ' + pl); else t('addressing plan filled for rack 4, gateway mismatch flagged ' + pl);
  await fr.locator('#t-canvas').click();
  await p.evaluate(() => { doc.diagram.devices.find(d => d.id === 'vmweb').gateway = '10.4.40.1'; commit(); });
  await p.click('[data-tab=log]');
  // Cyber Hubs 00 and 14 have no tickets; 00 has no commands
  await p.click('text=00 Launch Your Company');
  if (await p.isVisible('text=Troubleshooting tickets') || await p.isVisible('text=Commands and settings')) errs.push('00 should have no tickets or commands'); else t('00: no tickets, no commands');
  await p.click('text=14 Physical Security Briefing');
  if (await p.isVisible('text=Troubleshooting tickets')) errs.push('14 should have no tickets'); else t('14: no tickets');
  // Cyber Hub 15: restoration record and instructor sign-off, with a throwaway test password (never the real one)
  const TPW = 'test-only-' + crypto.randomBytes(4).toString('hex'), salt = crypto.randomBytes(8).toString('hex');
  const chk = crypto.pbkdf2Sync(TPW.toLowerCase().replace(/[\s\-_.]+/g, ''), salt, 1000, 64, 'sha256').subarray(0, 32).toString('hex');
  await p.evaluate(([salt, chk]) => Object.assign(SIGNOFF, { salt, iter: 1000, check: chk }), [salt, chk]);
  await p.click('text=15 Lab Restoration');
  if ((await p.locator('table.restore').count()) !== 2) errs.push('restore tables');
  if (!(await p.isDisabled('button:has-text("Sign off")'))) errs.push('sign off should wait for every tick');
  for (const cb of await p.locator('table.restore input[type=checkbox]').all()) await cb.check();
  await p.fill('#so-name', 'G. Goltz'); await p.fill('#so-pw', 'wrong password'); await p.click('button:has-text("Sign off")'); await p.waitForTimeout(400);
  if (!(await p.isVisible('text=That password isn\'t right'))) errs.push('wrong password accepted');
  await p.fill('#so-pw', TPW.toUpperCase().replace(/-/g, ' ')); await p.click('button:has-text("Sign off")'); await p.waitForTimeout(400);
  const so = await p.evaluate(() => restoreData().sign);
  if (!so || !/^[0-9A-F]{5}-[0-9A-F]{5}$/.test(so.code) || so.by !== 'G. Goltz') errs.push('sign off ' + JSON.stringify(so)); else t('signed off ' + so.code);
  if (!(await p.isVisible('text=hasn\'t changed since it was signed'))) errs.push('seal check');
  await p.locator('table.restore input[type=checkbox]').first().uncheck(); await p.waitForTimeout(400);
  if (!(await p.isVisible('text=changed after it was signed'))) errs.push('change after signing not caught'); else t('change after signing caught');
  await p.locator('table.restore input[type=checkbox]').first().check(); await p.waitForTimeout(400);
  await p.click('text=Check a sign-off'); await p.fill('#m-body input[type=password]', TPW); await p.click('#m-acts >> text=Check'); await p.waitForTimeout(400);
  if (!(await p.isVisible('text=Genuine.'))) errs.push('code check'); else t('code checks as genuine');
  await p.evaluate(() => { restoreData().sign.code = 'AAAAA-BBBBB'; }); await p.click('#m-acts >> text=Check'); await p.waitForTimeout(400);
  if (!(await p.isVisible('text=Not genuine'))) errs.push('forged code accepted'); else t('forged code rejected');
  await p.click('#m-acts >> text=Close');
  const h15 = await p.evaluate(() => { const s = hubHTML(LABS.find(l => l.num === '15')); return [s.includes('Reset record'), s.includes('AAAAA-BBBBB')]; });
  if (h15.join() !== 'true,true') errs.push('15 export ' + h15); else t('15 export has the record');
  // logos from logo makers: the empty margin is trimmed and a plain background made transparent
  const lg = await p.evaluate(() => { const c = document.createElement('canvas'); c.width = c.height = 500; const x = c.getContext('2d');
    x.fillStyle = '#f5ecdc'; x.fillRect(0, 0, 500, 500); x.fillStyle = '#444'; x.beginPath(); x.arc(250, 220, 90, 0, 7); x.fill();
    x.fillStyle = '#f5ecdc'; x.fillRect(225, 195, 50, 50);
    const r = cleanLogo(c), d = r.canvas.getContext('2d').getImageData(0, 0, r.canvas.width, r.canvas.height).data, w = r.canvas.width;
    const at = (px, py) => d[(py * w + px) * 4 + 3];
    return [r.canvas.width < 220, r.canvas.height < 220, at(0, 0), at(w >> 1, r.canvas.height >> 1) > 200]; });
  if (lg.join() !== 'true,true,0,true') errs.push('logo clean-up ' + lg); else t('logo margin trimmed, background transparent, enclosed shape kept');
  // VAR scope fills from the client's rack
  await p.click('[data-tab=var]'); await p.click('.step:has-text("Cover")'); await p.fill('input[placeholder="1 to 8"]', '6');
  await p.click('.step:has-text("Scope")');
  const scp = await p.evaluate(() => doc.var.scope.map(s => s.range).join(' '));
  if (scp !== '10.6.20.0/24 10.6.40.0/24 10.6.200.2') errs.push('scope ' + scp); else t('VAR scope from client rack');
  await p.click('[data-tab=log]');
  // hub 05
  await p.click('text=05 Switch Ports and DHCP');
  await p.click('text=+ Add session');
  await p.click('text=+ Open a ticket'); await p.locator('.pcard textarea').first().fill('Ping to the gateway failed');
  const pc = await p.evaluate(() => [hubData('05').problems.length, Array.isArray(hubData('05').problems[0].images), Array.isArray(hubData('05').shots)]);
  if (pc.join() !== '1,true,true') errs.push('problem card ' + pc); else t('problem card with screenshots');
  if (!(await p.isVisible('text=Connectivity checkpoint'))) errs.push('checkpoint missing'); else t('checkpoint table');
  // VAR hosts: nmap import
  await p.click('[data-tab=var]'); await p.click('.step:has-text("Hosts found")');
  let [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('text=Import Nmap results')]);
  await fc.setFiles('nmap-internal.xml'); await p.waitForTimeout(200);
  await p.click('#m-acts >> text=Internal view'); await p.waitForTimeout(200);
  const hosts = await p.evaluate(() => doc.var.hosts.map(h => h.ip + ':' + h.ports));
  if (JSON.stringify(hosts) !== JSON.stringify(['10.3.40.10:22, 80', '10.3.40.11:21, 22'])) errs.push('nmap: ' + hosts); else t('nmap import ' + hosts);
  // greenbone
  await p.click('.step:has-text("Triage")');
  [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('text=Import Greenbone report')]);
  await fc.setFiles('greenbone.xml'); await p.waitForTimeout(200);
  const tri = await p.evaluate(() => doc.var.triage.map(x => `${x.name}|${x.hosts.join(',')}|${x.threat}|${x.vector}`));
  console.log(tri.join('\n'));
  if (tri.length !== 3 || !tri[0].includes('10.3.40.11,10.3.200.2')) errs.push('greenbone grouping');
  const visible = await p.locator('.flist .frow').count(); if (visible !== 2) errs.push('log results should be hidden: ' + visible); else t('log hidden');
  await p.locator('.flist .frow').first().click();
  await p.click('#panel >> text=Make a finding'); await p.waitForTimeout(200);
  const f0 = await p.evaluate(() => ({ t: doc.var.findings[0].title, h: doc.var.findings[0].hosts, st: state.var, hosts: doc.var.hosts.length }));
  console.log(f0); if (f0.st !== 'findings' || f0.h.length !== 2 || f0.hosts !== 3) errs.push('promote');
  await p.click('#panel >> text=Start from Greenbone\'s vector'); await p.waitForTimeout(100);
  const sc = await p.evaluate(() => cvss(doc.var.findings[0].v)); if (sc !== 6.5) errs.push('cvss from vector ' + sc); else t('cvss from vector 6.5');
  await p.fill('#f-title', 'Anonymous FTP login allowed');
  await p.click('#panel >> button:has-text("Confirmed")');
  if (!(await p.isVisible('text=Say how you confirmed it'))) errs.push('confirm warning'); else t('confirm warning');
  // CVSS known values
  const cv = await p.evaluate(() => [cvss(parseVector('CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:N')), cvss(parseVector('CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H')), cvss(parseVector('CVSS:3.1/AV:A/AC:L/PR:L/UI:R/S:C/C:L/I:L/A:N')), cvss(parseVector('CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:L/A:N'))]);
  if (cv.join() !== '7.4,10,4.8,4.8') errs.push('cvss table ' + cv); else t('cvss values ' + cv);
  // second triage → dismiss
  await p.click('.step:has-text("Triage")');
  await p.locator('.flist .frow').nth(1).click();
  await p.fill('#dismiss', 'Covered by F-01'); await p.click('#panel >> button:has-text("Dismiss")');
  // recs
  await p.click('.step:has-text("Fix priority")'); await p.click('text=not yet covered');
  // summary + screenshot of findings view
  await p.click('.step:has-text("Findings")'); await p.locator('.flist .frow').first().click();
  await p.screenshot({ path: 'var.png' });
  // VAR to SSP: the findings file makes the full trip into the client's POA&M
  await p.evaluate(() => { doc.var.findings[0].fix = 'Set anonymous_enable=NO'; commit(); state.tab = 'var'; state.var = 'review'; renderAll(); });
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('button:has-text("Send findings to the client")')]);
  const fpath = 'findings.cyberhub-findings'; await dl.saveAs(fpath);
  await p.click('[data-tab=ssp]'); await p.click('.step:has-text("POA&M")');
  [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('text=Import the VAR findings')]);
  await fc.setFiles(fpath); await p.waitForTimeout(200);
  const pm = await p.evaluate(() => doc.ssp.poam.map(r => [r.source, r.rec, r.fix, r.response].join('|')));
  if (pm.length !== 1 || pm[0] !== 'VAR F-01|Set anonymous_enable=NO||') errs.push('poam import ' + pm); else t('findings file into POA&M, plan left blank');
  const shown = await p.isVisible('td.ref-col >> text=Set anonymous_enable=NO'); if (!shown) errs.push('recommendation not shown'); else t('recommendation shown for reference');
  require('fs').unlinkSync(fpath);
  // SSP inventory from diagram
  await p.click('[data-tab=ssp]'); await p.click('.step:has-text("Inventory")');
  await p.click('text=Start from my diagram'); await p.click('text=Copy from my diagram');
  await p.click('.step:has-text("Network diagram")'); await p.click('button:has-text("Add my diagram")'); await p.waitForTimeout(300);
  const sd = await p.evaluate(() => !!images[doc.ssp.diagram]); if (!sd) errs.push('ssp diagram'); else t('ssp diagram from tab');
  const inv = await p.evaluate(() => [doc.ssp.inventory.length, doc.ssp.addressing.length]); console.log('inventory', inv); if (inv[0] !== 3 || inv[1] !== 5) errs.push('inventory ' + inv);
  await p.click('.step:has-text("Security controls")'); await p.screenshot({ path: 'ssp.png' });
  // persistence
  await p.waitForTimeout(900); await p.reload(); await p.waitForTimeout(500);
  if (await p.isVisible('#modal')) errs.push('welcome shown twice'); else t('welcome only once');
  const per = await p.evaluate(() => [doc.var.findings.length, doc.var.triage.filter(x => x.state !== 'new').length, doc.log.cover.roster[1].name]);
  if (per.join() !== '1,2,Jay Lee') errs.push('persist ' + per); else t('persist ' + per);
  // team file round trip + findings file
  const rt = await p.evaluate(() => { const f = parseTeamFile(teamFileJSON()); return [f.doc.var.findings[0].title, f.doc.diagram ? 'diagram' : 'nodiagram']; });
  if (rt.join() !== 'Anonymous FTP login allowed,diagram') errs.push('roundtrip ' + rt); else t('team file round trip');
  const hist = await p.evaluate(async () => (await historyList()).length); if (!hist) errs.push('no history'); else t('history ' + hist);
  // printed docs to PDF
  await p.evaluate(async () => { diagramImg = await diagramPNG(); });
  for (const [k, fn] of [['var', 'varHTML()'], ['ssp', 'sspHTML()'], ['log05', 'logCoverHTML()+hubHTML(LABS.find(l=>l.num==="05"))+diagramHTML("test")']]) {
    await p.evaluate((fn) => { $('print').innerHTML = '<div class="doc">' + eval(fn) + '</div>'; }, fn);
    await p.emulateMedia({ media: 'print' });
    await p.pdf({ path: k + '.pdf', format: 'Letter', printBackground: true });
    await p.emulateMedia({ media: 'screen' });
  }
  t('pdfs');
  // phone width
  const m = await ctx.newPage(); await m.setViewportSize({ width: 400, height: 800 }); await m.goto(U); await m.waitForTimeout(400);
  const sw = await m.evaluate(() => document.documentElement.scrollWidth); console.log(await m.evaluate(()=>['html','body','.bar','.savebar','.main','#rail','#work','#panel','#print','#modal'].map(s=>{const e=document.querySelector(s);return s+':'+(e&&e.scrollWidth)+'/'+(e&&Math.round(e.getBoundingClientRect().width))}))); console.log(await m.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>{if(e.getBoundingClientRect().right<=401)return false;for(let a=e.parentElement;a;a=a.parentElement)if(getComputedStyle(a).overflowX!=='visible')return false;return true}).slice(0,6).map(e=>e.tagName+'.'+e.className+' '+Math.round(e.getBoundingClientRect().right)+' '+(e.textContent||'').slice(0,40)))); if (sw > 400) errs.push('phone overflow ' + sw); else t('phone width');
  await m.screenshot({ path: 'phone.png' });
  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'ALL PASS');
  await b.close();
})();
