// Version-controlled newsletter receiver. Existing rows are never edited or deleted.
// Required Script Properties: FORM_SECRET, NEWSLETTER_SHEET_NAME.
function doPost(e) {
  try {
    var p = (e && e.parameter) || {};
    if (p.kind !== 'newsletter') return json_({ ok: false, error: 'unsupported' });
    var expected = PropertiesService.getScriptProperties().getProperty('FORM_SECRET');
    if (!expected || !constantTimeEqual_(String(p.secret || ''), expected)) {
      return json_({ ok: false, error: 'unauthorized' });
    }
    if (String(p.hp || '')) return json_({ ok: true });
    var elapsed = Number(p.t);
    if (!isFinite(elapsed) || elapsed < 1500 || elapsed > 86400000) return json_({ ok: false, error: 'invalid timing' });
    var email = String(p.email || '').trim().toLowerCase();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return json_({ ok: false, error: 'invalid email' });
    }
    var lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      var sheetName = PropertiesService.getScriptProperties().getProperty('NEWSLETTER_SHEET_NAME');
      if (!sheetName) throw new Error('NEWSLETTER_SHEET_NAME is not configured');
      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
      if (!sheet) throw new Error('Configured newsletter sheet does not exist');
      var lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0]
          .map(function (h) { return String(h).trim().toLowerCase(); });
        var emailColumn = headers.indexOf('email') + 1;
        if (!emailColumn) throw new Error('Newsletter sheet needs an Email header');
        var match = sheet.getRange(2, emailColumn, lastRow - 1, 1)
          .createTextFinder(email).matchEntireCell(true).matchCase(false).findNext();
        if (match) return json_({ ok: true, duplicate: true });
      }
      appendMappedRow_(sheet, { timestamp: new Date(), email: email, name: 'Newsletter',
        message: 'Newsletter signup', page: String(p.page || '').slice(0, 500), source: 'website' });
      return json_({ ok: true, duplicate: false });
    } finally { lock.releaseLock(); }
  } catch (error) {
    console.error('Newsletter signup failed: ' + error.message);
    return json_({ ok: false, error: 'storage failure' });
  }
}

function appendMappedRow_(sheet, values) {
  var width = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, width).getDisplayValues()[0];
  var row = headers.map(function (header) {
    var key = String(header).trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : '';
  });
  sheet.appendRow(row);
}

function constantTimeEqual_(a, b) {
  var mismatch = a.length ^ b.length;
  var length = Math.max(a.length, b.length);
  for (var i = 0; i < length; i++) mismatch |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return mismatch === 0;
}

function json_(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}
