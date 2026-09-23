import type { GlobalThemeOverrides } from 'naive-ui'
import { appColors } from './design-tokens'

/**
 * Naive UI 主题覆盖。
 *
 * ⚠️ **颜色必须写字面量，不能写 `var(--sd-color-*)`。**
 * Naive 用 seemly 在**渲染期**解析颜色并据此**推导** hover / pressed / suppl
 * （`changeColor` → `rgba`），它不认 `var()`，会抛
 * `[seemly/rgba]: Invalid color value var(--sd-color-action)` ——
 * 抛在渲染期 ⇒ **整棵组件树挂掉、页面全白**，而不是「某个颜色不对」。
 * 所以颜色一律取自 `design-tokens.ts` 的 `appColors`。
 *
 * 🔴 **控件高度（`height*`）同样必须写字面量 —— 这条曾经写错，代价是「所有下拉打开都是空的」。**
 * 它们**确实**会进 seemly：Naive 的 `InternalSelectMenu` 把 `optionHeight{Size}` 直接取成
 * `common.height{Size}`（`_internal/select-menu/styles/light.mjs`：
 * `optionHeightMedium: heightMedium`），再 `depx()` 成**数字**喂给虚拟列表的 `itemSize`
 * （`SelectMenu.mjs:144`）。而 seemly 的 `depx` 只认数字或 `px` 结尾的串：
 *
 *     depx('34px') → 34        depx('var(--sd-control-height-medium)') → Number('var(…)') → NaN
 *
 * `itemSize: NaN` ⇒ vueuc 虚拟列表算不出任何可见项 ⇒ **下拉弹层只剩上下 padding（8px）、
 * 一个候选都不渲染**。选中的值照常显示在框里，所以看起来「下拉失效」，而不是「报错」。
 * 只有 n-select / n-auto-complete / n-tree 这类**走虚拟列表**的组件中招；
 * 显式 `consistentMenuWidth: false` 的（如 `DetailLinesTable` 那一批）走非虚拟分支，侥幸没事。
 *
 * 其余非颜色 token（字体、圆角、阴影、动效）确实只落到 CSS 上，用 `var()` 没问题。
 *
 * ⚠️ 因此控件高度在**两处**各写一份：这里（Naive 侧，必须字面量）与 `tokens.css`
 * 的 `--sd-control-height-*`（业务 CSS 侧）。改高度时**两处同改**。
 *
 * `appColors` 是颜色字面量的唯一来源；`tokens.css` 不重复保存颜色。启动时
 * `installDesignTokenVariables()` 会把同一份值安装为 CSS variables，因此 Naive UI
 * 与业务 CSS 始终共享同一套语义色和材质色。
 */
export const appThemeOverrides: GlobalThemeOverrides = {
  common: {
    baseColor: appColors.bgSurface,
    primaryColor: appColors.action,
    primaryColorHover: appColors.actionHover,
    primaryColorPressed: appColors.actionPressed,
    primaryColorSuppl: appColors.actionHover,
    infoColor: appColors.info,
    infoColorHover: appColors.infoHover,
    infoColorPressed: appColors.infoPressed,
    infoColorSuppl: appColors.infoHover,
    successColor: appColors.success,
    successColorHover: appColors.successHover,
    successColorPressed: appColors.successPressed,
    successColorSuppl: appColors.successHover,
    warningColor: appColors.warning,
    warningColorHover: appColors.warningHover,
    warningColorPressed: appColors.warningPressed,
    warningColorSuppl: appColors.warningHover,
    errorColor: appColors.danger,
    errorColorHover: appColors.dangerHover,
    errorColorPressed: appColors.dangerPressed,
    errorColorSuppl: appColors.dangerHover,

    bodyColor: appColors.bgPage,
    cardColor: appColors.bgSurface,
    modalColor: appColors.bgSurface,
    popoverColor: appColors.bgSurface,
    tableColor: appColors.bgSurface,
    tableHeaderColor: appColors.bgPage,
    tableColorHover: appColors.bgHover,
    tableColorStriped: appColors.bgSubtle,
    inputColor: appColors.bgSurface,
    inputColorDisabled: appColors.bgPage,
    actionColor: appColors.bgPage,
    hoverColor: appColors.bgHover,
    pressedColor: appColors.bgPressed,
    dividerColor: appColors.divider,
    borderColor: appColors.border,

    textColorBase: appColors.textStrong,
    textColor1: appColors.textStrong,
    textColor2: appColors.text,
    textColor3: appColors.textMuted,
    textColorDisabled: appColors.textDisabled,
    placeholderColor: appColors.textMuted,
    placeholderColorDisabled: appColors.textDisabled,

    fontFamily: 'var(--sd-font-sans)',
    fontFamilyMono: 'var(--sd-font-data)',
    fontWeight: 'var(--sd-font-weight-regular)',
    fontWeightStrong: 'var(--sd-font-weight-medium)',
    fontSize: 'var(--sd-font-size-md)',
    fontSizeMini: 'var(--sd-font-size-xs)',
    fontSizeTiny: 'var(--sd-font-size-xs)',
    fontSizeSmall: 'var(--sd-font-size-md)',
    fontSizeMedium: 'var(--sd-font-size-md)',
    fontSizeLarge: '15px',
    fontSizeHuge: 'var(--sd-font-size-lg)',
    lineHeight: 'var(--sd-line-height-base)',

    borderRadius: 'var(--sd-radius-sm)',
    borderRadiusSmall: '2px',
    boxShadow1: 'var(--sd-shadow-sm)',
    boxShadow2: 'var(--sd-shadow-md)',
    boxShadow3: 'var(--sd-shadow-md)',

    // ⚠️ 字面量，别换成 `var(--sd-control-height-*)` —— 理由见文件头（下拉会变空）。
    //    值与 `tokens.css` 的 `--sd-control-height-*` 一一对应，两处同改。
    heightMini: '16px',
    heightTiny: '22px',
    heightSmall: '28px',
    heightMedium: '34px',
    heightLarge: '40px',
    heightHuge: '46px',
    cubicBezierEaseInOut: 'var(--sd-ease-standard)',
    cubicBezierEaseOut: 'var(--sd-ease-standard)',
  },
}
