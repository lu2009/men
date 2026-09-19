// 「辅助菜单设置」—— 手机辅助菜单 / 全面屏两个开关（旧版 `_0x187cf8` / `_0x21c393`）。
//
// 这一对开关**不改我们自己的界面**，它是给**手机端外壳（App / Capacitor WebView）**看的：
// 旧版改完会往 `window` 上派一个 `CustomEvent`，App 那边监听后调整底部预留空间。
// 所以这里的「输出」有两个：`localStorage` 里的持久值 + 那个事件。
//
// 旧版（`Hui.formatted.js`，逐行照抄，不是读一遍）：
//   · 声明  `:7916`  `_0x187cf8 = Vue.ref(!1)`、`_0x21c393 = Vue.ref(!1)`
//   · 初始化 `:7916-7920` `_0x285a13`：
//         const t = localStorage.getItem('assistiveMenuEnabled')
//         null !== t && (_0x187cf8.value = t === 'true')
//         const a = localStorage.getItem('assistiveFullscreen')
//         null !== a && (_0x21c393.value = a === 'true')
//   · onChange 手机辅助菜单 `:7921-7925` `_0x1bdba1`：
//         localStorage.setItem('assistiveMenuEnabled', _0x187cf8.value.toString())
//         window.dispatchEvent(new CustomEvent('assistive-menu-setting-changed', { detail: _0x187cf8.value }))
//         ElMessage.success(_0x187cf8.value ? '手机辅助菜单已开启' : '手机辅助菜单已关闭')
//   · onChange 全面屏 `:7926-7930` `_0x13d6a9`：
//         localStorage.setItem('assistiveFullscreen', _0x21c393.value.toString())
//         window.dispatchEvent(new CustomEvent('assistive-fullscreen-changed', { detail: _0x21c393.value }))
//         ElMessage.success(开 ? '全面屏已开启，底部不预留空间' : '全面屏已关闭，底部预留空间')
//   · 挂载   `:8261-8263`  `Vue.onMounted(() => { …; _0x285a13(); _0x1c743a() })`
//         （`_0x1c743a` 是「总余额显示」的初始化 —— 两者同一批，见 `totalBalance.ts`。）
//
// 界面在 **「添加门类」抽屉**的第 8 项（`H:13316-13335`），一个 200px 的 popover：
//   「辅助菜单设置」（开着时后面跟个 ✓）→ 里面一个「开启手机辅助菜单」开关；
//   该开关**开着**时才多出一块「全面屏（不预留底部空间）」的开关。
//
// ⚠️ 旧版 `setting-872a24e9.js` 也读同一个键（那里只读不写、也不派事件），
//    所以我们把它放在 `utils/` 而不是 `views/Hui.vue` 里 —— 将来那个设置页要复刻时直接引这里。

/** `localStorage` 键名 —— 与旧版**逐字相同**。 */
export const ASSISTIVE_MENU_KEY = 'assistiveMenuEnabled'
export const ASSISTIVE_FULLSCREEN_KEY = 'assistiveFullscreen'

/** 事件名 —— 手机端外壳监听的就是这两个字符串，一个字都不能改。 */
export const ASSISTIVE_MENU_EVENT = 'assistive-menu-setting-changed'
export const ASSISTIVE_FULLSCREEN_EVENT = 'assistive-fullscreen-changed'

type Readable = Pick<Storage, 'getItem'>
type Writable = Pick<Storage, 'setItem'>

/**
 * 读一个开关。旧版：`null !== t && (ref = t === 'true')`，默认关。
 * ⇒ 只有字面量 `"true"` 算开；`"1"` / 缺省 / 乱码一律算关。
 */
function readFlag(key: string, storage: Readable): boolean {
  try {
    return storage.getItem(key) === 'true'
  } catch {
    // 隐私模式等场景下 `localStorage` 访问本身会抛 —— 按「关」处理，与旧版异常路径同义。
    return false
  }
}

/** 写一个开关并派事件。旧版是 `setItem(key, value.toString())` + `dispatchEvent`。 */
function writeFlag(
  key: string,
  event: string,
  on: boolean,
  storage: Writable,
  target: EventTarget,
): void {
  try {
    storage.setItem(key, String(on))
  } catch {
    // 写不进去不该让开关本身报错（旧版没 try，但旧版也没处理过这个场景）。
  }
  try {
    // ⚠️ `CustomEvent` 在 node（差分台）里没有 —— 缺了就静默跳过，别让这颗开关挂掉。
    target.dispatchEvent(new CustomEvent(event, { detail: on }))
  } catch {
    /* 没有 CustomEvent 的环境（非浏览器）跳过派发 */
  }
}

export function readAssistiveMenu(storage: Readable = localStorage): boolean {
  return readFlag(ASSISTIVE_MENU_KEY, storage)
}

export function readAssistiveFullscreen(storage: Readable = localStorage): boolean {
  return readFlag(ASSISTIVE_FULLSCREEN_KEY, storage)
}

export function writeAssistiveMenu(
  on: boolean,
  storage: Writable = localStorage,
  target: EventTarget = window,
): void {
  writeFlag(ASSISTIVE_MENU_KEY, ASSISTIVE_MENU_EVENT, on, storage, target)
}

export function writeAssistiveFullscreen(
  on: boolean,
  storage: Writable = localStorage,
  target: EventTarget = window,
): void {
  writeFlag(ASSISTIVE_FULLSCREEN_KEY, ASSISTIVE_FULLSCREEN_EVENT, on, storage, target)
}
