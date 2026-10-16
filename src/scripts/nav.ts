// LE MENU : cinq catégories dans une pastille, en haut de l'écran.
//   - la catégorie de la section affichée est mise en avant, et son fond clair
//     glisse de l'une à l'autre quand on défile ;
//   - sur téléphone, le bouton « Menu » ouvre les catégories en plein écran ;
//   - la barre change de ton quand elle passe au-dessus du panneau clair.

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { decoder } from './decode';
import { lenis } from './defilement';
import { apresPause } from './outils';
import { rangCourant } from './voyage';

export function initNav(): void {
  const barre = document.querySelector<HTMLElement>('.barre');
  const nav = document.querySelector<HTMLElement>('.nav');
  if (!barre || !nav) return;

  const liens = [...nav.querySelectorAll<HTMLAnchorElement>('[data-section-lien]')];
  const fond = nav.querySelector<HTMLElement>('.nav__actif');
  const sections = liens.map((lien) => document.getElementById(lien.dataset.sectionLien ?? ''));
  const surAccueil = sections.every(Boolean);
  let active = -1;

  /** Glisse le fond clair sous le lien actif. */
  const placer = () => {
    const lien = liens[active];
    if (!fond || !lien) return;
    fond.style.transform = `translateX(${lien.offsetLeft}px)`;
    fond.style.width = `${lien.offsetWidth}px`;
  };

  const activer = (i: number) => {
    if (i === active) return;
    active = i;
    liens.forEach((lien, k) => {
      if (k === i) lien.setAttribute('aria-current', 'true');
      else lien.removeAttribute('aria-current');
    });
    placer();
  };

  // ---- Suivi de la section affichée ----
  const suivre = () => {
    // La section courante : la même règle que le fil du bas (voir voyage.ts).
    if (surAccueil) activer(rangCourant());

  };
  gsap.ticker.add(suivre);
  ScrollTrigger.addEventListener('refresh', placer);
  window.addEventListener('resize', apresPause(placer, 150));
  document.fonts.ready.then(placer);

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
      liens[Math.max(active, 0)]?.focus({ preventScroll: true });
    } else {
      lenis?.start();
    }
  };

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
