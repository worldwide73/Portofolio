// SIMULATION : un pilote automatique joue des parties de Portal Rush avec le vrai moteur (src/scripts/rush/moteur.ts),
// chargé dans un Chromium par le serveur de développement. Il sert à vérifier trois choses, chiffres à l'appui :
//   1. la JUSTICE : un pilote qui voit ce qu'un joueur voit (rien au-delà de la distance d'apparition, la place
//      finale d'un obstacle mobile seulement une fois figée) et réagit en « reaction » secondes doit pouvoir
//      tout passer, dans toutes les difficultés, Paradoxe comprise, avec les nouveaux obstacles mobiles ;
//   2. la RARETÉ de l'Overdrive : combien de parties remplissent la jauge (une fois au plus) ;
//   3. les SCORES qu'obtient un très bon pilote, pour placer les seuils des étoiles.
// Le pilote n'est pas un joueur : il planifie parfaitement, rangée par rangée, avec un temps de réaction fixe.
//
// Utilisation (serveur local lancé) : node outils/recettes/simulation-rush.mjs [parties par cas]
// Réglages : SITE, CHROMIUM. Écrit captures/v4/simulation.json.

import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const SITE = process.env.SITE ?? 'http://127.0.0.1:4321';
const PARTIES = Number(process.argv[2] ?? 6);
await mkdir('captures/v4', { recursive: true });
const navigateur = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const page = await navigateur.newPage();
await page.goto(SITE + '/404');

const resultats = await page.evaluate(async (parties) => {
  const { Partie } = await import('/src/scripts/rush/moteur.ts');
  const { NIVEAUX, VEHICULES } = await import('/src/scripts/rush/donnees.ts');
  const { ORDRE_DIFFICULTES, apparition } = await import('/src/scripts/rush/equilibrage.ts');

  /** Une partie entière jouée par le pilote. « reaction » : son temps de réaction (s). */
  const jouer = (mode, difficulte, niveau, graine, vehicule, reaction) => {
    const p = new Partie(mode, difficulte, niveau, graine, vehicule);
    const PAS = 1 / 120;
    let prochaineDecision = 0;
    let cible = 1;
    let odPret = false;
    let limite = 60 * 20; // 20 minutes au plus
    // Ce que le pilote « sait » d'un obstacle : sa place finale une fois figée ; avant, ce qu'il voit, avec un retard de réaction.
    const vu = new Map();
    const touches = {};
    const comptes = new Set();
    while (!p.termine && limite > 0) {
      if (p.temps >= prochaineDecision) {
        prochaineDecision = p.temps + 1 / 30;
        const loin = apparition(p.vitesse);
        const rangees = [];
        for (const o of p.objets) {
          const z = o.pos - p.distance;
          if (o.passe || o.detruit || z > loin || z + (o.longueur ?? 0) < -1) continue;
          if (['fragment', 'dore', 'noyau', 'portail'].includes(o.type)) {
            rangees.push({ pos: o.pos, fin: o.pos, bloque: [], bonus: o.type === 'portail' ? [] : o.voies, portail: o.type === 'portail' ? o : null });
            continue;
          }
          // Avant d'être figée, la configuration peut encore changer : le pilote se méfie de toutes ses voies possibles.
          let bloque;
          if (o.avant && z > (o.fige ?? 0)) {
            const premier = vu.get(o.id) ?? p.temps;
            vu.set(o.id, premier);
            // Inconnu : sa place finale sera figée assez tôt pour traverser deux voies ; le pilote l'ignore d'ici là.
            bloque = [];
          } else {
            const fige = vu.get(`f${o.id}`) ?? p.temps;
            vu.set(`f${o.id}`, fige);
            // Il ne « voit » la place finale qu'après son temps de réaction.
            bloque = p.temps - fige >= reaction || !o.avant ? o.voies : [];
          }
          rangees.push({ pos: o.pos, fin: o.pos + (o.longueur ?? 0), bloque, bonus: [], incertain: false });
        }
        rangees.sort((a, b) => a.pos - b.pos);
        // La meilleure voie pour la rangée suivante : programmation dynamique sur les rangées visibles.
        const v = p.vitesse;
        const dep = p.deplacement;
        // (Le pilote part d'où il est : sa voie la plus proche ; la première rangée se compte depuis sa position réelle.)
        let couts = [Infinity, Infinity, Infinity];
        couts[Math.round(p.x)] = 0;
        let tempsCourant = 0;
        const choix = [];
        for (const r of rangees.filter((x) => x.bloque.length || x.bonus.length)) {
          const dt = Math.max(0, (r.pos - p.distance) / v - tempsCourant);
          const t = (r.pos - p.distance) / v;
          const nouveaux = [Infinity, Infinity, Infinity];
          const de = [0, 0, 0];
          for (let l = 0; l < 3; l++) {
            for (let a = 0; a < 3; a++) {
              if (!Number.isFinite(couts[a])) continue;
              const besoin = choix.length === 0 ? (Math.abs(l - p.x) < 0.01 ? 0 : Math.abs(l - p.x) * dep + 0.02) : a === l ? 0 : Math.abs(a - l) * dep + 0.02;
              // Depuis la position actuelle, la première rangée dépend de x, pas d'une voie entière.
              const dispo = choix.length === 0 ? t : dt;
              let c = couts[a] + Math.abs(a - l) * 0.05;
              if (besoin > dispo + 1e-6) c += r.incertain ? 50 : 1000;
              // (Il préfère les trajets qui laissent de la marge : un geste au dernier moment est risqué.)
              else if (besoin > 0 && dispo - besoin < 0.1) c += (0.1 - (dispo - besoin)) * 40;
              if (r.bloque.includes(l)) c += r.incertain ? 30 : 1000;
              if (r.bonus.includes(l)) c -= 0.5;
              if (c < nouveaux[l]) {
                nouveaux[l] = c;
                de[l] = a;
              }
            }
          }
          choix.push(de);
          couts = nouveaux;
          tempsCourant = t;
          if (choix.length >= 7) break;
        }
        // On remonte le meilleur chemin jusqu'à la première rangée.
        if (choix.length) {
          let l = couts.indexOf(Math.min(...couts));
          for (let i = choix.length - 1; i > 0; i--) l = choix[i][l];
          cible = l;
        }
        if (p.voie !== cible && Math.abs(p.x - p.voie) < 0.35) p.deplacer(cible > p.voie ? 1 : -1);
        if (p.jauge >= 1 && p.etatOverdrive === 'pret') {
          odPret = true;
          p.declencher();
        }
      }
      const avant = p.chocs;
      p.avancer(PAS);
      p.evenements.length = 0;
      if (p.chocs > avant)
        for (const o of p.objets)
          if (o.touche && !comptes.has(o.id)) {
            comptes.add(o.id);
            const cle = `${o.type}${o.avant ? '*' : ''}`;
            touches[cle] = (touches[cle] ?? 0) + 1;
          }
      limite -= PAS;
    }
    const r = p.termine;
    return { touches, reussi: !!r?.reussi, arrive: !!r?.arrive, score: r?.score ?? 0, chocs: r?.chocs ?? -1, distance: Math.round(p.distance), od: odPret, overdrives: p.overdrives, parfaits: r?.parfaits ?? 0, rang: r?.rang };
  };

  const sortie = [];
  const graines = Array.from({ length: parties }, (_, k) => 1000 + k * 7919);
  for (const d of ORDRE_DIFFICULTES) {
    for (const n of NIVEAUX) {
      const parts = graines.map((g) => jouer('campagne', d, n.id, g, 'aube', 0.2));
      const chocs = parts.reduce((a, x) => a + Math.max(0, x.chocs), 0);
      const scores = parts.filter((x) => x.reussi).map((x) => x.score).sort((a, b) => a - b);
      const touches = {};
      for (const x of parts) for (const [k, v] of Object.entries(x.touches)) touches[k] = (touches[k] ?? 0) + v;
      sortie.push({ cas: `${n.id}-${d}`, touches, reussies: parts.filter((x) => x.reussi).length, parties, chocs, odRempli: parts.filter((x) => x.od).length, scoreMedian: scores[Math.floor(scores.length / 2)] ?? 0, scoreMax: scores.at(-1) ?? 0 });
    }
    const inf = graines.slice(0, 3).map((g) => jouer('infini', d, 1, g, 'aube', 0.2));
    sortie.push({ cas: `infini-${d}`, distances: inf.map((x) => x.distance), chocs: inf.map((x) => x.chocs), odRempli: inf.filter((x) => x.od).length });
  }
  // Les vaisseaux : la même épreuve (secteur 5, Expert) pour chacun.
  for (const v of VEHICULES) {
    const parts = graines.map((g) => jouer('campagne', 'expert', 5, g, v.id, 0.2));
    sortie.push({ cas: `vaisseau-${v.id}`, reussies: parts.filter((x) => x.reussi).length, parties, chocs: parts.reduce((a, x) => a + Math.max(0, x.chocs), 0), odRempli: parts.filter((x) => x.od).length });
  }
  return sortie;
}, PARTIES);

for (const r of resultats) console.log(JSON.stringify(r));
await writeFile('captures/v4/simulation.json', JSON.stringify({ date: new Date().toISOString(), parties: PARTIES, resultats }, null, 2));
await navigateur.close();
