/* Page to page: a cross-document view transition where the browser has it, a short ink fade where it does not. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;
  var native = 'startViewTransition' in document && window.CSS && CSS.supports && CSS.supports('view-transition-name', 'root');
  document.documentElement.classList.add('nav-ready');
  if (native) return;
  var veil = document.createElement('div'); veil.className = 'pageveil'; document.body.appendChild(veil);
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]'); if (!a) return;
    var href = a.getAttribute('href');
    if (!href || href.charAt(0) === '#' || /^(mailto|tel|https?):/.test(href) || a.target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault(); veil.classList.add('on');
    setTimeout(function () { location.href = href; }, 260);
  });
  window.addEventListener('pageshow', function () { veil.classList.remove('on'); });
})();
