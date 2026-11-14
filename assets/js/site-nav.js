// NoCapsAI main menu: dropdown toggles, phone menu, Escape and outside-click to close.
(function () {
  'use strict';
  var header = document.querySelector('.site-header');
  if (!header) return;
  var items = header.querySelectorAll('.nav-item.has-menu');

  function closeAll(except) {
    items.forEach(function (it) {
      if (it === except) return;
      it.classList.remove('open');
      var b = it.querySelector('.nav-caret');
      if (b) b.setAttribute('aria-expanded', 'false');
    });
  }

  items.forEach(function (it) {
    var btn = it.querySelector('.nav-caret');
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = !it.classList.contains('open');
      closeAll(it);
      it.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', String(open));
    });
  });

  var toggle = header.querySelector('.nav-toggle');
  if (toggle) toggle.addEventListener('click', function () {
    var open = !header.classList.contains('nav-open');
    header.classList.toggle('nav-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.querySelector('span').textContent = open ? 'Close' : 'Menu';
    if (!open) closeAll();
  });

  document.addEventListener('click', function (e) { if (!header.contains(e.target)) closeAll(); });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var openItem = header.querySelector('.nav-item.open');
    closeAll();
    if (openItem) openItem.querySelector('.nav-caret').focus();
  });
  // following an in-page link from the phone menu closes the menu
  header.querySelectorAll('.nav-menu a').forEach(function (a) {
    a.addEventListener('click', function () {
      header.classList.remove('nav-open');
      if (toggle) { toggle.setAttribute('aria-expanded', 'false'); toggle.querySelector('span').textContent = 'Menu'; }
      closeAll();
    });
  });
})();
