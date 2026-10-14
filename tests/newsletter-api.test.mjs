import test from 'node:test';
import assert from 'node:assert/strict';
import { newsletterHandler } from '../api/newsletter/index.js';

const originalEnv = { ...process.env };
const context = { errors: [], error(...args) { this.errors.push(args); } };
function request(body, method = 'POST') {
  return { method, headers: new Headers({ 'x-forwarded-for': '203.0.113.2' }), async json() { return body; } };
}
function configure() {
  process.env.NEWSLETTER_APPS_SCRIPT_URL = 'https://example.test/apps-script';
  process.env.NEWSLETTER_FORM_SECRET = 'server-only-secret';
  process.env.TURNSTILE_SECRET_KEY = 'turnstile-secret';
  process.env.TURNSTILE_SITE_KEY = 'turnstile-site';
}
test.afterEach(() => { process.env = { ...originalEnv }; context.errors.length = 0; });

test('fails closed when server secrets are absent', async () => {
  delete process.env.NEWSLETTER_FORM_SECRET;
  const result = await newsletterHandler(request({}), context, async () => assert.fail());
  assert.equal(result.status, 503);
});

test('rejects a missing Turnstile token without contacting Apps Script', async () => {
  configure();
  let calls = 0;
  const result = await newsletterHandler(request({ email: 'person@example.test', t: 2000 }), context,
    async () => { calls++; return new Response(JSON.stringify({ success: false }), { status: 200 }); });
  assert.equal(result.status, 403);
  assert.equal(calls, 0);
});

test('verified signup forwards the private secret server-side', async () => {
  configure();
  const calls = [];
  const fetchMock = async (url, options) => {
    calls.push({ url, options });
    if (url.includes('turnstile')) return new Response(JSON.stringify({ success: true, action: 'newsletter_signup' }), { status: 200 });
    return new Response(JSON.stringify({ ok: true, duplicate: false }), { status: 200 });
  };
  const result = await newsletterHandler(request({ email: 'Person@Example.test', t: 2000,
    turnstileToken: 'verified', page: 'https://nocapsai.com/' }), context, fetchMock);
  assert.equal(result.status, 200);
  assert.equal(calls.length, 2);
  const upstream = new URLSearchParams(calls[1].options.body);
  assert.equal(upstream.get('secret'), 'server-only-secret');
  assert.equal(upstream.get('email'), 'person@example.test');
});

test('honeypot submissions are accepted without storage', async () => {
  configure();
  const result = await newsletterHandler(request({ email: 'bot@example.test', t: 2000, hp: 'spam' }), context,
    async () => assert.fail('must not call external services'));
  assert.deepEqual(result.jsonBody, { ok: true });
});
