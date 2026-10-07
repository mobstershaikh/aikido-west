/* Aikido West, the dark room. A beat, composed and synthesised in the browser.
   170 bpm liquid drum and bass with the half-time feel: Rhodes, sub bass, koto plucks in the yo scale
   with a dotted echo, vinyl crackle, the wooden blocks as accents, a strings breakdown. 96 bars, about 2:15, then round. */
const BPM = 170, BEAT = 60 / BPM, BAR = BEAT * 4, S16 = BEAT / 4, SWING = 0.018;
const F = n => 440 * Math.pow(2, (n - 69) / 12);
// chords in G, four bars: Em9 Cmaj9 Gmaj7 D9  (midi)
const CHORDS = [[52, 55, 59, 62, 66], [48, 52, 55, 59, 62], [43, 47, 50, 54, 59], [50, 54, 57, 60, 64]];
const ROOTS = [40, 36, 31, 38];
// koto phrases in G yo (G A B D E), two bars each: [16th index, midi, length in 16ths]
const PHRASES = [
  [[0, 79, 3], [4, 81, 2], [6, 83, 4], [12, 86, 3], [16, 83, 2], [18, 81, 2], [20, 79, 6], [28, 74, 3]],
  [[0, 86, 2], [2, 88, 2], [4, 86, 4], [10, 83, 2], [12, 81, 4], [18, 79, 2], [20, 81, 2], [22, 83, 6]],
  [[0, 91, 3], [4, 88, 2], [6, 86, 4], [12, 83, 2], [14, 81, 2], [16, 79, 8], [26, 74, 2], [28, 76, 4]],
  [[2, 79, 2], [4, 83, 2], [6, 86, 2], [8, 88, 6], [16, 86, 2], [18, 83, 2], [20, 81, 2], [22, 79, 8]],
];
// sections by bar: i intro, a beat, b breakdown, d drop, o outro
const FORM = []; const push = (k, n) => { for (let i = 0; i < n; i++) FORM.push(k); };
push('i', 8); push('a', 16); push('b', 8); push('d', 24); push('a', 16); push('b', 8); push('o', 16);
const BARS = FORM.length; // 96

export class Beat {
  constructor() { this.ctx = null; this.on = false; this.level = 0; this._timer = null; }
  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); this.setOn(true); return; }
    const C = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = C.createGain(); this.master.gain.value = 0;
    const shaper = C.createWaveShaper(); const curve = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; curve[i] = Math.tanh(x * 1.25) / Math.tanh(1.25); } shaper.curve = curve;
    this.analyser = C.createAnalyser(); this.analyser.fftSize = 512; this._fft = new Uint8Array(256);
    this.master.connect(shaper).connect(this.analyser).connect(C.destination);
    this.reverb = C.createConvolver(); this.reverb.buffer = this._hall(1.8, 2.8); const rv = C.createGain(); rv.gain.value = 0.7; this.reverb.connect(rv).connect(this.master);
    const bus = (g, w) => { const G = C.createGain(); G.gain.value = g; G.connect(this.master); const W = C.createGain(); W.gain.value = w; G.connect(W).connect(this.reverb); return G; };
    this.bDrum = bus(0.5, 0.08); this.bBass = bus(0.2, 0.0); this.bKeys = bus(1.0, 0.3); this.bKoto = bus(1.3, 0.35); this.bPad = bus(0.8, 0.5); this.bWood = bus(0.6, 0.3); this.bTex = bus(0.08, 0.0);
    // the dotted-eighth echo for the koto
    this.echo = C.createDelay(1.0); this.echo.delayTime.value = S16 * 6; const fb = C.createGain(); fb.gain.value = 0.34; const lp = C.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
    this.echo.connect(lp).connect(fb).connect(this.echo); const eg = C.createGain(); eg.gain.value = 0.45; lp.connect(eg).connect(this.bKoto);
    this._crackle();
    this.t0 = C.currentTime + 0.15; this.step = 0;   // step = 16th index since t0
    this._loop(); this.setOn(true);
    document.addEventListener('visibilitychange', () => { if (!this.ctx) return; const t = this.ctx.currentTime; this.master.gain.cancelScheduledValues(t); this.master.gain.setTargetAtTime(document.hidden ? 0 : (this.on ? 1.0 : 0), t, 0.2); });
  }
  setOn(v) { this.on = v; if (!this.ctx) return; const t = this.ctx.currentTime; this.master.gain.cancelScheduledValues(t); this.master.gain.setTargetAtTime(v ? 1.0 : 0, t, v ? 0.8 : 0.3); }
  toggle() { if (!this.ctx) { this.start(); return true; } this.setOn(!this.on); return this.on; }
  // a 0..1 energy reading for the visuals
  pulse() { if (!this.ctx || !this.on) return 0; this.analyser.getByteFrequencyData(this._fft); let s = 0; for (let i = 1; i < 12; i++) s += this._fft[i]; return Math.min(1, s / (11 * 200)); }

  _hall(seconds, decay) { const C = this.ctx, n = Math.floor(C.sampleRate * seconds), b = C.createBuffer(2, n, C.sampleRate); for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) { const t = i / n; d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay); } } return b; }
  _noise(seconds) { const C = this.ctx, n = Math.floor(C.sampleRate * seconds), b = C.createBuffer(1, n, C.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; return b; }
  _crackle() {
    const C = this.ctx; const s = C.createBufferSource(); const n = C.sampleRate * 8, b = C.createBuffer(1, n, C.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) { d[i] = (Math.random() * 2 - 1) * 0.02; if (Math.random() < 0.00035) { const l = 20 + Math.floor(Math.random() * 60); for (let k = 0; k < l && i + k < n; k++) d[i + k] += (Math.random() * 2 - 1) * (1 - k / l) * 0.6; } }
    s.buffer = b; s.loop = true; const hp = C.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800; const lp = C.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 9000;
    s.connect(hp).connect(lp).connect(this.bTex); s.start();
  }

  // ---------- the clock ----------
  _loop() {
    const C = this.ctx; const ahead = 0.25;
    while (this.t0 + this.step * S16 < C.currentTime + ahead) {
      const i = this.step, bar = Math.floor(i / 16) % BARS, s = i % 16; const t = this.t0 + i * S16 + (s % 2 ? SWING : 0);
      if (t > C.currentTime - 0.05) this._bar(FORM[bar], bar, s, t);
      this.step++;
    }
    this._timer = setTimeout(() => this._loop(), 90);
  }
  _bar(sec, bar, s, t) {
    const chord = CHORDS[bar % 4], root = ROOTS[bar % 4], drums = sec === 'a' || sec === 'd' || sec === 'o', full = sec === 'd';
    const eight = bar % 8, inSec = FORM.indexOf(sec);
    // drums: a two-step
    if (drums) {
      if (s === 0 || s === 10 || (full && eight % 2 === 1 && s === 7)) this.kick(t, s === 0 ? 1 : 0.85);
      if (s === 4 || s === 12) this.snare(t, 1);
      if (full && (s === 11 || (eight % 4 === 3 && s === 14))) this.snare(t, 0.28, true);
      if (s % 2 === 0) this.hat(t, s % 4 === 0 ? 0.5 : 0.32, false);
      if (full && s % 2 === 1 && (eight % 2 === 1 || s > 8)) this.hat(t, 0.16, false);
      if (full && eight % 4 === 3 && s === 14) this.hat(t, 0.45, true);
      if (sec === 'o' && bar % 2 === 1 && s === 8) this.hat(t, 0.3, true);
    } else if (sec === 'b' || sec === 'i') {
      if (s % 4 === 2) this.hat(t, 0.18, false);
    }
    // bass
    if (drums) {
      if (s === 0) this.bass(F(root), t, S16 * 5);
      if (s === 6) this.bass(F(root + 7), t, S16 * 2, 0.7);
      if (s === 10) this.bass(F(root), t, S16 * 4);
      if (full && s === 14) this.bass(F(root + 12), t, S16 * 1.5, 0.5);
    }
    // keys: a long chord on the one, a stab on the and of two
    if (sec !== 'b' || bar % 8 >= 6) { if (s === 0) this.rhodes(chord, t, BAR * 0.9, 0.5); if (s === 6 && sec !== 'i') this.rhodes(chord, t, S16 * 3, 0.32); }
    // pad in the breakdowns and the outro
    if ((sec === 'b' || sec === 'o') && s === 0) this.pad(chord, t, BAR * 1.05);
    // koto: phrases every two bars in the melodic sections
    const melodic = sec === 'd' || sec === 'b' || (sec === 'a' && bar % 16 >= 8) || (sec === 'i' && bar >= 4);
    if (melodic && bar % 2 === 0 && s === 0) { const ph = PHRASES[(Math.floor(bar / 2)) % PHRASES.length]; for (const [k, n, l] of ph) this.koto(F(n), t + k * S16 + (k % 2 ? SWING : 0), l * S16, sec === 'b' ? 0.75 : 0.6); }
    // the blocks: a pair at the start of each eight, a tick on the and of three in the drop, a roll before each drop
    if (s === 0 && bar % 8 === 0 && sec !== 'b') this.hyoshigi(2, BEAT, t, 0.8);
    if (full && s === 10 && eight % 2 === 0) this.hyoshigi(1, 0, t, 0.35);
    const nextIsDrop = FORM[(bar + 1) % BARS] === 'd' && sec !== 'd';
    if (nextIsDrop && s === 8) this.roll(t);
    if (s === 0 && bar === BARS - 1) this.hyoshigi(2, BEAT, t + BEAT * 2, 0.8);
  }

  // ---------- instruments ----------
  kick(t, v = 1) { const C = this.ctx; const o = C.createOscillator(); o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.09); const g = C.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(1.0 * v, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.32); o.connect(g).connect(this.bDrum); o.start(t); o.stop(t + 0.35);
    const c = C.createBufferSource(); c.buffer = this._noise(0.02); const hp = C.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500; const cg = C.createGain(); cg.gain.setValueAtTime(0.25 * v, t); cg.gain.exponentialRampToValueAtTime(0.0005, t + 0.015); c.connect(hp).connect(cg).connect(this.bDrum); c.start(t); }
  snare(t, v = 1, ghost = false) { const C = this.ctx; const s = C.createBufferSource(); s.buffer = this._noise(0.3); const bp = C.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = ghost ? 2400 : 1800; bp.Q.value = 0.7; const g = C.createGain(); g.gain.setValueAtTime(0.9 * v, t); g.gain.exponentialRampToValueAtTime(0.0005, t + (ghost ? 0.08 : 0.17)); s.connect(bp).connect(g).connect(this.bDrum); s.start(t);
    if (!ghost) { const o = C.createOscillator(); o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(160, t + 0.05); const og = C.createGain(); og.gain.setValueAtTime(0.5 * v, t); og.gain.exponentialRampToValueAtTime(0.0005, t + 0.09); o.connect(og).connect(this.bDrum); o.start(t); o.stop(t + 0.1); } }
  hat(t, v = 0.4, open = false) { const C = this.ctx; const s = C.createBufferSource(); s.buffer = this._noise(open ? 0.3 : 0.06); const hp = C.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7500; const g = C.createGain(); g.gain.setValueAtTime(0.5 * v, t); g.gain.exponentialRampToValueAtTime(0.0005, t + (open ? 0.22 : 0.035)); s.connect(hp).connect(g).connect(this.bDrum); s.start(t); }
  bass(f, t, len, v = 1) { const C = this.ctx; const o = C.createOscillator(); o.frequency.setValueAtTime(f * 1.02, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.04); const o2 = C.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = f; const lp = C.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 180; const g = C.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.7 * v, t + 0.01); g.gain.setValueAtTime(0.7 * v, t + len - 0.03); g.gain.exponentialRampToValueAtTime(0.0005, t + len + 0.03); const g2 = C.createGain(); g2.gain.value = 0.12; o.connect(g); o2.connect(lp).connect(g2).connect(g); g.connect(this.bBass); o.start(t); o2.start(t); o.stop(t + len + 0.1); o2.stop(t + len + 0.1); }
  rhodes(notes, t, len, v = 0.5) {
    const C = this.ctx;
    for (const n of notes) {
      const f = F(n); const out = C.createGain(); out.gain.setValueAtTime(0.0001, t); out.gain.linearRampToValueAtTime(0.22 * v, t + 0.006); out.gain.setValueAtTime(0.22 * v, t + 0.05); out.gain.exponentialRampToValueAtTime(0.0005, t + len);
      const lp = C.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600; lp.connect(out);
      const pan = C.createStereoPanner(); pan.pan.value = ((n % 5) / 4 - 0.5) * 0.7; out.connect(pan).connect(this.bKeys);
      // DX-style: a carrier, a quiet octave, and a tine that dies fast
      const c = C.createOscillator(); c.frequency.value = f; const cg = C.createGain(); cg.gain.value = 1; c.connect(cg).connect(lp); c.start(t); c.stop(t + len + 0.05);
      const m = C.createOscillator(); m.frequency.value = f * 2; const mg = C.createGain(); mg.gain.setValueAtTime(0.35, t); mg.gain.exponentialRampToValueAtTime(0.02, t + 0.6); m.connect(mg).connect(lp); m.start(t); m.stop(t + len + 0.05);
      const tine = C.createOscillator(); tine.frequency.value = f * 7; const tg = C.createGain(); tg.gain.setValueAtTime(0.12, t); tg.gain.exponentialRampToValueAtTime(0.001, t + 0.08); tine.connect(tg).connect(lp); tine.start(t); tine.stop(t + 0.1);
    }
  }
  _kotoBuffer(f) {
    // Karplus-Strong computed sample by sample (a DelayNode in a cycle cannot go below one render quantum, so it is done here)
    this._kcache = this._kcache || {}; const key = Math.round(f);
    if (this._kcache[key]) return this._kcache[key];
    const C = this.ctx, SR = C.sampleRate, N = Math.max(2, Math.round(SR / f)), len = Math.floor(SR * 2.2);
    const b = C.createBuffer(1, len, SR), d = b.getChannelData(0); const ring = new Float32Array(N);
    for (let i = 0; i < N; i++) ring[i] = (Math.random() * 2 - 1) * (i < N * 0.3 ? 1 : 0.6);   // a pick near the bridge
    let last = 0, idx = 0; const decay = 0.996 - f / 60000;
    for (let i = 0; i < len; i++) { const cur = ring[idx]; const nxt = ring[(idx + 1) % N]; const v = decay * 0.5 * (cur + nxt); ring[idx] = v; d[i] = cur; idx = (idx + 1) % N; }
    this._kcache[key] = b; return b;
  }
  koto(f, t, len, v = 0.6) {
    const C = this.ctx; const src = C.createBufferSource(); src.buffer = this._kotoBuffer(f);
    const lp = C.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(3200, t); lp.frequency.exponentialRampToValueAtTime(1100, t + 0.9);
    const body = C.createBiquadFilter(); body.type = 'peaking'; body.frequency.value = 480; body.gain.value = 2.5;
    const g = C.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.9 * v, t + 0.003); g.gain.setValueAtTime(0.9 * v, t + Math.max(0.15, len)); g.gain.exponentialRampToValueAtTime(0.001, t + Math.max(0.15, len) + 0.7);
    const pan = C.createStereoPanner(); pan.pan.value = (Math.log2(f / 440) - 0.8) * 0.4;
    src.connect(lp).connect(body).connect(g).connect(pan); pan.connect(this.bKoto); pan.connect(this.echo);
    src.start(t); src.stop(t + Math.max(0.15, len) + 0.8);
  }
  pad(notes, t, len) {
    const C = this.ctx;
    for (const n of notes.slice(0, 4)) { const f = F(n - 12); const g = C.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.9); g.gain.setValueAtTime(0.05, t + len * 0.75); g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.6); const lp = C.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100; lp.Q.value = 0.5;
      for (const c of [-6, 0, 6]) { const o = C.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = c; o.connect(lp); o.start(t); o.stop(t + len + 1); }
      const pan = C.createStereoPanner(); pan.pan.value = ((n % 7) / 6 - 0.5) * 0.9; lp.connect(g).connect(pan).connect(this.bPad); }
  }
  hyoshigi(count = 2, gap = 0.35, t0, v = 1) {
    if (!this.ctx) return; const C = this.ctx; t0 = t0 || C.currentTime + 0.02;
    for (let i = 0; i < count; i++) { const t = t0 + i * gap;
      const hit = (f, g, d) => { const o = C.createOscillator(); o.frequency.value = f; const gg = C.createGain(); gg.gain.setValueAtTime(g * v, t); gg.gain.exponentialRampToValueAtTime(0.0005, t + d); o.connect(gg).connect(this.bWood); o.start(t); o.stop(t + d + 0.02); };
      hit(2140, 0.5, 0.07); hit(3290, 0.26, 0.05); hit(4720, 0.12, 0.03); hit(520, 0.26, 0.09);
      const s = C.createBufferSource(); s.buffer = this._noise(0.04); const f = C.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2900; f.Q.value = 1.5; const g = C.createGain(); g.gain.setValueAtTime(0.45 * v, t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.03); s.connect(f).connect(g).connect(this.bWood); s.start(t); }
  }
  roll(t0) { let t = t0, gap = S16 * 2; for (let i = 0; i < 10; i++) { this.hyoshigi(1, 0, t, 0.35 + i * 0.05); t += gap; gap = Math.max(S16 * 0.5, gap * 0.82); } }
  taiko(t, v = 0.7) { if (!this.ctx) return; const C = this.ctx; t = t || C.currentTime + 0.02; const o = C.createOscillator(); o.frequency.setValueAtTime(118, t); o.frequency.exponentialRampToValueAtTime(52, t + 0.09); const g = C.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.9 * v, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0005, t + 1.0); o.connect(g).connect(this.bDrum); o.start(t); o.stop(t + 1.1); }
}
export const TEMPO = { BPM, BEAT, BAR, BARS };
