// LE PORTAIL, D'OÙ QUE L'ON SOIT : rejoindre la carte du portail.
//
// La carte du portail (explorateur.ts) naît de ce qui se brise, avec la même séquence et les mêmes
// sons que sur l'accueil (fissures, rupture, éclats qui forment la constellation) :
//   - sur l'accueil : le grand portail. À l'écran, il se brise aussitôt ; plus bas (« Rejoindre le
//     portail », la fin de l'accueil), la page remonte jusqu'à lui, puis il se brise, sans second clic ;
//   - ailleurs (16 octobre 2026) : le bouton « Traverser le portail » de la fin de la destination se
//     fissure lui-même et vole en éclats ; la carte s'ouvre sur place, sans repasser par l'accueil.
//     Le contenu de la page s'efface derrière elle : le désert du fond de page reste visible. Refermer
//     la carte sans choisir ramène exactement où l'on était ;
//   - le Hub et le terminal, loin de l'accueil : la carte naît au centre de l'écran ;
//   - sur une fiche (ou la page 404) : l'accueil s'ouvre avec « ?portail », et la carte à l'arrivée.
//
// La barre du haut ne porte plus de bouton Portail (elle dit seulement où l'on est) et la touche P
// n'ouvre plus rien : on prend le portail en bas de chaque destination.

import { allerA, lenis } from './defilement';
import { ouvrirCarte } from './explorateur';
import { emprisePortail } from './gl/champ';
import { borner, mouvementReduit } from './outils';
import { reglages } from './reglages';
import { destinationActive } from './voyage';

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

/**
 * Rejoint la carte du portail. « source » : le bouton qui la demande (il se brise, loin de l'accueil) ;
 * « point » : l'endroit touché (le centre du bouton, au clavier).
 */
export function ouvrirPortail(options: { source?: HTMLElement | null; point?: { x: number; y: number } | null } = {}): void {
  const carte = document.querySelector<HTMLDialogElement>('.explorateur');
  // Sur une fiche (ou la page 404), la carte est sur l'accueil : on y va, et elle s'ouvrira à l'arrivée.
  if (!carte) {
    const accueil = document.querySelector<HTMLElement>('.identite__lien')?.dataset.accueil || '/';
    window.location.href = `${accueil.split('#')[0]}?portail`;
    return;
  }
  if (performance.now() < occupeJusque || carte.open || html.classList.contains('intro') || html.classList.contains('carte-en-transition')) return;
  // Ce qui est ouvert par-dessus la page se range d'abord (menu du téléphone, panneaux).
  if (html.classList.contains('menu-ouvert')) document.querySelector<HTMLButtonElement>('.barre__menu')?.click();
  document.querySelectorAll<HTMLElement>('#acces:popover-open, #reglages:popover-open, #hub:popover-open').forEach((p) => p.hidePopover());
  document.querySelectorAll<HTMLDialogElement>('.recherche[open], .rapide[open], .raccourcis[open]').forEach((d) => d.close());

  // Loin de l'accueil : le bouton se fissure et se brise, la carte s'ouvre sur place.
  if (destinationActive() !== 'accueil') {
    ouvrirCarte(options.source ? { bouton: options.source, point: options.point } : undefined);
    return;
  }
  // Sur l'accueil, le grand portail à l'écran : c'est lui qui se brise.
  if (emprisePortail()) {
    ouvrirCarte();
    return;
  }
  // Plus bas sur l'accueil : on remonte jusqu'à lui, puis il se brise, sans second clic.
  const ouvrir = () => {
    occupeJusque = 0;
    ouvrirCarte();
  };
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
    // (Au clavier, detail vaut 0 : le bouton se brise depuis son centre.)
    const point = e.detail > 0 ? { x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY } : null;
    ouvrirPortail({ source: bouton, point });
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
