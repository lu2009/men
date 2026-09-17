// 在 Home 大表 dr 里按明文找索引，并给出去重后的所有用法位置
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

const needles = process.argv.slice(2);
const hitsByNeedle = new Map(needles.map((n) => [n, []]));
for (let i = 467; i < 467 + 1100; i++) {
  let v; try { v = d(i); } catch { continue; }
  if (typeof v !== 'string') continue;
  for (const n of needles) if (v.includes(n)) hitsByNeedle.get(n).push([i, v]);
}
for (const n of needles) {
  console.log('### ' + n);
  for (const [i, v] of hitsByNeedle.get(n)) {
    // 找用法位置
    const uses = [];
    let p = -1;
    while ((p = src.indexOf('(' + i + ')', p + 1)) >= 0) { uses.push(p); if (uses.length > 12) break; }
    console.log('  idx=' + i, JSON.stringify(v), 'uses=' + uses.join(','));
  }
}
