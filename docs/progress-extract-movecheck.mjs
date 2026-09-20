/*
 * 「搬迁保真」检查（Progress 版）—— 证明 `Progress.vue` 里的代码搬到新文件时**逐字未改**。
 *
 * 为什么要这个：本项目栽过「手抄旧版源码导致转写错误」（见 `docs/home-audit/00-summary.md` 末尾）。
 * 把一堆声明从一个文件搬到另一个文件，风险与手抄同类 —— 而 `npm run build` 绿**证明不了**
 * 语义没变（少一个 `?? 0`、`Math.max` 写成 `Math.min` 都照样过编译）。
 * 所以这里拿 `git show <ref>:app/src/views/Progress.vue` 的**搬迁前**原文，
 * 与新文件里的同名声明逐字比。
 *
 * 比的是**声明归一化后的文本**：
 *   · 去掉每行行首缩进（搬进 `utils/` 后整体可能多缩进）
 *   · 折叠行尾空白、丢空行
 *   · `//` 注释**保留**（注释也是文档，改了要看得见）
 *
 * 用法：
 *   node docs/progress-extract-movecheck.mjs            # 与默认参照比
 *   node docs/progress-extract-movecheck.mjs <ref>      # 与指定 ref 比
 *   node docs/progress-extract-movecheck.mjs --selftest # 只跑自测（不碰 git）
 *
 * 姊妹件：`docs/home-audit/home-extract-movecheck.mjs`（Home.vue）·
 *        `docs/home-audit/hui-extract-movecheck.mjs`（Hui.vue）。
 *
 * 比对**核心**（`sliceFn` / `norm` / `applyRewrites` / `firstDiffLine`）**只有一份实现**，
 * 在 `docs/home-audit/lib/extract-movecheck-core.mjs` —— 本文件**不复制第二份**
 * （三台守卫共用同一份切片/归一化语义，改一处三边一起变）。
 * 留在这边的只有**搬迁清单**（`BLOCKS`）与判定/输出文案。
 *
 * ── ⚠️⚠️ 能力边界（别把它当成「全都验过了」）──────────────────────────────────
 *
 * 1. **只验 `BLOCKS` 里点名过的名字**。没搬的、搬了却忘了登记的，它**完全不知道**
 *    ⇒ 「本脚本绿」只等于「清单内逐字一致」，**不等于「搬迁完整」**。
 * 2. **它抓不到「登记本身写错」**：它证明的是「搬迁**符合登记过的改写**」，
 *    **不是**「登记过的改写**是对的**」—— `rewrites` 写错时，参照侧套的是**同一份错规则**
 *    ⇒ **两边同错** ⇒ 归一化后逐字一致、**照样绿**。
 *    实证：Home 的 B4 第一版把该块**自己拥有**的三个 ref 也当成注入项、体里写成
 *    `deps.orderNoInput.value` ⇒ **8 处 `TS2339`**，而守卫**全绿**。
 *    ⇒ 抓这一类的是 **`vue-tsc` / `npm run build`**。
 *    **结论：守卫与 `vue-tsc` 必须成对跑，缺一不可** —— 守卫管「搬的时候有没有偷偷改」，
 *    `vue-tsc` 管「搬完的名字与形状对不对」。只跑一个都会漏掉另一半。
 * 3. **「绿」不等于「这一段验过」**：比的是 `sliceFn` **切出来的那一段**。
 *    Hui 侧曾有 4 个已登记的名字因为命中「单行声明」快车道、**只比了第一行**，
 *    而守卫照样报「逐字一致」（详见核心文件头「历史假绿」）。
 *    ⇒ **登记前必做的验法**：把该声明的**第二行**改一下 → 跑本脚本 → **必须报红**；
 *      不红就别登记（登记了等于给自己发一张假绿卡）。改完**还原**。
 *    ⚠️ 本项目更硬的独立判据是**真 TS 解析器**：`app/node_modules/typescript` 就在仓库里，
 *      `ts.createSourceFile` + 递归遍历取同名声明 `getText()`，与切片都过 `norm()` 再比。
 *      本清单的 23 个名字**已经用它复核过一遍**（23/23 逐字一致），但那是一次性的，
 *      没有落成常驻仪器（`docs/home-audit/decl-sweep.mjs` 那台是 Home/Hui 的）。
 * 4. **切片器是文本切片器、不是解析器** —— 已知残留逐条列在核心文件头「能力边界」。
 *    与本文件最相关的一条：**正则字面量里的括号**不进括号栈。
 *    ⚠️ P1 里就有**两个正则字面量**（`DATE_RE = /\d{4}-\d{2}-\d{2}/` 与
 *      `escapeHtml` 里的 `/&/g` `/<` `/>` ）—— `--selftest` 里有专门一例钉住这类形状
 *      （它们收支正好配平，切出来是对的；但换个写法就不一定，所以**不许**把那条自测删掉）。
 *
 * ── 怎么登记一条块 ──────────────────────────────────────────────────────────
 *
 *   { target: 'app/src/utils/xxx.ts',   // 相对仓库根；有多个目标就写多条 block
 *     names:  ['foo', 'bar'],           // function / 箭头函数都算
 *     consts: ['BAZ'],                  // const / let / type / interface（含 computed / ref）
 *     rewrites: { foo: [{ from: '…', to: '…' }] } }
 *
 * · `names` / `consts` **都可省**（摊平与 `|| []` 的守卫在 `blockNames()` 里，自测有一例钉住）。
 * · `rewrites` 里每条 `from` 都必须在旧文里**找得到**（找不到 `applyRewrites` 会抛 —— 白送的检查）；
 *   反过来**漏登记不会抛**，只表现成 diff ⇒ 改完必须**逐行看 diff**，不能只看退出码。
 * · 规则一律**带边界**（写 `dialog.warning({` 而不是 `dialog`）：它是朴素 `split/join`，
 *   裸名会把别的标识符一起改坏（写 `load` 会顺手打到 `loadedIds` 上）。
 * · **`//` 注释不在任何切片里**（`sliceFn` 从**声明**起切）⇒ 段头注释的保真只有
 *   `git diff` 人工比对一条来源，本脚本管不到。别拿「本脚本绿」当它的证据。
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { applyRewrites, firstDiffLine, norm, sliceFn } from './home-audit/lib/extract-movecheck-core.mjs'

// 仓库根从**本文件位置**推出（本文件在 `docs/` ⇒ 往上**一级**就是仓库根）。
// 别写死 `/Users/aaa/Desktop/door-main`：本机跑得通，换台机器或进 CI（checkout 路径不同）就崩。
const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')

/**
 * ⚠️ 参照**必须钉在本次拆分动工之前的那个提交**（`f097a9b1`，Progress 拆分的 BASE）。
 * 不能用 `HEAD` —— 拆分提交一落，`HEAD` 就是「搬完」的状态，`Progress.vue` 里那些声明
 * 已经被删了，全部会报「HEAD 里找不到」。
 *
 * `--selftest` 分支里给的 `'HEAD'` 只是兜底占位 —— 自测**根本不碰 git**（见下）。
 */
const REF = process.argv[2] || (process.argv.includes('--selftest') ? 'HEAD' : 'f097a9b1')
const OLD_PATH = 'app/src/views/Progress.vue'

/**
 * Progress 拆分的搬迁清单。**每搬完一块就在这里加一条** —— 守卫只验清单里的东西，
 * 清单外的东西它不知道（这是它的能力边界，写在这里免得被当成「全都验过了」）。
 *
 * 形状见文件头「怎么登记一条块」。方案里的 12 块依次是 P1…P12（`docs/…` 的 plan §3.1）。
 */
const BLOCKS = [
  {
    /*
     * **P1「单元格保真」**（→ `app/src/utils/progressCells.ts`）—— 本守卫的第一条，
     * 也是 12 块里唯一的**纯模块**（`utils/`，不是 `composables/`）。
     *
     * 快照 `Progress.vue:602-827`（连续一段，226 行），**23 个声明**：
     *   7 个 `const` 薄封装（`gContainer` `gContainer2` `gGroup` `gLabel` `gSpan` `gMaybe` `line`）·
     *   3 个渲染口径常量（`RED_STYLE` `DATE_RE`，以及 `redSpan`/`escapeHtml` 两个小函数）·
     *   3 个 `function`（`splitUnderscore` `va` `trackRowLabel`）·
     *   9 个单元格渲染（`progressCell` … `amountCell`）。
     *
     * ⚠️ **本块的改写只有「加 `export`」一类，一个注入改写都没有** ——
     *    实测：段内零 `ref`/`computed`/`message`/`api`/组件上下文引用，每个声明只读自己的
     *    形参 `r: ProgressRowDto` 与模块级导入（`h` / `VNodeChild` / `ProgressRowDto`）。
     *    ⇒ 它是「搬迁保真」最干净的一类：23 条规则**全部**是 `const X = ` → `export const X = `
     *      （或 `function X(` → `export function X(`），**没有第二种改写**。
     *    ⚠️ 正因为「零注入」，本块**验不出**「改写写错」那一类错（文件头能力边界 2）——
     *      它抓的是「有没有偷偷改逻辑」，形状对不对由 `vue-tsc` 管。
     *
     * ⚠️ **`consts` 里放的是 `const`/`function` 之外的声明形式吗？不是** —— 本文件沿用
     *    Home/Hui 两台的惯例：`names` 放 `function`、`consts` 放 `const`（两者都只是**清单分栏**，
     *    `blockNames()` 会摊平，判定完全一样；分栏只为让人一眼看出声明形式）。
     *    本块 3 个 `function` 进 `names`，其余 20 个进 `consts`。
     *
     * ⚠️ **段头三行分区横幅与段内注释不在任何切片里**（`sliceFn` 从**声明**起切）：
     *    它们的保真只有 `git diff` 人工比对一条来源。实测：把 `Progress.vue` 里
     *    `// A. 单元格保真` 那行改掉一个字，本脚本**不报红**（这是能力边界，不是洞）。
     */
    target: 'app/src/utils/progressCells.ts',
    names: ['splitUnderscore', 'va', 'trackRowLabel'],
    consts: [
      'gContainer', 'gContainer2', 'gGroup', 'gLabel', 'gSpan', 'gMaybe', 'line',
      'RED_STYLE', 'redSpan', 'escapeHtml', 'DATE_RE',
      'progressCell', 'remarkCell', 'profileColorCell', 'glassCell', 'fansDirectionCell',
      'trackCasingCell', 'doorSizeCell', 'lightWindowCell', 'amountCell',
    ],
    rewrites: {
      // ── 3 个 `function` ────────────────────────────────────────────────────
      splitUnderscore: [{ from: 'function splitUnderscore(', to: 'export function splitUnderscore(' }],
      va: [{ from: 'function va(', to: 'export function va(' }],
      trackRowLabel: [{ from: 'function trackRowLabel(', to: 'export function trackRowLabel(' }],
      // ── 20 个 `const` ─────────────────────────────────────────────────────
      // ⚠️ `from` 一律**带 ` = `**（不是裸名）：`applyRewrites` 是朴素 `split/join`，
      //    写 `const gContainer` 会**顺手打中 `const gContainer2`** —— 那是本仓库反复栽过的
      //    那一族（Hui 的 `load` → `loadedIds`）。带 ` = ` 之后两条规则互不干扰。
      //    （实测：去掉 ` = ` 后这一条会把 `gContainer2` 改坏，而**改写是逐声明施加的**、
      //      所以受害的其实是 `gContainer2` 自己那条 —— 两条都写成裸名时**互相**打中。）
      gContainer: [{ from: 'const gContainer = ', to: 'export const gContainer = ' }],
      gContainer2: [{ from: 'const gContainer2 = ', to: 'export const gContainer2 = ' }],
      gGroup: [{ from: 'const gGroup = ', to: 'export const gGroup = ' }],
      gLabel: [{ from: 'const gLabel = ', to: 'export const gLabel = ' }],
      gSpan: [{ from: 'const gSpan = ', to: 'export const gSpan = ' }],
      gMaybe: [{ from: 'const gMaybe = ', to: 'export const gMaybe = ' }],
      line: [{ from: 'const line = ', to: 'export const line = ' }],
      RED_STYLE: [{ from: 'const RED_STYLE = ', to: 'export const RED_STYLE = ' }],
      redSpan: [{ from: 'const redSpan = ', to: 'export const redSpan = ' }],
      escapeHtml: [{ from: 'const escapeHtml = ', to: 'export const escapeHtml = ' }],
      DATE_RE: [{ from: 'const DATE_RE = ', to: 'export const DATE_RE = ' }],
      progressCell: [{ from: 'const progressCell = ', to: 'export const progressCell = ' }],
      remarkCell: [{ from: 'const remarkCell = ', to: 'export const remarkCell = ' }],
      profileColorCell: [{ from: 'const profileColorCell = ', to: 'export const profileColorCell = ' }],
      glassCell: [{ from: 'const glassCell = ', to: 'export const glassCell = ' }],
      fansDirectionCell: [{ from: 'const fansDirectionCell = ', to: 'export const fansDirectionCell = ' }],
      trackCasingCell: [{ from: 'const trackCasingCell = ', to: 'export const trackCasingCell = ' }],
      doorSizeCell: [{ from: 'const doorSizeCell = ', to: 'export const doorSizeCell = ' }],
      lightWindowCell: [{ from: 'const lightWindowCell = ', to: 'export const lightWindowCell = ' }],
      amountCell: [{ from: 'const amountCell = ', to: 'export const amountCell = ' }],
    },
  },
  {
    /*
     * **P2「颜色口径」**（→ `app/src/composables/progress/useProgressColors.ts`）。
     *
     * 快照 `Progress.vue:828-997`（连续一段，170 行），**14 个声明**：
     *   5 个 `function`（`latestSegment` `resolveConfiguredColor` `colorKeyOf` `rawColorOf`
     *   `progressCellStyle`）+ 9 个 `const`（`UNPRODUCED_KEY` `normColor` `EMPTY_COLOR`
     *   `BUILTIN_COLORS` `nameColorMap` `slotNo` `orderedProcedureNames` `cellPad`
     *   `colorFilterOptions`）。
     *
     * ⚠️ **区间两端各易错一行**（方案原本写的是 `829-998`）：
     *    828-830 是**本段自己的**段首横幅（`// B. 颜色口径…`）⇒ **跟块走**；
     *    998-1000 是**下一段**（`// B. 列头交互`）的横幅 ⇒ **留在原地**。
     *    复量：`git show f097a9b1:app/src/views/Progress.vue | sed -n '826,830p'`（末三行 = 本段横幅）、
     *          `… | sed -n '996,1000p'`（末三行 = 下一段横幅）。
     *    ⚠️ 这条**没有任何闸能抓** —— `sliceFn` 从**声明**起切，横幅/注释根本不进切片
     *      （文件头「能力边界 1」）。所以它只有 `git diff` 逐字节核一条来源。
     *
     * ⚠️ **本块是本守卫第一条 `composables/` 块**：与 P1（纯模块）不同，这段要读**页面状态**
     *    ⇒ 拆成工厂 `useProgressColors(deps)`，声明**缩在工厂里**（与 Home/Hui 已经这么搬过的
     *    那批工厂块同一形状 —— 那批的名单由 `docs/home-audit/home-extract-movecheck.mjs` 与
     *    `hui-extract-movecheck.mjs` 的 `BLOCKS` 定义，这里不逐一点名：点名和 glob 一样会漂）。
     *    ⚠️ 因此**本块一条 `export` 改写都没有**（函数体内写 `export` 是 `TS1184`），
     *      14 个声明全部由工厂 `return` 借出 —— 「加 `export`」是 P1 独有的那类改写。
     *      `sliceFn` 的起点正则本来就允许行首缩进，所以缩进不影响逐字比对。
     *
     * ⚠️ **注入改写只有一条**：`procedures.value` → `deps.procedures.value`，而且**只发给真的
     *    含它的那 3 个**（`nameColorMap` / `orderedProcedureNames` / `colorFilterOptions`，
     *    段内共 3 处）。其余 11 个**不能**挂这条规则 —— `applyRewrites` 的 `from` 找不到会**抛**
     *    （白送的检查，但代价是那条名字直接判红）。
     *    ⚠️ 边界已核对：段内不存在别的 `…procedures.value` 形状会被朴素 `split/join` 误伤
     *      （`orderedProcedureNames.value` / `nameColorMap.value` 里都**不含** `procedures.value`
     *      这个子串 —— 差在 `Names` / `Map` 那段）。
     *
     * 登记前按文件头「能力边界 3」做过那条**必做验法**：把本块某个多行声明的**第二行**改一下
     * → 本脚本报红并定位到第 2 行 → 还原。实得：多行的 `nameColorMap` 报 `L2`、单行的
     * `EMPTY_COLOR` 报 `L1`、漏做注入改写时 `colorFilterOptions` 报 `L13`（三组都不是假绿）。
     */
    target: 'app/src/composables/progress/useProgressColors.ts',
    names: ['latestSegment', 'resolveConfiguredColor', 'colorKeyOf', 'rawColorOf', 'progressCellStyle'],
    consts: [
      'UNPRODUCED_KEY', 'normColor', 'EMPTY_COLOR', 'BUILTIN_COLORS', 'nameColorMap', 'slotNo',
      'orderedProcedureNames', 'cellPad', 'colorFilterOptions',
    ],
    rewrites: {
      nameColorMap: [{ from: 'procedures.value', to: 'deps.procedures.value' }],
      orderedProcedureNames: [{ from: 'procedures.value', to: 'deps.procedures.value' }],
      colorFilterOptions: [{ from: 'procedures.value', to: 'deps.procedures.value' }],
    },
  },
  {
    /*
     * **P4「行内删除」**（→ `app/src/composables/progress/useProgressDeleteRow.ts`）。
     *
     * 快照 `Progress.vue:513-601`（连续一段，89 行），段内**唯一的**声明是
     *   `function confirmDeleteRow`（REF **564**）。
     *   其余 50 行是段首那行分区横幅（`// ===== 行内「删除」（§4.3）=====`）与它下面那段
     *   解释「这一格删的是**整条门行**、不是进度」的块注释。
     *
     * ⚠️ **区间两端**（方案 `§3.1` 写的就是 513-601，实测两端都干净、一处不用改）：
     *    512 是空行、513 是本段自己的横幅 ⇒ **横幅跟块走**；
     *    601 是空行、602 起已是**下一段**的横幅（`// ═══ / A. 单元格保真`）⇒ **留在原地**。
     *    复量：`git show f097a9b1:app/src/views/Progress.vue | sed -n '511,515p'`（末行 = 本段横幅）、
     *          `… | sed -n '599,603p'`（次行已是 `// ═══`）。
     *    ⚠️ 这条**没有任何闸能抓**（`sliceFn` 从声明起切，横幅/注释根本不进切片）——
     *      它只有「整段与 REF 同区间逐字节比」一条来源（Global Constraints R32 的动手后验收）。
     *
     * ⚠️ **本块与 P2 同形**：落点是工厂 `useProgressDeleteRow(deps)`，声明缩在工厂里
     *    ⇒ **一条 `export` 改写都没有**（函数体内写 `export` 是 `TS1184`），
     *    `confirmDeleteRow` 由工厂 `return { confirmDeleteRow }` 借出。
     *
     * ⚠️ **注入改写 = 3 类、4 条规则**（`dialog.warning` ×1 · `message.` ×3 ·
     *    `rows.value.findIndex` ×1 · `rows.value.splice` ×1）：
     *    ⚠️ 规则**故意不写裸 `rows.value`**：它在段内出现 **4** 次，其中 **2 次在注释里**
     *      （REF 598 那句「用 `splice` 而不是 `rows.value = rows.value.filter(...)`」）。
     *      写裸名会把那句注释改成 `deps.rows.value = deps.rows.value.filter(...)` ——
     *      **注释内容就漂了**（Global Constraints 明令「不许改注释内容」），而本脚本
     *      `//` 注释**是保留着比的**（核心 `norm()` 只丢空行、不丢注释）⇒ 那样写会**报红**。
     *      带后界的两个名字正好只命中 23/25 两行那两处活代码。
     *    ⚠️ `message.` 的边界已核：段内另外两处 `message` 是 `… 显示它自己的 message（兜底…）`
     *      与 `（HTTP 错带服务端 message、断网带 fetch 的 reason）` —— **后面都不是 `.`**
     *      ⇒ 不会被这条规则误伤。`e.message : '删除失败，请重试'` 同理（`message` 后是空格）。
     *
     * 登记前按文件头「能力边界 3」做过那条**必做验法**：把多行的 `confirmDeleteRow` 改掉**第二行**
     * → 本脚本报红并定位到第 2 行 → 还原（实得见下方 `--selftest` 之外的人工记录；本块是单声明块，
     * 漏做任一注入改写同样报红并给出触发规则名）。
     */
    target: 'app/src/composables/progress/useProgressDeleteRow.ts',
    names: ['confirmDeleteRow'],
    consts: [],
    rewrites: {
      confirmDeleteRow: [
        { from: 'dialog.warning', to: 'deps.dialog.warning' },
        { from: 'message.', to: 'deps.message.' },
        { from: 'rows.value.findIndex', to: 'deps.rows.value.findIndex' },
        { from: 'rows.value.splice', to: 'deps.rows.value.splice' },
      ],
    },
  },
  {
    /*
     * **P3「更新进度弹窗」**（→ `app/src/composables/progress/useProgressUpdateDialog.ts`）。
     *
     * 快照 `Progress.vue:420-442`（挖掉 433 的 `procedures`）+ `453-512` —— **三段、不连续**
     * （82 行 = 13 + 9 + 60），**14 个声明**：
     *   7 个 `ref`（`updOpen` `updSaving` `updTarget` `updBatch` `updSlot` `updOperator` `updDate`）·
     *   3 个 `computed`（`slotOptions` `updValue` `updTitle`）·
     *   4 个 `function`（`today` `openUpdateDialog` `openUpdate` `submitUpdate`）= 7 + 3 + 4 = 14。
     *   按行段分：`420-432` 里 **7**（就是那 7 个 `upd*` ref —— `433` 的 `procedures` 留壳、不算）·
     *   `434-442` 里 **2**（`slotOptions` + `today`）· `453-512` 里 **5**（`updValue`
     *   `openUpdateDialog` `openUpdate` `updTitle` `submitUpdate`）⇒ 7 + 2 + 5 = 14 ✓。
     *   ⚠️ 12 块里**只有本块的行段是多段**（R1 裁决的产物）⇒ 删段必须是三段具名区间。
     *
     * ⚠️ **留壳的两处**（都实测过、都不归本块）：
     *   · `433` `const procedures` —— P2 的颜色口径与下面那个 `loadSlots` 共用它；
     *   · `443-452`（空行 + `async function loadSlots` + 空行）—— 写 `procedures` 的是它。
     *   ⇒ 本块的 82 行是**拼接**出来的：`434-442` 之后直接接 `453-512`，所以新家里
     *     `today()` 的 `}` 后面紧接 `updValue` 的 JSDoc、中间**没有空行**。
     *     ⚠️ 那**不是**改写，是本块区间自带的形状 —— 拿「多了/少了一个空行」当红是误判。
     *
     * ⚠️ **本块也是工厂式**（`useProgressUpdateDialog(deps)`），**一条 `export` 改写都没有**，
     *    14 个声明全部由 `return` 借出（函数体里写 `export` 是 `TS1184`）。
     *
     * ⚠️ **注入改写 = 4 条规则、命中 7 处**：
     *   `procedures.value`(×2，`slotOptions` / `updValue`) ·
     *   `selectedRows.value`(×2，`updTitle` / `submitUpdate`) ·
     *   `message.`(×2，`submitUpdate` 的 success/error) ·
     *   `load()`(×1，`submitUpdate` 末尾的 `await load()`)。
     *   ⚠️ **`load` 那条的边界已核**：段内 `load` 只出现这一次，但 `from` 仍写成带括号的
     *     `load()`（核心文件头「规则一律要带边界」）。段内**没有** `loadSlots` 那种会被裸名
     *     误伤的兄弟（`loadSlots` 留壳、不进本块切片）—— 写 `load` 也**碰巧**安全，
     *     但带括号是能自证的那一种，不靠「碰巧」。
     *   ⚠️ 这 4 条 vs 探针实测：`procedures.value` / `selectedRows.value` / `message.` 三条
     *     在段内**各 2 处，且全部落在活代码里**（段内注释里一个都没有）⇒ 不存在 P4 那种
     *     「规则改到注释里」的风险。
     */
    target: 'app/src/composables/progress/useProgressUpdateDialog.ts',
    names: ['today', 'openUpdateDialog', 'openUpdate', 'submitUpdate'],
    consts: [
      'updOpen', 'updSaving', 'updTarget', 'updBatch', 'updSlot', 'updOperator', 'updDate',
      'slotOptions', 'updValue', 'updTitle',
    ],
    rewrites: {
      slotOptions: [{ from: 'procedures.value', to: 'deps.procedures.value' }],
      updValue: [{ from: 'procedures.value', to: 'deps.procedures.value' }],
      updTitle: [{ from: 'selectedRows.value', to: 'deps.selectedRows.value' }],
      submitUpdate: [
        { from: 'selectedRows.value', to: 'deps.selectedRows.value' },
        { from: 'message.', to: 'deps.message.' },
        { from: 'load()', to: 'deps.load()' },
      ],
    },
  },
  {
    /*
     * **P7「工具条 + 行勾选」**（→ `app/src/composables/progress/useProgressToolbar.ts`）。
     *
     * ⚠️ **本块是两段，不是一个连续区间**（全计划里只有它是这样）：
     *   · `Progress.vue:1374-1417`（44 行）—— `ExcelJSInterop`(1383) / `exporting`(1389) /
     *     `searchText`(1396) / `selectedRows`(1408) / `refresh`(1414) —— **5 个**。
     *   · `Progress.vue:1599-1652`（54 行）—— `allSelected`(1621) / `toggleSelectAll`(1626) /
     *     `openBatchUpdate`(1644) —— **3 个**。
     *   合计 98 行、**8 个声明**，全在一个目标文件里（`ExcelJSInterop` 是 `type`，见下）。
     *   中间 `1418-1598` 是 **P8「查询更多」**（Task 5 才搬）⇒ **删段时是两条具名区间**，
     *   绝不是一整段 `1374,1652d`。
     *
     * ⚠️ **为什么两段必须同住一个文件**：`message`(1646) / `openUpdateDialog`(1650) 只在第二段
     *   出现，`filteredRows`(1622/1630) / `rows`(1408/1632) / `load`(1415) 两段都有
     *   ⇒ 拆成两个文件就得互相注入，两边各自 `TS2448`。**一条 `export` 改写以外的改动全在壳侧**。
     *
     * ⚠️ **两条横幅与段内注释没有任何闸能抓**（`sliceFn` 从声明起切，横幅/注释根本不进切片）——
     *   它们只有「整段与 REF 同区间逐字节比」一条来源（Global Constraints R32 的动手后验收）。
     *   本块那条逐字节核已做（独立脚本，不是本守卫）：两段拼起来 **88 行**（1374-1377 +
     *   1388-1417 + 1599-1652，中间那 10 行是 `ExcelJSInterop`，被提到工厂外）、
     *   反向套完 6 条注入改写后**残差 0 处**；拼缝处的那个空行也在比对范围内。
     *   复量：`git show f097a9b1:app/src/views/Progress.vue | sed -n '1372,1378p'`（横幅）·
     *        `… | sed -n '1415,1419p'`（止点 = 1417，1418 已是 **P8** 的横幅）·
     *        `… | sed -n '1597,1601p'` · `… | sed -n '1650,1654p'`（1653 已是 P9 的横幅）。
     *
     * ⚠️ **`ExcelJSInterop` 是「最容易被名单漏掉」的那一类**（`type` 不是函数）：
     *   漏登记 ⇒ 本守卫不切它 ⇒ 它留在壳里、**本守卫照样全绿**
     *   （memory `split-guard-blind-spots` 第 1 类「登记写错两侧同错」）。
     *   归口由 R2 更正 + 裁决定死（「归谁消费 ≠ 归谁搬」）：**随 P7a 一起搬，由本文件 `export`**，
     *   Task 7 的 `useProgressExport.ts` 去 import 它。
     *   ⇒ 它的改写是这里**唯一**一条 `export` 改写（其余 7 个都在工厂体内，写 `export` 是 `TS1184`）。
     *   ⚠️ 它还被**重排**过：REF 里在横幅之后、`exporting` 之前，新文件里提到 deps 接口上方
     *   （它必须出工厂）—— 但**工厂体内的相对顺序与 REF 一字不差**。
     *
     * ⚠️ **注入改写 = 6 条规则、命中 8 处**（`rows.value`×2 · `filteredRows.value`×3 ·
     *   `load()`×1 · `message.`×1 · `openUpdateDialog(null)`×1 · `type` 加 `export`×1）：
     *   · 规则一律**带边界**（核心文件头：朴素 `split/join`，裸名会顺手打到别的标识符上）——
     *     `load` 写成 `load()`、`openUpdateDialog` 写成带实参的 `openUpdateDialog(null)`。
     *   · `rows.value` 与 `filteredRows.value` **不构成子串关系**（差在 `Rows` 的**大写 R**，
     *     且 `split/join` 大小写敏感）⇒ 两条规则互不误伤（已核）。
     *   · 段内**注释里一处命中都没有**（逐条量过）：`toggleSelectAll` 里那两行注释写的是
     *     `te 数组` 与 `!r.isSelected`；`openBatchUpdate` 里那句旧版原文写的是
     *     `te.ping_hui` / `ElMessage.error`，**没有** `message.` 这个子串
     *     ⇒ 不存在 P4 那种「规则改到注释里、注释内容就漂了」的风险。
     *   · `openBatchUpdate` 的 `selectedRows.value` **不在改写表里**：那把 `selectedRows` 是本
     *     文件的工厂局部（既不是 `deps.selectedRows` 也不是页面的），REF 与新文件逐字相同。
     *
     * 登记后按文件头「能力边界 3」做了那条**必做验法**（三组变异，都报红并定位到行，**不是假绿**）：
     *   ① `allSelected` 第二行 `> 0` → `>= 0` ⇒ 报 `allSelected` `L2`
     *      （**这一条同时证明它没走「单行声明」快车道** —— 3 行的声明比到了第 2 行）；
     *   ② `openBatchUpdate` 里 `deps.message.` 还原成 `message.`（＝少套一条注入改写）
     *      ⇒ 报 `openBatchUpdate` `L3`（规则确实是承重的，不是装饰）；
     *   ③ `export type ExcelJSInterop = {` 去掉 `export`（＝漏登记那条唯一改写）
     *      ⇒ 报 `ExcelJSInterop` `L1`。
     *   三组都已还原，还原后本块 8 条全绿。
     */
    target: 'app/src/composables/progress/useProgressToolbar.ts',
    names: ['refresh', 'toggleSelectAll', 'openBatchUpdate'],
    consts: ['ExcelJSInterop', 'exporting', 'searchText', 'selectedRows', 'allSelected'],
    rewrites: {
      ExcelJSInterop: [{ from: 'type ExcelJSInterop = {', to: 'export type ExcelJSInterop = {' }],
      selectedRows: [{ from: 'rows.value', to: 'deps.rows.value' }],
      refresh: [{ from: 'load()', to: 'deps.load()' }],
      allSelected: [{ from: 'filteredRows.value', to: 'deps.filteredRows.value' }],
      toggleSelectAll: [
        { from: 'filteredRows.value', to: 'deps.filteredRows.value' },
        { from: 'rows.value', to: 'deps.rows.value' },
      ],
      openBatchUpdate: [
        { from: 'message.', to: 'deps.message.' },
        { from: 'openUpdateDialog(null)', to: 'deps.openUpdateDialog(null)' },
      ],
    },
  },
  {
    /*
     * **P5「列头交互」**（→ `app/src/composables/progress/useProgressHeader.ts`）。
     *
     * 快照 `Progress.vue:998-1225`（**连续一整段**，228 行），段内**14 个声明**：
     *   `matchesOrderNoOption`(1009) · `columnFilterState`(1016) · `onUpdateFilters`(1017) ·
     *   `orderNoFilterValues`(1021) · `orderNoInput`(1029) · `orderNoQuery`(1030) ·
     *   `orderNoPopShow`(1031) · `orderNoRestoring`(1032) · `confirmOrderNoQuery`(1046) ·
     *   `clearOrderNoQuery`(1074) · `orderNoHeader`(1086) · `colorFilter`(1155) ·
     *   `progressHeader`(1157) · `SEARCH_FIELDS`(1213)。
     *   其余 100 来行是段首三行分区横幅（`// ═══ / // B. 列头交互 / // ═══`）、
     *   `// ── B1.` / `// ── B2.` 两条子横幅，以及 B1 后面那段逐字抄着旧版 `ga`/`ya`/`ma` 的块注释。
     *
     * ⚠️ **区间两端**（方案 §3.1 写的就是 998-1225，实测两端都干净、一处不用改）：
     *    997 是**上一段（P2 颜色口径）**的收尾、998 是本段自己的横幅 ⇒ **横幅跟块走**；
     *    1225 是空行、1226 起已是**下一段**的横幅（`// ── B3. 筛选链 + 分页`）⇒ **留在原地**。
     *    ⚠️ 起点**不能写 999**（R38 的同类病）：那会把横幅的上横线 `// ═══` 留在 `Progress.vue`
     *      里当孤儿。
     *    复量：`git show f097a9b1:app/src/views/Progress.vue | sed -n '995,1000p'`（末行 = 本段横幅）、
     *          `… | sed -n '1223,1228p'`（次行已是 `// ── B3.`）。
     *    ⚠️ 这条**没有任何闸能抓**（`sliceFn` 从声明起切，横幅/注释根本不进切片）——
     *      它只有「整段与 REF 同区间逐字节比」一条来源（Global Constraints R32 的动手后验收）。
     *      本块那条逐字节核已做（独立脚本，不是本守卫）：**228 行 = 208（工厂正文）+ 20
     *      （模块级 `SEARCH_FIELDS`）**，反向套完 7 条注入改写后**两段残差都是 0 处**。
     *
     * ⚠️ **`SEARCH_FIELDS` 与其余 13 个不同**：它是**模块级常量**，必须出工厂并 `export`
     *   （工厂体内写 `export` 是 `TS1184`）⇒ 它的改写是这里**第二条** `export` 改写。
     *   ⚠️ 实测它**全部**引用点只有 **1213（定义）与 1273（P6 的 `filteredRows`）** ——
     *     **P5 自己一次都没用它**；由壳 `import { SEARCH_FIELDS }` 接住给 P6 用。
     *     漏登记它 ⇒ 本守卫不切它 ⇒ 它留在壳里、**本守卫照样全绿**
     *     （memory `split-guard-blind-spots` 第 1 类「登记写错两侧同错」）。
     *
     * ⚠️ **注入改写 = 7 条规则、命中 12 处**：`page.value`(×6：`onUpdateFilters`1 +
     *   `confirmOrderNoQuery`2 + `clearOrderNoQuery`1 + `progressHeader`2) ·
     *   `moreActive.value`(×1) · `moreRows.value`(×1) · `rows.value`(×1)（三条都在
     *   `confirmOrderNoQuery` 的候选集那一行）· `colorKeyOf(`(×1) · `message.warning`(×1) ·
     *   `colorFilterOptions.value`(×1)。
     *   · 规则一律**带边界**（核心文件头：朴素 `split/join`，裸名会顺手打到别的标识符上）：
     *     `colorKeyOf` 写成带左括号的 `colorKeyOf(`、`message` 写成 `message.warning`。
     *   · ⚠️ `rows.value` 与 `moreRows.value` **不构成子串关系**（差在 `Rows` 的**大写 R**，
     *     且 `split/join` 大小写敏感）⇒ 两条规则互不误伤（已核）。`page.value` 同理不会打到
     *     页面的 `pageSize`（本段内根本没有 `pageSize`）。
     *   · ⚠️ 12 处命中**全部落在活代码里**（逐条核过；段内注释里一处都没有）⇒ 不存在 P4 那种
     *     「规则改到注释里、注释内容就漂了」的风险。
     *   · `colorFilter`（本块自己的 `ref`）在段内有 5 处，**一条规则都不许挂**
     *     —— 它不是注入项。
     *
     * ⚠️ **本块的产出面 7 个**（另有 `SEARCH_FIELDS` 走 `export`）：`matchesOrderNoOption`
     *   `orderNoFilterValues` `orderNoQuery` `orderNoHeader` `colorFilter` `progressHeader`
     *   `onUpdateFilters`。**但这一条本守卫管不着** —— 它只比「声明搬得像不像」，
     *   「壳有没有漏接」由 `vue-tsc`（`TS2304`/`TS6133`）管（memory
     *   `split-guard-blind-spots` 第 3 类「模板绑定漏解构三绿仍空」）。
     *   另 6 个（`columnFilterState` `orderNoInput` `orderNoPopShow` `orderNoRestoring`
     *   `confirmOrderNoQuery` `clearOrderNoQuery`）**不回传**、壳里也不解构
     *   ⚠️ 但**别把它们从本清单里去掉**：它们是本块的内部件，`orderNoHeader` 那个 popover 的
     *   「清除」/「确认」按钮就是后两个 —— 去掉就等于这几段没人验。
     *
     * 登记后按文件头「能力边界 3」做了那条**必做验法**（三组变异，都报红并定位到行，**不是假绿**）：
     *   ① `confirmOrderNoQuery` 第 2 行 `-\d{2}\b` → `-\d{3}\b` ⇒ 报 `confirmOrderNoQuery` `L2`；
     *   ② `progressHeader` 里 `deps.page.value = 1` 还原成 `page.value = 1`（＝少套一条注入改写）
     *      ⇒ 报 `progressHeader`（规则确实是承重的）；
     *   ③ `SEARCH_FIELDS` 去掉 `export`（＝漏登记那条改写）⇒ 报 `SEARCH_FIELDS` `L1`。
     *   三组都已还原，还原后本块 14 条全绿。
     */
    target: 'app/src/composables/progress/useProgressHeader.ts',
    names: [
      'matchesOrderNoOption', 'onUpdateFilters', 'orderNoFilterValues',
      'confirmOrderNoQuery', 'clearOrderNoQuery',
    ],
    consts: [
      'columnFilterState', 'orderNoInput', 'orderNoQuery', 'orderNoPopShow', 'orderNoRestoring',
      'orderNoHeader', 'colorFilter', 'progressHeader', 'SEARCH_FIELDS',
    ],
    rewrites: {
      onUpdateFilters: [{ from: 'page.value', to: 'deps.page.value' }],
      confirmOrderNoQuery: [
        { from: 'page.value', to: 'deps.page.value' },
        { from: 'moreActive.value', to: 'deps.moreActive.value' },
        { from: 'moreRows.value', to: 'deps.moreRows.value' },
        { from: 'rows.value', to: 'deps.rows.value' },
        { from: 'colorKeyOf(', to: 'deps.colorKeyOf(' },
        { from: 'message.warning', to: 'deps.message.warning' },
      ],
      clearOrderNoQuery: [{ from: 'page.value', to: 'deps.page.value' }],
      progressHeader: [
        { from: 'page.value', to: 'deps.page.value' },
        { from: 'colorFilterOptions.value', to: 'deps.colorFilterOptions.value' },
      ],
      SEARCH_FIELDS: [{ from: 'const SEARCH_FIELDS = [', to: 'export const SEARCH_FIELDS = [' }],
    },
  },
  {
    /*
     * **「页面行」类型**（→ `app/src/utils/progressRow.ts`）—— **不属于任何一个块**。
     *
     * 快照 `Progress.vue:362`，**唯一一条只有一个 `type`、一行的块**：
     *   `type ProgressRow = ProgressRowDto & { isSelected: boolean }`
     *
     * ⚠️ **本计划里唯一一次「搬一个不属于任何块的声明」**：362 落在**壳区**
     *   （P2 起点 828 之前，没有任何块认领它）⇒ 它既不是 P6 的、也不是 P8/P9 的，
     *   但 **P6/P8/P9 三处都要 `import` 它**（`<script setup>` 里的 `type` 搬不进别的
     *   `.vue`、也 import 不进来）。归属裁决见方案 R35：归**第一个真正需要它的任务**
     *   （Task 5）。
     *
     * ⚠️ **它是「最容易被名单漏掉」的那一类**（`type` 不是函数）—— 与 P7 的
     *   `ExcelJSInterop` 同族。漏登记 ⇒ 本守卫不切它 ⇒ 它留在 `Progress.vue` 里、
     *   **本守卫照样全绿**（memory `split-guard-blind-spots` 第 1 类「登记写错两侧同错」）。
     *
     * ⚠️ 它的改写**只有一条**：`type ProgressRow =` → `export type ProgressRow =`
     *   （`utils/` 是**顶层模块**，不是工厂 ⇒ 照常 `export`；R44 那条「工厂体内不许
     *   `export`」不适用）。`from` 带 ` = ` 而不是裸名 —— 朴素 `split/join`，
     *   裸名的边界不如带 ` = ` 自证。
     *
     * ⚠️ **那 6 行 JSDoc（「页面行 = 后端行 + 勾选态」）跟着类型一起搬走了，本守卫管不到**
     *   （`sliceFn` 从**声明**起切）⇒ 它的保真只有「与 REF 371-376 逐字节 `diff`」一条来源。
     *   本任务做过：`diff <(sed -n '371,376p' REF) <(新文件里同 6 行)` **为空**。
     */
    target: 'app/src/utils/progressRow.ts',
    names: [],
    consts: ['ProgressRow'],
    rewrites: {
      ProgressRow: [{ from: 'type ProgressRow =', to: 'export type ProgressRow =' }],
    },
  },
  {
    /*
     * **P8「查询更多」**（→ `app/src/composables/progress/useProgressQueryMore.ts`）。
     *
     * 快照 `Progress.vue:1418-1598`（**连续一整段**，181 行），段内**16 个声明**：
     *   `moreShow`(1450) · `moreLoading`(1452) · `moreClients`(1454) · `moreRows`(1456) ·
     *   `moreActive`(1465) · `moreForm`(1466) · `dashboardRef`(1473) · `dayStart`(1476) ·
     *   `toIsoDate`(1484) · `MORE_DATE_SHORTCUTS`(1498) · `AUTOCOMPLETE_ALWAYS_SHOW`(1505) ·
     *   `moreClientOptions`(1508) · `openMore`(1516) · `submitMore`(1532) ·
     *   `onSearchInput`(1589) · `onSearchClear`(1594)。
     *   其余 30 来行是段首那行分区横幅（`// ── C1b. 查询更多…`）与它下面 31 行的块注释
     *   （旧版 `Lo`/`Io` 原文 + 两处**有意偏离** + 一处死代码说明 ——
     *   「默认日期按本地时区」「客户候选走 `/v1/clients`」两条的依据全在那里）。
     *
     * ⚠️ **区间两端**（R38 把起点从 1450 更正为 1418，理由就在这）：
     *    1417 是空行、**1418 = 本段自己的横幅** ⇒ **横幅跟块走**（写 1450 会把横幅与那 31 行
     *    承重注释留在壳里当孤儿）；1418-1449 **全是注释、0 个声明**，所以「区间扩大」不影响
     *    声明清单。1598 是空行、1599 起已是**下一段**的 C2 横幅（P7 的第二段）⇒ **留在原地**。
     *    复量：`git show f097a9b1:app/src/views/Progress.vue | sed -n '1415,1419p'` ·
     *          `… | sed -n '1596,1600p'`。
     *    ⚠️ 这条**没有任何闸能抓**（`sliceFn` 从声明起切，横幅/注释根本不进切片）——
     *      它只有「整段与 REF 同区间逐字节比」一条来源。本任务做过：归一化掉工厂那层统一
     *      缩进（+2）后，**剩余差异恰好等于下面这 5 条注入改写、不多不少**（R39 判据）。
     *
     * ⚠️ **工厂式**（`useProgressQueryMore(deps)`）⇒ **一条 `export` 改写都没有**
     *   （函数体内写 `export` 是 `TS1184`），16 个声明里**回传 13 个**、由工厂 `return` 借出。
     *
     * ⚠️ **注入改写 = 5 条规则、命中 9 处**（`searchText.value`×2 · `dashboardShow.value`×1 ·
     *   `message.error(`×2 · `message.success(`×1 · `rows.value`×3）：
     *   · 规则一律**带边界**（核心文件头：朴素 `split/join`，裸名会顺手打到别的标识符上）：
     *     `message` 写成带 `.` 与左括号的 `message.error(` / `message.success(`。
     *   · ⚠️ `rows.value` 与 `moreRows.value` **不构成子串关系**（差在 `Rows` 的**大写 R**，
     *     且 `split/join` 大小写敏感）⇒ 段内那处 `moreRows.value = list`（本块自己的 ref）
     *     不会被这条规则误伤（已核）。**`moreActive.value` 同理不挂规则**（本块自己的 ref）。
     *   · ⚠️ 9 处命中**全部落在活代码里**（逐条核过；段内注释里一处都没有 —— 段内注释里
     *     出现的是旧版标识符 `xo`/`Bo`/`zo`/`K`）⇒ 不存在 P4 那种「规则改到注释里、
     *     注释内容就漂了」的风险。
     *   ⚠️ **`submitMore` 里两条 `message.*` 是分开的两条规则**（success / error 各一处），
     *     不能合并成裸 `message.` —— 那句 `e.message : '查询数据失败'` 里的 `message`
     *     后面跟的是**空格**，裸 `message.` 恰好不会打到它，但带 `success(`/`error(`
     *     才是能自证的那一种，不靠「碰巧」。
     *
     * ⚠️ **回传 13 项**（16 个里真被段外消费的 13 个）：模板 11 个 —— `moreShow`(模板 209/257)
     *   `moreLoading`(258) `moreForm`(223/228/232/236/246) `dashboardRef`(189)
     *   `MORE_DATE_SHORTCUTS`(238/248) `AUTOCOMPLETE_ALWAYS_SHOW`(225) `moreClientOptions`(224)
     *   `openMore`(118/193) `submitMore`(258) `onSearchInput`(142) `onSearchClear`(143)；
     *   脚本 2 个 —— `moreRows` / `moreActive`，**段外引用点两处、分属两个块**：
     *   REF **1061**（`useProgressHeader` 候选集，**P5**）与 REF **1251**
     *   （`filteredRows` 的 `computed` 体第一行，**P6**）。两处源码**逐字同形**
     *   （`moreActive.value ? moreRows.value : rows.value`）⇒ 必须把引用点回落块区间
     *   才知道是**两个**接点，grep 只会说「有 2 处」。
     *   ⚠️ **这一条本守卫管不着** —— 它只比「声明搬得像不像」，「壳有没有漏接」由 `vue-tsc`
     *     （`TS2304`/`TS6133`）管（memory `split-guard-blind-spots` 第 3 类）。
     *   ⚠️ **不回传、也不许解构的 3 个**：`moreClients` `dayStart` `toIsoDate`
     *     （段外脚本 0、模板 0）。**但别把它们从本清单里去掉** —— 它们是本块的内部件
     *     （`moreClientOptions` 读 `moreClients`、`MORE_DATE_SHORTCUTS`/`openMore` 读
     *     `dayStart`、`submitMore` 读 `toIsoDate`），去掉就等于这几段没人验。
     */
    target: 'app/src/composables/progress/useProgressQueryMore.ts',
    names: ['dayStart', 'toIsoDate', 'openMore', 'submitMore', 'onSearchInput', 'onSearchClear'],
    consts: [
      'moreShow', 'moreLoading', 'moreClients', 'moreRows', 'moreActive', 'moreForm', 'dashboardRef',
      'MORE_DATE_SHORTCUTS', 'AUTOCOMPLETE_ALWAYS_SHOW', 'moreClientOptions',
    ],
    rewrites: {
      openMore: [{ from: 'message.error(', to: 'deps.message.error(' }],
      submitMore: [
        { from: 'searchText.value', to: 'deps.searchText.value' },
        { from: 'dashboardShow.value', to: 'deps.dashboardShow.value' },
        { from: 'message.success(', to: 'deps.message.success(' },
        { from: 'message.error(', to: 'deps.message.error(' },
        { from: 'rows.value', to: 'deps.rows.value' },
      ],
      onSearchClear: [{ from: 'searchText.value', to: 'deps.searchText.value' }],
    },
  },
]

/**
 * 摊平一个 block 的 `names` + `consts`（两者都可省 —— 缺了当空数组）。
 *
 * ⚠️ `|| []` **不能省**：漏写一个键时裸的展开会抛 `TypeError: b.consts is not iterable`，
 *    那句话对着清单看不出是哪个 block 缺了什么。主循环与 `allNames()` **共用这一个**。
 */
const blockNames = (b) => [...(b.names || []), ...(b.consts || [])]

/** 反查：这些名字搬走后，`Progress.vue` 里不该再有自己的定义（否则两份实现各自漂移）。 */
const allNames = () => BLOCKS.flatMap(blockNames)

/**
 * 声明探测（反查用）：`src` 里**自己定义**了 `name` 吗。
 *
 * ⚠️ 前缀必须与 `sliceFn` 的取法**逐字对齐**（含 `async` / `type` / `interface`）——
 *    否则「搬走之后旧文件里又长出一份同名 `type`」这类会**静默漏报**。
 *    （核心文件头「起点判据」那一段是同一件事的另一半。）
 */
const declares = (src, name) =>
  new RegExp(
    `^[ \\t]*(?:export\\s+)?(?:async\\s+)?(?:function|const|let|var|type|interface)\\s+${name}\\b`,
    'm',
  ).test(src)

/**
 * `--selftest`：只跑**判定本身**（在**合成夹具**上），不碰 git、不读真代码。
 *
 * ⚠️ **位置不能往后挪** —— 它必须早于本文件里**任何** git 调用（就在下面几十行）。
 *    自测验证的是判定与切片器，不该依赖仓库状态（浅克隆 / detached HEAD 下也要能跑）。
 *
 * ⚠️ 为什么需要它：`BLOCKS` 立骨架时是**空的** ⇒ 主循环一次都不跑 ⇒ 新写的 `compareOne`
 *    在第一条块登记之前**没人验过**。Home 守卫立骨架时正是这么栽的
 *    （清单空着的时候，绿勾什么都不代表）—— 所以这里把「已知输入上会不会红」钉住。
 */
if (process.argv.includes('--selftest')) {
  let bad = 0
  /** 一条断言：`cond` 为假就记红（`detail` 只在红时打出来，说明实得什么）。 */
  const check = (what, cond, detail = '') => {
    if (cond) console.log(`✓ 自测：${what}`)
    else {
      console.log(`✗ 自测失败：${what}${detail ? ` —— ${detail}` : ''}`)
      bad++
    }
  }
  /**
   * ⚠️ 自测里调 `sliceFn` 一律走 `trySlice` —— `sliceFn` 会**抛**
   *    （结构性硬闸：切出来不配平就报错）。裸调会把整段自测崩掉
   *    （栈糊满屏、后面的断言**一条都不跑**），而自测要的是一行干净的 ✗。
   */
  const trySlice = (src, name) => {
    try {
      return { v: sliceFn(src, name) }
    } catch (e) {
      return { e: `${e.constructor.name}: ${e.message.split('\n')[0]}` }
    }
  }
  /** 两次切片 + 首个差异行；切不出来（null 或抛错）时回 `why` 说明。 */
  const sliceDiff = (aSrc, bSrc, name) => {
    const a = trySlice(aSrc, name)
    const b = trySlice(bSrc, name)
    if (a.e || b.e) return { why: a.e || b.e }
    if (a.v == null || b.v == null) return { why: `切不出来（${JSON.stringify(a.v)} / ${JSON.stringify(b.v)}）` }
    return { diff: firstDiffLine(norm(a.v), norm(b.v)), text: a.v, textB: b.v }
  }

  /*
   * ① 比对核心：一对**已知故意改坏**的样本，必须报红且**定位到正确的行**。
   *    这是先例的教训（`docs/2026-09-18-detail-table-extraction.md` §5.3）：守卫自身的洞
   *    不会被它自己发现 —— 所以这里不测「真代码」，测「判定在已知输入上是否会红」。
   */
  const oldTxt = `function f(a: number) {\n  const n = Math.round(a * 1.13)\n  return n ?? 0\n}`
  const diffCases = [
    ['Math.round → Math.floor', `function f(a: number) {\n  const n = Math.floor(a * 1.13)\n  return n ?? 0\n}`, 2],
    ['丢掉 ?? 0', `function f(a: number) {\n  const n = Math.round(a * 1.13)\n  return n\n}`, 3],
    ['未改坏（应判为一致）', oldTxt, 0],
  ]
  for (const [what, newTxt, expectDiffLine] of diffCases) {
    const diff = firstDiffLine(norm(oldTxt), norm(newTxt))
    check(diff === expectDiffLine ? `${what} → 第 ${diff} 行` : what, diff === expectDiffLine,
      `期望首个差异在第 ${expectDiffLine} 行，实得 ${diff}`)
  }

  /*
   * ② 把上面三条**接到 `sliceFn` 上**跑一遍（不是只比两段常量）。
   *
   * ⚠️ 这一组是本文件的**核心断言**：P1 里 20/23 个声明都是
   *    `const NAME = (r: ProgressRowDto) =>` 这种**两行以上的表达式体箭头**，
   *    而这一族**正是历史上被「单行声明」快车道静默切短的那一族**（核心文件头「历史假绿」：
   *    Hui 侧 4 个名字因此只比了第一行）。只钉「两段常量比一比」是**看不见那个洞的** ——
   *    洞长在 `sliceFn` 里。所以样本**故意做成 P1 的形状**（箭头 + 多行 + 第二行才有内容），
   *    并断言切片**至少 3 行**且**第二行被改也报红**。
   */
  // 改的是**第 2 行**（`gContainer` → `gContainer2`，P1 里真有这一对同名兄弟）
  const arrowCell = (wrap) =>
    ['const cellX = (r: RowDto) =>', `  ${wrap}(`, '    gSpan(r.amount),', '  )'].join('\n')
  const acR = sliceDiff(arrowCell('gContainer'), arrowCell('gContainer2'), 'cellX')
  const acGot = acR.text ?? null
  check(
    '表达式体箭头（`const X = (r) =>` 多行）**改第 2 行** → 报红且定位到第 2 行',
    acR.diff === 2 && acGot != null && acGot.split('\n').length === 4,
    acR.why
      ? `切不出来：${acR.why}`
      : `切片 ${acGot?.split('\n').length} 行（应 4）、首个差异在第 ${acR.diff ?? -1} 行（应 2；0 = 快车道只切了首行 ⇒ 假绿复发）`,
  )

  /*
   * ③ P1 特有的形状：**正则字面量里的花括号**。
   *
   * `DATE_RE = /\d{4}-\d{2}-\d{2}/` 的三对 `{` `}` 会被括号扫描器当成代码括号计数
   * （`skipInert` 不认正则）。本例钉住「收支正好配平 ⇒ 切出来是对的」这条现状。
   * ⚠️ 核心文件头明确：**只有「收支变负」的那一半会被硬闸拦下**，写成 `/}/` 那种
   *    「提前收口且配平」的**不报**。所以这条自测证明的是**这一个形状**切得对，
   *    不是「正则都安全」—— 换个写法仍要单独钉。
   */
  const reSrc = 'const DATE_RE = /\\d{4}-\\d{2}-\\d{2}/'
  const reR = trySlice(reSrc, 'DATE_RE')
  check('正则字面量里的 `{}` 不把单行声明切歪', reR.v === reSrc, reR.e || `实得 ${JSON.stringify(reR.v)}`)
  // 同一个正则出现在**跨行声明内部**：函数体配对时也不能被那三对 `{}` 骗走。
  const reBody = (tail) =>
    ['const f = (s: string) => {', '  const m = s.match(/\\d{4}-\\d{2}-\\d{2}/)', `  return m ? '${tail}' : null`, '}'].join('\n')
  const rbR = sliceDiff(reBody('a'), reBody('b'), 'f')
  check(
    '跨行声明**内部**的正则 `{}` 不骗走函数体配对',
    rbR.diff === 3 && rbR.text != null && rbR.text.split('\n').length === 4,
    rbR.why ? `切不出来：${rbR.why}` : `切片 ${rbR.text?.split('\n').length} 行（应 4）、首个差异第 ${rbR.diff ?? -1} 行（应 3）`,
  )

  /*
   * ④ 登记的改写：**只加 `export`** 这一条是本清单（P1）唯一允许的改写类型。
   *    这一例钉住「改写生效」与「改写写错会抛」（`applyRewrites` 找不到 `from` 即抛）。
   */
  const REF_ONE = 'const gSpan = (v: unknown) => h(\'span\', null, v == null ? \'\' : String(v))'
  const NEW_ONE = "export const gSpan = (v: unknown) => h('span', null, v == null ? '' : String(v))"
  const RULE = { gSpan: [{ from: 'const gSpan = ', to: 'export const gSpan = ' }] }
  check('只加 `export` 的改写 ⇒ 判绿', applyRewrites('gSpan', norm(REF_ONE), RULE) === norm(NEW_ONE))
  let threw = null
  try {
    applyRewrites('gSpan', norm(REF_ONE), { gSpan: [{ from: '不存在的片段', to: 'x' }] })
  } catch (e) {
    threw = e.message
  }
  check('登记的 `from` 找不到 ⇒ **抛错**（白送的检查）', !!threw, '不抛的话，写错的规则会静默失效')

  /*
   * ⑤ 反查正则（`declares`）：认得出 `async function`，且**不把调用当定义**。
   *    立骨架时「漏 `async`」这个 bug 是 Home 侧**手工端到端跑**才发现的 —— 那里补了断言，
   *    这里照抄（同一判据两份实现会各自漂开，断言也要成对）。
   */
  check('反查认得 `async function`', declares('export async function load() {\n  return 1\n}', 'load'))
  check('反查不把普通调用当定义', !declares('void load()\nload()\n', 'load'))

  /*
   * ⑥ `names` / `consts` 都可省 —— 缺键**不能抛** `TypeError`。
   *    它同时也是「`BLOCKS` 为空也能跑」那条路的守卫（空清单 ⇒ 摊平 0 条 ⇒ 收尾打「0 条」）。
   */
  const flatOf = (b) => {
    try {
      return { v: blockNames(b) }
    } catch (e) {
      return { e: `${e.constructor.name}: ${e.message}` }
    }
  }
  const namesOnly = flatOf({ names: ['a', 'b'] })
  check('只写 `names`、不写 `consts` 不抛', !!namesOnly.v && namesOnly.v.join(',') === 'a,b', namesOnly.e || JSON.stringify(namesOnly.v))
  const bothAbsent = flatOf({})
  check('`names`/`consts` 都不写 = 空数组', !!bothAbsent.v && bothAbsent.v.length === 0, bothAbsent.e || JSON.stringify(bothAbsent.v))
  /*
   * ⚠️ 这一条**原来写的是** `allNames().length === 0`（立骨架、`BLOCKS` 还空着时）。
   *    P1 一登记进来它**必然红** —— 因为它断的是「清单现在有几条」（一个会随登记漂移的事实），
   *    不是「摊平的机制对不对」。这正是本项目反复栽的那一族：**断言写成了对当前状态的快照**。
   *    改成在**合成清单**上钉机制（含一个故意缺 `names`/`consts` 的 block）——
   *    它此后不会再因为「又加了一块」而红。
   *    ⚠️ 空清单那条路（收尾打「0 条」）仍由 `total === 0` 那个分支守着，
   *      而 `total` 是从真清单算出来的 —— 别为了「让它能被自测」去改那个分支。
   */
  const twoBlocks = [{ names: ['a'], consts: ['b'] }, {}]
  check(
    '多 block 摊平（含缺键的那个 block）',
    twoBlocks.flatMap(blockNames).join(',') === 'a,b',
    `实得 ${JSON.stringify(twoBlocks.flatMap(blockNames))}`,
  )
  check('真清单摊平后条数与逐块数出来的一致', allNames().length === BLOCKS.reduce((n, b) => n + blockNames(b).length, 0), `实得 ${allNames().length}`)

  /*
   * ⑦ **盲区断言（有意让它绿）** —— 文件头「能力边界 2」的可执行证据。
   *
   * `applyRewrites` 只改**参照侧**：登记里写什么，参照侧就变成什么。所以**只要新侧与那条
   * 规则的输出字面一致，本脚本就报绿** —— 哪怕规则本身是错的。
   * （Home 侧 B4 真栽过：把该块自己拥有的三个 ref 也登记成注入项 ⇒ 新文件 8 处 `TS2339`，
   *  而守卫**全绿**。）⇒ 抓这一类的是 `vue-tsc` / `npm run build`，两者必须成对跑。
   */
  const absurd = applyRewrites('gSpan', norm(REF_ONE), { gSpan: [{ from: 'const gSpan = ', to: 'NOTHING.' }] })
  check(
    '盲区：登记写成荒谬的 `to`，只要新侧与之字面一致 ⇒ **照样判绿**（抓它的是 vue-tsc）',
    absurd === 'NOTHING.(v: unknown) => h(\'span\', null, v == null ? \'\' : String(v))',
    JSON.stringify(absurd),
  )

  console.log(bad ? `\n✗ 自测 ${bad} 条失败` : '\n✓ 自测全部通过（判定与切片器的已知输入）')
  process.exit(bad ? 1 : 0)
}

/**
 * ⚠️ 参照**先取一次、且必须取到** —— 放在 block 循环**外面**是有意的：
 * `BLOCKS` 为空时循环体一次都不跑，若把 `git show` 写在循环里，`BLOCKS = []` 会让
 * 脚本**根本不碰 git** ⇒ 参照取不到也退 0（「未运行 ≠ 通过」的反面）。所以无条件先取：
 * 取不到就 fail-loud。
 * （简报 `task-1-brief.md` Step 1 那句「`git show` 的取值必须在用到时才做，别写在模块顶层」
 *   —— 见报告「与简报的偏离 2」：自测**确实**在最前面、早于这次取值，所以「`--selftest`
 *   不碰 git」成立；而这里保持**无条件**取，是为了不把「参照取不到」变成一句空转的绿。）
 *
 * ⚠️ 用 `execFileSync`（**不经 shell**）：`REF` 可以是命令行参数，走 shell 拼串既怕空格也怕注入
 * —— 与 Home / Hui 两台守卫同一口径。
 */
let refSrc
try {
  refSrc = execFileSync('git', ['-C', ROOT, 'show', `${REF}:${OLD_PATH}`], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    // stderr 也收进来（否则 git 会往终端直接喷一行 fatal，下面又打一遍 —— 重复且刺眼）
    stdio: ['ignore', 'pipe', 'pipe'],
  })
} catch (e) {
  console.error(`✗ 参照提交 ${REF} 取不到（${OLD_PATH}）—— 浅克隆？见 .github/workflows/ci.yml 的 fetch-depth: 0`)
  const why = String(e.stderr || e.message || '').trim().split('\n')[0]
  if (why) console.error(`  git 说：${why}`)
  process.exit(1)
}

/**
 * 比对**一条**。返回 `null` = 逐字一致；否则返回 `{ text, line?, missing? }`。
 *
 * ⚠️ 主循环与 `--selftest` **共用这一个** —— 分开写的话，自测验的就不是主循环真正跑的那段
 *    代码，等于没测（Home 版立的规矩，照抄）。
 * ⚠️ `sliceFn`（切片不配平 ⇒ 结构性硬闸）与 `applyRewrites`（登记的 `from` 找不到）
 *    **都会抛** —— 由调用侧接住转成一条计入 `fail` 的错误，别让整个脚本崩掉
 *    （那样后面的名字一条都不查）。
 */
function compareOne({ refSrc, newSrc, name, rules, ref, target }) {
  const o = sliceFn(refSrc, name)
  if (!o) return { text: `${name}: 在 ${ref}:${OLD_PATH} 里找不到（清单写错了？）` }
  const n = sliceFn(newSrc, name)
  if (!n) return { text: `${name}: ${target} 里找不到 —— 没搬过去？`, missing: true }
  // ⚠️ 顺序：**先归一化再套改写规则**。`norm()` 去了行首缩进，多行的 `from` 片段匹配不上
  //    ⇒ 规则里的 `from` 要写成**归一化后**的样子。
  const a = applyRewrites(name, norm(o), rules)
  const b = norm(n)
  const line = firstDiffLine(a, b)
  if (line === 0) return null
  const A = a.split('\n')
  const B = b.split('\n')
  const diffs = []
  for (let i = line - 1; i < Math.max(A.length, B.length) && diffs.length < 6; i++) {
    if (A[i] !== B[i]) {
      diffs.push(`    L${i + 1}\n      旧: ${String(A[i]).slice(0, 150)}\n      新: ${String(B[i]).slice(0, 150)}`)
    }
  }
  return { line, text: `${name}: 归一化后仍不一致（旧 ${A.length} 行 / 新 ${B.length} 行）\n${diffs.join('\n')}` }
}

let pass = 0
const fail = []
const missing = []

for (const b of BLOCKS) {
  const target = `${ROOT}/${b.target}`
  const rules = b.rewrites || {}
  let newSrc
  try {
    newSrc = readFileSync(target, 'utf8')
  } catch (e) {
    fail.push(`块「${b.target}」读不到 —— ${e.message}`)
    continue
  }
  for (const name of blockNames(b)) {
    let r
    try {
      r = compareOne({ refSrc, newSrc, name, rules, ref: REF, target: b.target })
    } catch (e) {
      // `sliceFn` 抛（切片不配平）或 `applyRewrites` 抛（登记的 `from` 找不到）——
      // 转成一条**计入 fail** 的错误：让它抛出去的话整个脚本崩掉、后面的名字一条都不查，
      // 而这条信息本身（哪个名字、为什么）是有用的。
      fail.push(`${name}: ${e.message}`)
      continue
    }
    if (r == null) { pass++; continue }
    if (r.missing) missing.push(name)
    fail.push(r.text)
  }
}

/**
 * 反向检查：搬走的定义不该在 `Progress.vue` 里留下第二份（否则两份实现会各自漂移）。
 * ⚠️ 做成**失败**而不是警告（与 Home 版一致）：清单里写「搬走了」= 同一笔里必须删干净，
 *    留着就是「改了一处忘了另一处」—— 那种不一致是 bug，不是提示。
 */
const after = readFileSync(`${ROOT}/${OLD_PATH}`, 'utf8')
const dupe = allNames().filter((n) => declares(after, n))

console.log(`搬迁保真检查（${REF}:${OLD_PATH} → ${BLOCKS.length} 个目标文件）`)
console.log(`  逐字一致：${pass} 个`)
if (missing.length) console.log(`  未搬走：${missing.length} 个`)
if (dupe.length) console.log(`  ⚠️ Progress.vue 里仍有同名定义（应已删除）：${dupe.join(', ')}`)
if (fail.length) {
  console.log(`\n✗ ${fail.length} 处不符：`)
  fail.forEach((f) => console.log('  - ' + f))
  process.exit(1)
}
if (dupe.length) {
  console.log('\n✗ 清单里已声明搬走、Progress.vue 里却仍有同名定义（两份实现会各自漂移）：')
  dupe.forEach((n) => console.log('  - ' + n))
  process.exit(1)
}
/*
 * 收尾那一行**只有一行、且必须是最后一行** —— `run-all.mjs` 的汇总只取 stdout 的**最后一行
 * 非空行**当说明文字。拆成两行的话，被显示出来的是后一行，前面那半读数就看不着了。
 *
 * ⚠️ **条数用 `total`（清单声明了多少条），不是 `pass`**：走到这里时 `pass === total` 恒成立，
 *    但**空转**看的是「清单里有没有东西」，与「比过几条」是两回事。
 * ⚠️ `total === 0` 时**也要把「0 条」写进这一行**（而不是删掉不提，也不能打绿勾）：
 *    清单空着 ⇒ 这一块什么都没验；不写出来的话会被读成「Progress 也验过了」——
 *    那正是 `run-all.mjs` 文件头禁止的「分不出『查了 0 个名字』和『全一致』」。
 *    注意它**仍然退 0**：清单还空着不是被检代码的失败，不该把整套 verify 弄红。
 */
const total = BLOCKS.reduce((n, b) => n + blockNames(b).length, 0)
if (total === 0) {
  console.log('\n⚠️ 清单内 **0 条** —— 守卫此刻**空转**，未保护任何代码（往 BLOCKS 里加条目才有用，见文件头「怎么登记一条块」）。')
} else {
  console.log(`\n✓ 清单内 ${pass} 条全部一致 —— 搬迁未改动任何逻辑`)
}
