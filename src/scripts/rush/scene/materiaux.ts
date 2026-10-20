// PORTAL RUSH 3D — LES MATIÈRES (shaders)
//
// Un seul shader « surface » éclaire tout ce qui est solide : un soleil
// (lumière directionnelle), un ciel et un sol (lumière d'ambiance), des reflets
// d'environnement (plus nets sur le métal lisse et le verre, à angle rasant),
// l'émission des bandes lumineuses, et un brouillard qui donne la profondeur.
// Le calcul se fait en couleurs linéaires, puis une courbe « filmique » (ACES)
// ramène la lumière à l'écran sans brûler les zones claires.
//
// À côté : le ciel (dégradé, nébuleuse, étoiles, soleil), les planètes, les
// halos et flammes additifs, les particules.

import { Program, type Geometry } from 'ogl';
import { CANAL } from './geometrie';

type Gl = ConstructorParameters<typeof Program>[0];

const ENTETE = '#version 300 es\nprecision highp float;\n';

/** Les fonctions communes : bruit, courbe filmique, brouillard. */
const COMMUN = /* glsl */ `
float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float bruit(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * bruit(p); p *= 2.03; a *= 0.5; } return s; }
vec3 filmique(vec3 x) { x *= 0.9; return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
// (V4-H) En HDR (« uHdr », avec le post-traitement), on écrit la lumière telle quelle, non bornée : la courbe
// filmique est appliquée à la fin (post.ts), après le halo, qui ne prend alors que ce qui dépasse vraiment le blanc.
uniform float uHdr;
vec3 ecran(vec3 c) { return uHdr > 0.5 ? max(c, 0.0) : pow(filmique(c), vec3(1.0 / 2.2)); }
`;

/**
 * Le pli du parcours (voir parcours.ts) : chaque sommet, à la distance r = −z devant le vaisseau, est déplacé
 * sur le côté et en hauteur, et la piste s'incline dans les virages. « uPlie » vaut 0 pour le lointain.
 * Les normales suivent (au premier ordre), pour que la lumière reste juste dans les virages et les côtes.
 */
export const PLIER_GLSL = /* glsl */ `
// uPliX : a1, k1, a2, k2 (virages) ; uPliY : A1 à A4 (harmoniques du relief) ; uPhase : θ1, θ2, θ du relief, q.
uniform vec4 uPliX, uPliY, uPhase; uniform float uDevers, uPlie;
// Une harmonique du relief : son déplacement en hauteur et sa pente, à la distance r.
vec2 relief(float A, float h, float r) {
  float a = h * uPhase.z, w = h * uPhase.w;
  return A * vec2(cos(a + w * r) - cos(a) + w * r * sin(a), w * (sin(a) - sin(a + w * r)));
}
vec3 plier(vec3 p, inout vec3 n) {
  if (uPlie < 0.5) return p;
  float r = -p.z;
  float t1 = uPhase.x + uPliX.y * r, t2 = uPhase.y + uPliX.w * r;
  float ox = uPliX.x * (cos(t1) - cos(uPhase.x) + uPliX.y * r * sin(uPhase.x)) + uPliX.z * (cos(t2) - cos(uPhase.y) + uPliX.w * r * sin(uPhase.y));
  float dx = uPliX.x * uPliX.y * (sin(uPhase.x) - sin(t1)) + uPliX.z * uPliX.w * (sin(uPhase.y) - sin(t2));
  vec2 ry = relief(uPliY.x, 1.0, r) + relief(uPliY.y, 2.0, r) + relief(uPliY.z, 3.0, r) + relief(uPliY.w, 4.0, r);
  float oy = ry.x, dy = ry.y;
  float devers = (-uPliX.x * uPliX.y * uPliX.y * cos(t1) - uPliX.z * uPliX.w * uPliX.w * cos(t2)) * uDevers;
  n = normalize(vec3(n.x - devers * n.y, n.y, n.z + dx * n.x + dy * n.y));
  return vec3(p.x + ox, p.y + oy + p.x * devers, p.z);
}
`;

/** Les réglages du monde, partagés par tous les shaders (mêmes objets : une mise à jour suffit). */
export function uniformesMonde() {
  return {
    uSoleilDir: { value: [0.4, 0.6, 0.3] },
    uSoleil: { value: [1, 0.95, 0.9] },
    uCiel: { value: [0.1, 0.14, 0.22] },
    uSol: { value: [0.02, 0.025, 0.04] },
    uBrouillard: { value: [0.02, 0.03, 0.06] },
    uBrume: { value: [60, 420] }, // début, fin (m)
    uAccent: { value: [0.5, 0.85, 1] },
    uAccent2: { value: [1, 0.6, 0.2] },
    uDanger: { value: [1, 0.12, 0.08] },
    uPeinture: { value: [0.85, 0.88, 0.92] },
    uCoeur: { value: [1, 1, 1] },
    uTemps: { value: 0 },
    uDistance: { value: 0 },
    uIntensite: { value: 0 }, // le combo (0 à 1) : les lignes de la piste s'animent
    uBoost: { value: 0 }, // l'Overdrive (0 à 1)
    uExposition: { value: 1 },
    // Les couloirs effondrés visibles : x du centre, demi-largeur, z de l'entrée, z de la sortie (repère du monde).
    // Les plaques de la piste y sont découpées : on voit le gouffre en dessous.
    uTrou0: { value: [0, 0, 0, 0] },
    uTrou1: { value: [0, 0, 0, 0] },
    uTrou2: { value: [0, 0, 0, 0] },
    uTrou3: { value: [0, 0, 0, 0] },
    uTrou4: { value: [0, 0, 0, 0] },
    uTrou5: { value: [0, 0, 0, 0] },
    uDecoupe: { value: 0 },
    // Le pli du parcours (virages, reliefs, dévers) : voir parcours.ts.
    uPliX: { value: [0, 0, 0, 0] },
    uPliY: { value: [0, 0, 0, 0] },
    uPhase: { value: [0, 0, 0, 0] },
    uDevers: { value: 0 },
    // (V4-H) Les textures procédurales (textures.ts), la carte d'ombres (ombres.ts), les lumières ponctuelles.
    // (Les textures sont posées par la scène dès sa création : une texture blanche 1 × 1 en attendant.)
    tPlaques: { value: null as unknown },
    tBrut: { value: null as unknown },
    tNormales: { value: null as unknown },
    uTextures: { value: 0 },
    tOmbre: { value: null as unknown },
    uMatOmbre: { value: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] as ArrayLike<number> },
    uOmbre: { value: 0 },
    uTexelOmbre: { value: 1 / 1024 },
    // Huit lumières : position (xyz) et portée (w) ; couleur × intensité (rgb). Nombre allumé : uNbLum.
    // (De vrais tableaux : OGL n'envoie un tableau d'uniformes que sous cette forme.)
    uLumPos: { value: new Array<number>(32).fill(0) },
    uLumCoul: { value: new Array<number>(24).fill(0) },
    uNbLum: { value: 0 },
    // L'ombre de contact sous le vaisseau (sans carte d'ombres) : x, z, rayon, force.
    uContact: { value: [0, 0, 0, 0] },
    // Rendu en HDR (1) ou directement à l'écran (0).
    uHdr: { value: 0 },
  };
}
export type Monde = ReturnType<typeof uniformesMonde>;
/** Les uniformes du pli pour un programme (les mêmes objets que le monde : une mise à jour suffit). */
const pli = (monde: Monde, plie = 1) => ({ uPliX: monde.uPliX, uPliY: monde.uPliY, uPhase: monde.uPhase, uDevers: monde.uDevers, uPlie: { value: plie }, uHdr: monde.uHdr });

// « vMonde » : la position sur le parcours droit (lignes de la piste, trous) ; « vPlie » : la position à l'image.
const SURFACE_VERT = /* glsl */ `${ENTETE}
in vec3 position; in vec3 normal; in vec3 couleur; in vec4 matiere;
uniform mat4 modelMatrix; uniform mat4 viewMatrix; uniform mat4 projectionMatrix;
${PLIER_GLSL}
out vec3 vMonde; out vec3 vNormale; out vec3 vCouleur; out vec4 vMatiere; out vec3 vLocal; out vec3 vPlie; out vec3 vNLocale;
void main() {
  vec4 m = modelMatrix * vec4(position, 1.0);
  vMonde = m.xyz; vLocal = position; vNLocale = normal;
  vec3 n = normalize(mat3(modelMatrix) * normal);
  vPlie = plier(m.xyz, n);
  vNormale = n;
  vCouleur = couleur; vMatiere = matiere;
  gl_Position = projectionMatrix * viewMatrix * vec4(vPlie, 1.0);
}`;

const SURFACE_FRAG = /* glsl */ `${ENTETE}/*VARIANTE*/
${COMMUN}
in vec3 vMonde; in vec3 vNormale; in vec3 vCouleur; in vec4 vMatiere; in vec3 vLocal; in vec3 vPlie; in vec3 vNLocale;
uniform vec3 cameraPosition;
uniform mat4 modelMatrix;
uniform vec3 uSoleilDir, uSoleil, uCiel, uSol, uBrouillard, uAccent, uAccent2, uDanger, uPeinture, uCoeur;
uniform vec2 uBrume;
uniform float uTemps, uDistance, uIntensite, uBoost, uExposition;
uniform vec4 uTrou0, uTrou1, uTrou2, uTrou3, uTrou4, uTrou5;
uniform float uDecoupe;
// (V4-H) Les textures, l'ombre du soleil, les lumières ponctuelles, l'ombre de contact.
uniform sampler2D tPlaques, tBrut, tNormales, tOmbre;
uniform float uTextures, uEchelleTex, uDetail;
uniform mat4 uMatOmbre; uniform float uOmbre, uTexelOmbre;
uniform vec4 uLumPos[8]; uniform vec3 uLumCoul[8]; uniform int uNbLum;
uniform vec4 uContact;
bool dansTrou(vec4 t) { return t.y > 0.0 && abs(vMonde.x - t.x) < t.y && vMonde.z < t.z && vMonde.z > t.w; }
// Propres à l'objet dessiné :
uniform vec3 uTeinte; uniform float uEmission; uniform float uOpacite; uniform float uImpact; uniform vec3 uImpactCouleur;
// (V4-H) Les dégâts du vaisseau : 0 intact, 1 au dernier souffle.
uniform float uDegats;
out vec4 sortie;

// L'ombre du soleil : la carte, lue en 3 × 3 points (bords adoucis), fondue en bordure de zone.
float ombreSoleil(float nl) {
#ifndef AVEC_OMBRES
  return 1.0;
#else
  if (uOmbre < 0.5) return 1.0;
  vec4 l = uMatOmbre * vec4(vPlie, 1.0);
  vec3 c = l.xyz / l.w * 0.5 + 0.5;
  if (c.x <= 0.0 || c.x >= 1.0 || c.y <= 0.0 || c.y >= 1.0 || c.z >= 1.0) return 1.0;
  float biais = 0.0004 + 0.0016 * (1.0 - nl);
  float s = 0.0;
  for (int i = -1; i <= 1; i++)
    for (int j = -1; j <= 1; j++) s += c.z - biais > texture(tOmbre, c.xy + vec2(i, j) * uTexelOmbre * 1.25).r ? 0.0 : 1.0;
  s /= 9.0;
  vec2 e = smoothstep(0.0, 0.07, c.xy) * smoothstep(1.0, 0.93, c.xy);
  return mix(1.0, s, e.x * e.y);
#endif
}

// Le reflet de l'environnement : la voûte et l'horizon du monde, deux grandes sources douces (elles dessinent
// le métal), et, vers le bas, les lignes lumineuses de la piste qui défilent.
vec3 environnement(vec3 R, float rugo, float ombre) {
#ifndef AVEC_TEXTURES
  // (Économie : le reflet d'avant V4-H, un simple dégradé.)
  return mix(uSol * 1.5, uCiel * 2.2, smoothstep(-0.25, 0.55, R.y)) + uAccent * 0.08 * (1.0 - abs(R.y));
#endif
  vec3 c = mix(uSol * 1.4, uCiel * 2.0, smoothstep(-0.3, 0.5, R.y));
  c += uCiel * 1.6 * exp(-abs(R.y - 0.04) * mix(26.0, 5.0, rugo)); // l'horizon, plus clair
  float boite1 = smoothstep(0.62, 0.9, dot(R, normalize(vec3(-0.5, 0.75, -0.42))));
  float boite2 = smoothstep(0.7, 0.93, dot(R, normalize(vec3(0.6, 0.5, 0.62))));
  // (Ces deux grandes sources sont le reflet du soleil et du ciel clair : l'ombre les éteint.)
  c += uSoleil * (boite1 * 0.9 + boite2 * 0.45) * mix(1.0, 0.35, rugo) * ombre;
  if (R.y < 0.0) {
    float s = uDistance - vMonde.z;
    float lignes = smoothstep(0.82, 0.98, abs(fract((vPlie.x + R.x / max(-R.y, 0.05) * 0.3) / 1.3) - 0.5) * 2.0);
    c += uAccent * lignes * 0.35 * smoothstep(0.0, -0.4, R.y) * (1.0 - rugo) * (0.6 + 0.4 * sin(s * 0.2 - uTemps * 3.0));
  }
  return c;
}

void main() {
  // La piste est percée au-dessus d'un couloir effondré (seulement la couche des plaques).
  if (uDecoupe > 0.5 && vMonde.y > -0.47 && vMonde.y < 0.06 && (dansTrou(uTrou0) || dansTrou(uTrou1) || dansTrou(uTrou2) || dansTrou(uTrou3) || dansTrou(uTrou4) || dansTrou(uTrou5))) discard;
  vec3 N = normalize(vNormale);
  float face = gl_FrontFacing ? 1.0 : -1.0;
  N *= face;
  vec3 V = normalize(cameraPosition - vPlie);
  vec3 L = normalize(uSoleilDir);
  float metal = vMatiere.x, rugo = vMatiere.y, emi = vMatiere.z; int canal = int(vMatiere.w + 0.5);
  vec3 base = vCouleur;
  bool peint = canal == ${CANAL.peinture} || canal == ${CANAL.peinture2};
  if (canal == ${CANAL.peinture}) base = uPeinture;
  else if (canal == ${CANAL.peinture2}) base = uAccent2 * 0.8;
  vec3 lueur = base;
  if (canal == ${CANAL.accent} || canal == ${CANAL.ligne}) lueur = uAccent;
  else if (canal == ${CANAL.accent2}) lueur = uAccent2;
  else if (canal == ${CANAL.danger} || canal == ${CANAL.fissure}) lueur = uDanger;
  else if (canal == ${CANAL.coeur}) lueur = uCoeur;
  base *= uTeinte;

  // ---- Les textures (projection triplanaire dans le repère de l'objet) ----
  float cavite = 1.0;
  float d = length(vPlie - cameraPosition);
#ifdef AVEC_TEXTURES
  if (uTextures > 0.5 && uDetail > 0.0 && emi == 0.0) {
    vec3 nl = normalize(vNLocale) * face;
    vec3 w = pow(abs(nl), vec3(6.0));
    w /= w.x + w.y + w.z;
    // (V4-H7) Le revêtement de la route : un détail plus large et beaucoup plus discret (pas de carrelage).
    bool route = canal == ${CANAL.revetement};
    vec3 pl = vLocal * uEchelleTex * (route ? 0.45 : 1.0);
    bool brut = metal < 0.3 && rugo > 0.7;
    vec4 dX, dY, dZ;
    if (brut) { dX = texture(tBrut, pl.zy); dY = texture(tBrut, pl.xz); dZ = texture(tBrut, pl.xy); }
    else { dX = texture(tPlaques, pl.zy); dY = texture(tPlaques, pl.xz); dZ = texture(tPlaques, pl.xy); }
    vec4 dt = dX * w.x + dY * w.y + dZ * w.z;
    vec4 qX = texture(tNormales, pl.zy), qY = texture(tNormales, pl.xz), qZ = texture(tNormales, pl.xy);
    vec2 gX = (brut ? qX.ba : qX.rg) * 2.0 - 1.0;
    vec2 gY = (brut ? qY.ba : qY.rg) * 2.0 - 1.0;
    vec2 gZ = (brut ? qZ.ba : qZ.rg) * 2.0 - 1.0;
    // (Le détail s'efface au loin, où il ne ferait que scintiller.)
    float k = uDetail * (1.0 - smoothstep(40.0, 140.0, d));
    float kp = peint ? 0.55 : route ? 0.22 : 1.0;
    vec3 delta = (vec3(0.0, gX.y, gX.x) * w.x + vec3(gY.x, 0.0, gY.y) * w.y + vec3(gZ.x, gZ.y, 0.0) * w.z) * k * kp;
    N = normalize(N + mat3(modelMatrix) * delta);
    base *= mix(1.0, dt.r * 1.5, k * (peint ? 0.6 : route ? 0.06 : 1.0));
    rugo = clamp(rugo + (dt.g - 0.5) * 0.9 * k * (route ? 0.45 : 1.0), 0.04, 1.0);
    cavite = mix(1.0, dt.b, k * (route ? 0.12 : 1.0));
  } else
#endif
  if (emi == 0.0) {
    // Sans textures : le grain très léger d'avant (usure, reprises de peinture).
    base *= 0.93 + 0.14 * bruit(vLocal * 7.0 + 3.1);
  }

  // ---- Les dégâts (le vaisseau) : des brûlures qui gagnent la coque à chaque bouclier perdu, et, vers la
  // fin, des fissures incandescentes qui palpitent dans les zones brûlées ----
  vec3 incandescence = vec3(0.0);
#ifdef AVEC_DEGATS
  if (uDegats > 0.01 && emi == 0.0) {
    float nb = fbm(vLocal * 2.6 + 11.0);
    float seuil = 1.0 - uDegats * 0.62;
    // La brûlure : un cœur noirci, une auréole de suie qui s'estompe.
    float brule = smoothstep(seuil - 0.03, seuil + 0.16, nb);
    float coeur = smoothstep(seuil + 0.08, seuil + 0.22, nb);
    base = mix(base, base * 0.35 + vec3(0.02, 0.016, 0.012), brule * 0.75);
    base = mix(base, vec3(0.012, 0.01, 0.009), coeur * 0.8);
    rugo = mix(rugo, 0.95, brule);
    metal = mix(metal, 0.1, brule);
    // Les fentes : des lignes de crête fines (bruit « ridged »), seulement au cœur des brûlures, qui palpitent.
    float crete = 1.0 - abs(bruit(vLocal * 6.5 + 3.0) * 2.0 - 1.0);
    crete = max(crete, 1.0 - abs(bruit(vLocal * 13.0 + 9.0) * 2.0 - 1.0) * 1.15);
    float fente = smoothstep(0.92, 0.985, crete) * coeur * smoothstep(0.4, 0.75, uDegats);
    incandescence = vec3(1.0, 0.3, 0.05) * fente * (0.6 + 0.4 * sin(uTemps * 9.0 + nb * 25.0)) * 3.0;
  }
#endif

  // ---- La lumière : soleil (et son ombre), ciel/sol, reflets, lumières ponctuelles ----
  float nl = max(dot(N, L), 0.0);
  float ombre = ombreSoleil(nl);
  // L'ombre de contact (sans carte d'ombres) : une tache douce sous le vaisseau.
  if (uContact.w > 0.0) {
    float dc = length((vPlie.xz - uContact.xy) / vec2(uContact.z, uContact.z * 1.6));
    ombre *= 1.0 - uContact.w * (1.0 - smoothstep(0.35, 1.0, dc)) * step(vPlie.y, 0.2);
  }
  vec3 ambiance = mix(uSol, uCiel, N.y * 0.5 + 0.5);
  vec3 H = normalize(L + V);
  float brillance = mix(220.0, 8.0, rugo);
  float spec = pow(max(dot(N, H), 0.0), brillance) * (1.0 - rugo * 0.85) * (brillance + 8.0) / 60.0;
  float nv = max(dot(N, V), 0.0);
  float fresnel = pow(1.0 - nv, 5.0);
  vec3 R = reflect(-V, N);
  vec3 env = environnement(R, rugo, ombre);
  // (V4-H7) Sur la chaussée : le reflet des rails lumineux du pied des bords (x = ±4,92, y ≈ 0,07 ; le second,
  // plus haut, de la seconde couleur), étiré par la rugosité — les longues traînées de lumière sur la route.
  if (canal == ${CANAL.revetement} && R.y > 0.0) {
    // (Le ciel s'y reflète peu : la route reste sombre, ce sont les lumières qui s'y étirent.)
    env *= 0.4;
    for (int k = 0; k < 4; k++) {
      float xr = (k == 0 || k == 2) ? 4.92 : -4.92;
      float yr = k < 2 ? 0.07 : 0.25;
      if (k >= 2) xr *= 1.06;
      float dx = xr - vMonde.x;
      if (dx * R.x <= 0.0) continue;
      float t = dx / R.x;
      float largeur = 0.06 + rugo * 0.9;
      float trace = exp(-pow((t * R.y - yr) / largeur, 2.0)) * exp(-t * 0.04);
      env += (k < 2 ? uAccent * 3.2 : uAccent2 * 2.0) * trace;
    }
  }
  // Dans l'ombre, le ciel aussi est en partie caché par ce qui la porte : ambiance et reflets baissent.
  float voile = mix(0.5, 1.0, ombre);
  vec3 f0 = mix(vec3(0.04), base, metal);
  vec3 couleur = base * (1.0 - metal) * (ambiance * cavite * voile + uSoleil * nl * ombre);
  couleur += env * mix(f0, vec3(1.0), fresnel) * (1.0 - rugo * 0.75) * cavite * voile;
  couleur += uSoleil * spec * mix(vec3(0.5), base + 0.3, metal) * nl * ombre * mix(1.0, cavite, 0.6);
  // Le vernis des peintures : un second reflet, net, par-dessus la couleur.
#ifdef AVEC_TEXTURES
  if (peint) {
    float verni = pow(max(dot(N, H), 0.0), 600.0) * 6.0;
    couleur += uSoleil * verni * nl * ombre * 0.5 + env * 0.06 * (0.25 + fresnel * 3.0) * cavite;
  }
#endif
  // Les lumières ponctuelles (réacteurs, fragments, feux de danger, portails).
#ifdef AVEC_LUMIERES
  for (int i = 0; i < 8; i++) {
    if (i >= uNbLum) break;
    vec4 lp = uLumPos[i];
    vec3 dl = lp.xyz - vPlie;
    float dist = length(dl);
    if (dist > lp.w) continue;
    vec3 Ld = dl / dist;
    float att = 1.0 - dist / lp.w;
    att *= att;
    float ndl = max(dot(N, Ld), 0.0);
    vec3 Hl = normalize(Ld + V);
    float sl = pow(max(dot(N, Hl), 0.0), brillance) * (1.0 - rugo * 0.8) * (brillance + 8.0) / 60.0;
    couleur += uLumCoul[i] * att * (base * (1.0 - metal) * ndl + mix(vec3(0.4), base + 0.3, metal) * sl * ndl) * cavite;
  }
#endif
  // Un peu de lumière de la piste sur ce qui est proche du sol (la piste éclaire les flancs).
  couleur += uAccent * 0.05 * exp(-abs(vMonde.y) * 0.9) * (1.0 - metal * 0.5) * (0.6 + uIntensite);

  // L'émission. Sur les lignes de la piste (accent), des impulsions courent vers l'avant ;
  // elles s'accélèrent et s'intensifient avec le combo et l'Overdrive.
  if (emi > 0.0) {
    float force = emi * uEmission;
    // « s » : la position sur le parcours. Elle est fixe pour un point de la piste : ce qui en dépend défile avec elle.
    float s = uDistance - vMonde.z;
    if (canal == ${CANAL.accent}) {
      float onde = fract((s - uTemps * (70.0 + uBoost * 90.0)) / 42.0);
      force *= 0.75 + (smoothstep(0.86, 1.0, onde) * 2.2 + uBoost * 0.8) * (0.35 + uIntensite);
    } else if (canal == ${CANAL.ligne}) {
      // Les lignes de guidage : des tirets posés sur la piste, qui passent sous le vaisseau ; ils s'allongent en Overdrive.
      float dd = fract(s / 4.5);
      float rempli = mix(0.38, 0.86, uBoost);
      float tiret = smoothstep(0.0, 0.03, dd) * (1.0 - smoothstep(rempli, rempli + 0.03, dd));
      force *= 0.16 + tiret * (1.0 + uIntensite * 0.6 + uBoost * 0.5);
    } else if (canal == ${CANAL.clignote}) {
      // Les feux à éclats (navigation, balises) : un éclair bref, chaque feu à son rythme.
      float ph = fract(uTemps * 0.8 + vLocal.x * 0.21 + vLocal.z * 0.13);
      force *= 0.06 + 1.6 * (1.0 - smoothstep(0.0, 0.09, ph));
    } else if (canal == ${CANAL.fissure}) {
      // Les fissures du gouffre : un réseau irrégulier, attaché à la piste, qui palpite.
      float n = bruit(vec3(vMonde.x * 2.3, s * 0.85, 0.0)) + 0.5 * bruit(vec3(vMonde.x * 6.0, s * 2.1, 3.0));
      float trait = 1.0 - smoothstep(0.0, 0.07, abs(n - 0.75));
      force *= trait * (0.75 + 0.25 * sin(uTemps * 5.0 + s * 0.4)) + 0.04;
    }
    couleur += lueur * force * 3.2;
  }
  couleur += uImpactCouleur * uImpact * (0.4 + fresnel * 2.0);
  couleur += incandescence;

  // La profondeur : le brouillard du monde (l'émission le perce un peu).
  float b = smoothstep(uBrume.x, uBrume.y, d);
  couleur = mix(couleur, uBrouillard, b * (1.0 - min(emi, 1.0) * 0.45));
  sortie = vec4(ecran(couleur * uExposition), uOpacite);
}`;

/**
 * Les variantes du shader de surface. Un rendu logiciel (sans carte graphique) exécute toutes les branches,
 * même celles qu'un réglage désactive : la qualité « Économie » compile donc un shader sans textures, sans
 * ombres et sans lumières ponctuelles (aussi léger que celui d'avant V4-H), et les autres qualités le shader complet.
 */
export interface VarianteSurface {
  textures: boolean;
  ombres: boolean;
  lumieres: boolean;
}
const fragmentSurface = (v: VarianteSurface, degats: boolean) =>
  SURFACE_FRAG.replace('/*VARIANTE*/', [v.textures && '#define AVEC_TEXTURES', v.ombres && '#define AVEC_OMBRES', v.lumieres && '#define AVEC_LUMIERES', degats && '#define AVEC_DEGATS'].filter(Boolean).join('\n') + '\n');
const variantes = new WeakMap<Program, { degats: boolean; cle: string }>();
/** Recompile un programme de surface dans une autre variante (les maillages qui l'utilisent n'ont rien à faire). */
export function varianteSurface(p: Program, v: VarianteSurface): void {
  const info = variantes.get(p);
  const cle = `${+v.textures}${+v.ombres}${+v.lumieres}`;
  if (!info || info.cle === cle) return;
  info.cle = cle;
  p.setShaders({ vertex: SURFACE_VERT, fragment: fragmentSurface(v, info.degats) });
}

/** Un programme de surface (solide). « transparent » : verre, bulles. « degats » : le vaisseau (brûlures). */
export function surface(gl: Gl, monde: Monde, options: { transparent?: boolean; profondeur?: boolean; echelle?: number; detail?: number; degats?: boolean } = {}) {
  const complet: VarianteSurface = { textures: true, ombres: true, lumieres: true };
  const p = new Program(gl, {
    vertex: SURFACE_VERT,
    fragment: fragmentSurface(complet, !!options.degats),
    uniforms: { uPlie: { value: 1 }, ...monde, uTeinte: { value: [1, 1, 1] }, uEmission: { value: 1 }, uOpacite: { value: 1 }, uImpact: { value: 0 }, uImpactCouleur: { value: [1, 0.2, 0.15] }, uDegats: { value: 0 }, uEchelleTex: { value: options.echelle ?? 0.5 }, uDetail: { value: options.detail ?? 1 } },
    transparent: !!options.transparent,
    depthWrite: options.profondeur ?? !options.transparent,
    cullFace: false,
  });
  variantes.set(p, { degats: !!options.degats, cle: '111' });
  return p;
}

// ==========================================================================
// LES HALOS ET LES FLAMMES : de la lumière pure, ajoutée à l'image
// ==========================================================================
const HALO_VERT = /* glsl */ `${ENTETE}
in vec3 position; in vec2 uv; in vec3 couleur;
uniform mat4 modelMatrix; uniform mat4 viewMatrix; uniform mat4 projectionMatrix;
${PLIER_GLSL}
out vec2 vUv; out vec3 vCouleur; out float vDist;
void main() {
  vec4 m = modelMatrix * vec4(position, 1.0);
  vUv = uv; vCouleur = couleur;
  vec3 n = vec3(0.0, 1.0, 0.0);
  vec4 vue = viewMatrix * vec4(plier(m.xyz, n), 1.0); vDist = -vue.z;
  gl_Position = projectionMatrix * vue;
}`;
const HALO_FRAG = /* glsl */ `${ENTETE}
${COMMUN}
in vec2 vUv; in vec3 vCouleur; in float vDist;
uniform vec2 uBrume; uniform float uTemps; uniform float uForce;
out vec4 sortie;
void main() {
  float r = length(vUv);
  float a = exp(-r * r * 4.0) * (1.0 - smoothstep(0.85, 1.0, r));
  a += exp(-r * 18.0) * 0.6;
  float b = 1.0 - smoothstep(uBrume.x, uBrume.y * 1.1, vDist) * 0.85;
  vec3 c = vCouleur * a * b * uForce;
  sortie = vec4(ecran(c * 1.6), 1.0);
}`;
export function halo(gl: Gl, monde: Monde) {
  const p = new Program(gl, {
    vertex: HALO_VERT,
    fragment: HALO_FRAG,
    uniforms: { uBrume: monde.uBrume, uTemps: monde.uTemps, uForce: { value: 1 }, ...pli(monde) },
    transparent: true,
    depthWrite: false,
    cullFace: false,
  });
  p.setBlendFunc(gl.ONE, gl.ONE);
  return p;
}

/**
 * L'énergie : flammes de moteur, faisceaux laser, voiles de portail, bouclier.
 * La géométrie est une surface ordinaire ; la couleur vient de l'uniforme, et le
 * bruit fait vivre la matière. « forme » : 0 flamme, 1 faisceau, 2 voile tournant, 3 bulle.
 */
const ENERGIE_FRAG = /* glsl */ `${ENTETE}
${COMMUN}
in vec3 vMonde; in vec3 vNormale; in vec3 vCouleur; in vec4 vMatiere; in vec3 vLocal; in vec3 vPlie;
uniform vec3 cameraPosition;
uniform vec3 uCouleur; uniform float uForce; uniform float uTemps; uniform int uForme; uniform vec2 uBrume; uniform float uLongueur;
out vec4 sortie;
void main() {
  vec3 V = normalize(cameraPosition - vPlie);
  vec3 N = normalize(vNormale);
  float face = abs(dot(N, V));
  float a = 1.0;
  if (uForme == 0) {
    // Flamme : le long de +z local (0 à uLongueur), elle s'amincit et scintille.
    float t = clamp(vLocal.z / uLongueur, 0.0, 1.0);
    float n = fbm(vec3(vLocal.xy * 3.0, vLocal.z * 2.0 - uTemps * 18.0));
    a = (1.0 - t) * (0.55 + n * 0.9) * pow(face, 1.5);
  } else if (uForme == 1) {
    float n = bruit(vec3(vMonde.x * 4.0, vMonde.y * 4.0, uTemps * 30.0));
    a = (0.6 + 0.4 * n) * pow(face, 0.8);
  } else if (uForme == 2) {
    float ang = atan(vLocal.y, vLocal.x);
    float r = length(vLocal.xy);
    float n = fbm(vec3(cos(ang * 3.0 + uTemps * 2.0 + r * 4.0), sin(ang * 3.0 - uTemps * 1.5), r * 3.0 - uTemps));
    a = (0.25 + n * 0.9) * smoothstep(1.15, 0.2, r) + smoothstep(0.75, 1.05, r) * 0.6;
  } else if (uForme == 4) {
    float v = fract(vMonde.z * 0.35 + abs(vLocal.x) * 0.9 - uTemps * 2.4);
    a = smoothstep(0.35, 0.45, v) * (1.0 - smoothstep(0.62, 0.72, v)) * (1.0 - abs(vLocal.x) * 1.3);
  } else {
    float fres = pow(1.0 - face, 2.5);
    float n = bruit(vMonde * 3.0 + uTemps * 2.0);
    a = fres * (0.6 + 0.6 * n);
  }
  float d = length(vPlie - cameraPosition);
  a *= 1.0 - smoothstep(uBrume.x, uBrume.y * 1.15, d) * 0.9;
  vec3 c = uCouleur * a * uForce;
  sortie = vec4(ecran(c * 1.5), 1.0);
}`;
export function energie(gl: Gl, monde: Monde, forme: number) {
  const p = new Program(gl, {
    vertex: SURFACE_VERT,
    fragment: ENERGIE_FRAG,
    uniforms: { uCouleur: { value: [1, 1, 1] }, uForce: { value: 1 }, uTemps: monde.uTemps, uForme: { value: forme }, uBrume: monde.uBrume, uLongueur: { value: 1 }, ...pli(monde) },
    transparent: true,
    depthWrite: false,
    cullFace: false,
  });
  p.setBlendFunc(gl.ONE, gl.ONE);
  return p;
}

// ==========================================================================
// LE CIEL : un triangle plein écran, derrière tout
// ==========================================================================
const CIEL_VERT = /* glsl */ `${ENTETE}
in vec2 position; out vec2 vEcran;
void main() { vEcran = position; gl_Position = vec4(position, 1.0, 1.0); }`;
const CIEL_FRAG = /* glsl */ `${ENTETE}
${COMMUN}
in vec2 vEcran;
uniform mat4 uInverse;
uniform vec3 uSoleilDir, uSoleil, uHaut, uHorizon, uBas, uNebuleuse1, uNebuleuse2, uBrouillard;
uniform float uDensite, uEtoiles, uTemps, uEclair, uBoost, uVoile, uCap, uPente;
out vec4 sortie;
void main() {
  vec4 p = uInverse * vec4(vEcran, 1.0, 1.0);
  vec3 vue = normalize(p.xyz / p.w);
  // La direction dans le repère du ciel : on défait le virage (cap), puis la côte (pente).
  float cc = cos(uCap), sc = sin(uCap), cp = cos(uPente), sp = sin(uPente);
  vec3 d1 = vec3(vue.x * cc - vue.z * sc, vue.y, vue.x * sc + vue.z * cc);
  vec3 dir = vec3(d1.x, d1.y * cp - d1.z * sp, d1.y * sp + d1.z * cp);
  float h = dir.y;
  vec3 c = mix(uHorizon, uHaut, smoothstep(0.0, 0.75, h));
  c = mix(c, uBas, smoothstep(0.0, -0.5, h));
  // La nébuleuse : deux couleurs, des volutes lentes.
  vec3 q = dir * 2.2 + vec3(0.0, 0.0, uTemps * 0.004);
  float n = fbm(q + fbm(q * 1.7) * 0.8);
  float m = fbm(q * 3.1 + 4.0);
  c += uNebuleuse1 * smoothstep(0.45, 0.95, n) * uDensite;
  c += uNebuleuse2 * smoothstep(0.55, 1.0, m * n * 1.6) * uDensite * 0.8;
  // Les étoiles (plus nombreuses loin du plan de la piste).
  vec3 g = floor(dir * 260.0);
  float e = hash(g);
  if (e > 0.9965) {
    vec3 centre = (g + 0.5) / 260.0;
    float f = 1.0 - smoothstep(0.0, 0.0028, length(normalize(centre) - dir));
    float scint = 0.7 + 0.3 * sin(uTemps * 3.0 + e * 60.0);
    c += vec3(0.8, 0.88, 1.0) * f * scint * uEtoiles * (e - 0.9965) * 300.0;
  }
  // La Voie lactée : une bande laiteuse en travers du ciel, coupée de poussière sombre.
  vec3 axe = normalize(vec3(0.32, 0.84, -0.44));
  float lat = dot(dir, axe);
  float bande = exp(-lat * lat / 0.03);
  float poussiere = fbm(dir * 6.5 + 11.0);
  vec3 lait = mix(vec3(0.5, 0.58, 0.9), vec3(0.98, 0.84, 0.7), smoothstep(0.35, 0.75, bruit(dir * 3.0 + 5.0)));
  c += lait * bande * (0.03 + 0.07 * smoothstep(0.4, 0.85, bruit(dir * 22.0))) * uEtoiles * (1.0 - smoothstep(0.42, 0.68, poussiere) * 0.9);
  // Les étoiles fines, plus serrées dans la bande ; chacune a sa couleur (bleutée, blanche, orangée).
  vec3 g2 = floor(dir * 640.0);
  float e2 = hash(g2 + 17.0);
  float seuil = 0.9978 - bande * 0.0065;
  if (e2 > seuil) {
    vec3 centre2 = (g2 + 0.5) / 640.0;
    float f2 = 1.0 - smoothstep(0.0, 0.0014, length(normalize(centre2) - dir));
    vec3 teinte = mix(vec3(1.0, 0.74, 0.52), vec3(0.62, 0.76, 1.0), hash(g2 + 3.0));
    c += teinte * f2 * uEtoiles * (0.5 + 0.5 * sin(uTemps * 2.0 + e2 * 90.0)) * 0.9;
  }
  // Deux galaxies lointaines : de petites spirales floues.
  for (int i = 0; i < 2; i++) {
    vec3 pos = normalize(i == 0 ? vec3(-0.62, 0.55, -0.56) : vec3(0.7, 0.32, 0.64));
    vec3 dd = dir - pos;
    float r2 = length(dd);
    if (r2 < 0.06) {
      float ang = atan(dd.y, dd.x + dd.z);
      float spirale = 0.5 + 0.5 * sin(ang * 2.0 + log(r2 + 0.002) * 6.0);
      c += vec3(0.75, 0.72, 0.95) * exp(-r2 * 90.0) * (0.25 + 0.35 * spirale) * uEtoiles * 0.6;
    }
  }
  // Le soleil et sa lueur.
  vec3 L = normalize(uSoleilDir);
  float s = max(dot(vue, L), 0.0);
  c += uSoleil * (pow(s, 900.0) * 6.0 + pow(s, 60.0) * 0.12 + pow(s, 8.0) * 0.012);
  c += vec3(0.75, 0.82, 1.0) * uEclair * smoothstep(-0.1, 0.5, h) * (0.4 + n);
  c = mix(c, uBrouillard, uVoile * (1.0 - smoothstep(-0.1, 0.35, abs(h))));
  sortie = vec4(ecran(c), 1.0);
}`;
export function ciel(gl: Gl, monde: Monde) {
  return new Program(gl, {
    vertex: CIEL_VERT,
    fragment: CIEL_FRAG,
    uniforms: {
      uInverse: { value: new Float32Array(16) },
      uHdr: monde.uHdr,
      uSoleilDir: monde.uSoleilDir,
      uSoleil: monde.uSoleil,
      uBrouillard: monde.uBrouillard,
      uHaut: { value: [0, 0, 0] },
      uHorizon: { value: [0, 0, 0] },
      uBas: { value: [0, 0, 0] },
      uNebuleuse1: { value: [0, 0, 0] },
      uNebuleuse2: { value: [0, 0, 0] },
      uDensite: { value: 1 },
      uEtoiles: { value: 1 },
      uTemps: monde.uTemps,
      uEclair: { value: 0 },
      uBoost: monde.uBoost,
      uVoile: { value: 0.3 },
      uCap: { value: 0 },
      uPente: { value: 0 },
    },
    depthTest: false,
    depthWrite: false,
    cullFace: false,
  });
}

// ==========================================================================
// LES PLANÈTES : relief procédural, éclairées par le soleil, atmosphère
// ==========================================================================
const PLANETE_FRAG = /* glsl */ `${ENTETE}
${COMMUN}
in vec3 vMonde; in vec3 vNormale; in vec3 vCouleur; in vec4 vMatiere; in vec3 vLocal;
uniform vec3 cameraPosition; uniform vec3 uSoleilDir; uniform vec3 uSoleil;
uniform vec3 uCouleurA, uCouleurB, uAtmosphere; uniform int uGenre; uniform float uTemps; uniform float uGraine;
out vec4 sortie;
void main() {
  vec3 N = normalize(vNormale);
  vec3 P = normalize(vLocal);
  // La planète tourne lentement sur elle-même (le relief défile, l'éclairage reste celui du soleil).
  float rot = uTemps * 0.006 + uGraine;
  P = vec3(P.x * cos(rot) - P.z * sin(rot), P.y, P.x * sin(rot) + P.z * cos(rot));
  vec3 V = normalize(cameraPosition - vMonde);
  float t;
  if (uGenre == 0) {
    // Géante gazeuse : des bandes déformées.
    float bandes = sin(P.y * 18.0 + fbm(P * 3.0 + uGraine) * 4.0 + uTemps * 0.01);
    t = bandes * 0.5 + 0.5;
  } else if (uGenre == 1) {
    // Tellurique : continents et nuages.
    float sol = fbm(P * 2.5 + uGraine);
    t = smoothstep(0.45, 0.55, sol);
  } else {
    // Rocheuse : cratères et poussière.
    t = fbm(P * 6.0 + uGraine) * 0.8 + bruit(P * 30.0) * 0.2;
  }
  vec3 base = mix(uCouleurA, uCouleurB, t);
  vec3 Ls = normalize(uSoleilDir);
  float diffus = max(dot(N, Ls), 0.0);
  float terminateur = smoothstep(-0.05, 0.25, dot(N, Ls));
  float nuages = 0.0;
  if (uGenre == 0) {
    // Une grande tempête ovale, et des bandes plus contrastées.
    vec2 q = vec2(atan(P.z, P.x), P.y);
    float tache = exp(-pow((q.x - 1.1) / 0.32, 2.0) - pow((q.y + 0.28) / 0.1, 2.0));
    base = mix(base, uCouleurB * vec3(1.25, 0.8, 0.6), tache * (0.6 + 0.4 * fbm(P * 12.0)));
    base *= 0.85 + 0.3 * bruit(vec3(P.y * 60.0, 0.0, uGraine));
  } else if (uGenre == 1) {
    nuages = smoothstep(0.6, 0.8, fbm(P * 4.0 + vec3(uTemps * 0.002, 0.0, 0.0) + 9.0));
    base = mix(base, vec3(0.95), nuages * 0.8);
  } else {
    // Les cratères : des anneaux plus clairs, un fond plus sombre.
    float cr = bruit(P * 13.0 + uGraine);
    base *= 1.0 - smoothstep(0.62, 0.7, cr) * 0.35 + smoothstep(0.58, 0.62, cr) * (1.0 - smoothstep(0.62, 0.66, cr)) * 0.45;
  }
  vec3 c = base * (uSoleil * diffus * 1.2 + 0.015);
  if (uGenre == 1) {
    // Le reflet du soleil sur les océans, et les lumières des villes sur la face de nuit.
    float ocean = (1.0 - t) * (1.0 - nuages);
    vec3 H = normalize(Ls + V);
    c += uSoleil * pow(max(dot(N, H), 0.0), 70.0) * ocean * 0.9 * diffus;
    float villes = smoothstep(0.72, 0.9, bruit(P * 70.0 + uGraine)) * smoothstep(0.5, 0.56, fbm(P * 2.5 + uGraine)) * (1.0 - nuages);
    c += vec3(1.0, 0.72, 0.38) * villes * (1.0 - smoothstep(-0.15, 0.1, dot(N, Ls))) * 0.55;
  }
  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  c += uAtmosphere * fres * (0.25 + terminateur * 1.2);
  sortie = vec4(ecran(c), 1.0);
}`;
export function planete(gl: Gl, monde: Monde) {
  return new Program(gl, {
    vertex: SURFACE_VERT,
    fragment: PLANETE_FRAG,
    uniforms: {
      uSoleilDir: monde.uSoleilDir,
      uSoleil: monde.uSoleil,
      uCouleurA: { value: [0.2, 0.3, 0.5] },
      uCouleurB: { value: [0.5, 0.6, 0.8] },
      uAtmosphere: { value: [0.3, 0.5, 1] },
      uGenre: { value: 1 },
      uTemps: monde.uTemps,
      uGraine: { value: 0 },
      ...pli(monde, 0),
    },
    cullFace: false,
  });
}

/** Les anneaux d'une planète ou le disque d'accrétion : des bandes translucides. */
const ANNEAU_FRAG = /* glsl */ `${ENTETE}
${COMMUN}
in vec3 vMonde; in vec3 vNormale; in vec3 vCouleur; in vec4 vMatiere; in vec3 vLocal;
uniform vec3 uCouleurA; uniform vec3 uCouleurB; uniform float uR0; uniform float uR1; uniform float uTemps; uniform int uGenre; uniform vec3 uSoleil;
out vec4 sortie;
void main() {
  float r = (length(vLocal.xy) - uR0) / (uR1 - uR0);
  float ang = atan(vLocal.y, vLocal.x);
  float a;
  vec3 c;
  if (uGenre == 0) {
    float bandes = fbm(vec3(r * 40.0, 0.0, 0.0)) * 0.8 + 0.2;
    a = bandes * smoothstep(0.0, 0.08, r) * smoothstep(1.0, 0.85, r) * 0.75;
    c = mix(uCouleurA, uCouleurB, bandes) * uSoleil * 0.9;
  } else {
    // Disque d'accrétion : il tourne, plus chaud vers le centre.
    float n = fbm(vec3(cos(ang * 2.0 - uTemps * 0.8 / (0.3 + r)), sin(ang * 2.0 - uTemps * 0.8 / (0.3 + r)), r * 9.0));
    a = (0.35 + n) * smoothstep(0.0, 0.06, r) * smoothstep(1.0, 0.4, r);
    c = mix(uCouleurA * 4.0, uCouleurB, smoothstep(0.0, 0.7, r)) * (0.6 + n);
  }
  sortie = vec4(ecran(c * a), a);
}`;
export function anneau(gl: Gl, monde: Monde) {
  const p = new Program(gl, {
    vertex: SURFACE_VERT,
    fragment: ANNEAU_FRAG,
    uniforms: { uCouleurA: { value: [1, 0.9, 0.7] }, uCouleurB: { value: [0.6, 0.5, 0.4] }, uR0: { value: 1 }, uR1: { value: 2 }, uTemps: monde.uTemps, uGenre: { value: 0 }, uSoleil: monde.uSoleil, ...pli(monde, 0) },
    transparent: true,
    depthWrite: false,
    cullFace: false,
  });
  p.setBlendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  return p;
}

// ==========================================================================
// LES PARTICULES : étincelles, éclats, poussière de vitesse
// ==========================================================================
const POINTS_VERT = /* glsl */ `${ENTETE}
in vec3 position; in vec4 couleur; in float taille;
uniform mat4 modelMatrix; uniform mat4 viewMatrix; uniform mat4 projectionMatrix; uniform float uEchelle;
${PLIER_GLSL}
out vec4 vCouleur;
void main() {
  vec3 n = vec3(0.0, 1.0, 0.0);
  vec4 vue = viewMatrix * vec4(plier((modelMatrix * vec4(position, 1.0)).xyz, n), 1.0);
  vCouleur = couleur;
  gl_PointSize = taille * uEchelle / max(0.5, -vue.z);
  gl_Position = projectionMatrix * vue;
}`;
const POINTS_FRAG = /* glsl */ `${ENTETE}
${COMMUN}
in vec4 vCouleur; out vec4 sortie;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float a = pow(max(0.0, 1.0 - r), 2.0) * vCouleur.a;
  sortie = vec4(ecran(vCouleur.rgb * a * 2.0), 1.0);
}`;
export function points(gl: Gl, monde: Monde) {
  const p = new Program(gl, {
    vertex: POINTS_VERT,
    fragment: POINTS_FRAG,
    uniforms: { uEchelle: { value: 300 }, ...pli(monde) },
    transparent: true,
    depthWrite: false,
    cullFace: false,
  });
  p.setBlendFunc(gl.ONE, gl.ONE);
  return p;
}

const TRAIT_VERT = /* glsl */ `${ENTETE}
in vec3 position; in vec4 couleur;
uniform mat4 modelMatrix; uniform mat4 viewMatrix; uniform mat4 projectionMatrix;
${PLIER_GLSL}
out vec4 vCouleur;
void main() {
  vCouleur = couleur;
  vec3 n = vec3(0.0, 1.0, 0.0);
  gl_Position = projectionMatrix * viewMatrix * vec4(plier((modelMatrix * vec4(position, 1.0)).xyz, n), 1.0);
}`;
const TRAIT_FRAG = /* glsl */ `${ENTETE}
${COMMUN}
in vec4 vCouleur; out vec4 sortie;
void main() { sortie = vec4(ecran(vCouleur.rgb * vCouleur.a * 1.4), 1.0); }`;
export function traits(gl: Gl, monde: Monde) {
  const p = new Program(gl, { vertex: TRAIT_VERT, fragment: TRAIT_FRAG, uniforms: pli(monde), transparent: true, depthWrite: false, cullFace: false });
  p.setBlendFunc(gl.ONE, gl.ONE);
  return p;
}

export type { Geometry };
