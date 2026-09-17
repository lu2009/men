const fs = require('fs');
const p = '/Users/aaa/Desktop/door-main/legacy/js/Receipt2.deobfuscated.js';
const lines = fs.readFileSync(p, 'utf8').split('\n');
// lines 371..438 (1-based) contain the `ue` arrow function
let code = lines.slice(370, 438).join('\n').replace(/^\s*ue = /, '');
code = code.replace(/,\s*$/, '');
const l = (x) => x;
const n = { value: [13.2, 4.2, 6.6, 12.1, 13.6, 4, 4.4, 5.4, 22.8, 13.5] };
const ue = eval(code);
const font = { headerFontSize: 30, tableFontSize: 15, amountFontSize: 20, metaFontSize: 18, declarationFontSize: 15, orderDateFontSize: 13 };
const pageL = { copies: 1, widthMm: 200, heightMm: 140, orientation: 'landscape' };
const pageP = { copies: 1, widthMm: 148, heightMm: 210, orientation: 'portrait' };
fs.writeFileSync('/tmp/r2-analysis/css-landscape.css', ue(font, pageL));
fs.writeFileSync('/tmp/r2-analysis/css-portrait.css', ue(font, pageP));
console.log('OK bytes:', ue(font, pageL).length);
