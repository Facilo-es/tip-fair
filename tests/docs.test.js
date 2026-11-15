// Printout and check tests: T12 to T14, T18, T19, T22, T23.
var Core = require('../src/core.js'), Docs = require('../src/docs.js'), I18N = require('../src/i18n.js');
var assert = require('assert');
var T = [];
function t(name, fn) { T.push([name, fn]); }
var STAFF = [
  { name: 'Amy', full: 'Amy Clarke', group: 'Bar', points: 100, lang: 'English' }, { name: 'Ben', full: 'Ben Okafor', group: 'Bar', points: 100, lang: 'Polish' },
  { name: 'Cara', full: 'Cara Doyle', group: 'Bar', points: 100, type: 'Self-employed', lang: 'Spanish' }, { name: 'Dan', full: 'Dan Price', group: 'Kitchen', points: 200, type: 'Owner or manager', lang: 'Portuguese' },
  { name: 'Eve', full: 'Eve Marsh', group: 'Kitchen', points: 100, type: 'Agency worker', agency: 'ShiftPro', lang: 'Romanian' }
];
var HOURS = [{ name: 'Amy', hours: 4000 }, { name: 'Ben', hours: 3000 }, { name: 'Cara', hours: 1000 }, { name: 'Dan', hours: 4000 }, { name: 'Eve', hours: 2000 }];
var O = { tips: [{ date: '2026-10-03', amount: 110000, type: 'Card' }, { date: '2026-10-20', amount: 13457, type: 'Cash' }], staff: STAFF, hours: HOURS,
  from: '2026-10-01', to: '2026-10-31', groupsOn: true, groups: [{ name: 'Bar', pct: 70, method: 'Hours' }, { name: 'Kitchen', pct: 30, method: 'Hours × points' }], pool: 'period', tronc: 0 };
var R = Core.split(O), BY = {};
STAFF.forEach(function (s) { BY[s.name] = s; });
function V(c, payout) { return { country: c, venue: 'The Red Lion', contact: 'Sam Taylor', from: O.from, to: O.to, payout: payout || '2026-11-28', groupsOn: true }; }
function texts(list) { return list.map(function (x) { return x.text; }); }
var LEGAL = [/\blaw\b/i, /must reach/i, /Keep it until/i, /Reply by/i, /written statement/i, /10 days/i, /self-employed/i, /owner or manager/i, /3 years/i, /s27/i, /tipping policy/i];

t('T11 T13 checks', function () {
  var gb = texts(Docs.checks(R, V('GB'), false));
  assert.strictEqual(gb[0], 'Shares add up to £1,234.57 exactly.');
  assert.strictEqual(gb[1], 'Payout 28 Nov is on time. October tips must reach staff by 30 Nov 2026.');
  assert.ok(gb.some(function (x) { return /^Cara is self-employed\./.test(x); })); assert.ok(!gb.some(function (x) { return /owner or manager/.test(x); }));
  assert.strictEqual(texts(Docs.checks(R, V('GB', '2026-12-05'), false))[1], 'Tips paid in October must reach staff by 30 November 2026. Your payout date is 5 December.');
  var ie = texts(Docs.checks(R, V('IE', '2026-10-28'), false));
  assert.ok(ie.indexOf('Give each person their statement by 7 November 2026, within 10 days of payout.') > -1);
  assert.ok(ie.indexOf('Dan is an owner or manager. In Ireland they can only share in card tips if they regularly do the same work as the others, and only a fair share.') > -1);
  assert.ok(!ie.some(function (x) { return /self-employed/.test(x); }));
  assert.ok(texts(Docs.checks(R, V('GB'), true)).indexOf('5 people share in this period. Free covers up to 5. Upgrade to see each share.') > -1);
  assert.strictEqual(Docs.savedLine(V('GB')), 'October 2026 is saved in the Record sheet. Keep it until 28 Nov 2029.');
});
t('T14 Northern Ireland has no legal text', function () {
  var v = V('NI'), all = texts(Docs.checks(R, v, false)).join('\n') + Docs.savedLine(v) + Docs.statements(R, v, BY);
  var blocks = Core.readRecord(Core.recordRows(R, O, '2026-11-28', '2026-11-28 10:00'));
  all += Docs.letter(Core.letterRows(blocks, 'Amy Clarke', '2026-11', '2026-11'), { worker: 'Amy Clarke', on: '2026-12-02', m1: '2026-11', m2: '2026-11' }, v);
  LEGAL.forEach(function (re) { assert.ok(!re.test(all), 'NI text matches ' + re); });
  assert.ok(/Tips summary/.test(all));
});
t('T18 single statement shows only that person', function () {
  var s = Docs.statements(R, V('GB'), BY, 'Amy');
  assert.ok(/Amy Clarke/.test(s) && /£432\.10/.test(s) && /£1,234\.57/.test(s));
  ['Ben', 'Cara', 'Dan', 'Eve', '£324.08', '£108.02', '£296.30', '£74.07'].forEach(function (x) { assert.ok(s.indexOf(x) < 0, 'leaks ' + x); });
  assert.ok(s.indexOf('Bar shares 70% of the tips, by hours worked.') > -1 && s.indexOf(Docs.esc('You worked 40 of the Bar\'s 80 hours.')) > -1);
  assert.ok(s.indexOf('Questions? Ask Sam Taylor.') > -1 && s.indexOf('1 October 2026 to 31 October 2026') > -1);
  var dan = Docs.statements(R, V('GB'), BY, 'Dan');
  assert.ok(dan.indexOf(Docs.esc('You worked 40 hours at 2 points: 80 of the Kitchen\'s 100.')) > -1);
});
t('T19b statement explains the share in its own language, English under it', function () {
  var I = require('../src/i18n.js'), langs = ['Spanish', 'Polish', 'Portuguese', 'Romanian', 'Italian'];
  langs.forEach(function (lang) {
    var by = {}; Object.keys(BY).forEach(function (k) { by[k] = Object.assign({}, BY[k], { lang: lang }); });
    var amy = Docs.statements(R, V('GB'), by, 'Amy'), dan = Docs.statements(R, V('GB'), by, 'Dan');
    assert.ok(/\{|undefined/.test(amy + dan) === false, lang + ' has an unfilled word');
    assert.ok(amy.indexOf(Docs.esc('You worked 40 of the Bar\'s 80 hours.') + '</i>') > -1, lang + ' keeps the English under');
    assert.ok(amy.indexOf(' 40 ') > -1 && amy.indexOf('80') > -1 && dan.indexOf('40 × 2 = 80') > -1, lang);
    assert.ok(amy.indexOf(Docs.esc(I[lang].howWords.gs.split(' {')[0].replace('{g}', 'Bar'))) > -1 || amy.indexOf('Bar') > -1);
    var none = Docs.statements(R, Object.assign(V('GB'), { contact: '' }), by, 'Amy');
    assert.ok(none.indexOf(Docs.esc(I[lang].askNone) + '<i>Questions? Ask your manager.</i>') > -1, lang + ' no contact');
  });
  var pl = Docs.statements(R, V('GB'), Object.assign({}, BY, { Ben: Object.assign({}, BY.Ben, { lang: 'Polish' }) }), 'Ben');
  assert.ok(pl.indexOf('Bar dzieli 70% napiwków według przepracowanych godzin.<i>Bar shares 70% of the tips, by hours worked.</i>') > -1);
  assert.ok(pl.indexOf('Twoje godziny: 30 z 80 (Bar).') > -1);
});
t('T19 all statements, languages', function () {
  var all = Docs.statements(R, V('IE'), BY);
  assert.strictEqual((all.match(/<article class="tf-page/g) || []).length, 5);
  assert.ok(all.indexOf('Zestawienie napiwków<i>Tips statement</i>') > -1);
  assert.ok(all.indexOf('Agencia') < 0 && all.indexOf('Agenție<i>Agency</i>') > -1 && all.indexOf('ShiftPro') > -1);
  assert.ok(all.indexOf('This is your written statement of tips and gratuities for this period.') > -1 && all.indexOf('National Insurance') < 0);
  var keys = Object.keys(I18N.English);
  Object.keys(I18N).forEach(function (l) { keys.forEach(function (k) { assert.ok(I18N[l][k], l + ' misses ' + k); }); });
  assert.deepStrictEqual(Object.keys(I18N), Core.LANGS);
  Object.keys(I18N).forEach(function (l) {
    var st = STAFF.map(function (s) { return Object.assign({}, s, { lang: l }); }), by = {};
    st.forEach(function (s) { by[s.name] = s; });
    var one = Docs.statements(R, V('GB'), by, 'Amy');
    ['title', 'share', 'how', 'taxUK'].forEach(function (k) { assert.ok(one.indexOf(Docs.esc(I18N[l][k].replace('{v}', 'The Red Lion').replace('{c}', 'Sam Taylor'))) > -1, l + ' ' + k); });
  });
});
t('T22 policy', function () {
  var a = { ask: 'encourage', ways: ['Card', 'Cash'], who: 'All staff in the groups on the Split page', when: 'With the monthly pay, at the end of the next month', consultOn: '2026-10-14', consultHow: 'Meeting',
    said: 'Most staff want kitchen included.', contact: 'Sam Taylor', pointsMean: 'role: Head chef 2, Chef 1.5, Porter 1', today: '2026-11-06' };
  var p = Docs.policy(O, a, V('GB'));
  ['How we share tips at The Red Lion', 'We encourage customers to tip', 'Who shares', 'Bar staff share 70% of tips by hours worked. Kitchen staff share 30% by hours worked times points.',
    'Points stand for role: Head chef 2, Chef 1.5, Porter 1.', 'With the monthly pay', '100% of tips go to staff', 'records of your tips', 'on 14 October 2026', 'Most staff want kitchen included.',
    'This policy: 6 November 2026. Review due by 6 November 2029.', 'Made with Tip Fair. This is a template to help you write your own policy, not legal advice.']
    .forEach(function (x) { assert.ok(p.indexOf(Docs.esc(x)) > -1, 'policy misses ' + x); });
});
t('T23 notice', function () {
  var a = { card: true, how: 'By hours worked, between all staff on shift', pct: '100%', service: true, cash: 'Shared the same way' };
  var n = Docs.notice(a, V('IE')), txt = Docs.noticeText(a, V('IE'));
  [Docs.LAW, 'Cash tips are shared the same way.', 'Our service charge is shared with staff in the same way as card tips.'].forEach(function (x) { assert.ok(n.indexOf(Docs.esc(x)) > -1 && txt.indexOf(x) > -1, x); });
  assert.strictEqual((n.match(/<article/g) || []).length, 2);
});
t('no banned words', function () {
  var fs = require('fs'), dir = __dirname + '/../src/';
  fs.readdirSync(dir).forEach(function (f) {
    var s = fs.readFileSync(dir + f, 'utf8');
    [/\bcompliant\b/i, /guarantees compliance/i, /legally approved/i, /HMRC approved/i, /tamper-proof/i].forEach(function (re) { assert.ok(!re.test(s), f + ' has ' + re); });
  });
});
module.exports = T;
