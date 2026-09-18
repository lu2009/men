
// ════ 搬迁自 Hui.vue 1442-1701：A 单元格 ════
function wallThicknessCell(l: Line) {
  return h(
    NInputNumber,
    {
      ...CELL,
      class: 'red-number-input',
      status: cellError(l, 'wall_thickness') ? 'error' : undefined,
      value: l.wall_thickness,
      showButton: false,
      inputStyle: { textAlign: 'right' },
      onUpdateValue: (v: number | null) => {
        l.wall_thickness = sanitizeNum(v, 0)
        lineRefresh(l)
      },
      // 原版 `Qt` 挂在 onBlur：吊趟会在 ≥2 候选时弹窗，随输入触发会连弹
      onBlur: () => syncSizeMarkup(l, 'wall_thickness'),
    },
  )
}

// 玻璃单元格（面玻/底玻）：onSelect 需拿改前值做「元/方」加价项联动，故此处自行实现。
function glassSelectCell(l: Line, field: 'face_glass' | 'bottom_glass') {
  const oldByField = new WeakMap<object, string>()
  return h(
    NSelect,
    {
      ...CELL,
      status: cellError(l, field) ? 'error' : undefined,
      value: (l as unknown as Record<string, string>)[field],
      options: glassOptions,
      filterable: true,
      // ⚠️ **不加 `clearable`** —— 原版底玻/面玻两格都没有（@75060 / @73314），
      //    配合「必填」校验与新建行默认值（磨砂·白玻 / 白玻·白玻）⇒ 空串根本产生不出来。
      onUpdateValue: (v: string | null) => {
        const old = oldByField.get(l) ?? (l as unknown as Record<string, string>)[field] ?? ''
        ;(l as unknown as Record<string, string>)[field] = (v as string) ?? ''
        oldByField.set(l, (v as string) ?? '')
        onGlassSelection(l, (v as string) ?? '', old)
        // 「改底玻 → 设为默认」只在**平开表**（原版 `le` 仅挂在平开表底玻格的 onSelect/onBlur）。
        if (field === 'bottom_glass' && l.line_type === 'ping') rememberDefaultBottomGlass((v as string) ?? '')
      },
    },
  )
}

// 就地控件 helpers（h() 渲染）
const CELL = {
  size: 'small' as const,
  style: { width: '100%' },
  // 旧版的 el-input / el-select 在不写 placeholder 时是**空的**；
  // naive-ui 不给就是英文默认值（"Please Input" / "Please Select"），必须显式清空。
  placeholder: '',
}

// 校验红框：必填但为空的字段 → status=error（仿旧版 error-cell 红框标单元格）
function cellError(l: Line, field: string): boolean {
  const t = l.line_type
  switch (field) {
    case 'profile': return !l.profile.trim()
    // 门洞宽/高**不标红** —— 原版从不给 `errorFields["门洞高"/"门洞宽"]` 写 true（死代码，见
    // `missingFieldsOf` 的注释），单元格上的 `error-cell` 绑定恒为 false。
    case 'color': return !l.color.trim()
    // 底玻/面玻 也是必填：原版两格都挂了 `error-cell`（`{["error-cell"]: 校验结果["底玻"]}`），
    // 且**没有 `clearable`**（见 @75060 平开 / @185271 吊趟 的底玻格、@73314 / @183565 的面玻格）。
    case 'bottom_glass': return !l.bottom_glass.trim()
    case 'face_glass': return !l.face_glass.trim()
    case 'glass_thickness': return !l.glass_thickness.trim()
    case 'direction': return !l.direction.trim()
    case 'quantity': return t === 'ping' && !(l.quantity >= 1)
    case 'price_type': return t === 'ping' && !l.price_type.trim()
    case 'fans': return t === 'diao' && !l.fans.trim()
    case 'track': return t === 'diao' && !l.track.trim()
    default: return false
  }
}

function tCell(l: Line, field: string, onBlur?: (l: Line) => void) {
  return h(
    NInput,
    {
      ...CELL,
      status: cellError(l, field) ? 'error' : undefined,
      value: (l as unknown as Record<string, string>)[field],
      onUpdateValue: (v: string) => {
        ;(l as unknown as Record<string, string>)[field] = v
        lineRefresh(l)
      },
      onBlur: onBlur ? () => onBlur(l) : undefined,
    },
  )
}

/**
 * 数字格红字（旧版 `.red-number-input .el-input__inner{color:red}`）挂在哪些格子上：
 *   平开：门洞高 / 门洞宽 / 墙厚 / 钻石型门洞尺寸里的「右宽」那一格（绑的也是 亮窗总高）
 *   移门：门洞高 / 门洞宽 / 墙厚 / 封板高
 * 注意 **独立的「亮窗总高」列不红**（原版那一格没挂 class）—— 同一字段在钻石型里才红，
 * 两种渲染互斥，所以这里按 `isDiamond` 判断即可。吊脚 / 轨道长 / 边封数 都是黑字。
 */
function isRedNum(l: Line, field: string): boolean {
  if (field === 'door_width' || field === 'door_height' || field === 'wall_thickness') return true
  if (field === 'light_window_height') return isDiamond(l)
  if (field === 'seal_board_height') return l.line_type === 'diao'
  return false
}

function intCell(l: Line, field: string, min = 0) {
  // 门洞宽/门洞高在**失焦**时触发尺寸类自动加价（原版 `Qt` 挂在 onBlur 上，不是随输入）
  const sizeField =
    field === 'door_width' || field === 'door_height' ? (field as SizeField) : null
  return h(
    NInputNumber,
    {
      ...CELL,
      class: isRedNum(l, field) ? 'red-number-input' : undefined,
      status: cellError(l, field) ? 'error' : undefined,
      value: (l as unknown as Record<string, number>)[field],
      min,
      showButton: false,
      inputStyle: { textAlign: 'right' },
      onUpdateValue: (v: number | null) => {
        ;(l as unknown as Record<string, number>)[field] = sanitizeNum(v, min)
        lineRefresh(l)
      },
      onBlur: sizeField ? () => syncSizeMarkup(l, sizeField) : undefined,
    },
  )
}

function moneyCell(l: Line, field: string, min = 0) {
  return h(
    NInputNumber,
    {
      ...CELL,
      status: cellError(l, field) ? 'error' : undefined,
      value: (l as unknown as Record<string, number>)[field],
      min,
      showButton: false,
      inputStyle: { textAlign: 'right' },
      onUpdateValue: (v: number | null) => {
        ;(l as unknown as Record<string, number>)[field] = sanitizeFloat(v, min)
        lineRefresh(l)
      },
    },
  )
}

function optCell(
  l: Line,
  field: string,
  options: { label: string; value: string }[],
  onChange?: (l: Line) => void,
  allowCreate = false,
  historyKey?: string,
) {
  return h(
    NSelect,
    {
      ...CELL,
      status: cellError(l, field) ? 'error' : undefined,
      value: (l as unknown as Record<string, string>)[field],
      options,
      filterable: true,
      clearable: true,
      ...(allowCreate ? { tag: true } : {}),
      onUpdateValue: (v: string | null) => {
        const next = (v as string) ?? ''
        ;(l as unknown as Record<string, string>)[field] = next
        if (historyKey) rememberField(historyKey, next)
        ;(onChange ?? lineRefresh)(l)
      },
    },
  )
}

// 型材/颜色：带候选下拉（可搜索 + 可输入新值，仿旧版 autocomplete），型材变化即取价/算料
// 型材候选按行门型过滤（平开不显示移门公式）
function profileCell(l: Line) {
  const opts = l.line_type === 'diao' ? diaoProfileOptions.value : pingProfileOptions.value
  // 不加 `historyKey`：原版型材**不写候选库**（见 `profileOptionsFor` 注释），故无需记忆。
  return optCell(l, 'profile', opts, (x) => void resolveRow(x), true)
}


function colorCell(l: Line) {
  return h(
    NSelect,
    {
      ...CELL,
      status: cellError(l, 'color') ? 'error' : undefined,
      value: l.color,
      options: colorOptions.value,
      filterable: true,
      clearable: true,
      tag: true,
      onUpdateValue: (v: string | null) => {
        const next = (v as string) ?? ''
        l.color = next
        rememberField('color', next)
        lineRefresh(l)
      },
    },
  )
}
function trackCell(l: Line) {
  // 轨道候选按当前行公式 parts 的 track 提取（随型材联动），合并历史
  const opts = partsTrackOptions(l, 'track') // 轨道候选仅来自公式 parts + 历史，无内置兜底
  return optCell(l, 'track', opts, undefined, true, 'track')
}
function casingCell(l: Line) {
  // 套线候选仅来自当前行公式 parts 的单包/双包 + 历史，无内置候选（原版）
  const opts = partsTrackOptions(l, 'casing')
  return optCell(l, 'casing', opts, undefined, true, 'casing')
}
// 平开「包边」＝原版「套线种类」（Hui.formatted.js:2132 的「包边:」标签即绑 `e["套线种类"]`）。
// 平开公式常无 包宽/包高 件，纯靠 parts 提候选会空，故候选 = 原版枚举 + 公式套线件 track + 历史。
/**
 * 五金格 —— 原版是**多选** el-select（:2387-2434）：
 *   · 行字段 `五金` 存的是**下划线分隔的字符串**（`a_b_c`），候选里要去掉已选的；
 *   · `multiple/filterable/allow-create/collapse-tags`，`placeholder:"选择或填写五金"`；
 *   · 已选项会在下方另起一行 `join("、")` 展示（:2434-2435，style margin-top:4px/font-size:12px/color:#606266）。
 * 我们原来是**单选**（`optCell` + tag），只能存一个五金 —— 与旧版不符，这里改成多选。
 */
function hardwareCell(l: Line) {
  const selected = String(l.hardware || '')
    .split('_')
    .map((s) => s.trim())
    .filter(Boolean)
  const options = hardwareOptionsFor(l).filter((o) => !selected.includes(o.value))
  return h('div', { class: 'glass-inputs-container' }, [
    h(NSelect, {
      ...CELL,
      multiple: true,
      filterable: true,
      tag: true,
      options,
      value: selected,
      placeholder: '选择或填写五金',
      onUpdateValue: (vals: string[]) => {
        // 去重后写回下划线串（原版 `m(行, 值数组)`：`[...new Set(v)].join("_")`）
        l.hardware = [...new Set(vals.map((v) => String(v)))].join('_')
        rememberField('hardware', l.hardware)
        lineRefresh(l)
      },
    }),
    selected.length
      ? h(
          'div',
          { style: 'margin-top:4px;font-size:12px;color:#606266;line-height:1.4' },
          selected.join('、'),
        )
      : null,
  ])
}
// 洞尺选项 —— **两张表的取值集不同**（原版 ping :2341-2345 只有 2 项，diao :5136-5141 有 4 项）
const PING_HOLE_SIZE_OPTS = ['洞尺', '净尺'].map((v) => ({ label: v, value: v }))
const DIAO_HOLE_SIZE_OPTS = ['洞尺', '净尺', '单包洞尺', '双包洞尺'].map((v) => ({ label: v, value: v }))
function holeCell(l: Line, options: { label: string; value: string }[]) {
  return optCell(l, 'hole_size', options)
}

// ════ 搬迁自 Hui.vue 1703-1718：B selCol ════
// 批量选择列：行首复选框，选中后可批量删除
const selCol = (): DataTableColumn<Line> => ({
  title: ' ',
  key: 'selection',
  width: 34,
  fixed: 'left',
  render: (l: Line) =>
    h(NCheckbox, {
      size: 'small',
      checked: !!l.isSelected,
      onUpdateChecked: (v: boolean) => {
        l.isSelected = v
        checkboxTick.value++
      },
    }),
})

// ════ 搬迁自 Hui.vue 1756-1781：C partsTooltip ════
function partsTooltip(l: Line) {
  const parts = (l.parts ?? []).filter((p) => p && p.materialName)
  if (!parts.length) return '点「算料」后在此显示部件数量与下料长度'
  return parts
    .map((p) => `${p.materialName} ×${p.quantity} → ${p.result.toFixed(2)}`)
    .join('\n')
}

// 操作列。**表头文字就是「平开门」/「移门」**（原版 :1723 / :4517 `label:"平开门"/"移门"`，
// width:"50"）——旧版没有额外的表格标题栏，门型名就挂在第一列表头上。
// 原版这一格的按钮是 删除 / 复制 / 查看3D（`div.upload-buttons` 竖排、文案前后带空格）；
// 我们把「查看3D」换成「算料」（3D 未做），文案保持原样。
// ===== 行级编辑态（旧版「点单元格 → 该行可 保存/取消」三件套）=====
//
// 旧版平开 `Hui.formatted.js:1335` 的 `ht=ref(new Map)` / `vt=ref(new Set)` / `pt=ref({})`；
// 移门 `:3769-3770` 的 `ae`/`xe`/`_e`。**两个 SFC 各持一份**，所以这里也是两份。
//
// | 本文件 | 旧版平开 | 旧版移门 | 是什么 |
// |---|---|---|---|
// | `editing`  | `ht` | `xe` | rowKey → 该行在表里的下标。**同时只允许一行**（进新行前 `clear()`） |
// | `snapshot` | `pt` | `ae` | rowKey → 进入编辑态那一刻的行副本（「取消」靠它回滚） |
// | `dirty`    | `vt` | `_e` | rowKey 集合；判定见 `recomputeDirty` |
//
// ⚠️ **`unsaved-row` 的语义跟着改了**：旧版是「脏」，我们原先写的是「行还没有 id」。
//    旧版新建行在客户端就有临时 id（`id:n()`，`:1805`）且没有快照 ⇒ `Et` 直接 `vt.delete`
//    ⇒ **永不判脏 ⇒ 从不标粉**。我们照旧版：无 id 的行没有 rowKey，进不了编辑态，也就不标粉。

// ════ 搬迁自 Hui.vue 1782-1924：D 行级编辑态 ════
type EditState = {
  editing: Map<string, number>
  snapshot: Record<string, Line>
  dirty: Set<string>
}
const pingEdit = reactive<EditState>({ editing: new Map(), snapshot: {}, dirty: new Set() })
const diaoEdit = reactive<EditState>({ editing: new Map(), snapshot: {}, dirty: new Set() })

/** 行键（旧版 `Ct`/`oe`：`String(row.id || row["回执单号"] || "")`）。我们行上没有回执单号，只认 id。 */
const rowKeyOf = (l: Line): string => (l.id != null ? String(l.id) : '')
/** 该行归哪张表的编辑态。 */
const editOf = (l: Line): EditState => (l.line_type === 'diao' ? diaoEdit : pingEdit)

/**
 * 脏判定用的投影（旧版 `Bt`/`ce`：剔掉一组**客户端专用**键）。
 * 旧版剔的是 `["平开门","门花图","开向图","errorFields","imageUrl","isSelected","生产进度"]`。
 * 换到我们的字段：`开向图`/`imageUrl`/`生产进度` 是**要落库的列**（`open_img`/`image_url`/`progress`），
 * 不能剔（剔了 `update_line` 会把它们抹空）；`errorFields` 我们没有；操作列标签不是字段。
 * ⇒ **只剔 `isSelected`**。
 */
function stripForDirty(l: Line): Record<string, unknown> {
  const out: Record<string, unknown> = { ...l }
  delete out.isSelected
  return out
}

/** 脏判定（旧版 `Et`/`ne`）：没有快照 ⇒ 不脏；有快照 ⇒ 与快照逐字段比。 */
function recomputeDirty(l: Line) {
  const st = editOf(l)
  const k = rowKeyOf(l)
  if (!k) return
  const snap = st.snapshot[k]
  if (!snap) {
    st.dirty.delete(k)
    return
  }
  if (JSON.stringify(stripForDirty(l)) !== JSON.stringify(stripForDirty(snap))) st.dirty.add(k)
  else st.dirty.delete(k)
}

/** 该行是否处于编辑态（决定操作列出「确认修改/取消」还是「删除/复制/算料」）。 */
const isEditing = (l: Line) => {
  const k = rowKeyOf(l)
  return !!k && editOf(l).editing.has(k)
}
/** 该行是否有未保存改动（`unsaved-row` 粉底的唯一来源）。 */
const isDirty = (l: Line) => {
  const k = rowKeyOf(l)
  return !!k && editOf(l).dirty.has(k)
}

/**
 * 「上一行还有未保存改动」守卫（旧版 `It`）。
 * 返回 `true` = 可以继续（该保存的已保存）；`false` = 用户选了「继续编辑」，别往下走。
 *
 * 旧版 `ElMessageBox.confirm(…, { distinguishCancelAndClose: true })`：
 * 确认 → 保存并切换；**取消与关闭都算「继续编辑」**（`catch` 一支）。
 */
async function confirmLeaveDirtyRow(): Promise<boolean> {
  for (const st of [pingEdit, diaoEdit]) {
    const key = st.editing.keys().next().value as string | undefined
    if (!key || !st.dirty.has(key)) continue
    const row = lines.value.find((x) => rowKeyOf(x) === key)
    if (!row) continue
    const go = await new Promise<boolean>((resolve) => {
      dialog.warning({
        title: '未保存提醒',
        content: '当前行有未保存修改，是否先保存？',
        positiveText: '保存并切换',
        negativeText: '继续编辑',
        onPositiveClick: () => resolve(true),
        onNegativeClick: () => resolve(false),
        onClose: () => resolve(false),
        onAfterLeave: () => resolve(false),
      })
    })
    if (!go) return false
    await saveRow(row)
    if (st.dirty.has(key)) return false
  }
  return true
}

/**
 * 点单元格进入编辑态（旧版 `kt`）。
 *
 * ⚠️ 旧版 `kt` 挂在 Element Plus 的 `@cell-click`，**每次点单元格都跑一遍** ——
 *    所以同一行里换个格子再点，快照会被**重新拍**（`pt[key]={...row}`）。
 *    后果：「取消」只回滚到**最后一次点击**那一刻，不是进入该行编辑的那一刻。
 *    这是旧版原样行为，**照抄**；是否算缺陷另行确认（见方案文档 §7）。
 *    另一处：旧版首个判据是 `column.property === "平开门"` 跳过操作列 ——
 *    我们改在操作列那格 `stopPropagation`（naive-ui 的 `n-data-table` 没有 cell-click 事件，
 *    只有 `row-props`，拿不到列信息）。
 */
async function enterEdit(l: Line) {
  if (!(await confirmLeaveDirtyRow())) return
  const st = editOf(l)
  st.editing.clear()
  const k = rowKeyOf(l)
  if (!k) return
  const rows = l.line_type === 'diao' ? diaoRows.value : pingRows.value
  st.snapshot[k] = { ...l }
  st.editing.set(k, rows.indexOf(l))
  recomputeDirty(l)
}

/** 「取消」：用快照回滚（旧版 `kt` 旁边那颗按钮，`:1735-1741`）。 */
function cancelEdit(l: Line) {
  const st = editOf(l)
  const k = rowKeyOf(l)
  if (!k) return
  const snap = st.snapshot[k]
  if (snap) Object.assign(l, snap)
  st.editing.delete(k)
  delete st.snapshot[k]
  st.dirty.delete(k)
}

/**
 * 单行保存（旧版 `Ut` / 移门 `fe`）→ `PUT /orders/{id}/lines/{line_id}`。
 *
 * 旧版先 POST `param1=updateRowData`；我们走 RESTful 端点（同一个东西）。
 *
 * ⚠️ **平开那侧的「锁具没有指定」只是警告、不拦截**（旧版 `Ut` 第一行是个 `&&` 链，
 *    `ElMessage.warning` 是最后一个操作数，没有 `return`）。移门侧**没有这条**。
 */
async function saveRow(l: Line) {
  if (l.line_type === 'ping' && colVis(pingColVis, 'track') && !(l.track || '').trim()) {
    message.warning('锁具没有指定，请确认是否遗漏！')
  }
  const k = rowKeyOf(l)
  if (!k || l.id == null || orderId.value == null) return
  try {
    await api.updateOrderLine(orderId.value, l.id, lineInputOf(l))
    message.success('数据更新成功')
    const st = editOf(l)
    st.editing.delete(k)
    delete st.snapshot[k]
    st.dirty.delete(k)
  } catch (e) {
    message.error(e instanceof Error ? e.message : '更新失败')
  }
}

// ════ 搬迁自 Hui.vue 1926-1966：E opsCol ════
const opsCol = (label: string): DataTableColumn<Line> => ({
  title: label,
  key: 'actions',
  width: 96,
  fixed: 'left',
  // 两个分支（旧版 `:1729-1735` 起）：
  //   编辑中 → 「确认修改」「取消」（标签逐字：`" 确认修改 "` 前后带空格，`:674`）
  //   否则   → 「删除」「复制」+ 第三个按钮
  // ⚠️ 外层 `stopPropagation`：我们的「进入编辑态」挂在 `row-props` 的 onClick 上，
  //    不拦住的话点「删除」会先把该行推进编辑态（旧版靠 `column.property === "平开门"` 跳过）。
  render: (l) =>
    h(
      'div',
      {
        style:
          'display:flex;flex-wrap:wrap;gap:0 6px;align-items:center;line-height:1.5;font-size:11px;white-space:nowrap',
        onClick: (e: MouseEvent) => e.stopPropagation(),
      },
      isEditing(l)
        ? [
            h(NButton, { size: 'tiny', text: true, onClick: () => void saveRow(l) }, { default: () => ' 确认修改 ' }),
            h(NButton, { size: 'tiny', text: true, type: 'error', onClick: () => cancelEdit(l) }, { default: () => '取消' }),
          ]
        : [
            h(NButton, { size: 'tiny', text: true, type: 'error', onClick: () => removeLine(l) }, { default: () => '删除' }),
            h(NButton, { size: 'tiny', text: true, onClick: () => copyRow(l) }, { default: () => '复制' }),
            h(
              NTooltip,
              { trigger: 'hover', placement: 'left', rawContent: false },
              {
                trigger: () =>
                  h(NButton, { size: 'tiny', text: true, type: 'warning', onClick: () => void calcSingleRow(l) }, { default: () => '算料' }),
                default: () => h('pre', { style: 'margin:0;font-size:12px;white-space:pre-wrap;max-width:340px' }, partsTooltip(l)),
              },
            ),
          ],
    ),
})

// 金额格的「平方数」那一行：**只读输入框**，唯一入口是右键打开「修改平方数」浮窗
// （原版 :2482-2491：外层 div 挂 onContextmenu，内层 el-input `modelValue:行["平方数"] readonly`）。

// ════ 搬迁自 Hui.vue 1967-2061：F sqCell/amountCell/remarkCell/markupSelectCell/markupCol ════
const sqCell = (l: Line) =>
  h(
    'div',
    {
      onContextmenu: (e: MouseEvent) => {
        e.preventDefault()
        openSquareDialog(l)
      },
    },
    [h(NInput, { ...CELL, readonly: true, value: l.square.toFixed(2) })],
  )

// 金额格的「金额」那一行：原版是 `el-input readonly:!we["金额"][id]`，
// 而 `we` 只在 onBlur 里被写成 `false`（`!false` 仍是 true）⇒ **恒只读**，不会变成可编辑。
const amountCell = (l: Line) => h(NInput, { ...CELL, readonly: true, value: l.amount.toFixed(2) })

// 备注格：原版是 `el-input type="textarea" :autosize="{minRows:1}"`，不是单行输入框。
function remarkCell(l: Line) {
  return h(NInput, {
    ...CELL,
    type: 'textarea',
    autosize: { minRows: 1 },
    value: l.remark,
    onUpdateValue: (v: string) => {
      l.remark = v
      lineRefresh(l)
    },
  })
}

// 加价项目列：行内摘要（名称+金额），点击进入行编辑抽屉管理
// 行内加价：多选目录 + 明细行 + 点击添加（自定义→抽屉）
function markupSelectCell(l: Line) {
  const opts = markupCatalogOptions.value
  const selected = (l.markup ?? [])
    .filter((m) => m && m.name)
    .map((m) => {
      const idx = markupCatalog.value.findIndex((c) => c.name === m.name)
      return idx >= 0 ? `${idx}_${m.name}` : `x_${m.name}__${m.price}__${m.unit}`
    })
  // 明细多行：原版把 `wt`/`ft` 产出的文本按 `\n` 渲染成 `.expression-line`（`Hui.formatted.js:2515`），
  // 内容是**带算式的文本**（如 `超宽: 5元/公分*3.5公分*2=35元`），不是「名称 ¥金额」。
  // 文本可现算（与金额同源、同一批分支），故不必落库。
  const lines = markupLines(l, markupError)
  // ⚠️ 结构与类名照抄原版（平开 @2497-2520 / 吊趟 @5288-5300 两处同构）：
  //   div.extra-items-container
  //     ├ div.glass-input-label  文案 `" 点击添加： "`（**前后各一个空格 + 全角冒号**）cursor:pointer
  //     ├ el-select              multiple/collapse-tags/collapse-tags-tooltip/filterable，宽 **100%**
  //     └ div.extra-items-expressions（有内容才渲染）
  //   四个类的样式见 <style scoped> 末尾（从 legacy/css/Hui-39b802eb.css 抄的）。
  return h('div', { class: 'extra-items-container' }, [
    h(
      'div',
      { class: 'glass-input-label', style: { cursor: 'pointer' }, onClick: () => openAddMarkup(l) },
      ' 点击添加： ',
    ),
    h(NSelect, {
      size: 'small',
      multiple: true,
      'collapse-tags': true,
      'collapse-tags-tooltip': true,
      filterable: true,
      options: opts,
      value: selected,
      placeholder: '请选择加价项目',
      style: { width: '100%' },
      onUpdateValue: (vals: (string | number)[]) => {
        const names = vals.map((v) => String(v))
        l.markup = names.map((n) => {
          const m = n.match(/x_(.+)__([\d.]+)__(.+)/)
          if (m) return { name: m[1], price: Number(m[2]), unit: m[3], amount: 0 }
          const idx = Number(n.split('_')[0])
          const c = markupCatalog.value[idx]
          return c ? { ...c, amount: 0 } : { name: n, price: 0, unit: '元/套', amount: 0 }
        })
        lineRefresh(l)
      },
    }),
    lines.length
      ? h(
          'div',
          { class: 'extra-items-expressions' },
          lines.map((t) => h('div', { class: 'expression-line' }, t)),
        )
      : null,
  ])
}
const markupCol = (): DataTableColumn<Line> => ({
  title: '加价项目',
  key: 'markup_summary',
  width: 168,
  render: (l) => markupSelectCell(l),
})

// ===== 门花图（行图片）：传图/文字传图/预览/删除 =====

// ════ 搬迁自 Hui.vue 2178-2211：G doorImgCell ════
function doorImgCell(l: Line) {
  if (l.image_url) {
    return h('div', { key: 'door-img', style: 'position:relative;display:inline-block' }, [
      h('img', {
        src: l.image_url,
        style: 'display:block;width:76px;height:52px;object-fit:contain;border:1px solid #dcdfe6;border-radius:3px;cursor:zoom-in;background:#fff',
        onClick: () => {
          previewImg.value = l.image_url
          previewOpen.value = true
        },
      }),
      h(
        NButton,
        { size: 'tiny', quaternary: true, circle: true, type: 'error', title: '删除门图', style: 'position:absolute;top:-6px;right:-6px', onClick: () => removeDoorImg(l) },
        { icon: () => '×' },
      ),
    ])
  }
  return h(
    'div',
    {
      key: 'door-img-empty',
      style:
        'display:flex;align-items:center;justify-content:center;gap:2px;width:76px;height:52px;border:1px dashed #c0c4cc;border-radius:3px;background:#fafafa;cursor:pointer',
      onClick: (e: MouseEvent) => e.stopPropagation(),
    },
    [
      h(NButton, { size: 'tiny', text: true, type: 'primary', onClick: () => pickDoorImg(l) }, { default: () => '传图' }),
      h(NButton, { size: 'tiny', text: true, onClick: () => openTextImg(l) }, { default: () => '文字' }),
    ],
  )
}

// 载入订单后：有 image_id 但无 image_url 的行，从 IndexedDB 回读

// ════ 搬迁自 Hui.vue 2233-2269：H cCol/sub/DOUBLE_DING_OPTS/orderNoCell/moneyCell_2/doorImgCol ════
const cCol = (...vs: (import('vue').VNodeChild | null)[]) =>
  h('div', { class: 'glass-inputs-container' }, vs)
const sub = (label: string, ctrl: import('vue').VNodeChild | null) =>
  h('div', { class: 'glass-input-group' }, [
    h('div', { class: 'glass-input-label' }, label),
    ctrl == null ? null : h('div', { class: 'glass-input' }, [ctrl]),
  ])

const DOUBLE_DING_OPTS = ['正常', '单丁墙', '双丁墙', '上丁墙', '上丁加单丁', '上丁加双丁'].map((v) => ({
  label: v,
  value: v,
}))
/**
 * 「单号」列。
 *
 * ⚠️ 这里曾显示 `order.receipt_no`（订单的**回执单号**）—— **层级错了**：
 * 旧版这列是**行级**单号（每樘门一个，`N-YY/MM/DD`），且**可编辑**
 * （`Hui.formatted.js:2597-2602`，列 label `:6287`）。
 * 搞混的后果不只是显示错：打印的 `OrderID`/`qrcode` 全取这列，
 * 于是**二维码扫出来是订单号而不是「哪一樘门」**（见 `docs/2026-09-18-order-no-semantics.md` §4.1）。
 *
 * 未填时显示 `—`；「填入单号」按钮会向服务端取号后回填（等同旧版 `:8491` 那颗按钮）。
 */
const orderNoCell = (l: Line) =>
  h('span', { style: 'font-size:11px;color:#606266' }, l.line_no || '—')
// 金额列（平方+金额 同格）
// 金额格（原版 :2471-2492）：`金额：`（只读输入框）+ `平方数：`（只读输入框，右键改）
const moneyCell_2 = (l: Line) => cCol(sub('金额：', amountCell(l)), sub('平方数：', sqCell(l)))

const doorImgCol = (): DataTableColumn<Line> => ({
  title: '门花图',
  key: 'door_img',
  width: 72,
  fixed: 'left',
  render: (l) => doorImgCell(l),
})


// ════ 搬迁自 Hui.vue 2270-2548：I pingCols/diaoCols ════
function pingCols(): DataTableColumn<Line>[] {
  return [
    selCol(),
    opsCol('平开门'),
    doorImgCol(),
    {
      title: '型材/颜色',
      key: 'profile_color',
      width: 118,
      render: (l) => cCol(sub('型材：', profileCell(l)), sub('颜色：', colorCell(l))),
    },
    {
      title: '单价/数量',
      key: 'unit_quantity',
      width: 96,
      render: (l) => cCol(sub('单价：', moneyCell(l, 'unit_price')), sub('数量：', intCell(l, 'quantity', 1))),
    },
    {
      title: '玻璃',
      key: 'glass',
      width: 128,
      render: (l) =>
        cCol(
          // 面玻标签**随公式类型变**（原版 :1992-1998：
          //   `formulaid && L.value[formulaid] ? (=== 'diamond' ? '门玻：' : '面玻：') : '面玻：'`）。
          sub(isDiamond(l) ? '门玻：' : '面玻：', glassSelectCell(l, 'face_glass')),
          // 底玻标签同样随公式类型变（原版 :2042-2048：钻石型 '固玻：'，否则 '底玻：'）。
          sub(isDiamond(l) ? '固玻：' : '底玻：', glassSelectCell(l, 'bottom_glass')),
          // 厚度一格**不分支**：原版此处恒为 '厚度：'，钻石型也照旧。
          // 平开表改厚度即「设为默认玻璃厚度」（原版 `ne`，:887）。
          sub(
            '厚度：',
            optCell(l, 'glass_thickness', glassThicknessOptions, (row) => {
              if (row.line_type === 'ping') rememberDefaultGlassThickness(row.glass_thickness)
              lineRefresh(row)
            }),
          ),
        ),
    },
    {
      // 原版这一列**没有 `label`**，标题完全由 header 插槽给出：
      //   `span.clickable-header(onClick=M)` 文本 `" 开向 "`（前后各一个空格）+ 设置图标。
      title: () =>
        h('span', { class: 'clickable-header', onClick: openOpenDirSettings }, [
          ' 开向 ',
          h('span', { style: 'font-size:11px' }, '⚙'),
        ]),
      key: 'open_dir',
      width: 132,
      render: (l) => {
        // ⚠️ 开向图要**先把自定义开向名还原成原始开向**再查表（原版 `ve.value[C(行["开向"])]`，
        //    `C` = `getOriginalOpenDirection`）。直接用显示名查会漏图。
        const img = PING_DIRECTION_IMAGES[getOriginalOpenDirection(l.direction)]
        return cCol(
          ...(colVis(pingColVis, 'casing')
            ? [sub('包边：', optCell(l, 'casing', pingCasingOptions(l, casingKindOptions), undefined, true, 'casing'))]
            : []),
          ...(colVis(pingColVis, 'track') ? [sub('锁具：', trackCell(l))] : []),
          sub('开向：', optCell(l, 'direction', pingDirectionOptions.value, undefined, true)),
          h('div', { class: 'image-cell2 image-cell2--ping' }, [
            img ? h('img', { src: img, alt: l.direction, class: 'direction-image' }) : null,
          ]),
        )
      },
    },
    // 原版 ping 表 门洞尺寸格（:2222-2348）从上到下：
    //   高度： → 宽度：/左宽： → ( 母门宽: ) → 墙厚：/门宽： → (右宽：, 钻石型) → (洞/净尺：)
    // `l.value` 那个三元（决定高/宽谁在前）在旧版恒走 key:0，即**高度在上**。
    {
      title: '门洞尺寸',
      key: 'door_size',
      width: 96,
      render: (l) =>
        cCol(
          sub('高度：', intCell(l, 'door_height')),
          // 门洞宽标签随公式类型变（原版 :2231-2236：钻石型 '左宽：'，否则 '宽度：'）。
          sub(isDiamond(l) ? '左宽：' : '宽度：', intCell(l, 'door_width')),
          // 母门宽：标签原文是 `" 母门宽: "`（**前后空格 + 半角冒号**），闸门是
          // `L.value[formulaid] === 'parentSubsidiary'`（子母门公式类型）。
          ...(needsMotherWidth(l) ? [sub(' 母门宽: ', intCell(l, 'mother_door_width'))] : []),
          // 墙厚一格也分支：钻石型显示 '门宽：'（仅 ping 表如此，diao 表恒为 '墙厚：'）。
          sub(isDiamond(l) ? '门宽：' : '墙厚：', wallThicknessCell(l)),
          // 钻石型时「亮窗总高」这个字段**搬进本列**并改名「右宽」（原版 :2314-2335）。
          // 非钻石时它在下面独立的「亮窗总高」列里 —— 两处互斥。
          ...(isDiamond(l) ? [sub('右宽：', intCell(l, 'light_window_height'))] : []),
          // ⚠️ 「洞尺」**不是独立列**，而是门洞尺寸格里的最后一块（原版 :2336-2346，
          //    `_["value"]["洞尺"]` 闸门 + `"洞/净尺："` 标签 + 下拉「洞尺/净尺」两项）。
          ...(colVis(pingColVis, 'hole_size')
            ? [sub('洞/净尺：', holeCell(l, PING_HOLE_SIZE_OPTS))]
            : []),
        ),
    },
    // 原版 ping 表里「吊脚」与「亮窗总高」是**两个独立列**（`Hui-d088417c` @86619 / @86995），
    // 槽内直接渲染输入框、无内嵌小标签。吊脚列由 `列显隐表['吊脚']` 闸门；亮窗总高列**无闸门**（原版如此）。
    {
      title: '吊脚',
      key: 'jiao',
      width: 62,
      render: (l) => intCell(l, 'jiao'),
    },
    {
      title: '亮窗总高',
      key: 'lightwin',
      width: 62,
      // 原版该列自带互斥条件：`L.value[formulaid] !== 'diamond'` 才渲染输入框，钻石型整格为空
      // （else 分支是 `createCommentVNode`）。无公式时渲染（与原版 `return true` 一致）。
      render: (l) => (isDiamond(l) ? null : intCell(l, 'light_window_height')),
    },
    // 原版「五金」（`["五金"]` 闸门）与「封板高」是两个独立列
    { title: '五金', key: 'hardware', width: 82, render: (l) => hardwareCell(l) },
    { title: '封板高', key: 'seal_board', width: 62, render: (l) => intCell(l, 'seal_board_height') },
    {
      title: '备注',
      key: 'remark',
      width: 110,
      render: (l) => cCol(sub('地址：', tCell(l, 'install_address')), sub('备注：', remarkCell(l))),
    },
    { title: '金额', key: 'money', width: 96, render: (l) => moneyCell_2(l) },
    markupCol(),
    // 原版平开表尾部列序：加价项目 → 计价方式 → 打折 → 前包加长 → 后包加长 → 单双丁 → 单号 → …
    { title: '计价方式', key: 'price_type', width: 74, render: (l) => optCell(l, 'price_type', priceTypeOptions) },
    { title: '打折', key: 'discount', width: 62, render: (l) => moneyCell(l, 'discount') },
    { title: '前包加长', key: 'front_casing', width: 84, render: (l) => intCell(l, 'front_casing_add') },
    { title: '后包加长', key: 'back_casing', width: 84, render: (l) => intCell(l, 'back_casing_add') },
    { title: '单/双丁墙体', key: 'double_ding', width: 96, render: (l) => optCell(l, 'double_ding', DOUBLE_DING_OPTS) },
    { title: '单号', key: 'order_no', width: 78, render: (l) => orderNoCell(l) },
    { title: '图片ID', key: 'image_id', width: 80, render: (l) => h('span', { style: 'font-size:11px;color:#606266' }, l.image_id || '—') },
    // 原版「客户」「客户编号」是**订单级**（行上无此字段），故取 order 而非 l
    { title: '客户', key: 'client', width: 88, render: () => h('span', { style: 'font-size:11px;color:#606266' }, order.client_name || '—') },
    { title: '客户编号', key: 'client_code', width: 84, render: () => h('span', { style: 'font-size:11px;color:#606266' }, order.client_code || '—') },
    { title: '其它费用', key: 'other_fee', width: 78, render: (l) => moneyCell(l, 'other_fee') },
  ]
}

function diaoCols(): DataTableColumn<Line>[] {
  return [
    selCol(),
    opsCol('移门'),
    doorImgCol(),
    {
      title: '型材/颜色',
      key: 'profile_color',
      width: 118,
      render: (l) => cCol(sub('型材：', profileCell(l)), sub('颜色：', colorCell(l))),
    },
    // 原版移门表列序与列内容见 `Hui-d088417c` @176837..@207080（表头 label 偏移即列序）：
    //   门花图 | 型材/颜色 | 单价/数量 | 玻璃 | 扇数/开向 | 下轨道/套线 | 门洞尺寸 | 洞尺 |
    //   亮窗信息 | 五金 | 备注 | 金额 | 加价项目 | 上轨/边封 | 前包加长 | 后包加长 |
    //   单双丁 | 计价方式 | 打折 | 单号 | 图片ID | 客户 | 客户编号 | 其它费用
    // 其中「单价/数量」列内还含 套线单价，且**生产进度是「单价」框上的 tooltip**（不是可编辑格子）；
    // 「亮窗信息」列内含 亮窗总高/亮窗数量/封板高。
    {
      title: '单价/数量',
      key: 'unit_qty',
      width: 112,
      render: (l) =>
        cCol(
          // 原版 @181691：`el-tooltip :disabled="!e[…]" :content="e['生产进度']"` 包住单价输入框
          sub(
            '单价：',
            h(
              NTooltip,
              { disabled: !l.progress, trigger: 'hover' },
              { trigger: () => moneyCell(l, 'unit_price'), default: () => l.progress },
            ),
          ),
          sub('数量：', intCell(l, 'quantity', 1)),
          sub('套线单价：', moneyCell(l, 'casing_price')),
        ),
    },
    {
      title: '玻璃',
      key: 'glass',
      width: 128,
      render: (l) =>
        cCol(
          // 移门表**不分支**（原版 :4803-4870 恒为「面玻：/底玻：/厚度：」，无 diamond 变体）
          sub('面玻：', glassSelectCell(l, 'face_glass')),
          sub('底玻：', glassSelectCell(l, 'bottom_glass')),
          sub('厚度：', optCell(l, 'glass_thickness', glassThicknessOptions)),
        ),
    },
    {
      title: '扇数/开向',
      key: 'fans_dir',
      width: 124,
      render: (l) => {
        // 原版 :4962-4963 是 img 的 v-if = 「开向 && 图表[扇数+开向]」，class="direction-image"，
        // 图取自「扇数+开向」联合键（**不过 getOriginalOpenDirection**，与平开不同）。
        const img = diaoDirImage(l.fans, l.direction)
        return cCol(
          sub(
            '扇数：',
            optCell(l, 'fans', fansOptions, (x) => {
              lineRefresh(x)
              void resolveRow(x)
            }, true),
          ),
          sub('开向：', optCell(l, 'direction', directionSuffixOptions.value, undefined, true)),
          h('div', { class: 'image-cell2 image-cell2--diao' }, [
            img ? h('img', { src: img, alt: l.direction, class: 'direction-image' }) : null,
          ]),
        )
      },
    },
    {
      title: '下轨道/套线',
      key: 'track_line',
      width: 108,
      render: (l) =>
        cCol(
          // 原版 :4973-5000 这两格**都没有 v-if 闸门**，恒渲染。
          sub('轨道：', trackCell(l)),
          sub('套线：', casingCell(l)),
        ),
    },
    // 原版移门表 门洞尺寸格（:5003-5143）从上到下：高度： → 宽度： → 墙厚： → (洞/净尺：)
    // **没有母门宽、没有钻石型「右宽」**（那两格是平开表独有的）。
    // 决定高/宽先后顺序的那个三元在旧版恒走 key:0，即**高度在上**。
    {
      title: '门洞尺寸',
      key: 'door_size',
      width: 96,
      render: (l) =>
        cCol(
          sub('高度：', intCell(l, 'door_height')),
          sub('宽度：', intCell(l, 'door_width')),
          // 移门表墙厚标签**不分支**（原版恒为 '墙厚：'，:3458）
          sub('墙厚：', wallThicknessCell(l)),
          ...(colVis(diaoColVis, 'hole_size')
            ? [sub('洞/净尺：', holeCell(l, DIAO_HOLE_SIZE_OPTS))]
            : []),
        ),
    },
    // 原版「亮窗信息」列内含三格：亮窗总高 / 亮窗数量 / 封板高
    {
      title: '亮窗信息',
      key: 'lightwin',
      width: 98,
      render: (l) =>
        cCol(
          sub('亮窗总高：', intCell(l, 'light_window_height')),
          sub('亮窗数量：', intCell(l, 'light_window_count')),
          // 「封板高」也挂在 列显隐表['封板高'] 闸门上（原版 :5147 / :5165）
          ...(colVis(diaoColVis, 'seal_board') ? [sub('封板高：', intCell(l, 'seal_board_height'))] : []),
        ),
    },
    // 原版「五金」是独立列（`["五金"]` 闸门）
    { title: '五金', key: 'hardware', width: 82, render: (l) => hardwareCell(l) },
    {
      title: '备注',
      key: 'remark',
      width: 110,
      render: (l) => cCol(sub('地址：', tCell(l, 'install_address')), sub('备注：', remarkCell(l))),
    },
    { title: '金额', key: 'money', width: 96, render: (l) => moneyCell_2(l) },
    markupCol(),
    // 以下列序严格照原版：加价项目 → 上轨/边封 → 前包加长 → 后包加长 → 单双丁 →
    // 计价方式 → 打折 → 单号 → 图片ID → 客户 → 客户编号 → 其它费用
    {
      title: '上轨/边封',
      key: 'up_track_seal',
      width: 92,
      render: (l) => cCol(sub('轨道长：', intCell(l, 'track_length')), sub('边封数：', intCell(l, 'edge_seal_count', 2))),
    },
    { title: '前包加长', key: 'front_casing', width: 84, render: (l) => intCell(l, 'front_casing_add') },
    { title: '后包加长', key: 'back_casing', width: 84, render: (l) => intCell(l, 'back_casing_add') },
    { title: '单双丁', key: 'double_ding', width: 82, render: (l) => optCell(l, 'double_ding', DOUBLE_DING_OPTS) },
    { title: '计价方式', key: 'price_type', width: 74, render: (l) => optCell(l, 'price_type', priceTypeOptions) },
    { title: '打折', key: 'discount', width: 62, render: (l) => moneyCell(l, 'discount') },
    { title: '单号', key: 'order_no', width: 78, render: (l) => orderNoCell(l) },
    // 原版「图片ID」列不可编辑（只展示），故用只读 span
    { title: '图片ID', key: 'image_id', width: 80, render: (l) => h('span', { style: 'font-size:11px;color:#606266' }, l.image_id || '—') },
    // 原版「客户」「客户编号」是**订单级**（行上无此字段），故取 order 而非 l
    { title: '客户', key: 'client', width: 88, render: () => h('span', { style: 'font-size:11px;color:#606266' }, order.client_name || '—') },
    { title: '客户编号', key: 'client_code', width: 84, render: () => h('span', { style: 'font-size:11px;color:#606266' }, order.client_code || '—') },
    { title: '其它费用', key: 'other_fee', width: 78, render: (l) => moneyCell(l, 'other_fee') },
  ]
}

// ════ 搬迁自 Hui.vue 2550-2581：J rowKey/rowClassName/rowPropsOf/pingColumns/diaoColumns ════
const rowKey = (r: Line) => (r.id ?? r) as unknown as number

/**
 * `unsaved-row` 粉底 —— **语义改过了**（2026-09-19）。
 *
 * 旧版 `Nt`（`:1359-1370`）/ 移门 `de`（`:3783-3792`）是
 * `dirty.has(rowKey) ? "unsaved-row" : ""`，即**有未保存改动**。
 * 我们原先写的是「行还没有 id」——那是另一回事（新建行就永远是粉的）。
 * 照旧版改回「脏」；新建行在旧版靠客户端临时 id + 无快照 ⇒ 永不判脏 ⇒ 不标粉。
 */
const rowClassName = (r: Line) => (isDirty(r) ? 'unsaved-row' : '')

// 点单元格进入编辑态（旧版 `@cell-click: kt`）。naive-ui 的 `n-data-table` 没有 cell-click，
// 只有 `row-props`；拿不到列信息，所以「跳过操作列」改在那一格 `stopPropagation`（见 `opsCol`）。
const rowPropsOf = (row: Line) => ({ onClick: () => void enterEdit(row) })

// 行内任何改动 → 重算所有已开编辑态行的脏标记（旧版 `Vue.watch(ue, …, {deep:true})`，`:1394-1400`）。
watch(
  lines,
  () => {
    for (const l of lines.value) if (rowKeyOf(l) && editOf(l).snapshot[rowKeyOf(l)]) recomputeDirty(l)
  },
  { deep: true },
)

type KeyedCol = DataTableColumn<Line> & { key: string }
const pingColumns = computed<DataTableColumn<Line>[]>(() =>
  pingCols().filter((c) => colVis(pingColVis, (c as KeyedCol).key ?? '')),
)
const diaoColumns = computed<DataTableColumn<Line>[]>(() =>
  diaoCols().filter((c) => colVis(diaoColVis, (c as KeyedCol).key ?? '')),
)