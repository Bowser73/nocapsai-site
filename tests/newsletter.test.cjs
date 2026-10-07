const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('assets/js/newsletter.js', 'utf8');

function setup(fetch) {
  function element(textContent = '') {
    return { textContent, style: {}, attrs: {}, handlers: {}, value: '',
      setAttribute(k, v) { this.attrs[k] = v; },
      getAttribute(k) { return this.attrs[k] || null; },
      removeAttribute(k) { delete this.attrs[k]; },
      addEventListener(k, fn) { this.handlers[k] = fn; },
      focus() { this.focused = true; }
    };
  }
  const input = element(), button = element('Sign Up'), form = element(), root = element();
  button.tagName = 'BUTTON';
  input.checkValidity = () => true;
  input.closest = () => form;
  root.querySelector = selector => selector.startsWith('input') ? input : null;
  root.querySelectorAll = () => [button];
  root.appendChild = el => { root.status = el; };
  const heading = element('Stay in the Loop');
  heading.closest = () => root;
  vm.runInNewContext(source, {
    document: { querySelectorAll: () => [heading], createElement: () => element() },
    window: { location: { href: 'https://example.test/' } },
    URLSearchParams, fetch, console: { warn() {}, error() {} }
  });
  const click = () => button.handlers.click({ preventDefault() {} });
  const enter = () => input.handlers.keydown({ key: 'Enter', preventDefault() {} });
  const submit = () => form.handlers.submit({ preventDefault() {} });
  return { input, button, root, click, enter, submit };
}
const settle = () => new Promise(resolve => setImmediate(resolve));

test('invalid input does not send a request and exposes accessible feedback', () => {
  let calls = 0;
  const ui = setup(() => { calls++; });
  ui.input.value = 'not-an-email';
  ui.click();
  assert.equal(calls, 0);
  assert.equal(ui.input.attrs['aria-invalid'], 'true');
  assert.equal(ui.input.focused, true);
  assert.equal(ui.root.status.attrs['aria-live'], 'polite');
  assert.equal(ui.input.attrs['aria-describedby'], 'newsletter-status');
});

test('native validity constraints are respected', () => {
  const ui = setup(() => assert.fail('must not fetch'));
  ui.input.value = 'person@example.test';
  ui.input.checkValidity = () => false;
  ui.submit();
  assert.equal(ui.input.attrs['aria-invalid'], 'true');
});

test('click, Enter and form submit share an in-flight guard; opaque response never claims signup', async () => {
  let resolve, calls = 0;
  const ui = setup((url, options) => {
    calls++;
    assert.equal(options.mode, 'no-cors');
    assert.equal(new URLSearchParams(options.body).get('email'), 'person@example.test');
    return new Promise(done => { resolve = done; });
  });
  ui.input.value = ' person@example.test ';
  ui.click(); ui.enter(); ui.submit();
  assert.equal(calls, 1);
  assert.equal(ui.button.disabled, true);
  assert.equal(ui.root.attrs['aria-busy'], 'true');
  resolve({ type: 'opaque', status: 0 });
  await settle();
  assert.match(ui.root.status.textContent, /cannot confirm your subscription/);
  assert.equal(ui.input.value, 'person@example.test');
  assert.equal(ui.button.disabled, false);
  assert.equal(ui.button.textContent, 'Sign Up');
  assert.equal(ui.root.attrs['aria-busy'], undefined);
});

test('network rejection retains address and restores retry controls', async () => {
  let calls = 0;
  const ui = setup(async () => { calls++; throw new Error('offline'); });
  ui.input.value = 'person@example.test';
  ui.enter();
  await settle();
  assert.match(ui.root.status.textContent, /Network error/);
  assert.equal(ui.input.value, 'person@example.test');
  assert.equal(ui.button.disabled, false);
  ui.click();
  await settle();
  assert.equal(calls, 2);
});
