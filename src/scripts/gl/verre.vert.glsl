#version 300 es
// ============================================================================
// SHADER DE SOMMETS DE LA LAME : place les 8 coins du parallélépipède à
// l'écran et prépare, pour chaque face, ce dont le shader de pixels a besoin.
// ============================================================================

in vec3 position;
in vec3 normal;
in vec2 uv;

uniform mat4 modelViewMatrix;   // place l'objet devant la caméra
uniform mat4 projectionMatrix;  // applique la perspective
uniform mat3 normalMatrix;      // tourne les normales avec l'objet

out vec3 vNormale;      // direction perpendiculaire à la face
out vec3 vTangente;     // direction « vers la droite » sur la face
out vec3 vBitangente;   // direction « vers le haut » sur la face
out vec3 vPosVue;       // position vue depuis la caméra
out vec2 vUv;           // coordonnées 0..1 sur la face
out float vFace;        // 1 sur les deux grandes faces, 0 sur la tranche

void main() {
  vec3 t = abs(normal.y) > 0.9 ? vec3(1.0, 0.0, 0.0) : normalize(cross(vec3(0.0, 1.0, 0.0), normal));
  vec3 b = cross(normal, t);

  vNormale = normalize(normalMatrix * normal);
  vTangente = normalize(normalMatrix * t);
  vBitangente = normalize(normalMatrix * b);

  vec4 posVue = modelViewMatrix * vec4(position, 1.0);
  vPosVue = posVue.xyz;
  vUv = uv;
  vFace = abs(normal.z);

  gl_Position = projectionMatrix * posVue;
}
