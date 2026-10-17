// RECETTE : Portal Rush V4-C — l'entrée cinématographique et le tutoriel immersif (17 octobre 2026).
// Joue réellement, au clavier et à la souris, dans un Chromium sans écran :
//   A. avec WebGL (la vraie 3D) : l'entrée depuis l'Orbital Hub (le bouton se fissure, se brise en éclats 3D,
//      le tunnel, l'arrivée) ; le premier lancement mène directement à l'étape 1 du tutoriel (ni menu, ni
//      « Commencer », ni 3-2-1) ; l'étape 1 réussie aux flèches ; « PASSER LE TUTORIEL » ; le Hub intact au
//      retour ; le lancement suivant (menu, « Passer » tout de suite, Échap) ;
//   B. sans WebGL (le rendu 2D de secours, même moteur, mêmes touches) : le tutoriel joué en entier — l'assistance
//      (le vaisseau ralentit), l'échec qui fait recommencer l'étape, les cinq étapes, la finale, le menu ; aucun
//      record ni statistique ; « Refaire l'entraînement » ; « Recommencer » en pause rejoue l'étape ; la reprise
//      à la même étape après une sortie ; le son du moteur coupé à la fin ;
//   C. animations réduites : la version courte du voyage.
// (Pourquoi deux temps : ce Chromium n'a pas de carte graphique ; la 3D y est émulée par le processeur et tourne
// à 1-5 images/s, et le jeu, qui borne chaque pas à 50 ms, y avance au ralenti. Le tutoriel entier en 3D y
// prendrait plus d'un quart d'heure ; le rendu 2D y tourne à pleine vitesse.)
//
// Utilisation (le serveur local doit tourner) : node outils/recettes/portal-rush-v4c.mjs
// Réglages : SITE ; CHROMIUM (chemin d'un Chromium déjà installé). Écrit captures/v4/v4c.json et des captures.

import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const SITE = process.env.SITE ?? 'http://127.0.0.1:4321';
const DOSSIER = 'captures/v4';
await mkdir(DOSSIER, { recursive: true });
const avec3D = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--autoplay-policy=no-user-gesture-required'] });
const en2D = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--autoplay-policy=no-user-gesture-required', '--disable-webgl', '--disable-3d-apis'] });
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
const visiteur = async (navigateur, options = {}) => {
  const contexte = await navigateur.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference', ...options });
  await contexte.addInitScript(() => localStorage.setItem('guidage-vu', '1'));
  const p = await contexte.newPage();
  p.on('pageerror', (e) => erreurs.push(e.message));
  // (Sans WebGL, l'échec de création du contexte 3D est attendu : c'est lui qui fait passer au rendu 2D.)
  const attendu = navigateur === en2D ? /Failed to load resource|webgl context/i : /Failed to load resource/;
  p.on('console', (m) => m.type() === 'error' && !attendu.test(m.text()) && erreurs.push('console : ' + m.text()));
  await p.goto(SITE + '/');
  await p.waitForFunction(() => !document.documentElement.classList.contains('intro') && window.__portalRush, null, { timeout: 40000 });
  await p.waitForTimeout(500);
  return p;
};
const etat = (p) =>
  p.evaluate(() => {
    const r = window.__portalRush;
    const e = r.etat();
    return { ecran: e.ecran, compte: e.compte, transition: e.transition, distance: e.distanceAffichee, tuto: r.tutoriel(), s: { tutoriel: e.sauvegarde.tutoriel, totaux: e.sauvegarde.totaux, records: e.sauvegarde.records } };
  });
/** Ouvre l'Orbital Hub et clique (vraie souris) sur l'onglet Portal Rush. */
const lancerDepuisHub = async (p) => {
  await p.click('.jeu-bouton');
  await p.waitForFunction(() => document.querySelector('#hub')?.matches(':popover-open'));
  await p.waitForTimeout(400);
  await p.evaluate(() => {
    window.__voyage = [];
    // (La toile des fissures ne vit que la demi-seconde de la charge : on note son apparition au moment même.)
    window.__fissures = false;
    window.__brise = false;
    window.__passerAuDebut = null;
    const b = document.querySelector('#hub [data-onglet="rush"]');
    new MutationObserver(() => b.querySelector('canvas.fissures-entree') && (window.__fissures = true)).observe(b, { childList: true });
    new MutationObserver(() => b.classList.contains('est-brise') && (window.__brise = true)).observe(b, { attributes: true, attributeFilter: ['class'] });
    // (L'état de « Passer » au moment même où la couche du voyage apparaît.)
    new MutationObserver((ms, o) => {
      const v = document.querySelector('.voyage-temporel');
      if (v && window.__passerAuDebut === null) {
        window.__passerAuDebut = v.querySelector('.voyage-temporel__passer').hidden;
        o.disconnect();
      }
    }).observe(document.body, { childList: true });
  });
  await p.click('#hub [data-onglet="rush"]');
};
const lancerDepuisPortfolio = (p) => p.evaluate(() => ((window.__voyage = []), document.querySelector('[data-jouer-rush]').click()));
const arriveDansLeJeu = (p, delai = 30000) => p.waitForFunction(() => document.querySelector('.rush').open && !window.__portalRush.tutoriel().voyage && !window.__portalRush.etat().transition, null, { timeout: delai });
const quitterLeJeu = async (p) => {
  for (let k = 0; k < 4 && (await p.evaluate(() => document.querySelector('.rush').open)); k++) {
    const e = await etat(p);
    if (e.ecran === 'pause') await p.evaluate(() => document.querySelector('[data-ecran="pause"] [data-rush="menu"]').click());
    else await p.keyboard.press('Escape');
    await p.waitForTimeout(500);
  }
  await p.waitForFunction(() => !document.querySelector('.rush').open, null, { timeout: 10000 });
  await p.waitForTimeout(600);
};

/**
 * Le pilote du tutoriel : il lit la piste comme un joueur (les objets devant lui, la touche qui s'allume) et
 * appuie sur les vraies touches. Il s'arrête quand l'étape « jusqua » est atteinte.
 */
const piloter = async (p, jusqua, { limite = 90000 } = {}) => {
  const t0 = Date.now();
  while (Date.now() - t0 < limite) {
    const v = await p.evaluate(() => {
      const r = window.__portalRush;
      const t = r.tutoriel();
      const q = r.partie();
      if (!q || !t.actif) return { phase: t.phase, actif: t.actif };
      const devant = q.objets.filter((o) => !o.passe && !o.detruit && o.pos > q.distance).map((o) => ({ type: o.type, z: o.pos - q.distance, voies: [...o.voies], fige: o.fige ?? 0, mobile: !!o.avant }));
      const touches = [...document.querySelectorAll('.tuto__touche.est-attendue')].map((k) => k.dataset.touche);
      return { phase: t.phase, actif: t.actif, voie: q.voie, x: q.x, devant, touches };
    });
    if (!v.actif || v.phase >= jusqua) return v;
    if (v.phase % 1 === 0) {
      let cle = null;
      if (v.phase === 0 && v.touches.length === 1) cle = v.touches[0] === 'gauche' ? 'ArrowLeft' : 'ArrowRight';
      else if (v.phase === 1 || v.phase === 3) {
        const o = v.devant.find((d) => (d.type === 'bloc' || d.type === 'drone') && (!d.mobile || d.z <= d.fige) && d.z < 22);
        if (o && o.voies.includes(v.voie)) cle = v.voie === 0 ? 'ArrowRight' : 'ArrowLeft';
      } else if (v.phase === 2) {
        const f = v.devant.find((d) => d.type === 'fragment');
        if (f && f.voies[0] !== v.voie && f.z < 30) cle = f.voies[0] < v.voie ? 'ArrowLeft' : 'ArrowRight';
      }
      if (cle && Math.abs(v.x - v.voie) < 0.2) await p.keyboard.press(cle);
    }
    await p.waitForTimeout(30);
  }
  throw new Error(`étape ${jusqua} non atteinte en ${limite / 1000} s`);
};

try {
  // ==========================================================================
  // A. AVEC LA VRAIE 3D : L'ENTRÉE, LE PREMIER LANCEMENT, « PASSER »
  // ==========================================================================
  const p = await visiteur(avec3D);
  const avantHub = await p.evaluate(() => document.querySelector('#hub').outerHTML.length);
  await lancerDepuisHub(p);
  await controle('Entrée : le bouton du Hub s\'illumine, vibre et se fissure ; la couche du voyage passe par-dessus le Hub', async () => {
    const e = await p.evaluate(() => {
      const b = document.querySelector('#hub [data-onglet="rush"]');
      const v = document.querySelector('.voyage-temporel');
      return {
        fissure: b.classList.contains('est-fissure'),
        toile: window.__fissures,
        anim: getComputedStyle(b).animationName,
        couche: !!v && v.matches(':popover-open'),
        simple: v?.classList.contains('est-simple'),
        hub: document.querySelector('#hub').matches(':popover-open'),
        jeu: document.querySelector('.rush').open,
        passerCache: window.__passerAuDebut,
      };
    });
    await p.screenshot({ path: `${DOSSIER}/v4c-1-fissure.png` });
    assert.ok(e.fissure, 'pas de classe est-fissure');
    assert.ok(e.toile, 'pas de toile de fissures');
    assert.match(e.anim, /rush-charge/);
    assert.ok(e.couche, 'couche absente ou pas au premier plan');
    assert.equal(e.simple, false, 'WebGL indisponible : version simple');
    assert.ok(e.hub, 'le Hub doit rester ouvert dessous pendant la charge');
    assert.equal(e.jeu, false, 'le jeu ne doit pas encore être ouvert');
    assert.equal(e.passerCache, true, '« Passer » doit attendre une seconde au premier lancement');
  });
  await controle('Entrée : le bouton se brise (éclats 3D), puis le tunnel temporel ; « Passer » paraît ensuite', async () => {
    await p.waitForFunction(() => window.__brise || document.querySelector('.voyage-temporel')?.classList.contains('est-ouvert'), null, { timeout: 10000 });
    await p.screenshot({ path: `${DOSSIER}/v4c-2-eclats.png` });
    const brise = await p.evaluate(() => window.__brise);
    assert.ok(brise, 'le bouton n\'est pas brisé');
    // (« Passer » paraît une seconde après le début, pendant le tunnel.)
    await p.waitForFunction(() => document.querySelector('.voyage-temporel__passer')?.hidden === false || window.__voyage.some(([m]) => m === 'tunnel'), null, { timeout: 10000 });
    const vu = await p.evaluate(() => document.querySelector('.voyage-temporel__passer')?.hidden);
    assert.notEqual(vu, true, '« Passer » toujours caché pendant le tunnel');
    await p.waitForTimeout(600);
    await p.screenshot({ path: `${DOSSIER}/v4c-3-tunnel.png` });
  });
  await arriveDansLeJeu(p);
  const moments = await p.evaluate(() => window.__voyage.map(([m, t]) => [m, Math.round(t - window.__voyage[0][1])]));
  await controle(`Le voyage suit ses temps forts dans l'ordre (${moments.map(([m, t]) => `${m} ${(t / 1000).toFixed(1)} s`).join(', ')})`, async () => {
    assert.deepEqual(moments.map(([m]) => m), ['charge', 'bris', 'tunnel', 'arrivee']);
    const arrivee = moments.at(-1)[1] / 1000;
    assert.ok(arrivee >= 4 && arrivee <= 9, `arrivée à ${arrivee} s`);
  });
  await controle('Premier lancement : directement dans la course (ni menu, ni 3-2-1), à l\'étape 1 ; le Hub s\'est rangé', async () => {
    const e = await etat(p);
    await p.waitForTimeout(400);
    await p.screenshot({ path: `${DOSSIER}/v4c-4-tutoriel-3d.png` });
    assert.equal(e.ecran, '', `écran « ${e.ecran} » au lieu de la course`);
    assert.equal(e.compte, 0, 'compte à rebours');
    assert.ok(e.tuto.actif && e.tuto.scriptee && e.tuto.phase === 0, JSON.stringify(e.tuto));
    const vis = await p.evaluate(() => ({
      tuto: getComputedStyle(document.querySelector('.tuto')).display !== 'none',
      passer: getComputedStyle(document.querySelector('.tuto__passer')).display !== 'none',
      menu: getComputedStyle(document.querySelector('[data-ecran="accueil"]')).visibility,
      hub: document.querySelector('#hub').matches(':popover-open'),
      couche: !!document.querySelector('.voyage-temporel'),
      score: getComputedStyle(document.querySelector('.hud__score')).visibility,
    }));
    assert.ok(vis.tuto && vis.passer, JSON.stringify(vis));
    assert.equal(vis.hub, false, 'le Hub aurait dû se ranger');
    assert.equal(vis.couche, false, 'la couche du voyage est restée');
    assert.equal(vis.score, 'hidden', 'le score ne doit pas s\'afficher pendant l\'entraînement');
  });
  await controle('Le Hub n\'a rien perdu : le bouton est intact, aucune toile de fissure ne reste', async () => {
    const e = await p.evaluate(() => ({ classes: document.querySelector('#hub [data-onglet="rush"]').className, toile: !!document.querySelector('.fissures-entree'), taille: document.querySelector('#hub').outerHTML.length }));
    assert.ok(!/est-fissure|est-brise/.test(e.classes), e.classes);
    assert.equal(e.toile, false);
    assert.ok(Math.abs(e.taille - avantHub) < 200, `Hub modifié (${avantHub} → ${e.taille})`);
  });
  await controle('Étape 1, en 3D : la touche attendue s\'allume ; ← puis → (vraies touches) réussissent l\'étape', async () => {
    const t = await p.evaluate(() => [...document.querySelectorAll('.tuto__touche.est-attendue')].map((k) => k.dataset.touche));
    assert.equal(t.length, 1);
    await piloter(p, 0.5, { limite: 60000 });
    await p.waitForFunction(() => window.__portalRush.tutoriel().phase === 1, null, { timeout: 30000 });
    await p.waitForTimeout(800);
    await p.screenshot({ path: `${DOSSIER}/v4c-5-etape2-3d.png` });
  });
  await controle('« PASSER LE TUTORIEL » (en bas à droite) : tout s\'arrête (moteur, sons), le menu s\'ouvre, état « passé »', async () => {
    const b = await p.evaluate(() => {
      const r = document.querySelector('.tuto__passer').getBoundingClientRect();
      return { droite: innerWidth - r.right, bas: innerHeight - r.bottom, texte: document.querySelector('.tuto__passer').textContent };
    });
    assert.ok(b.droite < 80 && b.bas < 80, JSON.stringify(b));
    assert.match(b.texte, /Passer le tutoriel/i);
    await p.click('.tuto__passer');
    await p.waitForFunction(() => window.__portalRush.etat().ecran === 'accueil', null, { timeout: 8000 });
    await p.waitForTimeout(500);
    const e = await etat(p);
    assert.equal(e.tuto.actif, false);
    assert.equal(e.tuto.scriptee, false);
    assert.equal(e.tuto.moteur, false, 'le son du moteur tourne encore');
    assert.equal(e.s.tutoriel.etat, 'passe');
    assert.equal(e.s.totaux.parties, 0, 'une partie a été comptée');
    const visibles = await p.evaluate(() => ['.tuto', '.tuto__passer', '[data-tuto="fin"]'].map((s) => getComputedStyle(document.querySelector(s)).display));
    assert.deepEqual(visibles, ['none', 'none', 'none']);
    await p.screenshot({ path: `${DOSSIER}/v4c-6-menu-apres-passer.png` });
  });
  await controle('Retour au portfolio : le Hub s\'ouvre encore normalement, son bouton intact', async () => {
    await quitterLeJeu(p);
    await p.click('.jeu-bouton');
    await p.waitForFunction(() => document.querySelector('#hub')?.matches(':popover-open'));
    const b = await p.evaluate(() => document.querySelector('#hub [data-onglet="rush"]').className);
    assert.ok(!/est-/.test(b), b);
    await p.keyboard.press('Escape');
    await p.waitForTimeout(300);
  });
  await controle('Lancement suivant : « Passer » visible tout de suite ; Échap passe le voyage ; on arrive au menu', async () => {
    await lancerDepuisHub(p);
    const passer = await p.evaluate(() => document.querySelector('.voyage-temporel__passer')?.hidden);
    assert.equal(passer, false);
    await p.keyboard.press('Escape');
    await arriveDansLeJeu(p, 15000);
    const m = await p.evaluate(() => window.__voyage.map(([m]) => m));
    assert.ok(m.includes('passe'), m.join(','));
    const e = await etat(p);
    assert.equal(e.ecran, 'accueil');
    assert.equal(e.tuto.actif, false);
  });
  await p.context().close();

  // ==========================================================================
  // B. LE TUTORIEL JOUÉ EN ENTIER (rendu 2D de secours, même moteur)
  // ==========================================================================
  const q = await visiteur(en2D);
  await lancerDepuisPortfolio(q);
  await arriveDansLeJeu(q);
  await controle('Sans WebGL aussi, depuis un bouton « Jouer » du portfolio : premier lancement → tutoriel, étape 1', async () => {
    const e = await etat(q);
    assert.ok(e.tuto.actif && e.ecran === '' && e.tuto.phase === 0, JSON.stringify(e.tuto));
    assert.equal(await q.evaluate(() => window.__portalRush.etat().troisD), false);
  });
  await controle('Étape 1 (déplacements) : ← puis → la réussissent', async () => {
    await piloter(q, 1, { limite: 20000 });
  });
  await controle('Étape 2 : immobile, le vaisseau ralentit et attend (assistance) ; le choc fait recommencer l\'étape', async () => {
    await q.waitForFunction(() => window.__portalRush.tutoriel().phase === 1, null, { timeout: 8000 });
    await q.waitForFunction(() => window.__portalRush.partie()?.vitesseImposee === 2.5, null, { timeout: 20000 });
    const consigne = await q.textContent('[data-tuto="consigne"]');
    await q.screenshot({ path: `${DOSSIER}/v4c-7-assistance.png` });
    assert.match(consigne, /ralentit/i, consigne);
    await q.waitForFunction(() => window.__portalRush.tutoriel().phase === 1.5, null, { timeout: 30000 });
    const genre = await q.evaluate(() => document.querySelector('[data-tuto="ok"]').dataset.genre);
    assert.equal(genre, 'rate');
    await q.waitForFunction(() => window.__portalRush.tutoriel().phase === 1, null, { timeout: 8000 });
    const e = await etat(q);
    assert.ok(e.tuto.actif && e.ecran === '', 'l\'étape n\'a pas recommencé sur place');
  });
  await controle('Étape 2 (esquiver) : trois obstacles évités au clavier', async () => {
    await piloter(q, 2);
  });
  await controle('Étape 3 (énergie) : au moins trois fragments ; la jauge se remplit en partie, jamais pleine', async () => {
    await q.waitForFunction(() => window.__portalRush.tutoriel().phase === 2, null, { timeout: 8000 });
    await q.waitForTimeout(300);
    await q.screenshot({ path: `${DOSSIER}/v4c-8-energie.png` });
    await piloter(q, 2.5);
    const j = await q.evaluate(() => window.__portalRush.partie().jauge);
    assert.ok(j >= 0.36 && j <= 0.6, `jauge ${j}`);
    const etatOd = await q.evaluate(() => window.__portalRush.partie().etatOverdrive);
    assert.notEqual(etatOd, 'pret', 'un Overdrive aurait été offert');
  });
  await controle('Étape 4 (obstacle mobile) : le drone glisse d\'une voie à l\'autre, se pose, il est évité', async () => {
    await q.waitForFunction(() => window.__portalRush.tutoriel().phase === 3, null, { timeout: 8000 });
    const mobile = await q.evaluate(() => window.__portalRush.partie().objets.some((o) => o.type === 'drone' && o.avant?.length));
    assert.ok(mobile, 'pas de drone mobile');
    await piloter(q, 4);
  });
  await controle('Étape 5 (arrivée) : le vaisseau accélère, « Entraînement terminé. Bienvenue dans Portal Rush. », puis le menu', async () => {
    await q.waitForFunction(() => window.__portalRush.tutoriel().phase === 4, null, { timeout: 8000 });
    const v0 = await q.evaluate(() => window.__portalRush.partie().vitesse);
    await q.waitForTimeout(1500);
    const v1 = await q.evaluate(() => window.__portalRush.partie()?.vitesse ?? 99);
    assert.ok(v1 > v0, `pas d'accélération (${v0} → ${v1})`);
    await q.waitForFunction(() => !document.querySelector('[data-tuto="fin"]').hidden, null, { timeout: 40000 });
    const fin = (await q.textContent('[data-tuto="fin"]')).replace(/\s+/g, ' ').trim();
    await q.screenshot({ path: `${DOSSIER}/v4c-9-finale.png` });
    assert.match(fin, /Entraînement terminé\. ?Bienvenue dans Portal Rush/);
    await q.waitForFunction(() => window.__portalRush.etat().ecran === 'accueil', null, { timeout: 8000 });
  });
  await controle('Après le tutoriel : « terminé » sauvegardé ; aucun record, aucune partie ; moteur et sons arrêtés', async () => {
    await q.waitForTimeout(400);
    const e = await etat(q);
    assert.equal(e.s.tutoriel.etat, 'termine');
    assert.equal(e.s.totaux.parties, 0);
    assert.equal(Object.keys(e.s.records ?? {}).length, 0, JSON.stringify(e.s.records));
    assert.equal(e.tuto.scriptee, false);
    assert.equal(e.tuto.moteur, false, 'le son du moteur tourne encore');
    const enregistre = await q.evaluate(() => JSON.parse(localStorage.getItem('portal-rush-3')).tutoriel.etat);
    assert.equal(enregistre, 'termine');
    await q.screenshot({ path: `${DOSSIER}/v4c-10-menu.png` });
  });
  await controle('« Refaire l\'entraînement » relance l\'étape 1 ; en pause, « Recommencer » rejoue l\'étape (pas une vraie partie) ; « Menu » y met fin', async () => {
    await q.click('[data-rush="tutoriel"]');
    await q.waitForFunction(() => window.__portalRush.tutoriel().actif && window.__portalRush.tutoriel().phase === 0, null, { timeout: 5000 });
    await piloter(q, 1, { limite: 20000 });
    await q.waitForFunction(() => window.__portalRush.tutoriel().phase === 1, null, { timeout: 8000 });
    await q.keyboard.press('Escape');
    await q.waitForFunction(() => window.__portalRush.etat().ecran === 'pause', null, { timeout: 5000 });
    await q.evaluate(() => document.querySelector('[data-ecran="pause"] [data-rush="recommencer"]').click());
    await q.evaluate(() => document.querySelector('[data-ecran="pause"] [data-rush="recommencer"]').click());
    await q.waitForFunction(() => window.__portalRush.etat().ecran === '', null, { timeout: 5000 });
    const r = await etat(q);
    assert.ok(r.tuto.scriptee && r.tuto.actif && r.tuto.phase === 1, JSON.stringify(r.tuto));
    await q.keyboard.press('Escape');
    await q.waitForFunction(() => window.__portalRush.etat().ecran === 'pause', null, { timeout: 5000 });
    await q.evaluate(() => document.querySelector('[data-ecran="pause"] [data-rush="menu"]').click());
    await q.waitForFunction(() => window.__portalRush.etat().ecran === 'accueil', null, { timeout: 5000 });
    const e = await etat(q);
    assert.equal(e.tuto.actif, false);
    assert.equal(e.tuto.scriptee, false);
    assert.equal(e.s.tutoriel.etat, 'termine', 'refaire ne doit pas effacer « terminé »');
  });
  await q.context().close();

  const r = await visiteur(en2D);
  await lancerDepuisPortfolio(r);
  await arriveDansLeJeu(r);
  await controle('Interrompu à l\'étape 2 (sortie du jeu) : le lancement suivant reprend directement à l\'étape 2', async () => {
    await piloter(r, 1, { limite: 20000 });
    await r.waitForFunction(() => window.__portalRush.tutoriel().phase === 1, null, { timeout: 8000 });
    await quitterLeJeu(r);
    const e1 = await r.evaluate(() => JSON.parse(localStorage.getItem('portal-rush-3')).tutoriel);
    assert.deepEqual([e1.etat, e1.phase], ['commence', 1]);
    await lancerDepuisPortfolio(r);
    await arriveDansLeJeu(r);
    const e2 = await etat(r);
    assert.ok(e2.tuto.actif && e2.tuto.phase === 1 && e2.ecran === '', JSON.stringify(e2.tuto));
  });
  await r.context().close();

  // ==========================================================================
  // C. ANIMATIONS RÉDUITES
  // ==========================================================================
  const m = await visiteur(avec3D, { reducedMotion: 'reduce' });
  await controle('Mouvement réduit : version courte (un fondu, sans tunnel ni éclats), le jeu s\'ouvre en moins d\'une seconde', async () => {
    await lancerDepuisPortfolio(m);
    const simple = await m.evaluate(() => document.querySelector('.voyage-temporel')?.classList.contains('est-simple'));
    await arriveDansLeJeu(m, 15000);
    const mo = await m.evaluate(() => window.__voyage.map(([n, t]) => [n, Math.round(t - window.__voyage[0][1])]));
    assert.equal(simple, true);
    const arrivee = mo.find(([n]) => n === 'arrivee');
    assert.ok(arrivee && arrivee[1] < 1000, JSON.stringify(mo));
    const e = await etat(m);
    assert.ok(e.tuto.actif, 'le tutoriel aussi en mouvement réduit');
  });
  await m.context().close();
} catch (e) {
  resultats.push({ nom: 'exécution', ok: false, erreur: e.message });
  console.log('ERREUR ' + e.message);
}

const echecs = resultats.filter((x) => !x.ok).length;
console.log(`\n${resultats.length - echecs}/${resultats.length} contrôles réussis.`);
if (erreurs.length) console.log('Erreurs de page :\n  ' + [...new Set(erreurs)].join('\n  '));
await writeFile(`${DOSSIER}/v4c.json`, JSON.stringify({ date: new Date().toISOString(), resultats, erreurs: [...new Set(erreurs)] }, null, 2));
await avec3D.close();
await en2D.close();
process.exit(echecs ? 1 : 0);
