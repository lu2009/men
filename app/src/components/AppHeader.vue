<template>
  <header class="app-header" :class="{ 'is-restricted': needsOwnLogout }">
    <div class="app-header__brand" aria-label="SmartDoor 智能门窗工作台">
      <span class="app-header__brand-mark" aria-hidden="true">
        <svg viewBox="0 0 28 28" fill="none">
          <path d="M6.5 23V5.5h15V23" />
          <path d="M10 23V9h8v14M14 9v14" />
          <circle cx="16.2" cy="16" r=".8" />
        </svg>
      </span>
      <span class="app-header__brand-copy">
        <strong>SMARTDOOR</strong>
        <small>智能门窗工作台</small>
      </span>
    </div>

    <div class="app-header__nav-viewport">
      <nav class="app-header__nav" aria-label="主导航">
        <RouterLink
          v-for="it in visibleItems"
          :key="it.to.name"
          :to="it.to"
          class="app-header__nav-item"
          :class="{ 'is-active': isActive(it) }"
          :aria-current="isActive(it) ? 'page' : undefined"
          :aria-label="it.label"
          :title="it.description"
        >
          <span class="app-header__nav-icon" aria-hidden="true">
            <span class="app-header__nav-glyph">
              <AppNavIcon :name="it.icon" />
            </span>
          </span>
          <span class="app-header__nav-label">{{ it.label }}</span>
        </RouterLink>
      </nav>
    </div>

    <div class="app-header__account">
      <div
        v-if="auth.tenant || auth.user"
        class="app-header__identity"
        :title="`${auth.tenant?.name || ''}${auth.user?.name ? ` · ${auth.user.name}` : ''}`"
      >
        <span class="app-header__avatar" aria-hidden="true">{{ userInitial }}</span>
        <span class="app-header__identity-copy">
          <strong>{{ auth.tenant?.name || '当前企业' }}</strong>
          <small>{{ auth.user?.name || '已登录' }}</small>
        </span>
      </div>

      <!-- 扫码账号无法进入 Home，因此仍由全局导航提供退出入口。 -->
      <n-button
        v-if="needsOwnLogout"
        class="app-header__logout"
        size="small"
        quaternary
        @click="onLogout"
      >
        <template #icon>
          <AppNavIcon name="logout" />
        </template>
        退出登录
      </n-button>

      <button
        v-if="needsOwnLogout"
        class="app-header__mobile-logout"
        type="button"
        aria-label="退出登录"
        @click="onLogout"
      >
        <span class="app-header__mobile-logout-icon" aria-hidden="true">
          <AppNavIcon name="logout" />
        </span>
        <span class="app-header__mobile-logout-label">退出</span>
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { canAccessRoute } from '../utils/roles'
import AppNavIcon from './AppNavIcon.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

/** 仅展示已经实现的业务入口；图标统一使用同一套 24px 线性符号。 */
const items = [
  { icon: 'orders', label: '订单管理', description: '查询、编辑与跟进订单', to: { name: 'home' } as const },
  { icon: 'quote', label: '汇算下单', description: '核算门窗配置并创建订单', to: { name: 'hui' } as const },
  { icon: 'progress', label: '生产进度', description: '跟踪工序与交付状态', to: { name: 'progress' } as const },
  { icon: 'scanner', label: '扫码生产', description: '扫码录入与更新生产工序', to: { name: 'qrscanner' } as const },
  { icon: 'formula', label: '公式', description: '维护产品计算公式', to: { name: 'formulas' } as const },
  { icon: 'clients', label: '客户信息', description: '维护客户与物流资料', to: { name: 'clients' } as const },
] satisfies Array<{
  icon: 'orders' | 'quote' | 'progress' | 'scanner' | 'formula' | 'clients'
  label: string
  description: string
  to: { name: string }
}>

/** 导航显隐继续与路由守卫共用同一套角色规则。 */
const visibleItems = computed(() =>
  items.filter((it) => canAccessRoute(auth.user?.role, it.to.name)),
)

/** 当前账号到不了订单管理页时，由顶栏提供独立退出入口。 */
const needsOwnLogout = computed(() => !canAccessRoute(auth.user?.role, 'home'))

const userInitial = computed(() => {
  const source = auth.user?.name?.trim() || auth.tenant?.name?.trim() || 'S'
  return source.slice(0, 1).toUpperCase()
})

function isActive(it: { to: { name: string } }) {
  return route.name === it.to.name
}

async function onLogout() {
  await auth.logout()
  router.push({ name: 'login' })
}
</script>

<style scoped>
.app-header {
  position: sticky;
  z-index: 100;
  top: 0;
  height: var(--app-header-h);
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: var(--sd-space-4);
  padding: var(--sd-space-2) var(--sd-space-5);
  border-bottom: var(--sd-border-width) solid var(--sd-border-glass-divider);
  background: var(--sd-material-surface);
  box-shadow: var(--sd-shadow-sm);
  backdrop-filter: blur(var(--sd-glass-blur-md)) saturate(var(--sd-glass-saturation));
  -webkit-backdrop-filter: blur(var(--sd-glass-blur-md)) saturate(var(--sd-glass-saturation));
}

.app-header::after {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: var(--sd-border-width);
  background: var(--sd-material-highlight-faint);
  content: '';
  pointer-events: none;
}

.app-header__brand {
  display: flex;
  align-items: center;
  flex: 0 0 auto;
  gap: var(--sd-space-2-5);
}

.app-header__brand-mark {
  width: var(--sd-control-height-large);
  height: var(--sd-control-height-large);
  box-sizing: border-box;
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  border: var(--sd-border-width) solid var(--sd-border-action-faint);
  border-radius: var(--sd-radius-control);
  color: var(--sd-color-action);
  background: var(--sd-material-brand-chip);
  box-shadow: var(--sd-shadow-brand-mark);
}

.app-header__brand-mark svg {
  width: 25px;
  height: 25px;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.65;
}

.app-header__brand-copy {
  display: grid;
  min-width: 0;
  line-height: 1.1;
}

.app-header__brand-copy strong {
  color: var(--sd-color-text-strong);
  font-size: var(--sd-font-size-sm);
  font-weight: var(--sd-font-weight-bold);
  letter-spacing: 0.055em;
}

.app-header__brand-copy small {
  margin-top: var(--sd-space-1);
  color: var(--sd-color-text-muted);
  font-size: var(--sd-font-size-2xs);
  font-weight: var(--sd-font-weight-medium);
}

.app-header__nav-viewport {
  min-width: 0;
  flex: 1 1 auto;
  overflow-x: auto;
  scrollbar-width: none;
}

.app-header__nav-viewport::-webkit-scrollbar {
  display: none;
}

.app-header__nav {
  width: max-content;
  min-width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--sd-space-1);
}

.app-header__nav-item {
  position: relative;
  height: var(--sd-control-height-large);
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  gap: var(--sd-space-2);
  padding: 0 var(--sd-space-3);
  border: var(--sd-border-width) solid transparent;
  border-radius: var(--sd-radius-control);
  color: var(--sd-color-text);
  font-size: var(--sd-font-size-sm);
  font-weight: var(--sd-font-weight-medium);
  text-decoration: none;
  transition:
    color var(--sd-duration-fast) var(--sd-ease-standard),
    background-color var(--sd-duration-fast) var(--sd-ease-standard),
    border-color var(--sd-duration-fast) var(--sd-ease-standard),
    box-shadow var(--sd-duration-fast) var(--sd-ease-standard),
    transform var(--sd-duration-fast) var(--sd-ease-standard);
}

.app-header__nav-icon {
  width: 19px;
  height: 19px;
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  color: var(--sd-color-text-muted);
  transition: color var(--sd-duration-fast) var(--sd-ease-standard);
}

.app-header__nav-item:hover {
  border-color: var(--sd-border-glass-soft);
  color: var(--sd-color-text-strong);
  background: var(--sd-material-control-hover);
  transform: translateY(var(--sd-motion-hover-y));
}

.app-header__nav-item:hover .app-header__nav-icon {
  color: var(--sd-color-action);
}

.app-header__nav-item:focus-visible {
  outline: none;
  box-shadow: var(--sd-focus-ring);
}

.app-header__nav-item:active {
  transform: scale(var(--sd-motion-press-scale));
}

.app-header__nav-item.is-active {
  border-color: var(--sd-border-action-faint);
  color: var(--sd-color-action);
  background: var(--sd-color-action-soft);
  box-shadow: var(--sd-shadow-sm);
  font-weight: var(--sd-font-weight-strong);
}

.app-header__nav-item.is-active::after {
  position: absolute;
  right: var(--sd-space-3);
  bottom: calc(var(--sd-space-1) * -1);
  left: var(--sd-space-3);
  height: 2px;
  border-radius: var(--sd-radius-pill);
  background: var(--sd-color-action);
  content: '';
}

.app-header__nav-item.is-active .app-header__nav-icon {
  color: var(--sd-color-action);
}

.app-header__account {
  display: flex;
  align-items: center;
  flex: 0 0 auto;
  gap: var(--sd-space-2);
}

.app-header__identity {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--sd-space-2);
  padding-left: var(--sd-space-3);
  border-left: var(--sd-border-width) solid var(--sd-material-separator-soft);
}

.app-header__avatar {
  width: var(--sd-control-height-medium);
  height: var(--sd-control-height-medium);
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  border: var(--sd-border-width) solid var(--sd-border-glass-strong);
  border-radius: var(--sd-radius-pill);
  color: var(--sd-color-action);
  background: var(--sd-material-brand-chip);
  font-size: var(--sd-font-size-xs);
  font-weight: var(--sd-font-weight-bold);
  box-shadow: var(--sd-shadow-sm);
}

.app-header__identity-copy {
  max-width: 132px;
  display: grid;
  line-height: 1.15;
}

.app-header__identity-copy strong,
.app-header__identity-copy small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-header__identity-copy strong {
  color: var(--sd-color-text-strong);
  font-size: var(--sd-font-size-xs);
  font-weight: var(--sd-font-weight-strong);
}

.app-header__identity-copy small {
  margin-top: var(--sd-space-1);
  color: var(--sd-color-text-muted);
  font-size: var(--sd-font-size-2xs);
}

.app-header__logout {
  flex: 0 0 auto;
}

.app-header__logout :deep(.n-button__icon) {
  width: 17px;
  height: 17px;
}

.app-header__mobile-logout {
  display: none;
}

@media (max-width: 1180px) {
  .app-header {
    gap: var(--sd-space-2);
    padding-right: var(--sd-space-3);
    padding-left: var(--sd-space-3);
  }

  .app-header__brand-copy small,
  .app-header__identity-copy {
    display: none;
  }

  .app-header__identity {
    padding-left: var(--sd-space-2);
  }
}

@media (max-width: 820px) {
  .app-header__brand-copy {
    display: none;
  }

  .app-header__nav {
    justify-content: flex-start;
  }

  .app-header__nav-item {
    gap: var(--sd-space-1-5);
    padding: 0 var(--sd-space-2-5);
  }

  .app-header__identity {
    display: none;
  }
}

@media (max-width: 720px) {
  .app-header {
    position: fixed;
    z-index: 300;
    top: auto;
    right: var(--sd-shell-mobile-dock-gutter);
    bottom: calc(var(--sd-shell-mobile-dock-offset) + env(safe-area-inset-bottom, 0px));
    left: var(--sd-shell-mobile-dock-gutter);
    width: auto;
    max-width: var(--sd-shell-mobile-dock-max-width);
    height: var(--sd-shell-mobile-dock-height);
    margin-inline: auto;
    gap: 0;
    padding: var(--sd-space-1-5);
    border: var(--sd-border-width) solid var(--sd-border-glass-strong);
    border-radius: var(--sd-radius-pill);
    background: var(--sd-material-surface-strong);
    box-shadow: var(--sd-shadow-material-card);
    transform: none;
    animation: app-header-dock-enter var(--sd-duration-enter) var(--sd-ease-enter) both;
    isolation: isolate;
  }

  .app-header::before {
    position: absolute;
    z-index: -1;
    top: var(--sd-border-width);
    right: var(--sd-space-5);
    left: var(--sd-space-5);
    height: 44%;
    border-radius: var(--sd-radius-pill);
    background: linear-gradient(
      180deg,
      var(--sd-material-highlight-soft),
      transparent
    );
    content: '';
    opacity: 0.68;
    pointer-events: none;
  }

  .app-header::after {
    top: var(--sd-border-width);
    right: var(--sd-space-6);
    bottom: auto;
    left: var(--sd-space-6);
    height: var(--sd-border-width);
    border-radius: var(--sd-radius-pill);
    background: var(--sd-material-highlight-strong);
    opacity: 0.86;
  }

  .app-header.is-restricted {
    max-width: var(--sd-shell-mobile-dock-compact-width);
  }

  .app-header__brand,
  .app-header__identity,
  .app-header__logout {
    display: none;
  }

  .app-header__nav-viewport {
    height: 100%;
    overflow: visible;
  }

  .app-header__nav {
    width: 100%;
    min-width: 0;
    height: 100%;
    justify-content: stretch;
    gap: var(--sd-space-0);
  }

  .app-header__nav-item {
    min-width: 0;
    height: 100%;
    justify-content: center;
    flex: 1 1 0;
    gap: 0;
    padding: 0;
    border-color: transparent;
    border-radius: var(--sd-radius-pill);
    color: var(--sd-color-text-muted);
    background: transparent;
    box-shadow: none;
    overflow: visible;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
    transition:
      color var(--sd-duration-base) var(--sd-ease-standard),
      filter var(--sd-duration-slow) var(--sd-ease-standard),
      transform var(--sd-duration-fast) var(--sd-ease-standard);
  }

  .app-header__nav-item:hover {
    border-color: transparent;
    color: var(--sd-color-text-muted);
    background: transparent;
    transform: none;
  }

  .app-header__nav-item:focus-visible {
    outline: none;
    box-shadow: var(--sd-focus-ring);
  }

  .app-header__nav-item.is-active,
  .app-header__nav-item.is-active:hover {
    border-color: transparent;
    color: var(--sd-color-action);
    background: transparent;
    box-shadow: none;
  }

  .app-header__nav-item.is-active::after {
    display: none;
  }

  .app-header__nav-icon {
    position: relative;
    width: var(--sd-shell-mobile-nav-icon-size);
    height: var(--sd-shell-mobile-nav-icon-size);
    display: grid;
    color: currentColor;
    filter: saturate(0.32);
    transform: translateY(0);
    transition:
      color var(--sd-duration-base) var(--sd-ease-standard),
      filter var(--sd-duration-slow) var(--sd-ease-standard),
      transform var(--sd-duration-slow) var(--sd-ease-enter);
  }

  .app-header__nav-icon::before,
  .app-header__mobile-logout-icon::before {
    position: absolute;
    inset: var(--sd-space-1);
    border: var(--sd-border-width) solid var(--sd-border-glass-soft);
    border-radius: var(--sd-radius-control);
    background: var(--sd-material-control);
    box-shadow:
      inset 0 1px 0 var(--sd-material-highlight),
      var(--sd-shadow-sm);
    content: '';
    transform: translateY(0) scale(1);
    transform-origin: center;
    transition:
      border-color var(--sd-duration-base) var(--sd-ease-standard),
      background-color var(--sd-duration-base) var(--sd-ease-standard),
      box-shadow var(--sd-duration-base) var(--sd-ease-standard),
      transform var(--sd-duration-fast) var(--sd-ease-standard);
  }

  .app-header__nav-icon::after,
  .app-header__mobile-logout-icon::after {
    position: absolute;
    z-index: 1;
    top: 9px;
    left: 12px;
    width: 12px;
    height: 4px;
    border-top: var(--sd-border-width) solid var(--sd-material-highlight-strong);
    border-radius: var(--sd-radius-pill);
    content: '';
    opacity: 0.92;
    pointer-events: none;
    transform: rotate(-8deg);
  }

  .app-header__nav-glyph,
  .app-header__mobile-logout-icon > .app-nav-icon {
    position: relative;
    z-index: 2;
    width: 20px;
    height: 20px;
    display: grid;
    place-items: center;
    transform: translateY(0) scale(1);
    transform-origin: center;
    transition:
      color var(--sd-duration-base) var(--sd-ease-standard),
      transform var(--sd-duration-slow) var(--sd-ease-enter);
  }

  .app-header__nav-item:hover .app-header__nav-icon {
    color: currentColor;
  }

  .app-header__nav-item.is-active .app-header__nav-icon {
    color: var(--sd-color-action);
    filter: saturate(1);
    transform: translateY(-1px);
  }

  .app-header__nav-item.is-active .app-header__nav-icon::before {
    border-color: var(--sd-border-action-subtle);
    background: var(--sd-color-action-soft);
    box-shadow:
      inset 0 1px 0 var(--sd-material-highlight-strong),
      var(--sd-shadow-action);
    transform: translateY(-1px) scale(1.02);
  }

  .app-header__nav-item.is-active .app-header__nav-glyph {
    transform: translateY(-1px) scale(1.04);
  }

  .app-header__nav-item:active .app-header__nav-icon::before,
  .app-header__mobile-logout:active .app-header__mobile-logout-icon::before {
    box-shadow: inset 0 1px 0 var(--sd-material-highlight-soft);
    transform: translateY(1px) scale(0.94);
  }

  .app-header__nav-item:active .app-header__nav-glyph,
  .app-header__mobile-logout:active .app-header__mobile-logout-icon > .app-nav-icon {
    transform: translateY(1px) scale(0.9);
  }

  .app-header__nav-label,
  .app-header__mobile-logout-label {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    clip-path: inset(50%);
    white-space: nowrap;
    border: 0;
  }

  .app-header__account {
    display: none;
  }

  .app-header.is-restricted .app-header__account {
    height: 100%;
    display: flex;
    flex: 0 0 50%;
    gap: 0;
  }

  .app-header.is-restricted .app-header__nav-viewport {
    flex: 0 0 50%;
  }

  .app-header__mobile-logout {
    width: 100%;
    height: 100%;
    min-width: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: 0;
    border-radius: var(--sd-radius-pill);
    color: var(--sd-color-text-muted);
    background: transparent;
    font: inherit;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }

  .app-header__mobile-logout:focus-visible {
    outline: none;
    box-shadow: var(--sd-focus-ring);
  }

  .app-header__mobile-logout:active {
    color: var(--sd-color-danger);
    background: transparent;
  }

  .app-header__mobile-logout-icon {
    position: relative;
    width: var(--sd-shell-mobile-nav-icon-size);
    height: var(--sd-shell-mobile-nav-icon-size);
    display: grid;
    flex: 0 0 auto;
    place-items: center;
  }

  .app-header__mobile-logout-icon > .app-nav-icon {
    width: 20px;
    height: 20px;
  }
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  @media (max-width: 720px) {
    .app-header {
      background: var(--sd-material-fallback);
    }
  }
}

@keyframes app-header-dock-enter {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .app-header,
  .app-header__nav-item,
  .app-header__nav-icon,
  .app-header__nav-label,
  .app-header__mobile-logout {
    animation: none;
    transition: none;
  }
}
</style>
