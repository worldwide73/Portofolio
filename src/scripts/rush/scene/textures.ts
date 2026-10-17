// PORTAL RUSH 3D — LES TEXTURES (V4-H, 17 octobre 2026)
//
// De vraies textures, sans fichier à télécharger ni licence à vérifier : elles sont calculées une fois, au
// chargement, par la carte graphique (des shaders dessinent dans des textures de 1024 × 1024), puis relues
// et confiées à OGL avec leurs mipmaps et le filtrage anisotrope. Elles se répètent sans couture (tous les
// motifs et les bruits sont périodiques).
//
//   « plaques » — le métal des coques, des structures et de la piste : un calepinage de panneaux de tailles
//     variées (joints creusés), des rivets le long des joints, des trappes de visite vissées, des grilles
//     d'aération, des rayures fines, l'usure des arêtes, la crasse qui s'accumule dans les creux, des coulures ;
//   « brut » — la roche, le béton composite, le caoutchouc : fissures (bruit « ridged »), piqûres, grain ;
//   « normales » — le relief des deux précédentes (dérivées de leur hauteur, calculées sans quantification).
//
// Canaux des textures de détail : R = albédo (× 1,5), G = rugosité (0,5 = inchangée), B = cavité (ombre des
// creux), A = hauteur. Les normales : RG = « plaques », BA = « brut » (x, y ; z se déduit).
// Le shader de surface (materiaux.ts) les applique en projection triplanaire, dans le repère de l'objet :
// pas besoin de coordonnées de texture, et elles suivent le pli du parcours.

import { Mesh, Program, RenderTarget, Texture, Triangle } from 'ogl';

type Gl = ConstructorParameters<typeof Program>[0];

const TAILLE = 1024;

const VERT = /* glsl */ `#version 300 es
in vec2 position; in vec2 uv; out vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position, 0.0, 1.0); }`;

/** Les fonctions communes : hachages, bruits périodiques, et les deux hauteurs (pour les normales). */
const OUTILS = /* glsl */ `
float h21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 h22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
// Bruit de valeur périodique (période P, en cellules).
float bruitP(vec2 x, float P) {
  vec2 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  float a = h21(mod(i, P)), b = h21(mod(i + vec2(1, 0), P)), c = h21(mod(i + vec2(0, 1), P)), d = h21(mod(i + vec2(1, 1), P));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbmP(vec2 uv, float P) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 6; i++) { s += a * bruitP(uv * P, P); P *= 2.0; a *= 0.5; }
  return s;
}
float arete(vec2 uv, float P) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { s += a * (1.0 - abs(bruitP(uv * P, P) * 2.0 - 1.0)); P *= 2.0; a *= 0.5; }
  return s;
}

// ---- Les plaques : le calepinage ----
// Renvoie : xy = position dans le panneau (0 à 1), zw = taille du panneau (en tuile) ; « id » : son identifiant.
vec4 panneau(vec2 uv, out vec2 id) {
  vec2 P = uv * 2.0;
  vec2 B = floor(P);
  vec2 f = fract(P);
  float hb = h21(mod(B, 2.0) + 7.0);
  vec2 taille = vec2(0.5);
  vec2 sous = vec2(0.0);
  // Un grand panneau, ou coupé en deux (en long ou en large), ou en quatre, à des proportions variées.
  float cx = 0.38 + 0.24 * h21(mod(B, 2.0) + 3.1), cy = 0.38 + 0.24 * h21(mod(B, 2.0) + 5.7);
  if (hb > 0.25) { if (f.x < cx) { f.x /= cx; taille.x *= cx; } else { f.x = (f.x - cx) / (1.0 - cx); taille.x *= 1.0 - cx; sous.x = 1.0; } }
  if (hb > 0.55 || hb < 0.12) { if (f.y < cy) { f.y /= cy; taille.y *= cy; } else { f.y = (f.y - cy) / (1.0 - cy); taille.y *= 1.0 - cy; sous.y = 1.0; } }
  id = mod(B, 2.0) * 4.0 + sous;
  return vec4(f, taille);
}
// La hauteur du métal en plaques (0 : fond d'un joint ; 1 : surface).
float hauteurPlaques(vec2 uv) {
  vec2 id;
  vec4 pn = panneau(uv, id);
  vec2 d = min(pn.xy, 1.0 - pn.xy) * pn.zw; // distance aux bords (en tuile)
  float bord = min(d.x, d.y);
  float h = smoothstep(0.0015, 0.006, bord);                 // le joint, et un léger chanfrein
  h *= 0.94 + 0.06 * h21(id + 1.3);                           // chaque panneau, à sa hauteur
  // Les rivets : le long des joints, à 1,4 % du bord, tous les 2,8 %.
  vec2 q = pn.xy * pn.zw;
  float pas = 0.028;
  float dr = 1.0;
  if (d.x < 0.02) { vec2 c = vec2(pn.x < 0.5 ? 0.012 : pn.z - 0.012, (floor(q.y / pas) + 0.5) * pas); dr = min(dr, length(q - c)); }
  if (d.y < 0.02) { vec2 c = vec2((floor(q.x / pas) + 0.5) * pas, pn.y < 0.5 ? 0.012 : pn.w - 0.012); dr = min(dr, length(q - c)); }
  float rivet = 1.0 - smoothstep(0.0, 0.0042, dr);
  h += 0.05 * sqrt(max(rivet, 0.0));
  float genre = h21(id + 9.2);
  vec2 c = abs(pn.xy - 0.5) * pn.zw;                          // depuis le centre du panneau
  vec2 m = pn.zw * 0.5 - 0.035;
  if (genre > 0.78) {
    // Une trappe de visite : une rainure rectangulaire en retrait, quatre vis.
    float r = max(c.x - m.x, c.y - m.y);
    h -= 0.4 * (1.0 - smoothstep(0.0008, 0.0026, abs(r)));
    vec2 v = abs(c - (m - 0.012));
    h -= 0.25 * (1.0 - smoothstep(0.0012, 0.0032, length(v)));
  } else if (genre > 0.62) {
    // Une grille d'aération : des fentes parallèles.
    if (c.x < m.x - 0.02 && c.y < m.y - 0.02) h -= 0.55 * smoothstep(0.32, 0.5, abs(fract(q.y * 90.0) - 0.5) * 2.0);
  }
  // Un très léger martelage de la tôle.
  h += 0.012 * (bruitP(uv * 64.0, 64.0) - 0.5);
  return clamp(h, 0.0, 1.0);
}
// La hauteur de la matière brute.
float hauteurBrut(vec2 uv) {
  float h = fbmP(uv, 4.0) * 0.55;
  float fissure = arete(uv + 0.37, 3.0);
  h -= 0.35 * smoothstep(0.78, 0.95, fissure);
  float piq = h21(floor(uv * 160.0));
  vec2 fp = fract(uv * 160.0) - 0.5;
  h -= 0.15 * step(0.93, piq) * (1.0 - smoothstep(0.1, 0.35, length(fp)));
  return clamp(h + 0.25, 0.0, 1.0);
}
`;

const PLAQUES = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv; out vec4 sortie;
${OUTILS}
// Une rayure : un segment fin, au hasard dans chaque cellule d'une grille.
float rayures(vec2 uv, float n) {
  vec2 g = uv * n; vec2 i = floor(g); float m = 0.0;
  for (int dy = -1; dy <= 1; dy++) for (int dx = -1; dx <= 1; dx++) {
    vec2 c = i + vec2(dx, dy);
    vec2 r = h22(mod(c, n));
    if (r.x > 0.28) continue;
    vec2 o = c + r;
    float ang = h21(mod(c, n) + 2.0) * 3.14159;
    vec2 dir = vec2(cos(ang), sin(ang));
    float L = 0.15 + 0.45 * r.y;
    vec2 p = g - o;
    float t = clamp(dot(p, dir), -L, L);
    float d = length(p - dir * t);
    m = max(m, (1.0 - smoothstep(0.0, 0.02 + 0.02 * r.y, d)) * (0.5 + 0.5 * r.y));
  }
  return m;
}
void main() {
  vec2 uv = vUv;
  vec2 id;
  vec4 pn = panneau(uv, id);
  vec2 d = min(pn.xy, 1.0 - pn.xy) * pn.zw;
  float bord = min(d.x, d.y);
  float h = hauteurPlaques(uv);
  // La crasse : un grand bruit, plus forte près des joints et en bas des panneaux (coulures).
  float crasse = smoothstep(0.35, 0.85, fbmP(uv, 3.0));
  crasse = max(crasse, (1.0 - smoothstep(0.0, 0.03, bord)) * 0.75);
  // (Les coulures, seulement sur un panneau sur trois, sous son bord haut.)
  float coulure = smoothstep(0.62, 0.92, bruitP(vec2(uv.x * 90.0, uv.y * 6.0), 90.0)) * smoothstep(0.55, 1.0, pn.y) * step(0.66, h21(id + 6.6));
  crasse = clamp(crasse * 0.8 + coulure * 0.35, 0.0, 1.0);
  // L'usure : sur les arêtes des panneaux, la peinture partie laisse le métal.
  float usure = (1.0 - smoothstep(0.004, 0.016, bord)) * smoothstep(0.45, 0.75, bruitP(uv * 48.0, 48.0));
  float ray = rayures(uv, 24.0) * 0.8 + rayures(uv + 0.5, 48.0) * 0.5;
  float teinte = 0.9 + 0.14 * h21(id + 4.4) + 0.06 * (fbmP(uv, 8.0) - 0.5);
  float albedo = teinte * (1.0 - 0.22 * crasse) + 0.16 * ray + 0.14 * usure;
  float rugo = 0.5 + 0.18 * crasse - 0.22 * ray - 0.16 * usure + 0.08 * (h21(id + 2.2) - 0.5);
  float cav = mix(0.28, 1.0, smoothstep(0.05, 0.9, h)) * (1.0 - 0.25 * crasse);
  sortie = vec4(clamp(albedo / 1.5, 0.0, 1.0), clamp(rugo, 0.0, 1.0), clamp(cav, 0.0, 1.0), h);
}`;

const BRUT = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv; out vec4 sortie;
${OUTILS}
void main() {
  vec2 uv = vUv;
  float h = hauteurBrut(uv);
  float n = fbmP(uv + 3.3, 6.0);
  float taches = smoothstep(0.45, 0.8, fbmP(uv + 7.1, 2.0));
  float albedo = 0.8 + 0.35 * (n - 0.5) - 0.18 * taches + 0.1 * h;
  float rugo = 0.5 + 0.12 * (bruitP(uv * 96.0, 96.0) - 0.5) + 0.1 * taches;
  float cav = mix(0.45, 1.0, smoothstep(0.0, 0.45, h));
  sortie = vec4(clamp(albedo / 1.5, 0.0, 1.0), clamp(rugo, 0.0, 1.0), cav, h);
}`;

// Les normales, par différences centrées des hauteurs (calculées, pas relues : aucune marche d'escalier).
const NORMALES = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv; out vec4 sortie;
uniform float uTexel;
${OUTILS}
vec2 pente(int genre, vec2 uv, float force) {
  float e = uTexel;
  float hx0, hx1, hy0, hy1;
  if (genre == 0) { hx0 = hauteurPlaques(uv - vec2(e, 0)); hx1 = hauteurPlaques(uv + vec2(e, 0)); hy0 = hauteurPlaques(uv - vec2(0, e)); hy1 = hauteurPlaques(uv + vec2(0, e)); }
  else { hx0 = hauteurBrut(uv - vec2(e, 0)); hx1 = hauteurBrut(uv + vec2(e, 0)); hy0 = hauteurBrut(uv - vec2(0, e)); hy1 = hauteurBrut(uv + vec2(0, e)); }
  vec3 n = normalize(vec3((hx0 - hx1) * force, (hy0 - hy1) * force, 1.0));
  return n.xy;
}
void main() {
  vec2 a = pente(0, vUv, 6.0);
  vec2 b = pente(1, vUv, 3.5);
  sortie = vec4(a * 0.5 + 0.5, b * 0.5 + 0.5);
}`;

export interface TexturesJeu {
  plaques: Texture;
  brut: Texture;
  normales: Texture;
  /** Les pixels, si on les a demandés (pour les regarder dans une recette). */
  pixels?: { plaques: Uint8Array; brut: Uint8Array; normales: Uint8Array; taille: number };
}

/** Calcule les trois textures (une fois). null si quelque chose échoue : le rendu se passe alors de textures. */
export function creerTextures(gl: Gl, taille = TAILLE, garderPixels = false): TexturesJeu | null {
  try {
    const g = gl as unknown as WebGL2RenderingContext;
    const tri = new Triangle(gl);
    const r = (gl as unknown as { renderer: { render: (o: object) => void } }).renderer;
    const dessiner = (fragment: string, uniforms: Record<string, { value: unknown }> = {}): Uint8Array => {
      const cible = new RenderTarget(gl, { width: taille, height: taille, depth: false });
      const prog = new Program(gl, { vertex: VERT, fragment, uniforms, depthTest: false, depthWrite: false, cullFace: false });
      const m = new Mesh(gl, { geometry: tri, program: prog, frustumCulled: false });
      r.render({ scene: m, target: cible, clear: false, sort: false, frustumCull: false, update: false });
      const pixels = new Uint8Array(taille * taille * 4);
      (r as unknown as { bindFramebuffer: (t: object) => void }).bindFramebuffer(cible);
      g.readPixels(0, 0, taille, taille, g.RGBA, g.UNSIGNED_BYTE, pixels);
      (r as unknown as { bindFramebuffer: (t?: object) => void }).bindFramebuffer();
      g.deleteFramebuffer(cible.buffer);
      g.deleteTexture(cible.texture.texture);
      g.deleteProgram(prog.program);
      return pixels;
    };
    const texture = (donnees: Uint8Array) =>
      new Texture(gl, {
        image: donnees,
        width: taille,
        height: taille,
        wrapS: g.REPEAT,
        wrapT: g.REPEAT,
        generateMipmaps: true,
        minFilter: g.LINEAR_MIPMAP_LINEAR,
        magFilter: g.LINEAR,
        flipY: false,
        anisotropy: 8,
      });
    const pPlaques = dessiner(PLAQUES);
    const pBrut = dessiner(BRUT);
    const pNormales = dessiner(NORMALES, { uTexel: { value: 0.75 / taille } });
    return {
      plaques: texture(pPlaques),
      brut: texture(pBrut),
      normales: texture(pNormales),
      pixels: garderPixels ? { plaques: pPlaques, brut: pBrut, normales: pNormales, taille } : undefined,
    };
  } catch (e) {
    console.warn('Portal Rush : textures procédurales indisponibles', e);
    return null;
  }
}
