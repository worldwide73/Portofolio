// Point d'entrée du contenu : choisit la langue, fournit les adresses
// des pages et applique la typographie française.

import type { ImageMetadata } from 'astro';
import { fr } from './fr';
import { en } from './en';
import type { Contenu, IdSection, Langue } from './types';

import forensics from '../assets/projets/worldwide-forensics.jpg';
import tools from '../assets/projets/worldwide-tools.jpg';
import check from '../assets/projets/worldwide-check.jpg';
import tweaks from '../assets/projets/worldwide-tweaks.jpg';
import bots from '../assets/projets/bots-discord.jpg';
import portalRush from '../assets/projets/portal-rush.jpg';
import accueilPortfolio from '../assets/projets/portfolio-accueil.jpg';

export const LANGUES: Langue[] = ['fr', 'en'];
export const SECTIONS: IdSection[] = ['accueil', 'competences', 'realisations', 'veille', 'contact'];

export function contenu(langue: Langue): Contenu {
  return langue === 'en' ? en : fr;
}

/** Capture de chaque projet, rangée par slug. Un projet sans image reçoit une couverture dessinée en CSS. */
export const images: Record<string, ImageMetadata | undefined> = {
  'worldwide-forensics': forensics,
  'worldwide-tools': tools,
  'worldwide-check': check,
  'worldwide-tweaks': tweaks,
  'bots-discord': bots,
  'portal-rush': portalRush,
  portfolio: accueilPortfolio,
};

/** Adresse de l'accueil dans une langue. */
export function cheminAccueil(langue: Langue): string {
  return langue === 'en' ? '/en/' : '/';
}

/** Adresse de la fiche d'un projet dans une langue. */
export function cheminFiche(langue: Langue, slug: string): string {
  return langue === 'en' ? `/en/work/${slug}/` : `/realisations/${slug}/`;
}

/** Adresse du tableau de synthèse BTS SIO à télécharger (voir src/pages/tableau-bts-sio.csv.ts). */
export function cheminTableau(): string {
  return '/tableau-bts-sio.csv';
}

/** Vrai si un texte attend encore une information de Mathéo (« [À COMPLÉTER : … ] »). */
export function estACompleter(texte: string): boolean {
  return texte.trimStart().startsWith('[');
}

/**
 * Typographie automatique.
 * En français : espace fine insécable avant ; ! ?, espace insécable avant
 * les deux-points et à l'intérieur des guillemets « ». Dans les deux
 * langues : apostrophes courbes. Tu peux donc écrire le contenu « normalement ».
 */
export function typo(texte: string, langue: Langue): string {
  let t = texte.replace(/'/g, '’');
  if (langue === 'fr') {
    t = t
      .replace(/ ([;!?])/g, ' $1')
      .replace(/ :/g, ' :')
      .replace(/« /g, '« ')
      .replace(/ »/g, ' »');
  }
  return t;
}
