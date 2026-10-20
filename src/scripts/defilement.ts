// Défilement fluide.
// Lenis remplace le défilement saccadé de la molette par un mouvement amorti.
// ScrollTrigger (GSAP) déclenche et pilote les animations selon la position.
// Les deux partagent la même horloge (gsap.ticker) pour rester synchronisés.

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { mouvementReduit } from './outils';

gsap.registerPlugin(ScrollTrigger);

export let lenis: Lenis | null = null;

export function initDefilement(): void {
  if (mouvementReduit) return; // défilement natif, sans amorti

  lenis = new Lenis({ lerp: 0.095, wheelMultiplier: 1 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((temps) => lenis?.raf(temps * 1000));
  gsap.ticker.lagSmoothing(0);

  // Les liens internes (#contact…) défilent en douceur au lieu de sauter.
  document.addEventListener('click', (e) => {
    const lien = (e.target as Element).closest<HTMLAnchorElement>('a[href^="#"]');
    if (!lien || lien.dataset.telephone) return;
    const cible = document.querySelector<HTMLElement>(lien.hash);
    if (!cible) return;
    // Les liens vers une section sont pris en charge par le fil de navigation (voyage.ts).
    if (cible.hasAttribute('data-section')) return;
    e.preventDefault();
    allerA(cible);
  });
}

/**
 * Fait défiler jusqu'à une position (en pixels) ou jusqu'à un élément.
 * « retrait » : la distance à laisser au-dessus de l'élément (la place de la barre fixe).
 */
export function allerA(cible: number | HTMLElement, immediat = false, retrait = 0): void {
  // La position d'arrivée est toujours calculée ici, en pixels : un seul calcul,
  // que le défilement soit amorti (Lenis) ou natif.
  const y = Math.max(0, Math.round((typeof cible === 'number' ? cible : cible.getBoundingClientRect().top + window.scrollY) - retrait));
  // (Un saut immédiat passe même quand le défilement est suspendu, par exemple sous la carte du portail :
  // c'est le site qui change de destination, pas le visiteur qui fait défiler.)
  if (lenis) lenis.scrollTo(y, { immediate: immediat, force: immediat, duration: 1.5, easing: (t) => 1 - Math.pow(1 - t, 4) });
  else window.scrollTo({ top: y, behavior: 'auto' });
}

/** Vitesse actuelle du défilement (0 à l'arrêt). */
export function vitesse(): number {
  // (Après un saut immédiat, Lenis peut garder une vitesse périmée : on ne la lit que pendant un vrai défilement.)
  return lenis && lenis.isScrolling ? lenis.velocity : 0;
}
