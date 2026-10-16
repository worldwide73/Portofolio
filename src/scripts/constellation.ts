// LA CONSTELLATION : ouvrir la fenêtre, choisir une étoile.
// Le dessin et les fiches sont déjà dans la page (src/components/Constellation.astro).
// Ici on ne fait que montrer la fiche de l'étoile choisie et allumer les
// traits qui la relient à ses domaines de compétences.

export function initConstellation(): void {
  const fenetre = document.querySelector<HTMLDialogElement>('.constellation');
  const ouvrir = document.querySelector<HTMLButtonElement>('[data-constellation]');
  if (!fenetre || !ouvrir) return;

  const etoiles = [...fenetre.querySelectorAll<HTMLButtonElement>('.constellation__etoile')];
  const fiches = [...fenetre.querySelectorAll<HTMLElement>('[data-fiche]')];
  const traits = [...fenetre.querySelectorAll<SVGLineElement>('line')];
  const domaines = [...fenetre.querySelectorAll<HTMLElement>('.constellation__domaine')];
  let choisie = etoiles[0]?.dataset.projet ?? '';
  let filtre = '';
  const filtrer = (id: string) => {
    filtre = id;
    fenetre.querySelectorAll<HTMLElement>('[data-filtre]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.filtre === id)));
    const visibles = new Set(id ? traits.filter(t => t.dataset.domaine === id).map(t => t.dataset.projet) : etoiles.map(e => e.dataset.projet));
    etoiles.forEach(e => { e.disabled = !visibles.has(e.dataset.projet); });
    traits.forEach(t => t.classList.toggle('est-filtre', !!id && t.dataset.domaine !== id));
    if (!visibles.has(choisie)) choisir(etoiles.find(e => !e.disabled)?.dataset.projet ?? '');
  };

  const choisir = (slug: string) => {
    choisie = slug;
    etoiles.forEach((etoile) => etoile.setAttribute('aria-pressed', String(etoile.dataset.projet === slug)));
    fiches.forEach((fiche) => (fiche.hidden = fiche.dataset.fiche !== slug));
    const relies = new Set<string>();
    traits.forEach((trait) => {
      const oui = trait.dataset.projet === slug;
      trait.classList.toggle('est-relie', oui);
      if (oui) relies.add(trait.dataset.domaine ?? '');
    });
    domaines.forEach((domaine) => domaine.classList.toggle('est-relie', relies.has(domaine.dataset.domaine ?? '')));
  };

  etoiles.forEach((etoile) => etoile.addEventListener('click', () => choisir(etoile.dataset.projet ?? '')));
  fenetre.addEventListener('click', (e) => {
    const cible = (e.target as Element).closest<HTMLElement>('[data-filtre], [data-lie]');
    if (!cible) return;
    if (cible.dataset.filtre !== undefined) filtrer(cible.dataset.filtre === filtre ? '' : cible.dataset.filtre);
    if (cible.dataset.lie) { filtrer(''); choisir(cible.dataset.lie); }
  });
  ouvrir.addEventListener('click', () => {
    fenetre.showModal();
    choisir(choisie);
  });
  fenetre.querySelector('.constellation__fermer')?.addEventListener('click', () => fenetre.close());
  fenetre.addEventListener('close', () => ouvrir.focus({ preventScroll: true }));
}
