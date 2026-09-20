/**
 * 页头那几个「外壳开关」—— 2026-09-20 从 `Hui.vue` 搬出（逻辑逐字未改，C4）。
 *
 * 搬出前的行段（参照提交 `28e36d21`）是**两段**，中间隔着「更多功能」下拉的选项表
 * （`moreMenuOptions`，**不属本块**，它留在页面）：
 *   · `Hui.vue:883-896` —— 两表显隐（`showPing`/`showDiao`/`addTypeOpen` + `toggleShow`/`ensureShown`）
 *   · `Hui.vue:918-959` —— 「总余额显示」一个开关 + 「辅助菜单设置」两个开关及各自的 onChange
 * 两段合计 **11 个声明**（与 spec §3.3 的 C4 对得上）。
 *
 * 搬迁保真由 `docs/home-audit/hui-extract-movecheck.mjs` 机核（`SPLIT_BLOCKS` 里 C4 一条）。
 *
 * ## 注入面 = **1 项**
 *
 * | 注入项 | 正主 | 体里怎么用 |
 * |---|---|---|
 * | `message` | 页面 `useMessage()` | 三个 onChange 各弹一句成功提示 |
 *
 * `writeShowTotalBalance` / `writeAssistiveMenu` / `writeAssistiveFullscreen` 是模块级单例
 * （`utils/totalBalance` / `utils/assistiveMenu`）⇒ 新家直接 `import`，**不注入**。
 *
 * ## 回传面 = **11 项，全部有段外活读者**（2026-09-20 逐条实测）
 *
 * | 名字 | 段外的活读者 |
 * |---|---|
 * | `showPing` / `showDiao` | 模板 `:123`/`:134`/`:151`/`:176`/`:177`/`:263`/`:266` · **`loadOrder` 里按导入数据写**（`:1202`/`:1203`）· 序列化/打印载荷（`:1881`/`:1882`、`:1907`/`:1908`） |
 * | `addTypeOpen` | 模板 `:17`（**写** `= true`）· `:260`（`v-model:show`） |
 * | `toggleShow` / `ensureShown` | 模板 `:146`/`:163`/`:263`/`:266` 的 `@toggle-show`/`@click`；`ensureShown` 另被 `onMoreSelect` 调（`:1101`） |
 * | `showTotalBalance` | 模板 `:292`/`:293`/`:298`/`:299`/`:300` · **`onMounted` 读 localStorage 后写它**（`:1924`） |
 * | `onTotalBalanceChange` | 模板 `:299` 的 `@update:value` |
 * | `showAssistiveMenu` / `assistiveFullscreen` | 模板 `:323`-`:337`（含 `:333` 的 `v-if`）· **`onMounted`**（`:1927`/`:1928`） |
 * | `onAssistiveMenuChange` / `onAssistiveFullscreenChange` | 模板 `:331`/`:336` 的 `@update:value` |
 * ⇒ **11 项全部回传**，页面侧全部解构（少解构一个，对应的开关/按钮就静默失效）。
 *
 * ⚠️ 两处**语义陷阱**（本块只搬声明、不改行为，但别在后续改动里踩）：
 *   ① 「总余额显示」的 ref **不参与打印取值** —— 打印链路自己读 localStorage
 *      （见 `utils/totalBalance.ts` 文件头）；这里只负责开关与提示。
 *   ② 「辅助菜单」那两颗**不影响本页任何渲染**，只写 localStorage + 派 CustomEvent 给手机端外壳。
 */
import { ref } from 'vue'
import type { MessageApi } from 'naive-ui'
import { writeShowTotalBalance } from '../../utils/totalBalance'
import { writeAssistiveFullscreen, writeAssistiveMenu } from '../../utils/assistiveMenu'

/** `useHuiShellToggles()` 的注入面。**只放页面拥有的东西**（见文件头那张表）。 */
export interface HuiShellTogglesDeps {
  /** 页面 `useMessage()`。 */
  message: MessageApi
}

/** 页头外壳开关：两表显隐 + 总余额显示 + 辅助菜单/全面屏。 */
export function useHuiShellToggles(deps: HuiShellTogglesDeps) {
  const showPing = ref(true)
  const showDiao = ref(true)
  const addTypeOpen = ref(false)

  function toggleShow(kind: 'ping' | 'diao') {
    if (kind === 'ping') showPing.value = !showPing.value
    else showDiao.value = !showDiao.value
  }

  function ensureShown(kind: 'ping' | 'diao') {
    if (kind === 'ping') showPing.value = true
    else showDiao.value = true
  }

  /**
   * 「总余额显示」开关。
   *
   * 旧版：`_0x2ffe36 = Vue.ref(!1)`（**默认关**，`H:399836`）+ `onMounted` 里 `_0x1c743a()`
   * 读一次 `localStorage['showTotalBalance']`（`H:400056`）；`onChange` `_0x14b5ca`（`H:7934`）
   * 写回 localStorage 并弹一句成功提示。
   *
   * ⚠️ **开关本身不在这里取余额、也不在打印时读这里的 ref**：真正取余额的是打印链路
   * （`useOrderPrint.loadPrintPrereqs`），它自己去读 localStorage。这样 Hui / Home / Progress
   * 三条路同源，也不会出现「改了开关但打印用的是旧值」。见 `utils/totalBalance.ts`。
   */
  const showTotalBalance = ref(false)

  function onTotalBalanceChange(on: boolean) {
    showTotalBalance.value = on
    writeShowTotalBalance(on)
    deps.message.success(on ? '总余额显示已开启' : '总余额显示已关闭')
  }

  /**
   * 「辅助菜单设置」两个开关 —— 旧版 `_0x187cf8`（手机辅助菜单）/ `_0x21c393`（全面屏）。
   *
   * 这颗**不影响本页任何渲染**：写 `localStorage` + 往 `window` 派一个 CustomEvent，
   * 由**手机端外壳**监听后决定底部要不要预留空间。见 `utils/assistiveMenu.ts` 的文件头
   * （键名、事件名、四句提示文案都在那儿核过）。
   *
   * 旧版初值和「总余额显示」同一批在 `onMounted` 读（`H:8263` 连着调 `_0x285a13()` `_0x1c743a()`）。
   */
  const showAssistiveMenu = ref(false)
  const assistiveFullscreen = ref(false)

  function onAssistiveMenuChange(on: boolean) {
    showAssistiveMenu.value = on
    writeAssistiveMenu(on)
    deps.message.success(on ? '手机辅助菜单已开启' : '手机辅助菜单已关闭')
  }

  function onAssistiveFullscreenChange(on: boolean) {
    assistiveFullscreen.value = on
    writeAssistiveFullscreen(on)
    deps.message.success(on ? '全面屏已开启，底部不预留空间' : '全面屏已关闭，底部预留空间')
  }
  return {
    // 11 项全部回传 —— 每一名的段外活读者见文件头那张表（模板 + `loadOrder`/`onMounted` 的写）。
    showPing,
    showDiao,
    addTypeOpen,
    toggleShow,
    ensureShown,
    showTotalBalance,
    onTotalBalanceChange,
    showAssistiveMenu,
    assistiveFullscreen,
    onAssistiveMenuChange,
    onAssistiveFullscreenChange,
  }
}
