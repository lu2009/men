// 自定义合格标签（ic=13） · 默认值 / 清洗 / 固定张数 / 布局纯函数 逻辑比对。
//
// 覆盖施工图 §2.2（默认 11 条字段）/ §2.4（paper）/ §2.5（globalFont 与「应用到全部」）/
// §2.6（清洗 R1–R11）/ §3.2–§3.3（布局编辑器的纯变换）/ §5.2（固定张数）/ §5.3（保存设置）/
// §4.2 的前置（别名表 + 剥前缀）。
//
// ★ 期望值是**从施工图的规则独立算出来的**（不是抄实现），并在注释里给出推导。
//
// ⚠️ 本文件里凡是「旧版语义很怪」的地方（`Number(null)===0`、`|| 默认` vs clamp、
//    `round` 在 clamp 之前、`height` 只限制 y 的上界…）都**单独成条**，
//    因为它们正是最容易被「顺手修正」的地方。
import { createRequire } from 'node:module'
const _ROOT = '/Users/aaa/Desktop/door-main'
const _req = createRequire(_ROOT + '/app/')
const { build: _build } = _req(_ROOT + '/app/node_modules/esbuild')
const _OUT = _ROOT + '/app/node_modules/.cache/ql-logiccheck-bundle.mjs'
await _build({
  entryPoints: [_ROOT + '/app/src/utils/qualifiedlabel/index.ts'],
  bundle: true, format: 'esm', platform: 'neutral',
  outfile: _OUT, logLevel: 'warning',
})

// —— localStorage 桩（读盘/写回用例要用）——
const store = new Map()
let storageThrows = false
globalThis.localStorage = {
  getItem: (k) => { if (storageThrows) throw new Error('denied'); return store.has(k) ? store.get(k) : null },
  setItem: (k, v) => { if (storageThrows) throw new Error('denied'); store.set(k, String(v)) },
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
}

const m = await import(_OUT)
const {
  createDefaultConfig, createDefaultFields,
  normalizeQualifiedLabelConfig, normalizeFixedQuantity,
  readFieldValue, stripLabelPrefix, FIELD_ALIASES,
  padToFixedQuantity, createFixedQuantitySetting,
  loadFixedQuantitySetting, saveFixedQuantitySetting,
  loadQualifiedLabelSettings, saveQualifiedLabelConfig, saveQualifiedLabelPrinter,
  autoFitFields, applyToAllFontSize, fitPaperWidth, readBatchValues,
  applyBatchFontSize, applyBatchBodyWidth, applyBatchOrderWidth, applyPaperPreset,
  BODY_FIELD_KEYS, ORDER_FIELD_KEYS, APPLY_TO_ALL_EXCLUDED_KEYS,
  QL_STORAGE_KEYS, QL_QR_FALLBACK_VIEW_BOX, QL_EMPTY_QR_VIEW_BOX, QL_DOCUMENT_TITLE, QL_CLASSES,
  PAPER_PRESETS, FONT_FAMILY_OPTIONS, COPY_RANGE, LONG_EDGE_BASE, FIELD_UI_RANGES, FIELD_TABLE_UI_RANGES,
} = m
import fs from 'node:fs'

const results = []
let failed = false
const record = (name, ok, actual, expected) => {
  results.push({ name, ok })
  if (!ok) failed = true
  console.log(`${ok ? '✓' : '✗'} ${name}`)
  if (!ok) {
    console.log('  expected:', JSON.stringify(expected))
    console.log('  actual  :', JSON.stringify(actual))
  }
}
const eq = (name, actual, expected) => record(name, actual === expected, actual, expected)
const ok = (name, cond) => record(name, !!cond, cond, true)

/** 与键序无关的深比较（夹具 JSON 的键序不保证与实现一致）。 */
function deepEqual(a, b) {
  if (a === b) return true
  if (typeof a !== typeof b) return false
  if (a === null || b === null || typeof a !== 'object') return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const ka = Object.keys(a); const kb = Object.keys(b)
  if (ka.length !== kb.length) return false
  return ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]))
}
const deepEq = (name, actual, expected) => record(name, deepEqual(actual, expected), actual, expected)

const fieldOf = (cfg, key) => cfg.fields.find((f) => f.key === key)
/** 按 key 从**字段数组**里找（`cfg.fields` 亦可直接传数组）。 */
const findField = (fields, key) => fields.find((f) => f.key === key)

// ================================================================ //
console.log('—— §2.2 默认配置 ——')
// ================================================================ //
const DEF = createDefaultConfig()
const fixture = JSON.parse(fs.readFileSync(_ROOT + '/docs/custom-docs-recon/ql-default-config.json', 'utf8'))
deepEq('createDefaultConfig() 与 ql-default-config.json 深相等', DEF, fixture)
eq('每次都返回新对象（不是共享常量）', createDefaultConfig() === createDefaultConfig(), false)
eq('fields 是 11 条', DEF.fields.length, 11)
eq('每条 13 个键', [...new Set(DEF.fields.map((f) => Object.keys(f).length))].join(','), '13')
eq('顶层 5 个键', Object.keys(DEF).sort().join(','), 'autoHideEmpty,fields,globalFont,paper,print')
eq('paper 5 个键', Object.keys(DEF.paper).sort().join(','), 'heightMm,orientation,paddingMm,printRotate90,widthMm')
eq('globalFont 4 个键', Object.keys(DEF.globalFont).sort().join(','), 'fontFamily,fontSize,fontWeight,lineHeight')
eq('★ 唯一 bold 的是 client', DEF.fields.filter((f) => f.fontWeight === 'bold').map((f) => f.key).join(','), 'client')
eq('★ 唯一 center 的是 package', DEF.fields.filter((f) => f.textAlign === 'center').map((f) => f.key).join(','), 'package')
eq('★ wrap=true 的是 door/address/remark',
  DEF.fields.filter((f) => f.wrap).map((f) => f.key).join(','), 'door,address,remark')
eq('★ 唯一 maxLines=2 的是 address/remark',
  DEF.fields.filter((f) => f.maxLines === 2).map((f) => f.key).join(','), 'address,remark')
eq('★ qrcode 的 width 与 height 相等（20）', fieldOf(DEF, 'qrcode').height, fieldOf(DEF, 'qrcode').width)
eq('★ qrcode 的 fontSize 是 19（死值）', fieldOf(DEF, 'qrcode').fontSize, 19)
eq('package 是 10pt / x=4', fieldOf(DEF, 'package').fontSize + '/' + fieldOf(DEF, 'package').x, '10/4')
eq('只有 orderID/client 的 showPrefix=false',
  DEF.fields.filter((f) => !f.showPrefix).map((f) => f.key).join(','), 'qrcode,orderID,client')
eq('常量：7 个纸张预设 / 5 个字体族 / 基准 70×90 / 份数 1–99',
  PAPER_PRESETS.length + '/' + FONT_FAMILY_OPTIONS.length + '/' + LONG_EDGE_BASE.widthMm + '×' + LONG_EDGE_BASE.heightMm + '/' + COPY_RANGE.min + '-' + COPY_RANGE.max,
  '7/5/70×90/1-99')
eq('导出常量：文档标题 / QR 回退 200 / 空占位 1×1 / 4 个 class',
  [QL_DOCUMENT_TITLE, QL_QR_FALLBACK_VIEW_BOX, QL_EMPTY_QR_VIEW_BOX,
    [QL_CLASSES.root, QL_CLASSES.label, QL_CLASSES.field, QL_CLASSES.fieldQr, QL_CLASSES.fieldText].join(',')].join(' | '),
  '自定义合格标签 | 0 0 200 200 | 0 0 1 1 | qlabel-root,qlabel,qfield,qfield-qr,qfield-text')

// ================================================================ //
console.log('—— §2.6 清洗 R1–R11 ——')
// ================================================================ //
deepEq('R1：normalize(undefined) 逐字段等于默认', normalizeQualifiedLabelConfig(undefined), DEF)
deepEq('R1：normalize(null) 逐字段等于默认', normalizeQualifiedLabelConfig(null), DEF)
deepEq('R1：normalize("垃圾") 逐字段等于默认', normalizeQualifiedLabelConfig('垃圾'), DEF)
deepEq('R1：normalize({}) 逐字段等于默认', normalizeQualifiedLabelConfig({}), DEF)
// ★ 恒等性：默认版式**正好压在几条 clamp 边界上**（`package.y=85` = 纸高−height、
//   `package.x=4` = 纸宽−width、`qrcode.height=width`），清洗若有半点偏差就会把它挤变形 ——
//   而「存盘一份默认配置」是**最常见**的路径（用户改一下纸张再改回来）。
deepEq('★ 清洗对默认配置**恒等**（存盘=默认 → 不变形）', normalizeQualifiedLabelConfig(DEF), DEF)
deepEq('★ 清洗幂等（N(N(x)) = N(x)）',
  normalizeQualifiedLabelConfig(normalizeQualifiedLabelConfig({ paper: { widthMm: 40 }, fields: [{ key: 'size', y: 300 }] })),
  normalizeQualifiedLabelConfig({ paper: { widthMm: 40 }, fields: [{ key: 'size', y: 300 }] }))

// R3：clamp，且 null/"" → **min**（不是回落）
const r3 = normalizeQualifiedLabelConfig({ paper: { widthMm: 5, heightMm: 9999, paddingMm: 99 } })
eq('R3：widthMm 5 → clamp 到 20', r3.paper.widthMm, 20)
eq('R3：heightMm 9999 → clamp 到 400', r3.paper.heightMm, 400)
eq('R3：paddingMm 99 → clamp 到 20', r3.paper.paddingMm, 20)
eq('R2：存盘里的 null 是有限值 → 夹到 min（不是回落）',
  normalizeQualifiedLabelConfig({ paper: { widthMm: null } }).paper.widthMm, 20)
eq('R2：存盘里的 "" 同理 → 夹到 min',
  normalizeQualifiedLabelConfig({ paper: { widthMm: '' } }).paper.widthMm, 20)
eq('R2：undefined 才走 fallback（默认 70）',
  normalizeQualifiedLabelConfig({ paper: { heightMm: undefined } }).paper.heightMm, 90)

// R4：只认 landscape
eq('R4：orientation "landscape" 保留', normalizeQualifiedLabelConfig({ paper: { orientation: 'landscape' } }).paper.orientation, 'landscape')
eq('R4：orientation 其它值 → portrait', normalizeQualifiedLabelConfig({ paper: { orientation: '横向' } }).paper.orientation, 'portrait')
eq('R4：orientation 缺失 → portrait', normalizeQualifiedLabelConfig({ paper: {} }).paper.orientation, 'portrait')
// printRotate90 不 clamp，原样带过
eq('R1：printRotate90 原样带过（true）', normalizeQualifiedLabelConfig({ paper: { printRotate90: true } }).paper.printRotate90, true)
eq('R1：printRotate90 缺失 → 默认 false', normalizeQualifiedLabelConfig({ paper: {} }).paper.printRotate90, false)
eq('R1：存盘里的 "false" 串是真值 → 旧版也当真值用（照真值语义）',
  normalizeQualifiedLabelConfig({ paper: { printRotate90: 'false' } }).paper.printRotate90, true)

// R5
eq('R5：globalFont.fontSize 99 → 30', normalizeQualifiedLabelConfig({ globalFont: { fontSize: 99 } }).globalFont.fontSize, 30)
eq('R5：lineHeight 5 → 2', normalizeQualifiedLabelConfig({ globalFont: { lineHeight: 5 } }).globalFont.lineHeight, 2)
eq('R5：fontWeight "600" → normal', normalizeQualifiedLabelConfig({ globalFont: { fontWeight: '600' } }).globalFont.fontWeight, 'normal')
eq('R5：fontFamily **不校验**，原样带过',
  normalizeQualifiedLabelConfig({ globalFont: { fontFamily: 'Arial' } }).globalFont.fontFamily, 'Arial')

// R6
eq('R6：autoHideEmpty false 保留', normalizeQualifiedLabelConfig({ autoHideEmpty: false }).autoHideEmpty, false)
eq('R6：autoHideEmpty undefined → 默认 true', normalizeQualifiedLabelConfig({ autoHideEmpty: undefined }).autoHideEmpty, true)
eq('R6：autoHideEmpty 0 → false', normalizeQualifiedLabelConfig({ autoHideEmpty: 0 }).autoHideEmpty, false)

// R7：★ 与 R3 的 clamp 写法**不同** —— 0/"":走 `|| 默认`
eq('R7：copies 0 → 回落默认 1（不是夹到 min=1 的同一结果，但路径不同）',
  normalizeQualifiedLabelConfig({ print: { copies: 0 } }).print.copies, 1)
eq('R7：copies 200 → 99', normalizeQualifiedLabelConfig({ print: { copies: 200 } }).print.copies, 99)
eq('R7：copies "50" → 50', normalizeQualifiedLabelConfig({ print: { copies: '50' } }).print.copies, 50)
eq('R7：copies 98.6 → **98.6**（★ 没有 round，与 maxLines 的 round 不同）',
  normalizeQualifiedLabelConfig({ print: { copies: 98.6 } }).print.copies, 98.6)
eq('R7：★ copies null → Number(null)=0 是假值 → 回落默认 1（若用 m() 会夹到 min 亦为 1，但 -5 就见差别）',
  normalizeQualifiedLabelConfig({ print: { copies: -5 } }).print.copies, 1)

// R8/R9：按 key 合并、以默认表为主干
const r9 = normalizeQualifiedLabelConfig({ fields: [{ key: 'door', width: 30 }, { key: '不存在的key', width: 1 }] })
eq('R9：仍然是默认的 11 条、默认顺序', r9.fields.map((f) => f.key).join(','), DEF.fields.map((f) => f.key).join(','))
eq('R9：存盘的 door.width 生效', fieldOf(r9, 'door').width, 30)
eq('R9：★ 存盘里多出来的 key 被**静默丢弃**', r9.fields.some((f) => f.key === '不存在的key'), false)
eq('R9：★ 缺失的 key 回默认（size.width 仍是 66）', fieldOf(r9, 'size').width, 66)
eq('R9：★ 存盘改过的 label **会覆盖**默认',
  normalizeQualifiedLabelConfig({ fields: [{ key: 'door', label: '改过的' }] }).fields.find((f) => f.key === 'door').label, '改过的')
eq('R9：存盘里的重复 key → 后者胜（Map 语义）',
  normalizeQualifiedLabelConfig({ fields: [{ key: 'door', width: 10 }, { key: 'door', width: 20 }] }).fields.find((f) => f.key === 'door').width, 20)
eq('R8：fields 不是数组 → 当空', normalizeQualifiedLabelConfig({ fields: 'x' }).fields.length, 11)

// R10
const r10 = normalizeQualifiedLabelConfig({
  fields: [
    { key: 'size', width: 0, x: -1, y: -1, fontSize: 1, maxLines: 0, fontWeight: '900', textAlign: '居中' },
    { key: 'qrcode', width: 200, height: 3 },
  ],
})
const sizeF = fieldOf(r10, 'size')
const qrF = fieldOf(r10, 'qrcode')
eq('R10：width 0 → clamp 到 1', sizeF.width, 1)
eq('R10：x -1 → 0', sizeF.x, 0)
eq('R10：y -1 → 夹到**下界** 0', sizeF.y, 0)
eq('R10：★ y 的上界是 纸高−height = 90−5 = 85 ⇒ y=300 夹到 85',
  normalizeQualifiedLabelConfig({ fields: [{ key: 'size', y: 300 }] }).fields.find((f) => f.key === 'size').y, 85)
eq('R10：fontSize 1 → 5', sizeF.fontSize, 5)
eq('R10：maxLines 0 → `Number(0)||默认(1)` = 1', sizeF.maxLines, 1)
eq('R10：fontWeight "900" → normal', sizeF.fontWeight, 'normal')
eq('R10：textAlign "居中" → left', sizeF.textAlign, 'left')
eq('R10：★ qrcode 的 width 200 → clamp 到 纸宽 70', qrF.width, 70)
eq('R10：★ qrcode 的 height **强制 = width**（存盘的 3 被忽略）', qrF.height, 70)
eq('R10：★ qrcode 的 y 上界用 height(=width) ⇒ 90−70 = 20 仍 ≥ 默认 0', qrF.y, 0)
eq('R10：maxLines 99 → 10', normalizeQualifiedLabelConfig({ fields: [{ key: 'size', maxLines: 99 }] }).fields.find((f) => f.key === 'size').maxLines, 10)
eq('R10：maxLines 2.6 → round→3', normalizeQualifiedLabelConfig({ fields: [{ key: 'size', maxLines: 2.6 }] }).fields.find((f) => f.key === 'size').maxLines, 3)

// ★ height 的**半死**语义：它只限制 y 的上界，改它不影响任何其它键
const tallY = normalizeQualifiedLabelConfig({ fields: [{ key: 'remark', height: 80, y: 300 }] })
eq('★ height 加大 → y 的上界变成 90−80 = 10（这就是 height 唯一的真实作用）', fieldOf(tallY, 'remark').y, 10)

// R11 ★ 全字段不可见 → 整体回落默认
const allHidden = normalizeQualifiedLabelConfig({
  fields: DEF.fields.map((f) => ({ key: f.key, visible: false, width: 11 })),
})
eq('R11：全 11 条 visible=false → **整体回落默认字段表**',
  allHidden.fields.map((f) => f.visible).join(','), DEF.fields.map((f) => f.visible).join(','))
eq('R11：回落后 width 也回默认（存盘的 11 被丢弃）', fieldOf(allHidden, 'door').width, 66)
deepEq('R11：回落的字段表与 createDefaultFields() 深相等', allHidden.fields, createDefaultFields())
ok('R11：只要有一条可见就不回落',
  !deepEqual(normalizeQualifiedLabelConfig({ fields: [{ key: 'size', visible: false }] }).fields, DEF.fields) ||
  normalizeQualifiedLabelConfig({ fields: [{ key: 'size', visible: false }] }).fields.filter((f) => f.visible).length === 10)

// ================================================================ //
console.log('—— §5.2 固定张数 ——')
// ================================================================ //
const rows3 = [{ n: 1 }, { n: 2 }, { n: 3 }]
const padded = padToFixedQuantity(rows3, { enabled: true, value: 5 })
eq('开启 + 5 张 → 循环取模补齐到 5 条', padded.map((r) => r.n).join(','), '1,2,3,1,2')
eq('开启 + 张数 < 行数 → 取前 N 条（不截断语义外的东西）',
  padToFixedQuantity(rows3, { enabled: true, value: 2 }).map((r) => r.n).join(','), '1,2')
eq('★ 关闭 → **原样返回同一个数组引用**', padToFixedQuantity(rows3, { enabled: false, value: 5 }) === rows3, true)
eq('★ 行集为空 → 原样返回（空集取模会得到 undefined，必须挡住）', padToFixedQuantity([], { enabled: true, value: 5 }).length, 0)
eq('setting 缺失 → 原样', padToFixedQuantity(rows3, undefined) === rows3, true)
eq('rows 非数组 → 空数组', padToFixedQuantity(null, { enabled: true, value: 5 }).length, 0)
eq('补齐后元素是**同一批引用**（不是深拷贝）', padded[3] === rows3[0], true)

// `L` = round → clamp(1,99)，非有限 → 1
eq('L：0.4 → round 0 → clamp 1', normalizeFixedQuantity(0.4), 1)
eq('L：98.6 → round 99', normalizeFixedQuantity(98.6), 99)
eq('L：200 → 99', normalizeFixedQuantity(200), 99)
eq('L：NaN → 1', normalizeFixedQuantity(NaN), 1)
eq('L：Infinity → 1', normalizeFixedQuantity(Infinity), 1)
eq('L："abc" → 1', normalizeFixedQuantity('abc'), 1)
eq('L："7" → 7', normalizeFixedQuantity('7'), 7)
eq('L：undefined → 1', normalizeFixedQuantity(undefined), 1)
deepEq('createFixedQuantitySetting 归一化 value（旧版 L(z.value)）',
  createFixedQuantitySetting(true, 0), { enabled: true, value: 1 })
deepEq('padToFixedQuantity 内部也归一化 value（0 → 1）',
  padToFixedQuantity(rows3, { enabled: true, value: 0 }).map((r) => r.n), [1])

// 两个裸串键
store.clear()
deepEq('读：两个键都缺失 → false / 1', loadFixedQuantitySetting(), { enabled: false, value: 1 })
store.set('qualified_label_quantity_enabled', '1')
store.set('qualified_label_quantity_value', '5')
deepEq('读："1" + "5"', loadFixedQuantitySetting(), { enabled: true, value: 5 })
store.set('qualified_label_quantity_enabled', 'true')
deepEq('读：★ 开关判的是严格 "1"，"true" 不算', loadFixedQuantitySetting(), { enabled: false, value: 5 })
store.set('qualified_label_quantity_value', '0')
deepEq('读：值 "0" 是真值串 → Number("0")=0 → round 0 → clamp 1', loadFixedQuantitySetting(), { enabled: false, value: 1 })
store.set('qualified_label_quantity_value', '')
deepEq('读：值 "" → `|| 1` 回落 1', loadFixedQuantitySetting(), { enabled: false, value: 1 })
store.clear()
deepEq('写：存**裸串** "1" / "5"（不是 JSON）',
  (() => { const r = saveFixedQuantitySetting(true, 5); return [r, store.get('qualified_label_quantity_enabled'), store.get('qualified_label_quantity_value')] })(),
  [{ enabled: true, value: 5 }, '1', '5'])
eq('写：先 clamp 再存（0.4 → 1）',
  (() => { saveFixedQuantitySetting(false, 0.4); return store.get('qualified_label_quantity_value') })(), '1')
eq('写：关闭时存 "0"',
  (() => { saveFixedQuantitySetting(false, 9); return store.get('qualified_label_quantity_enabled') })(), '0')

// localStorage 抛错时的回落
storageThrows = true
deepEq('读：localStorage 抛错 → 回落 false / 1', loadFixedQuantitySetting(), { enabled: false, value: 1 })
eq('写：localStorage 抛错不抛异常（空 catch）',
  (() => { try { saveFixedQuantitySetting(true, 9); return 'no-throw' } catch { return 'threw' } })(), 'no-throw')
storageThrows = false

// ================================================================ //
console.log('—— 配置/打印机的 4 个键 ——')
// ================================================================ //
eq('键名逐字（含 §2.6 的两个裸串键）',
  Object.values(QL_STORAGE_KEYS).join(','),
  'qualified_label_template_v2,qualified_label_printer,qualified_label_quantity_enabled,qualified_label_quantity_value')
store.clear()
deepEq('读：无存盘 → 默认配置 + 空打印机名', loadQualifiedLabelSettings(), { config: DEF, selectedPrinter: '' })
store.set('qualified_label_template_v2', JSON.stringify({ paper: { widthMm: 100 } }))
store.set('qualified_label_printer', '标签机A')
const loaded = loadQualifiedLabelSettings()
eq('读：配置走清洗（widthMm 100）', loaded.config.paper.widthMm, 100)
eq('读：打印机是裸串', loaded.selectedPrinter, '标签机A')
store.set('qualified_label_template_v2', '{不是 JSON')
deepEq('读：JSON 坏掉 → 回落默认（整段 try/catch）', loadQualifiedLabelSettings().config, DEF)
store.clear()
saveQualifiedLabelConfig(DEF)
eq('写：配置是 JSON', JSON.parse(store.get('qualified_label_template_v2')).paper.widthMm, 70)
saveQualifiedLabelPrinter('标签机B')
eq('写：打印机是**裸串**（不是 JSON）', store.get('qualified_label_printer'), '标签机B')

// ================================================================ //
console.log('—— §4.2 前置：别名表 / 取值 / 剥前缀 ——')
// ================================================================ //
eq('别名表 11 组', Object.keys(FIELD_ALIASES).length, 11)
eq('qrcode 的 4 个候选（唯一的多大小写变体）', FIELD_ALIASES.qrcode.join(','), 'qrcode,qrCode,QRCode,orderQrcode')
eq('address 的候选含「安装地址」', FIELD_ALIASES.address.join(','), 'address,安装地址,地址')
eq('orderID 的候选末项是「编号」不是「订单号」', FIELD_ALIASES.orderID.join(','), 'orderID,orderId,orderNo,编号')
eq('★ 别名表里**没有** storeAddress', 'storeAddress' in FIELD_ALIASES, false)
eq('取值：按候选顺序取第一个命中的', readFieldValue({ profile: '型材A' }, 'door'), '型材A')
eq('取值：第一个候选胜出', readFieldValue({ door: 'A', profile: 'B' }, 'door'), 'A')
eq('取值：★ 空串算命中（不是真值判断）', readFieldValue({ door: '' }, 'door'), '')
eq('取值：★ 数字 0 也算命中', readFieldValue({ door: 0 }, 'door'), '0')
eq('取值：null 跳过、看下一个候选', readFieldValue({ door: null, profile: 'B' }, 'door'), 'B')
eq('取值：undefined 跳过、看下一个候选', readFieldValue({ door: undefined, 型材: 'C' }, 'door'), 'C')
eq('取值：全缺 → ""', readFieldValue({}, 'door'), '')
eq('取值：未知 key 回落同名属性（分支 C）', readFieldValue({ 随便: 'X' }, '随便'), 'X')
eq('取值：row 为 null → ""', readFieldValue(null, 'door'), '')
eq('剥前缀：半角', stripLabelPrefix('型材:80断桥', '型材'), '80断桥')
eq('剥前缀：全角', stripLabelPrefix('型材：80断桥', '型材'), '80断桥')
eq('剥前缀：没有前缀 → 原样', stripLabelPrefix('80断桥', '型材'), '80断桥')
eq('剥前缀：只剥开头一处', stripLabelPrefix('型材:型材:A', '型材'), '型材:A')
eq('剥前缀：不在开头不剥', stripLabelPrefix('A型材:B', '型材'), 'A型材:B')

// ================================================================ //
console.log('—— §3.2/§3.3 布局纯函数 ——')
// ================================================================ //
const onBase = createDefaultFields()
autoFitFields(onBase, 70, 90)
deepEq('§3.3：在基准 70×90 上自适应 → **恒等**（r=i=c=1）', onBase, createDefaultFields())

const wide = createDefaultFields()
autoFitFields(wide, 140, 90) // r=2, i=1, c=1
eq('§3.3：140×90 → x 按宽比 ×2', findField(wide, 'size').x, 4)
eq('§3.3：140×90 → y 按**高比** ×1（不是 min）', findField(wide, 'size').y, 29)
eq('§3.3：140×90 → width ×2', findField(wide, 'size').width, 132)
eq('§3.3：140×90 → fontSize 用 min(r,i)=1 → 不变', findField(wide, 'size').fontSize, 16)
eq('§3.3：★ height **完全不缩放**，直接抄默认 5', findField(wide, 'size').height, 5)
eq('§3.3：★ qrcode 的 width 按 min 比（不是宽比）= 20', findField(wide, 'qrcode').width, 20)
eq('§3.3：★ qrcode 的 height = width', findField(wide, 'qrcode').height, findField(wide, 'qrcode').width)

const half = createDefaultFields()
autoFitFields(half, 35, 45) // r=i=c=0.5
eq('§3.3：35×45 → fontSize round(16*0.5*2)/2 = 8', findField(half, 'size').fontSize, 8)
eq('§3.3：35×45 → client.y 11.5 → round(11.5*0.5*10)/10 = 5.8（0.1 精度）', findField(half, 'client').y, 5.8)
eq('§3.3：35×45 → qrcode width = 10', findField(half, 'qrcode').width, 10)

const big = createDefaultFields()
autoFitFields(big, 140, 180) // c = 2
eq('§3.3：140×180 → fontSize round(16*2*2)/2 = 32（取到 0.5）', findField(big, 'size').fontSize, 32)
eq('§3.3：package 的 fontSize 10 → 20（它**不被排除**）', findField(big, 'package').fontSize, 20)
eq('§3.3：★ 无字段被跳过（11 条全改）', big.filter((f, i) => f.x !== createDefaultFields()[i].x).length, 11)

// §2.5 应用到全部
const all = createDefaultFields()
applyToAllFontSize(all, 16.5)
eq('§2.5：应用到全部 → door/size/… 变 16.5',
  ['door', 'size', 'lockway', 'color', 'glass', 'address', 'remark'].map((k) => findField(all, k).fontSize).join(','),
  '16.5,16.5,16.5,16.5,16.5,16.5,16.5')
eq('§2.5：★ 排除 qrcode（21.5→19 不变）', findField(all, 'qrcode').fontSize, 19)
eq('§2.5：★ 排除 package（仍是 10，不是 16.5）', findField(all, 'package').fontSize, 10)
eq('§2.5：显式排除表 = qrcode,package', APPLY_TO_ALL_EXCLUDED_KEYS.join(','), 'qrcode,package')
eq('§2.5：只写 fontSize、不写 fontWeight（orderID 仍 normal）', findField(all, 'orderID').fontWeight, 'normal')

// §3.2 适应纸张宽度
const fit = createDefaultFields()
fitPaperWidth(fit, { widthMm: 100, heightMm: 90, paddingMm: 5, orientation: 'portrait', printRotate90: false })
eq('§3.2：适应纸张宽度 = 100 − 2×5 = 90', findField(fit, 'size').width, 90)
eq('§3.2：★ 只排除 qrcode', findField(fit, 'qrcode').width, 20)
eq('§3.2：★ package **不被排除**（也变 90）', findField(fit, 'package').width, 90)
eq('§3.2：可用宽有下限 1（20−2×20 = −20 → 1）',
  (() => { const f = createDefaultFields(); fitPaperWidth(f, { widthMm: 20, heightMm: 90, paddingMm: 20, orientation: 'portrait', printRotate90: false }); return findField(f, 'size').width })(), 1)

// §3.2 批量调整
deepEq('§3.2：回读取组内**第一个**命中 → door 的字号/宽度、client 的宽度',
  readBatchValues(createDefaultFields()), { fontSize: 16, bodyWidth: 66, orderWidth: 48 })
const batch = createDefaultFields()
applyBatchFontSize(batch, 12)
applyBatchBodyWidth(batch, 50)
applyBatchOrderWidth(batch, 40)
eq('§3.2：正文字号作用于 7 条', BODY_FIELD_KEYS.map((k) => findField(batch, k).fontSize).join(','), '12,12,12,12,12,12,12')
eq('§3.2：正文行宽作用于 7 条', BODY_FIELD_KEYS.map((k) => findField(batch, k).width).join(','), '50,50,50,50,50,50,50')
eq('§3.2：客户/单号宽作用于 2 条', ORDER_FIELD_KEYS.map((k) => findField(batch, k).width).join(','), '40,40')
eq('§3.2：★ 两个组都不含 qrcode/package',
  [...BODY_FIELD_KEYS, ...ORDER_FIELD_KEYS].some((k) => k === 'qrcode' || k === 'package'), false)
eq('§3.2：批量调整**改不到** package 的字号（仍是 10）', findField(batch, 'package').fontSize, 10)

// §3.2 P：常用尺寸只写宽高
const presetPaper = createDefaultConfig().paper
applyPaperPreset(presetPaper, 60, 40)
eq('§3.2：常用尺寸只写宽高', presetPaper.widthMm + '×' + presetPaper.heightMm, '60×40')
eq('§3.2：★ 不重排字段（本函数不碰 fields）', Object.keys(presetPaper).length, 5)

// ================================================================ //
console.log('—— UI 范围常量（§3.2 三处 width 下限不一致）——')
// ================================================================ //
eq('★ 左栏 宽(mm) 下限 4', FIELD_UI_RANGES.width.min, 4)
eq('★ 右栏字段表 宽(mm) 下限 1', FIELD_TABLE_UI_RANGES.width.min, 1)
eq('★ 清洗 clamp 下限也是 1（与右栏一致、与左栏不一致）',
  normalizeQualifiedLabelConfig({ fields: [{ key: 'size', width: 2 }] }).fields.find((f) => f.key === 'size').width, 2)
eq('左栏 maxLines 1–10 step 1', `${FIELD_UI_RANGES.maxLines.min}-${FIELD_UI_RANGES.maxLines.max}/${FIELD_UI_RANGES.maxLines.step}`, '1-10/1')
eq('左栏 y 0–400 step 0.5', `${FIELD_UI_RANGES.y.min}-${FIELD_UI_RANGES.y.max}/${FIELD_UI_RANGES.y.step}`, '0-400/0.5')

console.log('')
console.log('通过', results.filter((r) => r.ok).length, '/', results.length)
if (failed) process.exitCode = 1
