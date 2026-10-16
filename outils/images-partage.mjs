// Fabrique les deux images que le <head> du site référence :
//   public/partage.jpg   l'aperçu affiché quand on partage le lien (1200 × 630)
//   public/icone-180.png l'icône pour l'écran d'accueil des téléphones
// À relancer si le hero ou le favicon changent (le serveur local doit tourner) :
//   node outils/images-partage.mjs

import { chromium } from 'playwright';
import sharp from 'sharp';

const BASE = process.env.SITE ?? 'http://localhost:4321';

// ---- L'image de partage : le hero, sans la barre ni les boutons ----
const navigateur = await chromium.launch({ args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const page = await navigateur.newPage({ viewport: { width: 1200, height: 630 }, reducedMotion: 'no-preference' });
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
// L'introduction se joue à chaque chargement : on la passe.
await page.locator('.initialisation.est-active .initialisation__passer').click().catch(() => {});
await page.addStyleTag({
  content:
    '.barre, .progression, .curseur, .hero__actions, .trajet, .jeu-bouton, .initialisation { display: none !important } .hero { padding: 0 !important } .hero__cadre { border-radius: 0 !important }',
});
// (Le cadre a changé de taille : la scène WebGL se redimensionne, sinon une bande sombre reste au bord.)
await page.evaluate(() => window.dispatchEvent(new Event('resize')));
await page.waitForTimeout(6000); // entrée de page terminée, étoile filante passée
const capture = await page.screenshot({ type: 'png' });
await navigateur.close();
await sharp(capture).jpeg({ quality: 86, mozjpeg: true }).toFile('public/partage.jpg');
console.log('public/partage.jpg');

// ---- L'icône : le favicon, agrandi sur un fond plein ----
await sharp('public/favicon.svg', { density: 600 })
  .resize(120, 120, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .extend({ top: 30, bottom: 30, left: 30, right: 30, background: '#0c0d10' })
  .flatten({ background: '#0c0d10' })
  .png()
  .toFile('public/icone-180.png');
console.log('public/icone-180.png');
