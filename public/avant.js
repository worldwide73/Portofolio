// Exécuté avant le premier affichage de chaque page (appelé dans le <head>).
// Prépare l'entrée de page. Si le JavaScript principal ne démarre pas,
//      la classe « intro » tombe toute seule au bout de 7 secondes et le
//      contenu reste lisible.
(function () {
  var h = document.documentElement;
  h.classList.add('js');
  // Un refresh de l'accueil recommence l'expérience ; les liens profonds et
  // Précédent/Suivant gardent leur navigation normale.
  var navigation = performance.getEntriesByType('navigation')[0];
  if (navigation && navigation.type === 'reload' && /^\/(en\/?)?$/.test(location.pathname)) {
    history.scrollRestoration = 'manual';
    history.replaceState(null, '', location.pathname + location.search);
    var debut = function () { window.scrollTo({ top: 0, behavior: 'instant' }); };
    debut();
    document.addEventListener('DOMContentLoaded', debut, { once: true });
    window.addEventListener('load', debut, { once: true });
  }
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    h.classList.add('intro');
    setTimeout(function () {
      h.classList.remove('intro');
    }, 7000);
  }
})();
