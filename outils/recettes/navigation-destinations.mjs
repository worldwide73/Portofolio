// RECETTE : la navigation par destinations (16 octobre 2026).
// Vérifie, dans un vrai navigateur, les scénarios de la demande « refonte de la navigation » :
// destinations indépendantes, barre (le lieu affiché, puis Rechercher et Visite rapide), portail (le
// grand portail de l'accueil, rejoint depuis le passage en bas de chaque destination), fil des
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
const lieuAffiche = (p) => p.evaluate(() => [...document.querySelectorAll('.nav__lieu .nav__nom')].filter((e) => e.getClientRects().length).map((e) => e.textContent.trim()).join('|'));
/** Descend au bas de la destination affichée et prend son passage vers le portail. */
const traverser = async (p) => {
  await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await p.waitForTimeout(1200);
  const y = (await etat(p)).y;
  await p.locator(`main > .suite[data-suite-de="${(await etat(p)).destination}"] .suite__action`).click();
  return y;
};
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

  await controle('Barre : « Accueil » sur le fond clair, sans action, puis Rechercher et Visite rapide', async () => {
    assert.equal(await lieuAffiche(p), 'Accueil');
    assert.equal(await p.locator('.nav__lieu').evaluate((e) => e.tagName), 'P');
    assert.equal(await p.locator('[data-outil="portail"], .nav__lieu a, .nav__lieu button').count(), 0);
    assert.deepEqual(await p.locator('.nav__outil').allTextContents().then((t) => t.map((x) => x.trim())), ['Rechercher', 'Visite rapide']);
  });
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
  await controle('Carte : cinq destinations (plus de CV), régulièrement espacées', async () => {
    assert.deepEqual(await p.locator('.astre').evaluateAll((a) => a.map((e) => e.dataset.destination)), ['accueil', 'competences', 'realisations', 'veille', 'contact']);
  });
  await controle('Carte → Réalisations : destination affichée seule, ancre #realisations, lieu écrit dans la barre', async () => {
    await choisir(p, 'realisations');
    const e = await etat(p);
    assert.equal(e.destination, 'realisations');
    assert.equal(e.ancre, '#realisations');
    assert.match(e.fil, /07$/);
    assert.equal(await lieuAffiche(p), 'Réalisations');
  });
  await controle('Galerie : l’anneau est déployé à l’arrivée (pas de cartes empilées)', async () => {
    const ecarts = await p.locator('.galerie .carte').evaluateAll((c) => c.map((e) => Math.abs(new DOMMatrix(getComputedStyle(e).transform).m41)));
    assert.ok(ecarts.filter((x) => x > 100).length >= 2, ecarts.join(', '));
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
  await controle('Passage en bas de Réalisations : l’accueil, puis le grand portail se brise et forme la même carte', async () => {
    await p.locator('.galerie__pause').click(); // la rotation reprend
    yLecture = await traverser(p);
    await p.waitForFunction(() => document.documentElement.classList.contains('carte-en-transition'), null, { timeout: 10000 });
    const pendant = await etat(p);
    assert.equal(pendant.destination, 'accueil'); // le grand portail est sur l'accueil
    assert.equal(pendant.ancre, '#realisations'); // l'adresse ne change pas tant que rien n'est choisi
    await carteFormee(p);
    await p.waitForTimeout(800);
    assert.equal(await p.locator('.explorateur').count(), 1);
    assert.equal(await p.evaluate(() => document.querySelector('.explorateur [aria-current]')?.dataset.destination), 'realisations');
    assert.ok(await p.evaluate(() => !document.querySelector('.explorateur').classList.contains('sans-scene')), 'carte sur fond noir');
    assert.equal(await p.locator('.fracture').count(), 0);
  });
  await controle('Carte ouverte : la page ne bouge plus (molette, touches)', async () => {
    const avant = (await etat(p)).y;
    await p.mouse.wheel(0, 1200);
    await p.waitForTimeout(700);
    await p.keyboard.press('PageDown');
    await p.waitForTimeout(500);
    assert.equal((await etat(p)).y, avant);
  });
  await controle('Fermer la carte sans choisir : retour à la même destination, même position de lecture', async () => {
    await p.keyboard.press('Escape');
    await carteFermee(p);
    await p.waitForTimeout(1200);
    const e = await etat(p);
    assert.equal(e.destination, 'realisations');
    assert.equal(e.ancre, '#realisations');
    assert.ok(Math.abs(e.y - yLecture) < 4, `${e.y} au lieu de ${yLecture}`);
  });
  await controle('Clics répétés sur le passage : une seule transition', async () => {
    const bouton = p.locator('main > .suite[data-suite-de="realisations"] .suite__action');
    await bouton.click();
    await bouton.click({ force: true }).catch(() => {});
    await carteFormee(p);
    assert.equal(await p.locator('.explorateur[open]').count(), 1);
    await p.keyboard.press('Escape');
    await carteFermee(p);
    await p.waitForTimeout(1200);
  });
  await controle('Touche P sans effet ; passage → carte → Contact, jusqu’aux crédits (sans « Revenir en haut »)', async () => {
    await p.keyboard.press('p');
    await p.waitForTimeout(600);
    assert.equal(await p.locator('.explorateur[open]').count(), 0);
    await traverser(p);
    await carteFormee(p);
    await choisir(p, 'contact');
    assert.equal(await lieuAffiche(p), 'Contact');
    await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await p.waitForTimeout(1800);
    const e = await etat(p);
    assert.equal(e.destination, 'contact');
    assert.equal(e.chapitre, 'Crédits');
    assert.ok(await p.locator('.pied').isVisible());
    assert.equal(await p.locator('.pied__haut').count(), 0);
    assert.equal(await p.locator('#contact .suite').count(), 0, 'le passage est encore dans le panneau');
    assert.ok(await p.locator('main > .suite[data-suite-de="contact"]').isVisible());
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
    assert.equal(await p.locator('[data-outil="rapide"]').getAttribute('aria-pressed'), 'true');
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
    assert.ok((await p.locator('.raccourcis').textContent()).includes('Ouvrir ou fermer la recherche'));
    await p.keyboard.press('Escape');
  });
  await controle('Changement de langue sans rechargement : destination et outils traduits', async () => {
    await p.evaluate(() => (window.marque = 1));
    await p.locator('.barre__outils [data-langue]').click();
    await p.waitForFunction(() => document.documentElement.lang === 'en', null, { timeout: 15000 });
    await p.waitForTimeout(1200);
    assert.equal(await p.evaluate(() => window.marque), 1);
    assert.equal((await etat(p)).destination, 'realisations');
    assert.deepEqual(await p.locator('.nav__outil').allTextContents().then((t) => t.map((x) => x.trim())), ['Search', 'Quick view']);
    assert.equal(await lieuAffiche(p), 'Work');
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

  // ---- Arrivée directe sur une destination : le grand portail n'est pas noir ----
  const direct = await page();
  await direct.goto(SITE + '/#contact');
  await pret(direct);
  await controle('Arrivée sur #contact, puis le portail : le paysage et le cube sont là (pas d’écran noir)', async () => {
    await direct.waitForTimeout(800);
    await traverser(direct);
    await carteFormee(direct);
    const taille = await direct.evaluate(() => [document.getElementById('champ').width, document.getElementById('champ').clientWidth]);
    assert.ok(taille[0] >= taille[1] && taille[1] > 300, taille.join(' / '));
    assert.equal(await direct.evaluate(() => document.querySelector('.explorateur [aria-current]')?.dataset.destination), 'contact');
  });
  await direct.screenshot({ path: `${DOSSIER}/carte-depuis-contact.png` });
  await direct.context().close();

  // ---- Mouvement réduit ----
  const reduit = await page({ reducedMotion: 'reduce' });
  await reduit.goto(SITE + '/#veille');
  await pret(reduit);
  await controle('Mouvement réduit : la carte s’ouvre directement, le clavier choisit la destination', async () => {
    await traverser(reduit);
    await reduit.waitForTimeout(500);
    assert.ok(await reduit.locator('.explorateur.est-formee').count());
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
  await controle('Téléphone : menu (le lieu, puis les deux outils), passage, carte, destination', async () => {
    await mobile.locator('.barre__menu').tap();
    await mobile.waitForTimeout(800);
    assert.ok(await mobile.locator('.nav [data-outil="rapide"]').isVisible());
    assert.equal(await lieuAffiche(mobile), 'Accueil');
    assert.equal(await mobile.locator('.nav [data-outil="portail"]').count(), 0);
    await mobile.screenshot({ path: `${DOSSIER}/mobile-menu.png` });
    await mobile.locator('.barre__menu').tap();
    await mobile.waitForTimeout(600);
    await mobile.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await mobile.waitForTimeout(1200);
    await mobile.locator('#accueil .suite__action').tap();
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
