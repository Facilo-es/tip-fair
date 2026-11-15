// Tip Fair printouts and result checks (spec 5.6 to 5.10). Pure: data in, HTML strings out, so tests can scan them.
// v = venue context: {country: 'GB'|'NI'|'IE', venue, contact, from, to, payout, groupsOn}
var Docs = (function () {
  'use strict';
  var C = typeof Core !== 'undefined' ? Core : require('./core.js');
  var W = typeof I18N !== 'undefined' ? I18N : require('./i18n.js');

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function cur(v) { return v.country === 'IE' ? '€' : '£'; }
  function num(x) { return String(Math.round(x * 100) / 100); }
  function sub(s, v) { return s.replace('{v}', v.venue).replace('{c}', v.contact || 'your manager'); }

  /* ---------- result checks (5.6) ---------- */
  // Returns [{kind: 'ok'|'warn', text}] in the order shown above the Finalise button.
  function checks(r, v, locked) {
    var out = [{ kind: 'ok', text: 'Shares add up to ' + C.money(r.Tsplit, cur(v)) + ' exactly.' }];
    var month = C.d(v.from, 'm');
    if (v.country === 'GB' && r.first) {
      var D1 = C.gbDeadline(r.first);
      out.push(v.payout > D1
        ? { kind: 'warn', text: 'Tips paid in ' + month + ' must reach staff by ' + C.d(D1, 'long') + '. Your payout date is ' + C.d(v.payout, 'dM') + '.' }
        : { kind: 'ok', text: 'Payout ' + C.d(v.payout, 'dm') + ' is on time. ' + month + ' tips must reach staff by ' + C.d(D1) + '.' });
    }
    if (v.country === 'IE') out.push({ kind: 'warn', text: 'Give each person their statement by ' + C.d(C.ieStatementBy(v.payout), 'long') + ', within 10 days of payout.' });
    r.people.forEach(function (p) {
      if (p.share <= 0) return;
      if (v.country === 'IE' && p.type === 'Owner or manager') out.push({ kind: 'warn', text: p.name + ' is an owner or manager. In Ireland they can only share in card tips if they regularly do the same work as the others, and only a fair share.' });
      if (v.country === 'GB' && p.type === 'Self-employed') out.push({ kind: 'warn', text: p.name + ' is self-employed. The UK tips law covers workers and agency workers, not the self-employed. You can still include them.' });
    });
    if (locked) out.push({ kind: 'warn', text: r.sharers + ' people share in this period. Free covers up to 5. Upgrade to see each share.' });
    return out;
  }
  function savedLine(v) {
    return C.d(v.from, 'my') + ' is saved in the Record sheet.' + (v.country === 'NI' ? '' : ' Keep it until ' + C.d(C.addYears(v.payout, 3)) + '.');
  }

  /* ---------- statements (5.7) ---------- */
  function how(r, p, v) {
    var g = r.groups.filter(function (x) { return x.name === p.group; })[0], who = v.groupsOn ? g.name : 'Everyone', of = v.groupsOn ? 'the ' + g.name + '\'s' : 'the team\'s';
    var on = g.people.filter(function (x) { return x.w > 0; });
    var H = on.reduce(function (a, x) { return a + x.h; }, 0) / 100, P = on.reduce(function (a, x) { return a + x.p; }, 0) / 100;
    var HP = on.reduce(function (a, x) { return a + x.h * x.p; }, 0) / 10000, h = p.h / 100, pt = p.p / 100;
    var lead = v.groupsOn ? who + ' shares ' + num(g.pct) + '% of the tips, ' : 'Tips are shared ';
    if (v.groupsOn && g.method === 'Equal') lead = who + ' shares ' + num(g.pct) + '% of the tips ';
    if (r.days) lead = lead.replace(/, $/, ' ') + 'day by day, ';
    switch (g.method) {
      case 'Hours': return [lead + 'by hours worked.', 'You worked ' + num(h) + ' of ' + of + ' ' + num(H) + ' hours.'];
      case 'Points': return [lead + 'by points.', 'You have ' + num(pt) + ' of ' + of + ' ' + num(P) + ' points.'];
      case 'Equal': return [lead + 'equally.', 'You are one of ' + on.length + ' people sharing.'];
      default: return [lead + 'by hours worked times points.', 'You worked ' + num(h) + ' hours at ' + num(pt) + ' points: ' + num(h * pt) + ' of ' + of + ' ' + num(HP) + '.'];
    }
  }
  // The same two lines in the statement's language (i18n howWords). Returns null for English.
  function howIn(r, p, v, lang) {
    var t = lang !== 'English' && W[lang] && W[lang].howWords;
    if (!t) return null;
    var g = r.groups.filter(function (x) { return x.name === p.group; })[0], on = g.people.filter(function (x) { return x.w > 0; });
    var H = on.reduce(function (a, x) { return a + x.h; }, 0) / 100, P = on.reduce(function (a, x) { return a + x.p; }, 0) / 100;
    var HP = on.reduce(function (a, x) { return a + x.h * x.p; }, 0) / 10000, h = p.h / 100, pt = p.p / 100;
    var k = g.method === 'Hours × points' ? 'HP' : g.method;
    var f = { g: v.groupsOn ? g.name : t.team, pct: num(g.pct), m: t[k], d: r.days ? t.day : '', h: num(h), H: num(H), pt: num(pt), P: num(P), x: num(h * pt), HP: num(HP), n: on.length };
    function fill(s) { return s.replace(/\{(\w+)\}/g, function (a, x) { return f[x]; }); }
    return [fill(v.groupsOn ? t.gs : t.all), fill(t['y' + k])];
  }
  // One A4 statement. Only this person's share and the venue's total: never anyone else's amount.
  function statement(r, p, v, staff) {
    var lang = W[staff && staff.lang] ? staff.lang : 'English', w = W[lang], en = lang === 'English' ? null : W.English;
    function L(k) { return esc(sub(w[k], v)) + (en ? '<i>' + esc(sub(en[k], v)) + '</i>' : ''); }
    var c = cur(v), foot = v.country === 'IE' ? ['taxIE'] : ['taxUK', v.contact ? 'ask' : 'askNone'];
    var agency = staff && staff.type === 'Agency worker' && staff.agency ? '<dt>' + L('agency') + '</dt><dd>' + esc(staff.agency) + '</dd>' : '';
    return '<article class="tf-page a-st" lang="' + ({ English: 'en', Spanish: 'es', Polish: 'pl', Portuguese: 'pt', Romanian: 'ro', Italian: 'it' })[lang] + '">' +
      '<div class="hd"><b>' + esc(v.venue) + '</b><span>' + L('title') + '</span></div><div class="bd"><dl>' +
      '<dt>' + L('name') + '</dt><dd>' + esc(p.full) + '</dd>' + agency +
      '<dt>' + L('period') + '</dt><dd>' + C.d(v.from, 'long') + (lang === 'English' ? ' to ' : ' – ') + C.d(v.to, 'long') + '</dd>' +
      '<dt>' + L('paid') + '</dt><dd>' + C.d(v.payout, 'long') + '</dd>' +
      '<dt>' + L('total') + '</dt><dd>' + C.money(r.T, c) + '</dd>' +
      '<dt>' + L('tronc') + '</dt><dd>' + C.money(r.R, c) + '</dd></dl>' +
      '<div class="sh"><span>' + L('share') + '</span><b>' + C.money(p.share, c) + '</b></div>' +
      '<div class="how"><h4>' + L('how') + '</h4>' + howLines(r, p, v, lang) + '</div>' +
      '<div class="ft">' + foot.map(function (k) { return '<p>' + L(k) + '</p>'; }).join('') + '</div></div></article>';
  }
  function howLines(r, p, v, lang) {
    var en = how(r, p, v), loc = howIn(r, p, v, lang);
    return en.map(function (x, i) { return '<p>' + (loc ? esc(loc[i]) + '<i>' + esc(x) + '</i>' : esc(x)) + '</p>'; }).join('');
  }
  function statements(r, v, staffByName, only) {
    return r.people.filter(function (p) { return p.share > 0 && (!only || p.name === only); })
      .map(function (p) { return statement(r, p, v, staffByName[p.name]); }).join('');
  }

  /* ---------- reply letter (5.8) ---------- */
  // L = Core.letterRows(...). req = {worker (full name), on, m1, m2}
  function letter(L, req, v) {
    var c = cur(v), ni = v.country === 'NI';
    function mo(x) { return C.money(x, c); }
    var body = L.rows.map(function (x) {
      return '<tr><td>' + C.d(x.month + '-01', 'mY') + '</td><td>' + mo(x.total) + '</td><td>' + mo(x.toWorkers) + '</td><td>' + mo(x.tronc) + '</td><td>' + mo(x.share) + '</td></tr>';
    }).join('');
    var range = C.d(req.m1 + '-01', 'my') + ' to ' + C.d(req.m2 + '-01', 'my');
    return '<article class="tf-page tf-doc"><p class="tf-dv">' + esc(v.venue) + '</p><p>' + C.d(req.on, 'long') + '</p>' +
      '<p>Dear ' + esc(req.worker) + ',</p>' +
      (ni ? '<h2>Tips summary</h2><p>Here are the tips from ' + range + '.</p>'
        : '<h2>Your request for tips records</h2><p>You asked on ' + C.d(req.on, 'long') + ' for the records of tips from ' + range + '. Here they are.</p>') +
      '<table><thead><tr><th>Month paid</th><th>Tips at ' + esc(v.venue) + '</th><th>To workers</th><th>Through tronc</th><th>Your share</th></tr></thead><tbody>' + body +
      '</tbody><tfoot><tr><td>Total</td><td>' + mo(L.sum.total) + '</td><td>' + mo(L.sum.toWorkers) + '</td><td>' + mo(L.sum.tronc) + '</td><td>' + mo(L.sum.share) + '</td></tr></tfoot></table>' +
      (L.sum.total ? '' : '<p>No tips were paid in these months.</p>') +
      (L.later || []).map(function (b) {
        var span = b.from.slice(0, 7) === b.to.slice(0, 7) ? C.d(b.to, 'my') : C.d(b.from, 'long') + ' to ' + C.d(b.to, 'long');
        return '<p>Tips for ' + span + ' are paid on ' + C.d(b.paid, 'long') + ', so they will appear under ' + C.d(b.paid, 'my') + '.</p>';
      }).join('') +
      '<p>These are the total tips received at ' + esc(v.venue) + ' and your own share. We don\'t share other people\'s amounts.</p>' +
      '<p class="tf-sig">' + esc(v.contact) + '</p></article>';
  }

  /* ---------- policy (5.9, s27I) ---------- */
  var ASK = { no: 'No. Tips are up to the customer.', encourage: 'We encourage customers to tip, but it is always up to them.', service: 'We add a service charge to the bill. Customers can ask us to remove it.' };
  var METHOD_WORDS = { 'Equal': 'equally', 'Hours': 'by hours worked', 'Points': 'by points', 'Hours × points': 'by hours worked times points' };
  function ruleWords(o, pointsMean) {
    var pts = '';
    var s = o.groupsOn ? o.groups.map(function (g, i) {
      return (i ? g.name + ' staff share ' + num(g.pct) + '% ' : g.name + ' staff share ' + num(g.pct) + '% of tips ') + METHOD_WORDS[g.method] + '.';
    }).join(' ') : 'Tips are shared between all staff ' + METHOD_WORDS[o.method] + '.';
    var usesPoints = (o.groupsOn ? o.groups.map(function (g) { return g.method; }) : [o.method]).some(function (m) { return /Points|points/.test(m); });
    if (usesPoints && pointsMean) pts = ' Points stand for ' + pointsMean.replace(/\.$/, '') + '.';
    return s + pts + (o.pool === 'day' ? ' Tips are shared day by day, among the staff who worked that day.' : '');
  }
  // a = form answers: {ask, ways:[...], who, when, consultOn, consultHow, said, contact, pointsMean, today}
  function policy(o, a, v) {
    var ways = (a.ways && a.ways.length ? a.ways : ['Card', 'Cash']).map(function (x) { return x.toLowerCase(); });
    var waysTxt = ways.length > 1 ? ways.slice(0, -1).join(', ') + ' or ' + ways[ways.length - 1] : ways[0];
    var S = [
      ['What counts as a tip here', 'Any tip, gratuity or service charge a customer pays by ' + waysTxt + '.'],
      ['Do we ask customers to tip?', ASK[a.ask] || ASK.no],
      ['Who shares', a.who + '.'],
      ['How shares are worked out', ruleWords(o, a.pointsMean)],
      ['When tips are paid', a.when + '.'],
      ['Card fees', '100% of tips go to staff. We keep nothing for card fees.']
    ];
    if (o.tronc > 0 || a.tronc) S.push(['Tronc', 'Part of the tips is paid through a tronc operator, who decides how that part is shared.']);
    S.push(['Your records', 'You can ask ' + a.contact + ' for the records of your tips. We\'ll reply within 4 weeks.']);
    S.push(['How we asked staff', 'We asked staff for their views by ' + (a.consultHow || 'Meeting').toLowerCase() + ' on ' + C.d(a.consultOn, 'long') + '. What staff said: ' + (a.said || 'no comments.')]);
    S.push(['Dates', 'This policy: ' + C.d(a.today, 'long') + '. Review due by ' + C.d(C.addYears(a.today, 3), 'long') + '.']);
    S.push(['Who to ask', a.contact]);
    return '<article class="tf-page tf-doc"><h1>How we share tips at ' + esc(v.venue) + '</h1>' +
      S.map(function (x) { return '<h3>' + esc(x[0]) + '</h3><p>' + esc(x[1]) + '</p>'; }).join('') +
      '<p class="tf-fine">Made with Tip Fair. This is a template to help you write your own policy, not legal advice.</p></article>';
  }

  /* ---------- notice (5.10, Ireland) ---------- */
  var LAW = 'The law requires that tips and gratuities paid by card or other electronic means are distributed to employees.';
  // a = {card: true|false, how, pct, service: true|false, cash}
  function noticeLines(a) {
    var L = [];
    if (a.card) L.push('We share ' + (a.pct || '100%') + ' of card tips with our staff, ' + a.how.charAt(0).toLowerCase() + a.how.slice(1) + '.');
    else L.push('We don\'t take tips by card.');
    L.push(a.cash === 'Shared the same way' ? 'Cash tips are shared the same way.' : 'Cash tips are kept by the person who receives them.');
    L.push(a.service ? 'Our service charge is shared with staff in the same way as card tips.' : 'We don\'t add a service charge.');
    return L;
  }
  function notice(a, v) {
    var L = noticeLines(a);
    function page(cls) {
      return '<article class="tf-page tf-doc tf-poster ' + cls + '"><p class="tf-dv">' + esc(v.venue) + '</p><h1>Tips and gratuities</h1>' +
        '<p class="tf-big">' + esc(L[0]) + '</p>' + L.slice(1).map(function (x) { return '<p>' + esc(x) + '</p>'; }).join('') +
        '<p class="tf-fine">' + esc(LAW) + '</p></article>';
    }
    return page('tf-a4') + page('tf-a5');
  }
  function noticeText(a, v) { return v.venue + ': tips and gratuities\n\n' + noticeLines(a).join('\n') + '\n\n' + LAW; }

  return { esc: esc, checks: checks, savedLine: savedLine, how: how, statement: statement, statements: statements, letter: letter,
    ruleWords: ruleWords, policy: policy, notice: notice, noticeText: noticeText, LAW: LAW };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Docs;
