// 通用：从 Hui.formatted.js 里 eval「表函数 + 解码器函数 + 其旋转 IIFE」，得到真解码器
// 用法：node x-hui.mjs <tableFn> <decFn> <fromLine> <toLine>
import fs from 'node:fs';

const srcAll = fs.readFileSync('/Users/aaa/Desktop/door-main/legacy/js/Hui.formatted.js', 'utf8');
const lines = srcAll.split('\n');
const [tblFn, decFn, fromL, toL] = process.argv.slice(2);

// 1) 表函数
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
// 表函数整体文本（含 return）
const tblEnd = srcAll.indexOf('}\n', srcAll.indexOf('})()', arrEnd)) + 1;

// 2) 解码器函数：从定义到 `,decFn(e,t)}`
const decStart = srcAll.indexOf(`function ${decFn}(e,t){`);
const decEndM = new RegExp(`,${decFn}\\(e,t\\)\\s*\\}`).exec(srcAll.slice(decStart));
if (!decEndM) throw new Error('decoder end not found');
const decEnd = decStart + decEndM.index + decEndM[0].length;

// 3) 旋转 IIFE：包含对 decFn 的引用
let iife = null;
const re = /!function\(/g;
let m;
while ((m = re.exec(srcAll))) {
  // 花括号配平找结尾
  let i = srcAll.indexOf('{', m.index), depth = 0, end = -1;
  for (; i < srcAll.length; i++) {
    if (srcAll[i] === '{') depth++;
    else if (srcAll[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  const blob = srcAll.slice(m.index, end + 3);
  if (blob.includes(decFn) && blob.includes(`${tblFn}()`)) { iife = blob; break; }
}
if (!iife) throw new Error('rotation iife not found for ' + decFn);

const code = [
  `function ${tblFn}(){const e=[${body}];return(${'function(){return e}'})()}`.replace('return(function', 'return(function'),
  srcAll.slice(decStart, decEnd),
  iife,
].join('\n');
// 简单起见：表函数直接重建
const rebuilt = `function ${tblFn}(){ const e=[${body}]; return (${tblFn}=function(){return e})() }`;
eval([rebuilt, srcAll.slice(decStart, decEnd), iife].join('\n') + `\nglobalThis.__d=${decFn};`);
const dec = globalThis.__d;

if (!toL) {
  // 自检：打印若干索引
  for (const i of process.argv.slice(4)) console.log(i, JSON.stringify(dec(Number(i))));
} else {
  const seg = lines.slice(fromL - 1, toL).join('\n');
  console.log(seg.replace(/\b[a-zA-Z_]\((\d{3})\)/g, (mm, n) => {
    let v; try { v = dec(Number(n)); } catch { return mm; }
    return typeof v === 'string' ? '【' + v.replace(/\n/g, '\\n') + '】' : mm;
  }));
}
