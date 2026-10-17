// PORTAL RUSH 3D — LES OMBRES (V4-H, 17 octobre 2026)
//
// Une carte d'ombres du soleil, recalculée à chaque image, centrée sur la portion de piste qui compte : du
// vaisseau jusqu'à ~70 m devant. Y projettent leur ombre le vaisseau, les obstacles et les structures des
// tronçons proches (portiques, anneaux, pylônes, bordures). Le passage d'ombre plie les sommets exactement
// comme le rendu (virages, reliefs, dévers : PLIER, materiaux.ts), sinon les ombres glisseraient dans les virages.
// Le shader de surface lit la carte avec un filtrage PCF (bords adoucis) ; au-delà de la zone couverte, rien.
// Qualité « Équilibrée » : 1024² ; « Élevée » : 2048² ; « Économie » : pas de carte (une ombre de contact
// sous le vaisseau, dessinée par le shader).

import { Camera, Mat4, Mesh, Program, RenderTarget, Transform, Vec3 } from 'ogl';
import { PLIER_GLSL, type Monde } from './materiaux';

type Gl = ConstructorParameters<typeof Program>[0];

const VERT = /* glsl */ `#version 300 es
precision highp float;
in vec3 position; in vec3 normal;
uniform mat4 modelMatrix; uniform mat4 viewMatrix; uniform mat4 projectionMatrix;
${PLIER_GLSL}
void main() {
  vec4 m = modelMatrix * vec4(position, 1.0);
  vec3 n = normal;
  gl_Position = projectionMatrix * viewMatrix * vec4(plier(m.xyz, n), 1.0);
}`;
const FRAG = /* glsl */ `#version 300 es
precision highp float;
out vec4 sortie;
void main() { sortie = vec4(1.0); }`;

/** Ce que la carte couvre (m, repère du monde : le vaisseau en z = 0, la piste vers −z). */
const DEMI_LARGEUR = 26;
const AVANT = 8;
const ARRIERE = -78;

export class Ombres {
  private gl: Gl;
  readonly cible: RenderTarget;
  private lumiere: Camera;
  private prog: Program;
  /** La matrice monde → espace de la carte (projection × vue de la lumière), pour le shader de surface. */
  readonly matrice = new Mat4();
  readonly taille: number;

  constructor(gl: Gl, monde: Monde, taille = 1024) {
    this.gl = gl;
    this.taille = taille;
    const g = gl as unknown as WebGL2RenderingContext;
    this.cible = new RenderTarget(gl, { width: taille, height: taille, color: 1, depthTexture: true, minFilter: g.NEAREST, magFilter: g.NEAREST });
    const demi = (AVANT - ARRIERE) / 2 + 6;
    this.lumiere = new Camera(gl, { left: -DEMI_LARGEUR, right: DEMI_LARGEUR, bottom: -demi, top: demi, near: 1, far: 260 });
    this.prog = new Program(gl, {
      vertex: VERT,
      fragment: FRAG,
      uniforms: { uPliX: monde.uPliX, uPliY: monde.uPliY, uPhase: monde.uPhase, uDevers: monde.uDevers, uPlie: { value: 1 } },
      cullFace: false,
    });
  }

  /**
   * Dessine la carte. « projeteurs » : les maillages qui projettent une ombre (leur programme est remplacé le
   * temps du passage) ; « soleil » : la direction d'où vient la lumière (vers le soleil).
   */
  dessiner(scene: Transform, projeteurs: Set<Program>, soleil: number[]): void {
    const renderer = (this.gl as unknown as { renderer: { render: (o: object) => void } }).renderer;
    // La lumière vise le milieu de la zone, depuis le soleil (assez loin pour tout englober).
    const centre = new Vec3(0, 0, (AVANT + ARRIERE) / 2);
    const s = new Vec3(soleil[0], Math.max(0.25, soleil[1]), soleil[2]).normalize();
    this.lumiere.position.set(centre.x + s.x * 120, centre.y + s.y * 120, centre.z + s.z * 120);
    // (« Haut » de la lumière : l'axe de la piste, pour que le rectangle couvert suive la piste.)
    this.lumiere.up.set(0, 0, -1);
    if (Math.abs(s.z) > 0.95) this.lumiere.up.set(0, 1, 0);
    this.lumiere.lookAt(centre);
    this.lumiere.updateMatrixWorld();
    // On ne garde que les projeteurs proches de la zone ; les autres sont cachés le temps du passage.
    const remplaces: { m: Mesh; p: Program }[] = [];
    const caches: Transform[] = [];
    scene.updateMatrixWorld();
    scene.traverse((n: Transform) => {
      if (!n.visible) return true;
      const m = n as Mesh;
      if (!m.program) return;
      if (!projeteurs.has(m.program)) {
        n.visible = false;
        caches.push(n);
        return;
      }
      // Les tronçons partent de leur origine vers −z (48 m) ; les objets sont à leur position.
      const z = m.worldMatrix[14];
      if (z < ARRIERE - 6 || z - 48 > AVANT + 4) {
        n.visible = false;
        caches.push(n);
        return;
      }
      remplaces.push({ m, p: m.program });
      m.program = this.prog;
    });
    renderer.render({ scene, camera: this.lumiere, target: this.cible, sort: false, frustumCull: false });
    for (const r of remplaces) r.m.program = r.p;
    for (const n of caches) n.visible = true;
    this.matrice.multiply(this.lumiere.projectionMatrix, this.lumiere.viewMatrix);
  }
}
