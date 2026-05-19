// Twizted Journeys — Main JS

// Mobile nav toggle
function toggleNav(btn) {
  const nav = document.getElementById('nav-links');
  const isOpen = nav.classList.toggle('open');
  btn.setAttribute('aria-expanded', isOpen);
  btn.textContent = isOpen ? '✕' : '☰';
}

// Close nav when a link is clicked on mobile
document.querySelectorAll('.nav-links a').forEach(link => {
  link.addEventListener('click', () => {
    const nav = document.getElementById('nav-links');
    const btn = document.querySelector('.nav-toggle');
    if (nav.classList.contains('open')) {
      nav.classList.remove('open');
      if (btn) { btn.setAttribute('aria-expanded', false); btn.textContent = '☰'; }
    }
  });
});

// Highlight active nav link based on current page
(function () {
  const current = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === current || (current === '' && href === 'index.html')) {
      a.classList.add('active');
    } else {
      a.classList.remove('active');
    }
  });
})();
