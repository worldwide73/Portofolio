// PORTAL RUSH — L'ÉQUILIBRAGE (tous les réglages de difficulté, au même endroit)
//
// Pour rendre le jeu plus dur ou plus doux, c'est ce fichier qu'on modifie :
// rien d'autre ne contient de chiffre de difficulté.
//
// LA COURBE CONTINUE. Pendant une partie, quatre grandeurs évoluent chacune
// avec sa propre courbe (et pas un seul multiplicateur) :
//   - la vitesse        : départ, puis + « acceleration » m/s par seconde de survie, jusqu'au maximum ;
//   - l'espacement      : les motifs se resserrent avec le temps, jusqu'au minimum ;
//   - la réaction       : le temps garanti pour réagir diminue, sans passer sous le minimum ;
//   - la complexité     : elle monte avec le nombre de motifs franchis ; elle débloque les motifs avancés.
// Chaque niveau de campagne ajoute ses facteurs (plus rapide, plus serré, plus complexe)
// et découpe le parcours en phases (familles de motifs, phases de pression).
//
// LA JUSTICE. Aucun réglage ne peut produire d'obstacle impossible : le générateur
// (moteur.ts) laisse toujours le temps de réagir puis de changer de voie autant
// de fois qu'il faut, et vérifie chaque motif avant de le poser.
//
// ANCIENNES VALEURS (version 1 des règles, avant le 14 octobre 2026), pour comparer :
//   vitesse de départ (niveau 1) : Pilot 20 · Ace 24 · Expert 27 · Nightmare 31 m/s, à peine plus en fin de niveau ;
//   écart entre rangées : 44 m au début du niveau 1 (÷ 0,7 à 1,6 selon la difficulté) ;
//   réaction garantie : 0,55 / 0,42 / 0,34 / 0,28 s ; boucliers 5 / 3 / 2 / 1 ;
//   Overdrive : 5 s, invincible, score ×2 ; combo jamais remis à zéro sans choc.

/** Augmenter ce numéro dès que la génération ou le calcul du score change : un record n'est comparable qu'à règles égales. */
// Version 3 (14 octobre 2026) : les étoiles. Un seul objectif de maîtrise par secteur (la 3e étoile),
// le score cible fait la 2e. La note de fin compte cet objectif pour 30 points (au lieu de 2 × 15).
// Version 4 (15 octobre 2026) : l'Overdrive se gagne deux fois moins vite ; scores cibles des étoiles recalculés.
export const REGLES_VERSION = 4;

export type Difficulte = 'pilote' | 'as' | 'expert' | 'cauchemar';

export interface Profil {
  /** Multiplicateur de score affiché et appliqué. */
  score: number;
  vitesse: { depart: number; max: number; acceleration: number };
  /** Écart (m) entre deux motifs : au départ, au minimum, et ce qu'il perd par seconde de survie. */
  ecart: { depart: number; min: number; resserrement: number };
  /** Réaction garantie (s) avant une rangée qui oblige à bouger : au départ, et au plus serré (atteint après « sur » secondes). */
  reaction: { depart: number; min: number; sur: number };
  /** Complexité (0 à 1) : au départ, au maximum, et ce que rapporte chaque motif franchi. */
  complexite: { depart: number; max: number; parMotif: number };
  boucliers: number;
  /** Secondes d'invulnérabilité après un choc. */
  invulnerable: number;
  /** Facteur sur le nombre de fragments posés. */
  fragments: number;
  /** Ce que rapportent fragments et esquives à la jauge d'Overdrive. */
  gainOverdrive: number;
  /** Overdrive : durée (s), obstacles qu'il peut briser, multiplicateur de score de base. */
  overdrive: { duree: number; charges: number; multiplicateur: number };
  /** Fenêtre du Perfect Dodge (s) : on a quitté la voie de l'obstacle depuis moins de ce temps. */
  parfait: number;
  /** Le combo s'éteint s'il ne monte pas pendant ce temps (s). */
  comboDelai: number;
  /** Phases de pression : tous les « toutesLes » mètres, « motifs » motifs enchaînés sans répit. */
  pression: { toutesLes: number; motifs: number };
}

export const PROFILS: Record<Difficulte, Profil> = {
  // Pour apprendre, mais pas gratuit : ça accélère, et les erreurs coûtent.
  pilote: {
    score: 0.75,
    vitesse: { depart: 30, max: 60, acceleration: 0.14 },
    ecart: { depart: 30, min: 15, resserrement: 0.08 },
    reaction: { depart: 0.5, min: 0.32, sur: 120 },
    complexite: { depart: 0.12, max: 0.7, parMotif: 0.006 },
    boucliers: 4,
    invulnerable: 1.2,
    fragments: 1.15,
    gainOverdrive: 1.25,
    overdrive: { duree: 6, charges: 3, multiplicateur: 2 },
    parfait: 0.28,
    comboDelai: 6,
    pression: { toutesLes: 1100, motifs: 2 },
  },
  // La référence : difficile dès le départ, on peut mourir en jouant mal.
  as: {
    score: 1,
    vitesse: { depart: 36, max: 64, acceleration: 0.17 },
    ecart: { depart: 24, min: 13, resserrement: 0.08 },
    reaction: { depart: 0.4, min: 0.28, sur: 110 },
    complexite: { depart: 0.32, max: 0.92, parMotif: 0.008 },
    boucliers: 3,
    invulnerable: 1,
    fragments: 1,
    gainOverdrive: 1,
    overdrive: { duree: 5, charges: 2, multiplicateur: 2 },
    parfait: 0.22,
    comboDelai: 4.5,
    pression: { toutesLes: 800, motifs: 3 },
  },
  // Un vrai saut : plus vite, plus serré, moins de ressources, combos exigeants.
  expert: {
    score: 1.5,
    vitesse: { depart: 42, max: 74, acceleration: 0.23 },
    ecart: { depart: 20, min: 11, resserrement: 0.09 },
    reaction: { depart: 0.32, min: 0.23, sur: 100 },
    complexite: { depart: 0.55, max: 1, parMotif: 0.01 },
    boucliers: 2,
    invulnerable: 0.85,
    fragments: 0.8,
    gainOverdrive: 0.8,
    overdrive: { duree: 4.5, charges: 1, multiplicateur: 2.5 },
    parfait: 0.18,
    comboDelai: 3.5,
    pression: { toutesLes: 600, motifs: 4 },
  },
  // Extrême, jamais injuste : motifs avancés dès le départ, presque aucune marge.
  cauchemar: {
    score: 2,
    vitesse: { depart: 48, max: 84, acceleration: 0.3 },
    ecart: { depart: 17, min: 9.5, resserrement: 0.1 },
    reaction: { depart: 0.27, min: 0.2, sur: 90 },
    complexite: { depart: 0.75, max: 1, parMotif: 0.012 },
    boucliers: 1,
    invulnerable: 0.7,
    fragments: 0.65,
    gainOverdrive: 0.65,
    overdrive: { duree: 4, charges: 1, multiplicateur: 3 },
    parfait: 0.15,
    comboDelai: 2.8,
    pression: { toutesLes: 450, motifs: 5 },
  },
};
export const ORDRE_DIFFICULTES: Difficulte[] = ['pilote', 'as', 'expert', 'cauchemar'];

/** Les points. Tout est multiplié par le profil (score) et le multiplicateur de combo, sauf la distance. */
export const POINTS = {
  /** Par mètre parcouru (faible : une longue partie sans adresse ne bat pas un record). */
  metre: 0.4,
  fragment: 40,
  /** Fragment doré : posé sur un chemin à risque. */
  dore: 120,
  parfait: 100,
  /** Motif franchi sans choc : base, plus ce qu'ajoute sa complexité. */
  motif: 120,
  motifComplexite: 360,
  /** Obstacle brisé pendant l'Overdrive. */
  brise: 60,
  /** Chaque objectif de maîtrise atteint, en fin de niveau. */
  objectif: 600,
  /** Chaque point de vie retiré au boss. */
  boss: 150,
};

/** Le combo : un cran de multiplicateur toutes les « parCran » réussites, jusqu'à « max ». */
export const COMBO = { parCran: 4, max: 10 };

/** La jauge d'Overdrive : ce que rapporte chaque réussite (avant le gain du profil). */
// (15 octobre 2026, à la demande de Mathéo : l'Overdrive venait trop vite. Gains presque divisés par deux ;
// avant : fragment 0,06 · doré 0,12 · parfait 0,12 · motif 0,05.)
export const JAUGE = { fragment: 0.032, dore: 0.065, parfait: 0.065, motif: 0.026 };

/** Bonus de l'Overdrive déclenché sur un gros combo : jusqu'à +1 au multiplicateur, atteint à « combo » réussites. */
export const OVERDRIVE_COMBO = { combo: 24, bonus: 1 };

/** Le boss : points de vie par difficulté, et ce qui le blesse. */
export const BOSS = {
  vie: { pilote: 0.85, as: 1, expert: 1.25, cauchemar: 1.5 } as Record<Difficulte, number>,
  degats: { parfait: 1, noyau: 2, overdrive: 3, brise: 1 },
};

/** Les rangs, du plus haut au plus bas, et la note (sur 100) qu'il faut pour chacun. */
export const RANGS: [string, number][] = [
  ['SSS', 97],
  ['S', 88],
  ['A', 75],
  ['B', 60],
  ['C', 0],
];

/** Le temps physique d'un changement de voie (s) : il ne dépend pas de la difficulté (les commandes répondent pareil). */
export const DEPLACEMENT = 0.12;

/** Distance à laquelle un obstacle apparaît : au moins 95 m, et au moins 1,4 s à la vitesse en cours (toujours bien plus que la réaction garantie). */
export const apparition = (vitesse: number) => Math.max(95, vitesse * 1.4);
