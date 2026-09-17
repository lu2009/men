// 不 eval 旋转 IIFE（那个 for(;;) 可能死循环）：改用锚点暴力求旋转量
// 用法：node x-hui2.mjs <tableFn> <shift> <fromLine> <toLine>
import fs from 'node:fs';

const srcAll = fs.readFileSync('/Users/aaa/Desktop/door-main/legacy/js/Hui.formatted.js', 'utf8');
const lines = srcAll.split('\n');
const [tblFn, shiftS, fromL, toL] = process.argv.slice(2);
const SHIFT = Number(shiftS);

const tblStart = srcAll.indexOf(`function ${tblFn}(){`);
if (tblStart < 0) throw new Error('table fn not found: ' + tblFn);
let p = srcAll.indexOf('const e=[', tblStart) + 'const e=['.length;
let arrEnd = p, body = null;
for (;;) {
  arrEnd = srcAll.indexOf('];', arrEnd + 1);
  if (arrEnd < 0) throw new Error('table end not found');
  if (/^\s*return\(/.test(srcAll.slice(arrEnd + 2, arrEnd + 30))) { body = srcAll.slice(p, arrEnd); break; }
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
const mod = (n, m) => ((n % m) + m) % m;

// 锚点：本组件 render 里的 Vue.resolveComponent(x(NNN)) 一定解出 element-plus 组件名
const COMP = new Set(['el-input', 'el-button', 'el-dialog', 'el-table', 'el-table-column', 'el-image', 'el-upload', 'el-icon', 'el-form', 'el-form-item', 'el-select', 'el-option', 'el-alert', 'el-tabs', 'el-tab-pane', 'el-checkbox', 'el-color-picker', 'el-input-number']);
const scope = lines.slice(Number(fromL) - 1, Number(toL)).join('\n');
const anchors = [];
{
  // 在目标区间 ±120 行内扫，且只保留索引落在本表值域内的（别的模块解码器索引会越界被滤掉）
  const win = lines.slice(Math.max(0, Number(fromL) - 121), Number(toL) + 120).join('\n');
  const re = /Vue\.resolveComponent\([a-z]\((\d{3})\)\)/g;
  let m;
  while ((m = re.exec(win))) {
    const v = Number(m[1]);
    if (v - SHIFT >= 0 && v - SHIFT < plain.length) anchors.push(v);
  }
}
if (!anchors.length) throw new Error('no resolveComponent anchors in range');

let ROT = null;
for (let r = 0; r < plain.length; r++) {
  const g = (x) => plain[mod(x - SHIFT + r, plain.length)];
  if (anchors.every((a) => COMP.has(g(a)))) { ROT = r; break; }
}
if (ROT === null) { console.error('rotation not found, len=' + plain.length + ', anchors=' + anchors.join(',')); process.exit(1); }
console.error('ROT=' + ROT + ' len=' + plain.length + ' anchors=' + anchors.join(','));
const dec = (x) => plain[mod(x - SHIFT + ROT, plain.length)];

console.log(scope.replace(/\b[a-zA-Z_]\((\d{3})\)/g, (m, n) => {
  let v; try { v = dec(Number(n)); } catch { return m; }
  return typeof v === 'string' ? '【' + v.replace(/\n/g, '\\n') + '】' : m;
}));
