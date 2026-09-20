/*
 * 「搬迁保真」检查 —— 证明引擎代码从 Hui.vue 搬到 useOrderLines.ts 时**逐字未改**。
 *
 * 为什么要这个：本项目栽过「手抄旧版源码导致转写错误」（见 00-summary 末尾）。
 * 把 800 行从一个文件搬到另一个文件，风险与手抄同类 —— 而 `npm run build` 绿**证明不了**
 * 语义没变（少一个 `?? 0`、`Math.max` 写成 `Math.min` 都照样过编译）。
 * 所以这里拿 `git show <ref>:app/src/views/Hui.vue` 的**搬迁前**原文，
 * 与新文件里的同名函数逐字比。
 *
 * 比的是**函数体归一化后的文本**：
 *   · 去掉每行行首缩进（引擎进了工厂函数，整体多缩进 2 格）
 *   · 折叠行尾空白
 *   · `//` 注释保留（注释也是文档，改了要看得见）
 *
 * 用法：
 *   node docs/home-audit/hui-extract-movecheck.mjs              # 与默认参照比（两半一起）
 *   node docs/home-audit/hui-extract-movecheck.mjs <ref>        # 与指定 ref 比（**只换引擎那半**）
 *   node docs/home-audit/hui-extract-movecheck.mjs --selftest   # 只跑 C 块那半的自测（不碰 git）
 *
 * ⚠️ **声明的改写**（`REWRITES`）只有这些，多一处都要报错：
 *   出现「未声明的差异」= 搬迁过程中动了逻辑，必须回查。
 *
 * ## 两轮
 *
 * · **第一轮**（步骤 1）：引擎 → `composables/useOrderLines.ts`，参照 `git show <ref>:Hui.vue`。
 * · **第二轮**（步骤 3b）：列/单元格/行级编辑态 → `components/DetailLinesTable.vue`。
 *
 * ⚠️ **第二轮用的是一个过渡期参照**：步骤 1/2/3a 的改动当时还没提交，`HEAD` 对「被那三步
 * 动过的函数」是过期的（`opsCol`/`rowClassName` 在步骤 2 改过、`pingCols` 在 3a 改过）。
 * 所以那一批拿 `/tmp/moved3b.ts` —— **3b 动手前一刻从工作区切出来的原文** —— 当参照。
 *
 * 这个快照是**临时的**：等步骤 1–5 提交之后，`HEAD` 就成了正确参照，那个文件可以不要
 * （找不到时脚本会退回过期会话并打印提示，不会静默放过）。
 *
 * ## 🔴 本脚本现在有**两半**，各钉各的参照 —— 别合并（2026-09-20 加的第二半）
 *
 * | 半 | 参照 | 旧文件 | 验什么 |
 * |---|---|---|---|
 * | **引擎 + 组件**（`MOVED` / `MOVED_CONSTS` / `MOVED_TO_COMPONENT`） | `d6057283` | `app/src/views/Hui.vue` | 引擎 → `useOrderLines.ts`；列/单元格/编辑态 → `DetailLinesTable.vue` |
 * | **C 块**（`SPLIT_BLOCKS`） | **`28e36d21`** | **同一个** `Hui.vue` | 2026-09-20 的 Hui 拆分（C1–C13）→ 各新文件 |
 *
 * ⚠️ **为什么不能把上面那个 `REF` 直接改成 `28e36d21`**（**实测**，不是推理）：
 *   `d6057283` 是**引擎抽取之前**的快照；而 `28e36d21:Hui.vue` 是**抽取之后**的
 *   （与当前工作区的 `Hui.vue` 逐字节相同）⇒ 拿它去查引擎那 47 项，
 *   **47 项全部「在参照提交里找不到」、EXIT 1**。
 *   两个参照各自服务一半，所以 `SPLIT_REF` 是**另加的一个常量**，不是把 `REF` 换掉。
 *   （这条 plan `:36` 与 spec §8.2-4 都明写着，别「顺手统一」。）
 *
 * ### C 块怎么登记（`SPLIT_BLOCKS`）
 *
 * 形状与 Home 守卫的 `BLOCKS` **逐字同形**（那边也是多目标 manifest）：
 *   { target: 'app/src/composables/hui/xxx.ts',   // 相对仓库根；多个目标就写多条 block
 *     names:  ['foo', 'bar'],                     // function / 箭头函数都算
 *     consts: ['BAZ'],                            // const / type / interface（含 computed / ref）
 *     rewrites: { foo: [{ from: '…', to: '…' }] } }
 *
 * `rewrites` 里每条 `from` 都必须在旧文里**找得到**（找不到 `applyRewrites` 会抛 —— 白送的检查）；
 * 反过来**漏登记不会抛**，只表现成 diff ⇒ 改完必须**逐行看 diff**，不能只看退出码。
 * 规则一律**带边界**（写 `dialog.warning({` 而不是 `dialog`）：它是朴素 `split/join`，
 * 裸名会把别的标识符一起改坏（写 `load` 会顺手打到 `loadedIds` 上）。
 *
 * ⚠️ **空清单必须照常绿**（C 块还没动时）：`SPLIT_BLOCKS = []` ⇒ 循环一次都不跑、
 *   不报错、退出码仍是 0；收尾那一行会**明说「C 块清单 0 条」**，别把那个绿当成「C 块验过了」。
 *
 * ### ⚠️ 能力边界（C 块这一半；引擎那半的老边界见 `lib/extract-movecheck-core.mjs` 文件头）
 *
 * 1. **只验清单里点名过的名字**。没搬的、搬了却忘了登记的，它**完全不知道** ⇒
 *    「本脚本绿」只等于「清单内逐字一致」，**不等于「搬迁完整」**。
 * 2. **它抓不到「登记本身写错」**（2026-09-20 在 Home 侧实测撞出来的）：
 *    它证明的是「搬迁**符合登记过的改写**」，**不是**「登记过的改写**是对的**」——
 *    `rewrites` 写错时，参照侧套的是**同一份错规则** ⇒ **两边同错** ⇒ 归一化后逐字一致、
 *    **照样绿**。实证：Home 的 B4 第一版把该块**自己拥有**的三个 ref 也当成注入项、
 *    体里写成 `deps.orderNoInput.value` ⇒ **8 处 `TS2339`**，而守卫**全绿**。
 *    ⇒ 抓这一类的是 **`vue-tsc` / `npm run build`**。
 *    **结论：守卫与 `vue-tsc` 必须成对跑，缺一不可** —— 守卫管「搬的时候有没有偷偷改」，
 *    `vue-tsc` 管「搬完的名字与形状对不对」。只跑一个都会漏掉另一半。
 * 3. **`sliceFn` 是文本切片器、不是解析器** —— 已知残留（泛型实参里的多行类型字面量、
 *    正则字面量里的括号、`${}` 与内层反引号、嵌套件…）逐条列在
 *    `lib/extract-movecheck-core.mjs` 文件头的「能力边界」。它每多认一种形状都要单独钉一例自测。
 * 4. **「绿」不等于「这段验过」**（本文件自己的历史，见 spec §9c）：Hui 侧曾有 4 个已登记的名字
 *    （`sqCell` / `cCol` / `sub` / `orderNoCell`）因为命中「单行声明」快车道、**只比了第一行**，
 *    而守卫照样报「逐字一致」。修好后它们**恰好**都是真的逐字一致 —— 恒等式的结论没变，
 *    但那 4 条绿从「空绿」变成了「真绿」。⇒ **别拿绿勾当覆盖率。**
 *
 * **登记前必做的验法**（别只看绿勾）：把该声明的**第二行**随便改一下 → 跑本脚本 →
 * **必须报红**；不红就别登记（登记了等于给自己发一张假绿卡）。改完**还原**。
 */
import { execFileSync, execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { applyRewrites, firstDiffLine, norm, sliceFn } from './lib/extract-movecheck-core.mjs'

// 仓库根从**本文件位置**推出（本文件在 `docs/home-audit/` ⇒ 往上**两级**才是仓库根）。
// 原来这里写死的是 `'/Users/aaa/Desktop/door-main'`：本机跑得通，换台机器或进 CI
// （checkout 路径不同）就直接崩。`docs/*.mjs` 那几个台子早就这么写了，差的正是这一层深度。
const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
/**
 * ⚠️ 参照**必须钉在本次重构之前的那个提交**（`d6057283`，2026-09-19）。
 * 不能用 `HEAD` —— 重构提交一落，HEAD 就是「搬完」的状态，两个文件的函数都已经被删了，
 * 全部会报「HEAD 里找不到」。
 */
const REF = process.argv[2] || 'd6057283'
const OLD_PATH = 'app/src/views/Hui.vue'
const NEW_PATH = `${ROOT}/app/src/composables/useOrderLines.ts`

// ─────────────────────────────────────────────────────────────────────────
// C 块（2026-09-20 的 Hui 拆分 C1–C13）—— 与上面两半**各钉各的参照**，见文件头「现在有两半」
// ─────────────────────────────────────────────────────────────────────────
/**
 * ⚠️ C 块这一半的参照是 **`28e36d21`**（Hui 拆分**动工前**那一个提交），与引擎那半的
 *   `d6057283` **不同**，两个都要留着。
 *
 *   🔴 **别把上面那个 `REF` 改成它**（实测）：`28e36d21:Hui.vue` 是**引擎抽取之后**的状态，
 *   拿它去查引擎那 47 项 ⇒ **47 项全部「找不到」、EXIT 1**。
 *   两个参照各自服务一半：`d6057283` 服引擎/组件那两轮，`28e36d21` 服 C 块。
 */
const SPLIT_REF = '28e36d21'
/** C 块搬的是**同一个** `Hui.vue`，只是参照提交不同 —— 单列一个名字，免得读的人以为它俩无关。 */
const SPLIT_OLD_PATH = OLD_PATH

/**
 * C 块（C1–C13）的搬迁清单。**每搬完一块就在这里加一条** —— 形状见文件头「C 块怎么登记」，
 * 与 Home 守卫的 `BLOCKS` 逐字同形（`{ target, names, consts, rewrites }`）。
 *
 * ⚠️ **它现在是空的**（2026-09-20 立骨架时）：这一半此刻**没有任何检验力**，
 *    收尾那一行会明说「C 块清单 0 条」。第一条由 C1 登记。
 */
const SPLIT_BLOCKS = [
  {
    // C1「加价项目管理」（旧版主页三弹窗：管理 → 新增 / 修改删除）。快照段 `Hui.vue:1108-1224`，13 个声明。
    // 改写只有「页面拥有的 `message`/`dialog` → 注入」这一件事；`markupCatalog` 家族是模块单例，
    // 新家直接 `import`（`composables/useMarkupCatalog.ts`），**不注入** ⇒ 那几处文本一字未动。
    target: 'app/src/composables/hui/useHuiMarkupMgmt.ts',
    names: [
      'openMarkupMgmt', 'openMarkupAdd', 'confirmMarkupAdd',
      'openMarkupEdit', 'pickMarkupEdit', 'confirmMarkupEdit', 'confirmMarkupDelete',
    ],
    consts: ['markupMgmtOpen', 'markupAddOpen', 'markupEditOpen', 'mgmtAdd', 'mgmtEdit', 'markupEditOptions'],
    rewrites: {
      // 只列**该声明体内真的出现**的规则（`applyRewrites` 找不到 `from` 会抛 —— 这是白送的检查）。
      // ⚠️ `message[ok ? 'success' : 'error']` 是**属性访问**、不是 `message.`，两条规则各管各的。
      confirmMarkupAdd: [
        { from: 'message.', to: 'deps.message.' },
      ],
      openMarkupEdit: [
        { from: 'message.', to: 'deps.message.' },
      ],
      confirmMarkupEdit: [
        { from: 'message.', to: 'deps.message.' },
      ],
      confirmMarkupDelete: [
        { from: "message[ok ? 'success' : 'error']", to: "deps.message[ok ? 'success' : 'error']" },
        { from: 'message.', to: 'deps.message.' },
        { from: 'dialog.', to: 'deps.dialog.' },
      ],
      // 其余 8 个名字体内没有 `message.`/`dialog.` ⇒ 零改写（不是漏写）。
      openMarkupMgmt: [],
      pickMarkupEdit: [],
      markupMgmtOpen: [],
      markupAddOpen: [],
      markupEditOpen: [],
      mgmtAdd: [],
      mgmtEdit: [],
      markupEditOptions: [],
    },
  },
  {
    // C2「列显隐」。快照是**两段**：`Hui.vue:1005-1104`（列清单/生效值/设置弹窗）+ `1258-1310`
    // （旧版租户默认值 + `loadColumnConfig`），中间隔着「自动加价设置」（属 C8）—— 非连续没关系，
    // 本脚本按**名字**逐条切片。两段合计 15 个声明。
    // ⚠️ 本块最要紧的不是逐字比对，而是 spec §6.1-1 的**引用同一性**：`pingColVis`/`diaoColVis`
    // 必须回传**同一个 `reactive` 对象**（原地 `delete`/`Object.assign` 是语义）——
    // 那条**本脚本验不了**（它只看文本），靠新家文件头 + 页面注释写明，并由 `vue-tsc` 兜形状。
    target: 'app/src/composables/hui/useHuiColumnConfig.ts',
    names: ['colVis', 'openVisDialog', 'resetVisDraft', 'saveVisDialog', 'seedColumnDefaults', 'loadColumnConfig'],
    consts: [
      'PING_VIS_KEYS', 'DIAO_VIS_KEYS', 'pingColVis', 'diaoColVis',
      'visOpen', 'visDraft', 'savingVis', 'PING_COL_DEFAULTS', 'DIAO_COL_DEFAULTS',
    ],
    rewrites: {
      // 全块**只有 `saveVisDialog` 里那两处**是页面拥有的东西（`message`）；`api` 是新家自己
      // `import` 的模块单例 ⇒ 不产生改写。其余 14 个名字**零改写**（不是漏写）。
      saveVisDialog: [{ from: 'message.', to: 'deps.message.' }],
      colVis: [],
      openVisDialog: [],
      resetVisDraft: [],
      seedColumnDefaults: [],
      loadColumnConfig: [],
      PING_VIS_KEYS: [],
      DIAO_VIS_KEYS: [],
      pingColVis: [],
      diaoColVis: [],
      visOpen: [],
      visDraft: [],
      savingVis: [],
      PING_COL_DEFAULTS: [],
      DIAO_COL_DEFAULTS: [],
    },
  },
  {
    // C3「收款码」。快照 `Hui.vue:810-848`（含 6 行原版考据注释），6 个声明。
    // 只有 `message` 一条注入改写；`imageStore` 四件是模块级单例，新家直接 import。
    target: 'app/src/composables/hui/useHuiPayQrcode.ts',
    names: ['loadPayQrcode', 'pickPayQrcode', 'removePayQrcode'],
    consts: ['PAY_QRCODE_KEY', 'payQrcodeUrl', 'payQrcodeOpen'],
    rewrites: {
      pickPayQrcode: [{ from: 'message.', to: 'deps.message.' }],
      removePayQrcode: [{ from: 'message.', to: 'deps.message.' }],
      loadPayQrcode: [],
      PAY_QRCODE_KEY: [],
      payQrcodeUrl: [],
      payQrcodeOpen: [],
    },
  },
  {
    // C4「外壳开关」。快照**两段**：`Hui.vue:883-896`（两表显隐）+ `918-959`（总余额/辅助菜单），
    // 中间隔着 `moreMenuOptions`（**不属本块**，留在页面）。两段合计 11 个声明。
    // 只有三个 onChange 里有 `message` ⇒ 3 处改写；三个 write* 是模块级单例，新家直接 import。
    target: 'app/src/composables/hui/useHuiShellToggles.ts',
    names: ['toggleShow', 'ensureShown', 'onTotalBalanceChange', 'onAssistiveMenuChange', 'onAssistiveFullscreenChange'],
    consts: ['showPing', 'showDiao', 'addTypeOpen', 'showTotalBalance', 'showAssistiveMenu', 'assistiveFullscreen'],
    rewrites: {
      onTotalBalanceChange: [{ from: 'message.', to: 'deps.message.' }],
      onAssistiveMenuChange: [{ from: 'message.', to: 'deps.message.' }],
      onAssistiveFullscreenChange: [{ from: 'message.', to: 'deps.message.' }],
      toggleShow: [],
      ensureShown: [],
      showPing: [],
      showDiao: [],
      addTypeOpen: [],
      showTotalBalance: [],
      showAssistiveMenu: [],
      assistiveFullscreen: [],
    },
  },
  {
    // C5「客户」。快照**两段**：`Hui.vue:1370-1410` + `2091-2093`（`currentClient`），6 个声明。
    // 注入 `order`/`lines`/`dialog`；`lastAppliedClient` 是**裸 `let`** ⇒ 登记它只为逐字比对，
    // 它**不回传值**（spec §6.2 要求 getter+setter 一对，那对新函数不在搬迁段内、本脚本不管）。
    target: 'app/src/composables/hui/useHuiClients.ts',
    names: ['applyClient', 'onClientChange'],
    consts: ['clients', 'clientOptions', 'lastAppliedClient', 'currentClient'],
    rewrites: {
      applyClient: [
        { from: 'order.', to: 'deps.order.' },
      ],
      onClientChange: [
        { from: 'order.', to: 'deps.order.' },
        { from: 'lines.value', to: 'deps.lines.value' },
        { from: 'dialog.', to: 'deps.dialog.' },
      ],
      currentClient: [{ from: 'order.', to: 'deps.order.' }],
      clients: [],
      clientOptions: [],
      lastAppliedClient: [],
    },
  },
  {
    // C6「模板预览」。快照 `Hui.vue:1988-2037`，7 个声明。
    // ⚠️ `templatePreviewOrders` 里那处是**整体断言**（`(order as unknown as OrderDto)`），
    //    不是 `order.` —— 所以单列一条规则；`orderId.value` 同理。
    target: 'app/src/composables/hui/useHuiPreview.ts',
    names: ['openTemplatePreview'],
    consts: [
      'templatePreviewOpen', 'templatePreviewLoading', 'templateList',
      'templatePreviewMode', 'templatePreviewTitle', 'templatePreviewOrders',
    ],
    rewrites: {
      openTemplatePreview: [
        { from: 'lines.value', to: 'deps.lines.value' },
        { from: 'message.', to: 'deps.message.' },
      ],
      templatePreviewOrders: [
        { from: 'lines.value', to: 'deps.lines.value' },
        { from: '(order as unknown as OrderDto)', to: '(deps.order as unknown as OrderDto)' },
        { from: 'orderId.value', to: 'deps.orderId.value' },
      ],
      templatePreviewOpen: [],
      templatePreviewLoading: [],
      templateList: [],
      templatePreviewMode: [],
      templatePreviewTitle: [],
    },
  },
  {
    // C7「终端链接」。快照 `Hui.vue:2084-2129`，但段内夹着的 `currentClient` 是 **C5** 的
    // （C5 先搬走了）⇒ 本块实收 5 个声明，`currentClient` 只作**注入**。
    // ⚠️ `tenantName`/`currentUserName` 会被 `onMounted` **回写** ⇒ 必须回传该 ref（本脚本只验搬迁）。
    target: 'app/src/composables/hui/useTerminalLink.ts',
    names: ['buildTerminalToken', 'copyTerminalLink'],
    consts: ['tenantName', 'currentUserName', 'terminalLink'],
    rewrites: {
      terminalLink: [
        { from: 'currentClient.value', to: 'deps.currentClient.value' },
        { from: 'order.', to: 'deps.order.' },
      ],
      copyTerminalLink: [
        { from: 'currentClient.value', to: 'deps.currentClient.value' },
        { from: 'message.', to: 'deps.message.' },
      ],
      tenantName: [],
      currentUserName: [],
      buildTerminalToken: [],
    },
  },
  {
    // C13「排序方式」。快照 `Hui.vue:1919-1932`，5 个声明。
    // ⚠️ `sortMethod` 本身还被**打印载荷**读（`:1775`）⇒ 必须回传该 ref —— 少回传不报错，
    //    只是生成的单据行顺序永远走默认。本脚本只验搬迁，回传面靠新家文件头 + 页面注释钉住。
    target: 'app/src/composables/hui/useHuiSortMethod.ts',
    names: ['openSortMethod', 'saveSortMethod'],
    consts: ['sortMethod', 'sortMethodOpen', 'sortMethodDraft'],
    rewrites: {
      saveSortMethod: [{ from: 'message.', to: 'deps.message.' }],
      openSortMethod: [],
      sortMethod: [],
      sortMethodOpen: [],
      sortMethodDraft: [],
    },
  },
]

/**
 * 摊平一个 block 的 `names` + `consts`（两者都可省 —— 缺了当空数组）。
 *
 * ⚠️ `|| []` **不能省**：漏写一个键时裸的展开会抛 `TypeError: b.consts is not iterable`，
 *    那句话对着清单看不出是哪个 block 缺了什么。主循环与 `--selftest` **共用这一个**。
 */
const blockNames = (b) => [...(b.names || []), ...(b.consts || [])]

/** C 块清单里所有被点名的名字（反查「搬走后旧文件里不该再有同名定义」用）。 */
const splitNames = () => SPLIT_BLOCKS.flatMap(blockNames)

/**
 * 声明探测（反查用）：`src` 里**自己定义**了 `name` 吗。
 *
 * ⚠️ 前缀必须与 `sliceFn` 的取法**逐字对齐**（含 `async` / `type` / `interface`）——
 *    否则「搬走之后旧文件里又长出一份同名 `type`」这类会**静默漏报**。
 *    （**实测**：把它换成引擎那半原来的窄前缀 `(?:function|const|let|var)`，
 *     在本仓库当前状态上两者对那 47 项的命中数**都是 0** ⇒ 收严**不改变今天的结论**，
 *     只是把那个暗区堵掉。这也是「反查与切片器的前缀必须对齐」这条规矩的要求。）
 */
const declares = (src, name) =>
  new RegExp(
    `^[ \\t]*(?:export\\s+)?(?:async\\s+)?(?:function|const|let|var|type|interface)\\s+${name}\\b`,
    'm',
  ).test(src)

/**
 * 比对**一条**（C 块那半）。返回 `null` = 逐字一致；否则返回
 * `{ text, line?, missing? }`（`text` 是要打印的失败说明）。
 *
 * ⚠️ 主循环与 `--selftest` **共用这一个** —— 分开写的话，自测验的就不是主循环真正跑的那段
 *    代码，等于没测（Home 版立的规矩，照抄）。
 * ⚠️ `sliceFn`（切片不配平 ⇒ 结构性硬闸）与 `applyRewrites`（登记的 `from` 找不到）
 *    **都会抛** —— 由调用侧接住转成一条计入 `fail` 的错误，别让整个脚本崩掉
 *    （那样后面的名字一条都不查）。两处调用侧都补了同款壳。
 * ⚠️ 引擎/组件那两半的判定**维持原样、没动**：它们还带着「过渡期快照」那层逻辑，不属本次改动。
 */
function compareOne({ refSrc, newSrc, name, rules, ref, target }) {
  const o = sliceFn(refSrc, name)
  if (!o) return { text: `${name}: 在 ${ref}:${SPLIT_OLD_PATH} 里找不到（清单写错了？）` }
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

/**
 * `--selftest`：只跑 **C 块那半**的判定（在**合成夹具**上），不碰 git、不读真代码。
 *
 * ⚠️ **位置不能往后挪** —— 它必须早于本文件里**任何** git 调用（就在下面几十行）。
 *    自测验证的是判定本身，不该依赖仓库状态（浅克隆 / detached HEAD 下也要能跑）。
 *
 * ⚠️ **为什么 Hui 这半特别需要它**：`SPLIT_BLOCKS` 立骨架时是**空的** ⇒ 主循环一次都不跑
 *    ⇒ 新写的 `compareOne` 在第一条 C 块登记之前**没人验过**。Home 守卫立骨架时正是这么栽的
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
  // 参照侧（旧）+ 新侧的合成样本。两侧都**故意写得和真代码同形**（缩进、`export`）。
  const REFS = `const a = () => {
  const s = name.value
  return s
}
const KEEP = 1
`
  // 新侧：多一个 `export`、多一层缩进、`name` 改成经 `deps` 注入 —— 正是 C 块的常态形状。
  const NEWS_OK = `export const a = () => {
    const s = deps.name.value
    return s
  }
  const KEEP = 1
  `
  /** 常态登记：① 搬到模块级要加 `export`；② 闭包捕获的 `name` 改成 `deps.name`。 */
  const RULES = {
    a: [
      { from: 'const a = ', to: 'export const a = ' },
      { from: 'name.value', to: 'deps.name.value' },
    ],
  }
  const one = (newSrc, name = 'a', rules = RULES) =>
    compareOne({ refSrc: REFS, newSrc, name, rules, ref: SPLIT_REF, target: '合成样本' })

  check('只加 export + 登记过的注入改写 ⇒ 判绿', one(NEWS_OK) === null, JSON.stringify(one(NEWS_OK)))

  // 第二行（`const s = …`）被改坏 ⇒ 必须报红，且**定位到第 2 行**（归一化后的行号：
  // `norm()` 丢了空行，所以行号是「声明内第几行」而不是文件行号）。
  const newsBad = NEWS_OK.replace('deps.name.value', 'deps.name.values')
  const rBad = one(newsBad)
  check('改坏第二行 ⇒ 报红', rBad !== null)
  check('报红的行号 = 2（不是 0、也不是别的行）', rBad?.line === 2, `实得 line=${rBad?.line}`)

  // 未登记的差异（新侧多了一个 `export`，而 `rewrites` 里没写）⇒ 必须报红。
  // 这就是文件头那句「多一处都要报错」：**漏登记不会抛**，只表现成 diff ⇒ 宁可多报。
  check('未登记的差异 ⇒ 报红（宁可多报）', one(NEWS_OK, 'a', {}) !== null)

  /*
   * 🔴 **盲区断言（有意让它绿）** —— 文件头「能力边界」第 2 条的可执行证据。
   *
   * `applyRewrites` 只改**参照侧**：登记里写什么，参照侧就变成什么。所以**只要新侧与那条
   * 规则的输出字面一致，本脚本就报绿** —— 哪怕规则本身是错的。
   * 这里故意用一条**荒谬**的 `to`（`THIS.IS.NONSENSE`）把它钉死：守卫验的是
   * 「搬迁**符合登记过的改写**」，**不是**「登记过的改写**是对的**」。
   *
   * 这不是假想：Home 侧 B4 真栽过 —— 把该块**自己拥有**的三个 ref 也登记成注入项
   * ⇒ 新文件里 8 处 `TS2339`，而守卫**全绿**（它把同一条错规则也套在参照侧了）。
   * ⇒ **抓这一类的是 `vue-tsc` / `npm run build`**；两者必须成对跑，缺一不可。
   */
  const NONSENSE = `export const a = () => {
    const s = THIS.IS.NONSENSE
    return s
  }
  const KEEP = 1
  `
  const absurdRules = {
    a: [
      { from: 'const a = ', to: 'export const a = ' },
      { from: 'name.value', to: 'THIS.IS.NONSENSE' },
    ],
  }
  const absurd = one(NONSENSE, 'a', absurdRules)
  check(
    '盲区：登记写成荒谬的 `to`，只要新侧与之字面一致 ⇒ **照样判绿**（抓它的是 vue-tsc）',
    absurd === null,
    JSON.stringify(absurd),
  )

  // 空清单 / 缺键的 block 都不能抛（收尾的「C 块 0 条」那条路靠它）。
  check('blockNames 容忍缺 names/consts', blockNames({}).length === 0 && blockNames({ names: ['x'] }).length === 1)
  check('SPLIT_BLOCKS 为空时 splitNames() = 0 条（空转那条路）', splitNames().length === 0, `实得 ${splitNames().length}`)

  console.log(bad ? `\n✗ 自测 ${bad} 条失败` : '\n✓ 自测全部通过（C 块判定的已知输入）')
  process.exit(bad ? 1 : 0)
}

const oldSrc = execSync(`git -C ${ROOT} show ${REF}:${OLD_PATH}`, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
const newSrc = readFileSync(NEW_PATH, 'utf8')

/** 应该已经被搬走的函数/常量名。搬完 Hui.vue 里不该再有这些定义。 */
const MOVED = [
  'readFieldHistory', 'writeFieldHistory', 'rememberField',
  'partsTrackOptions', 'rememberLocks', 'hardwareOptionsFor',
  'newLine',
  'needsMotherWidth', 'singleArea', 'fanCount', 'minSquareOf',
  'computeSquare', 'computeAmount', 'markupError', 'recalcMarkup',
  'matchFormulaByName', 'resolveRow', 'syncGlassMarkup', 'onGlassSelection',
  'sizeMarkupCandidates', 'syncSizeMarkupPing', 'pickDiaoWallMarkup',
  'syncSizeMarkupDiao', 'syncSizeMarkup',
  'removeLine', 'copyRow',
  'belongsToTable', 'profileOptionsFor', 'pingCasingOptions',
  'sanitizeNum', 'sanitizeFloat',
  'defaultBottomGlass', 'defaultGlassThickness',
  'rememberDefaultBottomGlass', 'rememberDefaultGlassThickness',
]

/** `const X = ...` 形式（箭头/计算属性）也要比。 */
const MOVED_CONSTS = [
  'LS', 'lockOptions', 'lastProf', 'PING_FAMILY_TYPES',
  'lineRefresh', 'colorOptions', 'partsEngine', 'formulaOf', 'isDiamond',
  'computeParts', 'pingProfileOptions', 'diaoProfileOptions',
]

/**
 * 声明的改写：`名字 → [{from,to}]`。每条都必须**在旧文里找得到 from**、否则报错
 * （防止写出永不生效的规则把真实差异放过）。
 */
const REWRITES = {
  // 搬到模块级并导出（页面初始化 `disableAutoMarkup` 也要用它，那时引擎还没实例化）。
  LS: [{ from: 'const LS = {', to: 'export const LS = {' }],
  pingCasingOptions: [
    // 原来是闭包捕获页面的 casingKindOptions；搬出去后改成形参注入（引擎不依赖视图常量）。
    { from: 'function pingCasingOptions(l: Line): { label: string; value: string }[] {', to: 'function pingCasingOptions(l: Line, casingKindOptions: { label: string; value: string }[]) {' },
  ],
  /*
   * 2026-09-19：子母门 `formulaType` 的大小写对齐（审计 §3.1）——
   * **搬迁之后有意改的，不是搬迁失真。**
   *
   * · 搬迁时这里是**全小写** `'parentsubsidiary'`；而旧版**四处全是驼峰**
   *   `parentSubsidiary`（`Diao.deobfuscated.js:912-914` 的 `_0x3ccfb0`、`:2213`、`:2236`、`:2133`）。
   * · 更要命的是**自家** `utils/printPayloads.ts:823/:1000` 早就按驼峰在比，
   *   而那边拿的是 `formulaOf(l)?.formula_type`（就是库里这一列）
   *   ⇒ **子母门公式的算料单据一直静默走错分支**（数量 `4×/2×` 变成 `quantity× / quantity÷2`、
   *   子门/母门玻璃取成通用玻璃），不报错、界面上也看不出来。
   * · 已按旧版对齐（前端 4 个文件）并用**迁移 0024** 迁数据。
   *
   * ⚠️ 这条改写规则**自带自检**：`applyRewrites` 找不到 `from` 就抛错。
   *    所以哪天旧值变了，这里会立刻报「声明的改写失效」，不会静默漏过。
   * 详见 `docs/2026-09-19-diao-audit.md` §3.1。
   */
  PING_FAMILY_TYPES: [
    {
      from: "const PING_FAMILY_TYPES = ['ping', 'double', 'parentsubsidiary', 'diamond']",
      to: "const PING_FAMILY_TYPES = ['ping', 'double', 'parentSubsidiary', 'diamond']",
    },
  ],
}

let pass = 0
const fail = []
let missing = 0

for (const name of [...MOVED, ...MOVED_CONSTS]) {
  /*
   * ⚠️ `sliceFn` 会**抛**（结构性硬闸：切出来不配平就报错，见核心文件头）。
   * 这里把它转成一条**计入 `fail` 的**错误 —— 让它抛出去的话，整个脚本崩掉、
   * 后面的名字一条都不查，而这条信息本身（哪个名字、为什么不配平）是有用的。
   *
   * 2026-09-20 Task 3.6 补（🟡5）。此前这里**没有**这层壳，理由是「别为了变绿去动清单」——
   * 但「不加 try/catch」与「别动清单」是两件事：`fail.push + continue` **不会让任何东西变绿**
   * （退出码仍是 1）。实测：往 `useOrderLines.ts` 的 `computeSquare` 体里塞一个 `/)/`，
   * **加之前**是未捕获异常、第一条循环就中止（47 个比对与组件侧 46 个全不跑），
   * **加之后**是「computeSquare: 切片不平衡…」一条失败行 + 其余 92 条照跑 —— 两种都退 1。
   */
  let o, n
  try {
    o = sliceFn(oldSrc, name)
    n = sliceFn(newSrc, name)
  } catch (e) {
    fail.push(`${name}: ${e.message}`)
    continue
  }
  if (!o) { fail.push(`${name}: 在 ${REF}:${OLD_PATH} 里找不到（MOVED 清单写错了？）`); continue }
  if (!n) { fail.push(`${name}: 新文件 ${NEW_PATH} 里找不到 —— 没搬过去？`); missing++; continue }
  // ⚠️ 顺序：**先归一化再套改写规则**。`norm()` 去了行首缩进，多行的 `from` 片段匹配不上。
  // 规则从模块级 `REWRITES` 来 —— 这就是与 Home 版唯一的分歧，现在走共享核心的第三个形参。
  const a = applyRewrites(name, norm(o), REWRITES)
  const b = norm(n)
  if (a === b) { pass++; continue }
  const A = a.split('\n'), B = b.split('\n')
  const diffs = []
  for (let i = 0; i < Math.max(A.length, B.length) && diffs.length < 6; i++) {
    if (A[i] !== B[i]) diffs.push(`    L${i + 1}\n      旧: ${String(A[i]).slice(0, 150)}\n      新: ${String(B[i]).slice(0, 150)}`)
  }
  fail.push(`${name}: 归一化后仍不一致（旧 ${A.length} 行 / 新 ${B.length} 行）\n${diffs.join('\n')}`)
}

// ─────────────────────────────────────────────────────────────────────────
// 第二轮：3b（2026-09-19）—— 列定义 / 单元格 / 行级编辑态搬到 DetailLinesTable.vue
// ─────────────────────────────────────────────────────────────────────────
const COMPONENT = `${ROOT}/app/src/components/DetailLinesTable.vue`
const compSrc = readFileSync(COMPONENT, 'utf8')

/** 搬到组件里的定义（顺序同搬迁清单 A–J）。 */
const MOVED_TO_COMPONENT = [
  // A 单元格
  'wallThicknessCell', 'glassSelectCell', 'CELL', 'cellError', 'tCell', 'isRedNum',
  'intCell', 'moneyCell', 'optCell', 'profileCell', 'colorCell', 'trackCell',
  'casingCell', 'hardwareCell', 'PING_HOLE_SIZE_OPTS', 'DIAO_HOLE_SIZE_OPTS', 'holeCell',
  // B
  'selCol',
  // C
  'partsTooltip',
  // D 行级编辑态
  'pingEdit', 'diaoEdit', 'rowKeyOf', 'editOf', 'stripForDirty', 'recomputeDirty',
  'isEditing', 'isDirty', 'confirmLeaveDirtyRow', 'enterEdit', 'cancelEdit', 'saveRow',
  // E
  'opsCol',
  // F
  'sqCell', 'amountCell', 'remarkCell', 'markupSelectCell', 'markupCol',
  // G
  'doorImgCell',
  // H
  'cCol', 'sub', 'DOUBLE_DING_OPTS', 'orderNoCell', 'moneyCell_2', 'doorImgCol',
  // I
  'pingCols', 'diaoCols',
  // J
  'rowKey', 'rowClassName', 'rowPropsOf', 'pingColumns', 'diaoColumns',
]

/**
 * 组件化时**声明的改写** —— 全是「页面作用域 → props/引擎」这一件事，逐条列出。
 * 规则是**纯字符串替换**（不是正则），`from` 在旧文里找不到就报错。
 */
const COMPONENT_REWRITES = [
  // 3a 改的：`pingCasingOptions` 多了一个形参（视图常量改注入），调用点跟着变
  ["pingCasingOptions(l), undefined, true, 'casing')", "pingCasingOptions(l, casingKindOptions), undefined, true, 'casing')"],
  ['pingColVis', 'props.colVis'],
  ['diaoColVis', 'props.colVis'],
  ['orderId.value', 'props.savedOrderId'],
  ['lineInputOf(', 'props.hooks.lineInputOf('],
  ['calcSingleRow(', 'props.hooks.calcSingleRow('],
  ['openSquareDialog(', 'props.hooks.openSquareDialog('],
  ['openAddMarkup(', 'props.hooks.openAddMarkup('],
  ['removeDoorImg(', 'props.hooks.removeDoorImg('],
  ['pickDoorImg(', 'props.hooks.pickDoorImg('],
  ['openTextImg(', 'props.hooks.openTextImg('],
  ['order.client_name', 'props.client.name'],
  ['order.client_code', 'props.client.code'],
  // 引擎在组件里是局部常量 `engine`（Hui 传进来 / Home 自建，二选一），不是 `props.engine`
  ['lines.value.find(', 'engine.lines.value.find('],
  ['diaoRows.value', 'props.rows'],
  ['pingRows.value', 'props.rows'],
  ['checkboxTick.value++', 'props.hooks.onSelectChange()'],
  // 归一化之后两行都去了缩进，所以 from 也写成去缩进的样子
  ['previewImg.value = l.image_url\npreviewOpen.value = true', "props.hooks.previewImage(l.image_url ?? '')"],
]

/**
 * ⚠️ **第 2 步（行级编辑态）写的那批代码还没提交，`HEAD` 里没有** ——
 * 所以那一批拿「3b 动手前从工作区切出来的快照」当参照（`/tmp/moved3b.ts`，
 * 由 `move3b.mjs` 在删除**之前**导出，是独立的原文）。
 * 它证明的是「切出来之后到落进组件之间没被手改」—— 与 HEAD 那一路的证明力不同，
 * 但也够：那批代码本身的正确性由 `hui-row-save-check.mjs` 与 `hui-engine-logiccheck.mjs` 管。
 */
const SNAPSHOT = `${ROOT}/docs/home-audit/fixtures/hui-pre-3b.ts`
let snapSrc = ''
try {
  snapSrc = readFileSync(SNAPSHOT, 'utf8')
} catch {
  // ⚠️ 找不到就**退回过期会话**（下面会打印用的是哪个参照）—— 别当成通过。
  snapSrc = ''
}

/**
 * **搬迁之后有意改过的**（不是搬迁失真，因此不再逐字比；但**必须列出来**，别让它变成
 * 「反正检查器不看」的暗区 —— 脚本会把它们打印出来）。
 *
 * 2026-09-19 用户实测报「点确认修改没反应」，查下来两处：
 *  · `confirmLeaveDirtyRow` 漏了旧版 `It` 的第二个判据（同一行里换格子不算切行）⇒ 补上，并加 `target` 形参；
 *  · `saveRow` 的前置不满足时**静默 return**（表现就是「点了没反应」）⇒ 改成出声提示。
 *  `enterEdit` 随之改成把当前行传给守卫。
 *
 * 2026-09-19 追加 `opsCol` / `doorImgCell` —— **「算料」按钮挪回它该在的列**：
 *  · 旧版两张明细表的**操作列**第三颗是「**查看3D**」，而「**算料**」在**门花图列**
 *    （`Hui.formatted.js:1880` 平开 / `:4682` 移门，触发点表见
 *    `docs/2026-09-18-detail-sfc-recon.md` §5）；
 *  · 我们当初把「算料」放进了操作列占着查看3D 那位（当时的注释就写着"把查看3D换成算料"），
 *    **门花图列反而没有** —— 两处都不对；
 *  · 现把算料挪到 `doorImgCell` 的空图态里（传图 / 文字 / 算料，算料排最后、`type:"warning"`），
 *    操作列那格**留空**（查看3D 属 3D 暂缓那一摊，见 memory `3d-module-deferred`）。
 *  ⇒ 这两处**是该改的**，不是搬迁失真。结论与依据见 `docs/2026-09-08-hui-table-gap.md`。
 */
const POST_MOVE_EDITS = new Set([
  'confirmLeaveDirtyRow',
  'enterEdit',
  'saveRow',
  'opsCol',
  'doorImgCell',
])

let pass2 = 0
const fail2 = []
const skipped = []
for (const name of MOVED_TO_COMPONENT) {
  if (POST_MOVE_EDITS.has(name)) { skipped.push(name); continue }

  // ⚠️ **快照优先**：第 1/2/3a 步的改动都还没提交，`HEAD` 对「被那三步动过的函数」是过期的
  //    （`opsCol`/`rowClassName` 在步骤 2 改过、`pingCols` 在 3a 改过）。
  //    快照是 3b 动手**前一刻**的工作区原文，才是这批的真参照。
  // ⚠️ 第二轮同样要这层壳（与上面那条同源）：不补的话，组件侧发生一次不配平会
  //    把**本轮剩下的名字**与**后面的反查**一起带走。见上一条注释的实测。
  let o, n
  let ref = '搬迁前快照'
  try {
    o = snapSrc ? sliceFn(snapSrc, name) : null
    if (!o) { o = sliceFn(oldSrc, name); ref = `${REF}:${OLD_PATH}` }
    n = sliceFn(compSrc, name)
  } catch (e) {
    fail2.push(`${name}: ${e.message}`)
    continue
  }
  if (!o) { fail2.push(`${name}: 在 ${ref} 里找不到`); continue }
  if (!n) { fail2.push(`${name}: 组件里找不到 —— 没搬过去？`); continue }
  let a = norm(o)
  for (const [from, to] of COMPONENT_REWRITES) {
    // 与上同理：先归一化再替换；但改写里的多行片段要在归一化后仍然匹配
    a = a.split(from).join(to)
  }
  const b = norm(n)
  if (a === b) { pass2++; continue }
  const A = a.split('\n'), B = b.split('\n')
  const diffs = []
  for (let i = 0; i < Math.max(A.length, B.length) && diffs.length < 5; i++) {
    if (A[i] !== B[i]) diffs.push(`    L${i + 1}\n      旧: ${String(A[i]).slice(0, 150)}\n      新: ${String(B[i]).slice(0, 150)}`)
  }
  fail2.push(`${name}: 归一化后仍不一致（旧 ${A.length} 行 / 新 ${B.length} 行）\n${diffs.join('\n')}`)
}
console.log(`  组件（列/单元格/编辑态）逐字一致：${pass2} 个`)
if (skipped.length) console.log(`  ⚠️ 搬迁后有意改过、**不在逐字比对内**：${skipped.join(', ')}`)
if (fail2.length) {
  console.log(`\n✗ 组件侧 ${fail2.length} 处不符：`)
  fail2.forEach((f) => console.log('  - ' + f))
  process.exit(1)
}
fail.push(...fail2)

// ─────────────────────────────────────────────────────────────────────────
// C 块（2026-09-20 的 Hui 拆分 C1–C13）—— 参照 `SPLIT_REF`（`28e36d21`），见文件头「现在有两半」
// ─────────────────────────────────────────────────────────────────────────
/**
 * ⚠️ **参照先取一次、且必须取到** —— 放在 block 循环**外面**是有意的：
 *    `SPLIT_BLOCKS` 为空时循环体一次都不跑，若把 `git show` 写在循环里，脚本就**根本不碰这个
 *    参照** ⇒ 参照取不到也退 0（「未运行 ≠ 通过」的反面）。所以这里无条件先取：取不到就 fail-loud。
 *
 * ⚠️ 用 `execFileSync`（**不经 shell**）：参数是常量，但走 shell 拼串既怕空格也怕注入 ——
 *    与 Home 守卫同一口径。上面引擎那半的 `execSync` 是历史写法，本次**不动它**（超出改动范围）。
 */
let splitRefSrc = ''
try {
  splitRefSrc = execFileSync('git', ['-C', ROOT, 'show', `${SPLIT_REF}:${SPLIT_OLD_PATH}`], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    // stderr 也收进来（否则 git 会往终端直接喷一行 fatal，下面又打一遍 —— 重复且刺眼）
    stdio: ['ignore', 'pipe', 'pipe'],
  })
} catch (e) {
  console.error(`✗ C 块参照提交 ${SPLIT_REF} 取不到（${SPLIT_OLD_PATH}）—— 浅克隆？见 .github/workflows/ci.yml 的 fetch-depth: 0`)
  const why = String(e.stderr || e.message || '').trim().split('\n')[0]
  if (why) console.error(`  git 说：${why}`)
  process.exit(1)
}

let passSplit = 0
let missingSplit = 0
for (const b of SPLIT_BLOCKS) {
  const target = `${ROOT}/${b.target}`
  const rules = b.rewrites || {}
  let targetSrc
  try {
    targetSrc = readFileSync(target, 'utf8')
  } catch (e) {
    fail.push(`C 块「${b.target}」读不到 —— ${e.message}`)
    continue
  }
  for (const name of blockNames(b)) {
    let r
    try {
      r = compareOne({ refSrc: splitRefSrc, newSrc: targetSrc, name, rules, ref: SPLIT_REF, target: b.target })
    } catch (e) {
      // `sliceFn` 抛（切片不配平）或 `applyRewrites` 抛（登记的 `from` 找不到）——
      // 转成一条**计入 fail** 的错误：让它抛出去的话整个脚本崩掉、后面的名字一条都不查，
      // 而这条信息本身（哪个名字、为什么）是有用的。与 Home 版同一处置（那里有实测）。
      fail.push(`${name}: ${e.message}`)
      continue
    }
    if (r == null) { passSplit++; continue }
    if (r.missing) missingSplit++
    fail.push(r.text)
  }
}
/** C 块清单声明的条数（空转判定用它，不用 `passSplit` —— 两者是两回事）。 */
const splitTotal = splitNames().length
if (splitTotal) console.log(`  C 块逐字一致：${passSplit} 个`)
if (missingSplit) console.log(`  C 块未搬走：${missingSplit} 个`)

// 反向检查：搬走的定义不该在 Hui.vue 里留下第二份（否则两份实现会各自漂移）。
// ⚠️ 两半的**处置不同，是有意的**：
//    · 引擎那半只**警告**（历史行为，本次不动它）；
//    · C 块这半做成**失败** —— 清单里写「搬走了」= 同一笔里必须删干净，
//      留着就是「改了一处忘了另一处」，那种不一致是 bug，不是提示。
// 两处**共用 `declares()`**（前缀与 `sliceFn` 对齐）：分开写两份正则会各自漂开，
// 而这正是本仓库反复栽过的那一族（「同一判据两份实现」）。
function src_after() {
  try {
    return readFileSync(`${ROOT}/${OLD_PATH}`, 'utf8')
  } catch {
    return ''
  }
}
const after = src_after()
const dupe = [...MOVED, ...MOVED_CONSTS].filter((n) => declares(after, n))
const splitDupe = splitNames().filter((n) => declares(after, n))

console.log(`搬迁保真检查（${REF}:${OLD_PATH} → ${NEW_PATH}）`)
console.log(`  逐字一致：${pass} 个`)
if (missing) console.log(`  未搬走：${missing} 个`)
if (dupe.length) console.log(`  ⚠️ Hui.vue 里仍有同名定义（应已删除）：${dupe.join(', ')}`)
if (fail.length) {
  console.log(`\n✗ ${fail.length} 处不符：`)
  fail.forEach((f) => console.log('  - ' + f))
  process.exit(1)
}
if (splitDupe.length) {
  console.log('\n✗ C 块清单里已声明搬走、Hui.vue 里却仍有同名定义（两份实现会各自漂移）：')
  splitDupe.forEach((n) => console.log('  - ' + n))
  process.exit(1)
}
/*
 * 收尾那一行**只有一行、且必须是最后一行** —— `run-all.mjs` 的汇总只取 stdout 的**最后一行
 * 非空行**当说明文字（见它 `:133`）。拆成两行的话，被显示出来的是后一行，
 * 前面那半（引擎/组件/C 块的读数）就看不着了。
 *
 * ⚠️ **`splitTotal === 0` 时也要把「0 条」写进这一行**（而不是删掉不提）：
 *    清单空着 ⇒ 这一半什么都没验；不写出来的话，一个绿勾会被读成「C 块也验过了」——
 *    那正是 `run-all.mjs` 文件头禁止的「分不出『查了 0 个名字』和『全一致』」。
 *    注意它**仍然退 0**：清单还空着不是被检代码的失败，不该把整套 verify 弄红。
 */
if (splitTotal === 0) {
  console.log('\n✓ 全部一致 —— 搬迁未改动任何逻辑（C 块清单 **0 条**：这一半尚未保护任何代码，登记法见文件头）')
} else {
  console.log(`\n✓ 全部一致 —— 搬迁未改动任何逻辑（引擎 ${pass} + 组件 ${pass2} + C 块 ${passSplit}）`)
}
