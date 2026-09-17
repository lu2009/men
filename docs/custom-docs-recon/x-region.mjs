// 把 Home 大表里某个字符区间的显式解码调用 (NNN) 就地替换成明文，便于阅读
import fs from 'node:fs';

const src = fs.readFileSync('/Users/aaa/Desktop/door-main/legacy/js/Home-d6b13b9a.js', 'utf8');
const iifeStart = src.indexOf('!function(){const e=dr,t=Vr()');
const iifeEnd = src.indexOf('}();', iifeStart) + 4;
const drStart = src.indexOf('function dr(e,t)');
const drEnd = src.indexOf('dr(e,t)}', drStart) + 'dr(e,t)}'.length;
const tblStart = src.indexOf('function Vr(){const e=[');
const tblEnd = src.indexOf('];return(Vr=function', tblStart);
eval([src.slice(iifeStart, iifeEnd), src.slice(drStart, drEnd), src.slice(tblStart, tblEnd) + '];return(Vr=function(){return e})()}'].join('\n') + '\nglobalThis.__dr=dr;');
const d = globalThis.__dr;

const [from, to] = process.argv.slice(2).map(Number);
let seg = src.slice(from, to);
seg = seg.replace(/\((\d{3,4})\)/g, (m, n) => {
  let v; try { v = d(Number(n)); } catch { return m; }
  if (typeof v !== 'string') return m;
  if (!/[一-龥A-Za-z]/.test(v)) return m;
  return '【' + v.replace(/\n/g, '\\n') + '】';
});
console.log(seg);
