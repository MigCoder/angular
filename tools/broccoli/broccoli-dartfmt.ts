/// <reference path="../typings/node/node.d.ts" />
/// <reference path="../typings/fs-extra/fs-extra.d.ts" />
import fse = require('fs-extra');
import path = require('path');
import {wrapDiffingPlugin, DiffingBroccoliPlugin, DiffResult} from './diffing-broccoli-plugin';
var spawn = require('child_process').spawn;
var exec = require('child_process').exec;

function processToPromise(process) {
  return new Promise(function(resolve, reject) {
    process.on('close', function(code) {
      if (code) {
        reject(code);
      } else {
        resolve();
      }
    });
  });
}

class DartFormatter implements DiffingBroccoliPlugin {
  private DARTFMT: string;
  private verbose: boolean;

  constructor(public inputPath: string, public cachePath: string, options) {
    if (!options.dartSDK) throw new Error("Missing Dart SDK");
    this.DARTFMT = options.dartSDK.DARTFMT;
    this.verbose = options.logs.dartfmt;
  }

  rebuild(treeDiff: DiffResult): Promise<any> {
    let args = ['-w'];
    treeDiff.changedPaths.forEach((changedFile) => {
      let sourcePath = path.join(this.inputPath, changedFile);
      let destPath = path.join(this.cachePath, changedFile);
      if (/\.dart$/.test(changedFile)) args.push(destPath);
      fse.copySync(sourcePath, destPath);
    });
    treeDiff.removedPaths.forEach((removedFile) => {
      let destPath = path.join(this.cachePath, removedFile);
      fse.removeSync(destPath);
    });

    if (args.length < 1) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      exec(this.DARTFMT + ' ' + args.join(' '), (err, stdout, stderr) => {
        if (this.verbose) {
          console.log(stdout);
        }
        if (err) {
          console.error(shortenFormatterOutput(stderr));
          reject('Formatting failed.');
        } else {
          resolve();
        }
      });
    });
  }
}

export default wrapDiffingPlugin(DartFormatter);

var ARROW_LINE = /^(\s+)\^+/;
var BEFORE_CHARS = 15;
var stripAnsi = require('strip-ansi');
function shortenFormatterOutput(formatterOutput) {
  var lines = formatterOutput.split('\n');
  var match, line;
  for (var i = 0; i < lines.length; i += 1) {
    line = lines[i];
    if (match = stripAnsi(line).match(ARROW_LINE)) {
      let leadingWhitespace = match[1].length;
      let leadingCodeChars = Math.min(leadingWhitespace, BEFORE_CHARS);
      lines[i] = line.substr(leadingWhitespace - leadingCodeChars);
      lines[i - 1] = lines[i - 1].substr(leadingWhitespace - leadingCodeChars, 80) + '…';
    }
  }
  return lines.join('\n');
}
