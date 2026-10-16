// LES PETITS DÉTAILS
//   - le titre de l'onglet change quand le visiteur regarde ailleurs ;
//   - un mot pour les curieux qui ouvrent la console du navigateur
//     (il leur indique comment ouvrir le terminal caché, voir terminal.ts) ;
//   - si le changement de langue doit recharger la page (repli : voir langue.ts),
//     la position de lecture est gardée.

import { allerA } from './defilement';

const CLE_POSITION = 'position-avant-langue';

export function initDetails(): void {
  // ---- Titre de l'onglet ----
  let titre = document.title;
  let absent = document.documentElement.dataset.ongletAbsent;
  document.addEventListener('visibilitychange', () => {
    if (absent) document.title = document.hidden ? absent : titre;
  });
  // Changement de langue : le titre de la page et celui de l'onglet délaissé ont été traduits.
  window.addEventListener('langue', () => {
    titre = document.title;
    absent = document.documentElement.dataset.ongletAbsent;
  });

  // ---- Console ----
  console.info(
    '%cMathéo Maleyran%c\nCe site est fait avec Astro, GSAP et WebGL (OGL).\nUn terminal est caché sur la page : touche ², ou tapez le mot « trace ».\nCurieux du code ? Écrivez-moi : matheo.maleyran38@gmail.com',
    'font: 600 16px sans-serif; color: #cfe1ff',
    'font: 13px sans-serif',
  );

  // ---- Changement de langue : on revient au même endroit de la page ----
  document.querySelectorAll<HTMLAnchorElement>('[data-langue]').forEach((lien) => {
    lien.addEventListener('click', () => {
      const fin = document.documentElement.scrollHeight - window.innerHeight;
      try {
        sessionStorage.setItem(CLE_POSITION, String(fin > 0 ? window.scrollY / fin : 0));
      } catch {
        // stockage indisponible : la page s'ouvrira simplement en haut
      }
    });
  });
}

/** À appeler une fois la page mise en place : replace le visiteur où il lisait. */
export function restaurerPosition(): void {
  let part = 0;
  try {
    part = Number(sessionStorage.getItem(CLE_POSITION) ?? 0);
    sessionStorage.removeItem(CLE_POSITION);
  } catch {
    return;
  }
  // Un clic de langue sans rechargement peut laisser cette ancienne position.
  // Le refresh doit toujours rejouer l'accueil depuis zéro.
  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  if (navigation?.type === 'reload') return;
  if (!part) return;
  const fin = document.documentElement.scrollHeight - window.innerHeight;
  allerA(Math.round(fin * part), true);
}
