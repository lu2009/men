#!/usr/bin/env node
/**
 * 收据单2 · 分页「打包半」的可执行参考实现
 *
 * 逐字移植自 legacy/js/Receipt2.deobfuscated.js:693-714（`we` 函数内的分页循环），
 * 以及 :715-721 的页切片逻辑。原代码用单字母变量，这里保留原名并逐个注明。
 *
 *   原码           本文件            含义
 *   ---------------------------------------------------------------
 *   a              rows              明细行数组（收据 receipt[]），只用得到 .length
 *   n              rowHeights        每行的高度 px（getBoundingClientRect().height）
 *   u              availNoFooter     本页放得下的行高预算（不含页脚）
 *   r              availWithFooter   本页放得下的行高预算（含页脚）
 *   i              penalty           纸型修正量 0 | 1（原 :667-692 的 switch）
 *   c / s          nfBudget / wfBudget   扣掉 penalty 后的两个预算
 *   V              pages             每页起始行下标
 *   y l t e        y l t e           原样保留
 *
 * 用法：node paginate.mjs        （跑全部用例，自带断言，不通过则退出码 1）
 */

/* ------------------------------------------------------------------ *
 * 1. 主函数 —— 原样逻辑
 * ------------------------------------------------------------------ */

/**
 * @param {number[]} rowHeights            每行高度 px
 * @param {number}   availNoFooter         无页脚时可用的行高预算 px
 * @param {number}   availWithFooter       带页脚时可用的行高预算 px
 * @param {number}   penalty               纸型修正量（0 | 1）
 * @returns {number[]}                     每页起始行下标
 */
export function paginate(rowHeights, availNoFooter, availWithFooter, penalty) {
  const a = rowHeights;
  const n = rowHeights;
  const len = a.length;

  // 原 :693-694
  let c = Math.max(0, availNoFooter - penalty);
  let s = Math.max(0, availWithFooter - penalty);

  // 原 :695-714
  const V = [0];
  let y = 0;
  for (; y < a.length; ) {
    let e = 0;
    for (let u = y; u < a.length; u++) e += n[u];   // 剩余所有行高之和
    if (e <= s) break;                              // 连页脚一起塞得下 → 收工
    let t = 0,
      l = y;
    for (; l < a.length && !(l > y && t + n[l] > c); ) {
      t += n[l];
      l++;
    }
    if (
      (l <= y && (l = y + 1),                        // 「至少前进一行」——死代码，见 §「死补丁」
      l >= a.length && a.length - y > 1 && (l = a.length - 1), // 「给最后一页留一行」
      (y = l),
      !(y < a.length))
    )
      break;
    V.push(y);
  }
  return V;
}

/**
 * 原 :715-721 的页切片：把「起始下标数组」变成 [start, end) 区间。
 * isLast 就是原码里的 `n === a.length`（决定这一页要不要渲染页脚）。
 */
export function pageRanges(pages, rowCount) {
  const out = [];
  for (let l = 0; l < pages.length; l++) {
    const t = pages[l];
    const n = l + 1 < pages.length ? pages[l + 1] : rowCount;
    out.push({ start: t, end: n, rows: n - t, isLast: n === rowCount });
  }
  return out;
}

/** 便捷：一次拿到区间 + 每页实际行高合计 + 该页预算 */
export function paginateDetailed(rowHeights, availNoFooter, availWithFooter, penalty) {
  const pages = paginate(rowHeights, availNoFooter, availWithFooter, penalty);
  const ranges = pageRanges(pages, rowHeights.length);
  const nf = Math.max(0, availNoFooter - penalty);
  const wf = Math.max(0, availWithFooter - penalty);
  return ranges.map((r) => {
    const h = rowHeights.slice(r.start, r.end).reduce((x, v) => x + v, 0);
    const budget = r.isLast ? wf : nf;
    return { ...r, height: round2(h), budget: round2(budget), fits: h <= round2(budget) + 1e-9 };
  });
}

/* ------------------------------------------------------------------ *
 * 2. 带插桩的克隆 —— 只用来证明「至少前进一行」那个补丁是死代码
 * ------------------------------------------------------------------ */

export function paginateTraced(rowHeights, availNoFooter, availWithFooter, penalty) {
  const a = rowHeights,
    n = rowHeights;
  let c = Math.max(0, availNoFooter - penalty);
  let s = Math.max(0, availWithFooter - penalty);
  const trace = [];
  const V = [0];
  let y = 0;
  for (; y < a.length; ) {
    let e = 0;
    for (let u = y; u < a.length; u++) e += n[u];
    if (e <= s) {
      trace.push({ step: 'break: rest fits with footer', y, restSum: round2(e), s: round2(s) });
      break;
    }
    let t = 0,
      l = y;
    for (; l < a.length && !(l > y && t + n[l] > c); ) {
      t += n[l];
      l++;
    }
    const packedTo = l;
    const patchAdvanceFired = l <= y; // 「至少前进一行」是否真的触发过
    if (patchAdvanceFired) l = y + 1;
    const patchLastRowFired = l >= a.length && a.length - y > 1;
    if (patchLastRowFired) l = a.length - 1;
    y = l;
    const done = !(y < a.length);
    trace.push({
      step: 'page',
      from: V[V.length - 1],
      packedTo,
      patchAdvanceFired,
      patchLastRowFired,
      nextY: y,
      done,
      c: round2(c),
      s: round2(s),
    });
    if (done) break;
    V.push(y);
  }
  return { pages: V, trace };
}

/* ------------------------------------------------------------------ *
 * 3. 用例
 * ------------------------------------------------------------------ */

const round2 = (x) => Math.round(x * 100) / 100;

// 每个用例：[名字, rowHeights, availNoFooter, availWithFooter, penalty, 期望 pages]
const CASES = [
  ['1  单页装得下（含页脚）', [30, 30, 30], 100, 90, 0, [0]],

  ['1b 装不下页脚、但正文能装满一页（触发「留一行」补丁）', [30, 30, 35], 100, 90, 0, [0, 2]],

  ['2  边界 t+h === c（刚好塞进）', [50, 50, 30], 100, 90, 0, [0, 2]],
  ['2b 边界 t+h === c + 0.01（超 0.01 被拒）', [50, 50.01, 30], 100, 90, 0, [0, 1]],

  ['3  多页 · 4 页（10 行 × 30）', Array(10).fill(30), 100, 90, 0, [0, 3, 6, 9]],
  ['3b 多页 · 5 页（13 行 × 30）', Array(13).fill(30), 100, 90, 0, [0, 3, 6, 9, 12]],

  ['4  行高极大 · 单行超整页、且是最后一行', [10, 10, 200], 100, 90, 0, [0, 2]],
  ['4b 行高极大 · 单行超整页、后面还有行', [10, 200, 10], 100, 90, 0, [0, 1, 2]],
  ['4c 行高极大 · 只有一行且超整页', [200], 100, 90, 0, [0]],

  ['5  只剩 1 行会不会被上一页带走 · 装得下（1 页）', [25, 25, 25, 25], 100, 100, 0, [0]],
  ['5b 只剩 1 行会不会被上一页带走 · 真装不下（2 页）', [25, 25, 25, 25, 25], 100, 100, 0, [0, 4]],
  ['5c 只剩 1 行 · 补丁强制切走（2 页）', [30, 30, 35], 100, 90, 0, [0, 2]],

  ['6  penalty 0 vs 1 · 切分点不同', [50, 50, 30], 100, 90, 0, [0, 2]],
  ['6b penalty 1 · 切分点移到第 1 行', [50, 50, 30], 100, 90, 1, [0, 1]],
  ['6c penalty 0 · 1 页', [30, 30, 30], 100, 90, 0, [0]],
  ['6d penalty 1 · 变 2 页', [30, 30, 30], 100, 90, 1, [0, 2]],

  ['7  空数组', [], 100, 90, 0, [0]],

  ['8a 单行 · 装得下', [30], 100, 90, 0, [0]],
  ['8b 预算退化 · c=s=0（每页一行）', [10, 10, 10], 0, 0, 0, [0, 1, 2]],
  ['8c 预算退化 · c=s=0 且单行超高', [10, 10, 10], 5, 5, 0, [0, 1, 2]],
  ['8d 全零行高（极端，不应死循环）', [0, 0, 0], 0, 0, 0, [0]],
  ['8f 0 高行会独占一页（反直觉）', [0, 5, 0], 0, 0, 0, [0, 1, 2]],
  ['8g 中间页塞满 c、末页只剩一点点', [60, 40, 20], 100, 100, 0, [0, 2]],
  ['8e 50 行 · 大用例', Array(50).fill(30), 100, 90, 0, [0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36, 39, 42, 45, 48]],
];

/* ------------------------------------------------------------------ *
 * 4. 跑（只有直接执行才跑；被 import 时只导出上面三个函数）
 * ------------------------------------------------------------------ */

import { pathToFileURL } from 'node:url';
const EXECUTED_DIRECTLY =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (EXECUTED_DIRECTLY) {
let failed = 0;

function fmtRows(h) {
  return '[' + h.join(', ') + ']';
}

console.log('='.repeat(100));
console.log('收据单2 · 分页打包 —— 全部用例');
console.log('='.repeat(100));

for (const [name, rows, u, r, p, expected] of CASES) {
  const c = Math.max(0, u - p);
  const s = Math.max(0, r - p);
  const actual = paginate(rows, u, r, p);
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;

  const detail = paginateDetailed(rows, u, r, p);
  console.log('\n── ' + name + ' ' + '─'.repeat(Math.max(0, 92 - name.length)));
  console.log(
    `   输入  rows=${rows.length > 12 ? `Array(${rows.length}).fill(${rows[0]})` : fmtRows(rows)}` +
      `  availNoFooter=${u}  availWithFooter=${r}  penalty=${p}`,
  );
  console.log(`   预算  c(无页脚)=${round2(c)}  s(带页脚)=${round2(s)}`);
  console.log(`   产出  pages=${fmtRows(actual)}   ${ok ? '✅ 与预期一致' : `❌ 预期 ${fmtRows(expected)}`}`);
  console.log(
    '   分页  ' +
      detail
        .map(
          (d) =>
            `${d.isLast ? '末页' : '中间页'}[${d.start},${d.end}) ` +
            `${d.rows}行 高${d.height}/预算${d.budget}${d.fits ? '' : ' ⚠溢出'}`,
        )
        .join('  |  '),
  );
}

/* ---- 死代码证明 ---- */

console.log('\n' + '='.repeat(100));
console.log('插桩：两个补丁各触发了几次（跑遍上面全部用例）');
console.log('='.repeat(100));

let advanceFired = 0,
  lastRowFired = 0,
  pageCount = 0;
for (const [, rows, u, r, p] of CASES) {
  const { trace } = paginateTraced(rows, u, r, p);
  for (const t of trace) {
    if (t.step !== 'page') continue;
    pageCount++;
    if (t.patchAdvanceFired) advanceFired++;
    if (t.patchLastRowFired) lastRowFired++;
  }
}
console.log(`   翻页决策次数        = ${pageCount}`);
console.log(`   「至少前进一行」触发 = ${advanceFired}`);
console.log(`   「给最后一页留一行」触发 = ${lastRowFired}`);

/* ---- 不变式检查 ---- */

console.log('\n' + '='.repeat(100));
console.log('不变式检查（全部用例 + 随机模糊）');
console.log('='.repeat(100));

/**
 * 逐条不变式。注意「每页预算」有两条**例外**，它们是算法「保证前进一行」的直接后果：
 *   非末页：sum <= c  或  (该页恰好 1 行且该行 > c)
 *   末  页：sum <= s  或  (该页恰好 1 行且该行 > s)
 * 单行本身超过一整页预算时，算法不切分行，只能溢出。
 */
function checkInvariants(rows, u, r, p) {
  const pg = paginate(rows, u, r, p);
  const len = rows.length;
  const c = Math.max(0, u - p);
  const s = Math.max(0, r - p);
  const errs = [];
  const sum = (a, b) => rows.slice(a, b).reduce((x, v) => x + v, 0);

  if (!(pg.length >= 1)) errs.push('pages 为空');
  if (pg[0] !== 0) errs.push(`pages[0]=${pg[0]} ≠ 0`);
  if (!pg.every((v, i) => i === 0 || v > pg[i - 1])) errs.push('pages 非严格递增（会产生空页）');
  if (!pg.every((v) => v >= 0 && v <= len)) errs.push('下标越界');
  if (len > 0 && !pg.every((v, i) => (i + 1 < pg.length ? pg[i + 1] - v : len - v) >= 1))
    errs.push('存在空页');

  for (let k = 0; k < pg.length; k++) {
    const a = pg[k];
    const b = k + 1 < pg.length ? pg[k + 1] : len;
    const isLast = b === len;
    const h = sum(a, b);
    const budget = isLast ? s : c;
    const nRows = b - a;
    if (!(h <= budget + 1e-9 || nRows === 1)) {
      errs.push(`页[${a},${b}) 高${round2(h)} > 预算${round2(budget)} 且行数=${nRows}≠1`);
    }
  }
  return { pages: pg, errs };
}

let invFailed = 0;
for (const [name, rows, u, r, p] of CASES) {
  const { pages, errs } = checkInvariants(rows, u, r, p);
  if (errs.length) {
    console.log(`   ❌ ${name}  pages=${fmtRows(pages)}`);
    errs.forEach((e) => console.log(`        ${e}`));
    invFailed += errs.length;
  }
}
console.log(`   固定用例：${CASES.length} 个，失败 ${invFailed}`);

/* ---- 随机模糊：20 万组，验证「不死循环 + 不变式 + 补丁死代码」 ---- */

let seed = 20260917;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const pick = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));

const FUZZ = 200000;
let fuzzFail = 0,
  fuzzAdvanceFired = 0,
  fuzzLastRowFired = 0,
  fuzzPages = 0,
  fuzzMulti = 0,
  fuzzOverflowPages = 0;
const fuzzSamples = [];

for (let it = 0; it < FUZZ; it++) {
  const len = pick(0, 14);
  const rows = [];
  for (let i = 0; i < len; i++) {
    const mode = pick(1, 10);
    // 覆盖：正常小数 / 整数 / 0 高 / 超高单行
    rows.push(mode <= 6 ? round2(rnd() * 60) : mode <= 9 ? pick(0, 90) : pick(0, 400));
  }
  const u = pick(0, 300);
  const r = pick(0, u); // 页脚高 ≥ 0 ⇒ r ≤ u 恒成立
  const p = pick(0, 1);

  const { pages: pg, errs } = checkInvariants(rows, u, r, p);
  if (errs.length) {
    fuzzFail++;
    if (fuzzSamples.length < 5)
      fuzzSamples.push({ rows, u, r, p, pg: pg.slice(), errs });
  }
  const { trace } = paginateTraced(rows, u, r, p);
  for (const t of trace) {
    if (t.step !== 'page') continue;
    fuzzPages++;
    if (t.patchAdvanceFired) fuzzAdvanceFired++;
    if (t.patchLastRowFired) fuzzLastRowFired++;
  }
  if (pg.length > 1) fuzzMulti++;
  const c = Math.max(0, u - p),
    s = Math.max(0, r - p);
  for (let k = 0; k < pg.length; k++) {
    const a = pg[k],
      b = k + 1 < pg.length ? pg[k + 1] : len;
    const h = rows.slice(a, b).reduce((x, v) => x + v, 0);
    if (h > (b === len ? s : c) + 1e-9) fuzzOverflowPages++;
  }
}

console.log(`   随机模糊：${FUZZ} 组（行数 0–14、行高含 0/小数/超高、预算 0–300、penalty 0/1），失败 ${fuzzFail}`);
if (fuzzSamples.length) {
  for (const s of fuzzSamples) {
    console.log(`       反例 rows=${fmtRows(s.rows)} u=${s.u} r=${s.r} p=${s.p} → pages=${fmtRows(s.pg)}`);
    s.errs.forEach((e) => console.log(`           ${e}`));
  }
}
console.log(`   模糊中「至少前进一行」触发 = ${fuzzAdvanceFired} / ${fuzzPages} 次翻页决策  ← 死代码的实证`);
console.log(`   模糊中「给最后一页留一行」触发 = ${fuzzLastRowFired} 次`);
console.log(`   多于一页的比例 = ${round2((fuzzMulti / FUZZ) * 100)}%`);
console.log(`   溢出的页面数 = ${fuzzOverflowPages}（都应是「单行本身就超过该页预算」的不可解情形）`);

const totalFailed = failed + invFailed + fuzzFail;
console.log('\n' + '='.repeat(100));
console.log(totalFailed === 0 ? '✅ 全部用例、不变式、随机模糊通过' : `❌ 失败：用例 ${failed} / 不变式 ${invFailed} / 模糊 ${fuzzFail}`);
console.log('='.repeat(100));
process.exitCode = totalFailed === 0 ? 0 : 1;
} // end if (EXECUTED_DIRECTLY)
