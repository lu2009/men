<template>
  <aside class="brand-panel" aria-labelledby="login-brand-title">
    <div class="brand-panel__topline">
      <div class="brand-panel__identity">
        <LoginBrandMark />
        <div>
          <strong>智能门窗</strong>
          <span>SMARTDOOR WORKSPACE</span>
        </div>
      </div>
      <span class="brand-panel__edition">企业业务系统</span>
    </div>

    <div class="brand-panel__content">
      <div class="brand-panel__copy">
        <p class="brand-panel__eyebrow">订单 · 生产 · 交付</p>
        <h1 id="login-brand-title">从一扇门开始，<br />贯通订单与生产。</h1>
        <p class="brand-panel__summary">
          面向门窗企业的统一工作台，让订单、生产进度与扫码流转保持在同一条业务链路上。
        </p>
      </div>

      <div class="facade" aria-hidden="true">
        <div class="facade__measure facade__measure--top">2400</div>
        <div class="facade__measure facade__measure--side">2100</div>
        <div class="facade__frame">
          <span class="facade__transom"></span>
          <span class="facade__mullion facade__mullion--left"></span>
          <span class="facade__mullion facade__mullion--right"></span>
          <span class="facade__opening"></span>
          <span class="facade__handle"></span>
        </div>
        <div class="facade__caption">SYSTEM FLOW / 01</div>
      </div>
    </div>

    <ul class="brand-panel__capabilities" aria-label="系统核心能力">
      <li>
        <span>01</span>
        <div><strong>订单协同</strong><small>集中处理客户与订单信息</small></div>
      </li>
      <li>
        <span>02</span>
        <div><strong>生产进度</strong><small>清晰掌握工序与交付状态</small></div>
      </li>
      <li>
        <span>03</span>
        <div><strong>扫码流转</strong><small>快速完成现场状态更新</small></div>
      </li>
    </ul>
  </aside>
</template>

<script setup lang="ts">
import LoginBrandMark from './LoginBrandMark.vue'
</script>

<style scoped>
.brand-panel {
  position: relative;
  display: flex;
  min-width: 0;
  flex-direction: column;
  overflow: hidden;
  padding: 40px 44px 36px;
  color: var(--sd-color-text-strong);
  background: var(--sd-color-bg-brand);
}

.brand-panel::before,
.brand-panel::after {
  position: absolute;
  border-radius: 50%;
  content: '';
  pointer-events: none;
}

.brand-panel::before {
  top: -150px;
  right: -130px;
  width: 390px;
  height: 390px;
  border: var(--sd-border-width) solid var(--sd-border-glass-faint);
  background: var(--sd-material-highlight-faint);
}

.brand-panel::after {
  right: 48px;
  bottom: -190px;
  width: 360px;
  height: 360px;
  border: var(--sd-border-width) solid var(--sd-border-action-faint);
}

.brand-panel__topline,
.brand-panel__content,
.brand-panel__capabilities {
  position: relative;
  z-index: 1;
}

.brand-panel__topline {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--sd-space-6);
}

.brand-panel__identity {
  display: flex;
  align-items: center;
  gap: var(--sd-space-3);
}

.brand-panel__identity div {
  display: grid;
  gap: 2px;
}

.brand-panel__identity strong {
  color: var(--sd-color-text-strong);
  font-size: 18px;
  font-weight: var(--sd-font-weight-bold);
  letter-spacing: 0.04em;
}

.brand-panel__identity span,
.brand-panel__edition,
.brand-panel__eyebrow,
.facade__caption,
.facade__measure {
  font-variant-numeric: tabular-nums;
  letter-spacing: var(--sd-letter-spacing-eyebrow);
}

.brand-panel__identity span {
  color: var(--sd-color-text);
  font-size: var(--sd-font-size-2xs);
  font-weight: var(--sd-font-weight-strong);
}

.brand-panel__edition {
  margin-top: 3px;
  padding: 6px 10px;
  border: var(--sd-border-width) solid var(--sd-border-glass-soft);
  border-radius: var(--sd-radius-pill);
  color: var(--sd-color-text);
  background: var(--sd-material-highlight-soft);
  font-size: var(--sd-font-size-2xs);
  font-weight: var(--sd-font-weight-strong);
  backdrop-filter: blur(var(--sd-glass-blur-sm));
  -webkit-backdrop-filter: blur(var(--sd-glass-blur-sm));
}

.brand-panel__content {
  display: grid;
  flex: 1;
  grid-template-columns: minmax(280px, 1.05fr) minmax(220px, 0.95fr);
  align-items: center;
  gap: var(--sd-space-7);
  padding: 52px 0 40px;
}

.brand-panel__copy {
  align-self: center;
}

.brand-panel__eyebrow {
  margin: 0 0 14px;
  color: var(--sd-color-action);
  font-size: var(--sd-font-size-xs);
  font-weight: var(--sd-font-weight-bold);
}

.brand-panel h1 {
  margin: 0;
  color: var(--sd-color-text-strong);
  font-size: clamp(var(--sd-font-size-3xl), 2.8vw, var(--sd-font-size-display));
  font-weight: var(--sd-font-weight-bold);
  letter-spacing: -0.055em;
  line-height: 1.22;
}

.brand-panel__summary {
  max-width: 420px;
  margin: var(--sd-space-5) 0 0;
  color: var(--sd-color-text);
  font-size: var(--sd-font-size-control);
  line-height: var(--sd-line-height-relaxed);
}

.facade {
  position: relative;
  width: min(100%, 282px);
  margin: var(--sd-space-5) auto 0;
  aspect-ratio: 1.04;
  border: var(--sd-border-width) solid var(--sd-border-glass);
  border-radius: var(--sd-radius-material);
  background: var(--sd-material-brand-glass);
  box-shadow: var(--sd-shadow-material-art);
  backdrop-filter: blur(var(--sd-glass-blur-md)) saturate(var(--sd-glass-saturation));
  -webkit-backdrop-filter: blur(var(--sd-glass-blur-md)) saturate(var(--sd-glass-saturation));
}

.facade::before {
  position: absolute;
  inset: var(--sd-border-width);
  border-radius: 23px;
  background: linear-gradient(135deg, var(--sd-material-highlight-soft), transparent 42%);
  content: '';
  pointer-events: none;
}

.facade__frame {
  position: absolute;
  inset: 42px 28px 40px 40px;
  border: 2px solid var(--sd-material-blueprint-line-strong);
  background: var(--sd-material-blueprint-fill);
  box-shadow: var(--sd-shadow-blueprint-frame);
}

.facade__transom,
.facade__mullion,
.facade__opening,
.facade__handle {
  position: absolute;
  display: block;
}

.facade__transom {
  top: 31%;
  right: 0;
  left: 0;
  border-top: var(--sd-border-width) solid var(--sd-material-blueprint-line);
}

.facade__mullion {
  top: 0;
  bottom: 0;
  border-left: var(--sd-border-width) solid var(--sd-material-blueprint-line);
}

.facade__mullion--left {
  left: 35%;
}

.facade__mullion--right {
  left: 68%;
}

.facade__opening {
  top: 31%;
  right: 0;
  bottom: 0;
  left: 68%;
  border-left: 2px solid var(--sd-color-action);
  transform: skewY(-40deg);
  transform-origin: left bottom;
}

.facade__handle {
  right: 7%;
  bottom: 29%;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--sd-color-action);
}

.facade__measure {
  position: absolute;
  color: var(--sd-color-text-muted);
  font-size: 9px;
  font-weight: var(--sd-font-weight-strong);
}

.facade__measure--top {
  top: 18px;
  left: 52%;
  transform: translateX(-50%);
}

.facade__measure--top::before,
.facade__measure--top::after {
  position: absolute;
  top: 5px;
  width: 62px;
  border-top: var(--sd-border-width) solid var(--sd-material-measure-line);
  content: '';
}

.facade__measure--top::before {
  right: calc(100% + 8px);
}

.facade__measure--top::after {
  left: calc(100% + 8px);
}

.facade__measure--side {
  top: 51%;
  left: 13px;
  transform: rotate(-90deg) translateX(-50%);
  transform-origin: left top;
}

.facade__caption {
  position: absolute;
  right: var(--sd-space-5);
  bottom: 14px;
  color: var(--sd-color-text-muted);
  font-size: 9px;
  font-weight: var(--sd-font-weight-strong);
}

.brand-panel__capabilities {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0;
  margin: 0;
  padding: 19px 0 0;
  border-top: var(--sd-border-width) solid var(--sd-material-separator);
  list-style: none;
}

.brand-panel__capabilities li {
  display: flex;
  min-width: 0;
  gap: 11px;
  padding: 0 var(--sd-space-4);
  border-left: var(--sd-border-width) solid var(--sd-material-separator-soft);
}

.brand-panel__capabilities li:first-child {
  padding-left: 0;
  border-left: 0;
}

.brand-panel__capabilities li > span {
  display: grid;
  width: 26px;
  height: 26px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: var(--sd-radius-sm);
  color: var(--sd-color-action);
  background: var(--sd-material-brand-chip);
  font-size: var(--sd-font-size-2xs);
  font-weight: var(--sd-font-weight-bold);
}

.brand-panel__capabilities div {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.brand-panel__capabilities strong {
  color: var(--sd-color-text-strong);
  font-size: var(--sd-font-size-sm);
  font-weight: var(--sd-font-weight-strong);
}

.brand-panel__capabilities small {
  overflow: hidden;
  color: var(--sd-color-text-muted);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .brand-panel__edition,
  .facade {
    background: var(--sd-material-brand-chip);
  }
}

@media (max-width: 1120px) {
  .brand-panel {
    padding-right: var(--sd-space-8);
    padding-left: var(--sd-space-8);
  }

  .brand-panel__content {
    display: block;
    padding-top: 46px;
    padding-bottom: 34px;
  }

  .brand-panel h1 {
    font-size: 34px;
  }

  .facade {
    display: none;
  }

  .brand-panel__capabilities {
    grid-template-columns: 1fr;
    gap: var(--sd-space-3);
  }

  .brand-panel__capabilities li,
  .brand-panel__capabilities li:first-child {
    padding: 0;
    border: 0;
  }
}

@media (max-width: 900px) {
  .brand-panel {
    min-height: 238px;
    padding: var(--sd-space-7) var(--sd-space-8);
  }

  .brand-panel::before {
    top: -220px;
    right: -80px;
  }

  .brand-panel__content {
    display: block;
    padding: 30px 0 0;
  }

  .brand-panel h1 {
    font-size: 29px;
    line-height: 1.2;
  }

  .brand-panel__summary,
  .facade,
  .brand-panel__capabilities {
    display: none;
  }
}

@media (max-width: 640px) {
  .brand-panel {
    min-height: 194px;
    padding: var(--sd-space-6);
  }

  .brand-panel__edition {
    display: none;
  }

  .brand-panel__content {
    padding-top: 26px;
  }

  .brand-panel__eyebrow {
    margin-bottom: var(--sd-space-2-5);
  }

  .brand-panel h1 {
    font-size: 26px;
  }
}
</style>
