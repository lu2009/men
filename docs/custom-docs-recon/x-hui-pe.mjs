// 解码 Hui.formatted.js 里 ProductionEdit 模块的字符串（解码器 _0x12cc，表 _0x5aaf，shift 190）
// 用法：node x-hui-pe.mjs <fromLine> <toLine>
import fs from 'node:fs';

const src = fs.readFileSync('/Users/aaa/Desktop/door-main/legacy/js/Hui.formatted.js', 'utf8');
const lines = src.split('\n');

// 1) 表
const tblDef = src.indexOf('function _0x5aaf(){');
const arrMarker = 'const e=[';
const arrStart = src.indexOf(arrMarker, tblDef) + arrMarker.length;
let arrEnd = arrStart, body = null;
for (;;) {
  arrEnd = src.indexOf('];', arrEnd + 1);
  const tail = src.slice(arrEnd + 2, arrEnd + 40);
  if (/^\s*return\(_0x5aaf=/.test(tail)) { body = src.slice(arrStart, arrEnd); break; }
  if (arrEnd < 0) throw new Error('table end not found');
}
const arr = eval('[' + body + ']');

function b64(x) {
  let t = '', l = '';
  for (let o, aa, n = 0, u = 0; (aa = x.charAt(u++)); ~aa && ((o = n % 4 ? 64 * o + aa : aa), n++ % 4) ? (t += String.fromCharCode(255 & (o >> ((-2 * n) & 6)))) : 0)
    aa = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/='.indexOf(aa);
  for (let i = 0; i < t.length; i++) l += '%' + ('00' + t.charCodeAt(i).toString(16)).slice(-2);
  return decodeURIComponent(l);
}
const plain = arr.map((v) => { try { return b64(v); } catch { return v; } });

// 2) 旋转量：用锚点 t(266)==='value'（源码里 `l[t(266)]=e`，l 是 ref）
const SHIFT = 190;
const mod = (n, m) => ((n % m) + m) % m;
let ROT = null;
for (let r = 0; r < plain.length; r++) {
  const g = (x) => plain[mod(x - SHIFT + r, plain.length)];
  if (g(266) === 'value' && g(249) === 'modelValue') { ROT = r; break; }
}
if (ROT === null) { console.error('rotation not found; len=' + plain.length); process.exit(1); }
console.error('ROT=' + ROT + ' len=' + plain.length);
const dec = (x) => plain[mod(x - SHIFT + ROT, plain.length)];

const [from, to] = process.argv.slice(2).map(Number);
if (!to) {
  for (let i = 0; i < 400; i++) { const v = dec(i); if (typeof v === 'string') console.log(i, JSON.stringify(v)); }
} else {
  const seg = lines.slice(from - 1, to).join('\n');
  console.log(seg.replace(/\b[a-zA-Z_]\((\d{3})\)/g, (m, n) => {
    const v = dec(Number(n));
    return typeof v === 'string' ? '【' + v.replace(/\n/g, '\\n') + '】' : m;
  }));
}
