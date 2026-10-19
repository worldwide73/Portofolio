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
 * Le préchargement discret : rien au chargement du portfolio ; à l'ouverture de l'Orbital Hub, ou à l'approche d'un
 * bouton qui lance le jeu, le code de la version Unity et les fichiers du build sont demandés en faible priorité.
 */
export function approcheRushUnity(): void {
  if (!rushUnityDemandee()) return;
  let fait = false;
  const approcher = () => {
    if (fait) return;
    fait = true;
    void import('./index').then((m) => m.prechargerRushUnity()).catch(() => undefined);
  };
  document.querySelector('#hub')?.addEventListener('toggle', (e) => (e as ToggleEvent).newState === 'open' && approcher());
  const pres = (e: Event) => (e.target as Element | null)?.closest?.('[data-onglet="rush"], [data-jouer-rush]') && approcher();
  document.addEventListener('pointerover', pres, { passive: true });
  document.addEventListener('focusin', pres);
}
