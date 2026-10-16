// Titres qui montent ligne par ligne dans un masque, quand ils entrent à l'écran.
// SplitText (GSAP) découpe le titre en lignes ; chaque ligne est enfermée dans
// une boîte qui cache ce qui dépasse, puis glisse de bas en haut.
// Les sept étapes de la méthode s'éclairent une à une au passage.

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { mouvementReduit } from './outils';

gsap.registerPlugin(ScrollTrigger, SplitText);

const decoupes = new Map<HTMLElement, SplitText>();

/** Découpe un titre en lignes. « pose » : sans animation, pour un titre déjà affiché qu'on vient de réécrire. */
function decouper(el: HTMLElement, pose = false): void {
  decoupes.set(
    el,
    SplitText.create(el, {
      type: 'lines',
      mask: 'lines',
      linesClass: 'ligne-titre',
      autoSplit: true, // redécoupe si la largeur change ou si la police arrive en retard
      onSplit(decoupe) {
        if (pose) return;
        return gsap.from(decoupe.lines, {
          yPercent: 115,
          duration: 1.15,
          ease: 'expo.out',
          stagger: 0.09,
          // (Sans clamp() : un titre déjà à l'écran au chargement, comme celui d'une fiche projet, monte tout de suite ;
          // avec clamp(), son départ était ramené à 0 et il restait caché jusqu'au premier défilement.)
          scrollTrigger: { trigger: el, start: 'top 90%', once: true },
        });
      },
    }),
  );
}

/**
 * Réécrit un titre déjà découpé (changement de langue) : on défait le
 * découpage, on écrit le nouveau texte, on redécoupe. Renvoie false si cet
 * élément n'est pas un titre découpé.
 */
export function retitrer(el: HTMLElement, html: string): boolean {
  const decoupe = decoupes.get(el);
  if (!decoupe) return false;
  // Déjà apparu à l'écran : on le repose tel quel. Plus bas dans la page : il gardera son entrée.
  const dejaVu = el.getBoundingClientRect().top < window.innerHeight * 0.9;
  decoupe.revert();
  el.innerHTML = html;
  decouper(el, dejaVu);
  return true;
}

export function initTitres(): void {
  const etapes = document.querySelectorAll<HTMLElement>('.etape');

  if (mouvementReduit) {
    etapes.forEach((el) => el.classList.add('est-atteinte'));
    return;
  }

  // Un titre d'une destination masquée n'a pas de largeur : découpé maintenant, il le serait mot par mot,
  // puis redécoupé à son arrivée à l'écran (son entrée sautait, ou se rejouait en retard). On attend qu'il paraisse.
  let enAttente: HTMLElement[] = [];
  document.querySelectorAll<HTMLElement>('[data-titre]').forEach((el) => (el.getClientRects().length ? decouper(el) : enAttente.push(el)));
  window.addEventListener('destination', () => {
    enAttente = enAttente.filter((el) => {
      if (!el.getClientRects().length) return true;
      decouper(el);
      return false;
    });
  });

  etapes.forEach((el) => {
    ScrollTrigger.create({
      trigger: el,
      start: 'top 74%',
      onEnter: () => el.classList.add('est-atteinte'),
      onLeaveBack: () => el.classList.remove('est-atteinte'),
    });
  });
}
