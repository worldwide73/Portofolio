// PORTAL RUSH 3D — LA LISTE DES MONDES
// Un kit par thème (voir mondes.ts et mondes2.ts). Le défi du jour reprend la
// station de lancement sous une lumière dorée ; la survie parcourt les huit mondes.

import type { Theme } from '../donnees';
import { LANCEMENT, type Kit } from './mondes';
import { DEBRIS, LASER, NEON, RIFT, SENTINELLE, SINGULARITE, TEMPETE } from './mondes2';

const DEFI: Kit = {
  ...LANCEMENT,
  palette: { ...LANCEMENT.palette, horizon: '#3a2a14', nebuleuse1: '#5a3a14', soleil: '#ffd890', ciel: '#a88a5a', brouillard: '#1c150c', accent: '#ffd678', accent2: '#ffb04a' },
};

export const KITS: Record<Theme, Kit> = {
  lancement: LANCEMENT,
  neon: NEON,
  debris: DEBRIS,
  laser: LASER,
  rift: RIFT,
  tempete: TEMPETE,
  sentinelle: SENTINELLE,
  singularite: SINGULARITE,
  infini: LANCEMENT,
  defi: DEFI,
};

export const kitDe = (theme: Theme): Kit => KITS[theme] ?? LANCEMENT;
