// 游客额度墙：全局登录引导弹窗的响应式单例。
// 任意视图调 promptLogin(引导语) 即可唤起 LoginGuideModal（挂在 App.vue），
// 游客点击需登录的入口时不发请求，先引导登录。
import { reactive } from 'vue'

export const loginPrompt = reactive({ open: false, message: '' })

/** 唤起登录引导弹窗；message 为调用方传入的场景化引导语 */
export function promptLogin(message) {
  loginPrompt.message = message
  loginPrompt.open = true
}
