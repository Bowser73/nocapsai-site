// Runs the live Apps Script receiver (Code.gs) in Node with stand-ins for Apps Script services.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const SRC = fs.readFileSync('integrations/google-apps-script/Code.gs', 'utf8');
const HEADER = ["TimeStamp", "Name", "Phone", "Email", "Message", "Page", "Source", "Kind", "Status", "NormalizedEmail"];

function world({ verify = { success: true, action: 'newsletter_signup', hostname: 'nocapsai.com' }, props, rows } = {}) {
  const P = props || { TURNSTILE_SECRET: 'srv-secret', SHEET_ID: 'sheet-1', NOTIFY_EMAIL: 'njwhitt@nocapsai.com' };
  const data = [HEADER.slice(), ...(rows || [['2026-10-01', 'Newsletter', '', 'existing@example.com', 'Newsletter signup', 'https://nocapsai.com/', 'website', 'newsletter', 'new', 'existing@example.com']])];
  const before = JSON.stringify(data);
  const cache = {}, fetches = [], mails = [];
  const sheet = {
    getLastRow: () => data.length,
    getRange: (r, c, nr = 1, nc = 1) => ({
      getValues: () => data.slice(r - 1, r - 1 + nr).map(row => { const out = []; for (let i = 0; i < nc; i++) out.push(row[c - 1 + i] ?? ''); return out; }),
      setValue: v => { data[r - 1][c - 1] = v; } }),
    appendRow: row => data.push(row.slice())
  };
  const g = {
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in P ? P[k] : null) }) },
    CacheService: { getScriptCache: () => ({ get: k => cache[k] || null, put: (k, v) => { cache[k] = v; } }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
    SpreadsheetApp: { openById: id => ({ getSheetByName: n => (id === 'sheet-1' && n === 'WebsiteLeads' ? sheet : null), insertSheet: () => sheet }) },
    UrlFetchApp: { fetch: (url, o) => { fetches.push({ url, o }); return { getResponseCode: () => 200, getContentText: () => JSON.stringify(verify) }; } },
    MailApp: { sendEmail: m => mails.push(m) },
    Utilities: { base64EncodeWebSafe: x => String(x), computeDigest: (a, s) => s, DigestAlgorithm: { SHA_256: 1 } },
    ContentService: { createTextOutput: t => ({ setMimeType: () => JSON.parse(t) }), MimeType: { JSON: 'json' } },
    console: { error() {}, warn() {}, log() {} }, Date, JSON, Math, Number, String, isFinite
  };
  vm.runInNewContext(SRC, g);
  const post = params => JSON.parse(JSON.stringify(g.doPost({ parameter: params })));
  return { post, data, before, fetches, mails };
}
const good = (o = {}) => Object.assign({ kind: 'newsletter', name: 'Newsletter', email: 'New.Person@Example.com', t: '6000', hp: '',
  turnstileToken: 'tok', message: 'Newsletter signup', page: 'https://nocapsai.com/', source: 'website' }, o);

test('legitimate signup: token verified server-side, one row appended, existing rows untouched', () => {
  const w = world();
  assert.deepEqual(w.post(good()), { ok: true });
  assert.equal(w.fetches.length, 1);
  assert.equal(w.fetches[0].url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
  assert.equal(w.fetches[0].o.payload.secret, 'srv-secret');
  assert.equal(w.data.length, 3);
  const row = w.data[2];
  assert.equal(row[3], 'new.person@example.com'); assert.equal(row[7], 'newsletter'); assert.equal(row[8], 'new');
  assert.equal(JSON.stringify(w.data.slice(0, 2)), JSON.stringify(JSON.parse(w.before)));
});

test('no email ever goes to the subscriber; only the capped internal notice to NOTIFY_EMAIL', () => {
  const w = world();
  w.post(good());
  assert.equal(w.mails.length, 1);
  assert.equal(w.mails[0].to, 'njwhitt@nocapsai.com');
  assert.ok(!JSON.stringify(w.mails).includes('"to":"new.person@example.com"'));
});

test('duplicates (including Gmail dot/+tag variants) add no row and send no notice', () => {
  const w = world({ rows: [['x', 'Newsletter', '', 'janedoe@gmail.com', 'Newsletter signup', '', 'website', 'newsletter', 'new', 'janedoe@gmail.com']] });
  assert.deepEqual(w.post(good({ email: 'Jane.Doe+news@gmail.com' })), { ok: true });
  assert.equal(w.data.length, 2);
  assert.equal(w.mails.length, 0);
});

test('invalid, missing, wrong-action and wrong-host tokens are rejected before the sheet', () => {
  for (const [verify, tok] of [
    [{ success: false, 'error-codes': ['invalid-input-response'] }, 'tok'],
    [{ success: true, action: 'other', hostname: 'nocapsai.com' }, 'tok'],
    [{ success: true, action: 'newsletter_signup', hostname: 'evil.example' }, 'tok'],
    [{ success: true, action: 'newsletter_signup', hostname: 'nocapsai.com' }, '']]) {
    const w = world({ verify });
    assert.deepEqual(w.post(good({ turnstileToken: tok })), { ok: false, error: 'verification_failed' });
    assert.equal(w.data.length, 2); assert.equal(w.mails.length, 0);
  }
});

test('the old browser form key alone no longer works', () => {
  const w = world({ verify: { success: false } });
  const r = w.post(good({ turnstileToken: undefined, secret: '23DDDDA126981E83136C51E30ED4D60279CABD8AF7048FC9' }));
  assert.equal(r.ok, false); assert.equal(w.data.length, 2);
  assert.doesNotMatch(SRC, /getProperty\("FORM_SECRET"\)/);
});

test('bot submissions (honeypot, too fast) are dropped silently without calling Cloudflare', () => {
  const w = world();
  assert.deepEqual(w.post(good({ hp: 'http://spam' })), { ok: true });
  assert.deepEqual(w.post(good({ t: '300' })), { ok: true });
  assert.equal(w.data.length, 2); assert.equal(w.fetches.length, 0); assert.equal(w.mails.length, 0);
});

test('missing Turnstile secret fails closed', () => {
  const w = world({ props: { SHEET_ID: 'sheet-1', NOTIFY_EMAIL: 'njwhitt@nocapsai.com' } });
  assert.deepEqual(w.post(good()), { ok: false, error: 'server not configured' });
  assert.equal(w.data.length, 2);
});

test('formula injection is neutralised and invalid email rejected', () => {
  const w = world();
  w.post(good({ name: '=HYPERLINK("x")' }));
  assert.equal(w.data[2][1], '\'=HYPERLINK("x")');
  assert.deepEqual(world().post(good({ email: 'nope' })), { ok: false, error: 'invalid email' });
});
