// LE TABLEAU DE SYNTHÈSE BTS SIO, À TÉLÉCHARGER
// Ce fichier fabrique /tableau-bts-sio.csv au moment du build, à partir des
// mêmes données que le tableau affiché dans la section Compétences
// (src/contenu/referentiel.ts). Il ne peut donc pas s'en écarter.
// Le format CSV s'ouvre dans Excel, LibreOffice ou Google Sheets.

import type { APIRoute } from 'astro';
import { fr } from '../contenu/fr';
import { BLOCS, DEMONTRE } from '../contenu/referentiel';

/** Entoure une valeur de guillemets, comme le veut le format CSV. */
const cellule = (valeur: string) => `"${valeur.replace(/"/g, '""')}"`;

export const GET: APIRoute = () => {
  const projets = fr.realisations.projets.filter((p) => !p.horsReferentiel);
  const lignes: string[][] = [['Bloc', 'Compétence du référentiel BTS SIO', ...projets.map((p) => p.nom)]];

  for (const bloc of BLOCS) {
    for (const competence of bloc.competences) {
      lignes.push([
        `Bloc ${bloc.numero} : ${bloc.intitule}`,
        competence.intitule,
        ...projets.map((p) => ((DEMONTRE[p.slug] ?? []).includes(competence.id) ? 'X' : '')),
      ]);
    }
  }

  // Point-virgule : le séparateur attendu par Excel en français.
  // Le caractère invisible du début (BOM) lui indique que le fichier est en UTF-8, pour les accents.
  const csv = '﻿' + lignes.map((ligne) => ligne.map(cellule).join(';')).join('\r\n') + '\r\n';
  return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8' } });
};
