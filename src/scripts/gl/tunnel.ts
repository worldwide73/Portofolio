// LE TUNNEL DE LUMIÈRE : une toile WebGL posée par-dessus toute la page (.voyage).
// Son dessin est dans tunnel.frag.glsl. Ici, on ne fait que le préparer (au
// premier besoin seulement), le dessiner à chaque image tant qu'il est ouvert,
// puis l'effacer. Deux modules s'en servent :
//   - voyage.ts, pour l'éclair de la fin de l'introduction et de la rupture du portail ;
//   - saut.ts, pour la traversée du saut dans le temps entre l'accueil et Contact.
// Ils l'animent en modifiant les nombres de « tunnel » (avec GSAP).

import gsap from 'gsap';
import { Mesh, Program, Renderer, Triangle } from 'ogl';
import tunnelFrag from './tunnel.frag.glsl?raw';

/**
 * L'état du tunnel, lu à chaque image.
 * force : 0 = invisible, 1 = plein écran ; distance : le chemin parcouru (il
 * augmente quand on avance, diminue quand on recule) ; vitesse : l'étirement
 * des filets de lumière ; saut : 1 pour la torsion du « saut dans le temps ».
 */
export const tunnel = { force: 0, distance: 0, vitesse: 0, saut: 0 };

let dessiner: (() => void) | null = null;
let ouvert = false;

function preparer(): boolean {
  if (dessiner) return true;
  const toile = document.querySelector<HTMLCanvasElement>('.voyage canvas');
  if (!toile) return false;
  let renderer: Renderer;
  try {
    renderer = new Renderer({ canvas: toile, dpr: Math.min(window.devicePixelRatio || 1, 1.5), alpha: true, premultipliedAlpha: true });
  } catch {
    return false;
  }
  const gl = renderer.gl;
  if (!renderer.isWebgl2) return false;
  gl.clearColor(0, 0, 0, 0);

  const u = {
    uRes: { value: [1, 1] },
    uForce: { value: 0 },
    uDistance: { value: 0 },
    uVitesse: { value: 0 },
    uSaut: { value: 0 },
    uClair: { value: 0 },
  };
  const plan = new Mesh(gl, {
    geometry: new Triangle(gl),
    program: new Program(gl, {
      vertex: '#version 300 es\nin vec2 position;\nvoid main() { gl_Position = vec4(position, 0.0, 1.0); }',
      fragment: tunnelFrag,
      uniforms: u,
      transparent: true,
      depthTest: false,
    }),
  });

  dessiner = () => {
    const l = window.innerWidth;
    const h = window.innerHeight;
    if (toile.width !== Math.round(l * renderer.dpr) || toile.height !== Math.round(h * renderer.dpr)) renderer.setSize(l, h);
    u.uRes.value = [gl.canvas.width, gl.canvas.height];
    u.uForce.value = tunnel.force;
    u.uDistance.value = tunnel.distance;
    u.uVitesse.value = tunnel.vitesse;
    u.uSaut.value = tunnel.saut;
    renderer.render({ scene: plan });
  };
  return true;
}

/** Commence à dessiner le tunnel à chaque image. Renvoie false si WebGL 2 n'est pas disponible. */
export function ouvrirTunnel(): boolean {
  if (!preparer()) return false;
  if (!ouvert) {
    ouvert = true;
    gsap.ticker.add(dessiner!);
  }
  return true;
}

/** Arrête le tunnel : plus aucune animation ne le pilote, et sa toile est effacée. */
export function fermerTunnel(): void {
  gsap.killTweensOf(tunnel);
  tunnel.force = 0;
  tunnel.saut = 0;
  if (!ouvert || !dessiner) return;
  ouvert = false;
  gsap.ticker.remove(dessiner);
  dessiner();
}
