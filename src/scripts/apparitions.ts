// APPARITIONS AU DÉFILEMENT
// Tout élément qui porte l'attribut data-apparait monte de quelques pixels et
// devient visible quand il entre à l'écran. Les éléments qui entrent en même
// temps (une liste, par exemple) arrivent l'un après l'autre.
// L'état caché est posé ici, en JavaScript : sans JavaScript, tout reste visible.
//
// Ce fichier s'occupe aussi de la barre de progression de lecture.

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { decoder } from './decode';
import { mouvementReduit } from './outils';

export function initApparitions(): void {
  // ---- Barre de progression ----
  // Sur une fiche, sa largeur suit le défilement de la page. Sur l'accueil, elle
  // avance par section (un quart par catégorie) : c'est voyage.ts qui la tient.
  const barre = document.querySelector<HTMLElement>('.progression');
  if (barre && !document.querySelector('[data-section]')) {
    gsap.to(barre, {
      scaleX: 1,
      ease: 'none',
      scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: 0.3 },
    });
  }

  if (mouvementReduit) return;

  const elements = gsap.utils.toArray<HTMLElement>('[data-apparait]');
  if (!elements.length) return;

  gsap.set(elements, { autoAlpha: 0, y: 22 });
  ScrollTrigger.batch(elements, {
    // « clamp » plafonne le seuil au défilement maximal de la page : un élément
    // posé tout en bas (le pied de page) apparaît donc forcément en fin de page.
    start: 'clamp(top 90%)',
    once: true,
    onEnter: (lot) => {
      // Quand on arrive d'un coup au milieu de la page (lien du menu, changement
      // de langue), tout ce qui se trouve plus haut « entre » en même temps.
      // Ces éléments-là, déjà dépassés, sont affichés sans animation : sinon
      // ceux qu'on regarde attendraient leur tour derrière eux.
      const depasses: Element[] = [];
      const visibles: Element[] = [];
      lot.forEach((el) => (el.getBoundingClientRect().bottom < 0 ? depasses : visibles).push(el));
      gsap.set(depasses, { autoAlpha: 1, y: 0 });
      gsap.to(visibles, { autoAlpha: 1, y: 0, duration: 0.95, ease: 'power3.out', stagger: 0.07 });
      // Les libellés « décodés » que contient le lot se résolvent en apparaissant.
      visibles.forEach((el) => el.querySelectorAll<HTMLElement>('[data-decode]').forEach((libelle) => decoder(libelle)));
    },
  });
}
