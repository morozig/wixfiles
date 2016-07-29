var fs = require('fs-extra')
var async = require('async');
var cheerio = require('cheerio');
var path = require('path');

const ERROR_RE = /(.+\.wxs)\((\d+)\): error LGHT0103: .+'(.+)'.+\[(.+)\]/gi;
const SOURCE_RE = /Source[\s]*=[\s]*"([^"]+)"/;
const BINARY_SOURCE_FILE_RE = /SourceFile[\s]*=[\s]*"([^"]+)"/;
const BAD_SYMBOLS_RE = /[!"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~]/g;

exports.fixErrors = (errorsFile, filesDir, callback) => {
    fs.readFile(errorsFile, 'utf8', (err, text) => {
        if (err) callback(err);
        var errors = [];
        for (var m; m = ERROR_RE.exec(text);){
            var wxsFile = m[1];
            var lineNumber = parseInt(m[2]);
            var missedFile = m[3];
            var wixProjFile = m[4];
            if (!path.isAbsolute(missedFile)){
                missedFile = path.join(path.dirname(wixProjFile), missedFile);
            }
            errors.push({wxsFile, lineNumber, missedFile});
        }
        async.eachSeries(errors, (error, callback) => {
            var wxsFile = error.wxsFile;
            var lineNumber = error.lineNumber;
            var missedFile = error.missedFile;
            fs.readFile(wxsFile, 'utf8', (err, text) => {
                if (err) callback(err);
                var lines = text.split(/\r\n|\n/);
                var source = '';
                for (var i = lineNumber - 1; i < lines.length; i++){
                    var line = lines[i];
                    var match = line.match(SOURCE_RE);
                    if (match){
                        source = match[1];
                        break;
                    }
                }
                if (source === ''){
                    line = lines[lineNumber - 1];
                    match = line.match(BINARY_SOURCE_FILE_RE);
                    if (match){
                        console.log('File is binary: "' + missedFile + '"');
                    } else {
                        console.log(
                            'Could not find file: "' + missedFile + '"'
                        );
                    }
                    callback(null);
                    return;
                }
                var $ = cheerio.load(text, {
                    xmlMode: true
                });
                var escapedSource = source.replace(BAD_SYMBOLS_RE, "\\$&");
                var fileId = $('File[Source=' + escapedSource + ']')
                    .attr('Id');
                if (!fileId){
                    var sourceWithoutVars = source.match(/([^\)]+)/g).pop();
                    fileId = path.basename(sourceWithoutVars);
                }
                var localFile = path.join(filesDir, fileId);
                var targetDir = path.dirname(missedFile);
                fs.ensureDir(targetDir, (err) => {
                    if (err) callback(err);
                    fs.copy(localFile, missedFile, (err) => {
                        if (err){
                            if (err.code === "ENOENT"){
                                console.log(err.message);
                                callback(null);
                            } else callback(err);
                        } else {
                            console.log('Copied:', fileId);
                            callback(null);
                        }
                    });
                });
            });
        },
        (err) => {
            if (err) callback(err);
            callback(null);
        });
    });
};
