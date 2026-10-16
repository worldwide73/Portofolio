// Section contact : copie de l'adresse en un clic, et numéro de téléphone
// recollé par le navigateur (il n'apparaît pas en clair dans le HTML).

import { decoder } from './decode';

/** Copie un texte dans le presse-papiers. Renvoie false si le navigateur refuse. */
async function copier(texte: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texte);
    return true;
  } catch {
    // Ancienne méthode, pour les navigateurs qui bloquent la première.
    const zone = document.createElement('textarea');
    zone.value = texte;
    zone.setAttribute('readonly', '');
    zone.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    document.body.appendChild(zone);
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
}

export function initContact(): void {
  // L'année du pied de page : celle du jour (la page est construite à l'avance).
  document.querySelectorAll<HTMLElement>('[data-annee]').forEach((el) => (el.textContent = String(new Date().getFullYear())));

  const bouton = document.querySelector<HTMLButtonElement>('[data-copier]');
  if (bouton) {
    const action = bouton.querySelector<HTMLElement>('.contact__action');
    let repos = ''; // le libellé au repos (« Copier »), relu à chaque fois : il peut avoir changé de langue
    let minuterie = 0;

    bouton.addEventListener('click', async () => {
      const ok = await copier(bouton.dataset.copier ?? '');
      if (!ok || !action) return;
      if (!minuterie) repos = action.dataset.texte ?? action.textContent ?? '';
      decoder(action, bouton.dataset.copie);
      window.clearTimeout(minuterie);
      minuterie = window.setTimeout(() => {
        minuterie = 0;
        decoder(action, repos);
      }, 2400);
    });
    // Changement de langue : le libellé vient d'être traduit, on ne le remplace plus par l'ancien.
    window.addEventListener('langue', () => {
      window.clearTimeout(minuterie);
      minuterie = 0;
    });
  }

  // Le numéro est écrit ici, à partir de ses morceaux. Son format dépend de la
  // langue (national en français, international en anglais) : on le réécrit
  // quand la langue change.
  const ecrireTelephones = () => {
    document.querySelectorAll<HTMLAnchorElement>('[data-telephone]').forEach((lien) => {
      const morceaux: string[] = JSON.parse(lien.dataset.telephone ?? '[]');
      const valeur = lien.querySelector('.valeur');
      if (!morceaux.length || !valeur) return;
      valeur.textContent = morceaux.join(' ');
      const brut = morceaux.join('');
      lien.href = `tel:${brut.startsWith('+') ? brut : `+33${brut.slice(1)}`}`;
    });
  };
  ecrireTelephones();
  window.addEventListener('langue', ecrireTelephones);
}
