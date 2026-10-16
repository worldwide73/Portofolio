// LE COMPTEUR QUI ROULE
// Chaque chiffre vit dans une petite colonne qui masque ce qui en dépasse.
// Quand il change, l'ancien sort par le haut et le nouveau entre par le bas
// (l'inverse si on recule), comme les rouleaux d'un compteur kilométrique.
// Seuls les chiffres qui changent bougent : de 01 à 02, le 0 reste immobile.
// La mise en page des colonnes est dans galerie.css (.rouleau).

import gsap from 'gsap';
import { mouvementReduit } from './outils';

/**
 * Transforme un élément qui contient un nombre en compteur à rouleaux.
 * Renvoie la fonction à appeler pour afficher une nouvelle valeur ;
 * « sens » vaut 1 quand on avance, -1 quand on recule.
 */
export function creerCompteur(el: HTMLElement): (valeur: string, sens?: number) => void {
  let affichee = el.textContent ?? '';

  const colonnes = [...affichee].map((caractere) => {
    const colonne = document.createElement('span');
    colonne.className = 'rouleau';
    const chiffre = document.createElement('span');
    chiffre.textContent = caractere;
    colonne.append(chiffre);
    return colonne;
  });
  el.replaceChildren(...colonnes);

  return (valeur, sens = 1) => {
    if (valeur === affichee) return;

    [...valeur].forEach((caractere, i) => {
      const colonne = colonnes[i];
      if (!colonne || caractere === affichee[i]) return;

      const sortants = [...colonne.children] as HTMLElement[];
      const entrant = document.createElement('span');
      entrant.textContent = caractere;
      colonne.append(entrant);

      // Si l'on défile vite, un chiffre peut encore être en train de sortir :
      // on ne garde que le dernier arrivé, qui repart de là où il se trouve.
      const dernier = sortants.pop();
      sortants.forEach((s) => {
        gsap.killTweensOf(s);
        s.remove();
      });
      if (!dernier) return;
      gsap.killTweensOf(dernier);

      if (mouvementReduit) {
        dernier.remove();
        return;
      }
      const geste = { duration: 0.6, ease: 'expo.out' };
      gsap.to(dernier, { yPercent: -110 * sens, ...geste, onComplete: () => dernier.remove() });
      gsap.fromTo(entrant, { yPercent: 110 * sens }, { yPercent: 0, ...geste });
    });

    affichee = valeur;
  };
}
