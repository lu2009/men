<template>
  <!--
    全局顶部导航栏 —— 照**线上**旧版的应用外壳。

    ## 依据（不是 DESIGN-DOC.md，那份已过时）

    直接从线上取：`https://www.19901110.xyz:16666/` → 入口 `/js/index-f9710780.js`
    （**注意：本地下载的那份是 `index-c3b16e3f.js`，与线上不是同一个** —— 包更新过）。
    该外壳没混淆，桌面导航项是 `class:"desktop-icon"` 的那一批，按 bundle 顺序取出来是：

    | 图标 | 文案 | 本版 |
    |---|---|---|
    | ➗ | 公式 | ⇒ `/formulas`（已实现） |
    | 📋 | **生产**（文案是 `o(443)`，见下） | ⇒ `/`（订单生产总表） |
    | 👥 | 客户信息 | ⇒ `/clients`（已实现） |
    | 📱 | 扫码生产 | **未实现** |
    | ✏️ | 画门窗 | **未实现** |
    | 🔄 | **进度**（文案是 `o(372)`，见下） | **未实现** |

    ⚠️ **两个文案是推断的**：`📋` 与 `🔄` 两项的 label 在 bundle 里是 `o(443)` / `o(372)`，
    而那个解码器 `o` 定义在**另一个 chunk** 里（外壳自身没有字符串数组），没解出来。
    推断依据：外壳里的中文字面量只有「生产 / 进度 / 订单管理 / 参数设定 …」这几个还没安置，
    按图标配（📋→生产、🔄→进度）。**要较真得再解一次 `o`。**
    其余四项（公式 / 客户信息 / 扫码生产 / 画门窗）是**字面量**，确凿。

    ## 未实现的项

    不删、不藏 —— 按旧版原样列出来，但**置灰并标「本版未实现」**，点了给提示。
    理由：死链（点了没反应）比置灰更糟；而直接不显示会让人以为旧版没有。

    ## 本项目自己的入口

    「汇算下单」(`/hui`) 是**本版新增**的入口（旧版从 Home 里的按钮进），也列在这里，
    否则进 Hui 之后又是没有回头路 —— 这正是加这条导航栏的原因。
  -->
  <header class="app-header">
    <nav class="nav">
      <template v-for="it in items" :key="it.label">
        <RouterLink
          v-if="it.to"
          :to="it.to"
          class="nav-item"
          :class="{ 'is-active': isActive(it) }"
        >
          <span class="ico">{{ it.icon }}</span>{{ it.label }}
        </RouterLink>
        <span v-else class="nav-item is-todo" :title="'旧版有、本版未实现'" @click="onTodo(it.label)">
          <span class="ico">{{ it.icon }}</span>{{ it.label }}
        </span>
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
import { useMessage } from 'naive-ui'
import { useAuthStore } from '../stores/auth'

const route = useRoute()
const auth = useAuthStore()
const message = useMessage()

/**
 * 桌面导航项 —— **顺序照线上 bundle 里 `desktop-icon` 的出现顺序**。
 * `to` 缺省 = 旧版有、本版未实现（置灰）。
 */
const items = [
  { icon: '➗', label: '公式', to: { name: 'formulas' } as const },
  { icon: '📋', label: '生产', to: { name: 'home' } as const },
  { icon: '👥', label: '客户信息', to: { name: 'clients' } as const },
  { icon: '📱', label: '扫码生产', to: null },
  { icon: '✏️', label: '画门窗', to: null },
  { icon: '🔄', label: '进度', to: null },
  // ⚠️ 本版新增（旧版从 Home 里的按钮进）—— 不放它的话进 Hui 就没回头路了。
  { icon: '🧮', label: '汇算下单', to: { name: 'hui' } as const },
]

function isActive(it: { to: unknown }) {
  const name = (it.to as { name?: string } | null)?.name
  return !!name && route.name === name
}

function onTodo(label: string) {
  message.info(`「${label}」旧版有，本版还没做`)
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
/* 旧版有、本版未实现：置灰但仍可点（点了给提示，不是死链） */
.nav-item.is-todo {
  color: #c0c4cc;
  cursor: pointer;
}
.nav-item.is-todo:hover {
  background: #fafafa;
  color: #909399;
}
.grow {
  flex: 1;
}
.who {
  font-size: 12px;
  color: #909399;
}
</style>
