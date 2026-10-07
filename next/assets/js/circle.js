/* The circle, drawn in light: a long exposure. A bright head travels once round and leaves a glowing trail
   that keeps burning, with a small opening where it lifts. 2D canvas, additive, cheap enough for a phone. */
export function lightCircle(canvas, opts = {}) {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const W = canvas.clientWidth, H = canvas.clientHeight; canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
  const cx = W / 2, cy = H / 2, R = Math.min(W, H) * (opts.radius || 0.36);
  const a0 = -Math.PI * 0.62, span = Math.PI * 1.93;   // starts top-left, runs clockwise, leaves an opening
  let seed = 3; const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const wob = [rnd() * 6.3, rnd() * 6.3];
  const pt = u => { const a = a0 + span * u; const r = R * (1 + 0.012 * Math.sin(3 * a + wob[0]) + 0.006 * Math.sin(7 * a + wob[1])); return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, u }; };
  let drawn = 0; const N = 900;
  function seg(i) {
    const p = pt(i / N), q = pt((i + 1) / N), fade = Math.pow(Math.sin(Math.PI * Math.min(1, i / N)), 0.35);
    ctx.globalCompositeOperation = 'lighter';
    // wide soft glow, then the core
    for (const [w, a] of [[R * 0.16, 0.022], [R * 0.07, 0.05], [R * 0.022, 0.5]]) {
      ctx.strokeStyle = `rgba(255,255,255,${a * fade})`; ctx.lineWidth = w; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
    }
  }
  return {
    reset() { ctx.globalCompositeOperation = 'source-over'; ctx.clearRect(0, 0, W, H); drawn = 0; },
    to(u) { const n = Math.min(N - 1, Math.floor(u * N)); for (let i = drawn; i <= n; i++) seg(i); drawn = Math.max(drawn, n + 1); },
    head(u) { const p = pt(Math.min(1, u)); return p; },
    centre: { x: cx, y: cy, r: R }, size: { W, H },
  };
}
export function animateCircle(c, headEl, seconds = 2.4, onDone) {
  const t0 = performance.now(); c.reset();
  const ease = x => x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
  const tick = now => { const k = Math.min(1, (now - t0) / (seconds * 1000)); const u = ease(k); c.to(u); if (headEl) { const p = c.head(u); headEl.style.transform = `translate(${p.x}px, ${p.y}px)`; headEl.style.opacity = k < 1 ? 1 : 0; } if (k < 1) requestAnimationFrame(tick); else onDone && onDone(); };
  requestAnimationFrame(tick);
}
