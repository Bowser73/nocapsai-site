// NoCapsAI newsletter receiver (Google Apps Script web app).
//
// Security model:
//   * Every signup must carry a Cloudflare Turnstile token. It is verified HERE, server-side,
//     against Cloudflare's siteverify API using TURNSTILE_SECRET from Script Properties.
//     The secret never appears in website code.
//   * The old shared FORM_SECRET is no longer accepted or required (it was visible in public JS).
//   * Honeypot and minimum fill-time checks, per-address and global rate limits.
//   * Append-only: existing rows are never edited or deleted. Duplicates are not re-added.
//   * This script sends NO email of any kind (no auto-replies to subscribers).
//
// Script Properties (Project Settings > Script properties):
//   TURNSTILE_SECRET          required  Turnstile secret key (Cloudflare > Turnstile > widget)
//   NEWSLETTER_SHEET_NAME     required  exact name of the existing tab that holds signups
//   TURNSTILE_ALLOWED_HOSTS   optional  comma list, default "nocapsai.com,www.nocapsai.com"
//   FORM_SECRET               remove    no longer used; delete it after this version is live

var TURNSTILE_ACTION = 'newsletter_signup';
var SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
var MIN_FILL_MS = 1500;
var MAX_FILL_MS = 86400000;
var GLOBAL_LIMIT_PER_10_MIN = 30;

function doPost(e) {
  return json_(handleNewsletter_((e && e.parameter) || {}, services_()));
}

function doGet() {
  return json_({ ok: false, error: 'unsupported' });
}

// Real Apps Script services, wrapped so tests can substitute them.
function services_() {
  var props = PropertiesService.getScriptProperties();
  var cache = CacheService.getScriptCache();
  return {
    prop: function (k) { return props.getProperty(k); },
    cacheGet: function (k) { return cache.get(k); },
    cachePut: function (k, v, s) { cache.put(k, v, s); },
    fetch: function (url, opts) {
      var r = UrlFetchApp.fetch(url, opts);
      return { code: r.getResponseCode(), text: r.getContentText() };
    },
    withLock: function (fn) {
      var lock = LockService.getScriptLock();
      lock.waitLock(10000);
      try { return fn(); } finally { lock.releaseLock(); }
    },
    sheet: function (name) { return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name); },
    log: function (m) { console.warn(m); },
    now: function () { return new Date(); }
  };
}

function handleNewsletter_(p, svc) {
  try {
    if (p.kind !== 'newsletter') return { ok: false, error: 'unsupported' };

    // Bots that fill the hidden field get a quiet "ok" and nothing is stored.
    if (String(p.hp || '')) return { ok: true };

    var elapsed = Number(p.t);
    if (!isFinite(elapsed) || elapsed < MIN_FILL_MS || elapsed > MAX_FILL_MS) {
      return { ok: false, error: 'verification_failed' };
    }

    var email = String(p.email || '').trim().toLowerCase();
    if (email.length > 254 || !EMAIL_RE.test(email)) return { ok: false, error: 'invalid_email' };

    var secret = svc.prop('TURNSTILE_SECRET');
    var sheetName = svc.prop('NEWSLETTER_SHEET_NAME');
    if (!secret || !sheetName) {
      svc.log('Newsletter receiver not configured (TURNSTILE_SECRET / NEWSLETTER_SHEET_NAME).');
      return { ok: false, error: 'unavailable' }; // fail closed
    }

    if (!verifyTurnstile_(String(p.turnstileToken || ''), secret, svc)) {
      return { ok: false, error: 'verification_failed' };
    }

    // Rate limits (after verification, so unverified traffic can't exhaust them).
    var g = Number(svc.cacheGet('nl:global') || 0);
    if (g >= GLOBAL_LIMIT_PER_10_MIN) return { ok: false, error: 'rate_limited' };
    svc.cachePut('nl:global', String(g + 1), 600);
    var ek = 'nl:e:' + email.slice(0, 200); // CacheService keys max 250 chars
    if (svc.cacheGet(ek)) return { ok: true, duplicate: true }; // same address seconds ago

    return svc.withLock(function () {
      var sheet = svc.sheet(sheetName);
      if (!sheet) throw new Error('Configured newsletter sheet does not exist');
      var width = sheet.getLastColumn();
      var headers = sheet.getRange(1, 1, 1, width).getDisplayValues()[0]
        .map(function (h) { return String(h).trim().toLowerCase(); });
      var emailCol = headers.indexOf('email') + 1;
      if (!emailCol) throw new Error('Newsletter sheet needs an Email header');
      var lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        var match = sheet.getRange(2, emailCol, lastRow - 1, 1)
          .createTextFinder(email).matchEntireCell(true).matchCase(false).findNext();
        if (match) return { ok: true, duplicate: true };
      }
      var values = { timestamp: svc.now(), email: cell_(email), name: 'Newsletter',
                     message: 'Newsletter signup', page: cell_(String(p.page || '').slice(0, 500)),
                     source: 'website' };
      sheet.appendRow(headers.map(function (h) {
        return Object.prototype.hasOwnProperty.call(values, h) ? values[h] : '';
      }));
      svc.cachePut(ek, '1', 600);
      return { ok: true, duplicate: false };
    });
  } catch (err) {
    svc.log('Newsletter signup failed: ' + (err && err.message));
    return { ok: false, error: 'storage_failure' };
  }
}

function verifyTurnstile_(token, secret, svc) {
  if (!token || token.length > 2048) return false;
  var res = svc.fetch(SITEVERIFY_URL, {
    method: 'post',
    payload: { secret: secret, response: token },
    muteHttpExceptions: true
  });
  if (res.code !== 200) { svc.log('Turnstile siteverify HTTP ' + res.code); return false; }
  var body;
  try { body = JSON.parse(res.text); } catch (e) { return false; }
  if (body.success !== true) return false;
  if (body.action !== TURNSTILE_ACTION) return false;
  var allowed = String(svc.prop('TURNSTILE_ALLOWED_HOSTS') || 'nocapsai.com,www.nocapsai.com')
    .split(',').map(function (h) { return h.trim().toLowerCase(); });
  return allowed.indexOf(String(body.hostname || '').toLowerCase()) !== -1;
}

// Text from the internet is stored as text, never as a spreadsheet formula.
function cell_(v) {
  v = String(v);
  return /^[=+\-@\t\r]/.test(v) ? "'" + v : v;
}

function json_(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}
