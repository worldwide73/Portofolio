// RECETTE : Portal Rush → Unity — l'intégration au portfolio et le pont JavaScript ↔ Unity (18 octobre 2026).
// Sans build Unity (il se construit sur le PC de Mathéo), la recette remplace le build par une instance SIMULÉE :
// page.route fournit un manifeste (public/rush-unity/portal-rush.json) et un faux « loader » dont le
// createUnityInstance dessine dans la toile (WebGL 2), répond « pret », joue (en accéléré) la sortie du tunnel
// (« ecran: intro » puis « menu » / « tutoriel »), enregistre les messages page → Unity et permet d'injecter des
// messages Unity → page. Rien n'est écrit dans public/. Ce qui est vérifié ici : le chargeur, le pont, la sauvegarde,
// l'audio vu de la page, le focus, les replis. Ce qui ne peut l'être qu'avec un vrai build : voir le rapport.
//
//   A. sans ?rush=unity : l'ancien jeu s'ouvre comme avant, et rien de la version Unity n'est demandé ;
//   B. avec le drapeau et le faux build : rien au chargement, préchargement à l'ouverture du Hub, fissure + tunnel,
//      toile dans la fenêtre Portal Rush (pas d'iframe), « config » d'abord avec une vue correcte, DREAM RADIO
//      suspendue, focus sur la toile, Échap gardé par Unity, relais du tunnel à « intro », pause / reprise ;
//   C. « fin » d'une victoire → sauvegarde v3 au même format (étoiles, record, secteur débloqué), « bilan » ;
//      « fin » invalide refusée ; « fin » produite par Messages.cs (C#) acceptée ;
//   D. réglages, vaisseau, équipement, difficulté, tutoriel, radio, moteur, langue ;
//   E. « fermer » → fenêtre fermée, portfolio restauré, focus rendu au bouton du Hub, DREAM RADIO reprise ;
//   F. replis : manifeste absent, chargement en échec, WebGL absent → l'ancien jeu, sans erreur visible ;
//   G. sauvegarde v3 existante, et ancienne v2 seule : intactes à l'ouverture, vue migrée ;
//   H. tunnel retenu tant que Unity charge ; voyage passé ; mouvement réduit (lumière d'attente, sans intro).
//
// Utilisation (le serveur local doit tourner) : node outils/recettes/rush-unity-pont.mjs
// Réglages : SITE ; CHROMIUM. Écrit captures/rush-unity/rapport.json et des captures.

import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const SITE = process.env.SITE ?? 'http://127.0.0.1:4321';
const DOSSIER = 'captures/rush-unity';
await mkdir(DOSSIER, { recursive: true });
const ARGS = ['--autoplay-policy=no-user-gesture-required'];
const avecGl = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ARGS });
const sansGl = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: [...ARGS, '--disable-webgl', '--disable-3d-apis'] });
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

// ---- Le faux build ----
const MANIFESTE = {
  version: '2026-10-18T12:00:00Z',
  unity: '6000.3.faux',
  loader: 'Build/PortalRush.loader.js',
  data: 'Build/PortalRush.data.unityweb',
  framework: 'Build/PortalRush.framework.js.unityweb',
  code: 'Build/PortalRush.wasm.unityweb',
  octets: 1234,
  compression: 'brotli',
  repliDecompression: true,
};
// Le faux loader : il définit createUnityInstance, comme celui de Unity. Ses options : window.__fauxUnityOptions.
const FAUX_LOADER = `(() => {
  const f = (window.__fauxUnity = { recus: [], touches: [], progres: [], quitte: false, creees: 0, config: null });
  window.createUnityInstance = (toile, config, progression) => new Promise((resoudre, rejeter) => {
    const o = Object.assign({ pret: 500, resolution: 350, echec: false, intro: true, dureeIntro: 700, repondreFermer: true }, window.__fauxUnityOptions || {});
    f.creees++;
    f.config = Object.fromEntries(Object.entries(config).map(([k, v]) => [k, typeof v === 'function' ? 'fonction' : v]));
    f.toile = toile;
    f.dansFenetre = !!toile.closest('dialog.rush');
    if (o.echec) return void setTimeout(() => rejeter(new Error('faux build en échec')), 600);
    const gl = toile.getContext('webgl2');
    f.gl = !!gl;
    let arret = false;
    const t0 = performance.now();
    const dessiner = () => {
      if (arret) return;
      const k = (performance.now() - t0) / 1000;
      if (gl) { gl.clearColor(0.05, 0.25 + 0.15 * Math.sin(k * 3), 0.55, 1); gl.clear(gl.COLOR_BUFFER_BIT); }
      requestAnimationFrame(dessiner);
    };
    [0.25, 0.6, 1].forEach((p, i) => setTimeout(() => { f.progres.push(p); progression && progression(p); }, 80 * (i + 1)));
    toile.addEventListener('keydown', (e) => f.touches.push(e.key));
    const envoyer = (m) => window.__portalRushUnity.recevoir(JSON.stringify(m));
    f.envoyer = envoyer;
    const instance = {
      SendMessage(objet, methode, json) {
        const m = JSON.parse(json);
        f.recus.push({ objet, methode, m, t: performance.now() });
        if (m.type === 'config') {
          f.configMsg = m;
          const premier = m.tutorielAFaire ? 'tutoriel' : 'menu';
          if (m.intro && o.intro) setTimeout(() => { envoyer({ type: 'ecran', nom: 'intro' }); f.introT = performance.now(); setTimeout(() => envoyer({ type: 'ecran', nom: premier }), o.dureeIntro); }, 40);
          else setTimeout(() => envoyer({ type: 'ecran', nom: premier }), 40);
        }
        if (m.type === 'fermer' && o.repondreFermer) setTimeout(() => envoyer({ type: 'fermer' }), 30);
      },
      Quit() { arret = true; f.quitte = true; return Promise.resolve(); },
    };
    dessiner();
    setTimeout(() => resoudre(instance), o.resolution);
    setTimeout(() => { f.pretT = performance.now(); envoyer({ type: 'pret', version: 'faux' }); }, o.pret);
  });
})();`;

/** Un visiteur : un contexte, le faux build (ou son absence), une page chargée. */
const visiteur = async (navigateur, { adresse = '/?rush=unity', manifeste = true, reducedMotion = 'no-preference', sauvegardes = null, options = null } = {}) => {
  const contexte = await navigateur.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion });
  await contexte.addInitScript(
    ([sauv, opts]) => {
      localStorage.setItem('guidage-vu', '1');
      // (Une seule fois par onglet : la recette pose la sauvegarde de départ, puis la page vit sa vie.)
      if (sauv && !sessionStorage.getItem('recette-posee')) {
        sessionStorage.setItem('recette-posee', '1');
        for (const [k, v] of Object.entries(sauv)) localStorage.setItem(k, v);
      }
      if (opts) window.__fauxUnityOptions = opts;
    },
    [sauvegardes, options],
  );
  // Les fichiers du build (public/rush-unity/…), et les modules de la version Unity hors drapeau.ts (en développement,
  // Vite sert chaque module à part : src/scripts/rush-unity/index.ts, pont.ts…).
  const requetes = [];
  const modules = [];
  contexte.on('request', (r) => {
    const chemin = new URL(r.url()).pathname;
    if (chemin.startsWith('/rush-unity/')) requetes.push(chemin);
    else if (/\/rush-unity\/(?!drapeau)/.test(chemin)) modules.push(chemin);
  });
  await contexte.route('**/rush-unity/portal-rush.json*', (r) => (manifeste ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MANIFESTE) }) : r.fulfill({ status: 404, body: 'absent' })));
  await contexte.route('**/rush-unity/Build/PortalRush.loader.js', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FAUX_LOADER }));
  await contexte.route('**/rush-unity/Build/*.unityweb', (r) => r.fulfill({ status: 200, contentType: 'application/octet-stream', body: 'faux' }));
  const p = await contexte.newPage();
  const journal = [];
  p.on('pageerror', (e) => erreurs.push(e.message));
  p.on('console', (m) => {
    journal.push(`${m.type()} ${m.text()}`);
    if (m.type() === 'error' && !/Failed to load resource|webgl context/i.test(m.text())) erreurs.push('console : ' + m.text());
  });
  await p.goto(SITE + adresse);
  await p.waitForFunction(() => !document.documentElement.classList.contains('intro') && window.__portalRush, null, { timeout: 40000 });
  await p.waitForTimeout(600);
  return { p, contexte, requetes, modules, journal };
};

const ouvrirHub = async (p) => {
  await p.click('.jeu-bouton');
  await p.waitForFunction(() => document.querySelector('#hub')?.matches(':popover-open'));
  await p.waitForTimeout(500);
};
/** Le clic sur l'onglet Portal Rush du Hub, avec un compteur des couches de voyage créées. */
const cliquerRush = async (p) => {
  await p.evaluate(() => {
    window.__voyages = 0;
    window.__clic = performance.now();
    new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => n.classList?.contains('voyage-temporel') && window.__voyages++))).observe(document.body, { childList: true });
  });
  await p.click('#hub [data-onglet="rush"]');
};
const etatUnity = (p) => p.evaluate(() => window.__rushUnity?.etat());
const recus = (p) => p.evaluate(() => (window.__fauxUnity?.recus ?? []).map((r) => r.m));
const dernier = async (p, type) => (await recus(p)).filter((m) => m.type === type).pop();
/** Injecte un message Unity → page et attend la réponse de ce type. */
const envoyer = async (p, message, reponse, delai = 5000) => {
  const avant = (await recus(p)).length;
  await p.evaluate((m) => window.__fauxUnity.envoyer(m), message);
  if (!reponse) return p.waitForTimeout(80);
  await p.waitForFunction(([n, t]) => window.__fauxUnity.recus.slice(n).some((r) => r.m.type === t), [avant, reponse], { timeout: delai });
  return (await recus(p)).slice(avant).filter((m) => m.type === reponse).pop();
};
const sauvegarde = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('portal-rush-3') ?? 'null'));
const ancienOuvert = (p, delai = 30000) =>
  p.waitForFunction(() => document.querySelector('.rush').open && !document.querySelector('.rush').dataset.moteur && !window.__portalRush.tutoriel().voyage && !window.__portalRush.etat().transition, null, { timeout: delai });
const quitterAncien = async (p) => {
  for (let k = 0; k < 5 && (await p.evaluate(() => document.querySelector('.rush').open)); k++) {
    const e = await p.evaluate(() => window.__portalRush.etat().ecran);
    if (e === 'pause') await p.evaluate(() => document.querySelector('[data-ecran="pause"] [data-rush="menu"]').click());
    else await p.keyboard.press('Escape');
    await p.waitForTimeout(500);
  }
  await p.waitForFunction(() => !document.querySelector('.rush').open, null, { timeout: 10000 });
};
const cles = (o) => (o && typeof o === 'object' ? Object.keys(o).sort() : []);
const forme = (s) => ({ haut: cles(s), reglages: cles(s?.reglages), totaux: cles(s?.totaux), tutoriel: cles(s?.tutoriel), defi: cles(s?.defi), equipement: cles(s?.equipement) });

// Une victoire : secteur 01 en Ace, rang S, score au-dessus de l'étoile « score » (90 000), maîtrise atteinte.
const VICTOIRE = {
  type: 'fin', mode: 'campagne', difficulte: 'as', niveau: 1, vehicule: 'aube', graine: 424242,
  resultat: {
    reussi: true, arrive: true,
    objectifs: [ { type: 'fin', valeur: 0, atteint: true, mesure: 2200 }, { type: 'parfaits', valeur: 8, atteint: true, mesure: 9 } ],
    score: 123456, rang: 'S', note: 92, fragments: 40, fragmentsVus: 44, parfaits: 9, comboMax: 70, multiplicateurMax: 6,
    motifs: 30, distance: 2200, temps: 75.5, chocs: 0, portails: 0, overdrives: 1,
  },
};
// Un message « fin » tel que Messages.cs le sérialise (ResultatJson.De), produit par Pont.cs compilé en .NET contre
// des bouchons de UnityEngine, sur une vraie partie du cœur C# (secteur 01, Ace, graine 1001, sans pilote : défaite).
const FIN_CS = {"type":"fin","mode":"campagne","difficulte":"as","niveau":1,"vehicule":"aube","graine":1001,"resultat":{"reussi":false,"arrive":false,"objectifs":[{"type":"fin","valeur":0,"atteint":false,"mesure":211},{"type":"parfaits","valeur":8,"atteint":false,"mesure":0}],"score":301,"rang":"—","note":11,"fragments":0,"fragmentsVus":1,"parfaits":0,"comboMax":1,"multiplicateurMax":1,"motifs":1,"distance":211,"temps":6.075000000000092,"chocs":3,"portails":0,"overdrives":0}};

let formeAncienne = null;

try {
  // ==========================================================================
  // A. SANS LE DRAPEAU : L'ANCIEN JEU, COMME AVANT
  // ==========================================================================
  {
    const { p, contexte, requetes, modules } = await visiteur(avecGl, { adresse: '/' });
    await ouvrirHub(p);
    await cliquerRush(p);
    await controle('A. Sans ?rush=unity : l\'ancien jeu s\'ouvre depuis le Hub (fissure, tunnel, tutoriel), sans toile Unity', async () => {
      await ancienOuvert(p);
      const e = await p.evaluate(() => ({ moteur: document.querySelector('.rush').dataset.moteur ?? null, toile: !!document.querySelector('.rush-unity__toile'), voyages: window.__voyages, ecran: window.__portalRush.etat().ecran, tuto: window.__portalRush.tutoriel().actif, styles: !!document.getElementById('rush-unity-styles') }));
      assert.equal(e.moteur, null);
      assert.equal(e.toile, false);
      assert.equal(e.voyages, 1);
      assert.equal(e.tuto, true, 'premier lancement : le tutoriel');
      assert.equal(e.styles, false, 'aucun style de la version Unity');
    });
    await controle('A. Sans ?rush=unity : aucune requête vers le build ni vers le code de la version Unity (seul drapeau.ts)', async () => {
      assert.deepEqual(requetes, []);
      assert.deepEqual(modules, []);
    });
    formeAncienne = forme(await sauvegarde(p));
    await quitterAncien(p);
    await contexte.close();
  }

  // ==========================================================================
  // B à E. AVEC LE DRAPEAU ET LE FAUX BUILD
  // ==========================================================================
  {
    const { p, contexte, requetes, modules } = await visiteur(avecGl);
    await controle('B. Rien de la version Unity au chargement du portfolio (ni build, ni code, ni style)', async () => {
      assert.deepEqual(requetes, []);
      assert.deepEqual(modules, []);
      assert.equal(await p.evaluate(() => !!document.getElementById('rush-unity-styles')), false);
    });
    // DREAM RADIO joue avant l'entrée (pour vérifier qu'elle s'efface puis reprend).
    await p.evaluate(() => window.__dreamRadio.jouer());
    await p.waitForTimeout(400);
    await ouvrirHub(p);
    await controle('B. À l\'ouverture du Hub : manifeste lu, fichiers du build préchargés (prefetch, faible priorité)', async () => {
      await p.waitForFunction(() => document.querySelectorAll('link[rel="prefetch"][data-rush-unity]').length === 4, null, { timeout: 5000 });
      assert.ok(requetes.some((u) => u.includes('portal-rush.json')));
      const liens = await p.evaluate(() => [...document.querySelectorAll('link[rel="prefetch"][data-rush-unity]')].map((l) => new URL(l.href).pathname));
      assert.deepEqual(liens.sort(), ['/rush-unity/Build/PortalRush.data.unityweb', '/rush-unity/Build/PortalRush.framework.js.unityweb', '/rush-unity/Build/PortalRush.loader.js', '/rush-unity/Build/PortalRush.wasm.unityweb']);
    });
    await cliquerRush(p);
    await controle('B. Le clic : le bouton se fissure, le tunnel part, la fenêtre Portal Rush s\'ouvre dessous avec la toile Unity', async () => {
      await p.waitForFunction(() => document.querySelector('.rush-unity__toile'), null, { timeout: 8000 });
      const e = await p.evaluate(() => {
        const t = document.querySelector('.rush-unity__toile');
        const b = t.getBoundingClientRect();
        return { dansFenetre: !!t.closest('dialog.rush[open]'), moteur: document.querySelector('.rush').dataset.moteur, voile: !!document.querySelector('.voyage-temporel'), iframes: document.querySelectorAll('iframe').length, l: b.width, h: b.height, barre: getComputedStyle(document.querySelector('.rush__barre')).display, voyages: window.__voyages };
      });
      assert.equal(e.dansFenetre, true);
      assert.equal(e.moteur, 'unity');
      assert.equal(e.voile, true, 'le tunnel couvre encore');
      assert.equal(e.iframes, 0);
      assert.equal(e.voyages, 1);
      assert.ok(e.l >= 1430 && e.h >= 890, `plein cadre (${e.l} × ${e.h})`);
      assert.equal(e.barre, 'none', "l'interface de l'ancien jeu est cachée");
    });
    await p.screenshot({ path: `${DOSSIER}/b-tunnel.png` });
    await controle('B. createUnityInstance : la toile, les fichiers du manifeste, 1,5 px par pixel CSS au plus, pas de bandeau', async () => {
      await p.waitForFunction(() => window.__fauxUnity?.config, null, { timeout: 8000 });
      const c = await p.evaluate(() => window.__fauxUnity.config);
      assert.ok(c.dataUrl.endsWith('/rush-unity/Build/PortalRush.data.unityweb'));
      assert.ok(c.frameworkUrl.endsWith('/rush-unity/Build/PortalRush.framework.js.unityweb'));
      assert.ok(c.codeUrl.endsWith('/rush-unity/Build/PortalRush.wasm.unityweb'));
      assert.equal(c.productName, 'Portal Rush');
      assert.equal(c.productVersion, MANIFESTE.version);
      assert.equal(c.matchWebGLToCanvasSize, true);
      assert.ok(c.devicePixelRatio > 0 && c.devicePixelRatio <= 1.5);
      assert.equal(c.showBanner, 'fonction');
      assert.equal(await p.evaluate(() => window.__fauxUnity.dansFenetre && window.__fauxUnity.gl), true);
    });
    await controle('B. « config » est le premier message reçu par Unity, avec une vue correcte (profil neuf)', async () => {
      await p.waitForFunction(() => window.__fauxUnity.configMsg, null, { timeout: 10000 });
      const tous = await p.evaluate(() => window.__fauxUnity.recus.map((r) => [r.objet, r.methode, r.m.type]));
      assert.deepEqual(tous[0], ['Pont', 'Recevoir', 'config']);
      const c = await p.evaluate(() => window.__fauxUnity.configMsg);
      assert.equal(c.langue, 'fr');
      assert.equal(c.intro, true);
      assert.equal(c.tutorielAFaire, true);
      assert.equal(c.ecran, 'tutoriel');
      assert.equal(c.appareil.mouvementReduit, false);
      assert.equal(typeof c.appareil.dpr, 'number');
      const v = c.vue;
      assert.equal(v.version, 3);
      assert.equal(v.niveauMax, 1);
      assert.equal(v.difficulte, 'as');
      assert.equal(v.vehicule, 'aube');
      assert.deepEqual(v.difficultes.map((d) => [d.id, d.ouverte]), [['pilote', true], ['as', true], ['expert', true], ['cauchemar', false], ['paradoxe', false]]);
      assert.equal(v.niveaux.length, 8);
      assert.deepEqual(v.niveaux.map((n) => n.debloque), [true, false, false, false, false, false, false, false]);
      assert.equal(v.niveaux[0].scores[1].etoile, 90000, "l'étoile « score » du secteur 01 en Ace (donnees.ts)");
      assert.deepEqual(v.niveaux[0].scores[1].etoiles, [false, false, false]);
      assert.deepEqual(v.vehicules.map((x) => [x.id, x.debloque]), [['aube', true], ['faucon', false], ['bastion', false], ['spectre', false]]);
      assert.equal(v.vehicules[2].condition.type, 'niveau');
      assert.equal(v.vehicules[2].condition.niveau, 5);
      assert.equal(v.pieces.length, 15);
      assert.equal(v.pieces.filter((x) => x.debloquee).length, 4);
      assert.equal(v.pieces.find((x) => x.id === 'coque-comete').condition.cible, 3000);
      assert.deepEqual(v.equipement, { coque: 'coque-givre', trainee: 'trainee-givre', overdrive: 'overdrive-standard', noyau: 'noyau-blanc' });
      assert.deepEqual(v.tutoriel, { etat: 'nouveau', phase: 0, aFaire: true });
      assert.deepEqual(v.reprise, { premiere: true, niveau: 1, difficulte: 'as' });
      assert.ok(v.prochainePiece.id.length > 0);
      assert.equal(v.reglages.sons, true);
      assert.equal(v.reglages.animations, 1);
      assert.equal(v.derniere.existe, false);
      assert.equal(v.meilleurScore, 0);
      assert.equal(v.defi.graine, Number(new Date().toISOString().slice(0, 10).replace(/-/g, '')) || v.defi.graine);
      const radio = tous.find((x) => x[2] === 'radio');
      assert.ok(radio, "l'état de RUSH RADIO suit la config");
    });
    await controle('B. « intro » : le tunnel de la page fond (pas d\'éclair, pas d\'écran noir) ; le premier écran = l\'arrivée', async () => {
      await p.waitForFunction(() => window.__rushUnity.etat().relais, null, { timeout: 10000 });
      await p.waitForFunction(() => !document.querySelector('.voyage-temporel'), null, { timeout: 3000 });
      await p.waitForFunction(() => window.__rushUnity.etat().monde, null, { timeout: 5000 });
      const e = await etatUnity(p);
      assert.equal(e.intro, true);
      assert.equal(e.ecran, 'tutoriel');
      assert.equal(e.attente, false);
    });
    await p.waitForTimeout(700);
    await p.screenshot({ path: `${DOSSIER}/b-unity.png` });
    await controle('B. DREAM RADIO suspendue, RUSH RADIO prend le relais ; focus sur la toile', async () => {
      const a = await p.evaluate(() => ({ dream: window.__dreamRadio.enLecture, suspendue: window.__dreamRadio.estSuspendue, radios: window.__audio.radiosEnLecture(), focus: document.activeElement?.id }));
      assert.equal(a.dream, false);
      assert.equal(a.suspendue, true);
      assert.deepEqual(a.radios, ['rush']);
      assert.equal(a.focus, 'unity-canvas');
    });
    await controle('B. Échap va à Unity (toile) ; la fenêtre ne se ferme pas, l\'ancien jeu ne réagit pas', async () => {
      await p.keyboard.press('Escape');
      await p.waitForTimeout(300);
      const e = await p.evaluate(() => ({ ouverte: document.querySelector('.rush').open, touches: window.__fauxUnity.touches, moteur: document.querySelector('.rush').dataset.moteur, transition: window.__portalRush.etat().transition }));
      assert.equal(e.ouverte, true);
      assert.ok(e.touches.includes('Escape'));
      assert.equal(e.moteur, 'unity');
      assert.equal(e.transition, null);
    });
    await controle('B. Onglet masqué → « pause » ; de nouveau visible → « reprendre »', async () => {
      const n = (await recus(p)).length;
      try {
        await p.evaluate(() => {
          Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
          document.dispatchEvent(new Event('visibilitychange'));
        });
        await p.waitForTimeout(80);
      } finally {
        await p.evaluate(() => {
          delete document.hidden;
          document.dispatchEvent(new Event('visibilitychange'));
        });
      }
      await p.waitForTimeout(80);
      // (L'audio qui reprend peut ajouter « audio » ; l'ordre pause → reprendre est ce qui compte.)
      const types = (await recus(p)).slice(n).map((m) => m.type).filter((x) => x === 'pause' || x === 'reprendre');
      assert.deepEqual(types, ['pause', 'reprendre']);
    });

    // ---- C. La fin d'une partie ----
    await controle('C. « fin » d\'une victoire → sauvegarde v3 (étoiles, record, secteur 02 débloqué) et « bilan »', async () => {
      await envoyer(p, { type: 'ecran', nom: 'jeu' });
      const b = (await envoyer(p, VICTOIRE, 'bilan')).bilan;
      assert.deepEqual(b.etoiles, [true, true, true]);
      assert.deepEqual(b.nouvellesEtoiles, [0, 1, 2]);
      assert.equal(b.record, true);
      assert.equal(b.ancienRecord, 0);
      assert.equal(b.niveauDebloque, 2);
      assert.ok(b.vehicules.includes('spectre'), 'rang S : le Spectre');
      assert.ok(b.pieces.includes('trainee-prisme'), 'rang S : la traînée Prisme');
      assert.equal(b.vue.niveauMax, 2);
      assert.equal(b.vue.niveaux[1].debloque, true);
      const s = await sauvegarde(p);
      assert.equal(s.version, 3);
      assert.deepEqual(s.etoiles['1-as'], [true, true, true]);
      assert.equal(s.reussis['1-as'], true);
      assert.equal(s.records['1-as'].score, 123456);
      assert.equal(s.records['1-as'].rang, 'S');
      assert.equal(s.records['1-as'].regles, 5);
      assert.match(s.records['1-as'].date, /^\d{4}-\d{2}-\d{2}$/);
      assert.equal(s.niveauMax, 2);
      assert.equal(s.totaux.parties, 1);
      assert.equal(s.totaux.rangS, true);
      assert.equal(s.totaux.meilleurCombo, 70);
      assert.deepEqual(s.derniere, { mode: 'campagne', difficulte: 'as', niveau: 1 });
      assert.ok(s.vehicules.includes('spectre'));
    });
    await controle('C. Même format que l\'ancien jeu (mêmes clés, à tous les niveaux)', async () => {
      assert.ok(formeAncienne, "la sauvegarde écrite par l'ancien jeu (A)");
      assert.deepEqual(forme(await sauvegarde(p)), formeAncienne);
    });
    await controle('C. Résultats (« ecran: fin ») puis menu : la séquence de fin suit, rien ne casse', async () => {
      await envoyer(p, { type: 'ecran', nom: 'fin' });
      await p.waitForTimeout(600);
      await envoyer(p, { type: 'ecran', nom: 'menu' });
      assert.equal((await etatUnity(p)).ecran, 'menu');
    });
    await controle('C. « fin » invalide (secteur verrouillé) : refusée, la sauvegarde ne change pas, un bilan neutre répond', async () => {
      const avant = await p.evaluate(() => localStorage.getItem('portal-rush-3'));
      const b = (await envoyer(p, { ...VICTOIRE, niveau: 6 }, 'bilan')).bilan;
      assert.equal(b.record, false);
      assert.equal(b.niveauDebloque, 0);
      assert.equal(await p.evaluate(() => localStorage.getItem('portal-rush-3')), avant);
      const b2 = (await envoyer(p, { ...VICTOIRE, resultat: { ...VICTOIRE.resultat, score: 'beaucoup' } }, 'bilan')).bilan;
      assert.equal(b2.record, false);
      assert.equal(await p.evaluate(() => localStorage.getItem('portal-rush-3')), avant);
    });
    await controle('C. « fin » sérialisée par Messages.cs (C#) : acceptée telle quelle (défaite rangée, pas de record)', async () => {
      const b = (await envoyer(p, FIN_CS, 'bilan')).bilan;
      assert.equal(b.record, false);
      assert.equal(b.ancienRecord, 123456);
      assert.deepEqual(b.etoiles, []);
      const s = await sauvegarde(p);
      assert.equal(s.totaux.parties, 2);
      assert.equal(s.records['1-as'].score, 123456);
      assert.ok(await p.evaluate(() => localStorage.getItem('portal-rush-3-secours')), 'copie de secours tenue');
    });

    // ---- D. Les réglages et le reste ----
    await controle('D. « reglages » (objet complet) : enregistrés, « vue » en réponse', async () => {
      const r = { ...(await dernier(p, 'bilan')).bilan.vue.reglages, volume: 0.4, secousses: false, tactile: 'glisser', qualite: 'economie', sequenceFin: 'courte', effetsReduits: true };
      const v = (await envoyer(p, { type: 'reglages', reglages: r }, 'vue')).vue;
      assert.equal(v.reglages.volume, 0.4);
      assert.equal(v.reglages.qualite, 'economie');
      const s = await sauvegarde(p);
      assert.deepEqual([s.reglages.volume, s.reglages.secousses, s.reglages.tactile, s.reglages.qualite, s.reglages.sequenceFin, s.reglages.effetsReduits], [0.4, false, 'glisser', 'economie', 'courte', true]);
      // Une valeur invalide est ignorée, le reste garde sa valeur.
      await envoyer(p, { type: 'reglages', reglages: { ...r, qualite: 'ultra', volume: 7 } }, 'vue');
      const s2 = await sauvegarde(p);
      assert.equal(s2.reglages.qualite, 'economie');
      assert.equal(s2.reglages.volume, 1, 'volume borné à 1');
    });
    await controle('D. « vehicule » : un vaisseau gagné se choisit, un verrouillé non', async () => {
      assert.equal((await envoyer(p, { type: 'vehicule', id: 'spectre' }, 'vue')).vue.vehicule, 'spectre');
      assert.equal((await envoyer(p, { type: 'vehicule', id: 'bastion' }, 'vue')).vue.vehicule, 'spectre');
      assert.equal((await sauvegarde(p)).vehicule, 'spectre');
    });
    await controle('D. « equiper » : une pièce gagnée s\'équipe, une verrouillée non', async () => {
      const v = (await envoyer(p, { type: 'equiper', emplacement: 'trainee', piece: 'trainee-prisme' }, 'vue')).vue;
      assert.equal(v.equipement.trainee, 'trainee-prisme');
      assert.equal(v.pieces.find((x) => x.id === 'trainee-prisme').equipee, true);
      await envoyer(p, { type: 'equiper', emplacement: 'coque', piece: 'coque-eclipse' }, 'vue');
      assert.equal((await sauvegarde(p)).equipement.coque, 'coque-givre');
    });
    await controle('D. « difficulte » : ouverte, gardée ; verrouillée, refusée', async () => {
      assert.equal((await envoyer(p, { type: 'difficulte', difficulte: 'pilote' }, 'vue')).vue.difficulte, 'pilote');
      assert.equal((await envoyer(p, { type: 'difficulte', difficulte: 'cauchemar' }, 'vue')).vue.difficulte, 'pilote');
    });
    await controle('D. « tutoriel » : noterTutoriel (terminé ne redevient jamais « à faire »)', async () => {
      await envoyer(p, { type: 'tutoriel', etat: 'commence', phase: 2 }, 'vue');
      assert.deepEqual([(await sauvegarde(p)).tutoriel.etat, (await sauvegarde(p)).tutoriel.phase], ['commence', 2]);
      const v = (await envoyer(p, { type: 'tutoriel', etat: 'termine', phase: 4 }, 'vue')).vue;
      assert.deepEqual([v.tutoriel.etat, v.tutoriel.aFaire], ['termine', false]);
      await envoyer(p, { type: 'tutoriel', etat: 'nouveau', phase: 0 }, 'vue');
      assert.equal((await sauvegarde(p)).tutoriel.etat, 'termine');
    });
    await controle('D. « radio » : pause, piste choisie ; RUSH RADIO répond son état ; la préférence est gardée', async () => {
      const a = (await envoyer(p, { type: 'radio', action: 'pause', piste: '' }, 'radio')).etat;
      assert.equal(a.lecture, false);
      assert.equal((await sauvegarde(p)).reglages.musique, false);
      const b = (await envoyer(p, { type: 'radio', action: 'piste', piste: 'hyperlane' }, 'radio')).etat;
      assert.deepEqual([b.lecture, b.piste], [true, 'hyperlane']);
      assert.equal(b.pistes.length, 4);
      assert.ok(b.pistes.every((x) => x.id && x.titre && x.licence));
      assert.deepEqual(await p.evaluate(() => window.__audio.radiosEnLecture()), ['rush']);
      assert.equal((await sauvegarde(p)).reglages.piste, 'hyperlane');
    });
    await controle('D. « moteur » : le son du moteur suit Unity en course, s\'arrête hors course', async () => {
      await envoyer(p, { type: 'reglages', reglages: { ...(await dernier(p, 'vue')).vue.reglages, volume: 0.5 } }, 'vue');
      await envoyer(p, { type: 'ecran', nom: 'jeu' });
      await envoyer(p, { type: 'moteur', actif: true, vitesse: 0.5, overdrive: false, avancement: 0.3, boucliers: 3, boss: false });
      await p.waitForTimeout(200);
      const marche = await p.evaluate(() => window.__portalRush.tutoriel().moteur);
      await envoyer(p, { type: 'evenement', nom: 'fragment', valeur: 120, voie: 1 });
      await envoyer(p, { type: 'son', nom: 'pret' });
      await envoyer(p, { type: 'ecran', nom: 'pause' });
      const arret = await p.evaluate(() => window.__portalRush.tutoriel().moteur);
      assert.equal(marche, true);
      assert.equal(arret, false);
      await envoyer(p, { type: 'ecran', nom: 'menu' });
    });
    await controle('D. « langue » : le site passe en anglais sans rechargement ; Unity reçoit « langue » et la vue', async () => {
      // (Le serveur de développement compile la page anglaise à la première demande : on lui laisse le temps.)
      const r = await envoyer(p, { type: 'langue', langue: 'en' }, 'langue', 30000).catch(async (e) => {
        throw new Error(`${e.message.split('\n')[0]} — ${JSON.stringify(await p.evaluate(() => [document.documentElement.lang, location.href, window.__fauxUnity.recus.slice(-3).map((x) => x.m.type)]))}`);
      });
      assert.equal(r.langue, 'en');
      assert.equal(await p.evaluate(() => document.documentElement.lang), 'en');
      await p.waitForFunction(() => window.__fauxUnity.recus.filter((x) => x.m.type === 'vue').pop()?.m.vue.langue === 'en', null, { timeout: 3000 });
      assert.equal(await p.evaluate(() => document.querySelector('.rush').open), true);
      // (Le site n'accepte pas deux changements de langue coup sur coup : il répond alors la langue affichée.)
      const refus = await envoyer(p, { type: 'langue', langue: 'fr' }, 'langue', 30000);
      await p.waitForTimeout(800);
      const retour = refus.langue === 'fr' ? refus : await envoyer(p, { type: 'langue', langue: 'fr' }, 'langue', 30000);
      assert.equal(retour.langue, 'fr');
      assert.equal(await p.evaluate(() => document.documentElement.lang), 'fr');
    });

    // ---- E. La sortie ----
    await controle('E. « fermer » : Unity arrêté (Quit), fenêtre fermée, toile retirée, focus rendu au bouton du Hub', async () => {
      await envoyer(p, { type: 'fermer' });
      await p.waitForFunction(() => !document.querySelector('.rush').open, null, { timeout: 5000 });
      await p.waitForTimeout(400);
      const e = await p.evaluate(() => ({
        quitte: window.__fauxUnity.quitte,
        toile: !!document.querySelector('.rush-unity__toile'),
        moteur: document.querySelector('.rush').dataset.moteur ?? null,
        pont: !!window.__portalRushUnity,
        focus: document.activeElement?.classList.contains('jeu-bouton'),
        bouton: document.querySelector('#hub [data-onglet="rush"]').className,
        voile: !!document.querySelector('.voyage-temporel'),
        moteurSon: window.__portalRush.tutoriel().moteur,
      }));
      assert.equal(e.quitte, true);
      assert.equal(e.toile, false);
      assert.equal(e.moteur, null);
      assert.equal(e.pont, false);
      assert.equal(e.focus, true);
      assert.doesNotMatch(e.bouton, /est-fissure|est-brise/);
      assert.equal(e.voile, false);
      assert.equal(e.moteurSon, false);
    });
    await controle('E. DREAM RADIO reprend (elle jouait avant), RUSH RADIO se tait', async () => {
      await p.waitForTimeout(300);
      const a = await p.evaluate(() => ({ dream: window.__dreamRadio.enLecture, radios: window.__audio.radiosEnLecture() }));
      assert.equal(a.dream, true);
      assert.deepEqual(a.radios, ['dream']);
    });
    await p.screenshot({ path: `${DOSSIER}/e-retour.png` });
    await controle('E. Le portfolio revit : rouvrir la version Unity marche (2e ouverture, « Passer » d\'Échap)', async () => {
      await ouvrirHub(p);
      await cliquerRush(p);
      await p.waitForTimeout(900);
      await p.keyboard.press('Escape');
      await p.waitForFunction(() => window.__rushUnity.etat().monde, null, { timeout: 15000 });
      const e = await etatUnity(p);
      assert.equal(e.passe, true);
      assert.equal(e.intro, false, 'voyage passé : pas de sortie de tunnel');
      assert.equal(await p.evaluate(() => window.__fauxUnity.configMsg.tutorielAFaire), false, 'tutoriel déjà terminé');
      assert.equal(await p.evaluate(() => window.__fauxUnity.configMsg.ecran), 'accueil');
      await envoyer(p, { type: 'fermer' });
      await p.waitForFunction(() => !document.querySelector('.rush').open, null, { timeout: 5000 });
    });
    await contexte.close();
  }

  // ==========================================================================
  // F. LES REPLIS
  // ==========================================================================
  {
    const { p, contexte, journal } = await visiteur(avecGl, { manifeste: false });
    await ouvrirHub(p);
    await cliquerRush(p);
    await controle('F. Manifeste absent : l\'ancien jeu s\'ouvre (un seul voyage), un message discret au journal, rien de visible', async () => {
      await ancienOuvert(p);
      const e = await p.evaluate(() => ({ voyages: window.__voyages, toile: !!document.querySelector('.rush-unity__toile') }));
      assert.equal(e.voyages, 1);
      assert.equal(e.toile, false);
      assert.ok(journal.some((l) => l.startsWith('info') && l.includes('pas de build')), 'message au journal');
    });
    await quitterAncien(p);
    await contexte.close();
  }
  {
    const { p, contexte, journal } = await visiteur(avecGl, { options: { echec: true } });
    await ouvrirHub(p);
    await cliquerRush(p);
    await controle('F. Chargement en échec : l\'ancien jeu s\'ouvre à l\'arrivée du même voyage (pas de second tunnel)', async () => {
      await ancienOuvert(p);
      const e = await p.evaluate(() => ({ voyages: window.__voyages, toile: !!document.querySelector('.rush-unity__toile'), moteur: document.querySelector('.rush').dataset.moteur ?? null, ecran: window.__portalRush.etat().ecran }));
      assert.equal(e.voyages, 1);
      assert.equal(e.toile, false);
      assert.equal(e.moteur, null);
      assert.ok(journal.some((l) => l.includes('chargement impossible')));
    });
    await quitterAncien(p);
    await controle('F. Après le repli, DREAM RADIO et le focus sont rendus par l\'ancien jeu, comme d\'habitude', async () => {
      assert.equal(await p.evaluate(() => document.activeElement?.classList.contains('jeu-bouton')), true);
    });
    await contexte.close();
  }
  {
    const { p, contexte, requetes } = await visiteur(sansGl);
    await ouvrirHub(p);
    await cliquerRush(p);
    await controle('F. Sans WebGL : l\'ancien jeu (rendu 2D), aucune requête vers le build', async () => {
      await ancienOuvert(p);
      assert.equal(await p.evaluate(() => !!document.querySelector('.rush-unity__toile')), false);
      assert.deepEqual(requetes, []);
    });
    await quitterAncien(p);
    await contexte.close();
  }

  // ==========================================================================
  // G. LES SAUVEGARDES EXISTANTES
  // ==========================================================================
  {
    const v3 = {
      version: 3, revision: 7, tutoriel: { etat: 'termine', phase: 4, date: '2026-10-16' }, niveauMax: 4,
      reussis: { '1-as': true, '2-as': true, '3-expert': true }, records: { '1-as': { score: 99000, rang: 'A', date: '2026-10-16', regles: 5 }, '3-expert': { score: 150000, rang: 'S', date: '2026-10-17', regles: 5 } },
      etoiles: { '1-as': [true, true, false], '2-as': [true, false, false], '3-expert': [true, true, true] }, infini: { as: { score: 40000, distance: 3100, date: '2026-10-17', regles: 5 } },
      defi: { date: 20261017, meilleur: 30000, dernier: 30000, tentatives: 2, regles: 5 }, defisReussis: [20261017],
      totaux: { parties: 12, overdrives: 9, parfaits: 80, distance: 30000, multiplicateurMax: 7, infiniMax: 3100, rangS: true, meilleurCombo: 90, meilleursParfaits: 14, meilleureDistance: 3100 },
      derniere: { mode: 'infini', difficulte: 'as', niveau: 1 }, difficulte: 'expert',
      debloques: ['coque-givre', 'trainee-givre', 'overdrive-standard', 'noyau-blanc', 'trainee-aurore', 'coque-comete', 'overdrive-nova', 'trainee-prisme'],
      equipement: { coque: 'coque-comete', trainee: 'trainee-aurore', overdrive: 'overdrive-nova', noyau: 'noyau-blanc' }, vehicules: ['aube', 'faucon', 'spectre'], vehicule: 'faucon',
      reglages: { volume: 0.7, effetsReduits: false, secousses: true, aideCommandes: true, tactile: 'toucher', musique: false, volumeMusique: 0.5, muet: false, piste: 'hyperlane', sequenceFin: 'complete', qualite: 'auto' }, origine: 0,
    };
    const brut = JSON.stringify(v3);
    const { p, contexte } = await visiteur(avecGl, { sauvegardes: { 'portal-rush-3': brut } });
    await ouvrirHub(p);
    await cliquerRush(p);
    await controle('G. Sauvegarde v3 existante : intacte à l\'ouverture (octet pour octet), vue fidèle', async () => {
      await p.waitForFunction(() => window.__fauxUnity?.configMsg, null, { timeout: 15000 });
      assert.equal(await p.evaluate(() => localStorage.getItem('portal-rush-3')), brut);
      assert.equal(await p.evaluate(() => localStorage.getItem('portal-rush-3-secours')), null);
      const c = await p.evaluate(() => window.__fauxUnity.configMsg);
      const v = c.vue;
      assert.equal(c.tutorielAFaire, false);
      assert.equal(c.ecran, 'accueil');
      assert.equal(v.niveauMax, 4);
      assert.equal(v.vehicule, 'faucon');
      assert.equal(v.difficulte, 'expert');
      assert.deepEqual(v.difficultes.map((d) => d.ouverte), [true, true, true, true, false], 'Nightmare ouverte par un secteur réussi en Expert');
      assert.deepEqual(v.niveaux[2].scores[2].etoiles, [true, true, true]);
      assert.equal(v.niveaux[0].scores[1].record, 99000);
      assert.deepEqual(v.infini, [{ difficulte: 'as', score: 40000, distance: 3100 }]);
      assert.equal(v.defi.reussis, 1);
      assert.equal(v.meilleurScore, 150000);
      assert.deepEqual(v.reprise, { premiere: false, niveau: 4, difficulte: 'expert' });
      assert.equal(v.reglages.piste, 'hyperlane');
      assert.equal(v.reglages.musique, false);
      assert.deepEqual(await p.evaluate(() => window.__audio.radiosEnLecture()), [], 'musique coupée par le joueur : RUSH RADIO ne joue pas');
    });
    await envoyer(p, { type: 'fermer' });
    await p.waitForFunction(() => !document.querySelector('.rush').open, null, { timeout: 15000 });
    await contexte.close();
  }
  {
    const v2 = { version: 2, niveauMax: 3, reussis: { '1-as': true, '2-as': true }, records: { '1-as': { score: 5000, rang: 'A', date: '2026-10-01', regles: 4 } }, totaux: { parties: 5, overdrives: 2, parfaits: 10, distance: 9000, multiplicateurMax: 3, infiniMax: 0, rangS: false }, difficulte: 'as', debloques: ['coque-givre'], equipement: { coque: 'coque-givre' } };
    const brut = JSON.stringify(v2);
    const { p, contexte } = await visiteur(avecGl, { sauvegardes: { 'portal-rush-2': brut } });
    await ouvrirHub(p);
    await cliquerRush(p);
    await controle('G. Ancienne sauvegarde v2 seule : lue migrée (sauvegarde.ts), rien n\'est écrit à l\'ouverture', async () => {
      await p.waitForFunction(() => window.__fauxUnity?.configMsg, null, { timeout: 15000 });
      assert.equal(await p.evaluate(() => localStorage.getItem('portal-rush-2')), brut);
      assert.equal(await p.evaluate(() => localStorage.getItem('portal-rush-3')), null);
      const c = await p.evaluate(() => window.__fauxUnity.configMsg);
      assert.equal(c.vue.niveauMax, 3);
      assert.deepEqual(c.vue.niveaux[0].scores[1].etoiles, [true, false, false], 'un secteur réussi avant les étoiles garde la première');
      assert.equal(c.vue.niveaux[0].scores[1].record, 5000);
      assert.equal(c.vue.tutoriel.etat, 'passe', 'un joueur migré ne revoit pas le tutoriel automatique');
      assert.equal(c.tutorielAFaire, false);
    });
    await envoyer(p, { type: 'fermer' });
    await p.waitForFunction(() => !document.querySelector('.rush').open, null, { timeout: 15000 });
    await contexte.close();
  }

  // ==========================================================================
  // H. LE TUNNEL RETENU, LE MOUVEMENT RÉDUIT
  // ==========================================================================
  {
    const { p, contexte } = await visiteur(avecGl, { options: { pret: 9500 } });
    await ouvrirHub(p);
    await cliquerRush(p);
    await controle('H. Unity lent : le tunnel se prolonge en croisière (pas d\'arrivée, pas d\'attente noire) jusqu\'à « pret »', async () => {
      await p.waitForTimeout(8000);
      const pendant = await p.evaluate(() => ({ voile: !!document.querySelector('.voyage-temporel'), etat: window.__rushUnity.etat(), arrivee: (window.__voyage ?? []).some(([m]) => m === 'arrivee') }));
      assert.equal(pendant.voile, true, 'le tunnel est toujours là à 8 s (≈ 6 s prévues)');
      assert.equal(pendant.arrivee, false);
      assert.equal(pendant.etat.attente, false);
      await p.screenshot({ path: `${DOSSIER}/h-tunnel-retenu.png` });
      await p.waitForFunction(() => window.__rushUnity.etat().relais, null, { timeout: 8000 });
      await p.waitForFunction(() => !document.querySelector('.voyage-temporel'), null, { timeout: 3000 });
      assert.equal((await etatUnity(p)).intro, true);
    });
    await envoyer(p, { type: 'fermer' });
    await p.waitForFunction(() => !document.querySelector('.rush').open, null, { timeout: 5000 });
    await contexte.close();
  }
  {
    const { p, contexte } = await visiteur(avecGl, { reducedMotion: 'reduce', options: { pret: 1800 } });
    await p.evaluate(() => window.__dreamRadio.jouer());
    await p.waitForTimeout(300);
    await ouvrirHub(p);
    await cliquerRush(p);
    await controle('H. Mouvement réduit : voyage court, lumière d\'attente (pas de noir) jusqu\'à « pret », puis Unity sans intro', async () => {
      await p.waitForFunction(() => window.__rushUnity?.etat().attente, null, { timeout: 5000 });
      await p.screenshot({ path: `${DOSSIER}/h-reduit-attente.png` });
      const fond = await p.evaluate(() => getComputedStyle(document.querySelector('.rush-unity__attente')).backgroundImage);
      assert.match(fond, /radial-gradient/);
      await p.waitForFunction(() => window.__rushUnity.etat().monde, null, { timeout: 8000 });
      const c = await p.evaluate(() => window.__fauxUnity.configMsg);
      assert.equal(c.intro, false);
      assert.equal(c.appareil.mouvementReduit, true);
      await p.waitForFunction(() => !document.querySelector('.rush-unity__attente'), null, { timeout: 3000 });
      assert.equal(await p.evaluate(() => document.activeElement?.id), 'unity-canvas');
      assert.equal(await p.evaluate(() => window.__dreamRadio.estSuspendue), true);
    });
    await controle('H. Mouvement réduit : « fermer » rend le portfolio, le focus et DREAM RADIO', async () => {
      await envoyer(p, { type: 'fermer' });
      await p.waitForFunction(() => !document.querySelector('.rush').open, null, { timeout: 5000 });
      await p.waitForTimeout(400);
      const e = await p.evaluate(() => ({ focus: document.activeElement?.classList.contains('jeu-bouton'), dream: window.__dreamRadio.enLecture, toile: !!document.querySelector('.rush-unity__toile') }));
      assert.deepEqual(e, { focus: true, dream: true, toile: false });
    });
    await controle('H. Mouvement réduit : Échap pendant l\'attente abandonne le chargement proprement', async () => {
      await p.evaluate(() => (window.__fauxUnityOptions = { pret: 6000 }));
      await ouvrirHub(p);
      await cliquerRush(p);
      await p.waitForFunction(() => document.querySelector('.rush')?.dataset.moteur === 'unity' && window.__rushUnity?.etat().attente, null, { timeout: 12000 }).catch(async (e) => {
        throw new Error(`${e.message.split('\n')[0]} — état : ${JSON.stringify(await p.evaluate(() => ({ e: window.__rushUnity?.etat(), ouvert: document.querySelector('.rush').open, hub: document.querySelector('#hub').matches(':popover-open') })))}`);
      });
      await p.keyboard.press('Escape');
      await p.waitForFunction(() => !document.querySelector('.rush').open, null, { timeout: 5000 });
      await p.waitForTimeout(1700);
      const e = await p.evaluate(() => ({ toile: !!document.querySelector('.rush-unity__toile'), quitte: window.__fauxUnity.quitte, dream: window.__dreamRadio.enLecture }));
      assert.deepEqual(e, { toile: false, quitte: true, dream: true });
    });
    await contexte.close();
  }

  await controle('Aucune erreur JavaScript dans les pages (hors ressources absentes attendues)', async () => {
    assert.deepEqual([...new Set(erreurs)], []);
  });
} catch (e) {
  resultats.push({ nom: 'exécution', ok: false, erreur: e.message });
  console.log('ARRÊT  ' + e.message);
}

const echecs = resultats.filter((x) => !x.ok).length;
console.log(`\n${resultats.length - echecs}/${resultats.length} contrôles réussis.`);
await writeFile(`${DOSSIER}/rapport.json`, JSON.stringify({ date: new Date().toISOString(), resultats, erreurs: [...new Set(erreurs)] }, null, 2));
await avecGl.close();
await sansGl.close();
process.exit(echecs ? 1 : 0);
