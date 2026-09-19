<template>
  <!--
    全局顶部导航栏。

    ## 为什么只有这几项

    旧版桌面导航有 12 个位置（线上外壳里 `class:"desktop-icon"` 那一批），但**那些模块本版还没做**
    （画门窗 / 制作回执单 …），其中 7 个连文案都还是 token（`o(436)` 等，
    解码器在另一个 chunk 里，没解出来）。

    ⇒ **只列本版真有的路由**，标签一律用**能核实到字面量**的那几个：

    | 图标 | 文案 | 核实来源 | 路由 |
    |---|---|---|---|
    | 📋 | 订单管理 | 线上外壳**字面量**（移动 Tab 那套） | `/` |
    | 🧮 | 汇算下单 | **本版新增**（旧版从 Home 里的按钮进） | `/hui` |
    | ⏳ | 生产进度 | 线上外壳**字面量** | `/progress` |
    | 📱 | 扫码生产 | 线上外壳**字面量**（`o(396)`，`docs/2026-09-19-legacy-nav.md`） | `/qrscanner` |
    | ➗ | 公式 | 线上外壳**字面量**（桌面那套） | `/formulas` |
    | 👥 | 客户信息 | 线上外壳**字面量**（桌面那套） | `/clients` |

    ⚠️ **不摆置灰的占位项**：文案解不出、模块也没做，摆上去只是噪音。
       等那些模块做的时候，按 `docs/2026-09-19-legacy-nav.md` 里记的三套导航清单补。

    ⚠️ `/qrscanner` 这一项曾经只是「放它是为了让工序名配得上」（Progress 的「更新进度」下拉
       靠它写 `procedure_name_*` 两个键）；那页现在已整页补齐，见 `Qrscanner.vue` 文件头。

    ## 谁看得见哪几项（2026-09-19 补）

    不是所有人都该看见全部六项。**按账号角色过滤**，用的是 `utils/roles.ts` 里那张
    **和路由拦截共用**的受限表 —— 所以「这儿看不见」与「敲 URL 也进不去」永远一致。

    | 角色 | 看得见的项 |
    |---|---|
    | `scanner`（扫码账号，旧版 `defaulted=2`） | **只有「📱 扫码生产」** |
    | 其余（`admin` / `staff` / …） | 全部六项（**与加这套门控之前一模一样**） |

    依据见 `docs/2026-09-19-legacy-nav.md` 的「新版映射」一节。

    ## 为什么需要它（2026-09-19 用户提）

    新版把入口都放在 Home（「汇算下单」→ `/hui`），而 Hui 里**没有任何回头的路**，进去就出不来。
    旧版靠这条导航栏做页面间跳转。

    ⚠️ 平时这里**不放「退出登录」**：`Home.vue` 自己工具条上已经有一颗，会重复。
       只有**到不了 Home 的账号**（扫码账号）才补一颗 —— 否则它没地方退出。
  -->
  <header class="app-header">
    <nav class="nav">
      <template v-for="it in visibleItems" :key="it.label">
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

    <!-- 退出登录：**只在到不了「订单管理」的账号上补一颗**。
         平时不摆 —— `Home.vue` 工具条上本来就有一颗，摆上去是重复的。
         但扫码账号进不去 Home（`utils/roles.ts` 的受限表），顶栏再不给就**没地方退出了**。 -->
    <n-button v-if="needsOwnLogout" class="logout" size="small" quaternary @click="onLogout">
      退出登录
    </n-button>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { canAccessRoute } from '../utils/roles'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

/** 导航项 —— **只放本版真有的路由**（见文件头的表）。 */
const items = [
  { icon: '📋', label: '订单管理', to: { name: 'home' } as const },
  { icon: '🧮', label: '汇算下单', to: { name: 'hui' } as const },
  { icon: '⏳', label: '生产进度', to: { name: 'progress' } as const },
  { icon: '📱', label: '扫码生产', to: { name: 'qrscanner' } as const },
  { icon: '➗', label: '公式', to: { name: 'formulas' } as const },
  { icon: '👥', label: '客户信息', to: { name: 'clients' } as const },
]

/**
 * 按**角色**过滤后的导航项。
 *
 * ⚠️ 过滤用的是 `utils/roles.ts` 那张**和路由拦截同一张**的表 —— 两边不会各写一份。
 *    这意味着「导航里看不见」与「敲 URL 也进不去」永远一致：**不会再出现
 *    『藏了菜单但直接敲地址栏还进得去』**那种假门控。
 *
 * ⚠️ 同样地：**藏起来不是授权**。真正的授权在后端，见 `utils/roles.ts` 抬头。
 */
const visibleItems = computed(() =>
  items.filter((it) => canAccessRoute(auth.user?.role, it.to.name)),
)

/** 当前账号到不了「订单管理」⇒ 顶栏得自己带一颗退出登录（Home 那颗够不着）。 */
const needsOwnLogout = computed(() => !canAccessRoute(auth.user?.role, 'home'))

function isActive(it: { to: unknown }) {
  const name = (it.to as { name?: string } | null)?.name
  return !!name && route.name === name
}

async function onLogout() {
  await auth.logout()
  router.push({ name: 'login' })
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
.logout {
  /* 顶栏是 flex 行（`flex-wrap: wrap` + 定高 60px）；`.grow` 已经把名字推到右边，
     按钮只需要不被压缩、且和名字之间留一点缝。 */
  flex: none;
  margin-left: 4px;
}
</style>
