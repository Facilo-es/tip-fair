/**
 * Tip Fair: shares tips fairly and keeps the records the tips laws ask for.
 * Sheets: Staff, Tips, Hours, Record (+ Shares when written). Settings, mappings and the licence in Document Properties.
 * The maths is in core.js, the documents in docs.js. Nothing here sends data out of the spreadsheet.
 */

function onOpen(e) {
  SpreadsheetApp.getUi().createAddonMenu().addItem('Open Tip Fair', 'showSidebar').addToUi();
}
function onInstall(e) { onOpen(e); }

function showSidebar() {
  SpreadsheetApp.getUi().showSidebar(HtmlService.createTemplateFromFile('Sidebar').evaluate().setTitle('Tip Fair'));
}
function include(name) { return HtmlService.createHtmlOutputFromFile(name).getContent(); }

function today_() { return Utilities.formatDate(new Date(), ss_().getSpreadsheetTimeZone() || 'Europe/London', 'yyyy-MM-dd'); }
function now_() { return Utilities.formatDate(new Date(), ss_().getSpreadsheetTimeZone() || 'Europe/London', "yyyy-MM-dd HH:mm"); }
function pro_() { return licenceState_(today_()).pro; }

/** 5.1 */
function setup(country, venue) {
  if (['GB', 'NI', 'IE'].indexOf(country) < 0) throw new Error('Choose where the venue is.');
  saveSettings_({ country: country, venue: String(venue || '').trim().slice(0, 120) || 'My venue' });
  setupSheets_(country);
  return getState();
}

function saveSettings(patch) {
  var keep = {};
  ['venue', 'country', 'contact'].forEach(function (k) { if (patch[k] != null) keep[k] = String(patch[k]).trim().slice(0, 120); });
  if (keep.country && ['GB', 'NI', 'IE'].indexOf(keep.country) < 0) delete keep.country;
  var s = saveSettings_(keep);
  if (keep.country) setNotes_(s.country);
  return getState();
}

function openSheet(name) {
  var sh = ss_().getSheetByName(name);
  if (sh) ss_().setActiveSheet(sh);
}

/** Default period: the month of the latest tip, or last month. Default payout: the 28th of the month after. */
function defaults_(tips, today) {
  var last = tips.reduce(function (a, t) { return t.date > a ? t.date : a; }, '');
  var ym = last ? last.slice(0, 7) : Core.addMonths(today.slice(0, 7), -1);
  return { from: ym + '-01', to: Core.monthEnd(ym + '-01'), payout: Core.addMonths(ym, 1) + '-28' };
}
function groupsFrom_(staff, saved) {
  var names = [];
  staff.forEach(function (s) { if (names.indexOf(s.group) < 0) names.push(s.group); });
  var old = {};
  (saved || []).forEach(function (g) { old[g.name] = g; });
  if (names.every(function (n) { return old[n]; }) && (saved || []).length === names.length) return saved;
  var base = Math.floor(10000 / Math.max(names.length, 1)), extra = 10000 - base * names.length;
  return names.map(function (n, i) { return old[n] || { name: n, pct: (base + (i === 0 ? extra : 0)) / 100, method: 'Hours' }; });
}

/** Everything the home screen (5.2) needs. Counts and totals only. */
function getState() {
  var s = settings_(), today = today_(), lic = licenceState_(today);
  if (!isSetUp_()) return { setUp: false, licence: lic, today: today };
  var st = readStaff_(), tp = readTips_(), hr = readHours_();
  var d = defaults_(tp.tips, today);
  var o = s.work && s.work.from ? s.work : {};
  var from = o.from || d.from, to = o.to || d.to;
  var tt = Core.tipsTotal(tp.tips, from, to);
  var hrs = hr.hours.filter(function (r) { return !r.date || (r.date >= from && r.date <= to); });
  var hTotal = hrs.reduce(function (a, r) { return a + r.hours; }, 0);
  var id = from + '_' + to, blocks = Core.readRecord(recordValues_());
  var fin = blocks.filter(function (b) { return b.id === id && !b.replaced; })[0];
  return {
    setUp: true, today: today, licence: lic,
    settings: { country: s.country, venue: s.venue, contact: s.contact || '' },
    staff: st.staff.map(function (x) { return { name: x.name, group: x.group, points: x.points, type: x.type }; }), badPoints: st.badPoints,
    tips: { total: tt.total, count: tt.count, bad: tp.bad, latest: d.from },
    hours: { total: hTotal, bad: hr.bad },
    work: { from: from, to: to, payout: o.payout || d.payout, groupsOn: o.groupsOn != null ? o.groupsOn : groupsFrom_(st.staff, []).length > 1,
      groups: groupsFrom_(st.staff, o.groups), method: o.method || 'Hours', pool: o.pool || 'period', tronc: o.tronc || 0 },
    finalised: fin ? { at: fin.at, changed: fin.changed } : null,
    records: blocks.filter(function (b) { return !b.replaced; }).length
  };
}

/** 5.4 */
function checkHours(from, to) {
  var st = readStaff_(), hr = readHours_();
  var r = Core.checkHours(st.staff, hr.hours, from, to, Core.d(from, 'm'));
  r.bad = hr.bad;
  return r;
}

/** 5.3: the sidebar parses the CSV and sends the tips it found. They are checked again here. */
function importTips(tips, mapping) {
  var clean = [];
  (tips || []).forEach(function (t) {
    var date = Core.parseDate(t.date), amount = typeof t.amount === 'number' ? Math.round(t.amount) : Core.parseAmount(t.amount, false);
    if (!date || amount == null) return;
    clean.push({ date: date, amount: amount, type: Core.TYPES.indexOf(t.type) > -1 ? t.type : 'Card', vat: Math.round(Number(t.vat) || 0),
      source: String(t.source || '').slice(0, 60), ref: String(t.ref || '').slice(0, 80) });
  });
  if (mapping && mapping.key && /^map:/.test(mapping.key)) {
    PropertiesService.getDocumentProperties().setProperty(mapping.key, JSON.stringify({ map: mapping.map, source: String(mapping.source || '').slice(0, 60), order: mapping.order || '' }));
  }
  return appendTips_(clean);
}
function getMapping(key) {
  if (!/^map:/.test(key)) return null;
  var raw = PropertiesService.getDocumentProperties().getProperty(key);
  return raw ? JSON.parse(raw) : null;
}

/** The split settings from the sidebar, kept so the next month starts from them. */
function cleanWork_(w) {
  var o = { from: Core.parseDate(w.from), to: Core.parseDate(w.to), payout: Core.parseDate(w.payout), groupsOn: !!w.groupsOn,
    method: Core.METHODS.indexOf(w.method) > -1 ? w.method : 'Hours', pool: w.pool === 'day' ? 'day' : 'period', tronc: Math.max(0, Math.round(Number(w.tronc) || 0)),
    groups: (w.groups || []).map(function (g) { return { name: String(g.name), pct: Number(g.pct) || 0, method: Core.METHODS.indexOf(g.method) > -1 ? g.method : 'Hours' }; }) };
  if (!o.from || !o.to || o.from > o.to) throw new Error('Choose the period again.');
  if (!o.payout) throw new Error('Choose the payout date.');
  return o;
}
function compute_(w) {
  var o = cleanWork_(w), st = readStaff_();
  saveSettings_({ work: o });
  o.tips = readTips_().tips; o.staff = st.staff; o.hours = readHours_().hours;
  return { o: o, r: Core.split(o), staff: st.staff };
}
function view_(o) {
  var s = settings_();
  return { country: s.country, venue: s.venue, contact: s.contact || '', from: o.from, to: o.to, payout: o.payout, groupsOn: o.groupsOn };
}

/** 5.5 → 5.6. Over 5 people without Pro, only group totals come back (6.10). */
function work(w) {
  var c = compute_(w), r = c.r;
  if (!r.ok) return { ok: false, error: r.error };
  var lock = Core.locked(r, pro_()), v = view_(c.o);
  var id = c.o.from + '_' + c.o.to, fin = Core.readRecord(recordValues_()).filter(function (b) { return b.id === id && !b.replaced; })[0];
  return {
    ok: true, locked: lock, T: r.T, R: r.R, Tsplit: r.Tsplit, byType: r.byType, count: r.count, sharers: r.sharers,
    groups: r.groups.map(function (g) {
      return { name: g.name, pct: g.pct, method: g.method, pot: g.pot, n: g.people.filter(function (p) { return p.share > 0; }).length,
        people: lock ? [] : g.people.map(function (p) { return { name: p.full, h: p.h, p: p.p, share: p.share }; }) };
    }),
    checks: Docs.checks(r, v, lock), saved: fin ? Docs.savedLine(v) : null, finalisedAt: fin ? fin.at : null
  };
}

/** 6.8 */
function finalise(w, note) {
  var c = compute_(w), r = c.r;
  if (!r.ok) return { ok: false, error: r.error };
  if (Core.locked(r, pro_())) return { ok: false, code: 'PRO' };
  var rows = Core.recordRows(r, c.o, c.o.payout, now_());
  if (note) rows[0][20] = String(note).slice(0, 200);
  writeRecord_(rows, c.o.from + '_' + c.o.to, today_());
  return { ok: true, saved: Docs.savedLine(view_(c.o)) };
}

function writeShares(w) {
  var c = compute_(w), r = c.r;
  if (!r.ok) return { ok: false, error: r.error };
  if (Core.locked(r, pro_())) return { ok: false, code: 'PRO' };
  writeSharesSheet_(r, settings_().venue + ': tip shares, ' + Core.d(c.o.from, 'long') + ' to ' + Core.d(c.o.to, 'long'));
  return { ok: true };
}

/** 5.8: finalised periods and the names in them, for the Records screen. */
function getRecords() {
  var blocks = Core.readRecord(recordValues_()), names = [];
  blocks.forEach(function (b) { if (!b.replaced) b.rows.forEach(function (r) { if (names.indexOf(r[12]) < 0) names.push(r[12]); }); });
  return {
    blocks: blocks.map(function (b) { return { id: b.id, from: b.from, to: b.to, paid: b.paid, total: b.total, at: b.at, people: b.rows.length, changed: b.changed, replaced: b.replaced, status: b.status }; }).reverse(),
    names: names.sort()
  };
}
function checkRequest(on, m1, m2) { return Core.requestRange(on, m1, m2); }

/**
 * Documents open in a print dialog (7). 'one' is free while the period isn't locked; the rest need Pro (6.10).
 * kind: 'one' {w, name} | 'all' {w} | 'letter' {worker, on, m1, m2} | 'policy' {w, a} | 'notice' {a}
 */
function print(kind, x) {
  var s = settings_(), html, title;
  if (kind !== 'one' && !pro_()) return { ok: false, code: 'PRO' };
  if (kind === 'one' || kind === 'all') {
    var c = compute_(x.w), r = c.r;
    if (!r.ok) return { ok: false, error: r.error };
    if (Core.locked(r, pro_())) return { ok: false, code: 'PRO' };
    var by = {};
    c.staff.forEach(function (p) { by[p.name] = p; });
    var only = kind === 'one' ? (r.people.filter(function (p) { return p.full === x.name; })[0] || {}).name : null;
    if (kind === 'one' && !only) return { ok: false, error: 'Choose a name from the list.' };
    html = Docs.statements(r, view_(c.o), by, only);
    title = kind === 'one' ? 'Statement' : 'Statements';
  } else if (kind === 'letter') {
    var q = Core.requestRange(x.on, x.m1, x.m2);
    if (q.errors.length) return { ok: false, error: q.errors[0].text };
    var L = Core.letterRows(Core.readRecord(recordValues_()), x.worker, x.m1, x.m2);
    html = Docs.letter(L, x, { country: s.country, venue: s.venue, contact: s.contact || '' });
    title = 'Reply letter';
  } else if (kind === 'policy') {
    var o = cleanWork_(x.w);
    x.a.today = today_();
    html = Docs.policy(o, x.a, { venue: s.venue });
    title = 'Tipping policy';
  } else if (kind === 'notice') {
    html = Docs.notice(x.a, { venue: s.venue });
    title = 'Tips notice';
  } else throw new Error('Unknown document');
  var t = HtmlService.createTemplateFromFile('Print');
  t.data = html;
  SpreadsheetApp.getUi().showModalDialog(t.evaluate().setWidth(860).setHeight(640), title);
  return { ok: true };
}

/** 5.10: the notice as text to copy to a website. */
function noticeText(a) {
  if (!pro_()) return { ok: false, code: 'PRO' };
  return { ok: true, text: Docs.noticeText(a, { venue: settings_().venue }) };
}
