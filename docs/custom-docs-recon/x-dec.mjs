// 直接 eval Home 大表解码器 dr（含旋转 IIFE），解出玻璃合片单用到的大表字符串
import fs from 'node:fs';

const src = fs.readFileSync('/Users/aaa/Desktop/door-main/legacy/js/Home-d6b13b9a.js', 'utf8');

// 1) 旋转 IIFE（引用了 dr 与 Vr）
const iifeStart = src.indexOf('!function(){const e=dr,t=Vr()');
if (iifeStart < 0) throw new Error('no dr rotation iife');
const iifeEnd = src.indexOf('}();', iifeStart) + 4;

// 2) dr 解码器本体
const drStart = src.indexOf('function dr(e,t)');
const drEnd = src.indexOf('dr(e,t)}', drStart) + 'dr(e,t)}'.length;

// 3) 表
const tblStart = src.indexOf('function Vr(){const e=[');
const tblEnd = src.indexOf('];return(Vr=function', tblStart);

const code = [
  src.slice(iifeStart, iifeEnd),
  src.slice(drStart, drEnd),
  src.slice(tblStart, tblEnd) + '];return(Vr=function(){return e})()}',
].join('\n');

eval(code + '\nglobalThis.__dr = dr;');
const d = globalThis.__dr;

const args = process.argv.slice(2);
if (args[0] === '--dump') {
  for (let i = 0; i < 2000; i++) {
    let v; try { v = d(i); } catch { continue; }
    if (typeof v === 'string' && /gs2|gs-root|gs-sheet|玻璃|合片|布局|纸张|门图|方向|订单信息|客户|门类|单号|备注/.test(v)) console.log(i, JSON.stringify(v));
  }
} else {
  for (const a of args) {
    let v; try { v = d(Number(a)); } catch (e) { v = '<ERR>'; }
    console.log(a, JSON.stringify(v));
  }
}
