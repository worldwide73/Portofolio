// LES REFLETS DE VERRE AU CURSEUR (16 octobre 2026).
// Sur trois surfaces de verre seulement (la pastille de la barre du haut, le passage vers le portail
// à la fin de chaque destination, la carte LinkedIn du Contact), la lumière glisse légèrement sous
// le curseur : un reflet bleu glacier, très doux, peint sous le texte (reflets dans destinations.css).
// Il apparaît quand le curseur entre, le suit, et s'éteint quand il sort. Rien ne tourne en continu :
// on ne travaille qu'au mouvement de la souris, une fois par image au plus.
// Ni sur un écran tactile, ni en mouvement réduit, ni quand les animations sont coupées. Le grand
// portail n'est pas concerné : son rendu ne change pas.

import { mouvementReduit } from './outils';
import { reglages } from './reglages';

const CIBLES = '.nav__liste, .suite__action, .contact__linkedin';

export function initReflets(): void {
  const souris = window.matchMedia('(hover: hover) and (pointer: fine)');
  if (mouvementReduit) return;
  const actif = () => souris.matches && reglages.animations > 0;

  document.querySelectorAll<HTMLElement>(CIBLES).forEach((surface) => {
    surface.classList.add('reflet');
    let dedans = false;
    let image = 0;
    let x = 0;
    let y = 0;
    // (Le cadre est relu à chaque image : la page a pu défiler sous un curseur immobile.)
    const poser = () => {
      image = 0;
      if (!dedans) return;
      const cadre = surface.getBoundingClientRect();
      surface.style.setProperty('--rx', `${(((x - cadre.left) / cadre.width) * 100).toFixed(1)}%`);
      surface.style.setProperty('--ry', `${(((y - cadre.top) / cadre.height) * 100).toFixed(1)}%`);
    };
    surface.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse' || !actif()) return;
      dedans = true;
      x = e.clientX;
      y = e.clientY;
      poser();
      surface.classList.add('a-reflet');
    });
    surface.addEventListener('pointermove', (e) => {
      if (!dedans) return;
      x = e.clientX;
      y = e.clientY;
      if (!image) image = requestAnimationFrame(poser);
    });
    surface.addEventListener('pointerleave', () => {
      dedans = false;
      surface.classList.remove('a-reflet');
    });
  });
}
