// RECETTE V4-H : la même image de course (partie figée), avec puis sans chaque effet (ombres, textures, halo,
// lumières). Utilisation : NIVEAU=1 DISTANCE=260 node outils/recettes/rush-3d-ab.mjs. Réglages : SITE, CHROMIUM, SORTIE,
// QUALITE (elevee par défaut), CAS (tout,ombres,textures,halo,lumieres,rien), BOUCLIERS.
// A/B : la même image (partie figée), avec puis sans chaque effet V4-H. Pour juger chacun isolément.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const SORTIE = process.env.SORTIE || 'captures/v4h';
mkdirSync(SORTIE, { recursive: true });
const L = Number(process.env.L || 1280), H = Number(process.env.H || 720);
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM });
const ctx = await nav.newContext({ viewport: { width: L, height: H } });
await ctx.addInitScript((q) => { localStorage.setItem('guidage-vu', '1'); window.__rushQualite = q; }, process.env.QUALITE || 'elevee');
const p = await ctx.newPage();
p.on('pageerror', (e) => console.log('ERR', e.message));
p.on('console', (m) => ['warning', 'error'].includes(m.type()) && !/Failed to load|GPU stall|GL Driver|AudioContext/.test(m.text()) && console.log('CONSOLE', m.type(), m.text().slice(0, 600)));
await p.goto((process.env.SITE || 'http://127.0.0.1:4321') + '/');
await p.waitForFunction(() => !document.documentElement.classList.contains('intro') && window.__portalRush, null, { timeout: 90000 });
await p.evaluate(() => { window.__images = 0; const f = () => { window.__images++; requestAnimationFrame(f); }; requestAnimationFrame(f); document.querySelector('[data-jouer-rush]').click(); });
await p.waitForFunction(() => document.querySelector('.rush').open && !window.__portalRush.etat().transition, null, { timeout: 120000 });
if (await p.evaluate(() => window.__portalRush.tutoriel().actif)) { await p.evaluate(() => document.querySelector('.tuto__passer').click()); await p.waitForTimeout(500); }
await p.evaluate((n) => window.__portalRush.demarrer('campagne', 'pilote', n), Number(process.env.NIVEAU || 1));
await p.waitForTimeout(800);
const info = await p.evaluate(([dist, boucliers]) => {
  const q = window.__portalRush.partie();
  let k = 0;
  while (q.distance < dist && k++ < 40000) {
    q.invincible = 5;
    q.boucliers = q.bouclierMax;
    q.avancer(1 / 120);
  }
  q.invincible = 0;
  q.boucliers = boucliers ?? q.bouclierMax;
  q.evenements.length = 0;
  // Le monde est figé (le moteur n'avance plus) ; la scène continue d'être dessinée.
  q.avancer = () => {};
  return { d: Math.round(q.distance), theme: q.niveauBase.theme };
}, [Number(process.env.DISTANCE || 260), process.env.BOUCLIERS ? Number(process.env.BOUCLIERS) : null]);
console.log(JSON.stringify(info));
const cas = (process.env.CAS || 'tout,ombres,textures,halo,lumieres').split(',');
for (const c of cas) {
  await p.evaluate((c) => (window.__rushSans = c === 'tout' ? {} : c === 'rien' ? { ombres: true, textures: true, halo: true, lumieres: true } : { [c]: true }), c);
  await p.evaluate(() => (window.__images = 0));
  await p.waitForFunction(() => window.__images >= 3, null, { timeout: 120000, polling: 250 });
  await p.screenshot({ timeout: 240000, path: `${SORTIE}/ab-${info.theme}-${c === 'tout' ? 'tout' : 'sans-' + c}.png` });
  console.log('capture', c);
}
await nav.close();
