(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const motion = document.querySelector('.motion-toggle');
  let paused = reduced.matches;
  const setMotion = () => {
    document.body.classList.toggle('motion-paused', paused);
    motion.setAttribute('aria-pressed', String(paused));
    motion.textContent = paused ? 'Play motion' : 'Pause motion';
  };
  setMotion();
  motion.addEventListener('click', () => { paused = !paused; setMotion(); });
  reduced.addEventListener('change', () => { paused = reduced.matches; setMotion(); });
  const tracks = document.querySelectorAll('.carousel-track');
  const update = track => {
    document.querySelector(`[data-carousel-prev="${track.id}"]`).disabled = track.scrollLeft < 2;
    document.querySelector(`[data-carousel-next="${track.id}"]`).disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 3;
  };
  const move = (track, direction) => {
    const card = [...track.children].find(item => !item.hidden);
    if (!card) return;
    track.scrollBy({left: direction * (card.getBoundingClientRect().width + 22), behavior: reduced.matches || paused ? 'instant' : 'smooth'});
  };
  tracks.forEach(track => {
    document.querySelector(`[data-carousel-prev="${track.id}"]`).addEventListener('click', () => move(track, -1));
    document.querySelector(`[data-carousel-next="${track.id}"]`).addEventListener('click', () => move(track, 1));
    track.addEventListener('scroll', () => update(track), {passive:true});
    track.addEventListener('keydown', event => {
      if (event.target === track && ['ArrowLeft','ArrowRight'].includes(event.key)) {
        event.preventDefault(); move(track, event.key === 'ArrowRight' ? 1 : -1);
      }
    });
    new ResizeObserver(() => update(track)).observe(track);
    update(track);
  });
  const buttons = document.querySelectorAll('[data-filter]');
  const products = document.querySelectorAll('[data-category]');
  buttons.forEach(button => button.addEventListener('click', () => {
    const category = button.dataset.filter;
    buttons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    let visible = 0;
    products.forEach(product => {
      product.hidden = category !== 'all' && product.dataset.category !== category;
      if (!product.hidden) visible++;
    });
    document.querySelector('#product-count').textContent = `${visible} products shown`;
    const track = document.querySelector('#products');
    track.scrollTo({left:0, behavior:'instant'});
    update(track);
  }));
  document.querySelectorAll('[data-year]').forEach(el => el.textContent = new Date().getFullYear());
})();
