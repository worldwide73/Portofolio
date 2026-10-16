// LES RÉGLAGES DU VISITEUR : un seul endroit qui les garde et les mémorise.
// Les autres modules lisent « reglages », appellent « regler » pour changer
// une valeur, et « surReglage » pour être prévenus quand elle change.
// Tout est mémorisé dans le navigateur (localStorage).
//
// Le son est actif d'office, à faible volume : effets à 8 %, musique à 2 %. Le visiteur peut
// tout couper ou tout régler dans le panneau ; son choix est gardé d'une visite
// à l'autre. (Un navigateur ne laisse de toute façon rien jouer avant le
// premier clic ou la première touche sur la page : voir sons.ts.)

import { AMBIANCES, type Ambiance, type Piste } from './ambiances';

export interface Reglages {
  /** Opacité des panneaux en verre, de 0.2 à 0.9. */
  opacite: number;
  /** Flou de ce qu'on voit à travers les panneaux, de 0 à 1. */
  flou: number;
  /** Intensité des halos et contours lumineux, de 0 à 1. */
  lueur: number;
  /** Intensité des animations : 1 = complètes, 0.5 = allégées, 0 = coupées. */
  animations: number;
  /** Effets sonores (portail, changements de section), et leur volume de 0 à 1. */
  sons: boolean;
  volumeSons: number;
  /** Musique d'ambiance, et son volume de 0 à 1. */
  musique: boolean;
  volumeMusique: number;
  /** L'ambiance choisie (vide : le site d'origine). Voir ambiances.ts. */
  atmosphere: Ambiance;
  /** La piste de musique choisie. */
  piste: Piste;
  /** Le son démarre-t-il seul à l'ouverture du site (musique, son de l'introduction) ? */
  sonAuLancement: boolean;
}

// (« -5 » : les réglages des versions d'avant, aux valeurs d'origine différentes, ne sont pas repris.
// 15 octobre 2026 : le site de base a des panneaux à 25 % d'opacité et 5 % de flou, à la demande de Mathéo.)
const CLE = 'reglages-5';
const DEFAUT: Reglages = {
  opacite: 0.25,
  flou: 0.05,
  lueur: 0.7,
  animations: 1,
  sons: true,
  volumeSons: 0.08,
  musique: true,
  volumeMusique: 0.02,
  atmosphere: '',
  piste: 'derive',
  sonAuLancement: true,
};

function lire(): Reglages {
  try {
    const brut = JSON.parse(localStorage.getItem(CLE) ?? '{}');
    const lus = { ...DEFAUT };
    if (brut && typeof brut === 'object' && !Array.isArray(brut)) {
      for (const cle of Object.keys(DEFAUT) as (keyof Reglages)[]) {
        const valeur = brut[cle];
        if (typeof DEFAUT[cle] === 'number' && typeof valeur === 'number' && Number.isFinite(valeur)) {
          (lus as unknown as Record<string,unknown>)[cle] = Math.max(cle === 'opacite' ? .2 : 0, Math.min(cle === 'opacite' ? .9 : 1, valeur));
        } else if (typeof DEFAUT[cle] === 'boolean' && typeof valeur === 'boolean') {
          (lus as unknown as Record<string,unknown>)[cle] = valeur;
        } else if ((cle === 'piste' || cle === 'atmosphere') && typeof valeur === 'string') {
          (lus as unknown as Record<string,unknown>)[cle] = valeur;
        }
      }
    }
    // Une valeur inconnue (réglage d'une ancienne version du site) : on revient à celle d'origine.
    if (!Object.hasOwn(AMBIANCES, lus.atmosphere)) lus.atmosphere = DEFAUT.atmosphere;
    if (!['derive', 'heure-bleue', 'trait'].includes(lus.piste)) lus.piste = DEFAUT.piste;
    // Le visiteur a demandé que le site s'ouvre en silence : la musique attend qu'il appuie sur « Lire ».
    if (!lus.sonAuLancement) lus.musique = false;
    return lus;
  } catch {
    return { ...DEFAUT };
  }
}

export const reglages: Reglages = lire();

type Ecouteur = <C extends keyof Reglages>(cle: C, valeur: Reglages[C]) => void;
const ecouteurs: Ecouteur[] = [];

export function surReglage(fn: Ecouteur): void {
  ecouteurs.push(fn);
}

export function regler<C extends keyof Reglages>(cle: C, valeur: Reglages[C]): void {
  if (reglages[cle] === valeur) return;
  reglages[cle] = valeur;
  try {
    localStorage.setItem(CLE, JSON.stringify(reglages));
  } catch {
    // stockage indisponible : le réglage vaudra pour cette page seulement
  }
  appliquer();
  ecouteurs.forEach((fn) => fn(cle, valeur));
}

/** Reporte les réglages sur la page : variables CSS et attributs lus par les feuilles de style. */
export function appliquer(): void {
  const html = document.documentElement;
  html.style.setProperty('--opacite', reglages.opacite.toFixed(2));
  // L'ambiance module la lueur choisie par le visiteur (plus douce en Chill, plus vive en Deep Space).
  html.style.setProperty('--lueur', Math.min(1, reglages.lueur * AMBIANCES[reglages.atmosphere].lueur).toFixed(2));
  html.style.setProperty('--flou', reglages.flou.toFixed(2));
  html.classList.toggle('animations-coupees', reglages.animations === 0);
  if (reglages.atmosphere) html.dataset.atmosphere = reglages.atmosphere;
  else delete html.dataset.atmosphere;
}
