(() => {
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
  }));
  document.querySelectorAll('[data-year]').forEach(el => el.textContent = new Date().getFullYear());
})();
