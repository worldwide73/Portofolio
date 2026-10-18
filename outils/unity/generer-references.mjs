// PORTAL RUSH → UNITY : LES PARTIES DE RÉFÉRENCE (tests dorés du portage C#)
//
// Joue des parties complètes avec le vrai moteur TypeScript (src/scripts/rush/moteur.ts), pilotées par un
// pilote automatique simple, à pas fixe (1/60 s), et enregistre tout : les commandes données à chaque image,
// chaque objet créé (type, position, voies, états d'approche…), chaque événement, l'état final et le résultat.
// Le portage C# (unity/PortalRush/Assets/PortalRush/Scripts/Coeur) rejoue les mêmes commandes et doit
// retrouver exactement la même chose (tests : outils/unity/coeur-tests, et les tests EditMode de Unity).
//
// Utilisation : node --experimental-strip-types --no-warnings outils/unity/generer-references.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chargerCoeur, RACINE } from './coeur-ts.mjs';

const { moteur } = await chargerCoeur();
const SORTIE = join(RACINE, 'unity', 'PortalRush', 'Assets', 'PortalRush', 'Tests', 'Editor', 'References');
mkdirSync(SORTIE, { recursive: true });

const DT = 1 / 60;
const SCENARIOS = [
  ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ mode: 'campagne', difficulte: 'as', niveau: n, graine: 1000 + n, vehicule: 'aube', secondes: 90 })),
  { mode: 'campagne', difficulte: 'pilote', niveau: 3, graine: 77, vehicule: 'faucon', secondes: 90 },
  { mode: 'campagne', difficulte: 'expert', niveau: 5, graine: 4242, vehicule: 'bastion', secondes: 90 },
  { mode: 'campagne', difficulte: 'cauchemar', niveau: 4, graine: 9001, vehicule: 'spectre', secondes: 90 },
  { mode: 'campagne', difficulte: 'paradoxe', niveau: 6, graine: 31337, vehicule: 'aube', secondes: 90 },
  { mode: 'campagne', difficulte: 'pilote', niveau: 1, graine: 5, vehicule: 'aube', secondes: 120 },
  { mode: 'infini', difficulte: 'as', niveau: 1, graine: 2026, vehicule: 'aube', secondes: 90 },
  { mode: 'infini', difficulte: 'paradoxe', niveau: 1, graine: 7, vehicule: 'faucon', secondes: 60 },
  { mode: 'defi', difficulte: 'pilote', niveau: 1, graine: 20261018, vehicule: 'bastion', secondes: 90 },
  // Le pilote « tardif » esquive au dernier moment (Perfect Dodge), prend les portails et déclenche l'Overdrive ;
  // le pilote « maladroit » se trompe parfois : chocs, combo perdu, fin de partie, objectifs manqués.
  { mode: 'campagne', difficulte: 'pilote', niveau: 2, graine: 202, vehicule: 'aube', secondes: 120, pilote: 'tardif' },
  { mode: 'campagne', difficulte: 'as', niveau: 4, graine: 404, vehicule: 'faucon', secondes: 120, pilote: 'tardif' },
  { mode: 'campagne', difficulte: 'expert', niveau: 6, graine: 606, vehicule: 'spectre', secondes: 120, pilote: 'tardif' },
  { mode: 'campagne', difficulte: 'as', niveau: 7, graine: 707, vehicule: 'aube', secondes: 150, pilote: 'tardif' },
  { mode: 'campagne', difficulte: 'cauchemar', niveau: 8, graine: 808, vehicule: 'bastion', secondes: 150, pilote: 'tardif' },
  { mode: 'infini', difficulte: 'expert', niveau: 1, graine: 1234, vehicule: 'spectre', secondes: 150, pilote: 'tardif' },
  { mode: 'campagne', difficulte: 'pilote', niveau: 3, graine: 33, vehicule: 'bastion', secondes: 120, pilote: 'maladroit' },
  { mode: 'campagne', difficulte: 'as', niveau: 5, graine: 55, vehicule: 'aube', secondes: 120, pilote: 'maladroit' },
  { mode: 'campagne', difficulte: 'pilote', niveau: 7, graine: 77077, vehicule: 'faucon', secondes: 150, pilote: 'maladroit' },
  { mode: 'infini', difficulte: 'pilote', niveau: 1, graine: 99, vehicule: 'aube', secondes: 120, pilote: 'maladroit' },
  { mode: 'defi', difficulte: 'pilote', niveau: 1, graine: 20261019, vehicule: 'aube', secondes: 120, pilote: 'tardif' },
];

/** Le premier obstacle encore devant le vaisseau (à moins de 55 m). */
const premierObstacle = (p) =>
  p.objets
    .filter((o) => moteur.estObstacle(o.type) && !o.passe && !o.detruit)
    .map((o) => ({ o, z: o.pos - p.distance }))
    .filter(({ o, z }) => (o.type === 'faille' ? z + (o.longueur ?? 0) > 0 : z > 0) && z < 55)
    .sort((a, b) => a.z - b.z)[0];

/** Un tirage reproductible propre au pilote (il ne touche pas au tirage du moteur). */
function tirage(graine) {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Le pilote automatique : il regarde le premier obstacle devant lui et rejoint la voie libre la plus proche. */
function piloter(p) {
  const devant = premierObstacle(p);
  if (p.etatOverdrive === 'pret') return 'o';
  if (!devant) {
    // Rien de dangereux : un fragment proche dans une voie voisine ?
    const f = p.objets.filter((o) => (o.type === 'fragment' || o.type === 'dore') && !o.passe && o.pos - p.distance > 0 && o.pos - p.distance < 30).sort((a, b) => a.pos - b.pos)[0];
    if (f && f.voies[0] !== p.voie && Math.abs(p.x - p.voie) < 0.05) return f.voies[0] > p.voie ? 'd' : 'g';
    return null;
  }
  const bloquees = p.voiesA(devant.o, Math.max(0, devant.z));
  if (!bloquees.includes(p.voie)) return null;
  const libres = [0, 1, 2].filter((v) => !bloquees.includes(v)).sort((a, b) => Math.abs(a - p.voie) - Math.abs(b - p.voie));
  if (!libres.length || Math.abs(p.x - p.voie) > 0.05) return null;
  return libres[0] > p.voie ? 'd' : 'g';
}

/** Le pilote tardif : il attend le dernier moment pour esquiver (Perfect Dodge) et prend les portails. */
function piloterTard(p) {
  if (p.etatOverdrive === 'pret') return 'o';
  // Pendant l'Overdrive, tant qu'il reste des charges, il fonce dans les obstacles pour les briser.
  if (p.overdrive > 0 && p.charges > 0) return null;
  const devant = premierObstacle(p);
  const pose = Math.abs(p.x - p.voie) < 0.05;
  const portail = p.objets.filter((o) => o.type === 'portail' && !o.passe && o.pos - p.distance > 0 && o.pos - p.distance < 40).sort((a, b) => a.pos - b.pos)[0];
  if (portail && (!devant || portail.pos < devant.o.pos) && portail.voies[0] !== p.voie && pose) return portail.voies[0] > p.voie ? 'd' : 'g';
  if (!devant) return null;
  const bloquees = p.voiesA(devant.o, Math.max(0, devant.z));
  if (!bloquees.includes(p.voie) || !pose) return null;
  const libres = [0, 1, 2].filter((v) => !bloquees.includes(v)).sort((a, b) => Math.abs(a - p.voie) - Math.abs(b - p.voie));
  if (!libres.length) return null;
  const sauts = Math.abs(libres[0] - p.voie);
  const fenetre = p.profil.parfait * p.vehicule.parfait;
  const dernierMoment = Math.max(p.deplacement * (sauts - 0.5) + 0.05, Math.min(fenetre * 0.8, p.deplacement * sauts + 0.1));
  if (devant.z / p.vitesse > dernierMoment) return null;
  return libres[0] > p.voie ? 'd' : 'g';
}

/** Le pilote maladroit : il oublie parfois d'esquiver et bouge parfois sans raison. */
function pilotageMaladroit(graine) {
  const h = tirage(graine ^ 0x5bd1e995);
  const oublies = new Map();
  return (p) => {
    if (p.etatOverdrive === 'pret') return 'o';
    if (h() < 0.012) return h() < 0.5 ? 'g' : 'd';
    const devant = premierObstacle(p);
    if (devant && !oublies.has(devant.o.id)) oublies.set(devant.o.id, h() < 0.22);
    if (devant && oublies.get(devant.o.id)) return null;
    return piloter(p);
  };
}

const arrondi = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 1e9) / 1e9 : v);
const objetVersListe = (o) => [o.id, o.type, arrondi(o.pos), o.voies, o.longueur === undefined ? null : arrondi(o.longueur), o.avant ? o.avant.map((e) => [arrondi(e.des), e.voies]) : null, o.fige === undefined ? null : arrondi(o.fige), o.vers ?? null, !!o.chaud, o.lie ?? null, o.motif ?? null, arrondi(o.graine)];

const index = [];
for (const s of SCENARIOS) {
  const p = new moteur.Partie(s.mode, s.difficulte, s.niveau, s.graine, s.vehicule);
  const pilote = s.pilote === 'tardif' ? piloterTard : s.pilote === 'maladroit' ? pilotageMaladroit(s.graine) : piloter;
  const entrees = [];
  const evenements = [];
  const objets = new Map();
  const images = Math.round(s.secondes / DT);
  let i = 0;
  for (; i < images && !p.termine; i++) {
    const a = pilote(p);
    if (a === 'g') p.deplacer(-1);
    else if (a === 'd') p.deplacer(1);
    else if (a === 'o') p.declencher();
    if (a) entrees.push([i, a]);
    p.avancer(DT);
    for (const e of p.evenements) evenements.push([i, e.type, e.valeur === undefined ? null : arrondi(e.valeur), e.voie ?? null]);
    p.evenements.length = 0;
    for (const o of p.objets) if (!objets.has(o.id)) objets.set(o.id, objetVersListe(o));
  }
  const final = {
    images: i,
    distance: arrondi(p.distance),
    temps: arrondi(p.temps),
    vitesse: arrondi(p.vitesse),
    score: arrondi(p.score),
    combo: p.combo,
    comboMax: p.comboMax,
    boucliers: p.boucliers,
    jauge: arrondi(p.jauge),
    overdrives: p.overdrives,
    fragments: p.fragments,
    parfaits: p.parfaits,
    chocs: p.chocs,
    portails: p.portails,
    motifs: p.motifsReussis,
    phase: p.phase,
    boss: p.boss ? { vie: arrondi(p.boss.vie), max: p.boss.max, phase: p.boss.phase } : null,
    resultat: p.termine ? { ...p.termine, temps: arrondi(p.termine.temps), objectifs: p.termine.objectifs.map((o) => ({ type: o.type, valeur: o.valeur, atteint: o.atteint, mesure: o.mesure })) } : null,
  };
  const nom = `${s.mode}-${s.difficulte}-${s.niveau}-${s.vehicule}-${s.graine}${s.pilote ? `-${s.pilote}` : ''}`;
  writeFileSync(join(SORTIE, `${nom}.json`), JSON.stringify({ scenario: { ...s, dt: DT }, entrees, objets: [...objets.values()], evenements, final }));
  index.push(nom);
  console.log(`${nom} : ${i} images, ${objets.size} objets, ${evenements.length} événements, ${p.termine ? (p.termine.reussi ? 'réussi' : p.termine.arrive ? 'arrivé' : 'perdu') : 'en cours'} (score ${Math.round(p.score)})`);
}
writeFileSync(join(SORTIE, 'index.json'), JSON.stringify(index, null, 1));
