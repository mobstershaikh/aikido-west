/* Aikido West, the frontier edition. One WebGL stage behind the page:
   photographs given depth (monocular depth maps), mountain fog and light in a shader, ink dissolves between places,
   the brush mark assembling from grains of ink, and a bokken modelled from a curve that makes one cut. */
import * as THREE from './three.module.min.js';
import { RoomEnvironment } from './RoomEnvironment.js';

const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
const MOBILE = matchMedia('(max-width: 900px)').matches;

const PHOTOS = {
  hero: { src: '../assets/stock/kumano_torii.jpg', depth: 'assets/depth/kumano_torii_depth.png', grade: 0.0, fog: 1.0, shaft: 0.5, zoom: [1.16, 1.3], focus: [0.5, 0.7], drift: [0.0, 0.012], shade: [0.9, 0.55] },
  road: { src: '../assets/stock/kumano_steps.jpg', depth: 'assets/depth/kumano_steps_depth.png', grade: 0.0, fog: 0.75, shaft: 0.35, zoom: [1.12, 1.2], focus: [0.5, 0.5], drift: [0.0, -0.03], shade: [0.55, 0.35] },
  line: { src: '../assets/kanetsuka_wide.jpg', depth: 'assets/depth/kanetsuka_wide_depth.png', grade: 1.0, fog: 0.2, shaft: 0.25, zoom: [1.06, 1.12], focus: [0.5, 0.55], drift: [0.012, 0.0], shade: [0.5, 0.5] },
  mat: { src: '../assets/throw_wide.jpg', depth: 'assets/depth/throw_wide_depth.png', grade: 1.0, fog: 0.1, shaft: 0.25, zoom: [1.08, 1.16], focus: [0.5, 0.48], drift: [0.0, 0.01], shade: [0.55, 0.4] },
  door: { src: '../assets/stock/nachi_torii.jpg', depth: 'assets/depth/nachi_torii_depth.png', grade: 0.0, fog: 0.6, shaft: 0.5, zoom: [1.1, 1.22], focus: [0.5, 0.5], drift: [0.0, 0.015], shade: [0.65, 0.4] },
};

const VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D tA, dA, tB, dB;
uniform float aA, aB, screenAspect, time, grain, mixAB;
uniform float zoomA, zoomB, blackA, blackB, gradeA, gradeB, fogA, fogB, shaftA, shaftB;
uniform vec2 offA, offB, focusA, focusB, shadeA, shadeB;
uniform vec3 night, fogCol;
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
  col += sh * vec3(0.5, 0.56, 0.66) * (0.35 + 0.65 * far);
  col = mix(col, night, shade.x * smoothstep(0.5, 1.05, vUv.y) * 0.9);
  col = mix(col, night, shade.y * smoothstep(0.62, 0.0, vUv.x) * 0.85);
  return mix(col, night, black);
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

const PVERT = `
attribute vec3 target; attribute float seed;
uniform float t, time, pr, alpha;
varying float vA;
void main(){
  float d = clamp((t - seed * 0.4) / 0.6, 0.0, 1.0);
  float e = 1.0 - pow(1.0 - d, 3.0);
  vec3 p = mix(position, target, e);
  p.xy += 0.0035 * vec2(sin(time * 1.3 + seed * 31.0), cos(time * 1.1 + seed * 17.0)) * (1.0 - e * 0.85);
  gl_Position = vec4(p.xy, 0.0, 1.0);
  gl_PointSize = mix(1.2, 2.4, e) * pr;
  vA = alpha * (0.25 + 0.75 * e);
}`;
const PFRAG = `
precision mediump float; varying float vA;
void main(){ vec2 c = gl_PointCoord - 0.5; float r = length(c); if (r > 0.5) discard;
  float a = smoothstep(0.5, 0.15, r) * vA; gl_FragColor = vec4(0.965, 0.955, 0.93, a); }`;

export async function createStage(canvas, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, MOBILE ? 1.25 : 1.6));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const night = new THREE.Color('#182A42');

  // ---------- background: the photograph quad ----------
  const bgScene = new THREE.Scene();
  const bgCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const blank = new THREE.DataTexture(new Uint8Array([24, 42, 66, 255]), 1, 1); blank.needsUpdate = true;
  const blankD = new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1); blankD.needsUpdate = true;
  const U = {
    tA: { value: blank }, dA: { value: blankD }, tB: { value: blank }, dB: { value: blankD },
    aA: { value: 1 }, aB: { value: 1 }, screenAspect: { value: 1 }, time: { value: 0 }, grain: { value: 0.035 }, mixAB: { value: 0 },
    zoomA: { value: 1.1 }, zoomB: { value: 1.1 }, blackA: { value: 1 }, blackB: { value: 1 },
    gradeA: { value: 0 }, gradeB: { value: 0 }, fogA: { value: 0 }, fogB: { value: 0 }, shaftA: { value: 0 }, shaftB: { value: 0 },
    offA: { value: new THREE.Vector2() }, offB: { value: new THREE.Vector2() }, focusA: { value: new THREE.Vector2(0.5, 0.5) }, focusB: { value: new THREE.Vector2(0.5, 0.5) }, shadeA: { value: new THREE.Vector2() }, shadeB: { value: new THREE.Vector2() },
    night: { value: night }, fogCol: { value: new THREE.Color('#D7DCE4') },
  };
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: U, vertexShader: VERT, fragmentShader: FRAG, depthWrite: false, depthTest: false, defines: { OCT: MOBILE ? 3 : 4 } }));
  quad.frustumCulled = false; bgScene.add(quad);

  // ---------- the grains of ink ----------
  const COUNT = MOBILE ? 5000 : 14000;
  const pGeo = new THREE.BufferGeometry();
  const start = new Float32Array(COUNT * 3), target = new Float32Array(COUNT * 3), seed = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) { seed[i] = Math.random(); }
  pGeo.setAttribute('position', new THREE.BufferAttribute(start, 3));
  pGeo.setAttribute('target', new THREE.BufferAttribute(target, 3));
  pGeo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const pU = { t: { value: 0 }, time: { value: 0 }, pr: { value: renderer.getPixelRatio() }, alpha: { value: 0 } };
  const points = new THREE.Points(pGeo, new THREE.ShaderMaterial({ uniforms: pU, vertexShader: PVERT, fragmentShader: PFRAG, transparent: true, depthWrite: false, depthTest: false }));
  points.frustumCulled = false; points.visible = false; bgScene.add(points);

  async function layoutParticles(el) {
    // sample the brush mark exactly where the page will set it, so the grains settle into the type
    await document.fonts.load(`${getComputedStyle(el).fontSize} "Yuji"`).catch(() => {});
    const r = el.getBoundingClientRect(); const W = innerWidth, H = innerHeight;
    const c = document.createElement('canvas'); c.width = Math.ceil(r.width) + 4; c.height = Math.ceil(r.height) + 4;
    const x = c.getContext('2d'); const cs = getComputedStyle(el);
    x.font = `${cs.fontWeight} ${cs.fontSize} "Yuji"`; x.letterSpacing = cs.letterSpacing; x.textBaseline = 'alphabetic'; x.fillStyle = '#fff';
    // baseline: approximate from line-height
    const fs = parseFloat(cs.fontSize); x.fillText(el.textContent.trim(), 2, fs * 0.9 + 2);
    const d = x.getImageData(0, 0, c.width, c.height).data; const pts = [];
    for (let j = 0; j < c.height; j += 1) for (let i = 0; i < c.width; i += 1) { if (d[(j * c.width + i) * 4 + 3] > 110) pts.push(i, j); }
    if (pts.length < 100) return false;
    for (let k = 0; k < COUNT; k++) {
      const q = Math.floor(Math.random() * (pts.length / 2)) * 2;
      const sx = r.left + pts[q] - 2 + (Math.random() - 0.5) * 1.2, sy = r.top + pts[q + 1] - 2 + (Math.random() - 0.5) * 1.2;
      target[k * 3] = (sx / W) * 2 - 1; target[k * 3 + 1] = 1 - (sy / H) * 2; target[k * 3 + 2] = 0;
      // start: a loose cloud low and to the right, like mist drifting in
      const a = Math.random() * Math.PI * 2, rr = Math.pow(Math.random(), 0.5);
      start[k * 3] = target[k * 3] + Math.cos(a) * rr * 0.9 + 0.25; start[k * 3 + 1] = target[k * 3 + 1] + Math.sin(a) * rr * 0.5 - 0.35; start[k * 3 + 2] = 0;
    }
    pGeo.attributes.position.needsUpdate = true; pGeo.attributes.target.needsUpdate = true;
    return true;
  }

  // ---------- foreground: the bokken ----------
  const fgScene = new THREE.Scene();
  fgScene.fog = new THREE.FogExp2(night.getHex(), 0.5);
  const fgCam = new THREE.PerspectiveCamera(34, 1, 0.05, 20); fgCam.position.set(0.0, 0.14, MOBILE ? 1.7 : 1.15); fgCam.lookAt(0.0, MOBILE ? 0.12 : 0.0, 0);
  const pmrem = new THREE.PMREMGenerator(renderer);
  fgScene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; fgScene.environmentIntensity = 0.35;
  const key = new THREE.SpotLight(0xffdfbd, 0, 9, 0.62, 0.55, 1.3); key.position.set(0.9, 1.5, 1.0); key.target.position.set(0, -0.05, 0); fgScene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0xa9c0e6, 0); rim.position.set(-1.4, -0.5, -1.2); fgScene.add(rim);
  const fill = new THREE.DirectionalLight(0x6f86a8, 0); fill.position.set(-0.6, 0.8, 1.4); fgScene.add(fill);
  const hemi = new THREE.HemisphereLight(0x3a5a8a, 0x05080c, 0); fgScene.add(hemi);
  const rig = new THREE.Group(); fgScene.add(rig);
  const pivot = new THREE.Group(); pivot.position.set(-0.5, 0, 0); rig.add(pivot);
  const bokken = makeBokken(); bokken.position.set(0.5, 0, 0); pivot.add(bokken);
  // the trail of the cut
  const trailMat = new THREE.MeshBasicMaterial({ color: 0xbfd0e8, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
  const trail = new THREE.Mesh(new THREE.BufferGeometry(), trailMat); pivot.add(trail);
  // a pool of light on the floor beneath
  const poolTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); const g = x.createRadialGradient(128, 128, 10, 128, 128, 128); g.addColorStop(0, 'rgba(255,230,200,0.5)'); g.addColorStop(0.45, 'rgba(255,230,200,0.12)'); g.addColorStop(1, 'rgba(255,230,200,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 256); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.4), new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, opacity: 0, depthWrite: false }));
  pool.rotation.x = -Math.PI / 2; pool.position.set(0, -0.42, -0.2); fgScene.add(pool);

  // ---------- state ----------
  const tex = {}, pending = {}; const loader = new THREE.TextureLoader();
  function load(name) {
    if (tex[name]) return Promise.resolve(tex[name]);
    if (pending[name]) return pending[name];
    const p = PHOTOS[name];
    pending[name] = Promise.all([loader.loadAsync(p.src), loader.loadAsync(p.depth)]).then(([t, d]) => {
      t.colorSpace = THREE.SRGBColorSpace; for (const x of [t, d]) { x.generateMipmaps = false; x.minFilter = THREE.LinearFilter; x.magFilter = THREE.LinearFilter; x.wrapS = x.wrapT = THREE.ClampToEdgeWrapping; }
      tex[name] = { t, d, aspect: t.image.width / t.image.height }; renderer.initTexture(t); renderer.initTexture(d); return tex[name];
    });
    return pending[name];
  }
  const state = { a: null, b: null, mix: 0, pA: 0, pB: 0, sword: 0, mouse: new THREE.Vector2(), smooth: new THREE.Vector2(), cutT: -1, cutDone: false, entered: false, time: 0 };
  function apply(side, name, p) {
    const S = side === 'A' ? 'A' : 'B'; const ph = PHOTOS[name]; const tx = tex[name];
    if (!ph || !tx) { U['black' + S].value = 1; return; }
    U['t' + S].value = tx.t; U['d' + S].value = tx.d; U['a' + S].value = tx.aspect; U['black' + S].value = 0;
    U['zoom' + S].value = ph.zoom[0] + (ph.zoom[1] - ph.zoom[0]) * p;
    U['grade' + S].value = ph.grade; U['fog' + S].value = ph.fog * (name === 'hero' ? (1.0 - 0.45 * p) : 1.0); U['shaft' + S].value = ph.shaft;
    U['focus' + S].value.set(ph.focus[0], ph.focus[1]); U['shade' + S].value.set(ph.shade[0], ph.shade[1]);
    const m = state.smooth; U['off' + S].value.set(m.x * 0.02 + ph.drift[0] * p, -m.y * 0.016 + ph.drift[1] * p);
  }

  function resize() {
    const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false);
    U.screenAspect.value = w / h; fgCam.aspect = w / h; fgCam.updateProjectionMatrix(); pU.pr.value = renderer.getPixelRatio();
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  }
  addEventListener('resize', resize); resize();

  // ---------- the cut ----------
  const ease = { inOutSine: x => -(Math.cos(Math.PI * x) - 1) / 2, inCubic: x => x * x * x, outCubic: x => 1 - Math.pow(1 - x, 3), outQuint: x => 1 - Math.pow(1 - x, 5) };
  function cutPose(tc) {
    // returns pivot rotation (z) and trail opacity for time since the cut began
    const raiseEnd = 1.1, cutEnd = raiseEnd + 0.24, holdEnd = cutEnd + 0.8, backEnd = holdEnd + 1.8;
    const RAISED = 1.18, CUT = -0.26;
    if (tc < 0) return { z: 0, trail: 0, phase: 0 };
    if (tc < raiseEnd) return { z: RAISED * ease.inOutSine(tc / raiseEnd), trail: 0, phase: 1 };
    if (tc < cutEnd) { const k = ease.inCubic((tc - raiseEnd) / (cutEnd - raiseEnd)); return { z: RAISED + (CUT - RAISED) * k, trail: 0.16 * k, phase: 2 }; }
    if (tc < holdEnd) return { z: CUT, trail: 0.16 * Math.max(0, 1 - (tc - cutEnd) / 0.45), phase: 3 };
    if (tc < backEnd) return { z: CUT * (1 - ease.outCubic((tc - holdEnd) / (backEnd - holdEnd))), trail: 0, phase: 4 };
    return { z: 0, trail: 0, phase: 5 };
  }
  function buildTrail(z0, z1) {
    const R = 0.98, n = 24, pos = [];
    for (let i = 0; i < n; i++) { const a0 = z0 + (z1 - z0) * i / n, a1 = z0 + (z1 - z0) * (i + 1) / n; pos.push(0, 0, 0, Math.cos(a0) * R, Math.sin(a0) * R, 0, Math.cos(a1) * R, Math.sin(a1) * R, 0); }
    trail.geometry.dispose(); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); trail.geometry = g;
  }
  buildTrail(-0.26, 1.18);
  let swishPlayed = false;

  // ---------- loop ----------
  let last = performance.now();
  function render(now) {
    const dt = Math.min(0.5, (now - last) / 1000); last = now; if (!REDUCE) state.time += dt; else state.time += 0.0;
    U.time.value = state.time; pU.time.value = state.time;
    state.smooth.lerp(state.mouse, 0.04);
    if (state.a) apply('A', state.a, state.pA); else U.blackA.value = 1;
    if (state.b) apply('B', state.b, state.pB); else U.blackB.value = 1;
    U.mixAB.value = state.mix;
    renderer.autoClear = true; renderer.render(bgScene, bgCam);
    if (state.sword > 0.001) {
      const f = state.sword; key.intensity = 820 * f; rim.intensity = 4.2 * f; fill.intensity = 0.9 * f; hemi.intensity = 0.45 * f; fgScene.environmentIntensity = 0.22 * f; pool.material.opacity = 0.9 * f;
      if (!REDUCE) { rig.rotation.y = -0.62 + 0.07 * Math.sin(state.time * 0.21); rig.rotation.x = 0.3 + 0.04 * Math.sin(state.time * 0.17); rig.rotation.z = 0.18 + 0.03 * Math.sin(state.time * 0.11); rig.position.set(-0.12, (MOBILE ? 0.1 : -0.14) + 0.015 * Math.sin(state.time * 0.3), 0.18); }
      else { rig.rotation.set(0.3, -0.62, 0.18); rig.position.set(-0.12, MOBILE ? 0.1 : -0.14, 0.18); }
      let pose = { z: 0, trail: 0, phase: 0 };
      if (state.cutT >= 0) { const tc = state.time - state.cutT; pose = cutPose(tc); if (pose.phase === 2 && !swishPlayed) { swishPlayed = true; opts.onCut && opts.onCut(); } if (pose.phase === 5) { state.cutT = -1; } }
      pivot.rotation.z = pose.z; trailMat.opacity = pose.trail * f;
      renderer.autoClear = false; renderer.clearDepth(); renderer.render(fgScene, fgCam); renderer.autoClear = true;
    }
  }

  window.__U = U; window.__state = state; window.__pU = pU;
  return {
    renderer, load,
    setMouse(x, y) { state.mouse.set(x, y); },
    setScene(a, pA, b, pB, mix) { state.a = a; state.pA = pA; state.b = b; state.pB = pB; state.mix = mix; },
    setSword(f) { state.sword = f; },
    cut() { if (state.cutT < 0) { state.cutT = state.time; swishPlayed = false; } },
    resetCut() { state.cutT = -1; swishPlayed = false; },
    async enter(el) {
      if (REDUCE) return;
      const ok = await layoutParticles(el); if (!ok) return;
      points.visible = true; pU.alpha.value = 0.9; const t0 = state.time;
      return new Promise(res => { const tick = () => { const k = (state.time - t0) / 2.6; pU.t.value = Math.min(1, k); if (k < 1) requestAnimationFrame(tick); else res(); }; tick(); });
    },
    fadeParticles(sec = 1.2) { const t0 = state.time, a0 = pU.alpha.value; const tick = () => { const k = (state.time - t0) / sec; pU.alpha.value = a0 * Math.max(0, 1 - k); if (k < 1) requestAnimationFrame(tick); else points.visible = false; }; tick(); },
    render, resize,
  };
}

// ---------- the bokken, from a curve ----------
function makeBokken() {
  const L = 1.02, TSUKA = 0.26, N = 180, M = 30;
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N, x = -L / 2 + u * L;
    const blade = x > -L / 2 + TSUKA; const ub = blade ? (x - (-L / 2 + TSUKA)) / (L - TSUKA) : 0;
    const y = blade ? 0.016 * Math.pow(ub, 1.6) : 0;                   // sori: the curve rises toward the tip
    let ry = blade ? 0.0168 - 0.005 * ub : 0.0158, rz = blade ? 0.0122 - 0.0038 * ub : 0.0128;
    const tip0 = L / 2 - 0.065; let tipk = 1; if (x > tip0) { tipk = Math.max(0.02, 1 - (x - tip0) / 0.065); rz *= Math.pow(tipk, 0.6); }
    if (x < -L / 2 + 0.025) { const k = (x + L / 2) / 0.025; ry *= 0.86 + 0.14 * k; rz *= 0.86 + 0.14 * k; }
    for (let j = 0; j <= M; j++) {
      const th = j / M * Math.PI * 2, c = Math.cos(th), s = Math.sin(th);
      let yy = Math.sign(c) * Math.pow(Math.abs(c), blade ? 0.72 : 0.85) * ry;
      if (c < 0) yy *= tipk;                                            // the kissaki: the back falls away to the edge line
      const pinch = (blade && c > 0) ? 1 - 0.42 * Math.pow(c, 2.5) : 1;   // the ha: a lens edge on the cutting side
      pos.push(x, y + yy, s * rz * pinch); uv.push(u * 7.0, j / M);
    }
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) { const a = i * (M + 1) + j, b = a + M + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const wood = woodTexture();
  const mat = new THREE.MeshPhysicalMaterial({ map: wood.map, roughnessMap: wood.rough, roughness: 0.48, metalness: 0.0, clearcoat: 0.18, clearcoatRoughness: 0.5, sheen: 0.1, sheenColor: new THREE.Color(0xfff2dc), envMapIntensity: 0.5 });
  const mesh = new THREE.Mesh(g, mat);
  // tsuba: black lacquer, and the small ring that keeps it
  const tsuba = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.044, 0.005, 48), new THREE.MeshPhysicalMaterial({ color: 0x070708, roughness: 0.25, clearcoat: 1.0, clearcoatRoughness: 0.15, envMapIntensity: 0.35 }));
  tsuba.rotation.z = Math.PI / 2; tsuba.position.set(-L / 2 + TSUKA, 0, 0);
  const grp = new THREE.Group(); grp.add(mesh, tsuba); return grp;
}

function woodTexture() {
  const W = 2048, H = 256; const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  const img = x.createImageData(W, H), d = img.data; const r = c2 => c2;
  const rnd = new Float32Array(1024); for (let i = 0; i < 1024; i++) rnd[i] = Math.random();
  const vn = (t) => { const i = Math.floor(t), f = t - i; const a = rnd[i & 1023], b = rnd[(i + 1) & 1023]; return a + (b - a) * (f * f * (3 - 2 * f)); };
  const rough = x.createImageData(W, H), rd = rough.data;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const u = i / W, v = j / H;
    const grain = vn(v * 64 + vn(u * 5) * 7 + Math.sin(u * 22) * 0.6) * 0.6 + vn(v * 220 + u * 40) * 0.25 + vn(u * 90) * 0.15;   // rings run along the length
    const pore = vn(u * 900 + v * 50) > 0.93 ? 0.08 : 0;
    const base = [0.84, 0.72, 0.52]; const dark = [0.5, 0.38, 0.23];
    const k = 0.35 + 0.65 * Math.pow(grain, 1.2);
    const o = (j * W + i) * 4;
    d[o] = 255 * (base[0] * k + dark[0] * (1 - k) - pore); d[o + 1] = 255 * (base[1] * k + dark[1] * (1 - k) - pore); d[o + 2] = 255 * (base[2] * k + dark[2] * (1 - k) - pore); d[o + 3] = 255;
    const rr = 255 * (0.5 + 0.35 * grain); rd[o] = rd[o + 1] = rd[o + 2] = rr; rd[o + 3] = 255;
  }
  x.putImageData(img, 0, 0); const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace; map.wrapS = map.wrapT = THREE.RepeatWrapping; map.anisotropy = 4;
  const c2 = document.createElement('canvas'); c2.width = W; c2.height = H; c2.getContext('2d').putImageData(rough, 0, 0); const rt = new THREE.CanvasTexture(c2); rt.wrapS = rt.wrapT = THREE.RepeatWrapping;
  return { map, rough: rt };
}
