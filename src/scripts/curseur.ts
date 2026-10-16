// Curseur personnalisé et boutons magnétiques (souris uniquement).
// Le curseur suit la souris avec un léger retard, et change de forme selon
// ce qu'il survole :
//   - rien de spécial      → un point ;
//   - un lien, un bouton   → un anneau ;
//   - un élément qui porte data-curseur="Ouvrir" → un disque avec ce mot.

import gsap from 'gsap';
import { aUneSouris, mouvementReduit } from './outils';

export function initCurseur(): void {
  const curseur = document.querySelector<HTMLElement>('.curseur');
  if (!curseur || !aUneSouris || mouvementReduit) return;

  const mot = curseur.querySelector<HTMLElement>('.curseur__texte');
  document.documentElement.classList.add('curseur-actif');

  // quickTo : une animation réutilisable, relancée à chaque mouvement de souris.
  const versX = gsap.quickTo(curseur, 'x', { duration: 0.42, ease: 'power3.out' });
  const versY = gsap.quickTo(curseur, 'y', { duration: 0.42, ease: 'power3.out' });

  window.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType === 'touch') return;
      versX(e.clientX);
      versY(e.clientY);
      curseur.classList.add('est-visible');
    },
    { passive: true },
  );

  document.addEventListener('pointerover', (e) => {
    const cible = e.target as Element;
    const nomme = cible.closest<HTMLElement>('[data-curseur]');
    const lien = cible.closest('a, button');
    curseur.classList.toggle('curseur--mot', !!nomme);
    curseur.classList.toggle('curseur--lien', !nomme && !!lien);
    if (nomme && mot) mot.textContent = nomme.dataset.curseur ?? '';
  });

  document.addEventListener('pointerdown', () => curseur.classList.add('curseur--presse'));
  document.addEventListener('pointerup', () => curseur.classList.remove('curseur--presse'));
  document.documentElement.addEventListener('pointerleave', () => curseur.classList.remove('est-visible'));

  // ---- Boutons magnétiques : le bouton se penche vers le curseur ----
  document.querySelectorAll<HTMLElement>('[data-aimant]').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      gsap.to(el, { x: dx * 0.22, y: dy * 0.32, duration: 0.5, ease: 'power3.out', overwrite: 'auto' });
    });
    el.addEventListener('pointerleave', () => {
      gsap.to(el, { x: 0, y: 0, duration: 1, ease: 'elastic.out(1, 0.45)', overwrite: 'auto' });
    });
  });
}
