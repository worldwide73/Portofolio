// RECETTE : les huit améliorations du 16 octobre 2026 (densités, restauration de l'affichage,
// mémoire des destinations, mini-guidage, reflets de verre, fin de chapitre, recherche avec
// synonymes, aide clavier), dans un vrai navigateur, au bureau, en mouvement réduit et sur téléphone.
//
// Utilisation (le serveur local doit tourner) :
//   node outils/recettes/huit-ameliorations.mjs
// Réglages : SITE=http://127.0.0.1:4321 ; CHROMIUM=<chemin d'un Chromium déjà installé> (facultatif).
// Ne modifie aucun fichier du site ; écrit son rapport et ses captures dans captures/huit/.

import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const SITE = process.env.SITE ?? 'http://127.0.0.1:4321';
const DOSSIER = 'captures/huit';
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
/** Un visiteur neuf (stockage vide), sauf ce que « avant » pose dans le stockage avant la première page. */
const visiteur = async (options = {}, avant = null) => {
  const contexte = await navigateur.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference', ...options });
  if (avant) await contexte.addInitScript(avant);
  const p = await contexte.newPage();
  p.on('pageerror', (e) => erreurs.push(e.message));
  return p;
};
const pret = (p) => p.waitForFunction(() => !document.documentElement.classList.contains('intro'), null, { timeout: 40000 });
const stockage = (p, cle) => p.evaluate((cle) => localStorage.getItem(cle), cle);
const lieu = (p) => p.evaluate(() => document.documentElement.dataset.lieu);
const taille = (p, selecteur) => p.evaluate((s) => parseFloat(getComputedStyle(document.querySelector(s)).fontSize), selecteur);
const ouvrirReglages = async (p) => {
  await p.locator('[popovertarget="reglages"]').first().click();
  await p.waitForSelector('#reglages:popover-open');
};
/** Le titre et le type des premiers résultats d'une recherche. */
const chercher = async (p, q) => {
  await p.locator('#recherche-champ').fill(q);
  await p.waitForTimeout(120);
  return p.locator('.recherche__resultat').evaluateAll((li) => li.slice(0, 6).map((e) => `${e.querySelector('b').textContent}|${e.querySelector('.recherche__type').textContent}`));
};

try {
  // ==================================================================
  // 1 et 8. DENSITÉS, puis RESTAURER L'AFFICHAGE D'ORIGINE
  // ==================================================================
  const p = await visiteur({}, () => {
    // Un visiteur qui revient : guidage déjà vu, des réglages de son et une sauvegarde de jeu à ne pas toucher.
    localStorage.setItem('guidage-vu', '1');
    if (!localStorage.getItem('reglages-5')) localStorage.setItem('reglages-5', JSON.stringify({ volumeSons: 0.3, atmosphere: 'chill' }));
  });
  await p.goto(SITE + '/#competences');
  await pret(p);
  await p.waitForTimeout(600);
  const reference = {
    titre: await taille(p, '#competences .titre'),
    hero: await p.evaluate(() => getComputedStyle(document.querySelector('.hero__titre')).fontSize),
    portail: await p.evaluate(() => getComputedStyle(document.querySelector('.hero__portail')).width),
  };
  await controle('Densité : Équilibré (l’affichage d’origine) par défaut, sans attribut posé', async () => {
    assert.equal(await p.evaluate(() => document.documentElement.dataset.densite ?? null), null);
    await ouvrirReglages(p);
    assert.ok(await p.locator('input[name="densite"][value="equilibre"]').isChecked());
    await p.screenshot({ path: `${DOSSIER}/reglages-affichage.png` });
  });
  await controle('Densité Compact : instantanée, titres plus petits ; le portail, le hero et la carte ne changent pas', async () => {
    await p.locator('input[name=\"densite\"][value=\"compact\"]').check();
    await p.waitForTimeout(300);
    assert.equal(await p.evaluate(() => document.documentElement.dataset.densite), 'compact');
    assert.ok((await taille(p, '#competences .titre')) < reference.titre * 0.9);
    assert.equal(await p.evaluate(() => getComputedStyle(document.querySelector('.hero__titre')).fontSize), reference.hero);
    assert.equal(await p.evaluate(() => getComputedStyle(document.querySelector('.hero__portail')).width), reference.portail);
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  });
  await controle('Densité Cinématique : titres plus grands, sans débordement horizontal', async () => {
    await p.locator('input[name=\"densite\"][value=\"cinematique\"]').check();
    await p.waitForTimeout(300);
    assert.equal(await p.evaluate(() => document.documentElement.dataset.densite), 'cinematique');
    assert.ok((await taille(p, '#competences .titre')) > reference.titre * 1.1);
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await p.keyboard.press('Escape');
    await p.screenshot({ path: `${DOSSIER}/densite-cinematique-competences.png` });
  });
  await controle('Densité mémorisée après rechargement (posée avant le premier affichage)', async () => {
    await p.reload();
    assert.equal(await p.evaluate(() => document.documentElement.dataset.densite), 'cinematique');
    await pret(p);
  });
  await controle('Restaurer l’affichage d’origine : densité, opacité, flou, lueur, animations ; rien d’autre', async () => {
    await ouvrirReglages(p);
    await p.locator('input[name="opacite"]').evaluate((c) => {
      c.value = '60';
      c.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await p.locator('input[name=\"animations\"][value=\"0.5\"]').check();
    const autres = await p.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter((k) => k !== 'reglages-5').map((k) => [k, localStorage.getItem(k)])));
    const avant = JSON.parse(await stockage(p, 'reglages-5'));
    await p.locator('[data-restaurer]').click();
    await p.waitForTimeout(300);
    const apres = JSON.parse(await stockage(p, 'reglages-5'));
    assert.deepEqual([apres.densite, apres.opacite, apres.flou, apres.lueur, apres.animations], ['equilibre', 0.25, 0.05, 0.7, 1]);
    // Les réglages non visuels (son, ambiance, piste…) ne bougent pas.
    for (const cle of ['sons', 'volumeSons', 'musique', 'volumeMusique', 'atmosphere', 'piste', 'sonAuLancement']) assert.deepEqual(apres[cle], avant[cle], cle);
    // Le reste du stockage (guidage, destinations visitées, Portal Rush, Orbit) non plus.
    assert.deepEqual(await p.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter((k) => k !== 'reglages-5').map((k) => [k, localStorage.getItem(k)]))), autres);
    assert.equal(await p.evaluate(() => document.documentElement.dataset.densite ?? null), null);
    assert.ok(await p.locator('input[name="densite"][value="equilibre"]').isChecked());
    assert.equal(await p.locator('input[name="opacite"]').inputValue(), '25');
    assert.ok(await p.locator('.reglages__confirmation.est-visible').count());
    assert.match(await p.locator('.reglages__confirmation').textContent(), /rétabli/);
    assert.equal((await taille(p, '#competences .titre')).toFixed(2), reference.titre.toFixed(2));
    await p.screenshot({ path: `${DOSSIER}/restauration.png` });
    await p.keyboard.press('Escape');
  });

  // ==================================================================
  // 7. AIDE CLAVIER
  // ==================================================================
  await controle('Aide clavier : touche « ? », touches réelles, sans raccourci de destination ni P du portail', async () => {
    await p.keyboard.press('?');
    await p.waitForSelector('.raccourcis[open]');
    const texte = await p.locator('.raccourcis').textContent();
    assert.match(texte, /Ctrl/);
    assert.match(texte, /Fermer la fenêtre ou la carte active/);
    assert.ok((await p.locator('.raccourcis kbd').count()) >= 20);
    assert.doesNotMatch(texte, /Ouvrir la carte du portail/);
    // P n'apparaît que dans Portal Rush.
    const avecP = await p.locator('.raccourcis__groupe').evaluateAll((g) => g.filter((s) => [...s.querySelectorAll('kbd')].some((k) => k.textContent === 'P')).map((s) => s.querySelector('h3').textContent));
    assert.deepEqual(avecP, ['Portal Rush']);
    await p.screenshot({ path: `${DOSSIER}/aide-clavier.png` });
    await p.keyboard.press('Tab');
    assert.ok(await p.evaluate(() => !!document.activeElement?.closest('.raccourcis')));
    await p.keyboard.press('Escape');
    await p.waitForTimeout(300);
    assert.equal(await p.locator('.raccourcis[open]').count(), 0);
    assert.ok(await p.evaluate(() => document.activeElement?.classList.contains('identite__commande')));
  });
  await controle('Aide clavier : aucun effet pendant une saisie (recherche)', async () => {
    await p.keyboard.press('Control+k');
    await p.waitForSelector('.recherche[open]');
    await p.keyboard.type('?');
    await p.waitForTimeout(200);
    assert.equal(await p.locator('.raccourcis[open]').count(), 0);
    // (Dans un champ de recherche rempli, la première Échap vide le champ, la seconde ferme la fenêtre.)
    await p.keyboard.press('Escape');
    if (await p.locator('.recherche[open]').count()) await p.keyboard.press('Escape');
    await p.waitForTimeout(200);
    assert.equal(await p.locator('.recherche[open]').count(), 0);
  });

  // ==================================================================
  // 6. RECHERCHE AVEC SYNONYMES
  // ==================================================================
  await controle('Recherche : synonymes, variantes, accents, majuscules, fautes, mots vides', async () => {
    await p.keyboard.press('Control+k');
    await p.waitForSelector('.recherche[open]');
    const attendus = [
      ['jeu', /Portal Rush/],
      ['gaming', /Portal Rush/],
      ['arcade', /Portal Rush/],
      ['alternance', /Contact|CV|Parcours/],
      ['candidature', /CV/],
      ['recrutement', /Contact|CV/],
      ['langage', /Compétence/],
      ['programmation', /Compétence/],
      ['technologies', /Compétence/],
      ['réalisations', /Réalisation/],
      ['application', /Réalisation/],
      ['mail', /E-mail/],
      ['email', /E-mail/],
      ['me joindre', /Contact/],
      ['ELECTRON', /Electron/],
      ['securite', /./],
      ['pyhon', /Python/],
      ['javscript', /JavaScript/],
    ];
    const echecs = [];
    for (const [q, motif] of attendus) {
      const r = await chercher(p, q);
      if (!r.length || !r.slice(0, 5).some((x) => motif.test(x))) echecs.push(`${q} → ${r.slice(0, 3).join(' ; ') || '∅'}`);
    }
    assert.deepEqual(echecs, []);
    assert.equal((await chercher(p, 'xyzabc')).length, 0);
    assert.match(await p.locator('.recherche__etat').textContent(), /Aucun résultat/);
    await chercher(p, 'gaming');
    await p.screenshot({ path: `${DOSSIER}/recherche-gaming.png` });
  });
  await controle('Recherche : un résultat explicite vers Contact, par le court fondu (pas le saut dans le temps)', async () => {
    await p.evaluate(() => window.scrollTo(0, 0));
    await chercher(p, 'téléphone');
    await p.keyboard.press('Enter');
    let saut = false;
    for (let k = 0; k < 10; k++) {
      saut ||= await p.evaluate(() => document.documentElement.classList.contains('en-aller') || document.documentElement.classList.contains('en-retour'));
      await p.waitForTimeout(100);
    }
    await p.waitForTimeout(1000);
    assert.equal(await lieu(p), 'contact');
    assert.equal(saut, false);
  });
  await p.context().close();

  // ==================================================================
  // 2. MÉMOIRE DES DESTINATIONS, et 5. MINI-GUIDAGE
  // ==================================================================
  const neuf = await visiteur();
  await neuf.goto(SITE + '/');
  await pret(neuf);
  await controle('Guidage : affiché à la première visite, près du grand portail, mémorisé', async () => {
    await neuf.waitForSelector('.guidage.est-visible', { timeout: 8000 });
    assert.match(await neuf.locator('.guidage').textContent(), /Votre voyage commence ici/);
    assert.equal(await stockage(neuf, 'guidage-vu'), '1');
    const g = await neuf.locator('.guidage').boundingBox();
    const portail = await neuf.locator('.hero__portail').boundingBox();
    assert.ok(g.x > portail.x + portail.width - 4, 'à droite du portail');
    await neuf.screenshot({ path: `${DOSSIER}/guidage-bureau.png` });
  });
  await controle('Guidage : « Compris » le ferme ; il ne revient pas au rechargement', async () => {
    await neuf.locator('.guidage__fermer').click();
    await neuf.waitForTimeout(600);
    assert.ok(await neuf.locator('.guidage').evaluate((g) => g.hidden));
    await neuf.reload();
    await pret(neuf);
    await neuf.waitForTimeout(2000);
    assert.equal(await neuf.locator('.guidage.est-visible').count(), 0);
  });
  await controle('Guidage : on peut le revoir depuis l’aide clavier', async () => {
    await neuf.keyboard.press('?');
    await neuf.waitForSelector('.raccourcis[open]');
    await neuf.locator('[data-revoir-guidage]').click();
    await neuf.waitForSelector('.guidage.est-visible', { timeout: 5000 });
    await neuf.keyboard.press('Escape');
    await neuf.waitForTimeout(600);
    assert.equal(await neuf.locator('.guidage.est-visible').count(), 0);
  });
  await controle('Mémoire : l’accueil d’arrivée est noté ; une destination rejointe aussi', async () => {
    assert.deepEqual(JSON.parse(await stockage(neuf, 'destinations-visitees')), ['accueil']);
    await neuf.keyboard.press('Control+k');
    await neuf.locator('#recherche-champ').fill('veille');
    await neuf.waitForTimeout(150);
    await neuf.keyboard.press('Enter');
    await neuf.waitForTimeout(1500);
    assert.equal(await lieu(neuf), 'veille');
    assert.deepEqual(JSON.parse(await stockage(neuf, 'destinations-visitees')).sort(), ['accueil', 'veille']);
  });
  await controle('Mémoire : sur la carte, un point discret sur les seules destinations visitées ; positions inchangées', async () => {
    await neuf.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await neuf.waitForTimeout(1000);
    await neuf.locator('main > .suite[data-suite-de="veille"] .suite__action').click();
    await neuf.waitForSelector('.explorateur.est-formee', { timeout: 30000 });
    await neuf.waitForTimeout(600);
    const marques = await neuf.locator('.astre').evaluateAll((a) => a.filter((e) => e.hasAttribute('data-visitee')).map((e) => e.dataset.destination).sort());
    assert.deepEqual(marques, ['accueil', 'veille']);
    const point = await neuf.locator('.astre[data-visitee] i').first().evaluate((i) => getComputedStyle(i, '::after').width);
    assert.equal(point, '4px');
    assert.equal(await neuf.locator('.astre').count(), 5);
    await neuf.screenshot({ path: `${DOSSIER}/carte-souvenirs.png` });
    await neuf.keyboard.press('Escape');
    await neuf.waitForFunction(() => !document.querySelector('.explorateur').open, null, { timeout: 20000 });
  });
  await neuf.context().close();

  const detour = await visiteur({}, () => localStorage.setItem('guidage-vu', '1'));
  await detour.goto(SITE + '/#contact');
  await pret(detour);
  await controle('Mémoire : le court passage par l’accueil, le temps que le portail se brise, n’est pas une visite', async () => {
    await detour.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await detour.waitForTimeout(1000);
    await detour.locator('main > .suite[data-suite-de="contact"] .suite__action').click();
    await detour.waitForSelector('.explorateur.est-formee', { timeout: 30000 });
    assert.deepEqual(JSON.parse(await stockage(detour, 'destinations-visitees')), ['contact']);
    assert.equal(await detour.locator('.astre[data-destination="accueil"][data-visitee]').count(), 0);
    await detour.keyboard.press('Escape');
    await detour.waitForFunction(() => !document.querySelector('.explorateur').open, null, { timeout: 20000 });
  });
  await detour.context().close();

  // ==================================================================
  // 3. REFLETS DE VERRE, et 4. FIN DE CHAPITRE
  // ==================================================================
  const lecteur = await visiteur({}, () => localStorage.setItem('guidage-vu', '1'));
  await lecteur.goto(SITE + '/#competences');
  await pret(lecteur);
  await lecteur.waitForTimeout(600);
  await controle('Reflets : la pastille de la barre suit le curseur, puis s’éteint ; trois surfaces seulement', async () => {
    assert.equal(await lecteur.locator('.reflet').count(), await lecteur.locator('.nav__liste, .suite__action, .contact__linkedin').count());
    const b = await lecteur.locator('.nav__liste').boundingBox();
    await lecteur.mouse.move(b.x + 10, b.y + b.height / 2);
    await lecteur.mouse.move(b.x + b.width * 0.7, b.y + b.height / 2, { steps: 4 });
    await lecteur.waitForTimeout(400);
    assert.ok(await lecteur.locator('.nav__liste.a-reflet').count());
    const rx = parseFloat(await lecteur.locator('.nav__liste').evaluate((e) => e.style.getPropertyValue('--rx')));
    assert.ok(rx > 55 && rx < 85, String(rx));
    await lecteur.mouse.move(700, 600);
    await lecteur.waitForTimeout(300);
    assert.equal(await lecteur.locator('.nav__liste.a-reflet').count(), 0);
  });
  await controle('Fin de chapitre : lu à la molette en s’y attardant → segment allumé une fois ; un saut ne compte pas', async () => {
    // Un saut par le fil (clic sur le 4e point) : aucun chapitre ne devient « lu ».
    await lecteur.locator('.trajet__point').nth(3).click();
    await lecteur.waitForTimeout(2600);
    assert.equal(await lecteur.locator('.trajet__fil li.est-lu').count(), 0);
    await lecteur.locator('.trajet__point').nth(0).click();
    await lecteur.waitForTimeout(2600);
    // La lecture à la main : on reste dans le premier chapitre, puis on descend à la molette jusqu'au suivant.
    await lecteur.mouse.move(700, 500);
    await lecteur.waitForTimeout(1800);
    let vu = false;
    for (let k = 0; k < 14 && !vu; k++) {
      await lecteur.mouse.wheel(0, 90);
      await lecteur.waitForTimeout(260);
      vu = (await lecteur.locator('.trajet__fil li.vient-d-etre-lu').count()) > 0 || (await lecteur.locator('.trajet__fil li.est-lu').count()) > 0;
    }
    assert.ok(vu, 'aucun chapitre lu');
    assert.equal(await lecteur.locator('.trajet__fil li.est-lu').first().evaluate((li) => li.querySelector('.trajet__point').dataset.rang), '0');
    await lecteur.screenshot({ path: `${DOSSIER}/fil-chapitre-lu.png` });
    // Retour en arrière puis en avant : pas de nouvelle animation pour ce chapitre.
    await lecteur.waitForTimeout(1500);
    await lecteur.mouse.wheel(0, -1200);
    await lecteur.waitForTimeout(1500);
    await lecteur.mouse.wheel(0, 500);
    await lecteur.waitForTimeout(500);
    assert.equal(await lecteur.locator('.trajet__fil li:first-child.vient-d-etre-lu').count(), 0);
    assert.equal(await lecteur.locator('.trajet__fil li:first-child.est-lu').count(), 1);
  });
  await lecteur.context().close();

  // ==================================================================
  // MOUVEMENT RÉDUIT et TÉLÉPHONE
  // ==================================================================
  const reduit = await visiteur({ reducedMotion: 'reduce' });
  await reduit.goto(SITE + '/');
  await pret(reduit);
  await controle('Mouvement réduit : guidage affiché sans animation, pas de reflets, densités disponibles', async () => {
    await reduit.waitForSelector('.guidage.est-visible', { timeout: 8000 });
    assert.equal(await reduit.locator('.reflet').count(), 0);
    await ouvrirReglages(reduit);
    await reduit.locator('input[name=\"densite\"][value=\"compact\"]').check();
    assert.equal(await reduit.evaluate(() => document.documentElement.dataset.densite), 'compact');
  });
  await reduit.context().close();

  const mobile = await visiteur({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await mobile.goto(SITE + '/');
  await pret(mobile);
  await controle('Téléphone : guidage au-dessus du portail (geste « Défiler »), sans débordement ; densités sans débordement', async () => {
    await mobile.waitForSelector('.guidage.est-visible', { timeout: 8000 });
    const g = await mobile.locator('.guidage').boundingBox();
    assert.ok(g.x >= 0 && g.x + g.width <= 390, JSON.stringify(g));
    assert.ok(await mobile.locator('.guidage__doigt').isVisible());
    await mobile.screenshot({ path: `${DOSSIER}/guidage-mobile.png` });
    await mobile.locator('.guidage__fermer').tap();
    for (const d of ['compact', 'cinematique']) {
      await mobile.evaluate((d) => (document.documentElement.dataset.densite = d), d);
      for (const id of ['competences', 'veille', 'contact']) {
        await mobile.evaluate((id) => (document.documentElement.dataset.lieu = id), id);
        await mobile.waitForTimeout(150);
        assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${d} ${id}`);
      }
    }
  });
  await mobile.context().close();

  await controle('Aucune exception JavaScript', async () => assert.deepEqual(erreurs, []));
} finally {
  await navigateur.close();
  await writeFile(`${DOSSIER}/resultats.json`, JSON.stringify({ resultats, erreurs }, null, 2));
  const reussis = resultats.filter((r) => r.ok).length;
  console.log(`${reussis}/${resultats.length} contrôles réussis`);
  if (reussis !== resultats.length) process.exitCode = 1;
}
