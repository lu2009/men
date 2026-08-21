<template>
  <n-config-provider :theme-overrides="themeOverrides">
    <n-message-provider>
      <router-view />
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import type { GlobalThemeOverrides } from 'naive-ui'

// 品牌主色沿用「开门红」的 #409eff。
const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#409eff',
    primaryColorHover: '#66b1ff',
    primaryColorPressed: '#337ecc',
    primaryColorSuppl: '#66b1ff',
  },
}
</script>
