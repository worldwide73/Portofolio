// RECETTE V4-H7 : la même image de course, avec puis sans les modèles importés (Blender : vaisseaux, bordures,
// portiques, modules des mondes, obstacles). Pour chaque cas : une capture, le nombre de triangles dessinés
// (passage principal), et les images dessinées en DUREE secondes (rendu logiciel : seuls les rapports comptent).
// Utilisation : NIVEAU=1 DISTANCE=260 node outils/recettes/rush-3d-h7.mjs  (serveur local lancé)
// Réglages : SITE, CHROMIUM, SORTIE (captures/v4h/h7), QUALITE (elevee), DUREE (15), L, H.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const SORTIE = process.env.SORTIE || 'captures/v4h/h7';
mkdirSync(SORTIE, { recursive: true });
const L = Number(process.env.L || 1280), H = Number(process.env.H || 720);
const DUREE = Number(process.env.DUREE || 15);
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM });
const resultats = [];
for (const sans of [true, false]) {
  const ctx = await nav.newContext({ viewport: { width: L, height: H } });
  await ctx.addInitScript(([q, sans]) => {
    localStorage.setItem('guidage-vu', '1');
    window.__rushQualite = q;
    if (sans) window.__rushSans = { assets: true };
  }, [process.env.QUALITE || 'elevee', sans]);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.goto((process.env.SITE || 'http://127.0.0.1:4321') + '/');
  await p.waitForFunction(() => !document.documentElement.classList.contains('intro') && window.__portalRush, null, { timeout: 90000 });
  await p.evaluate(() => { window.__images = 0; const f = () => { window.__images++; requestAnimationFrame(f); }; requestAnimationFrame(f); document.querySelector('[data-jouer-rush]').click(); });
  await p.waitForFunction(() => document.querySelector('.rush').open && !window.__portalRush.etat().transition, null, { timeout: 180000 });
  if (await p.evaluate(() => window.__portalRush.tutoriel().actif)) { await p.evaluate(() => document.querySelector('.tuto__passer').click()); await p.waitForTimeout(500); }
  await p.evaluate((n) => window.__portalRush.demarrer('campagne', 'pilote', n), Number(process.env.NIVEAU || 1));
  await p.waitForTimeout(800);
  const info = await p.evaluate((dist) => {
    const q = window.__portalRush.partie();
    let k = 0;
    while (q.distance < dist && k++ < 40000) { q.invincible = 5; q.boucliers = q.bouclierMax; q.avancer(1 / 120); }
    q.invincible = 0;
    q.evenements.length = 0;
    q.avancer = () => {};
    return { d: Math.round(q.distance), theme: q.niveauBase.theme };
  }, Number(process.env.DISTANCE || 260));
  // Le temps que les modules du monde arrivent et que les tronçons soient refaits.
  await p.waitForTimeout(4000);
  await p.evaluate(() => (window.__images = 0));
  await p.waitForFunction(() => window.__images >= 2, null, { timeout: 240000, polling: 250 });
  const cas = sans ? 'sans-modeles' : 'avec-modeles';
  await p.screenshot({ timeout: 240000, path: `${SORTIE}/${info.theme}-${cas}.png` });
  const tri = await p.evaluate(() => window.__rushTriangles?.());
  await p.evaluate(() => (window.__images = 0));
  await p.waitForTimeout(DUREE * 1000);
  const images = await p.evaluate(() => window.__images);
  const r = { cas, theme: info.theme, ...tri, imagesParSeconde: Math.round((images / DUREE) * 100) / 100 };
  resultats.push(r);
  console.log(JSON.stringify(r));
  await ctx.close();
}
await nav.close();
