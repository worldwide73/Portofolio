// RUSH RADIO : la musique de Portal Rush (16 octobre 2026).
// Elle joue en entrant dans le jeu (si le joueur ne l'a pas coupée dans ses réglages), se tait à la
// sortie, et n'est jamais en même temps que DREAM RADIO : celle-ci s'efface à l'entrée (sa position est
// gardée) et reprend à la sortie seulement si elle jouait. Ses préférences (piste, volume, sourdine) sont
// gardées dans la sauvegarde du jeu (rush/sauvegarde.ts).

import { CATALOGUE_RUSH } from './catalogue';
import type { Fabrique } from './compositions';
import { versPiste } from './dream';
import { Radio, type Stockage } from './radio';

const COMPOSITIONS: Record<string, Fabrique> = {};

export function creerRushRadio(stockage: Stockage): Radio {
  return new Radio(
    'rush',
    CATALOGUE_RUSH.map((e) => versPiste(e, COMPOSITIONS, 'original')),
    stockage,
    0.6,
  );
}
