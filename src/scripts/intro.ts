// L'ENTRÉE DE PAGE. Il y en a deux.
//
// 1. L'INTRODUCTION COMPLÈTE, « initialisation du portail » : jouée à chaque
//    arrivée sur l'accueil, et à chaque actualisation. La partition ci-dessous
//    est accélérée pour retirer exactement 1,7 seconde à sa durée totale,
//    sans supprimer d'effet (demande du 15 octobre, reprise Codex).
//    en quatre temps, sur le vrai décor du site (rien n'est une vidéo) :
//
//   Départ   Temps            Ce qui se passe                                   Durée
//   0 ms     1. Éveil         le paysage sort de l'ombre, l'horizon s'éclaire   2500
//   1080     2. Construction  le portail se dessine : contour, puis verre       2000
//   1170                      le symbole se trace, trait après trait            1600
//   2600     3. Identité      le nom monte et apparaît                          800
//   2970                      le métier                                         800
//   3500                      « portail calibré » se décode                     600
//   4140                      le portail pulse une dernière fois                600
//   4550     4. Entrée        les textes s'effacent                             350
//   4600                      la caméra plonge vers le portail                  520
//   4950                      éclair, onde sur les dunes, tunnel entrouvert     600
//   5100                      la caméra revient, l'accueil apparaît             (voir 2.)
//
//    Seul le bouton « Passer l'intro » l'interrompt : un clic sur la page ou le
//    portail, une touche, la molette n'y font rien (et la page ne défile pas).
//    Son : toujours joué, à 5 %, même si les effets sont coupés (sonIntro).
//    Rien n'est mémorisé : elle se rejoue au prochain chargement.
//
// 2. L'ENTRÉE COURTE : en venant d'une autre page du site (retour d'une fiche,
//    changement de langue), ou sur une fiche. Le décor apparaît, la lame
//    pivote, la barre et les textes se posent : moins de deux secondes.
//
// Si la personne a demandé moins d'animations, il n'y a pas d'entrée du tout.

import gsap from 'gsap';
import { decoder } from './decode';
import { etat, onde } from './gl/champ';
import { mouvementReduit } from './outils';
import { reglages } from './reglages';
import { lenis } from './defilement';
import { couperEffets, preparerSonIntro, sonIntro } from './sons';
import { eclair } from './voyage';

function decoderGroupe(selecteur: string, decalage = 0.06): void {
  document.querySelectorAll<HTMLElement>(selecteur).forEach((el, i) => {
    gsap.delayedCall(i * decalage, () => decoder(el));
  });
}

const depart = (y: number) => ({ autoAlpha: 0, y });
const arrivee = { autoAlpha: 1, y: 0, ease: 'power3.out' };

/** L'apparition de l'interface de l'accueil (barre, titre, accroche, boutons), à partir de l'instant « t ». */
function poserInterface(tl: gsap.core.Timeline, t: number): void {
  tl.fromTo('[data-intro="barre"]', depart(-10), { ...arrivee, duration: 0.55, stagger: 0.06 }, t);
  tl.fromTo('.hero__surtitre', depart(14), { ...arrivee, duration: 0.7 }, t + 0.1);
  tl.fromTo(
    '[data-titre-hero]',
    { yPercent: 115, autoAlpha: 1 },
    { yPercent: 0, autoAlpha: 1, duration: 1, ease: 'expo.out', stagger: 0.1 },
    t + 0.15,
  );
  tl.fromTo('.hero__accroche, .fiche [data-intro="texte"]', depart(14), { ...arrivee, duration: 0.7, stagger: 0.08 }, t + 0.41);
  tl.fromTo('[data-intro="action"]', depart(14), { ...arrivee, duration: 0.7, stagger: 0.07 }, t + 0.55);
  // (clearProps : l'encart partira plus tard par ses classes CSS, que des styles en ligne masqueraient.)
  tl.fromTo('.vitrine-jeu', { autoAlpha: 0, x: 18 }, { autoAlpha: 1, x: 0, duration: 0.8, ease: 'power3.out', clearProps: 'opacity,visibility,transform' }, t + 0.7);
  tl.fromTo('.trajet', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6 }, t + 0.6);
  tl.call(() => decoderGroupe('[data-intro="action"] [data-decode], .barre [data-decode], .fiche__retour [data-decode]'), [], t + 0.65);
}

/** Vient-on d'une autre page du site (lien interne, retour arrière) plutôt que de l'extérieur ou d'une actualisation ? */
function arriveeInterne(): boolean {
  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  if (navigation?.type === 'reload') return false;
  if (navigation?.type === 'back_forward') return true;
  return document.referrer !== '' && new URL(document.referrer).origin === window.location.origin;
}

export function jouerIntro(): void {
  const html = document.documentElement;
  const terminer = () => html.classList.remove('intro');

  if (mouvementReduit || reglages.animations === 0) {
    Object.assign(etat, { reveal: 1, verreIntro: 1, tourIntro: 0 });
    terminer();
    return;
  }

  const ecran = document.querySelector<HTMLElement>('.initialisation');
  const complete = !!ecran && !arriveeInterne() && !window.location.hash && window.scrollY < 10;

  // ---- 2. L'entrée courte ----
  if (!complete) {
    const tl = gsap.timeline({ onComplete: terminer });
    tl.to(etat, { reveal: 1, duration: 1.5, ease: 'power2.out' }, 0);
    tl.to(etat, { verreIntro: 1, duration: 0.9, ease: 'power2.out' }, 0.25);
    tl.to(etat, { tourIntro: 0, duration: 1.7, ease: 'expo.out' }, 0.25);
    poserInterface(tl, 0.35);
    return;
  }

  // ---- 1. L'introduction complète ----
  const textes = ecran.querySelector<HTMLElement>('.initialisation__textes');
  const traits = ecran.querySelectorAll('.initialisation__symbole path');
  const point = ecran.querySelector('.initialisation__symbole circle');
  const etatTexte = ecran.querySelector<HTMLElement>('.initialisation__etat [data-decode]');
  ecran.classList.add('est-active');
  Object.assign(etat, { verreIntro: 1, tourIntro: -0.55, construit: 0 });
  // Pendant l'introduction, la page ne défile pas ; le son de l'intro attend le premier geste si besoin.
  lenis?.stop();
  html.classList.add('intro-longue');
  const oublierSon = preparerSonIntro();

  /** La fin de l'introduction, qu'on y arrive au bout de la séquence ou en la passant. */
  const finir = () => {
    ecran.classList.remove('est-active');
    Object.assign(etat, { construit: 1, zoom: 0, energie: 0, eclat: 0 });
    terminer();
    html.classList.remove('intro-longue');
    lenis?.start();
    oublierSon();
    ecouteurs.abort();
  };
  const tl = gsap.timeline({ onComplete: finir });

  // 1. Éveil
  tl.to(etat, { reveal: 1, duration: 2.5, ease: 'power2.out' }, 0);
  tl.fromTo('.initialisation__passer', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5 }, 0.3);

  // 2. Construction du portail
  tl.to(etat, { construit: 1, duration: 2, ease: 'power2.inOut' }, 1.08);
  tl.call(() => sonIntro('eveil'), [], 1.0);
  tl.to(etat, { tourIntro: 0, duration: 3, ease: 'expo.out' }, 1.08);
  tl.to(traits, { strokeDashoffset: 0, duration: 1.6, ease: 'power2.inOut', stagger: 0.2 }, 1.17);
  tl.to(point, { opacity: 1, duration: 0.4 }, 2.52);
  tl.to(etat, { energie: 0.45, duration: 1, ease: 'power2.out' }, 2.16);

  // 3. Identité
  tl.fromTo('.initialisation__nom', depart(14), { ...arrivee, duration: 0.8 }, 2.6);
  tl.fromTo('.initialisation__metier', depart(12), { ...arrivee, duration: 0.8 }, 2.97);
  tl.fromTo('.initialisation__etat', depart(10), { ...arrivee, duration: 0.6 }, 3.5);
  tl.call(() => decoder(etatTexte), [], 3.5);
  tl.to(etat, { energie: 0.95, duration: 0.3, ease: 'power2.out', yoyo: true, repeat: 1 }, 4.14);
  // Le symbole a fait son office : il s'efface avant la plongée, et laisse le portail vide.
  tl.to('.initialisation__symbole', { autoAlpha: 0, scale: 1.25, duration: 0.45, ease: 'power2.in' }, 4.2);

  // 4. Entrée : on plonge, le passage s'entrouvre, l'accueil apparaît.
  tl.to(textes, { autoAlpha: 0, y: -12, duration: 0.35, ease: 'power2.in' }, 4.55);
  tl.to('.initialisation__passer', { autoAlpha: 0, duration: 0.3 }, 4.55);
  tl.to(etat, { zoom: 0.6, energie: 1, duration: 0.52, ease: 'power2.in' }, 4.6);
  tl.call(() => sonIntro('entree'), [], 4.6);
  tl.call(
    () => {
      onde();
      eclair(0.7);
    },
    [],
    4.95,
  );
  // (immediateRender: false : sans cela, GSAP poserait l'éclair dès la création de la séquence.)
  tl.fromTo(etat, { eclat: 0.85 }, { eclat: 0, duration: 0.6, ease: 'power2.out', immediateRender: false }, 4.95);
  tl.to(etat, { zoom: 0, energie: 0, duration: 0.8, ease: 'expo.out' }, 5.1);
  poserInterface(tl, 5.05);
  tl.timeScale(tl.duration() / (tl.duration() - 1.7));

  // ---- Passer l'intro : seulement avec son bouton ----
  // Le bouton envoie la séquence directement à sa fin : tout prend sa place
  // finale. Le « true » demande à GSAP de ne déclencher aucun des évènements
  // sautés (ni éclair, ni onde, ni son) ; on coupe aussi le son déjà lancé.
  const ecouteurs = new AbortController();
  const passer = () => {
    if (tl.progress() >= 1) return;
    tl.progress(1, true);
    couperEffets();
    finir();
  };
  ecran.querySelector('.initialisation__passer')?.addEventListener('click', passer, { signal: ecouteurs.signal });
}
