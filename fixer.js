var fs = require('fs-extra')
var async = require('async');
var cheerio = require('cheerio');
var path = require('path');

const ERROR_RE = /(.+\.wxs)\((\d+)\): error LGHT0103: .+'(.+)'/gi;
const SOURCE_RE = /Source[\s]*=[\s]*"([^"]+)"/;
const BAD_SYMBOLS_RE = /[!"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~]/g;

exports.fixErrors = (errorsFile, filesDir, callback) => {
    fs.readFile(errorsFile, 'utf8', (err, text) => {
        if (err) callback(err);
        var errors = [];
        for (var m; m = ERROR_RE.exec(text);){
            var wxsFile = m[1];
            var lineNumber = parseInt(m[2]);
            var missedFile = m[3];
            errors.push({wxsFile, lineNumber, missedFile});
        }
        async.eachSeries(errors, (error, callback) => {
            var wxsFile = error.wxsFile;
            var lineNumber = error.lineNumber;
            var missedFile = error.missedFile;
            fs.readFile(wxsFile, 'utf8', (err, text) => {
                if (err) callback(err);
                var line = text.split(/\r\n|\n/)[lineNumber - 1];
                var source = line.match(SOURCE_RE)[1];
                var $ = cheerio.load(text, {
                    xmlMode: true
                });
                var escapedSource = source.replace(BAD_SYMBOLS_RE, "\\$&");
                var fileId = $('File[Source=' + escapedSource + ']')
                    .attr('Id');
                fileId = fileId || path.basename(source);
                console.log(fileId);
                var localFile = path.join(filesDir, fileId);
                var targetDir = path.dirname(missedFile);
                fs.ensureDir(targetDir, (err) => {
                    if (err) callback(err);
                    fs.copy(localFile, missedFile, callback);
                });
            });
        },
        (err) => {
            if (err) callback(err);
            callback(null);
        });
    });
};
