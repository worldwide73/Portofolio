// RECETTE : Portal Rush V4 et le son du portfolio (16 octobre 2026).
// DREAM RADIO (l'icône casque à côté de la langue, le lecteur, aucune lecture automatique, l'atténuation
// pendant les grands effets, la passation avec RUSH RADIO), les réglages du son sans ambiances, et la
// sauvegarde versionnée de Portal Rush (migration, secours, corruption, fusion).
//
// Utilisation (le serveur local doit tourner) :
//   node outils/recettes/portal-rush-v4.mjs
// Réglages : SITE=http://127.0.0.1:4321 ; CHROMIUM=<chemin d'un Chromium déjà installé> (facultatif).
// Ne modifie aucun fichier du site ; écrit son rapport et ses captures dans captures/v4/.
// (Ce qui est vérifié ici l'est dans un Chromium sans écran : le son est réellement produit et mesuré par
// un analyseur, mais personne ne l'écoute. Le rendu sur un vrai téléphone et le son à l'oreille restent
// à vérifier à la main.)

import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const SITE = process.env.SITE ?? 'http://127.0.0.1:4321';
const DOSSIER = 'captures/v4';
await mkdir(DOSSIER, { recursive: true });
const navigateur = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
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
const visiteur = async (options = {}, avant = () => localStorage.setItem('guidage-vu', '1'), argument = null) => {
  const contexte = await navigateur.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference', ...options });
  await contexte.addInitScript(avant, argument);
  const p = await contexte.newPage();
  p.on('pageerror', (e) => erreurs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && erreurs.push('console : ' + m.text()));
  return p;
};
const pret = (p) => p.waitForFunction(() => !document.documentElement.classList.contains('intro'), null, { timeout: 40000 });
/** Ouvre Portal Rush et attend la fin de son entrée (la scène 3D est lente à charger sans carte graphique). */
const ouvrirRush = async (p) => {
  await p.evaluate(() => document.querySelector('[data-jouer-rush]')?.click());
  await p.waitForFunction(() => document.querySelector('.rush').open && !window.__portalRush.etat().transition, null, { timeout: 20000 });
  await p.waitForTimeout(800);
};
const quitterRush = async (p) => {
  await p.keyboard.press('Escape');
  await p.waitForFunction(() => !document.querySelector('.rush').open, null, { timeout: 10000 });
  await p.waitForTimeout(700);
};
const rect = (p, sel) => p.evaluate((s) => {
  const b = document.querySelector(s).getBoundingClientRect();
  return { x: b.left, r: b.right, y: b.top, w: b.width, h: b.height };
}, sel);
/** L'énergie captée par l'analyseur de DREAM RADIO (0 : silence). */
const energie = (p) => p.evaluate(() => {
  const an = window.__dreamRadio.analyseur();
  const d = new Uint8Array(an.frequencyBinCount);
  an.getByteFrequencyData(d);
  return d.reduce((a, b) => a + b, 0);
});

try {
  // ==========================================================================
  // DREAM RADIO
  // ==========================================================================
  const p = await visiteur();
  await p.goto(SITE + '/');
  await pret(p);
  await p.waitForTimeout(500);

  await controle('DREAM RADIO : le casque est juste à gauche du drapeau, même taille, même écart que les autres boutons', async () => {
    const casque = await rect(p, '.barre__outils .radio-bouton');
    const drapeau = await rect(p, '.barre__outils [data-langue]');
    const cv = await rect(p, '.barre__outils .pastille--pleine');
    assert.equal(Math.round(casque.w), Math.round(drapeau.w));
    assert.equal(Math.round(casque.h), Math.round(drapeau.h));
    assert.equal(Math.round(casque.y), Math.round(drapeau.y));
    const ecart = Math.round(drapeau.x - casque.r);
    assert.equal(ecart, Math.round(cv.x - drapeau.r), `écart ${ecart}`);
  });

  await controle('Aucune musique ne joue à l’ouverture du site (et rien ne démarre en 3 s)', async () => {
    await p.waitForTimeout(3000);
    assert.deepEqual(await p.evaluate(() => window.__audio.radiosEnLecture()), []);
  });

  await controle('Le casque ouvre le lecteur sous lui ; Lecture lance une composition qui produit vraiment du son', async () => {
    await p.click('.barre__outils .radio-bouton');
    await p.waitForTimeout(500);
    assert.ok(await p.evaluate(() => document.querySelector('#dream-radio').matches(':popover-open')));
    const lecteur = await rect(p, '#dream-radio');
    const casque = await rect(p, '.barre__outils .radio-bouton');
    assert.ok(lecteur.y >= casque.y + casque.h, 'le lecteur est sous la barre');
    await p.click('[data-dream="lecture"]');
    await p.waitForTimeout(2200);
    assert.ok(await p.evaluate(() => window.__dreamRadio.enLecture));
    assert.ok((await energie(p)) > 200, 'l’analyseur capte du son');
    await p.screenshot({ path: `${DOSSIER}/dream-lecteur.png` });
  });

  await controle('Fermer le lecteur n’arrête pas la musique ; changer de destination non plus', async () => {
    await p.keyboard.press('Escape');
    await p.waitForTimeout(300);
    assert.equal(await p.evaluate(() => document.querySelector('#dream-radio').matches(':popover-open')), false);
    await p.evaluate(() => window.location.hash = 'competences');
    await p.waitForTimeout(2500);
    assert.equal(await p.evaluate(() => document.documentElement.dataset.lieu), 'competences');
    assert.ok(await p.evaluate(() => window.__dreamRadio.enLecture));
  });

  await controle('Atténuation : la carte qui s’ouvre baisse la musique de 10 à 25 %, puis elle remonte', async () => {
    await p.evaluate(() => window.dispatchEvent(new CustomEvent('portail', { detail: 'carte' })));
    await p.waitForTimeout(260);
    const pendant = await p.evaluate(() => window.__audio.attenuationEnCours());
    assert.ok(pendant >= 0.1 && pendant <= 0.25, `pendant : ${pendant}`);
    await p.waitForTimeout(2400);
    assert.ok((await p.evaluate(() => window.__audio.attenuationEnCours())) < 0.02);
  });

  await controle('Effets coupés : plus aucune atténuation (elle ne suit que des effets réellement joués)', async () => {
    await p.evaluate(async () => {
      const { regler } = await import('/src/scripts/reglages.ts');
      regler('sons', false);
    });
    await p.evaluate(() => window.dispatchEvent(new CustomEvent('portail', { detail: 'carte' })));
    await p.waitForTimeout(260);
    assert.ok((await p.evaluate(() => window.__audio.attenuationEnCours())) < 0.02);
    await p.evaluate(async () => (await import('/src/scripts/reglages.ts')).regler('sons', true));
  });

  await controle('Piste suivante : un morceau enregistré (CC BY-SA) se charge et joue', async () => {
    await p.click('.barre__outils .radio-bouton');
    await p.waitForTimeout(300);
    await p.click('[data-dream="suivante"]');
    await p.waitForTimeout(3500);
    const e = await p.evaluate(() => ({ ...window.__dreamRadio.etat, src: window.__dreamRadio.piste.src }));
    assert.ok(e.src && e.src.endsWith('.mp3'));
    assert.ok(e.lecture && e.position > 0.5 && !e.erreur, JSON.stringify(e));
    assert.ok((await energie(p)) > 200);
    assert.match(await p.textContent('[data-dream="licence"]'), /CC BY-SA 3\.0/);
  });

  await controle('Volume et sourdine : le réglage est gardé (préférences, jamais la lecture)', async () => {
    await p.$eval('[data-dream="volume"]', (el) => {
      el.value = '30';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await p.click('[data-dream="muet"]');
    const prefs = await p.evaluate(() => JSON.parse(localStorage.getItem('dream-radio')));
    assert.equal(prefs.volume, 0.3);
    assert.equal(prefs.muet, true);
    assert.equal('lecture' in prefs, false);
    await p.click('[data-dream="muet"]');
  });

  await controle('Portal Rush : DREAM RADIO s’efface, RUSH RADIO joue ; à la sortie, DREAM reprend (jamais les deux)', async () => {
    await p.keyboard.press('Escape');
    await p.evaluate(() => window.location.hash = '');
    await ouvrirRush(p);
    assert.deepEqual(await p.evaluate(() => window.__audio.radiosEnLecture()), ['rush']);
    assert.ok(await p.evaluate(() => window.__dreamRadio.estSuspendue));
    await quitterRush(p);
    assert.deepEqual(await p.evaluate(() => window.__audio.radiosEnLecture()), ['dream']);
  });

  await controle('Portal Rush : si DREAM RADIO ne jouait pas, elle ne reprend pas à la sortie', async () => {
    await p.evaluate(() => window.__dreamRadio.pauser());
    await ouvrirRush(p);
    await quitterRush(p);
    assert.deepEqual(await p.evaluate(() => window.__audio.radiosEnLecture()), []);
  });

  await controle('RUSH RADIO : lecteur compact en bas à droite du menu, caché pendant la course', async () => {
    await ouvrirRush(p);
    const lecteur = await rect(p, '.rush-radio');
    assert.ok(lecteur.x + lecteur.w > 1440 * 0.7 && lecteur.y + lecteur.h > 900 * 0.8, JSON.stringify(lecteur));
    assert.ok(lecteur.x + lecteur.w <= 1440 && lecteur.y + lecteur.h <= 900);
    assert.equal(await p.evaluate(() => window.__portalRush.radio.piste.adaptative), true, 'piste adaptative');
    await p.screenshot({ path: `${DOSSIER}/rush-radio.png` });
    await p.click('[data-rr="liste"]');
    assert.equal(await p.locator('[data-rr-liste]').isVisible(), true, 'liste ouverte');
    await p.keyboard.press('Escape');
    assert.equal(await p.locator('[data-rr-liste]').isVisible(), false, 'liste refermée');
    assert.ok(await p.evaluate(() => document.querySelector('.rush').open), 'Échap ferme la liste, pas le jeu');
  });

  /** Le dosage des couches de la composition en cours (arrondi). */
  const couches = () => p.evaluate(() => Object.fromEntries(Object.entries(window.__portalRush.radio.couches ?? {}).map(([k, g]) => [k, Math.round(g.gain.value * 100) / 100])));
  await controle('Musique adaptative : batterie et basse entrent en course, la pause les retire (couches réelles)', async () => {
    const menu = await couches();
    assert.equal(menu.batterie, 0);
    await p.evaluate(() => window.__portalRush.demarrer('campagne', 'as', 1));
    await p.waitForTimeout(4000);
    assert.equal(await p.locator('.rush-radio').isVisible(), false, 'lecteur caché en course');
    const course = await couches();
    assert.ok(course.batterie > 0.9 && course.basse > 0.9, JSON.stringify(course));
    await p.keyboard.press('Escape');
    await p.waitForTimeout(2500);
    const pause = await couches();
    assert.ok(pause.batterie < 0.05, JSON.stringify(pause));
    await p.click('section[data-ecran="pause"] [data-rush="menu"]');
    await p.click('section[data-ecran="pause"] [data-rush="menu"]');
    await p.waitForTimeout(300);
    await quitterRush(p);
  });

  await controle('Réglages : page « Son » (effets, son de l’introduction, renvoi vers DREAM RADIO), plus aucune ambiance', async () => {
    await p.click('.barre__outils [popovertarget="reglages"]');
    await p.click('input[name="onglet"][value="son"]', { force: true });
    await p.waitForTimeout(300);
    assert.equal(await p.locator('[data-ambiance]').count(), 0);
    assert.equal(await p.locator('input[name="piste"]').count(), 0);
    assert.ok(await p.locator('[data-page="son"] input[name="sons"]').isVisible());
    assert.ok(await p.locator('[data-page="son"] input[name="sonAuLancement"]').isVisible());
    await p.screenshot({ path: `${DOSSIER}/reglages-son.png` });
    await p.click('[data-page="son"] [popovertarget="dream-radio"]');
    await p.waitForTimeout(300);
    assert.ok(await p.evaluate(() => document.querySelector('#dream-radio').matches(':popover-open')));
    await p.keyboard.press('Escape');
  });
  await p.context().close();

  // Une ancienne ambiance mémorisée (Chill) n'efface rien d'autre et ne change plus rien.
  const q = await visiteur({}, () => {
    localStorage.setItem('guidage-vu', '1');
    localStorage.setItem('reglages-5', JSON.stringify({ opacite: 0.6, atmosphere: 'chill', piste: 'trait', musique: true, volumeMusique: 0.4, sons: true, volumeSons: 0.2 }));
  });
  await q.goto(SITE + '/');
  await pret(q);
  await controle('Anciens réglages (ambiance Chill, musique activée) : opacité gardée, pas d’ambiance, pas de musique', async () => {
    const r = await q.evaluate(async () => {
      const { reglages } = await import('/src/scripts/reglages.ts');
      return { opacite: reglages.opacite, volumeSons: reglages.volumeSons, atmosphere: document.documentElement.dataset.atmosphere ?? '', radios: window.__audio.radiosEnLecture() };
    });
    assert.equal(r.opacite, 0.6);
    assert.equal(r.volumeSons, 0.2);
    assert.equal(r.atmosphere, '');
    assert.deepEqual(r.radios, []);
  });
  await q.context().close();

  // Téléphone : le casque est dans le menu, juste à côté du drapeau.
  const t = await visiteur({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await t.goto(SITE + '/');
  await pret(t);
  await controle('Téléphone : le casque est juste à côté du drapeau dans le menu ; le lecteur monte du bas', async () => {
    await t.tap('.barre__menu');
    await t.waitForTimeout(900);
    const casque = await rect(t, '.nav__annexe .radio-bouton');
    const drapeau = await rect(t, '.nav__annexe [data-langue]');
    assert.equal(Math.round(casque.y), Math.round(drapeau.y));
    assert.ok(drapeau.x - casque.r >= 6 && drapeau.x - casque.r <= 12, `écart ${drapeau.x - casque.r}`);
    await t.tap('.nav__annexe .radio-bouton');
    await t.waitForTimeout(700);
    const lecteur = await rect(t, '#dream-radio');
    assert.ok(lecteur.y + lecteur.h > 844 - 20 && lecteur.x <= 12, JSON.stringify(lecteur));
    await t.screenshot({ path: `${DOSSIER}/dream-telephone.png` });
  });
  await t.context().close();

  // ==========================================================================
  // LA SAUVEGARDE DE PORTAL RUSH
  // ==========================================================================
  const V2 = {
    version: 2,
    niveauMax: 4,
    reussis: { '1-as': true, '2-as': true, '3-expert': true },
    records: { '1-as': { score: 12345, rang: 'A', date: '2026-10-14', regles: 4 }, '3-expert': { score: 45678, rang: 'S', date: '2026-10-15', regles: 4 } },
    etoiles: { '1-as': [true, true, false] },
    infini: { as: { score: 9000, distance: 2400, date: '2026-10-15', regles: 4 } },
    defi: { date: 20261015, meilleur: 3000, dernier: 2000, tentatives: 2, regles: 4 },
    defisReussis: [20261015],
    totaux: { parties: 17, overdrives: 5, parfaits: 40, distance: 9000, multiplicateurMax: 6, infiniMax: 2400, rangS: true, meilleurCombo: 33, meilleursParfaits: 9, meilleureDistance: 2400 },
    derniere: { mode: 'campagne', difficulte: 'as', niveau: 3 },
    difficulte: 'expert',
    debloques: ['coque-givre', 'trainee-givre', 'overdrive-standard', 'noyau-blanc', 'trainee-aurore'],
    equipement: { coque: 'coque-givre', trainee: 'trainee-aurore', overdrive: 'overdrive-standard', noyau: 'noyau-blanc' },
    reglages: { volume: 0.7, effetsReduits: true, secousses: false, aideCommandes: true, tactile: 'glisser' },
  };
  /** Une page dont le stockage contient d'avance « stockage » (posé une seule fois, avant tout script du site). */
  const charge = async (stockage) => {
    const s = await visiteur(
      {},
      (donnees) => {
        if (sessionStorage.getItem('pose')) return;
        sessionStorage.setItem('pose', '1');
        localStorage.setItem('guidage-vu', '1');
        for (const [cle, valeur] of Object.entries(donnees)) localStorage.setItem(cle, valeur);
      },
      stockage,
    );
    await s.goto(SITE + '/');
    await pret(s);
    const sauvegarde = await s.evaluate(async () => (await import('/src/scripts/rush/sauvegarde.ts')).charger());
    return { s, sauvegarde };
  };

  await controle('Migration v2 → v3 : secteurs, records, étoiles, survie, défi, pièces, équipement et réglages gardés', async () => {
    const { s, sauvegarde: v } = await charge({ 'portal-rush-2': JSON.stringify(V2) });
    assert.equal(v.version, 3);
    assert.equal(v.origine, 2);
    assert.equal(v.niveauMax, 4);
    assert.deepEqual(Object.keys(v.reussis).sort(), ['1-as', '2-as', '3-expert']);
    assert.equal(v.records['3-expert'].score, 45678);
    assert.deepEqual(v.etoiles['1-as'], [true, true, false]);
    assert.deepEqual(v.etoiles['2-as'], [true, false, false]);
    assert.equal(v.infini.as.distance, 2400);
    assert.equal(v.defi.meilleur, 3000);
    assert.equal(v.totaux.parties, 17);
    assert.equal(v.equipement.trainee, 'trainee-aurore');
    assert.equal(v.reglages.tactile, 'glisser');
    assert.equal(v.reglages.volume, 0.7);
    assert.equal(v.difficulte, 'expert');
    // Un joueur qui a déjà joué ne revoit pas le tutoriel tout seul ; les vaisseaux déjà mérités sont gagnés.
    assert.equal(v.tutoriel.etat, 'passe');
    assert.ok(v.vehicules.includes('faucon') && v.vehicules.includes('spectre') && !v.vehicules.includes('bastion'), v.vehicules.join());
    // L'ancienne clé n'est jamais effacée.
    assert.ok(await s.evaluate(() => !!localStorage.getItem('portal-rush-2')));
    await s.context().close();
  });

  await controle('Sauvegarde v3 illisible : la copie de secours la remplace, l’illisible est mise de côté', async () => {
    const bonne = { ...V2, version: 3, revision: 4, niveauMax: 6 };
    const { s, sauvegarde: v } = await charge({ 'portal-rush-3': '{"version":3,"niveauMax":', 'portal-rush-3-secours': JSON.stringify(bonne) });
    assert.equal(v.niveauMax, 6);
    assert.equal(await s.evaluate(() => localStorage.getItem('portal-rush-3-illisible')), '{"version":3,"niveauMax":');
    await s.context().close();
  });

  await controle('Champs corrompus : ignorés un par un, sans perdre le reste', async () => {
    const abimee = { ...V2, version: 3, revision: 1, niveauMax: 'beaucoup', records: { '1-as': { score: -5 }, '9-as': { score: 1 }, '2-as': { score: 777, rang: 'Z' } }, vehicule: 'inconnu', tutoriel: { etat: 'bizarre' } };
    const { s, sauvegarde: v } = await charge({ 'portal-rush-3': JSON.stringify(abimee) });
    assert.equal(v.niveauMax, 1);
    assert.equal(v.records['1-as'], undefined);
    assert.equal(v.records['9-as'], undefined);
    assert.equal(v.records['2-as'].score, 777);
    assert.equal(v.records['2-as'].rang, 'C');
    assert.equal(v.vehicule, 'aube');
    assert.equal(v.totaux.parties, 17);
    await s.context().close();
  });

  await controle('Deux onglets : une écriture plus ancienne fusionne au lieu d’écraser (rien ne recule)', async () => {
    const { s } = await charge({});
    const r = await s.evaluate(async () => {
      const m = await import('/src/scripts/rush/sauvegarde.ts');
      const a = m.charger();
      const b = m.charger();
      a.niveauMax = 5;
      a.records['1-as'] = { score: 1000, rang: 'B', date: '2026-10-16', regles: 4 };
      m.enregistrer(a); // révision 1
      b.records['2-as'] = { score: 2000, rang: 'A', date: '2026-10-16', regles: 4 };
      b.tutoriel = { etat: 'termine', phase: 5, date: '2026-10-16' };
      m.enregistrer(b); // b avait la révision 0 : fusion
      const fin = m.charger();
      return { niveauMax: fin.niveauMax, r1: fin.records['1-as']?.score, r2: fin.records['2-as']?.score, tutoriel: fin.tutoriel.etat, revision: fin.revision };
    });
    assert.deepEqual(r, { niveauMax: 5, r1: 1000, r2: 2000, tutoriel: 'termine', revision: 2 });
    await s.context().close();
  });

  await controle('Stockage indisponible : le jeu se charge quand même, sans mémoire et sans erreur', async () => {
    const s = await visiteur({}, () => {
      const lever = () => {
        throw new DOMException('refusé', 'SecurityError');
      };
      Object.defineProperty(window, 'localStorage', { get: lever, configurable: true });
    });
    await s.goto(SITE + '/');
    await pret(s);
    const v = await s.evaluate(async () => {
      const m = await import('/src/scripts/rush/sauvegarde.ts');
      const x = m.charger();
      m.enregistrer(x);
      return { version: x.version, disponible: m.stockageDisponible };
    });
    assert.deepEqual(v, { version: 3, disponible: false });
    await s.context().close();
  });

  await controle('Aucune erreur dans la console pendant la recette', async () => {
    assert.deepEqual(erreurs, []);
  });
} finally {
  await navigateur.close();
  const bilan = { date: new Date().toISOString(), site: SITE, reussis: resultats.filter((r) => r.ok).length, total: resultats.length, resultats, erreurs };
  await writeFile(`${DOSSIER}/rapport.json`, JSON.stringify(bilan, null, 2));
  console.log(`\n${bilan.reussis} / ${bilan.total} contrôles réussis`);
}
