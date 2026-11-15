// Core tests (spec section 9). Exports a list of [name, fn]; run.js runs them and prints one line.
var Core = require('../src/core.js');
var assert = require('assert');
var T = [];
function t(name, fn) { T.push([name, fn]); }

var STAFF = [
  { name: 'Amy', group: 'Bar', points: 100 }, { name: 'Ben', group: 'Bar', points: 100 }, { name: 'Cara', group: 'Bar', points: 100 },
  { name: 'Dan', group: 'Kitchen', points: 200 }, { name: 'Eve', group: 'Kitchen', points: 100 }
];
var HOURS = [{ name: 'Amy', hours: 4000 }, { name: 'Ben', hours: 3000 }, { name: 'Cara', hours: 1000 }, { name: 'Dan', hours: 4000 }, { name: 'Eve', hours: 2000 }];
var TIPS = [{ date: '2026-10-03', amount: 110000, type: 'Card' }, { date: '2026-10-20', amount: 13457, type: 'Cash' }];
var EX = { tips: TIPS, staff: STAFF, hours: HOURS, from: '2026-10-01', to: '2026-10-31', groupsOn: true,
  groups: [{ name: 'Bar', pct: 70, method: 'Hours' }, { name: 'Kitchen', pct: 30, method: 'Hours × points' }], pool: 'period', tronc: 0 };
function shares(r) { var o = {}; r.people.forEach(function (p) { o[p.name] = p.share; }); return o; }

t('T6 worked example', function () {
  var r = Core.split(EX);
  assert.ok(r.ok, r.error);
  assert.deepStrictEqual(r.groups.map(function (g) { return g.pot; }), [86420, 37037]);
  assert.deepStrictEqual(shares(r), { Amy: 43210, Ben: 32408, Cara: 10802, Dan: 29630, Eve: 7407 });
  assert.strictEqual(Core.ruleText(EX), 'Bar 70% hours; Kitchen 30% hours×points; whole period');
});
t('T4 VAT and negative tips', function () {
  var tt = Core.tipsTotal([{ date: '2026-10-01', amount: 1200, vat: 200, type: 'Service charge' }, { date: '2026-10-02', amount: -300, type: 'Card' }, { date: '2026-11-01', amount: 999 }], '2026-10-01', '2026-10-31');
  assert.strictEqual(tt.total, 700); assert.strictEqual(tt.byType['Service charge'], 1000); assert.strictEqual(tt.count, 2);
  assert.strictEqual(Core.safeText('=SUM(A1)'), "'=SUM(A1)"); assert.strictEqual(Core.safeText('+44'), "'+44"); assert.strictEqual(Core.safeText('-x'), "'-x"); assert.strictEqual(Core.safeText('@me'), "'@me"); assert.strictEqual(Core.safeText('Amy'), 'Amy');
});
t('T5 hours and names', function () {
  assert.strictEqual(Core.parseHours('7:30'), 750); assert.strictEqual(Core.parseHours('7.5'), 750); assert.strictEqual(Core.parseHours(8), 800); assert.strictEqual(Core.parseHours('x'), null);
  var c = Core.checkHours(STAFF.concat([{ name: 'Fay' }]), HOURS.concat([{ name: 'Jo B', hours: 500 }]), '2026-10-01', '2026-10-31', 'October');
  assert.ok(c.messages.some(function (m) { return m.text === '"Jo B" has hours but isn\'t on the Staff sheet. Add them, or fix the name.'; }));
  assert.ok(c.messages.some(function (m) { return m.text === 'Fay has no hours in October, so gets no share unless the rule is Equal.'; }));
  var ok = Core.checkHours(STAFF, HOURS, '2026-10-01', '2026-10-31', 'October');
  assert.strictEqual(ok.messages.length, 0); assert.strictEqual(ok.total, 14000); assert.strictEqual(ok.people, 5);
});
t('T7 property 10000 cases', function () {
  var seed = 7; function rnd(n) { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; }
  for (var i = 0; i < 10000; i++) {
    var n = rnd(5000000) - 1000, k = 1 + rnd(12), w = [];
    for (var j = 0; j < k; j++) w.push(rnd(3) === 0 ? 0 : rnd(100000));
    if (w.every(function (x) { return x === 0; })) w[0] = 1;
    var s = Core.largestRemainder(n, w), W = w.reduce(function (a, b) { return a + b; }, 0);
    assert.strictEqual(s.reduce(function (a, b) { return a + b; }, 0), n);
    s.forEach(function (x, j2) { assert.ok(Math.abs(x - n * w[j2] / W) < 1 + 1e-6); });
    assert.deepStrictEqual(Core.largestRemainder(n, w), s);
  }
});
t('T8 methods', function () {
  var base = { tips: TIPS, staff: STAFF, hours: HOURS, from: '2026-10-01', to: '2026-10-31', groupsOn: false, pool: 'period', tronc: 0 };
  var eq = Core.split(Object.assign({}, base, { method: 'Equal' }));
  assert.deepStrictEqual(shares(eq), { Amy: 24692, Ben: 24692, Cara: 24691, Dan: 24691, Eve: 24691 });
  var eqNoHours = Core.split(Object.assign({}, base, { method: 'Equal', hours: [] }));
  assert.strictEqual(eqNoHours.sharers, 5);
  var st = STAFF.map(function (s, i) { return Object.assign({}, s, { points: [150, 125, 0, 200, 100][i] }); });
  var pt = Core.split(Object.assign({}, base, { method: 'Points', staff: st }));
  assert.strictEqual(shares(pt).Cara, 0); assert.strictEqual(pt.Tsplit, 123457);
  var tot = 0; pt.people.forEach(function (p) { tot += p.share; }); assert.strictEqual(tot, 123457);
  assert.strictEqual(Core.parsePoints('1.25'), 125); assert.strictEqual(Core.parsePoints(''), 100); assert.strictEqual(Core.parsePoints('0'), 0); assert.strictEqual(Core.parsePoints('-1'), null);
  var hp = Core.split(Object.assign({}, base, { method: 'Hours × points', staff: st }));
  assert.strictEqual(shares(hp).Cara, 0);
  var hh = Core.split(Object.assign({}, base, { method: 'Hours' }));
  assert.deepStrictEqual(shares(hh), { Amy: 35274, Ben: 26455, Cara: 8818, Dan: 35273, Eve: 17637 });
});
t('T9 each day', function () {
  var o = { tips: [{ date: '2026-10-01', amount: 1000 }, { date: '2026-10-02', amount: 2000 }], staff: [{ name: 'A' }, { name: 'B' }],
    hours: [{ date: '2026-10-01', name: 'A', hours: 500 }, { date: '2026-10-02', name: 'B', hours: 500 }],
    from: '2026-10-01', to: '2026-10-31', groupsOn: false, method: 'Hours', pool: 'day', tronc: 300 };
  var r = Core.split(o);
  assert.ok(r.ok, r.error); assert.deepStrictEqual(shares(r), { A: 900, B: 1800 }); assert.strictEqual(r.days, 2);
  var e1 = Core.split(Object.assign({}, o, { hours: o.hours.concat([{ name: 'A', hours: 100 }]) }));
  assert.strictEqual(e1.error, 'Each-day sharing needs a date on every Hours row.');
  var e2 = Core.split(Object.assign({}, o, { tips: o.tips.concat([{ date: '2026-10-12', amount: 500 }]) }));
  assert.strictEqual(e2.error, '12 Oct has tips but no hours. Add hours for that day, or share by the whole period.');
  assert.strictEqual(Core.split(Object.assign({}, o, { tronc: 4000 })).error, 'The tronc amount can\'t be more than the tips.');
  assert.strictEqual(Core.split(Object.assign({}, o, { tips: [], tronc: 0 })).error, 'There are no tips to share in this period.');
});
t('T10 groups', function () {
  var o = Object.assign({}, EX, { groups: [{ name: 'Bar', pct: 70, method: 'Hours' }, { name: 'Kitchen', pct: 25, method: 'Hours' }] });
  assert.strictEqual(Core.split(o).error, 'Group shares add up to 95%. Make them 100%.');
  var o2 = Object.assign({}, EX, { hours: HOURS.slice(0, 3) });
  assert.strictEqual(Core.split(o2).error, 'Nobody in Kitchen has hours in this period. Set its share to 0%, or add hours.');
  var o3 = Object.assign({}, o2, { groups: [{ name: 'Bar', pct: 100, method: 'Hours' }, { name: 'Kitchen', pct: 0, method: 'Hours' }] });
  assert.ok(Core.split(o3).ok);
});
t('T11 GB deadline', function () {
  assert.strictEqual(Core.gbDeadline('2026-10-01'), '2026-11-30');
  assert.strictEqual(Core.gbDeadline('2026-10-25'), '2026-11-30');
  assert.strictEqual(Core.gbDeadline('2027-01-15'), '2027-02-28');
  assert.strictEqual(Core.d('2026-11-30', 'long'), '30 November 2026');
});
t('T12 Ireland statement date', function () {
  assert.strictEqual(Core.ieStatementBy('2026-10-28'), '2026-11-07');
  assert.strictEqual(Core.ieStatementBy('2026-12-28'), '2027-01-07');
});
t('T20 request range', function () {
  var r = Core.requestRange('2026-11-06', '2023-11', '2026-10');
  assert.deepStrictEqual(r.errors, []); assert.strictEqual(r.min, '2023-11'); assert.strictEqual(r.max, '2026-10'); assert.strictEqual(r.replyBy, '2026-12-03');
  var bad = Core.requestRange('2026-11-06', '2023-10', '2026-11');
  assert.strictEqual(bad.errors[0].text, 'The months must start no more than 3 years before the request: November 2023 or later.');
  assert.strictEqual(bad.errors[1].text, 'The months must have ended before the request date: October 2026 or earlier.');
});
t('T16 T17 T21 record rows and letter', function () {
  var r = Core.split(EX), rows = Core.recordRows(r, EX, '2026-11-28', '2026-11-28 10:00');
  assert.strictEqual(rows.length, 5); assert.strictEqual(rows[0][0], '2026-10-01_2026-10-31'); assert.strictEqual(rows[0][19], '2029-11-28');
  assert.strictEqual(rows[0][18].length, 16); assert.strictEqual(rows[0][18], Core.fingerprint(rows));
  var blocks = Core.readRecord(rows); assert.strictEqual(blocks.length, 1); assert.ok(!blocks[0].changed);
  var edited = rows.map(function (x) { return x.slice(); }); edited[1][16] = '324.09';
  assert.ok(Core.readRecord(edited)[0].changed);
  var old = rows.map(function (x) { var y = x.slice(); y[17] = '2026-11-20 09:00'; y[21] = 'Replaced on 28 Nov 2026'; return y; });
  var L = Core.letterRows(Core.readRecord(old.concat(rows)), 'Amy', '2026-10', '2026-11');
  assert.strictEqual(L.rows[1].share, 43210); assert.strictEqual(L.rows[1].total, 123457); assert.strictEqual(L.sum.share, 43210);
  assert.deepStrictEqual(L.noShare, ['2026-10']);
});
t('T2 T3 CSV parsing', function () {
  var p = Core.parseCsv('﻿Date;Tip amount;Staff;Reference\n03/10/2026;"1.234,56";Amy;R1\n04/10/2026;0;Ben;R2\n05/10/2026;2,50;"Doe, Jo";R3\n');
  assert.strictEqual(p.sep, ';'); var m = Core.detectColumns(p.headers); assert.ok(m.found);
  var c = Core.csvTips(p, m, 'Till', null);
  assert.strictEqual(c.count, 2); assert.strictEqual(c.total, 123706); assert.strictEqual(c.tips[1].staff, 'Doe, Jo'); assert.strictEqual(c.first, '2026-10-03');
  assert.ok(!Core.detectColumns(['When', 'Money']).found);
  assert.strictEqual(Core.mappingKey(['B', 'a']), 'map:a|b');
  assert.ok(Core.ambiguousDates(['03/04/2026', '05/06/2026'])); assert.ok(!Core.ambiguousDates(['13/04/2026', '05/06/2026']));
  assert.strictEqual(Core.parseDate('03/04/2026'), '2026-04-03'); assert.strictEqual(Core.parseDate('03/04/2026', 'mdy'), '2026-03-04');
  assert.strictEqual(Core.parseDate('2026-10-05 14:22:01'), '2026-10-05'); assert.strictEqual(Core.parseDate('5 Oct 2026 14:22'), '2026-10-05');
  var tab = Core.parseCsv('Date\tTips\n2026-10-01\t£1,200.00\n'); assert.strictEqual(tab.sep, '\t'); assert.strictEqual(Core.csvTips(tab, Core.detectColumns(tab.headers)).total, 120000);
});
t('T15 duplicates', function () {
  var ex = [{ date: '2026-10-01', amount: 500, ref: 'A' }];
  var r = Core.dedupe(ex, [{ date: '2026-10-01', amount: 500, ref: 'A' }, { date: '2026-10-01', amount: 500, ref: 'B' }]);
  assert.strictEqual(r.skipped, 1); assert.strictEqual(r.tips.length, 1);
});
t('T24 free limit', function () {
  var six = STAFF.concat([{ name: 'Fay', group: 'Bar', points: 100 }]), h = HOURS.concat([{ name: 'Fay', hours: 500 }]);
  var r = Core.split(Object.assign({}, EX, { staff: six, hours: h }));
  assert.strictEqual(r.sharers, 6); assert.ok(Core.locked(r, false)); assert.ok(!Core.locked(r, true)); assert.ok(!Core.locked(Core.split(EX), false));
});
t('T25 licence states', function () {
  var today = '2026-11-15';
  assert.deepStrictEqual(Core.licenceState({ expiration: '2027-11-15 00:00:00' }, today), { pro: true, status: 'ok', expires: '2027-11-15' });
  assert.strictEqual(Core.licenceState({ expiration: null }, today).pro, true);
  assert.strictEqual(Core.licenceState({ expiration: '2026-11-01' }, today).status, 'expired');
  assert.strictEqual(Core.licenceState({ is_cancelled: true }, today).status, 'cancelled');
  assert.deepStrictEqual(Core.licenceState(null, today, '2026-11-10'), { pro: true, status: 'offline', left: 9 });
  assert.strictEqual(Core.licenceState(null, today, '2026-10-30').pro, false);
});
t('sha256 and uid', function () {
  assert.strictEqual(Core.sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.strictEqual(Core.sha256(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  var c = require('crypto');
  var s = 'Łódź é ✓ 😀 ' + 'x'.repeat(200);
  assert.strictEqual(Core.sha256(s), c.createHash('sha256').update(s, 'utf8').digest('hex'));
  assert.strictEqual(Core.uid('abc').length, 32);
});
module.exports = T;
