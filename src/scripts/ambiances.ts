// LES AMBIANCES : ce que chacune change, en chiffres.
// Une ambiance est facultative : sans elle, le site est celui d'origine (tous
// les facteurs valent 1). Elle ne touche ni au thème (nuit, verre, clair) ni
// aux réglages d'affichage : elle agit sur la scène, le rythme des animations
// et le son. Ce fichier ne contient que des données ; elles sont appliquées
// par atmosphere.ts (scène, rythme), reglages.ts (lueur) et sons.ts (volumes, piste).

export type Ambiance = '' | 'chill' | 'espace' | 'focus' | 'silence';
export type Piste = 'derive' | 'heure-bleue' | 'trait';

export interface Dosage {
  /** Vitesse de l'horloge de la scène : nuages, voiles de sable, flottement du portail. */
  vitesse: number;
  /** Rythme de toutes les animations de l'interface (1 = normal ; plus petit = plus lent). */
  rythme: number;
  /** Voiles de sable, brume et étoiles. */
  brume: number;
  /** Lumière adoucie et légèrement réchauffée (0 = non, 1 = oui). */
  douceur: number;
  /** Lueur bleue de l'espace profond (0 = non, 1 = oui). */
  bleu: number;
  /** Éclairs, tremblements et fêlures. */
  eclats: number;
  /** Force de la lampe du curseur. */
  lampe: number;
  /** Facteur appliqué à l'intensité lumineuse de l'interface (halos, contours). */
  lueur: number;
  /** Facteur appliqué au volume des effets sonores, et à celui de la musique. */
  effets: number;
  musique: number;
  /** La piste que l'ambiance met en route quand on la choisit (aucune : on garde celle du visiteur). */
  piste: Piste | null;
}

const ORIGINE: Dosage = { vitesse: 1, rythme: 1, brume: 1, douceur: 0, bleu: 0, eclats: 1, lampe: 1, lueur: 1, effets: 1, musique: 1, piste: null };

export const AMBIANCES: Record<Ambiance, Dosage> = {
  '': ORIGINE,
  // Décontracté : tout ralentit et s'adoucit, les éclairs s'effacent presque.
  chill: { vitesse: 0.55, rythme: 0.85, brume: 0.8, douceur: 1, bleu: 0, eclats: 0.35, lampe: 0.85, lueur: 0.75, effets: 0.55, musique: 1, piste: 'heure-bleue' },
  // Espace profond : plus de brume et d'étoiles, une lueur bleue, rien d'agressif.
  espace: { vitesse: 0.9, rythme: 1, brume: 1.6, douceur: 0, bleu: 1, eclats: 1, lampe: 1.1, lueur: 1.15, effets: 1, musique: 1, piste: 'derive' },
  // Lecture : la scène se fige presque, les transitions raccourcissent, plus d'éclairs ni de fêlures.
  focus: { vitesse: 0.3, rythme: 1.5, brume: 0.35, douceur: 0.3, bleu: 0, eclats: 0, lampe: 0.45, lueur: 0.5, effets: 0.5, musique: 0.6, piste: 'trait' },
  // Silence : la musique est coupée, tout le reste est celui d'origine.
  silence: { ...ORIGINE },
};

/**
 * Les valeurs en cours pour la scène. Elles glissent en douceur d'une ambiance
 * à l'autre (atmosphere.ts) ; la scène les lit à chaque image (gl/champ.ts).
 */
export const ambiance = { vitesse: 1, brume: 1, douceur: 0, bleu: 0, eclats: 1, lampe: 1 };
