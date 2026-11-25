(() => {
  const interest = new URLSearchParams(window.location.search).get('interest');
  const select = document.querySelector('#service-inquiry select[name="interest"]');
  if (interest === 'website-ownership' && select && !select.value) {
    select.value = 'Website Ownership Plan';
  }
})();
