// Runs every test file and prints one summary line (failures in full).
var files = ['./core.test.js'].concat(require('fs').existsSync(__dirname + '/gs.test.js') ? ['./gs.test.js'] : []).concat(require('fs').existsSync(__dirname + '/docs.test.js') ? ['./docs.test.js'] : []);
var pass = 0, fail = 0;
files.forEach(function (f) {
  require(f).forEach(function (x) {
    try { x[1](); pass++; } catch (e) { fail++; console.log('FAIL ' + x[0] + ': ' + (e && e.message)); }
  });
});
console.log((fail ? 'FAILED ' : 'OK ') + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
