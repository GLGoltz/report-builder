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
  // rack sheet fills from the rack number
  await p.fill('input[placeholder="1 to 8"]', '4'); await p.click('.step:has-text("Rack sheet")');
  const rs = await p.evaluate(() => [...document.querySelectorAll('table.edit tbody tr')].map(r => r.lastElementChild.previousElementSibling.textContent));
  if (rs[1] !== '10.4.200.2' || rs[16] !== '10.4.20.100 to .199' || rs[0] !== '4') errs.push('rack sheet ' + rs.slice(0,2)); else t('rack sheet autofill');
  // hub 05
  await p.click('text=05 Switch Ports and DHCP');
  await p.click('text=+ Add session');
  await p.click('text=+ Add problem'); await p.locator('.pcard textarea').first().fill('Ping to the gateway failed');
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
