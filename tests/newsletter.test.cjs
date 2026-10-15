const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const RAW = fs.readFileSync('assets/js/newsletter.js', 'utf8');
const withKey = RAW.replace('const TURNSTILE_SITE_KEY = "";', 'const TURNSTILE_SITE_KEY = "1x00000000000000000000AA";');

function setup(fetch, { source = withKey, token = 'tok-123' } = {}) {
  function element(textContent = '') {
    return { textContent, style: {}, attrs: {}, handlers: {}, value: '',
      setAttribute(k, v) { this.attrs[k] = v; },
      getAttribute(k) { return this.attrs[k] || null; },
      removeAttribute(k) { delete this.attrs[k]; },
      addEventListener(k, fn) { this.handlers[k] = fn; },
      appendChild() {}, focus() { this.focused = true; } };
  }
  const input = element(), button = element('Sign Up'), form = element(), root = element();
  button.tagName = 'BUTTON';
  input.checkValidity = () => true;
  input.closest = () => form;
  const appended = [];
  root.querySelector = selector => selector.startsWith('input') ? input : null;
  root.querySelectorAll = () => [button];
  root.appendChild = el => { appended.push(el); if (el.className === 'newsletter-status') root.status = el; };
  const heading = element('Stay in the Loop');
  heading.closest = () => root;
  const ts = { resets: 0, rendered: null,
    render(box, opts) { this.rendered = opts; if (token) opts.callback(token); return 'w1'; },
    reset() { this.resets++; if (token) this.rendered.callback(token + '-' + this.resets); } }; // real widget re-issues a token after reset
  vm.runInNewContext(source, {
    document: { querySelectorAll: () => [heading], createElement: () => element(), head: element() },
    window: { location: { href: 'https://nocapsai.com/' }, turnstile: ts },
    URLSearchParams, fetch, console: { warn() {}, error() {} }, Date
  });
  root.status = appended.find(e => e.className === 'newsletter-status');
  const click = () => button.handlers.click({ preventDefault() {} });
  const enter = () => input.handlers.keydown({ key: 'Enter', preventDefault() {} });
  const submit = () => form.handlers.submit({ preventDefault() {} });
  return { input, button, root, click, enter, submit, ts };
}
const settle = () => new Promise(resolve => setImmediate(resolve));
const reply = body => Promise.resolve({ ok: true, json: async () => body });

test('no form secret or hardcoded credential ships in the browser code', () => {
  assert.doesNotMatch(RAW, /NEWSLETTER_SECRET|FORM_SECRET|secret\s*:/i);
  assert.doesNotMatch(RAW, /["'][A-F0-9]{32,}["']/i);
  assert.match(RAW, /const TURNSTILE_SITE_KEY = "/);
});

test('invalid email never sends', () => {
  let calls = 0;
  const ui = setup(() => { calls++; });
  ui.input.value = 'not-an-email';
  ui.click();
  assert.equal(calls, 0);
  assert.equal(ui.input.attrs['aria-invalid'], 'true');
  assert.equal(ui.root.status.attrs['aria-live'], 'polite');
});

test('without a site key the form fails closed and points to email', () => {
  let calls = 0;
  const ui = setup(() => { calls++; }, { source: RAW });
  ui.input.value = 'person@example.test';
  ui.click();
  assert.equal(calls, 0);
  assert.match(ui.root.status.textContent, /temporarily unavailable.*info@nocapsai\.com/);
});

test('no Turnstile token means no request', () => {
  let calls = 0;
  const ui = setup(() => { calls++; }, { token: '' });
  ui.input.value = 'person@example.test';
  ui.click();
  assert.equal(calls, 0);
  assert.match(ui.root.status.textContent, /verification check/);
});

test('legitimate signup posts the token (not a secret), reports success and resets the widget', async () => {
  let sent;
  const ui = setup((url, options) => { sent = new URLSearchParams(options.body); assert.equal(options.mode, undefined); return reply({ ok: true, duplicate: false }); });
  assert.equal(ui.ts.rendered.action, 'newsletter_signup');
  ui.input.value = ' person@example.test ';
  ui.click(); ui.enter(); ui.submit(); // one in-flight request only
  await settle(); await settle();
  assert.equal(sent.get('turnstileToken'), 'tok-123');
  assert.equal(sent.get('email'), 'person@example.test');
  assert.equal(sent.get('kind'), 'newsletter');
  assert.equal(sent.get('secret'), null);
  assert.match(ui.root.status.textContent, /on the list/);
  assert.equal(ui.ts.resets, 1);
  assert.equal(ui.button.disabled, false);
});

test('duplicate and rejected-token responses are shown honestly', async () => {
  const dup = setup(() => reply({ ok: true, duplicate: true }));
  dup.input.value = 'person@example.test'; dup.click(); await settle(); await settle();
  assert.match(dup.root.status.textContent, /already on the list/);
  const bad = setup(() => reply({ ok: false, error: 'verification_failed' }));
  bad.input.value = 'person@example.test'; bad.click(); await settle(); await settle();
  assert.match(bad.root.status.textContent, /couldn't verify/);
  assert.equal(bad.ts.resets, 1);
});

test('network failure keeps the address and allows retry', async () => {
  let calls = 0;
  const ui = setup(async () => { calls++; throw new Error('offline'); });
  ui.input.value = 'person@example.test';
  ui.enter(); await settle();
  assert.match(ui.root.status.textContent, /Network error/);
  assert.equal(ui.input.value, 'person@example.test');
  ui.click(); await settle();
  assert.equal(calls, 2);
});
