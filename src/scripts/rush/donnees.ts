// PORTAL RUSH — LES DONNÉES DU JEU
//
// Les huit niveaux (leurs phases, objectifs et environnements), la survie
// infinie, le défi du jour, et les récompenses du garage. Les chiffres de
// difficulté sont dans equilibrage.ts ; la règle dans moteur.ts ; le dessin
// dans rendu.ts ; les sauvegardes dans sauvegarde.ts ; l'interface dans rush.ts.

import type { Difficulte } from './equilibrage';
export type { Difficulte } from './equilibrage';
export { ORDRE_DIFFICULTES, PROFILS, REGLES_VERSION } from './equilibrage';

export type Mode = 'campagne' | 'infini' | 'defi';
export const VOIES = 3;

/**
 * Les familles de motifs (voir moteur.ts) :
 *   simple, double     un ou deux cristaux sur une rangée
 *   escalier           la voie libre avance d'un cran à chaque rangée
 *   zigzag             enchaînement rapide : la voie libre saute d'un bord à l'autre
 *   couloir            piste instable : un long tronçon s'effondre, il faut choisir sa voie avant d'y entrer
 *   essaim             champ de débris serré
 *   laser              portes laser dont la voie libre change en approchant
 *   glissement         obstacles qui glissent d'une voie à l'autre
 *   portail            portail qui fait changer de voie (et une sortie à prendre aussitôt)
 *   risque             fragments dorés entre deux obstacles rapprochés : plus de points, moins de marge
 *   frappe, balayage, grille, effondrement : les attaques des boss
 * Les familles mobiles de la V4 (16 octobre 2026) :
 *   drones             des drones de patrouille glissent sur le côté, puis se posent sur leur voie
 *   portes             une structure mécanique se referme : une voie de plus se ferme en approchant
 *   rotors             une structure tournante : son ouverture tourne, puis s'arrête
 *   chutes             des blocs tombent du ciel sur leur voie (connue dès qu'ils apparaissent)
 *   convoi             des éclaireurs ennemis foncent vers le joueur, l'un après l'autre
 */
export type Famille =
  | 'simple'
  | 'double'
  | 'escalier'
  | 'zigzag'
  | 'couloir'
  | 'essaim'
  | 'laser'
  | 'glissement'
  | 'portail'
  | 'risque'
  | 'frappe'
  | 'balayage'
  | 'grille'
  | 'effondrement'
  | 'drones'
  | 'portes'
  | 'rotors'
  | 'chutes'
  | 'convoi';

/** Le nom d'une phase, affiché pendant la course. */
export type NomPhase = 'calibrage' | 'acceleration' | 'pression' | 'finale' | 'assaut' | 'tempete' | 'effondrement';

export interface Phase {
  /** Jusqu'où va la phase : fraction du parcours (ou des dégâts faits au boss). */
  fin: number;
  nom: NomPhase;
  familles: Partial<Record<Famille, number>>;
  /** Pendant cette phase, des motifs enchaînés sans répit, plus souvent. */
  pression?: boolean;
}

export type TypeObjectif = 'fin' | 'fragments' | 'parfaits' | 'portails' | 'boss' | 'score' | 'combo' | 'chocsMax';
export interface Objectif {
  type: TypeObjectif;
  valeur: number;
}

/** L'environnement d'un niveau : couleurs du ciel et de la piste, décor (voir rendu.ts). */
export type Theme = 'lancement' | 'neon' | 'debris' | 'laser' | 'rift' | 'tempete' | 'sentinelle' | 'singularite' | 'infini' | 'defi';

export interface Niveau {
  id: number;
  /** Longueur (m). 0 : le niveau dure jusqu'à la chute du boss. */
  longueur: number;
  theme: Theme;
  /** Facteurs sur le profil de difficulté : vitesse de départ, écart entre motifs ; et bonus de complexité. */
  vitesse: number;
  ecart: number;
  complexite: number;
  phases: Phase[];
  /** L'objectif de réussite (il débloque le niveau suivant). */
  objectif: Objectif;
  /**
   * L'objectif de maîtrise (la 3e étoile) : un seul, annoncé avant de jouer, réalisable.
   * (Le défi du jour en garde deux, pour son score.)
   */
  maitrise: Objectif[];
  /**
   * Les scores cibles de la 2e étoile, par difficulté (Pilot, Ace, Expert, Nightmare) : environ 80 % du score médian
   * d'un pilote simulé expert (règles version 4, 15 octobre 2026, scratchpad/calib-etoiles.mjs). Secteurs 4 et 5 :
   * le pilote simulé ne vise ni les esquives parfaites ni les portails ; leurs anciens chiffres ont suivi la baisse
   * moyenne mesurée sur les autres secteurs (× 0,86).
   */
  etoiles?: [number, number, number, number, number];
  /** Visibilité (m) dans la tempête. */
  brume?: number;
  boss?: { vie: number; phases: number };
  tutoriel?: boolean;
}

/**
 * Les huit niveaux. Plus longs et plus exigeants que dans la première version ;
 * les niveaux 5 et 6 sont un vrai saut ; 7 et 8 demandent tout maîtriser.
 */
export const NIVEAUX: Niveau[] = [
  {
    id: 1,
    longueur: 2200,
    theme: 'lancement',
    vitesse: 0.95,
    ecart: 1.05,
    complexite: -0.08,
    tutoriel: true,
    phases: [
      { fin: 0.3, nom: 'calibrage', familles: { simple: 3, double: 2, escalier: 1 } },
      { fin: 0.7, nom: 'acceleration', familles: { double: 2, escalier: 2, zigzag: 1, risque: 1 } },
      { fin: 1, nom: 'pression', familles: { double: 1, escalier: 1, zigzag: 2, risque: 1 }, pression: true },
    ],
    objectif: { type: 'fin', valeur: 0 },
    maitrise: [{ type: 'parfaits', valeur: 8 }],
    etoiles: [55000, 90000, 175000, 170000, 205000],
  },
  {
    id: 2,
    longueur: 2800,
    theme: 'neon',
    vitesse: 0.96,
    ecart: 1.05,
    complexite: -0.05,
    phases: [
      { fin: 0.3, nom: 'calibrage', familles: { double: 2, couloir: 2, escalier: 1 } },
      { fin: 0.7, nom: 'acceleration', familles: { couloir: 3, zigzag: 1, risque: 2, double: 1, drones: 1 } },
      { fin: 1, nom: 'pression', familles: { couloir: 2, zigzag: 2, risque: 2, drones: 2 }, pression: true },
    ],
    objectif: { type: 'fragments', valeur: 30 },
    maitrise: [{ type: 'combo', valeur: 60 }],
    etoiles: [105000, 155000, 230000, 265000, 295000],
  },
  {
    id: 3,
    longueur: 3000,
    theme: 'debris',
    vitesse: 1,
    ecart: 0.95,
    complexite: 0,
    phases: [
      { fin: 0.35, nom: 'calibrage', familles: { essaim: 3, simple: 1, double: 1 } },
      { fin: 0.75, nom: 'acceleration', familles: { essaim: 3, zigzag: 2, double: 1, risque: 1, chutes: 2 } },
      { fin: 1, nom: 'pression', familles: { essaim: 3, zigzag: 2, couloir: 1, chutes: 2 }, pression: true },
    ],
    objectif: { type: 'fin', valeur: 0 },
    maitrise: [{ type: 'chocsMax', valeur: 0 }],
    etoiles: [50000, 75000, 135000, 100000, 80000],
  },
  {
    id: 4,
    longueur: 3200,
    theme: 'laser',
    vitesse: 1,
    ecart: 1,
    complexite: 0.05,
    phases: [
      { fin: 0.3, nom: 'calibrage', familles: { laser: 3, double: 1 } },
      { fin: 0.7, nom: 'acceleration', familles: { laser: 3, couloir: 1, zigzag: 1, risque: 1, rotors: 2 } },
      { fin: 1, nom: 'pression', familles: { laser: 2, zigzag: 2, couloir: 1, rotors: 2, portes: 2 }, pression: true },
    ],
    objectif: { type: 'parfaits', valeur: 12 },
    maitrise: [{ type: 'combo', valeur: 50 }],
    etoiles: [105000, 155000, 235000, 310000, 370000],
  },
  {
    id: 5,
    longueur: 3600,
    theme: 'rift',
    vitesse: 1.08,
    ecart: 0.9,
    complexite: 0.12,
    phases: [
      { fin: 0.3, nom: 'calibrage', familles: { glissement: 3, portail: 2, double: 1 } },
      { fin: 0.65, nom: 'acceleration', familles: { glissement: 3, portail: 2, couloir: 2, laser: 1, portes: 2 } },
      { fin: 1, nom: 'pression', familles: { glissement: 2, couloir: 2, zigzag: 2, laser: 1, portail: 1, portes: 2, drones: 2 }, pression: true },
    ],
    objectif: { type: 'portails', valeur: 5 },
    maitrise: [{ type: 'parfaits', valeur: 15 }],
    etoiles: [225000, 275000, 465000, 670000, 805000],
  },
  {
    id: 6,
    longueur: 4200,
    theme: 'tempete',
    vitesse: 1.12,
    ecart: 0.85,
    complexite: 0.18,
    brume: 80,
    phases: [
      { fin: 0.25, nom: 'tempete', familles: { essaim: 2, couloir: 2, double: 2 } },
      { fin: 0.55, nom: 'pression', familles: { laser: 2, glissement: 2, essaim: 2, zigzag: 2 }, pression: true },
      { fin: 0.8, nom: 'tempete', familles: { couloir: 2, glissement: 2, laser: 2, essaim: 2, risque: 1, convoi: 2, chutes: 1 } },
      { fin: 1, nom: 'finale', familles: { zigzag: 3, glissement: 2, laser: 1, couloir: 2, convoi: 2, rotors: 2 }, pression: true },
    ],
    objectif: { type: 'fin', valeur: 0 },
    maitrise: [{ type: 'chocsMax', valeur: 1 }],
    etoiles: [120000, 155000, 300000, 305000, 260000],
  },
  {
    id: 7,
    longueur: 0,
    theme: 'sentinelle',
    vitesse: 1.1,
    ecart: 0.9,
    complexite: 0.2,
    boss: { vie: 40, phases: 3 },
    phases: [
      { fin: 0.33, nom: 'assaut', familles: { frappe: 4, double: 1 } },
      { fin: 0.66, nom: 'assaut', familles: { frappe: 3, balayage: 3, zigzag: 1, drones: 2 } },
      { fin: 1, nom: 'finale', familles: { grille: 3, frappe: 2, balayage: 2 }, pression: true },
    ],
    objectif: { type: 'boss', valeur: 0 },
    maitrise: [{ type: 'chocsMax', valeur: 0 }],
    etoiles: [135000, 180000, 540000, 665000, 765000],
  },
  {
    id: 8,
    longueur: 0,
    theme: 'singularite',
    vitesse: 1.18,
    ecart: 0.82,
    complexite: 0.3,
    brume: 100,
    boss: { vie: 60, phases: 4 },
    phases: [
      { fin: 0.25, nom: 'assaut', familles: { frappe: 3, glissement: 2, essaim: 1 } },
      { fin: 0.5, nom: 'assaut', familles: { balayage: 3, laser: 2, couloir: 2, convoi: 2 } },
      { fin: 0.75, nom: 'pression', familles: { grille: 3, glissement: 2, zigzag: 2, portes: 2 }, pression: true },
      { fin: 1, nom: 'effondrement', familles: { effondrement: 4, balayage: 2, grille: 2 }, pression: true },
    ],
    objectif: { type: 'boss', valeur: 0 },
    maitrise: [{ type: 'combo', valeur: 120 }],
    etoiles: [460000, 770000, 1900000, 3500000, 4200000],
  },
];

/** Survie infinie : les familles se débloquent avec la distance ; la courbe du profil fait le reste. */
export function niveauInfini(): Niveau {
  return {
    id: 0,
    longueur: Infinity,
    theme: 'infini',
    vitesse: 1,
    ecart: 1,
    complexite: 0,
    phases: [
      { fin: 400, nom: 'calibrage', familles: { simple: 2, double: 2, escalier: 1 } },
      { fin: 1200, nom: 'acceleration', familles: { double: 2, escalier: 1, zigzag: 2, couloir: 1, risque: 1 } },
      { fin: 2400, nom: 'pression', familles: { zigzag: 2, couloir: 2, essaim: 2, laser: 1, risque: 1, drones: 2, chutes: 1 }, pression: true },
      { fin: 4000, nom: 'tempete', familles: { couloir: 2, essaim: 2, laser: 2, glissement: 2, portail: 1, zigzag: 2, portes: 2, rotors: 1 }, pression: true },
      { fin: Infinity, nom: 'effondrement', familles: { zigzag: 2, couloir: 2, laser: 2, glissement: 2, essaim: 2, portail: 1, drones: 2, portes: 2, rotors: 2, convoi: 2, chutes: 1 }, pression: true },
    ],
    objectif: { type: 'fin', valeur: 0 },
    maitrise: [],
  };
}

/** Le défi du jour : le même parcours pour tout le monde, tiré d'après la date, en difficulté Ace. */
export const DEFI: Niveau = {
  id: 0,
  longueur: 3000,
  theme: 'defi',
  vitesse: 1,
  ecart: 1,
  complexite: 0.05,
  phases: [
    { fin: 0.3, nom: 'calibrage', familles: { double: 2, escalier: 1, couloir: 1, risque: 1 } },
    { fin: 0.7, nom: 'acceleration', familles: { zigzag: 2, couloir: 2, laser: 1, essaim: 1, glissement: 1, risque: 1, drones: 1, chutes: 1 } },
    { fin: 1, nom: 'pression', familles: { zigzag: 2, couloir: 2, laser: 2, glissement: 1, essaim: 1, portail: 1, portes: 2, convoi: 1 }, pression: true },
  ],
  objectif: { type: 'fin', valeur: 0 },
  maitrise: [
    { type: 'parfaits', valeur: 15 },
    { type: 'chocsMax', valeur: 0 },
  ],
};
export const DIFFICULTE_DEFI: Difficulte = 'as';

/** Le score cible de la 2e étoile d'un secteur, dans une difficulté. */
/**
 * Le score de la deuxième étoile (Pilote, As, Expert, Nightmare, Paradoxe). V4 (règles 5) : recalculés avec
 * outils/recettes/simulation-rush.mjs (85 % du score médian d'un pilote automatique sans faute ; les secteurs
 * dont il ne sait pas remplir l'objectif gardent leurs anciennes valeurs, Paradoxe = Nightmare × 1,2).
 */
export const scoreEtoile = (niveau: Niveau, d: Difficulte): number => niveau.etoiles?.[(['pilote', 'as', 'expert', 'cauchemar', 'paradoxe'] as Difficulte[]).indexOf(d)] ?? 0;

/** La graine du défi du jour : AAAAMMJJ, en heure locale. */
export function graineDuJour(date = new Date()): number {
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
}

/** Un tirage au sort reproductible (mulberry32) : la même graine donne toujours la même suite. */
export function hasardGraine(graine: number): () => number {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ==========================================================================
// LE GARAGE : quatre emplacements, des pièces gagnées en jouant (aucun avantage)
// ==========================================================================
export type Emplacement = 'coque' | 'trainee' | 'overdrive' | 'noyau';
export type Condition =
  | { type: 'depart' }
  | { type: 'niveau'; niveau: number }
  | { type: 'rang'; rang: 'S' }
  | { type: 'difficulte'; difficulte: Difficulte }
  | { type: 'infini'; distance: number }
  | { type: 'total'; stat: 'overdrives' | 'parfaits' | 'defis'; valeur: number }
  | { type: 'multiplicateur'; valeur: number };
export interface Piece {
  id: string;
  emplacement: Emplacement;
  /** Une couleur « r, g, b », ou « prisme » (elle change avec le temps). */
  couleur: string;
  condition: Condition;
}
export const PIECES: Piece[] = [
  { id: 'coque-givre', emplacement: 'coque', couleur: '238, 244, 255', condition: { type: 'depart' } },
  { id: 'coque-aurore', emplacement: 'coque', couleur: '170, 255, 225', condition: { type: 'niveau', niveau: 4 } },
  { id: 'coque-comete', emplacement: 'coque', couleur: '255, 228, 160', condition: { type: 'infini', distance: 3000 } },
  { id: 'coque-eclipse', emplacement: 'coque', couleur: '20, 22, 30', condition: { type: 'difficulte', difficulte: 'cauchemar' } },
  { id: 'trainee-givre', emplacement: 'trainee', couleur: '150, 192, 255', condition: { type: 'depart' } },
  { id: 'trainee-aurore', emplacement: 'trainee', couleur: '90, 240, 200', condition: { type: 'niveau', niveau: 2 } },
  { id: 'trainee-braise', emplacement: 'trainee', couleur: '255, 150, 90', condition: { type: 'niveau', niveau: 7 } },
  { id: 'trainee-prisme', emplacement: 'trainee', couleur: 'prisme', condition: { type: 'rang', rang: 'S' } },
  { id: 'trainee-singularite', emplacement: 'trainee', couleur: '170, 120, 255', condition: { type: 'niveau', niveau: 8 } },
  { id: 'overdrive-standard', emplacement: 'overdrive', couleur: '236, 244, 255', condition: { type: 'depart' } },
  { id: 'overdrive-nova', emplacement: 'overdrive', couleur: '120, 230, 255', condition: { type: 'total', stat: 'overdrives', valeur: 8 } },
  { id: 'overdrive-spectre', emplacement: 'overdrive', couleur: '190, 150, 255', condition: { type: 'multiplicateur', valeur: 10 } },
  { id: 'noyau-blanc', emplacement: 'noyau', couleur: '255, 255, 255', condition: { type: 'depart' } },
  { id: 'noyau-braise', emplacement: 'noyau', couleur: '255, 170, 110', condition: { type: 'total', stat: 'defis', valeur: 3 } },
  { id: 'noyau-violet', emplacement: 'noyau', couleur: '190, 150, 255', condition: { type: 'total', stat: 'parfaits', valeur: 100 } },
];
export const EMPLACEMENTS: Emplacement[] = ['coque', 'trainee', 'overdrive', 'noyau'];
export type Equipement = Record<Emplacement, string>;
export const EQUIPEMENT_DEPART: Equipement = { coque: 'coque-givre', trainee: 'trainee-givre', overdrive: 'overdrive-standard', noyau: 'noyau-blanc' };

/** Nightmare se débloque en réussissant un niveau en Expert ; Paradoxe, en réussissant un niveau en Nightmare. */
export const CONDITION_CAUCHEMAR: Condition = { type: 'difficulte', difficulte: 'expert' };
export const CONDITION_PARADOXE: Condition = { type: 'difficulte', difficulte: 'cauchemar' };

// ==========================================================================
// LES VAISSEAUX (Portal Rush V4, 16 octobre 2026) : quatre coques, chacune avec de vraies différences
// de pilotage, toutes équilibrées (un avantage se paie toujours ailleurs). Les pièces du garage, elles,
// restent purement visuelles. Le moteur lit ces chiffres (moteur.ts) ; le garage les affiche tels quels.
// ==========================================================================
export interface Vehicule {
  id: 'aube' | 'faucon' | 'bastion' | 'spectre';
  /** La silhouette dessinée par la scène 3D (0 à 3). */
  modele: 0 | 1 | 2 | 3;
  /** Durée d'un changement de voie (facteur : < 1 = plus vif). */
  deplacement: number;
  /** Boucliers en plus (ou en moins) par rapport à la difficulté (jamais moins d'un). */
  boucliers: number;
  /** Fenêtre du Perfect Dodge (facteur). */
  parfait: number;
  /** Ce que rapportent les réussites à la jauge d'Overdrive (facteur). */
  jauge: number;
  condition: Condition;
}
export const VEHICULES: Vehicule[] = [
  // L'équilibre : la référence, sans bonus ni défaut.
  { id: 'aube', modele: 0, deplacement: 1, boucliers: 0, parfait: 1, jauge: 1, condition: { type: 'depart' } },
  // Le plus vif : il change de voie plus vite, mais il encaisse un choc de moins.
  { id: 'faucon', modele: 1, deplacement: 0.8, boucliers: -1, parfait: 1, jauge: 1, condition: { type: 'niveau', niveau: 3 } },
  // Le plus solide : un bouclier de plus, mais il est plus lent à changer de voie et charge moins l'Overdrive.
  { id: 'bastion', modele: 2, deplacement: 1.18, boucliers: 1, parfait: 1, jauge: 0.85, condition: { type: 'niveau', niveau: 5 } },
  // Le plus fin : une fenêtre de Perfect Dodge plus large, mais une jauge qui monte moins vite.
  { id: 'spectre', modele: 3, deplacement: 1, boucliers: 0, parfait: 1.3, jauge: 0.8, condition: { type: 'rang', rang: 'S' } },
];
export const VEHICULE_DEPART: Vehicule['id'] = 'aube';
