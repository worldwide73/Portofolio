// PORTAL RUSH — LE DRAPEAU DE LA VERSION UNITY (18 octobre 2026)
//
// Tant que la version Unity n'est pas validée, l'ancien jeu reste celui de tout le monde. On essaie la version
// Unity avec « ?rush=unity » dans l'adresse (retenu pour l'onglet : le changement de langue réécrit l'adresse),
// ou avec la clé de développement localStorage « portal-rush-moteur » = « unity ». « ?rush=web » revient à l'ancien
// jeu pour l'onglet. Sans drapeau, ce fichier est le seul de la version Unity à être chargé, et il ne fait rien.

const CLE = 'portal-rush-moteur';
let demande: boolean | null = null;

function lire(): boolean {
  try {
    const choix = new URLSearchParams(window.location.search).get('rush');
    if (choix === 'unity' || choix === 'web') sessionStorage.setItem(CLE, choix);
    const onglet = sessionStorage.getItem(CLE);
    if (onglet) return onglet === 'unity';
    return localStorage.getItem(CLE) === 'unity';
  } catch {
    return new URLSearchParams(window.location.search).get('rush') === 'unity';
  }
}

/** La version Unity est-elle demandée ? (Lu une fois par page.) */
export const rushUnityDemandee = (): boolean => (demande ??= lire());

/**
 * Le préchargement discret : rien au chargement du portfolio ; à l'ouverture de l'Orbital Hub, le code de la version
 * Unity et les petits fichiers du build ; à l'approche d'un bouton qui lance le jeu, le reste (données, WebAssembly),
 * en faible priorité et jamais en économie de données (chargeur.ts).
 */
export function approcheRushUnity(): void {
  if (!rushUnityDemandee()) return;
  let fait: 'rien' | 'leger' | 'complet' = 'rien';
  const approcher = (niveau: 'leger' | 'complet') => {
    if (fait === 'complet' || fait === niveau) return;
    fait = niveau;
    void import('./index').then((m) => m.prechargerRushUnity(niveau)).catch(() => undefined);
  };
  document.querySelector('#hub')?.addEventListener('toggle', (e) => (e as ToggleEvent).newState === 'open' && approcher('leger'));
  const pres = (e: Event) => (e.target as Element | null)?.closest?.('[data-onglet="rush"], [data-jouer-rush]') && approcher('complet');
  document.addEventListener('pointerover', pres, { passive: true });
  document.addEventListener('focusin', pres);
}
