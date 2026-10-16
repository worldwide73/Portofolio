// LES EFFETS SONORES : tout est fabriqué ici, à la volée, avec la Web Audio API.
// Chaque son est construit à partir de briques simples :
//   - un « oscillateur » produit une note pure (onde sinus, en dents de scie…) ;
//   - un « bruit » est un souffle, comme le vent ou une radio entre deux stations ;
//   - un « filtre » ne laisse passer que les graves ou que les aigus ;
//   - un « gain » règle le volume, et son évolution dans le temps s'appelle une « enveloppe ».
//
// Règles :
//   - les effets sont actifs d'office, à faible volume (8 %) ; le visiteur les règle ou les coupe dans le
//     panneau (page Son). Un navigateur ne laisse rien jouer avant le premier clic ou la première touche ;
//   - les sons suivent les changements de section (voyage.ts), le portail (champ.ts) et sa carte (explorateur.ts) ;
//   - un son en cours est coupé en fondu si l'animation est annulée ;
//   - le moteur et ses canaux sont communs (audio/moteur.ts). La musique n'est plus ici : elle est dans
//     DREAM RADIO (audio/dream.ts) et RUSH RADIO. Les grands effets (le portail qui se brise, la carte
//     qui s'ouvre, une traversée) baissent la musique un instant, s'ils jouent vraiment.

import { attenuerMusique, bruitBlanc, canalEffets, canalIntro, contexte, contexteExistant } from './audio/moteur';
import { reglages, surReglage } from './reglages';
import { surEtape, type Mode } from './voyage';

let forcerIntro = false;

// ---- Les sons en cours, pour pouvoir les couper proprement ----
const enCours = new Set<GainNode>();

/** Ouvre une « piste » : un gain relié à la sortie, qui se retire tout seul à la fin. */
function piste(duree: number): { c: AudioContext; g: GainNode; t: number } | null {
  if (!reglages.sons && !forcerIntro) return null;
  const c = contexte();
  // Tant que le navigateur n'a pas autorisé le son (aucun geste du visiteur), on
  // ne programme rien : les sons s'entasseraient et partiraient tous au premier clic.
  const sortie = forcerIntro ? canalIntro() : canalEffets();
  if (!c || !sortie || c.state !== 'running') return null;
  const g = c.createGain();
  g.gain.value = 0;
  g.connect(sortie);
  enCours.add(g);
  window.setTimeout(() => {
    enCours.delete(g);
    g.disconnect();
  }, (duree + 0.4) * 1000);
  return { c, g, t: c.currentTime };
}

/** Coupe en fondu tous les effets en cours (animation annulée, sons désactivés). */
export function couperEffets(): void {
  const ctx = contexte();
  if (!ctx) return;
  const t = ctx.currentTime;
  enCours.forEach((g) => {
    g.gain.cancelScheduledValues(t);
    g.gain.setTargetAtTime(0, t, 0.05);
  });
}

function oscillateur(c: AudioContext, type: OscillatorType, vers: AudioNode, debut: number, fin: number): OscillatorNode {
  const o = c.createOscillator();
  o.type = type;
  o.connect(vers);
  o.start(debut);
  o.stop(fin);
  return o;
}

function souffle(c: AudioContext, vers: AudioNode, debut: number, fin: number): { filtre: BiquadFilterNode; source: AudioBufferSourceNode } {
  const source = c.createBufferSource();
  source.buffer = bruitBlanc();
  source.loop = true;
  const filtre = c.createBiquadFilter();
  filtre.type = 'bandpass';
  filtre.Q.value = 0.9;
  source.connect(filtre).connect(vers);
  source.start(debut);
  source.stop(fin);
  return { filtre, source };
}

// ---- Le passage (fin de l'introduction) ----
// Une seule piste par traversée, écrite d'avance sur toute sa durée : impulsion
// grave au départ, montée, souffle qui s'ouvre dans le tunnel, puis retombée.
// Au retour, tout est inversé : les fréquences descendent, le souffle se referme.
function sonVoyage(mode: Mode | 'origine', duree: number): void {
  const p = piste(duree);
  if (!p) return;
  const { c, g, t } = p;
  if (!forcerIntro) attenuerMusique(0.2, duree * 0.9);
  const fin = t + duree;
  const retour = mode === 'retour';
  const origine = mode === 'origine';
  const milieu = t + duree * 0.55;

  // Enveloppe générale : attaque franche, tenue, extinction douce à l'arrivée.
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.9, t + 0.06);
  g.gain.setValueAtTime(0.9, milieu);
  g.gain.exponentialRampToValueAtTime(0.001, fin);

  // 1. L'impulsion grave de l'activation.
  const grave = oscillateur(c, 'sine', g, t, t + 0.7);
  const volGrave = c.createGain();
  grave.disconnect();
  grave.connect(volGrave).connect(g);
  grave.frequency.setValueAtTime(retour ? 62 : 92, t);
  grave.frequency.exponentialRampToValueAtTime(retour ? 96 : 40, t + 0.6);
  volGrave.gain.setValueAtTime(0.9, t);
  volGrave.gain.exponentialRampToValueAtTime(0.001, t + 0.65);

  // 2. La montée (ou la descente au retour) : deux notes légèrement désaccordées.
  const filtreNotes = c.createBiquadFilter();
  filtreNotes.type = 'lowpass';
  filtreNotes.connect(g);
  const volNotes = c.createGain();
  volNotes.gain.value = 0.16;
  volNotes.connect(filtreNotes);
  const [f0, f1] = retour ? [520, 110] : origine ? [140, 880] : [110, 620];
  [1, 1.007].forEach((desaccord) => {
    const o = oscillateur(c, 'sawtooth', volNotes, t, fin);
    o.frequency.setValueAtTime(f0 * desaccord, t);
    o.frequency.exponentialRampToValueAtTime(f1 * desaccord, milieu);
    o.frequency.exponentialRampToValueAtTime((retour ? f1 * 0.7 : f1 * 0.5) * desaccord, fin);
  });
  filtreNotes.frequency.setValueAtTime(retour ? 2600 : 380, t);
  filtreNotes.frequency.exponentialRampToValueAtTime(retour ? 300 : 3200, milieu);
  filtreNotes.frequency.exponentialRampToValueAtTime(260, fin);

  // 3. Le souffle du tunnel : un bruit filtré dont la couleur suit la vitesse.
  const volSouffle = c.createGain();
  volSouffle.connect(g);
  volSouffle.gain.setValueAtTime(0.0001, t);
  volSouffle.gain.exponentialRampToValueAtTime(0.5, milieu);
  volSouffle.gain.exponentialRampToValueAtTime(0.0001, fin);
  const { filtre } = souffle(c, volSouffle, t, fin);
  filtre.frequency.setValueAtTime(retour ? 3800 : 300, t);
  filtre.frequency.exponentialRampToValueAtTime(retour ? 500 : 4200, milieu);
  filtre.frequency.exponentialRampToValueAtTime(retour ? 180 : 700, fin);

  // Le saut dans le temps ajoute un battement rapide qui ralentit : l'espace se contracte.
  if (origine) {
    const tremolo = c.createOscillator();
    const profondeur = c.createGain();
    profondeur.gain.value = 0.35;
    tremolo.frequency.setValueAtTime(26, t);
    tremolo.frequency.exponentialRampToValueAtTime(3, fin);
    tremolo.connect(profondeur).connect(volSouffle.gain);
    tremolo.start(t);
    tremolo.stop(fin);
  }
}

// ---- Le portail ----
let pisteCharge: { g: GainNode; arret: () => void } | null = null;

/** La charge : une vibration grave qui monte, avec de petits crépitements. */
function sonCharge(): void {
  const p = piste(1.6);
  if (!p) return;
  const { c, g, t } = p;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.55, t + 1.0);
  const o = oscillateur(c, 'triangle', g, t, t + 1.6);
  o.frequency.setValueAtTime(55, t);
  o.frequency.exponentialRampToValueAtTime(180, t + 1.05);
  // Crépitements : de très courts éclats de bruit aigu, de plus en plus rapprochés.
  for (let i = 0; i < 12; i++) {
    const quand = t + 0.15 + (1 - Math.pow(1 - i / 12, 2)) * 0.9;
    const vol = c.createGain();
    vol.connect(g);
    vol.gain.setValueAtTime(0.0001, quand);
    vol.gain.exponentialRampToValueAtTime(0.25, quand + 0.004);
    vol.gain.exponentialRampToValueAtTime(0.0001, quand + 0.035);
    const { filtre } = souffle(c, vol, quand, quand + 0.05);
    filtre.frequency.value = 3200 + Math.random() * 2600;
    filtre.Q.value = 4;
  }
  pisteCharge = {
    g,
    arret: () => {
      g.gain.cancelScheduledValues(c.currentTime);
      g.gain.setTargetAtTime(0, c.currentTime, 0.06);
    },
  };
}

/** La rupture : un claquement sourd et un éclat de verre, brefs et contenus. */
function sonRupture(): void {
  const p = piste(0.9);
  if (!p) return;
  const { c, g, t } = p;
  attenuerMusique(0.24, 1.1);
  g.gain.setValueAtTime(0.9, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
  const coup = oscillateur(c, 'sine', g, t, t + 0.5);
  coup.frequency.setValueAtTime(150, t);
  coup.frequency.exponentialRampToValueAtTime(36, t + 0.4);
  const vol = c.createGain();
  vol.gain.setValueAtTime(0.5, t);
  vol.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
  vol.connect(g);
  const { filtre } = souffle(c, vol, t, t + 0.55);
  filtre.type = 'highpass';
  filtre.frequency.setValueAtTime(2400, t);
}

/** Le survol : une note de verre, très légère. */
function sonSurvol(): void {
  const p = piste(0.5);
  if (!p) return;
  const { c, g, t } = p;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.1, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
  oscillateur(c, 'sine', g, t, t + 0.5).frequency.setValueAtTime(1320, t);
  oscillateur(c, 'sine', g, t, t + 0.5).frequency.setValueAtTime(1980, t);
}

/** Une note seule, avec sa propre enveloppe : attaque rapide, extinction douce. */
function note(c: AudioContext, vers: AudioNode, frequence: number, debut: number, duree: number, volume: number, type: OscillatorType = 'sine'): void {
  const vol = c.createGain();
  vol.gain.setValueAtTime(0, debut);
  vol.gain.linearRampToValueAtTime(volume, debut + 0.014);
  vol.gain.exponentialRampToValueAtTime(0.0001, debut + duree);
  vol.connect(vers);
  oscillateur(c, type, vol, debut, debut + duree + 0.02).frequency.setValueAtTime(frequence, debut);
}

// ---- Le fil de navigation ----
/** Chaque section a sa note (gamme pentatonique de la mineur) : on entend où l'on arrive. */
const NOTES_DU_FIL = [440, 523.25, 587.33, 659.25, 783.99];

/** Un changement de section : un souffle très bref qui file dans le sens du trajet, puis la note d'arrivée. */
function sonFil(mode: Mode, rang: number, duree: number): void {
  const p = piste(duree + 0.5);
  if (!p) return;
  const { c, g, t } = p;
  g.gain.setValueAtTime(1, t);
  const vol = c.createGain();
  vol.connect(g);
  vol.gain.setValueAtTime(0.0001, t);
  vol.gain.exponentialRampToValueAtTime(0.15, t + duree * 0.45);
  vol.gain.exponentialRampToValueAtTime(0.0001, t + duree);
  const { filtre } = souffle(c, vol, t, t + duree + 0.05);
  filtre.Q.value = 1.6;
  const [f0, f1] = mode === 'retour' ? [3000, 900] : [900, 3000];
  filtre.frequency.setValueAtTime(f0, t);
  filtre.frequency.exponentialRampToValueAtTime(f1, t + duree);
  const frequence = NOTES_DU_FIL[rang] ?? NOTES_DU_FIL[0];
  note(c, g, frequence, t + duree * 0.7, 0.42, 0.1);
  note(c, g, frequence * 2, t + duree * 0.7, 0.3, 0.035);
}

/**
 * Le saut dans le temps, entre l'accueil et Contact. Quatre moments, calés sur
 * l'image : l'impulsion du départ, l'aspiration des éclats (un souffle qui se
 * resserre vers l'aigu), la traversée (à rebours au retour : une montée dont le
 * battement ralentit), puis la note de la section d'arrivée, qui s'éteint doucement.
 */
function sonSaut(mode: Mode, duree: number, rang: number): void {
  sonVoyage(mode === 'retour' ? 'origine' : 'aller', duree);
  const p = piste(duree + 1.2);
  if (!p) return;
  const { c, g, t } = p;
  g.gain.setValueAtTime(1, t);
  const vol = c.createGain();
  vol.connect(g);
  vol.gain.setValueAtTime(0.0001, t);
  vol.gain.exponentialRampToValueAtTime(0.3, t + duree * 0.42);
  vol.gain.exponentialRampToValueAtTime(0.0001, t + duree * 0.56);
  const { filtre } = souffle(c, vol, t, t + duree * 0.6);
  filtre.Q.value = 3;
  filtre.frequency.setValueAtTime(420, t);
  filtre.frequency.exponentialRampToValueAtTime(5200, t + duree * 0.52);
  const arrivee = NOTES_DU_FIL[rang] ?? NOTES_DU_FIL[0];
  note(c, g, arrivee, t + duree * 0.8, 1, 0.12);
  note(c, g, arrivee / 2, t + duree * 0.8, 1.2, 0.08);
}

// ---- La carte du portail ----
/** La carte s'ouvre : trois notes de verre qui montent, sur un léger souffle. */
function sonCarte(): void {
  const p = piste(0.8);
  if (!p) return;
  const { c, g, t } = p;
  attenuerMusique(0.18, 0.9);
  g.gain.setValueAtTime(1, t);
  [660, 990, 1320].forEach((frequence, i) => note(c, g, frequence, t + i * 0.06, 0.5, 0.08));
  const vol = c.createGain();
  vol.connect(g);
  vol.gain.setValueAtTime(0.0001, t);
  vol.gain.exponentialRampToValueAtTime(0.1, t + 0.18);
  vol.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
  const { filtre } = souffle(c, vol, t, t + 0.6);
  filtre.frequency.setValueAtTime(700, t);
  filtre.frequency.exponentialRampToValueAtTime(2800, t + 0.45);
}

/** Une destination est choisie : deux notes rapprochées, le trait de lumière part. */
function sonDestination(): void {
  const p = piste(0.5);
  if (!p) return;
  const { c, g, t } = p;
  g.gain.setValueAtTime(1, t);
  note(c, g, 880, t, 0.22, 0.1, 'triangle');
  note(c, g, 1318.5, t + 0.07, 0.3, 0.09, 'triangle');
}

let pisteFermeture: { arret: () => void } | null = null;

/**
 * La carte se referme (0,55 s, calé sur les 0,45 s du rassemblement) : une petite
 * impulsion électronique, un souffle qui se resserre vers le centre pendant que les
 * éclats sont aspirés, puis une courte résonance de verre quand le cube se reforme.
 */
function sonFermeture(): void {
  const p = piste(0.7);
  if (!p) return;
  const { c, g, t } = p;
  g.gain.setValueAtTime(1, t);
  // L'impulsion : un « tic » qui glisse vers le bas.
  const tic = c.createGain();
  tic.connect(g);
  tic.gain.setValueAtTime(0, t);
  tic.gain.linearRampToValueAtTime(0.07, t + 0.006);
  tic.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
  const o = oscillateur(c, 'triangle', tic, t, t + 0.1);
  o.frequency.setValueAtTime(1760, t);
  o.frequency.exponentialRampToValueAtTime(880, t + 0.08);
  // L'aspiration : un souffle filtré qui descend de l'aigu vers le médium, en enflant puis en s'éteignant.
  const vol = c.createGain();
  vol.connect(g);
  vol.gain.setValueAtTime(0.0001, t);
  vol.gain.exponentialRampToValueAtTime(0.11, t + 0.3);
  vol.gain.exponentialRampToValueAtTime(0.0001, t + 0.46);
  const { filtre } = souffle(c, vol, t, t + 0.5);
  filtre.Q.value = 1.4;
  filtre.frequency.setValueAtTime(3200, t);
  filtre.frequency.exponentialRampToValueAtTime(700, t + 0.44);
  // La résonance : deux notes de verre, brèves, quand les éclats se rejoignent.
  note(c, g, 784, t + 0.36, 0.2, 0.05);
  note(c, g, 1176, t + 0.37, 0.16, 0.025);
  pisteFermeture = {
    arret: () => {
      g.gain.cancelScheduledValues(c.currentTime);
      g.gain.setTargetAtTime(0, c.currentTime, 0.04);
    },
  };
}

// ---- Portal Rush ----
/** Le volume des effets du jeu (0 à 1), réglé dans le jeu ; il s'ajoute au volume des effets du site. */
let volumeRush = 1;
export function reglerVolumeRush(volume: number): void {
  volumeRush = Math.max(0, Math.min(1, volume));
}
export type EvenementRush = 'deplacement' | 'fragment' | 'noyau' | 'parfait' | 'choc' | 'portail' | 'overdrive' | 'pret' | 'detruit' | 'boss' | 'phase' | 'victoire' | 'defaite' | 'ouverture' | 'sortie';

/** Les sons de Portal Rush : brefs et discrets, réglés comme les autres effets (et coupés avec eux). */
export function sonRush(evenement: EvenementRush): void {
  const long = evenement === 'victoire' || evenement === 'defaite' || evenement === 'overdrive' || evenement === 'phase' || evenement === 'ouverture' || evenement === 'sortie';
  if (volumeRush <= 0) return;
  const p = piste(long ? 1.5 : 0.6);
  if (!p) return;
  const { c, g, t } = p;
  g.gain.setValueAtTime(volumeRush, t);
  /** Un souffle filtré : volume maximal, fréquences de départ et d'arrivée, durée. */
  const vent = (volume: number, f0: number, f1: number, duree: number, type: BiquadFilterType = 'bandpass') => {
    const vol = c.createGain();
    vol.connect(g);
    vol.gain.setValueAtTime(0.0001, t);
    vol.gain.exponentialRampToValueAtTime(volume, t + Math.min(0.02, duree * 0.3));
    vol.gain.exponentialRampToValueAtTime(0.0001, t + duree);
    const { filtre } = souffle(c, vol, t, t + duree + 0.02);
    filtre.type = type;
    filtre.Q.value = type === 'bandpass' ? 1.8 : 0.7;
    filtre.frequency.setValueAtTime(f0, t);
    filtre.frequency.exponentialRampToValueAtTime(f1, t + duree);
  };
  switch (evenement) {
    case 'deplacement':
      vent(0.05, 2400, 1600, 0.07);
      break;
    case 'fragment':
      note(c, g, 1318.5, t, 0.22, 0.07);
      note(c, g, 1975.5, t + 0.04, 0.2, 0.04);
      break;
    case 'noyau':
      note(c, g, 880, t, 0.3, 0.08);
      note(c, g, 1318.5, t + 0.05, 0.3, 0.06);
      break;
    case 'parfait':
      note(c, g, 987.8, t, 0.16, 0.08, 'triangle');
      note(c, g, 1480, t + 0.07, 0.24, 0.08, 'triangle');
      break;
    case 'choc': {
      const vol = c.createGain();
      vol.connect(g);
      vol.gain.setValueAtTime(0.0001, t);
      vol.gain.exponentialRampToValueAtTime(0.32, t + 0.01);
      vol.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
      const o = oscillateur(c, 'sine', vol, t, t + 0.4);
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.35);
      vent(0.12, 2600, 1800, 0.2, 'highpass');
      break;
    }
    case 'portail':
      vent(0.12, 500, 3200, 0.35);
      note(c, g, 1174.7, t + 0.12, 0.3, 0.05);
      break;
    case 'overdrive':
      vent(0.16, 300, 4200, 0.6);
      [523.25, 659.25, 783.99].forEach((f, i) => note(c, g, f, t + 0.08 + i * 0.04, 0.6, 0.05));
      break;
    case 'pret':
      note(c, g, 1760, t, 0.12, 0.05);
      note(c, g, 2349.3, t + 0.1, 0.16, 0.05);
      break;
    case 'detruit':
      vent(0.1, 3000, 2200, 0.12, 'highpass');
      break;
    case 'boss':
      note(c, g, 329.6, t, 0.25, 0.08, 'triangle');
      break;
    case 'phase':
      [659.25, 523.25, 392].forEach((f, i) => note(c, g, f, t + i * 0.12, 0.4, 0.07));
      break;
    case 'victoire':
      [659.25, 783.99, 987.77, 1318.5].forEach((f, i) => note(c, g, f, t + i * 0.09, 0.5, 0.07));
      break;
    case 'defaite':
      [440, 349.23, 261.63].forEach((f, i) => note(c, g, f, t + i * 0.18, 0.5, 0.07));
      break;
    case 'ouverture': {
      // L'entrée dans le jeu : un souffle qui monte (l'aspiration), une nappe grave, puis deux notes claires.
      vent(0.14, 180, 3800, 0.75);
      const vol = c.createGain();
      vol.connect(g);
      vol.gain.setValueAtTime(0.0001, t);
      vol.gain.exponentialRampToValueAtTime(0.16, t + 0.3);
      vol.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
      const o = oscillateur(c, 'sine', vol, t, t + 1.15);
      o.frequency.setValueAtTime(70, t);
      o.frequency.exponentialRampToValueAtTime(140, t + 0.8);
      note(c, g, 1046.5, t + 0.55, 0.5, 0.05);
      note(c, g, 1568, t + 0.68, 0.6, 0.04);
      break;
    }
    case 'sortie': {
      // Le retour au portfolio : le souffle redescend, le portail se referme d'un coup sourd.
      vent(0.12, 3400, 260, 0.55);
      note(c, g, 1318.5, t, 0.25, 0.04);
      const vol = c.createGain();
      vol.connect(g);
      vol.gain.setValueAtTime(0.0001, t + 0.45);
      vol.gain.exponentialRampToValueAtTime(0.22, t + 0.5);
      vol.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      const o = oscillateur(c, 'sine', vol, t + 0.45, t + 0.95);
      o.frequency.setValueAtTime(110, t + 0.45);
      o.frequency.exponentialRampToValueAtTime(48, t + 0.9);
      break;
    }
  }
}

/** L'éveil du portail, pendant l'introduction : une nappe grave qui s'ouvre lentement. */
export function sonEveil(): void {
  const p = piste(2.5);
  if (!p) return;
  const { c, g, t } = p;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.5, t + 1.3);
  g.gain.exponentialRampToValueAtTime(0.001, t + 2.4);
  const filtre = c.createBiquadFilter();
  filtre.type = 'lowpass';
  filtre.frequency.setValueAtTime(160, t);
  filtre.frequency.exponentialRampToValueAtTime(1500, t + 1.9);
  const volume = c.createGain();
  volume.gain.value = 0.22;
  volume.connect(filtre).connect(g);
  // Trois notes graves à la quinte et à l'octave : stable, sans mélodie.
  [55, 82.4, 110.3].forEach((frequence) => oscillateur(c, 'sawtooth', volume, t, t + 2.5).frequency.setValueAtTime(frequence, t));
}

/** L'entrée dans le site, à la fin de l'introduction : le son d'une traversée, en plus court. */
export function sonEntree(): void {
  sonVoyage('aller', 1);
}

/**
 * Les sons de la première introduction (l'arrivée sur le site) : toujours joués, à 5 %, même si les effets
 * sont coupés dans les réglages (demande de Mathéo). Les autres portails, eux, suivent les réglages.
 * Si le navigateur n'autorise pas encore le son (aucun geste du visiteur), le premier geste pendant
 * l'introduction le débloque, et le son en attente part à ce moment-là : c'est la règle des navigateurs.
 */
let enAttente: 'eveil' | 'entree' | null = null;
export function sonIntro(quoi: 'eveil' | 'entree'): void {
  // (La case « Son de l'introduction » du panneau, décochée : le site s'ouvre en silence.)
  if (!reglages.sonAuLancement) return;
  const c = contexte();
  if (!c) return;
  if (c.state !== 'running') {
    enAttente = quoi;
    return;
  }
  enAttente = null;
  forcerIntro = true;
  try {
    if (quoi === 'eveil') sonEveil();
    else sonEntree();
  } finally {
    forcerIntro = false;
  }
}
/** Pendant l'introduction, le premier geste réveille le son (même si les effets sont coupés). */
export function preparerSonIntro(): () => void {
  const ctx = contexte();
  const debloquer = () => {
    if (!ctx || ctx.state === 'running') return;
    void ctx.resume().then(() => {
      if (enAttente) sonIntro(enAttente);
    });
  };
  const types = ['pointerdown', 'keydown', 'touchend'] as const;
  types.forEach((type) => window.addEventListener(type, debloquer, { capture: true, passive: true }));
  return () => {
    enAttente = null;
    types.forEach((type) => window.removeEventListener(type, debloquer, { capture: true }));
  };
}

/** Une note brève, pour le mini-jeu. Comme les autres effets, elle ne sonne que s'ils sont activés. */
export function bip(frequence: number, duree = 0.2): void {
  const p = piste(duree);
  if (!p) return;
  const { c, g, t } = p;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.22, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.001, t + duree);
  oscillateur(c, 'triangle', g, t, t + duree).frequency.setValueAtTime(frequence, t);
}

export function initSons(): void {
  // Les changements de section : le souffle du fil et la note de la section d'arrivée ;
  // entre l'accueil et Contact, le son du saut dans le temps (coupé net s'il est interrompu).
  surEtape((etape, mode, duree, rang) => {
    if (etape === 'depart') sonFil(mode, rang, duree);
    else if (etape === 'saut') sonSaut(mode, duree, rang);
    else if (etape === 'annule') couperEffets();
  });

  // Les moments du portail.
  window.addEventListener('portail', (e) => {
    const moment = (e as CustomEvent<string>).detail;
    if (moment === 'survol') sonSurvol();
    else if (moment === 'charge') sonCharge();
    else if (moment === 'relache') pisteCharge?.arret();
    else if (moment === 'rupture') {
      pisteCharge?.arret();
      sonRupture();
    } else if (moment === 'carte') sonCarte();
    else if (moment === 'destination') sonDestination();
    else if (moment === 'carte-referme') sonFermeture();
    else if (moment === 'ouvre' || moment === 'charge') pisteFermeture?.arret(); // (rouverte aussitôt : le son de fermeture s'efface)
  });

  // Les réglages : couper les effets les arrête aussitôt (le volume est suivi par le moteur commun).
  surReglage((cle) => {
    if (cle === 'sons' && !reglages.sons) couperEffets();
    if (cle === 'sons' && reglages.sons) contexte();
  });

  // ---- Démarrage ----
  // Le moteur est préparé tout de suite si les effets sont actifs. Si le navigateur autorise déjà le son
  // (cela arrive quand on revient sur le site), les effets s'entendent dès le chargement. Sinon, le
  // premier geste du visiteur (clic, touche) le débloque : c'est une règle des navigateurs. La musique,
  // elle, ne démarre jamais seule (DREAM RADIO).
  if (reglages.sons) contexte();
  const reveiller = () => {
    const ctx = contexte();
    if (ctx?.state === 'suspended' && !document.hidden) void ctx.resume().catch(() => undefined);
  };
  (['pointerdown', 'pointerup', 'keydown', 'touchend'] as const).forEach((type) => window.addEventListener(type, reveiller, { capture: true, passive: true }));

  // Onglet masqué : on met le moteur en pause pour ne rien jouer en arrière-plan (les radios se taisent aussi).
  document.addEventListener('visibilitychange', () => {
    const ctx = contexteExistant();
    if (!ctx) return;
    if (document.hidden) void ctx.suspend();
    else void ctx.resume().catch(() => undefined);
  });
}
