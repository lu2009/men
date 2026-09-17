// C 家族自绘单据 · 单据档案（profile）—— 底座层**唯一**的差异注入点。
//
// 施工图：`docs/custom-docs-recon/01-diff.md` §0「PS2 不是另一张单子，而是 GS2 换了 4 样东西」。
// 四处差异里有**两处落在 profile**：
//   #2 列集 8→9 列（键/标签/宽/字号/行高/颜色全改）  → `createDefaultColumns` / `createDefaultConfig`
//   #3 空行渲染（丢空段 → 补 `&nbsp;` 占位）          → `keepEmptyLines`
//   #4 类名前缀 `gs`→`ps`、两个 localStorage 键名、UI 文案 → `prefix` / `storageKeys` / `documentTitle`
//   #1 行数据来源不同                                → **不在本层**，行由调用方传（见各单据 `index.ts`）
// 另外还有颜色/标签之外的「单元格 case 表」差异（§7.1：GS2 有 `client` 无 `doorframe/windows`）→ `cellCases`。

import type { ColumnConfig, DocSheetConfig } from './types'

/**
 * 一张单据用到的全部 class 名。
 *
 * ⚠️ **两套前缀并存是旧版事实，别"顺手统一"**（§4.2 末段，CONFIRMED）：
 * `gs-root` / `gs-sheet` 是**不带 `2`** 的，`gs2-title` / `gs2-table` … 是**带 `2`** 的。
 * 而 `gs`→`ps` 这个**单一**字符串替换正好同时覆盖两者（`gs2-` 的前两个字符就是 `gs`）
 * —— 所以这里只需一个 `prefix`，其余全部派生。
 */
export interface DocSheetClasses {
  /** 根容器：`gs-root` / `ps-root`（GS:637、652 四处） */
  root: string
  /** 单页：`gs-sheet` / `ps-sheet` */
  sheet: string
  /** 带 `2` 的命名空间前缀：`gs2` / `ps2` */
  ns: string
  /** 页面标题：`gs2-title` */
  title: string
  /** 页码：`gs2-page-num` */
  pageNum: string
  /** 表格：`gs2-table` */
  table: string
  /**
   * 多行文本的每一行：`gs2-line`。
   * ⚠️ 这个名字同时出现在三处，改前缀时**一处都不能漏**：
   * `css.ts` 的样式规则、`html.ts` 的行构造、`paginate.ts` 量测样式块里的 `.gs2-line{line-height:inherit;}`。
   */
  line: string
  /** 死选择器（照抄不删，见 `css.ts`） */
  qr: string
  /** 死选择器 */
  order: string
  /** 死选择器（两个） */
  lockImg: string
  /** 死选择器（两个） */
  doorImg: string
  /** 布局编辑器预览表格的**后代选择器**：`gs2-prev-table`（GS:401-405、448-457） */
  prevTable: string
  /** 布局编辑器左栏（旧版 module 级常量 `Mn`/`Nn`，§1） */
  layoutWrap: string
  /** 布局编辑器左栏 */
  layoutLeft: string
}

/** 由**单一**前缀派生全部 class 名（`'gs'` / `'ps'`）。 */
export function createDocSheetClasses(prefix: string): DocSheetClasses {
  const ns = prefix + '2'
  const k = (suffix: string): string => ns + '-' + suffix
  return {
    root: prefix + '-root',
    sheet: prefix + '-sheet',
    ns,
    title: k('title'),
    pageNum: k('page-num'),
    table: k('table'),
    line: k('line'),
    qr: k('qr'),
    order: k('order'),
    lockImg: k('lock-img'),
    doorImg: k('door-img'),
    prevTable: k('prev-table'),
    layoutWrap: k('layout-wrap'),
    layoutLeft: k('layout-left'),
  }
}

/** 单元格的渲染形态（旧版 `U` 的 `switch` 分支，GS:206-307 / PS2:216-327）。 */
export type CellKind =
  /** `renderMultiline` —— 富文本按 `<br>` 切行 */
  | 'multiline'
  /** `<img style="{imgStyle}" src="…" />`，URL 不转义、空则整格空串 */
  | 'image'
  /** 二维码 SVG（`qrSize`）+ 居中单号字幕（按 `/` 折行） */
  | 'order'

/**
 * 一条 case（列 `key` → 渲染形态 + 读哪个字段）。
 *
 * ⚠️ `order` 不带 `field`：它的取值是**固定的三级回退**
 * `row.OrderID ?? row.orderID ?? row.qrcode`（GS:225-244 / PS2:235-254），两张单据逐字相同。
 */
export type CellCase =
  | { kind: 'multiline'; field: string }
  | { kind: 'image'; field: string }
  | { kind: 'order' }

/**
 * 一张单据的档案 —— 底座层读它来产出该单据的 HTML/CSS/分页/存储。
 *
 * ⚠️ 档案只描述「换成什么」，不含任何「怎么做」；`docsheet/` 里**不允许**出现
 * `gs` / `ps` / 「玻璃合片单」/「生产单」这类字面量。
 */
export interface DocSheetProfile {
  /** 类名前缀基：`'gs'` / `'ps'`。见 `DocSheetClasses` —— **只有一个字面量** */
  prefix: string
  /** 由 `prefix` 派生的全部 class 名（`createDocSheetClasses(prefix)`） */
  classes: DocSheetClasses
  /**
   * 完整文档的 `<title>` 字面量（旧版 `J`，GS:673-681 / PS2:699-707）。
   * ⚠️ **不是** `config.table.title` —— 用户改了标题，浏览器标签页仍是这几个字。
   */
  documentTitle: string
  /** 两个 localStorage 键（§8）：整份配置 JSON / 打印机名裸串 */
  storageKeys: {
    template: string
    selectedPrinter: string
  }
  /** 默认配置工厂 —— ⚠️ **函数**，每次返回全新对象（含全新 `columns` 数组），别改成共享常量 */
  createDefaultConfig: () => DocSheetConfig
  /**
   * 默认列工厂 —— 读盘时 `columns` 缺失/非法要回落到它（GS:739-749）。
   * 与 `createDefaultConfig().table.columns` 同源，单独暴露只是为了避免每次重建整份配置。
   */
  createDefaultColumns: () => ColumnConfig[]
  /**
   * **空段占位开关** —— 本家族唯一真正的逻辑差异（§6）：
   *   · `false`（GS2）：`.filter(Boolean)` 丢空段，**全空 → 空串**；
   *   · `true` （PS2）：不 filter，空段出 `<div class="…-line">&nbsp;</div>` 占位行。
   * ⚠️ 打开后 `renderMultiline` **永不可能返回 `""`**（`String(x).split()` 至少 1 段）——
   * 旧版 PS2 的 `o.length === 0` 分支正是这么变成死代码的（§6.2 CONFIRMED）。
   * 后果：`doorframe`/`windows` 这类常为空串的列不再塌成 0 高，**每行实测高度变大、分页随之改变**（§6.3）。
   */
  keepEmptyLines: boolean
  /** 列 `key` → 渲染形态（旧版 `U` 的 `switch`）。表里没有的 key 走 `default` → 空串 */
  cellCases: Record<string, CellCase>
}
