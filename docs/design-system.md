# SmartDoor Design System

> 版本：1.0 · 2026-09-21  
> 适用范围：`app/` 内所有新页面、页面重构与通用业务组件。  
> 视觉基调：**iOS / iPadOS 材质语言 × 企业级 SaaS / ERP 信息密度**。

## 1. 设计原则

1. **业务效率优先**：先保证任务路径、数据扫描和异常处理，再考虑视觉表现。
2. **层级来自结构**：通过标题、间距、分组、对齐和语义色建立层级，不依赖堆叠卡片。
3. **玻璃材质限量使用**：毛玻璃只表达高层容器和浮层，不给每个区块都加 blur。
4. **高密度但不拥挤**：表格、筛选器和工具条保持紧凑；关键操作保留足够触达面积。
5. **状态清晰**：成功、警告、危险、流程状态使用固定语义，不用颜色承担唯一信息。
6. **动效服务反馈**：动效只说明进入、聚焦、按压、加载和状态变化，不做装饰性表演。
7. **兼容优先**：页面结构可以调整，业务逻辑、API、字段和核心流程不得因视觉重构改变。

## 2. Token 架构

Token 分为三层：

| 层级 | 用途 | 页面是否可直接使用 |
| --- | --- | --- |
| Primitive | 原始色板和基础值，例如 `--sd-palette-action` | 否；只用于构建语义层 |
| Semantic | 操作、文本、背景、边框、状态，例如 `--sd-color-action` | 是；默认优先 |
| Material / Component | 玻璃、控件填充、焦点环、阴影，例如 `--sd-material-surface` | 是；按使用规则限制 |

实现位置：

- `app/src/styles/design-tokens.ts`：**所有带颜色的 token 的唯一来源**，同时供 Naive UI 和 CSS 使用。
- `app/src/styles/tokens.css`：字体、字号、间距、圆角、高度、模糊、时间与缓动。
- `app/src/styles/naive-theme.ts`：把同一套语义色接入 Naive UI。
- `app/src/main.ts`：应用挂载前安装颜色 CSS variables，避免首帧变量为空。

### 命名规则

```text
--sd-palette-*    原始色板，页面通常不直接使用
--sd-color-*      语义色
--sd-material-*   半透明材质、填充和高光
--sd-border-*     边界材质
--sd-shadow-*     阴影、焦点环、状态环
--sd-font-*       字体与排版
--sd-space-*      间距
--sd-radius-*     圆角
--sd-control-*    控件尺寸
--sd-glass-*      模糊与饱和度
--sd-duration-*   动效时长
--sd-ease-*       动效曲线
--sd-motion-*     位移和缩放反馈
```

**禁止在页面内建立 `--ios-*`、`--page-blue-*` 等平行体系。** 如果视觉值具有跨页面价值，应提升为 `--sd-*`；真正只属于某一布局的尺寸可以保留为局部变量。

## 3. 颜色语义

### 3.1 主操作与状态

| 语义 | Token | 用途 |
| --- | --- | --- |
| 主操作 | `--sd-color-action` | 主按钮、选中态、焦点态、关键链接 |
| Hover | `--sd-color-action-hover` | 支持 hover 的精确指针设备 |
| Pressed | `--sd-color-action-pressed` | 按压和激活反馈 |
| Soft | `--sd-color-action-soft` | 低强调选中背景，不用于大面积装饰 |
| Process | `--sd-color-process` | 生产中、流转中等业务流程状态 |
| Success | `--sd-color-success` | 已完成、在线、校验通过 |
| Warning | `--sd-color-warning` | 需要注意、临近阈值 |
| Danger | `--sd-color-danger` | 失败、删除、阻断异常 |
| Info | `--sd-color-info` | 中性提示和非关键状态 |

状态必须同时提供文本、图标或标签，不能只靠颜色区分。

### 3.2 文本与背景

| 层级 | Token | 规则 |
| --- | --- | --- |
| 强文本 | `--sd-color-text-strong` | 页面标题、关键值、字段名称 |
| 正文 | `--sd-color-text` | 正文、说明、常规数据 |
| 弱文本 | `--sd-color-text-muted` | 辅助信息、时间、占位说明 |
| 禁用 | `--sd-color-text-disabled` | 不可操作状态，不用于普通次要文本 |
| 页面背景 | `--sd-color-bg-page` | 常规桌面页面底色 |
| Surface | `--sd-color-bg-surface` | 实体卡片、表格、兼容性回退 |
| Subtle | `--sd-color-bg-subtle` | 分区、移动/窄屏无玻璃背景 |
| Brand | `--sd-color-bg-brand` | 品牌说明区，不用于业务数据区 |

不要在业务页面新增未经定义的 Hex、RGB、HSL 颜色。需要新语义时，先判断现有 token 是否足够，再修改 `design-tokens.ts`。

## 4. 字体与信息层级

系统字体栈使用 `--sd-font-sans`；金额、编号、尺寸等数据可使用 `--sd-font-data` 并开启 `tabular-nums`。

| 角色 | 建议 token | 字重 |
| --- | --- | --- |
| 页面主标题 | `--sd-font-size-2xl` / `3xl` | `--sd-font-weight-bold` |
| 区块标题 | `--sd-font-size-xl` | `--sd-font-weight-strong` |
| 卡片标题 | `--sd-font-size-lg` | `--sd-font-weight-strong` |
| 正文 / 表单 | `--sd-font-size-md` | regular / medium |
| 标签 | `--sd-font-size-sm` | strong |
| 辅助信息 | `--sd-font-size-xs` | regular / medium |
| 数据眉题 | `--sd-font-size-2xs` / `xs` | strong + eyebrow spacing |

规则：

- 一个页面只保留一个主标题。
- 字号不是越大越重要；ERP 关键数据更应通过位置、对齐和字重突出。
- 中文正文不使用过大的字距；大写英文眉题可使用 `--sd-letter-spacing-eyebrow`。

## 5. 间距与布局

- 采用 4px 基准网格，优先使用 `--sd-space-*`。
- 页面外壳使用 `--sd-page-padding`，主要区块间距使用 `--sd-page-gap`。
- 同一层级的间距保持一致：控件内部 < 同组控件 < 区块之间 < 页面区域之间。
- 桌面优先，但不能把桌面布局等比压缩到平板；平板应按任务优先级重排。

推荐页面骨架：

```css
.page {
  min-height: 100%;
  padding: var(--sd-page-padding);
  color: var(--sd-color-text-strong);
  background: var(--sd-color-bg-page);
}

.page__content {
  width: min(100%, var(--sd-content-max-width));
  margin: 0 auto;
}
```

## 6. 圆角

| Token | 使用场景 |
| --- | --- |
| `--sd-radius-xs` | 紧凑标签、表格内小控件 |
| `--sd-radius-sm` | Tag、局部按钮、紧凑组件 |
| `--sd-radius-md` | 常规 Naive UI 控件和卡片 |
| `--sd-radius-control` | 突出输入框、登录/搜索等主任务控件 |
| `--sd-radius-card` | 主要实体卡片 |
| `--sd-radius-material` | 毛玻璃主任务卡 |
| `--sd-radius-shell` | 页面级玻璃 shell |
| `--sd-radius-pill` | 仅用于状态胶囊，不用于普通按钮 |

不要给表格每个单元格、每个筛选项或每个文本区块增加大圆角。

## 7. Material / Glass

### 允许使用

- 登录、引导等单任务页面的页面 shell。
- 页面中的一个主任务卡。
- Modal、Drawer、Popover 等浮层。
- 品牌区或少量需要表达空间层级的辅助面板。

### 禁止使用

- 长列表和大表格的滚动容器。
- 页面内每一个统计块或字段组。
- 打印、标签、回执、画布和导出内容。
- 仅为了“更高级”而增加的无业务价值卡片。

推荐组合：

```css
.material-card {
  border: var(--sd-border-width) solid var(--sd-border-glass-strong);
  border-radius: var(--sd-radius-material);
  background: var(--sd-material-surface-strong);
  box-shadow: var(--sd-shadow-material-card);
  backdrop-filter: blur(var(--sd-glass-blur-lg)) saturate(var(--sd-glass-saturation-strong));
}
```

必须提供不支持 `backdrop-filter` 时的实体背景回退。

## 8. Button

- 每个任务区只保留一个视觉最强的主操作。
- 主操作使用 action；危险操作只有在动作确实不可逆时使用 danger。
- 次要操作使用默认/tertiary 视觉，不与主按钮争夺注意力。
- 按钮文案必须描述结果，如“保存更改”“创建订单”，避免模糊的“确定”“提交”。
- 常规业务按钮沿用 Naive UI 密度；认证、全局搜索等主任务可用 `--sd-control-height-prominent`。
- hover 只在 `hover: hover` 且 `pointer: fine` 时启用；按压使用 `--sd-motion-press-scale`。

## 9. Input / Select

- 表单标签置于字段上方或保持整页统一，不在同一表单中混用。
- Placeholder 只给示例，不替代标签。
- Focus 必须同时具备边框变化和 `--sd-focus-ring` / `--sd-focus-ring-soft`。
- 错误信息紧邻字段并说明修复方法。
- 同一行只放强相关字段；平板空间不足时按业务顺序换行。

## 10. Table

- 表格是高密度工作区，不使用毛玻璃和大圆角单元格。
- 表头、关键列、状态列和操作列保持稳定位置。
- 多列表格必须设置 `scroll-x`，不得撑破页面。
- 数字右对齐，编号/金额/尺寸使用等宽数字。
- 行 hover 只帮助定位当前行，不使用明显位移或阴影。
- 空表格显示下一步操作；加载期间保持表头和容器稳定，避免布局跳动。

## 11. Modal / Drawer

- Modal 用于需要明确完成/取消的短任务；Drawer 用于不中断上下文的详情和编辑。
- 标题说明任务，底部操作固定且主次清晰。
- 不嵌套多层 Modal；复杂流程应进入独立页面。
- 可以使用 Material token，但内容区应保持清晰实体底色，避免 blur 影响文字对比。

## 12. Tag / Status

- Tag 用于分类，Status 用于状态，两者不可混用。
- 默认使用低饱和 soft 背景 + 清晰文字；高饱和色只用于图标、状态点或关键告警。
- 状态文案使用稳定词汇，例如“待生产 / 生产中 / 已完成 / 已取消”。
- 状态点的呼吸动效只用于真实在线或实时状态，不用于普通装饰。

## 13. Card

- 卡片必须对应一个可命名的信息组或任务，不把纯布局容器视觉化。
- 默认业务卡使用实体 surface；只有页面级或主任务卡可使用 glass material。
- 卡片内部优先用留白、标题和分隔线分组，避免“卡片套卡片”。

## 14. Empty / Loading / Error

- **Empty**：说明为什么为空，并提供最可能的下一步操作。
- **Loading**：按钮内加载保持原宽；页面加载使用骨架或稳定占位，避免整体闪烁。
- **Error**：指出失败对象和解决方式；错误不使用含糊文案，也不只显示颜色。
- **Success**：短暂反馈即可，不用阻塞式弹窗打断连续操作。

## 15. 响应式

建议按信息优先级使用以下边界：

- `> 1120px`：完整桌面工作区。
- `901–1120px`：紧凑桌面 / 横向平板，减少辅助信息，保留主要操作。
- `641–900px`：平板单列或主次分区重排。
- `≤ 640px`：窄屏兜底；隐藏非关键装饰，保持核心任务完整。

CSS custom property 不能可靠用于 media query 条件，因此断点数值写在 media query 中，但必须遵循以上语义，不得随页面任意新增相近断点。

响应式不是“把桌面缩小”：

1. 先保留主任务、关键状态和主要操作。
2. 再折叠辅助说明、次要统计和装饰图形。
3. 最后让工具条换行、表格横向滚动或切换为适合任务的详情结构。

## 16. 微交互与 Reduced Motion

- Hover 位移最多使用 `--sd-motion-hover-y`。
- Press 使用 `--sd-motion-press-scale`，不得造成布局变化。
- 常规反馈使用 fast/base；容器进入使用 enter。
- 禁止无意义循环动画；实时状态的低幅呼吸是例外。
- 所有新动画必须在 `prefers-reduced-motion: reduce` 下关闭或通过 token 降为 1ms / 0 位移。

## 17. 可访问性

- 所有交互元素必须支持键盘操作并有可见焦点。
- 图标按钮必须有可读名称；装饰性 SVG 使用 `aria-hidden="true"`。
- 不用颜色作为唯一状态信息。
- 正文和关键操作保证足够对比；弱文本不承载关键业务数据。
- 点击目标建议不小于 40px；主任务控件可使用 48px。

## 18. Naive UI 接入规则

- 颜色只从 `appColors` 进入 `appThemeOverrides`，不要给需要颜色运算的 Naive token 传 `var()`。
- 页面局部覆盖 `--n-*` 时，值必须来自 `--sd-color-*` / `--sd-material-*` / `--sd-shadow-*`。
- 不得用局部 `--n-*` 创建另一套品牌色、圆角和动效。
- 能通过全局主题解决的一致性问题，不在每个页面重复覆盖。

## 19. Do / Don’t

### Do

- 用语义 token 表达用途，而不是记忆颜色值。
- 用一个主操作引导任务完成。
- 让表格、筛选和状态保持紧凑清晰。
- 用细边框、内高光和克制阴影表达玻璃层级。
- 在桌面与平板分别确认信息优先级。

### Don’t

- 不新增页面级 `--ios-*` 或硬编码主题颜色。
- 不在一个页面铺满玻璃卡片。
- 不用大面积渐变、重阴影、过度圆角制造“高级感”。
- 不给不可交互元素增加 hover 动效。
- 不因 UI 重构修改 API、字段、权限逻辑和核心流程。

## 20. 页面重构检查清单

- [ ] 业务功能、API、字段、权限和导航流程未改变。
- [ ] 主操作、次要操作和危险操作层级清晰。
- [ ] 页面没有新增未经定义的颜色、圆角、阴影和动效值。
- [ ] 页面没有 `--ios-*` 等平行 token。
- [ ] 毛玻璃仅用于高层容器，表格滚动区没有 blur。
- [ ] Input / Select / Button 的高度、圆角、focus 和 disabled 状态一致。
- [ ] Empty / Loading / Error 状态完整。
- [ ] 1120px、900px、640px 附近完成布局检查。
- [ ] 键盘焦点可见，状态不只依赖颜色。
- [ ] `prefers-reduced-motion` 已验证。
- [ ] `npm --prefix app run build` 与 `git diff --check` 通过。
