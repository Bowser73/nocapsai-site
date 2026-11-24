// NoCapsAI agency visual enhancements
// Canvas particles, 3D tilt, counters, scroll reveal
(function () {
  'use strict';

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canHover = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  // ---- Canvas: particles + flowing data streams ----------------
  function initParticles() {
    var canvas = document.getElementById('hero-canvas');
    if (!canvas || reduced) return;

    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w, h, t = 0;

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

    var COUNT = Math.min(55, Math.floor(window.innerWidth / 22));
    var particles = [];
    var mouse = { x: -9999, y: -9999 };
    var raf;

    // ---- Particles ----
    function Particle() {
      this.x = Math.random() * w;
      this.y = Math.random() * h;
      this.vx = (Math.random() - 0.5) * 0.22;
      this.vy = (Math.random() - 0.5) * 0.22;
      this.r = Math.random() * 1.3 + 0.4;
      this.alpha = Math.random() * 0.4 + 0.12;
      this.pulse = Math.random() * Math.PI * 2;
      this.isNode = Math.random() < 0.14;
      if (this.isNode) this.r = Math.random() * 2 + 1.5;
    }

    for (var i = 0; i < COUNT; i++) particles.push(new Particle());

    // ---- Data stream paths (bezier arcs flowing across the canvas) ----
    var STREAM_COUNT = 5;
    var streams = [];
    function makeStream() {
      var side = Math.floor(Math.random() * 2); // 0=left, 1=top
      var s = {
        progress: Math.random(),           // 0–1 along path
        speed: 0.0003 + Math.random() * 0.0003,
        alpha: 0.03 + Math.random() * 0.06,
        width: 0.6 + Math.random() * 0.8,
        // Control points for a bezier stream
        x0: 0, y0: 0, cx1: 0, cy1: 0, cx2: 0, cy2: 0, x1: 0, y1: 0
      };
      // Randomise start/end so streams cross the hero at interesting angles
      if (side === 0) {
        s.x0 = -10; s.y0 = Math.random() * h;
        s.x1 = w + 10; s.y1 = Math.random() * h;
      } else {
        s.x0 = Math.random() * w; s.y0 = -10;
        s.x1 = Math.random() * w; s.y1 = h + 10;
      }
      s.cx1 = w * (0.2 + Math.random() * 0.3); s.cy1 = h * (0.1 + Math.random() * 0.4);
      s.cx2 = w * (0.5 + Math.random() * 0.3); s.cy2 = h * (0.5 + Math.random() * 0.4);
      return s;
    }
    for (var k = 0; k < STREAM_COUNT; k++) {
      var st = makeStream();
      st.progress = Math.random(); // stagger starts
      streams.push(st);
    }

    // Evaluate cubic bezier at parameter t
    function bezier(t, p0, p1, p2, p3) {
      var mt = 1 - t;
      return mt*mt*mt*p0 + 3*mt*mt*t*p1 + 3*mt*t*t*p2 + t*t*t*p3;
    }

    // Draw a glowing dot travelling along a bezier stream
    function drawStreamDot(s) {
      var tt = s.progress;
      var x = bezier(tt, s.x0, s.cx1, s.cx2, s.x1);
      var y = bezier(tt, s.y0, s.cy1, s.cy2, s.y1);

      // Gradient trail — draw several dots with decreasing alpha behind the head
      var TRAIL = 8;
      for (var n = 0; n < TRAIL; n++) {
        var tp = Math.max(0, tt - n * 0.012);
        var tx = bezier(tp, s.x0, s.cx1, s.cx2, s.x1);
        var ty = bezier(tp, s.y0, s.cy1, s.cy2, s.y1);
        var ta = s.alpha * (1 - n / TRAIL) * (n === 0 ? 1.8 : 1);
        ctx.beginPath();
        ctx.arc(tx, ty, s.width * (1 - n * 0.08), 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,236,149,' + Math.min(ta, 0.95) + ')';
        ctx.fill();
      }
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);
      t++;

      // ---- Draw streams ----
      for (var k = 0; k < streams.length; k++) {
        var s = streams[k];
        s.progress += s.speed;
        if (s.progress > 1.05) {
          streams[k] = makeStream();
          streams[k].progress = 0;
          continue;
        }
        drawStreamDot(s);
      }

      // ---- Draw particles + connections ----
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];

        p.x += p.vx;
        p.y += p.vy;
        p.pulse += 0.016;

        if (p.x < -5) p.x = w + 5;
        else if (p.x > w + 5) p.x = -5;
        if (p.y < -5) p.y = h + 5;
        else if (p.y > h + 5) p.y = -5;

        var pAlpha = p.alpha * (0.72 + 0.28 * Math.sin(p.pulse));

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.isNode
          ? 'rgba(0,236,149,' + (pAlpha * 1.5) + ')'
          : 'rgba(0,236,149,' + pAlpha + ')';
        ctx.fill();

        if (p.isNode) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r + 2.5, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(0,236,149,' + (pAlpha * 0.25) + ')';
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        for (var j = i + 1; j < particles.length; j++) {
          var q = particles[j];
          var dx = p.x - q.x, dy = p.y - q.y;
          var distSq = dx * dx + dy * dy;
          if (distSq < 8100) {
            var dist = Math.sqrt(distSq);
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = 'rgba(0,236,149,' + ((1 - dist / 90) * 0.08) + ')';
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }

        var mx = p.x - mouse.x, my = p.y - mouse.y;
        var mdSq = mx * mx + my * my;
        if (mdSq < 22500) {
          var md = Math.sqrt(mdSq);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.strokeStyle = 'rgba(0,236,149,' + ((1 - md / 150) * 0.3) + ')';
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }

      raf = requestAnimationFrame(draw);
    }

    resize();
    draw();

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
