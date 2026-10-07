/* The dark room. One WebGL plane: a photograph lives in darkness and is revealed where a soft light falls.
   The light follows the pointer, drifts on its own when left alone, and breathes with the beat when sound is on. */
import * as THREE from './three.module.min.js';
const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;

const VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D tA, dA, tB, dB;
uniform float aA, aB, screenAspect, time, mixAB, blackA, blackB, gradeA, gradeB, zoomA, zoomB;
uniform vec2 focusA, focusB, light, offA, offB;
uniform float rad, glow, ambient, beam, dust;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return v; }
vec2 cover(vec2 uv, float ta, float zoom, vec2 focus){
  vec2 s = (screenAspect > ta) ? vec2(1.0, ta / screenAspect) : vec2(screenAspect / ta, 1.0);
  return (uv - 0.5) * s / zoom + focus;
}
vec3 photo(sampler2D t, sampler2D d, vec2 uv, vec2 off, float grade, float black){
  float dep = texture2D(d, uv).r;
  vec2 uv2 = clamp(uv + off * (dep - 0.45), 0.002, 0.998);
  float dep2 = texture2D(d, uv2).r;
  vec2 uv3 = clamp(uv + off * (dep2 - 0.45), 0.002, 0.998);
  vec3 col = texture2D(t, uv3).rgb;
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, vec3(lum), grade);
  return mix(col, vec3(0.0), black);
}
void main(){
  vec2 uvA = cover(vUv, aA, zoomA, focusA);
  vec2 uvB = cover(vUv, aB, zoomB, focusB);
  vec3 ca = photo(tA, dA, uvA, offA, gradeA, blackA);
  vec3 cb = photo(tB, dB, uvB, offB, gradeB, blackB);
  float th = fbm(vUv * vec2(screenAspect, 1.0) * 2.4 + 5.3);
  float m = smoothstep(th - 0.22, th + 0.22, mixAB * 1.44 - 0.22);
  vec3 col = mix(ca, cb, m);
  // the light: a soft pool with a breathing, noisy edge
  vec2 q = (vUv - light) * vec2(screenAspect, 1.0);
  float dist = length(q);
  float edge = 1.0 + 0.08 * fbm(q * 6.0 + time * 0.2);
  float spot = smoothstep(rad * edge, rad * 0.18, dist);
  // a beam from above, faint, with drifting haze in it
  float cone = smoothstep(0.42 + 0.3 * (1.0 - vUv.y), 0.0, abs(vUv.x - light.x) * screenAspect) * (0.35 + 0.65 * vUv.y);
  float haze = fbm(vec2(vUv.x * 3.0 * screenAspect, vUv.y * 2.0 - time * 0.05));
  float ray = beam * cone * (0.35 + 0.65 * haze);
  float lit = ambient + spot * glow + ray * 0.35;
  col *= lit;
  // light seen in the air: a faint grey pool and sparkles of dust inside the beam and the pool
  col += vec3(0.1, 0.1, 0.11) * spot * 0.35 * glow;
  col += vec3(0.07) * ray;
  float sp = pow(noise(vUv * vec2(screenAspect, 1.0) * 420.0 + floor(time * 9.0)), 24.0);
  col += vec3(sp) * dust * (spot + ray * 0.6);
  col += (hash(vUv * 1400.0 + fract(time)) - 0.5) * 0.02;
  gl_FragColor = vec4(col, 1.0);
}`;

export async function createLight(canvas, PHOTOS) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5)); renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(); const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); blank.needsUpdate = true;
  const blankD = new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1); blankD.needsUpdate = true;
  const U = {
    tA: { value: blank }, dA: { value: blankD }, tB: { value: blank }, dB: { value: blankD }, aA: { value: 1 }, aB: { value: 1 }, screenAspect: { value: 1 }, time: { value: 0 }, mixAB: { value: 0 },
    blackA: { value: 1 }, blackB: { value: 1 }, gradeA: { value: 0 }, gradeB: { value: 0 }, zoomA: { value: 1.05 }, zoomB: { value: 1.05 },
    focusA: { value: new THREE.Vector2(0.5, 0.5) }, focusB: { value: new THREE.Vector2(0.5, 0.5) }, light: { value: new THREE.Vector2(0.5, 0.5) }, offA: { value: new THREE.Vector2() }, offB: { value: new THREE.Vector2() },
    rad: { value: 0.34 }, glow: { value: 1.0 }, ambient: { value: 0.06 }, beam: { value: 0.0 }, dust: { value: 0.6 },
  };
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: U, vertexShader: VERT, fragmentShader: FRAG, depthWrite: false, depthTest: false }));
  quad.frustumCulled = false; scene.add(quad);
  const tex = {}, pending = {}; const loader = new THREE.TextureLoader();
  function load(name) {
    if (!PHOTOS[name]) return Promise.resolve(null); if (tex[name]) return Promise.resolve(tex[name]); if (pending[name]) return pending[name];
    const p = PHOTOS[name];
    pending[name] = Promise.all([loader.loadAsync(p.src), loader.loadAsync(p.depth)]).then(([t, d]) => {
      t.colorSpace = THREE.SRGBColorSpace; for (const x of [t, d]) { x.generateMipmaps = false; x.minFilter = THREE.LinearFilter; x.magFilter = THREE.LinearFilter; x.wrapS = x.wrapT = THREE.ClampToEdgeWrapping; }
      tex[name] = { t, d, aspect: t.image.width / t.image.height }; renderer.initTexture(t); renderer.initTexture(d); return tex[name];
    });
    return pending[name];
  }
  const st = { a: null, b: null, mix: 0, pA: 0, pB: 0, pointer: new THREE.Vector2(0.5, 0.55), target: new THREE.Vector2(0.5, 0.55), idle: 0, time: 0, pulse: 0, scene: null };
  function apply(S, name, p) {
    const ph = PHOTOS[name], tx = tex[name];
    if (!ph || !tx) { U['black' + S].value = 1; return; }
    U['t' + S].value = tx.t; U['d' + S].value = tx.d; U['a' + S].value = tx.aspect; U['black' + S].value = 0;
    U['grade' + S].value = ph.grade || 0; U['zoom' + S].value = ph.zoom[0] + (ph.zoom[1] - ph.zoom[0]) * p; U['focus' + S].value.set(ph.focus[0], ph.focus[1]);
    const o = st.pointer; U['off' + S].value.set((o.x - 0.5) * 0.03, -(o.y - 0.5) * 0.024);
  }
  function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); U.screenAspect.value = w / h; canvas.style.width = w + 'px'; canvas.style.height = h + 'px'; }
  addEventListener('resize', resize); resize();
  let last = performance.now(), lastMove = performance.now();
  function render(now) {
    const dt = Math.min(0.5, (now - last) / 1000); last = now; if (!REDUCE) st.time += dt; U.time.value = st.time;
    // when nobody moves the pointer for a while, the light wanders on its own
    const idle = (now - lastMove) / 1000;
    if (idle > 2.5 || REDUCE) { const t = st.time * 0.17; st.target.set(0.5 + 0.28 * Math.sin(t * 0.9) * Math.cos(t * 0.37), 0.52 + 0.2 * Math.sin(t * 0.63 + 1.3)); }
    st.pointer.lerp(st.target, REDUCE ? 1 : 0.045);
    U.light.value.set(st.pointer.x, 1.0 - st.pointer.y);
    const sc = st.scene || {}; const base = sc.rad == null ? 0.34 : sc.rad;
    U.rad.value = base * (1.0 + 0.1 * st.pulse); U.glow.value = (sc.glow == null ? 1.0 : sc.glow) * (1.0 + 0.25 * st.pulse);
    U.ambient.value = sc.ambient == null ? 0.06 : sc.ambient; U.beam.value = sc.beam == null ? 0 : sc.beam;
    if (st.a) apply('A', st.a, st.pA); else U.blackA.value = 1;
    if (st.b) apply('B', st.b, st.pB); else U.blackB.value = 1;
    U.mixAB.value = st.mix; renderer.render(scene, cam);
  }
  return {
    load, render, resize,
    pointer(x, y) { st.target.set(x, y); lastMove = performance.now(); },
    pulse(v) { st.pulse = v; },
    setScene(a, pA, b, pB, mix, look) { st.a = a; st.pA = pA; st.b = b; st.pB = pB; st.mix = mix; st.scene = look || null; },
    light() { return { x: st.pointer.x, y: st.pointer.y }; },
  };
}
