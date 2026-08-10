<script setup lang="ts">
import { usePasswordModal } from '@/composables/usePasswordModal'

const { show, target, oldPwd, newPwd, newPwd2, loading, isSelf, canSubmit, close, submit } = usePasswordModal()
</script>

<template>
  <n-modal v-model:show="show" preset="card"
    :title="isSelf ? '修改密码' : ('重置密码 - ' + (target?.username || ''))"
    style="max-width: min(440px, 92vw);">
    <n-form size="large" label-placement="top">
      <n-form-item v-if="isSelf" label="当前密码">
        <n-input v-model:value="oldPwd" type="password" show-password-on="click" placeholder="请输入当前密码" />
      </n-form-item>
      <n-form-item label="新密码">
        <n-input v-model:value="newPwd" type="password" show-password-on="click" placeholder="请输入新密码（至少4位）" />
      </n-form-item>
      <n-form-item v-if="isSelf" label="确认新密码">
        <n-input v-model:value="newPwd2" type="password" show-password-on="click" placeholder="再次输入新密码" />
      </n-form-item>
    </n-form>
    <template #footer>
      <n-button @click="close">取消</n-button>
      <n-button type="primary" :disabled="!canSubmit" :loading="loading" @click="submit">
        {{ loading ? '修改中...' : '确认修改' }}
      </n-button>
    </template>
  </n-modal>
</template>
