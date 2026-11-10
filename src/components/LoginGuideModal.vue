<template>
  <!-- 游客额度墙：Teleport 到 body 的全屏登录引导弹窗（遮罩点击空白处关闭） -->
  <Teleport to="body">
    <div v-if="loginPrompt.open" class="lg-mask" @click.self="close">
      <div class="lg-modal glass-card" role="dialog" aria-label="登录引导">
        <button type="button" class="lg-close mono" @click="close">✕</button>
        <p class="eyebrow mono">LOGIN · 登录解锁</p>
        <h3 class="lg-title">登录星语，继续你的旅程</h3>
        <p class="lg-message">{{ loginPrompt.message }}</p>
        <input
          v-model="nickname"
          class="lg-input"
          type="text"
          maxlength="20"
          placeholder="星语旅人"
          @keyup.enter="submit"
        />
        <p v-if="error" class="lg-error">{{ error }}</p>
        <button type="button" class="lg-submit" :disabled="busy" @click="submit">
          {{ busy ? '星尘登记中…' : '登录并继续' }}
        </button>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref } from 'vue'
import { devLogin, setToken } from '../api'
import { loginPrompt } from '../loginPrompt'

const nickname = ref('')
const busy = ref(false)
const error = ref('')

function close() {
  if (busy.value) return // 登录请求进行中不允许关弹窗，避免状态悬挂
  loginPrompt.open = false
  error.value = ''
}

// 昵称登录 → 存 token → 关闭弹窗（后续动作由调用方按钮继续）
async function submit() {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    const data = await devLogin(nickname.value.trim() || '星语旅人')
    setToken(data.token)
    loginPrompt.open = false
    nickname.value = ''
  } catch (e) {
    error.value = '登录失败，请稍后再试'
  } finally {
    busy.value = false // 所有路径（含 return）都经 finally 复位，杜绝一直转圈
  }
}
</script>

<style scoped>
/* 弹层（沿用打卡弹层 ck-mask/ck-modal 工艺） */
.lg-mask {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: rgba(7, 11, 30, 0.72);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.lg-modal {
  position: relative;
  width: 360px;
  max-width: 100%;
  padding: 28px 28px 26px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.lg-close {
  position: absolute;
  top: 12px;
  right: 14px;
  background: none;
  border: none;
  color: var(--ink-dim);
  font-size: 14px;
  cursor: pointer;
}
.lg-close:hover {
  color: var(--gold);
}
.lg-title {
  font-family: var(--font-display);
  font-size: 20px;
  letter-spacing: 0.12em;
  color: var(--ink);
}
.lg-message {
  font-size: 14px;
  line-height: 1.8;
  letter-spacing: 0.06em;
  color: var(--ink-dim);
}
.lg-input {
  width: 100%;
  padding: 10px 14px;
  border-radius: 4px;
  border: 1px solid rgba(139, 135, 176, 0.3);
  background: rgba(7, 11, 30, 0.5);
  color: var(--ink);
  font-size: 14px;
  letter-spacing: 0.06em;
  font-family: var(--font-body);
}
.lg-input::placeholder {
  color: var(--ink-dim);
}
.lg-input:focus-visible {
  outline: 1px solid var(--gold);
  outline-offset: 0;
  border-color: var(--gold);
}
.lg-error {
  font-size: 13px;
  letter-spacing: 0.08em;
  color: var(--cinnabar);
}
/* 金边主按钮（与 MineView 的 .gold-btn 同风格，scoped 重写一份） */
.lg-submit {
  padding: 10px 0;
  border-radius: 4px;
  border: 1px solid var(--gold);
  background: rgba(232, 196, 124, 0.08);
  color: var(--gold);
  font-size: 14px;
  letter-spacing: 0.24em;
  text-indent: 0.24em;
  cursor: pointer;
  transition: background 0.25s, box-shadow 0.25s;
}
.lg-submit:hover:not(:disabled) {
  background: rgba(232, 196, 124, 0.16);
  box-shadow: 0 0 16px rgba(232, 196, 124, 0.3);
}
.lg-submit:disabled {
  opacity: 0.55;
  cursor: default;
}
</style>
