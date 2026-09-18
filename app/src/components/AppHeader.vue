<template>
  <!--
    全局顶部导航栏。

    ## 为什么只有 4 项

    旧版桌面导航有 12 个位置（线上外壳里 `class:"desktop-icon"` 那一批），但**那些模块本版还没做**
    （扫码生产 / 画门窗 / 进度 / 制作回执单 …），其中 7 个连文案都还是 token（`o(436)` 等，
    解码器在另一个 chunk 里，没解出来）。

    ⇒ **只列本版真有的路由**，标签一律用**能核实到字面量**的那几个：

    | 图标 | 文案 | 核实来源 | 路由 |
    |---|---|---|---|
    | 📋 | 订单管理 | 线上外壳**字面量**（移动 Tab 那套） | `/` |
    | 🧮 | 汇算下单 | **本版新增**（旧版从 Home 里的按钮进） | `/hui` |
    | ➗ | 公式 | 线上外壳**字面量**（桌面那套） | `/formulas` |
    | 👥 | 客户信息 | 线上外壳**字面量**（桌面那套） | `/clients` |

    ⚠️ **不摆置灰的占位项**：文案解不出、模块也没做，摆上去只是噪音。
       等那些模块做的时候，按 `docs/2026-09-19-legacy-nav.md` 里记的三套导航清单补。

    ## 为什么需要它（2026-09-19 用户提）

    新版把入口都放在 Home（「汇算下单」→ `/hui`），而 Hui 里**没有任何回头的路**，进去就出不来。
    旧版靠这条导航栏做页面间跳转。

    ⚠️ 这里**不放「退出登录」**：`Home.vue` 自己工具条上已经有一颗，会重复。
  -->
  <header class="app-header">
    <nav class="nav">
      <template v-for="it in items" :key="it.label">
        <RouterLink
          :to="it.to"
          class="nav-item"
          :class="{ 'is-active': isActive(it) }"
        >
          <span class="ico">{{ it.icon }}</span>{{ it.label }}
        </RouterLink>
      </template>
    </nav>

    <span class="grow" />

    <span v-if="auth.tenant || auth.user" class="who">
      {{ auth.tenant?.name || '' }}<template v-if="auth.user?.name"> · {{ auth.user.name }}</template>
    </span>
  </header>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const route = useRoute()
const auth = useAuthStore()

/** 导航项 —— **只放本版真有的路由**（见文件头的表）。 */
const items = [
  { icon: '📋', label: '订单管理', to: { name: 'home' } as const },
  { icon: '🧮', label: '汇算下单', to: { name: 'hui' } as const },
  { icon: '➗', label: '公式', to: { name: 'formulas' } as const },
  { icon: '👥', label: '客户信息', to: { name: 'clients' } as const },
]

function isActive(it: { to: unknown }) {
  const name = (it.to as { name?: string } | null)?.name
  return !!name && route.name === name
}

</script>

<style scoped>
.app-header {
  /* ⚠️ **固定高度**：Home / Hui 都是 `100vh` 布局，顶栏一进来就会把它们顶出去。
     那两个页面用 `calc(100vh - var(--app-header-h))` 减掉它（见 .home-container / .page）。 */
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
.nav {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.nav-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 12px;
  border-radius: 4px;
  font-size: 14px;
  color: #606266;
  text-decoration: none;
}
.ico {
  font-size: 15px;
  line-height: 1;
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
