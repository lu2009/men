<template>
  <!--
    ⚠️ `:locale` / `:date-locale` **必须给**。naive 的默认 locale 是 **enUS**，
    不给的话组件内置文案会回退成英文 —— 最典型的是 `n-input-number`：
    它会把 locale 的 `InputNumber.placeholder` 当默认 placeholder
    （`naive-ui/es/input-number/src/InputNumber.mjs:149`），
    英文包写的是 **"Please Input"**（`locales/common/enUS.mjs:95`），
    中文包才是「请输入」。财务面板里一堆金额框都吃这个。
  -->
  <n-config-provider
    :theme-overrides="themeOverrides"
    :locale="zhCN"
    :date-locale="dateZhCN"
  >
    <n-dialog-provider>
      <n-message-provider>
        <!-- 全局标题栏：登录后的页面才有（登录页/电子回执分享页不加）。
             ⚠️ 这是**新增**不是复刻 —— 旧版没有全局导航，见 AppHeader.vue 的注释。 -->
        <AppHeader v-if="showHeader" />
        <router-view />
      </n-message-provider>
    </n-dialog-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { dateZhCN, zhCN, type GlobalThemeOverrides } from 'naive-ui'
import AppHeader from './components/AppHeader.vue'

const route = useRoute()
/**
 * 挂标题栏的页面 —— **白名单**，不是「所有 requiresAuth」。
 *
 * ⚠️ 电子回执单预览（`receipt-view`）也带 `requiresAuth`，但那是给客户看的独立页面，
 *    顶个后台导航栏不合适；登录页 / 无认证分享页本来就没有。
 */
const HEADER_ROUTES = new Set(['home', 'hui', 'formulas', 'clients'])
const showHeader = computed(() => HEADER_ROUTES.has(String(route.name ?? '')))

// 主色沿用**旧版**的 #409eff（新版不用旧版那个名字）。
const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#409eff',
    primaryColorHover: '#66b1ff',
    primaryColorPressed: '#337ecc',
    primaryColorSuppl: '#66b1ff',
  },
}
</script>

<style>
/* 全局标题栏高度 —— 页面里的 `calc(100vh - var(--app-header-h))` 靠它。
   ⚠️ scoped 样式设不了 :root，所以放在这里（无 scoped）。 */
:root {
  --app-header-h: 60px;
}
</style>
