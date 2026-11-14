// NoCapsAI signature effects (all pages).
// - scroll progress line
// - spotlight cards (light + lit edge follow the cursor)
// - focus-pull reveal (blur -> sharp as content scrolls in)
// - headline decode (h1 letters resolve from noise, once, on load)
// - magnetic primary buttons
// Decorative only. Skipped for prefers-reduced-motion and when motion is paused.
(function () {
  'use strict';
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canHover = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var body = document.body;
  var paused = function () { return reduced || body.classList.contains('motion-paused'); };

  // Footer year
  document.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });

  // Pause/Play motion button on inner pages (the homepage's own script handles its button)
  var toggle = document.querySelector('.motion-toggle');
  if (toggle && !body.classList.contains('sales-home')) {
    var set = function (p) {
      body.classList.toggle('motion-paused', p);
      toggle.setAttribute('aria-pressed', String(p));
      toggle.textContent = p ? 'Play motion' : 'Pause motion';
    };
    set(reduced);
    toggle.addEventListener('click', function () { set(!body.classList.contains('motion-paused')); });
  }

  if (reduced) return;

  // 1. Scroll progress
  var bar = document.createElement('div');
  bar.className = 'fx-progress';
  bar.setAttribute('aria-hidden', 'true');
  body.appendChild(bar);
  var ticking = false;
  var onScroll = function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.setProperty('--fx-p', max > 0 ? Math.min(1, window.scrollY / max).toFixed(4) : 0);
      ticking = false;
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // 2. Spotlight cards
  var cardSel = '.product-card,.service-card,.proof-card,.subscription-card,.grantflow-section,.contact-strip,' +
    '.pkg,.service-panel,.pain-card,.stack-card,.step,.compare-card,.price-card,.funnel,.cta-strip';
  if (canHover) {
    document.querySelectorAll(cardSel).forEach(function (card) {
      if (getComputedStyle(card).position === 'static') card.style.position = 'relative';
      card.classList.add('fx-spot');
      var g = document.createElement('span');
      g.className = 'fx-glow';
      g.setAttribute('aria-hidden', 'true');
      card.appendChild(g);
      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        card.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    });
  }

  // 3. Focus-pull reveal
  if ('IntersectionObserver' in window) {
    var revealSel = 'h2,.section-heading,.shop-filters,.carousel-controls,' + cardSel +
      ',.includes,.example-list,.price-badge,.lede,.pkg-group,.custom-line,article.case h2,article.case p,article.case ul,' +
      '.case-cta,.faq-item,.quick-answers details,.site-footer .footer-top';
    var vh = window.innerHeight;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('is-in');
        io.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    var seen = new Set();
    document.querySelectorAll(revealSel).forEach(function (el) {
      if (seen.has(el) || el.closest('.hero, .page-hero, .shop-hero, .site-header')) return;
      if (el.parentElement && el.parentElement.closest('.fx-reveal')) return; // parent already reveals
      // carousel items scroll sideways; reveal the track instead of each card
      if (el.parentElement && el.parentElement.classList.contains('carousel-track')) return;
      seen.add(el);
      if (el.getBoundingClientRect().top < vh * 0.92) return; // already on screen: leave it
      var sibs = el.parentElement ? Array.prototype.indexOf.call(el.parentElement.children, el) : 0;
      el.style.setProperty('--fx-delay', Math.min(sibs, 6) * 80 + 'ms');
      el.classList.add('fx-reveal');
      io.observe(el);
    });
    document.querySelectorAll('.carousel-track').forEach(function (t) {
      if (t.getBoundingClientRect().top < vh * 0.92) return;
      t.classList.add('fx-reveal');
      io.observe(t);
    });
  }

  // 4. Headline decode (runs once on load)
  var h1 = document.querySelector('h1');
  if (h1 && !paused()) {
    var glyphs = '01<>/{}[]#%&@$*+=?ABCDEFXYZ';
    var nodes = [];
    var walk = document.createTreeWalker(h1, NodeFilter.SHOW_TEXT, null);
    while (walk.nextNode()) if (walk.currentNode.nodeValue.trim()) nodes.push(walk.currentNode);
    var finals = nodes.map(function (n) { return n.nodeValue; });
    var total = finals.join('').length;
    if (total && total < 140) {
      h1.setAttribute('aria-label', h1.textContent.replace(/\s+/g, ' ').trim());
      h1.style.minHeight = h1.offsetHeight + 'px';
      var start = performance.now(), dur = 950;
      var frame = function (now) {
        var t = Math.min(1, (now - start) / dur);
        var done = Math.floor(t * total), idx = 0;
        nodes.forEach(function (n, i) {
          var src = finals[i], out = '';
          for (var c = 0; c < src.length; c++, idx++) {
            var ch = src[c];
            out += (idx < done || ch === ' ') ? ch : glyphs[(Math.random() * glyphs.length) | 0];
          }
          n.nodeValue = out;
        });
        if (t < 1) requestAnimationFrame(frame);
        else { nodes.forEach(function (n, i) { n.nodeValue = finals[i]; }); h1.style.minHeight = ''; }
      };
      requestAnimationFrame(frame);
    }
  }

  // 5. Magnetic primary buttons
  if (canHover) {
    document.querySelectorAll('.button,.btn-primary').forEach(function (b) {
      b.style.transition = (b.style.transition ? b.style.transition + ',' : '') + 'transform .25s cubic-bezier(.2,.7,.2,1)';
      b.addEventListener('pointermove', function (e) {
        if (paused()) return;
        var r = b.getBoundingClientRect();
        var x = (e.clientX - r.left - r.width / 2) / r.width;
        var y = (e.clientY - r.top - r.height / 2) / r.height;
        b.style.transform = 'translate(' + (x * 8).toFixed(1) + 'px,' + (y * 6).toFixed(1) + 'px)';
      });
      b.addEventListener('pointerleave', function () { b.style.transform = ''; });
    });
  }
})();
