// PORTAL RUSH 3D — LE POST-TRAITEMENT (V4-H, 17 octobre 2026)
//
// La scène n'est plus dessinée directement à l'écran : elle l'est dans un tampon multi-échantillonné (on garde
// l'anticrénelage), résolu dans une texture. Puis :
//   1. le « bloom » : ce qui est très lumineux (néons, réacteurs, cristaux, soleil, éclairs) déborde en halo.
//      Chaîne « double filtre » : un seuil doux à la première réduction (½), trois réductions (¼, ⅛, 1/16),
//      puis trois remontées en filtre en tente, chacune ajoutée au niveau du dessus ;
//   2. la composition, à l'écran : l'image + le halo (mélange « écran », sans brûler), un flou radial qui
//      grandit avec la vitesse (les bords filent, le centre reste net), une légère aberration chromatique en
//      Overdrive et pendant les chocs, un vignettage, un grain très fin (il casse les aplats et le « banding »).
// Les scènes de la 3D écrivent déjà des couleurs passées par la courbe filmique (sRGB) : le halo est donc
// calculé sur l'image finale, avec un seuil doux, ce qui suffit pour la lumière des néons et des réacteurs.
// Coût : six passes plein écran à résolution décroissante (la plus chère à ½). En qualité « Économie », rien.

import { Mesh, Program, RenderTarget, Triangle } from 'ogl';

type Gl = ConstructorParameters<typeof Program>[0];

const VERT = /* glsl */ `#version 300 es
in vec2 position; in vec2 uv;
out vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position, 0.0, 1.0); }`;

// La réduction : 13 lectures (motif de Jimenez, « Next Generation Post Processing in Call of Duty »), qui
// évitent le scintillement ; à la première, un seuil doux (genou) isole ce qui brille.
const REDUIRE = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D tSource; uniform vec2 uTexel; uniform float uSeuil; uniform float uPremier; uniform float uHdr;
out vec4 sortie;
vec3 l(vec2 o) { return texture(tSource, vUv + o * uTexel).rgb; }
vec3 seuil(vec3 c) {
  float b = max(c.r, max(c.g, c.b));
  float genou = 0.18;
  float s = clamp(b - uSeuil + genou, 0.0, 2.0 * genou);
  s = s * s / (4.0 * genou + 1e-4);
  return c * max(s, b - uSeuil) / max(b, 1e-4);
}
void main() {
  vec3 a = l(vec2(-2, -2)), b = l(vec2(0, -2)), c = l(vec2(2, -2));
  vec3 d = l(vec2(-1, -1)), e = l(vec2(1, -1));
  vec3 f = l(vec2(-2, 0)), g = l(vec2(0, 0)), h = l(vec2(2, 0));
  vec3 i = l(vec2(-1, 1)), j = l(vec2(1, 1));
  vec3 k = l(vec2(-2, 2)), m = l(vec2(0, 2)), n = l(vec2(2, 2));
  vec3 col = (d + e + i + j) * 0.125 + (a + b + f + g) * 0.03125 + (b + c + g + h) * 0.03125 + (f + g + k + m) * 0.03125 + (g + h + m + n) * 0.03125;
  if (uPremier > 0.5) {
    // (Sans HDR, les couleurs sont en sRGB : on revient à peu près au linéaire pour que le halo garde ses teintes.)
    if (uHdr < 0.5) col = pow(col, vec3(2.2));
    // (Un plafond : un point extrêmement brillant ne doit pas faire clignoter tout le halo.)
    col = min(seuil(col), vec3(24.0));
  }
  sortie = vec4(col, 1.0);
}`;

// La remontée : un filtre en tente (9 lectures) sur le niveau du dessous, ajouté au niveau courant.
const REMONTER = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D tPetit; uniform sampler2D tCourant; uniform vec2 uTexel; uniform float uRayon;
out vec4 sortie;
void main() {
  vec2 o = uTexel * uRayon;
  vec3 s = texture(tPetit, vUv).rgb * 4.0;
  s += (texture(tPetit, vUv + vec2(-o.x, 0.0)).rgb + texture(tPetit, vUv + vec2(o.x, 0.0)).rgb + texture(tPetit, vUv + vec2(0.0, -o.y)).rgb + texture(tPetit, vUv + vec2(0.0, o.y)).rgb) * 2.0;
  s += texture(tPetit, vUv + vec2(-o.x, -o.y)).rgb + texture(tPetit, vUv + vec2(o.x, -o.y)).rgb + texture(tPetit, vUv + vec2(-o.x, o.y)).rgb + texture(tPetit, vUv + vec2(o.x, o.y)).rgb;
  sortie = vec4(texture(tCourant, vUv).rgb + s / 16.0, 1.0);
}`;

const COMPOSER = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D tScene; uniform sampler2D tHalo;
uniform vec2 uRes; uniform float uHalo; uniform float uFlou; uniform float uAberration; uniform float uVignette; uniform float uGrain; uniform float uTemps;
uniform vec2 uCentre; uniform float uHdr; uniform float uExposition;
out vec4 sortie;
vec3 filmique(vec3 x) { x *= 0.9; return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
float h12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
void main() {
  vec2 d = vUv - uCentre;
  float r = length(d * vec2(uRes.x / uRes.y, 1.0));
  vec3 col;
  // Le flou radial de vitesse : nul au centre (là où l'on regarde), il grandit vers les bords.
  float k = uFlou * smoothstep(0.18, 0.95, r);
  if (k > 0.002) {
    col = vec3(0.0);
    float tot = 0.0;
    float j = h12(gl_FragCoord.xy + uTemps) - 0.5;
    for (int i = 0; i < 8; i++) {
      float t = (float(i) + j) / 8.0;
      float w = 1.0 - t * 0.6;
      col += texture(tScene, vUv - d * k * t).rgb * w;
      tot += w;
    }
    col /= tot;
  } else col = texture(tScene, vUv).rgb;
  // L'aberration chromatique : le rouge et le bleu se séparent un peu vers les bords.
  if (uAberration > 0.001) {
    vec2 a = d * uAberration * r;
    col.r = mix(col.r, texture(tScene, vUv - a).r, 0.85);
    col.b = mix(col.b, texture(tScene, vUv + a).b, 0.85);
  }
  if (uHdr > 0.5) {
    // HDR : la lumière et son halo s'additionnent, puis la courbe filmique, puis le gamma de l'écran.
    col = col + texture(tHalo, vUv).rgb * uHalo * 0.22;
    col = pow(filmique(col * uExposition), vec3(1.0 / 2.2));
  } else {
    // Sans HDR : le halo, ramené en sRGB, mélangé « écran ».
    vec3 halo = pow(max(texture(tHalo, vUv).rgb * uHalo, 0.0), vec3(1.0 / 2.2));
    col = 1.0 - (1.0 - col) * (1.0 - min(halo, 1.0));
  }
  // Le vignettage.
  col *= 1.0 - uVignette * smoothstep(0.35, 1.05, r);
  // Le grain (fin, centré sur zéro, plus visible dans les ombres).
  float g = h12(gl_FragCoord.xy * 1.37 + fract(uTemps * 7.13) * 91.0) - 0.5;
  col += g * uGrain * (1.0 - dot(col, vec3(0.333)) * 0.6);
  sortie = vec4(col, 1.0);
}`;

export interface ReglagesPost {
  /** Force du halo lumineux (0 : aucun). */
  halo: number;
  /** Flou radial de vitesse (0 à ~0,06). */
  flou: number;
  /** Aberration chromatique (0 à ~0,012). */
  aberration: number;
  vignette: number;
  grain: number;
  temps: number;
  /** Le centre du flou (le point de fuite de la piste), en coordonnées de texture. */
  centre?: [number, number];
}

export class Post {
  private gl: Gl;
  private l = 0;
  private h = 0;
  /** Le tampon multi-échantillonné où la scène est dessinée (null : pas de MSAA, on dessine dans « image »). */
  private msaa: { fb: WebGLFramebuffer; couleur: WebGLRenderbuffer; profondeur: WebGLRenderbuffer } | null = null;
  private echantillons = 0;
  private image!: RenderTarget;
  private bas: RenderTarget[] = [];
  private haut: RenderTarget[] = [];
  private pReduire: Program;
  private pRemonter: Program;
  private pComposer: Program;
  private quad: Mesh;
  private triangle: Triangle;
  /** La cible à donner à renderer.render pour dessiner la scène. */
  // (« depth » : OGL ne réactive l'écriture de profondeur, pour l'effacer, que si la cible le dit.)
  cible: { buffer: WebGLFramebuffer | null; width: number; height: number; depth: true } = { buffer: null, width: 1, height: 1, depth: true };

  /** Vrai si la scène est dessinée en HDR (tampons en flottant 16 bits). */
  readonly hdr: boolean;

  constructor(gl: Gl) {
    this.gl = gl;
    const g = gl as unknown as WebGL2RenderingContext;
    this.echantillons = Math.min(4, (g.getParameter(g.MAX_SAMPLES) as number) || 0);
    // (Écrire dans un tampon flottant demande une extension, présente presque partout en WebGL 2 ; sinon, 8 bits.)
    this.hdr = !!(g.getExtension('EXT_color_buffer_float') || g.getExtension('EXT_color_buffer_half_float'));
    this.triangle = new Triangle(gl);
    const prog = (fragment: string, uniforms: Record<string, { value: unknown }>) => new Program(gl, { vertex: VERT, fragment, uniforms, depthTest: false, depthWrite: false, cullFace: false });
    this.pReduire = prog(REDUIRE, { tSource: { value: null }, uTexel: { value: [0, 0] }, uSeuil: { value: 0.62 }, uPremier: { value: 0 }, uHdr: { value: 0 } });
    this.pRemonter = prog(REMONTER, { tPetit: { value: null }, tCourant: { value: null }, uTexel: { value: [0, 0] }, uRayon: { value: 1 } });
    this.pComposer = prog(COMPOSER, {
      tScene: { value: null },
      tHalo: { value: null },
      uRes: { value: [1, 1] },
      uHalo: { value: 1 },
      uFlou: { value: 0 },
      uAberration: { value: 0 },
      uVignette: { value: 0.3 },
      uGrain: { value: 0.03 },
      uTemps: { value: 0 },
      uCentre: { value: [0.5, 0.5] },
      uHdr: { value: 0 },
      uExposition: { value: 1 },
    });
    this.quad = new Mesh(gl, { geometry: this.triangle, program: this.pComposer, frustumCulled: false });
  }

  /** (Re)crée les tampons à la taille du dessin (pixels réels). */
  dimensionner(l: number, h: number): void {
    l = Math.max(2, Math.round(l));
    h = Math.max(2, Math.round(h));
    if (l === this.l && h === this.h) return;
    this.l = l;
    this.h = h;
    const gl = this.gl;
    const g = gl as unknown as WebGL2RenderingContext;
    const format = this.hdr ? { type: g.HALF_FLOAT, format: g.RGBA, internalFormat: g.RGBA16F } : {};
    const opt = { depth: false, minFilter: g.LINEAR, magFilter: g.LINEAR, ...format };
    if (!this.image) this.image = new RenderTarget(gl, { width: l, height: h, depth: this.echantillons === 0, minFilter: g.LINEAR, magFilter: g.LINEAR, ...format });
    else this.image.setSize(l, h);
    const tailles = [2, 4, 8, 16].map((d) => [Math.max(1, Math.round(l / d)), Math.max(1, Math.round(h / d))]);
    tailles.forEach(([w, hh], i) => {
      if (!this.bas[i]) this.bas[i] = new RenderTarget(gl, { width: w, height: hh, ...opt });
      else this.bas[i].setSize(w, hh);
      if (i < 3) {
        if (!this.haut[i]) this.haut[i] = new RenderTarget(gl, { width: w, height: hh, ...opt });
        else this.haut[i].setSize(w, hh);
      }
    });
    // Le tampon multi-échantillonné (couleur + profondeur), résolu dans « image » à chaque image.
    if (this.echantillons > 0) {
      try {
        if (this.msaa) {
          g.deleteFramebuffer(this.msaa.fb);
          g.deleteRenderbuffer(this.msaa.couleur);
          g.deleteRenderbuffer(this.msaa.profondeur);
        }
        const fb = g.createFramebuffer()!;
        const couleur = g.createRenderbuffer()!;
        const profondeur = g.createRenderbuffer()!;
        g.bindFramebuffer(g.FRAMEBUFFER, fb);
        g.bindRenderbuffer(g.RENDERBUFFER, couleur);
        g.renderbufferStorageMultisample(g.RENDERBUFFER, this.echantillons, this.hdr ? g.RGBA16F : g.RGBA8, l, h);
        g.framebufferRenderbuffer(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.RENDERBUFFER, couleur);
        g.bindRenderbuffer(g.RENDERBUFFER, profondeur);
        g.renderbufferStorageMultisample(g.RENDERBUFFER, this.echantillons, g.DEPTH_COMPONENT24, l, h);
        g.framebufferRenderbuffer(g.FRAMEBUFFER, g.DEPTH_ATTACHMENT, g.RENDERBUFFER, profondeur);
        const ok = g.checkFramebufferStatus(g.FRAMEBUFFER) === g.FRAMEBUFFER_COMPLETE;
        this.msaa = ok ? { fb, couleur, profondeur } : null;
        if (!ok) this.echantillons = 0;
      } catch {
        this.msaa = null;
        this.echantillons = 0;
      }
      this.oublierEtat();
    }
    if (!this.msaa && !this.image.depthBuffer) {
      // (Sans MSAA, la scène est dessinée directement dans « image », qui a alors besoin d'une profondeur.)
      this.image = new RenderTarget(gl, { width: l, height: h, depth: true, minFilter: g.LINEAR, magFilter: g.LINEAR, ...format });
    }
    this.cible = { buffer: this.msaa ? this.msaa.fb : this.image.buffer, width: l, height: h, depth: true };
  }

  /** OGL garde en mémoire le tampon lié : après nos appels directs, on le lui fait oublier. */
  private oublierEtat(): void {
    const r = (this.gl as unknown as { renderer: { state: { framebuffer: unknown } } }).renderer;
    r.state.framebuffer = undefined;
  }

  private passe(prog: Program, cible: RenderTarget | null, uniforms: Record<string, unknown>): void {
    for (const [k, v] of Object.entries(uniforms)) prog.uniforms[k].value = v;
    this.quad.program = prog;
    const r = (this.gl as unknown as { renderer: { render: (o: object) => void } }).renderer;
    r.render({ scene: this.quad, target: cible ?? undefined, clear: false, sort: false, frustumCull: false, update: false });
  }

  /** Après le dessin de la scène dans « cible » : le halo, puis la composition à l'écran. */
  composer(o: ReglagesPost & { exposition?: number }): void {
    const g = this.gl as unknown as WebGL2RenderingContext;
    if (this.msaa) {
      g.bindFramebuffer(g.READ_FRAMEBUFFER, this.msaa.fb);
      g.bindFramebuffer(g.DRAW_FRAMEBUFFER, this.image.buffer);
      g.blitFramebuffer(0, 0, this.l, this.h, 0, 0, this.l, this.h, g.COLOR_BUFFER_BIT, g.NEAREST);
      g.bindFramebuffer(g.READ_FRAMEBUFFER, null);
      g.bindFramebuffer(g.DRAW_FRAMEBUFFER, null);
      this.oublierEtat();
    }
    let halo = this.bas[0].texture;
    if (o.halo > 0.001) {
      // Les réductions (la première avec le seuil).
      let source = this.image;
      this.bas.forEach((rt, i) => {
        this.passe(this.pReduire, rt, { tSource: source.texture, uTexel: [1 / source.width, 1 / source.height], uPremier: i === 0 ? 1 : 0, uHdr: this.hdr ? 1 : 0, uSeuil: this.hdr ? 1.15 : 0.82 });
        source = rt;
      });
      // Les remontées : du plus petit au ½.
      let petit = this.bas[3];
      for (let i = 2; i >= 0; i--) {
        this.passe(this.pRemonter, this.haut[i], { tPetit: petit.texture, tCourant: this.bas[i].texture, uTexel: [1 / petit.width, 1 / petit.height], uRayon: 1 });
        petit = this.haut[i];
      }
      halo = this.haut[0].texture;
    }
    this.passe(this.pComposer, null, {
      tScene: this.image.texture,
      tHalo: halo,
      uRes: [this.l, this.h],
      uHalo: o.halo,
      uFlou: o.flou,
      uAberration: o.aberration,
      uVignette: o.vignette,
      uGrain: o.grain,
      uTemps: o.temps,
      uCentre: o.centre ?? [0.5, 0.5],
      uHdr: this.hdr ? 1 : 0,
      uExposition: o.exposition ?? 1,
    });
  }
}
