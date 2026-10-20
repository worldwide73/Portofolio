// RUSH RADIO : la musique de Portal Rush (16 octobre 2026).
// Elle joue en entrant dans le jeu (si le joueur ne l'a pas coupée dans ses réglages), se tait à la
// sortie, et n'est jamais en même temps que DREAM RADIO : celle-ci s'efface à l'entrée (sa position est
// gardée) et reprend à la sortie seulement si elle jouait. Ses préférences (piste, volume, sourdine) sont
// gardées dans la sauvegarde du jeu (rush/sauvegarde.ts).
// Musique adaptative : « Néon Rush » et « Hyperlane » sont écrites en couches séparées (nappe, basse,
// batterie, arpège, mélodie, tension) que la course dose (radio.ts, « adapter ») : départ, vitesse,
// danger, Overdrive, pause, défaite, victoire. Les deux morceaux enregistrés n'ont pas de couches : la
// course ne fait que les filtrer et doser leur volume, et le lecteur le dit.

import { CATALOGUE_RUSH } from './catalogue';
import { hyperlane, neonRush, type Fabrique } from './compositions';
import { versPiste } from './dream';
import { Radio, type Stockage } from './radio';

const COMPOSITIONS: Record<string, Fabrique> = { 'neon-rush': neonRush, hyperlane };

export function creerRushRadio(stockage: Stockage): Radio {
  return new Radio(
    'rush',
    CATALOGUE_RUSH.map((e) => versPiste(e, COMPOSITIONS, 'original')),
    stockage,
    0.6,
  );
}
