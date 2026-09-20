/*
 * 「搬迁保真」检查（Home 版）—— 证明 Home.vue 里的代码搬到新文件时**逐字未改**。
 *
 * 为什么要这个：本项目栽过「手抄旧版源码导致转写错误」（见 00-summary 末尾）。
 * 把上千行从一个文件搬到另一个文件，风险与手抄同类 —— 而 `npm run build` 绿**证明不了**
 * 语义没变（少一个 `?? 0`、`Math.max` 写成 `Math.min` 都照样过编译）。
 * 所以这里拿 `git show <ref>:app/src/views/Home.vue` 的**搬迁前**原文，
 * 与新文件里的同名函数逐字比。
 *
 * 比的是**函数体归一化后的文本**：
 *   · 去掉每行行首缩进（搬进 utils/ 或 composables/ 后整体会多缩进）
 *   · 折叠行尾空白
 *   · 丢空行
 *   · `//` 注释**保留**（注释也是文档，改了要看得见）
 *
 * 用法：
 *   node docs/home-audit/home-extract-movecheck.mjs            # 与默认参照比
 *   node docs/home-audit/home-extract-movecheck.mjs <ref>      # 与指定 ref 比
 *   node docs/home-audit/home-extract-movecheck.mjs --selftest # 只跑自测（不碰 git）
 *
 * ⚠️ **能力边界（别把它当成「全都验过了」）**：
 *   它只验 `BLOCKS` 清单里**点名过的那些名字**。清单里没有的东西 —— 不管是没搬的、
 *   还是搬了却忘了登记 —— 它**完全不知道**。所以「本脚本绿」只等于「清单内逐字一致」，
 *   不等于「搬迁完整」。清单本身由人来维护，每搬一块加一条。
 *
 * ⚠️⚠️ **「清单内逐字一致」还要再加一句**：比的是 `sliceFn` **切出来的那一段**，
 *   不是整个声明。切片器多认一种形状，原来那些"空绿"才会变成真绿 ——
 *   2026-09-20 就有**实证**：Hui 侧 4 个已登记的名字（`sqCell`/`cCol`/`sub`/`orderNoCell`）
 *   当时只切到第一行，函数体一行都没比，而脚本照样报「逐字一致」。
 *   ⇒ **登记前按下面「验法」自己变异一次**，别只看绿勾。
 *
 * ⚠️ **`sliceFn` 会抛**（2026-09-20 加的结构性硬闸）：切出来的一段如果**括号不配平**
 *   （跳过字符串与注释后），它会抛错而不是返回一段可疑文本。理由与处理见
 *   `lib/extract-movecheck-core.mjs` 文件头的「结构性硬闸」。主循环把它转成一条
 *   计入 `fail` 的错误（不这样就会整个脚本崩掉、后面的名字一条都不查）。
 *
 * ⚠️ **声明的改写**（每个 block 的 `rewrites`）只有列出来的那些，多一处都要报错：
 *   出现「未声明的差异」= 搬迁过程中动了逻辑，必须回查。
 *   反过来它**抓不到「漏了一条改写」** —— 那只会表现成 diff（这是有意的：宁可多报）。
 *
 * 姊妹件：`docs/home-audit/hui-extract-movecheck.mjs`（Hui.vue 那一版）。
 *
 * 比对**核心**（`sliceFn` / `norm` / `applyRewrites` / `firstDiffLine`）现在**只有一份实现**，
 * 在 `lib/extract-movecheck-core.mjs`（2026-09-20 Task 3.5 抽的）。
 * 在此之前两边各存一份逐字相同的副本、靠「改一份必须同步另一份」的自觉维持 ——
 * Task 3 撞出了那个死结：Home 侧的 `sliceFn` 实测有洞，而**修它就得动两份**，
 * 于是「改一份」与「别碰另一份」互相矛盾。抽成共用件正是解那个死结。
 *
 * 留在这边的只有**搬迁清单**与**判定/输出文案** —— 两版的形状本来就不同
 * （这边是多目标 manifest、规则按 block 传；那边是模块级 `MOVED` / `REWRITES`），
 * 硬合并只会让两边都变难懂。
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { applyRewrites, firstDiffLine, norm, sliceFn } from './lib/extract-movecheck-core.mjs'

// 仓库根从**本文件位置**推出（本文件在 `docs/home-audit/` ⇒ 往上**两级**才是仓库根）。
// 别写死 `/Users/aaa/Desktop/door-main`：本机跑得通，换台机器或进 CI（checkout 路径不同）就崩。
const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')

/**
 * ⚠️ 参照**必须钉在本次拆分之前的那个提交**（`28e36d21`，Home 拆分动工前）。
 * 不能用 `HEAD` —— 拆分提交一落，HEAD 就是「搬完」的状态，Home.vue 里那些函数已经被删了，
 * 全部会报「HEAD 里找不到」。`--selftest` 分支里给的 `'HEAD'` 只是兜底占位，自测本身不碰 git。
 */
const REF = process.argv[2] || (process.argv.includes('--selftest') ? 'HEAD' : '28e36d21')
const OLD_PATH = 'app/src/views/Home.vue'

/**
 * 本次拆分的搬迁清单。**每搬完一块就在这里加一条** —— 守卫只验清单里的东西，
 * 清单外的东西它不知道（这是它的能力边界，写在这里免得被当成「全都验过了」）。
 *
 * 一条的形状：
 *   { target: 'app/src/utils/xxx.ts',   // 相对仓库根；有多个目标就写多条 block
 *     names:  ['foo', 'bar'],           // function foo() {} / 箭头函数都算
 *     consts: ['BAZ'],                  // const BAZ = ... / type BAZ = ...（含 computed / ref）
 *     rewrites: { foo: [{ from: '…', to: '…' }] } }  // 声明的改写，可省
 *
 * ⚠️ **清单是空的那些日子**（2026-09-20 立骨架时）本脚本对真代码**没有任何检验力**
 * （它只证明「跑得起来」）。Task 2 加了第一条（B2 → `utils/homeMetrics.ts`，纯函数样板），
 * Task 3 加了第二条（B10 → `composables/home/useHomeSelection.ts`，**composable 样板**：
 * 注入响应式依赖 + 回传状态）。后两条是后面各块的样板，改它们等于改一整片。
 *
 * ⚠️⚠️ **登记新名字前先验「切片切得完整」** —— 本脚本的绿只等于「切出来的那一段逐字一致」，
 * **不等于「整个声明都对过」**。切片器是文本启发式，**不是解析器**，
 * 所以它每多认一种形状都得单独钉一例自测（`--selftest` 现在 **36** 条：其中 9 条是
 * 2026-09-20 为「声明跨行」这一族补的，7 条是 Task 3.6 补的 —— 洞④ 5 条 + 快车道 `<= 0`
 * 1 条 + 联合类型夹注释 1 条，**3 条是 Task 3.7 补的** —— 快车道看下一行行首 2 条（`.`
 * 与 `?` 各一）+ 行尾续行记号含 `<` 1 条，**4 条是 Task 3.8 补的** —— 行首续行记号
 * 含 `>`（㉑）+ 联合类型夹 `/** *\/` 注释（㉒）+ 行首续行记号含 `&`（㉓）+ 跳过空行（㉔））。
 * ⚠️ 这个数字**此前写着 21，而实际是 22**（⑭ 那条加进来时没跟着改）—— 现已按实测改。
 * ⚠️ **数字只为「看得出它长过」**，别拿它当覆盖率：`--selftest` 只证明「定义好的输入上会红」，
 *    它**不扫真代码**。要扫真代码用 `docs/home-audit/decl-sweep.mjs`（那台才是硬闸）。
 *
 * **验法**（别只看绿勾）：把该声明的**第二行**随便改一下 → 跑本脚本 → **必须报红**；
 * 不红就别登记（登记了等于给自己发一张假绿卡）。改完**还原**。
 *
 * ⚠️ **最可靠的独立判据是真 TS 解析器**（`app/node_modules/typescript` 就在仓库里）：
 * `ts.createSourceFile` + 递归遍历整棵树取同名声明的 `getText()`，与 `sliceFn` 的结果
 * 都过一遍 `norm()` 再比。2026-09-20 用它复核了双方清单里的**每一个**名字，
 * **查出 4 个已登记的名字此前是假绿**（见下）。这就是「守卫自己的绿证明不了切片完整」的实证。
 *
 * ⚠️ 那套判据**已经从「一次性脚本」落成常驻仪器**：`docs/home-audit/decl-sweep.mjs`
 *    （2026-09-20 Task 3.7 建，全 `app/src` 154 文件 / 4434 个声明 / 三方对照）。
 *    用法：`node docs/home-audit/decl-sweep.mjs [--check] [--against <git-ref>]` ——
 *    `--check` 把「解析器切得全、`sliceFn` 切短」变成**硬闸**（exit 1）；
 *    `--against <sha>` 打「旧核 vs 新核」方向表（`旧对新错` **必须是 0**）。
 *    **改 `lib/` 里的核心之后跑它** —— 本脚本与姊妹件都只验清单内的名字，看不见这一类。
 *
 * ### 已知残留（切片器还没认的形状，别登记这些）
 *
 * 见 `lib/extract-movecheck-core.mjs` 文件头「能力边界」。当前最要紧的一条：
 * **正则字面量里的括号**（`const re = /}/` 这种）不进括号栈 ⇒ 函数体会**提前收口**，
 * 而且收口后的片段**是配平的**（所以结构性硬闸也拦不住）。本仓库暂无这种形状被登记。
 * ⚠️ **同一族里只有一半会被硬闸拦下**：`/)/` 让收支变负 ⇒ 硬闸响亮报错；
 *    `/}/` 提前收口且**配平** ⇒ 硬闸**不报**（静默切短）。别把这条概括成「硬闸会挡住正则」。
 *
 * **第二条残留（2026-09-20 Task 3.6 已修，记在这里是为了别再踩）**：
 * **泛型实参里的类型字面量**（`reactive<{ … }` / `ref<{ … } | null>` / `defineProps<{ … }>()`
 * 这类**多行**类型字面量）修前会被那个 `{` 骗成函数体 ⇒ **初值整段被丢掉**，而且切出来那段
 * **配平** ⇒ 硬闸也拦不住。受害真形状四处：Home `queryForm`(REF:1237–1243)、
 * `financeOrder`(1388–1394)、`DetailLinesTable.vue` 的 `props`(68–112)、`emit`(114–119)。
 * ⚠️ 但**四处里今天只有 `queryForm` 会被真绿卡盖住**（它就列在 `task-8-brief.md` 的 `consts` 里）；
 *    `props`/`emit` 虽在 Hui 守卫的目标文件里却**没被登记**（今天不构成假绿，登记那一刻才会），
 *    `financeOrder` 不属任何块。本洞的性质是「**发绿卡的那台机器会把这一类全盖成绿的**」。
 * 修法与判据见核心文件头「路 2」第 4 条；`--selftest` ⑮ 有 5 条断言钉住它。
 *
 * ⚠️⚠️ **「受害四处」是低报 —— 四处只是「需要立刻保护的那四个」**（2026-09-20 Task 3.7
 *    按 `decl-sweep.mjs` 实测改准）。上一版这里把同族的 `const x = {` + 换行与 `type X = {`
 *    写成**「等价」**（「修前走函数体、修后走语句末，实测切出同一段」）—— **那句话是错的**。
 *    实测（旧核 = `bc8d5855` 的 `lib/extract-movecheck-core.mjs`，新核 = `970369c3`，
 *    全 `app/src` 154 文件 / 3645 个非重名声明，脚本 `/tmp/t37/class.mjs`）：
 *    **旧错 → 新对 70 条**，按首行形状分四类 ——
 *      · **42** `const props = defineProps<{` / `const emit = defineEmits<{`（`>()` 被丢）
 *      · **24** `const X = {` / `type X = {` + 换行（**就是被写成「等价」的那一族**）
 *      · **3**  `reactive<{…}>({…})` / `ref<{…} | null>(null)`（`queryForm` / `financeOrder` / `moreForm`）
 *      · **1**  `const HEADER_ROWS: {…}[] = [ … ]`（`Receipt2SettingsDialog.vue:277`，**整段数组初值被丢**，4 行 → 8 行）
 *    **触发条件**：多行字面量收尾的 `}` **同一行后面还有文本**（` as const` / ` as const satisfies …`
 *    / ` & B`）时，旧核切到 `}` 就返回、新核切全；只有收尾 `}` 恰好就是声明末尾时两侧才逐字相同。
 *    反例（4/4 不等价，**行数一模一样、只有内容能区分** —— 别用行数证明这件事）：
 *    `printService.ts::HiprintModule`（丢 ` & Partial<HiprintCtor>`）·
 *    `docsheet/defaults.ts::PAPER_UI_RANGES` · `receipt2/defaults.ts::FONT_RANGES` ·
 *    `productionsheet/profile.ts::PS_CLASSES`（三个都丢 ` as const …`）。
 *    ⇒ **这 70 处是 Task 3.6 修好的**，不是「没变化」；`decl-sweep.mjs --against <改前 sha>`
 *    随时可复跑这张方向表。
 *
 * **第三条残留（2026-09-20 Task 3.7 才修）：路 1（快车道）不看下一行行首** —— 详见 §9h。
 */
const BLOCKS = [
  {
    target: 'app/src/utils/homeMetrics.ts',
    names: ['paymentStatus', 'progressMatch', 'paidOf', 'dateCellClass', 'isUnaudited'],
    consts: ['fmt', 'unpaidOf'],
    rewrites: {
      // ① 搬到模块级并导出（新文件里每个声明都加 `export`）。
      fmt: [{ from: 'const fmt = ', to: 'export const fmt = ' }],
      // ② 读 `financeSummary.value` 的两处 → 形参 `fin`（unpaidOf / paidOf 各一处）。
      unpaidOf: [
        { from: 'const unpaidOf = (r: OrderSummaryDto) => {', to: 'export const unpaidOf = (r: OrderSummaryDto, fin: Record<string, OrderFinance>) => {' },
        { from: 'const s = financeSummary.value[r.id]', to: 'const s = fin[r.id]' },
      ],
      paidOf: [
        { from: 'function paidOf(r: OrderSummaryDto): number {', to: 'export function paidOf(r: OrderSummaryDto, fin: Record<string, OrderFinance>): number {' },
        { from: 'const s = financeSummary.value[r.id]', to: 'const s = fin[r.id]' },
      ],
      // ③ 两个下游函数的签名加形参 + 内部调用点跟着改（同一名字的多条规则写在同一个数组里）。
      paymentStatus: [
        { from: 'function paymentStatus(r: OrderSummaryDto): string {', to: 'export function paymentStatus(r: OrderSummaryDto, fin: Record<string, OrderFinance>): string {' },
        { from: 'const unpaid = unpaidOf(r)', to: 'const unpaid = unpaidOf(r, fin)' },
      ],
      dateCellClass: [
        { from: 'function dateCellClass(r: OrderSummaryDto): string {', to: 'export function dateCellClass(r: OrderSummaryDto, fin: Record<string, OrderFinance>): string {' },
        { from: 'if (!due || unpaidOf(r) === 0) return', to: 'if (!due || unpaidOf(r, fin) === 0) return' },
      ],
      // ④ 只加 `export`、签名一字未动的那两个。
      progressMatch: [{ from: 'function progressMatch(', to: 'export function progressMatch(' }],
      isUnaudited: [{ from: 'function isUnaudited(', to: 'export function isUnaudited(' }],
    },
  },
  {
    target: 'app/src/composables/home/useHomeSelection.ts',
    names: ['onCheckedKeys', 'deleteSelected', 'clearAccounts', 'combineSelected'],
    consts: ['checkedRowKeys', 'selectAllMode'],
    rewrites: {
      /*
       * B10（删除选中 / 清账 / 合并订单）。**本块没有 `export` 改写** ——
       * 6 个声明都由工厂 `return` 借出，不做模块级导出（与 B2 那套不同）。
       *
       * 下面是「闭包名 → `deps.名`」的**全量**清单。两件事必须同时成立：
       *   · 每条 `from` 都得在该函数的旧文里找得到（找不到 `applyRewrites` 会抛 —— 这是白送的检查）；
       *   · **不能漏**（漏了不抛，只表现成 diff）⇒ 改完必须**逐行看 diff**，不能只看退出码。
       *
       * ⚠️ 规则一律**带边界**（写 `dialog.warning({` 而不是 `dialog`）：`applyRewrites` 是朴素
       *    split/join，裸名会把别的标识符一起改坏（例：写 `load` 会顺手打到 `loadedIds` 上）。
       *    本块的 `message.` 只锚了右边 —— 左锚写不出（`norm()` 去了行首空白，多行/带缩进的
       *    `from` 匹配不上），所以**另行核对过**：本块内不存在 `.message.` 这种「属性名恰好叫
       *    `message`、后面还跟一个点」的序列 ⇒ 不会把 `(e as Error).message` 改坏
       *    （改完实测全文 `.deps` 出现 0 次）。
       *
       * ⚠️ `clearAccounts` 的第一条**不是注入改写**，是 B2 那一刀留下的**调用点变化**：
       *    参照提交里 `unpaidOf` 自己读 `financeSummary`，抽进 `utils/homeMetrics.ts` 后改成
       *    显式传参（`unpaidOf(r, financeSummary.value)`）⇒ 这条的 `from` 得写**抽取前**的样子。
       *    换句话说 `rewrites` 记的是「相对参照提交的全部文本差异」，不只是「注入面」。
       */
      /*
       * ⚠️⚠️ **这条曾经是空的，而且是被迫空的 —— 记住这段历史，别再退回那个状态。**
       *
       * `onCheckedKeys`(REF:1601) 的**参数表跨行**。旧的 `sliceFn` 找函数体 `{` 的循环末尾
       * 有一句「遇到换行就 break」，参数表一换行就永远找不到体 ⇒ 退化成「按行切」，
       * **只返回 `function onCheckedKeys(` 这一行，函数体一行都不比**。
       * 后果有两层：① 往里写任何 `from` 都会抛「声明的改写失效」；
       *            ② 更危险的是**它不抛也不报** —— 本来就没在比，看起来却是绿的。
       * （Task 3 当时判定「本脚本保证不了这个名字」，只做了**手工**切段比对。）
       *
       * **2026-09-20 Task 3.5 修好了根因**：`sliceFn` 移进 `lib/extract-movecheck-core.mjs`
       * 并重写为「只在**括号栈空**时遇换行才停」，参数表跨行不再挡路。修好后这个名字
       * **第一次被真正比对**，当场报出一处此前看不见的真差异（就是下面那条规则）。
       *
       * 全 `Home.vue` 里参数表跨行的**函数声明**只有 3 个：`onCheckedKeys`(REF:1601)、
       * `renderEditable`(REF:2807)、`headerFilter`(REF:2866) —— 后两个属 B12。
       * 它们现在**同样**受加固后的 `sliceFn` 保护（不必再手工复核）。
       *
       * ⚠️ **这个数字是 3，不是 4**（2026-09-20 复核过一次，两个数都量了）：
       *    量法 = 对每个 `function NAME(` 从 `(` 配平找 `)`，看它是否跨行。
       *    有人把 `open`(REF:1500) 也算进来 —— **它不算**：它是 `onOpenDoc`(REF:1496)
       *    **函数体内的局部箭头函数**，既不是 `function` 声明、也不是顶层。
       *    它单切能得 7 行只是巧合（顶层扫描第一个撞到的同名声明就是它那个 `const`）。
       *    **嵌套件靠外层声明的整段比对覆盖，不需要也不该单独登记**（核心文件头「能力边界」有）。
       *    当前 `onOpenDoc` **不在**清单里，所以 `open` 现在**没被任何东西保护** ——
       *    等搬到它所属的那一块时登记 `onOpenDoc` 即可。
       *
       * ⚠️ 下面这条规则是**修好根因之后按报出的 diff 补的**，不是为了让守卫变绿而删名字 ——
       *    「把它从 BLOCKS 里删掉」是本仓库 CLAUDE.md 明令禁止的那种改法。
       *    边界已核对：本函数旧文里 `filtered.value` **只出现 1 次**（L10），
       *    不存在 `xfiltered.value` 这种会被朴素 split/join 误伤的前缀。
       */
      onCheckedKeys: [{ from: 'filtered.value', to: 'deps.filtered.value' }],
      deleteSelected: [
        { from: 'rawOrders.value.', to: 'deps.rawOrders.value.' },
        { from: 'await load()', to: 'await deps.load()' },
        { from: 'message.', to: 'deps.message.' },
        { from: 'dialog.warning({', to: 'deps.dialog.warning({' },
      ],
      clearAccounts: [
        { from: 'unpaidOf(r)', to: 'unpaidOf(r, deps.financeSummary.value)' },
        { from: 'rawOrders.value.', to: 'deps.rawOrders.value.' },
        { from: 'await load()', to: 'await deps.load()' },
        { from: 'message.', to: 'deps.message.' },
        { from: 'dialog.warning({', to: 'deps.dialog.warning({' },
      ],
      combineSelected: [
        { from: 'await load()', to: 'await deps.load()' },
        { from: 'message.', to: 'deps.message.' },
        { from: 'dialog.warning({', to: 'deps.dialog.warning({' },
      ],
    },
  },
  /*
   * Task 4 —— 「放错位置的纯件」归位（纯搬迁，零行为变化）。
   *
   * ⚠️⚠️ **这三块里每一条「加 `export`」的改写都不是多余的** —— 照着简报
   *    （`.superpowers/sdd/2026-09-20-home-hui-split-plan/task-4-brief.md` Step 3）
   *    的 `rewrites: {}` 登记会**13 条全红**。实测（2026-09-20，本笔落地时先照抄跑过一遍）：
   *    `13 处不符`，每一条的差异都长这样 ——
   *      旧: `function localToday(): string {`
   *      新: `export function localToday(): string {`
   *    原因见 `norm()` 的注释：它**不 strip `export`**，而那是有意的（「多加了 `export`
   *    却没登记」必须看得见）。所以新文件里**每一个**多出来的 `export` 都要在这里声明。
   *
   *    这正是简报自己「修正 B」讲的那类错（把「函数体不用改」误当成「整段不用改」）——
   *    只是 B 只点了 `progressSegments` 的**签名**那一条，漏了每个名字都有的 `export` 那一条。
   *    ⇒ 以**实测**为准补全，函数体/表达式体一字未动（本条已按简报要求的「改第二行必须报红」
   *    逐名变异验过，见 `task-4-report.md` §2）。
   */
  { target: 'app/src/utils/homeDate.ts',
    names: ['localToday', 'legacyToday'],
    consts: ['pad'],
    rewrites: {
      // ① 搬到模块级并导出（新文件里每个声明都加 `export`）—— 三个名字各一条。
      pad: [{ from: 'const pad = ', to: 'export const pad = ' }],
      localToday: [{ from: 'function localToday(', to: 'export function localToday(' }],
      legacyToday: [{ from: 'function legacyToday(', to: 'export function legacyToday(' }],
      // ② 两个函数体**一字未动**：`legacyToday` 里仍是 `toISOString()`（UTC）+ 返回时间戳，
      //    `localToday` 里仍是本地时区 + 返回 `YYYY-MM-DD` 串 —— **两套口径没有合并**（spec §6.3-9）。
    } },

  { target: 'app/src/utils/homeConstants.ts',
    names: ['progressSegments'],
    consts: ['PROGRESS_OPTIONS', 'PROGRESS_STEPS', 'EMPTY_FILTER_VALUE',
             'CUSTOM_SEGMENT_COLOR', 'CUSTOM_SEGMENT_FLEX', 'AUTOCOMPLETE_ALWAYS_SHOW',
             'ProgressSegment'],
    rewrites: {
      // ① 八个名字各自的 `export`（`consts` 里那个 `type` 也在内 —— `norm` 同样不 strip 它）。
      PROGRESS_OPTIONS: [{ from: 'const PROGRESS_OPTIONS = ', to: 'export const PROGRESS_OPTIONS = ' }],
      PROGRESS_STEPS: [{ from: 'const PROGRESS_STEPS = ', to: 'export const PROGRESS_STEPS = ' }],
      EMPTY_FILTER_VALUE: [{ from: 'const EMPTY_FILTER_VALUE = ', to: 'export const EMPTY_FILTER_VALUE = ' }],
      CUSTOM_SEGMENT_COLOR: [{ from: 'const CUSTOM_SEGMENT_COLOR = ', to: 'export const CUSTOM_SEGMENT_COLOR = ' }],
      CUSTOM_SEGMENT_FLEX: [{ from: 'const CUSTOM_SEGMENT_FLEX = ', to: 'export const CUSTOM_SEGMENT_FLEX = ' }],
      AUTOCOMPLETE_ALWAYS_SHOW: [{ from: 'const AUTOCOMPLETE_ALWAYS_SHOW = ', to: 'export const AUTOCOMPLETE_ALWAYS_SHOW = ' }],
      ProgressSegment: [{ from: 'type ProgressSegment = ', to: 'export type ProgressSegment = ' }],
      // ② 「控制器修正 B」：`progressSegments` 加了第二形参 ⇒ 签名行变了，必须登记这条替换。
      //    函数体一字未动（形参就叫 manualActions，体内 `manualActions.value` 原样有效）。
      //    ⚠️ `to` 里那个 `export ` **不能少** —— 简报给的那条 `to` 没有它，是同一个漏项。
      progressSegments: [
        { from: 'function progressSegments(status: string): ProgressSegment[] {',
          to:   'export function progressSegments(status: string, manualActions: Ref<string[]>): ProgressSegment[] {' },
      ],
      // ③ 语义上**零注入**：`manualActions` 是**调用方传进来的** ref（`Home.vue` 的
      //    `manualActions` 此刻仍留在页面，属 B11/Task 13）—— 本块的函数体里没有一处
      //    改成 `deps.` 或形参改名，除了上面那条签名行。
    } },

  { target: 'app/src/utils/homeOrderNo.ts',
    names: ['splitOrderNos'],
    consts: ['orderNosOf'],
    rewrites: {
      // ① 两个名字各自的 `export`。
      splitOrderNos: [{ from: 'function splitOrderNos(', to: 'export function splitOrderNos(' }],
      orderNosOf: [{ from: 'const orderNosOf = ', to: 'export const orderNosOf = ' }],
      // ② **零页面作用域捕获**（这是「可以归位」的前提，逐行核过，见 `task-4-report.md` §6）：
      //    `splitOrderNos` 只读自己的形参 `v`；`orderNosOf` 只调 `splitOrderNos` 与读
      //    `r.order_no_set`。两者都不读 `ref` / `localStorage` / 组件上下文 ⇒ 不需要注入。
    } },

  /*
   * Task 5 —— B1（「数据 / 加载」+「经营看板」）→ `composables/home/useHomeData.ts`。
   * **Home 侧第一个真「页面块」**（Task 3 的 B10 是 composable 样板，本块是它的第一个同类）。
   *
   * ⚠️ **本块没有 `export` 改写** —— 6 个声明都由工厂 `return` 借出（同 B10），
   *    不做模块级导出。`Home.vue` 侧是 `const { … } = useHomeData({ message, auth })` 解构。
   *
   * ⚠️ 两条 `deps.` 改写**都以 `.` 收尾**（`applyRewrites` 是朴素 `split/join`）：
   *    · `load` 里写 `message.error(` 而不是裸 `message` —— 裸名会打中 `messageXxx` 这类同前缀标识符；
   *    · `dashboardOrders` 里写 `auth.user?.` 而不是裸 `auth.user` —— 裸名会打中 `xauth.user` 这类同尾标识符。
   *    两种误伤**守卫都抓不到**（比对发生在改写之后），所以边界只能靠这里写对。
   *
   * ⚠️ `dashboardOrders` 是「**跨行、且首行没有 `{`**」的 `const`（`computed(() =>` 断行）——
   *    正是 `sliceFn` 路 1 快车道历史上会**静默切短**的那一族（§9h）。登记时按文件头的「验法」
   *    变异过一次：改**第二行**（`.name` → `.role`）守卫**报红**，证明整段真被比中（见 `task-5-report.md` §2）。
   *
   * ⚠️ 与 `docs/roles-admin-logiccheck.mjs` 的联动（**别忘**）：本块搬走的 `dashboardOrders` 里
   *    那处 `canSeeAllOrders(auth.user?.role)` 正是那台子数的**三处之一**。而上面那条
   *    `auth.user?.` → `deps.auth.user?.` 会**改掉台子正则要的字面** ⇒ 台子那边**同一笔里**
   *    加了第二份被数源（新家）+ 正则放宽成 `(?:deps\.)?`（断言仍是 `=== 3`，**不许降**）。
   *    理由与边界写在那个脚本里。
   */
  { target: 'app/src/composables/home/useHomeData.ts',
    names: ['load'],
    consts: ['loading', 'rawOrders', 'financeSummary', 'dashboardShow', 'dashboardOrders'],
    rewrites: {
      load: [{ from: 'message.error(', to: 'deps.message.error(' }],
      dashboardOrders: [{ from: 'auth.user?.', to: 'deps.auth.user?.' }],
    } },
  /*
   * B5（「查询更多」弹窗）—— 第 8 块。11 个声明：5 个 `function` + 6 个 `const`。
   *
   * ⚠️ **本块不拥有任何共享状态** —— 十块里唯一一个「只写别人的 ref」的块。
   *    注入面 8 项：`rawOrders`/`financeSummary`（B1）+ `searchText`/`queryRows`/`queryMode`/
   *    `querySearchPreset`（B3）+ `auth`/`message`（页面）。**下面每一条 `deps.` 规则对应一次注入写/读。**
   *
   * ⚠️ 规则一律**带边界**（Ruling 55）：本段有 7 个 `query` 同前缀家族成员
   *    （`queryShow`/`queryLoading`/`queryClients`/`queryForm`/`queryRows`/`queryMode`/`querySearchPreset`）
   *    —— 写裸的 `queryMode` 会把 `queryModeXxx` 一起改而守卫抓不到。
   *    实测这 7 个名字在本段内**没有更长同前缀标识符**，且 `searchText.value` 与
   *    `querySearchPreset.value` **互不为子串**（已 `node -e` 验过。
   *    所以下面每条都写全 `X.value` / `auth.user?.` / `message.error(`。
   *
   * ⚠️ 两个 `async function`（`openQuery` / `submitQuery`）—— `rawSlice` 的前缀含 `(?:async\s+)?`，
   *    登记时按 Step 6 的变异测试 3（对调 `REF:1362/1363`）实测报红过，证明是**整段**比中，
   *    不是只比签名行。
   *
   * ⚠️ 与 `docs/roles-admin-logiccheck.mjs` 的联动（**别忘**）：本块搬走的 `submitQuery` 里
   *    那处 `!canSeeAllOrders(auth.user?.role)`（`REF:1327`）正是那台子数的**三处之一**
   *    （`homeCalls === 3` / `homeNegated === 2`）。而上面那条 `auth.user?.` → `deps.auth.user?.`
   *    会**改掉台子正则要的字面** ⇒ 台子那边**同一笔里**加了第三份被数源（新家）。
   *    `homeCalls` 的正则 `(?:deps\.)?` 是 Task 5 放宽的，**本笔不再动正则**；
   *    `homeNegated` 的正则（`/!\s*canSeeAllOrders\(/`）**本来就不含 `auth`** ⇒ 只加源。
   *    两条断言数字 `3` / `2` **一个字没改**。理由写在那个脚本里。
   */
  { target: 'app/src/composables/home/useHomeQueryMore.ts',
    names: ['dayStart', 'yearAgoStart', 'toIsoDate', 'openQuery', 'submitQuery'],
    consts: ['queryShow', 'queryLoading', 'queryClients', 'queryForm', 'DATE_SHORTCUTS', 'clientSuggestions'],
    rewrites: {
      // `openQuery`：`REF:1306` 的 `message.error('初始化客户信息失败')`。
      openQuery: [{ from: 'message.error(', to: 'deps.message.error(' }],
      // `submitQuery`：9 处跨块读/写 + 2 处页面上下文（逐条对应 REF 行见下方注释）。
      submitQuery: [
        { from: 'auth.user?.', to: 'deps.auth.user?.' },                     // REF:1327 · 1328（角色过滤）
        { from: 'queryRows.value', to: 'deps.queryRows.value' },             // REF:1344（写 B3）
        { from: 'queryMode.value', to: 'deps.queryMode.value' },             // REF:1345（写 B3）
        { from: 'rawOrders.value', to: 'deps.rawOrders.value' },             // REF:1350 · 1352 · 1353（写 B1）
        { from: 'querySearchPreset.value', to: 'deps.querySearchPreset.value' }, // REF:1362（写 B3）
        { from: 'searchText.value', to: 'deps.searchText.value' },           // REF:1363（写 B3）
        { from: 'financeSummary.value', to: 'deps.financeSummary.value' },   // REF:1374（写 B1）
        { from: 'message.error(', to: 'deps.message.error(' },               // REF:1378（页面上下文）
      ],
    } },
  /*
   * B3（筛选 / 列头筛选 / 分页）—— 第 9 块。**十块里最大的一块**：41 个登记名（8 `function` + 33 `const`/`type`）。
   *
   * ⚠️ **本块有 2 处守卫登记不了的东西**：`watch([searchText, …])`(REF:945-947) 与
   *    `watch(searchText, …)`(REF:954-956) 是**顶层匿名调用**，没有名字 ⇒ `sliceFn` 匹配不到
   *    （它只按名字切）⇒ 既进不了 `names` 也进不了 `consts`。
   *    **这 2 处的保真由手工 `git diff` 提供，不由本守卫提供** —— 见 `task-6-report.md`。
   *    这是本守卫的一条**能力边界**，Task 15 要记账。
   *
   * ⚠️ 本块的 `rewrites` **分两类，顺序有意义**（`split/join` 逐条串行）：
   *    ① **Task 2 的调用形**（`REF → 当前工作区`）：`paidOf`/`unpaidOf`/`paymentStatus` 在那一笔
   *       从「自己读 `financeSummary`」改成了**显式传参**（`.value`）⇒ 规则的 `from` 得写**抽取前**的样子；
   *    ② **本笔的注入前缀**（`当前工作区 → deps.`）。
   *    ⇒ **①必须排在②前面**：② 的 `from`（`financeSummary.value`）在 ① 跑完之前根本不存在。
   *    每条都切成**最小字面**（Ruling 55），不写「一条大规则覆盖多行」、不写恒等规则。
   *
   * ⚠️ 注入面**只有 3 项**（`rawOrders`/`financeSummary`/`auth`）—— 实测重核过（与简报修正 C 一致）。
   *    本块的 `orderNoQuery`/`queryRows`/`queryMode`/`querySearchPreset` 是**本块拥有并借出**的，
   *    **不加 `deps.` 前缀**（它们是声明方，不是注入方）。
   */
  { target: 'app/src/composables/home/useHomeFilterView.ts',
    names: ['matchSearch', 'distinctOptions', 'textColumnFilter', 'matchesColumnFilters',
            'columnFilterValues', 'onUpdateFilters', 'onPageChange', 'onPageSizeChange'],
    consts: ['searchText', 'onlyUnproduced', 'paymentFilter', 'progressFilter', 'orderNoQuery',
             'queryRows', 'queryMode', 'filtered', 'columnFilterState', 'EMPTY_FILTER_LABEL',
             'ColumnFilterOption', 'TextFilterKey', 'paidColumnFilter', 'unpaidColumnFilter',
             'querySearchPreset', 'tableRef', 'pageSizeJustChanged', 'TEXT_FILTER_KEYS',
             'clientFilterOptions', 'dateFilterOptions', 'addressFilterOptions',
             'doorCountFilterOptions', 'totalPriceFilterOptions', 'remarkFilterOptions',
             'salespersonFilterOptions', 'creatorFilterOptions', 'productionStatusFilterOptions',
             'paidFilterOptions', 'unpaidFilterOptions', 'summary', 'page', 'pageSize', 'paged'],
    rewrites: {
      // `filtered`：REF:705 的 `paymentStatus(r)`（Task 2 加实参）+ 691/692/693 三处注入写读。
      filtered: [
        { from: 'paymentStatus(r)', to: 'paymentStatus(r, financeSummary.value)' },
        { from: 'rawOrders.value', to: 'deps.rawOrders.value' },
        { from: 'auth.user?.', to: 'deps.auth.user?.' },
        { from: 'financeSummary.value', to: 'deps.financeSummary.value' },
      ],
      // `distinctOptions`：REF:750 的 `for (const r of rawOrders.value)`（选项取自全量原始列表）。
      distinctOptions: [{ from: 'rawOrders.value', to: 'deps.rawOrders.value' }],
      // `paidColumnFilter`(REF:789) / `unpaidColumnFilter`(REF:790)：Task 2 加了 `, financeSummary.value`。
      paidColumnFilter: [
        { from: 'paidOf(row)', to: 'paidOf(row, financeSummary.value)' },
        { from: 'financeSummary.value', to: 'deps.financeSummary.value' },
      ],
      unpaidColumnFilter: [
        { from: 'unpaidOf(row)', to: 'unpaidOf(row, financeSummary.value)' },
        { from: 'financeSummary.value', to: 'deps.financeSummary.value' },
      ],
      // `paidFilterOptions`(REF:846) / `unpaidFilterOptions`(REF:847)：Task 2 把裸函数名包成箭头函数。
      paidFilterOptions: [
        { from: 'distinctOptions(paidOf)', to: 'distinctOptions((r) => paidOf(r, financeSummary.value))' },
        { from: 'financeSummary.value', to: 'deps.financeSummary.value' },
      ],
      unpaidFilterOptions: [
        { from: 'distinctOptions(unpaidOf)', to: 'distinctOptions((r) => unpaidOf(r, financeSummary.value))' },
        { from: 'financeSummary.value', to: 'deps.financeSummary.value' },
      ],
      // `summary`：REF:876/877/878 三处（`s + paidOf(r)` · `s + unpaidOf(r)` · `unpaidOf(r) > 0`）。
      summary: [
        { from: 's + paidOf(r)', to: 's + paidOf(r, financeSummary.value)' },
        { from: 's + unpaidOf(r)', to: 's + unpaidOf(r, financeSummary.value)' },
        { from: 'unpaidOf(r) > 0', to: 'unpaidOf(r, financeSummary.value) > 0' },
        { from: 'financeSummary.value', to: 'deps.financeSummary.value' },
      ],
    } },
  /*
   * B9（「打印选中订单」+「打印选项」抽屉的 4 个入口）—— 第 10 块。23 个声明：4 个 `function` + 19 个 `const`。
   *
   * ⚠️ **行段是 `1411–1528`**（`1528 − 1411 + 1 = 118`）。`1529–1531` 起是**另一个分区**
   *    「电子回执单」（§6.2），`openReceipt`(1532–1538) **不搬** —— 它的调用者是 `columns`，
   *    而 `columns` 留在页面（用户拍板）。登记时以 `1411–1527` 的**声明文本**为准，
   *    1528 是那一段尾部的空行（`norm()` 会丢掉它，不影响比对）。
   *
   * ⚠️ **本块没有 `export` 改写** —— 23 个声明都由工厂 `return` 借出（同 B10/B1/B5）。
   *
   * ⚠️ 只有 `openPrint` 有 `deps.` 改写（实测：`onOpenMode`/`onOpenReceiptOther`/`onOpenDoc`
   *    三个体里只用本块自己的 ref，逐字不动；19 个 `const` 的初始化式也逐字不动）。
   *    **每条 `from` 都以 `(` 或 `.` 或 `[` 收尾**（Ruling 55：`applyRewrites` 是裸 split/join）——
   *    `openPrint` 体里有 `(e as Error).message`，所以**绝对不许**写 `from: 'message'`。
   *
   * ⚠️ `openPrintPreview`（本笔新增的接缝）**不在本清单里、也不该登记** —— 实测：
   *    `sliceFn(新家, 'openPrintPreview')` **切得出 5 行**，而 `sliceFn(REF, 'openPrintPreview')`
   *    返回 **`null`**（REF 里没有这个名字）⇒ 登记进 `names` 只会报「参照里找不到」。
   *    ⇒ **守卫对这一处零检验力**（不是「切不出来」，是「参照侧根本没有可比之物」）。
   *    它的保真靠人工核对那三行与 REF `2238`/`2239`/`2242` 的逐字对照（见 `task-9-report.md`）。
   *    这也是本守卫的能力边界：**新增件它一概验不到**，只有「搬走的东西」才在它射程内。
   */
  { target: 'app/src/composables/home/useHomePrint.ts',
    names: ['openPrint', 'onOpenMode', 'onOpenReceiptOther', 'onOpenDoc'],
    consts: ['printShow', 'printOrders', 'previewShow', 'previewMode', 'previewTitle',
             'previewAutoLineNumbers', 'receiptOtherShow', 'receiptOtherOrders',
             'receipt2Show', 'receipt2Orders', 'glassSheet2Show', 'glassSheet2Orders',
             'productionSheet2Show', 'productionSheet2Orders', 'productionSheetShow',
             'productionSheetOrders', 'qualifiedLabelShow', 'qualifiedLabelOrders',
             'qualifiedLabelEntry'],
    rewrites: {
      openPrint: [
        { from: 'message.warning(', to: 'deps.message.warning(' },
        { from: 'message.error(', to: 'deps.message.error(' },
        { from: 'checkedRowKeys.value', to: 'deps.checkedRowKeys.value' },
        { from: 'details[', to: 'deps.details[' },
      ],
      // 其余三个函数体只读写本块自己的 ref，零替换。
      onOpenMode: [], onOpenReceiptOther: [], onOpenDoc: [],
    } },
  /*
   * B6（「展开明细」两段）—— 第 11 块、**本阶段最大的一块**。23 个声明：11 `names` + 12 `consts`。
   *
   * ⚠️ **段二是 `2107–2257`，不是 `2134–2257`**（简报修正 A2）：`2107–2133` 那 27 行是
   *    `renderExpandDetail` 头上的 `/* … *\/` 说明块。方案 §3.1 从 `function` 那行起算 ⇒ 会把它
   *    留在旧文件里。本守卫按**声明**切，本来就不看段头注释，所以这条是**人工**核对的
   *    （见 `task-10-report.md`），不是本脚本保证的。
   *
   * ⚠️⚠️ **`calcSingleRowInExpand` 那一整段替换是本清单里唯一一处「真改代码」** ——
   *    REF 末尾那五行（`printOrders.value = [detail]` / `onOpenMode(...)` / 两行注释 /
   *    `previewAutoLineNumbers.value = false`）在新侧收成了一行 `deps.openPrintPreview([detail], false)`。
   *    **为什么这不是「搬迁失真」**：那五行的**新家**是 `useHomePrint.ts` 的 `openPrintPreview`，
   *    它逐字等于 REF `2238`/`2239`/`2242`（顺序也一致）—— 收拢是为了**断 B6↔B9 的环**。
   *    ⚠️ **`openPrintPreview` 这个函数本身**验不到（REF 里没有对应声明，正比对无从做起）⇒
   *    它内部那三行的保真只有**人工逐行对照**一条来源，别再拿「本脚本绿」当它的证据。
   *    ✅ 但**调用点这一句在射程内** —— 实测（2026-09-20，本笔）：把新侧那一行改成
   *    `deps.openPrintPreview([detail], true)`，守卫**立刻报红**（`L8` 逐字贴出两侧文本）。
   *    原因在判据本身：改写是**只加在 REF 侧**的（主循环 `const a = applyRewrites(name, norm(o), rules)`
   *    再与 `norm(新侧)` 比）⇒ `to` 那段文本**就是被比对的期望值**，新侧写错一样会露。
   *    ⚠️ 这条「会红」与简报（`task-10-brief.md` 修正 G 的变异 3）预测的「守卫不会红」**相反** ——
   *    以实测为准（简报那句话多半是推的）。`from` 不匹配时 `applyRewrites` 会**抛错**（白送的检查）。
   *
   * ⚠️ 注入面 3 项（`message` / `dialog` / `openPrintPreview`）—— 其中只有 `message` 与 `dialog`
   *    体现为前缀改写；`openPrintPreview` 体现为上面那条整段替换。
   *    **每条 `from` 都以 `(` 或 `{` 收尾**（Ruling 55）：`loadDetail` 体里有 `(e as Error).message`、
   *    `fillLineNumbersFor` 体里有 `e instanceof Error ? e.message : …` ⇒ **绝对不许**写裸 `message`。
   *    实测：改写后全文 `deps.` 前缀的出现次数 = 8（1 warning + 3 success + 2 error + 1 dialog + 1 整段），
   *    且**不存在** `.deps.message` / `.deps.dialog` 这种把 `e.message` 改坏的形态（已按「剥注释后
   *    再数」的口径核过）。
   */
  { target: 'app/src/composables/home/useHomeExpand.ts',
    names: ['lineRefOf', 'normalizeLines', 'shownOf', 'homeLineInputOf', 'onExpandedKeys',
            'loadDetail', 'renderExpandDetail', 'addRowToExpand', 'batchDeleteInExpand',
            'calcSingleRowInExpand', 'fillLineNumbersFor'],
    consts: ['expandedRowKeys', 'details', 'loadingDetail', 'homeFormulas', 'homeDisableAutoMarkup',
             'lineRefs', 'homeDialogs', 'homeDetailHooks', 'homeSelectTick', 'tableShown',
             'homeCalcEngine', 'loadedIds'],
    rewrites: {
      loadDetail: [
        { from: 'message.error(', to: 'deps.message.error(' },   // 体里有 (e as Error).message
      ],
      batchDeleteInExpand: [
        { from: 'message.warning(', to: 'deps.message.warning(' },
        { from: 'message.success(', to: 'deps.message.success(' },
        { from: 'dialog.warning(', to: 'deps.dialog.warning(' },
      ],
      fillLineNumbersFor: [
        { from: 'message.success(', to: 'deps.message.success(' },
        { from: 'message.error(', to: 'deps.message.error(' },   // 体里有 e.message
      ],
      calcSingleRowInExpand: [
        // ⚠️ `from` 按 `norm()` 之后的形态写（逐行 trim、丢空行）。
        { from: [
            'printOrders.value = [detail]',
            "onOpenMode('product', '生产单')",
            '// ⚠️ **算料不补行级单号** —— 旧版 `In`/`Un` 只算料 + 开预览，补号是打印时才做的。',
            '//    放在 onOpenMode 之后（它会把标志置回 true）。',
            'previewAutoLineNumbers.value = false',
          ].join('\n'),
          to: 'deps.openPrintPreview([detail], false)' },
        { from: 'message.success(', to: 'deps.message.success(' },
      ],
      // 其余 7 个函数体零替换（只读写段内自产的名字 + 直接 import 的 api/h/NSpin/NEmpty/DetailLinesTable）。
      lineRefOf: [], normalizeLines: [], shownOf: [], homeLineInputOf: [],
      onExpandedKeys: [], renderExpandDetail: [], addRowToExpand: [],
    } },
  /*
   * B8（「内联编辑 / 改客户名 / 改生产日期」）—— 15 个声明：7 `names` + 8 `consts`。
   *
   * ⚠️ **段是 `1018–1058` + `1060–1106` + `1191–1203` 三段**，不是 `1018–1203` 一整段：
   *    `1108`（`pad`）与 `1110–1119`（`localToday`）归 Task 4、`1121–1153`（`confirmAudit`）归 **B11**、
   *    `1155–1189`（`combineSelected`）归 **B10** —— 全夹在中间。本清单按**名字**切，本来就切不到它们；
   *    这条约束是**删段**时的人工纪律（方案 §3.1 的 B8 行写的是 Task 3/4 跑之前的快照）。
   *
   * ⚠️ 三个函数体里都有 `(e as Error).message`（`saveEdit` / `submitRename` / `submitDate`）⇒
   *    **绝对不许**写裸 `{ from: 'message' }`（Ruling 55）：会把 `e.message` 改成 `e.deps.message`。
   *    一律用带 `(` 的形态。实测各自声明切片里各命中一次（改写是**按声明切片**分别施加的）。
   *    ⚠️ `load()` 同理带右括号 —— 裸 `load(` 会打进 `loadDetail(` 这类同前缀标识符。
   *
   * ⚠️ **段头注释 `1018–1020`（「内联编辑（§4.5…）」三行）在 `editingId` 的声明之上**，
   *    `sliceFn` 从**声明**起切 ⇒ **不在任何切片里**，本守卫管不到它（实测：改它一个字不报红）。
   *    它的保真只有 `git diff` 人工比对一条来源 —— 与 B6 段二那 27 行说明块同一性质。
   */
  { target: 'app/src/composables/home/useHomeRowEditing.ts',
    names: ['startEdit', 'saveEdit', 'cancelEdit', 'openRename', 'submitRename', 'openDate',
            'submitDate'],
    consts: ['editingId', 'draft', 'renameShow', 'renameTarget', 'renameValue',
             'dateShow', 'dateTarget', 'dateValue'],
    rewrites: {
      startEdit: [], cancelEdit: [], openRename: [],
      saveEdit: [
        { from: 'load()', to: 'deps.load()' },
        { from: 'message.success(', to: 'deps.message.success(' },
        { from: 'message.error(', to: 'deps.message.error(' },   // 体里有 (e as Error).message
      ],
      submitRename: [
        { from: 'load()', to: 'deps.load()' },
        { from: 'message.success(', to: 'deps.message.success(' },
        { from: 'message.error(', to: 'deps.message.error(' },   // 体里有 (e as Error).message
      ],
      openDate: [
        { from: 'message.warning(', to: 'deps.message.warning(' },
      ],
      submitDate: [
        { from: 'load()', to: 'deps.load()' },
        { from: 'message.success(', to: 'deps.message.success(' },
        { from: 'message.error(', to: 'deps.message.error(' },   // 体里有 (e as Error).message
      ],
    } },
]

/**
 * 摊平一个 block 的 `names` + `consts`（两者都可省 —— 缺了当空数组）。
 *
 * ⚠️ `|| []` **不能省**：漏写一个键时裸的展开会抛 `TypeError: b.consts is not iterable`
 * （立骨架时实测踩到），那句话对着清单看不出是哪个 block 缺了什么。
 * 主循环与 `allNames()` **共用这一个**，别在两处各写一遍展开 —— `--selftest` 有一例钉住它。
 */
const blockNames = (b) => [...(b.names || []), ...(b.consts || [])]

/** 反查：这些名字搬走后，Home.vue 里不该再有自己的定义（否则两份实现各自漂移）。 */
const allNames = () => BLOCKS.flatMap(blockNames)

/**
 * 声明探测（反查用）：`src` 里**自己定义**了 `name` 吗。
 *
 * ⚠️ 前缀必须与 `sliceFn` 的取法**逐字对齐**（含 `async`）—— 否则 `async function foo()`
 * 搬走后这一条认不出来，反查会**静默漏报**（立骨架时实测踩到：`load` 正是 `async function`）。
 * `--selftest` 有一例专门钉住这个 `async`。
 *
 * ⚠️ `type` / `interface` 是 2026-09-20（Task 3.5）跟着 `sliceFn` 一起加的 —— 正是
 * 「前缀必须对齐」这条规矩要求的。Task 4 要把 `type ProgressSegment` 搬进
 * `utils/homeConstants.ts`，反查若认不出 `type` 声明，那个名字就成了**反查的暗区**：
 * 搬走之后 `Home.vue` 里再长出一份同名 `type`，本脚本不会吭声。
 */
const declares = (src, name) =>
  new RegExp(
    `^[ \\t]*(?:export\\s+)?(?:async\\s+)?(?:function|const|let|var|type|interface)\\s+${name}\\b`,
    'm',
  ).test(src)

/**
 * 自测：拿一对**已知故意改坏**的样本跑一遍比对核心，断言它报红且**定位到正确的行**。
 * 先例的教训（docs/2026-09-18-detail-table-extraction.md §5.3）：守卫自身的洞不会被它自己发现
 * —— 那次的扇数正则从 `(\d+)` 被改窄成 `(\d)`，夹具全是单位数，于是测试不报错。
 * 所以这里不测「真代码」，测「比对函数在已知输入上是否会红」。
 *
 * ⚠️ 这一段必须留在**任何 git 调用之前**：自测验证的是比对核心，不该依赖仓库状态
 *    （浅克隆、detached HEAD 下也要能跑）。
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

  /*
   * ⚠️ **自测里调 `sliceFn` 一律走 `trySlice`** —— `sliceFn` 现在会**抛**
   *    （结构性硬闸：切出来不配平就报错，见核心文件头）。裸调会把整段自测崩掉
   *    （栈糊满屏、后面的断言**一条都不跑**），而自测要的是一行干净的 ✗。
   *    实测踩过两次：变异「块注释不再被跳过」时 `headerFilter` 那例、
   *    变异「跨行遇换行就停」时上面那条跨行签名那例，都把 `--selftest` 直接崩了。
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
    return { diff: firstDiffLine(norm(a.v), norm(b.v)), text: a.v }
  }

  // ① 比对核心：一对**已知故意改坏**的样本，必须报红且**定位到正确的行**。
  const oldTxt = `function f(a: number) {\n  const n = Math.round(a * 1.13)\n  return n ?? 0\n}`
  const diffCases = [
    ['Math.round → Math.floor', `function f(a: number) {\n  const n = Math.floor(a * 1.13)\n  return n ?? 0\n}`, 2],
    ['丢掉 ?? 0',              `function f(a: number) {\n  const n = Math.round(a * 1.13)\n  return n\n}`, 3],
    ['未改坏（应判为一致）',    oldTxt, 0],
  ]
  for (const [what, newTxt, expectDiffLine] of diffCases) {
    const diff = firstDiffLine(norm(oldTxt), norm(newTxt)) // 返回首个不同的行号（1 基），一致则 0
    const same = diff === expectDiffLine
    // 绿时把「定位到第几行」打出来（这是这一例的看点）；红时别把实得值也塞进标题 —— 详情里已经有了。
    check(same ? `${what} → 第 ${diff} 行` : what, same, `期望首个差异在第 ${expectDiffLine} 行，实得 ${diff}`)
  }

  /*
   * ② 反查正则（`declares`）：认得出 `async function`，且**不把调用当定义**。
   * 这一例是补出来的 —— 立骨架时「漏 `async`」这个 bug 是**手工端到端跑**才发现的，
   * 当时 `--selftest` 对它完全不可见（那正是先例 §5.3「守卫自身的洞」的重演）。
   */
  check(
    '反查认得 `async function`（去掉 `(?:async\\s+)?` 这例即红）',
    declares('export async function load() {\n  return 1\n}', 'load'),
    '`async function` 搬走后反查会**静默漏报**',
  )
  check(
    '反查不把普通调用当定义',
    !declares('void load()\nload()\n', 'load'),
    '把调用当定义会让每个调用点都误报',
  )

  /*
   * ③ `names` / `consts` 都可省 —— 缺键**不能抛** `TypeError`。
   * 同样是手工跑才发现的：漏写 `consts` 换来一句对不上清单的 TypeError。
   */
  // 两条断言都走这个小包装 —— 否则「抛了」会变成**未捕获**的崩溃（栈糊满屏、后面的断言一条不跑），
  // 而自测要的是一行干净的 ✗（复审变异时实测踩到）。
  const flatOf = (b) => {
    try {
      return { v: blockNames(b) }
    } catch (e) {
      return { e: `${e.constructor.name}: ${e.message}` }
    }
  }
  const namesOnly = flatOf({ names: ['a', 'b'] })
  check(
    '只写 `names`、不写 `consts` 不抛',
    !!namesOnly.v && namesOnly.v.join(',') === 'a,b',
    namesOnly.e || `实得 ${JSON.stringify(namesOnly.v)}`,
  )
  const bothAbsent = flatOf({})
  check(
    '`names`/`consts` 都不写 = 空数组',
    !!bothAbsent.v && bothAbsent.v.length === 0,
    bothAbsent.e || `实得 ${JSON.stringify(bothAbsent.v)}`,
  )

  /*
   * ④ `sliceFn` 的边界：**返回类型里的花括号字面量**不能把切片骗走。
   * 这是姊妹件「前几版都栽在这」的那个构造（`function f(l: Line): { label: string }[] {`），
   * 而它此前对自测不可见。判据：切出来必须**就是整段**（含返回类型与函数体）。
   */
  const retTxt = `function pingCasingOptions(l: Line): { label: string; value: string }[] {\n  return []\n}`
  const retR = trySlice(retTxt, 'pingCasingOptions')
  check(
    '返回类型里的 `{}` 不骗走切片',
    retR.v === retTxt,
    retR.e ? `抛错：${retR.e}` : `实得 ${JSON.stringify(retR.v)}`,
  )

  /*
   * ⑤ 洞①：**参数表跨行时，函数体也必须被比对**（2026-09-20 Task 3.5 补）。
   *
   * 这一例的构造就是 `Home.vue` 的 `onCheckedKeys` / `renderEditable` 的形状：参数表换行。
   * 改坏的是**函数体的第 2 行**（`String` → `Number`）。
   * ⚠️ 断言必须**经过 `sliceFn`**，不能只比 `norm` 的两段常量 —— 洞就长在 `sliceFn` 里：
   *    旧版对跨行签名只返回 `function onKeys(`，两边都只剩签名那一行 ⇒ 无论体内怎么改都判「一致」。
   *    经过 `sliceFn` 才有检验力（实测：把 `sliceFn` 换回旧版，这一例立刻红）。
   */
  const multiSig = (body2) =>
    ['function onKeys(', '  keys: DataRowKey[],', '  meta?: { row?: unknown },', ') {', '  if (!keys.length) return', `  checked.value = keys.map(${body2})`, '}'].join('\n')
  const multiR = sliceDiff(multiSig('String'), multiSig('Number'), 'onKeys')
  const multiGone = multiR.diff ?? -1
  check(
    '跨行签名的**函数体**被改坏 → 报红且定位到体内那行',
    multiGone === 6,
    multiR.why
      ? `切不出来：${multiR.why}`
      : `期望首个差异在第 6 行，实得 ${multiGone}（0 = 函数体根本没被比对 ⇒ 洞① 复发）`,
  )

  /*
   * ⑥ 洞②：`type` 别名要能切、且改坏要报红（2026-09-20 Task 3.5 补）。
   *
   * Task 4 要把 `type ProgressSegment` 搬进 `utils/homeConstants.ts`；切不出来就**登记不了**
   * （登记了也是假绿）。改坏的是字段类型（`flex: number` → `flex: string`）。
   * ⚠️ 判据里显式判 `null`：旧版 `sliceFn` 的正则不认 `type`，返回的是 `null` 而不是「切歪了」，
   *    直接丢给 `norm()` 会抛，整个自测崩掉、后面的断言一条都不跑。
   */
  const typeSrc = (field) => ['type Seg = {', '  label: string', `  flex: ${field}`, '  done: boolean', '}'].join('\n')
  const tR = sliceDiff(typeSrc('number'), typeSrc('string'), 'Seg')
  const tDiff = tR.diff ?? -1
  check(
    '`type` 别名被改坏 → 报红且定位到那行',
    tDiff === 3,
    tR.why
      ? `切不出来：${tR.why}（洞② 复发：正则不认 type）`
      : `期望首个差异在第 3 行，实得 ${tDiff}`,
  )
  // `interface` 与 `type` 是两条独立的正则分支，只钉住一条等于「只在单侧被钉住」（洞③ 的教训）。
  const ifaceSrc = (field) => ['interface Seg {', '  label: string', `  flex: ${field}`, '}'].join('\n')
  const iR = sliceDiff(ifaceSrc('number'), ifaceSrc('string'), 'Seg')
  const iDiff = iR.diff ?? -1
  check(
    '`interface` 被改坏 → 报红且定位到那行',
    iDiff === 3,
    iR.why
      ? `切不出来：${iR.why}（洞② 复发：正则不认 interface）`
      : `期望首个差异在第 3 行，实得 ${iDiff}`,
  )

  /*
   * ⑦ 洞③：`async` 前缀 —— 这次钉的是 **`sliceFn`**，不是 `declares`。
   *
   * 上面第 ② 组那条 `declares` 的 async 断言只钉住了**反查**那一侧：把 `sliceFn` 正则里的
   * `(?:async\s+)?` 删掉，此前自测**全绿**。而 `sliceFn` 认不出 `async function foo()` 的后果
   * 更直接：正比对里旧文件那侧返回 `null` ⇒ 报「参照里找不到」（名字明明在），
   * 或者反查与新文件两侧一起出错 ⇒ 静默漏报。
   *
   * ⚠️ 样本里**故意没有 `export`** —— 这样唯一能把匹配挡在 `function` 前面的就只剩 `async`，
   *    这一例才「只可能由 async 前缀差异触发」。
   */
  const asyncTxt = `async function load() {\n  return 1\n}`
  const asyncR = trySlice(asyncTxt, 'load')
  check(
    '`sliceFn` 认得 `async function`（去掉 `(?:async\\s+)?` 这例即红）',
    asyncR.v === asyncTxt,
    asyncR.e ? `抛错：${asyncR.e}` : `实得 ${JSON.stringify(asyncR.v)}`,
  )

  /*
   * ⑧ 洞①的同族：**多行、但没有函数体 `{` 的顶层 `const`**，第二行起也必须被比对。
   *
   * 样本就是 `PROGRESS_STEPS`(REF:498–504) 的形状（Task 4 要登记它）。
   * 旧版对「无 `{`」一律退化成「只返回第一行」⇒ 第二行怎么改都判「一致」。
   * 这里改坏的正是**第二行**（`flex: 1` → `flex: 9`）—— 只比第一行的实现会判它一致。
   */
  const stepsSrc = (second) =>
    ['const STEPS = [', `  { label: \'a\', flex: ${second} },`, '  { label: \'b\', flex: 2 },', ']'].join('\n')
  const stepsR = sliceDiff(stepsSrc(1), stepsSrc(9), 'STEPS')
  const stepsGot = stepsR.text ?? null
  const stepsDiff = stepsR.diff ?? -1
  check(
    '多行无 `{` 的 const：**只改第二行** → 报红',
    stepsGot != null && stepsGot.split('\n').length === 4 && stepsDiff === 2,
    stepsR.why
      ? `切不出来：${stepsR.why}`
      : `切片 ${stepsGot?.split('\n').length} 行（应 4）、首个差异在第 ${stepsDiff} 行（应 2；0 = 第二行根本没被比对）`,
  )

  /*
   * ⑨ 续行记号：`const NAME = (…) =>` 这种**表达式体箭头**，函数体在下一行。
   *
   * 这一例钉的是 2026-09-20 查出来的**真假绿**：Hui 侧 4 个已登记的名字
   * （`sqCell`/`cCol`/`sub`/`orderNoCell`）首行括号正好配平 ⇒ 命中「单行声明」快车道
   * ⇒ 只比了第一行，而守卫照样报「逐字一致」。修法是「行尾续行记号」判据。
   * 改坏的是**体内**那一行（`open` → `close`）。
   */
  const arrowSrc = (fn) =>
    ['const cell = (l: Line) =>', "  h(", "    'div',", `    { onClick: () => ${fn}(l) },`, '    [String(l.sq)],', '  )'].join('\n')
  const arrowR = sliceDiff(arrowSrc('open'), arrowSrc('close'), 'cell')
  const arrowGot = arrowR.text ?? null
  const arrowDiff = arrowR.diff ?? -1
  check(
    '表达式体箭头（`=>` 在行尾）的多行 const：**改体内那行** → 报红且定位正确',
    arrowGot != null && arrowGot.split('\n').length === 6 && arrowDiff === 4,
    arrowR.why
      ? `切不出来：${arrowR.why}`
      : `切片 ${arrowGot?.split('\n').length} 行（应 6）、首个差异在第 ${arrowDiff} 行（应 4；1 = 只比了首行）`,
  )

  /*
   * ⑬-b 续行记号（**行首那一半**）：prettier 风格的联合类型把 `|` 写在**下一行行首**。
   *
   * ```ts
   * type TextFilterKey =
   *   | 'client_name'      ← 行尾是 'client_name'，只看行尾会在这里**停住**
   *   | 'order_date'
   * ```
   *
   * `type TextFilterKey`(REF:769) 是**真形状**（10 行）—— 它属 B3（Task 6）要搬的那一段，
   * 只靠「行尾续行记号」会切出 2 行（第一行以 `=` 收尾续上了，第二行以 `'client_name'`
   * 收尾就断了）。所以还要看**下一行行首**。
   * 改坏的是**第 4 行**的成员名（`client_name` → `client_code`）。
   */
  const unionSrc = (third) =>
    ['type TextFilterKey =', "  | 'client_name'", "  | 'order_date'", `  | '${third}'`, "  | 'status'"].join('\n')
  const unionR = sliceDiff(unionSrc('salesperson'), unionSrc('creator_name'), 'TextFilterKey')
  const unionGot = unionR.text ?? null
  const unionDiff = unionR.diff ?? -1
  check(
    'prettier 风格联合类型（`|` 在下一行行首）：**改第 4 行** → 报红',
    unionGot != null && unionGot.split('\n').length === 5 && unionDiff === 4,
    unionR.why
      ? `切不出来：${unionR.why}`
      : `切片 ${unionGot?.split('\n').length} 行（应 5；2 = 只看行尾、在第 2 行就停了）、首个差异在第 ${unionDiff} 行（应 4）`,
  )

  /*
   * ⑩ 函数体里的**注释**含不平衡花括号 —— 配平必须跳过注释。
   *
   * 这条是 2026-09-20 复审指出的那个根因的形状（它说的是 `headerFilter` 的 JSDoc）。
   * 改前：配平只看字符串、不看注释 ⇒ 注释里一个孤立的 `{` 就让深度永不归零 ⇒ 返回 `null`
   * （报「参照里找不到」，名字明明在）。改后：跳过注释 ⇒ 切出整段。
   */
  const cmtSrc = ['function f() {', '  // 注释里只有一个左花括号 { 就够骗走配对了', '  return 1', '}'].join('\n')
  const cmtR = trySlice(cmtSrc, 'f')
  check(
    '函数体里的注释含不平衡 `{` → 仍切出整段（配平跳过注释）',
    cmtR.v === cmtSrc,
    cmtR.e ? `抛错：${cmtR.e}` : `实得 ${JSON.stringify(cmtR.v)}`,
  )
  // 反向那一半：注释里只有 `}` —— 配平会在注释处**提前收口**，切出半段（且不配平）。
  const cmtSrc2 = ['function g() {', '  const s = 1 // 注释里只有一个右花括号 }', '  return s', '}'].join('\n')
  const cmtR2 = trySlice(cmtSrc2, 'g')
  check(
    '函数体里的注释含不平衡 `}` → 不会在注释处提前收口',
    cmtR2.v === cmtSrc2,
    cmtR2.e ? `抛错：${cmtR2.e}` : `实得 ${JSON.stringify(cmtR2.v)}`,
  )

  /*
   * ⑪ 字符串字面量里的 `}` —— 同样不许骗走配平。
   *
   * ⚠️ 诚实说明：**这一例对改前的核心也是绿的**（旧版函数体配平本来就跳字符串）。
   *    留着它是**回归钉**：哪天有人把字符串跳过删了，这一例会立刻红。
   *    真正能区分改前/改后的是 ⑩（注释）与 ⑨（续行记号）。
   */
  const strSrc = ['function f() {', "  const s = '}'", '  return s', '}'].join('\n')
  const strR = trySlice(strSrc, 'f')
  check(
    '字符串字面量里的 `}` 不骗走配平',
    strR.v === strSrc,
    strR.e ? `抛错：${strR.e}` : `实得 ${JSON.stringify(strR.v)}`,
  )

  /*
   * ⑫ 真实形状的 `headerFilter`(REF:2866)：**多行签名 + 参数里的类型字面量 + JSDoc 里
   *    反引号与引号交错**。这是复审点名的那一处（实测它**在改前就已经切得对** —— 98 行，
   *    与真 TS 解析器逐字相同；但形状本身值得钉住，因为它是「三件事同时出现」的唯一一处）。
   *    样本按真源码的骨架缩写了，但**反引号/引号交错那两行是照抄的**。
   */
  const hfSrc = [
    'function headerFilter(opt: {',
    '  /** 列名（旧版 `<span>未付</span>` / `打单操作`） */',
    '  columnLabel: string',
    '  /**',
    '   * ⚠️ **两列不一样，别统一**：`打单操作` 的值包在',
    '   *    `<span style="color:#409eff;font-weight:700"> (" 生产进度 " 的 `Ou`，`:11541`)；',
    '   */',
    '  highlightValue?: boolean',
    '  current: Ref<string>',
    '}) {',
    '  // 旧版选项容器 `Yu`(`:11485 区`) / `Hu`(`:11545 区`)：`display:flex`',
    "  return () => h('div', { class: 'header-filter' }, [opt.columnLabel])",
    '}',
  ].join('\n')
  const hfR = trySlice(hfSrc, 'headerFilter')
  check(
    '真实形状的 `headerFilter`（多行签名 + 交错反引号/引号 JSDoc）→ 切出整段',
    hfR.v === hfSrc,
    hfR.e
      ? `抛错：${hfR.e}`
      : hfR.v == null
        ? '返回 `null`（多发于配平不跳注释）'
        : `切片 ${hfR.v.split('\n').length} 行（应 ${hfSrc.split('\n').length}）`,
  )

  /*
   * ⑬ **结构性硬闸**：切出来但**不配平**的一段，必须**抛错**，绝不许静默返回拿去比对。
   *
   * 起因：若两侧（参照 / 目标文件）用同样错误的方式各切一段，比的就是**错误的那段文本**，
   * 却报「逐字一致」—— 那比假绿更坏。`sliceFn` 现在对非快车道的结果跑一遍
   * `bracketBalance()`（跳过字符串与注释），不配平就抛。
   *
   * 样本 = **一条括号永远没闭合的声明**（模拟文件在声明中途截断，或判据没找着结尾）：
   * `const UNSET = [` 后面到文件尾都没出现 `]` ⇒ 兜底退回「只切第一行」，
   * 而那一行带着一个未闭合的 `[` ⇒ 硬闸必须拦下。
   *
   * ⚠️ 断言必须区分「抛错」与「返回 null」：**返回 null 不算通过** ——
   *    null 会被上层当成「参照里找不到」，那是另一回事。
   */
  const gateR = trySlice(['const UNSET = [', '  { a: 1 },', '  { b: 2 },'].join('\n'), 'UNSET')
  check(
    '切片不平衡 → **抛错**（不是静默返回、也不是 null）',
    !!gateR.e && /切片不平衡/.test(gateR.e),
    gateR.e ? `抛了别的错：${gateR.e.slice(0, 80)}` : `没抛，实得 ${JSON.stringify(gateR.v)}`,
  )
  // 反向：**合法**的单行声明不许被闸误伤 —— 尤其 `const X = '…'` 这种**收尾引号恰好是
  // 最后一个字符**的（`EMPTY_FILTER_VALUE`(REF:735) 就是）。实测踩过一次误判：
  // 用「跳过终点 `>= 长度`」判「字符串没闭合」，会把它误报成切片不配平而抛错。
  const oneLineR = trySlice(["const EMPTY_FILTER_VALUE = '__EMPTY__'", 'const NEXT = 1'].join('\n'), 'EMPTY_FILTER_VALUE')
  check(
    "合法单行声明不被硬闸误伤（`= '…'` 收尾引号在行尾）",
    oneLineR.v === "const EMPTY_FILTER_VALUE = '__EMPTY__'",
    oneLineR.e ? `被误判：${oneLineR.e}` : `实得 ${JSON.stringify(oneLineR.v)}`,
  )

  /*
   * ⑭ **声明在文件尾收口**（末尾无换行）与 **后面还有换行** 必须切出同一段。
   *
   * 这一例钉的是 `fixtures/hui-pre-3b.ts` 的最后一个声明 `diaoColumns` —— 那个文件末尾
   * **没有换行**（最后一个字符就是 `)`）。跨行扫描靠「栈空时遇到的那个换行」收工；
   * 文件尾没有换行 ⇒ 扫到文件尾也没停过 ⇒ 只剩 `rawSlice` 末尾那条「栈空就切到文件尾」
   * 兜底能救它。**去掉那一行，两侧就不等价**：有换行的一侧 3 行、无换行的一侧只剩首行
   * ⇒ 两边比出一个「差异」，而那是**切片器自己造出来的假差异**（不是搬迁失真）。
   * （实测：去掉那一行后，无换行那一侧还会被硬闸拦下、抛「切片不平衡 —— 收支 1」。）
   *
   * ⚠️ 断言必须**两侧都覆盖**：只给「有换行」那一侧就会漏掉这个洞 —— 洞恰恰在无换行那侧。
   */
  const eofDecl = ['const diaoColumns = computed<T[]>(() =>', '  diaoCols().filter((c) => vis(c)),', ')']
  const noNl = eofDecl.join('\n') // 夹具的真形状：末尾无换行
  const withNl = noNl + '\n'
  const eofA = trySlice(noNl, 'diaoColumns')
  const eofB = trySlice(withNl, 'diaoColumns')
  check(
    '声明收口在文件尾：**末尾无换行**与**有换行**切出同一段（否则是切片器自造的假差异）',
    eofA.v != null && eofA.v === eofB.v && eofA.v.split('\n').length === 3,
    eofA.e || eofB.e
      ? `抛错：${eofA.e || eofB.e}`
      : `无换行 ${eofA.v == null ? 'null' : eofA.v.split('\n').length + ' 行'} / 有换行 ${eofB.v == null ? 'null' : eofB.v.split('\n').length + ' 行'}（应都是 3 行且逐字相同）`,
  )

  /*
   * ⑮ 洞④：**泛型实参里的类型字面量**不许被当成函数体（2026-09-20 Task 3.6 补）。
   *
   * `const q = reactive<{\n a: string\n}>({ a: '' })` 里那个类型字面量的 `{`
   * 「栈空 + 后面紧跟换行」两条全中 ⇒ 修前被判成函数体，从它配平到类型字面量的 `}` 就返回
   * ⇒ **初值整段被丢掉**。而切出来那段**括号是配平的** ⇒ 结构性硬闸不报 ⇒ 假绿。
   * 受害真形状：Home `queryForm`(REF:1237–1243) · `financeOrder`(1388–1394) ·
   * `DetailLinesTable.vue` 的 `props`(68–112) · `emit`(114–119)。
   *
   * ⚠️ 断言一律写**逐字相等**（比「几行」强）：修前/修后的行数**都是 3**（见下），
   *    差别在**末行内容** —— 修前末行是 `}`、修后是 `}>({ a: '' })`。
   *    （简报把这段写成「4 行」是数错了：`}` 与 `>({ … })` 在**同一行**上，
   *      真声明就是 3 行 —— 实测见 task-3.6-report.md。）
   */
  const genSrc = (field, init) => ['const q = reactive<{', `  a: ${field}`, `}>({ a: ${init} })`].join('\n')
  const genR = trySlice(genSrc('string', "''"), 'q')
  check(
    '泛型实参里的类型字面量 + 初值 → 切出**整个声明**（含 `>({ a: … })`）',
    genR.v === genSrc('string', "''"),
    genR.e ? `抛错：${genR.e}` : `实得 ${JSON.stringify(genR.v)}`,
  )
  // 第 2 行（类型字面量里的字段）改坏必须报红 —— 若切片只到 `}` 这一步是绿的（洞④）。
  const genDiff = sliceDiff(genSrc('string', "''"), genSrc('number', "''"), 'q')
  check(
    '泛型类型字面量里的**字段**被改坏 → 报红且定位到第 2 行',
    genDiff.diff === 2,
    genDiff.why ? `切不出来：${genDiff.why}` : `期望首个差异在第 2 行，实得 ${genDiff.diff ?? -1}`,
  )
  /*
   * ⚠️ **这一条是本次修复的证明**：修前它是**绿的**（`firstDiffLine` = 0，初值根本没被比）。
   *    实测（task-3.6-report.md）：`sawParen` 闩退回「只判栈空」时，这条立刻变 0 并报红。
   */
  const genInit = sliceDiff(genSrc('string', "''"), genSrc('string', "'x'"), 'q')
  check(
    '泛型声明的**初值**被改坏 → 报红且定位到第 3 行（修前这里是 0 = 假绿）',
    genInit.diff === 3,
    genInit.why
      ? `切不出来：${genInit.why}`
      : `期望首个差异在第 3 行，实得 ${genInit.diff ?? -1}（0 = 初值根本没被比对 ⇒ 洞④ 复发）`,
  )
  // 同族第 2 例：`| null>(null)` 写法（Home 的 `financeOrder` 就是这个形状）。
  const genNullSrc = (init) => ['const f = ref<{', '  id: number', `} | null>(${init})`].join('\n')
  const genNullR = trySlice(genNullSrc('null'), 'f')
  check(
    '`ref<{ … } | null>(null)` → 切出整个声明（`| null>(null)` 不许被丢掉）',
    genNullR.v === genNullSrc('null'),
    genNullR.e ? `抛错：${genNullR.e}` : `实得 ${JSON.stringify(genNullR.v)}`,
  )
  /*
   * 等价性回归：**多行对象字面量当整个初值**（`const o = {` + 换行）。
   * 修前那条 `{` 是走「函数体」那条路（从 `{` 配平到 `}` 就返回）；修后不再当函数体 ⇒
   * 走「语句末」。两者必须切出**同一段** —— 否则修洞④ 就顺带改了这一族的切片。
   * 真形状：Home `homeDetailHooks`(REF:1942) · `rowTipHandlers`(2780)，实测两者修前修后逐字相同。
   */
  const objSrc = ['const o = {', '  a: 1,', '  b: 2,', '}'].join('\n')
  const objR = trySlice(objSrc, 'o')
  check(
    '等价性：`const o = {` + 换行（多行对象字面量当整个初值）→ 仍切出整段',
    objR.v === objSrc,
    objR.e ? `抛错：${objR.e}` : `实得 ${JSON.stringify(objR.v)}`,
  )

  /*
   * ⑯ 快车道判据是 **`depth <= 0`**，不是 `=== 0`（2026-09-20 Task 3.6 补的断言）。
   *
   * 核心文件头 / 「路 1」明文论证过：正则字面量里的 `)` 让首行收支变**负**
   * （`const re = /)/`），而那一行**本来就是完整的**，必须走「单行声明」那条路。
   * 把 `<= 0` 改成 `=== 0` 时这一例从「1 行」变成**抛错**（跨行扫描 → bail → 退回首行 →
   * 那一行带着未配平的 `)` ⇒ 硬闸拦下），而**此前 `--selftest` 仍然 EXIT=0**：
   * 原来钉收支的那条用的是收支 **0** 的 `const EMPTY_FILTER_VALUE = '__EMPTY__'`
   * （见下 ⑬ 反向那例）—— **负收支没被钉住**。这一条就是补那个缺口。
   */
  const negR = trySlice(['const re = /)/', 'const NEXT = 1'].join('\n'), 're')
  check(
    '负收支的单行声明（`const re = /)/`）→ 切出 **1 行**且不抛（`<= 0` 改成 `=== 0` 即红）',
    negR.v === 'const re = /)/',
    negR.e ? `抛错：${negR.e}（快车道判据大概被改成了 \`=== 0\`）` : `实得 ${JSON.stringify(negR.v)}`,
  )

  /*
   * ⑰ 路 3 的 lookahead **要跳过注释行**（2026-09-20 Task 3.6 补的断言）。
   *
   * prettier 风格的联合类型把 `|` 写在下一行行首，靠 `headContinues()` 看下一行行首判「还续」；
   * 而它中间**夹一行 `//` 注释**时，若不跳过注释行，就会在注释处停住 ⇒ 只切出前半段。
   *
   * ⚠️ **这是「现存」不是「潜在」**（2026-09-20 Task 3.7 改准；本节此前写「仓库里 0 处」，**错**）：
   *    全 `app/src` 有 **3 个声明**是这个形状（2026-09-20 Task 3.8 实测改准 —— Task 3.7 写的是
   *    「**1 个**」，**那个数也是错的**，这一段至今错过三次：`task-3.6-report.md` §6🟠4 的「0 处」
   *    → Task 3.7 的「1 个」→ 本次实测「3 个」，**以本次为准**）：
   *    | 声明 | 现核 | 去掉跳注释后 |
   *    |---|---|---|
   *    | `app/src/utils/docsheet/profile.ts::CellKind` | 7 行 · 与解析器逐字相同 | 3 行（**切短**）|
   *    | `app/src/utils/printPayloads.ts::src` | 10 行 · 与解析器逐字相同 | 3 行（**切短**）|
   *    | `app/src/utils/printPayloads.ts::suppress` | 6 行 · 与解析器逐字相同 | 3 行（**切短**）|
   *    三个**现在都是对的**，而且**都是「跳注释行」这条判据在守着它们**
   *    ⇒ 断言 ⑰ 不是「守一个现存声明」，是**守三个**（比文档说的更强）。
   *    其中 `CellKind` 夹的是 `/** … *\/`：
   *    ```ts
   *    export type CellKind =
   *      /** `renderMultiline` —— 富文本按 `<br>` 切行 *\/
   *      | 'multiline'
   *      …
   *    ```
   *    ⇒ **`//` 与 `/** *\/` 两种注释都要跳**（`headContinues` 里的 `t.startsWith('/*')`
   *      与 `t.startsWith('*')` 就是为 `/** *\/` 的起始行与续行准备的）——
   *      只跳 `//` 的话，`CellKind` 会立刻变成一张**假绿卡**。
   *    ⚠️⚠️ **⑰ 只钉了 `//` 那一半**：`/** *\/` 那一半此前**只在文档里守着、断言里没有**
   *      （实测：判据改成只跳 `//` 后 `--selftest` 仍 **EXIT=0 · ✓32 ✗0**）。
   *      Task 3.8 补了 **㉒** 专钉 `/** *\/`，两条合起来才覆盖「两种注释都要跳」。
   *    ⚠️ 量法：对每个可整体搬走的声明，**在 `/tmp` 副本里**把 `core:333` 整行改成
   *      `if (t === '') {`（三个注释分支全去掉），跑**全部**声明，看切片文本变了的那些。
   *      实测恰好 3 个（分母 = 3640 个非重名可比声明），**且三个都从 `same` 变成 `short`**。
   */
  const unionCmtSrc = (last) =>
    [
      'type K =',
      "  | 'a'",
      '  // 这里夹一行注释（真实代码里没有，但判据不许因此断掉）',
      "  | 'b'",
      `  | '${last}'`,
    ].join('\n')
  const ucmtR = trySlice(unionCmtSrc('c'), 'K')
  check(
    '联合类型中间夹一行 `//` 注释 → 仍切出**整段**（含注释后那两行）',
    ucmtR.v === unionCmtSrc('c'),
    ucmtR.e ? `抛错：${ucmtR.e}` : `实得 ${JSON.stringify(ucmtR.v)}`,
  )

  /*
   * ⑱ 路 1（快车道）必须看**下一行行首**（2026-09-20 Task 3.7 补）。
   *
   * 这一例钉的是**第五个洞**（复审 §2🟠2）：路 1 的判据只看**首行自己**
   * （收支 ≤ 0 + 行尾不是续行记号 + 首行没有未闭合的串），于是
   * ```ts
   * const theadCells = cols     ← 收支 0、行尾是 `cols`（不在行尾表里）
   *   .map(…)                   ← 声明在下一行继续，但快车道根本不看这一行
   * ```
   * 会被切成 **1 行**并返回；而 `fast: true` 让 `sliceFn` **跳过结构性硬闸**
   * ⇒ 「配平、不报错、只有 1 行」地被拿去比对 ⇒ **假绿卡**。
   * 实测受害 **33 处**（含 6 处顶层），形状最多的是「下一行以 `.` / `?` 开头」
   * （`printPayloads.ts::{main,src,casing,suppress}` · `partsEngine.ts::bad` ·
   *  `docsheet/paginate.ts::{theadCells,bodyRows,tds}` …）。
   *
   * ⚠️ 判据必须**经过 `sliceFn`**（走 `sliceDiff`），不能只比 `norm` 的两段常量 ——
   *    洞就长在 `sliceFn` 的路 1 里。断言里同时钉**切片行数**：只钉 `diff` 的话，
   *    万一哪天切成 2 行却内容错位，这一例仍可能碰巧是 2。
   * ⚠️ **变异 M-a**（把路 1 里那条 `&& !headContinues(…)` 去掉）下这一例必须红 ——
   *    实测就是红（切片退回 1 行、`diff` 变 0）。这不是「顺手加的断言」。
   */
  const chainSrc = (meth) => ['const x = foo', `  .${meth}()`].join('\n')
  const chainR = sliceDiff(chainSrc('bar'), chainSrc('baz'), 'x')
  const chainGot = chainR.text ?? null
  check(
    '路 1 快车道看**下一行行首**：成员链断行（下一行 `.` 开头）**改第 2 行** → 报红且定位第 2 行',
    chainR.diff === 2 && chainGot != null && chainGot.split('\n').length === 2,
    chainR.why
      ? `切不出来：${chainR.why}`
      : `切片 ${chainGot?.split('\n').length} 行（应 2）、首个差异在第 ${chainR.diff ?? -1} 行（应 2；0 = 快车道只切了首行 ⇒ 洞复发）`,
  )
  /*
   * 同一条判据的**第二个记号**：下一行以 `?` 开头（三元断行）。
   * `?` 与 `.` 是 `HEAD_CONTINUES` 里两个不同的 token —— 只钉一个等于「只在单侧被钉住」
   * （洞③ 的教训）。真形状：`app/src/utils/partsEngine.ts::bad`
   * （`const bad = !isSecondPass && mainLt1` + 下一行 `? …`）。
   */
  const ternSrc = (then) => ['const bad = a && b', `  ? ${then}`, '  : c'].join('\n')
  const ternR = sliceDiff(ternSrc('x'), ternSrc('y'), 'bad')
  const ternGot = ternR.text ?? null
  check(
    '路 1 快车道看**下一行行首**：三元断行（下一行 `?` 开头）**改第 2 行** → 报红且定位第 2 行',
    ternR.diff === 2 && ternGot != null && ternGot.split('\n').length === 3,
    ternR.why
      ? `切不出来：${ternR.why}`
      : `切片 ${ternGot?.split('\n').length} 行（应 3）、首个差异在第 ${ternR.diff ?? -1} 行（应 2；0 = 快车道只切了首行 ⇒ 洞复发）`,
  )

  /*
   * ⑲ 行尾续行记号必须含 **`<`**（2026-09-20 Task 3.7 补）。
   *
   * 泛型形参/实参断行的声明，首行以 `<` 收尾：
   * ```ts
   * export interface DocSheetRenderApi<     ← `<` `>` 不在括号栈里 ⇒ 首行收支正好 0
   *   C = DocSheetConfig,
   *   …
   * > {
   * ```
   * `'<'` 缺了行尾表、下一行又以 `T`（普通标识符）开头 ⇒ `headContinues` 也拦不住
   * ⇒ **两条修法各管一半**：实测那 6 处**顶层**受害者（真声明 22/10/24/46/5/5 行）
   * **全靠 `<` 这一条**，而 33 处里的嵌套那些**全靠 `headContinues`**。少任何一条都还有一半在漏。
   *
   * ⚠️ **变异 M-b**（把 `'<'` 从 `TAIL_CONTINUES` 里去掉）下这一例必须红 ——
   *    实测就是红（切片退回 1 行、`diff` 变 0）。这一例**只在 M-b 下红**，
   *    ⑱ 只在 M-a 下红 ⇒ 两条修法各有一条**独立**的钉。
   */
  const genIfaceSrc = (param) => ['export interface X<', `  ${param},`, '> {', '  a: T', '}'].join('\n')
  const giR = sliceDiff(genIfaceSrc('T extends string'), genIfaceSrc('T extends number'), 'X')
  const giGot = giR.text ?? null
  check(
    '行尾续行记号含 `<`：泛型断行（`export interface X<`）**改第 2 行** → 报红且定位第 2 行',
    giR.diff === 2 && giGot != null && giGot.split('\n').length === 5,
    giR.why
      ? `切不出来：${giR.why}`
      : `切片 ${giGot?.split('\n').length} 行（应 5）、首个差异在第 ${giR.diff ?? -1} 行（应 2；0 = 快车道只切了首行 ⇒ 洞复发）`,
  )

  /*
   * ㉑ 行**首**续行记号必须含 **`'>'`**（2026-09-20 Task 3.8 补）。
   *
   * 与 ⑲ 是**两条不同的判据**、各管一半，别互相顶替：
   *   · ⑲ 管的是**首行以 `<` 收尾**（`export interface X<`）—— 靠 `TAIL_CONTINUES` 里的 `'<'`；
   *   · ⑳ 管的是首行**不收尾于 `<`**、而**泛型实参表收尾的那个 `>` 独占一格**留在下一行：
   *     ```ts
   *     export type ProductionSheetUiProfile = DocSheetDialogProfile<
   *       ProductionSheetRow,
   *       ProductionSheetRenderOptions
   *     >                            ← 这一行 trim 后就是孤零零一个 `>`，谁都不认得它
   *     ```
   *     中间几行收尾既不是 `<` 也不在行尾表里 ⇒ 只有**看下一行行首**才拦得住。
   *
   * ⚠️ **`'>'` 不在表里时这一例必须红**（切片停在第 3 行、第 4 行的改动看不见、`diff` 变 0）。
   *    实测受害的两个真声明：`productionSheetUiProfile.ts::ProductionSheetUiProfile`
   *    （收尾 `>` 在第 44 行）· `qualifiedLabelUiProfile.ts::QualifiedLabelUiProfile`（第 70 行）——
   *    都在 `decl-sweep.mjs` 的「切短」名单里，加 `'>'` 后两条都变成「逐字相同」（3505 → 3507）。
   *
   * ⚠️ 变异写法：**改第 4 行**取 `>` → `> & Extra`（一条真实的续写形状，不是乱改）——
   *    这样「第 4 行有没有被切进切片」才是唯一变量。
   */
  const genArgSrc = (tail) => ['export type X = Y<', '  A,', '  B', tail].join('\n')
  const gaR = sliceDiff(genArgSrc('>'), genArgSrc('> & Extra'), 'X')
  const gaGot = gaR.text ?? null
  check(
    "行首续行记号含 `>`：泛型实参表收尾的 `>` 独占一格 → **改第 4 行** → 报红且定位到第 4 行",
    gaR.diff === 4 && gaGot != null && gaGot.split('\n').length === 4,
    gaR.why
      ? `切不出来：${gaR.why}`
      : `切片 ${gaGot?.split('\n').length} 行（应 4）、首个差异在第 ${gaR.diff ?? -1} 行（应 4；0 = \`'>'\` 不在行首表里 ⇒ 收尾那行根本没进切片）`,
  )

  /*
   * ㉒ `headContinues` 跳过注释行的 **`/*` `*` 那一半** 必须有断言（2026-09-20 Task 3.8 补）。
   *
   * ⚠️ 这一条补的是一个**真实存在的洞**：⑰（上面）只钉了 `//` 那一半，而文档
   *    （本文件上面 ⑰ 的注释）白纸黑字写着「`//` 与 `/** *\/` 两种注释都要跳」
   *    「只跳 `//` 的话，`CellKind` 会立刻变成一张假绿卡」—— **断言里却没有 `/** *\/` 的样本**。
   *    实测：把判据改成 `if (t === '' || t.startsWith('//')) {`（只去 `/*` 与 `*`、保留 `//`）后
   *    `--selftest` 仍然 **EXIT=0 · ✓32 ✗0**，而 `profile.ts::CellKind` 的切片
   *    **从 7 行变成 3 行**（真的切短了）。**这就是「声称强度 > 断言强度」。**
   *
   * ⚠️ ⑫（上面那条 `headerFilter`）里**也有 `/**`**，但它夹在 `opt: { … }` **大括号里面**
   *    ⇒ 括号栈非空 ⇒ **根本不走 `headContinues`** ⇒ **不能**算作这条判据的断言。
   *    别拿 ⑫ 顶替 —— 「看起来有覆盖、其实没有」正是本条要治的病。
   *
   * 样本 = `CellKind` 的真实形状（`app/src/utils/docsheet/profile.ts:79-85`）：
   * 联合类型成员之间夹的是 `/** … *\/` 而**不是** `//`，全仓库**共 3 个声明**是这个形状
   * （另两个是 `printPayloads.ts::{src,suppress}`，它们夹的是 `//` ⇒ 由 ⑰ 管）。
   */
  const cellKindSrc = (last) =>
    [
      'type CellKind =',
      '  /** `renderMultiline` —— 富文本按 `<br>` 切行 */',
      "  | 'multiline'",
      '  /** 二维码 SVG（`qrSize`）+ 居中单号字幕（按 `/` 折行） */',
      "  | 'order'",
      `  | '${last}'`,
    ].join('\n')
  const ckR = sliceDiff(cellKindSrc('count'), cellKindSrc('amount'), 'CellKind')
  const ckGot = ckR.text ?? null
  check(
    '联合类型成员之间夹 `/** */` 注释 → 仍切出**整段**（`/*` `*` 那一半去掉即红）',
    ckR.diff === 6 && ckGot != null && ckGot.split('\n').length === 6,
    ckR.why
      ? `切不出来：${ckR.why}`
      : `切片 ${ckGot?.split('\n').length} 行（应 6）、首个差异在第 ${ckR.diff ?? -1} 行（应 6；0 = 在 \`/** */\` 处停住 ⇒ \`CellKind\` 变假绿卡）`,
  )

  /*
   * ㉓ 行首续行记号 **`'&'`**（交叉类型断行）（2026-09-20 Task 3.8 补）。
   *
   * `&` 与 `|` 是 `HEAD_CONTINUES` 里两个不同的 token —— 只钉一个等于「只在单侧被钉住」。
   * 实测：把 `'&'` 从 `HEAD_CONTINUES` 里去掉，此前 `--selftest` **仍然 EXIT=0 · ✓32 ✗0**
   * （仓库里当前 0 处 `&` 这个形状 ⇒ 是**潜在**，但按本项目既有标准，每条判据都要「改坏即红」）。
   */
  const interSrc = (last) => ['type X = A', `  & ${last}`].join('\n')
  const inR = sliceDiff(interSrc('B'), interSrc('C'), 'X')
  const inGot = inR.text ?? null
  check(
    "行首续行记号含 `&`：交叉类型断行（下一行 `& B` 开头）**改第 2 行** → 报红且定位到第 2 行",
    inR.diff === 2 && inGot != null && inGot.split('\n').length === 2,
    inR.why
      ? `切不出来：${inR.why}`
      : `切片 ${inGot?.split('\n').length} 行（应 2）、首个差异在第 ${inR.diff ?? -1} 行（应 2；0 = \`'&'\` 不在行首表里）`,
  )

  /*
   * ㉔ `headContinues` **跳过空行**（2026-09-20 Task 3.8 补）。
   *
   * 声明在「下一行是**空行**、再下一行才续」时，若不再跳空行，lookahead 会在空行处
   * 判「不续」⇒ 切片停在第 1 行。实测：把 `t === ''` 那个分支去掉，此前 `--selftest`
   * **仍然 EXIT=0 · ✓32 ✗0**（同样是**潜在**、仓库里当前 0 处）。
   *
   * ⚠️ 断言里的行号是 **`norm()` 之后**的行号：`norm()` 会**丢掉空行**（那是它的契约），
   *    所以「改第 3 行」在 `firstDiffLine` 眼里是**第 2 行**。同时钉 `split('\n')` 的**原始**
   *    行数 3 —— 两个数一起才说明「空行与续行都被切进来了」。
   */
  const blankSrc = (last) => ['type X = A', '', `  | ${last}`].join('\n')
  const blR = sliceDiff(blankSrc('b'), blankSrc('c'), 'X')
  const blGot = blR.text ?? null
  check(
    "下一行是**空行**、再下一行才续 → 仍切出整段（`t === ''` 那个分支去掉即红）",
    blR.diff === 2 && blGot != null && blGot.split('\n').length === 3,
    blR.why
      ? `切不出来：${blR.why}`
      : `切片 ${blGot?.split('\n').length} 行（原始，应 3）、首个差异在第 ${blR.diff ?? -1} 行（norm 后，应 2；0 = 在空行处停住 ⇒ 续行没被切进来）`,
  )

  process.exit(bad ? 1 : 0)
}

/**
 * ⚠️ 参照**先取一次、且必须取到** —— 放在 block 循环**外面**是有意的：
 * `BLOCKS` 为空时循环体一次都不跑，若把 `git show` 写在循环里，`BLOCKS = []` 会让
 * 脚本**根本不碰 git** ⇒ 参照取不到也退 0。那就是「未运行 ≠ 通过」的反面（假绿）。
 * 所以这里无条件先取参照：取不到就 fail-loud。
 */
let refSrc
try {
  // 用 execFileSync（不经 shell）：ref 是命令行参数，走 shell 拼串既怕空格也怕注入。
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
  // `names` / `consts` 都可省 —— 摊平与 `|| []` 的守卫都在 `blockNames()` 里（自测有一例钉住）。
  for (const name of blockNames(b)) {
    /*
     * ⚠️ `sliceFn` 现在会**抛**（结构性硬闸：切出来不配平就报错，见 `lib/extract-movecheck-core.mjs`
     * 文件头）。这里把它转成一条**计入 fail 的**错误 —— 让它抛出去的话，整个脚本崩掉、
     * 后面的名字一条都不查，而这条信息本身（哪个名字、为什么不配平）是有用的。
     *
     * ⚠️ 姊妹件（Hui 版）**此前没有**这层 try/catch，理由是「别为了变绿去动清单」。
     *    Task 3.6（🟡5）判定那个理由站不住：**「不加 try/catch」与「别动清单」是两件事** ——
     *    `fail.push + continue` 不会让任何东西变绿（退出码仍是 1）。所以那边**也补了**同款壳
     *    （两轮循环各一层），Hui 侧的判据/清单/`REWRITES`/文案一字未动。
     *    实测：往 `computeSquare` 体里塞 `/)/`，加之前是未捕获异常、第一条循环就中止；
     *    加之后是一条失败行 + 其余 92 条照跑 —— 两种都退 1。
     */
    let o, n
    try {
      o = sliceFn(refSrc, name)
      n = sliceFn(newSrc, name)
    } catch (e) {
      fail.push(`${name}: ${e.message}`)
      continue
    }
    if (!o) { fail.push(`${name}: 在参照 ${REF}:${OLD_PATH} 里找不到（清单写错了？）`); continue }
    if (!n) { fail.push(`${name}: ${b.target} 里找不到 —— 没搬过去？`); missing.push(name); continue }
    // ⚠️ 顺序：**先归一化再套改写规则**。`norm()` 去了行首缩进，多行的 `from` 片段匹配不上。
    const a = applyRewrites(name, norm(o), rules)
    const nb = norm(n)
    const at = firstDiffLine(a, nb)
    if (at === 0) { pass++; continue }
    const A = a.split('\n'), B = nb.split('\n')
    const diffs = []
    for (let i = at - 1; i < Math.max(A.length, B.length) && diffs.length < 6; i++) {
      if (A[i] !== B[i]) diffs.push(`    L${i + 1}\n      旧: ${String(A[i]).slice(0, 150)}\n      新: ${String(B[i]).slice(0, 150)}`)
    }
    fail.push(`${name}: 归一化后仍不一致（旧 ${A.length} 行 / 新 ${B.length} 行）\n${diffs.join('\n')}`)
  }
}

// 反向检查：搬走的定义不该在 Home.vue 里留下第二份（否则两份实现会各自漂移）。
// ⚠️ 这里做成**失败**而不是姊妹件那样的警告：清单里写「搬走了」= 同一笔里必须删干净，
//    留着就是「改了一处忘了另一处」——那种不一致是 bug，不是提示。
const after = readFileSync(`${ROOT}/${OLD_PATH}`, 'utf8')
// 前缀含 `async` 的道理与自测那一例同源 —— 见 `declares()` 上方的注释。
const dupe = allNames().filter((n) => declares(after, n))

console.log(`搬迁保真检查（${REF}:${OLD_PATH} → ${BLOCKS.length} 个目标文件）`)
console.log(`  逐字一致：${pass} 个`)
if (missing.length) console.log(`  未搬走：${missing.length} 个`)
if (dupe.length) console.log(`  ⚠️ Home.vue 里仍有同名定义（应已删除）：${dupe.join(', ')}`)
if (fail.length) {
  console.log(`\n✗ ${fail.length} 处不符：`)
  fail.forEach((f) => console.log('  - ' + f))
  process.exit(1)
}
if (dupe.length) {
  console.log('\n✗ 清单里已声明搬走、Home.vue 里却仍有同名定义（两份实现会各自漂移）：')
  dupe.forEach((n) => console.log('  - ' + n))
  process.exit(1)
}
/*
 * 收尾的**判定句必须以条数为条件** —— 不能无条件打绿勾。
 *
 * 起因（复审 Minor 1）：原来这里无条件打 `✓ 清单内全部一致`，于是 `BLOCKS` 为空
 * （或每个 block 的 `names`/`consts` 都空）时，`run-all` 照样把它显示成 ✅ ——
 * 那正是 `run-all.mjs` 文件头明文禁止的那类混淆：**分不出「查了 0 个名字」和「全一致」**
 * （「未运行 ≠ 通过」）。
 *
 * ⚠️ 条数用 `total`（清单声明了多少条），不是 `pass`：
 *    走到这里时 `pass === total` 恒成立（任何没通过的条目都已经 `fail.push` 并在上面退 1），
 *    但**空转**看的是「清单里有没有东西」，与「比过几条」是两回事 —— 别弄反。
 * ⚠️ 空转**仍退 0**：「清单还是空的」不是被检代码的失败，不该把整套 verify 弄红。
 *    但它打的是 ⚠️ 说明，不是绿勾 —— 读的人必须看得出「这次什么都没验」。
 */
const total = BLOCKS.reduce((n, b) => n + blockNames(b).length, 0)
if (total === 0) {
  // ⚠️ **只打一行、且这一行必须在最后** —— `run-all.mjs` 的汇总只取 stdout 的**最后一行非空行**
  //    当说明文字。拆成两行的话，被显示出来的是后一行，看汇总的人就看不到「0 条」这个关键字了。
  console.log('\n⚠️ 清单内 0 条 —— 守卫此刻**空转**，未保护任何代码 —— 往 BLOCKS 里加条目才有用（见文件头「一条的形状」）。')
} else {
  console.log(`\n✓ 清单内 ${pass} 条全部一致 —— 搬迁未改动任何逻辑`)
}
