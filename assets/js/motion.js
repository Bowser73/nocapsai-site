// Scroll-in motion: blocks fade and rise into place the first time they
// enter the screen. Skipped entirely for visitors who ask for reduced motion,
// and content stays fully visible if this script never runs.
(function () {
  'use strict';
  if (!('IntersectionObserver' in window)) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var blocks = [
    '.np-band h2', '.np-band .np-eyebrow', '.np-band .np-lead', '.np-audience',
    '.np-also h3', '.np-case', '.np-disclaimer', '.np-band .cta-button',
    '.ai-integrations h3', '.ai-integrations .ai-sub', '.ai-logos',
    '.store-heading', '.store-featured .product-card', '.store-carousel', '.store-note',
    '.pricing-section > h2', '.pricing-section > .np-lead', '.pricing-section .pkg-carousel', '.np-custom',
    '.np-contact .np-inner'
  ];
  var staggered = ['.np-grid .np-card', '.np-steps .np-step'];   // cards rise one after another

  var items = [];
  document.querySelectorAll(blocks.join(',')).forEach(function (el) { items.push(el); });
  staggered.forEach(function (sel) {
    document.querySelectorAll(sel).forEach(function (el) {
      var i = Array.prototype.indexOf.call(el.parentNode.children, el);
      el.style.setProperty('--reveal-delay', Math.min(i, 7) * 70 + 'ms');
      items.push(el);
    });
  });

  var vh = window.innerHeight;
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });

  items.forEach(function (el) {
    if (el.closest('.hero')) return;
    // leave anything already on screen at load alone, so nothing flashes
    if (el.getBoundingClientRect().top < vh * 0.9) return;
    el.classList.add('reveal');
    io.observe(el);
  });
})();
