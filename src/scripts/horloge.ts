// L'heure de Lyon, mise à jour chaque seconde, quel que soit le fuseau du visiteur.

export function initHorloge(): void {
  const el = document.querySelector<HTMLElement>('[data-horloge]');
  if (!el) return;

  const format = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const afficher = () => {
    const [heures, minutes, secondes] = format.format(new Date()).split(':');
    el.innerHTML = `${heures}:${minutes}<span class="secondes">:${secondes}</span>`;
    el.setAttribute('datetime', `${heures}:${minutes}`);
  };

  afficher();
  window.setInterval(afficher, 1000);
}
