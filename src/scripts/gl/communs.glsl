// ============================================================================
// MORCEAU COMMUN aux deux shaders (le paysage et la lame de verre).
// Un shader est un petit programme exécuté par la carte graphique pour CHAQUE
// pixel, 60 fois par seconde. Les « uniform » sont les valeurs que le
// JavaScript lui envoie à chaque image.
//
// La scène part d'une photographie de dunes (générée par IA). Le shader la
// rend vivante : les nuages dérivent, la brume circule entre les dunes, des
// voiles de sable courent au vent, les étoiles scintillent, une étoile filante
// passe de temps en temps, l'aube respire, et tout réagit à la souris.
// ============================================================================

uniform vec2 uRes;         // taille de la toile, en pixels réels
uniform float uTemps;      // secondes écoulées
uniform vec2 uSouris;      // curseur lissé, de 0 à 1, origine en bas à gauche
uniform float uLampe;      // intensité de la lampe du curseur (0 = éteinte)
uniform float uReveal;     // 0 → 1 pendant l'entrée de page
uniform float uJour;       // 0 = nuit (thème sombre), 1 = le jour est monté (thème clair)
uniform float uZoom;       // 0 → 1 : la caméra plonge vers le portail (traversée)
uniform float uEnergie;    // 0 → 1 : énergie du portail (survol, charge, traversée)
uniform float uFissure;    // 0 → 1 : étendue des fissures sur le verre
uniform float uEclat;      // 1 → 0 : éclair de la rupture
uniform vec2 uImpact;      // point du verre d'où partent les fissures (0 à 1 sur la face)
uniform float uConstruit;  // 0 → 1 : le portail se dessine pendant l'introduction
uniform float uAgitation;  // 0 → 1 : vitesse du curseur, lissée (fissures du décor)
uniform float uScan;       // 0 → 1 : le scanner du survol descend le long du verre
uniform vec3 uAmbiance;    // l'ambiance choisie : brume (1 = normale), douceur (0 à 1), lueur bleue (0 à 1)
uniform float uSortie;     // 0 → 1 quand le panneau suivant recouvre la scène
uniform vec3 uOnde;        // dernier clic : position (x, y) et âge en secondes
uniform vec3 uVerre;       // la lame : position (x, y) à l'écran et opacité
uniform float uHorizon;    // hauteur de l'horizon dans l'image, de 0 (bas) à 1 (haut)
uniform sampler2D uScene;  // la photographie
uniform vec2 uSceneRes;    // sa taille en pixels
uniform float uSceneOn;    // 1 quand elle est chargée

// ---- Bruit simplex 2D (Ian McEwan, Ashima Arts, licence MIT) ----
// Donne une valeur lisse et « organique » entre -1 et 1 pour un point p.
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

float bruit(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

// ---- De l'écran à l'image ----
// 1. « couvrir » : l'image remplit le cadre sans être déformée, quitte à être rognée.
// 2. parallaxe : le sol (bas de l'image, donc proche) se décale plus que le ciel
//    (lointain) quand la souris bouge. C'est ce qui donne de la profondeur.
// 3. onde : un clic déforme l'image en anneau, comme une goutte dans l'eau.
vec2 versImage(vec2 suv) {
  float rapport = uRes.x / uRes.y;
  float rapportImage = uSceneRes.x / uSceneRes.y;
  vec2 part = rapport > rapportImage ? vec2(1.0, rapportImage / rapport) : vec2(rapport / rapportImage, 1.0);
  // Léger recul de caméra à l'entrée ; pendant la traversée, le paysage avance vers nous.
  float zoom = 1.13 - 0.06 * uReveal + 0.05 * uSortie + 0.55 * uZoom * uZoom;
  vec2 uv = (suv - 0.5) * part / zoom + 0.5;

  float proche = smoothstep(uHorizon + 0.02, 0.0, uv.y);  // 0 à l'horizon, 1 tout en bas
  vec2 m = uSouris - 0.5;
  uv.x -= m.x * (0.004 + 0.024 * proche);
  uv.y -= m.y * (0.003 + 0.012 * proche);

  // (distance comptée en « petits côtés » de l'écran, pour que l'onde reste
  // ronde et de même taille relative sur un téléphone tenu debout)
  vec2 versClic = (suv - uOnde.xy) * vec2(rapport, 1.0) / min(rapport, 1.0);
  float distance = length(versClic);
  float front = distance - uOnde.z * 0.55;
  float vague = sin(front * 46.0) * exp(-front * front / 0.012) * max(0.0, 1.0 - uOnde.z / 2.2);
  uv += normalize(versClic + 0.0001) * vague * 0.006;

  return uv;
}

// ---- Une étoile filante ----
// Toutes les 11 secondes, un trait de lumière traverse un coin du ciel en un
// peu moins d'une seconde. Son point de départ et sa pente changent à chaque
// passage : ils sont tirés d'un nombre pseudo-aléatoire calculé à partir du
// numéro du passage. « uv » est la position dans l'image.
float filante(vec2 uv) {
  const float CYCLE = 11.0;
  float t = uTemps + 6.0;                          // la première passe 5 s après l'arrivée
  float numero = floor(t / CYCLE);
  float vie = (t - numero * CYCLE) / 0.85;         // 0 → 1 pendant la traversée
  if (vie > 1.0) return 0.0;
  float a = fract(sin(numero * 91.7 + 3.1) * 43758.5453);
  float b = fract(sin(numero * 47.3 + 1.7) * 24634.6345);
  vec2 depart = vec2(0.22 + 0.56 * a, uHorizon + 0.27 + 0.10 * b);
  vec2 sens = normalize(vec2(a > 0.5 ? -1.0 : 1.0, -0.42 - 0.25 * b));
  vec2 p = (uv - depart) * vec2(uSceneRes.x / uSceneRes.y, 1.0);
  float tete = vie * 0.30;                         // distance déjà parcourue par la tête
  float lelong = dot(p, sens);                     // où est ce pixel le long de la trajectoire
  float ecart = length(p - sens * lelong);         // et à quelle distance sur le côté
  float traine = smoothstep(tete - 0.10, tete, lelong) * step(lelong, tete);
  return traine * exp(-ecart * ecart / 0.0000016) * sin(vie * 3.14159);
}

// ---- La scène : la photographie, rendue vivante ----
// « flou » choisit un niveau de détail de l'image (0 = net, 3 = très adouci).
vec3 scene(vec2 suv, float flou) {
  vec2 uv = versImage(suv);
  float hautCiel = smoothstep(uHorizon + 0.02, uHorizon + 0.26, uv.y);  // 1 dans le ciel

  // Les nuages dérivent. On lit l'image deux fois, décalée de deux quantités
  // qui avancent en boucle, et on fond l'une dans l'autre : quand l'une revient
  // à zéro, elle est invisible. Le mouvement paraît continu, sans jamais sauter.
  vec2 flux = vec2(0.040, 0.0) * hautCiel;
  float t = uTemps * 0.014;
  float phase0 = fract(t);
  float phase1 = fract(t + 0.5);
  vec3 c = mix(
    textureLod(uScene, uv - flux * (phase0 - 0.5), flou).rgb,
    textureLod(uScene, uv - flux * (phase1 - 0.5), flou).rgb,
    abs(1.0 - 2.0 * phase0)
  );

  // Des voiles de sable courent sur les dunes, poussés par le vent.
  // On traite le sol comme un plan qui fuit vers l'horizon : « loin » est petit
  // au premier plan et grandit vers l'horizon. Le bruit est lu dans ce repère,
  // étiré dans le sens du vent : les voiles proches paraissent donc larges et
  // rapides, les lointains fins et lents. Ils n'accrochent que le sable éclairé.
  float sousHorizon = max(uHorizon - uv.y, 0.0);
  float loin = 0.16 / (sousHorizon + 0.05);
  vec2 vent = vec2((uv.x - 0.5) * loin * 1.5 + uTemps * 0.05, loin * 9.0);
  float voile = 0.6 * bruit(vent) + 0.4 * bruit(vent * vec2(2.3, 2.1) + vec2(uTemps * 0.03, 7.0));
  float eclaire = smoothstep(0.02, 0.20, dot(c, vec3(0.30, 0.59, 0.11)));
  c += vec3(0.44, 0.52, 0.68) * smoothstep(0.15, 0.85, voile) * smoothstep(0.045, 0.16, sousHorizon) * eclaire * 0.10 * uAmbiance.x;

  // La brume circule dans les creux, juste sous l'horizon.
  float creux = smoothstep(uHorizon - 0.20, uHorizon - 0.04, uv.y) * smoothstep(uHorizon + 0.015, uHorizon - 0.02, uv.y);
  float volute = 0.6 * bruit(vec2(uv.x * 3.0 - uTemps * 0.012, uv.y * 15.0))
               + 0.4 * bruit(vec2(uv.x * 6.5 + uTemps * 0.018, uv.y * 24.0 + 3.0));
  c += vec3(0.40, 0.48, 0.62) * smoothstep(-0.2, 0.9, volute) * creux * 0.11 * uAmbiance.x;

  // L'aube respire : la bande de lumière à l'horizon pulse très lentement.
  float bande = exp(-pow((uv.y - uHorizon - 0.012) / 0.045, 2.0));
  c *= 1.0 + bande * (0.07 * sin(uTemps * 0.45) + 0.05);

  // Thème clair : le jour monte. Le ciel et le sable s'éclaircissent, le ciel
  // davantage. « marge » vaut 1 dans les zones sombres et 0 dans celles qui
  // sont déjà claires : on ne pousse pas l'horizon, qui virerait au blanc pur.
  float ciel = smoothstep(uHorizon - 0.03, uHorizon + 0.34, uv.y);
  float marge = 1.0 - smoothstep(0.16, 0.62, dot(c, vec3(0.30, 0.59, 0.11)));
  vec3 plusTard = c * (1.0 + marge * mix(vec3(0.40, 0.43, 0.52), vec3(0.62, 0.64, 0.66), ciel));
  plusTard += vec3(0.020, 0.036, 0.062) * ciel * marge;
  c = mix(c, plusTard, uJour);

  // Quelques étoiles qui scintillent, tout en haut du ciel. Elles pâlissent
  // quand le jour monte.
  vec2 grille = vec2(uv.x * uSceneRes.x / uSceneRes.y, uv.y) * 130.0;
  float alea = fract(sin(dot(floor(grille), vec2(127.1, 311.7))) * 43758.5453);
  float etoile = step(0.990, alea) * smoothstep(0.26, 0.0, length(fract(grille) - 0.5));
  etoile *= 0.5 + 0.5 * sin(uTemps * (1.0 + alea * 3.0) + alea * 40.0);
  float nuit = 1.0 - 0.8 * uJour;
  c += etoile * smoothstep(uHorizon + 0.20, uHorizon + 0.46, uv.y) * 0.55 * nuit * mix(1.0, uAmbiance.x, 0.6);
  // (Pas d'étoile filante dans l'ambiance de lecture, où la brume est presque coupée.)
  c += vec3(0.86, 0.92, 1.0) * filante(uv) * 0.7 * nuit * step(0.5, uAmbiance.x);

  // L'ambiance (voir ambiances.ts). Douceur : les hautes lumières sont retenues
  // et la teinte se réchauffe à peine. Lueur bleue : l'espace profond.
  float clarte = dot(c, vec3(0.30, 0.59, 0.11));
  c = mix(c, c * vec3(1.03, 1.0, 0.95) / (1.0 + 0.45 * clarte), uAmbiance.y);
  c += vec3(0.006, 0.016, 0.042) * uAmbiance.z * (0.4 + 0.6 * ciel);
  c *= mix(vec3(1.0), vec3(0.96, 0.99, 1.07), uAmbiance.z);

  return c * uSceneOn;
}

// ---- Le relief : la luminosité de l'image, très adoucie ----
// On s'en sert comme d'une altitude pour tracer des lignes de niveau sur le sable.
float relief(vec2 suv) {
  vec2 uv = versImage(suv);
  float lum = dot(textureLod(uScene, uv, 3.2).rgb, vec3(0.30, 0.59, 0.11));
  // On ajoute la hauteur dans l'image : les lignes suivent la pente du terrain.
  return lum * 24.0 + uv.y * 18.0;
}

// Un trait fin à chaque palier du relief. fwidth mesure la variation d'un
// pixel au suivant : on s'en sert pour garder un trait d'environ un pixel.
// Les lignes ne sont tracées que sur le sol, pas dans le ciel.
float isolignes(vec2 suv) {
  vec2 uv = versImage(suv);
  float v = relief(suv);
  float d = abs(fract(v - 0.5) - 0.5) / max(fwidth(v), 0.0001);
  return (1.0 - smoothstep(0.0, 1.3, d)) * smoothstep(uHorizon + 0.005, uHorizon - 0.03, uv.y) * uSceneOn;
}

// ---- Grain de film : une valeur pseudo-aléatoire par pixel, 24 fois par seconde ----
float grain(vec2 px, float t) {
  float image = floor(t * 24.0);
  return fract(sin(dot(px + image * 17.0, vec2(12.9898, 78.233))) * 43758.5453);
}

// ---- Les fissures ----
// Un « diagramme de Voronoï » : on sème des points au hasard, et l'on trace
// la frontière entre les zones les plus proches de chaque point. Ces frontières
// dessinent un réseau d'éclats, comme sur un verre fêlé. La fonction renvoie
// la distance à la frontière la plus proche (0 = sur une fissure).
vec2 semis(vec2 p) {
  return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453);
}

float versFissure(vec2 p) {
  vec2 n = floor(p);
  vec2 f = fract(p);
  float d1 = 8.0;
  float d2 = 8.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      float d = length(g + semis(n + g) - f);
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
    }
  }
  return d2 - d1;
}
