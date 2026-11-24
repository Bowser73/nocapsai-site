// NoCapsAI agency visual enhancements
// Canvas particles, 3D tilt, counters, scroll reveal
(function () {
  'use strict';

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canHover = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  // ---- Canvas particle network --------------------------------
  function initParticles() {
    var canvas = document.getElementById('hero-canvas');
    if (!canvas || reduced) return;

    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w, h;

    function resize() {
      var rect = canvas.parentElement.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    }

    var COUNT = Math.min(70, Math.floor(window.innerWidth / 18));
    var particles = [];
    var mouse = { x: -9999, y: -9999 };
    var raf;

    function Particle() {
      this.x = Math.random() * w;
      this.y = Math.random() * h;
      this.vx = (Math.random() - 0.5) * 0.25;
      this.vy = (Math.random() - 0.5) * 0.25;
      this.r = Math.random() * 1.4 + 0.5;
      this.alpha = Math.random() * 0.45 + 0.15;
      this.pulse = Math.random() * Math.PI * 2;
      // Data-stream look: some particles are "data nodes" (slightly larger)
      this.isNode = Math.random() < 0.15;
      if (this.isNode) this.r = Math.random() * 2 + 1.5;
    }

    for (var i = 0; i < COUNT; i++) particles.push(new Particle());

    function draw() {
      ctx.clearRect(0, 0, w, h);

      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];

        p.x += p.vx;
        p.y += p.vy;
        p.pulse += 0.018;

        if (p.x < -5) p.x = w + 5;
        else if (p.x > w + 5) p.x = -5;
        if (p.y < -5) p.y = h + 5;
        else if (p.y > h + 5) p.y = -5;

        var pAlpha = p.alpha * (0.75 + 0.25 * Math.sin(p.pulse));

        // Draw particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.isNode
          ? 'rgba(0,236,149,' + (pAlpha * 1.6) + ')'
          : 'rgba(0,236,149,' + pAlpha + ')';
        ctx.fill();

        if (p.isNode) {
          // Glow ring on data nodes
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r + 3, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(0,236,149,' + (pAlpha * 0.3) + ')';
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        // Connect nearby particles
        for (var j = i + 1; j < particles.length; j++) {
          var q = particles[j];
          var dx = p.x - q.x, dy = p.y - q.y;
          var distSq = dx * dx + dy * dy;
          if (distSq < 9000) { // 95px
            var dist = Math.sqrt(distSq);
            var lineAlpha = (1 - dist / 95) * 0.1;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = 'rgba(0,236,149,' + lineAlpha + ')';
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }

        // Connect to mouse (interactive)
        var mx = p.x - mouse.x, my = p.y - mouse.y;
        var mdSq = mx * mx + my * my;
        if (mdSq < 25000) { // 158px
          var md = Math.sqrt(mdSq);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.strokeStyle = 'rgba(0,236,149,' + ((1 - md / 158) * 0.35) + ')';
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }

      raf = requestAnimationFrame(draw);
    }

    resize();
    draw();

    // Pause when hero scrolls out of view
    var scrollPaused = false;
    window.addEventListener('scroll', function () {
      var heroBottom = canvas.parentElement.getBoundingClientRect().bottom;
      if (heroBottom < 0 && !scrollPaused) {
        cancelAnimationFrame(raf);
        scrollPaused = true;
      } else if (heroBottom >= 0 && scrollPaused) {
        scrollPaused = false;
        draw();
      }
    }, { passive: true });

    var debounceResize;
    window.addEventListener('resize', function () {
      clearTimeout(debounceResize);
      debounceResize = setTimeout(function () {
        resize();
        particles = [];
        for (var i = 0; i < COUNT; i++) particles.push(new Particle());
      }, 200);
    }, { passive: true });

    var hero = canvas.parentElement;
    if (hero) {
      hero.addEventListener('pointermove', function (e) {
        var r = hero.getBoundingClientRect();
        mouse.x = e.clientX - r.left;
        mouse.y = e.clientY - r.top;
      }, { passive: true });
      hero.addEventListener('pointerleave', function () {
        mouse.x = -9999; mouse.y = -9999;
      });
    }
  }

  // ---- 3D tilt on cards ---------------------------------------
  function initTilt() {
    if (!canHover || reduced) return;
    var sel = '.capability-tile, .client-project-card, .product-showcase-card';
    document.querySelectorAll(sel).forEach(function (card) {
      card.addEventListener('mousemove', function (e) {
        var r = card.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5;
        var y = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform = 'perspective(700px) rotateY(' + (x * 7) + 'deg) rotateX(' + (-y * 7) + 'deg) translateZ(6px) scale(1.01)';
      });
      card.addEventListener('mouseleave', function () {
        card.style.transform = '';
      });
    });
  }

  // ---- Counter animation (data-count attributes) --------------
  function initCounters() {
    if (!('IntersectionObserver' in window) || reduced) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target;
        var target = parseInt(el.getAttribute('data-count'), 10);
        var suffix = el.getAttribute('data-suffix') || '';
        var dur = 1200;
        var start = performance.now();
        var tick = function (now) {
          var t = Math.min(1, (now - start) / dur);
          var ease = 1 - Math.pow(1 - t, 3);
          el.textContent = Math.round(ease * target) + suffix;
          if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        io.unobserve(el);
      });
    }, { threshold: 0.5 });
    document.querySelectorAll('[data-count]').forEach(function (el) { io.observe(el); });
  }

  // ---- Scroll reveal for new sections -------------------------
  function initScrollReveal() {
    if (!('IntersectionObserver' in window) || reduced) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('av-in');
        io.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.05 });

    document.querySelectorAll('.av-reveal').forEach(function (el) {
      var top = el.getBoundingClientRect().top;
      if (top < window.innerHeight * 0.95) {
        el.classList.add('av-in');
      } else {
        io.observe(el);
      }
    });
  }

  // ---- Init ---------------------------------------------------
  function init() {
    initParticles();
    initTilt();
    initCounters();
    initScrollReveal();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
