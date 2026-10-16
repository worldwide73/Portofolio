// Petites fonctions utilisées partout.

/** Vrai si la personne a demandé moins d'animations dans son système. */
export const mouvementReduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Vrai si l'appareil a une vraie souris (pas un écran tactile). */
export const aUneSouris = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/** Garde une valeur entre un minimum et un maximum. */
export function borner(valeur: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, valeur));
}

/**
 * Interpolation linéaire : la valeur située à « t » du chemin entre a et b.
 * t = 0 donne a, t = 1 donne b, t = 0.5 donne le milieu.
 * Appelée à chaque image avec un petit t, elle rapproche doucement a de b :
 * c'est ce qui donne de l'inertie au curseur, à la galerie et à la lame.
 */
export function interpoler(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Appelle « fn » une seule fois, quand les appels ont cessé depuis « delai » ms. */
export function apresPause<T extends unknown[]>(fn: (...args: T) => void, delai = 150) {
  let minuterie = 0;
  return (...args: T) => {
    window.clearTimeout(minuterie);
    minuterie = window.setTimeout(() => fn(...args), delai);
  };
}
