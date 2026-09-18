<template>
  <!--
    全局顶部导航栏 —— 照旧版的应用外壳。

    ## 依据

    `legacy/DESIGN-DOC.md` §5「应用外壳（布局与导航）」：
      · 桌面 `≥768px`：**顶部导航栏（高约 60px）**，顶部横向菜单
      · 移动 `<768px`：底部导航栏（高约 65px）—— ⚠️ **本版未做**（见文末）

    §5.2 从入口 bundle 提取的主导航是：**生产 / 生产进度 / 画门窗 / 菜单 / 通知**。
    本版只实现了其中两条路由，所以只出「生产」+「菜单」下拉：
      · 生产   → `/home`（订单生产总表）
      · 菜单   → 下拉，装本版**已实现**的其余入口（汇算下单 / 公式库 / 客户）

    ⚠️ **未实现、故未出现在导航里**（旧版有）：生产进度 `/Progress`、画门窗 `/drawDoor`、
       通知（`syncNoticeBoard`）、3D / 扫码 / 终端 / 设置。
       别把它们做成点了没反应的死链 —— 等实现了再加。

    ## 为什么需要它（2026-09-19 用户提）

    新版把入口都放在 Home（「汇算下单」→ `/hui`），而 Hui 里**没有任何回头的路**
    （连 `useRouter` 都没用），进去就出不来。旧版靠这条导航栏做页面间跳转。

    ⚠️ 这里**不放「退出登录」**：Home 自己工具条上已经有一颗（`Home.vue:52`），会重复。
  -->
  <header class="app-header">
    <div class="brand">开门红</div>

    <nav class="nav">
      <RouterLink
        v-for="it in tabs"
        :key="it.name"
        :to="{ name: it.name }"
        class="nav-item"
        :class="{ 'is-active': route.name === it.name }"
      >
        {{ it.label }}
      </RouterLink>

      <!-- 旧版第 4 项就是「菜单」：更多功能入口都收在它下面 -->
      <n-dropdown trigger="click" :options="moreOptions" @select="onMore">
        <span class="nav-item nav-more">菜单 ▾</span>
      </n-dropdown>
    </nav>

    <span class="grow" />

    <span v-if="auth.tenant || auth.user" class="who">
      {{ auth.tenant?.name || '' }}<template v-if="auth.user?.name"> · {{ auth.user.name }}</template>
    </span>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { NDropdown } from 'naive-ui'
import { useAuthStore } from '../stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

/** 顶部横向菜单（旧版第一项「生产」+ 本版的同级入口）。 */
const tabs = computed(() => [
  { name: 'home', label: '生产' },
  { name: 'hui', label: '汇算下单' },
])

/** 「菜单」下拉 —— 只放**已经存在**的路由（死链不如不放）。 */
const moreOptions = [
  { label: '公式库', key: 'formulas' },
  { label: '客户', key: 'clients' },
]

function onMore(key: string) {
  void router.push({ name: key })
}
</script>

<style scoped>
.app-header {
  /* ⚠️ **固定高度**：Home / Hui 都是 `100vh` 布局，顶栏一进来就会把它们顶出去。
     那两个页面用 `calc(100vh - var(--app-header-h))` 减掉它（见 .home-container / .page）。
     高度取设计文档 §5.1 的「桌面约 60px」。 */
  height: var(--app-header-h);
  box-sizing: border-box;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 16px;
  padding: 6px 16px;
  background: #fff;
  border-bottom: 1px solid #ebeef5;
}
.brand {
  font-size: 17px;
  font-weight: 700;
  color: #1a7f3c;
  letter-spacing: 1px;
}
.nav {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.nav-item {
  padding: 5px 14px;
  border-radius: 4px;
  font-size: 14px;
  color: #606266;
  text-decoration: none;
  cursor: pointer;
}
.nav-item:hover {
  background: #f0f9eb;
  color: #1a7f3c;
}
.nav-item.is-active {
  background: #1a7f3c;
  color: #fff;
}
.grow {
  flex: 1;
}
.who {
  font-size: 12px;
  color: #909399;
}
</style>
