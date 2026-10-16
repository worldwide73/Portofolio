// LES DESTINATIONS : passer de l'une à l'autre.
//
// Depuis le 16 octobre 2026, les cinq sections de l'accueil sont des destinations
// indépendantes : une seule est affichée à la fois (html[data-lieu], voir
// destinations.css). La molette ne fait défiler que la destination affichée, et
// s'arrête à sa fin : elle ne passe plus à la suivante. On voyage par le portail
// (sa carte), et par quelques accès directs (CV, Contact, boutons de l'accueil,
// recherche, liens venus d'une fiche).
//
// Un changement de destination dure environ 0,4 seconde, en trois gestes :
//   1. le contenu s'efface (90 ms) ;
//   2. à l'abri de ce court fondu, la destination change et la page repart en haut ;
//   3. le contenu réapparaît (300 ms) en glissant de quelques pixels, du côté
//      vers lequel on va (dans l'ordre Accueil → Contact).
// Rien n'est bloqué : une autre destination peut être demandée à tout moment ; elle
// remplace simplement la précédente, sans rien empiler.
//
// Une seule exception à ce fondu court : entre l'accueil et Contact, dans un sens
// comme dans l'autre, on joue le saut dans le temps (saut.ts), une vraie séquence
// d'une seconde : convergence, éclats de verre, traversée, révélation.
//
// L'adresse suit la destination (#competences, #contact…) : le bouton « précédent »
// du navigateur ramène à la destination d'avant, à l'endroit où on la lisait. L'accueil
// n'a pas d'ancre, pour qu'une actualisation y rejoue l'introduction.
//
// Les chapitres internes d'une destination (le fil du bas) sont l'affaire de fil.ts.
// Le tunnel plein écran (gl/tunnel.ts) ne sert plus qu'à ce saut et à l'éclair (eclair) :
// fin de l'introduction, et rupture du portail.

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ambiance } from './ambiances';
import { allerA, lenis } from './defilement';
import { fermerTunnel, ouvrirTunnel, tunnel } from './gl/tunnel';
import { reglages } from './reglages';
import { mouvementReduit } from './outils';
import { DUREE_SAUT, allureSaut, jouerSaut, type Sens } from './saut';

/** Le sens d'un changement de destination : vers la fin de la liste, ou vers son début. */
export type Mode = 'aller' | 'retour';
/** « saut » : un saut dans le temps commence (accueil ↔ Contact). « annule » : il est interrompu. */
export type Etape = 'depart' | 'fin' | 'saut' | 'annule';

/** Les destinations, dans l'ordre. Ce sont les ancres des sections. */
export const TRAJET = ['accueil', 'competences', 'realisations', 'veille', 'contact'] as const;
export type Destination = (typeof TRAJET)[number];

const SORTIE = 0.09; // secondes : le contenu s'efface
const ENTREE = 0.3; //  secondes : il réapparaît
const GLISSE = 26; //   pixels : le petit déplacement horizontal de l'arrivée

const ecouteurs: ((etape: Etape, mode: Mode, duree: number, rang: number) => void)[] = [];
/** S'abonner aux changements de destination (les sons s'y accrochent). « rang » : la destination d'arrivée. */
export function surEtape(fn: (etape: Etape, mode: Mode, duree: number, rang: number) => void): void {
  ecouteurs.push(fn);
}
const annoncer = (etape: Etape, mode: Mode, duree = 0, rang = 0) => ecouteurs.forEach((fn) => fn(etape, mode, duree, rang));

// ---- L'éclair de tunnel ----
let eclairEnCours = false;

/**
 * Un éclair de tunnel : le passage s'entrouvre et se referme, sans changer de
 * destination. L'introduction s'en sert au moment où l'on « entre » dans le site,
 * et le portail quand il éclate.
 */
export function eclair(duree = 0.7): void {
  if (mouvementReduit || reglages.animations === 0 || ambiance.eclats < 0.05 || eclairEnCours || annulerSaut || !ouvrirTunnel()) return;
  eclairEnCours = true;
  Object.assign(tunnel, { force: 0, vitesse: 0.2, saut: 0 });
  gsap
    .timeline({
      onComplete: () => {
        fermerTunnel();
        eclairEnCours = false;
      },
    })
    .to(tunnel, { force: 0.62 * ambiance.eclats, vitesse: 1, duration: duree * 0.4, ease: 'power2.in' }, 0)
    .to(tunnel, { distance: '+=1.6', duration: duree, ease: 'power1.out' }, 0)
    .to(tunnel, { force: 0, vitesse: 0, duration: duree * 0.6, ease: 'power2.out' }, duree * 0.4);
}

// ---- La destination affichée ----
const html = document.documentElement;
const estDestination = (id: string): id is Destination => (TRAJET as readonly string[]).includes(id);
/** La destination affichée (posée dès le <head> par public/avant.js, d'après l'adresse). */
export const destinationActive = (): Destination => {
  const id = html.dataset.lieu ?? 'accueil';
  return estDestination(id) ? id : 'accueil';
};
/** Son rang dans TRAJET (0 = l'accueil). */
export const rangCourant = () => TRAJET.indexOf(destinationActive());

/**
 * Le détour par le grand portail (voir rejoindrePortail) : la destination d'où l'on est parti, et
 * l'endroit où on la lisait. Tant qu'il dure, l'accueil est affiché, mais le visiteur est « là-bas ».
 */
let detour: { id: Destination; y: number } | null = null;
/** Le rang de la destination du visiteur : celle d'où il a demandé le portail, pendant un détour. */
export const rangDuVisiteur = () => TRAJET.indexOf(detour?.id ?? destinationActive());

/**
 * Où s'arrête une section quand on y navigue (scroll-margin-top, voir base.css).
 * Gardé pour le changement de langue, qui s'en sert comme point d'appui.
 */
export function retrait(section: HTMLElement): number {
  return parseFloat(getComputedStyle(section).scrollMarginTop) || 0;
}

/** Où l'on lisait chaque destination, pour y revenir au même endroit (bouton « précédent »). */
const lectures = new Map<Destination, number>();

/**
 * Affiche une destination, sans animation : les autres sont masquées, la page est
 * remesurée, et l'on se place en haut (ou à « y »). Prévient les autres modules
 * par l'évènement « destination ».
 */
function montrer(id: Destination, y = 0, detour = false): void {
  const avant = destinationActive();
  if (avant !== id) lectures.set(avant, window.scrollY);
  html.dataset.lieu = id;
  lenis?.resize();
  ScrollTrigger.refresh();
  allerA(y, true);
  ScrollTrigger.update();
  // (« detour » : l'accueil n'est affiché que le temps que le grand portail s'y brise ; ce n'est pas une visite.)
  window.dispatchEvent(new CustomEvent('destination', { detail: { id, avant, detour } }));
}

/**
 * Revient en haut de l'accueil, sans animation (quitter Portal Rush : le jeu cache encore la page).
 * L'adresse perd son ancre, sans ajouter d'étape à l'historique.
 */
export function revenirAccueil(): void {
  if (!document.getElementById('accueil')) return;
  detour = null;
  if (window.location.hash) history.replaceState(history.state, '', window.location.pathname + window.location.search);
  montrer('accueil');
}

/** Va en haut de la destination affichée, en douceur (elle est déjà là). */
function remonter(): void {
  if (lenis) lenis.scrollTo(0, { duration: 0.9, easing: (t) => 1 - Math.pow(1 - t, 3) });
  else window.scrollTo({ top: 0, behavior: mouvementReduit ? 'auto' : 'smooth' });
}

// ---- Le changement de destination ----
let enCours: gsap.core.Timeline | null = null;
/** Tant qu'un saut dans le temps est en route : la fonction qui l'annule, et le rang de sa destination. */
let annulerSaut: (() => void) | null = null;
let sautVers = -1;
/** La destination, tant que la page n'y a pas encore changé. */
let visee: { id: Destination; sens: 1 | -1 } | null = null;
let glissements: Animation[] = [];

/** Vrai pendant un changement de destination. */
export const enVoyage = () => enCours !== null || annulerSaut !== null;

const estCalme = () => mouvementReduit || reglages.animations === 0;

/** L'adresse d'une destination : l'accueil n'a pas d'ancre, pour qu'une actualisation y rejoue l'introduction. */
const adresse = (id: string) => (id === 'accueil' ? window.location.pathname + window.location.search : `#${id}`);

/** Note la destination dans l'adresse. « nouvelle » : ajoute une étape à l'historique (bouton précédent du navigateur). */
function inscrire(id: string, nouvelle: boolean): void {
  const actuelle = window.location.hash || window.location.pathname + window.location.search;
  if (actuelle === adresse(id)) return;
  try {
    if (nouvelle) history.pushState({ section: id }, '', adresse(id));
    else history.replaceState(history.state, '', adresse(id));
  } catch {
    // certains navigateurs limitent ces appels : l'adresse reste simplement en retard
  }
}

/**
 * Place le point de départ du clavier sur une section : la touche Tab continue
 * alors dans cette section, et les lecteurs d'écran annoncent où l'on est arrivé.
 */
export function focaliser(section: HTMLElement): void {
  section.setAttribute('tabindex', '-1');
  section.focus({ preventScroll: true });
  section.addEventListener('blur', () => section.removeAttribute('tabindex'), { once: true });
}

/** Le contenu de la destination glisse de quelques pixels vers sa place, depuis le côté d'où l'on vient. */
function glisser(section: HTMLElement, sens: 1 | -1): void {
  glissements.forEach((animation) => animation.cancel());
  // À l'accueil, la scène ne bouge pas : seuls ses textes glissent. Ailleurs, chaque bloc de la section.
  const blocs =
    section.id === 'accueil'
      ? [...section.querySelectorAll<HTMLElement>('.hero__bas > :not(.hero__invite)')]
      : ([...section.children] as HTMLElement[]);
  glissements = blocs
    .filter((bloc) => typeof bloc.animate === 'function')
    .map((bloc) =>
      bloc.animate([{ translate: `${sens * GLISSE}px 0` }, { translate: '0 0' }], {
        duration: ENTREE * 1000,
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
      }),
    );
}

/**
 * Va à une destination. « memoriser » : ajoute l'étape à l'historique du navigateur.
 * « direct » : un accès explicite (un résultat de recherche) ; on prend le court fondu, jamais le
 * saut dans le temps d'une seconde entre l'accueil et Contact.
 * Si un changement est déjà en route, sa destination est simplement remplacée.
 * Déjà sur place : on remonte en haut de la destination.
 */
export function voyager(id: string, memoriser = true, direct = false): void {
  if (!estDestination(id)) return;
  const cible = document.getElementById(id);
  const contenu = document.querySelector<HTMLElement>('main');
  if (!cible || !contenu) return;
  const arrivee = TRAJET.indexOf(id);

  // Pendant un détour par le grand portail, on est déjà sur l'accueil : la carte y emmène.
  if (detour) {
    const origine = detour;
    detour = null;
    // Retour à la destination de départ : on y retrouve sa lecture (l'adresse n'a pas changé).
    if (id === origine.id) return revenirDuDetour(origine);
    // L'accueil : on y est, l'adresse le dit maintenant.
    if (id === 'accueil') return inscrire('accueil', memoriser);
  }

  // Un saut dans le temps est déjà en route.
  if (annulerSaut) {
    if (arrivee === sautVers) return; // on y va déjà : les clics répétés ne relancent rien
    // Une autre destination est demandée : on coupe net, image et son, puis on continue normalement.
    annulerSaut();
    annulerSaut = null;
    annoncer('annule', 'retour');
  }

  const depart = visee ? TRAJET.indexOf(visee.id) : rangCourant();
  if (!visee && arrivee === depart) {
    remonter();
    return;
  }

  const sens = arrivee < depart ? -1 : 1;
  const mode: Mode = sens === 1 ? 'aller' : 'retour';
  if (memoriser) inscrire(id, true);
  // Si l'on vient d'une commande de navigation au clavier, le clavier repart de la destination d'arrivée.
  const auClavier = !!document.activeElement?.closest('.barre, .trajet, .acces, .suite, .recherche');

  /** Le changement lui-même, et ce qui l'accompagne. */
  const changer = (anime: boolean, cote: 1 | -1) => {
    montrer(id);
    if (anime) glisser(cible, cote);
    if (auClavier) focaliser(cible);
  };

  if (estCalme()) {
    enCours?.kill();
    enCours = null;
    visee = null;
    gsap.set(contenu, { clearProps: 'opacity' });
    changer(false, sens);
    annoncer('fin', mode, 0, arrivee);
    return;
  }

  // Entre les deux bouts du site, l'accueil et Contact : le saut dans le temps (voir saut.ts).
  // Les ambiances ne suppriment pas cette navigation signature dans les deux sens.
  // Seul le choix explicite d'animations allégées/coupées (ou système) la simplifie.
  const dernier = TRAJET.length - 1;
  const saut: Sens | null = arrivee === 0 && depart === dernier ? 'retour' : arrivee === dernier && depart === 0 ? 'aller' : null;
  if (saut && !visee && !direct && reglages.animations === 1) {
    enCours?.kill();
    enCours = null;
    gsap.set(contenu, { clearProps: 'opacity' });
    const duree = DUREE_SAUT / allureSaut();
    annoncer('saut', saut, duree, arrivee);
    sautVers = arrivee;
    annulerSaut = jouerSaut(
      saut,
      () => changer(false, sens),
      () => {
        annulerSaut = null;
        annoncer('fin', mode, 0, arrivee);
      },
    );
    return;
  }

  // La page n'a pas encore changé : on change seulement la destination à venir.
  if (enCours && visee) {
    visee = { id, sens };
    return;
  }

  enCours?.kill();
  visee = { id, sens };
  annoncer('depart', mode, SORTIE + ENTREE, arrivee);
  const opacite = Number(gsap.getProperty(contenu, 'opacity')) || 0;
  enCours = gsap.timeline({
    onComplete: () => {
      gsap.set(contenu, { clearProps: 'opacity' });
      enCours = null;
      annoncer('fin', mode, 0, arrivee);
    },
  });
  // (Si un fondu était déjà entamé, on le termine au lieu de le recommencer.)
  enCours.to(contenu, { opacity: 0, duration: SORTIE * opacite, ease: 'power1.in' });
  enCours.call(() => {
    const destination = visee;
    visee = null;
    if (!destination) return;
    const section = document.getElementById(destination.id);
    montrer(destination.id);
    if (section) glisser(section, destination.sens);
    if (auClavier && section) focaliser(section);
  });
  enCours.to(contenu, { opacity: 1, duration: ENTREE, ease: 'power2.out' });
}

// ---- Le détour par le grand portail ----
// La carte du portail naît du grand portail de l'accueil, qui se brise (explorateur.ts). Demandée
// depuis une autre destination (sa fin, le Hub, le terminal), la page passe donc un instant sur
// l'accueil, tout en haut, le temps d'un fondu ; le portail s'y brise exactement comme d'habitude.
// L'adresse ne change pas tant que rien n'est choisi : refermer la carte ramène là où l'on lisait.

/** Affiche l'accueil, tout en haut, pour que le grand portail s'y brise ; « pret » est appelé une fois la page en place. */
export function rejoindrePortail(pret: () => void): void {
  const contenu = document.querySelector<HTMLElement>('main');
  const id = destinationActive();
  if (!contenu || id === 'accueil' || !document.getElementById('accueil')) return pret();
  annulerSaut?.();
  annulerSaut = null;
  enCours?.kill();
  enCours = null;
  visee = null;
  detour = { id, y: window.scrollY };
  if (estCalme()) {
    montrer('accueil', 0, true);
    pret();
    return;
  }
  // (Sans le son d'un changement de destination : ce sont ceux du portail qui suivent. Le portail
  // ne se brise qu'une fois l'accueil tout à fait revenu : on le voit entier, puis il cède.)
  enCours = gsap.timeline({
    onComplete: () => {
      gsap.set(contenu, { clearProps: 'opacity' });
      enCours = null;
      pret();
    },
  });
  enCours.to(contenu, { opacity: 0, duration: 0.16, ease: 'power1.in' });
  enCours.call(() => montrer('accueil', 0, true));
  enCours.to(contenu, { opacity: 1, duration: ENTREE, ease: 'power2.out' });
}

/** La carte s'est refermée sans choix : retour à la destination de départ, là où on la lisait. */
function revenirDuDetour(origine: { id: Destination; y: number }): void {
  const contenu = document.querySelector<HTMLElement>('main');
  const section = document.getElementById(origine.id);
  if (!contenu || !section) return;
  if (estCalme()) {
    montrer(origine.id, origine.y);
    return;
  }
  // (Sans son non plus : celui de la carte qui se referme l'accompagne.)
  enCours?.kill();
  enCours = gsap.timeline({
    onComplete: () => {
      gsap.set(contenu, { clearProps: 'opacity' });
      enCours = null;
    },
  });
  enCours.to(contenu, { opacity: 0, duration: SORTIE, ease: 'power1.in' });
  enCours.call(() => {
    montrer(origine.id, origine.y);
    glisser(section, 1);
  });
  enCours.to(contenu, { opacity: 1, duration: ENTREE, ease: 'power2.out' });
}

/** Branche les destinations : les liens vers une section, l'historique, l'arrivée par une adresse. */
export function initVoyage(): void {
  const sections = TRAJET.map((id) => document.getElementById(id));
  if (!sections.every(Boolean)) return; // les destinations ne sont que sur l'accueil
  const contenu = document.querySelector<HTMLElement>('main');
  // C'est le site qui replace la page à chaque changement de destination, pas le navigateur.
  history.scrollRestoration = 'manual';

  // ---- Tout lien vers une destination (boutons de l'accueil, pied de page, liens internes) ----
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const lien = (e.target as Element).closest<HTMLAnchorElement>('a[href^="#"]');
    if (!lien || lien.dataset.telephone) return;
    const id = lien.hash.slice(1);
    if (!estDestination(id)) return;
    e.preventDefault();
    voyager(id);
  });

  // ---- La carte du portail refermée sans choix, pendant un détour : on rentre ----
  window.addEventListener('portail', (e) => {
    if ((e as CustomEvent<string>).detail !== 'carte-fermee' || !detour) return;
    const origine = detour;
    detour = null;
    revenirDuDetour(origine);
  });

  // ---- Le bouton « précédent » du navigateur : la destination d'avant, là où on la lisait ----
  window.addEventListener('popstate', () => {
    const id = window.location.hash.slice(1) || 'accueil';
    if (!estDestination(id) || !contenu) return;
    detour = null;
    annulerSaut?.();
    annulerSaut = null;
    enCours?.kill();
    enCours = null;
    visee = null;
    if (id === destinationActive()) return;
    const sens = TRAJET.indexOf(id) < rangCourant() ? -1 : 1;
    const y = lectures.get(id) ?? 0;
    if (estCalme()) {
      montrer(id, y);
      return;
    }
    annoncer('depart', sens === 1 ? 'aller' : 'retour', SORTIE + ENTREE, TRAJET.indexOf(id));
    enCours = gsap.timeline({
      onComplete: () => {
        gsap.set(contenu, { clearProps: 'opacity' });
        enCours = null;
      },
    });
    enCours.to(contenu, { opacity: 0, duration: SORTIE, ease: 'power1.in' });
    enCours.call(() => {
      montrer(id, y);
      glisser(document.getElementById(id)!, sens);
    });
    enCours.to(contenu, { opacity: 1, duration: ENTREE, ease: 'power2.out' });
  });

  // ---- Arrivée sur une adresse qui nomme une destination (lien venu d'une fiche, recherche) ----
  // La destination est déjà affichée (public/avant.js) : on se place simplement en haut,
  // une fois toutes les hauteurs connues.
  if (destinationActive() !== 'accueil') {
    const caler = () => {
      ScrollTrigger.removeEventListener('refresh', caler);
      allerA(0, true);
    };
    ScrollTrigger.addEventListener('refresh', caler);
  }
}
