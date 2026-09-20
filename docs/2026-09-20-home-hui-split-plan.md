# Home.vue / Hui.vue 拆分 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `app/src/views/Home.vue`（3650 行）与 `app/src/views/Hui.vue`（2605 行）的 `script setup` 切成 composables / utils，**逻辑逐字搬、一行行为不改**，为 `ui-upgrade` 的重设计铺路。

**Architecture:** 每块按「搬迁保真守卫（源码逐字比）→ 搬 → 33/34 个差分台 + `npm run build` → 逐字一致 → 提交」的节拍推进，一块一笔。守卫是数据驱动的 manifest：每块声明「哪些名字、搬去哪个文件、允许哪些文本改写」，改写在旧文里找不到就抛错。先立守卫、再做两个样板（纯函数 / composable），其余块照样板推。

**Tech Stack:** Vue 3 `<script setup>` + TypeScript · Naive UI · Vite · Node ESM 脚本（零依赖，只用 `node:child_process` / `node:fs`）· Rust axum + PostgreSQL（仅验收时拉起，本计划不改 Rust）

**Spec:** `docs/2026-09-20-home-hui-split.md`（提交 `a3ab5860`）—— 本计划是它的实施展开；**行号段界、依赖拓扑、「必须跟走的雷」全在那份文档里，执行时必须对照读**。

## 关于本计划的写法（先读这段，免得把「按设计留白」当成漏写）

Task 0–4 与 Task 15 是**逐步写全**的：每一步的命令、代码、期望输出都在计划里。

**Task 5–14 与 16–28（那 23 个搬块）是「骨架 + 参数表」**，每块的 `rewrites`（闭包名 → 注入名的逐条替换）与最终注入项数**由该块自己的 Step 1–2 实读产出**，不预先写死在计划里。这不是偷懒，是两条硬约束逼出来的：

1. **行号每搬一块就漂移** —— 提前写死后面块的行号，等于写一份**按构造就会错**的对照表。所以定位一律**按名字 grep**（骨架 Step 1）。
2. **spec §8.2-2/3 明确记着那些块的注入面「未逐块实做验证」**，而且 Hui 那半边的初版清单已经**实测证明漏了 409 行**。照着未验证的清单写死替换规则，就是在猜 —— 而本仓库的第一条规矩是**不要靠猜**。实读出来的东西才有资格进守卫。

**CSS 产物差分台**（spec §5.4：构建两次、剥掉 `data-v-*`、比规则多重集）**本计划不需要建** —— 因为这次基本不动模板与 CSS（spec §6.6）。**例外**：若哪一块不得不连模板一起搬，**先补那台机器再动**。

## Global Constraints

以下每条都是**每一笔提交都要满足**的硬约束，不再在每个 Task 里重复：

1. **零行为变化。** 只搬代码，不改行为。搬迁中发现的任何问题（含那批不生效的死 CSS）**只记账，不在搬迁笔里修** —— 修它就是从「死」变「活」，是行为变化。记在 `docs/2026-09-20-home-hui-split.md` §8。
2. **参照提交是 `28e36d21`。** 本文所有行号是该提交的快照。**每块动手前必须按当时的工作区重新核一遍段界** —— 前面任何一块搬完，后面所有行号都会往下移。
3. **验收 = `npm run verify` 全绿**（含 `cargo fmt --check` / `npm run build` / `cargo clippy` / `cargo test` / 差分台全套）。**不是**「build 绿了」「我跑了我记得的那几个台子」。
4. **改了行为就要在同一笔改文档**（本仓库硬规矩）。搬迁本身不改行为，但**台子数、行号引用、`docs/verification.md` 的记录**会失效 —— 见各 Task 的说明。
5. **终止进程只用具体 PID**，绝不用 `pkill -f`。**破坏性操作先问。**
6. **`npm run build` 是 CSS/模板完整性的权威** —— `vue-tsc` 抓不到缺失的 `.vue` 导入（`declare module '*.vue'` 通配），也抓不到某些 CSS 语法错。两者都绿才算绿。
7. **提交前跑** `node .gitnexus/run.cjs detect-changes --scope all --repo .`。`partial: true` / `truncated: true` **不算干净**，要重跑。
8. **不许为了让测试变绿而改夹具。** 只能改「夹具本身与旧版口径不符」的桩，且必须在脚本注释里写明理由。
9. **两个守卫的 `REF` 各钉各的**：现有 `hui-extract-movecheck.mjs` **保持 `d6057283` 不动**（改了会 12 处全红，实测见 spec §8.2-4）；本次新建的 Home 守卫用 `28e36d21`。

---

## 文件结构

**新建**

| 路径 | 职责 |
|---|---|
| `docs/home-audit/home-extract-movecheck.mjs` | Home 拆分守卫 —— 逐字比 + manifest + 反向检查 + `--selftest` |
| `app/src/utils/homeMetrics.ts` | 纯函数：金额/付款状态/进度匹配/日期告警（Task 2） |
| `app/src/utils/homeDate.ts` | `pad` / `localToday` / `legacyToday`（**两套时区口径并存，不合并**）（Task 4） |
| `app/src/utils/homeConstants.ts` | `PROGRESS_OPTIONS` / `EMPTY_FILTER_VALUE` / `AUTOCOMPLETE_ALWAYS_SHOW` / `progressSegments`（Task 4） |
| `app/src/composables/home/useHomeData.ts` | B1 |
| `app/src/composables/home/useHomeSelection.ts` | B10（Task 3） |
| `app/src/composables/home/useHomeFilterView.ts` | B3 |
| `app/src/composables/home/useHomeOrderNo.ts` | B4 |
| `app/src/composables/home/useHomeQueryMore.ts` | B5 |
| `app/src/composables/home/useHomeExpand.ts` | B6 |
| `app/src/composables/home/useHomeRowStatus.ts` | B7 |
| `app/src/composables/home/useHomeRowEditing.ts` | B8 |
| `app/src/composables/home/useHomePrint.ts` | B9 |
| `app/src/composables/home/useHomeManualProgress.ts` | B11 |
| `app/src/composables/home/useHomeCellRender.ts` | B12 |
| `app/src/composables/hui/*.ts` | Hui C1–C13（Task 16–28） |
| `app/src/utils/huiLineChecks.ts` | Hui C11 |

**改动**

| 路径 | 改什么 |
|---|---|
| `docs/home-audit/run-all.mjs` | 收集正则加 `-movecheck`（Task 0） |
| `.github/workflows/ci.yml` | checkout 加 `fetch-depth: 0`（Task 0） |
| `scripts/verify.mjs` · `README.md` · `docs/verification.md` · `docs/home-audit/00-summary.md` · `docs/legacy-finance/08-fix-plan.md` · `docs/2026-09-20-home-hui-split.md` | 台子数 33 → 34（Task 0） |
| `app/src/views/Home.vue` / `Hui.vue` | 每块删掉已搬走的定义、改成 import |

**不动**（spec §3.2 / §3.4 逐条给了理由）：`columns`(Home 2968–3305) · `renderExpandDetail` · `homeDialogs`/`homeCalcEngine`/`homeDetailHooks`（三件当一件） · Home 的 `<style>` 3626–3647 · Hui 的 `onMoreSelect`/`moreMenuOptions` · Hui 的 `onMounted` · Hui 的 `saveOrder`/`fillLineNumbers` · Hui 的脊梁 850–882 · Hui 的「订单列表」弹窗 1788–1897（`loadOrder` 深写脊梁）。

---

# 阶段一 · 守卫（必须先做，后面每块都靠它）

### Task 0: 把现有 movecheck 接进统一入口 + 修 CI 浅克隆

**Files:**
- Modify: `docs/home-audit/run-all.mjs:68`（收集正则）
- Modify: `.github/workflows/ci.yml:37`（checkout 步）
- Modify: 台子数写了 33 的 6 个文件（见下）

**Interfaces:**
- Consumes: 无
- Produces: `npm run verify` 的差分台从 33 → **34**；后续所有 Task 的验收基线

- [ ] **Step 1: 放开收集正则**

`docs/home-audit/run-all.mjs:68` 现在是：

```js
const collect = (dir, re = /(-logiccheck|-check|-e2e)\.mjs$/) =>
```

改成（新增 `-movecheck` 一个分支）：

```js
const collect = (dir, re = /(-logiccheck|-movecheck|-check|-e2e)\.mjs$/) =>
```

同时把该行上方的注释（62–67 行那段讲「两套命名各有各的正则」的）补一句：

```
 *   · 搬迁保真守卫：`*-movecheck.mjs`（2026-09-20 接入）—— 它们只读 git + 文件，不依赖后端，
 *     因此**在任何环境都该跑**；但**要 `git show <旧提交>`**，浅克隆下会失败（见 ci.yml 的 fetch-depth）。
```

- [ ] **Step 2: 修 CI 的浅克隆**

`.github/workflows/ci.yml:37` 现在是 `- uses: actions/checkout@v4`，改成：

```yaml
      # ⚠️ 必须取全历史：`docs/home-audit/*-movecheck.mjs` 要 `git show <旧提交>:<路径>`
      # 拿搬迁前的原文来逐字比。默认的 fetch-depth:1 只取 1 个提交 ⇒ 那些 `git show` 会失败。
      # 代价实测：本仓库 size-pack 651 MiB / 283 提交，比后面的 Rust 构建小一个量级。
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
```

- [ ] **Step 3: 本地验收集生效**

Run: `node docs/home-audit/run-all.mjs --quiet`
Expected: 汇总行变成 `共 34 个台子：✅ 通过 ≥32 …`，且列表里能看到 `docs/home-audit/hui-extract-movecheck.mjs`。
（此时后端没起，需要后端的台子会 ❌ —— 那是环境性的，不是本步失败；本步只看**数目**和**movecheck 在不在列**。）

- [ ] **Step 4: 改所有写了 33 的地方（硬规矩，同一笔）**

实测这 6 个文件写了 33，逐个改成 34（`docs/verification.md:68` 那条是**一次运行记录的转录**，不改数字，改成在它上方标注「此为 2026-09-20 接入 movecheck 前的转录」）：

```bash
grep -rn "33 个\|33 台\|共 33\|33 个台子" docs/ scripts/ README.md | grep -v "^docs/2026-09-20"
```

预期命中 11 处，分布：
- `docs/verification.md` — 24、32、68、73、166、174
- `docs/legacy-finance/08-fix-plan.md:200`
- `docs/home-audit/00-summary.md:323`
- `docs/home-audit/run-all.mjs:37`
- `README.md:88`
- `scripts/verify.mjs` — 17、102、227、228
- `docs/2026-09-20-home-hui-split.md` — 本方案自己写的 33 也一并改（搜 `33`）

- [ ] **Step 5: 跑全套验收**

Run: `npm run verify`
Expected: 结尾 `✅ 全绿`，且第 5 步 banner 显示「差分台（34 个）」，汇总 `共 34 个台子：✅ 通过 34 · … · ❌ 失败 0`。

- [ ] **Step 6: 图变更分析 + 提交**

```bash
node .gitnexus/run.cjs detect-changes --scope all --repo .
git add docs/home-audit/run-all.mjs .github/workflows/ci.yml docs/verification.md \
        docs/legacy-finance/08-fix-plan.md docs/home-audit/00-summary.md README.md \
        scripts/verify.mjs docs/2026-09-20-home-hui-split.md
git commit -m "chore(verify): 把 movecheck 接进统一入口（33→34）+ CI checkout 取全历史"
```

---

### Task 1: 立 Home 搬迁保真守卫（含 `--selftest`）

**Files:**
- Create: `docs/home-audit/home-extract-movecheck.mjs`

**Interfaces:**
- Consumes: Task 0 的收集正则（文件名必须以 `-movecheck.mjs` 结尾才会被跑）
- Produces: 一个可执行的守卫。后续**每个** Task 都要 `node docs/home-audit/home-extract-movecheck.mjs` 并期望退出 0。它导出的 manifest 结构（后续 Task 往里加条目）：

```js
/** @type {{ target: string, names: string[], consts: string[], rewrites: Record<string, {from: string, to: string}[]> }[]} */
const BLOCKS = [ /* 每块一条 */ ]
```

- [ ] **Step 1: 写脚本（完整代码）**

照 `docs/home-audit/hui-extract-movecheck.mjs` 的做法（`sliceFn` / `norm` / `applyRewrites` 那三个函数**逐字照抄**，不要重写 —— 它们是被两版调试磨出来的，尤其 `sliceFn` 的「后面紧跟换行的 `{`」判据），但把「单一目标文件」改成 **BLOCKS manifest 驱动多目标**，并加 `--selftest`。

关键差异（其余照抄）：

```js
const REF = process.argv[2] || (process.argv.includes('--selftest') ? 'HEAD' : '28e36d21')
const OLD_PATH = 'app/src/views/Home.vue'

/**
 * 本次拆分的搬迁清单。**每搬完一块就在这里加一条** —— 守卫只验清单里的东西，
 * 清单外的东西它不知道（这是它的能力边界，写在这里免得被当成「全都验过了」）。
 */
const BLOCKS = []

/** 反查：这些名字搬走后，Home.vue 里不该再有自己的定义（否则两份实现各自漂移）。 */
const allNames = () => BLOCKS.flatMap((b) => [...b.names, ...b.consts])
```

比对循环：外层遍历 `BLOCKS`，每个 block 读它自己的 `target` 文件，内层遍历 `names`/`consts` —— 逻辑同 Hui 那个的 `pass`/`fail` 段（含「先 `norm()` 再 `applyRewrites()`」的顺序，和逐行 diff 打印）。

`--selftest` 模式（**这次要专门做，因为先例记着「守卫自身的洞」**：它的扇数正则被改窄成单位数，测试仍不报错）：

```js
/**
 * 自测：拿一对**已知故意改坏**的样本跑一遍比对核心，断言它报红且**定位到正确的行**。
 * 先例的教训（docs/2026-09-18-detail-table-extraction.md §5.3）：守卫自身的洞不会被它自己发现
 * —— 那次的扇数正则从 `(\d+)` 被改窄成 `(\d)`，夹具全是单位数，于是测试不报错。
 * 所以这里不测「真代码」，测「比对函数在已知输入上是否会红」。
 */
if (process.argv.includes('--selftest')) {
  const oldTxt = `function f(a: number) {\n  const n = Math.round(a * 1.13)\n  return n ?? 0\n}`
  const cases = [
    ['Math.round → Math.floor', `function f(a: number) {\n  const n = Math.floor(a * 1.13)\n  return n ?? 0\n}`, 2],
    ['丢掉 ?? 0',              `function f(a: number) {\n  const n = Math.round(a * 1.13)\n  return n\n}`, 3],
    ['未改坏（应判为一致）',    oldTxt, 0],
  ]
  let bad = 0
  for (const [what, newTxt, expectDiffLine] of cases) {
    const diff = firstDiffLine(norm(oldTxt), norm(newTxt)) // 返回首个不同的行号（1 基），一致则 0
    if (diff !== expectDiffLine) {
      console.log(`✗ 自测失败：${what} —— 期望首个差异在第 ${expectDiffLine} 行，实得 ${diff}`)
      bad++
    } else {
      console.log(`✓ 自测：${what} → 第 ${diff} 行`)
    }
  }
  process.exit(bad ? 1 : 0)
}
```

- [ ] **Step 2: 跑自测，确认它真的会红**

Run: `node docs/home-audit/home-extract-movecheck.mjs --selftest`
Expected: 三行 ✓，退出 0。

- [ ] **Step 3: 变异测试 —— 故意把自测的判据改坏**

临时把 `firstDiffLine` 里比较用的 `!==` 改成 `===`（即翻转判定），再跑 Step 2。
Expected: 输出 `✗ 自测失败`，退出 1。**这一步必须真的报红** —— 不红说明自测没有检验力，等于没做。
然后**还原**该改动，重跑 Step 2 确认回到 3 个 ✓。

- [ ] **Step 4: 确认它在参照不可得时 fail-loud**

Run: `git stash list >/dev/null; node docs/home-audit/home-extract-movecheck.mjs 0000000`
Expected: 非 0 退出，且打印能看懂的原因（`execSync` 抛的 `fatal: invalid object name` 可以接受，但更好是捕获它、打印「参照提交 <ref> 取不到 —— 浅克隆？见 ci.yml 的 fetch-depth」再退 1）。
⚠️ **不许**让它在这种情况下退 0 —— 「未运行 ≠ 通过」是本仓库写在 `run-all.mjs` 文件头里的规矩。

- [ ] **Step 5: 确认它被统一入口收集**

Run: `node docs/home-audit/run-all.mjs --quiet`
Expected: 汇总仍是 34 个（新脚本已在 Task 0 的正则范围内），且 `home-extract-movecheck.mjs` 在列、✅。

- [ ] **Step 6: 提交**

```bash
git add docs/home-audit/home-extract-movecheck.mjs
git commit -m "test(split): 立 Home 搬迁保真守卫（manifest 驱动 + --selftest 防守卫自身的洞）"
```

---

# 阶段二 · 两个样板

本阶段的两个 Task 是**模式样板**：Task 2 示范「纯函数搬去 `utils/`」（无 Vue 依赖），Task 3 示范「搬到 `composables/`」（要注入响应式依赖 + 回传状态）。后面 20 多块都是这两类的变体。

### Task 2: B2 → `utils/homeMetrics.ts`（纯函数样板）

**Files:**
- Create: `app/src/utils/homeMetrics.ts`
- Modify: `app/src/views/Home.vue`（删 578–604 / 761–764 / 1001–1016，改成 import）
- Modify: `docs/home-audit/home-extract-movecheck.mjs`（加第一条 block）

**Interfaces:**
- Consumes: `OrderSummaryDto`（`app/src/api/types.ts`）、`OrderFinance`（同上）
- Produces: 7 个导出，签名如下（**后两块会 import 它们**）：

```ts
export const fmt = (v: number): string => (v ?? 0).toFixed(2)
export const unpaidOf = (r: OrderSummaryDto, fin: Record<string, OrderFinance>): number
export function paymentStatus(r: OrderSummaryDto, fin: Record<string, OrderFinance>): string
export function progressMatch(r: OrderSummaryDto, opt: string): boolean
export function paidOf(r: OrderSummaryDto, fin: Record<string, OrderFinance>): number
export function dateCellClass(r: OrderSummaryDto, fin: Record<string, OrderFinance>): string
export function isUnaudited(r: OrderSummaryDto): boolean
```

- [ ] **Step 1: 建 `app/src/utils/homeMetrics.ts`**

文件头写清来路，正文是**三段的原样拼接**（顺序按 `28e36d21` 的行号：578–604 → 761–764 → 1001–1016），**逐字不改**，只做两件事：

1. 每个声明前加 `export`；
2. 读 `financeSummary.value` 的三处改成形参 `fin` —— 即 `unpaidOf` / `paidOf` 里：
   ```ts
   const s = financeSummary.value[r.id]
   ```
   改成
   ```ts
   const s = fin[r.id]
   ```
   并把 `paymentStatus` / `dateCellClass` 内部对 `unpaidOf(r)` 的调用改成 `unpaidOf(r, fin)`，同时给它们自己加上 `fin` 形参。

```ts
/**
 * Home 订单管理页的**纯口径函数**（2026-09-20 从 Home.vue §财务/进度口径 搬出，逻辑逐字未改）。
 *
 * ⚠️ 与 `legacyToday` / `localToday`（`utils/homeDate.ts`）**不是一回事，别合并** —— 那里是两套时区口径。
 *
 * `fin` 就是页面上的 `financeSummary`（`ref<Record<string, OrderFinance>>`）。
 * 之前它们是闭包捕获 `financeSummary.value`，搬出来后改成形参注入 —— 除此之外一字未动。
 */
import type { OrderFinance, OrderSummaryDto } from '../api/types'

const fmt = (v: number) => (v ?? 0).toFixed(2)
// …以下逐字照搬 Home.vue 578–604 / 761–764 / 1001–1016
```

- [ ] **Step 2: 在守卫里登记这一块**

`docs/home-audit/home-extract-movecheck.mjs` 的 `BLOCKS` 加第一条：

```js
const BLOCKS = [
  {
    target: 'app/src/utils/homeMetrics.ts',
    names: ['paymentStatus', 'progressMatch', 'paidOf', 'dateCellClass', 'isUnaudited'],
    consts: ['fmt', 'unpaidOf'],
    rewrites: {
      // ① 读 financeSummary.value 的三处 → 形参 fin（unpaidOf / paidOf 各一处）
      unpaidOf: [{ from: 'const s = financeSummary.value[r.id]', to: 'const s = fin[r.id]' }],
      paidOf:   [{ from: 'const s = financeSummary.value[r.id]', to: 'const s = fin[r.id]' }],
      // ② 两个下游函数的签名加形参 + 内部调用点跟着改（同一名字的多条规则写在同一个数组里）
      paymentStatus: [
        { from: 'function paymentStatus(r: OrderSummaryDto): string {',
          to:   'function paymentStatus(r: OrderSummaryDto, fin: Record<string, OrderFinance>): string {' },
        { from: 'const unpaid = unpaidOf(r)', to: 'const unpaid = unpaidOf(r, fin)' },
      ],
      dateCellClass: [
        { from: 'function dateCellClass(r: OrderSummaryDto): string {',
          to:   'function dateCellClass(r: OrderSummaryDto, fin: Record<string, OrderFinance>): string {' },
        { from: 'if (!due || unpaidOf(r) === 0) return', to: 'if (!due || unpaidOf(r, fin) === 0) return' },
      ],
    },
  },
]
```

⚠️ **同一个名字的规则必须写在同一个数组里**（`applyRewrites` 是按名字取数组、逐条 `split/join`）。每条 `from` 在旧文里找不到就抛错，所以漏一条会立刻报出来，**不会静默放过**。

- [ ] **Step 3: 先跑守卫，确认它对 B2 报「找不到」**

此时 Home.vue 还没动、`utils/homeMetrics.ts` 已存在，两边都有定义 ⇒ 守卫此时**应当**通过逐字比（新文件里找得到、旧文件里也找得到），但**反向检查会报「Home.vue 里仍有同名定义」**。

Run: `node docs/home-audit/home-extract-movecheck.mjs`
Expected: 逐字比通过；反向检查列出 `fmt, unpaidOf, paymentStatus, …` 提示「应已删除」。

- [ ] **Step 4: 从 `Home.vue` 删掉这三段、改成 import**

删 578–604、761–764、1001–1016 三段。在 import 区加：

```ts
import { dateCellClass, fmt, isUnaudited, paidOf, paymentStatus, progressMatch, unpaidOf } from '../utils/homeMetrics'
```

**调用点要改**：Home.vue 里所有 `unpaidOf(r)` / `paidOf(r)` / `paymentStatus(r)` / `dateCellClass(r)` 变成传 `financeSummary.value`。用 `grep -n "unpaidOf(\|paidOf(\|paymentStatus(\|dateCellClass(" app/src/views/Home.vue` 找全 —— **别只改我列的这几处**。

⚠️ 模板里也有调用（`columns` 的 render 回调里），模板不能用 `financeSummary.value` 之外的东西伪装 —— 它是 `ref`，模板里写 `financeSummary` 会自动解包，所以模板侧传 `financeSummary` 即可，脚本侧传 `financeSummary.value`。**逐个看，别一律替换**。

- [ ] **Step 5: 跑守卫，确认逐字一致 + 反向检查干净**

Run: `node docs/home-audit/home-extract-movecheck.mjs`
Expected: `逐字一致：7 个`，无「未搬走」，无「Home.vue 里仍有同名定义」，退出 0（`BLOCKS` 里目标文件已存在、旧文件已删）。

- [ ] **Step 6: 变异测试 —— 证明这条守卫对 B2 真的有效**

临时把 `app/src/utils/homeMetrics.ts` 里 `paidOf` 的 `s ? s.allocated_amount : r.deposit || 0` 改成 `r.deposit`（丢掉财务摘要分支）。
Run: `node docs/home-audit/home-extract-movecheck.mjs`
Expected: **报红**，且打印出 `paidOf: 归一化后仍不一致`+ 逐行 diff，退出 1。
**然后还原**，重跑 Step 5 确认回绿。

- [ ] **Step 7: 跑全套验收**

Run: `npm run verify`
Expected: `✅ 全绿`，`共 34 个台子：✅ 通过 34 · … · ❌ 失败 0`。
特别关注这几个（它们直接打这些函数）：`rowstate-logiccheck`（105 条）、`headerfilter-logiccheck`（13 条）、`editable-cell-logiccheck`（15 条）、`total-balance-logiccheck`。

- [ ] **Step 8: 图变更分析 + 提交**

```bash
node .gitnexus/run.cjs detect-changes --scope all --repo .
git add app/src/utils/homeMetrics.ts app/src/views/Home.vue docs/home-audit/home-extract-movecheck.mjs
git commit -m "refactor(home): B2 财务/进度口径纯函数搬到 utils/homeMetrics.ts（逐字搬迁，零行为变化）"
```

- [ ] **Step 9: 记下实测到的块体积，回头修方案**

本块搬走多少行？实测后如果与 spec §3.1 写的（578–604 + 761–764 + 1001–1016）有出入，**同一笔或紧接着一笔**改掉 `docs/2026-09-20-home-hui-split.md` §3.1 那一行，并在 §8.2 记下「B2 实测 vs 方案」的差。先例就是「§3.3 立项不完整、实际范围比写的大」栽过的。

---

### Task 3: B10 → `composables/home/useHomeSelection.ts`（composable 样板，第一条真切）

**Files:**
- Create: `app/src/composables/home/useHomeSelection.ts`
- Modify: `app/src/views/Home.vue`（删 1550–1886 + 1167–1189）
- Modify: `docs/home-audit/home-extract-movecheck.mjs`

**Interfaces:**
- Consumes（全部以**参数注入**，注入 `ref` / 函数本身，不注入值）：
  `filtered: ComputedRef<OrderSummaryDto[]>` · `loadedIds: Ref<Set<number>>`（按实际类型） · `rawOrders: Ref<OrderSummaryDto[]>` · `load: () => Promise<void>` · `message` · `dialog` · `api`
- Produces（**返回引用本身**，不是副本）：

```ts
export function useHomeSelection(deps: {...}) {
  return { checkedRowKeys, selectAllMode, onCheckedKeys, deleteSelected, clearAccounts, combineSelected }
}
```

- [ ] **Step 1: 读块、记下真实注入面**

Run: `sed -n '1550,1886p;1167,1189p' app/src/views/Home.vue`
把这块**读到的**外部标识符列出来（spec §1.3 给的是起点，不是终点）—— 尤其确认 `deleteSelected` / `clearAccounts` 各自读了哪些状态、写了哪些。
**产出**：一张「标识符 → 它该被注入还是该被回传」的表，写进下一步的注释里。

⚠️ 这一步是**必须真读**的：spec §8.2-2 明说 Home 的 12 块「未逐块实做验证」。别照抄 spec 的注入清单当结论。

- [ ] **Step 2: 建 `useHomeSelection.ts`，正文逐字搬**

结构：

```ts
/**
 * 「删除选中 / 清账 / 合并」——2026-09-20 从 Home.vue 搬出（逻辑逐字未改）。
 *
 * ⚠️ `checkedRowKeys` 是本块**拥有并借出**的状态：模板有 5 处直接读写它。
 *    所以这里 `return` 的是**那个 ref 本身**，不是 `.value` 的副本 —— 返回副本会让模板的勾选静默失效。
 */
import { ref, type ComputedRef, type Ref } from 'vue'
import type { DataTableRowKey } from 'naive-ui'
// …

export function useHomeSelection(deps: {
  filtered: ComputedRef<OrderSummaryDto[]>
  rawOrders: Ref<OrderSummaryDto[]>
  load: () => Promise<void>
  message: MessageApi
  dialog: DialogApi
}) {
  // …以下逐字照搬 1550–1886 + 1167–1189，闭包引用的外部名改成 deps.xxx
  return { checkedRowKeys, selectAllMode, onCheckedKeys, deleteSelected, clearAccounts, combineSelected }
}
```

**别动的三处**（spec §6.3）：
- `onCheckedKeys` 的**第三参 `meta.action`**（区分表头全选），不能简化成「写 keys」；
- `clearOrderNoQuery` 那个 50ms `setTimeout` —— 注意它属 B4 不属本块，别顺手带过来；
- `loadedIds` 的语义（跨页全选）—— 注入前先看清它到底是什么类型。

- [ ] **Step 3: 守卫登记 + 反向检查**

`BLOCKS` 加：

```js
  {
    target: 'app/src/composables/home/useHomeSelection.ts',
    names: ['onCheckedKeys', 'deleteSelected', 'clearAccounts', 'combineSelected'],
    consts: ['checkedRowKeys', 'selectAllMode'],
    rewrites: {
      // ⚠️ 这组规则由上面 Step 1–2 的**实读结果**产出，形式是「闭包名 → deps.名」逐条列全：
      //    onCheckedKeys: [{ from: 'filtered.value', to: 'deps.filtered.value' }, …],
      //    deleteSelected: [{ from: 'loadedIds', to: 'deps.loadedIds' }, …],
      //    规则必须穷举：applyRewrites 的每条 from 在旧文里找不到会抛错，
      //    但**漏列的替换不会报错** —— 它只表现为「归一化后仍不一致」的 diff，所以 Step 6 要逐行看 diff。
    },
  },
```

Run: `node docs/home-audit/home-extract-movecheck.mjs`
Expected: 反向检查报「Home.vue 里仍有同名定义」——**这是预期的**，下一步才删。

- [ ] **Step 4: 从 `Home.vue` 删段、改成调用 composable**

删 1550–1886 与 1167–1189。加：

```ts
import { useHomeSelection } from '../composables/home/useHomeSelection'
// …
const { checkedRowKeys, selectAllMode, onCheckedKeys, deleteSelected, clearAccounts, combineSelected } =
  useHomeSelection({ filtered, rawOrders, load, message, dialog })
```

⚠️ **构造顺序**：`useHomeSelection` 必须晚于 `filtered` / `rawOrders` / `load` 的定义（它们都是 setup 顶层即时求值）。放错位置 = `undefined`，且**不一定报错**。

- [ ] **Step 5: 模板一行都不用改（这是本方案最大的红利）**

`checkedRowKeys` 等名字仍在同一作用域 ⇒ 模板 5 处引用**原样有效**。
Run: `grep -n "checkedRowKeys\|selectAllMode" app/src/views/Home.vue | head -20` 确认它们只出现在**模板**与上面那行解构里，没有别处再定义。

- [ ] **Step 6: 守卫回绿**

Run: `node docs/home-audit/home-extract-movecheck.mjs`
Expected: 逐字一致、反向检查干净、退出 0。

- [ ] **Step 7: 变异测试**

临时把 `useHomeSelection.ts` 里 `deleteSelected` 的 `await Promise.all(...)` 改成 `await Promise.all(sel.slice(0, 1).map(...))`（只删第一条）。
Run: `node docs/home-audit/home-extract-movecheck.mjs` → 期望**报红**。
**还原**，重跑确认回绿。

- [ ] **Step 8: 跑全套验收**

Run: `npm run verify`
Expected: `✅ 全绿`，34 个台子全过。特别关注 `finance-reversal-e2e`（删除/清账链路）、`progress-select-logiccheck`、`rowstate-logiccheck`。

- [ ] **Step 9: 图变更分析 + 提交**

```bash
node .gitnexus/run.cjs detect-changes --scope all --repo .
git add app/src/composables/home/useHomeSelection.ts app/src/views/Home.vue docs/home-audit/home-extract-movecheck.mjs
git commit -m "refactor(home): B10 删除选中/清账/合并搬到 useHomeSelection（逐字搬迁，零行为变化）"
```

- [ ] **Step 10: 用实测结果回头修方案（**这一步不许跳**）**

B10 是第一条真切，spec §8.2-2 明说「第一刀做完后要用实测结果回头修这份方案」。逐条核并对齐：
- 实测搬走了多少行？spec 说 1550–1886 + 1167–1189 对不对？
- 注入面实测几项？spec 说 8 项，对不上就改。
- **有没有发现 spec 漏认领的代码**（Hui 那半边就是这么漏掉 409 行的）？
- 结论写回 `docs/2026-09-20-home-hui-split.md` §3.1 / §8.2，**同一笔或紧接着一笔提交**。

---

# 阶段三 · 归位 + 其余 Home 块

### Task 4: 把「放错位置」的纯件归位（单独一笔，不混进任何块）

**为什么单独一笔**：搬迁笔里既有「搬家」又有「切缝」就分不清是谁弄坏的（spec §4 纪律 1）。归位不是搬迁，是先把东西放到它该在的地方，后面几块才切得干净。

**Files:**
- Create: `app/src/utils/homeDate.ts` · `app/src/utils/homeConstants.ts`
- Modify: `app/src/views/Home.vue`

**Interfaces:**
- Produces: `pad(n)` · `localToday()` · `legacyToday()`（`homeDate.ts`）；`PROGRESS_OPTIONS` · `EMPTY_FILTER_VALUE` · `AUTOCOMPLETE_ALWAYS_SHOW` · `progressSegments(status)`（`homeConstants.ts`）

- [ ] **Step 1: 建 `utils/homeDate.ts`**

搬 `pad`(1108)、`localToday`(1116)、`legacyToday`(2401)。

⚠️ **`localToday` 与 `legacyToday` 是两套口径，绝不合并**（spec §6.3-9）：
- `localToday()` —— 本地时区，返回 `YYYY-MM-DD` 字符串；
- `legacyToday()` —— 经 `toISOString()`（**UTC**），返回**时间戳**。

文件头必须写明这一点，并把 Home.vue 里那句原有注释（「别与 `legacyToday()` 混」）一起搬过来。

- [ ] **Step 2: 建 `utils/homeConstants.ts`**

搬 `PROGRESS_OPTIONS`(495)、`EMPTY_FILTER_VALUE`(735)、`AUTOCOMPLETE_ALWAYS_SHOW`(536)、`progressSegments`(2592)。
`AUTOCOMPLETE_ALWAYS_SHOW` 的**解释性注释（520–535）必须整段跟走** —— 那注释说明了为什么不能省这个恒真函数。

- [ ] **Step 3: 守卫登记**

```js
  { target: 'app/src/utils/homeDate.ts', names: ['localToday', 'legacyToday'], consts: ['pad'], rewrites: {} },
  { target: 'app/src/utils/homeConstants.ts', names: ['progressSegments'],
    consts: ['PROGRESS_OPTIONS', 'EMPTY_FILTER_VALUE', 'AUTOCOMPLETE_ALWAYS_SHOW'], rewrites: {} },
```

⚠️ 归类判据是**声明形式不是语义**：`names` = `function` 声明，`consts` = `const X = ...`。按 `28e36d21` 实测：
- `function localToday()`(1116) · `function legacyToday()`(2401) · `function progressSegments()`(2592) ⇒ **`names`**
- `const pad = (n) => ...`(1108) · `const PROGRESS_OPTIONS = [...]`(495) · `const EMPTY_FILTER_VALUE = '__EMPTY__'`(735) · `const AUTOCOMPLETE_ALWAYS_SHOW = () => true`(536) ⇒ **`consts`**

（Hui 那份脚本的 `MOVED` / `MOVED_CONSTS` 分法同此。`sliceFn` 对两类用的是同一个正则，所以分错了也不会报错 —— 但会让清单读起来骗人，所以按实测归类。）

- [ ] **Step 4: 别顺手删 §6.4 的「只读件」**

`homeDetailHooks.calcSingleRow`(1950) 是**默认实现**、靠 2169 逐单覆盖 —— 归位时若它落在你改的范围边上一格，**不要删**。同理 `AUTOCOMPLETE_ALWAYS_SHOW` 的 `() => true`。

- [ ] **Step 5: 守卫 + 全套**

Run: `node docs/home-audit/home-extract-movecheck.mjs && npm run verify`
Expected: 守卫退出 0；`npm run verify` `✅ 全绿`。
`homeDate` 的改动会被 `orderno-logiccheck`（119 条）、`rowstate-logiccheck`（105 条）覆盖到；`progressSegments` 被 `progress-*` 那一组覆盖。

- [ ] **Step 6: 提交**

```bash
git add app/src/utils/homeDate.ts app/src/utils/homeConstants.ts app/src/views/Home.vue docs/home-audit/home-extract-movecheck.mjs
git commit -m "refactor(home): 把放错位置的纯件归位到 utils/（pad/localToday/legacyToday/常量），单独一笔"
```

---

### Task 5–14: 其余 Home 块（一块一笔）

**这十块的任务写法统一如下**（每块执行前照抄这个骨架，填进该块自己的参数）。⚠️ **行号是 `28e36d21` 的快照，每块开工前必须重核** —— 前面每搬一块，后面的行号都会往下移。

**统一骨架（每块 7 步）**

- [ ] **Step 1: 定位 —— 按「名字」找，不按行号找。**
  Run: `grep -n "^function <该块首函数>\|^const <该块首常量>" app/src/views/Home.vue`
  用 grep 出来的真实行号替换下表里的快照行号。**行号对不上是正常的，不是出错** —— 前面搬走的行数就是偏移量。
- [ ] **Step 2: 读该块，记下真实注入面与输出面**（同 Task 3 Step 1）。spec 给的是起点，不是结论。
- [ ] **Step 3: 建新文件，正文逐字搬**，只做「加 `export`」与「闭包名 → 注入名」两类改动。
- [ ] **Step 4: 守卫 `BLOCKS` 加一条**，`rewrites` 把每一处改名逐条列出。
- [ ] **Step 5: 从 `Home.vue` 删段、改成调用**；**构造顺序**按 spec §1.3 的顺序约束放对位置。
- [ ] **Step 6: 守卫回绿 → 变异测试（故意改坏一处，确认报红，再还原）→ `npm run verify` 全绿。**
- [ ] **Step 7: 提交**（信息格式：`refactor(home): B<n> <中文块名>搬到 <文件>（逐字搬迁，零行为变化）`），并在 spec §3.1 把实测结果对齐。

**十块的参数表**（行号为 `28e36d21` 快照）

| Task | 块 | 目标文件 | 快照行段 | 已知的关键雷（照 spec §6 读全） |
|---|---|---|---|---|
| 5 | B1 | `composables/home/useHomeData.ts` | 538–576 + 1540–1548 | 干净的根块。`load()` 有 11 个调用点跨 9 个分区 —— **必须回传 `load`**，别让别处再定义 |
| 6 | B3 | `composables/home/useHomeFilterView.ts` | 606–613 + 689–714 + 716–883 + 885–956 | **四段必须一起搬**：`watch`(945) 监听 4 个筛选 ref、`watch`(954) 读 `querySearchPreset`。`onPageSizeChange` 里的 `nextTick` 顺序不能动，`pageSizeJustChanged`(920) 是**普通 `let`** |
| 7 | B4 | `composables/home/useHomeOrderNo.ts` | 617–664 + 2259–2338 | **不得吞 `filtered`**（那是 B3 的）。`clearOrderNoQuery`(2325) 的 50ms `setTimeout` 照抄旧版时间轴，**不要改成 `await`** |
| 8 | B5 | `composables/home/useHomeQueryMore.ts` | 1205–1382 | 写 `rawOrders`/`financeSummary` 的权利靠 ref 注入 |
| 9 | B9 | `composables/home/useHomePrint.ts` | 1411–1538 | 与 B6 的接口是**一个注入回调**（见 Task 10） |
| 10 | B6 | `composables/home/useHomeExpand.ts` | 1888–2014 + 2134–2257 | ⚠️ **前置改造**：先把 2238–2242 对 `printOrders`/`onOpenMode` 的直写改成注入的 `openPrintPreview(orders, autoLineNumbers)`，否则它会反向依赖 B9。`renderEditable`(2807) 的「先 `startEdit` 再写草稿」顺序（关键区 2822–2828）不能动 |
| 11 | B7 | `composables/home/useHomeRowStatus.ts` | 2016–2064 | **顺序依赖**：必须在 B6 之后构造。3 进 4 出 |
| 12 | B8 | `composables/home/useHomeRowEditing.ts` | 1018–1058 + 1060–1108 + 1116–1119 + 1191–1203 | ⚠️ 这段现在混了 5 件事，**先确认 Task 4 / 3 / 13 已把 `pad`/`localToday`/`combineSelected`/`confirmAudit` 拿走了**。`submitDate`(1191) 的日期口径别与 `legacyToday` 混 |
| 13 | B11 | `composables/home/useHomeManualProgress.ts` | 1136–1153 + 2340–2676 | `headWithStatus`(2489) 与 `confirmAudit`(1136) **必须一起进**。⚠️ `headWithStatus` 是**全头覆盖**（后端 `update_head` 绑全字段），**不能改成「只传要改的字段」**，否则 `order_date`/`install_address` 被抹空。`progressFilter` 的跨区写(2447) 改成注入回调。`manualActions`(2344–2362) 的 localStorage **只在组件建立时读一次，不许加 `watch` 或 `storage` 监听** |
| 14 | B12 | `composables/home/useHomeCellRender.ts` | 2678–2783 + 2807–2830 + 2866–2963 | 三个小件可放一个文件三个导出。`headerFilter`(2866) 是 0 注入的纯工厂。⚠️ 紧邻的 `paymentPopShow`(2965)/`progressPopShow`(2966) **留在页面**，别带走 |

### Task 15: Home 阶段收尾 —— 实测对账并写回方案

**为什么单独一笔**：spec §8.2-2 明说 Home 的 12 块「未逐块实做验证」，要靠实测回头修方案。攒到最后一次改不如在这里做一次正式的账。

**Files:**
- Modify: `docs/2026-09-20-home-hui-split.md`（§3.1 的实测列、§8.2 的不确定项）

- [ ] **Step 1: 量终局**

```bash
awk 'NR>=1 && /^<script setup/{s=NR} /^<\/script>/{e=NR} END{print "script 内容行数 =", e-s-1}' app/src/views/Home.vue
wc -l app/src/views/Home.vue
grep -n "^$" app/src/views/Home.vue | awk -F: 'NR>1 && $1==prev+1 {print "连续空行:", prev, $1} {prev=$1}'
```

- [ ] **Step 2: 与 spec 的预期对账**

spec §3.1 预期终局：script 约 **950–1100** 行（`columns` 335 行留驻）。把**实测**值写进 §3.1，并注明测量日期。

- [ ] **Step 3: 逐块核「spec 说的」vs「实际搬的」**

对每一块，核三件事并写回 §3.1：快照行段对不对 · 注入项数对不对 · **有没有 spec 漏认领的代码**（Hui 那半边就是这么漏掉 409 行的，同样的错 Home 也可能有）。

- [ ] **Step 4: 把结论写进 §8.2**，删掉已被实测解决的不确定项，留下真的还不确定的。

- [ ] **Step 5: 提交**

```bash
git add docs/2026-09-20-home-hui-split.md
git commit -m "docs(split): Home 阶段收尾 —— 用实测结果对账 §3.1/§8.2"
```

---

# 阶段四 · Hui 的 13 块

### Task 16–28: Hui 的 13 块（一块一笔）

⚠️ **本阶段开工前必须做的事**：spec §8.2-3 记着「Hui 的块划分初版是错的（漏了 1532–1940 那 409 行），用户拍板时依据的是那份错的；**Hui 半边须按 §3.3 修订版重新确认**」。**先拿修订版 §3.3 再跟用户确认一次，再开工。**

**统一骨架同 Task 5–14**（7 步），但 Hui 多两条本阶段特有的硬约束：

1. **脊梁不能动**（850–882：`lines`/`formulas`/`order`/`orderId`/`disableAutoMarkup` + `engine = useOrderLines(...)`）。所有块都从它读、不许搬它。
2. **三处引用同一性**（spec §6.1）—— 搬错不报错、类型也对，只是界面悄悄不对：
   - `pingColVis`/`diaoColVis`(1062/1063)：必须回传**同一个 `reactive` 对象**（原地 `delete`/`Object.assign` 是语义的一部分）；
   - `engine`(874)：**不许**再 `createPartsEngine` 一份；
   - `detailHooks`(1642)：普通对象、**一次性捕获 9 个闭包**，不许每块各构造一份。

| Task | 块 | 目标文件 | 快照行段 | 风险与雷 |
|---|---|---|---|---|
| 16 | C1 | `composables/hui/useHuiMarkupMgmt.ts` | 1108–1224 | 低（`markupCatalog` 家族本来就是模块单例） |
| 17 | C2 | `composables/hui/useHuiColumnConfig.ts` | 1005–1107 + 1258–1310 | 低，但 ⚠️ **必须返回同一 reactive 引用**（`colVis` 的原地改是语义） |
| 18 | C3 | `composables/hui/useHuiPayQrcode.ts` | 810–848 | 低。`payQrcodeOpen`(825) 被 `onMoreSelect` 的 `case 'payQrcode'` 写 ⇒ 必须回传该 ref |
| 19 | C4 | `composables/hui/useHuiShellToggles.ts` | 883–896 + 918–959 | 低 |
| 20 | C5 | `composables/hui/useHuiClients.ts` | 1370–1410 + 2091–2093 | 低，但 ⚠️ `lastAppliedClient`(1375) 是**裸 `let`** ⇒ **导出 getter + setter 一对函数**，不能导出值（导出值 = 一次快照） |
| 21 | C6 | `composables/hui/useHuiPreview.ts` | 1988–2037 | 低。`openTemplatePreview`(2019) 被 `onMoreSelect` 与 `calcSingleRow`(1658) 两处调 |
| 22 | C7 | `composables/hui/useTerminalLink.ts` | 2084–2129 | 低。`tenantName`/`currentUserName` 的 ref 必须回传（onMounted 2198–2200 要写） |
| 23 | C11 | `utils/huiLineChecks.ts` | 1537–1584 | 最低（`missingFieldsOf`/`rowHasContent` 都以 `l: Line` 为参 ⇒ 纯函数，按约定进 `utils/`） |
| 24 | C12 | `composables/hui/useHuiLineSelection.ts` | 1587–1620 | **中**。⚠️ `checkboxTick`(1587) 是**组件通过页面回调写**的（模板 141/158 传 `:selected-count="selectedLines.length"`，`DetailLinesTable.vue:97` 那个 prop；组件侧调 `props.hooks.onSelectChange()`）。抽出后那个回调必须接到抽出的状态上 —— 属 §6.1 那类失效点 |
| 25 | C13 | `composables/hui/useHuiSortMethod.ts` | 1919–1932 | 低。⚠️ `sortMethod` 同时被打印载荷构造读（1913–1918 注释那条规则）⇒ 必须回传该 ref，不能只回传对话框开关 |
| 26 | C8 | `composables/hui/useHuiAutoMarkup.ts` | 961–972 + 1226–1256 | **高**（注入 `disableAutoMarkup`；1233 的 `ref(disableAutoMarkup.value)` 是**即时读值**） |
| 27 | C9 | `composables/hui/useHuiOrderIo.ts` | 1419–1531 + 2131–2146 | **高**（注入 11 项）。必须导出 `markSaved`（外部 5 个调用点）；`savedSnap`(1429) 是**裸 `let`** ⇒ getter+setter；`serializeOrder`(1419) 对 **key 顺序敏感**，函数体**逐字不动**；`onBeforeRouteLeave`(1436) **绝不能挪进 async/回调** |
| 28 | C10 | `composables/hui/useHuiPrint.ts` | 1941–1980 + 2039–2079 + 2152–2175 | **高**（注入 12 项）。⚠️ 入参必须是 ref/对象引用，**传值 ⇒ 打印内容冻结在注入那一刻** |

**Stage 4 收尾**：

- [ ] Run: `npm run verify` 全绿；`wc -l app/src/views/Hui.vue` 与 spec 对齐。
- [ ] ⚠️ **不要顺手做的事**（spec §6.3-7 / §6.4）：`beforeunload`(2191) 摘了、`storage`(2192) **从不摘** —— 这个不对称**不许修**；`fillLineNumbers` 只有平开表挂了按钮（模板 147，**全文件只此一处**），**不许补齐**；`1899–1918` 那 20 行孤儿注释**本阶段不动**（已记账在 spec §8.2-3b）。

---

# 阶段五 · 行号引用复核（**必须排期，否则就是「等用户问起才想起来」**）

### Task 29: 复核 238 处行号引用

**Files:**
- Modify: 20 个文件（18 `.md` + 2 `.mjs`）

- [ ] **Step 1: 重新枚举**

```bash
grep -rn "Home\.vue:[0-9]\|Hui\.vue:[0-9]" docs/ --include=*.md --include=*.mjs | wc -l
```

- [ ] **Step 2: 先修 `.mjs`（它们会真的红）**

`docs/home-audit/hui-save-clobber-check.mjs` · `docs/home-audit/hui-engine-logiccheck.mjs`
—— 这两个是差分台，里面若按行号引用了已搬走的代码，**跑 `npm run verify` 就会红**（所以其实阶段三/四会先撞上它们；撞上时**就地改对**，别攒到最后）。

- [ ] **Step 3: 再修 `.md`（会漂移但不红）**

按引用数从多到少：`docs/home-audit/01-table.md`(75) · `02-actions.md`(56) · `03-shell.md`(28) · `docs/2026-09-18-detail-table-extraction.md`(16) · `docs/2026-09-16-markup-gap.md`(13) · `docs/ui-upgrade/01-hardcoded-styles.md`(12) · `docs/2026-09-15-parts-order-fidelity.md`(9) · 其余。

原则：**引用的代码搬走了 ⇒ 改成指向新文件的新行号**；引用的代码没搬 ⇒ 只改数字。

- [ ] **Step 4: 过 lint（清单类文档的表格）**

```bash
node docs/home-audit/recount-status.mjs          # 硬闸：列数与表头不符
node docs/home-audit/recount-status.mjs --check   # 与 00-summary 那张表对账，漂了就退 1
```

- [ ] **Step 5: 提交**

```bash
git commit -m "docs: 拆分后行号引用复核（238 处 / 20 文件）"
```

---

## 完成判据

- [ ] `app/src/views/Home.vue` 的 script 从 2890 行降到约 950–1100 行（`columns` 335 行留驻）
- [ ] `app/src/views/Hui.vue` 的 script 从 1617 行显著下降
- [ ] `node docs/home-audit/home-extract-movecheck.mjs` 退出 0，清单覆盖**每一块**搬走的每个名字，反向检查干净
- [ ] `node docs/home-audit/hui-extract-movecheck.mjs` 仍退出 0（**它的 `REF` 没被改动**）
- [ ] `npm run verify` 全绿：34 个台子 · `cargo fmt --check` · `npm run build` · `cargo clippy` · `cargo test`
- [ ] `node docs/home-audit/recount-status.mjs --check` 退出 0
- [ ] 238 处行号引用已复核
- [ ] `docs/2026-09-20-home-hui-split.md` 的 §3.1/§3.3 已按**实测**结果对齐（每块搬完都回头改了一次）
- [ ] spec §8.1「有意不做」那 6 项**仍然没做**（死 CSS 仍死、`storage` 监听仍不摘、`columns` 仍在原地）

## 已知的坑（本计划执行时一定会撞上）

| # | 坑 | 处置 |
|---|---|---|
| 1 | **行号漂移**。前面每搬一块，后面全部偏移 | 一律**按名字 grep 定位**，不按行号。Task 5–14 骨架 Step 1 就是干这个 |
| 2 | **`npm run verify` 里差分台的夹具过时**。本项目真栽过（2026-09-19，`print-lineno-check.mjs` 的手写桩被打崩，一天后才发现） | 所以**不许只跑 build**。桩确实该改时，在脚本注释写明理由 |
| 3 | **`vue-tsc` 的盲区**：抓不到缺失的 `.vue` 导入、某些 CSS 语法错 | 以 `npm run build` 为准（`npm run verify` 里已含） |
| 4 | **守卫的 manifest 是能力边界**：清单外的代码它不知道 | 每块搬完**立刻**登记，别攒 |
| 5 | **`git show` 在浅克隆下失败** | Task 0 已给 CI 加 `fetch-depth: 0`；本地若也是浅克隆，`git fetch --unshallow` |
| 6 | **导出值 vs 导出引用**（§6.1 + 两个裸 `let`） | 一律回传 ref 本身 / getter+setter 对。这是**静默失效**，测试抓不到 |
| 7 | 阶段四开工前 **Hui 清单需要用户重新确认**（初版漏了 409 行） | 别忘了这一步，否则是在错的清单上开工 |

## 「不要顺手做」清单（每条都是行为变化）

死 CSS 那 15 条（spec §1.5）· `beforeunload`/`storage` 的不对称 · `fillLineNumbers` 只给平开表挂按钮 · `manualActions` 的「只读一次」 · `headWithStatus` 的全头覆盖 · `onCheckedKeys` 的 `meta.action` · `serializeOrder` 的 key 顺序 · `renderEditable` 的「先 startEdit 再写草稿」 · `clearOrderNoQuery` 的 50ms · `localToday`/`legacyToday` 的两套口径 · 那 20 行孤儿注释 · `columns` 的 30 个依赖。

**发现它们有问题 ⇒ 记进 spec §8，不在搬迁笔里修。**
