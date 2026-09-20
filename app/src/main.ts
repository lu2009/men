import { createApp } from 'vue'
import { createPinia } from 'pinia'
import naive from 'naive-ui'
import App from './App.vue'
import router from './router'
import './styles/tokens.css'
import { installDesignTokenVariables } from './styles/design-tokens'

// 颜色 token 的唯一来源是 `design-tokens.ts`（Naive 主题要用同一份字面量）；
// 这里把同名 CSS 变量写到 `:root` 上供业务样式使用。**必须在 mount 之前**，
// 否则首帧渲染时 `var(--sd-color-*)` 还是空的。
installDesignTokenVariables()

const app = createApp(App)

app.use(createPinia())
app.use(naive)
app.use(router)

app.mount('#app')
