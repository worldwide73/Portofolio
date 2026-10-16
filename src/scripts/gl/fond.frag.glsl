// ============================================================================
// SHADER DU FOND : le paysage, plus tout ce qui réagit à la souris.
// ============================================================================

out vec4 couleur;

void main() {
  vec2 px = gl_FragCoord.xy;   // position du pixel, origine en bas à gauche
  vec2 suv = px / uRes;        // la même, ramenée entre 0 et 1
  float rapport = uRes.x / uRes.y;

  vec3 c = scene(suv, 0.0);
  float lignes = isolignes(suv);

  // ---- La lampe : sous le curseur, le relief se révèle en lignes de niveau ----
  // La distance est comptée en « petits côtés » de l'écran : la lampe garde la
  // même taille relative sur un écran large et sur un téléphone tenu debout.
  vec2 ecart = (suv - uSouris) * vec2(rapport, 1.0) / min(rapport, 1.0);
  float lampe = exp(-dot(ecart, ecart) / 0.034) * uLampe;
  c += lignes * lampe * vec3(0.74, 0.86, 1.0) * 0.58;
  c *= 1.0 + lampe * 0.22;

  // ---- Fissures du décor : sous un curseur qui bouge, la surface se fêle un instant ----
  // uAgitation suit la vitesse du curseur : à l'arrêt, les fêlures s'effacent.
  // Elles restent fines et locales, un peu plus marquées près du portail.
  // (Le calcul n'est fait que dans le petit disque concerné.)
  float felures = exp(-dot(ecart, ecart) / 0.016) * uAgitation;
  if (felures > 0.01) {
    vec2 versPortail = (suv - uVerre.xy) * vec2(rapport, 1.0);
    float trait = 1.0 - smoothstep(0.0, 0.028, versFissure(suv * vec2(rapport, 1.0) * 11.0));
    c += trait * felures * (0.45 + 0.6 * exp(-dot(versPortail, versPortail) / 0.06)) * vec3(0.76, 0.87, 1.0);
  }

  // ---- L'onde : l'anneau d'un clic balaie le relief ----
  vec2 versClic = (suv - uOnde.xy) * vec2(rapport, 1.0) / min(rapport, 1.0);
  float front = length(versClic) - uOnde.z * 0.55;
  float anneau = exp(-front * front / 0.0045) * max(0.0, 1.0 - uOnde.z / 2.2);
  c += (lignes * 0.9 + 0.03) * anneau * vec3(0.74, 0.86, 1.0);

  // ---- Halo de la lame : une lueur froide derrière elle, et son reflet au sol ----
  vec2 versLame = (suv - uVerre.xy) * vec2(rapport, 1.0);
  c += vec3(0.36, 0.52, 0.90) * exp(-dot(versLame, versLame) / 0.055) * (0.11 + 0.22 * uEnergie) * uVerre.z;
  // Près du portail, le relief affleure en lignes de niveau quand il prend de l'énergie.
  c += lignes * exp(-dot(versLame, versLame) / 0.09) * vec3(0.74, 0.86, 1.0) * 0.5 * uEnergie;
  // L'éclair de la rupture éclaire tout le paysage un court instant.
  c += vec3(0.55, 0.68, 0.95) * uEclat * 0.5;
  float sol = smoothstep(uVerre.y - 0.16, uVerre.y - 0.42, suv.y);
  c += vec3(0.45, 0.58, 0.85) * exp(-versLame.x * versLame.x / 0.004) * sol * 0.07 * uVerre.z;

  // ---- Lisibilité : le bas (texte) et le haut (menu) sont assombris ----
  c *= mix(0.42, 1.0, smoothstep(0.0, 0.46, suv.y));
  c *= mix(0.74, 1.0, smoothstep(1.0, 0.80, suv.y));

  // Entrée de page (sortie du noir) et recouvrement par le panneau suivant.
  c *= smoothstep(0.0, 0.6, uReveal) * (1.0 - 0.35 * uSortie);

  // Grain de film : il casse aussi les bandes visibles dans les dégradés.
  c += (grain(px, uTemps) - 0.5) * 0.034;

  couleur = vec4(c, 1.0);
}
