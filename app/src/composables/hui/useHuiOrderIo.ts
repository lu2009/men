/**
 * 「订单 IO」：**脏检查 / 离开拦截 / 导入上次订单 / 清空 / 落盘上次订单** ——
 * 2026-09-20 从 `Hui.vue` 搬出（逻辑逐字未改，C9）。
 *
 * 搬出前的行段（参照提交 `28e36d21`）是**两段**：
 *   · `Hui.vue:1419-1531` —— `serializeOrder` / `savedSnap` / `dirtyNow` / `markSaved` /
 *     `handleBeforeUnload` / `applyLastOrder` / `lastOrderIO` / `importLastOrder` /
 *     `resetOrder` / `clearOrder`，**10 个声明**（段中间还夹着一句 `onBeforeRouteLeave(...)`，
 *     见下「不许动的那一条」）
 *   · `Hui.vue:2131-2146` —— `persistLastOrder`，**1 个声明**
 * 两段合计 **11 个声明**。
 *
 * 搬迁保真由 `docs/home-audit/hui-extract-movecheck.mjs` 机核（`SPLIT_BLOCKS` 里 C9 一条）。
 *
 * ## 🔴 不许动的那一条：`onBeforeRouteLeave` 必须留在**同步的 setup 作用域**里
 *
 * 它现在写在本工厂函数的**顶层**（不在任何 `async` / 回调 / `watch` 里）——**这是有意的，别"refactor"它**：
 * Vue 的路由守卫是**按当前实例的 setup 上下文注册**的，一旦挪进 `async`（`await` 之后）或某个回调里，
 * 注册时就**脱离了组件实例** ⇒ 守卫要么静默不生效、要么直接报「no active component instance」。
 * 本 composable **必须在页面 setup 期同步调用**（页面就是这么调的）。
 * 副作用是：它注册的**是**「本页的」守卫 —— 与搬之前逐字同义（旧版这一句也在 setup 顶层）。
 *
 * ## 注入面 = **11 项**（plan `:828` 说的「注入 11 项」就是这张表）
 *
 * | 注入项 | 正主 | 体里怎么用 |
 * |---|---|---|
 * | `order` | **脊梁** `reactive` | `serializeOrder` 快照、`applyLastOrder` 落值、`resetOrder` 逐字段清 |
 * | `lines` | **脊梁** `ref<Line[]>` | 同上三处 |
 * | `orderId` | **脊梁** `ref<number \| null>` | 导入/清空时置 `null` |
 * | `showPing` / `showDiao` | C2 `useHuiColumnConfig` 回传的两个 ref | 导入时跟着走、落盘时写进快照 |
 * | `clients` | C5 `useHuiClients` 回传 | 导入时判「目录里查不查得到这个 code」 |
 * | `applyClient` | C5 回传 | 查得到才套目录值（查不到会抹空，见 `applyLastOrder` 里的注释） |
 * | `setLastAppliedClient` | C5 回传的**写入口** | 查不到 / 清空时直接落 code |
 * | `today` | 页面 `function today()`（`:788`，**没搬**） | `resetOrder` 里重置 `order_date` |
 * | `message` / `dialog` | 页面 `useMessage()` / `useDialog()` | 提示 / 二次确认（`lastOrderIO` 也接它俩） |
 *
 * `LS` / `importLastOrderFlow` / `writeLastOrder` / `LastOrderIO` / `LastOrderSnapshot`
 * 都是**模块级导出** ⇒ 直接 `import`，**不进注入面**。
 *
 * ⚠️ **全部注入项都必须传「引用本身」**（`order`/`lines`/`orderId`/`showPing`/`showDiao`/`clients` 是 ref 或
 * reactive 对象）。传值（`lines: lines.value`）的后果与 C8/C10 同族：`resetOrder` 把行清空、
 * `applyLastOrder` 把导入的整单落上去——**都会落进一份与页面无关的副本**，界面上「点了没反应」，
 * 而且**不报错**。`vue-tsc` 会抓（`TS2339`/`TS2740`），**守卫完全不看这个**。
 *
 * ## 回传面 = **5 项**（其余 6 个声明在页面里**零读者**）
 *
 * | 名字 | 页面（`Hui.vue`）里剩下的读者 |
 * |---|---|---|
 * | `markSaved` | 保存成功的 3 处（`:1373` / `:1471` / `:1707`）—— **漏回传 ⇒ 脏标记永远不清**，`beforeunload` 会一直拦人 |
 * | `handleBeforeUnload` | `onMounted` 里 `addEventListener`（`:1708`）· `onBeforeUnmount` 里 `removeEventListener`（`:1666`） |
 * | `importLastOrder` | 模板 `:226`（「更多功能」清单）· `:269`（抽屉按钮） |
 * | `clearOrder` | 模板 `:16`（「1.清空」） |
 * | `persistLastOrder` | 「3.保存回执单」成功那一刻（`:1372`） |
 *
 * **有意不回传的 6 个**（2026-09-20 逐个实测，全部只剩块内引用）：
 * `serializeOrder` · `savedSnap` · `dirtyNow` · `applyLastOrder` · `lastOrderIO` · `resetOrder`
 * （`resetOrder` 唯一的页面侧调用点在 `clearOrder` 里，而 `clearOrder` 已随本块搬走）。
 *
 * ### `savedSnap` 为什么**没有**做成 getter+setter 一对（plan `:828` 提过这一条）
 *
 * 它是**裸 `let`**（不是 ref）⇒ 直接回传"值"会变成**一次性快照**，那是错的形状。plan 的提醒
 * 针对的是"页面还要读写它"的情形。**实测：页面里零读零写**（三处引用
 * `let savedSnap = serializeOrder()` / `dirtyNow` / `markSaved` 全在本块内）⇒ 它就**留在工厂里当私有变量**。
 * ⚠️ 将来若真有外部要用：**照 C5 的 `lastAppliedClient` 那对来**（`getSavedSnap` / `setSavedSnap`），
 * **别回传 `savedSnap` 本身**。
 *
 * ### `serializeOrder` 对 **key 顺序敏感** —— 函数体**逐字不动**
 *
 * 它输出的字符串就是"脏不脏"的判据（`dirtyNow` 比的是**字符串**）。改字段顺序 / 换
 * `JSON.stringify` 的写法 ⇒ 与**已存在的** `savedSnap` 比出永久脏（或永久不脏）。
 * 本次搬迁**一个字都没动**（连注释都在），守卫逐字核过。
 * ⚠️ ```h: { ...order }``` 的展开顺序 = `order` 的键定义顺序 ⇒ **别去重排 `order` 的字段**。
 *
 * ## 与 C5 的接口（一处**非**逐字的衔接，2026-09-20 记）
 *
 * 页面上那三处 `lastAppliedClient = …` 已随 **C5** 改成 `setLastAppliedClient(…)`
 * （那个裸 `let` 搬进了 `useHuiClients.ts`）⇒ 本块搬进来时**跟着用 setter**：
 * `applyLastOrder` 里 `lastAppliedClient = order.client_code ?? ''` 现在写成
 * `deps.setLastAppliedClient(order.client_code)`；`resetOrder` 里 `lastAppliedClient = ''` 写成
 * `deps.setLastAppliedClient('')`。这两处**在守卫的 `rewrites` 里逐条登记过**（不是偷偷改的）。
 */
import { onBeforeRouteLeave } from 'vue-router'
import type { DialogApi, MessageApi } from 'naive-ui'
import type { Ref } from 'vue'
import { LS } from '../useOrderLines'
import {
  importLastOrder as importLastOrderFlow,
  writeLastOrder,
  type LastOrderIO,
  type LastOrderSnapshot,
} from '../../utils/lastOrder'
import type { Line } from '../../utils/partsEngine'

/** `useHuiOrderIo()` 的注入面。**只放页面拥有的东西**（见文件头那张表）。 */
export interface HuiOrderIoDeps {
  /**
   * **脊梁**：订单头（`Hui.vue` 的 `order`，reactive 对象本身）。
   *
   * ⚠️ 类型写成 `Record<string, unknown> & { client_code: string }` 是**有意**的：
   * 页面那个 `order` 有十来个具体字段，这里**不去复制一份字段清单**（复制必漂），
   * 只把本块真的"当作 string 用"的那一个（`client_code`，要喂给 `setLastAppliedClient`）钉出来。
   * 其余字段走 `unknown` —— 赋值给 `unknown` 是允许的，所以 `resetOrder` 里那些
   * `deps.order.xxx = ''` 照样编得过，**不是**漏写类型。
   */
  order: Record<string, unknown> & { client_code: string }
  /** **脊梁**：明细行。 */
  lines: Ref<Line[]>
  /** **脊梁**：当前订单 id。 */
  orderId: Ref<number | null>
  /** 两表显隐（C2 回传的 ref）。 */
  showPing: Ref<boolean>
  /** 两表显隐（C2 回传的 ref）。 */
  showDiao: Ref<boolean>
  /** 客户目录（C5 回传）。 */
  clients: Ref<{ code: string }[]>
  /** 按 code 套客户目录值（C5 回传）。 */
  applyClient: (code: string) => void
  /** `lastAppliedClient` 的**写入口**（C5 回传的一对函数之一；那个值是裸 `let`，不能回传值）。 */
  setLastAppliedClient: (code: string) => void
  /** 页面的 `today()`（没搬，仍在 `Hui.vue`）。 */
  today: () => string
  /** 页面 `useMessage()`。 */
  message: MessageApi
  /** 页面 `useDialog()`。 */
  dialog: DialogApi
}

/** 订单 IO：脏检查 / 离开拦截 / 导入上次订单 / 清空 / 落盘上次订单。 */
export function useHuiOrderIo(deps: HuiOrderIoDeps) {
  function serializeOrder(): string {
    try {
      return JSON.stringify({
        h: { ...deps.order },
        l: deps.lines.value.map((x) => ({ ...x, markup: x.markup, parts: x.parts })),
      })
    } catch {
      return ''
    }
  }
  let savedSnap = serializeOrder()
  function dirtyNow() {
    return serializeOrder() !== savedSnap
  }
  function markSaved() {
    savedSnap = serializeOrder()
  }
  onBeforeRouteLeave(() => {
    if (!dirtyNow()) return true
    return window.confirm('存在未保存的修改，离开后将丢失，是否继续离开？')
  })
  function handleBeforeUnload(e: BeforeUnloadEvent) {
    if (!dirtyNow()) return
    e.preventDefault()
    e.returnValue = ''
  }
  /**
   * 「导入上次订单」—— 流程本身在 `utils/lastOrder.ts`（**逐字照旧版 `H:8899-8925`**：
   * 没存过 → `warning`「没有找到上次保存的订单数据」；有 → 弹确认框（标题「导入上次订单」、
   * 正文「将导入 {时间} 保存的订单数据，当前数据将被覆盖，是否继续？」、按钮「确认导入」/「取消」）；
   * 确认后应用 + `success`「上次订单数据已导入」；解析失败 → `error`「导入订单数据失败」）。
   *
   * 为什么拆出去：那些**文案和分支**要和旧版逐字对齐，而 SFC 里的 setup 函数差分台 import 不到。
   * 拆成「注入 IO 的纯函数」之后，`docs/home-audit/last-order-logiccheck.mjs` 能把旧版那段
   * 切片**真的跑一遍**，跟我们的调用序列逐条比。
   *
   * ⚠️ 本地这层只管「拿快照改页面状态」，这一段旧版没有对应（它的键存的是整单载荷、
   *    直接往 12 个表单 ref 上落），所以差分台只比**流程与文案**，不比这里的字段映射。
   */
  function applyLastOrder(data: LastOrderSnapshot) {
    if (data.header) Object.assign(deps.order, data.header)
    if (Array.isArray(data.lines)) deps.lines.value = data.lines as typeof deps.lines.value
    // 两表显隐跟着导入的数据走（旧版 `showPingkai` / `showDiao` 直接赋给那两个 ref）
    if (typeof data.showPing === 'boolean') deps.showPing.value = data.showPing
    if (typeof data.showDiao === 'boolean') deps.showDiao.value = data.showDiao
    // ⚠️ 导入出来的是**新的一单**：旧版不认领上一单的 id（再点保存是一次全新提交）。
    //    不清掉的话，下一次「保存」会去 PUT 覆盖上一单 —— 那不是「导入」该干的事。
    deps.orderId.value = null
    // ⚠️ **不要**无条件 `applyClient()`：它按 code 去客户目录**重取**姓名/电话/品牌，
    //    目录里查不到这个 code 时会把刚导入的三个字段**抹成空**。
    //    旧版是把 `customerInfo` 里存的值**直接落上去**、不查目录。所以只在查得到时才套目录值。
    if (deps.clients.value.some((c) => c.code === deps.order.client_code)) {
      deps.applyClient(deps.order.client_code)
    } else {
      deps.setLastAppliedClient(deps.order.client_code)
    }
    // 导入的行按「已保存」着色（旧版是把上次保存的整表行 splice 回来，那些行本来就带保存态）。
    markSaved()
  }
  const lastOrderIO: LastOrderIO = {
    storage: { getItem: (k) => LS.get(k), setItem: (k, v) => LS.set(k, v) },
    warning: (m) => deps.message.warning(m),
    success: (m) => deps.message.success(m),
    error: (m) => deps.message.error(m),
    confirm: (o) => deps.dialog.warning(o),
  }
  function importLastOrder() {
    importLastOrderFlow(lastOrderIO, applyLastOrder)
  }
  function resetOrder() {
    deps.orderId.value = null
    deps.order.receipt_no = ''
    deps.order.client_code = ''
    deps.order.client_name = ''
    deps.order.phone = ''
    deps.order.brand = ''
    deps.order.order_date = deps.today()
    deps.order.production_days = 0
    deps.order.deposit = 0
    deps.order.remark = ''
    deps.order.salesperson = ''
    deps.order.install_address = ''
    // ⚠️ 这两个同上：忘一个，保存时那一个就被抹空（见 `order` 声明处的说明）。
    deps.order.production_status = ''
    deps.order.lock_direction = ''
    deps.lines.value = []
    deps.setLastAppliedClient('')
    markSaved()
    // ⚠️ **不要**在这里写 `smartdoor_last_order`：旧版那个键全文件只有两处
    // （`H:8853` 保存成功时写、`H:8903` 导入时读），**清空订单不动它**。
    // （我们先前那套实时草稿在这里写了个空草稿 —— 等于「清空 = 把上次订单也清了」，
    //  旧版没这回事。见 `persistLastOrder` 的注释。）
  }
  function clearOrder() {
    if (deps.lines.value.length === 0 && deps.orderId.value == null) {
      deps.message.info('当前订单已为空')
      return
    }
    deps.dialog.warning({
      title: '清空订单',
      content: '将清空当前订单的所有内容（未保存的更改会丢失）。是否继续？',
      positiveText: '清空',
      negativeText: '取消',
      onPositiveClick: () => resetOrder(),
    })
  }
  // —— 「上次订单」的写入 ——
  //
  // 旧版只在**「3.保存回执单」成功那一刻**写一次（`H:8853`），页面加载时**什么都不恢复**
  // （`onMounted`（`H:8261`）里没有这个键）。口径、修正经过、键名取舍全都写在
  // `app/src/utils/lastOrder.ts` 的文件头里 —— 一句话：
  // **我们先前那个「编辑中就落盘的实时草稿 + onMounted 无条件恢复」是自造的，已整套删掉**
  // （用户 2026-09-19 报的「每次刷新页面都会自动恢复上次订单」就是它）。
  function persistLastOrder() {
    writeLastOrder(lastOrderIO, {
      header: { ...deps.order },
      lines: deps.lines.value,
      showPing: deps.showPing.value,
      showDiao: deps.showDiao.value,
      savedAt: Date.now(),
    })
  }

  return {
    // 5 项回传（其余 6 个声明在页面里零读者，见文件头「回传面」）。
    markSaved,
    handleBeforeUnload,
    importLastOrder,
    clearOrder,
    persistLastOrder,
  }
}
