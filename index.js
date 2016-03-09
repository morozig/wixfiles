var fixer = require('./fixer.js');

var errorsLog = process.argv[2];
var unzippedDirPAth = process.argv[3];

fixer.fixErrors(errorsLog, unzippedDirPAth, (err) => {
    if (err) throw err;
    console.log('Done!');
});
