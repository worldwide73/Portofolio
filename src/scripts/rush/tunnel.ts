// PORTAL RUSH V4 — L'ENTRÉE CINÉMATIQUE : LA FISSURE ET LE VOYAGE TEMPOREL (16 octobre 2026)
//
// Quand on lance Portal Rush depuis l'Orbital Hub, son entrée (le bouton « Portal Rush » du Hub) :
//   1. réagit : sa lueur s'intensifie, il vibre, des fissures de verre partent du point touché (toile 2D posée
//      sur le bouton, comme pour le passage « Traverser le portail ») ;
//   2. se brise : ses éclats deviennent de vrais morceaux de verre en 3D (triangles éclairés : reflets, bords,
//      transparence) qui tournent vers la caméra, puis sont aspirés ; une ouverture d'énergie naît à sa place et
//      grandit jusqu'à remplir l'écran. Le reste du Hub et du portfolio ne bouge pas ; le bouton se reforme au retour ;
//   3. le voyage : un tunnel temporel rendu en WebGL 2 (un vrai tube en perspective, courbé dans l'espace,
//      anneaux et structures qui défilent, trois couches de particules, éclats aspirés, distorsions mesurées),
//      cyan, bleu, blanc et violet, avec une forte accélération puis une décélération (4 à 7 s) ;
//   4. l'arrivée : un éclair, et le jeu apparaît dessous (rush.ts ouvre sa fenêtre à ce moment-là).
// On peut le passer (Échap, Entrée, Espace, un clic, ou le bouton « Passer », discret, qui paraît tout de suite
// aux lancements suivants). Mouvement réduit ou animations coupées : une version courte, sans tunnel (un fondu).
// Animations allégées : un voyage plus court. Les sons sont joués par sons.ts (sonVoyageTemporel), au même rythme.

export interface OptionsVoyage {
  /** L'élément qui se brise (le bouton Portal Rush du Hub), s'il est à l'écran. */
  source: HTMLElement | null;
  /** Le point touché (px), ou le centre du bouton. */
  point?: { x: number; y: number } | null;
  /** Durée du voyage (s), sans compter la fissure : 4 à 7 s (complète), plus court si allégée. */
  duree: number;
  /** Version courte (mouvement réduit, animations coupées) : pas de tunnel. */
  court: boolean;
  /** Le bouton « Passer » paraît tout de suite (lancements suivants) ou après une seconde (le premier). */
  passerVisibleTout: boolean;
  texte: { passer: string };
  /** Appelé au moment de l'arrivée (le jeu doit s'ouvrir dessous) ; « passe » si le joueur a passé le voyage. */
  arrivee: (passe: boolean) => void;
  /** Appelé quand tout est fini (la toile est retirée). */
  fin: () => void;
  /** Les moments du voyage, pour le son. */
  moment?: (m: 'charge' | 'bris' | 'tunnel' | 'arrivee' | 'passe') => void;
  /**
   * (Version Unity, 18 octobre 2026) Tant que cette fonction répond vrai, le voyage se prolonge à vitesse de croisière,
   * avant sa fin (le jeu se charge encore) ; il reprend sa décélération et son arrivée dès qu'elle répond faux.
   * Sans elle, rien ne change.
   */
  retenir?: () => boolean;
}

const VERTEX_PLEIN = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

// Le tunnel : pour chaque pixel, un rayon depuis la caméra coupe un tube de rayon 1 ; on obtient la profondeur
// et l'angle du point touché sur la paroi, et l'on y dessine plaques, anneaux, structures, particules.
const FRAGMENT_TUNNEL = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uT;
uniform float uProfondeur;
uniform float uVitesse;
uniform float uOuverture;
uniform vec2 uCentre;
uniform float uFlash;
uniform float uFondu;
uniform vec2 uCourbe;
uniform float uRoulis;
out vec4 sortie;

float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float bruit(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y);
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 p = (frag * 2.0 - uRes) / uRes.y;
  // Le roulis de la caméra (elle s'incline dans les courbes).
  float cr = cos(uRoulis), sr = sin(uRoulis);
  p = mat2(cr, -sr, sr, cr) * p;
  // L'ouverture : le tunnel n'existe d'abord que dans un disque qui grandit depuis le bouton brisé.
  vec2 c = (uCentre * 2.0 - uRes) / uRes.y;
  float dOuv = length((frag * 2.0 - uRes) / uRes.y - c);
  float rayonOuv = uOuverture * 2.6;
  float masque = smoothstep(rayonOuv, rayonOuv - 0.06 - 0.25 * uOuverture, dOuv);
  // La courbure de l'espace : l'axe du tube s'écarte avec la profondeur (le tunnel tourne). On cherche où le
  // rayon du pixel touche la paroi d'un tube courbé : quelques itérations (point fixe) suffisent.
  float z0 = 1.5 / max(length(p), 0.02);
  vec2 q = p;
  for (int i = 0; i < 4; i++) {
    q = p - uCourbe * 0.014 * min(z0, 30.0);
    z0 = 1.5 / max(length(q), 0.02);
  }
  float r = max(length(q), 0.0015);
  float ang = atan(q.y, q.x);
  float z = 1.5 / r;
  float zw = z + uProfondeur;
  // Les distorsions, mesurées : la paroi ondule un peu, plus vite quand la vitesse monte.
  ang += 0.05 * sin(zw * 0.35 + uT * 1.7) * (0.4 + uVitesse);
  float u = ang / 6.28318 + 0.5;
  // (Au-delà de 16 m, la paroi se fond dans la lumière du cœur : la courbure y est bornée.)
  float brouillard = exp(-z * 0.055) * (1.0 - smoothstep(16.0, 30.0, z));
  // Les plaques de la paroi : une grille en (angle, profondeur), aux joints lumineux.
  vec2 g = vec2(u * 24.0, zw * 0.5);
  vec2 gf = abs(fract(g) - 0.5);
  float joint = smoothstep(0.47, 0.5, max(gf.x, gf.y));
  float plaque = 0.35 + 0.65 * h21(floor(g));
  // Les anneaux (structures qui passent) : une bande tous les 9 m, plus marquée une fois sur trois.
  float an = fract(zw / 9.0);
  float anneau = smoothstep(0.035, 0.0, abs(an - 0.5) - 0.0) * (mod(floor(zw / 9.0), 3.0) < 1.0 ? 1.6 : 0.8);
  // Les nervures : deux grandes hélices fines (structure du tube), un tour tous les 27 m.
  float arc = smoothstep(0.465, 0.5, abs(fract(zw / 27.0 + u * 2.0) - 0.5));
  // Les rails : quatre filets de lumière le long du tube, parcourus d'impulsions qui filent vers l'arrière.
  float ru = 0.5 - abs(fract(u * 4.0 + 0.125) - 0.5);
  float rail = smoothstep(0.012, 0.0, ru) * (0.35 + 0.65 * smoothstep(0.55, 1.0, fract(zw / 14.0)));
  // Trois couches de particules : des traits étirés par la vitesse, à trois rayons du centre.
  float part = 0.0;
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    vec2 cell = vec2(u * (40.0 + fk * 30.0), zw * (0.25 + fk * 0.12) + fk * 13.0);
    vec2 id = floor(cell);
    vec2 fc = fract(cell);
    float hh = h21(id + fk * 7.1);
    float trait = smoothstep(0.08, 0.0, abs(fc.x - 0.5)) * smoothstep(0.0, 0.2 + uVitesse * 0.6, fc.y) * smoothstep(1.0, 0.7, fc.y);
    part += trait * step(0.86 - fk * 0.04, hh) * (1.0 - fk * 0.25);
  }
  // Les couleurs : une nuit bleue profonde, cyan, blanc et violet pour la lumière.
  vec3 cyan = vec3(0.38, 0.85, 1.0), bleu = vec3(0.12, 0.3, 0.95), blanc = vec3(0.95, 0.98, 1.0), violet = vec3(0.62, 0.42, 1.0);
  vec3 nuit = vec3(0.012, 0.022, 0.06);
  float teinte = 0.5 + 0.5 * sin(u * 6.28318 * 2.0 + zw * 0.05 + uT * 0.4);
  // La paroi : des plaques de métal sombre, éclairées par le cœur (plus clair près de la caméra, où la
  // lumière du tunnel les frappe de biais) ; un léger reflet qui suit la vitesse.
  float eclairage = 0.25 + 0.75 * smoothstep(0.1, 1.1, r);
  vec3 paroi = mix(vec3(0.04, 0.08, 0.2), vec3(0.11, 0.07, 0.24), teinte) * plaque * eclairage;
  paroi += vec3(0.05, 0.1, 0.2) * pow(1.0 - abs(fract(g.x) - 0.5) * 2.0, 6.0) * uVitesse * 0.6;
  vec3 col = mix(nuit, paroi, 0.25 + 0.75 * brouillard);
  col += cyan * joint * 0.4 * brouillard;
  col += mix(cyan, blanc, 0.45) * anneau * brouillard * (0.6 + uVitesse);
  col += mix(violet, cyan, teinte) * arc * brouillard * 0.7;
  col += mix(cyan, violet, step(0.5, fract(u * 2.0))) * rail * (0.25 + 0.75 * brouillard) * (0.7 + 0.8 * uVitesse);
  col += mix(blanc, cyan, h21(vec2(floor(u * 60.0), 3.0))) * part * (0.3 + 1.1 * uVitesse) * (0.4 + 0.6 * brouillard);
  // Le cœur du tunnel : une lumière blanche au loin, entourée d'un tourbillon violet qui tourne.
  float spirale = (0.5 + 0.5 * sin(ang * 3.0 + log(r) * 7.0 - uT * 5.0)) * smoothstep(0.015, 0.09, r);
  float halo = exp(-r * (7.0 - 3.5 * uVitesse));
  col += mix(violet, cyan, 0.3) * halo * spirale * (0.35 + 0.5 * uVitesse);
  col += blanc * exp(-r * (16.0 - 8.0 * uVitesse)) * (0.7 + 0.6 * uVitesse);
  // Un voile de bruit qui file (l'espace qui se déforme).
  col += bleu * 0.08 * bruit(vec2(u * 8.0, zw * 0.08 - uT)) * brouillard;
  // Le vignetage : les bords de l'image s'assombrissent, le regard file vers le centre.
  vec2 pv = (frag / uRes) - 0.5;
  col *= 1.0 - 0.55 * dot(pv, pv) * 2.0;
  // Le bord de l'ouverture : un liseré d'énergie.
  float bord = smoothstep(0.08, 0.0, abs(dOuv - rayonOuv + 0.03)) * step(0.001, uOuverture) * (1.0 - smoothstep(0.85, 1.0, uOuverture));
  col += mix(cyan, blanc, 0.5) * bord * 1.6;
  col = mix(col, vec3(1.0), uFlash);
  float alpha = max(masque, bord * 0.9) * uFondu;
  sortie = vec4(col * alpha, alpha);
}`;

// Les éclats de verre : des triangles en 3D, éclairés (reflet de Fresnel, éclat spéculaire, bords lumineux).
const VERTEX_ECLAT = `#version 300 es
in vec3 aPos;
in vec3 aNormale;
in float aAlpha;
uniform mat4 uProjection;
out vec3 vNormale;
out vec3 vPos;
out float vAlpha;
void main() {
  vNormale = aNormale;
  vPos = aPos;
  vAlpha = aAlpha;
  gl_Position = uProjection * vec4(aPos, 1.0);
}`;
const FRAGMENT_ECLAT = `#version 300 es
precision highp float;
in vec3 vNormale;
in vec3 vPos;
in float vAlpha;
uniform float uBord;
out vec4 sortie;
void main() {
  vec3 n = normalize(vNormale);
  vec3 v = normalize(-vPos);
  if (dot(n, v) < 0.0) n = -n;
  float fresnel = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  vec3 l = normalize(vec3(-0.4, 0.7, 0.6));
  float spec = pow(max(dot(reflect(-l, n), v), 0.0), 40.0);
  vec3 verre = vec3(0.55, 0.85, 1.0);
  vec3 col = verre * (0.12 + 0.55 * fresnel) + vec3(1.0) * spec * 1.4;
  float a = (0.16 + 0.6 * fresnel + spec) * vAlpha;
  if (uBord > 0.5) { col = vec3(0.75, 0.95, 1.0); a = 0.85 * vAlpha; }
  sortie = vec4(col * a, a);
}`;

interface Eclat {
  /** Les sommets du morceau, autour de son centre (m), et sa position, sa vitesse, sa rotation. */
  forme: [number, number][];
  pos: [number, number, number];
  vit: [number, number, number];
  axe: [number, number, number];
  angle: number;
  tour: number;
  retard: number;
}

const doux = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const borne = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));

function programme(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram | null {
  const compiler = (type: number, src: string) => {
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.warn(gl.getShaderInfoLog(sh));
      return null;
    }
    return sh;
  };
  const v = compiler(gl.VERTEX_SHADER, vs),
    f = compiler(gl.FRAGMENT_SHADER, fs);
  if (!v || !f) return null;
  const p = gl.createProgram()!;
  gl.attachShader(p, v);
  gl.attachShader(p, f);
  gl.linkProgram(p);
  return gl.getProgramParameter(p, gl.LINK_STATUS) ? p : null;
}

/** Une matrice de perspective (colonnes), champ vertical « fov » (rad). */
function perspective(fov: number, aspect: number, pres: number, loin: number): Float32Array {
  const f = 1 / Math.tan(fov / 2);
  const nf = 1 / (pres - loin);
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (loin + pres) * nf, -1, 0, 0, 2 * loin * pres * nf, 0]);
}

/** Rotation d'un point autour d'un axe (Rodrigues). */
function tourner(p: [number, number, number], axe: [number, number, number], a: number): [number, number, number] {
  const c = Math.cos(a),
    s = Math.sin(a);
  const [x, y, z] = p,
    [u, v, w] = axe;
  const d = u * x + v * y + w * z;
  return [u * d * (1 - c) + x * c + (-w * y + v * z) * s, v * d * (1 - c) + y * c + (w * x - u * z) * s, w * d * (1 - c) + z * c + (-v * x + u * y) * s];
}

/** Les fissures sur le bouton (toile 2D posée dessus), du point touché vers les bords. */
function fissurer(bouton: HTMLElement, impact: { x: number; y: number }, duree: number): () => void {
  const b = bouton.getBoundingClientRect();
  const toile = document.createElement('canvas');
  toile.className = 'fissures-entree';
  toile.setAttribute('aria-hidden', 'true');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  toile.width = Math.round(b.width * dpr);
  toile.height = Math.round(b.height * dpr);
  bouton.append(toile);
  const c = toile.getContext('2d')!;
  c.scale(dpr, dpr);
  const ox = impact.x - b.left,
    oy = impact.y - b.top;
  const branches = Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2 + Math.random() * 0.4;
    const pts: [number, number][] = [[ox, oy]];
    let x = ox,
      y = oy,
      ang = a;
    for (let k = 0; k < 7; k++) {
      ang += (Math.random() - 0.5) * 0.7;
      const pas = Math.max(b.width, b.height) * (0.08 + Math.random() * 0.1);
      x += Math.cos(ang) * pas;
      y += Math.sin(ang) * pas;
      pts.push([x, y]);
    }
    return pts;
  });
  const t0 = performance.now();
  let id = 0;
  const pas = () => {
    const t = borne((performance.now() - t0) / (duree * 1000));
    c.clearRect(0, 0, b.width, b.height);
    c.lineCap = 'round';
    for (const br of branches) {
      const n = Math.max(2, Math.ceil(br.length * doux(t)));
      c.beginPath();
      c.moveTo(br[0][0], br[0][1]);
      for (let k = 1; k < n; k++) c.lineTo(br[k][0], br[k][1]);
      c.strokeStyle = `rgba(220, 248, 255, ${(0.55 + 0.45 * t).toFixed(2)})`;
      c.lineWidth = 1.2;
      c.shadowColor = 'rgba(98, 217, 255, 0.9)';
      c.shadowBlur = 6 + 8 * t;
      c.stroke();
    }
    if (t < 1) id = requestAnimationFrame(pas);
  };
  id = requestAnimationFrame(pas);
  return () => {
    cancelAnimationFrame(id);
    toile.remove();
  };
}

/** Lance la séquence complète. Renvoie de quoi la passer (Échap, etc.), ou null si elle n'a pas pu démarrer. */
export function voyageTemporel(o: OptionsVoyage): { passer: () => void; remonter: () => void; fondre: (ms?: number) => void } | null {
  const b = o.source?.getBoundingClientRect();
  const visible = !!b && b.width > 0 && b.bottom > 0 && b.top < window.innerHeight;
  const impact = o.point ?? (b && visible ? { x: b.left + b.width / 2, y: b.top + b.height / 2 } : { x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const CHARGE = o.court ? 0.25 : 0.5;
  const BRIS = o.court ? 0 : 0.85; // de la rupture à l'ouverture pleine
  const DUREE = o.court ? 0.7 : CHARGE + BRIS + o.duree;
  let fini = false;
  let arrive = false;
  let passe = false;

  // ---- 1. La fissure, sur le bouton lui-même ----
  const bouton = visible ? o.source : null;
  bouton?.classList.add('est-fissure');
  const effacerFissures = bouton ? fissurer(bouton, impact, CHARGE) : () => undefined;
  o.moment?.('charge');

  // ---- La toile du voyage, par-dessus tout ----
  // (Une couche « popover » : elle passe par-dessus le Hub, lui-même au premier plan du navigateur.)
  const voile = document.createElement('div');
  voile.className = 'voyage-temporel';
  voile.setAttribute('aria-hidden', 'true');
  voile.setAttribute('popover', 'manual');
  const toile = document.createElement('canvas');
  voile.append(toile);
  const bouton_passer = document.createElement('button');
  bouton_passer.type = 'button';
  bouton_passer.className = 'voyage-temporel__passer';
  bouton_passer.textContent = o.texte.passer;
  bouton_passer.hidden = !o.passerVisibleTout;
  voile.append(bouton_passer);
  document.body.append(voile);
  voile.showPopover?.();
  if (!o.passerVisibleTout) window.setTimeout(() => !fini && (bouton_passer.hidden = false), 1000);

  const dpr = Math.min(1.5, window.devicePixelRatio || 1);
  const L = window.innerWidth,
    H = window.innerHeight;
  toile.width = Math.round(L * dpr);
  toile.height = Math.round(H * dpr);
  const gl = o.court ? null : toile.getContext('webgl2', { premultipliedAlpha: true, alpha: true, antialias: true });
  const pTunnel = gl ? programme(gl, VERTEX_PLEIN, FRAGMENT_TUNNEL) : null;
  const pEclat = gl ? programme(gl, VERTEX_ECLAT, FRAGMENT_ECLAT) : null;
  const avecGl = !!(gl && pTunnel && pEclat);
  if (!avecGl) voile.classList.add('est-simple');

  // ---- Les éclats : le rectangle du bouton découpé en coins depuis le point d'impact ----
  const eclats: Eclat[] = [];
  const FOV = 0.9;
  const profondeurBouton = 3.2;
  /** D'un point de l'écran (px) au plan z = −profondeur (m). */
  const versMonde = (x: number, y: number, z: number): [number, number, number] => {
    const t = Math.tan(FOV / 2) * z;
    return [((x / L) * 2 - 1) * t * (L / H), -((y / H) * 2 - 1) * t, -z];
  };
  if (avecGl && b && visible) {
    const coins: [number, number][] = [
      [b.left, b.top],
      [b.right, b.top],
      [b.right, b.bottom],
      [b.left, b.bottom],
    ];
    // Des points sur le contour, triés par angle autour de l'impact : chaque paire voisine fait un éclat.
    const bordure: [number, number][] = [];
    const n = 16;
    for (let i = 0; i < n; i++) {
      const t = (i + Math.random() * 0.6) / n;
      const per = 2 * (b.width + b.height);
      let d = t * per;
      if (d < b.width) bordure.push([b.left + d, b.top]);
      else if ((d -= b.width) < b.height) bordure.push([b.right, b.top + d]);
      else if ((d -= b.height) < b.width) bordure.push([b.right - d, b.bottom]);
      else bordure.push([b.left, b.bottom - (d - b.width)]);
    }
    bordure.push(...coins);
    bordure.sort((a, c) => Math.atan2(a[1] - impact.y, a[0] - impact.x) - Math.atan2(c[1] - impact.y, c[0] - impact.x));
    for (let i = 0; i < bordure.length; i++) {
      const a = bordure[i],
        c = bordure[(i + 1) % bordure.length];
      const centre: [number, number] = [(impact.x + a[0] + c[0]) / 3, (impact.y + a[1] + c[1]) / 3];
      const m = versMonde(centre[0], centre[1], profondeurBouton);
      const pts = [[impact.x, impact.y], a, c].map(([x, y]) => {
        const w = versMonde(x, y, profondeurBouton);
        return [w[0] - m[0], w[1] - m[1]] as [number, number];
      });
      const dir = [centre[0] - impact.x, centre[1] - impact.y];
      const ld = Math.hypot(dir[0], dir[1]) || 1;
      eclats.push({
        forme: pts,
        pos: m,
        vit: [(dir[0] / ld) * (0.4 + Math.random() * 0.5), (-dir[1] / ld) * (0.4 + Math.random() * 0.5), 1.2 + Math.random() * 1.4],
        axe: (() => {
          const v: [number, number, number] = [Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5];
          const l = Math.hypot(...v) || 1;
          return [v[0] / l, v[1] / l, v[2] / l];
        })(),
        angle: 0,
        tour: (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random() * 3),
        retard: Math.random() * 0.08,
      });
    }
  }

  // ---- Les tampons WebGL ----
  const plein = avecGl ? gl!.createBuffer() : null;
  const tamponEclats = avecGl ? gl!.createBuffer() : null;
  const tamponBords = avecGl ? gl!.createBuffer() : null;
  if (avecGl && gl) {
    gl.bindBuffer(gl.ARRAY_BUFFER, plein);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  }
  const u = (p: WebGLProgram, nom: string) => gl!.getUniformLocation(p, nom);

  let profondeur = 0;
  let vitesse = 0;
  // (L'horloge part de la première image affichée : une machine lente ne doit pas sauter la charge.)
  let t0 = -1;
  let tPrec = 0;
  let id = 0;
  let tPasse = -1;
  /** Le temps passé retenu (option « retenir ») : l'horloge du voyage s'arrête au point de croisière. */
  let retenue = 0;
  const CROISIERE = CHARGE + BRIS + o.duree * 0.75;

  const terminer = () => {
    if (fini) return;
    fini = true;
    cancelAnimationFrame(id);
    effacerFissures();
    // (Le Hub retrouve son bouton intact : il était caché sous le jeu depuis l'arrivée.)
    bouton?.classList.remove('est-fissure', 'est-brise');
    voile.remove();
    if (gl) gl.getExtension('WEBGL_lose_context')?.loseContext();
    o.fin();
  };
  const arriver = () => {
    if (arrive) return;
    arrive = true;
    o.moment?.(passe ? 'passe' : 'arrivee');
    o.arrivee(passe);
  };

  const image = (maintenant: number) => {
    if (t0 < 0) {
      t0 = maintenant;
      tPrec = maintenant;
    }
    const dt = Math.min(0.05, (maintenant - tPrec) / 1000);
    tPrec = maintenant;
    let t = (maintenant - t0) / 1000 - retenue;
    if (o.retenir && avecGl && tPasse < 0 && t > CROISIERE && o.retenir()) {
      retenue += t - CROISIERE;
      t = CROISIERE;
    }
    // Passé : on saute à l'arrivée, en 0,35 s.
    if (tPasse >= 0) t = Math.max(t, DUREE - 0.35 + (maintenant - tPasse) / 1000 - 0.0001);
    const tVoyage = t - CHARGE - BRIS;
    if (!avecGl) {
      // Version simple : un fondu sombre, puis clair (le jeu s'ouvre dessous à mi-chemin).
      const k = borne(t / DUREE);
      voile.style.background = `radial-gradient(circle at ${impact.x}px ${impact.y}px, rgba(160, 230, 255, ${(0.5 * Math.sin(k * Math.PI)).toFixed(3)}), rgba(3, 6, 12, ${(Math.sin(k * Math.PI) * 0.95).toFixed(3)}) 60%)`;
      if (k >= 0.5) arriver();
      if (k >= 1) return terminer();
      id = requestAnimationFrame(image);
      return;
    }
    const g = gl!;
    if (t >= CHARGE && !voile.classList.contains('est-ouvert')) {
      voile.classList.add('est-ouvert');
      o.moment?.('bris');
      effacerFissures();
      bouton?.classList.add('est-brise');
    }
    // La vitesse : forte accélération, puis décélération avant l'arrivée.
    const tv = borne(tVoyage / o.duree);
    const cible = tVoyage < 0 ? 0 : tv < 0.6 ? 0.15 + 0.85 * doux(tv / 0.6) : 1 - 0.8 * doux((tv - 0.6) / 0.4);
    vitesse += (cible - vitesse) * Math.min(1, dt * 3);
    profondeur += dt * (6 + 110 * vitesse);
    if (tVoyage >= 0 && !voile.classList.contains('est-voyage')) {
      voile.classList.add('est-voyage');
      o.moment?.('tunnel');
    }
    const ouverture = doux((t - CHARGE) / Math.max(0.01, BRIS));
    const flash = Math.max(0, 1 - Math.abs(t - (DUREE - 0.25)) / 0.25) * 0.95;
    const fondu = t > DUREE - 0.2 ? borne((DUREE - t) / 0.2) : 1;
    if (t >= DUREE - 0.25) arriver();

    g.viewport(0, 0, toile.width, toile.height);
    g.clearColor(0, 0, 0, 0);
    g.clear(g.COLOR_BUFFER_BIT);
    g.enable(g.BLEND);
    g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA);
    // Le tunnel (et l'ouverture).
    g.useProgram(pTunnel);
    g.bindBuffer(g.ARRAY_BUFFER, plein);
    const aPos = g.getAttribLocation(pTunnel!, 'aPos');
    g.enableVertexAttribArray(aPos);
    g.vertexAttribPointer(aPos, 2, g.FLOAT, false, 0, 0);
    const centre = { x: impact.x + (L / 2 - impact.x) * doux(ouverture * 1.2), y: impact.y + (H / 2 - impact.y) * doux(ouverture * 1.2) };
    g.uniform2f(u(pTunnel!, 'uRes'), toile.width, toile.height);
    g.uniform1f(u(pTunnel!, 'uT'), t);
    g.uniform1f(u(pTunnel!, 'uProfondeur'), profondeur);
    g.uniform1f(u(pTunnel!, 'uVitesse'), vitesse);
    g.uniform1f(u(pTunnel!, 'uOuverture'), ouverture);
    g.uniform2f(u(pTunnel!, 'uCentre'), centre.x * dpr, (H - centre.y) * dpr);
    g.uniform1f(u(pTunnel!, 'uFlash'), flash);
    g.uniform1f(u(pTunnel!, 'uFondu'), fondu);
    // La trajectoire de la caméra : une courbe lente, et le roulis qui l'accompagne.
    const courbe: [number, number] = [Math.sin(t * 0.7) * 0.9 * vitesse, Math.cos(t * 0.5) * 0.5 * vitesse];
    g.uniform2f(u(pTunnel!, 'uCourbe'), courbe[0], courbe[1]);
    g.uniform1f(u(pTunnel!, 'uRoulis'), Math.sin(t * 0.6) * 0.25 * vitesse);
    g.drawArrays(g.TRIANGLES, 0, 3);
    g.disableVertexAttribArray(aPos);

    // Les éclats : ils tournent vers la caméra, puis sont aspirés vers le cœur du tunnel.
    if (eclats.length && t >= CHARGE) {
      const te = t - CHARGE;
      const sommets: number[] = [];
      const bords: number[] = [];
      for (const e of eclats) {
        const k = Math.max(0, te - e.retard);
        e.angle = e.tour * k * (1 + k);
        const aspire = doux((k - 0.55) / 1.1);
        // Vers la caméra d'abord, puis aspiré vers le centre et au loin.
        const px = e.pos[0] + e.vit[0] * k * (1 - aspire) - e.pos[0] * aspire;
        const py = e.pos[1] + e.vit[1] * k * (1 - aspire) - e.pos[1] * aspire;
        const pz = e.pos[2] + e.vit[2] * Math.min(k, 0.6) * (1 - aspire) - aspire * 40 * aspire;
        const alpha = borne(1 - aspire * 1.1) * fondu;
        if (alpha <= 0.01 || pz > -0.35) continue;
        const pts3 = e.forme.map(([x, y]) => {
          const r = tourner([x, y, 0], e.axe, e.angle);
          return [r[0] + px, r[1] + py, r[2] + pz] as [number, number, number];
        });
        const [a, bb, c] = pts3;
        const n = (() => {
          const u1 = [bb[0] - a[0], bb[1] - a[1], bb[2] - a[2]],
            v1 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
          const nx = u1[1] * v1[2] - u1[2] * v1[1],
            ny = u1[2] * v1[0] - u1[0] * v1[2],
            nz = u1[0] * v1[1] - u1[1] * v1[0];
          const l = Math.hypot(nx, ny, nz) || 1;
          return [nx / l, ny / l, nz / l];
        })();
        for (const pt of pts3) sommets.push(...pt, ...n, alpha);
        for (const [i, j] of [
          [0, 1],
          [1, 2],
          [2, 0],
        ])
          bords.push(...pts3[i], ...n, alpha * 0.8, ...pts3[j], ...n, alpha * 0.8);
      }
      if (sommets.length) {
        g.useProgram(pEclat);
        g.uniformMatrix4fv(u(pEclat!, 'uProjection'), false, perspective(FOV, L / H, 0.1, 200));
        const dessiner = (donnees: number[], mode: number, bord: number, tampon: WebGLBuffer | null) => {
          g.bindBuffer(g.ARRAY_BUFFER, tampon);
          g.bufferData(g.ARRAY_BUFFER, new Float32Array(donnees), g.DYNAMIC_DRAW);
          const lieux = ['aPos', 'aNormale', 'aAlpha'].map((nom) => g.getAttribLocation(pEclat!, nom));
          const pasOctets = 7 * 4;
          g.enableVertexAttribArray(lieux[0]);
          g.vertexAttribPointer(lieux[0], 3, g.FLOAT, false, pasOctets, 0);
          g.enableVertexAttribArray(lieux[1]);
          g.vertexAttribPointer(lieux[1], 3, g.FLOAT, false, pasOctets, 12);
          g.enableVertexAttribArray(lieux[2]);
          g.vertexAttribPointer(lieux[2], 1, g.FLOAT, false, pasOctets, 24);
          g.uniform1f(u(pEclat!, 'uBord'), bord);
          g.drawArrays(mode, 0, donnees.length / 7);
          lieux.forEach((l) => g.disableVertexAttribArray(l));
        };
        dessiner(sommets, g.TRIANGLES, 0, tamponEclats);
        dessiner(bords, g.LINES, 1, tamponBords);
      }
    }
    if (t >= DUREE) return terminer();
    id = requestAnimationFrame(image);
  };
  id = requestAnimationFrame(image);

  const passer = () => {
    if (fini || tPasse >= 0) return;
    passe = true;
    tPasse = performance.now();
    if (!avecGl) {
      arriver();
      terminer();
    }
  };
  bouton_passer.addEventListener('click', passer);
  voile.addEventListener('pointerdown', (e) => e.target !== bouton_passer && passer());
  // (Un garde-fou : si l'onglet est masqué ou que les images ne viennent plus, on arrive quand même ; pas pendant
  // que le voyage est retenu, et, après, le temps de finir.)
  let aEteRetenu = false;
  const gardeFou = (delai: number) =>
    window.setTimeout(() => {
      if (fini) return;
      if (o.retenir?.()) {
        aEteRetenu = true;
        return gardeFou(1000);
      }
      if (aEteRetenu) {
        aEteRetenu = false;
        return gardeFou((DUREE - CROISIERE + 4) * 1000);
      }
      arriver();
      terminer();
    }, delai);
  gardeFou((DUREE + 4) * 1000);
  /** Repasse par-dessus ce qui vient de s'ouvrir (la fenêtre du jeu), pour finir l'éclair dessus. */
  const remonter = () => {
    if (fini || !voile.isConnected) return;
    try {
      voile.hidePopover?.();
      voile.showPopover?.();
    } catch {
      // (pas de popover : la couche reste où elle est)
    }
  };
  /** (Version Unity) S'efface en fondu, sans éclair : le jeu a repris le tunnel à son compte. Puis se retire. */
  const fondre = (ms = 450) => {
    if (fini) return;
    arriver();
    voile.style.transition = `opacity ${ms}ms ease`;
    voile.style.opacity = '0';
    window.setTimeout(terminer, ms);
  };
  return { passer, remonter, fondre };
}
