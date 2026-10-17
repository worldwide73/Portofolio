// RECETTE V4-H : ce que coûte chaque niveau de qualité, mesuré sur la même image de course (partie figée).
// Compte les images dessinées en 15 s et le temps JavaScript d'une image, pour Économie, Équilibrée, Élevée.
// ATTENTION : sans carte graphique (rendu logiciel), les chiffres absolus ne disent rien de la fluidité réelle ;
// seuls les rapports entre niveaux renseignent sur le travail demandé au GPU.
// Utilisation : node outils/recettes/rush-3d-perf.mjs (serveur local lancé). Réglages : SITE, CHROMIUM, L, H, NIVEAU.
import { chromium } from 'playwright';
const L = Number(process.env.L || 960), H = Number(process.env.H || 540);
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const ctx = await nav.newContext({ viewport: { width: L, height: H } });
await ctx.addInitScript(() => { localStorage.setItem('guidage-vu', '1'); window.__rushQualite = 'economie'; });
const p = await ctx.newPage();
p.on('pageerror', (e) => console.log('ERR', e.message));
await p.goto((process.env.SITE || 'http://127.0.0.1:4321') + '/');
await p.waitForFunction(() => !document.documentElement.classList.contains('intro') && window.__portalRush, null, { timeout: 90000 });
await p.evaluate(() => { window.__images = 0; const f = () => { window.__images++; requestAnimationFrame(f); }; requestAnimationFrame(f); document.querySelector('[data-jouer-rush]').click(); });
await p.waitForFunction(() => document.querySelector('.rush').open && !window.__portalRush.etat().transition, null, { timeout: 120000 });
if (await p.evaluate(() => window.__portalRush.tutoriel().actif)) { await p.evaluate(() => document.querySelector('.tuto__passer').click()); await p.waitForTimeout(500); }
await p.evaluate((n) => window.__portalRush.demarrer('campagne', 'pilote', n), Number(process.env.NIVEAU || 1));
await p.waitForTimeout(800);
await p.evaluate(() => {
  const q = window.__portalRush.partie();
  let k = 0;
  while (q.distance < 260 && k++ < 40000) { q.invincible = 5; q.avancer(1 / 120); }
  q.invincible = 0;
  q.evenements.length = 0;
  q.avancer = () => {};
});
const resultats = [];
for (const q of ['economie', 'equilibree', 'elevee']) {
  await p.evaluate((q) => (window.__rushQualite = q), q);
  await p.waitForTimeout(6000);
  const r = await p.evaluate(async () => {
    window.__images = 0;
    const ms = [];
    const t0 = performance.now();
    while (performance.now() - t0 < 15000) {
      await new Promise((r) => setTimeout(r, 500));
      ms.push(window.__rushImage().ms);
    }
    return { images: window.__images, js: ms.reduce((a, b) => a + b, 0) / ms.length, info: window.__rushImage() };
  });
  resultats.push({ qualite: q, imagesParSeconde: +(r.images / 15).toFixed(2), msJavaScript: +r.js.toFixed(1), ...r.info });
  console.log(JSON.stringify(resultats.at(-1)));
}
await nav.close();
