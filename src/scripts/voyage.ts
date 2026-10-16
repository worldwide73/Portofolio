// LE FIL DE NAVIGATION : passer d'une section à une autre, vite.
//
// Un changement de section dure environ 0,4 seconde, en trois gestes :
//   1. le contenu s'efface (90 ms) ;
//   2. la page saute à la section demandée, à l'abri de ce court fondu ;
//   3. le contenu réapparaît (300 ms) en glissant de quelques pixels, du côté
//      vers lequel on va. Pendant ce temps, un faisceau file sur le fil du bas
//      de l'écran, de l'ancien point au nouveau.
// Rien n'est bloqué : on peut défiler, cliquer ailleurs ou demander une autre
// section à tout moment. La destination change alors, sans rien empiler.
//
// Le fil lui-même (.trajet, dans Chrome.astro) suit aussi le défilement : sa
// partie allumée s'allonge à mesure qu'on descend dans la page.
//
// L'adresse de la page suit la section affichée (#competences, #contact…) :
// le bouton « précédent » du navigateur ramène à la section d'avant.
//
// Une seule exception à ce fondu court : entre les deux bouts du site,
// l'accueil et Contact, dans un sens comme dans l'autre, on joue le saut dans
// le temps (saut.ts), une vraie séquence d'une seconde : convergence, éclats
// de verre, traversée, révélation.
//
// Le tunnel plein écran (gl/tunnel.ts) ne sert plus qu'à ce saut et à
// l'éclair (eclair) : fin de l'introduction, et rupture du portail.

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ambiance } from './ambiances';
import { allerA, lenis } from './defilement';
import { fermerTunnel, ouvrirTunnel, tunnel } from './gl/tunnel';
import { reglages } from './reglages';
import { borner, mouvementReduit } from './outils';
import { DUREE_SAUT, allureSaut, jouerSaut, type Sens } from './saut';

/** Le sens d'un changement de section : vers la suite du fil, ou vers son début. */
export type Mode = 'aller' | 'retour';
/** « saut » : un saut dans le temps commence (accueil ↔ Contact). « annule » : il est interrompu. */
export type Etape = 'depart' | 'fin' | 'saut' | 'annule';

/** Les destinations du fil, dans l'ordre. Ce sont les ancres des sections. */
export const TRAJET = ['accueil', 'competences', 'realisations', 'veille', 'contact'] as const;
type Section = (typeof TRAJET)[number];

const SORTIE = 0.09; // secondes : le contenu s'efface
const ENTREE = 0.3; //  secondes : il réapparaît
const GLISSE = 26; //   pixels : le petit déplacement horizontal de l'arrivée

const ecouteurs: ((etape: Etape, mode: Mode, duree: number, rang: number) => void)[] = [];
/** S'abonner aux changements de section (les sons s'y accrochent). « rang » : la section d'arrivée. */
export function surEtape(fn: (etape: Etape, mode: Mode, duree: number, rang: number) => void): void {
  ecouteurs.push(fn);
}
const annoncer = (etape: Etape, mode: Mode, duree = 0, rang = 0) => ecouteurs.forEach((fn) => fn(etape, mode, duree, rang));

// ---- L'éclair de tunnel ----
let eclairEnCours = false;

/**
 * Un éclair de tunnel : le passage s'entrouvre et se referme, sans changer de
 * section. L'introduction s'en sert au moment où l'on « entre » dans le site,
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

// ---- Où en est-on dans la page ? ----
let sections: (HTMLElement | null)[] = [];

/**
 * Où s'arrête une section quand on y navigue : son haut vient se placer juste
 * sous la barre fixe. La distance est écrite dans le CSS (scroll-margin-top,
 * voir base.css) ; elle est nulle pour l'accueil et la galerie, qui occupent
 * tout l'écran. C'est la seule règle d'alignement du site : le menu, le fil,
 * les flèches, la carte du portail et la section « courante » s'en servent tous.
 */
export function retrait(section: HTMLElement): number {
  return parseFloat(getComputedStyle(section).scrollMarginTop) || 0;
}

let memoire: { cle: string; ou: { rang: number; position: number } } | null = null;
let version = 0; // augmente quand la mise en page change : les mesures gardées ne valent plus

/**
 * « rang » : la section où l'on se trouve (son rang dans TRAJET). Une section
 * devient la section courante à l'instant précis où elle est alignée, c'est-à-dire
 * là où une navigation la dépose. Pas avant : tant qu'on voit encore la fin de la
 * précédente, c'est la précédente qui compte.
 * « position » : la même chose en continu ; 2,5 = à mi-chemin entre la 3e et la 4e.
 * (Le résultat est gardé tant que la page n'a pas bougé : plusieurs modules le demandent à chaque image.)
 */
function situer(): { rang: number; position: number } {
  const cle = `${window.scrollY}|${window.innerHeight}|${version}`;
  if (memoire?.cle === cle) return memoire.ou;
  if (!sections.length) sections = TRAJET.map((id) => document.getElementById(id));
  // Pour chaque section : ce qu'il reste à défiler avant qu'elle soit alignée (négatif : c'est déjà fait).
  const restes = sections.map((section) => (section ? section.getBoundingClientRect().top - retrait(section) : Infinity));
  // « Alignée » s'entend à une petite marge près (4 % de la hauteur de l'écran) :
  // assez peu pour que le fil s'allume bien au moment où la section se cale sous
  // la barre, assez pour qu'un écart de quelques pixels ne la fasse pas reculer.
  const marge = Math.max(24, window.innerHeight * 0.04);
  let rang = 0;
  restes.forEach((reste, i) => {
    if (reste <= marge) rang = i;
  });
  // Tout en bas de la page : la dernière section, même si elle ne peut pas monter plus haut.
  const fin = document.documentElement.scrollHeight - window.innerHeight;
  if (window.scrollY >= fin - 2) rang = TRAJET.length - 1;
  const dernier = rang === TRAJET.length - 1;
  const ou = { rang, position: dernier ? rang : rang + borner(-restes[rang] / Math.max(1, restes[rang + 1] - restes[rang]), 0, 1) };
  memoire = { cle, ou };
  return ou;
}

/** La section du fil actuellement à l'écran (son rang dans TRAJET). */
export const rangCourant = () => situer().rang;

// ---- Le changement de section ----
let enCours: gsap.core.Timeline | null = null;
/** Tant qu'un saut dans le temps est en route : la fonction qui l'annule, et le rang de sa destination. */
let annulerSaut: (() => void) | null = null;
let sautVers = -1;
/** La destination, tant que la page n'y a pas encore sauté. */
let visee: { id: Section; cible: HTMLElement; sens: 1 | -1 } | null = null;
let glissements: Animation[] = [];
/** Ce que montre le fil : sa position, et s'il est guidé par un faisceau (sinon il suit le défilement). */
const fil = { position: 0, guide: false };
let rail: HTMLElement | null = null;

/** Vrai pendant un changement de section. */
export const enVoyage = () => enCours !== null || annulerSaut !== null;

const estCalme = () => mouvementReduit || reglages.animations === 0;

/** L'adresse d'une section : l'accueil n'a pas d'ancre, pour qu'une actualisation y rejoue l'introduction. */
const adresse = (id: string) => (id === 'accueil' ? window.location.pathname + window.location.search : `#${id}`);

/** Note la section dans l'adresse. « nouvelle » : ajoute une étape à l'historique (bouton précédent du navigateur). */
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

/** Le contenu de la section glisse de quelques pixels vers sa place, depuis le côté d'où l'on vient. */
function glisser(section: HTMLElement, sens: 1 | -1): void {
  glissements.forEach((animation) => animation.cancel());
  // À l'accueil, la scène ne bouge pas : seuls ses textes glissent. Ailleurs, chaque
  // bloc de la section ; pour la galerie épinglée, c'est le bloc épinglé lui-même.
  const blocs =
    section.id === 'accueil'
      ? [...section.querySelectorAll<HTMLElement>('.hero__bas > :not(.hero__invite)')]
      : ([...section.children] as HTMLElement[]).map((bloc) =>
          bloc.classList.contains('pin-spacer') ? ((bloc.firstElementChild as HTMLElement | null) ?? bloc) : bloc,
        );
  glissements = blocs
    .filter((bloc) => typeof bloc.animate === 'function')
    .map((bloc) =>
      bloc.animate([{ translate: `${sens * GLISSE}px 0` }, { translate: '0 0' }], {
        duration: ENTREE * 1000,
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
      }),
    );
}

/** Le faisceau file sur le fil jusqu'au point d'une section. */
function lancerFaisceau(rang: number, duree = SORTIE + ENTREE * 0.85): void {
  if (!rail) return;
  rail.style.setProperty('--sens', rang < fil.position ? '-1' : '1');
  rail.classList.add('est-en-route');
  fil.guide = true;
  gsap.to(fil, {
    position: rang,
    duration: duree,
    ease: 'power3.inOut',
    overwrite: true,
    onComplete: () => {
      fil.guide = false;
      rail?.classList.remove('est-en-route');
    },
  });
}

/**
 * Va à une section. « memoriser » : ajoute l'étape à l'historique du navigateur.
 * Si un changement est déjà en route, sa destination est simplement remplacée.
 */
export function voyager(id: string, memoriser = true): void {
  const cible = document.getElementById(id);
  const contenu = document.querySelector<HTMLElement>('main');
  const arrivee = TRAJET.indexOf(id as Section);
  if (!cible || !contenu || arrivee < 0) return;

  // Un saut dans le temps est déjà en route.
  if (annulerSaut) {
    if (arrivee === sautVers) return; // on y va déjà : les clics répétés ne relancent rien
    // Une autre destination est demandée : on coupe net, image et son, puis on continue normalement.
    annulerSaut();
    annulerSaut = null;
    annoncer('annule', 'retour');
  }

  const depart = visee ? TRAJET.indexOf(visee.id) : rangCourant();
  // Déjà sur place : rien à faire.
  if (!visee && arrivee === depart && Math.abs(cible.getBoundingClientRect().top - retrait(cible)) < 4) return;

  const sens = arrivee < depart ? -1 : 1;
  const mode: Mode = sens === 1 ? 'aller' : 'retour';
  if (memoriser) inscrire(id, true);

  /** Le saut lui-même, et ce qui l'accompagne. */
  const sauter = (vers: HTMLElement, anime: boolean, cote: 1 | -1) => {
    allerA(vers, true, retrait(vers));
    ScrollTrigger.update();
    if (anime) glisser(vers, cote);
    // Si l'on vient d'une commande de navigation, le clavier repart de la section d'arrivée.
    if (document.activeElement?.closest('.barre, .trajet, .acces')) focaliser(vers);
  };

  if (estCalme()) {
    enCours?.kill();
    enCours = null;
    visee = null;
    gsap.set(contenu, { clearProps: 'opacity' });
    sauter(cible, false, sens);
    annoncer('fin', mode, 0, arrivee);
    return;
  }

  // Entre les deux bouts du site, l'accueil et Contact : le saut dans le temps (voir saut.ts).
  // Les ambiances ne suppriment pas cette navigation signature dans les deux sens.
  // Seul le choix explicite d'animations allégées/coupées (ou système) la simplifie.
  const dernier = TRAJET.length - 1;
  const saut: Sens | null = arrivee === 0 && depart === dernier ? 'retour' : arrivee === dernier && depart === 0 ? 'aller' : null;
  if (saut && !visee && reglages.animations === 1) {
    enCours?.kill();
    enCours = null;
    gsap.set(contenu, { clearProps: 'opacity' });
    const duree = DUREE_SAUT / allureSaut();
    lancerFaisceau(arrivee, duree);
    annoncer('saut', saut, duree, arrivee);
    sautVers = arrivee;
    annulerSaut = jouerSaut(
      saut,
      () => sauter(cible, false, sens),
      () => {
        annulerSaut = null;
        annoncer('fin', mode, 0, arrivee);
      },
    );
    return;
  }

  lancerFaisceau(arrivee);
  // La page n'a pas encore sauté : on change seulement la destination du saut à venir.
  if (enCours && visee) {
    visee = { id: id as Section, cible, sens };
    return;
  }

  enCours?.kill();
  visee = { id: id as Section, cible, sens };
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
    if (destination) sauter(destination.cible, true, destination.sens);
  });
  enCours.to(contenu, { opacity: 1, duration: ENTREE, ease: 'power2.out' });
}

/**
 * Continue le fil : une section plus loin (1) ou plus tôt (-1).
 * Le fil est une boucle : après la dernière section on revient à la première,
 * et avant la première on gagne la dernière.
 */
export function pas(sens: 1 | -1): void {
  const depart = visee ? TRAJET.indexOf(visee.id) : rangCourant();
  voyager(TRAJET[(depart + sens + TRAJET.length) % TRAJET.length]);
}

/** Branche le fil : ses points, ses flèches, les liens vers les sections, le clavier, l'historique. */
export function initVoyage(): void {
  sections = TRAJET.map((id) => document.getElementById(id));
  if (!sections.every(Boolean)) return; // les sections ne sont que sur l'accueil
  rail = document.querySelector<HTMLElement>('.trajet');
  const contenu = document.querySelector<HTMLElement>('main');

  // ---- Tout lien vers une section (menu, boutons, points du fil, pied de page) ----
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const lien = (e.target as Element).closest<HTMLAnchorElement>('a[href^="#"]');
    if (!lien || lien.dataset.telephone) return;
    const id = lien.hash.slice(1);
    if (!(TRAJET as readonly string[]).includes(id)) return;
    e.preventDefault();
    voyager(id);
  });

  // ---- Les deux flèches du fil ----
  rail?.querySelectorAll<HTMLButtonElement>('button[data-trajet]').forEach((bouton) => {
    bouton.addEventListener('click', () => pas(bouton.dataset.trajet === 'suivant' ? 1 : -1));
  });

  // ---- Les flèches gauche et droite du clavier : une section plus tôt, ou plus loin ----
  // Exceptions : quand on tape ou règle quelque chose (champ, curseur, panneau
  // ouvert), et dans la galerie, qui garde les flèches pour ses projets tant
  // qu'il en reste dans ce sens (elle marque alors la touche comme « traitée »).
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    if (e.repeat || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
    if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable], [popover], dialog, .terminal')) return;
    if (document.documentElement.classList.contains('menu-ouvert')) return;
    e.preventDefault();
    pas(e.key === 'ArrowRight' ? 1 : -1);
  });

  // ---- Le bouton « précédent » du navigateur ----
  // Le navigateur replace lui-même la page où elle était. On accompagne ce
  // retour comme une arrivée : fondu, glissement, faisceau sur le fil.
  window.addEventListener('popstate', () => {
    const id = window.location.hash.slice(1) || 'accueil';
    const rang = TRAJET.indexOf(id as Section);
    const cible = sections[rang];
    if (!cible || !contenu) return;
    annulerSaut?.();
    annulerSaut = null;
    enCours?.kill();
    enCours = null;
    visee = null;
    const sens = rang < fil.position ? -1 : 1;
    requestAnimationFrame(() => {
      // Si le navigateur n'a pas replacé la page (cela dépend des navigateurs), on y va nous-mêmes.
      if (rangCourant() !== rang) allerA(cible, true, retrait(cible));
      else lenis?.scrollTo(window.scrollY, { immediate: true, force: true });
      ScrollTrigger.update();
      if (estCalme()) return;
      lancerFaisceau(rang);
      glisser(cible, sens);
      enCours = gsap.timeline({
        onComplete: () => {
          gsap.set(contenu, { clearProps: 'opacity' });
          enCours = null;
        },
      });
      enCours.fromTo(contenu, { opacity: 0 }, { opacity: 1, duration: ENTREE, ease: 'power2.out' });
    });
  });

  // ---- Arrivée sur une adresse qui nomme une section (lien venu d'une fiche) ----
  // La galerie allonge la page après son chargement : on recale la position
  // une fois toutes les hauteurs connues.
  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  const ancre = TRAJET.indexOf(window.location.hash.slice(1) as Section);
  if (ancre > 0 && navigation?.type !== 'reload' && navigation?.type !== 'back_forward') {
    const caler = () => {
      ScrollTrigger.removeEventListener('refresh', caler);
      allerA(sections[ancre]!, true, retrait(sections[ancre]!));
    };
    ScrollTrigger.addEventListener('refresh', caler);
  }

  // ---- Le fil reflète la position ----
  const points = rail ? [...rail.querySelectorAll<HTMLElement>('.trajet__point')] : [];
  const contact = sections[TRAJET.length - 1]!;
  const scene = document.querySelector<HTMLElement>('.hero__cadre');
  const voile = document.querySelector<HTMLElement>('.methode');
  const progression = document.querySelector<HTMLElement>('.progression'); // le trait tout en haut de la page
  let rangAffiche = -1;
  let positionAffichee = -1;
  let dernierY = -1;
  let derniereH = -1;
  let ou = { rang: 0, position: 0 };
  // La mise en page a changé (fenêtre, contenu, thème) : les mesures gardées ne valent plus.
  const perimer = () => {
    dernierY = -1;
    version++;
  };
  ScrollTrigger.addEventListener('refresh', perimer);

  gsap.ticker.add(() => {
    // On ne remesure que si la page a bougé.
    if (window.scrollY !== dernierY || window.innerHeight !== derniereH) {
      dernierY = window.scrollY;
      derniereH = window.innerHeight;
      ou = situer();
      if (rail) {
        // Le fil n'a pas de fond : il prend les couleurs de ce qu'il survole
        // (la scène est toujours sombre, le panneau de contact est inversé).
        const ligne = window.innerHeight - 40;
        const surContact = contact.getBoundingClientRect().top < ligne;
        const surScene = !!scene && scene.getBoundingClientRect().bottom > ligne && (!voile || voile.getBoundingClientRect().top > ligne);
        // (Contact n'est plus un panneau clair depuis le 15 octobre 2026 : le fil garde les couleurs du site.)
        rail.classList.toggle('toujours-sombre', surScene && !surContact);
      }
    }
    if (!fil.guide) fil.position = ou.position;

    if (ou.rang !== rangAffiche) {
      // (Pas au tout premier passage : on laisse l'adresse d'arrivée telle quelle.)
      if (rangAffiche !== -1 && !enCours) inscrire(TRAJET[ou.rang], false);
      rangAffiche = ou.rang;
      points.forEach((point, i) => {
        if (i === ou.rang) point.setAttribute('aria-current', 'location');
        else point.removeAttribute('aria-current');
      });
    }
    if (Math.abs(fil.position - positionAffichee) > 0.002) {
      positionAffichee = fil.position;
      // Le fil du bas et le trait du haut disent la même chose : un quart par section.
      const avance = (fil.position / (TRAJET.length - 1)).toFixed(4);
      rail?.style.setProperty('--avance', avance);
      if (progression) progression.style.transform = `scaleX(${avance})`;
      points.forEach((point, i) => point.classList.toggle('est-passe', i <= fil.position + 0.02));
    }
  });
}
