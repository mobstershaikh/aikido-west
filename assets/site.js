/* Aikido West v5: smooth scroll, a slow drift on the full-bleed photographs, and nothing else. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!reduce && window.Lenis) {
    var lenis = new Lenis({ lerp: 0.08, wheelMultiplier: 0.9, smoothWheel: true });
    function raf(time) { lenis.raf(time); requestAnimationFrame(raf); }
    requestAnimationFrame(raf);
    window.__lenis = lenis;
    if (window.gsap && window.ScrollTrigger) lenis.on('scroll', ScrollTrigger.update);
  }

  if (!reduce && window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
    document.querySelectorAll('.para').forEach(function (frame) {
      var img = frame.querySelector('img');
      if (!img) return;
      gsap.fromTo(img, { yPercent: -6 }, { yPercent: 6, ease: 'none', scrollTrigger: { trigger: frame, start: 'top bottom', end: 'bottom top', scrub: 0.6 } });
    });
  }

  var here = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav .links a').forEach(function (a) {
    if (a.getAttribute('href') === here) a.classList.add('on');
  });
})();
