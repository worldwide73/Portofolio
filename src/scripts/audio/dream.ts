// DREAM RADIO : LE LECTEUR DE MUSIQUE DU PORTFOLIO (16 octobre 2026).
// L'icône casque est juste à côté du drapeau de la langue, en haut à droite (dans le menu, sur
// téléphone, à côté du drapeau aussi). Elle ouvre un lecteur en verre : la piste en cours, son titre,
// son artiste et sa licence, la liste des pistes, lecture et pause, précédente et suivante, la position
// dans le morceau, le volume et la sourdine.
//
// Règles (demande de Mathéo) :
//   - la musique est coupée à l'ouverture du site et ne démarre jamais seule ;
//   - fermer le lecteur n'arrête pas la musique ; elle continue d'une destination à l'autre ;
//   - en entrant dans Portal Rush, elle s'efface (sa position est gardée) ; en sortant, elle reprend
//     seulement si elle jouait (rush.ts) ;
//   - sur une autre page (une fiche projet), le navigateur recharge tout : la musique ne peut pas
//     continuer d'elle-même. Le lecteur se souvient alors de la piste et de la position, et l'icône
//     propose de reprendre : un clic sur Lecture, jamais de lecture automatique.

import { CATALOGUE_DREAM, minutes, type EntreeCatalogue } from './catalogue';
import { cordesDuSoir, derive, heureBleue, traitFin, type Fabrique } from './compositions';
import { attenuationEnCours, contexte } from './moteur';
import { Radio, radiosEnLecture, stockageLocal, type PisteRadio } from './radio';
import { mouvementReduit } from '../outils';

const COMPOSITIONS: Record<string, Fabrique> = { 'cordes-du-soir': cordesDuSoir, 'heure-bleue': heureBleue, derive, 'trait-fin': traitFin };
const CLE_REPRISE = 'dream-radio-reprise';

export const versPiste = (e: EntreeCatalogue, compositions: Record<string, Fabrique>, original: string): PisteRadio => ({
  id: e.id,
  titre: e.titre,
  artiste: e.artiste,
  licence: e.licence === 'original' ? original : 'CC BY-SA 3.0',
  lien: e.lien,
  src: e.src,
  fabriquer: e.src ? undefined : compositions[e.id],
  niveau: e.niveau,
  duree: e.duree,
  adaptative: !!e.adaptative,
});

/** La radio du portfolio (une seule par page). */
export const dreamRadio = new Radio(
  'dream',
  CATALOGUE_DREAM.map((e) => versPiste(e, COMPOSITIONS, 'original')),
  stockageLocal('dream-radio'),
  0.55,
);

export function initDreamRadio(): void {
  const lecteur = document.querySelector<HTMLElement>('#dream-radio');
  if (!lecteur) return;
  const textes = JSON.parse(lecteur.dataset.textes ?? '{}') as Record<string, string>;
  const $ = <T extends HTMLElement = HTMLElement>(nom: string) => lecteur.querySelector<T>(`[data-dream="${nom}"]`);
  const boutons = [...document.querySelectorAll<HTMLButtonElement>('[popovertarget="dream-radio"].radio-bouton')];
  const lecture = $<HTMLButtonElement>('lecture');
  const progression = $<HTMLInputElement>('progression');
  const volume = $<HTMLInputElement>('volume');
  const muet = $<HTMLButtonElement>('muet');
  const etatTexte = $('etat');
  const pistes = [...lecteur.querySelectorAll<HTMLButtonElement>('[data-dream-piste]')];
  const toile = lecteur.querySelector<HTMLCanvasElement>('.dream__spectre');
  let glisse = false;
  let derniere = -1;
  /** Venu d'une autre page où la musique jouait : le lecteur propose de reprendre. */
  let reprise = false;

  /** Sous l'artiste : « Jouée en direct par le code du site » (composition originale) ou « CC BY-SA 3.0 ». */
  const licence = (p: PisteRadio) => (p.fabriquer ? textes.genere : p.licence);

  const peindre = () => {
    const e = dreamRadio.etat;
    const p = dreamRadio.piste;
    lecteur.dataset.lecture = String(e.lecture);
    if (derniere !== e.index) {
      derniere = e.index;
      $('titre')!.textContent = p.titre;
      $('artiste')!.textContent = p.artiste === 'Portfolio' ? textes.original : p.artiste;
      $('licence')!.textContent = licence(p);
      pistes.forEach((b, i) => {
        const ici = i === e.index;
        b.setAttribute('aria-current', String(ici));
        b.closest('li')?.classList.toggle('est-courante', ici);
      });
    }
    pistes.forEach((b, i) => b.closest('li')?.classList.toggle('est-jouee', i === e.index && e.lecture));
    lecture?.setAttribute('aria-pressed', String(e.lecture));
    lecture?.setAttribute('aria-label', e.lecture ? textes.pause : textes.lire);
    if (lecture) lecture.title = lecture.getAttribute('aria-label') ?? '';
    if (progression && !glisse) {
      progression.value = String(e.duree ? Math.round((e.position / e.duree) * 1000) : 0);
      progression.style.setProperty('--v', `${(Number(progression.value) / 10).toFixed(1)}%`);
    }
    $('position')!.textContent = minutes(e.position);
    $('duree')!.textContent = minutes(e.duree);
    if (volume && document.activeElement !== volume) volume.value = String(Math.round(e.volume * 100));
    if (volume) volume.style.setProperty('--v', `${e.muet ? 0 : Math.round(e.volume * 100)}%`);
    $('volumeSortie')!.textContent = e.muet ? '—' : `${Math.round(e.volume * 100)} %`;
    muet?.setAttribute('aria-pressed', String(e.muet));
    muet?.setAttribute('aria-label', e.muet ? textes.reactiver : textes.muet);
    if (muet) muet.title = muet.getAttribute('aria-label') ?? '';
    lecteur.dataset.muet = String(e.muet);
    if (e.lecture) reprise = false;
    if (etatTexte) etatTexte.textContent = e.erreur ? textes.erreur : e.chargement && e.lecture ? textes.chargement : reprise ? textes.reprise : '';
    // L'icône du casque : des ondes quand la musique joue, un point quand elle peut reprendre.
    boutons.forEach((b) => {
      b.dataset.lecture = String(e.lecture);
      b.setAttribute('aria-label', `${textes.bouton}${e.lecture ? ` · ${p.titre}` : ''}`);
      b.title = b.getAttribute('aria-label') ?? '';
    });
  };
  dreamRadio.surChangement(peindre);

  // ---- Les commandes ----
  lecture?.addEventListener('click', () => {
    boutons.forEach((b) => delete b.dataset.reprise);
    dreamRadio.basculer();
  });
  $('precedente')?.addEventListener('click', () => dreamRadio.precedente());
  $('suivante')?.addEventListener('click', () => dreamRadio.suivante());
  muet?.addEventListener('click', () => dreamRadio.basculerMuet());
  volume?.addEventListener('input', () => dreamRadio.reglerVolume(Number(volume.value) / 100));
  pistes.forEach((b, i) =>
    b.addEventListener('click', () => {
      boutons.forEach((x) => delete x.dataset.reprise);
      if (i === dreamRadio.etat.index) dreamRadio.basculer();
      else dreamRadio.choisir(i, true);
    }),
  );
  if (progression) {
    progression.addEventListener('pointerdown', () => (glisse = true));
    progression.addEventListener('input', () => {
      glisse = true;
      const e = dreamRadio.etat;
      progression.style.setProperty('--v', `${(Number(progression.value) / 10).toFixed(1)}%`);
      $('position')!.textContent = minutes((Number(progression.value) / 1000) * e.duree);
    });
    progression.addEventListener('change', () => {
      glisse = false;
      dreamRadio.chercher((Number(progression.value) / 1000) * dreamRadio.etat.duree);
    });
  }

  // Au clavier, dans le lecteur : Espace (hors des commandes) lecture ou pause, ← → piste précédente ou suivante.
  lecteur.addEventListener('keydown', (e) => {
    const cible = e.target as HTMLElement;
    if (cible.matches('input[type="range"]')) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      if (e.key === 'ArrowLeft') dreamRadio.precedente();
      else dreamRadio.suivante();
    } else if (e.key === ' ' && !cible.matches('button, a, summary')) {
      e.preventDefault();
      dreamRadio.basculer();
    }
  });

  // ---- La position du lecteur : sous l'icône qui l'a ouvert (en bas de l'écran, sur téléphone) ----
  let ouvreur: HTMLElement | null = null;
  boutons.forEach((b) => b.addEventListener('click', () => (ouvreur = b)));
  const placer = () => {
    if (window.matchMedia('(max-width: 860px)').matches) {
      lecteur.style.removeProperty('top');
      lecteur.style.removeProperty('left');
      return;
    }
    const b = (ouvreur && ouvreur.getClientRects().length ? ouvreur : boutons.find((x) => x.getClientRects().length))?.getBoundingClientRect();
    if (!b) return;
    const largeur = lecteur.offsetWidth || 360;
    lecteur.style.top = `${Math.round(b.bottom + 10)}px`;
    lecteur.style.left = `${Math.round(Math.max(8, Math.min(window.innerWidth - largeur - 8, b.right - largeur + 6)))}px`;
  };
  lecteur.addEventListener('toggle', (e) => {
    const ouvert = (e as ToggleEvent).newState === 'open';
    boutons.forEach((b) => b.setAttribute('aria-expanded', String(ouvert)));
    if (ouvert) {
      placer();
      peindre();
      dessiner();
    }
  });
  window.addEventListener('resize', () => lecteur.matches(':popover-open') && placer());

  // ---- Le spectre : des barres qui suivent vraiment la musique (rien quand elle se tait) ----
  const dessiner = () => {
    if (!toile || !lecteur.matches(':popover-open')) return;
    const ctx = toile.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const l = toile.clientWidth;
    const h = toile.clientHeight;
    if (toile.width !== Math.round(l * dpr)) {
      toile.width = Math.round(l * dpr);
      toile.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, l, h);
    const an = dreamRadio.enLecture ? dreamRadio.analyseur() : null;
    const n = 28;
    const donnees = new Uint8Array(64);
    if (an) an.getByteFrequencyData(donnees);
    const pas = l / n;
    for (let i = 0; i < n; i++) {
      const v = an ? donnees[Math.min(63, Math.floor(1 + i * 1.6))] / 255 : 0;
      const hb = Math.max(2, v * h * 0.92);
      const x = i * pas + pas * 0.22;
      const g = ctx.createLinearGradient(0, h, 0, h - hb);
      g.addColorStop(0, 'rgba(98, 217, 255, 0.55)');
      g.addColorStop(1, `rgba(${180 + Math.round(v * 60)}, ${160 + Math.round(v * 70)}, 255, ${(0.35 + v * 0.6).toFixed(2)})`);
      ctx.fillStyle = g;
      ctx.fillRect(x, h - hb, pas * 0.56, hb);
    }
    if (!mouvementReduit && dreamRadio.enLecture) requestAnimationFrame(dessiner);
  };
  dreamRadio.surChangement(() => dreamRadio.enLecture && lecteur.matches(':popover-open') && requestAnimationFrame(dessiner));

  // ---- D'une page à l'autre : retenir où l'on en était, proposer de reprendre (sans jamais relancer seul) ----
  window.addEventListener('pagehide', () => {
    try {
      const e = dreamRadio.etat;
      // (Suspendue : la musique jouait avant d'entrer dans Portal Rush, qu'on quitte vers une autre page.)
      if (e.lecture || dreamRadio.estSuspendue) sessionStorage.setItem(CLE_REPRISE, JSON.stringify({ i: e.index, p: Math.round(e.position) }));
      else sessionStorage.removeItem(CLE_REPRISE);
    } catch {
      // stockage indisponible
    }
  });
  try {
    const brut = JSON.parse(sessionStorage.getItem(CLE_REPRISE) ?? 'null');
    sessionStorage.removeItem(CLE_REPRISE);
    if (brut && Number.isInteger(brut.i) && typeof brut.p === 'number') {
      reprise = true;
      dreamRadio.poserReprise(brut.i, brut.p);
      boutons.forEach((b) => (b.dataset.reprise = 'true'));
    }
  } catch {
    // rien à reprendre
  }
  peindre();

  if (import.meta.env.DEV) Object.assign(window as unknown as Record<string, unknown>, { __dreamRadio: dreamRadio, __audio: { attenuationEnCours, radiosEnLecture, contexte } });
}
