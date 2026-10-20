// RECETTE : les retours de Mathéo du 16 octobre 2026 (4ᵉ lot).
// Le passage « Traverser le portail » qui se fissure et ouvre la carte sur place ; les réalisations dans
// leur lame de verre ; le texte des fins de destination agrandi ; le nom qui ouvre le menu ; le fil des
// Compétences chapitre par chapitre ; les flèches ↑ ↓ ; l'aide clavier ; le CV renommé.
//
// Utilisation (le serveur local doit tourner) :
//   node outils/recettes/retours-lot4.mjs
// Réglages : SITE=http://127.0.0.1:4321 ; CHROMIUM=<chemin d'un Chromium déjà installé> (facultatif).
// Ne modifie aucun fichier du site ; écrit son rapport et ses captures dans captures/lot4/.

import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const SITE = process.env.SITE ?? 'http://127.0.0.1:4321';
const DOSSIER = 'captures/lot4';
await mkdir(DOSSIER, { recursive: true });
const navigateur = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--enable-gpu', '--ignore-gpu-blocklist'] });
const resultats = [];
const erreurs = [];
const controle = async (nom, fn) => {
  try {
    await fn();
    resultats.push({ nom, ok: true });
    console.log('OK     ' + nom);
  } catch (e) {
    resultats.push({ nom, ok: false, erreur: e.message.split('\n')[0] });
    console.log('ÉCHEC  ' + nom + ' : ' + e.message.split('\n')[0]);
  }
};
const visiteur = async (options = {}) => {
  const contexte = await navigateur.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference', ...options });
  await contexte.addInitScript(() => localStorage.setItem('guidage-vu', '1'));
  const p = await contexte.newPage();
  p.on('pageerror', (e) => erreurs.push(e.message));
  return p;
};
const pret = (p) => p.waitForFunction(() => !document.documentElement.classList.contains('intro'), null, { timeout: 40000 });
const lieu = (p) => p.evaluate(() => document.documentElement.dataset.lieu);
const etatFil = (p) => p.evaluate(() => document.querySelector('.trajet__etat')?.textContent.trim().slice(-7));
const enBas = async (p) => {
  await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await p.waitForTimeout(1200);
};

try {
  const p = await visiteur();
  await p.goto(SITE + '/#competences');
  await pret(p);
  await p.waitForTimeout(800);

  await controle('Compétences : le fil avance d’un chapitre à la fois à la molette (01 → 06, sans saut)', async () => {
    await p.mouse.move(700, 500);
    const vus = [await etatFil(p)];
    for (let k = 0; k < 18; k++) {
      await p.mouse.wheel(0, 50);
      await p.waitForTimeout(200);
      const e = await etatFil(p);
      if (e !== vus[vus.length - 1]) vus.push(e);
    }
    assert.deepEqual(vus, ['01 / 06', '02 / 06', '03 / 06', '04 / 06', '05 / 06', '06 / 06']);
  });
  await controle('Compétences : un clic sur chaque point du fil rend ce chapitre actif', async () => {
    const n = await p.locator('.trajet__point').count();
    for (let i = 0; i < n; i++) {
      await p.locator('.trajet__point').nth(i).click();
      await p.waitForTimeout(1500);
      assert.equal(await p.evaluate(() => document.querySelector('.trajet__point[aria-current]')?.dataset.rang), String(i), `point ${i}`);
    }
  });
  await controle('Flèches ↓ ↑ : la destination défile, dans chaque destination', async () => {
    const echecs = [];
    for (const id of ['accueil', 'competences', 'realisations', 'veille', 'contact']) {
      await p.evaluate((id) => import('/src/scripts/voyage.ts').then((m) => m.voyager(id, true, true)), id);
      await p.waitForTimeout(1300);
      await p.evaluate(() => window.scrollTo(0, 0));
      await p.waitForTimeout(300);
      await p.keyboard.press('ArrowDown');
      await p.waitForTimeout(700);
      const bas = await p.evaluate(() => scrollY);
      await p.keyboard.press('ArrowUp');
      await p.waitForTimeout(700);
      const haut = await p.evaluate(() => scrollY);
      if (!(bas > 100 && haut < bas)) echecs.push(`${id} ${bas} ${haut}`);
    }
    assert.deepEqual(echecs, []);
  });
  await controle('Aide clavier : les flèches ↑ ↓ y figurent', async () => {
    await p.keyboard.press('?');
    await p.waitForSelector('.raccourcis[open]');
    assert.match(await p.locator('.raccourcis').textContent(), /Faire défiler la destination/);
    await p.keyboard.press('Escape');
    await p.waitForTimeout(300);
  });

  await controle('Fin des Compétences : la phrase est écrite en grand (comme le titre de la fin de l’accueil)', async () => {
    await p.evaluate(() => import('/src/scripts/voyage.ts').then((m) => m.voyager('competences', true, true)));
    await p.waitForTimeout(1300);
    await enBas(p);
    const taille = await p.evaluate(() => parseFloat(getComputedStyle(document.querySelector('main > .suite[data-suite-de="competences"] .suite__texte')).fontSize));
    assert.ok(taille >= 40, String(taille));
    await p.screenshot({ path: `${DOSSIER}/fin-competences.png` });
  });

  let yLecture = 0;
  await controle('Traverser le portail : le bouton se fissure (même son « charge »), puis la carte s’ouvre sur place', async () => {
    yLecture = await p.evaluate(() => scrollY);
    await p.evaluate(() => {
      window.momentsPortail = [];
      window.addEventListener('portail', (e) => window.momentsPortail.push(e.detail));
    });
    const b = await p.locator('main > .suite[data-suite-de="competences"] .suite__action').boundingBox();
    await p.mouse.click(b.x + b.width * 0.3, b.y + b.height / 2);
    await p.waitForTimeout(150);
    assert.ok(await p.evaluate(() => !!document.querySelector('.suite__action.est-charge .fissures')));
    await p.screenshot({ path: `${DOSSIER}/bouton-fissure.png` });
    await p.waitForSelector('.explorateur.est-formee', { timeout: 30000 });
    await p.waitForTimeout(800);
    assert.equal(await lieu(p), 'competences');
    assert.deepEqual((await p.evaluate(() => window.momentsPortail)).slice(0, 3), ['carte-activation', 'charge', 'rupture']);
    assert.equal(await p.evaluate(() => document.querySelector('.astre[aria-current]')?.dataset.destination), 'competences');
    assert.ok(await p.evaluate(() => document.documentElement.classList.contains('carte-sur-page')));
    await p.screenshot({ path: `${DOSSIER}/carte-sur-place.png` });
  });
  await controle('Refermer : même destination, même position, le bouton se reforme', async () => {
    await p.keyboard.press('Escape');
    await p.waitForFunction(() => !document.querySelector('.explorateur').open, null, { timeout: 20000 });
    await p.waitForTimeout(900);
    assert.equal(await lieu(p), 'competences');
    assert.ok(Math.abs((await p.evaluate(() => scrollY)) - yLecture) < 4);
    assert.ok(await p.evaluate(() => !document.querySelector('.suite__action.est-brise') && !document.documentElement.classList.contains('carte-sur-page')));
    assert.equal(await p.evaluate(() => getComputedStyle(document.getElementById('competences')).visibility), 'visible');
  });

  await controle('Réalisations : dans une lame de verre (contour, coins, fond réglable par l’opacité)', async () => {
    await p.locator('main > .suite[data-suite-de="competences"] .suite__action').click();
    await p.waitForSelector('.explorateur.est-formee', { timeout: 30000 });
    await p.waitForTimeout(500);
    await p.locator('.astre[data-destination="realisations"]').click({ force: true });
    await p.waitForFunction(() => !document.querySelector('.explorateur').open, null, { timeout: 20000 });
    await p.waitForTimeout(2500);
    const style = await p.evaluate(() => {
      const s = getComputedStyle(document.getElementById('realisations'));
      return { bord: s.borderTopWidth, coins: parseFloat(s.borderTopLeftRadius), fond: s.backgroundColor };
    });
    assert.equal(style.bord, '1px');
    assert.ok(style.coins > 10);
    assert.equal(style.fond, 'rgba(20, 28, 43, 0.25)');
    // L'opacité des réglages s'y applique.
    await p.evaluate(() => import('/src/scripts/reglages.ts').then((m) => m.regler('opacite', 0.6)));
    assert.equal(await p.evaluate(() => getComputedStyle(document.getElementById('realisations')).backgroundColor), 'rgba(20, 28, 43, 0.6)');
    await p.evaluate(() => import('/src/scripts/reglages.ts').then((m) => m.regler('opacite', 0.25)));
    // L'anneau est déployé dans la lame.
    const ecarts = await p.locator('.galerie .carte').evaluateAll((c) => c.map((e) => Math.abs(new DOMMatrix(getComputedStyle(e).transform).m41)));
    assert.ok(ecarts.filter((x) => x > 100).length >= 2);
    await p.screenshot({ path: `${DOSSIER}/realisations-lame.png` });
  });

  await controle('Le nom en haut à gauche ouvre le menu (comme le chevron), sans changer de destination', async () => {
    await p.locator('.identite__lien').click();
    await p.waitForTimeout(400);
    assert.ok(await p.evaluate(() => document.querySelector('#acces').matches(':popover-open')));
    assert.equal(await lieu(p), 'realisations');
    assert.equal(await p.locator('.identite__lien').getAttribute('aria-expanded'), 'true');
    await p.locator('.identite__lien').click();
    await p.waitForTimeout(300);
    assert.ok(await p.evaluate(() => !document.querySelector('#acces').matches(':popover-open')));
    await p.locator('.identite__commande').click();
    await p.waitForTimeout(300);
    assert.ok(await p.evaluate(() => document.querySelector('#acces').matches(':popover-open')));
    await p.keyboard.press('Escape');
  });

  await controle('CV : /CV_Matheo_Maleyran.pdf, partout dans le site', async () => {
    const r = await p.request.get(SITE + '/CV_Matheo_Maleyran.pdf');
    assert.equal(r.status(), 200);
    assert.match(r.headers()['content-type'] ?? '', /pdf/);
    assert.equal(await p.locator('a[href*="cv-matheo-maleyran"]').count(), 0);
    assert.ok((await p.locator('a[href="/CV_Matheo_Maleyran.pdf"]').count()) >= 4);
  });
  await p.context().close();

  // ---- Arrivée directe, puis retour sur l'accueil : le grand portail n'est pas noir ----
  const direct = await visiteur();
  await direct.goto(SITE + '/#realisations');
  await pret(direct);
  await controle('Arrivée par #realisations : la lame tout en haut ; puis l’accueil : sa scène à la bonne taille', async () => {
    await direct.waitForTimeout(800);
    assert.equal(await direct.evaluate(() => scrollY), 0);
    await enBas(direct);
    await direct.locator('main > .suite[data-suite-de="realisations"] .suite__action').click();
    await direct.waitForSelector('.explorateur.est-formee', { timeout: 30000 });
    await direct.waitForTimeout(500);
    await direct.locator('.astre[data-destination="accueil"]').click({ force: true });
    await direct.waitForFunction(() => !document.querySelector('.explorateur').open, null, { timeout: 20000 });
    await direct.waitForTimeout(1500);
    const taille = await direct.evaluate(() => [document.getElementById('champ').width, document.getElementById('champ').clientWidth]);
    assert.ok(taille[0] >= taille[1] && taille[1] > 300, taille.join(' / '));
  });
  await direct.context().close();

  // ---- Téléphone et mouvement réduit ----
  const mobile = await visiteur({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await mobile.goto(SITE + '/#realisations');
  await pret(mobile);
  await controle('Téléphone : lame des réalisations, passage, carte sur place, menu par le nom', async () => {
    await mobile.waitForTimeout(800);
    assert.equal(await mobile.evaluate(() => getComputedStyle(document.getElementById('realisations')).borderTopWidth), '1px');
    assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await enBas(mobile);
    await mobile.locator('main > .suite[data-suite-de="realisations"] .suite__action').tap();
    await mobile.waitForSelector('.explorateur.est-formee', { timeout: 30000 });
    assert.equal(await lieu(mobile), 'realisations');
    await mobile.screenshot({ path: `${DOSSIER}/mobile-carte.png` });
    await mobile.locator('.explorateur__fermer').tap();
    await mobile.waitForFunction(() => !document.querySelector('.explorateur').open, null, { timeout: 20000 });
    await mobile.locator('.identite__lien').tap();
    await mobile.waitForTimeout(400);
    assert.ok(await mobile.evaluate(() => document.querySelector('#acces').matches(':popover-open')));
  });
  await mobile.context().close();

  const reduit = await visiteur({ reducedMotion: 'reduce' });
  await reduit.goto(SITE + '/#veille');
  await pret(reduit);
  await controle('Mouvement réduit : la carte s’ouvre aussitôt sur place ; ↑ ↓ défilent', async () => {
    await enBas(reduit);
    await reduit.locator('main > .suite[data-suite-de="veille"] .suite__action').click();
    await reduit.waitForTimeout(400);
    assert.ok(await reduit.locator('.explorateur.est-formee').count());
    assert.equal(await lieu(reduit), 'veille');
    await reduit.keyboard.press('Escape');
    await reduit.waitForTimeout(400);
    const y = await reduit.evaluate(() => scrollY);
    await reduit.keyboard.press('ArrowUp');
    await reduit.waitForTimeout(300);
    assert.ok((await reduit.evaluate(() => scrollY)) < y);
  });
  await reduit.context().close();

  await controle('Aucune exception JavaScript', async () => assert.deepEqual(erreurs, []));
} finally {
  await navigateur.close();
  await writeFile(`${DOSSIER}/resultats.json`, JSON.stringify({ resultats, erreurs }, null, 2));
  const reussis = resultats.filter((r) => r.ok).length;
  console.log(`${reussis}/${resultats.length} contrôles réussis`);
  if (reussis !== resultats.length) process.exitCode = 1;
}
