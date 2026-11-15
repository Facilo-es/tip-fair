/**
 * Tip Fair: reading and writing the sheets. One getValues() and one setValues() per operation.
 * Every text value is written through Core.safeText, so a name can't become a formula.
 * Logs never hold row data.
 */

var SHEETS = { staff: 'Staff', tips: 'Tips', hours: 'Hours', record: 'Record', shares: 'Shares' };
var HEADERS = {
  Staff: ['Name', 'Group', 'Points', 'Type', 'Agency', 'Statement language', 'Notes'],
  Tips: ['Date', 'Amount', 'Type', 'VAT part', 'Source', 'Reference'],
  Hours: ['Date', 'Name', 'Hours'],
  Record: Core.RECORD_COLS,
  Shares: ['Name', 'Group', 'Hours', 'Points', 'Share']
};

function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }

/** Settings live in Document Properties, so they travel with the spreadsheet. */
function settings_() {
  var raw = PropertiesService.getDocumentProperties().getProperty('tf');
  return raw ? JSON.parse(raw) : {};
}
function saveSettings_(patch) {
  var s = settings_();
  Object.keys(patch).forEach(function (k) { s[k] = patch[k]; });
  PropertiesService.getDocumentProperties().setProperty('tf', JSON.stringify(s));
  return s;
}

function isSetUp_() {
  var ss = ss_();
  return !!settings_().country && ['Staff', 'Tips', 'Hours', 'Record'].every(function (n) { return !!ss.getSheetByName(n); });
}

/** 5.1: adds the four sheets. Safe to run again: sheets that exist keep their data. */
function setupSheets_(country) {
  var ss = ss_(), first = null;
  ['Staff', 'Tips', 'Hours', 'Record'].forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (!sh) {
      sh = ss.insertSheet(name);
      sh.getRange(1, 1, 1, HEADERS[name].length).setValues([HEADERS[name]]).setFontWeight('bold');
      sh.setFrozenRows(1);
      if (name === 'Record') {
        // Plain text, so amounts and dates read back exactly as written and the fingerprint holds.
        sh.getRange(1, 1, sh.getMaxRows(), HEADERS.Record.length).setNumberFormat('@');
        sh.protect().setWarningOnly(true).setDescription('Written by Tip Fair');
      }
      if (name === 'Staff') {
        sh.getRange(2, 4, 500, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(Core.STAFF_TYPES, true).setAllowInvalid(true).build());
        sh.getRange(2, 6, 500, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(Core.LANGS, true).setAllowInvalid(true).build());
      }
      if (name === 'Tips') sh.getRange(2, 3, 5000, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(Core.TYPES, true).setAllowInvalid(true).build());
      if (name === 'Hours') sh.getRange(2, 3, 5000, 1).setNumberFormat('0.00');
      if (!first) first = sh;
    }
  });
  setNotes_(country);
  if (first) ss.setActiveSheet(ss.getSheetByName('Staff'));
}

/** Header notes (4). They follow the country, so changing it in Settings updates them. */
function setNotes_(country) {
  var ss = ss_(), tips = ss.getSheetByName('Tips'), rec = ss.getSheetByName('Record');
  if (tips) {
    tips.getRange(1, 2).setNote('What the customer paid as a tip, before any card fees. Don\'t take card fees off.');
    tips.getRange(1, 4).setNote('Only if this amount includes VAT, such as some service charges. Leave blank otherwise.');
    tips.getRange(1, 3).setNote(country === 'IE' ? 'In Ireland a service charge counts as an electronic tip and is shared like one.' : '');
  }
  if (rec) rec.getRange(1, 1).setNote(country === 'NI' ? 'Written by Tip Fair.' : 'Written by Tip Fair. Keep for 3 years from each payout.');
}

function rows_(name) {
  var sh = ss_().getSheetByName(name);
  if (!sh) return [];
  var n = sh.getLastRow() - 1, c = HEADERS[name].length;
  return n > 0 ? sh.getRange(2, 1, n, c).getValues() : [];
}
function str_(v) { return v == null ? '' : String(v).trim(); }

/** Staff, from the Staff sheet. Name is used everywhere, so Hours must match it. */
function readStaff_() {
  var out = [], bad = [], seen = {};
  rows_('Staff').forEach(function (r) {
    var name = str_(r[0]);
    if (!name || seen[name]) return;
    seen[name] = 1;
    var p = Core.parsePoints(r[2]);
    if (p == null) { bad.push(name); p = 100; }
    var type = str_(r[3]), lang = str_(r[5]);
    out.push({ name: name, full: name, group: str_(r[1]) || 'Staff', points: p, type: Core.STAFF_TYPES.indexOf(type) > -1 ? type : 'Worker',
      agency: str_(r[4]), lang: Core.LANGS.indexOf(lang) > -1 ? lang : 'English' });
  });
  return { staff: out, badPoints: bad };
}

function readTips_() {
  var out = [], bad = 0;
  rows_('Tips').forEach(function (r) {
    if (r[0] === '' && r[1] === '') return;
    var date = Core.parseDate(r[0]), amount = Core.parseAmount(r[1], false), vat = r[3] === '' ? 0 : Core.parseAmount(r[3], false);
    if (!date || amount == null || vat == null) { bad++; return; }
    var type = str_(r[2]);
    out.push({ date: date, amount: amount, type: Core.TYPES.indexOf(type) > -1 ? type : 'Card', vat: vat, source: str_(r[4]), ref: str_(r[5]) });
  });
  return { tips: out, bad: bad };
}

function readHours_() {
  var out = [], bad = 0;
  rows_('Hours').forEach(function (r) {
    var name = str_(r[1]);
    if (!name) return;
    var h = Core.parseHours(r[2]), date = r[0] === '' ? null : Core.parseDate(r[0]);
    if (h == null || (r[0] !== '' && !date)) { bad++; return; }
    out.push({ date: date, name: name, hours: h });
  });
  return { hours: out, bad: bad };
}

/** 5.3: appends imported tips under the last row, skipping ones already there. */
function appendTips_(incoming) {
  var have = readTips_().tips, d = Core.dedupe(have, incoming);
  if (d.tips.length) {
    var sh = ss_().getSheetByName('Tips');
    var vals = d.tips.map(function (t) {
      return [t.date, Core.plain(t.amount), t.type || 'Card', t.vat ? Core.plain(t.vat) : '', Core.safeText(t.source), Core.safeText(t.ref)];
    });
    var range = sh.getRange(sh.getLastRow() + 1, 1, vals.length, 6);
    range.setValues(vals.map(function (r) { return [toDate_(r[0]), Number(r[1]), r[2], r[3] === '' ? '' : Number(r[3]), r[4], r[5]]; }));
    sh.getRange(range.getRow(), 1, vals.length, 1).setNumberFormat('d mmm yyyy');
    sh.getRange(range.getRow(), 2, vals.length, 1).setNumberFormat('0.00');
  }
  return { added: d.tips.length, skipped: d.skipped };
}
function toDate_(iso) { return new Date(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)); }

/** The Record sheet as text, from row 2. */
function recordValues_() {
  var sh = ss_().getSheetByName('Record');
  if (!sh) return [];
  var n = sh.getLastRow() - 1;
  return n > 0 ? sh.getRange(2, 1, n, HEADERS.Record.length).getDisplayValues() : [];
}

/** 6.8: adds a finalised block. An earlier block for the same period is marked Replaced, never deleted. */
function writeRecord_(rows, id, today) {
  var sh = ss_().getSheetByName('Record'), old = recordValues_(), stamp = 'Replaced on ' + Core.d(today);
  var all = old.map(function (r) {
    var x = r.slice();
    if (x[0] === id && !/^Replaced/.test(x[21])) x[21] = stamp;
    return x;
  }).concat(rows);
  all = all.map(function (r) { return r.map(Core.safeText); });
  sh.getRange(2, 1, all.length, HEADERS.Record.length).setNumberFormat('@').setValues(all);
}

/** "Write shares to sheet": a Shares sheet for payroll, replaced each time. */
function writeSharesSheet_(r, title) {
  var ss = ss_(), sh = ss.getSheetByName('Shares') || ss.insertSheet('Shares');
  sh.clearContents();
  var vals = [[Core.safeText(title), '', '', '', ''], HEADERS.Shares];
  r.people.forEach(function (p) { vals.push([Core.safeText(p.full), Core.safeText(p.group), Core.hundredths(p.h), Core.hundredths(p.p), p.share / 100]); });
  sh.getRange(1, 1, vals.length, 5).setValues(vals);
  sh.getRange(1, 1, 2, 5).setFontWeight('bold');
  sh.getRange(3, 5, Math.max(r.people.length, 1), 1).setNumberFormat('0.00');
  sh.setFrozenRows(2);
  ss.setActiveSheet(sh);
}
