// LA VISITE RAPIDE (16 octobre 2026) : le troisième outil de la barre.
// Une fenêtre lisible, sans animation secondaire, qui résume le portfolio pour un recruteur :
// profil, réalisations, compétences, parcours, CV et contact (voir VisiteRapide.astro).
// On la quitte par son bouton, par Échap, par un clic à côté, ou en recliquant sur l'outil :
// on retrouve alors le mode immersif exactement où on l'avait laissé.
// Pendant qu'elle est ouverte, la scène de l'accueil (masquée derrière) cesse d'être dessinée.

let basculer: ((depuis?: HTMLElement | null) => void) | null = null;
/** Ouvre la visite rapide, ou la referme si elle est ouverte. */
export function basculerRapide(depuis?: HTMLElement | null): void {
  basculer?.(depuis);
}

export function initRapide(): void {
  const fenetre = document.querySelector<HTMLDialogElement>('.rapide');
  if (!fenetre) return;
  const cadre = fenetre.querySelector<HTMLElement>('.rapide__cadre');
  let retour: HTMLElement | null = null;

  basculer = (depuis) => {
    if (fenetre.open) return void fenetre.close();
    if (document.querySelector('dialog[open]')) return; // une autre fenêtre est ouverte (carte, jeu…)
    retour = depuis ?? (document.activeElement as HTMLElement | null);
    document.querySelectorAll<HTMLElement>('#acces:popover-open, #reglages:popover-open, #hub:popover-open').forEach((p) => p.hidePopover());
    fenetre.showModal();
    if (cadre) cadre.scrollTop = 0;
    // Le focus va sur le titre du profil : un lecteur d'écran annonce où l'on est, Tab continue dans la fenêtre.
    const titre = fenetre.querySelector<HTMLElement>('#rapide-titre');
    titre?.setAttribute('tabindex', '-1');
    titre?.focus({ preventScroll: true });
    document.documentElement.classList.add('visite-rapide');
    window.dispatchEvent(new Event('outil'));
  };

  fenetre.querySelector('[data-rapide-fermer]')?.addEventListener('click', () => fenetre.close());
  fenetre.addEventListener('click', (e) => {
    if (e.target === fenetre) fenetre.close();
  });
  fenetre.addEventListener('close', () => {
    document.documentElement.classList.remove('visite-rapide');
    window.dispatchEvent(new Event('outil'));
    if (retour?.isConnected && !document.querySelector('dialog[open]')) retour.focus({ preventScroll: true });
    retour = null;
  });
}
