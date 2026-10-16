// LA BARRE DU HAUT : le centre de commandes (16 octobre 2026).
// La même pastille de verre qu'avant, mais elle ne répète plus les cinq destinations
// (on voyage par le portail). Elle porte trois outils :
//   - Portail : rejoint la carte du portail en une seule action (portail.ts) ;
//   - Rechercher : la recherche dans le portfolio (recherche.ts, aussi Ctrl + K) ;
//   - Visite rapide : le profil en un coup d'œil (rapide.ts).
// Le fond clair glisse sous l'outil « actif » : Portail au repos, Rechercher ou Visite rapide
// tant que leur fenêtre est ouverte. Sur téléphone, le bouton « Menu » ouvre ces outils en plein écran.

import { decoder } from './decode';
import { lenis } from './defilement';
import { apresPause } from './outils';
import { ouvrirPortail } from './portail';
import { ouvrirRecherche } from './recherche';
import { basculerRapide } from './rapide';

export function initNav(): void {
  const barre = document.querySelector<HTMLElement>('.barre');
  const nav = document.querySelector<HTMLElement>('.nav');
  if (!barre || !nav) return;

  const outils = [...nav.querySelectorAll<HTMLButtonElement>('[data-outil]')];
  const fond = nav.querySelector<HTMLElement>('.nav__actif');
  let actif = '';

  /** Glisse le fond clair sous l'outil actif. */
  const placer = () => {
    const bouton = outils.find((b) => b.dataset.outil === actif);
    if (!fond || !bouton) return;
    fond.style.transform = `translateX(${bouton.offsetLeft}px)`;
    fond.style.width = `${bouton.offsetWidth}px`;
  };
  const activer = (id: string) => {
    if (id === actif) return;
    actif = id;
    outils.forEach((b) => b.toggleAttribute('data-actif', b.dataset.outil === id));
    placer();
  };
  /** L'outil actif d'après ce qui est ouvert : la recherche, la visite rapide, sinon le portail. */
  const suivre = () => {
    const rapide = !!document.querySelector('.rapide[open]');
    const recherche = !!document.querySelector('.recherche[open]');
    outils.find((b) => b.dataset.outil === 'rapide')?.setAttribute('aria-pressed', String(rapide));
    activer(recherche ? 'recherche' : rapide ? 'rapide' : 'portail');
  };
  window.addEventListener('outil', suivre);
  window.addEventListener('resize', apresPause(placer, 150));
  window.addEventListener('langue', () => requestAnimationFrame(placer));
  document.fonts.ready.then(placer);
  suivre();

  // ---- Menu plein écran (téléphone) ----
  const bouton = barre.querySelector<HTMLButtonElement>('.barre__menu');
  const libelle = bouton?.querySelector<HTMLElement>('[data-decode]') ?? null;
  const html = document.documentElement;

  const basculer = (ouvert: boolean) => {
    html.classList.toggle('menu-ouvert', ouvert);
    bouton?.setAttribute('aria-expanded', String(ouvert));
    decoder(libelle, ouvert ? bouton?.dataset.fermer : bouton?.dataset.ouvrir);
    if (ouvert) {
      lenis?.stop();
      outils[0]?.focus({ preventScroll: true });
    } else {
      lenis?.start();
    }
  };

  // ---- Les trois outils ----
  outils.forEach((outil) =>
    outil.addEventListener('click', (e) => {
      const point = e.detail > 0 ? { x: e.clientX, y: e.clientY } : null;
      const dansLeMenu = html.classList.contains('menu-ouvert');
      if (dansLeMenu) basculer(false);
      const id = outil.dataset.outil;
      if (id === 'portail') {
        // Dans le menu du téléphone, c'est le bouton « Menu » (resté à l'écran) qui se brise.
        ouvrirPortail({ source: dansLeMenu ? bouton : outil, point: dansLeMenu ? null : point });
      } else if (id === 'recherche') ouvrirRecherche(outil);
      else if (id === 'rapide') basculerRapide(outil);
    }),
  );

  bouton?.addEventListener('click', () => basculer(!html.classList.contains('menu-ouvert')));
  nav.addEventListener('click', (e) => {
    if ((e.target as Element).closest('a') && html.classList.contains('menu-ouvert')) basculer(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !html.classList.contains('menu-ouvert')) return;
    basculer(false);
    bouton?.focus();
  });
  window.addEventListener(
    'resize',
    apresPause(() => {
      if (window.innerWidth > 860 && html.classList.contains('menu-ouvert')) basculer(false);
    }, 150),
  );
}
