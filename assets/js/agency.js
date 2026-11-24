(() => {
  const button = document.querySelector('.agency-toggle');
  const nav = document.querySelector('#agency-links');
  if (button && nav) {
    const setOpen = open => {
      button.setAttribute('aria-expanded', String(open));
      nav.classList.toggle('is-open', open);
    };
    button.addEventListener('click', () => setOpen(button.getAttribute('aria-expanded') !== 'true'));
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && nav.classList.contains('is-open')) {
        setOpen(false);
        button.focus();
      }
    });
  }
  const legacyRoutes = {
    '/': {payment:'/contact/#payment',pricing:'/services/pricing/',products:'/shop/#tools','funding-tools':'/shop/#tools',grantflow:'/grantflow/',faq:'/shop/', 'small-business':'/services/pricing/web.html'},
    '/services/':{websites:'/services/pricing/web.html',campaigns:'/marketing/','nonprofit-packages':'/services/pricing/nonprofit.html','small-business':'/services/pricing/web.html'}
  };
  function followLegacyLink() {
    const destination = legacyRoutes[location.pathname.replace(/index\.html$/, "")]?.[location.hash.slice(1)];
    if (typeof destination === 'string') location.replace(destination);
  }
  followLegacyLink();
  window.addEventListener('hashchange',followLegacyLink);
  const form = document.querySelector('#service-inquiry');
  if (!form) return;
  const query = new URLSearchParams(location.search);
  const service = query.get('service'), tier = query.get('tier');
  const interest = form.elements.namedItem('interest');
  if ([...interest.options].some(option => option.value === service)) {
    interest.value = service;
    if (['Essential','Professional','Advanced'].includes(tier) && !form.elements.message.value) {
      form.elements.message.value = 'I am interested in the ' + tier + ' package for ' + service + '. ';
    }
  }
})();
