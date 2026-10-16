// LE PORTAIL, D'OÙ QUE L'ON SOIT : rejoindre la carte du portail.
//
// La carte du portail (explorateur.ts) naît toujours du grand portail de l'accueil, qui se brise :
// ses fissures, sa rupture, ses éclats qui forment la carte, avec leurs sons. Ce module ne la
// redessine pas et n'invente aucune autre animation : il amène seulement le grand portail à l'écran.
//
//   - sur l'accueil, le grand portail à l'écran : il se brise aussitôt ;
//   - en bas de l'accueil (« Rejoindre le portail ») : la page remonte jusqu'à lui, puis il se brise,
//     sans second clic ;
//   - depuis une autre destination (le bouton de sa fin, le Hub, le terminal) : un court fondu ramène
//     en haut de l'accueil (le « détour » de voyage.ts), et le portail s'y brise de la même façon.
//     Refermer la carte sans choisir ramène à la destination de départ, là où on la lisait ;
//   - sur une fiche (ou la page 404) : l'accueil s'ouvre avec « ?portail », et la carte à l'arrivée.
//
// Depuis le 16 octobre 2026, la barre du haut ne porte plus de bouton Portail (elle dit seulement où
// l'on est) et la touche P n'ouvre plus rien : on prend le portail en bas de chaque destination.

import { allerA, lenis } from './defilement';
import { ouvrirCarte } from './explorateur';
import { emprisePortail } from './gl/champ';
import { borner, mouvementReduit } from './outils';
import { reglages } from './reglages';
import { destinationActive, rejoindrePortail } from './voyage';

const html = document.documentElement;
/** Jusqu'à quand (performance.now) une demande est en route : les clics répétés ne relancent rien. Ce n'est
    qu'un délai, pas un verrou : si le trajet est interrompu (un autre changement de destination, le bouton
    « précédent »), le portail redevient disponible de lui-même. */
let occupeJusque = 0;

/** Attend que le grand portail soit à l'écran, au plus « limite » millisecondes. */
function quandPortailVisible(fait: () => void, limite = 1600): void {
  const debut = performance.now();
  const guetter = () => {
    if (emprisePortail() || performance.now() - debut > limite) fait();
    else requestAnimationFrame(guetter);
  };
  requestAnimationFrame(guetter);
}

/** Rejoint la carte du portail : le grand portail de l'accueil se brise, comme toujours. */
export function ouvrirPortail(): void {
  const carte = document.querySelector<HTMLDialogElement>('.explorateur');
  // Sur une fiche (ou la page 404), la carte est sur l'accueil : on y va, et elle s'ouvrira à l'arrivée.
  if (!carte) {
    const accueil = document.querySelector<HTMLAnchorElement>('.identite__lien')?.getAttribute('href') || '/';
    window.location.href = `${accueil.split('#')[0]}?portail`;
    return;
  }
  if (performance.now() < occupeJusque || carte.open || html.classList.contains('intro') || html.classList.contains('carte-en-transition')) return;
  // Ce qui est ouvert par-dessus la page se range d'abord (menu du téléphone, panneaux).
  if (html.classList.contains('menu-ouvert')) document.querySelector<HTMLButtonElement>('.barre__menu')?.click();
  document.querySelectorAll<HTMLElement>('#acces:popover-open, #reglages:popover-open, #hub:popover-open').forEach((p) => p.hidePopover());
  document.querySelectorAll<HTMLDialogElement>('.recherche[open], .rapide[open], .raccourcis[open]').forEach((d) => d.close());

  const ouvrir = () => {
    occupeJusque = 0;
    ouvrirCarte();
  };

  // Une autre destination : un court fondu jusqu'en haut de l'accueil, puis le portail s'y brise.
  if (destinationActive() !== 'accueil') {
    occupeJusque = performance.now() + 2500;
    rejoindrePortail(() => quandPortailVisible(ouvrir, 1200));
    return;
  }
  // Le grand portail est à l'écran : c'est lui qui se brise.
  if (emprisePortail()) {
    ouvrirCarte();
    return;
  }
  // Plus bas sur l'accueil : on remonte jusqu'à lui, puis il se brise, sans second clic.
  occupeJusque = performance.now() + 3000;
  if (mouvementReduit || reglages.animations === 0 || !lenis) {
    allerA(0, true);
    quandPortailVisible(ouvrir, 400);
    return;
  }
  lenis.scrollTo(0, {
    duration: borner(window.scrollY / 3200, 0.55, 1),
    easing: (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
    onComplete: () => quandPortailVisible(ouvrir),
  });
}

export function initPortail(): void {
  // Les boutons qui rejoignent le portail : ceux de la fin de chaque destination (Suite.astro).
  document.addEventListener('click', (e) => {
    const bouton = (e.target as Element).closest<HTMLElement>('[data-portail-ouvrir]');
    if (!bouton) return;
    e.preventDefault();
    ouvrirPortail();
  });

  // Arrivée depuis une fiche (« ?portail ») : la carte s'ouvre après l'entrée de page.
  const adresse = new URL(window.location.href);
  if (adresse.searchParams.has('portail') && document.querySelector('.explorateur')) {
    adresse.searchParams.delete('portail');
    history.replaceState(history.state, '', adresse.pathname + adresse.search + adresse.hash);
    const lancer = () => {
      if (html.classList.contains('intro')) return false;
      window.setTimeout(ouvrirPortail, 250);
      return true;
    };
    if (!lancer()) {
      const guet = new MutationObserver(() => lancer() && guet.disconnect());
      guet.observe(html, { attributes: true, attributeFilter: ['class'] });
    }
  }
}
