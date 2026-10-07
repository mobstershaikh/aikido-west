/* Aikido West, the dream edition. A composed score, built in the browser and owned outright.
   Sixty beats a minute, forty-eight bars, three minutes twelve, then round again.
   A string bed that breathes, a temple bell, soft keys carrying one tune in D major pentatonic,
   and the wooden clappers of the theatre as pulse and punctuation. Tuned to A = 432 Hz. */
const A4 = 432;
const F = n => A4 * Math.pow(2, (n - 69) / 12);

// the tune, as [midi, beat, length] per bar
const THEME = [
  [[62, 0, 1], [66, 1, 1], [69, 2, 2]], [[71, 0, 1], [69, 1, 1], [66, 2, 2]], [[64, 0, 1], [66, 1, 1], [69, 2, 1], [74, 3, 1]], [[71, 0, 2], [69, 2, 2]],
  [[62, 0, 1], [66, 1, 1], [69, 2, 2]], [[71, 0, 1], [74, 1, 1], [71, 2, 2]], [[69, 0, 1], [66, 1, 1], [64, 2, 1], [66, 3, 1]], [[62, 0, 4]],
  [[62, 0, 1], [66, 1, 1], [69, 2, 2]], [[71, 0, 1], [69, 1, 1], [66, 2, 2]], [[64, 0, 1], [66, 1, 1], [69, 2, 1], [76, 3, 1]], [[74, 0, 2], [71, 2, 2]],
  [[69, 0, 1], [71, 1, 1], [74, 2, 2]], [[76, 0, 1], [74, 1, 1], [71, 2, 2]], [[69, 0, 1], [66, 1, 1], [64, 2, 1], [66, 3, 1]], [[62, 0, 4]],
];
const CHORDS = { D: [38, 45, 50, 54], Bm: [35, 42, 47, 50], G: [31, 38, 43, 47], A: [33, 40, 45, 49] };
const PROG = ['D', 'D', 'Bm', 'Bm', 'G', 'G', 'A', 'A'];   // two bars each, over sixteen bars

export class Score {
  constructor() { this.ctx = null; this.on = false; this.events = []; this.loopLen = 192; this.loopStart = 0; this.idx = 0; this._timer = null; this.pad = null; }

  // ---------- graph ----------
  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); this.setOn(true); return; }
    const C = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = C.createGain(); this.master.gain.value = 0;
    const comp = C.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3; comp.attack.value = 0.02; comp.release.value = 0.3;
    this.master.connect(comp).connect(C.destination);
    this.reverb = C.createConvolver(); this.reverb.buffer = this._hall(3.4, 2.4); const rv = C.createGain(); rv.gain.value = 0.8; this.reverb.connect(rv).connect(this.master);
    const bus = name => { const g = C.createGain(); g.connect(this.master); const w = C.createGain(); g.connect(w).connect(this.reverb); return { g, w }; };
    this.bBed = bus(); this.bBed.g.gain.value = 0.75; this.bBed.w.gain.value = 0.5;
    this.bKeys = bus(); this.bKeys.g.gain.value = 1.7; this.bKeys.w.gain.value = 0.55;
    this.bBell = bus(); this.bBell.g.gain.value = 1.3; this.bBell.w.gain.value = 0.6;
    this.bWood = bus(); this.bWood.g.gain.value = 1.25; this.bWood.w.gain.value = 0.42;
    this.bDrum = bus(); this.bDrum.g.gain.value = 0.9; this.bDrum.w.gain.value = 0.3;
    this._compose(); this.loopStart = C.currentTime + 0.2; this.idx = 0;
    this._schedule(); this.setOn(true);
    document.addEventListener('visibilitychange', () => { if (!this.ctx) return; const t = this.ctx.currentTime; this.master.gain.cancelScheduledValues(t); this.master.gain.setTargetAtTime(document.hidden ? 0 : (this.on ? 0.8 : 0), t, 0.25); });
  }
  setOn(v) { this.on = v; if (!this.ctx) return; const t = this.ctx.currentTime; this.master.gain.cancelScheduledValues(t); this.master.gain.setTargetAtTime(v ? 0.8 : 0, t, v ? 1.0 : 0.4); }
  toggle() { if (!this.ctx) { this.start(); return true; } this.setOn(!this.on); return this.on; }

  _hall(seconds, decay) {
    const C = this.ctx, n = Math.floor(C.sampleRate * seconds), b = C.createBuffer(2, n, C.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) { const t = i / n; let v = (Math.random() * 2 - 1) * Math.pow(1 - t, decay); if (i % 2203 < 2 || i % 3511 < 2 || i % 4733 < 2) v += (Math.random() * 2 - 1) * 0.25 * Math.pow(1 - t, 1.2); d[i] = v; } }
    return b;
  }
  _noise(seconds) { const C = this.ctx, n = Math.floor(C.sampleRate * seconds), b = C.createBuffer(1, n, C.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; return b; }

  // ---------- the composition, as a list of events on a 192 second loop ----------
  _compose() {
    const ev = []; const bar = b => (b - 1) * 4;   // seconds from loop start, 60 bpm
    // bells
    for (const b of [1, 25, 41]) ev.push({ t: bar(b), f: 'bell' });
    // clappers: the opening, the pulse of the tune, the roll before the return, the close
    ev.push({ t: bar(1), f: 'chon' });
    for (let b = 9; b <= 24; b++) ev.push({ t: bar(b), f: 'tick', v: b % 4 === 1 ? 0.45 : 0.28 });
    for (let b = 33; b <= 48; b++) ev.push({ t: bar(b), f: 'tick', v: b % 4 === 1 ? 0.4 : 0.24 });
    ev.push({ t: bar(32), f: 'roll' }); ev.push({ t: bar(33), f: 'chon' }); ev.push({ t: bar(33), f: 'taiko', v: 0.7 });
    ev.push({ t: bar(48) + 2, f: 'chon' });
    // the bed: D through the first eight, then the progression, twice
    const chord = (name, b0, bars) => ev.push({ t: bar(b0), f: 'chord', name, len: bars * 4 });
    chord('D', 1, 8);
    for (let k = 0; k < 8; k++) chord(PROG[k], 9 + k * 2, 2);
    chord('D', 25, 4); chord('G', 29, 2); chord('A', 31, 2);
    for (let k = 0; k < 8; k++) chord(PROG[k], 33 + k * 2, 2);
    // the tune: bars 9 to 24, then an octave up and softer, bars 33 to 48
    THEME.forEach((barNotes, i) => { for (const [n, s, l] of barNotes) { ev.push({ t: bar(9 + i) + s, f: 'key', n, l, v: 0.5 }); ev.push({ t: bar(33 + i) + s, f: 'key', n: n + 12, l, v: 0.3 }); if (i % 4 === 3 && s === 0) ev.push({ t: bar(33 + i) + s, f: 'key', n: n - 12, l: l + 1, v: 0.22 }); } });
    ev.sort((a, b) => a.t - b.t); this.events = ev;
  }
  _schedule() {
    const C = this.ctx; const ahead = 0.4;
    while (true) {
      if (this.idx >= this.events.length) { this.idx = 0; this.loopStart += this.loopLen; }
      const e = this.events[this.idx]; const when = this.loopStart + e.t;
      if (when > C.currentTime + ahead) break;
      if (when >= C.currentTime - 0.05) this._play(e, when);
      this.idx++;
    }
    this._timer = setTimeout(() => this._schedule(), 120);
  }
  _play(e, t) {
    switch (e.f) {
      case 'bell': return this.bell(t);
      case 'chon': return this.hyoshigi(2, 0.6, t);
      case 'tick': return this.hyoshigi(1, 0, t, e.v);
      case 'roll': return this.roll(t);
      case 'taiko': return this.taiko(t, e.v);
      case 'chord': return this.chord(CHORDS[e.name], t, e.len);
      case 'key': return this.key(F(e.n), t, e.l, e.v);
    }
  }

  // ---------- instruments ----------
  chord(notes, t, len) {
    const C = this.ctx;
    for (const n of notes) {
      const f = F(n); const g = C.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.028, t + 3.2); g.gain.setValueAtTime(0.028, t + len - 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + len + 3.5);
      const lp = C.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1250 + (n - 31) * 18; lp.Q.value = 0.6;
      const lfo = C.createOscillator(); lfo.frequency.value = 0.07; const lg = C.createGain(); lg.gain.value = 220; lfo.connect(lg).connect(lp.frequency); lfo.start(t); lfo.stop(t + len + 4);
      for (const c of [-7, 0, 7]) { const o = C.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = c; o.connect(lp); o.start(t); o.stop(t + len + 4); }
      // a gentle chorus
      const d1 = C.createDelay(0.05); d1.delayTime.value = 0.016; const m1 = C.createOscillator(); m1.frequency.value = 0.31; const mg = C.createGain(); mg.gain.value = 0.0016; m1.connect(mg).connect(d1.delayTime); m1.start(t); m1.stop(t + len + 4);
      const pan = C.createStereoPanner(); pan.pan.value = ((n % 7) / 7 - 0.5) * 0.8;
      lp.connect(g); g.connect(pan); g.connect(d1).connect(pan); pan.connect(this.bBed.g);
    }
  }
  key(f, t, beats, v = 0.5) {
    const C = this.ctx, out = C.createGain(); out.connect(this.bKeys.g);
    const pan = C.createStereoPanner(); pan.pan.value = (Math.log2(f / 261) - 0.5) * 0.5; pan.connect(out);
    const part = (ratio, amp, dec) => { const o = C.createOscillator(); o.frequency.value = f * ratio; const g = C.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(amp * v, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dec); o.connect(g).connect(pan); o.start(t); o.stop(t + dec + 0.05); };
    part(1, 0.42, 1.6 + beats * 0.5); part(2, 0.16, 1.0); part(3, 0.06, 0.6); part(4.01, 0.03, 0.35); part(5.02, 0.012, 0.25);
    // the felt: a touch of tone on the attack
    const o = C.createOscillator(); o.frequency.value = f * 7; const g = C.createGain(); g.gain.setValueAtTime(0.03 * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05); o.connect(g).connect(pan); o.start(t); o.stop(t + 0.08);
  }
  bell(t, f = 108) {
    const C = this.ctx, out = C.createGain(); out.gain.value = 0.5; out.connect(this.bBell.g);
    const parts = [[0.5, 0.5, 9], [0.5035, 0.4, 9], [1, 1.0, 8], [1.19, 0.45, 6], [1.52, 0.3, 5], [2.0, 0.55, 5], [2.47, 0.18, 3.5], [3.0, 0.22, 3], [4.1, 0.1, 2]];
    for (const [r, a, d] of parts) { const o = C.createOscillator(); o.frequency.value = f * r; const g = C.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(a * 0.16, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g).connect(out); o.start(t); o.stop(t + d + 0.1); }
    const s = C.createBufferSource(); s.buffer = this._noise(0.04); const bp = C.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1600; bp.Q.value = 1.2; const g = C.createGain(); g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.035); s.connect(bp).connect(g).connect(out); s.start(t);
  }
  hyoshigi(count = 2, gap = 0.6, t0, v = 1) {
    if (!this.ctx) return; const C = this.ctx; t0 = t0 || C.currentTime + 0.03;
    for (let i = 0; i < count; i++) {
      const t = t0 + i * gap;
      const hit = (f, g, d) => { const o = C.createOscillator(); o.frequency.value = f; const gg = C.createGain(); gg.gain.setValueAtTime(g * v, t); gg.gain.exponentialRampToValueAtTime(0.0005, t + d); o.connect(gg).connect(this.bWood.g); o.start(t); o.stop(t + d + 0.02); };
      hit(2140, 0.5, 0.07); hit(3290, 0.26, 0.05); hit(4720, 0.12, 0.03); hit(520, 0.26, 0.09);
      const s = C.createBufferSource(); s.buffer = this._noise(0.04); const f = C.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2900; f.Q.value = 1.5;
      const g = C.createGain(); g.gain.setValueAtTime(0.45 * v, t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.03); s.connect(f).connect(g).connect(this.bWood.g); s.start(t);
    }
  }
  roll(t0) { let t = t0, gap = 0.62; for (let i = 0; i < 13; i++) { this.hyoshigi(1, 0, t, 0.5 + i * 0.04); t += gap; gap = Math.max(0.075, gap * 0.8); } }
  taiko(t, v = 0.7) {
    if (!this.ctx) return; const C = this.ctx; t = t || C.currentTime + 0.02;
    const o = C.createOscillator(); o.frequency.setValueAtTime(118, t); o.frequency.exponentialRampToValueAtTime(52, t + 0.09); const g = C.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.9 * v, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0005, t + 1.1); o.connect(g).connect(this.bDrum.g); o.start(t); o.stop(t + 1.2);
    const s = C.createBufferSource(); s.buffer = this._noise(0.2); const lp = C.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; const ng = C.createGain(); ng.gain.setValueAtTime(0.5 * v, t); ng.gain.exponentialRampToValueAtTime(0.0005, t + 0.14); s.connect(lp).connect(ng).connect(this.bDrum.g); s.start(t);
  }
}
