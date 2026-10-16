// Configuration d'Astro, l'outil qui assemble le site.
// Astro produit des pages HTML statiques (rapides, bien référencées) et
// regroupe le CSS et le JavaScript. La doc : https://docs.astro.build
import { defineConfig } from 'astro/config';

export default defineConfig({
  // Adresse finale du site : sert au sitemap et aux liens absolus.
  site: 'https://matheomaleyran.com',
  trailingSlash: 'always',
  devToolbar: { enabled: false },

  // Deux langues. Le français est à la racine (/), l'anglais sous /en/.
  i18n: {
    locales: ['fr', 'en'],
    defaultLocale: 'fr',
    routing: { prefixDefaultLocale: false },
  },

  server: { port: 4321 },
});
