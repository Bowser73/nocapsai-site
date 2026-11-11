// Carousels (packages, funding tools): arrows, dots, optional group tabs,
// and a gentle auto-advance. Without JavaScript each track is still a
// normal swipe/scroll row.
(function () {
  'use strict';
  Array.prototype.forEach.call(document.querySelectorAll('[data-carousel]'), setup);

function setup(root) {
  var track = root.querySelector('[data-carousel-track]');
  if (!track) return;
  var cards = Array.prototype.slice.call(track.children);
  var prev = root.querySelector('.pkg-prev');
  var next = root.querySelector('.pkg-next');
  var dotsBox = root.querySelector('.pkg-dots');
  var tabs = Array.prototype.slice.call(root.querySelectorAll('.pkg-tab'));
  if (cards.length < 2) return;

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var AUTO_MS = parseInt(root.getAttribute('data-interval'), 10) || 5000;
  var timer = null, userTookOver = false, hovering = false, inView = false, dots = [];

  function offsetOf(card) { return card.offsetLeft - cards[0].offsetLeft; }
  function maxScroll() { return Math.max(0, track.scrollWidth - track.clientWidth); }
  // Number of distinct stops: the cards whose left edge can actually be reached.
  function stopCount() {
    var max = maxScroll(), n = 1;
    for (var i = 1; i < cards.length; i++) { if (offsetOf(cards[i]) <= max + 2) n = i + 1; }
    if (n < cards.length && offsetOf(cards[n - 1]) < max - 2) n += 1; // final partial stop
    return n;
  }
  function stopLeft(i) { return Math.min(offsetOf(cards[Math.min(i, cards.length - 1)]), maxScroll()); }
  function current() {
    var best = 0, bestD = Infinity, n = stopCount();
    for (var i = 0; i < n; i++) { var d = Math.abs(stopLeft(i) - track.scrollLeft); if (d < bestD) { bestD = d; best = i; } }
    return best;
  }
  function go(i) {
    var n = stopCount();
    i = ((i % n) + n) % n;
    track.scrollTo({ left: stopLeft(i), behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  function buildDots() {
    var n = stopCount();
    if (dots.length === n) return;
    dotsBox.innerHTML = ''; dots = [];
    for (var i = 0; i < n; i++) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'pkg-dot'; b.tabIndex = -1;
      (function (idx) { b.addEventListener('click', function () { takeOver(); go(idx); }); })(i);
      dotsBox.appendChild(b); dots.push(b);
    }
    root.classList.toggle('is-static', n < 2);
  }
  function refresh() {
    buildDots();
    var c = current();
    dots.forEach(function (d, i) { d.classList.toggle('is-active', i === c); });
    // Active tab = group of the card nearest the middle of the visible row.
    if (!tabs.length) return;
    var mid = track.scrollLeft + track.clientWidth / 2, group = null, bestD = Infinity;
    cards.forEach(function (card) {
      var d = Math.abs(offsetOf(card) + card.offsetWidth / 2 - mid);
      if (d < bestD) { bestD = d; group = card.getAttribute('data-group'); }
    });
    tabs.forEach(function (t) { t.classList.toggle('is-active', t.getAttribute('data-group') === group); });
  }

  function stop() { if (timer) { clearInterval(timer); timer = null; } }
  function start() {
    stop();
    if (reduceMotion || userTookOver || hovering || !inView || stopCount() < 2) return;
    timer = setInterval(function () { go(current() + 1); }, AUTO_MS);
  }
  function takeOver() { userTookOver = true; stop(); }

  prev.addEventListener('click', function () { takeOver(); go(current() - 1); });
  next.addEventListener('click', function () { takeOver(); go(current() + 1); });
  function showGroup(g) {
    for (var i = 0; i < cards.length; i++) {
      if (cards[i].getAttribute('data-group') === g) {
        track.scrollTo({ left: Math.min(offsetOf(cards[i]), maxScroll()), behavior: reduceMotion ? 'auto' : 'smooth' });
        break;
      }
    }
  }
  tabs.forEach(function (t) {
    t.addEventListener('click', function () { takeOver(); showGroup(t.getAttribute('data-group')); });
  });
  track.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight') { takeOver(); go(current() + 1); e.preventDefault(); }
    if (e.key === 'ArrowLeft') { takeOver(); go(current() - 1); e.preventDefault(); }
  });
  ['pointerdown', 'touchstart', 'wheel'].forEach(function (ev) {
    track.addEventListener(ev, takeOver, { passive: true });
  });
  root.addEventListener('mouseenter', function () { hovering = true; stop(); });
  root.addEventListener('mouseleave', function () { hovering = false; start(); });
  root.addEventListener('focusin', takeOver);

  var raf = null;
  track.addEventListener('scroll', function () {
    if (raf) return;
    raf = requestAnimationFrame(function () { raf = null; refresh(); });
  }, { passive: true });
  window.addEventListener('resize', refresh);

  // Links elsewhere on the page that point at a package group stop the auto-advance.
  if (tabs.length) document.querySelectorAll('a[href="#small-business"], a[href="#nonprofit-packages"]').forEach(function (a) {
    a.addEventListener('click', function () {
      takeOver();
      var g = a.getAttribute('href') === '#small-business' ? 'business' : 'nonprofit';
      setTimeout(function () { showGroup(g); }, 60);   // after the browser's own jump
    });
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      inView = entries[0].isIntersecting; start();
    }, { threshold: 0.35 }).observe(root);
  } else { inView = true; }

  refresh(); start();
}
})();
