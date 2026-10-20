// LA MÉMOIRE DES DESTINATIONS (16 octobre 2026).
// Une destination réellement rejointe est notée dans le navigateur. Sur la carte du portail, chaque
// destination déjà explorée porte un petit point cyan, posé sur le halo de sa planète (explorateur.css,
// .astre[data-visitee]) ; un lecteur d'écran entend « déjà explorée ». Rien n'est verrouillé ni compté :
// ce n'est qu'un souvenir. La carte, ses positions, ses mouvements et ses animations ne changent pas.
//
// Une fiche projet compte comme une visite des Réalisations. Sans stockage local (navigation privée
// stricte, stockage bloqué), le souvenir vaut pour la page en cours, sans erreur.

import { TRAJET, destinationActive, type Destination } from './voyage';

const CLE = 'destinations-visitees';
const estDestination = (id: unknown): id is Destination => typeof id === 'string' && (TRAJET as readonly string[]).includes(id);

function lire(): Set<Destination> {
  try {
    const brut: unknown = JSON.parse(localStorage.getItem(CLE) ?? '[]');
    return new Set(Array.isArray(brut) ? brut.filter(estDestination) : []);
  } catch {
    return new Set();
  }
}

const visitees = lire();

/** Pose la marque sur les destinations de la carte (sans effet sur les pages qui n'en ont pas). */
function refleter(): void {
  document.querySelectorAll<HTMLElement>('.explorateur .astre[data-destination]').forEach((astre) => {
    astre.toggleAttribute('data-visitee', visitees.has(astre.dataset.destination as Destination));
  });
}

/** Note qu'une destination a été rejointe. */
export function noterVisite(id: string): void {
  if (!estDestination(id) || visitees.has(id)) return;
  visitees.add(id);
  try {
    localStorage.setItem(CLE, JSON.stringify([...visitees]));
  } catch {
    // stockage indisponible : le souvenir vaut pour cette page
  }
  refleter();
}

export function initSouvenirs(): void {
  // La page d'arrivée : la destination affichée, ou les Réalisations pour une fiche projet.
  if (document.querySelector('[data-section]')) noterVisite(destinationActive());
  else if (document.querySelector('.fiche')) noterVisite('realisations');
  window.addEventListener('destination', (e) => {
    noterVisite((e as CustomEvent<{ id: string }>).detail.id);
  });
  refleter();
}
