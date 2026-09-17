// 用 GlassSheet2 模块自己的表（Ln, shift=170, 旋转 +37）就地解码某字符区间
import fs from 'node:fs';

const src = fs.readFileSync('/Users/aaa/Desktop/door-main/legacy/js/Home-d6b13b9a.js', 'utf8');
const a = src.indexOf('function Ln(){const e=[');
const b = src.indexOf('];return(Ln=function', a);
const arr = eval('[' + src.slice(a + 'function Ln(){const e=['.length, b) + ']');
const mod = (n, m) => ((n % m) + m) % m;
function b64(x) {
  let t = '', l = '';
  for (let o, aa, n = 0, u = 0; (aa = x.charAt(u++)); ~aa && ((o = n % 4 ? 64 * o + aa : aa), n++ % 4) ? (t += String.fromCharCode(255 & (o >> ((-2 * n) & 6)))) : 0)
    aa = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/='.indexOf(aa);
  for (let i = 0; i < t.length; i++) l += '%' + ('00' + t.charCodeAt(i).toString(16)).slice(-2);
  return decodeURIComponent(l);
}
const plain = arr.map((v) => { try { return b64(v); } catch { return v; } });
// 旋转量：由 Mn/Nn/En 反推
let ROT = null;
for (let r = 0; r < 255; r++) {
  const g = (x) => plain[mod(x - 170 + r, 255)];
  if (g(222) === 'gs2-layout-wrap' && g(311) === 'gs2-layout-left' && g(313) === 'innerHTML') { ROT = r; break; }
}
const dec = (x) => plain[mod(x - 170 + ROT, 255)];

const [from, to] = process.argv.slice(2).map(Number);
let seg = src.slice(from, to);
seg = seg.replace(/\((\d{3})\)/g, (m, n) => {
  const v = dec(Number(n));
  if (typeof v !== 'string') return m;
  return '【' + v.replace(/\n/g, '\\n').replace(/"/g, '\\"') + '】';
});
console.log(seg);
