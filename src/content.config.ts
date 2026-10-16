// LES COLLECTIONS DE CONTENU
// Astro lit ici quels dossiers contiennent des fiches à transformer en pages.
// Il n'y en a qu'une : la veille. Chaque fichier Markdown du dossier
// src/contenu/veille/ devient une entrée de la section Veille.
// Les fichiers dont le nom commence par « _ » (comme _modele.md) sont ignorés.

import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const veille = defineCollection({
  loader: glob({ pattern: '[^_]*.md', base: './src/contenu/veille' }),
  // Le « schéma » décrit ce que l'en-tête de chaque fiche doit contenir.
  // S'il manque un champ, le build s'arrête avec un message qui dit lequel.
  schema: z.object({
    /** La clé d'un sujet déclaré dans fr.ts et en.ts (veille.sujets). */
    sujet: z.string(),
    /** Le titre de ta note, avec tes mots. */
    titre: z.string(),
    /** Le même titre en anglais (facultatif). */
    titre_en: z.string().optional(),
    /** Le nom du média ou de l'organisme. */
    source: z.string(),
    /** Le titre exact de l'article ou du document (facultatif). */
    article: z.string().optional(),
    lien: z.url(),
    /** Date de publication de la source, au format AAAA-MM-JJ. */
    date: z.coerce.date(),
    /** Date à laquelle tu as ajouté la note (facultatif : sinon, la date de la source). */
    ajout: z.coerce.date().optional(),
  }),
});

export const collections = { veille };
