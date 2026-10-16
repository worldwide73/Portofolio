// RECETTE : la navigation par destinations (16 octobre 2026).
// Vérifie, dans un vrai navigateur, les scénarios de la demande « refonte de la navigation » :
// destinations indépendantes, portail (grand portail, bouton de la barre, touche P), fil des
// chapitres, recherche, visite rapide, menu d'identité, Portal Rush, langue, mouvement réduit, mobile.
//
// Utilisation (le serveur local doit tourner) :
//   node outils/recettes/navigation-destinations.mjs
// Réglages : SITE=http://127.0.0.1:4321 ; CHROMIUM=<chemin d'un Chromium déjà installé> (facultatif).
// Ne modifie aucun fichier du site ; écrit son rapport dans captures/navigation/.

import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const SITE = process.env.SITE ?? 'http://127.0.0.1:4321';
const DOSSIER = 'captures/navigation';
await mkdir(DOSSIER, { recursive: true });
const navigateur = await chromium.launch({
  executablePath: process.env.CHROMIUM || undefined,
  args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'],
});
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
const page = async (options = {}) => {
  const contexte = await navigateur.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference', ...options });
  const p = await contexte.newPage();
  p.on('pageerror', (e) => erreurs.push(e.message));
  return p;
};
const pret = (p) => p.waitForFunction(() => !document.documentElement.classList.contains('intro'), null, { timeout: 30000 });
const etat = (p) =>
  p.evaluate(() => ({
    destination: document.documentElement.dataset.lieu,
    y: Math.round(scrollY),
    fin: document.documentElement.scrollHeight - innerHeight,
    ancre: location.hash,
    fil: document.querySelector('.trajet__etat')?.textContent ?? '',
    chapitre: document.querySelector('.trajet__point[aria-current]')?.textContent ?? '',
    carte: !!document.querySelector('.explorateur[open]'),
  }));
const carteFormee = (p) => p.waitForSelector('.explorateur.est-formee', { timeout: 20000 });
const carteFermee = (p) => p.waitForFunction(() => !document.querySelector('.explorateur').open, null, { timeout: 20000 });
const choisir = async (p, id) => {
  const b = await p.locator(`.explorateur [data-destination="${id}"] i`).boundingBox();
  await p.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await carteFermee(p);
  await p.waitForTimeout(1500);
};

try {
  const p = await page();
  await p.goto(SITE + '/');
  await pret(p);
  await p.mouse.move(30, 880);

  await controle('Accueil : quatre chapitres, Intro actif en haut', async () => {
    const e = await etat(p);
    assert.equal(e.destination, 'accueil');
    assert.deepEqual(await p.locator('.trajet__point').allTextContents(), ['Intro', 'Méthode', 'Parcours', 'Explorer']);
    assert.equal(e.chapitre, 'Intro');
  });
  await controle('Le défilement s’arrête à la fin de l’accueil (pas de passage à Compétences)', async () => {
    await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await p.waitForTimeout(1800);
    const e = await etat(p);
    assert.equal(e.destination, 'accueil');
    assert.equal(e.chapitre, 'Explorer');
    assert.ok(await p.locator('#competences').evaluate((s) => s.getClientRects().length === 0), 'Compétences visible');
  });
  await controle('« Rejoindre le portail » : remonte au grand portail et ouvre la carte sans second clic', async () => {
    await p.locator('#accueil .suite__action').click();
    await carteFormee(p);
    const e = await etat(p);
    assert.equal(e.y, 0);
    assert.ok(e.carte);
  });
  await controle('Carte → Réalisations : destination affichée seule, ancre #realisations', async () => {
    await choisir(p, 'realisations');
    const e = await etat(p);
    assert.equal(e.destination, 'realisations');
    assert.equal(e.ancre, '#realisations');
    assert.match(e.fil, /07$/);
  });
  await controle('La molette explore Réalisations sans en sortir', async () => {
    await p.mouse.wheel(0, 4000);
    await p.waitForTimeout(1800);
    const e = await etat(p);
    assert.equal(e.destination, 'realisations');
    assert.ok(e.y <= e.fin);
    await p.mouse.wheel(0, -4000);
    await p.waitForTimeout(1200);
  });
  await controle('Fil → projet : la galerie amène ce projet de face, le fil suit', async () => {
    await p.locator('.galerie__pause').click(); // la rotation automatique ne doit pas fausser la lecture
    await p.locator('.trajet__point').nth(4).click();
    await p.waitForTimeout(2500);
    assert.equal(await p.locator('[data-courant]').evaluate((e) => e.textContent.replace(/\s/g, '')), '05');
    assert.equal((await etat(p)).chapitre, 'Tweaks');
  });
  let yLecture = 0;
  await controle('Bouton Portail (barre) : cassure du bouton, puis la même carte s’ouvre', async () => {
    await p.mouse.wheel(0, 300);
    await p.waitForTimeout(1200);
    yLecture = (await etat(p)).y;
    const b = await p.locator('[data-outil="portail"]').boundingBox();
    await p.mouse.click(b.x + b.width * 0.4, b.y + b.height / 2);
    await p.waitForTimeout(120);
    assert.ok(await p.evaluate(() => document.querySelector('[data-outil="portail"]').matches('.est-charge, .est-brise')), 'le bouton ne réagit pas');
    assert.ok(await p.evaluate(() => !!document.querySelector('.fracture:popover-open')), 'pas de toile de cassure');
    await carteFormee(p);
    await p.waitForTimeout(1200);
    assert.equal(await p.locator('.explorateur').count(), 1);
    assert.equal(await p.evaluate(() => document.querySelector('.explorateur [aria-current]')?.dataset.destination), 'realisations');
    assert.ok(await p.evaluate(() => !document.querySelector('.fracture:popover-open')), 'toile non nettoyée');
    assert.ok(await p.evaluate(() => !document.querySelector('[data-outil="portail"]').matches('.est-charge, .est-brise')), 'bouton non restauré');
  });
  await controle('Fermer la carte sans choisir : même destination, même position de lecture', async () => {
    await p.keyboard.press('Escape');
    await carteFermee(p);
    await p.waitForTimeout(800);
    const e = await etat(p);
    assert.equal(e.destination, 'realisations');
    assert.ok(Math.abs(e.y - yLecture) < 4, `${e.y} au lieu de ${yLecture}`);
  });
  await controle('Clics répétés sur Portail : une seule transition', async () => {
    const bouton = p.locator('[data-outil="portail"]');
    await bouton.click();
    await bouton.click({ force: true }).catch(() => {});
    await carteFormee(p);
    assert.equal(await p.locator('.explorateur[open]').count(), 1);
    await p.keyboard.press('Escape');
    await carteFermee(p);
    await p.waitForTimeout(600);
  });
  await controle('Touche P → carte → Contact, puis jusqu’aux crédits du pied de page', async () => {
    await p.keyboard.press('p');
    await carteFormee(p);
    await choisir(p, 'contact');
    await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await p.waitForTimeout(1800);
    const e = await etat(p);
    assert.equal(e.destination, 'contact');
    assert.equal(e.chapitre, 'Crédits');
    assert.ok(await p.locator('.pied').isVisible());
  });
  await controle('Bouton « précédent » du navigateur : retour à Réalisations', async () => {
    await p.goBack();
    await p.waitForTimeout(1800);
    assert.equal((await etat(p)).destination, 'realisations');
  });
  await controle('Recherche : vraies données, états, Entrée et Échap', async () => {
    await p.keyboard.press('Control+k');
    await p.waitForSelector('.recherche[open]');
    for (const [q, attendu] of [['python', 'Python'], ['supabase', 'Supabase'], ['electron', 'Electron'], ['cv', 'CV']]) {
      await p.locator('#recherche-champ').fill(q);
      await p.waitForTimeout(150);
      assert.ok((await p.locator('.recherche__resultat b').first().textContent()).includes(attendu), q);
    }
    await p.locator('#recherche-champ').fill('xyzabc');
    await p.waitForTimeout(150);
    assert.equal(await p.locator('.recherche__resultat').count(), 0);
    assert.match(await p.locator('.recherche__etat').textContent(), /Aucun résultat/);
    await p.locator('#recherche-champ').fill('tweaks');
    await p.waitForTimeout(150);
    await p.keyboard.press('Enter');
    await p.waitForTimeout(2800);
    assert.equal((await etat(p)).destination, 'realisations');
    assert.equal(await p.locator('[data-courant]').evaluate((e) => e.textContent.replace(/\s/g, '')), '05');
    await p.locator('[data-outil="recherche"]').click();
    await p.waitForSelector('.recherche[open]');
    await p.keyboard.press('Escape');
    await p.waitForTimeout(300);
    assert.equal(await p.locator('.recherche[open]').count(), 0);
    assert.equal(await p.evaluate(() => document.activeElement?.dataset.outil), 'recherche');
  });
  await controle('Visite rapide : contenu réel, puis retour au mode immersif', async () => {
    await p.locator('[data-outil="rapide"]').click();
    await p.waitForSelector('.rapide[open]');
    assert.equal(await p.locator('.rapide__projets li').count(), 7);
    assert.equal(await p.locator('.nav__outil[data-actif]').getAttribute('data-outil'), 'rapide');
    assert.ok(await p.locator('.rapide a[href="/cv-matheo-maleyran.pdf"]').count());
    await p.keyboard.press('Escape');
    await p.waitForTimeout(300);
    assert.equal(await p.locator('.rapide[open]').count(), 0);
    assert.equal((await etat(p)).destination, 'realisations');
  });
  await controle('Menu d’identité : informations et actions, sans navigation parallèle', async () => {
    await p.locator('.identite__commande').click();
    await p.waitForTimeout(400);
    assert.equal(await p.locator('#acces a[href^="#"]').count(), 0);
    assert.deepEqual(await p.locator('#acces .acces__texte').allTextContents(), ['Mon CV', 'Mon LinkedIn', 'Mon GitHub', 'Copier mon e-mail', 'Partager le portfolio', 'Commandes clavier']);
    assert.equal(await p.locator('#acces a[download]').getAttribute('href'), '/cv-matheo-maleyran.pdf');
    await p.locator('[data-action="raccourcis"]').click();
    await p.waitForSelector('.raccourcis[open]');
    assert.ok((await p.locator('.raccourcis').textContent()).includes('Rechercher dans le portfolio'));
    await p.keyboard.press('Escape');
  });
  await controle('Changement de langue sans rechargement : destination et outils traduits', async () => {
    await p.evaluate(() => (window.marque = 1));
    await p.locator('.barre__outils [data-langue]').click();
    await p.waitForFunction(() => document.documentElement.lang === 'en', null, { timeout: 15000 });
    await p.waitForTimeout(1200);
    assert.equal(await p.evaluate(() => window.marque), 1);
    assert.equal((await etat(p)).destination, 'realisations');
    assert.deepEqual(await p.locator('.nav__outil').allTextContents().then((t) => t.map((x) => x.trim())), ['Portal', 'Search', 'Quick view']);
  });
  await p.screenshot({ path: `${DOSSIER}/bureau-fin.png` });
  await p.context().close();

  // ---- Portal Rush : les raccourcis du site ne gênent pas le jeu ----
  const jeu = await page();
  await jeu.goto(SITE + '/#realisations');
  await pret(jeu);
  await controle('Portal Rush : P, ← →, Ctrl+K sans effet sur le site ; quitter ramène en haut de l’accueil', async () => {
    await jeu.locator('.jeu-bouton').click();
    await jeu.locator('[data-onglet="rush"]').click();
    await jeu.waitForSelector('.rush[open]', { timeout: 20000 });
    await jeu.waitForTimeout(2000);
    for (const touche of ['p', 'ArrowRight', 'ArrowLeft', 'Control+k']) await jeu.keyboard.press(touche);
    await jeu.waitForTimeout(500);
    assert.equal(await jeu.locator('.explorateur[open], .recherche[open]').count(), 0);
    assert.equal((await etat(jeu)).destination, 'realisations');
    await jeu.keyboard.press('Escape');
    await jeu.waitForTimeout(2500);
    assert.equal(await jeu.locator('.rush[open]').count(), 0);
    const e = await etat(jeu);
    assert.equal(e.destination, 'accueil');
    assert.equal(e.ancre, '');
  });
  await jeu.context().close();

  // ---- Mouvement réduit ----
  const reduit = await page({ reducedMotion: 'reduce' });
  await reduit.goto(SITE + '/#veille');
  await pret(reduit);
  await controle('Mouvement réduit : la carte s’ouvre directement, le clavier choisit la destination', async () => {
    await reduit.locator('[data-outil="portail"]').click();
    await reduit.waitForTimeout(300);
    assert.ok(await reduit.locator('.explorateur.est-formee').count());
    assert.equal(await reduit.evaluate(() => !!document.querySelector('.fracture:popover-open')), false);
    await reduit.keyboard.press('ArrowRight');
    await reduit.keyboard.press('Enter');
    await reduit.waitForTimeout(600);
    assert.equal((await etat(reduit)).destination, 'contact');
    await reduit.keyboard.press('ArrowRight');
    await reduit.waitForTimeout(500);
    assert.equal((await etat(reduit)).chapitre, 'Coordonnées');
  });
  await reduit.context().close();

  // ---- Téléphone (émulation) ----
  const mobile = await page({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await mobile.goto(SITE + '/');
  await pret(mobile);
  await controle('Téléphone : menu des trois outils, carte, destination', async () => {
    await mobile.locator('.barre__menu').tap();
    await mobile.waitForTimeout(800);
    assert.ok(await mobile.locator('.nav [data-outil="rapide"]').isVisible());
    await mobile.locator('.nav [data-outil="portail"]').tap();
    await carteFormee(mobile);
    await mobile.locator('[data-destination="competences"]').evaluate((a) => a.click());
    await mobile.waitForTimeout(2200);
    const e = await etat(mobile);
    assert.equal(e.destination, 'competences');
    assert.match(e.fil, /06$/);
  });
  await mobile.screenshot({ path: `${DOSSIER}/mobile-competences.png` });
  await mobile.context().close();

  await controle('Aucune exception JavaScript', async () => assert.deepEqual(erreurs, []));
} finally {
  await navigateur.close();
  await writeFile(`${DOSSIER}/resultats.json`, JSON.stringify({ resultats, erreurs }, null, 2));
  const reussis = resultats.filter((r) => r.ok).length;
  console.log(`${reussis}/${resultats.length} contrôles réussis`);
  if (reussis !== resultats.length) process.exitCode = 1;
}
