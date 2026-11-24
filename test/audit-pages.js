const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const files = process.argv.slice(2);
(async () => {
  const b = await chromium.launch(); let n = 0;
  for (const f of files) for (const w of [820, 390]) {
    const p = await b.newPage({ viewport: { width: w, height: 900 } });
    let html = fs.readFileSync(f, 'utf8');
    if (!/<html/i.test(html)) html = `<!doctype html><meta name=viewport content="width=device-width"><body style="margin:0;padding:12px;font-family:Lato,Arial,sans-serif;font-size:16px">${html}</body>`;
    await p.setContent(html, { waitUntil: 'load' });
    const bad = await p.evaluate(() => {
      const out = [], de = document.documentElement, vis = (e) => { const r = e.getBoundingClientRect(); const d = e.closest('details:not([open])'); if (d && !e.closest('summary')) return false; const s = getComputedStyle(e); if (s.position === 'absolute' && s.clip !== 'auto') return false; if (e.closest('nav,.toc,[style*="position: fixed"],[style*="position: sticky"]')) return false; return r.width > 0 && r.height > 0 && s.visibility !== 'hidden'; };
      if (de.scrollWidth > de.clientWidth + 1) {
        const W = de.clientWidth; const wide = [...document.querySelectorAll('body *')].filter((e) => vis(e) && e.getBoundingClientRect().right > W + 1 && ![...e.children].some((c) => c.getBoundingClientRect().right > W + 1));
        out.push('sideways scroll ' + de.scrollWidth + ': ' + wide.slice(0, 4).map((e) => e.tagName + ' "' + e.textContent.trim().slice(0, 50) + '"').join(' | '));
      }
      for (const e of document.querySelectorAll('body *')) {
        if (!vis(e)) continue; const s = getComputedStyle(e);
        if (e.tagName !== 'CAPTION' && (s.overflowX === 'hidden' || s.textOverflow === 'ellipsis') && e.scrollWidth > e.clientWidth + 2) out.push('clipped: ' + e.tagName + ' "' + e.textContent.trim().slice(0, 50) + '"');
      }
      const L = [...document.querySelectorAll('body *')].filter((e) => vis(e) && e.textContent.trim() && ![...e.children].some((c) => c.textContent.trim()) && !e.closest('svg')).map((e) => [e, [...e.getClientRects()]]);
      const hit = (A, C) => A.some((ra) => C.some((rc) => Math.min(ra.right, rc.right) - Math.max(ra.left, rc.left) > 3 && Math.min(ra.bottom, rc.bottom) - Math.max(ra.top, rc.top) > 3));
      for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) { const [a, ra] = L[i], [c, rc] = L[j]; if (a.contains(c) || c.contains(a)) continue;
        if (hit(ra, rc)) out.push(`overlap: "${a.textContent.trim().slice(0, 30)}" / "${c.textContent.trim().slice(0, 30)}"`); }
      return [...new Set(out)];
    });
    if (bad.length) { n++; console.log(path.basename(f) + ' @' + w + '\n  ' + bad.slice(0, 8).join('\n  ')); }
    await p.close();
  }
  console.log('files with issues:', n); await b.close();
})();
