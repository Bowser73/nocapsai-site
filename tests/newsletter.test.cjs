const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('assets/js/newsletter.js', 'utf8');

test('client sends newsletter requests only to the same-origin API', () => {
  assert.match(source, /const NEWSLETTER_API = "\/api\/newsletter"/);
  assert.doesNotMatch(source, /script\.google\.com/);
  assert.doesNotMatch(source, /FORM_SECRET|NEWSLETTER_SECRET/);
  assert.doesNotMatch(source, /AKfy[a-zA-Z0-9_-]+/);
});

test('client requires Turnstile before submission', () => {
  assert.match(source, /action: "newsletter_signup"/);
  assert.match(source, /if \(!turnstileToken\)/);
  assert.match(source, /turnstile\.reset/);
});

test('client keeps accessibility and local anti-bot controls', () => {
  assert.match(source, /aria-live/);
  assert.match(source, /aria-describedby/);
  assert.match(source, /company_website/);
  assert.match(source, /Date\.now\(\) - PAGE_LOADED_AT/);
});
