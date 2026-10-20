// LE MOTEUR AUDIO COMMUN (Portal Rush V4, 16 octobre 2026).
// Un seul AudioContext pour tout le site, et deux canaux qui ne se mélangent jamais :
//   - le canal des EFFETS (portail, carte, voyages, Portal Rush) : son volume est celui des réglages
//     (« Effets sonores ») ; il se coupe avec la case du panneau ;
//   - le canal de la MUSIQUE : DREAM RADIO (le portfolio) et RUSH RADIO (le jeu) y jouent, l'une ou
//     l'autre, jamais les deux (radio.ts). Chaque radio garde son volume ; le canal n'en a pas.
// Entre la musique et la sortie, un gain d'ATTÉNUATION (« ducking ») : quand un grand effet sonore
// joue vraiment (le portail se brise, la carte s'ouvre, une traversée), la musique baisse de 10 à 25 %
// le temps de l'effet, puis remonte en douceur. Le volume choisi par le visiteur reste la référence :
// l'atténuation n'est qu'un écart temporaire, et des effets rapprochés ne la font pas « pomper »
// (elle se prolonge au lieu de redescendre et remonter à chaque fois).
// Un limiteur en bout de chaîne : rien ne sature, même superposé.

import { reglages, surReglage } from '../reglages';

let ctx: AudioContext | null = null;
let effets: GainNode | null = null;
let musique: GainNode | null = null;
let attenuation: GainNode | null = null;
let intro: GainNode | null = null;
let bruit: AudioBuffer | null = null;
const prets: ((c: AudioContext) => void)[] = [];

/** Le volume du canal des effets : celui des réglages. */
const volumeEffets = () => reglages.volumeSons;
/** Le son de la toute première introduction : 5 %, quels que soient les réglages (voir sons.ts). */
export const VOLUME_INTRO = 0.05;

/** Crée le moteur audio au premier besoin. Les navigateurs exigent un geste du visiteur avant de jouer. */
export function contexte(): AudioContext | null {
  if (ctx) {
    if (ctx.state === 'suspended' && !document.hidden) void ctx.resume().catch(() => undefined);
    return ctx;
  }
  const Classe = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Classe) return null;
  try {
    ctx = new Classe();
  } catch {
    return null;
  }
  const limiteur = ctx.createDynamicsCompressor();
  limiteur.threshold.value = -14;
  limiteur.ratio.value = 6;
  limiteur.connect(ctx.destination);
  effets = ctx.createGain();
  effets.gain.value = volumeEffets();
  effets.connect(limiteur);
  attenuation = ctx.createGain();
  attenuation.gain.value = 1;
  attenuation.connect(limiteur);
  musique = ctx.createGain();
  musique.gain.value = 1;
  musique.connect(attenuation);
  intro = ctx.createGain();
  intro.gain.value = VOLUME_INTRO;
  intro.connect(limiteur);
  // Deux secondes de bruit blanc, réutilisées par tous les souffles.
  bruit = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = bruit.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const c = ctx;
  prets.splice(0).forEach((fn) => fn(c));
  return ctx;
}

/** Appelle « fn » dès que le moteur existe (tout de suite s'il existe déjà). */
export function quandMoteur(fn: (c: AudioContext) => void): void {
  if (ctx) fn(ctx);
  else prets.push(fn);
}

export const enMarche = () => ctx?.state === 'running';
/** Le moteur s'il existe déjà (sans le créer). */
export const contexteExistant = () => ctx;
export const canalEffets = () => effets;
export const canalMusique = () => musique;
export const canalIntro = () => intro;
export const bruitBlanc = () => bruit;

// ---- L'atténuation de la musique pendant les grands effets ----
let finAttenuation = 0;
let profondeurEnCours = 0;
let remontee = 0;

/**
 * Baisse la musique de « profondeur » (0.1 à 0.25) pendant « duree » secondes, puis la remonte en douceur.
 * À n'appeler que pour un effet réellement joué (sons.ts l'appelle après avoir programmé l'effet) : si les
 * effets sont coupés, ou si aucune musique ne joue, rien ne bouge.
 */
export function attenuerMusique(profondeur: number, duree: number): void {
  if (!ctx || !attenuation || !reglages.sons || ctx.state !== 'running') return;
  const p = Math.min(0.25, Math.max(0.1, profondeur));
  const t = ctx.currentTime;
  const fin = t + duree;
  const g = attenuation.gain;
  // Déjà baissée au moins autant : on prolonge seulement (pas de nouvelle descente, pas de « pompage »).
  if (t < finAttenuation && profondeurEnCours >= p) {
    finAttenuation = Math.max(finAttenuation, fin);
  } else {
    profondeurEnCours = Math.max(p, t < finAttenuation ? profondeurEnCours : 0);
    finAttenuation = Math.max(finAttenuation, fin);
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.setTargetAtTime(1 - profondeurEnCours, t, 0.07);
  }
  window.clearTimeout(remontee);
  remontee = window.setTimeout(() => {
    if (!ctx || !attenuation) return;
    const t2 = ctx.currentTime;
    attenuation.gain.cancelScheduledValues(t2);
    attenuation.gain.setValueAtTime(attenuation.gain.value, t2);
    attenuation.gain.setTargetAtTime(1, t2, 0.32);
    profondeurEnCours = 0;
    finAttenuation = 0;
  }, Math.max(0, (finAttenuation - t) * 1000));
}

/** La profondeur d'atténuation en cours (0 : aucune). Pour les recettes. */
export const attenuationEnCours = () => (attenuation ? 1 - attenuation.gain.value : 0);

// Les réglages : le volume des effets suit le curseur du panneau.
surReglage((cle) => {
  if (cle === 'volumeSons' && effets && ctx) effets.gain.setTargetAtTime(volumeEffets(), ctx.currentTime, 0.05);
});

// ---- Le chargement des sons enregistrés (effets courts) ----
const tampons = new Map<string, Promise<AudioBuffer | null>>();
/** Charge et décode un son de public/audio/ une seule fois (null s'il est introuvable ou illisible). */
export function tampon(src: string): Promise<AudioBuffer | null> {
  let p = tampons.get(src);
  if (!p) {
    p = fetch(src)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((brut) => {
        const c = contexte();
        return c ? c.decodeAudioData(brut) : null;
      })
      .catch(() => null);
    tampons.set(src, p);
  }
  return p;
}
/** Le tampon s'il est déjà décodé (sinon null, et son chargement commence). */
const decodes = new Map<string, AudioBuffer | null>();
export function tamponPret(src: string): AudioBuffer | null {
  if (decodes.has(src)) return decodes.get(src) ?? null;
  void tampon(src).then((b) => decodes.set(src, b));
  return null;
}
