// LE PANNEAU DES RÉGLAGES : relie chaque commande du panneau à sa valeur.
// Le panneau lui-même (ouverture, fermeture, touche Échap) est géré par le
// navigateur, grâce à l'attribut « popover ». Ici on ne fait que :
//   - afficher les valeurs mémorisées à l'ouverture de la page ;
//   - transmettre chaque changement à reglages.ts ;
//   - faire varier un instant l'opacité des surfaces en verre quand le portail s'ouvre.

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { Ambiance, Piste } from './ambiances';
import { lenis } from './defilement';
import { reglages, regler, restaurerAffichage, surReglage, type Densite, type Reglages } from './reglages';

/** Les curseurs : nom du champ, et facteur entre la valeur affichée (0 à 100) et la valeur gardée (0 à 1). */
const CURSEURS: (keyof Reglages)[] = ['opacite', 'flou', 'lueur', 'volumeSons', 'volumeMusique'];
const CASES: (keyof Reglages)[] = ['sons', 'sonAuLancement'];

export function initReglages(): void {
  const panneau = document.querySelector<HTMLElement>('.reglages');
  if (!panneau) return;
  const champ = <T extends HTMLInputElement>(selecteur: string) => [...panneau.querySelectorAll<T>(selecteur)];

  // ---- Curseurs ----
  // (« caler » remet chaque commande sur la valeur gardée : à l'ouverture, et après une restauration.)
  const calages: (() => void)[] = [];
  CURSEURS.forEach((cle) => {
    const curseur = panneau.querySelector<HTMLInputElement>(`input[name="${cle}"]`);
    const affichage = panneau.querySelector<HTMLOutputElement>(`output[data-pour="${cle}"]`);
    if (!curseur) return;
    const montrer = () => affichage && (affichage.textContent = `${curseur.value} %`);
    const caler = () => {
      curseur.value = String(Math.round((reglages[cle] as number) * 100));
      montrer();
    };
    caler();
    calages.push(caler);
    curseur.addEventListener('input', () => {
      regler(cle, (Number(curseur.value) / 100) as never);
      montrer();
    });
  });

  // ---- Niveau d'animation ----
  const niveaux = champ('input[name="animations"]');
  const calerNiveaux = () => niveaux.forEach((radio) => (radio.checked = Number(radio.value) === reglages.animations));
  calerNiveaux();
  calages.push(calerNiveaux);
  niveaux.forEach((radio) => radio.addEventListener('change', () => regler('animations', Number(radio.value))));

  // ---- Densité (16 octobre 2026) : instantanée, sans rechargement ----
  const densites = champ('input[name="densite"]');
  const calerDensite = () => {
    densites.forEach((radio) => (radio.checked = radio.value === reglages.densite));
    panneau.dataset.densite = reglages.densite; // (la phrase du mode choisi : voir reglages.css)
  };
  calerDensite();
  calages.push(calerDensite);
  densites.forEach((radio) => radio.addEventListener('change', () => regler('densite', radio.value as Densite)));
  surReglage((cle) => {
    if (cle !== 'densite') return;
    calerDensite();
    // Les hauteurs changent : on garde la même part de la destination à l'écran, puis tout se remesure
    // (défilement amorti, déclencheurs, fil des chapitres, fonds glissants).
    const fin = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const part = window.scrollY / fin;
    requestAnimationFrame(() => {
      lenis?.resize();
      ScrollTrigger.refresh();
      const y = Math.round(part * Math.max(0, document.documentElement.scrollHeight - window.innerHeight));
      if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
      else window.scrollTo(0, y);
      window.dispatchEvent(new Event('resize'));
    });
  });

  // ---- Restaurer l'affichage d'origine ----
  const restaurer = panneau.querySelector<HTMLButtonElement>('[data-restaurer]');
  const confirmation = panneau.querySelector<HTMLElement>('[data-confirmation]');
  let effacer = 0;
  restaurer?.addEventListener('click', () => {
    const changes = restaurerAffichage();
    calages.forEach((caler) => caler());
    if (!confirmation) return;
    confirmation.textContent = (changes ? confirmation.dataset.fait : confirmation.dataset.deja) ?? '';
    confirmation.classList.add('est-visible');
    window.clearTimeout(effacer);
    effacer = window.setTimeout(() => confirmation.classList.remove('est-visible'), 3200);
  });

  // ---- Cases à cocher : les effets sonores, le son dès l'ouverture du site ----
  CASES.forEach((cle) => {
    const coche = panneau.querySelector<HTMLInputElement>(`input[name="${cle}"]`);
    if (!coche) return;
    coche.checked = reglages[cle] as boolean;
    coche.addEventListener('change', () => regler(cle, coche.checked as never));
  });

  // ---- Atmosphère : l'ambiance, la piste, lecture ou pause ----
  // Quatre boutons d'ambiance : recliquer sur celui qui est enfoncé revient au site d'origine.
  const ambiances = [...panneau.querySelectorAll<HTMLButtonElement>('[data-ambiance]')];
  const pistes = champ('input[name="piste"]');
  const lecture = panneau.querySelector<HTMLButtonElement>('[data-lecture]');
  const volumeMusique = panneau.querySelector<HTMLInputElement>('input[name="volumeMusique"]');
  ambiances.forEach((bouton) => {
    bouton.addEventListener('click', () => regler('atmosphere', (bouton.dataset.ambiance === reglages.atmosphere ? '' : bouton.dataset.ambiance) as Ambiance));
  });
  pistes.forEach((radio) => radio.addEventListener('change', () => regler('piste', radio.value as Piste)));
  lecture?.addEventListener('click', () => regler('musique', !reglages.musique));

  /** Le panneau reflète les réglages (une ambiance peut changer la piste, par exemple). */
  const refleter = () => {
    const silence = reglages.atmosphere === 'silence';
    panneau.dataset.ambiance = reglages.atmosphere;
    ambiances.forEach((bouton) => bouton.setAttribute('aria-pressed', String(bouton.dataset.ambiance === reglages.atmosphere)));
    pistes.forEach((radio) => {
      radio.checked = radio.value === reglages.piste;
      radio.disabled = silence;
    });
    lecture?.setAttribute('aria-pressed', String(reglages.musique && !silence));
    if (lecture) lecture.disabled = silence;
    if (volumeMusique) volumeMusique.disabled = silence;
  };
  refleter();
  surReglage(refleter);

  // ---- L'opacité accompagne le zoom ----
  // Quand le portail s'ouvre sur sa carte, la caméra s'approche : les surfaces
  // en verre se densifient un instant, puis reviennent à la valeur choisie par
  // le visiteur. Le curseur garde la main sur la valeur de base : on n'ajoute
  // qu'un écart temporaire.
  const ecart = { valeur: 0 };
  const poser = () =>
    document.documentElement.style.setProperty('--opacite', Math.min(0.97, reglages.opacite + ecart.valeur).toFixed(3));
  window.addEventListener('portail', (e) => {
    if ((e as CustomEvent<string>).detail !== 'carte') return;
    gsap.killTweensOf(ecart);
    gsap
      .timeline({ onUpdate: poser })
      .to(ecart, { valeur: 0.24, duration: 0.25, ease: 'power2.out' })
      .to(ecart, { valeur: 0, duration: 0.7, ease: 'power2.out' });
  });
}
