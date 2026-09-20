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
