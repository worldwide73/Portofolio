// LA CRÉATION À LA UNE (accueil) : un petit encart qui présente Portal Rush, puis s'en va.
// Une fois l'entrée de page finie, un trait blanc se vide sous l'encart pendant 4 secondes,
// avec un compte à rebours à côté (4s, 3s, 2s, 1s) ; à zéro, l'encart part. Le compte se met
// en pause tant que la souris ou le clavier sont sur l'encart, quand l'onglet est caché et
// pendant une partie. Il ne revient qu'au prochain chargement (le jeu reste dans l'Orbital Hub
// et dans les Réalisations).

const DUREE = 4000;

export function initVitrine(): void {
  const vitrine = document.querySelector<HTMLElement>('[data-vitrine]');
  if (!vitrine) return;
  const compte = vitrine.querySelector<HTMLElement>('[data-vitrine-compte]');
  const html = document.documentElement;
  let ecoule = 0;
  let avant = 0;
  let survol = false;
  let fini = false;

  const enPause = () => survol || document.hidden || !!document.querySelector('.rush[open]');
  const afficher = () => {
    const reste = Math.max(0, 1 - ecoule / DUREE);
    vitrine.style.setProperty('--reste', reste.toFixed(4));
    if (compte) compte.textContent = `${Math.max(1, Math.ceil((DUREE - ecoule) / 1000))}s`;
  };
  const partir = () => {
    fini = true;
    vitrine.classList.add('est-partie');
    // (Si le focus était dans l'encart, on ne le laisse pas sur un élément devenu invisible.)
    if (vitrine.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
  };
  const pas = (maintenant: number) => {
    if (fini) return;
    const dt = Math.min(100, Math.max(0, maintenant - avant));
    avant = maintenant;
    if (!enPause()) ecoule += dt;
    vitrine.classList.toggle('est-en-pause', enPause());
    afficher();
    if (ecoule >= DUREE) partir();
    else requestAnimationFrame(pas);
  };
  const demarrer = () => {
    vitrine.classList.add('est-minutee');
    avant = performance.now();
    afficher();
    requestAnimationFrame(pas);
  };

  vitrine.addEventListener('pointerenter', () => (survol = true));
  vitrine.addEventListener('pointerleave', () => (survol = vitrine.contains(document.activeElement)));
  vitrine.addEventListener('focusin', () => (survol = true));
  vitrine.addEventListener('focusout', (e) => (survol = vitrine.contains(e.relatedTarget as Node) || vitrine.matches(':hover')));

  // Le compte ne part qu'une fois l'entrée de page terminée (et l'encart posé, 0,8 s plus tard).
  const lancer = () => window.setTimeout(demarrer, 800);
  if (!html.classList.contains('intro')) lancer();
  else {
    const guet = new MutationObserver(() => {
      if (html.classList.contains('intro')) return;
      guet.disconnect();
      lancer();
    });
    guet.observe(html, { attributes: true, attributeFilter: ['class'] });
  }
}
