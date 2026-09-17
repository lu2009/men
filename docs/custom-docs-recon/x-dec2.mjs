// GlassSheet2 模块自己的字符串表（Ln, shift=170, 旋转 +37）—— 直接 eval 原解码器再套旋转
import fs from 'node:fs';

const src = fs.readFileSync('/Users/aaa/Desktop/door-main/legacy/js/Home-d6b13b9a.js', 'utf8');
const a = src.indexOf('function Ln(){const e=[');
const b = src.indexOf('];return(Ln=function', a);
const arr = eval('[' + src.slice(a + 'function Ln(){const e=['.length, b) + ']');

const mod = (n, m) => ((n % m) + m) % m;
// 旋转量由 Mn/Nn/En 的定义反推：Bn(222)=gs2-layout-wrap, Bn(311)=gs2-layout-left, Bn(313)=innerHTML
function decRaw(i) { // 无旋转
  let x = arr[i];
  if (x === undefined) return undefined;
  return x;
}
// 还原 base64 变体解码
function b64(x) {
  let t = '', l = '';
  for (let o, aa, n = 0, u = 0; (aa = x.charAt(u++)); ~aa && ((o = n % 4 ? 64 * o + aa : aa), n++ % 4) ? (t += String.fromCharCode(255 & (o >> ((-2 * n) & 6)))) : 0)
    aa = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/='.indexOf(aa);
  for (let i = 0; i < t.length; i++) l += '%' + ('00' + t.charCodeAt(i).toString(16)).slice(-2);
  return decodeURIComponent(l);
}
const plain = arr.map((v) => { try { return b64(v); } catch { return v; } });

let ROT = null;
for (let r = 0; r < 255; r++) {
  const g = (x) => plain[mod(x - 170 + r, 255)];
  if (g(222) === 'gs2-layout-wrap' && g(311) === 'gs2-layout-left' && g(313) === 'innerHTML') { ROT = r; break; }
}
console.error('ROT =', ROT, 'len =', plain.length);
const dec = (x) => plain[mod(x - 170 + ROT, 255)];

const args = process.argv.slice(2);
if (args[0] === '--dump') {
  for (let i = 0; i < 600; i++) {
    let v = dec(i);
    if (typeof v === 'string') console.log(i, JSON.stringify(v));
  }
} else {
  for (const t of args) console.log(t, JSON.stringify(dec(Number(t))));
}
