// PORTAL RUSH (Unity) — LE PONT, CÔTÉ NAVIGATEUR (contrat docs/UNITY_ARCHITECTURE.md, §5.3)
//
// Pont.cs appelle ces fonctions dans un build Web. La page du portfolio (src/scripts/rush-unity/pont.ts) pose
// window.__portalRushUnity = { recevoir(json) } avant de créer l'instance ; elle traite chaque message juste après
// cet appel (jamais pendant). Sans le portfolio (build ouvert seul), DansLaPage vaut 0 et Pont simule la page.
mergeInto(LibraryManager.library, {
  // Un message Unity → page (JSON, voir Messages.cs).
  PortalRush_Envoyer: function (ptr) {
    var json = UTF8ToString(ptr);
    try {
      var pont = typeof window !== 'undefined' ? window.__portalRushUnity : null;
      if (pont && typeof pont.recevoir === 'function') pont.recevoir(json);
      else console.info('[Portal Rush · Unity] pas de page pour recevoir :', json.slice(0, 200));
    } catch (e) {
      console.warn('[Portal Rush · Unity] envoi vers la page impossible :', e);
    }
  },

  // 1 si le build est ouvert par le portfolio (le pont de la page existe), 0 sinon.
  PortalRush_DansLaPage: function () {
    try {
      var pont = typeof window !== 'undefined' ? window.__portalRushUnity : null;
      return pont && typeof pont.recevoir === 'function' ? 1 : 0;
    } catch (e) {
      return 0;
    }
  },
});
