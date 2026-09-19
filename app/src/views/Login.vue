<template>
  <div class="login-page">
    <n-card class="login-card" title="智能门窗">
      <n-form ref="formRef" :model="form" :rules="rules">
        <n-form-item label="用户名" path="username">
          <n-input
            v-model:value="form.username"
            placeholder="请输入用户名"
            @keyup.enter="onSubmit"
          />
        </n-form-item>
        <n-form-item label="密码" path="password">
          <n-input
            v-model:value="form.password"
            type="password"
            show-password-on="click"
            placeholder="请输入密码"
            @keyup.enter="onSubmit"
          />
        </n-form-item>
      </n-form>

      <n-button type="primary" block :loading="loading" @click="onSubmit">登录</n-button>

      <n-alert v-if="error" class="error" type="error" :show-icon="false">
        {{ error }}
      </n-alert>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMessage } from 'naive-ui'
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
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  /* 蓝紫渐变，对齐旧版登录页氛围 */
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 24px;
}
.login-card {
  width: 100%;
  max-width: 380px;
}
.error {
  margin-top: 16px;
}
</style>
