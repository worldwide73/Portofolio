// Exécuté avant le premier affichage de chaque page (appelé dans le <head>).
// Prépare l'entrée de page. Si le JavaScript principal ne démarre pas,
//      la classe « intro » tombe toute seule au bout de 7 secondes et le
//      contenu reste lisible.
// Sur l'accueil, il choisit aussi la destination affichée (16 octobre 2026) : celle que
// nomme l'adresse (#competences…), sinon l'accueil. Le CSS (destinations.css) masque les
// autres avant même le premier affichage ; sans JavaScript, tout reste visible.
(function () {
  var h = document.documentElement;
  h.classList.add('js');
  var surAccueil = /^\/(en\/?)?$/.test(location.pathname);
  // Un refresh de l'accueil recommence l'expérience ; les liens profonds et
  // Précédent/Suivant gardent leur navigation normale.
  var navigation = performance.getEntriesByType('navigation')[0];
  if (navigation && navigation.type === 'reload' && surAccueil) {
    history.scrollRestoration = 'manual';
    history.replaceState(null, '', location.pathname + location.search);
    var debut = function () { window.scrollTo({ top: 0, behavior: 'instant' }); };
    debut();
    document.addEventListener('DOMContentLoaded', debut, { once: true });
    window.addEventListener('load', debut, { once: true });
  }
  // La densité choisie dans les réglages (16 octobre 2026), posée avant le premier affichage pour
  // éviter un saut de mise en page ; reglages.ts la tient ensuite. L'affichage d'origine n'écrit rien.
  try {
    var densite = JSON.parse(localStorage.getItem('reglages-5') || '{}').densite;
    if (densite === 'compact' || densite === 'cinematique') h.setAttribute('data-densite', densite);
  } catch (e) {
    // stockage indisponible : l'affichage d'origine
  }
  if (surAccueil) {
    var id = location.hash.slice(1);
    h.setAttribute('data-lieu', ['competences', 'realisations', 'veille', 'contact'].indexOf(id) >= 0 ? id : 'accueil');
  }
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    h.classList.add('intro');
    setTimeout(function () {
      h.classList.remove('intro');
    }, 7000);
  }
})();
