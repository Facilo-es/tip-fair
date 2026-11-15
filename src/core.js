// Tip Fair core: all pure logic (spec section 6). Runs in Apps Script, in the sidebar and in Node tests.
// Amounts are integer pennies or cents. Hours and points are integer hundredths. Dates are 'yyyy-mm-dd' strings.
var Core = (function () {
  'use strict';

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var TYPES = ['Card', 'Cash', 'Service charge', 'Voucher'];
  var METHODS = ['Equal', 'Hours', 'Points', 'Hours × points'];
  var STAFF_TYPES = ['Worker', 'Agency worker', 'Owner or manager', 'Self-employed'];
  var LANGS = ['English', 'Spanish', 'Polish', 'Portuguese', 'Romanian', 'Italian'];
  var FREE_LIMIT = 5, GRACE_DAYS = 14;

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function err(text) { return { ok: false, error: text }; }

  /* ---------- 6.5 largest remainder ---------- */
  // Splits integer n by integer weights. Exact share e_k = n*w_k/W, worked out with BigInt so nothing rounds early.
  // Ties: larger fraction, then larger exact share, then list order.
  // No BigInt literals (0n): the Apps Script editor's parser refuses them, so the constants are made with BigInt().
  function largestRemainder(n, weights) {
    var ZERO = BigInt(0), ONE = BigInt(1);
    var W = ZERO, N = BigInt(n);
    weights.forEach(function (w) { W += BigInt(w); });
    if (W <= ZERO) return weights.map(function () { return 0; });
    var items = weights.map(function (w, k) {
      var num = N * BigInt(w), fl = num / W, rem = num % W;
      if (rem < ZERO) { fl -= ONE; rem += W; } // floor for negative n
      return { k: k, num: num, floor: fl, rem: rem };
    });
    var L = N;
    items.forEach(function (it) { L -= it.floor; });
    var order = items.slice().sort(function (a, b) {
      if (a.rem !== b.rem) return a.rem > b.rem ? -1 : 1;
      if (a.num !== b.num) return a.num > b.num ? -1 : 1;
      return a.k - b.k;
    });
    for (var i = 0; i < Number(L); i++) order[i].floor += ONE;
    return items.map(function (it) { return Number(it.floor); });
  }

  /* ---------- numbers ---------- */
  // Hours: a number or 'h:mm'. Returns hundredths of an hour, or null.
  function parseHours(v) {
    if (v === '' || v == null) return 0;
    if (typeof v === 'number') return isFinite(v) && v >= 0 ? Math.round(v * 100) : null;
    if (Object.prototype.toString.call(v) === '[object Date]') return Math.round((v.getHours() + v.getMinutes() / 60) * 100);
    var s = String(v).trim(), m = /^(\d+):([0-5]\d)$/.exec(s);
    if (m) return Number(m[1]) * 100 + Math.round(Number(m[2]) * 100 / 60);
    s = s.replace(',', '.');
    if (!/^\d+(\.\d+)?$/.test(s)) return null;
    return Math.round(parseFloat(s) * 100);
  }
  // Points: blank is 1, any number >= 0 up to 2 decimals. Returns hundredths, or null.
  function parsePoints(v) {
    if (v === '' || v == null) return 100;
    var x = typeof v === 'number' ? v : parseFloat(String(v).trim().replace(',', '.'));
    if (!isFinite(x) || x < 0 || !/^\s*\d*([.,]\d*)?\s*$/.test(String(v))) return null;
    return Math.round(x * 100);
  }
  function hundredths(h) { var x = h / 100; return Math.round(x * 100) / 100; }
  // Money from a sheet cell or CSV text. comma: true when the decimal mark is a comma (1.234,56).
  function parseAmount(v, comma) {
    if (typeof v === 'number') return isFinite(v) ? Math.round(v * 100) : null;
    var s = String(v == null ? '' : v).trim().replace(/[£€$\s ]|GBP|EUR/gi, '');
    if (!s) return null;
    var neg = false;
    if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
    if (/^[-−]/.test(s)) { neg = true; s = s.slice(1); }
    if (comma) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
    if (!/^\d*(\.\d{0,4})?$/.test(s) || s === '' || s === '.') return null;
    var p = Math.round(parseFloat(s) * 100);
    return neg ? -p : p;
  }

  /* ---------- dates ---------- */
  var MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
  function iso(y, m, d) {
    if (y < 100) y += 2000;
    var t = new Date(Date.UTC(y, m - 1, d));
    if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null;
    return y + '-' + pad(m) + '-' + pad(d);
  }
  // order: 'dmy' (default) or 'mdy' only when the venue says so for an ambiguous file. Never guesses mm/dd.
  function parseDate(v, order) {
    if (v == null || v === '') return null;
    if (Object.prototype.toString.call(v) === '[object Date]') return isNaN(v) ? null : iso(v.getFullYear(), v.getMonth() + 1, v.getDate());
    var s = String(v).trim().replace(/[T ]\d{1,2}:\d\d(:\d\d)?(\.\d+)?\s*(Z|[ap]m|[+-]\d\d:?\d\d)?$/i, '').trim(), m;
    if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s))) return iso(+m[1], +m[2], +m[3]);
    if ((m = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2}|\d{4})$/.exec(s))) return order === 'mdy' ? iso(+m[3], +m[1], +m[2]) : iso(+m[3], +m[2], +m[1]);
    if ((m = /^(\d{1,2})[ \-]([A-Za-z]{3,9})\.?[ \-,]+(\d{4})$/.exec(s))) { var mo = MON[m[2].slice(0, 4).toLowerCase()] || MON[m[2].slice(0, 3).toLowerCase()]; return mo ? iso(+m[3], mo, +m[1]) : null; }
    return null;
  }
  // True when every slash date in the list has day and month both <= 12 and at least one differs (3/4 vs 4/3).
  function ambiguousDates(values) {
    var seen = false, any = false;
    for (var i = 0; i < values.length; i++) {
      var s = String(values[i] == null ? '' : values[i]).trim().replace(/[T ]\d{1,2}:\d\d.*$/, '');
      var m = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2}|\d{4})$/.exec(s);
      if (!m) continue;
      any = true;
      if (+m[1] > 12 || +m[2] > 12) return false;
      if (+m[1] !== +m[2]) seen = true;
    }
    return any && seen;
  }
  function addDays(d, n) { var t = new Date(d + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); }
  function addYears(d, n) { var y = +d.slice(0, 4) + n, m = +d.slice(5, 7), day = +d.slice(8, 10); return iso(y, m, day) || iso(y, m, day - 1); }
  function lastDay(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
  function monthEnd(d) { var y = +d.slice(0, 4), m = +d.slice(5, 7); return d.slice(0, 8) + pad(lastDay(y, m)); }
  function addMonths(ym, n) { var y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1 + n; y += Math.floor(m / 12); m = ((m % 12) + 12) % 12; return y + '-' + pad(m + 1); }
  function daysBetween(a, b) { return Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 864e5); }
  function d(s, style) {
    if (!s) return '';
    var y = +s.slice(0, 4), m = +s.slice(5, 7), day = +s.slice(8, 10), M = MONTHS[m - 1];
    switch (style) {
      case 'long': return day + ' ' + M + ' ' + y;
      case 'my': return M + ' ' + y;
      case 'mY': return M.slice(0, 3) + ' ' + y;
      case 'm': return M;
      case 'dM': return day + ' ' + M;
      case 'dm': return day + ' ' + M.slice(0, 3);
      default: return day + ' ' + M.slice(0, 3) + ' ' + y;
    }
  }

  /* ---------- 6.7 deadlines ---------- */
  // Great Britain: the end of the month after the month of the earliest tip.
  function gbDeadline(earliest) { var ym = addMonths(earliest.slice(0, 7), 1); return monthEnd(ym + '-01'); }
  function ieStatementBy(payout) { return addDays(payout, 10); }

  /* ---------- money ---------- */
  function money(p, cur) {
    var neg = p < 0, a = Math.abs(p), s = String(Math.floor(a / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (neg ? '−' : '') + (cur || '£') + s + '.' + pad(a % 100);
  }
  function plain(p) { return (p < 0 ? '-' : '') + Math.floor(Math.abs(p) / 100) + '.' + pad(Math.abs(p) % 100); }

  /* ---------- 6.1 tips ---------- */
  function inPeriod(t, from, to) { return t.date && t.date >= from && t.date <= to; }
  function tipsTotal(tips, from, to) {
    var total = 0, byType = { Card: 0, Cash: 0, 'Service charge': 0, Voucher: 0 }, n = 0, first = null;
    tips.forEach(function (t) {
      if (!inPeriod(t, from, to)) return;
      var v = t.amount - (t.vat || 0);
      total += v; n++;
      byType[TYPES.indexOf(t.type) > -1 ? t.type : 'Card'] += v;
      if (!first || t.date < first) first = t.date;
    });
    return { total: total, byType: byType, count: n, first: first };
  }

  /* ---------- 6.2 weights ---------- */
  function weight(method, h, p, anyHours) {
    switch (method) {
      case 'Equal': return !anyHours || h > 0 ? 1 : 0;
      case 'Hours': return h;
      case 'Points': return h > 0 ? p : 0;
      default: return h * p; // Hours × points
    }
  }

  /* ---------- hours check (5.4) ---------- */
  function checkHours(staff, hours, from, to, monthName) {
    var names = {}, msgs = [], total = 0, people = {};
    staff.forEach(function (s) { names[s.name] = 1; });
    var unknown = {};
    hours.forEach(function (r) {
      if (r.date && (r.date < from || r.date > to)) return;
      if (!names[r.name]) { unknown[r.name] = 1; return; }
      total += r.hours;
      if (r.hours > 0) people[r.name] = 1;
    });
    Object.keys(unknown).forEach(function (n) { msgs.push({ k: 'unknown', name: n, text: '"' + n + '" has hours but isn\'t on the Staff sheet. Add them, or fix the name.' }); });
    staff.forEach(function (s) { if (!people[s.name]) msgs.push({ k: 'none', name: s.name, text: s.name + ' has no hours in ' + monthName + ', so gets no share unless the rule is Equal.' }); });
    return { total: total, people: Object.keys(people).length, unknown: Object.keys(unknown), messages: msgs };
  }

  /* ---------- 6.3, 6.4 split ---------- */
  // o: {tips, staff:[{name, full, group, points, type, lang}], hours:[{date, name, hours}], from, to,
  //     groupsOn, groups:[{name, pct, method}], method, pool: 'period'|'day', tronc}
  function split(o) {
    var tt = tipsTotal(o.tips, o.from, o.to), T = tt.total, R = o.tronc || 0;
    if (R < 0 || R > Math.max(T, 0)) return err('The tronc amount can\'t be more than the tips.');
    var N = T - R;
    if (N <= 0) return err('There are no tips to share in this period.');
    var defs = o.groupsOn ? o.groups : [{ name: 'All staff', pct: 100, method: o.method }];
    var pctSum = 0;
    defs.forEach(function (g) { pctSum += Math.round(Number(g.pct || 0) * 100); });
    if (pctSum !== 10000) return err('Group shares add up to ' + pctSum / 100 + '%. Make them 100%.');
    var known = {};
    o.staff.forEach(function (s) { known[s.name] = 1; });
    var hrs = o.hours.filter(function (r) { return known[r.name] && (!r.date || (r.date >= o.from && r.date <= o.to)); });
    var groups = defs.map(function (g) {
      var people = o.staff.filter(function (s) { return !o.groupsOn || s.group === g.name; }).map(function (s) {
        return { name: s.name, full: s.full || s.name, group: g.name, type: s.type || 'Worker', lang: s.lang || 'English', p: s.points == null ? 100 : s.points, h: 0, w: 0, share: 0 };
      });
      return { name: g.name, pct: Number(g.pct), method: g.method, people: people, pot: 0 };
    });
    var days;
    if (o.pool === 'day') {
      if (hrs.some(function (r) { return !r.date; })) return err('Each-day sharing needs a date on every Hours row.');
      var byDay = {};
      o.tips.forEach(function (t) { if (inPeriod(t, o.from, o.to)) byDay[t.date] = (byDay[t.date] || 0) + t.amount - (t.vat || 0); });
      days = Object.keys(byDay).sort().filter(function (k) { return byDay[k] !== 0; }).map(function (k) { return { date: k, T: byDay[k] }; });
      var tr = largestRemainder(R, days.map(function (x) { return Math.max(x.T, 0); }));
      days.forEach(function (x, i) { x.N = x.T - tr[i]; });
    } else days = [{ date: null, N: N }];
    var pots = groups.map(function () { return 0; });
    for (var di = 0; di < days.length; di++) {
      var day = days[di], hoursOf = {}, any = false;
      hrs.forEach(function (r) { if (!day.date || r.date === day.date) { hoursOf[r.name] = (hoursOf[r.name] || 0) + r.hours; if (r.hours > 0) any = true; } });
      if (day.date && !any && day.N !== 0) return err(Core.d(day.date, 'dm') + ' has tips but no hours. Add hours for that day, or share by the whole period.');
      var anyHours = hrs.length > 0;
      var ws = groups.map(function (g) {
        return g.people.map(function (p) { var h = hoursOf[p.name] || 0; return weight(g.method, h, p.p, anyHours); });
      });
      for (var gi = 0; gi < groups.length; gi++) {
        var sw = ws[gi].reduce(function (a, b) { return a + b; }, 0);
        if (sw === 0 && groups[gi].pct > 0) return err('Nobody in ' + groups[gi].name + ' has hours in this period. Set its share to 0%, or add hours.');
      }
      var dpots = largestRemainder(day.N, groups.map(function (g) { return Math.round(g.pct * 100); }));
      groups.forEach(function (g, gi2) {
        pots[gi2] += dpots[gi2];
        var s = largestRemainder(dpots[gi2], ws[gi2]);
        g.people.forEach(function (p, k) { p.share += s[k]; p.h += hoursOf[p.name] || 0; p.w += ws[gi2][k]; });
      });
    }
    var sharers = 0, check = 0, people = [];
    groups.forEach(function (g, gi) {
      g.pot = pots[gi];
      g.people.forEach(function (p) { check += p.share; if (p.share > 0) sharers++; people.push(p); });
    });
    if (check !== N) return err('Shares don\'t add up. Please write to support@facilo.es.');
    return { ok: true, T: T, R: R, Tsplit: N, byType: tt.byType, count: tt.count, first: tt.first, groups: groups, people: people, sharers: sharers, days: o.pool === 'day' ? days.length : 0 };
  }

  // 6.10: individual shares need Pro when more than 5 people share.
  function locked(r, pro) { return r.ok && r.sharers > FREE_LIMIT && !pro; }

  function ruleText(o) {
    var defs = o.groupsOn ? o.groups : [{ name: 'All staff', pct: 100, method: o.method }];
    return defs.map(function (g) { return g.name + ' ' + g.pct + '% ' + g.method.toLowerCase().replace(' × ', '×'); }).join('; ') +
      '; ' + (o.pool === 'day' ? 'each day' : 'whole period');
  }

  /* ---------- 6.8 record ---------- */
  var RECORD_COLS = ['Period ID', 'From', 'To', 'Paid on', 'Tips total', 'Card', 'Cash', 'Service charge', 'Voucher', 'Through tronc', 'To workers', 'Rule',
    'Name', 'Group', 'Hours', 'Points', 'Share', 'Finalised at', 'Fingerprint', 'Keep until', 'Note', 'Status'];
  var FP = RECORD_COLS.indexOf('Fingerprint');
  // One row per person with a share. Amounts as decimal text so the sheet shows them and the fingerprint is stable.
  function recordRows(r, o, payout, at) {
    var id = o.from + '_' + o.to, rule = ruleText(o), keep = addYears(payout, 3);
    var rows = r.people.filter(function (p) { return p.share > 0; }).map(function (p) {
      return [id, o.from, o.to, payout, plain(r.T), plain(r.byType.Card), plain(r.byType.Cash), plain(r.byType['Service charge']), plain(r.byType.Voucher),
        plain(r.R), plain(r.Tsplit), rule, p.full, p.group, String(hundredths(p.h)), String(hundredths(p.p)), plain(p.share), at, '', keep, '', ''];
    });
    var fp = fingerprint(rows);
    rows.forEach(function (row) { row[FP] = fp; });
    return rows;
  }
  // Canonical JSON of the block, without Fingerprint, Note and Status. First 16 hex of SHA-256.
  function fingerprint(rows) {
    var canon = rows.map(function (row) { return row.slice(0, FP).map(function (v) { return String(v == null ? '' : v); }); });
    return sha256(JSON.stringify(canon)).slice(0, 16);
  }
  // Groups the Record sheet rows (from row 2, as text) into blocks and checks each fingerprint.
  function readRecord(rows) {
    var blocks = [], cur = null;
    rows.forEach(function (row, i) {
      var r = row.map(function (v) { return v == null ? '' : String(v); });
      if (!r[0]) return;
      var key = r[0] + '|' + r[17];
      // One row per person in a block, so a repeated name starts a new one (two finalises in the same minute).
      if (!cur || cur.key !== key || cur.names[r[12]]) { cur = { key: key, id: r[0], from: r[1], to: r[2], paid: r[3], total: toP(r[4]), tronc: toP(r[9]), toWorkers: toP(r[10]), rule: r[11], at: r[17], fp: r[18], status: r[21], rows: [], names: {}, first: i }; blocks.push(cur); }
      cur.rows.push(r);
      cur.names[r[12]] = 1;
      if (r[21]) cur.status = r[21];
    });
    blocks.forEach(function (b) { b.changed = fingerprint(b.rows) !== b.fp; b.replaced = /^Replaced/.test(b.status); });
    return blocks;
  }
  function toP(s) { var p = parseAmount(s, false); return p == null ? 0 : p; }

  /* ---------- 6.9 record request ---------- */
  function requestRange(q, m1, m2) {
    var minM = addMonths(q.slice(0, 7), -36), maxM = addMonths(q.slice(0, 7), -1), errors = [];
    if (m1 < minM) errors.push({ k: 'min', m: minM, text: 'The months must start no more than 3 years before the request: ' + d(minM + '-01', 'my') + ' or later.' });
    if (m2 > maxM) errors.push({ k: 'max', m: maxM, text: 'The months must have ended before the request date: ' + d(maxM + '-01', 'my') + ' or earlier.' });
    if (m1 > m2) errors.push({ k: 'order', text: 'The first month must come before the last.' });
    return { errors: errors, min: minM, max: maxM, replyBy: addDays(q, 27) };
  }
  // Totals per payout month for one worker, from finalised blocks that weren't replaced.
  function letterRows(blocks, fullName, m1, m2) {
    var months = [], byM = {};
    for (var m = m1; m <= m2; m = addMonths(m, 1)) { months.push(m); byM[m] = { month: m, total: 0, toWorkers: 0, tronc: 0, share: 0, worked: false }; }
    blocks.forEach(function (b) {
      if (b.replaced) return;
      var m = b.paid.slice(0, 7), x = byM[m];
      if (!x) return;
      x.total += b.total; x.toWorkers += b.toWorkers; x.tronc += b.tronc;
      b.rows.forEach(function (r) { if (r[12] === fullName) { x.share += toP(r[16]); x.worked = true; } });
    });
    var rows = months.map(function (m) { return byM[m]; }), sum = { total: 0, toWorkers: 0, tronc: 0, share: 0 };
    rows.forEach(function (x) { sum.total += x.total; sum.toWorkers += x.toWorkers; sum.tronc += x.tronc; sum.share += x.share; });
    // Periods that end in the asked months but are paid after them, so the owner can say where they will show.
    var later = blocks.filter(function (b) { var e = b.to.slice(0, 7); return !b.replaced && e >= m1 && e <= m2 && b.paid.slice(0, 7) > m2; })
      .map(function (b) { return { from: b.from, to: b.to, paid: b.paid }; });
    return { rows: rows, sum: sum, later: later, noShare: rows.filter(function (x) { return !x.worked; }).map(function (x) { return x.month; }) };
  }

  /* ---------- 6.12 CSV ---------- */
  var MAX_CSV = 5 * 1024 * 1024;
  function parseCsv(text) {
    if (text.length > MAX_CSV) return err('That file is over 5 MB. Export a shorter period.');
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    var nl = text.search(/\r?\n/), head = nl < 0 ? text : text.slice(0, nl);
    var counts = { ',': 0, ';': 0, '\t': 0 }, q = false;
    for (var i = 0; i < head.length; i++) { var c = head[i]; if (c === '"') q = !q; else if (!q && counts[c] != null) counts[c]++; }
    var sep = counts['\t'] > counts[','] && counts['\t'] >= counts[';'] ? '\t' : counts[';'] > counts[','] ? ';' : ',';
    var rows = [], row = [], f = '', inq = false;
    for (var j = 0; j < text.length; j++) {
      var ch = text[j];
      if (inq) {
        if (ch === '"') { if (text[j + 1] === '"') { f += '"'; j++; } else inq = false; } else f += ch;
      } else if (ch === '"') inq = true;
      else if (ch === sep) { row.push(f); f = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[j + 1] === '\n') j++; row.push(f); rows.push(row); row = []; f = ''; }
      else f += ch;
    }
    if (f !== '' || row.length) { row.push(f); rows.push(row); }
    rows = rows.filter(function (r) { return r.some(function (x) { return x.trim() !== ''; }); });
    if (!rows.length) return err('That file is empty.');
    return { ok: true, sep: sep, headers: rows[0].map(function (h) { return h.trim(); }), rows: rows.slice(1) };
  }
  var WORDS = {
    date: ['date', 'created', 'time', 'transaction date'],
    tip: ['tip', 'tips', 'gratuity', 'tip amount'],
    staff: ['staff', 'employee', 'team member', 'server', 'operator'],
    ref: ['reference', 'ref', 'transaction id', 'receipt number', 'receipt', 'payment id', 'id']
  };
  function findCol(headers, words) {
    var low = headers.map(function (h) { return h.toLowerCase().replace(/[_\-]+/g, ' ').replace(/\s*\(.*\)$/, '').trim(); });
    for (var w = 0; w < words.length; w++) { var i = low.indexOf(words[w]); if (i > -1) return i; }
    for (var w2 = 0; w2 < words.length; w2++) {
      for (var k = 0; k < low.length; k++) if (new RegExp('(^|\\s)' + words[w2] + '(\\s|$)').test(low[k])) return k;
    }
    return -1;
  }
  function detectColumns(headers) {
    var m = { date: findCol(headers, WORDS.date), tip: findCol(headers, WORDS.tip), staff: findCol(headers, WORDS.staff), ref: findCol(headers, WORDS.ref) };
    if (m.ref === m.date || m.ref === m.tip) m.ref = -1;
    m.found = m.date > -1 && m.tip > -1;
    return m;
  }
  function mappingKey(headers) { return 'map:' + headers.map(function (h) { return h.toLowerCase(); }).sort().join('|'); }
  // Named tills, matched by their own export headers (fixtures in tests/fixtures).
  var TILLS = [
    { name: 'Square', has: ['date', 'time', 'tip', 'gross sales', 'transaction id'] },
    { name: 'SumUp', has: ['transaction id', 'date', 'tip amount', 'total amount'] },
    { name: 'Zettle', has: ['date', 'receipt number', 'tip', 'staff'] },
    { name: 'Dojo', has: ['transaction date', 'gratuity', 'transaction id'] },
    { name: 'Teya', has: ['transaction date', 'tip amount', 'terminal id'] },
    { name: 'Lightspeed', has: ['date', 'receipt id', 'tips', 'employee'] },
    { name: 'Clover', has: ['payment id', 'tip amount', 'employee', 'payment date'] }
  ];
  function tillName(headers) {
    var low = headers.map(function (h) { return h.toLowerCase().trim(); });
    for (var i = 0; i < TILLS.length; i++) if (TILLS[i].has.every(function (w) { return low.indexOf(w) > -1; })) return TILLS[i].name;
    return '';
  }
  // Turns parsed CSV rows into tips with a mapping {date, tip, staff, ref}. order: 'dmy' | 'mdy'.
  function csvTips(p, map, source, order) {
    var comma = p.sep === ';', out = [], bad = 0;
    p.rows.forEach(function (r) {
      var a = parseAmount(r[map.tip], comma);
      if (a == null || a === 0) return;
      var dt = parseDate(r[map.date], order);
      if (!dt) { bad++; return; }
      out.push({ date: dt, amount: a, type: 'Card', vat: 0, source: source || '', ref: map.ref > -1 ? String(r[map.ref] || '').trim() : '', staff: map.staff > -1 ? String(r[map.staff] || '').trim() : '' });
    });
    var first = null, last = null, total = 0;
    out.forEach(function (t) { total += t.amount; if (!first || t.date < first) first = t.date; if (!last || t.date > last) last = t.date; });
    return { tips: out, count: out.length, total: total, first: first, last: last, bad: bad, ambiguous: order ? false : ambiguousDates(p.rows.map(function (r) { return r[map.date]; })) };
  }
  // Duplicates: same date, amount and reference as a tip already in the sheet (or earlier in the file).
  function dedupe(existing, incoming) {
    var seen = {}, keep = [], skipped = 0;
    function key(t) { return t.date + '|' + t.amount + '|' + (t.ref || ''); }
    existing.forEach(function (t) { seen[key(t)] = 1; });
    incoming.forEach(function (t) { var k = key(t); if (seen[k] && (t.ref || existing.length)) { skipped++; return; } seen[k] = 1; keep.push(t); });
    return { tips: keep, skipped: skipped };
  }

  /* ---------- safety ---------- */
  // Text that Sheets would read as a formula gets a leading apostrophe.
  function safeText(v) { var s = v == null ? '' : String(v); return /^[=+\-@]/.test(s) ? '\'' + s : s; }

  /* ---------- 6.11 licence ---------- */
  // res: Freemius license object or null when offline. lastGood: 'yyyy-mm-dd' of the last good check.
  function licenceState(res, today, lastGood) {
    if (res === null) {
      if (!lastGood) return { pro: false, status: 'offline', left: 0 };
      var left = GRACE_DAYS - daysBetween(lastGood, today);
      return { pro: left > 0, status: 'offline', left: Math.max(0, left) };
    }
    if (!res || res.error) return { pro: false, status: 'wrong' };
    if (res.is_cancelled) return { pro: false, status: 'cancelled' };
    var exp = res.expiration ? String(res.expiration).slice(0, 10) : null;
    if (exp && exp < today) return { pro: false, status: 'expired', expires: exp };
    return { pro: true, status: 'ok', expires: exp };
  }

  /* ---------- SHA-256 (sync, so the same code runs everywhere) ---------- */
  var K256 = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
  function utf8(s) {
    var out = [];
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c >= 0xd800 && c < 0xdc00 && i + 1 < s.length) { c = 0x10000 + ((c - 0xd800) << 10) + (s.charCodeAt(++i) - 0xdc00); }
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | c >> 6, 0x80 | c & 63);
      else if (c < 0x10000) out.push(0xe0 | c >> 12, 0x80 | c >> 6 & 63, 0x80 | c & 63);
      else out.push(0xf0 | c >> 18, 0x80 | c >> 12 & 63, 0x80 | c >> 6 & 63, 0x80 | c & 63);
    }
    return out;
  }
  function sha256(s) {
    var b = utf8(s), l = b.length * 8, H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19], w = new Array(64);
    b.push(0x80);
    while (b.length % 64 !== 56) b.push(0);
    for (var sh = 56; sh >= 0; sh -= 8) b.push(sh >= 32 ? Math.floor(l / Math.pow(2, sh)) & 255 : l >>> sh & 255);
    for (var o = 0; o < b.length; o += 64) {
      for (var t = 0; t < 16; t++) w[t] = b[o + 4 * t] << 24 | b[o + 4 * t + 1] << 16 | b[o + 4 * t + 2] << 8 | b[o + 4 * t + 3];
      for (t = 16; t < 64; t++) {
        var x = w[t - 15], y = w[t - 2];
        var s0 = (x >>> 7 | x << 25) ^ (x >>> 18 | x << 14) ^ x >>> 3, s1 = (y >>> 17 | y << 15) ^ (y >>> 19 | y << 13) ^ y >>> 10;
        w[t] = w[t - 16] + s0 + w[t - 7] + s1 | 0;
      }
      var a = H[0], bb = H[1], c = H[2], dd = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (t = 0; t < 64; t++) {
        var S1 = (e >>> 6 | e << 26) ^ (e >>> 11 | e << 21) ^ (e >>> 25 | e << 7), ch = e & f ^ ~e & g;
        var t1 = h + S1 + ch + K256[t] + w[t] | 0;
        var S0 = (a >>> 2 | a << 30) ^ (a >>> 13 | a << 19) ^ (a >>> 22 | a << 10), mj = a & bb ^ a & c ^ bb & c;
        var t2 = S0 + mj | 0;
        h = g; g = f; f = e; e = dd + t1 | 0; dd = c; c = bb; bb = a; a = t1 + t2 | 0;
      }
      H[0] = H[0] + a | 0; H[1] = H[1] + bb | 0; H[2] = H[2] + c | 0; H[3] = H[3] + dd | 0; H[4] = H[4] + e | 0; H[5] = H[5] + f | 0; H[6] = H[6] + g | 0; H[7] = H[7] + h | 0;
    }
    return H.map(function (v) { return ('0000000' + (v >>> 0).toString(16)).slice(-8); }).join('');
  }
  function uid(spreadsheetId) { return sha256('tipfair:' + spreadsheetId).slice(0, 32); }

  return {
    MONTHS: MONTHS, TYPES: TYPES, METHODS: METHODS, STAFF_TYPES: STAFF_TYPES, LANGS: LANGS, FREE_LIMIT: FREE_LIMIT, GRACE_DAYS: GRACE_DAYS, RECORD_COLS: RECORD_COLS,
    largestRemainder: largestRemainder, parseHours: parseHours, parsePoints: parsePoints, parseAmount: parseAmount, parseDate: parseDate, ambiguousDates: ambiguousDates,
    addDays: addDays, addYears: addYears, addMonths: addMonths, monthEnd: monthEnd, daysBetween: daysBetween, d: d, gbDeadline: gbDeadline, ieStatementBy: ieStatementBy,
    money: money, plain: plain, hundredths: hundredths, tipsTotal: tipsTotal, weight: weight, checkHours: checkHours, split: split, locked: locked, ruleText: ruleText,
    recordRows: recordRows, fingerprint: fingerprint, readRecord: readRecord, requestRange: requestRange, letterRows: letterRows,
    parseCsv: parseCsv, detectColumns: detectColumns, mappingKey: mappingKey, tillName: tillName, csvTips: csvTips, dedupe: dedupe,
    safeText: safeText, licenceState: licenceState, sha256: sha256, uid: uid
  };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Core;
