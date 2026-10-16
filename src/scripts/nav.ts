// LA BARRE DU HAUT (16 octobre 2026).
// La même pastille de verre qu'avant. Elle dit d'abord où l'on est : la destination affichée
// (Accueil, Compétences, Réalisations, Veille, Contact ; sur une fiche, Réalisations), sur le fond
// clair. Ce n'est qu'un repère, sans action : on change de destination par le portail, en bas de
// chaque page. Viennent ensuite deux outils :
//   - Rechercher : la recherche dans le portfolio (recherche.ts, aussi Ctrl + K) ;
//   - Visite rapide : le profil en un coup d'œil (rapide.ts).
// Le nom affiché suit html[data-lieu] en CSS (destinations.css) ; ici, on ajuste seulement le fond
// clair à sa largeur. Sur téléphone, le bouton « Menu » ouvre la même liste en plein écran.

import { decoder } from './decode';
import { lenis } from './defilement';
import { apresPause } from './outils';
import { ouvrirRecherche } from './recherche';
import { basculerRapide } from './rapide';

export function initNav(): void {
  const barre = document.querySelector<HTMLElement>('.barre');
  const nav = document.querySelector<HTMLElement>('.nav');
  if (!barre || !nav) return;

  const outils = [...nav.querySelectorAll<HTMLButtonElement>('[data-outil]')];
  const lieu = nav.querySelector<HTMLElement>('.nav__lieu');
  const fond = nav.querySelector<HTMLElement>('.nav__actif');

  /** Le fond clair épouse le nom de la destination (sa largeur change avec elle). */
  const placer = () => {
    if (!fond || !lieu) return;
    fond.style.transform = `translateX(${lieu.offsetLeft}px)`;
    fond.style.width = `${lieu.offsetWidth}px`;
  };
  window.addEventListener('destination', placer);
  window.addEventListener('resize', apresPause(placer, 150));
  window.addEventListener('langue', () => requestAnimationFrame(placer));
  document.fonts.ready.then(placer);
  placer();

  // La Visite rapide se dit « enfoncée » tant que sa fenêtre est ouverte.
  window.addEventListener('outil', () =>
    outils.find((b) => b.dataset.outil === 'rapide')?.setAttribute('aria-pressed', String(!!document.querySelector('.rapide[open]'))),
  );

  // ---- Menu plein écran (téléphone) ----
  const bouton = barre.querySelector<HTMLButtonElement>('.barre__menu');
  const libelle = bouton?.querySelector<HTMLElement>('[data-decode]') ?? null;
  const html = document.documentElement;

  const basculer = (ouvert: boolean) => {
    html.classList.toggle('menu-ouvert', ouvert);
    bouton?.setAttribute('aria-expanded', String(ouvert));
    decoder(libelle, ouvert ? bouton?.dataset.fermer : bouton?.dataset.ouvrir);
    if (ouvert) {
      lenis?.stop();
      outils[0]?.focus({ preventScroll: true });
    } else {
      lenis?.start();
    }
  };

  // ---- Les deux outils ----
  outils.forEach((outil) =>
    outil.addEventListener('click', () => {
      if (html.classList.contains('menu-ouvert')) basculer(false);
      if (outil.dataset.outil === 'recherche') ouvrirRecherche(outil);
      else if (outil.dataset.outil === 'rapide') basculerRapide(outil);
    }),
  );

  bouton?.addEventListener('click', () => basculer(!html.classList.contains('menu-ouvert')));
  nav.addEventListener('click', (e) => {
    if ((e.target as Element).closest('a') && html.classList.contains('menu-ouvert')) basculer(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !html.classList.contains('menu-ouvert')) return;
    basculer(false);
    bouton?.focus();
  });
  window.addEventListener(
    'resize',
    apresPause(() => {
      if (window.innerWidth > 860 && html.classList.contains('menu-ouvert')) basculer(false);
    }, 150),
  );
}
