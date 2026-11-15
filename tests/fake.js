// Fake Google Sheets services, just enough to run the real .gs files in Node for the tests and the local preview.
// Started from Remesa Fácil's preview/fake.js, with notes, protection and Document Properties added.
'use strict';
var crypto = require('crypto');

function pad(n) { return (n < 10 ? '0' : '') + n; }
function display(v) {
  if (Object.prototype.toString.call(v) === '[object Date]') return pad(v.getDate()) + '/' + pad(v.getMonth() + 1) + '/' + v.getFullYear();
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  return v == null ? '' : String(v);
}

function Sheet(name, rows) {
  this.name = name;
  this.cells = (rows || []).map(function (r) { return r.slice(); });
  this.hiddenRows = {};
  this.formulas = {};
  this.frozen = 0;
  this.bold = {};
  this.checkboxCols = {};
  this.writes = []; // [{row, col, rows, cols}] so tests can see where we wrote
  this.notes = {};
  this.protections = [];
  this.formats = {};
}
Sheet.prototype.getName = function () { return this.name; };
Sheet.prototype.getLastRow = function () {
  for (var i = this.cells.length - 1; i >= 0; i--) if (this.cells[i].some(function (v) { return v !== '' && v != null; })) return i + 1;
  return 0;
};
Sheet.prototype.getLastColumn = function () {
  var m = 0;
  this.cells.forEach(function (r) { for (var j = r.length - 1; j >= 0; j--) if (r[j] !== '' && r[j] != null) { m = Math.max(m, j + 1); break; } });
  return m;
};
Sheet.prototype.getRange = function (row, col, nr, nc) {
  if (typeof row === 'string') { var m = /^([A-Z])(\d+)?/.exec(row); return new Range(this, m[2] ? +m[2] : 1, m[1].charCodeAt(0) - 64, 1, 1); }
  return new Range(this, row, col, nr || 1, nc || 1);
};
Sheet.prototype.getFilter = function () { return null; };
Sheet.prototype.isRowHiddenByUser = function (r) { return !!this.hiddenRows[r]; };
Sheet.prototype.isRowHiddenByFilter = function () { return false; };
Sheet.prototype.setFrozenRows = function (n) { this.frozen = n; return this; };
Sheet.prototype.setColumnWidth = function () { return this; };
Sheet.prototype.autoResizeColumns = function () { return this; };
Sheet.prototype.activate = function () { this.ss.active = this; return this; };
Sheet.prototype.hideSheet = function () { return this; };
Sheet.prototype.setTabColor = function () { return this; };
Sheet.prototype.getMaxRows = function () { return Math.max(this.cells.length, 1000); };
Sheet.prototype.clearContents = function () { this.cells = []; return this; };
Sheet.prototype.protect = function () { var p = { warning: false, desc: '', setWarningOnly: function (w) { p.warning = w; return p; }, setDescription: function (d) { p.desc = d; return p; } }; this.protections.push(p); return p; };
Sheet.prototype.getProtections = function () { return this.protections.slice(); };
Sheet.prototype.isFormula = function (r, c) { return !!this.formulas[r + ',' + c]; };
Sheet.prototype.at = function (r, c) { var row = this.cells[r - 1]; return row && row[c - 1] != null ? row[c - 1] : ''; };
Sheet.prototype.put = function (r, c, v) {
  while (this.cells.length < r) this.cells.push([]);
  var row = this.cells[r - 1];
  while (row.length < c) row.push('');
  row[c - 1] = v;
};

function Range(sh, row, col, nr, nc) { this.sh = sh; this.row = row; this.col = col; this.nr = nr; this.nc = nc; }
Range.prototype.getRow = function () { return this.row; };
Range.prototype.getColumn = function () { return this.col; };
Range.prototype.getNumRows = function () { return this.nr; };
Range.prototype.getNumColumns = function () { return this.nc; };
Range.prototype.getValues = function () {
  var out = [];
  for (var i = 0; i < this.nr; i++) { var r = []; for (var j = 0; j < this.nc; j++) r.push(this.sh.at(this.row + i, this.col + j)); out.push(r); }
  return out;
};
Range.prototype.getDisplayValues = function () { return this.getValues().map(function (r) { return r.map(display); }); };
Range.prototype.getValue = function () { return this.sh.at(this.row, this.col); };
Range.prototype.setValues = function (v) {
  if (v.length !== this.nr || v.some(function (r) { return r.length !== this.nc; }, this)) throw new Error('setValues: size ' + v.length + 'x' + (v[0] || []).length + ' does not match range ' + this.nr + 'x' + this.nc);
  for (var i = 0; i < this.nr; i++) for (var j = 0; j < this.nc; j++) {
    var x = v[i][j];
    // Sheets turns text that looks like a number or date into one, unless it starts with an apostrophe.
    var key = (this.row + i) + ',' + (this.col + j);
    if (typeof x === 'string' && x[0] === "'") { x = x.slice(1); delete this.sh.formulas[key]; }
    else if (typeof x === 'string' && /^[=+\-@]/.test(x)) this.sh.formulas[key] = 1;
    else delete this.sh.formulas[key];
    this.sh.put(this.row + i, this.col + j, x);
  }
  this.sh.writes.push({ row: this.row, col: this.col, rows: this.nr, cols: this.nc });
  return this;
};
Range.prototype.setValue = function (x) { return this.setValues([[x]]); };
Range.prototype.insertCheckboxes = function () { for (var j = 0; j < this.nc; j++) this.sh.checkboxCols[this.col + j] = 1; return this; };
Range.prototype.setNote = function (n) { this.sh.notes[this.row + ':' + this.col] = n; return this; };
Range.prototype.getNote = function () { return this.sh.notes[this.row + ':' + this.col] || ''; };
Range.prototype.setNumberFormat = function (f) { for (var j = 0; j < this.nc; j++) this.sh.formats[this.col + j] = f; return this; };
Range.prototype.offset = function (r, c, nr, nc) { return new Range(this.sh, this.row + r, this.col + c, nr || this.nr, nc || this.nc); };
['setNumberFormats', 'setFontWeight', 'setBackground', 'setDataValidation', 'setWrap', 'setFontColor', 'setHorizontalAlignment', 'activate', 'clearContent', 'setFontStyle'].forEach(function (m) {
  Range.prototype[m] = function () { if (m === 'setFontWeight') this.sh.bold[this.row] = 1; if (m === 'activate') this.sh.ss.cursor = { sheet: this.sh.name, row: this.row, col: this.col }; return this; };
});

function Spreadsheet(sheets) {
  var ss = this;
  this.sheets = [];
  this.ui = { sidebar: null, dialog: null, menu: [] };
  (sheets || []).forEach(function (s) { ss.add(s); });
  this.active = this.sheets[0] || null;
  this.selection = null;
}
Spreadsheet.prototype.add = function (sh) { sh.ss = this; this.sheets.push(sh); return sh; };
Spreadsheet.prototype.getSheets = function () { return this.sheets.slice(); };
Spreadsheet.prototype.getSheetByName = function (n) { return this.sheets.filter(function (s) { return s.name === n; })[0] || null; };
Spreadsheet.prototype.insertSheet = function (n) { if (this.getSheetByName(n)) throw new Error('exists ' + n); var s = this.add(new Sheet(n)); this.active = s; return s; };
Spreadsheet.prototype.getActiveSheet = function () { return this.active; };
Spreadsheet.prototype.getActiveRangeList = function () {
  var sel = this.selection, sh = this.active;
  if (!sel) return null;
  return { getRanges: function () { return sel.map(function (x) { return new Range(sh, x[0], 1, x[1], 1); }); } };
};
Spreadsheet.prototype.toast = function () {};
Spreadsheet.prototype.getId = function () { return this.id || '1TestSheetIdTipFair000000000000000000000000'; };
Spreadsheet.prototype.setActiveSheet = function (s) { this.active = s; return s; };
Spreadsheet.prototype.getSpreadsheetTimeZone = function () { return 'Europe/London'; };

function chain(onBuild) {
  var o = {};
  ['requireValueInList', 'setAllowInvalid', 'requireCheckbox', 'setHelpText', 'requireNumberGreaterThanOrEqualTo'].forEach(function (m) { o[m] = function () { return o; }; });
  o.build = function () { return onBuild ? onBuild() : {}; };
  return o;
}

/** Html templates: only the two scriptlets our files use. */
function HtmlOutput(content) { this.content = content; this.w = 0; this.h = 0; this.title = ''; }
['setWidth', 'setHeight', 'setTitle', 'setSandboxMode', 'setXFrameOptionsMode'].forEach(function (m) {
  HtmlOutput.prototype[m] = function (v) { if (m === 'setWidth') this.w = v; if (m === 'setHeight') this.h = v; if (m === 'setTitle') this.title = v; return this; };
});
HtmlOutput.prototype.getContent = function () { return this.content; };

function services(ss, files, ctx) {
  var ui = {
    createAddonMenu: function () { var m = { addItem: function (a, b) { ss.ui.menu.push([a, b]); return m; }, addSeparator: function () { return m; }, addToUi: function () {} }; return m; },
    showSidebar: function (h) { ss.ui.sidebar = h; },
    showModalDialog: function (h, title) { ss.ui.dialog = { html: h.getContent(), title: title, w: h.w, h: h.h }; },
    showModelessDialog: function (h, title) { ss.ui.dialog = { html: h.getContent(), title: title, w: h.w, h: h.h }; },
    alert: function () {}
  };
  return {
    SpreadsheetApp: { getActive: function () { return ss; }, getActiveSpreadsheet: function () { return ss; }, getUi: function () { return ui; }, newDataValidation: function () { return chain(); } },
    HtmlService: {
      createHtmlOutput: function (s) { return new HtmlOutput(s || ''); },
      createHtmlOutputFromFile: function (n) { return new HtmlOutput(files[n]); },
      createTemplateFromFile: function (n) { return this.createTemplate(files[n]); },
      // Scriptlets call the add-on's own functions, as Apps Script does (include('x') -> ctx.include).
      createTemplate: function (src) {
        var t = {
          evaluate: function () {
            var html = String(src).replace(/<\?!=\s*([\s\S]*?)\s*\?>/g, function (m, expr) {
              if (expr === 'data') return t.data;
              var f = /^(\w+)\((?:'(\w+)')?\)$/.exec(expr);
              if (f) return f[2] ? ctx[f[1]](f[2]) : ctx[f[1]]();
              throw new Error('scriptlet ' + expr);
            });
            return new HtmlOutput(html);
          }
        };
        return t;
      },
      SandboxMode: {}, XFrameOptionsMode: {}
    },
    Utilities: {
      formatDate: function (d, tz, pattern) {
        var p = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).formatToParts(d);
        var g = {}; p.forEach(function (x) { g[x.type] = x.value; });
        return pattern.replace("'T'", 'T').replace('yyyy', g.year).replace('MM', g.month).replace('dd', g.day).replace('HH', g.hour === '24' ? '00' : g.hour).replace('mm', g.minute).replace('ss', g.second);
      },
      getUuid: function () { return crypto.randomUUID(); },
      computeDigest: function (alg, text) { return Array.from(crypto.createHash('sha256').update(text, 'utf8').digest()).map(function (b) { return b > 127 ? b - 256 : b; }); },
      DigestAlgorithm: { SHA_256: 'SHA_256' }, Charset: { UTF_8: 'UTF_8' }
    },
    PropertiesService: { getDocumentProperties: function () { return ss.props; } },
    Logger: { log: function () { ctx.__logs.push([].slice.call(arguments).join(' ')); } },
    Session: { getScriptTimeZone: function () { return 'Europe/London'; } }
  };
}

/** Loads the real add-on files into one shared scope, as Apps Script does. */
var ORDER = ['i18n.js', 'core.js', 'docs.js', 'sheets.gs', 'licence.gs', 'Code.gs'];
var HTML = ['Sidebar', 'Print', 'styles'];
function load(ss, opts) {
  var fs = require('fs'), path = require('path'), vm = require('vm');
  var dir = path.join(__dirname, '..', 'src'), files = {};
  HTML.forEach(function (n) { files[n] = fs.readFileSync(path.join(dir, n + '.html'), 'utf8'); });
  ['core.js', 'docs.js', 'i18n.js'].forEach(function (n) { files[n.replace('.js', '')] = '<script>' + fs.readFileSync(path.join(dir, n), 'utf8') + '</script>'; });
  if (!ss.props) ss.props = props();
  var ctx = { __logs: [], console: opts && opts.quiet ? { log: function () {}, error: function () {} } : console };
  var svc = services(ss, files, ctx);
  Object.keys(svc).forEach(function (k) { ctx[k] = svc[k]; });
  if (opts && opts.now) {
    var RealDate = Date, fixed = new RealDate(opts.now).getTime();
    var FakeDate = function (a, b, c, d, e, f, g) { if (!arguments.length) return new RealDate(fixed); return arguments.length === 1 ? new RealDate(a) : new RealDate(a, b, c || 1, d || 0, e || 0, f || 0, g || 0); };
    FakeDate.UTC = RealDate.UTC; FakeDate.now = function () { return fixed; }; FakeDate.parse = RealDate.parse; FakeDate.prototype = RealDate.prototype;
    ctx.Date = FakeDate;
  }
  vm.createContext(ctx);
  if (opts && opts.bundle) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'dist', 'tip-fair.gs.txt'), 'utf8'), ctx, { filename: 'tip-fair.gs.txt' });
  else ORDER.forEach(function (f) { vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f }); });
  return ctx;
}
function props() {
  var m = {};
  return { getProperty: function (k) { return m.hasOwnProperty(k) ? m[k] : null; }, setProperty: function (k, v) { m[k] = String(v); return this; },
    setProperties: function (o) { Object.keys(o).forEach(function (k) { m[k] = String(o[k]); }); return this; }, getProperties: function () { return Object.assign({}, m); },
    deleteProperty: function (k) { delete m[k]; return this; } };
}

module.exports = { Sheet: Sheet, Spreadsheet: Spreadsheet, load: load, display: display, ORDER: ORDER, HTML: HTML };
