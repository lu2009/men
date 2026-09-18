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
        <router-view />
      </n-message-provider>
    </n-dialog-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { dateZhCN, zhCN, type GlobalThemeOverrides } from 'naive-ui'

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
