// LE PANNEAU D'ACTIONS RAPIDES : il s'ouvre sous le bloc d'identité, en haut à gauche (le chevron).
// Il ne répète pas les catégories du site (la navigation et la carte du portail s'en chargent) :
// LinkedIn, GitHub, le CV, partager le portfolio, le contact rapide, les raccourcis clavier.
// L'ouverture, la touche Échap, le clic à côté et le retour du focus sont gérés par le navigateur
// (attribut « popover »). Ici on ne fait que :
//   - refermer le panneau après une action qui mène ailleurs (lien, CV, e-mail) ;
//   - copier l'adresse du site ou l'e-mail, avec une confirmation, et un secours si le
//     presse-papiers est indisponible (le texte s'affiche, sélectionné, pour une copie à la main) ;
//   - ouvrir la fenêtre des commandes clavier (aussi avec la touche « ? »), d'où l'on peut revoir
//     le mini-guidage de la première visite.

import { revoirGuidage } from './guidage';

/** Copie un texte. Renvoie false si ni le presse-papiers ni l'ancienne commande « copier » ne marchent. */
async function copier(texte: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(texte);
      return true;
    }
  } catch {
    // refusé : on tente l'ancienne méthode
  }
  const zone = document.createElement('textarea');
  zone.value = texte;
  zone.setAttribute('readonly', '');
  zone.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
  document.body.append(zone);
  zone.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  zone.remove();
  return ok;
}

export function initAcces(): void {
  const menu = document.querySelector<HTMLElement>('.acces');
  const commande = document.querySelector<HTMLButtonElement>('.identite__commande');
  const fenetre = document.querySelector<HTMLDialogElement>('.raccourcis');
  if (!menu || !commande) return;
  const secours = menu.querySelector<HTMLElement>('.acces__secours');
  const champ = secours?.querySelector('input');
  const annonce = menu.querySelector<HTMLElement>('.acces__annonce');
  let fermeture = 0;

  menu.addEventListener('toggle', (e) => {
    const ouvert = (e as ToggleEvent).newState === 'open';
    commande.setAttribute('aria-expanded', String(ouvert));
    if (!ouvert) {
      // À la prochaine ouverture, tout est comme neuf.
      window.clearTimeout(fermeture);
      if (secours) secours.hidden = true;
      menu.querySelectorAll('.est-fait').forEach((b) => b.classList.remove('est-fait'));
    }
  });

  /** Une copie réussie : la ligne le dit, puis le panneau se referme. Ratée : le texte s'affiche, sélectionné. */
  const confirmer = async (bouton: HTMLElement, texte: string) => {
    if (await copier(texte)) {
      bouton.classList.add('est-fait');
      const message = bouton.dataset.fait ?? '';
      if (annonce) annonce.textContent = message;
      // La ligne dit « Lien copié » (ou « E-mail copié ») un instant.
      const libelle = bouton.classList.contains('acces__mini') ? bouton : bouton.querySelector('.acces__texte');
      if (libelle && message) {
        const avant = libelle.textContent;
        libelle.textContent = message;
        window.setTimeout(() => (libelle.textContent = avant), 1300);
      }
      bouton.querySelector('.acces__suite')?.replaceChildren(document.createTextNode('✓'));
      window.clearTimeout(fermeture);
      fermeture = window.setTimeout(() => menu.hidePopover(), 1100);
    } else if (secours && champ) {
      champ.value = texte;
      secours.hidden = false;
      champ.focus();
      champ.select();
    }
  };

  const ouvrirRaccourcis = () => {
    if (!fenetre || fenetre.open) return;
    if (menu.matches(':popover-open')) menu.hidePopover();
    fenetre.showModal();
  };

  menu.addEventListener('click', (e) => {
    const cible = (e.target as Element).closest<HTMLElement>('a, button');
    if (!cible) return;
    const action = cible.dataset.action;
    // Partager : l'adresse publique du portfolio, à l'endroit où l'on se trouve (page et destination).
    if (action === 'partager') void confirmer(cible, new URL(window.location.pathname + window.location.hash, menu.dataset.adresse ?? window.location.origin).href);
    else if (action === 'email') void confirmer(cible, cible.dataset.email ?? '');
    else if (action === 'raccourcis') ouvrirRaccourcis();
    // Un lien (LinkedIn, GitHub, CV, e-mail) : le panneau se referme.
    else if (cible.tagName === 'A') window.setTimeout(() => menu.hidePopover(), 0);
  });

  if (!fenetre) return;
  fenetre.querySelector('[data-fermer-raccourcis]')?.addEventListener('click', () => fenetre.close());
  // Un clic sur le fond (hors de la fenêtre) la referme aussi ; Échap est géré par le navigateur.
  fenetre.addEventListener('click', (e) => {
    if (e.target === fenetre) fenetre.close();
  });
  // « Revoir les indications de navigation » : l'aide se ferme, le mini-guidage reparaît (guidage.ts).
  let guider = false;
  fenetre.querySelector('[data-revoir-guidage]')?.addEventListener('click', () => {
    guider = true;
    fenetre.close();
  });
  fenetre.addEventListener('close', () => {
    commande.focus({ preventScroll: true });
    if (guider) revoirGuidage();
    guider = false;
  });
  // « ? » ouvre les raccourcis, sauf pendant une saisie ou quand une autre fenêtre est ouverte.
  window.addEventListener('keydown', (e) => {
    if (e.key !== '?' || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable]')) return;
    if (document.querySelector('dialog[open]') || document.documentElement.classList.contains('intro')) return;
    e.preventDefault();
    ouvrirRaccourcis();
  });
}
