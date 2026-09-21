<template>
  <main class="login-page">
    <section class="login-shell" aria-label="智能门窗系统登录">
      <LoginBrandPanel />

      <div class="login-workspace">
        <div class="login-workspace__inner">
          <header class="login-heading">
            <p class="login-heading__eyebrow">SMARTDOOR ID</p>
            <h2>登录工作台</h2>
            <p>使用系统分配的账号进入智能门窗业务系统。</p>
          </header>

          <Transition name="login-alert">
            <n-alert
              v-if="error"
              class="login-error"
              type="error"
              title="登录未完成"
              :show-icon="true"
            >
              {{ error }}
            </n-alert>
          </Transition>

          <n-form
            ref="formRef"
            class="login-form"
            :model="form"
            :rules="rules"
            label-placement="top"
            :show-require-mark="false"
            size="large"
          >
            <n-form-item label="用户名" path="username">
              <n-input
                v-model:value="form.username"
                placeholder="请输入用户名"
                autocomplete="username"
                autofocus
                @keyup.enter="onSubmit"
              >
                <template #prefix>
                  <svg class="field-icon" viewBox="0 0 20 20" aria-hidden="true">
                    <circle cx="10" cy="6.5" r="3.25" />
                    <path d="M4 16c.5-3.1 2.55-4.75 6-4.75S15.5 12.9 16 16" />
                  </svg>
                </template>
              </n-input>
            </n-form-item>

            <n-form-item label="密码" path="password">
              <n-input
                v-model:value="form.password"
                type="password"
                show-password-on="click"
                placeholder="请输入密码"
                autocomplete="current-password"
                @keyup.enter="onSubmit"
              >
                <template #prefix>
                  <svg class="field-icon" viewBox="0 0 20 20" aria-hidden="true">
                    <rect x="4" y="8.25" width="12" height="8.25" rx="1.5" />
                    <path d="M6.75 8.25V6a3.25 3.25 0 0 1 6.5 0v2.25" />
                  </svg>
                </template>
              </n-input>
            </n-form-item>

            <div class="login-form__context">
              <span class="status-dot" aria-hidden="true"></span>
              <span>账号权限由系统管理员统一配置</span>
            </div>

            <n-button
              class="login-submit"
              type="primary"
              block
              size="large"
              :loading="loading"
              :disabled="loading"
              @click="onSubmit"
            >
              登录
            </n-button>
          </n-form>

          <footer class="login-footer">
            <div class="login-footer__rule"></div>
            <p>
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d="M10 2.75 4.5 5v4.25c0 3.65 2.32 6.7 5.5 8 3.18-1.3 5.5-4.35 5.5-8V5L10 2.75Z" />
                <path d="m7.7 9.75 1.55 1.55 3.25-3.4" />
              </svg>
              系统仅供已授权人员使用，请妥善保管账号信息。
            </p>
          </footer>
        </div>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMessage } from 'naive-ui'
import LoginBrandPanel from '../components/login/LoginBrandPanel.vue'
import { useAuthStore } from '../stores/auth'
import { landingRouteName } from '../utils/roles'

const router = useRouter()
const route = useRoute()
const message = useMessage()
const auth = useAuthStore()

const formRef = ref()
const loading = ref(false)
const error = ref('')
const form = reactive({ username: '', password: '' })

const rules = {
  username: { required: true, message: '请输入用户名', trigger: 'blur' },
  password: { required: true, message: '请输入密码', trigger: 'blur' },
}

async function onSubmit() {
  error.value = ''
  try {
    await formRef.value?.validate()
  } catch {
    return
  }

  loading.value = true
  try {
    await auth.login(form.username, form.password)
    message.success('登录成功')
    // 有 `redirect`（被路由守卫从某个页面弹过来的）就先回那儿；
    // 否则按**角色**决定落地页 —— 扫码账号落 `/qrscanner`，其余落 `/`（旧行为）。
    // 见 `utils/roles.ts` 的 `landingRouteName`：落地页就是旧版 `defaulted` 语义里
    // 「不是 1 也不是 3 → `/Qrscanner`」那一条，我们**只取其中的扫码账号**。
    const redirect = (route.query.redirect as string) || ''
    router.push(redirect || { name: landingRouteName(auth.user?.role) })
  } catch (e) {
    error.value = e instanceof Error ? e.message : '登录失败'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  --login-shell-max: 1180px;

  position: fixed;
  inset: 0;
  overflow: auto;
  padding: var(--sd-space-8);
  color: var(--sd-color-text-strong);
  background: var(--sd-color-bg-page);
  font-family: var(--sd-font-sans);
  -webkit-font-smoothing: antialiased;
}

.login-page::before,
.login-page::after {
  position: fixed;
  z-index: -1;
  border-radius: 50%;
  background: var(--sd-material-page-orb-action);
  content: '';
  filter: blur(1px);
}

.login-page::before {
  top: -180px;
  right: -110px;
  width: 420px;
  height: 420px;
}

.login-page::after {
  bottom: -220px;
  left: -140px;
  width: 520px;
  height: 520px;
  background: var(--sd-material-page-orb-sky);
}

.login-shell {
  display: grid;
  width: min(100%, var(--login-shell-max));
  min-height: min(720px, calc(100vh - 64px));
  margin: 0 auto;
  overflow: hidden;
  grid-template-columns: minmax(0, 1.36fr) minmax(440px, 0.9fr);
  border: var(--sd-border-width) solid var(--sd-border-glass-strong);
  border-radius: var(--sd-radius-shell);
  background: var(--sd-material-surface);
  box-shadow: var(--sd-shadow-material-shell);
  backdrop-filter: blur(var(--sd-glass-blur-lg)) saturate(var(--sd-glass-saturation));
  -webkit-backdrop-filter: blur(var(--sd-glass-blur-lg)) saturate(var(--sd-glass-saturation));
  animation: login-shell-in var(--sd-duration-enter) var(--sd-ease-enter) both;
}

.login-workspace {
  display: grid;
  min-width: 0;
  place-items: center;
  padding: 44px 36px;
  border-left: var(--sd-border-width) solid var(--sd-border-glass-divider);
  background: var(--sd-material-surface-subtle);
}

.login-workspace__inner {
  position: relative;
  width: min(100%, 408px);
  padding: 34px 32px 30px;
  box-sizing: border-box;
  border: var(--sd-border-width) solid var(--sd-border-glass-strong);
  border-radius: var(--sd-radius-material);
  background: var(--sd-material-surface-strong);
  box-shadow: var(--sd-shadow-material-card);
  backdrop-filter: blur(var(--sd-glass-blur-lg)) saturate(var(--sd-glass-saturation-strong));
  -webkit-backdrop-filter: blur(var(--sd-glass-blur-lg)) saturate(var(--sd-glass-saturation-strong));
  transition:
    border-color var(--sd-duration-slow) var(--sd-ease-standard),
    box-shadow var(--sd-duration-slow) var(--sd-ease-standard);
}

.login-heading__eyebrow {
  margin: 0 0 var(--sd-space-2-5);
  color: var(--sd-color-action);
  font-size: 11px;
  font-weight: var(--sd-font-weight-bold);
  letter-spacing: 0.11em;
}

.login-heading h2 {
  margin: 0;
  color: var(--sd-color-text-strong);
  font-size: var(--sd-font-size-3xl);
  font-weight: var(--sd-font-weight-bold);
  letter-spacing: -0.045em;
  line-height: 1.16;
}

.login-heading > p:last-child {
  margin: var(--sd-space-3) 0 0;
  color: var(--sd-color-text);
  font-size: var(--sd-font-size-md);
  line-height: 1.65;
}

.login-error {
  margin-top: var(--sd-space-6);
  border: var(--sd-border-width) solid var(--sd-border-danger-subtle);
  border-radius: var(--sd-radius-control);
  background: var(--sd-material-danger);
  backdrop-filter: blur(var(--sd-glass-blur-sm));
  -webkit-backdrop-filter: blur(var(--sd-glass-blur-sm));
}

.login-form {
  margin-top: 30px;
}

.login-form :deep(.n-form-item) {
  margin-bottom: 18px;
}

.login-form :deep(.n-form-item-label) {
  min-height: auto;
  padding: 0 0 var(--sd-space-2);
  color: var(--sd-color-text-strong);
  font-size: var(--sd-font-size-sm);
  font-weight: var(--sd-font-weight-strong);
  line-height: var(--sd-line-height-tight);
}

.login-form :deep(.n-input) {
  --n-color: var(--sd-material-control) !important;
  --n-color-focus: var(--sd-material-control-focus) !important;
  --n-border: var(--sd-border-width) solid transparent !important;
  --n-border-hover: var(--sd-border-width) solid var(--sd-border-action-subtle) !important;
  --n-border-focus: var(--sd-border-width) solid var(--sd-color-action) !important;
  --n-box-shadow-focus: var(--sd-focus-ring-soft) !important;
  --n-placeholder-color: var(--sd-color-text-muted) !important;

  min-height: var(--sd-control-height-prominent);
  border-radius: var(--sd-radius-control);
  transition:
    background-color var(--sd-duration-base) var(--sd-ease-standard),
    border-color var(--sd-duration-base) var(--sd-ease-standard),
    box-shadow var(--sd-duration-base) var(--sd-ease-standard),
    transform var(--sd-duration-base) var(--sd-ease-standard);
}

.login-form :deep(.n-input__input-el) {
  color: var(--sd-color-text-strong);
  font-size: var(--sd-font-size-control);
  caret-color: var(--sd-color-action);
}

.login-form :deep(.n-input__prefix) {
  margin-right: var(--sd-space-2-5);
  color: var(--sd-color-text);
  transition:
    color var(--sd-duration-base) var(--sd-ease-standard),
    transform var(--sd-duration-base) var(--sd-ease-standard);
}

.login-form :deep(.n-input:hover) {
  --n-color: var(--sd-material-control-hover) !important;
}

.login-form :deep(.n-form-item:focus-within .n-input__prefix) {
  color: var(--sd-color-action);
  transform: scale(1.06);
}

.field-icon {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.55;
}

.login-form__context {
  display: flex;
  align-items: center;
  gap: 9px;
  margin: 0 2px 22px;
  color: var(--sd-color-text);
  font-size: var(--sd-font-size-xs);
  line-height: 1.5;
}

.status-dot {
  width: 7px;
  height: 7px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: var(--sd-color-success);
  box-shadow: var(--sd-shadow-status);
  animation: status-breathe var(--sd-duration-ambient) ease-in-out infinite;
}

.login-submit {
  --n-color: var(--sd-color-action) !important;
  --n-color-hover: var(--sd-color-action-hover) !important;
  --n-color-pressed: var(--sd-color-action-pressed) !important;
  --n-color-focus: var(--sd-color-action) !important;
  --n-border: var(--sd-border-width) solid var(--sd-color-action) !important;
  --n-border-hover: var(--sd-border-width) solid var(--sd-color-action-hover) !important;
  --n-border-pressed: var(--sd-border-width) solid var(--sd-color-action-pressed) !important;

  height: var(--sd-control-height-prominent);
  border-radius: var(--sd-radius-control);
  box-shadow: var(--sd-shadow-action);
  font-size: var(--sd-font-size-control);
  font-weight: var(--sd-font-weight-strong);
  letter-spacing: 0.02em;
  transition:
    background-color var(--sd-duration-fast) var(--sd-ease-standard),
    transform var(--sd-duration-fast) var(--sd-ease-standard),
    box-shadow var(--sd-duration-fast) var(--sd-ease-standard);
}

@media (hover: hover) and (pointer: fine) {
  .login-workspace__inner:hover {
    border-color: var(--sd-palette-white);
    box-shadow: var(--sd-shadow-material-card-hover);
  }

  .login-submit:hover {
    transform: translateY(var(--sd-motion-hover-y));
    box-shadow: var(--sd-shadow-action-hover);
  }
}

.login-submit:active {
  transform: scale(var(--sd-motion-press-scale));
  box-shadow: var(--sd-shadow-action-pressed);
}

.login-footer {
  margin-top: 38px;
}

.login-footer__rule {
  height: var(--sd-border-width);
  background: var(--sd-material-separator);
}

.login-footer p {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  margin: var(--sd-space-4) 0 0;
  color: var(--sd-color-text-muted);
  font-size: var(--sd-font-size-xs);
  line-height: var(--sd-line-height-base);
}

.login-footer svg {
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
  margin-top: 1px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.5;
}

.login-alert-enter-active,
.login-alert-leave-active {
  transition:
    opacity var(--sd-duration-base) var(--sd-ease-standard),
    transform var(--sd-duration-base) var(--sd-ease-enter);
}

.login-alert-enter-from,
.login-alert-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.99);
}

@keyframes login-shell-in {
  from {
    opacity: 0;
    transform: translateY(var(--sd-motion-enter-y)) scale(0.992);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes status-breathe {
  0%,
  100% {
    box-shadow: var(--sd-shadow-status-soft);
  }

  50% {
    box-shadow: var(--sd-shadow-status-wide);
  }
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .login-shell,
  .login-workspace__inner {
    background: var(--sd-material-fallback);
  }
}

@media (max-width: 1120px) {
  .login-shell {
    grid-template-columns: minmax(320px, 0.8fr) minmax(390px, 1fr);
  }

  .login-workspace {
    padding: 38px 32px;
  }
}

@media (max-width: 900px) {
  .login-page {
    padding: var(--sd-space-6);
  }

  .login-shell {
    max-width: 680px;
    min-height: calc(100vh - 48px);
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
    border-radius: 26px;
  }

  .login-workspace {
    align-items: start;
    padding: 44px 48px;
    border-top: var(--sd-border-width) solid var(--sd-border-glass);
    border-left: 0;
  }
}

@media (max-width: 640px) {
  .login-page {
    padding: 0;
    background: var(--sd-color-bg-subtle);
  }

  .login-page::before,
  .login-page::after {
    display: none;
  }

  .login-shell {
    min-height: 100vh;
    border: 0;
    border-radius: 0;
    background: var(--sd-color-bg-subtle);
    box-shadow: none;
    backdrop-filter: none;
  }

  .login-workspace {
    padding: 28px 20px 32px;
    background: var(--sd-color-bg-subtle);
  }

  .login-workspace__inner {
    padding: 30px 24px 26px;
    border-radius: 22px;
  }

  .login-heading h2 {
    font-size: 30px;
  }

  .login-form {
    margin-top: 26px;
  }

  .login-footer {
    margin-top: 32px;
  }
}

@media (max-height: 720px) and (min-width: 901px) {
  .login-page {
    padding-top: 20px;
    padding-bottom: 20px;
  }

  .login-shell {
    min-height: calc(100vh - 40px);
  }

  .login-workspace {
    padding-top: 36px;
    padding-bottom: 36px;
  }

  .login-footer {
    margin-top: 24px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .login-shell,
  .status-dot {
    animation: none;
  }

  .login-workspace__inner,
  .login-form :deep(.n-input),
  .login-form :deep(.n-input__prefix),
  .login-submit,
  .login-alert-enter-active,
  .login-alert-leave-active {
    transition: none;
  }
}
</style>
