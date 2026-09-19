// 「总余额显示」开关 + 客户总余额取值（旧版 `showTotalBalance`）。
//
// ⚠️ **先说清这一格到底长在哪** —— 我一开始判断错了，这里记下来免得后人再错：
//
//   旧版的「总余额」**只出现在打印出来的回执单上**，电子回执那一族从来没有过它。
//
//   证据（都是扫出来的，不是读一遍）：
//   · `TotalBalance` 是**打印模板字段**：`legacy/templates/print-templates-import.json` 里
//     `receipt` / `FinalReceipt` / `ReceiptList` 三张回执模板各有一个
//     `field:"TotalBalance"`、`title:"总余额"`、`color:"#f50808"` 的 text 元素；
//   · 电子回执那一族的 chunk —— `ReceiptMobile-2bb0962e.js`（= 我们的 `ReceiptCard.vue`）、
//     `ReceiptShare-48082842.js`、`ReceiptView-2e239d4a.js`、`receiptBuilder-76e5b538.js` ——
//     `TotalBalance` 与「总余额」**出现 0 次**（把 ReceiptMobile 的解码表整个 dump 出来，
//     中文串只有「已付款 / 待付款 / 已分配金额 / 未收金额 / 费用汇总 / 订单须知 …」）。
//
//   ⇒ 所以这里**只喂打印载荷**。`ReceiptCard` / `/receipt-share` 不显示总余额是**有意的**，
//     不是漏做；也正因为如此，**不需要**把它下发到那条无认证的分享链路上。
//
// 旧版口径（三个打印入口逐字相同，都写在「构造 customerInfo 之前」）：
//   · Hui      `docs` 里 `Hui.formatted.js:447411`
//   · Home     `Home.formatted.js:489099`
//   · Progress `Progress-f4bdef35.js:126718`
//
//     let L = ""
//     if (开关 && 客户编号) try {
//       const r = await fetch(余额接口 + ds + "&param3=" + 客户编号)
//       if (r.code === 200) L = r.data["客户余额"] ?? ""
//     } catch {}
//
// 即四个「取不到」的情形**一律回空串**（不是 `0`，也不是「总价 − 定金」——那是 `balance`）：
//   开关关 / 客户编号空 / 请求抛异常 / `code !== 200`。
//
// 另外两条**边界**（旧服务端源码 `finance.service.ts:730-770` 已确认，不是猜的）：
//   · 客户编号查不到时旧服务端回 `{code:200, data:null}` ⇒ `a["data"]["客户余额"]` 直接
//     **抛 TypeError**，被外层 catch 吞掉 ⇒ 同样空串。我们的等价物是 `customer_balance` 为
//     `null` ⇒ `''`，同义。
//   · 「余额」字段服务端算的是 `Math.max(0, 未收合计 − 客户调整合计)`（**不是**预付余额、
//     **不是**总价−定金），所以客户端这边**不做任何二次运算**、也不判负 —— 照抄一个数。
//
// 开关本身（`H:400056` 初始化、`H:13298-13312` 界面）：
//   · 初值 `Vue.ref(!1)`（**默认关**）；
//   · `onMounted` 读一次 `localStorage['showTotalBalance']`，
//     `null !== t && (ref = t === "true")` —— 没有这条记录就保持默认关；
//   · onChange 写回 `localStorage.setItem('showTotalBalance', String(value))`。
//   注意 Home / Progress 那两处的读取方式是**直接读 localStorage**（不像 Hui 走 ref），
//   所以「开关改了但没刷新 Home 页」这种行为差异在旧版本来就存在 —— 我们统一成一个模块，
//   比旧版更一致，这是有意的（旧版那点不一致只是实现散落，不是设计）。

/** `localStorage` 键名 —— 与旧版**逐字相同**。 */
export const SHOW_TOTAL_BALANCE_KEY = 'showTotalBalance'

type Readable = Pick<Storage, 'getItem'>
type Writable = Pick<Storage, 'setItem'>

/**
 * 读开关。旧版：`null !== t && (ref = t === "true")`，默认关。
 * ⇒ 只有字面量 `"true"` 算开；`"1"` / 缺省 / 乱码一律算关。
 */
export function readShowTotalBalance(storage: Readable = localStorage): boolean {
  try {
    return storage.getItem(SHOW_TOTAL_BALANCE_KEY) === 'true'
  } catch {
    // 隐私模式等场景下 `localStorage` 访问本身会抛 —— 按「关」处理，与旧版异常路径同义。
    return false
  }
}

/** 写开关。旧版：`setItem(key, value.toString())`。 */
export function writeShowTotalBalance(on: boolean, storage: Writable = localStorage): void {
  try {
    storage.setItem(SHOW_TOTAL_BALANCE_KEY, String(on))
  } catch {
    // 写不进去不该让开关本身报错（旧版没 try，但旧版也没处理过这个场景）。
  }
}

/** 取余额的注入点：返回 `null` 等价于旧版 `data["客户余额"]` 为 `null/undefined`。 */
export type BalanceFetcher = (clientCode: string) => Promise<number | null>

/**
 * 客户总余额。旧版 `L` 的等价实现（含全部四条例外路径）。
 *
 * ⚠️ **不做 `String()` 强转** —— 旧版是 `L = data["客户余额"] ?? ""`，`??` 只挡
 * `null/undefined`，值本身**原样**进 `customerInfo.TotalBalance`。
 * 旧服务端这个字段是 `Math.max(0, …)`（`finance.service.ts:763`，number），
 * 所以 `L` 的类型就是 `number | ""`。这里保持同一类型：
 * `0` 是**值**（渲染成 `0`），`""` 才是「取不到」。
 *
 * （差分台 `docs/home-audit/total-balance-logiccheck.mjs` 是逐值严格比的 ——
 *  `880` 与 `"880"` 会被判为不一致。别为了让它变绿去改夹具，改这里。）
 */
export async function loadTotalBalance(
  show: boolean,
  clientCode: string,
  fetchBalance: BalanceFetcher,
): Promise<number | ''> {
  if (!show || !clientCode) return ''
  try {
    const v = await fetchBalance(clientCode)
    return v == null ? '' : v
  } catch {
    return ''
  }
}
