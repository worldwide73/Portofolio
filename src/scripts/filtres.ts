// LES FILTRES : des rangées de boutons où un seul est choisi à la fois.
// Il y en a deux sur le site :
//   - dans Compétences, on choisit une réalisation : les compétences qu'elle
//     ne prouve pas s'éteignent. Dans l'autre sens, survoler une compétence
//     cercle les réalisations qui la prouvent ;
//   - dans Veille, on choisit un sujet : les notes des autres sujets sont masquées.
// Le fond plein qui glisse sous le bouton choisi est placé ici, par mesure.

import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { apresPause } from './outils';

/** Rend un groupe cliquable et appelle « surChoix » avec la valeur du bouton choisi. */
function brancher(groupe: HTMLElement, surChoix: (valeur: string) => void): HTMLButtonElement[] {
  const boutons = [...groupe.querySelectorAll<HTMLButtonElement>('button')];
  const fond = groupe.querySelector<HTMLElement>('.filtre__actif');

  /** Glisse le fond plein sous le bouton choisi, et lui donne sa taille. */
  const placer = () => {
    const choisi = boutons.find((b) => b.getAttribute('aria-pressed') === 'true');
    if (!fond || !choisi) return;
    fond.style.transform = `translate(${choisi.offsetLeft}px, ${choisi.offsetTop}px)`;
    fond.style.width = `${choisi.offsetWidth}px`;
    fond.style.height = `${choisi.offsetHeight}px`;
  };

  boutons.forEach((bouton) => {
    bouton.addEventListener('click', () => {
      boutons.forEach((b) => b.setAttribute('aria-pressed', String(b === bouton)));
      placer();
      surChoix(bouton.dataset.valeur ?? '');
    });
  });

  placer();
  window.addEventListener('resize', apresPause(placer, 150));
  document.fonts.ready.then(placer);
  // (Masqué avec sa destination, le groupe n'a aucune taille : le fond est replacé dès qu'il reparaît.)
  new ResizeObserver(placer).observe(groupe);
  return boutons;
}

export function initFiltres(): void {
  // ---- Compétences : lire par réalisation ----
  const parProjet = document.querySelector<HTMLElement>('[data-filtre="competences"]');
  if (parProjet) {
    const savoirs = [...document.querySelectorAll<HTMLElement>('.savoir')];
    const prouvePar = (savoir: HTMLElement) => (savoir.dataset.projets ?? '').split(' ').filter(Boolean);

    const boutons = brancher(parProjet, (slug) => {
      savoirs.forEach((s) => s.classList.toggle('est-eteint', slug !== '' && !prouvePar(s).includes(slug)));
    });

    savoirs.forEach((savoir) => {
      const slugs = prouvePar(savoir);
      const cercler = (oui: boolean) =>
        boutons.forEach((b) => b.classList.toggle('est-prouve', oui && slugs.includes(b.dataset.valeur ?? '')));
      savoir.addEventListener('pointerenter', (e) => e.pointerType !== 'touch' && cercler(true));
      savoir.addEventListener('pointerleave', () => cercler(false));
    });
  }

  // ---- Veille : filtrer par sujet ----
  const parSujet = document.querySelector<HTMLElement>('[data-filtre="veille"]');
  if (parSujet) {
    const notes = [...document.querySelectorAll<HTMLElement>('.note')];
    const vide = document.querySelector<HTMLElement>('.veille__vide');

    brancher(parSujet, (sujet) => {
      let visibles = 0;
      notes.forEach((note) => {
        const garde = sujet === '' || note.dataset.sujet === sujet;
        note.hidden = !garde;
        if (garde) visibles++;
      });
      if (vide) vide.hidden = visibles > 0;
      // Si la note ouverte vient d'être masquée, on ouvre la première qui reste.
      const visiblesListe = notes.filter((n) => !n.hidden);
      if (!visiblesListe.some((n) => n.querySelector('details')?.open)) {
        visiblesListe[0]?.querySelector('details')?.setAttribute('open', '');
      }
      ScrollTrigger.refresh(); // la page a changé de hauteur
    });
  }

  // Ouvrir ou fermer un bloc dépliable change la hauteur de la page : on
  // prévient ScrollTrigger une fois le mouvement terminé.
  const recalculer = apresPause(() => ScrollTrigger.refresh(), 700);
  document.querySelectorAll('details').forEach((bloc) => bloc.addEventListener('toggle', recalculer));
}
