/* Aikido West, the dream edition. One WebGL plane behind the page: photographs given depth, fog that lies low and far,
   a soft light, ink dissolves from one place to the next. Nothing modelled, nothing drawn by a machine's hand. */
import * as THREE from './three.module.min.js';

const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
const MOBILE = matchMedia('(max-width: 900px)').matches;

const VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D tA, dA, tB, dB;
uniform float aA, aB, screenAspect, time, grain, mixAB;
uniform float zoomA, zoomB, blackA, blackB, gradeA, gradeB, fogA, fogB, shaftA, shaftB;
uniform vec2 offA, offB, focusA, focusB, shadeA, shadeB;
uniform vec3 ground, fogCol;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < OCT; i++){ v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return v; }
vec2 cover(vec2 uv, float ta, float zoom, vec2 focus){
  vec2 s = (screenAspect > ta) ? vec2(1.0, ta / screenAspect) : vec2(screenAspect / ta, 1.0);
  return (uv - 0.5) * s / zoom + focus;
}
vec3 photo(sampler2D t, sampler2D d, vec2 uv, vec2 off, float grade, float fog, float shaft, float black, vec2 shade){
  float dep = texture2D(d, uv).r;
  vec2 uv2 = clamp(uv + off * (dep - 0.45), 0.002, 0.998);
  float dep2 = texture2D(d, uv2).r;
  vec2 uv3 = clamp(uv + off * (dep2 - 0.45), 0.002, 0.998);
  vec3 col = texture2D(t, uv3).rgb;
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, vec3(lum) * vec3(1.0, 0.995, 0.985), grade);
  float far = 1.0 - dep2;
  float n = fbm(vUv * vec2(screenAspect, 1.0) * 2.1 + vec2(time * 0.011, time * 0.004));
  float n2 = fbm(vUv * vec2(screenAspect, 1.0) * 5.0 - vec2(time * 0.006, time * 0.009));
  float band = 0.25 + 0.75 * smoothstep(0.0, 0.75, 1.0 - vUv.y);
  float f = fog * (0.12 + 0.88 * smoothstep(0.42, 0.9, n * 0.8 + n2 * 0.25)) * (0.3 + 0.7 * far) * band * 0.62;
  col = mix(col, fogCol, clamp(f, 0.0, 0.72));
  vec2 lp = (vUv - vec2(0.22, 1.12)) * vec2(0.8, 1.0);
  float sh = shaft * pow(max(0.0, 1.0 - length(lp) * 0.78), 2.4) * (0.55 + 0.45 * fbm(vUv * 3.0 - vec2(time * 0.008, 0.0)));
  col += sh * vec3(0.56, 0.52, 0.44) * (0.35 + 0.65 * far);
  col = mix(col, ground, shade.x * smoothstep(0.5, 1.05, vUv.y) * 0.9);
  col = mix(col, ground, shade.y * smoothstep(0.75, 0.0, vUv.y) * 0.9);
  return mix(col, ground, black);
}
void main(){
  vec2 uvA = cover(vUv, aA, zoomA, focusA);
  vec2 uvB = cover(vUv, aB, zoomB, focusB);
  vec3 ca = photo(tA, dA, uvA, offA, gradeA, fogA, shaftA, blackA, shadeA);
  vec3 cb = photo(tB, dB, uvB, offB, gradeB, fogB, shaftB, blackB, shadeB);
  float th = fbm(vUv * vec2(screenAspect, 1.0) * 2.4 + 5.3);
  float m = smoothstep(th - 0.22, th + 0.22, mixAB * 1.44 - 0.22);
  vec3 col = mix(ca, cb, m);
  float v = smoothstep(1.35, 0.3, length((vUv - 0.5) * vec2(1.0, 1.2)));
  col *= 0.84 + 0.16 * v;
  col += (hash(vUv * 1400.0 + fract(time)) - 0.5) * grain;
  gl_FragColor = vec4(col, 1.0);
}`;

export async function createStage(canvas, PHOTOS, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, MOBILE ? 1.25 : 1.6));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const ground = new THREE.Color(opts.ground || '#0B0B0C');
  const scene = new THREE.Scene(); const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const blank = new THREE.DataTexture(new Uint8Array([11, 11, 12, 255]), 1, 1); blank.needsUpdate = true;
  const blankD = new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1); blankD.needsUpdate = true;
  const U = {
    tA: { value: blank }, dA: { value: blankD }, tB: { value: blank }, dB: { value: blankD },
    aA: { value: 1 }, aB: { value: 1 }, screenAspect: { value: 1 }, time: { value: 0 }, grain: { value: 0.03 }, mixAB: { value: 0 },
    zoomA: { value: 1.1 }, zoomB: { value: 1.1 }, blackA: { value: 1 }, blackB: { value: 1 },
    gradeA: { value: 0 }, gradeB: { value: 0 }, fogA: { value: 0 }, fogB: { value: 0 }, shaftA: { value: 0 }, shaftB: { value: 0 },
    offA: { value: new THREE.Vector2() }, offB: { value: new THREE.Vector2() }, focusA: { value: new THREE.Vector2(0.5, 0.5) }, focusB: { value: new THREE.Vector2(0.5, 0.5) }, shadeA: { value: new THREE.Vector2() }, shadeB: { value: new THREE.Vector2() },
    ground: { value: ground }, fogCol: { value: new THREE.Color(opts.fog || '#C9C4BA') },
  };
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: U, vertexShader: VERT, fragmentShader: FRAG, depthWrite: false, depthTest: false, defines: { OCT: MOBILE ? 3 : 4 } }));
  quad.frustumCulled = false; scene.add(quad);

  const tex = {}, pending = {}; const loader = new THREE.TextureLoader();
  function load(name) {
    if (!PHOTOS[name]) return Promise.resolve(null);
    if (tex[name]) return Promise.resolve(tex[name]);
    if (pending[name]) return pending[name];
    const p = PHOTOS[name];
    pending[name] = Promise.all([loader.loadAsync(p.src), loader.loadAsync(p.depth)]).then(([t, d]) => {
      t.colorSpace = THREE.SRGBColorSpace; for (const x of [t, d]) { x.generateMipmaps = false; x.minFilter = THREE.LinearFilter; x.magFilter = THREE.LinearFilter; x.wrapS = x.wrapT = THREE.ClampToEdgeWrapping; }
      tex[name] = { t, d, aspect: t.image.width / t.image.height }; renderer.initTexture(t); renderer.initTexture(d); return tex[name];
    });
    return pending[name];
  }
  const state = { a: null, b: null, mix: 0, pA: 0, pB: 0, mouse: new THREE.Vector2(), smooth: new THREE.Vector2(), time: 0 };
  function apply(S, name, p) {
    const ph = PHOTOS[name], tx = tex[name];
    if (!ph || !tx) { U['black' + S].value = 1; return; }
    U['t' + S].value = tx.t; U['d' + S].value = tx.d; U['a' + S].value = tx.aspect; U['black' + S].value = 0;
    U['zoom' + S].value = ph.zoom[0] + (ph.zoom[1] - ph.zoom[0]) * p;
    U['grade' + S].value = ph.grade || 0; U['fog' + S].value = ph.fog || 0; U['shaft' + S].value = ph.shaft || 0;
    const fx = ph.focus[0] + (ph.pan ? ph.pan[0] * p : 0), fy = ph.focus[1] + (ph.pan ? ph.pan[1] * p : 0);
    U['focus' + S].value.set(fx, fy); U['shade' + S].value.set(ph.shade ? ph.shade[0] : 0.5, ph.shade ? ph.shade[1] : 0.4);
    const m = state.smooth; U['off' + S].value.set(m.x * (ph.parallax || 0.02), -m.y * (ph.parallax || 0.02) * 0.8);
  }
  function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); U.screenAspect.value = w / h; canvas.style.width = w + 'px'; canvas.style.height = h + 'px'; }
  addEventListener('resize', resize); resize();
  let last = performance.now();
  function render(now) {
    const dt = Math.min(0.5, (now - last) / 1000); last = now; if (!REDUCE) state.time += dt;
    U.time.value = state.time; state.smooth.lerp(state.mouse, 0.04);
    if (state.a) apply('A', state.a, state.pA); else U.blackA.value = 1;
    if (state.b) apply('B', state.b, state.pB); else U.blackB.value = 1;
    U.mixAB.value = state.mix; renderer.render(scene, cam);
  }
  return {
    load, render, resize,
    setMouse(x, y) { state.mouse.set(x, y); },
    setScene(a, pA, b, pB, mix) { state.a = a; state.pA = pA; state.b = b; state.pB = pB; state.mix = mix; },
  };
}
