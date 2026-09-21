<template>
  <n-config-provider
    :theme-overrides="appThemeOverrides"
    :locale="zhCN"
    :date-locale="dateZhCN"
  >
    <n-dialog-provider>
      <n-message-provider>
        <div class="app-shell">
          <a v-if="showHeader" class="app-shell__skip-link" href="#app-main">
            跳至主要内容
          </a>

          <!-- 登录后的业务页面共用全局工作台导航；登录页和回执分享页保持独立。 -->
          <AppHeader v-if="showHeader" />

          <div id="app-main" class="app-shell__content" tabindex="-1">
            <router-view />
          </div>
        </div>
      </n-message-provider>
    </n-dialog-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { dateZhCN, zhCN } from 'naive-ui'
import AppHeader from './components/AppHeader.vue'
import { appThemeOverrides } from './styles/naive-theme'

const route = useRoute()

/** 只有后台业务页面显示全局导航，回执预览与分享页保持沉浸式独立布局。 */
const HEADER_ROUTES = new Set(['home', 'hui', 'progress', 'qrscanner', 'formulas', 'clients'])
const showHeader = computed(() => HEADER_ROUTES.has(String(route.name ?? '')))
</script>

<style>
:root {
  --app-header-h: var(--sd-shell-header-height);
}

.app-shell {
  min-width: 0;
  min-height: 100vh;
  color: var(--sd-color-text);
  background: var(--sd-color-bg-page);
  font-family: var(--sd-font-sans);
}

.app-shell__content {
  min-width: 0;
  outline: none;
}

.app-shell__skip-link {
  position: fixed;
  z-index: 1000;
  top: var(--sd-space-2);
  left: var(--sd-space-3);
  padding: var(--sd-space-2) var(--sd-space-3);
  border: var(--sd-border-width) solid var(--sd-color-action-border);
  border-radius: var(--sd-radius-control);
  color: var(--sd-color-text-on-action);
  background: var(--sd-color-action);
  box-shadow: var(--sd-shadow-action);
  font-size: var(--sd-font-size-sm);
  font-weight: var(--sd-font-weight-strong);
  text-decoration: none;
  transform: translateY(calc(-100% - var(--sd-space-4)));
  transition: transform var(--sd-duration-fast) var(--sd-ease-standard);
}

.app-shell__skip-link:focus {
  transform: translateY(0);
}

@media (prefers-reduced-motion: reduce) {
  .app-shell__skip-link {
    transition: none;
  }
}
</style>
