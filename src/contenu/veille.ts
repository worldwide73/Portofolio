// Lit les fiches de veille (src/contenu/veille/*.md) et les prépare pour l'affichage :
// tri de la plus récente à la plus ancienne, choix de la langue, dates lisibles.

import { getCollection } from 'astro:content';
import type { Langue } from './types';

/** La ligne qui, dans une fiche, sépare la note en français de sa traduction. */
const SEPARATEUR = /^\[english\]\s*$/im;

export interface EntreeVeille {
  id: string;
  sujet: string;
  titre: string;
  /** Les paragraphes de « Ce que j'en retiens ». */
  paragraphes: string[];
  /** Faux si l'on affiche le français faute de traduction. */
  traduit: boolean;
  source: string;
  article?: string;
  lien: string;
  /** Date de la source, pour les machines (AAAA-MM-JJ) et pour les humains. */
  dateIso: string;
  dateLisible: string;
}

const enParagraphes = (texte: string) =>
  texte
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

/** Écrit une date en toutes lettres dans la langue demandée (13 octobre 2026, 13 October 2026). */
export function dateLisible(date: Date, langue: Langue): string {
  return new Intl.DateTimeFormat(langue === 'fr' ? 'fr-FR' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export async function chargerVeille(langue: Langue): Promise<{ entrees: EntreeVeille[]; majLe: string; majIso: string }> {
  const fiches = await getCollection('veille');
  fiches.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());

  const entrees = fiches.map((fiche): EntreeVeille => {
    const [francais, anglais = ''] = (fiche.body ?? '').split(SEPARATEUR);
    const aUneTraduction = enParagraphes(anglais).length > 0;
    const enAnglais = langue === 'en' && aUneTraduction;
    return {
      id: fiche.id,
      sujet: fiche.data.sujet,
      titre: langue === 'en' && fiche.data.titre_en ? fiche.data.titre_en : fiche.data.titre,
      paragraphes: enParagraphes(enAnglais ? anglais : francais),
      traduit: langue === 'fr' || enAnglais,
      source: fiche.data.source,
      article: fiche.data.article,
      lien: fiche.data.lien,
      dateIso: fiche.data.date.toISOString().slice(0, 10),
      dateLisible: dateLisible(fiche.data.date, langue),
    };
  });

  // « Dernière mise à jour » : la date d'ajout la plus récente.
  const ajouts = fiches.map((f) => (f.data.ajout ?? f.data.date).getTime());
  const maj = new Date(ajouts.length ? Math.max(...ajouts) : Date.now());
  return { entrees, majLe: dateLisible(maj, langue), majIso: maj.toISOString().slice(0, 10) };
}
