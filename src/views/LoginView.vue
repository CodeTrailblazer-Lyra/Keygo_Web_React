<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import type { FormInst, FormRules } from 'naive-ui'
import { useAuthStore } from '@/stores/auth'
import { register } from '@/api/auth'
import { useUtils } from '@/composables/useUtils'
import { getErrorMessage, isHandledError } from '@/api/request'
import AppIcon from '@/components/AppIcon.vue'

const router = useRouter()
const auth = useAuthStore()
const { message } = useUtils()

const activeTab = ref<'login' | 'register'>('login')

/* ===== 登录表单 ===== */
const loginFormRef = ref<FormInst | null>(null)
const loginModel = reactive({
  username: '',
  password: '',
  remember: false,
})
const loginRules: FormRules = {
  username: [{ required: true, message: '请输入用户名', trigger: ['blur', 'input'] }],
  password: [{ required: true, message: '请输入密码', trigger: ['blur', 'input'] }],
}
const loginLoading = ref(false)

async function handleLogin() {
  try {
    await loginFormRef.value?.validate()
  } catch {
    return
  }
  loginLoading.value = true
  try {
    await auth.login(loginModel.username, loginModel.password, loginModel.remember)
    message.success('登录成功')
    router.push('/fetch')
  } catch (err) {
    if (!isHandledError(err)) message.error(getErrorMessage(err))
  } finally {
    loginLoading.value = false
  }
}

/* ===== 注册表单 ===== */
const registerFormRef = ref<FormInst | null>(null)
const registerModel = reactive({
  username: '',
  password: '',
  confirm: '',
})
const registerRules: FormRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: ['blur', 'input'] },
    { min: 2, max: 50, message: '用户名长度 2-50 个字符', trigger: ['blur', 'input'] },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: ['blur', 'input'] },
    { min: 4, message: '密码至少 4 位', trigger: ['blur', 'input'] },
  ],
  confirm: [
    { required: true, message: '请再次输入密码', trigger: ['blur', 'input'] },
    {
      validator: () => registerModel.confirm === registerModel.password,
      message: '两次输入的密码不一致',
      trigger: ['blur', 'input'],
    },
  ],
}
const registerLoading = ref(false)

async function handleRegister() {
  try {
    await registerFormRef.value?.validate()
  } catch {
    return
  }
  registerLoading.value = true
  try {
    await register(registerModel.username, registerModel.password)
    message.success('注册成功，请等待管理员审核')
    const registeredName = registerModel.username
    registerModel.username = ''
    registerModel.password = ''
    registerModel.confirm = ''
    activeTab.value = 'login'
    loginModel.username = registeredName
    loginModel.password = ''
  } catch (err) {
    if (!isHandledError(err)) message.error(getErrorMessage(err))
  } finally {
    registerLoading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-wrapper">
      <div class="brand-area">
        <div class="brand-logo"><AppIcon name="key" :size="26" /></div>
        <h1 class="brand-title">KeyGo</h1>
        <p class="brand-subtitle">激活码分发管理系统</p>
      </div>

      <n-card class="login-card" :bordered="false">
        <n-tabs v-model:value="activeTab" type="line" animated size="large">
          <!-- 登录 -->
          <n-tab-pane name="login" tab="登录">
            <n-form
              ref="loginFormRef"
              :model="loginModel"
              :rules="loginRules"
              size="large"
              label-placement="top"
              :show-label="false"
            >
              <n-form-item path="username">
                <n-input
                  v-model:value="loginModel.username"
                  placeholder="用户名"
                  clearable
                >
                  <template #prefix><AppIcon name="user" :size="16" /></template>
                </n-input>
              </n-form-item>
              <n-form-item path="password">
                <n-input
                  v-model:value="loginModel.password"
                  type="password"
                  show-password-on="click"
                  placeholder="密码"
                  @keyup.enter="handleLogin"
                >
                  <template #prefix><AppIcon name="lock" :size="16" /></template>
                </n-input>
              </n-form-item>
              <div class="login-options">
                <n-checkbox v-model:checked="loginModel.remember">14天免登录</n-checkbox>
              </div>
              <n-button
                type="primary"
                size="large"
                block
                :loading="loginLoading"
                @click="handleLogin"
              >
                登录
              </n-button>
            </n-form>
          </n-tab-pane>

          <!-- 注册 -->
          <n-tab-pane name="register" tab="注册">
            <n-form
              ref="registerFormRef"
              :model="registerModel"
              :rules="registerRules"
              size="large"
              label-placement="top"
              :show-label="false"
            >
              <n-form-item path="username">
                <n-input
                  v-model:value="registerModel.username"
                  placeholder="用户名（2-50字符）"
                  clearable
                >
                  <template #prefix><AppIcon name="user" :size="16" /></template>
                </n-input>
              </n-form-item>
              <n-form-item path="password">
                <n-input
                  v-model:value="registerModel.password"
                  type="password"
                  show-password-on="click"
                  placeholder="密码（至少4位）"
                >
                  <template #prefix><AppIcon name="lock" :size="16" /></template>
                </n-input>
              </n-form-item>
              <n-form-item path="confirm">
                <n-input
                  v-model:value="registerModel.confirm"
                  type="password"
                  show-password-on="click"
                  placeholder="确认密码"
                  @keyup.enter="handleRegister"
                >
                  <template #prefix><AppIcon name="lock" :size="16" /></template>
                </n-input>
              </n-form-item>
              <p class="register-hint">注册后需管理员审核通过方可登录</p>
              <n-button
                type="primary"
                size="large"
                block
                :loading="registerLoading"
                @click="handleRegister"
              >
                注册
              </n-button>
            </n-form>
          </n-tab-pane>
        </n-tabs>
      </n-card>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8fafc;
  padding: 24px;
}

.login-wrapper {
  width: 100%;
  max-width: 400px;
}

.brand-area {
  text-align: center;
  margin-bottom: 24px;
}

.brand-logo {
  width: 56px;
  height: 56px;
  margin: 0 auto 12px;
  background: #6366f1;
  border-radius: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26px;
  color: #fff;
}

.brand-title {
  font-size: 26px;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 4px;
}

.brand-subtitle {
  color: #64748b;
  font-size: 14px;
  margin: 0;
}

.login-card {
  border-radius: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  background: #fff;
}

.login-options {
  display: flex;
  justify-content: flex-start;
  margin-bottom: 20px;
}

.register-hint {
  color: #94a3b8;
  font-size: 13px;
  text-align: center;
  margin: 0 0 16px;
}

/* ===== 移动端适配 ===== */
@media (max-width: 768px) {
  .login-page {
    padding: 0;
    align-items: stretch;
  }

  .login-wrapper {
    max-width: 100%;
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    padding: 24px 16px;
    padding-bottom: calc(24px + env(safe-area-inset-bottom));
  }

  .brand-area {
    margin-bottom: 20px;
    padding-top: env(safe-area-inset-top);
  }

  .brand-logo {
    width: 48px;
    height: 48px;
    border-radius: 16px;
    font-size: 22px;
    margin-bottom: 10px;
  }

  .brand-title {
    font-size: 22px;
  }

  .login-card {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .login-options {
    margin-bottom: 16px;
  }
}
</style>
