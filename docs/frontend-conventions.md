# 前端布局与 UI 规范

> 目的：保证所有页面在桌面与窄屏（移动端 / 小窗口）下排版一致、窄屏自动换行。**所有新页面必须遵守。**
>
> 视觉、Token、材质、组件状态与微交互的完整规范见 [`docs/design-system.md`](./design-system.md)。本文件保留布局和表格的工程约束。

## 1. 页面外壳

每个页面根元素统一用 `.page`，内边距与背景一致：

```css
.page {
  min-height: 100%;
  padding: var(--sd-page-padding);
  color: var(--sd-color-text-strong);
  background: var(--sd-color-bg-page);
}
```

## 2. 横向布局一律可换行

所有 `display: flex` 的横向容器（页头、工具条、筛选/尺寸区、按钮组）**必须**加 `flex-wrap: wrap` 与 `gap`，窄屏自动换行、禁止溢出：

```css
.header  { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
.actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.dims    { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; }
```

## 3. 表格

- **多列、固定列宽的表格**（用 `n-data-table`）：必须设 `scroll-x`，窄屏时在卡片内横向滚动，而不是撑破页面。

  ```html
  <n-data-table :columns="columns" :data="data" :scroll-x="1200" :pagination="pagination" />
  ```

  `scroll-x` 的取值 ≈ 各列 `width`/`minWidth` 之和。

- **简单 / 原生表格**：用百分比列宽 + `width: 100%`，随容器收缩。

  > ⚠️ 2026-09-16 更正：这里原来写着「参考公式管理页的部件表」，那条参考**已不成立**。
  > 部件表原先就是"百分比列宽 + 满宽"，观感是**拉满页面、材料名列巨大、输入框撑满整格**，
  > 用户明确反馈不理想。现在它改成了照抄旧版的**单元格内部结构**（一行多控件、居中堆叠、
  > 紧凑的辅助标签），而不是靠百分比列宽去铺。**别再拿它当"简单表格"的范例。**
  >
  > 顺带记一条实测教训：旧版的**声明式像素值不能直接照抄**。旧版部件表的 CSS 写着
  > `.formula-input{width:60px;font-size:28px}`、列宽 `100/30/65/120/120`，
  > 但把那页用旧版自己的 vendor（`legacy/vendor/js/vue.min.js` + `element-plus.min.js` +
  > `legacy/css/Diao-15870f7d.css`）单独渲染出来量：**列宽实测 336/101/218/403/403**
  > （el-table 在 `width:100%` 下把列等比拉伸了）、**输入框实测 176px**、**内层 input 字号 16px**
  > —— 那两个声明全是死的。照着字面抄的结果是每格文字被裁掉。
  > ⇒ 遇到"这个样式到底长什么样"说不清时，**把旧版那页用它的 vendor 单独跑起来量**，
  > 比读 CSS 靠谱。

## 4. Token 与组件约束

- 组件库：Naive UI（全局注册，`app.use(naive)`）。
- 弹窗 / 抽屉内布局同样遵守第 2 条（横向 flex 容器也要 `flex-wrap`）。
- 新页面和重构页面必须优先使用 `--sd-*` token。
- 不得新增未经定义的颜色、圆角、阴影、控件高度和动效值；通用值应提升到全局 token。
- 不得在页面内建立 `--ios-*`、`--page-theme-*` 等平行 token 系统。
- 毛玻璃只用于页面 shell、主任务卡、Modal / Drawer 等有限层级，不用于长表格滚动层。
- 打印、标签、回执和所见即所得画布属于输出契约，不套用应用 UI token。

## 5. 结构简化与容器层级

页面重构必须优先通过**删除重复结构**解决层级问题，而不是增加一组 CSS，把仍然存在的重复容器“伪装”为扁平结构。

### 5.1 基本原则

- 同一个业务任务区默认只允许一个主要容器。标题、工具条、表单和内容属于同一任务时，应放在同一个 Card / Surface 内。
- 禁止无业务层级的“卡片套卡片”。内层内容如果只是外层任务的一部分，应使用分区标题、分割线、间距或背景区分，而不是再增加完整的边框、圆角和阴影。
- 去除视觉套娃时，必须优先删除重复的 DOM 包装、标题、边框和样式；不得只用 `border: 0`、`box-shadow: none` 等覆盖规则长期保留冗余结构。
- 重构后的模板和样式原则上应比重构前更少或更集中。只有新增了明确业务能力时，代码量增加才是合理的。
- 不得为了局部视觉修复复制组件、状态或业务逻辑。不同页面需要相同内容时，应复用同一个业务组件，并通过明确的展示模式控制结构差异。

### 5.2 Card 嵌套判定

只有同时满足以下条件时，才允许 Card 内再嵌套 Card：

1. 内层是可以独立完成、独立保存或独立关闭的业务任务；
2. 内层有自己完整的状态、操作和错误边界；
3. 去掉内层容器后会造成真实的信息层级混淆，而不只是“看起来不够丰富”。

否则应改成普通分区：

```html
<section class="task-card">
  <header class="task-card__header">门明细录入</header>

  <div class="task-section">
    <h3>平开门</h3>
    <!-- 字段与操作直接属于 task-card，不再包第二张卡片 -->
  </div>
</section>
```

不要写成：

```html
<section class="task-card">
  <header>门明细录入</header>

  <section class="nested-card">
    <header>平开门明细</header>
    <!-- 与外层属于同一个任务，却再次出现完整卡片外壳 -->
  </section>
</section>
```

### 5.3 重构验收标准

完成页面结构重构后，必须检查：

- [ ] 是否存在表达同一业务任务的重复标题。
- [ ] 是否存在只有视觉作用、没有业务边界的嵌套 Card。
- [ ] 能否删除一层 DOM，而不影响数据、交互和可访问性。
- [ ] 是否为了覆盖旧结构新增了大量高权重选择器或 `!important`。
- [ ] 删除重复层级后，移动端是否减少了无效留白和滚动距离。
- [ ] 新增的组件模式是否真正减少了页面分支，而不是把重复代码搬到另一个文件。

> 规范结论：**消除视觉套娃必须以结构简化为目标。能删除结构时，不用 CSS 隐藏结构；没有业务价值的层级，不保留。**
