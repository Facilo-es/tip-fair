// One-file build of the add-on for venues that install it by pasting into Extensions > Apps Script.
// Same code as src/, in Apps Script's load order, with the HTML files inlined as strings.
// The manifest goes alongside, so the scopes stay exactly the two in appsscript.json.
// node tools/bundle.js  ->  dist/tip-fair.gs.txt, dist/appsscript.json.txt
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const A = path.join(__dirname, '..', 'src');
const read = (f) => fs.readFileSync(path.join(A, f), 'utf8');
const strip = (src) => src.replace(/\nif \(typeof module !== 'undefined'[^\n]*\n?/g, '\n');

const html = {
  Sidebar: read('Sidebar.html'),
  Print: read('Print.html'),
  styles: read('styles.html'),
  core: '<script>\n' + strip(read('core.js')) + '\n</script>'
};
let code = read('Code.gs')
  .replace(/HtmlService\.createTemplateFromFile\('(\w+)'\)/g, (m, n) => { if (!html[n]) throw new Error(n); return `HtmlService.createTemplate(HTML_FILES_['${n}'])`; })
  .replace(/function include\(name\) \{[^\n]*\}/, 'function include(name) { return HTML_FILES_[name]; }');
if (/FromFile/.test(code)) throw new Error('a file lookup is left in Code.gs');

const out = [
  '/** @OnlyCurrentDoc */',
  '// Tip Fair for Google Sheets · https://tipfair.facilo.es',
  '// Paste this whole file into Extensions > Apps Script (Code.gs), save, and reopen your spreadsheet.',
  '// It only reads and writes the spreadsheet it is installed in. Your tips data never leaves Google.',
  '',
  strip(read('core.js')), strip(read('i18n.js')), strip(read('docs.js')), code, read('sheets.gs'), read('licence.gs'),
  'var HTML_FILES_ = ' + JSON.stringify(html) + ';',
  ''
].join('\n')
  // Pure ASCII, so copying from a page served without a charset can't garble £, € or accents.
  .replace(/[^\x00-\x7f]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));

const dir = path.join(__dirname, '..', 'dist');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'tip-fair.gs.txt'), out);
fs.copyFileSync(path.join(A, 'appsscript.json'), path.join(dir, 'appsscript.json.txt'));
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 12);
console.log('tip-fair.gs.txt ' + out.length + ' bytes ' + sha(out) + ', appsscript.json.txt ' + sha(read('appsscript.json')));
