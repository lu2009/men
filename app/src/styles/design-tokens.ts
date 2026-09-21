/**
 * SmartDoor 颜色 token 的唯一值来源。
 *
 * Naive UI 会用 seemly 在运行时计算颜色，不能直接接收 `var(--token)`；因此这里同时
 * 为 Naive 主题提供实际色值，并在启动时生成同名 CSS variables 给业务样式使用。
 *
 * 这里也是一切“含颜色 token”的家。`tokens.css` 只保存字体、间距、圆角、尺寸与动效；
 * 阴影、透明材质与焦点环都由这里的颜色推导，避免同一颜色在 TS / CSS 中维护两份。
 */
export const appColors = {
  action: '#007aff',
  actionHover: '#1687ff',
  actionPressed: '#0062cc',
  actionSoft: '#eaf3ff',
  actionBorder: '#a9d0ff',

  process: '#1a7f3c',
  processSoft: '#eef8f1',
  processBorder: '#a9d8b5',

  success: '#34c759',
  successHover: '#49cf6c',
  successPressed: '#248a3d',
  successSoft: '#edf9f0',
  warning: '#ff9500',
  warningHover: '#ffa62b',
  warningPressed: '#cc7700',
  warningSoft: '#fff6e8',
  danger: '#ff3b30',
  dangerHover: '#ff6259',
  dangerPressed: '#d70015',
  dangerSoft: '#fff0ef',
  info: '#8e8e93',
  infoHover: '#a2a2a7',
  infoPressed: '#6c6c70',
  infoSoft: '#f2f2f7',

  bgPage: '#eef2f7',
  bgSurface: '#ffffff',
  bgSubtle: '#f7f8fa',
  bgHover: '#f1f2f5',
  bgPressed: '#eaf3ff',
  bgBrand: '#deebff',
  textStrong: '#172033',
  text: '#667085',
  textMuted: '#8d96a5',
  textDisabled: '#b8bec9',
  border: '#d9dee7',
  divider: '#e7eaf0',

  // 仅用于推导材质与透明层；业务页面不要直接消费这些 primitive。
  white: '#ffffff',
  neutralFill: '#767680',
  separator: '#3c3c43',
  accentSky: '#5ac8fa',
} as const

/** `#rrggbb` → `r g b`，供现代 CSS 的透明颜色语法使用。 */
function channels(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16)
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`
}

function alpha(hex: string, opacity: number): string {
  return `rgb(${channels(hex)} / ${opacity}%)`
}

const cssTokens: Record<string, string> = {
  // Primitive：只用于构建语义层和材质层。
  '--sd-palette-action': appColors.action,
  '--sd-palette-process': appColors.process,
  '--sd-palette-success': appColors.success,
  '--sd-palette-warning': appColors.warning,
  '--sd-palette-danger': appColors.danger,
  '--sd-palette-info': appColors.info,
  '--sd-palette-ink': appColors.textStrong,
  '--sd-palette-white': appColors.white,
  '--sd-palette-sky': appColors.accentSky,

  // Semantic：页面与业务组件优先使用这一层。
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
  '--sd-color-bg-brand': appColors.bgBrand,
  '--sd-color-text-strong': appColors.textStrong,
  '--sd-color-text': appColors.text,
  '--sd-color-text-muted': appColors.textMuted,
  '--sd-color-text-disabled': appColors.textDisabled,
  '--sd-color-text-on-action': appColors.white,
  '--sd-color-border': appColors.border,
  '--sd-color-divider': appColors.divider,

  // Material：有限用于页面 shell、主任务卡、Modal / Drawer 等高层容器。
  '--sd-material-page-orb-action': alpha(appColors.action, 7),
  '--sd-material-page-orb-sky': alpha(appColors.accentSky, 6),
  '--sd-material-surface': alpha(appColors.white, 76),
  '--sd-material-surface-strong': `linear-gradient(145deg, ${alpha(appColors.white, 78)}, ${alpha(appColors.white, 54)})`,
  '--sd-material-surface-subtle': alpha(appColors.bgSubtle, 48),
  '--sd-material-control': alpha(appColors.neutralFill, 10),
  '--sd-material-control-hover': alpha(appColors.neutralFill, 13),
  '--sd-material-control-focus': alpha(appColors.white, 92),
  '--sd-material-danger': alpha(appColors.danger, 8),
  '--sd-material-separator': alpha(appColors.separator, 16),
  '--sd-material-separator-soft': alpha(appColors.separator, 12),
  '--sd-material-highlight-strong': alpha(appColors.white, 94),
  '--sd-material-highlight': alpha(appColors.white, 72),
  '--sd-material-highlight-soft': alpha(appColors.white, 38),
  '--sd-material-highlight-faint': alpha(appColors.white, 24),
  '--sd-material-brand-glass': alpha(appColors.white, 26),
  '--sd-material-brand-chip': alpha(appColors.white, 48),
  '--sd-material-blueprint-fill': alpha(appColors.white, 10),
  '--sd-material-blueprint-line-strong': alpha(appColors.textStrong, 68),
  '--sd-material-blueprint-line': alpha(appColors.textStrong, 30),
  '--sd-material-measure-line': alpha(appColors.text, 30),
  '--sd-material-fallback': alpha(appColors.white, 96),

  // Border：玻璃边界以高光为主，避免用重描边模拟层级。
  '--sd-border-glass-strong': alpha(appColors.white, 88),
  '--sd-border-glass': alpha(appColors.white, 72),
  '--sd-border-glass-soft': alpha(appColors.white, 64),
  '--sd-border-glass-faint': alpha(appColors.white, 54),
  '--sd-border-glass-divider': alpha(appColors.white, 74),
  '--sd-border-action-subtle': alpha(appColors.action, 34),
  '--sd-border-action-faint': alpha(appColors.action, 8),
  '--sd-border-danger-subtle': alpha(appColors.danger, 14),

  // Elevation / focus：同样从语义色推导，禁止页面重新手写阴影颜色。
  '--sd-shadow-sm': `0 1px 2px ${alpha(appColors.textStrong, 8)}`,
  '--sd-shadow-md': `0 8px 24px ${alpha(appColors.textStrong, 12)}`,
  '--sd-shadow-material-shell': `0 30px 80px ${alpha(appColors.textStrong, 14)}, 0 2px 8px ${alpha(appColors.textStrong, 5)}`,
  '--sd-shadow-material-card': `inset 0 1px 0 ${alpha(appColors.white, 94)}, inset 1px 0 0 ${alpha(appColors.white, 54)}, 0 20px 48px ${alpha(appColors.textStrong, 10)}, 0 2px 8px ${alpha(appColors.textStrong, 5)}`,
  '--sd-shadow-material-card-hover': `inset 0 1px 0 ${appColors.white}, inset 1px 0 0 ${alpha(appColors.white, 62)}, 0 24px 54px ${alpha(appColors.textStrong, 12)}, 0 2px 8px ${alpha(appColors.textStrong, 5)}`,
  '--sd-shadow-material-art': `inset 0 1px 0 ${alpha(appColors.white, 72)}, inset 1px 0 0 ${alpha(appColors.white, 38)}, 0 20px 42px ${alpha(appColors.text, 10)}`,
  '--sd-shadow-blueprint-frame': `inset 0 0 0 6px ${alpha(appColors.white, 15)}`,
  '--sd-shadow-action': `0 9px 20px ${alpha(appColors.action, 20)}`,
  '--sd-shadow-action-hover': `0 12px 24px ${alpha(appColors.action, 24)}`,
  '--sd-shadow-action-pressed': `0 5px 12px ${alpha(appColors.action, 18)}`,
  '--sd-shadow-brand-mark': `0 8px 18px ${alpha(appColors.action, 20)}, inset 0 1px 0 ${alpha(appColors.white, 28)}`,
  '--sd-shadow-status': `0 0 0 4px ${alpha(appColors.success, 12)}`,
  '--sd-shadow-status-soft': `0 0 0 4px ${alpha(appColors.success, 10)}`,
  '--sd-shadow-status-wide': `0 0 0 6px ${alpha(appColors.success, 4)}`,
  '--sd-focus-ring': `0 0 0 3px ${alpha(appColors.action, 24)}`,
  '--sd-focus-ring-soft': `0 0 0 4px ${alpha(appColors.action, 12)}`,
}

export function installDesignTokenVariables(): void {
  const root = document.documentElement
  for (const [name, value] of Object.entries(cssTokens)) {
    root.style.setProperty(name, value)
  }
}
