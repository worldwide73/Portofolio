// LES RÉGLAGES DU VISITEUR : un seul endroit qui les garde et les mémorise.
// Les autres modules lisent « reglages », appellent « regler » pour changer
// une valeur, et « surReglage » pour être prévenus quand elle change.
// Tout est mémorisé dans le navigateur (localStorage).
//
// Les effets sonores sont actifs d'office, à faible volume (8 %). Le visiteur peut les couper ou les
// régler dans le panneau ; son choix est gardé d'une visite à l'autre. La musique n'est plus un réglage
// du panneau (16 octobre 2026) : elle vit dans DREAM RADIO, coupée à l'ouverture du site, et ne démarre
// jamais seule (audio/dream.ts). Les anciennes ambiances (Chill, Deep Space, Focus, Silence) ont été
// retirées : les valeurs mémorisées par une ancienne version sont simplement ignorées, sans rien
// réinitialiser d'autre.

/**
 * La densité de l'interface (16 octobre 2026). « equilibre » est le site tel qu'il a été dessiné et
 * validé : c'est la valeur d'origine, qui ne change rien. « compact » resserre le contenu éditorial,
 * « cinematique » lui donne plus d'air et des titres plus grands (voir densites.css). La scène, le
 * portail, sa carte, la galerie 3D et Portal Rush n'en dépendent pas.
 */
export type Densite = 'compact' | 'equilibre' | 'cinematique';
export const DENSITES: readonly Densite[] = ['compact', 'equilibre', 'cinematique'];

export interface Reglages {
  /** Opacité des panneaux en verre, de 0.2 à 0.9. */
  opacite: number;
  /** Flou de ce qu'on voit à travers les panneaux, de 0 à 1. */
  flou: number;
  /** Intensité des halos et contours lumineux, de 0 à 1. */
  lueur: number;
  /** Intensité des animations : 1 = complètes, 0.5 = allégées, 0 = coupées. */
  animations: number;
  /** Effets sonores (portail, changements de section, Portal Rush), et leur volume de 0 à 1. */
  sons: boolean;
  volumeSons: number;
  /** Le son de l'introduction joue-t-il à l'ouverture du site ? (La musique, elle, ne démarre jamais seule.) */
  sonAuLancement: boolean;
  /** La densité de l'interface ; « equilibre » est l'affichage d'origine. */
  densite: Densite;
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
  sonAuLancement: true,
  densite: 'equilibre',
};

/**
 * Les réglages de l'affichage d'origine, ceux que rétablit « Restaurer l'affichage d'origine » : la page
 * Affichage du panneau. Les sons, la musique (DREAM RADIO), Portal Rush (ses records, ses réglages à lui)
 * et la mémoire des destinations visitées ne sont pas concernés.
 */
const AFFICHAGE: (keyof Reglages)[] = ['densite', 'opacite', 'flou', 'lueur', 'animations'];

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
        } else if (cle === 'densite' && typeof valeur === 'string') {
          (lus as unknown as Record<string,unknown>)[cle] = valeur;
        }
      }
    }
    // Une valeur inconnue (réglage d'une ancienne version du site) : on revient à celle d'origine.
    if (!DENSITES.includes(lus.densite)) lus.densite = DEFAUT.densite;
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

function memoriser(): void {
  try {
    localStorage.setItem(CLE, JSON.stringify(reglages));
  } catch {
    // stockage indisponible : le réglage vaudra pour cette page seulement
  }
}

export function regler<C extends keyof Reglages>(cle: C, valeur: Reglages[C]): void {
  if (reglages[cle] === valeur) return;
  reglages[cle] = valeur;
  memoriser();
  appliquer();
  ecouteurs.forEach((fn) => fn(cle, valeur));
}

/** L'affichage est-il celui d'origine ? */
export const affichageDOrigine = () => AFFICHAGE.every((cle) => reglages[cle] === DEFAUT[cle]);

/**
 * Rétablit l'affichage d'origine (densité, opacité, flou, lueur, animations), d'un coup, et prévient les
 * modules de chaque valeur changée. Renvoie le nombre de réglages qui ont changé.
 */
export function restaurerAffichage(): number {
  const changes = AFFICHAGE.filter((cle) => reglages[cle] !== DEFAUT[cle]);
  if (!changes.length) return 0;
  changes.forEach((cle) => ((reglages as unknown as Record<string, unknown>)[cle] = DEFAUT[cle]));
  memoriser();
  appliquer();
  changes.forEach((cle) => ecouteurs.forEach((fn) => fn(cle, reglages[cle])));
  return changes.length;
}

/** Reporte les réglages sur la page : variables CSS et attributs lus par les feuilles de style. */
export function appliquer(): void {
  const html = document.documentElement;
  html.style.setProperty('--opacite', reglages.opacite.toFixed(2));
  html.style.setProperty('--lueur', reglages.lueur.toFixed(2));
  html.style.setProperty('--flou', reglages.flou.toFixed(2));
  html.classList.toggle('animations-coupees', reglages.animations === 0);
  // (L'affichage d'origine n'écrit rien : sans attribut, aucune règle de densites.css ne s'applique.)
  if (reglages.densite === 'equilibre') delete html.dataset.densite;
  else html.dataset.densite = reglages.densite;
}
