// PORTAL RUSH — CE QUE LA COURSE FAIT ENTENDRE (sorti de rush.ts le 18 octobre 2026, sans rien changer)
//
// Le son de chaque évènement du moteur, et ce que la course dit à la musique adaptative (RUSH RADIO). Une seule
// règle pour l'ancien jeu (rush.ts) et pour la version Unity (rush-unity/pont.ts) : les deux sonnent pareil.

import type { Adaptation } from '../audio/radio';
import type { EvenementRush } from '../sons';
import type { Mode } from './donnees';
import type { Partie, Resultat, TypeEvenement } from './moteur';

/** Le son de chaque évènement du moteur (les autres n'en ont pas). */
export const SON_EVENEMENT: Partial<Record<TypeEvenement, EvenementRush>> = {
  deplacement: 'deplacement',
  fragment: 'fragment',
  dore: 'noyau',
  noyau: 'noyau',
  parfait: 'parfait',
  motif: 'pret',
  choc: 'choc',
  portail: 'portail',
  overdrive: 'overdrive',
  pret: 'pret',
  detruit: 'detruit',
  'boss-touche': 'boss',
  'phase-boss': 'phase',
};

/** La vitesse du vaisseau de 0 (départ du profil) à 1 (son maximum) : ce qu'entendent la musique et le moteur. */
export const vitesseRelative = (p: Partie): number => Math.max(0, Math.min(1, (p.vitesse - p.profil.vitesse.depart) / Math.max(1, p.profil.vitesse.max - p.profil.vitesse.depart)));

/** La musique pendant la course : l'intensité suit la vitesse et l'avancée ; le danger, le dernier bouclier et le boss. */
export const adaptationCourse = (c: { vitesse: number; avancement: number; boucliers: number; boss: boolean; overdrive: boolean }): Adaptation => ({
  mode: 'course',
  intensite: Math.min(1, c.vitesse * 0.75 + c.avancement * 0.35),
  danger: c.boucliers <= 1 ? 0.8 : c.boss ? 0.5 : 0,
  overdrive: c.overdrive,
});

/** La musique hors de la course : menu, pause, défaite, victoire. */
export const adaptationFixe = (mode: Exclude<Adaptation['mode'], 'course'>): Adaptation => ({ mode, intensite: mode === 'victoire' ? 0.6 : 0, danger: 0, overdrive: false });

/** Deux situations qui s'entendent pareil ont la même clé : la radio n'est prévenue qu'au changement. */
export const cleAdaptation = (a: Adaptation): string => `${a.mode}|${Math.round(a.intensite * 20)}|${Math.round(a.danger * 4)}|${a.overdrive}`;

/** Une fin qui sonne comme une victoire : un secteur réussi, ou le défi du jour mené au bout. */
export const finVictorieuse = (mode: Mode, r: Resultat): boolean => (mode === 'campagne' && r.reussi) || (mode === 'defi' && r.arrive);
