export const waterVertex = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

export const waterFragment = `
precision mediump float;
uniform vec2 resolution;
uniform vec2 viewport;
uniform float time;
uniform float scroll;
uniform vec4 ripples[6];

float waves(vec2 p) {
  return sin(p.x * 0.024 + sin(p.y * 0.018 + time * 0.17))
    * cos(p.y * 0.021 - time * 0.13);
}

void main() {
  vec2 screen = gl_FragCoord.xy / resolution;
  vec2 pixel = vec2(screen.x, 1.0 - screen.y) * viewport;
  vec2 world = pixel + vec2(0.0, scroll * 0.22);
  vec2 flow = vec2(waves(world), waves(world.yx + 53.0)) * 3.2;
  float sheen = 0.0;
  for (int i = 0; i < 6; i++) {
    float elapsed = time - ripples[i].z;
    float age = clamp(elapsed, 0.0, 4.5);
    vec2 delta = world - ripples[i].xy;
    float distance = length(delta);
    float band = (distance - age * 165.0) / 55.0;
    float envelope = exp(-band * band) * exp(-age * 0.8);
    envelope *= step(0.0, elapsed) * (1.0 - step(4.5, elapsed));
    float wave = sin(distance * 0.065 - age * 11.0) * envelope;
    flow += delta / max(distance, 1.0) * wave * 15.0;
    sheen += wave * 0.018;
  }
  vec2 grid = (world + flow) / 34.0;
  vec2 edges = min(fract(grid), 1.0 - fract(grid)) * 34.0;
  float line = 1.0 - smoothstep(0.3, 1.5, min(edges.x, edges.y));
  float light = waves(world * 0.53 + flow * 0.6) * 0.022;
  float caustic = pow(max(0.0, waves(world * 0.3) * 0.5 + 0.5), 9.0) * 0.07;
  vec3 color = mix(vec3(0.17, 0.48, 0.77), vec3(0.22, 0.61, 0.81), screen.y);
  color += light + caustic + sheen;
  color = mix(color, vec3(0.74, 0.92, 0.95), line * 0.27);
  float vignette = length((screen - 0.5) * vec2(0.6, 0.8));
  color *= 1.04 - vignette * 0.13;
  gl_FragColor = vec4(color, 1.0);
}
`;
