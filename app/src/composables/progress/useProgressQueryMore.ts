/**
 * Progress 订单进度页的**「查询更多」开窗**（2026-09-20 从 `Progress.vue` 搬出，逻辑逐字未改）。
 *
 * 搬出前的行段（参照提交 `f097a9b1`，即本次拆分动工前）：`Progress.vue:1418-1598`
 * （连续一整段，181 行，**16 个声明**）—— 拆分方案里的 **P8**。
 * 段首那行分区横幅（`// ── C1b. 查询更多…`）与它下面 31 行的块注释
 * （旧版 `Lo`/`Io` 原文 + 两处**有意偏离** + 一处死代码说明）**一起搬来** ——
 * 「默认日期按本地时区算」「客户候选走 `/v1/clients`」两条的依据全在那段注释里。
 * 工厂体内**与 REF 一字不差、相对顺序也不动**。
 *
 * ⚠️ **横幅与段内注释的保真不在守卫里**（核心 `sliceFn` 从**声明**起切，它们根本不进切片）——
 *   唯一证据是「整段与 REF 同区间逐字节比」（判据 R39：归一化掉工厂那层统一缩进之后，
 *   剩余差异必须**恰好等于在案的注入改写，不多不少**）。别拿「守卫绿」当它的证据。
 *
 * ⚠️ **注入 4 项**（本块在页面上够不着的名字；**传 ref 本身，不是 `.value` 副本**）：
 *   · `rows`（REF 364）—— **写**：确认查询后把结果并回全量（`rows.value = [...]`，段内 3 处）。
 *   · `dashboardShow`（REF 418）—— 看板开着才把查到的日期区间回灌给它。
 *   · `searchText`（REF **1396**）—— **P7**（`useProgressToolbar.ts`，Task 4 已搬）回传的 `ref`。
 *     段内 2 处：确认后回显「客户 地址」、点清除时清空。
 *   · `message`（REF 352）—— 三句提示（初始化客户信息失败 / 查询成功 / 查询数据失败）。
 *   ⚠️ `ProgressRow`（REF 362）**不算注入**：它是 `type`，随本任务新建的
 *     `app/src/utils/progressRow.ts` 走 `import`（见那里的说明）。
 *   模块级依赖（`ref`/`reactive`/`computed` 与 `api` / `ClientDto` / `ProgressDashboard`）
 *   本文件**直接 import 不注入**（与 `useProgressColors.ts` 等同一口径）。
 *
 * ⚠️ **搬迁时的文本改写 = 5 条规则、命中 9 处**（逐条登记在守卫的 `rewrites` 里）：
 *   `searchText.value`(×2：`submitMore` / `onSearchClear`) · `dashboardShow.value`(×1) ·
 *   `message.error(`(×2：`openMore` / `submitMore`) · `message.success(`(×1) ·
 *   `rows.value`(×3，全在 `submitMore`)。
 *   · 规则一律**带边界**（核心文件头：「朴素 split/join，裸名会顺手打到别的标识符上」）：
 *     `message` 写成带 `.` 与左括号的 `message.error(` / `message.success(`。
 *   · `rows.value` 与 `moreRows.value` **不构成子串关系**（差在 `Rows` 的**大写 R**，
 *     且 split/join 大小写敏感）⇒ 段内那处 `moreRows.value = list`（本块自己的 ref）
 *     不会被这条规则误伤（已核）。
 *   · 9 处命中**全部落在活代码里**（逐条量过；段内注释里一处都没有）⇒ 不存在 P4 那种
 *     「规则改到注释里、注释内容就漂了」的风险。
 *   复量法：`applyRewrites` 的 `from` 在文本里找不到就**抛** ⇒ 上面这些计数一旦漂了，守卫直接红。
 *
 * ⚠️ **回传 13 项**（16 个声明里真的被段外消费的 13 个）：
 *   · **只被模板用**的 11 个（段外脚本引用 0）：`moreShow`(模板 209/257) `moreLoading`(258) ·
 *     `moreForm`(223/228/232/236/246) · `dashboardRef`(189) · `MORE_DATE_SHORTCUTS`(238/248) ·
 *     `AUTOCOMPLETE_ALWAYS_SHOW`(225) · `moreClientOptions`(224) · `openMore`(118/193) ·
 *     `submitMore`(258) · `onSearchInput`(142) · `onSearchClear`(143)。（模板行号取自 REF。）
 *   · **段外脚本**的 2 个：`moreRows` / `moreActive` —— 引用点**两处、分属两个块**：
 *     REF **1061**（`useProgressHeader` 候选集那一行，**P5**）与 REF **1251**
 *     （`filteredRows` 的 `computed` 体第一行，**P6**）。
 *     两处源码**逐字同形**（`moreActive.value ? moreRows.value : rows.value`）
 *     ⇒ grep 只能告诉你「有 2 处」，**必须把引用点回落块区间**才知道是**两个**接点。
 *     ⚠️ **本任务只负责把这两个名字回传出来**：P5 那一头（Task 4 已接）在本文件落地后
 *       改喂这里解构出的同名绑定；**P6 那一头（`filteredRows`）此刻仍在壳里** ——
 *       壳里解构出这两个名字之后它**照样读得到**（Task 7 搬 P6 时才改成接
 *       `useProgressColumns` 的回传）。
 *   ⚠️ **不回传、也不许解构的 3 个**：`moreClients` `dayStart` `toIsoDate`
 *     —— 段外脚本 0 引用、模板 0 引用（真 TS 解析器实测）。
 *     ⚠️ 但**「不回传」≠「可以删」**：它们仍是本块的内部件（`moreClientOptions` 读
 *       `moreClients`、`MORE_DATE_SHORTCUTS`/`openMore` 读 `dayStart`、`submitMore` 读
 *       `toIsoDate`）⇒ **跟着本块搬走，只是不借出去**。留在壳里才是死局部（`TS6133`）。
 *
 * ⚠️ **调用点为什么在壳里那个位置**：本块注入的 `searchText` 是 P7 工厂的回传
 *   （REF 1396）⇒ 调用点必须排在 `useProgressToolbar(...)` 之后；而 `useProgressHeader(...)`
 *   （P5）又拿本块的 `moreRows`/`moreActive` 当注入 ⇒ 本工厂的调用必须**早于**它。
 *   见 `.vue` 里那段指路注释。
 */
import { computed, reactive, ref, type Ref } from 'vue'
import type { MessageApi } from 'naive-ui'
import { api } from '../../api/client'
import type { ClientDto } from '../../api/types'
import type { ProgressRow } from '../../utils/progressRow'
import ProgressDashboard from '../../components/ProgressDashboard.vue'

/** `useProgressQueryMore()` 的注入面。**只放页面 / P7 拥有的东西**（见文件头「注入 4 项」）。 */
export interface ProgressQueryMoreDeps {
  /**
   * 全量行（页面 `ref<ProgressRow[]>([])`）—— 本块**写**它：确认查询后把结果并回全量
   * （已有 id 的换对象、新 id 追加到末尾，见 `submitMore` 里那段逐字抄着旧版 `Io` 的注释）。
   */
  rows: Ref<ProgressRow[]>
  /** 看板是否开着（页面 `ref(false)`）—— 开着才把查到的日期区间回灌给它。 */
  dashboardShow: Ref<boolean>
  /**
   * 搜索框词（**P7** `useProgressToolbar` 回传的 `ref`，REF 1396）—— 段内 2 处：
   * 确认后回显「客户 地址」、点清除时清空。
   */
  searchText: Ref<string>
  /** 三句提示（页面 `useMessage()`）：初始化客户信息失败 / 查询成功 / 查询数据失败。 */
  message: MessageApi
}

/**
 * 「查询更多」开窗（旧版 `Lo` 开窗 + `Io` 确认）—— 也就是 `no` 链路里的 `Bo`/`xo` 那一层。
 *
 * ⚠️ **构造顺序**：四个注入项都是 setup 顶层即时求值 ⇒ 调用本工厂之前它们必须都已声明好
 *   （`searchText` 最晚，来自 P7 的工厂）。见 `.vue` 里那段指路注释。
 */
export function useProgressQueryMore(deps: ProgressQueryMoreDeps) {
  // ── C1b. 查询更多（旧版 `Lo` 开窗 + `Io` 确认）—— 也就是 `no` 链路里的 `Bo`/`xo` 那一层 ──
  /*
   * 旧版原文（反混淆后，逐字）：
   *
   *   ko = 30 天前、Mo = 今天（两个 ISO 日期串）；Ao = 最近一周 / 最近一个月 / 最近三个月 三个快捷项
   *   Lo = async () => { Co=""; Do.selectedClient=""; Do.selectedAddress=""; Do.startDate=ko; Do.endDate=Mo;
   *                      ho=true; 拉 getClientsInfo → No = data.map(e => ({name:e.客户, tel:e.电话, address:e.地址, id:e.编号}))
   *                      拿不到 → ElMessage.error("初始化客户信息失败") }
   *   Io = async () => { …Do.selectedClient = Co…          // ← 提交时取**输入框文本**，不是下拉里选中的那条
   *                      GET getMoreProgress&param3=客户&param4=地址&param5=起始&param6=结束
   *                      非 200 → error(msg || "查询数据失败")
   *                      d = progressData.map(e => ({...e, isSelected:!1, "生产进度": e["生产进度"]||""}))
   *                                       .sort((a,b) => parseInt(b["回执单号"]) - parseInt(a["回执单号"]))  // 倒序
   *                      xo.value = d; Bo.value = true
   *                      并入 K：已有 id 的**换成新的那条**（位置不变）、新 id **追加到末尾**
   *                      zo.value = (客户 + " " + 地址).trim()   // ← 搜索框被赋值，「当前筛选」那句就是它
   *                      ho.value = false; ElMessage.success("查询成功") }
   *
   * ⚠️ 两处**有意偏离**（其余逐字照抄）：
   *
   * ① **默认日期按本地时区算**。旧版那两个默认值是 `new Date().toISOString().split("T")[0]`（**UTC**）
   *    ⇒ UTC+8 每天 00:00–08:00 打开弹窗，默认区间整体早一天。本仓库对 `toISOString()` 的同类问题
   *    已有定论（见 `Home.vue` 的 `localToday()` 那段「必须用本地日期，不能用 `legacyToday()`」），
   *    这里沿用同一口径：默认起始 = **本地**今天 − 30 天、默认结束 = **本地**今天。
   * ② **客户候选走 `GET /v1/clients`**（不照抄旧版那个口）。旧版 `getClientsInfo` 在旧服务端上返回的是
   *    prisma 行（**camelCase**），而旧前端读的是 `e["客户"]/["电话"]/["地址"]/["编号"]` —— 四个键全是
   *    `undefined`，紧接着 `bo` 里的 `l.name.toLowerCase()` 会**直接抛**。⇒ **那个口本来就是坏的，
   *    别拿它当参照**（分析文档 §8.3 与服务端文档各自独立证过同一件事）。
   *    字段映射按新版：`{ name, tel: phone, address, id: code }`。
   * ③ 旧版那颗客户框身上的 `.error-input`（红框）在这个页面里**从没被置真过**（`Eo` 只在 `onInput` 里被
   *    写成 `false`）⇒ 死代码，不复刻。
   */
  const moreShow = ref(false)
  /** 「查询中…」（旧版是 `ElLoading.service`，新版用按钮 loading）。 */
  const moreLoading = ref(false)
  /** 客户候选（旧版 `No`）。⚠️ 只是给下拉用，取不到也不拦查询。 */
  const moreClients = ref<ClientDto[]>([])
  /** 结果集（旧版 `xo`）。 */
  const moreRows = ref<ProgressRow[]>([])
  /**
   * 结果集生效标志（旧版 `Bo`）：为真时筛选链的底表从全量换成 `moreRows`，退出的条件只有两个 ——
   * **动搜索框**或**点搜索框的清除**（旧版 `ao` / `lo`）。
   *
   * ⚠️ **「刷新」不会退出结果集**：旧版 `pa()` 只重拉 `K`，`Bo`/`xo` 原样留着 ⇒ 刷新之后表里显示的
   *    仍是上一次查出来的那批行（且是旧对象）。看着像 bug，但那是旧版的行为，**照抄**
   *    （要退出结果集就按旧版那两条路：动一下搜索框、或点它的清除）。
   */
  const moreActive = ref(false)
  const moreForm = reactive<{
    client: string
    address: string
    startTs: number | null
    endTs: number | null
  }>({ client: '', address: '', startTs: null, endTs: null })
  /** 看板组件引用（旧版 `N`）—— 确认后把日期区间回灌给它（旧版 §3.5 那条环）。 */
  const dashboardRef = ref<InstanceType<typeof ProgressDashboard> | null>(null)

  /** 本地「今天 00:00」起算的 `offsetDays` 天前的时间戳（`n-date-picker` 的 model 是时间戳）。 */
  function dayStart(offsetDays = 0): number {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() + offsetDays)
    return d.getTime()
  }

  /** 时间戳 → 本地 `YYYY-MM-DD`（旧版 `value-format:"YYYY-MM-DD"`，Element 按本地日期格式化）。 */
  function toIsoDate(ts: number | null): string {
    if (ts == null) return ''
    const d = new Date(ts)
    const p = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
  }

  /**
   * 日期快捷项（旧版 `Ao`）：最近一周 / 最近一个月 / 最近三个月，**顺序与文案照抄**
   * （旧版是 `now - 6048e5 / -2592e6 / -7776e6` 三个定值）。
   * ⚠️ 旧版是 setup 里算好的**定值**（跨零点会把「最近一周」选成昨天），这里用函数形态按点击时求值
   * —— 与 `DATE_SHORTCUTS` 同一个口径（该声明已随 B5 归位到
   * `app/src/composables/home/useHomeQueryMore.ts`，2026-09-20 纯搬迁）。
   */
  const MORE_DATE_SHORTCUTS: Record<string, () => number> = {
    最近一周: () => dayStart(-7),
    最近一个月: () => dayStart(-30),
    最近三个月: () => dayStart(-90),
  }

  /** 自动完成永远展示候选（旧版 `trigger-on-focus`；与 `Home.vue` 的 `AUTOCOMPLETE_ALWAYS_SHOW` 同一招 —— 该常量的**声明**已于 2026-09-20 归位到 `app/src/utils/homeConstants.ts`，纯搬迁，`Home.vue` 那边只剩 import 与模板里两处 `:get-show`）。 */
  const AUTOCOMPLETE_ALWAYS_SHOW = () => true

  /** 客户候选：按 `name` 子串（忽略大小写）本地过滤；查询词为空给全量（旧版 `bo`）。 */
  const moreClientOptions = computed(() => {
    const q = moreForm.client.trim().toLowerCase()
    return moreClients.value
      .filter((c) => !q || (c.name ?? '').toLowerCase().includes(q))
      .map((c) => ({ label: c.name, value: c.name }))
  })

  /** 旧版 `Lo`：重置表单 + 开窗 + （异步）拉客户候选。看板那条环也走这里。 */
  async function openMore() {
    moreForm.client = ''
    moreForm.address = ''
    moreForm.startTs = dayStart(-30)
    moreForm.endTs = dayStart(0)
    moreShow.value = true
    try {
      // ⚠️ 旧版这里按 `{name: 客户, tel: 电话, address: 地址, id: 编号}` 映射（那四个键永远读不到，
      //    见上面第 ② 条）—— 新版直接用 `ClientDto` 的字段。
      moreClients.value = await api.listClients()
    } catch {
      deps.message.error('初始化客户信息失败')
    }
  }

  /** 旧版 `Io`：取数 → 排序 → 换底表 → 并入全量 → 搜索框回显 → 关窗。 */
  async function submitMore() {
    moreLoading.value = true
    try {
      const d = await api.listProgressMore({
        client_name: moreForm.client,
        install_address: moreForm.address,
        start_date: toIsoDate(moreForm.startTs),
        end_date: toIsoDate(moreForm.endTs),
      })
      const list: ProgressRow[] = (d?.progressData ?? [])
        // 同旧版：补 `isSelected`（勾选态随新对象归零）+ `生产进度` 兜底成空串
        .map((r) => ({ ...r, isSelected: false, 生产进度: r['生产进度'] || '' }))
        // 旧版按 `parseInt(回执单号)` **倒序**。⚠️ `parseInt` 解不出来的（空/非数字）是 `NaN`，
        // 比较函数返回 `NaN` ⇒ 被引擎当成 0（这几行的相对次序不保证）—— 旧版就是这个表现，照抄。
        .sort((a, b) => parseInt(b['回执单号']) - parseInt(a['回执单号']))

      moreRows.value = list
      moreActive.value = true

      /*
       * 并入全量 `K`（旧版 `Io` 末段，逐字）：
       *   V = new Set(K.map(id)); w = d.filter(r => V.has(r.id)); y = d.filter(r => !V.has(r.id))
       *   K = K.map(e => w.find(t => t.id === e.id) || e);  K = [...K, ...y]
       * ⇒ 查回来的**已有行换成新的那条对象**（位置保持在全量里的原位），**新行追加到末尾**。
       * ⚠️ 副作用照抄：被换掉的那些行对象上的勾选态没了（新对象是 `isSelected:false`）。
       */
      const existing = new Set(deps.rows.value.map((r) => r.id))
      const byId = new Map(list.filter((r) => existing.has(r.id)).map((r) => [r.id, r]))
      deps.rows.value = [
        ...deps.rows.value.map((r) => byId.get(r.id) ?? r),
        ...list.filter((r) => !existing.has(r.id)),
      ]

      // 搜索框回显「客户 地址」（旧版 `zo = (selectedClient + " " + selectedAddress).trim()`）。
      // ⚠️ 照抄旧版的两个后果：① 它**同时**是「当前筛选」那句文案与「导出表格」那颗按钮的开关；
      //    ② 空条件时它是空串 ⇒ 仍按「总计」显示。两者都与旧版一致，别当成 bug 去"修"。
      deps.searchText.value = `${moreForm.client} ${moreForm.address}`.trim()

      // 看板开着才回灌（旧版 `B.value && N.value`）：`setCustomDateRange` 顺手把时间档位切到「自定义查询」。
      if (deps.dashboardShow.value && dashboardRef.value) {
        dashboardRef.value.setCustomDateRange([
          toIsoDate(moreForm.startTs),
          toIsoDate(moreForm.endTs),
        ])
      }

      moreShow.value = false
      // 旧版文案。
      deps.message.success('查询成功')
    } catch (e) {
      deps.message.error(e instanceof Error ? e.message : '查询数据失败')
    } finally {
      moreLoading.value = false
    }
  }

  /** 旧版 `ao`：搜索框一动就打字退出「查询更多」的结果集（**不清** `xo`，也不清 `zo`）。 */
  function onSearchInput() {
    moreActive.value = false
  }

  /** 旧版 `lo`：点清除按钮 —— 清空搜索词**并且**退出结果集。 */
  function onSearchClear() {
    deps.searchText.value = ''
    moreActive.value = false
  }

  /*
   * 13 个**全部**回传 —— 本块的产出面就是它们（同 P2/P3/P5/P7 的口径）。
   * 另 3 个（`moreClients` / `dayStart` / `toIsoDate`）**不回传**、壳里也不解构
   * —— 但**别把它们从本文件删掉**：它们是本块自己的内部件（见文件头最后一条 ⚠️）。
   */
  return {
    moreShow, moreLoading, moreRows, moreActive, moreForm, dashboardRef,
    MORE_DATE_SHORTCUTS, AUTOCOMPLETE_ALWAYS_SHOW, moreClientOptions,
    openMore, submitMore, onSearchInput, onSearchClear,
  }
}
