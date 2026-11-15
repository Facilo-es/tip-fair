// Server tests: the real .gs files on the fake spreadsheet. T numbers match spec section 9; S tests are extra.
var F = require('./fake.js'), assert = require('assert');
var T = [];
function t(name, fn) { T.push([name, fn]); }
var NOW = '2026-11-15T10:00:00Z';

function fresh(country) {
  var ss = new F.Spreadsheet([new F.Sheet('Sheet1')]), g = F.load(ss, { now: NOW, quiet: true });
  g.setup(country || 'GB', 'The Red Lion');
  return { ss: ss, g: g };
}
function put(ss, name, rows) {
  var sh = ss.getSheetByName(name);
  sh.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
}
/** The 6.6 example: October 2026, Bar 70% by hours, Kitchen 30% by hours × points. */
function example(country) {
  var x = fresh(country);
  put(x.ss, 'Staff', [['Amy', 'Bar', 1, 'Worker', '', 'English', ''], ['Ben', 'Bar', 1, 'Worker', '', 'Polish', ''], ['Cara', 'Bar', 1, 'Worker', '', 'Spanish', ''],
    ['Dan', 'Kitchen', 2, 'Worker', '', 'English', ''], ['Eve', 'Kitchen', 1, 'Agency worker', 'ShiftPro', 'Romanian', '']]);
  put(x.ss, 'Tips', [[new Date(2026, 9, 3), 1100, 'Card', '', 'Square', 'A1'], [new Date(2026, 9, 20), 134.57, 'Cash', '', '', '']]);
  put(x.ss, 'Hours', [['', 'Amy', 40], ['', 'Ben', 30], ['', 'Cara', 10], ['', 'Dan', 40], ['', 'Eve', 20]]);
  return x;
}
function W(g) {
  var w = JSON.parse(JSON.stringify(g.getState().work));
  w.groupsOn = true;
  w.groups = [{ name: 'Bar', pct: 70, method: 'Hours' }, { name: 'Kitchen', pct: 30, method: 'Hours × points' }];
  return w;
}
function shares(r) { var o = {}; r.groups.forEach(function (gr) { gr.people.forEach(function (p) { o[p.name] = p.share; }); }); return o; }
function pro(g) { g.recordLicence({ status: 'ok', key: 'sk_test_1234', expires: '2027-11-15', installId: '9' }); }

t('T1 setup adds four sheets with headers, notes and a warning-only Record, and is safe to run again', function () {
  var x = fresh('GB'), ss = x.ss;
  ['Staff', 'Tips', 'Hours', 'Record'].forEach(function (n) { assert.ok(ss.getSheetByName(n), n); });
  assert.strictEqual(ss.getSheetByName('Tips').at(1, 2), 'Amount');
  assert.ok(/3 years/.test(ss.getSheetByName('Record').getRange(1, 1).getNote()));
  assert.strictEqual(ss.getSheetByName('Record').getProtections()[0].warning, true);
  put(ss, 'Staff', [['Amy', 'Bar', 1, 'Worker', '', 'English', '']]);
  var s = x.g.setup('GB', 'The Red Lion');
  assert.strictEqual(ss.getSheetByName('Staff').at(2, 1), 'Amy');
  assert.strictEqual(ss.getSheets().length, 5);
  assert.strictEqual(s.setUp, true);
  assert.strictEqual(s.settings.venue, 'The Red Lion');
  assert.throws(function () { x.g.setup('FR', 'x'); });
});

t('T14b Northern Ireland has no 3-year note', function () {
  var x = fresh('NI');
  assert.ok(!/3 years/.test(x.ss.getSheetByName('Record').getRange(1, 1).getNote()));
});

t('S2 getState: defaults to the month of the latest tip, payout the 28th after', function () {
  var x = example('GB'), s = x.g.getState();
  assert.strictEqual(s.work.from, '2026-10-01');
  assert.strictEqual(s.work.to, '2026-10-31');
  assert.strictEqual(s.work.payout, '2026-11-28');
  assert.strictEqual(s.tips.total, 123457);
  assert.strictEqual(s.hours.total, 14000);
  assert.strictEqual(s.staff.length, 5);
  assert.strictEqual(s.work.groupsOn, true);
});

t('T3 T4 T15 import: duplicates skipped, formula-looking text made safe, mapping remembered', function () {
  var x = fresh('GB');
  var tips = [{ date: '2026-10-03', amount: 1250, source: 'Square', ref: 'A1' }, { date: '2026-10-04', amount: 800, source: '=HYPERLINK("x")', ref: 'A2' }];
  var r = x.g.importTips(tips, { key: 'map:date|tip', map: { date: 0, tip: 1, staff: -1, ref: -1 }, source: 'Square', order: '' });
  assert.deepStrictEqual([r.added, r.skipped], [2, 0]);
  r = x.g.importTips(tips.concat([{ date: '2026-10-05', amount: 300, source: 'Square', ref: 'A3' }]), null);
  assert.deepStrictEqual([r.added, r.skipped], [1, 2]);
  var sh = x.ss.getSheetByName('Tips');
  assert.strictEqual(sh.at(3, 5), '=HYPERLINK("x")');
  assert.strictEqual(sh.isFormula(3, 5), false);
  assert.strictEqual(x.g.getMapping('map:date|tip').source, 'Square');
  assert.strictEqual(x.g.getMapping('nope'), null);
  assert.strictEqual(x.g.getState().tips.total, 2350);
});

t('T5 hours check names a person not on the Staff sheet', function () {
  var x = example('GB');
  put(x.ss, 'Hours', [['', 'Amy', 40], ['', 'Zed', 5]]);
  var h = x.g.checkHours('2026-10-01', '2026-10-31');
  assert.ok(h.messages.some(function (m) { return m.k === 'unknown' && /Zed/.test(m.text); }));
});

t('T6 the 6.6 example gives the spec shares to the penny', function () {
  var x = example('GB'), r = x.g.work(W(x.g));
  assert.ok(r.ok, r.error);
  assert.strictEqual(r.locked, false);
  assert.deepStrictEqual(shares(r), { Amy: 43210, Ben: 32408, Cara: 10802, Dan: 29630, Eve: 7407 });
  assert.strictEqual(r.Tsplit, 123457);
});

t('T16 T17 finalise writes the Record; a later edit is flagged as changed', function () {
  var x = example('GB'), w = W(x.g);
  var f = x.g.finalise(w, '');
  assert.ok(f.ok);
  assert.ok(/Record sheet/.test(f.saved));
  var s = x.g.getState();
  assert.strictEqual(s.records, 1);
  assert.strictEqual(s.finalised.changed, false);
  var rec = x.ss.getSheetByName('Record');
  rec.put(2, 13, 'Amy X');
  assert.strictEqual(x.g.getState().finalised.changed, true);
});

t('T17 finalising again marks the old block Replaced and keeps it', function () {
  var x = example('GB'), w = W(x.g);
  x.g.finalise(w, '');
  var n1 = x.ss.getSheetByName('Record').getLastRow();
  x.g.finalise(w, 'Hours corrected');
  var R = x.g.getRecords();
  assert.strictEqual(R.blocks.length, 2);
  assert.strictEqual(R.blocks.filter(function (b) { return b.replaced; }).length, 1);
  assert.strictEqual(x.ss.getSheetByName('Record').getLastRow(), (n1 - 1) * 2 + 1);
  assert.strictEqual(JSON.stringify(R.names), JSON.stringify(['Amy', 'Ben', 'Cara', 'Dan', 'Eve']));
});

t('T24 over 5 sharers without Pro: no individual shares, finalise and write refused, Pro unlocks', function () {
  var x = example('GB');
  put(x.ss, 'Staff', [['Fay', 'Kitchen', 1, 'Worker', '', 'English', '']].concat([]));
  x.ss.getSheetByName('Staff').getRange(7, 1, 1, 7).setValues([['Fay', 'Kitchen', 1, 'Worker', '', 'English', '']]);
  x.ss.getSheetByName('Staff').getRange(2, 1, 1, 7).setValues([['Amy', 'Bar', 1, 'Worker', '', 'English', '']]);
  x.ss.getSheetByName('Hours').getRange(7, 1, 1, 3).setValues([['', 'Fay', 10]]);
  var w = W(x.g), r = x.g.work(w);
  assert.strictEqual(r.sharers, 6);
  assert.strictEqual(r.locked, true);
  r.groups.forEach(function (g) { assert.strictEqual(g.people.length, 0); });
  assert.strictEqual(x.g.finalise(w, '').code, 'PRO');
  assert.strictEqual(x.g.writeShares(w).code, 'PRO');
  assert.strictEqual(x.g.print('one', { w: w, name: 'Amy' }).code, 'PRO');
  pro(x.g);
  r = x.g.work(w);
  assert.strictEqual(r.locked, false);
  assert.ok(x.g.finalise(w, '').ok);
});

t('S9 Pro badges: print all, letter, policy and notice need Pro; print one is free', function () {
  var x = example('GB'), w = W(x.g);
  assert.ok(x.g.print('one', { w: w, name: 'Amy' }).ok);
  assert.ok(/Amy/.test(x.ss.ui.dialog.html));
  assert.ok(!/Ben/.test(x.ss.ui.dialog.html.replace(/<style[\s\S]*?<\/style>/g, '')));
  assert.strictEqual(x.g.print('all', { w: w }).code, 'PRO');
  assert.strictEqual(x.g.print('notice', { a: {} }).code, 'PRO');
  assert.strictEqual(x.g.noticeText({}).code, 'PRO');
  pro(x.g);
  assert.ok(x.g.print('all', { w: w }).ok);
  x.g.finalise(w, '');
  assert.ok(x.g.print('letter', { worker: 'Amy', on: '2026-11-15', m1: '2026-10', m2: '2026-10' }).ok);
  assert.ok(/Amy/.test(x.ss.ui.dialog.html));
  assert.ok(x.g.print('policy', { w: w, a: { ask: 'no', ways: ['Card', 'Cash'], who: 'All staff', when: 'Monthly', consultOn: '2026-10-01', consultHow: 'Meeting', said: '', contact: 'Sam Taylor' } }).ok);
});

t('T25 licence: grace for 14 days offline, then Pro stops; a wrong key over a good one keeps Pro', function () {
  var x = example('GB');
  pro(x.g);
  assert.strictEqual(x.g.getState().licence.pro, true);
  x.g.recordLicence({ status: 'wrong', key: 'sk_other' });
  assert.strictEqual(x.g.getState().licence.pro, true);
  var req = x.g.licenceRequest('');
  assert.strictEqual(req.key, 'sk_test_1234');
  assert.strictEqual(req.ok, true); // Freemius product 44992
  assert.ok(/plugins\/44992\//.test(req.url) || /44992/.test(JSON.stringify(req)));
  var z = F.load(x.ss, { now: '2026-11-20T10:00:00Z', quiet: true });
  assert.strictEqual(z.getState().licence.needsCheck, true);
  z.recordLicence({ status: 'offline' });
  assert.strictEqual(z.getState().licence.pro, true); // 5 days into the grace
  var y = F.load(x.ss, { now: '2026-11-30T10:00:00Z', quiet: true });
  y.recordLicence({ status: 'offline' });
  assert.strictEqual(y.getState().licence.pro, false);
  y.recordLicence({ status: 'ok', key: 'sk_test_1234', expires: '2027-11-15' });
  assert.strictEqual(y.getState().licence.pro, true);
  y.recordLicence({ status: 'wrong', key: 'sk_test_1234' }); // the saved key itself refused
  assert.strictEqual(y.getState().licence.pro, false);
});

t('S15 write shares makes a Shares sheet', function () {
  var x = example('GB');
  assert.ok(x.g.writeShares(W(x.g)).ok);
  var sh = x.ss.getSheetByName('Shares');
  assert.strictEqual(sh.at(3, 1), 'Amy');
  assert.strictEqual(sh.at(3, 5), 432.1);
});

t('S16 sidebar and print templates load', function () {
  var x = fresh('GB');
  x.g.onOpen({}); x.g.showSidebar();
  var h = x.ss.ui.sidebar.getContent();
  assert.ok(/Core/.test(h) && /id="app"/.test(h) && !/<\?!=/.test(h));
  assert.strictEqual(JSON.stringify(x.ss.ui.menu), JSON.stringify([['Open Tip Fair', 'showSidebar']]));
});

t('S20 no row data in logs', function () {
  var x = example('GB'), w = W(x.g);
  x.g.work(w); x.g.finalise(w, ''); x.g.getRecords();
  assert.ok(!x.g.__logs.some(function (l) { return /Amy|Ben|Dan|1100|432/.test(l); }));
});

t('T27 speed: 50 staff, 10,000 tips and 3,000 hours rows in under 5 s', function () {
  var x = fresh('GB'), staff = [], tips = [], hours = [];
  for (var i = 0; i < 50; i++) staff.push(['P' + i, i < 30 ? 'Bar' : 'Kitchen', 100 + i, 'Worker', '', 'English', '']);
  for (i = 0; i < 10000; i++) tips.push([new Date(2026, 9, 1 + i % 31), 1 + (i % 17) / 10, i % 5 ? 'Card' : 'Cash', '', 'Till', 'R' + i]);
  for (i = 0; i < 3000; i++) hours.push([new Date(2026, 9, 1 + i % 31), 'P' + i % 50, 4 + i % 5]);
  put(x.ss, 'Staff', staff); put(x.ss, 'Tips', tips); put(x.ss, 'Hours', hours);
  pro(x.g);
  var t0 = Date.now(), w = W(x.g); w.pool = 'day';
  var r = x.g.work(w);
  x.g.finalise(w, '');
  var ms = Date.now() - t0;
  assert.ok(r.ok, r.error);
  assert.ok(ms < 5000, ms + ' ms');
});

t('T26 licence calls carry no name, amount or hours', function () {
  var x = example('GB'), w = W(x.g);
  x.g.work(w); x.g.finalise(w, '');
  pro(x.g);
  var req = x.g.licenceRequest('');
  assert.strictEqual(Object.keys(req).sort().join(','), 'apiBase,installId,key,ok,productId,title,uid');
  assert.ok(/^[0-9a-f]{16,64}$/.test(req.uid), req.uid);
  assert.ok(!/Amy|Ben|Cara|Dan|Eve|Red Lion|1100|134|432|Bar|Kitchen/.test(JSON.stringify(req)));
  // The sidebar sends Freemius only fields of that request: every call's URL and body use req.* or the install id.
  var html = require('fs').readFileSync(__dirname + '/../src/Sidebar.html', 'utf8');
  var lic = html.slice(html.indexOf('var Licence = {'), html.indexOf('draw();', html.indexOf('var Licence = {')));
  var calls = lic.match(/Licence\.request\([^;]*?function/g) || [];
  assert.strictEqual(calls.length, 3);
  calls.forEach(function (c) {
    var used = (c.replace(/'[^']*'/g, '').match(/[A-Za-z_$][\w$]*(?:\.[\w$]+)*/g) || []).filter(function (id) {
      return !/^(Licence\.request|req\.\w+|base|url|installId|encodeURIComponent|null|function|uid|license_key|title)$/.test(id);
    });
    assert.deepStrictEqual(used, [], c);
  });
});

t('S30 the paste bundle on its own: menu, sidebar, the 6.6 example and a printout', function () {
  require('child_process').execFileSync('node', [__dirname + '/../tools/bundle.js']);
  var ss = new F.Spreadsheet([new F.Sheet('Sheet1')]), g = F.load(ss, { now: NOW, quiet: true, bundle: true });
  // The Apps Script editor refuses BigInt literals such as 0n (ParseError on save).
  assert.ok(!/\b\d+n\b/.test(require('fs').readFileSync(__dirname + '/../dist/tip-fair.gs.txt', 'utf8').replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|\/\/.*$/gm, '')), 'BigInt literal in the bundle');
  g.onOpen({}); g.setup('GB', 'The Red Lion');
  put(ss, 'Staff', [['Amy', 'Bar', 1, 'Worker', '', 'English', ''], ['Ben', 'Bar', 1, 'Worker', '', 'Polish', ''], ['Cara', 'Bar', 1, 'Worker', '', 'Spanish', ''],
    ['Dan', 'Kitchen', 2, 'Worker', '', 'English', ''], ['Eve', 'Kitchen', 1, 'Agency worker', 'ShiftPro', 'Romanian', '']]);
  put(ss, 'Tips', [[new Date(2026, 9, 3), 1100, 'Card', '', 'Square', 'A1'], [new Date(2026, 9, 20), 134.57, 'Cash', '', '', '']]);
  put(ss, 'Hours', [['', 'Amy', 40], ['', 'Ben', 30], ['', 'Cara', 10], ['', 'Dan', 40], ['', 'Eve', 20]]);
  var r = g.work(W(g));
  assert.strictEqual(JSON.stringify(shares(r)), JSON.stringify({ Amy: 43210, Ben: 32408, Cara: 10802, Dan: 29630, Eve: 7407 }));
  g.showSidebar();
  var h = ss.ui.sidebar.getContent();
  assert.ok(/var Core = /.test(h) && /id="app"/.test(h) && /\.tf-side/.test(h) && !/<\?/.test(h));
  assert.ok(g.print('one', { w: W(g), name: 'Amy' }).ok);
  assert.ok(/Amy/.test(ss.ui.dialog.html) && !/<\?/.test(ss.ui.dialog.html));
});

module.exports = T;
