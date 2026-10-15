// Runs the Apps Script receiver (Code.gs) in Node with stand-ins for Apps Script services.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const SRC = fs.readFileSync('integrations/google-apps-script/Code.gs', 'utf8');
const ctx = {}; vm.runInNewContext(SRC, ctx);
// Values made inside the vm realm have different prototypes; compare them as plain JSON.
const plain = v => JSON.parse(JSON.stringify(v));
const H = (p, s) => plain(ctx.handleNewsletter_(p, s));

function sheetWith(rows) {
  const data = rows.map(r => r.slice());
  return { data, appended: [],
    getLastColumn: () => data[0].length, getLastRow: () => data.length,
    getRange(r, c, nr, nc) { return {
      getDisplayValues: () => data.slice(r - 1, r - 1 + nr).map(row => row.slice(c - 1, c - 1 + nc).map(String)),
      createTextFinder: (t) => ({ matchEntireCell() { return this; }, matchCase() { return this; },
        findNext: () => data.slice(r - 1, r - 1 + nr).some(row => String(row[c - 1]).toLowerCase() === t) ? {} : null }) }; },
    appendRow(row) { data.push(row); this.appended.push(row); } };
}
function svc({ verify = { success: true, action: 'newsletter_signup', hostname: 'nocapsai.com' }, props, sheet } = {}) {
  const cache = {}, calls = [];
  const P = props || { TURNSTILE_SECRET: 'srv-secret', NEWSLETTER_SHEET_NAME: 'WebsiteLeads' };
  const sh = sheet || sheetWith([['Timestamp', 'Name', 'Email', 'Message', 'Page', 'Source'],
                                 ['2026-10-01', 'Newsletter', 'existing@example.com', 'x', 'p', 'website']]);
  return { calls, sh,
    prop: k => P[k] || null, cacheGet: k => cache[k] || null, cachePut: (k, v) => { cache[k] = v; },
    fetch: (url, opts) => { calls.push({ url, opts }); return { code: 200, text: JSON.stringify(verify) }; },
    withLock: fn => fn(), sheet: n => (n === 'WebsiteLeads' ? sh : null), log() {}, now: () => 'NOW' };
}
const good = (o = {}) => Object.assign({ kind: 'newsletter', email: 'New@Example.com', t: '5000', hp: '',
  turnstileToken: 'tok', page: 'https://nocapsai.com/' }, o);

test('legitimate signup is verified server-side and appended under the right headers', () => {
  const s = svc();
  const r = H(good(), s);
  assert.deepEqual(r, { ok: true, duplicate: false });
  assert.equal(s.calls.length, 1);
  assert.equal(s.calls[0].url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
  assert.equal(s.calls[0].opts.payload.secret, 'srv-secret');
  assert.deepEqual(plain(s.sh.appended[0]), ['NOW', 'Newsletter', 'new@example.com', 'Newsletter signup', 'https://nocapsai.com/', 'website']);
  assert.equal(s.sh.data[1][2], 'existing@example.com'); // existing rows untouched
});

test('duplicates are not re-added (sheet match and immediate repeat)', () => {
  const s = svc();
  assert.deepEqual(H(good({ email: 'EXISTING@example.com' }), s), { ok: true, duplicate: true });
  assert.deepEqual(H(good(), s), { ok: true, duplicate: false });
  assert.deepEqual(H(good(), s), { ok: true, duplicate: true });
  assert.equal(s.sh.appended.length, 1);
});

test('invalid, missing, wrong-action and wrong-host tokens are rejected and store nothing', () => {
  for (const [verify, tok] of [
    [{ success: false, 'error-codes': ['invalid-input-response'] }, 'tok'],
    [{ success: true, action: 'other', hostname: 'nocapsai.com' }, 'tok'],
    [{ success: true, action: 'newsletter_signup', hostname: 'evil.example' }, 'tok'],
    [{ success: true, action: 'newsletter_signup', hostname: 'nocapsai.com' }, '']]) {
    const s = svc({ verify });
    assert.deepEqual(H(good({ turnstileToken: tok }), s), { ok: false, error: 'verification_failed' });
    assert.equal(s.sh.appended.length, 0);
  }
});

test('old FORM_SECRET-style requests without a token are rejected', () => {
  const s = svc();
  const r = H(good({ turnstileToken: undefined, secret: '23DDDDA126981E83136C51E30ED4D60279CABD8AF7048FC9' }), s);
  assert.equal(r.ok, false);
  assert.equal(s.sh.appended.length, 0);
});

test('bot signals: honeypot and too-fast submissions store nothing and skip siteverify', () => {
  const s = svc();
  assert.deepEqual(H(good({ hp: 'http://spam' }), s), { ok: true });
  assert.equal(H(good({ t: '200' }), s).ok, false);
  assert.equal(s.sh.appended.length, 0);
  assert.equal(s.calls.length, 0);
});

test('invalid email and unconfigured secret fail closed', () => {
  assert.deepEqual(H(good({ email: 'nope' }), svc()), { ok: false, error: 'invalid_email' });
  const s = svc({ props: { NEWSLETTER_SHEET_NAME: 'WebsiteLeads' } });
  assert.deepEqual(H(good(), s), { ok: false, error: 'unavailable' });
  assert.equal(s.sh.appended.length, 0);
});

test('global rate limit caps verified signups', () => {
  const s = svc();
  for (let i = 0; i < 30; i++) assert.equal(H(good({ email: `p${i}@example.com` }), s).ok, true);
  assert.deepEqual(H(good({ email: 'p99@example.com' }), s), { ok: false, error: 'rate_limited' });
});

test('submitted text cannot become a spreadsheet formula', () => {
  const s = svc();
  assert.equal(H(good({ email: '=cmd@evil.co', page: '=IMPORTXML("x")' }), s).ok, true);
  assert.equal(s.sh.appended[0][2], "'=cmd@evil.co");
  assert.equal(s.sh.appended[0][4], "'=IMPORTXML(\"x\")");
});

test('very long addresses still dedupe within cache key limits', () => {
  const s = svc(); const long = 'a'.repeat(240) + '@example.com';
  assert.equal(H(good({ email: long }), s).duplicate, false);
  assert.equal(H(good({ email: long }), s).duplicate, true);
});

test('the receiver never sends email', () => {
  assert.doesNotMatch(SRC, /MailApp|GmailApp|sendEmail/);
});
