#version 300 es
precision highp float;
// ============================================================================
// SHADER DU TUNNEL : ce que l'on voit pendant la traversée du portail.
// Des filets de lumière partent du centre de l'écran et filent vers les bords
// (ou l'inverse au retour), de plus en plus longs quand la vitesse monte.
// Le tunnel est dessiné par-dessus la page, en transparence.
// ============================================================================

uniform vec2 uRes;        // taille de la toile, en pixels
uniform float uForce;     // 0 = invisible, 1 = tunnel plein écran
uniform float uDistance;  // chemin parcouru : il avance à l'aller, recule au retour
uniform float uVitesse;   // 0 à 1 : allonge les filets
uniform float uSaut;      // 1 pendant le « saut dans le temps » vers l'accueil
uniform float uClair;     // 1 en thème clair : le tunnel devient un voile lumineux

out vec4 couleur;

float alea(float n) { return fract(sin(n * 127.1) * 43758.5453); }

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / min(uRes.x, uRes.y);
  float rayon = length(p);
  float angle = atan(p.y, p.x);

  // Le saut dans le temps tord l'espace : l'angle tourne avec la distance au centre.
  angle += uSaut * (0.9 / (rayon + 0.25)) * sin(uDistance * 0.6);

  // On découpe le tour en secteurs ; chacun porte un filet à sa propre vitesse.
  float filets = 0.0;
  for (int couche = 0; couche < 2; couche++) {
    float nombre = couche == 0 ? 220.0 : 120.0;
    float secteur = floor((angle / 6.28318 + 0.5) * nombre);
    float h = alea(secteur + float(couche) * 71.0);
    // « Profondeur » : loin au centre, proche au bord. Les filets y défilent.
    float profondeur = 0.22 / (rayon + 0.02);
    float course = fract(profondeur * (0.5 + h) + uDistance * (0.6 + h * 0.9) + h * 7.0);
    float longueur = mix(0.04, 0.55, uVitesse) * (0.5 + h);
    float trait = smoothstep(0.0, longueur, course) * smoothstep(longueur + 0.02, longueur, course);
    // Finesse du filet à l'intérieur de son secteur.
    float dansSecteur = abs(fract((angle / 6.28318 + 0.5) * nombre) - 0.5);
    float finesse = smoothstep(0.42, 0.0, dansSecteur);
    filets += trait * finesse * step(0.62, h) * (couche == 0 ? 0.9 : 0.6);
  }
  filets *= smoothstep(0.02, 0.32, rayon);   // rien au tout premier centre

  // Le cœur du passage : une lueur qui grossit avec la force.
  float coeur = exp(-rayon * rayon / (0.012 + 0.10 * uForce * uForce));

  vec3 froid = vec3(0.62, 0.78, 1.0);
  vec3 c = froid * filets * 1.25 + vec3(0.86, 0.93, 1.0) * coeur * (0.55 + 0.6 * uVitesse);

  // Le fond du tunnel : la nuit bleue du site, qui couvre la page à pleine force.
  vec3 nuit = mix(vec3(0.016, 0.022, 0.040), vec3(0.93, 0.95, 0.97), uClair);
  float voile = smoothstep(0.0, 0.85, uForce);
  vec3 rendu = mix(nuit, nuit + c, 1.0) ;
  rendu = uClair > 0.5 ? nuit - (1.0 - froid) * filets * 0.55 - vec3(0.20, 0.14, 0.05) * coeur : rendu;
  float alpha = clamp(voile + (filets + coeur) * uForce, 0.0, 1.0);

  couleur = vec4(rendu * alpha, alpha);   // couleurs prémultipliées par l'opacité
}
