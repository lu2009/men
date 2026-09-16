# 前端布局与 UI 规范

> 目的：保证所有页面在桌面与窄屏（移动端 / 小窗口）下排版一致、窄屏自动换行。**所有新页面必须遵守。**

## 1. 页面外壳

每个页面根元素统一用 `.page`，内边距与背景一致：

```css
.page {
  min-height: 100vh;
  padding: 24px;
  background: #f5f7fa;
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

## 4. 其它

- 组件库：Naive UI（全局注册，`app.use(naive)`）。
- 弹窗 / 抽屉内布局同样遵守第 2 条（横向 flex 容器也要 `flex-wrap`）。
