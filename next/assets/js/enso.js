/* The ensō: one circle, one breath. Drawn with a brush model on a 2D canvas: a wet landing, a full body,
   a drying tail that breaks into bristle streaks (kasure), and an opening left where the brush lifts. */
export function prepareEnso(canvas, opts = {}) {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const W = canvas.clientWidth, H = canvas.clientHeight;
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
  const cx = W * (opts.cx || 0.5), cy = H * (opts.cy || 0.5), R = Math.min(W, H) * (opts.radius || 0.36);
  const ink = opts.ink || '20,19,17';
  // a fixed random stream so the stroke is the same stroke every time
  let seed = opts.seed || 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const N = 1400; const pts = [];
  const a0 = (opts.start || 195) * Math.PI / 180, span = (opts.span || 338) * Math.PI / 180;
  const wob = [rnd() * 6.28, rnd() * 6.28, rnd() * 6.28];
  for (let i = 0; i <= N; i++) {
    const t = i / N, a = a0 + span * t;
    const r = R * (1 + 0.014 * Math.sin(3 * a + wob[0]) + 0.009 * Math.sin(7 * a + wob[1]) + 0.004 * Math.sin(13 * a + wob[2]) - 0.03 * t);
    const body = Math.pow(Math.sin(Math.PI * Math.pow(t, 0.85)), 0.6);
    const head = t < 0.07 ? (1 - t / 0.07) * 0.35 : 0;      // the landing of the brush
    const w = R * 0.2 * (0.3 + 0.7 * body + head);
    const dry = Math.max(0, (t - 0.58) / 0.42);                // the tail dries out
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, a, w, dry, t });
  }
  // bristles: fixed offsets and strengths across the brush width
  const B = 22; const bristles = [];
  for (let k = 0; k < B; k++) bristles.push({ o: (k / (B - 1) - 0.5) * 2, s: 0.35 + rnd() * 0.65, gap: rnd() });
  let drawn = 0;
  function stamp(p) {
    const nx = Math.cos(p.a), ny = Math.sin(p.a);             // radial normal
    const wet = 1 - p.dry;
    // the body: a soft disc, fading as the brush dries
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.w * 0.55);
    g.addColorStop(0, `rgba(${ink},${0.14 * (0.55 + 0.45 * wet)})`); g.addColorStop(1, `rgba(${ink},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.w * 0.55, 0, 6.2832); ctx.fill();
    // the bristles
    for (const b of bristles) {
      if (p.dry > 0 && b.gap < p.dry * 0.95 * (0.5 + 0.5 * Math.abs(b.o))) continue;   // streaks open at the edges first
      const r = Math.max(0.35, p.w * 0.085 * b.s * (1 - 0.35 * p.dry));
      const al = 0.08 * b.s * (1 - 0.5 * p.dry) * (1 - 0.35 * Math.abs(b.o));
      ctx.fillStyle = `rgba(${ink},${al})`;
      ctx.beginPath(); ctx.arc(p.x + nx * b.o * p.w * 0.5, p.y + ny * b.o * p.w * 0.5, r, 0, 6.2832); ctx.fill();
    }
  }
  return {
    reset() { ctx.clearRect(0, 0, W, H); drawn = 0; },
    // draw up to progress u in [0,1]
    to(u) { const n = Math.min(N, Math.floor(u * N)); for (let i = drawn; i <= n; i++) stamp(pts[i]); drawn = Math.max(drawn, n + 1); },
    bleed() { ctx.save(); ctx.globalAlpha = 0.22; ctx.filter = 'blur(2.2px)'; ctx.drawImage(canvas, 0, 0, W, H); ctx.restore(); },
    centre: { x: cx, y: cy, r: R },
  };
}

export function animateEnso(e, seconds = 1.9, onDone) {
  const t0 = performance.now(); e.reset();
  const ease = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  const tick = now => { const k = Math.min(1, (now - t0) / (seconds * 1000)); e.to(ease(k)); if (k < 1) requestAnimationFrame(tick); else { e.bleed(); onDone && onDone(); } };
  requestAnimationFrame(tick);
}
