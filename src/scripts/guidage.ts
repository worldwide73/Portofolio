// LE MINI-GUIDAGE DE LA PREMIÈRE VISITE (16 octobre 2026).
// À la toute première arrivée sur l'accueil, une fois l'introduction finie, une petite lame de verre
// paraît à côté du grand portail (au-dessus de lui sur téléphone) et dit, en deux lignes, comment se
// déplacer : la molette (ou le doigt) explore la destination affichée ; le portail fait voyager.
// Elle ne bloque rien, ne prend pas le focus, et s'en va :
//   - au bouton « Compris », ou à la touche Échap ;
//   - dès que l'on fait défiler, que le portail se brise ou que l'on quitte l'accueil.
// Elle est notée comme vue dès qu'elle s'affiche : elle ne revient pas aux visites suivantes (sans
// stockage local, elle reviendrait simplement à la prochaine page). L'aide clavier permet de la revoir.
// Le grand portail, ses sons et son animation ne sont pas touchés.

import { lenis } from './defilement';
import { mouvementReduit } from './outils';
import { destinationActive, voyager } from './voyage';

const CLE = 'guidage-vu';
const html = document.documentElement;
let montrer: (() => void) | null = null;

const dejaVu = () => {
  try {
    return localStorage.getItem(CLE) === '1';
  } catch {
    return false;
  }
};
const noterVu = () => {
  try {
    localStorage.setItem(CLE, '1');
  } catch {
    // stockage indisponible
  }
};

/** Remontre le guidage (bouton de l'aide clavier) : en haut de l'accueil, près du grand portail. */
export function revoirGuidage(): void {
  if (!montrer) return;
  const afficher = montrer;
  if (destinationActive() !== 'accueil') {
    // (Il paraît une fois l'accueil affiché, quelle que soit la durée du trajet.)
    window.addEventListener('destination', () => window.setTimeout(afficher, mouvementReduit ? 60 : 500), { once: true });
    voyager('accueil');
  } else if (window.scrollY > 10) {
    if (lenis) lenis.scrollTo(0, { duration: 0.8, onComplete: afficher });
    else {
      window.scrollTo({ top: 0 });
      afficher();
    }
  } else afficher();
}

export function initGuidage(): void {
  const guide = document.querySelector<HTMLElement>('.guidage');
  if (!guide) return;
  const fermer = guide.querySelector<HTMLButtonElement>('.guidage__fermer');
  let ouvert = false;

  const cacher = () => {
    if (!ouvert) return;
    ouvert = false;
    guide.classList.remove('est-visible');
    window.setTimeout(() => !ouvert && (guide.hidden = true), mouvementReduit ? 0 : 450);
  };

  montrer = () => {
    if (destinationActive() !== 'accueil' || html.classList.contains('carte-en-transition')) return;
    noterVu();
    ouvert = true;
    guide.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => ouvert && guide.classList.add('est-visible')));
  };

  fermer?.addEventListener('click', cacher);
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !ouvert) return;
    // (Une fenêtre ouverte garde sa touche Échap : on ne ferme le guidage que s'il est seul à l'écran.)
    if (document.querySelector('dialog[open], [popover]:popover-open') || html.classList.contains('menu-ouvert')) return;
    cacher();
  });
  window.addEventListener('scroll', () => ouvert && window.scrollY > 90 && cacher(), { passive: true });
  window.addEventListener('destination', (e) => {
    cacher();
    // Arrivé ailleurs qu'à l'accueil, le visiteur n'a pas encore vu le guidage : il l'aura en y arrivant.
    const { id, detour } = (e as CustomEvent<{ id: string; detour?: boolean }>).detail;
    if (id === 'accueil' && !detour && !dejaVu()) window.setTimeout(() => !dejaVu() && window.scrollY < 40 && montrer?.(), 900);
  });
  window.addEventListener('portail', (e) => (e as CustomEvent<string>).detail === 'carte-activation' && cacher());

  // La première visite : après l'introduction, si l'on est bien en haut de l'accueil.
  if (dejaVu()) return;
  const lancer = () => {
    if (html.classList.contains('intro')) return false;
    window.setTimeout(() => {
      if (!dejaVu() && window.scrollY < 40 && !document.querySelector('dialog[open]')) montrer?.();
    }, mouvementReduit ? 200 : 900);
    return true;
  };
  if (!lancer()) {
    const guet = new MutationObserver(() => lancer() && guet.disconnect());
    guet.observe(html, { attributes: true, attributeFilter: ['class'] });
  }
}
