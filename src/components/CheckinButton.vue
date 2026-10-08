<template>
  <div class="checkin">
    <!-- 头部右侧小金边按钮：三态（未登录「签到」/ 已登录未打卡「打卡」/ 已打卡「连续 N 天 ✦」） -->
    <button type="button" class="ck-btn mono" :class="{ done: status && status.todayDone }" @click="onClick">
      <template v-if="!loggedIn">签到</template>
      <template v-else-if="status && status.todayDone">已打卡 · 连续 {{ status.streak }} 天 ✦</template>
      <template v-else-if="status">打卡 · 连续 {{ status.streak }} 天</template>
      <template v-else>签到</template>
    </button>

    <!-- 游客登录弹层：昵称 → dev 登录 → 立即完成今日打卡 -->
    <div v-if="modalOpen" class="ck-mask" @click.self="modalOpen = false">
      <div class="ck-modal glass-card" role="dialog" aria-label="游客登录">
        <button type="button" class="ck-close mono" @click="modalOpen = false">✕</button>
        <p class="eyebrow mono">GUEST LOGIN · 游客通道</p>
        <h3 class="ck-title">留一个昵称，开始今日打卡</h3>
        <input
          v-model="nickname"
          class="ck-input"
          type="text"
          maxlength="20"
          placeholder="星语旅人"
          @keyup.enter="submit"
        />
        <p v-if="error" class="ck-error">{{ error }}</p>
        <button type="button" class="ck-submit" :disabled="busy" @click="submit">
          {{ busy ? '星尘登记中…' : '登录并打卡' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { getToken, setToken, devLogin, postCheckin, fetchCheckinStatus } from '../api'

const status = ref(null)      // {todayDone, streak, totalDays, recentDates}
const hasToken = ref(!!getToken())
const modalOpen = ref(false)
const nickname = ref('')
const busy = ref(false)
const error = ref('')

const loggedIn = computed(() => hasToken.value && !!status.value)

// 401 时 api 层已清 token，这里同步本地状态为未登录
function onUnauthorized() {
  hasToken.value = false
  status.value = null
}

async function loadStatus() {
  try {
    status.value = await fetchCheckinStatus()
  } catch (e) {
    if (e.code === 401) onUnauthorized()
    // 其他错误（断网等）静默：按钮保持未登录态文案，不打扰首屏
  }
}

function onClick() {
  if (!loggedIn.value) {
    error.value = ''
    modalOpen.value = true
    return
  }
  // 已登录：幂等打卡（今日已打则返回既有状态）
  doCheckin()
}

async function doCheckin() {
  busy.value = true
  try {
    status.value = await postCheckin()
  } catch (e) {
    if (e.code === 401) onUnauthorized()
  } finally {
    busy.value = false
  }
}

// dev 登录成功 → 立即完成今日打卡
async function submit() {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    const data = await devLogin(nickname.value.trim() || '星语旅人')
    setToken(data.token)
    hasToken.value = true
    status.value = await postCheckin()
    modalOpen.value = false
  } catch (e) {
    if (e.code === 401) {
      onUnauthorized()
    } else {
      error.value = '无法连接星语服务器，请稍后再试'
    }
  } finally {
    busy.value = false
  }
}

// App 挂载时：有 token 则拉 status 恢复登录/打卡状态
onMounted(() => {
  if (hasToken.value) loadStatus()
})
</script>

<style scoped>
.checkin {
  display: inline-flex;
}

/* 小金边按钮 */
.ck-btn {
  padding: 7px 18px;
  border-radius: 4px;
  border: 1px solid var(--gold);
  background: rgba(232, 196, 124, 0.08);
  color: var(--gold);
  font-size: 12.5px;
  letter-spacing: 0.16em;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.25s, box-shadow 0.25s;
}
.ck-btn:hover {
  background: rgba(232, 196, 124, 0.16);
  box-shadow: 0 0 14px rgba(232, 196, 124, 0.28);
}
/* 已打卡：收敛为描边文字态，不再召唤点击 */
.ck-btn.done {
  border-color: var(--gold-hairline);
  background: none;
  color: var(--gold-dim);
}

/* 弹层（沿用塔罗弹层工艺） */
.ck-mask {
  position: fixed;
  inset: 0;
  z-index: 40;
  background: rgba(7, 11, 30, 0.72);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.ck-modal {
  position: relative;
  width: 360px;
  max-width: 100%;
  padding: 28px 28px 26px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.ck-close {
  position: absolute;
  top: 12px;
  right: 14px;
  background: none;
  border: none;
  color: var(--ink-dim);
  font-size: 14px;
  cursor: pointer;
}
.ck-close:hover {
  color: var(--gold);
}
.ck-title {
  font-family: var(--font-display);
  font-size: 20px;
  letter-spacing: 0.12em;
  color: var(--ink);
}
.ck-input {
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
.ck-input::placeholder {
  color: var(--ink-dim);
}
.ck-input:focus-visible {
  outline: 1px solid var(--gold);
  outline-offset: 0;
  border-color: var(--gold);
}
.ck-error {
  font-size: 13px;
  letter-spacing: 0.08em;
  color: var(--cinnabar);
}
.ck-submit {
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
.ck-submit:hover:not(:disabled) {
  background: rgba(232, 196, 124, 0.16);
  box-shadow: 0 0 16px rgba(232, 196, 124, 0.3);
}
.ck-submit:disabled {
  opacity: 0.55;
  cursor: default;
}
</style>
