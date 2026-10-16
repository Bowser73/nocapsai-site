/**
 * Code.gs — NoCapsAI Website Lead Form (hardened 2026-10-14; Turnstile 2026-10-15)
 *
 * What it does now:
 *  - Records website signups / contact messages in the Google Sheet (unchanged sheet + columns, 3 columns appended).
 *  - Sends ONE internal notification to NOTIFY_EMAIL for new, non-duplicate, non-suspicious submissions (capped per hour).
 *  - Sends NOTHING to the submitted email address. Auto-replies were removed on 2026-10-14 after bot abuse.
 *    Do not add them back without Nate's approval. The previous version is backed up as Code.gs.before-20261014.
 *
 * Anti-abuse (all server-side):
 *  - Cloudflare Turnstile token verified here with TURNSTILE_SECRET (never in website code).
 *    The old browser form key (FORM_SECRET) is no longer used or accepted.
 *  - Honeypot field and minimum fill time; bots are dropped silently.
 *  - Strict field validation and length limits; spreadsheet formula injection neutralised.
 *  - Global rate limits per minute and per hour.
 *  - Duplicate prevention by normalised email (Gmail dots/+tags ignored), under a script lock so bursts cannot race.
 *  - Suspicious addresses (e.g. heavily dotted Gmail) are recorded as "suspected_bot" with no notification.
 *
 * Script Properties: TURNSTILE_SECRET, NOTIFY_EMAIL, SHEET_ID, SHEET_NAME (optional, default "WebsiteLeads"),
 *   TURNSTILE_ALLOWED_HOSTS (optional, default "nocapsai.com,www.nocapsai.com"). FORM_SECRET can be deleted.
 */

const CFG = {
  MAX_PER_MINUTE: 6,
  MAX_PER_HOUR: 40,
  MAX_NOTIFY_PER_HOUR: 10,
  MIN_FILL_MS: 2500,
  MAX_FILL_MS: 6 * 60 * 60 * 1000,
  TURNSTILE_ACTION: "newsletter_signup",
  LIMITS: { name: 100, phone: 40, email: 254, message: 2000, page: 300, source: 40, kind: 20 },
  HEADER: ["TimeStamp", "Name", "Phone", "Email", "Message", "Page", "Source", "Kind", "Status", "NormalizedEmail"]
};

function doPost(e) {
  try {
    const props = PropertiesService.getScriptProperties();
    const TURNSTILE_SECRET = (props.getProperty("TURNSTILE_SECRET") || "").trim();
    const NOTIFY_EMAIL = (props.getProperty("NOTIFY_EMAIL") || "").trim();
    const SHEET_ID = (props.getProperty("SHEET_ID") || "").trim();
    const SHEET_NAME = (props.getProperty("SHEET_NAME") || "WebsiteLeads").trim();
    const p = (e && e.parameter) ? e.parameter : {};

    // 1) Configuration. Without the Turnstile secret or the sheet, fail closed.
    if (!TURNSTILE_SECRET || !SHEET_ID) return _json({ ok: false, error: "server not configured" });

    // 2) Bot checks: honeypot must be empty; fill time must be human (client sends ms since page load).
    if (String(p.hp || "").trim() !== "") return _json({ ok: true });
    const fillMs = Number(p.t);
    if (!isFinite(fillMs) || fillMs < CFG.MIN_FILL_MS || fillMs > CFG.MAX_FILL_MS) return _json({ ok: true });

    // 2b) Cloudflare Turnstile, verified server-side. Missing or invalid token: reject without touching the sheet.
    if (!_verifyTurnstile(String(p.turnstileToken || ""), TURNSTILE_SECRET,
                          (props.getProperty("TURNSTILE_ALLOWED_HOSTS") || "nocapsai.com,www.nocapsai.com"))) {
      return _json({ ok: false, error: "verification_failed" });
    }

    // 3) Global rate limits.
    const cache = CacheService.getScriptCache();
    if (!_underLimit(cache, "rl:m:" + _bucket(60), CFG.MAX_PER_MINUTE, 120) ||
        !_underLimit(cache, "rl:h:" + _bucket(3600), CFG.MAX_PER_HOUR, 7200)) {
      return _json({ ok: false, error: "busy, please try again later" });
    }

    // 4) Validate and clean fields.
    const f = {
      kind: _clean(p.kind || "contact", CFG.LIMITS.kind).toLowerCase(),
      name: _clean(p.name, CFG.LIMITS.name),
      phone: _clean(p.phone, CFG.LIMITS.phone),
      email: _clean(p.email, CFG.LIMITS.email).toLowerCase(),
      message: _clean(p.message, CFG.LIMITS.message, true),
      page: _clean(p.page, CFG.LIMITS.page),
      source: _clean(p.source || "website", CFG.LIMITS.source)
    };
    if (["newsletter", "contact"].indexOf(f.kind) < 0) f.kind = "contact";
    if (!_validEmail(f.email)) return _json({ ok: false, error: "invalid email" });
    if (f.kind === "contact" && !f.message) return _json({ ok: false, error: "message required" });
    if (f.page && !/^https:\/\/([a-z0-9-]+\.)*nocapsai\.com(\/|$)/i.test(f.page)) f.page = "(other origin)";
    const norm = _normalizeEmail(f.email);

    // 5) Serialise writes so bursts cannot create duplicates.
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) return _json({ ok: false, error: "busy, please try again later" });
    let status;
    try {
      const sheet = _sheet(SHEET_ID, SHEET_NAME);
      const dup = _isDuplicate(sheet, norm, f.kind);
      status = dup ? "duplicate" : (_suspicious(f.email) ? "suspected_bot" : "new");
      if (!dup) {
        sheet.appendRow([new Date().toISOString(), f.name, f.phone, f.email, f.message, f.page, f.source,
                         f.kind, status, norm].map(_safeCell));
      }
    } finally {
      lock.releaseLock();
    }

    // 6) Internal notification only (never to the submitter), capped per hour.
    if (status === "new" && _validEmail(NOTIFY_EMAIL) &&
        _underLimit(cache, "rl:n:" + _bucket(3600), CFG.MAX_NOTIFY_PER_HOUR, 7200)) {
      MailApp.sendEmail({
        to: NOTIFY_EMAIL,
        subject: "New website " + f.kind + ": " + (f.name || f.email),
        body: "Kind: " + f.kind + "\nName: " + (f.name || "(none)") + "\nPhone: " + (f.phone || "(none)") +
              "\nEmail: " + f.email + "\nMessage: " + (f.message || "(none)") + "\nPage: " + (f.page || "(none)") +
              "\n\nNo automatic reply was sent to this person."
      });
    }

    // Same response for new and duplicate, so the form cannot be used to probe which addresses exist.
    return _json({ ok: true });
  } catch (err) {
    console.error(err);
    return _json({ ok: false, error: "server error" });
  }
}

function _verifyTurnstile(token, secret, allowedHosts) {
  if (!token || token.length > 2048) return false;
  const res = UrlFetchApp.fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "post",
    payload: { secret: secret, response: token },
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) { console.warn("Turnstile siteverify HTTP " + res.getResponseCode()); return false; }
  let body;
  try { body = JSON.parse(res.getContentText()); } catch (err) { return false; }
  if (body.success !== true || body.action !== CFG.TURNSTILE_ACTION) return false;
  const hosts = String(allowedHosts).split(",").map(function (h) { return h.trim().toLowerCase(); });
  return hosts.indexOf(String(body.hostname || "").toLowerCase()) !== -1;
}

function _sheet(id, name) {
  const ss = SpreadsheetApp.openById(id);
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(CFG.HEADER);
  } else {
    // Extend the existing header in place without moving existing data.
    const row = sheet.getRange(1, 1, 1, CFG.HEADER.length).getValues()[0];
    for (let i = 0; i < CFG.HEADER.length; i++) {
      if (String(row[i] || "") === "") sheet.getRange(1, i + 1).setValue(CFG.HEADER[i]);
    }
  }
  return sheet;
}

// Newsletter: one row per person, ever. Contact: repeats from the same address within 10 minutes are dropped,
// so a real person can still write again later.
function _isDuplicate(sheet, norm, kind) {
  if (kind === "contact") {
    const cache = CacheService.getScriptCache();
    const key = "dup:c:" + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, norm));
    if (cache.get(key)) return true;
    cache.put(key, "1", 600);
    return false;
  }
  const n = sheet.getLastRow();
  if (n < 2) return false;
  const rows = sheet.getRange(2, 4, n - 1, 7).getValues(); // columns D (Email) .. J (NormalizedEmail)
  for (let i = 0; i < rows.length; i++) {
    const stored = String(rows[i][6] || "") || _normalizeEmail(String(rows[i][0] || ""));
    const storedKind = String(rows[i][4] || "") || (/newsletter/i.test(String(rows[i][1] || "")) ? "newsletter" : "contact");
    if (stored === norm && storedKind === "newsletter") return true;
  }
  return false;
}

function _normalizeEmail(email) {
  const e = String(email || "").trim().toLowerCase();
  const at = e.lastIndexOf("@");
  if (at < 1) return e;
  let local = e.slice(0, at), domain = e.slice(at + 1);
  local = local.split("+")[0];
  if (domain === "gmail.com" || domain === "googlemail.com") { local = local.replace(/\./g, ""); domain = "gmail.com"; }
  return local + "@" + domain;
}

function _suspicious(email) {
  const e = String(email || "").toLowerCase();
  const at = e.lastIndexOf("@");
  const local = e.slice(0, at), domain = e.slice(at + 1);
  if ((domain === "gmail.com" || domain === "googlemail.com") && (local.match(/\./g) || []).length >= 3) return true;
  if (/^[a-z]{4,}\d{3,}@(hotmail|outlook)\.com$/.test(e) && /[bcdfghjklmnpqrstvwxz]{5,}/.test(local)) return true;
  return false;
}

function _validEmail(s) {
  const e = String(s || "");
  return e.length <= 254 && /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,}$/i.test(e);
}

function _clean(v, max, multiline) {
  let s = String(v == null ? "" : v);
  s = multiline ? s.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, "") : s.replace(/[\u0000-\u001F\u007F]/g, " ");
  return s.trim().slice(0, max);
}

function _safeCell(v) {
  const s = String(v == null ? "" : v);
  return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
}

function _bucket(seconds) {
  return Math.floor(Date.now() / 1000 / seconds);
}

function _underLimit(cache, key, max, ttl) {
  const n = Number(cache.get(key) || 0) + 1;
  cache.put(key, String(n), ttl);
  return n <= max;
}

function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
