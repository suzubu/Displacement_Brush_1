import * as THREE from "three";
// import "./assets/logo.jpg";

// 1. Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

let isDrawing = false;
let lastMoveTime = 0;

// 2. Main Scene & Camera
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); // fullscreen quad view

// 4. Texture Loading
const loader = new THREE.TextureLoader();
const texture = loader.load("./src/assets/logo.jpg");
const brushTexture = loader.load("./src/assets/brush.png");

// 3. Brush Render Tager + Scene + Camera
// render target to store brush texture
let brushRenderTarget = new THREE.WebGLRenderTarget(
  window.innerWidth,
  window.innerHeight,
  {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
  }
);
let brushRenderTarget2 = brushRenderTarget.clone();
// secondary scene for brush input
const brushScene = new THREE.Scene();
const brushCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

// 3.1 Brush material!
const brushMaterial = new THREE.ShaderMaterial({
  uniforms: {
    u_time: { value: 0.0 },
    u_mouse: { value: new THREE.Vector2(0.5, 0.5) }, // normalized
    u_prevTexture: { value: null }, // for fading trail
    u_brushTexture: { value: brushTexture },
    u_isDrawing: { value: false },
  },
  vertexShader: `
    varying vec2 v_uv;
    void main() {
      v_uv = uv;
      gl_Position = vec4(position, 1.0);
    }
  `,
  fragmentShader: `
precision mediump float;

uniform vec2 u_mouse;
uniform sampler2D u_prevTexture;
uniform sampler2D u_brushTexture;
uniform bool u_isDrawing;
varying vec2 v_uv;

void main() {
//  **TRAIL LENGTH / DECAY** 
  vec4 prev = texture2D(u_prevTexture, v_uv) * 0.88;

  // Use brush texture alpha to shape the brush mark
  float d = distance(v_uv, u_mouse);
  vec2 brushUV = (v_uv - u_mouse) * 5.0 + 0.5;
//   **BRUSH SIZE**
  float brush = texture2D(u_brushTexture, brushUV).a;
  float intensity = brush * 0.6;
  vec4 blended = mix(prev, vec4(intensity), brush * 0.5);

//   **TRAIL INTENSITY
  gl_FragColor = u_isDrawing ? blended : prev;
}
`,
});
const brushQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), brushMaterial);
brushScene.add(brushQuad);

// 5. Fullscreen Plane (main scene)
const geometry = new THREE.PlaneGeometry(2, 2); // covers screen
const material = new THREE.ShaderMaterial({
  uniforms: {
    u_texture: { value: texture },
    // for clock!
    u_time: { value: 0.0 },
    // add brush
    u_brush: { value: brushRenderTarget.texture },
  },
  vertexShader: `
    uniform float u_time;
    varying vec2 v_uv;
    
    void main() {
      v_uv = uv;

      float offsetY = sin(u_time * 0.5) * 0.01;
      float offsetX = cos(u_time * 0.3) * 0.005;
      
      vec3 pos = position;
      pos.x += offsetX;
      pos.y += offsetY;

      gl_Position = vec4(pos, 1.0);
    }
  `,
  fragmentShader: `
    precision mediump float;
    uniform sampler2D u_texture;
    uniform sampler2D u_brush;
    varying vec2 v_uv;

void main() {
  // Sample the brush texture
  float strength = texture2D(u_brush, v_uv).a;

  if (strength < 0.01) strength = 0.0;

  // Get brush gradient (offsets in x/y)
  float dx = texture2D(u_brush, v_uv + vec2(0.001, 0.0)).a - strength;
  float dy = texture2D(u_brush, v_uv + vec2(0.0, 0.001)).a - strength;

  // Use gradient to offset UVs (inverted for 'rippling' effect)
//    **BRUSH CONTRAST INTENSITY**
  vec2 offset = vec2(dx, dy) * 0.75;

  // Displace the background texture
  vec4 base = texture2D(u_texture, v_uv + offset);

  gl_FragColor = base;
}
  `,
});
const quad = new THREE.Mesh(geometry, material);
scene.add(quad);

// 6. Handle resize
window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
});

let mouse = new THREE.Vector2(0.5, 0.5);
window.addEventListener("mousemove", (e) => {
  mouse.x = e.clientX / window.innerWidth;
  mouse.y = 1.0 - e.clientY / window.innerHeight; //   flip Y for WebGL space **
  isDrawing = true;
  lastMoveTime = performance.now();
});

// 6. Clock +  animate loop
// create clock
const clock = new THREE.Clock();

// Render loop
function animate() {
  // add elapsed time
  const elapsed = clock.getElapsedTime();
  material.uniforms.u_time.value = elapsed;

  // Update brushMaterial input
  brushMaterial.uniforms.u_mouse.value.copy(mouse);
  brushMaterial.uniforms.u_time.value = elapsed;

  // Fade and add brush to target 2
  brushMaterial.uniforms.u_prevTexture.value = brushRenderTarget.texture;

  renderer.setRenderTarget(brushRenderTarget2);
  renderer.render(brushScene, brushCamera);
  renderer.setRenderTarget(null);

  // Swap targets
  let temp = brushRenderTarget;
  brushRenderTarget = brushRenderTarget2;
  brushRenderTarget2 = temp;

  const now = performance.now();
  if (now - lastMoveTime > 100) {
    isDrawing = false;
  }
  brushMaterial.uniforms.u_isDrawing.value = isDrawing;

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();
