/**
 * 「列显隐」（仿旧版 `ping_column` / `diao_column`，租户级）—— 2026-09-20 从 `Hui.vue` 搬出
 * （逻辑逐字未改，C2）。
 *
 * 搬出前的行段（参照提交 `28e36d21`，即本次拆分动工前）是**两段**，中间隔着「自动加价设置」：
 *   · `Hui.vue:1005-1104` —— 两个列清单 + `pingColVis`/`diaoColVis` + `colVis` + 设置弹窗四件
 *     （`visOpen`/`visDraft`/`savingVis` + `openVisDialog`/`resetVisDraft`/`saveVisDialog`）
 *   · `Hui.vue:1258-1310` —— 旧版租户默认值 `PING_COL_DEFAULTS`/`DIAO_COL_DEFAULTS`
 *     + `seedColumnDefaults` + `loadColumnConfig`
 * 两段合计 **15 个声明**（与 spec §3.3 的 C2 对得上）。
 *
 * 搬迁保真由 `docs/home-audit/hui-extract-movecheck.mjs` 机核（`SPLIT_BLOCKS` 里 C2 一条）。
 *
 * ## 🔴 引用同一性（spec §6.1-1）：`pingColVis` / `diaoColVis` 必须**回传同一个 `reactive` 对象**
 *
 * 这是本块唯一「搬错不报错、类型也对」的地方：`DetailLinesTable.vue:72` 把 `colVis` 声明成
 * **普通 prop**（`colVis: Record<string, boolean>`），读的是 `props.colVis`。
 * 而本块对它的写法是**原地改**（`Object.keys(…).forEach(k => delete …)` + `Object.assign(…)`）——
 * **原地改就是语义本身**：页面把同一个代理传下去，改完表格立刻跟着变。
 * ⇒ 返回**对象本身**（页面解构出来的就是这个代理）；**不要**返回副本、`toRefs`、computed 或展开
 *   ⇒ 一旦是副本，「保存列显隐」后表格列**不变**，且**没有任何报错**。
 *
 * ## 注入面 = **1 项**
 *
 * | 注入项 | 正主 | 体里怎么用 |
 * |---|---|---|
 * | `message` | 页面 `useMessage()` | `saveVisDialog` 的成功/失败提示 |
 *
 * `api` 是模块级单例（`../api/client`）⇒ 新家直接 `import`，**不注入**。
 *
 * ## 回传面 = **11 项**
 *
 * · 10 项是模板绑定（2026-09-20 实测）：`PING_VIS_KEYS`(`:539`)/`DIAO_VIS_KEYS`(`:548`) 的 `v-for`、
 *   `pingColVis`(`:137`)/`diaoColVis`(`:154`) 的 `:col-vis`、`visOpen`(`:534` `v-model:show`，
 *   `:558` 是**写**)、`visDraft`(`:541`/`:550` `v-model:checked`)、`savingVis`(`:559` `:loading`)、
 *   `resetVisDraft`(`:557`)/`saveVisDialog`(`:559`) 的 `@click`，以及 `openVisDialog`
 *   （`onMoreSelect` 的 `case 'columns'` 调它 —— 菜单那条路，不在模板里但**是活调用点**）。
 * · 第 11 项 `loadColumnConfig` —— `onMounted` 里预载租户配置。
 * · **不回传的 4 个**（段外零命中，解构出来就是 TS6133）：`colVis`（本块内部判据）、
 *   `PING_COL_DEFAULTS`/`DIAO_COL_DEFAULTS`（只被本块的 `resetVisDraft`/`seedColumnDefaults` 读）、
 *   `seedColumnDefaults`（只被 `loadColumnConfig` 调）。
 */
import { reactive, ref } from 'vue'
import type { MessageApi } from 'naive-ui'
import { api } from '../../api/client'

/** `useHuiColumnConfig()` 的注入面。**只放页面拥有的东西**（见文件头那张表）。 */
export interface HuiColumnConfigDeps {
  /** 页面 `useMessage()`。 */
  message: MessageApi
}

/** 列显隐：两个列清单、生效值、设置弹窗、旧版租户默认值与载入。 */
export function useHuiColumnConfig(deps: HuiColumnConfigDeps) {
  const PING_VIS_KEYS = [
    { key: 'profile_color', label: '型材/颜色' },
    { key: 'unit_quantity', label: '单价/数量' },
    { key: 'glass', label: '玻璃' },
    { key: 'open_dir', label: '开向' },
    { key: 'track', label: '开向内·锁具(轨道)' },
    { key: 'casing', label: '开向内·包边(套线)' },
    { key: 'door_size', label: '门洞尺寸' },
    { key: 'hole_size', label: '洞尺（门洞尺寸格内「洞/净尺」）' },
    { key: 'jiao', label: '吊脚' },
    // 「亮窗总高」原版**无显隐闸门**，故不进本表（仍照常显示）
    { key: 'hardware', label: '五金' },
    { key: 'seal_board', label: '封板高' },
    { key: 'remark', label: '备注' },
    { key: 'money', label: '金额' },
    { key: 'markup_summary', label: '加价' },
    { key: 'price_type', label: '计价方式' },
    { key: 'discount', label: '打折' },
    { key: 'front_casing', label: '前包加长' },
    { key: 'back_casing', label: '后包加长' },
    { key: 'double_ding', label: '单/双丁' },
    { key: 'order_no', label: '单号' },
    { key: 'image_id', label: '图片ID' },
    { key: 'client', label: '客户' },
    { key: 'client_code', label: '客户编号' },
    { key: 'other_fee', label: '其它费用' },
  ]
  // 移门表可显隐列（列序同原版，见 diaoCols 注释）

  const DIAO_VIS_KEYS = [
    { key: 'profile_color', label: '型材/颜色' },
    { key: 'unit_qty', label: '单价/数量' },
    { key: 'glass', label: '玻璃' },
    { key: 'fans_dir', label: '扇数/开向' },
    { key: 'track_line', label: '下轨道/套线' },
    { key: 'door_size', label: '门洞尺寸' },
    { key: 'hole_size', label: '洞尺（门洞尺寸格内「洞/净尺」）' },
    { key: 'lightwin', label: '亮窗信息' },
    { key: 'hardware', label: '五金' },
    { key: 'remark', label: '备注' },
    { key: 'money', label: '金额' },
    { key: 'markup_summary', label: '加价' },
    { key: 'up_track_seal', label: '上轨/边封' },
    { key: 'front_casing', label: '前包加长' },
    { key: 'back_casing', label: '后包加长' },
    { key: 'double_ding', label: '单/双丁' },
    { key: 'price_type', label: '计价方式' },
    { key: 'discount', label: '打折' },
    { key: 'order_no', label: '单号' },
    { key: 'image_id', label: '图片ID' },
    { key: 'client', label: '客户' },
    { key: 'client_code', label: '客户编号' },
    { key: 'other_fee', label: '其它费用' },
  ]
  // 是否显示某列（缺省都显示）
  const pingColVis = reactive<Record<string, boolean>>({})
  const diaoColVis = reactive<Record<string, boolean>>({})
  function colVis(map: Record<string, boolean>, key: string): boolean {
    return map[key] !== false // 仅当显式 false 才隐藏
  }
  // 列显隐设置弹窗
  const visOpen = ref(false)
  const visDraft = reactive({ ping_columns: {} as Record<string, boolean>, diao_columns: {} as Record<string, boolean> })
  const savingVis = ref(false)

  function openVisDialog() {
    // 从当前生效值初始化草稿（缺省都显示）
    visDraft.ping_columns = {}
    visDraft.diao_columns = {}
    for (const c of PING_VIS_KEYS) visDraft.ping_columns[c.key] = colVis(pingColVis, c.key)
    for (const c of DIAO_VIS_KEYS) visDraft.diao_columns[c.key] = colVis(diaoColVis, c.key)
    visOpen.value = true
  }

  /** 「恢复默认」：把草稿勾回旧版租户配置那套（见 `PING_COL_DEFAULTS`），**要再点保存才生效**。 */
  function resetVisDraft() {
    for (const c of PING_VIS_KEYS) visDraft.ping_columns[c.key] = PING_COL_DEFAULTS[c.key] !== false
    for (const c of DIAO_VIS_KEYS) visDraft.diao_columns[c.key] = DIAO_COL_DEFAULTS[c.key] !== false
  }

  async function saveVisDialog() {
    savingVis.value = true
    try {
      await api.updateColumnConfig({
        ping_columns: { ...visDraft.ping_columns },
        diao_columns: { ...visDraft.diao_columns },
      })
      // 回写到生效值
      Object.keys(pingColVis).forEach((k) => delete pingColVis[k])
      Object.keys(diaoColVis).forEach((k) => delete diaoColVis[k])
      for (const [k, v] of Object.entries(visDraft.ping_columns)) pingColVis[k] = v
      for (const [k, v] of Object.entries(visDraft.diao_columns)) diaoColVis[k] = v
      visOpen.value = false
      deps.message.success('列显隐已保存')
    } catch (e) {
      deps.message.error(e instanceof Error ? e.message : '保存列配置失败')
    } finally {
      savingVis.value = false
    }
  }

  /**
   * 列显隐默认值 —— 取自**旧版租户配置**（`GET /1?param1=login` 返回的
   * `registrant.ping_column` / `registrant.diao_column`，2026-09-16 实查）：
   *
   *   ping_column = {"五金":1,"前包加长":1,"单双丁":1,"吊脚":0,"后包加长":1,"套线种类":1,
   *                  "封板高":1,"平方数":0,"开向模式":1,"打折":0,"洞尺":1,"轨道种类":0,"锁向":1}
   *   diao_column = {"五金":0,"单双丁":1,"封板高":1,"打折":1,"数量":0,"洞尺":1,"计价方式":0}
   *
   * 旧版的闸门是「真值才渲染」；另外 **日期/回执单号/图片ID/客户/客户编号/其它费用 六列
   * 在旧版里恒 false**（闸门变量 `he`/`ge` = `Vue.ref(!1)`，全组件无赋值），从来没显示过，
   * 所以这里也默认隐藏（仍可在「列显隐设置」里打开）。
   */
  const PING_COL_DEFAULTS: Record<string, boolean> = {
    jiao: false, // 吊脚:0
    discount: false, // 打折:0
    track: false, // 轨道种类:0（开向格里的「锁具」那一行）
    image_id: false,
    client: false,
    client_code: false,
    other_fee: false,
  }
  const DIAO_COL_DEFAULTS: Record<string, boolean> = {
    hardware: false, // 五金:0
    price_type: false, // 计价方式:0
    image_id: false,
    client: false,
    client_code: false,
    other_fee: false,
  }
  function seedColumnDefaults() {
    Object.keys(pingColVis).forEach((k) => delete pingColVis[k])
    Object.keys(diaoColVis).forEach((k) => delete diaoColVis[k])
    Object.assign(pingColVis, PING_COL_DEFAULTS)
    Object.assign(diaoColVis, DIAO_COL_DEFAULTS)
  }

  async function loadColumnConfig() {
    seedColumnDefaults()
    try {
      const c = await api.getColumnConfig()
      // 后端存过就用存过的（整表覆盖；未存过保留上面的旧版默认）
      if (c.ping_columns && Object.keys(c.ping_columns).length) {
        Object.keys(pingColVis).forEach((k) => delete pingColVis[k])
        Object.assign(pingColVis, c.ping_columns)
      }
      if (c.diao_columns && Object.keys(c.diao_columns).length) {
        Object.keys(diaoColVis).forEach((k) => delete diaoColVis[k])
        Object.assign(diaoColVis, c.diao_columns)
      }
    } catch {
      // 忽略：保留旧版默认
    }
  }
  return {
    // 10 项模板/菜单绑定 + `loadColumnConfig`（`onMounted` 用）—— 逐条见文件头。
    // ⚠️ `pingColVis`/`diaoColVis` 回传的是**对象本身**（同一个 `reactive` 代理），见文件头 §6.1-1。
    PING_VIS_KEYS,
    DIAO_VIS_KEYS,
    pingColVis,
    diaoColVis,
    visOpen,
    visDraft,
    savingVis,
    openVisDialog,
    resetVisDraft,
    saveVisDialog,
    loadColumnConfig,
    // 不回传 `colVis` / `PING_COL_DEFAULTS` / `DIAO_COL_DEFAULTS` / `seedColumnDefaults`：
    // 段外零命中，解构出来就是未使用变量（`vue-tsc` 的 TS6133 会报）。
  }
}
