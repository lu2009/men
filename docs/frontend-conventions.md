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

- **简单 / 原生表格**：用百分比列宽 + `width: 100%`，随容器收缩（参考公式管理页的部件表）。

## 4. 其它

- 组件库：Naive UI（全局注册，`app.use(naive)`）。
- 弹窗 / 抽屉内布局同样遵守第 2 条（横向 flex 容器也要 `flex-wrap`）。
