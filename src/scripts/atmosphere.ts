// L'ATMOSPHÈRE : applique l'ambiance choisie dans le panneau des réglages.
// Quatre ambiances facultatives (Chill, Deep Space, Focus, Silence), décrites
// en chiffres dans ambiances.ts. Ici :
//   - la scène glisse en douceur vers ses nouvelles valeurs (vitesse, brume,
//     lumière, éclairs) : gl/champ.ts les lit à chaque image ;
//   - le rythme de toutes les animations de l'interface change (plus lent en
//     Chill, plus court en Focus) ;
//   - la piste de musique associée est mise en route (le visiteur peut
//     ensuite en choisir une autre dans le lecteur).
// Les volumes sont ajustés par sons.ts, la lueur de l'interface par reglages.ts.

import gsap from 'gsap';
import { AMBIANCES, ambiance } from './ambiances';
import { mouvementReduit } from './outils';
import { reglages, regler, surReglage } from './reglages';

export function initAtmosphere(): void {
  const poser = (enDouceur: boolean) => {
    const { vitesse, brume, douceur, bleu, eclats, lampe, rythme } = AMBIANCES[reglages.atmosphere];
    gsap.globalTimeline.timeScale(mouvementReduit ? 1 : rythme);
    if (enDouceur) gsap.to(ambiance, { vitesse, brume, douceur, bleu, eclats, lampe, duration: 1.4, ease: 'power2.inOut', overwrite: true });
    else Object.assign(ambiance, { vitesse, brume, douceur, bleu, eclats, lampe });
  };

  poser(false);
  surReglage((cle) => {
    if (cle !== 'atmosphere') return;
    poser(true);
    const piste = AMBIANCES[reglages.atmosphere].piste;
    if (piste) regler('piste', piste);
  });
}
