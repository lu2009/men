/**
 * 颜色 token 的唯一值来源。
 *
 * Naive UI 会用 seemly 在运行时计算颜色，不能直接接收 `var(--token)`；因此这里同时
 * 为 Naive 主题提供实际色值，并在启动时生成同名 CSS variables 给业务样式使用。
 */
export const appColors = {
  action: '#409eff',
  actionHover: '#66b1ff',
  actionPressed: '#337ecc',
  actionSoft: '#ecf5ff',
  actionBorder: '#b3d8ff',

  process: '#1a7f3c',
  processSoft: '#f0f9eb',
  processBorder: '#b3df9a',

  success: '#67c23a',
  successHover: '#85ce61',
  successPressed: '#529b2e',
  successSoft: '#f0f9eb',
  warning: '#e6a23c',
  warningHover: '#ebb563',
  warningPressed: '#b88230',
  warningSoft: '#fdf6ec',
  danger: '#f56c6c',
  dangerHover: '#f78989',
  dangerPressed: '#c45656',
  dangerSoft: '#fef0f0',
  info: '#909399',
  infoHover: '#a6a9ad',
  infoPressed: '#73767a',
  infoSoft: '#f4f4f5',

  bgPage: '#f5f7fa',
  bgSurface: '#ffffff',
  bgSubtle: '#fafafa',
  bgHover: '#f5f7fa',
  bgPressed: '#ecf5ff',
  textStrong: '#303133',
  text: '#606266',
  textMuted: '#909399',
  textDisabled: '#c0c4cc',
  border: '#dcdfe6',
  divider: '#ebeef5',
} as const

const cssColorTokens: Record<string, string> = {
  '--sd-palette-action': appColors.action,
  '--sd-palette-process': appColors.process,
  '--sd-palette-success': appColors.success,
  '--sd-palette-warning': appColors.warning,
  '--sd-palette-danger': appColors.danger,
  '--sd-palette-ink': appColors.textStrong,
  '--sd-color-action': appColors.action,
  '--sd-color-action-hover': appColors.actionHover,
  '--sd-color-action-pressed': appColors.actionPressed,
  '--sd-color-action-soft': appColors.actionSoft,
  '--sd-color-action-border': appColors.actionBorder,
  '--sd-color-process': appColors.process,
  '--sd-color-process-soft': appColors.processSoft,
  '--sd-color-process-border': appColors.processBorder,
  '--sd-color-success': appColors.success,
  '--sd-color-success-hover': appColors.successHover,
  '--sd-color-success-pressed': appColors.successPressed,
  '--sd-color-success-soft': appColors.successSoft,
  '--sd-color-warning': appColors.warning,
  '--sd-color-warning-hover': appColors.warningHover,
  '--sd-color-warning-pressed': appColors.warningPressed,
  '--sd-color-warning-soft': appColors.warningSoft,
  '--sd-color-danger': appColors.danger,
  '--sd-color-danger-hover': appColors.dangerHover,
  '--sd-color-danger-pressed': appColors.dangerPressed,
  '--sd-color-danger-soft': appColors.dangerSoft,
  '--sd-color-info': appColors.info,
  '--sd-color-info-hover': appColors.infoHover,
  '--sd-color-info-pressed': appColors.infoPressed,
  '--sd-color-info-soft': appColors.infoSoft,
  '--sd-color-bg-page': appColors.bgPage,
  '--sd-color-bg-surface': appColors.bgSurface,
  '--sd-color-bg-subtle': appColors.bgSubtle,
  '--sd-color-bg-hover': appColors.bgHover,
  '--sd-color-bg-pressed': appColors.bgPressed,
  '--sd-color-text-strong': appColors.textStrong,
  '--sd-color-text': appColors.text,
  '--sd-color-text-muted': appColors.textMuted,
  '--sd-color-text-disabled': appColors.textDisabled,
  '--sd-color-border': appColors.border,
  '--sd-color-divider': appColors.divider,
}

export function installDesignTokenVariables(): void {
  const root = document.documentElement
  for (const [name, value] of Object.entries(cssColorTokens)) {
    root.style.setProperty(name, value)
  }
}
