// LE PLAN DU SITE POUR LES MOTEURS DE RECHERCHE
// Fabrique /sitemap.xml au moment du build : la liste de toutes les pages,
// chacune avec sa version dans l'autre langue. Ajouter un projet dans le
// contenu suffit à l'y faire apparaître.

import type { APIRoute } from 'astro';
import { cheminAccueil, cheminFiche } from '../contenu';
import { fr } from '../contenu/fr';

export const GET: APIRoute = ({ site }) => {
  const absolue = (chemin: string) => new URL(chemin, site).href;

  // Chaque page existe en deux langues : on les range par paires.
  const paires = [
    { fr: cheminAccueil('fr'), en: cheminAccueil('en') },
    ...fr.realisations.projets.map((p) => ({ fr: cheminFiche('fr', p.slug), en: cheminFiche('en', p.slug) })),
  ];

  const entrees = paires.flatMap((paire) =>
    (['fr', 'en'] as const).map(
      (langue) => `  <url>
    <loc>${absolue(paire[langue])}</loc>
    <xhtml:link rel="alternate" hreflang="fr" href="${absolue(paire.fr)}"/>
    <xhtml:link rel="alternate" hreflang="en" href="${absolue(paire.en)}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${absolue(paire.fr)}"/>
  </url>`,
    ),
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entrees.join('\n')}
</urlset>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
