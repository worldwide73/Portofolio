// Prend des captures d'écran du site local, à la vraie résolution.
// Sert au contrôle qualité : on regarde les images, on corrige, on recommence.
//
// Utilisation (le serveur local doit tourner sur http://localhost:4321) :
//   node outils/captures.mjs                  → les vues par défaut
//   node outils/captures.mjs 1440x900 0.5     → une taille et un défilement (0 = haut, 1 = bas)
//
// Réglages, à passer en variables d'environnement :
//   CHEMIN=/en/        la page à ouvrir (par défaut l'accueil)
//   SUFFIXE=-essai     ajouté au nom des fichiers
//   THEME=clair        ouvre le site en thème clair
//   CIBLE=.apropos     se place sur cet élément (un sélecteur CSS) au lieu d'une fraction de page
//   MENU=1             ouvre le menu plein écran avant la capture (téléphone)
//   CLIC=0.3,0.5       clique à cet endroit de l'écran (fractions de la largeur et de la hauteur)
//   APRES=600          millisecondes d'attente entre le clic et la capture
//   REDUIT=1           simule le réglage « moins de mouvement » du système
//
// Les animations sont toujours actives ici, même si Windows les a désactivées
// sur cet ordinateur : c'est le navigateur de test qui décide, pas le système.

import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const BASE = process.env.SITE ?? 'http://localhost:4321';
const DOSSIER = 'captures';
const CHEMIN = process.env.CHEMIN ?? '/';
const SUFFIXE = process.env.SUFFIXE ?? '';
const THEME = process.env.THEME ?? '';
const CIBLE = process.env.CIBLE ?? '';
const CLIC = process.env.CLIC ? process.env.CLIC.split(',').map(Number) : null;
const APRES = Number(process.env.APRES ?? 600);

const [tailleArg, ...defilArgs] = process.argv.slice(2);
const tailles = tailleArg ? [tailleArg] : ['1440x900', '390x844'];
const defilements = defilArgs.length ? defilArgs.map(Number) : [0];

await mkdir(DOSSIER, { recursive: true });
// On demande la vraie carte graphique (D3D11 sous Windows) : la scène WebGL est
// trop lourde pour le rendu logiciel, qui ferait expirer les captures.
const navigateur = await chromium.launch({
  args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'],
});

for (const taille of tailles) {
  const [width, height] = taille.split('x').map(Number);
  const mobile = width < 821;
  const contexte = await navigateur.newContext({
    viewport: { width, height },
    deviceScaleFactor: mobile ? 2 : 1,
    hasTouch: mobile,
    isMobile: mobile,
    reducedMotion: process.env.REDUIT ? 'reduce' : 'no-preference',
  });
  // Le thème est lu dans le stockage du navigateur avant le premier affichage.
  if (THEME) await contexte.addInitScript((theme) => localStorage.setItem('theme', theme), THEME);

  const page = await contexte.newPage();
  const erreurs = [];
  page.on('console', (m) => ['error', 'warning'].includes(m.type()) && erreurs.push(`${m.type()}: ${m.text()}`));
  page.on('pageerror', (e) => erreurs.push(`exception: ${e.message}`));

  await page.goto(BASE + CHEMIN, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !document.documentElement.classList.contains('intro'), null, { timeout: 15000 });
  await page.waitForTimeout(200); // état final de la scène, pas un délai lié à une ancienne intro
  if (!mobile) await page.mouse.move(width * 0.34, height * 0.62, { steps: 8 });

  for (const d of defilements) {
    // Avec CIBLE, on se place sur un élément précis ; sinon, à une fraction de la page.
    const y = CIBLE
      ? await page.evaluate((s) => Math.round(document.querySelector(s).getBoundingClientRect().top + scrollY - 84), CIBLE)
      : await page.evaluate((f) => Math.round((document.documentElement.scrollHeight - innerHeight) * f), d);
    await page.evaluate((cible) => window.scrollTo(0, cible), y);
    await page.waitForTimeout(1600); // laisse le défilement amorti et les animations se poser

    if (process.env.MENU) {
      await page.locator('.barre__menu').click();
      await page.waitForTimeout(1100);
    }
    if (CLIC) {
      const [fx, fy] = CLIC;
      if (mobile) await page.touchscreen.tap(width * fx, height * fy);
      else await page.mouse.click(width * fx, height * fy);
      await page.waitForTimeout(APRES);
    }

    const nom = `${DOSSIER}/${taille}${SUFFIXE}-${String(Math.round(d * 100)).padStart(3, '0')}.png`;
    await page.screenshot({ path: nom });
    console.log(nom);
  }
  if (erreurs.length) console.log(`  console (${taille}) :\n   ` + [...new Set(erreurs)].join('\n   '));
  await contexte.close();
}

await navigateur.close();
