// L'effet « décodage » : un libellé se résout lettre par lettre, de gauche à
// droite, précédé d'une courte bande de caractères aléatoires.
// Tout élément qui porte l'attribut data-decode peut être décodé.

import { mouvementReduit, apresPause } from './outils';

const MINUSCULES = 'abcdefghijklmnopqrstuvwxyz';
const CHIFFRES = '0123456789';
const DUREE = 440;   // millisecondes, quelle que soit la longueur du texte
const BANDE = 3;     // nombre de caractères aléatoires devant le texte résolu

const enCours = new WeakMap<HTMLElement, number>();

function auHasard(modele: string): string {
  if (modele === ' ' || modele === ' ' || modele === ' ') return modele;
  if (CHIFFRES.includes(modele)) return CHIFFRES[(Math.random() * 10) | 0];
  const lettre = MINUSCULES[(Math.random() * 26) | 0];
  return modele === modele.toUpperCase() && modele !== modele.toLowerCase() ? lettre.toUpperCase() : lettre;
}

/** Lance le décodage d'un élément. « texte » remplace le libellé si on le fournit. */
export function decoder(el: HTMLElement | null, texte?: string): void {
  if (!el) return;
  if (texte !== undefined) el.dataset.texte = texte;
  const final = el.dataset.texte ?? el.textContent ?? '';
  el.dataset.texte = final;

  cancelAnimationFrame(enCours.get(el) ?? 0);
  if (mouvementReduit) {
    el.textContent = final;
    return;
  }

  const lettres = [...final];
  const debut = performance.now();
  let dernierTirage = 0;
  let alea: string[] = [];

  const image = (maintenant: number) => {
    const avancee = Math.min(1, (maintenant - debut) / DUREE);
    const front = avancee * lettres.length;
    if (maintenant - dernierTirage > 42) {
      alea = lettres.map(auHasard);
      dernierTirage = maintenant;
    }
    let sortie = '';
    for (let i = 0; i < lettres.length; i++) {
      if (i < front) sortie += lettres[i];
      else if (i < front + BANDE) sortie += alea[i];
      else break;
    }
    el.textContent = sortie;
    if (avancee < 1) enCours.set(el, requestAnimationFrame(image));
    else el.textContent = final;
  };
  enCours.set(el, requestAnimationFrame(image));
}

/** Fige la largeur de chaque libellé pour que le décodage ne déplace rien autour. */
export function reserver(): void {
  const elements = [...document.querySelectorAll<HTMLElement>('[data-decode]')];
  elements.forEach((el) => {
    el.style.minWidth = '';
    el.textContent = el.dataset.texte ?? el.textContent;
  });
  const largeurs = elements.map((el) => el.getBoundingClientRect().width);
  elements.forEach((el, i) => (el.style.minWidth = `${Math.ceil(largeurs[i] * 100) / 100}px`));
}

/** Après un changement de langue : le texte qu'on vient d'écrire devient le texte « final » du libellé. */
export function fixer(el: HTMLElement): void {
  cancelAnimationFrame(enCours.get(el) ?? 0);
  el.dataset.texte = el.textContent ?? '';
}

export function initDecodage(): void {
  document.querySelectorAll<HTMLElement>('[data-decode]').forEach((el) => {
    el.dataset.texte = el.textContent ?? '';
    // Au survol du lien ou du bouton qui contient le libellé, on le rejoue.
    const parent = el.closest('a, button');
    parent?.addEventListener('pointerenter', (e) => {
      if ((e as PointerEvent).pointerType !== 'touch') decoder(el);
    });
  });
  reserver();
  window.addEventListener('resize', apresPause(reserver, 200));
}
