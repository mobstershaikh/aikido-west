/* Aikido West, the frontier edition. Sound, built in the browser from first principles.
   Nothing is sampled, nothing is licensed, nothing plays until the visitor chooses.
   A low drone with an overtone voice, a plucked string in the in-scale, a soft half-time break
   that joins when the story reaches London, two wooden clappers at the door, one blade. */
export class Sound {
  constructor() { this.ctx = null; this.on = false; this.stage = 'kumano'; this._beat = null; this._phrase = null; }

  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); this.setOn(true); return; }
    const C = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = C.createGain(); this.master.gain.value = 0;
    this.comp = C.createDynamicsCompressor(); this.comp.threshold.value = -18; this.comp.ratio.value = 3; this.comp.attack.value = 0.01; this.comp.release.value = 0.25;
    this.master.connect(this.comp).connect(C.destination);
    this.reverb = C.createConvolver(); this.reverb.buffer = this._impulse(3.2, 2.6);
    this.rvGain = C.createGain(); this.rvGain.gain.value = 0.9;
    this.reverb.connect(this.rvGain).connect(this.master);
    this.busMusic = C.createGain(); this.busMusic.gain.value = 0; this.busMusic.connect(this.master);
    this.busMusicWet = C.createGain(); this.busMusicWet.gain.value = 0.35; this.busMusic.connect(this.busMusicWet).connect(this.reverb);
    this.busFx = C.createGain(); this.busFx.gain.value = 1; this.busFx.connect(this.master);
    this.busFxWet = C.createGain(); this.busFxWet.gain.value = 0.45; this.busFx.connect(this.busFxWet).connect(this.reverb);
    this._drone(); this._stringLoop(); this._beatLoop();
    this.setOn(true);
    document.addEventListener('visibilitychange', () => { if (!this.ctx) return; const g = this.master.gain; g.cancelScheduledValues(this.ctx.currentTime); g.setTargetAtTime(document.hidden ? 0 : (this.on ? 1 : 0), this.ctx.currentTime, 0.2); });
  }
  setOn(v) {
    this.on = v; if (!this.ctx) return; const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t); this.master.gain.setTargetAtTime(v ? 1 : 0, t, v ? 1.2 : 0.4);
    if (v) { this.busMusic.gain.cancelScheduledValues(t); this.busMusic.gain.setTargetAtTime(0.9, t + 0.8, 2.5); }
  }
  toggle() { if (!this.ctx) { this.start(); this.hyoshigi(); return true; } this.setOn(!this.on); return this.on; }
  setStage(s) { this.stage = s; }

  // ---------- impulse response: a hall, synthesised ----------
  _impulse(seconds, decay) {
    const C = this.ctx, n = Math.floor(C.sampleRate * seconds), b = C.createBuffer(2, n, C.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < n; i++) {
        const t = i / n; let v = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
        // a few early reflections
        if (i % 2203 < 2 || i % 3511 < 2 || i % 4733 < 2) v += (Math.random() * 2 - 1) * 0.3 * Math.pow(1 - t, 1.2);
        d[i] = v;
      }
    }
    return b;
  }
  _noise(seconds) {
    const C = this.ctx, n = Math.floor(C.sampleRate * seconds), b = C.createBuffer(1, n, C.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  // ---------- the drone and the overtone voice ----------
  _drone() {
    const C = this.ctx, out = C.createGain(); out.gain.value = 0.16; out.connect(this.busMusic);
    const hp = C.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 32; hp.connect(out);
    const mk = (type, f, g) => { const o = C.createOscillator(); o.type = type; o.frequency.value = f; const gg = C.createGain(); gg.gain.value = g; o.connect(gg); o.start(); return { o, g: gg }; };
    const a = mk('sine', 55, 0.5), b = mk('sine', 55.4, 0.42), c = mk('sine', 110, 0.16);
    a.g.connect(hp); b.g.connect(hp); c.g.connect(hp);
    // a filtered saw that breathes
    const saw = mk('sawtooth', 110, 0.07); const lp = C.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 2.2; lp.frequency.value = 220;
    saw.g.connect(lp).connect(hp);
    const lfo = C.createOscillator(); lfo.frequency.value = 0.045; const lg = C.createGain(); lg.gain.value = 120; lfo.connect(lg).connect(lp.frequency); lfo.start();
    // the overtone voice: a low square through a sweeping formant, the way a throat singer carves a whistle out of a drone
    const voice = mk('square', 73.42, 0.05); const bp = C.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 9; bp.frequency.value = 900;
    const bp2 = C.createBiquadFilter(); bp2.type = 'bandpass'; bp2.Q.value = 6; bp2.frequency.value = 1500;
    voice.g.connect(bp).connect(hp); voice.g.connect(bp2).connect(hp);
    const l2 = C.createOscillator(); l2.frequency.value = 0.023; const g2 = C.createGain(); g2.gain.value = 420; l2.connect(g2); g2.connect(bp.frequency); l2.start();
    const l3 = C.createOscillator(); l3.frequency.value = 0.031; const g3 = C.createGain(); g3.gain.value = 600; l3.connect(g3); g3.connect(bp2.frequency); l3.start();
    // slow swell on the voice so it comes and goes
    const l4 = C.createOscillator(); l4.frequency.value = 0.011; const g4 = C.createGain(); g4.gain.value = 0.03; l4.connect(g4); g4.connect(voice.g.gain); l4.start();
  }

  // ---------- the string: Karplus-Strong in the graph ----------
  _pluck(freq, vel = 0.6, bright = 3200, when = 0) {
    const C = this.ctx, t = when || C.currentTime;
    const src = C.createBufferSource(); src.buffer = this._noise(0.03);
    const burst = C.createGain(); burst.gain.setValueAtTime(vel, t); burst.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
    const delay = C.createDelay(0.05); delay.delayTime.value = 1 / freq;
    const lp = C.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = bright; lp.Q.value = 0.2;
    const fb = C.createGain(); fb.gain.value = 0.9905 - (freq / 8000);
    src.connect(burst).connect(delay); delay.connect(lp).connect(fb).connect(delay);
    // body: a soft resonance, a little sawari buzz from a gentle waveshaper
    const body = C.createBiquadFilter(); body.type = 'peaking'; body.frequency.value = 320; body.gain.value = 4; body.Q.value = 1.1;
    const shaper = C.createWaveShaper(); const curve = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 127.5 - 1; curve[i] = Math.tanh(x * 1.6) / Math.tanh(1.6); } shaper.curve = curve;
    const out = C.createGain(); out.gain.setValueAtTime(0.9, t); out.gain.setValueAtTime(0.9, t + 2.4); out.gain.exponentialRampToValueAtTime(0.001, t + 4.2);
    const pan = C.createStereoPanner(); pan.pan.value = (Math.random() - 0.5) * 0.6;
    lp.connect(body).connect(shaper).connect(out).connect(pan).connect(this.busMusic);
    src.start(t); src.stop(t + 0.05);
    setTimeout(() => { try { out.disconnect(); fb.disconnect(); delay.disconnect(); lp.disconnect(); } catch (e) {} }, (t - C.currentTime + 4.6) * 1000);
  }
  _stringLoop() {
    // miyako-bushi on D: D Eb G A Bb, two octaves
    const scale = [146.83, 155.56, 196.0, 220.0, 233.08, 293.66, 311.13, 392.0, 440.0];
    let idx = 2;
    const phrase = () => {
      if (!this.ctx) return;
      const n = 2 + Math.floor(Math.random() * 4); let t = this.ctx.currentTime + 0.05;
      for (let i = 0; i < n; i++) {
        const step = Math.random() < 0.7 ? (Math.random() < 0.5 ? -1 : 1) : (Math.random() < 0.5 ? -2 : 3);
        idx = Math.max(0, Math.min(scale.length - 1, idx + step));
        const vel = 0.35 + Math.random() * 0.4, bright = 2200 + Math.random() * 2600;
        this._pluck(scale[idx], this.on ? vel : 0.0001, bright, t);
        if (Math.random() < 0.25) this._pluck(scale[idx] * 2, vel * 0.3, bright, t + 0.09); // an octave shimmer
        t += 0.8 + Math.random() * 1.7;
      }
      this._phrase = setTimeout(phrase, (t - this.ctx.currentTime) * 1000 + 3500 + Math.random() * 6000);
    };
    this._phrase = setTimeout(phrase, 2200);
  }

  // ---------- the break: half-time, dusted, far back ----------
  _beatLoop() {
    const C = this.ctx; const bus = C.createGain(); bus.gain.value = 0; this.beatBus = bus;
    const lp = C.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6200; bus.connect(lp).connect(this.busMusic);
    const bpm = 170, beat = 60 / bpm, bar = beat * 4; let next = C.currentTime + 0.5; let barNo = 0;
    const kick = (t, v) => { const o = C.createOscillator(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12); const g = C.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.38); o.connect(g).connect(bus); o.start(t); o.stop(t + 0.4); };
    const snare = (t, v) => { const s = C.createBufferSource(); s.buffer = this._noise(0.25); const f = C.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 0.8; const g = C.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18); s.connect(f).connect(g).connect(bus); const o = C.createOscillator(); o.frequency.value = 190; const g2 = C.createGain(); g2.gain.setValueAtTime(v * 0.5, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.12); o.connect(g2).connect(bus); s.start(t); o.start(t); o.stop(t + 0.15); };
    const hat = (t, v) => { const s = C.createBufferSource(); s.buffer = this._noise(0.05); const f = C.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000; const g = C.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.035); s.connect(f).connect(g).connect(bus); s.start(t); };
    const schedule = () => {
      if (!this.ctx) return;
      while (next < C.currentTime + 0.3) {
        const t = next; barNo++;
        kick(t, 0.5); snare(t + 2 * beat, 0.32);
        if (barNo % 4 === 0) kick(t + 2.5 * beat, 0.25);
        if (barNo % 2 === 1 && Math.random() < 0.5) snare(t + 3.75 * beat, 0.08);
        for (let i = 0; i < 8; i++) hat(t + i * beat * 0.5 + (i % 2 ? 0.012 : 0), i % 2 ? 0.045 : 0.09);
        next += bar;
      }
      this._beat = setTimeout(schedule, 110);
    };
    schedule();
  }
  beat(on) { if (!this.ctx) return; const t = this.ctx.currentTime; this.beatBus.gain.cancelScheduledValues(t); this.beatBus.gain.setTargetAtTime(on ? 0.5 : 0, t, on ? 3.0 : 1.2); }

  // ---------- hyoshigi: two blocks of hardwood ----------
  hyoshigi(count = 2, gap = 0.62) {
    if (!this.ctx) return; const C = this.ctx; const t0 = C.currentTime + 0.05;
    for (let i = 0; i < count; i++) {
      const t = t0 + i * gap;
      const hit = (f, g, d) => { const o = C.createOscillator(); o.frequency.value = f; const gg = C.createGain(); gg.gain.setValueAtTime(g, t); gg.gain.exponentialRampToValueAtTime(0.0005, t + d); o.connect(gg).connect(this.busFx); o.start(t); o.stop(t + d + 0.02); };
      hit(2140, 0.55, 0.07); hit(3290, 0.3, 0.05); hit(4720, 0.14, 0.03); hit(520, 0.28, 0.09);
      const s = C.createBufferSource(); s.buffer = this._noise(0.04); const f = C.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2900; f.Q.value = 1.5;
      const g = C.createGain(); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.03); s.connect(f).connect(g).connect(this.busFx); s.start(t);
    }
  }

  // ---------- the blade ----------
  swish() {
    if (!this.ctx || !this.on) return; const C = this.ctx, t = C.currentTime + 0.01;
    const s = C.createBufferSource(); s.buffer = this._noise(0.5);
    const f = C.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.1; f.frequency.setValueAtTime(420, t); f.frequency.exponentialRampToValueAtTime(2600, t + 0.14); f.frequency.exponentialRampToValueAtTime(700, t + 0.34);
    const g = C.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.55, t + 0.11); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.36);
    const pan = C.createStereoPanner(); pan.pan.setValueAtTime(-0.6, t); pan.pan.linearRampToValueAtTime(0.6, t + 0.3);
    s.connect(f).connect(g).connect(pan).connect(this.busFx); s.start(t); s.stop(t + 0.5);
  }
}
