// LES COMPOSITIONS ORIGINALES, JOUÉES EN DIRECT PAR LE CODE (Web Audio API).
// Aucune n'imite un morceau existant : ce sont des partitions écrites pour ce site, jouées par des
// oscillateurs, du bruit filtré et des cordes pincées synthétisées (algorithme de Karplus-Strong).
// Elles ont une vraie durée (une introduction, des parties, une fin) : la radio affiche leur
// progression et passe à la piste suivante quand elles se terminent.
//
// Une composition reçoit le moteur audio, sa sortie et l'instant où reprendre (en secondes : une piste
// mise en pause reprend à la mesure où elle s'était arrêtée). Elle renvoie de quoi l'arrêter et savoir
// où elle en est. Les compositions de RUSH RADIO (adaptatives) exposent aussi leurs couches.

export interface Lecture {
  /** Arrête la composition (les notes déjà lancées s'éteignent d'elles-mêmes). */
  arret(): void;
  /** Le temps écoulé depuis le début du morceau (s). */
  position(): number;
  /** La durée du morceau (s). */
  duree: number;
  /** Les couches séparées (batterie, basse, arpèges…), pour la musique adaptative de Portal Rush. */
  couches?: Record<string, GainNode>;
}
export type Fabrique = (c: AudioContext, vers: AudioNode, depuis: number, bruit: AudioBuffer | null) => Lecture;

// ---- Les briques ----
/** La fréquence d'une note d'après son numéro MIDI (69 = la 440 Hz). */
export const hauteur = (numero: number) => 440 * 2 ** ((numero - 69) / 12);

export function oscillateur(c: AudioContext, type: OscillatorType, vers: AudioNode, debut: number, fin: number): OscillatorNode {
  const o = c.createOscillator();
  o.type = type;
  o.connect(vers);
  o.start(debut);
  o.stop(fin);
  return o;
}

/** Une note seule, avec sa propre enveloppe : attaque rapide, extinction douce. */
export function note(c: AudioContext, vers: AudioNode, frequence: number, debut: number, duree: number, volume: number, type: OscillatorType = 'sine', attaque = 0.014): OscillatorNode {
  const vol = c.createGain();
  vol.gain.setValueAtTime(0, debut);
  vol.gain.linearRampToValueAtTime(volume, debut + attaque);
  vol.gain.exponentialRampToValueAtTime(0.0001, debut + duree);
  vol.connect(vers);
  const o = oscillateur(c, type, vol, debut, debut + duree + 0.02);
  o.frequency.setValueAtTime(frequence, debut);
  return o;
}

/** Un souffle : du bruit blanc filtré. */
export function souffle(c: AudioContext, bruit: AudioBuffer | null, vers: AudioNode, debut: number, fin: number): { filtre: BiquadFilterNode; source: AudioBufferSourceNode } {
  const source = c.createBufferSource();
  source.buffer = bruit;
  source.loop = true;
  const filtre = c.createBiquadFilter();
  filtre.type = 'bandpass';
  filtre.Q.value = 0.9;
  source.connect(filtre).connect(vers);
  source.start(debut, Math.random() * 1.5);
  source.stop(fin);
  return { filtre, source };
}

/** Un coup bref de bruit filtré (charleston, shaker, claquement). */
export function coupDeBruit(c: AudioContext, bruit: AudioBuffer | null, vers: AudioNode, quand: number, volume: number, duree: number, type: BiquadFilterType, frequence: number, q = 0.8): void {
  const vol = c.createGain();
  vol.connect(vers);
  vol.gain.setValueAtTime(0.0001, quand);
  vol.gain.exponentialRampToValueAtTime(volume, quand + 0.003);
  vol.gain.exponentialRampToValueAtTime(0.0001, quand + duree);
  const { filtre } = souffle(c, bruit, vol, quand, quand + duree + 0.02);
  filtre.type = type;
  filtre.frequency.value = frequence;
  filtre.Q.value = q;
}

/** Une grosse caisse : une sinusoïde qui plonge. */
export function grosseCaisse(c: AudioContext, vers: AudioNode, quand: number, volume: number, f0 = 110, f1 = 42, duree = 0.32): void {
  const vol = c.createGain();
  vol.connect(vers);
  vol.gain.setValueAtTime(0.0001, quand);
  vol.gain.exponentialRampToValueAtTime(volume, quand + 0.005);
  vol.gain.exponentialRampToValueAtTime(0.0001, quand + duree);
  const o = oscillateur(c, 'sine', vol, quand, quand + duree + 0.02);
  o.frequency.setValueAtTime(f0, quand);
  o.frequency.exponentialRampToValueAtTime(f1, quand + duree * 0.7);
}

/** Une réverbération : une réponse d'impulsion fabriquée (bruit qui s'éteint), en stéréo. */
export function reverb(c: AudioContext, duree = 2.4, decroissance = 2.6): ConvolverNode {
  const n = Math.round(c.sampleRate * duree);
  const ir = c.createBuffer(2, n, c.sampleRate);
  for (let canal = 0; canal < 2; canal++) {
    const d = ir.getChannelData(canal);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** decroissance;
  }
  const conv = c.createConvolver();
  conv.buffer = ir;
  return conv;
}

// ---- Les cordes pincées (Karplus-Strong), calculées une fois par note ----
const cordes = new Map<string, AudioBuffer>();
/**
 * Le son d'une corde pincée : un court bruit qui circule dans une boucle de la longueur de la note,
 * et s'adoucit à chaque tour (c'est le principe de Karplus-Strong). « eclat » : la brillance de l'attaque.
 */
export function corde(c: AudioContext, numero: number, eclat = 0.5, duree = 2.6): AudioBuffer {
  const cle = `${numero}-${eclat}-${c.sampleRate}`;
  const deja = cordes.get(cle);
  if (deja) return deja;
  const sr = c.sampleRate;
  const f = hauteur(numero);
  const n = Math.round(sr * duree);
  const buf = c.createBuffer(1, n, sr);
  const y = buf.getChannelData(0);
  // La boucle dure une période ; la moyenne de deux échantillons ajoute un demi-échantillon de retard,
  // et le reste (la partie fractionnaire) est interpolé, pour que la note soit juste.
  const periode = sr / f - 0.5;
  const N = Math.max(2, Math.floor(periode));
  const frac = periode - N;
  // L'excitation : du bruit, lissé selon l'éclat (plus lisse = attaque plus douce, comme au pouce).
  let prec = 0;
  for (let i = 0; i < N + 2; i++) {
    const b = Math.random() * 2 - 1;
    prec = prec + (b - prec) * (0.25 + eclat * 0.7);
    y[i] = prec;
  }
  // La corde : chaque échantillon est la moyenne de deux échantillons d'une période plus tôt, un peu amortie.
  // (L'amortissement dépend de la hauteur : les graves tiennent plus longtemps, comme sur une guitare.)
  const perte = Math.min(0.9993, 0.9962 + 0.5 / f);
  for (let i = N + 2; i < n; i++) {
    const a = 0.5 * (y[i - N] + y[i - N - 1]);
    const b = 0.5 * (y[i - N - 1] + y[i - N - 2]);
    y[i] = perte * (a * (1 - frac) + b * frac);
  }
  // Le pincement près du chevalet : on retire un peu de l'écho de l'attaque (timbre plus « boisé »).
  const decalage = Math.max(1, Math.round(N * 0.18));
  let max = 0;
  for (let i = n - 1; i >= decalage; i--) {
    y[i] = y[i] - 0.45 * y[i - decalage];
    max = Math.max(max, Math.abs(y[i]));
  }
  if (max > 0) for (let i = 0; i < n; i++) y[i] /= max;
  // Une extinction douce à la fin du tampon.
  const queue = Math.round(sr * 0.25);
  for (let i = 0; i < queue; i++) y[n - 1 - i] *= i / queue;
  cordes.set(cle, buf);
  return buf;
}

/** Pince une corde : « glisse » (en demi-tons) fait partir la note d'un peu plus bas (un glissé de guitare). */
export function pincer(c: AudioContext, vers: AudioNode, numero: number, quand: number, volume: number, eclat = 0.5, glisse = 0, vibrato: AudioNode | null = null): AudioBufferSourceNode {
  const s = c.createBufferSource();
  s.buffer = corde(c, numero, eclat);
  const g = c.createGain();
  g.gain.value = volume;
  s.connect(g).connect(vers);
  if (glisse) {
    s.playbackRate.setValueAtTime(2 ** (-glisse / 12), quand);
    s.playbackRate.setTargetAtTime(1, quand + 0.04, 0.05);
  }
  if (vibrato) vibrato.connect(s.detune);
  s.start(quand);
  return s;
}

/**
 * Le séquenceur : appelle « jouer » à chaque pas (une mesure, en général), un peu en avance sur l'horloge
 * audio, du pas « premier » jusqu'au dernier. C'est ainsi qu'on tient un rythme régulier, même si la page
 * est occupée ailleurs. Il renvoie l'arrêt et la position dans le morceau.
 */
export function sequencer(c: AudioContext, pas: number, total: number, depuis: number, jouer: (quand: number, numero: number) => void): { arret: () => void; position: () => number } {
  const premier = Math.max(0, Math.min(total - 1, Math.floor(depuis / pas)));
  // L'origine virtuelle du morceau : la mesure « premier » tombe dans 0,12 s.
  const origine = c.currentTime + 0.12 - premier * pas;
  let numero = premier;
  const avancer = () => {
    while (numero < total && origine + numero * pas < c.currentTime + 1.4) {
      jouer(origine + numero * pas, numero);
      numero++;
    }
  };
  avancer();
  const minuterie = window.setInterval(avancer, 300);
  return { arret: () => window.clearInterval(minuterie), position: () => Math.max(0, c.currentTime - origine) };
}

// ==========================================================================
// DREAM RADIO : les compositions du portfolio
// ==========================================================================

/**
 * « Cordes du soir » : une guitare en arpèges, chaude et lente (84 battements par minute), sur une
 * grille en la majeur (Amaj9, F♯m9, Dmaj9, E sus4 → E). Elle entre seule, puis une batterie feutrée et
 * une basse ronde la rejoignent, une mélodie glissée passe au milieu, et elle finit seule à nouveau.
 */
export const cordesDuSoir: Fabrique = (c, vers, depuis, bruit) => {
  const TEMPS = 60 / 84;
  const MESURE = TEMPS * 4;
  const TOTAL = 64;
  const sortie = c.createGain();
  sortie.connect(vers);
  // La chaleur : un filtre doux sur tout, et une salle (réverbération) autour de la guitare.
  const chaleur = c.createBiquadFilter();
  chaleur.type = 'lowpass';
  chaleur.frequency.value = 5200;
  chaleur.Q.value = 0.3;
  chaleur.connect(sortie);
  const salle = reverb(c, 2.6, 2.4);
  const retour = c.createGain();
  retour.gain.value = 0.32;
  salle.connect(retour).connect(chaleur);
  const guitare = c.createGain();
  guitare.gain.value = 0.42;
  guitare.connect(chaleur);
  guitare.connect(salle);
  // Un léger flottement de bande (vibrato très lent, ±5 cents) sur la guitare.
  const ondulation = c.createOscillator();
  const ampleur = c.createGain();
  ondulation.frequency.value = 0.23;
  ampleur.gain.value = 5;
  ondulation.connect(ampleur);
  ondulation.start();
  const batterie = c.createGain();
  batterie.gain.value = 0.5;
  batterie.connect(chaleur);
  const basse = c.createGain();
  basse.gain.value = 0.22;
  basse.connect(sortie);
  const nappe = c.createBiquadFilter();
  nappe.type = 'lowpass';
  nappe.frequency.value = 900;
  nappe.connect(salle);
  nappe.connect(chaleur);

  // Les accords : la basse, puis les cordes de l'arpège (numéros MIDI).
  const GRILLE = [
    { basse: 45, cordes: [52, 56, 59, 61, 64, 68] }, // Amaj9
    { basse: 42, cordes: [49, 52, 56, 57, 61, 64] }, // F♯m9
    { basse: 50, cordes: [57, 61, 64, 66, 69, 73] }, // Dmaj9
    { basse: 40, cordes: [52, 57, 59, 64, 68, 71] }, // E sus4 → E
  ];
  // Le motif de l'arpège, sur huit croches (indices dans les cordes de l'accord).
  const MOTIF = [0, 3, 2, 4, 1, 5, 3, 2];
  // La mélodie du milieu : (croche de départ dans la mesure, note, durée en croches), sur quatre mesures.
  const MELODIE: [number, number, number][][] = [
    [[0, 76, 3], [3, 73, 2], [5, 71, 3]],
    [[0, 73, 4], [4, 69, 2], [6, 71, 2]],
    [[0, 69, 3], [3, 71, 2], [5, 73, 3]],
    [[0, 71, 5], [5, 68, 3]],
  ];
  const balance = (k: number) => (k % 2 ? TEMPS * 0.5 * 0.12 : 0); // un très léger balancement des contretemps

  const seq = sequencer(c, MESURE, TOTAL, depuis, (quand, m) => {
    const accord = GRILLE[m % 4];
    const fin = m >= 56;
    const avecRythme = m >= 8 && m < 56;
    const avecMelodie = m >= 24 && m < 40;
    const avecNappe = m >= 40 && m < 56;
    // La guitare : la basse au premier temps, puis l'arpège ; sur E, la quarte se résout au troisième temps.
    pincer(c, guitare, accord.basse + 12, quand, 0.55, 0.35, 0, ampleur);
    MOTIF.forEach((k, i) => {
      let n = accord.cordes[k];
      if (m % 4 === 3 && i >= 4 && n === 57) n = 56;
      const vel = (i === 0 ? 0.42 : i % 2 ? 0.26 : 0.34) * (fin ? 1 - (m - 56) / 10 : 1);
      pincer(c, guitare, n, quand + i * TEMPS * 0.5 + balance(i) + Math.random() * 0.008, vel, 0.45 + Math.random() * 0.15, 0, ampleur);
    });
    // Un accord gratté doucement toutes les deux mesures, au quatrième temps et demi.
    if (m % 2 === 1 && !fin) accord.cordes.slice(1, 5).forEach((n, i) => pincer(c, guitare, n, quand + TEMPS * 3.5 + i * 0.018, 0.16, 0.3, 0, ampleur));
    if (avecMelodie) {
      for (const [croche, n, longueur] of MELODIE[m % 4]) {
        pincer(c, guitare, n, quand + croche * TEMPS * 0.5, 0.36, 0.7, croche === 0 && m % 2 === 0 ? 2 : 0, ampleur);
        if (longueur >= 4) pincer(c, guitare, n - 12, quand + croche * TEMPS * 0.5 + 0.01, 0.12, 0.4);
      }
    }
    if (avecRythme) {
      // Batterie feutrée : grosse caisse au 1 et au 2 et demi, claquement au 2 et au 4, shaker en croches.
      grosseCaisse(c, batterie, quand, 0.5, 90, 44);
      grosseCaisse(c, batterie, quand + TEMPS * 1.5, 0.3, 90, 44);
      coupDeBruit(c, bruit, batterie, quand + TEMPS, 0.16, 0.12, 'bandpass', 1900, 1.4);
      coupDeBruit(c, bruit, batterie, quand + TEMPS * 3, 0.16, 0.12, 'bandpass', 1900, 1.4);
      for (let i = 0; i < 8; i++) coupDeBruit(c, bruit, batterie, quand + i * TEMPS * 0.5 + balance(i), i % 2 ? 0.035 : 0.05, 0.05, 'highpass', 7000);
      // La basse : une sinusoïde ronde, au 1 et au 3.
      note(c, basse, hauteur(accord.basse - 12), quand, TEMPS * 1.8, 0.5, 'sine', 0.02);
      note(c, basse, hauteur(accord.basse - 12), quand + TEMPS * 2, TEMPS * 1.6, 0.38, 'sine', 0.02);
    }
    if (avecNappe) accord.cordes.slice(0, 4).forEach((n) => note(c, nappe, hauteur(n), quand, MESURE * 1.1, 0.035, 'triangle', 0.8));
  });
  return {
    duree: TOTAL * MESURE,
    position: seq.position,
    arret: () => {
      seq.arret();
      ondulation.stop(c.currentTime + 3);
    },
  };
};

/** « Heure bleue » : quatre accords feutrés sur un rythme lent (72 battements par minute), avec le souffle d'un vieux disque. */
export const heureBleue: Fabrique = (c, vers, depuis, bruit) => {
  const TEMPS = 60 / 72;
  const TOTAL = 56;
  // Un accord par mesure : ré mineur 9, sol 7, do majeur 9, la mineur 9.
  const ACCORDS = [
    [50, 57, 60, 64, 65],
    [43, 53, 59, 62, 65],
    [48, 55, 59, 62, 64],
    [45, 55, 60, 64, 67],
  ];
  const voix = c.createBiquadFilter();
  voix.type = 'lowpass';
  voix.frequency.value = 1500;
  voix.Q.value = 0.4;
  voix.connect(vers);
  const disque = c.createGain();
  disque.gain.value = 0.014;
  disque.connect(vers);
  const fond = souffle(c, bruit, disque, c.currentTime, c.currentTime + TOTAL * TEMPS * 4 + 4);
  fond.filtre.frequency.value = 2400;
  fond.filtre.Q.value = 0.3;
  const touche = (numero: number, quand: number, volume: number, duree = 3.2) => {
    note(c, voix, hauteur(numero), quand, duree, volume);
    note(c, voix, hauteur(numero + 12), quand, duree * 0.45, volume * 0.22, 'triangle');
  };
  const seq = sequencer(c, TEMPS * 4, TOTAL, depuis, (quand, mesure) => {
    const accord = ACCORDS[mesure % ACCORDS.length];
    accord.forEach((numero, i) => touche(numero, quand + i * 0.028, i === 0 ? 0.11 : 0.06));
    touche(accord[3], quand + TEMPS * 2.5, 0.05, 1.8);
    touche(accord[2] + 12, quand + TEMPS * 3.25, 0.035, 1.4);
    if (mesure >= 2 && mesure < TOTAL - 2) {
      grosseCaisse(c, vers, quand, 0.16, 92, 44, 0.26);
      grosseCaisse(c, vers, quand + TEMPS * 2, 0.16, 92, 44, 0.26);
      [1, 3].forEach((t) => coupDeBruit(c, bruit, vers, quand + TEMPS * t, 0.03, 0.06, 'highpass', 5200));
      [0.5, 1.5, 2.5, 3.5].forEach((t) => coupDeBruit(c, bruit, vers, quand + TEMPS * t, 0.014, 0.06, 'highpass', 5200));
    }
  });
  return {
    duree: TOTAL * TEMPS * 4,
    position: seq.position,
    arret: () => {
      seq.arret();
      fond.source.stop(c.currentTime + 2);
    },
  };
};

/** « Dérive » : cinq notes tenues (un accord de la majeur étalé), chacune légèrement mouvante, derrière un filtre qui respire. */
export const derive: Fabrique = (c, vers, depuis) => {
  const DUREE = 240;
  const origine = c.currentTime - Math.min(depuis, DUREE - 1);
  const filtre = c.createBiquadFilter();
  filtre.type = 'lowpass';
  filtre.frequency.value = 520;
  filtre.Q.value = 0.6;
  filtre.connect(vers);
  const sources: OscillatorNode[] = [];
  const onduler = (frequence: number, profondeur: number, cible: AudioParam) => {
    const o = c.createOscillator();
    const ampleur = c.createGain();
    o.frequency.value = frequence;
    ampleur.gain.value = profondeur;
    o.connect(ampleur).connect(cible);
    o.start();
    sources.push(o);
  };
  onduler(0.045, 260, filtre.frequency);
  [110, 164.81, 220, 277.18, 329.63].forEach((frequence, i) => {
    const vol = c.createGain();
    vol.gain.value = i === 0 ? 0.2 : 0.085;
    vol.connect(filtre);
    [-4, 4].forEach((cents) => {
      const o = c.createOscillator();
      o.type = i < 2 ? 'sine' : 'triangle';
      o.frequency.value = frequence;
      o.detune.value = cents + i;
      o.connect(vol);
      o.start();
      sources.push(o);
    });
    onduler(0.03 + i * 0.011, vol.gain.value * 0.6, vol.gain);
  });
  return { duree: DUREE, position: () => c.currentTime - origine, arret: () => sources.forEach((s) => s.stop(c.currentTime + 2)) };
};

/** « Trait fin » : deux notes tenues à peine audibles, et de temps en temps une note seule qui s'éteint lentement. */
export const traitFin: Fabrique = (c, vers, depuis) => {
  const GAMME = [57, 60, 62, 64, 67, 69, 72]; // la mineur pentatonique
  const PAS = 4.5;
  const TOTAL = 40;
  const fond = c.createGain();
  fond.gain.value = 0.05;
  fond.connect(vers);
  const tenues = [45, 52].map((numero) => {
    const o = c.createOscillator();
    o.frequency.value = hauteur(numero);
    o.connect(fond);
    o.start();
    return o;
  });
  let degre = 3;
  const seq = sequencer(c, PAS, TOTAL, depuis, (quand) => {
    if (Math.random() < 0.25) return; // des silences, de temps en temps
    degre = Math.min(GAMME.length - 1, Math.max(0, degre + (Math.random() < 0.5 ? -1 : 1) * (1 + ((Math.random() * 2) | 0))));
    note(c, vers, hauteur(GAMME[degre]), quand + Math.random() * 1.2, 5, 0.1);
    if (Math.random() < 0.4) note(c, vers, hauteur(GAMME[degre] + 7), quand + 0.35, 4, 0.04);
  });
  return {
    duree: TOTAL * PAS,
    position: seq.position,
    arret: () => {
      seq.arret();
      tenues.forEach((o) => o.stop(c.currentTime + 2));
    },
  };
};

// ==========================================================================
// RUSH RADIO : les compositions adaptatives de Portal Rush
// ==========================================================================
// Une composition synthwave en six COUCHES séparées (nappe, basse, batterie, arpège, mélodie, tension),
// chacune sur son propre gain : la radio les dose selon la course (radio.ts, « adapter ») sans jamais
// toucher au tempo. Toutes les notes sont écrites pour ce site.

interface DefinitionSynth {
  tempo: number;
  mesures: number;
  /** Un accord (4 notes MIDI) par mesure, en boucle. */
  grille: number[][];
  /** La note grave de chaque mesure. */
  basses: number[];
  /** Le motif de l'arpège : 16 doubles-croches, indices dans l'accord (+4 = une octave au-dessus). */
  arpege: number[];
  /** La mélodie : par mesure (en boucle), des [double-croche, note, durée en doubles-croches]. */
  melodie: [number, number, number][][];
  /** La couleur de la nappe (fréquence du filtre). */
  couleur: number;
}

function synthwave(def: DefinitionSynth): Fabrique {
  return (c, vers, depuis, bruit) => {
    const DC = 60 / def.tempo / 4; // une double-croche
    const MESURE = DC * 16;
    const sortie = c.createGain();
    sortie.connect(vers);
    const salle = reverb(c, 1.8, 3);
    const retour = c.createGain();
    retour.gain.value = 0.22;
    salle.connect(retour).connect(sortie);
    const couche = (nom: string, valeur: number, envoi = 0) => {
      const g = c.createGain();
      g.gain.value = valeur;
      g.connect(sortie);
      if (envoi) {
        const e = c.createGain();
        e.gain.value = envoi;
        g.connect(e).connect(salle);
      }
      return [nom, g] as const;
    };
    const couches = Object.fromEntries([
      couche('nappe', 1, 0.6),
      couche('basse', 0.6),
      couche('batterie', 0),
      couche('arpege', 0.5, 0.35),
      couche('melodie', 0, 0.5),
      couche('tension', 0, 0.3),
    ]) as Record<'nappe' | 'basse' | 'batterie' | 'arpege' | 'melodie' | 'tension', GainNode>;

    // Les filtres propres à chaque voix (la nappe ronde, l'arpège brillant, la basse sourde).
    const filtreNappe = c.createBiquadFilter();
    filtreNappe.type = 'lowpass';
    filtreNappe.frequency.value = def.couleur;
    filtreNappe.Q.value = 0.7;
    filtreNappe.connect(couches.nappe);
    const filtreArp = c.createBiquadFilter();
    filtreArp.type = 'lowpass';
    filtreArp.frequency.value = 3200;
    filtreArp.Q.value = 5;
    filtreArp.connect(couches.arpege);
    // (L'arpège « respire » : son filtre s'ouvre et se ferme lentement.)
    const lfo = c.createOscillator();
    const lfoGain = c.createGain();
    lfo.frequency.value = 60 / def.tempo / 8;
    lfoGain.gain.value = 1600;
    lfo.connect(lfoGain).connect(filtreArp.frequency);
    lfo.start();
    const filtreBasse = c.createBiquadFilter();
    filtreBasse.type = 'lowpass';
    filtreBasse.frequency.value = 420;
    filtreBasse.Q.value = 3;
    filtreBasse.connect(couches.basse);
    const vibrato = c.createOscillator();
    const vibratoGain = c.createGain();
    vibrato.frequency.value = 5.2;
    vibratoGain.gain.value = 9;
    vibrato.connect(vibratoGain);
    vibrato.start();

    /** Une voix de synthé : deux dents de scie désaccordées, enveloppe ADSR simple. */
    const voix = (vers2: AudioNode, numero: number, quand: number, duree: number, volume: number, attaque: number, type: OscillatorType = 'sawtooth', ecart = 7, vib = false) => {
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, quand);
      g.gain.linearRampToValueAtTime(volume, quand + attaque);
      g.gain.setValueAtTime(volume, quand + Math.max(attaque, duree - 0.08));
      g.gain.exponentialRampToValueAtTime(0.0001, quand + duree + 0.12);
      g.connect(vers2);
      for (const d of [-ecart, ecart]) {
        const o = oscillateur(c, type, g, quand, quand + duree + 0.16);
        o.frequency.setValueAtTime(hauteur(numero), quand);
        o.detune.value = d;
        if (vib) vibratoGain.connect(o.detune);
      }
    };

    const seq = sequencer(c, MESURE, def.mesures, depuis, (quand, m) => {
      const accord = def.grille[m % def.grille.length];
      const fond = def.basses[m % def.basses.length];
      // La nappe : l'accord tenu toute la mesure, attaque lente.
      accord.forEach((n) => voix(filtreNappe, n, quand, MESURE * 0.98, 0.045, 0.35, 'sawtooth', 9));
      // La basse : des croches qui roulent (fondamentale, octave).
      for (let i = 0; i < 8; i++) {
        const n = fond + (i % 2 ? 12 : 0);
        voix(filtreBasse, n - 12, quand + i * DC * 2, DC * 1.7, 0.16, 0.006, 'sawtooth', 4);
      }
      // La batterie : grosse caisse sur les temps, caisse claire au 2 et au 4, charleston en doubles-croches.
      const batterie = couches.batterie;
      for (let t = 0; t < 4; t++) grosseCaisse(c, batterie, quand + t * DC * 4, 0.55, 120, 40, 0.28);
      for (const t of [1, 3]) {
        coupDeBruit(c, bruit, batterie, quand + t * DC * 4, 0.3, 0.18, 'bandpass', 1800, 0.9);
        note(c, batterie, 190, quand + t * DC * 4, 0.12, 0.18, 'triangle', 0.002);
      }
      for (let i = 0; i < 16; i++) coupDeBruit(c, bruit, batterie, quand + i * DC, i % 4 === 2 ? 0.06 : 0.03, i % 4 === 2 ? 0.12 : 0.04, 'highpass', 8000);
      // L'arpège : les notes de l'accord, une à deux octaves plus haut.
      def.arpege.forEach((k, i) => {
        const n = accord[k % 4] + 12 * (1 + Math.floor(k / 4));
        voix(filtreArp, n, quand + i * DC, DC * 0.8, 0.05, 0.004, 'square', 3);
      });
      // La mélodie : une phrase par mesure, avec un léger vibrato.
      for (const [dc, n, longueur] of def.melodie[m % def.melodie.length]) voix(couches.melodie, n, quand + dc * DC, longueur * DC, 0.07, 0.02, 'sawtooth', 5, true);
      // La tension : un souffle qui monte sur deux mesures, et une pulsation aiguë.
      if (m % 2 === 0) {
        const g = c.createGain();
        g.connect(couches.tension);
        g.gain.setValueAtTime(0.0001, quand);
        g.gain.exponentialRampToValueAtTime(0.12, quand + MESURE * 1.9);
        g.gain.exponentialRampToValueAtTime(0.0001, quand + MESURE * 2);
        const { filtre } = souffle(c, bruit, g, quand, quand + MESURE * 2 + 0.05);
        filtre.Q.value = 6;
        filtre.frequency.setValueAtTime(400, quand);
        filtre.frequency.exponentialRampToValueAtTime(6000, quand + MESURE * 2);
      }
      for (let i = 0; i < 16; i += 2) note(c, couches.tension, hauteur(accord[3] + 24), quand + i * DC, DC * 0.6, 0.03, 'square', 0.002);
    });
    return {
      duree: def.mesures * MESURE,
      position: seq.position,
      couches,
      arret: () => {
        seq.arret();
        lfo.stop(c.currentTime + 2);
        vibrato.stop(c.currentTime + 2);
      },
    };
  };
}

/** « Néon Rush » : 124 battements par minute, la mineur (Am7 – Fmaj7 – Cadd9 – G). */
export const neonRush: Fabrique = synthwave({
  tempo: 124,
  mesures: 96,
  grille: [
    [57, 60, 64, 67],
    [53, 57, 60, 64],
    [48, 55, 60, 62],
    [55, 59, 62, 67],
  ],
  basses: [45, 41, 48, 43],
  arpege: [0, 1, 2, 4, 2, 1, 3, 5, 0, 2, 4, 6, 4, 2, 3, 1],
  melodie: [
    [[0, 76, 3], [3, 74, 3], [6, 72, 2], [8, 71, 4], [12, 72, 4]],
    [[0, 72, 6], [6, 69, 2], [8, 67, 4], [12, 69, 4]],
    [[0, 67, 3], [3, 72, 3], [6, 74, 2], [8, 76, 6], [14, 74, 2]],
    [[0, 74, 4], [4, 71, 4], [8, 67, 6], [14, 71, 2]],
  ],
  couleur: 1300,
});

/** « Hyperlane » : 136 battements par minute, ré mineur (Dm – B♭ – F – C), plus sombre et plus serré. */
export const hyperlane: Fabrique = synthwave({
  tempo: 136,
  mesures: 112,
  grille: [
    [50, 53, 57, 62],
    [46, 50, 53, 58],
    [53, 57, 60, 65],
    [48, 52, 55, 60],
  ],
  basses: [38, 46, 41, 48],
  arpege: [0, 2, 1, 3, 4, 2, 5, 3, 0, 4, 2, 6, 5, 3, 4, 7],
  melodie: [
    [[0, 74, 2], [2, 77, 2], [4, 81, 4], [8, 79, 2], [10, 77, 2], [12, 74, 4]],
    [[0, 70, 4], [4, 74, 2], [6, 77, 2], [8, 74, 8]],
    [[0, 77, 2], [2, 81, 2], [4, 84, 4], [8, 81, 2], [10, 79, 2], [12, 77, 4]],
    [[0, 76, 6], [6, 72, 2], [8, 74, 8]],
  ],
  couleur: 1000,
});
