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
 * 非颜色的 token（字体、圆角、阴影、控件高度、动效）不经过 seemly，
 * 是直接落到 CSS 上的，用 `var()` 没问题 —— 这些由 `tokens.css` 提供。
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

    heightMini: 'var(--sd-control-height-mini)',
    heightTiny: 'var(--sd-control-height-tiny)',
    heightSmall: 'var(--sd-control-height-small)',
    heightMedium: 'var(--sd-control-height-medium)',
    heightLarge: 'var(--sd-control-height-large)',
    heightHuge: 'var(--sd-control-height-huge)',
    cubicBezierEaseInOut: 'var(--sd-ease-standard)',
    cubicBezierEaseOut: 'var(--sd-ease-standard)',
  },
}
