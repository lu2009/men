// 自定义生产单 · 读盘清洗 —— 逐字移植旧版 `z(e)`（`PS:271-513`，4806 字符，本单据最大的一块逻辑）。
//
// 施工图：`docs/custom-docs-recon/01-ps.md` §2.4（那张逐块规则表）。
//
// ⚠️ **与底座 `docsheet/sanitize.ts` 无一处同构**（§0.1 判定「必须新写」）：
//    · 本函数是**独立函数**（旧版就是 `z`，不是内联在 `onMounted` 里）；
//    · **读盘与写回两端都调用**（§2.2）—— 这一点像 QL 而不像 PS2/GS2（底座只在读盘用）；
//      4 个调用点：`onMounted`(`PS:1346`) / 保存设置 `E`(`PS:543`) /
//      保存布局 `_`(`PS:774`) / 打开布局编辑器(`PS:1370`)。
//      —— 只有 `openSettingsDialog` **不做**归一化（只 `JSON.parse(JSON.stringify(...))`，`PS:1363`）。
//    · 合并规则：`headerFields` 按 **key**（以默认表为主干）、`columns` 按 **key**（顺序跟随存盘）
//      —— 底座是「按**下标**合并、多出的列保留」，**两边都不同**（§2.4 施工注意 2）。
//
// ⚠️ **纯白名单**：未知 key 在 `headerFields` 数组项与 `columns` 数组项里都会被丢；
//    `paper`/`tableConfig`/`doorImgBox`/`print` 是逐字段构造，未知键自然不存在。
//    ⇒ 这是**用户可见行为**（旧版存盘里多出的列/字段会被静默丢弃），新版照抄（§2.4 施工注意 3）。

import { createDefaultConfig } from './defaults'
import type {
  HeaderField,
  PaperOrientation,
  ProductionSheetConfig,
  TableColumn,
} from './types'

/**
 * 数值 clamp 工具（旧版 `N`，`PS:275-279`）。
 *
 * ```js
 * const n = Number(e)
 * return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback
 * ```
 *
 * ★ **`Number(null) === 0` 是有限值** ⇒ 存盘里的 `null` 会被夹到 **`min`**（不是回落）；
 *   `undefined` → `NaN` → 才走 `fallback`。`""` 同理 → `0` → 夹到 `min`。**照抄这个语义。**
 */
function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value)
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback
}

/** 取一个可选的嵌套属性，等价于旧版的 `e?.paper?.widthMm` 长链。 */
function read(source: unknown, key: string): unknown {
  if (source === null || typeof source !== 'object') return undefined
  return (source as Record<string, unknown>)[key]
}

/**
 * 把任意存盘数据归一化成一份**必定合法**的配置（旧版 `z`，`PS:271-513`）。
 *
 * 传 `undefined` / `null` / 垃圾数据 → 产物与 `createDefaultConfig()` **逐字段相同**
 * （每一条都走 fallback 分支）。这保证「没有存盘记录」这条路径不需要特判
 * —— 与底座 `loadDocSheetSettings` 的处理一致（那边也是「没记录就用默认，且产物与默认逐字相同」）。
 *
 * @param raw 存盘里 `JSON.parse` 出来的东西（或 `undefined`）
 */
export function normalizeProductionSheetConfig(raw: unknown): ProductionSheetConfig {
  const defaults = createDefaultConfig()

  const paper = read(raw, 'paper')
  const globalHeaderFont = read(raw, 'globalHeaderFont')
  const tableConfig = read(raw, 'tableConfig')
  const doorImgBox = read(raw, 'doorImgBox')
  const print = read(raw, 'print')

  // ---------------------------------------------------------------- //
  // paper（`PS:281-313`）
  // ---------------------------------------------------------------- //
  const orientation: PaperOrientation =
    // ★ **只认 `landscape`**，其余（含 `undefined`/`"portrait"`）一律 `portrait`
    // —— 与底座「只认 `portrait`」**方向相反**（§2.1 注 3）。别复用底座的 `sanitizePaper`。
    read(paper, 'orientation') === 'landscape' ? 'landscape' : 'portrait'

  const config: ProductionSheetConfig = {
    paper: {
      widthMm: clampNumber(read(paper, 'widthMm'), 50, 400, defaults.paper.widthMm), // PS:282-289
      heightMm: clampNumber(read(paper, 'heightMm'), 50, 400, defaults.paper.heightMm), // PS:290-297
      orientation, // PS:298-304
      paddingMm: clampNumber(read(paper, 'paddingMm'), 0, 30, defaults.paper.paddingMm), // PS:305-312
    },

    // ---------------------------------------------------------------- //
    // globalHeaderFont（`PS:314-338`）—— ⚠️ 两个字符串用 `||` 不是 `??`（空串回落）
    // ---------------------------------------------------------------- //
    globalHeaderFont: {
      fontFamily:
        (read(globalHeaderFont, 'fontFamily') as string) || defaults.globalHeaderFont.fontFamily, // PS:315-318
      fontSize: clampNumber(
        read(globalHeaderFont, 'fontSize'),
        6,
        36,
        defaults.globalHeaderFont.fontSize,
      ), // PS:319-326
      fontColor:
        (read(globalHeaderFont, 'fontColor') as string) || defaults.globalHeaderFont.fontColor, // PS:327-330
      fontWeight: read(globalHeaderFont, 'fontWeight') === 'bold' ? 'bold' : 'normal', // PS:331-337
    },

    // 下面两块的数组成员在各自的合并循环里填（`PS:441-511`）
    headerFields: [],
    tableConfig: {
      showBodyBorder:
        // ★ **保留 `undefined` 与「假值」的区别**（`void 0 !== v ? !!v : 默认`）——
        // 存盘里显式写 `false` 要尊重，缺字段才回落。`PS:341-347`
        read(tableConfig, 'showBodyBorder') !== undefined
          ? !!read(tableConfig, 'showBodyBorder')
          : defaults.tableConfig.showBodyBorder,
      underlineBrElements:
        read(tableConfig, 'underlineBrElements') !== undefined // PS:348-354
          ? !!read(tableConfig, 'underlineBrElements')
          : defaults.tableConfig.underlineBrElements,
      rowHeight: clampNumber(read(tableConfig, 'rowHeight'), 16, 60, defaults.tableConfig.rowHeight), // PS:355-362
      tableFontSize: clampNumber(
        read(tableConfig, 'tableFontSize'),
        6,
        24,
        defaults.tableConfig.tableFontSize,
      ), // PS:363-370
      // ★ 下界是 **-1**（哨兵 = 自动），不是 0（`PS:371-378`；UI 的下界是 0，两者故意不同，§2.1 注 2）
      tableTopMm: clampNumber(read(tableConfig, 'tableTopMm'), -1, 400, defaults.tableConfig.tableTopMm),
      columns: [],
    },

    // ---------------------------------------------------------------- //
    // doorImgBox（`PS:381-417`）
    // ---------------------------------------------------------------- //
    doorImgBox: {
      enabled: !!read(doorImgBox, 'enabled'), // PS:382-384 —— `!!` 直取，**没有**「undefined 才回落」的写法
      x: clampNumber(read(doorImgBox, 'x'), 0, 400, defaults.doorImgBox.x), // PS:385-392
      y: clampNumber(read(doorImgBox, 'y'), 0, 400, defaults.doorImgBox.y), // PS:393-400
      width: clampNumber(read(doorImgBox, 'width'), 10, 200, defaults.doorImgBox.width), // PS:401-408
      height: clampNumber(read(doorImgBox, 'height'), 10, 200, defaults.doorImgBox.height), // PS:409-416
    },

    // ---------------------------------------------------------------- //
    // print（`PS:418-439`）
    // ---------------------------------------------------------------- //
    print: {
      // `Math.max(1, Math.min(99, Number(v) || 默认))` —— ★ 内层是 `||`：
      // `0`/`NaN`/`""` 都会先被换成默认值 1，**再**夹。`PS:419-429`
      copies: Math.max(1, Math.min(99, Number(read(print, 'copies')) || defaults.print.copies)),
      // ★ **`2 === Number(v) ? 2 : 默认`** —— `Number("2")` 是 2，所以**字符串 `"2"` 也能过**；
      // 其余（`3`/`1`/`undefined`/`null`→0）一律回落到默认值 1。`PS:430-438`
      itemsPerPage: Number(read(print, 'itemsPerPage')) === 2 ? 2 : defaults.print.itemsPerPage,
    },
  }

  // ---------------------------------------------------------------- //
  // headerFields —— ★ **以默认表为主干遍历**（`PS:441-483`）
  // ---------------------------------------------------------------- //
  // 存盘数组先按 key 建成 Map（后出现的同名 key 覆盖先出现的，`PS:444`），
  // 然后**只遍历默认的 12 条**：
  //   · 存盘里多出的 key → **丢弃**（不在默认表里就没机会被遍历到）；
  //   · `key`/`label`/`prefix` → **强制取默认**（`PS:450-452`，不允许改名）；
  //   · **顺序永远是默认顺序**（用户拖不出顺序，也存不住）—— 与下面 `columns` 相反。
  const storedFields = read(raw, 'headerFields')
  const storedFieldList: unknown[] = Array.isArray(storedFields) ? storedFields : []

  // PS:492 处旧版还对 `columns` 建过一个 `new Map(...)` 但**结果丢弃**（死代码），
  // 这里不照抄那行 —— 行为等价。
  const fieldByKey = new Map<unknown, unknown>()
  for (const item of storedFieldList) fieldByKey.set(read(item, 'key'), item)

  for (const def of defaults.headerFields) {
    const stored = fieldByKey.get(def.key)
    // ⚠️ `{...def, ...stored, …}` —— 旧版确实是**先摊开存盘对象、再逐字段覆盖**（`PS:447-481`）。
    // 也就是说 `key`/`label`/`prefix` 等 12 个受管字段被强制覆盖，但存盘对象上**多出来的
    // 杂键会在运行期漏进来**（类型上按 `Partial<HeaderField>` 收窄，运行期行为照旧）。
    // 注：施工图 §2.4 写「未知键会被丢」指的是**数组里多出的整条字段**（按 key 匹配，确实会丢），
    // 不是「一条字段对象上多出的属性」。以源码为准。
    const merged: HeaderField = {
      ...def,
      ...(stored as Partial<HeaderField> | undefined),
      key: def.key, // PS:450
      label: def.label, // PS:451
      prefix: def.prefix, // PS:452
      visible:
        read(stored, 'visible') !== undefined ? !!read(stored, 'visible') : def.visible, // PS:453-456
      x: clampNumber(read(stored, 'x'), 0, 400, def.x), // PS:457
      y: clampNumber(read(stored, 'y'), 0, 400, def.y), // PS:458
      width: clampNumber(read(stored, 'width'), 5, 300, def.width), // PS:459
      fontSize: clampNumber(read(stored, 'fontSize'), 6, 36, def.fontSize), // PS:460-465
      fontFamily: (read(stored, 'fontFamily') as string) || def.fontFamily, // PS:466
      fontColor: (read(stored, 'fontColor') as string) || def.fontColor, // PS:467
      fontWeight: read(stored, 'fontWeight') === 'bold' ? 'bold' : 'normal', // PS:468-471
      wrap: read(stored, 'wrap') !== undefined ? !!read(stored, 'wrap') : def.wrap, // PS:472-475
      lineHeight: Number.isFinite(Number(read(stored, 'lineHeight')))
        ? Math.max(0.8, Math.min(3, Number(read(stored, 'lineHeight'))))
        : def.lineHeight, // PS:476-481 —— ★ 唯一用「修掉 NaN」写法的一处
    }
    config.headerFields.push(merged)
  }

  // ---------------------------------------------------------------- //
  // tableConfig.columns —— ★ 按 key 合并，**顺序跟随存盘**（`PS:484-511`）
  // ---------------------------------------------------------------- //
  // 与 headerFields **两套不同规则，别统一**（§2.4 施工注意 2）：
  //   · 遍历的是**存盘**数组（不是默认表）⇒ 顺序来自存盘；
  //   · 用 `find` 在默认 4 列里按 key 找，**找不到的 key 丢弃**；
  //   · 最后把默认列里没出现过的（Set 补集）**追加到末尾**；
  //   · 存盘 `columns` 不是数组或为空 → 直接用默认 4 列的浅拷贝。
  //   ⇒ 键集**恒等于**默认 4 个（既不增也不减），只有顺序与显隐/宽可变。
  const storedColumns = read(tableConfig, 'columns')
  const storedColumnList: unknown[] = Array.isArray(storedColumns) ? storedColumns : []

  if (storedColumnList.length > 0) {
    const seen = new Set<string>() // 旧版 `e` 的 Set
    for (const stored of storedColumnList) {
      const def = defaults.tableConfig.columns.find((c) => c.key === read(stored, 'key'))
      if (!def) continue // 未知 key → 丢弃（`PS:498` 的 `l &&` 短路）
      // ⚠️ 这里是 `{...l, visible, width}`（先摊开**默认**列）——
      // 所以存盘对象上多出的杂键**不会**漏进来（与上面 headerFields 的写法不同，旧版就是如此）。`PS:499-504`
      const col: TableColumn = {
        ...def,
        visible: read(stored, 'visible') !== undefined ? !!read(stored, 'visible') : def.visible,
        width: clampNumber(read(stored, 'width'), 5, 300, def.width),
      }
      config.tableConfig.columns.push(col)
      seen.add(def.key)
    }
    // 默认列里没在存盘出现过的 → 追加到末尾（`PS:506-507`）
    for (const def of defaults.tableConfig.columns) {
      if (!seen.has(def.key)) config.tableConfig.columns.push({ ...def })
    }
  } else {
    // `PS:508-511` —— 浅拷贝，别把默认数组的引用交出去
    config.tableConfig.columns = defaults.tableConfig.columns.map((c) => ({ ...c }))
  }

  return config
}

/**
 * 深拷贝一份配置（旧版到处用的 `JSON.parse(JSON.stringify(x))`，`PS:543`/`PS:774`/`PS:1363`/`PS:1370`）。
 *
 * 两个弹窗（设置 / 布局编辑）都靠它拿**独立草稿**：改草稿不影响生效配置，保存时才归一化回写。
 */
export function cloneProductionSheetConfig(config: ProductionSheetConfig): ProductionSheetConfig {
  return JSON.parse(JSON.stringify(config)) as ProductionSheetConfig
}
