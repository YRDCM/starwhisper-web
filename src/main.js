// 入口：创建 Vue 应用并挂载
import { createApp } from 'vue'
import App from './App.vue'
import './style.css'

// 字体（npm 本地加载，均带系统字体降级）：
// ZCOOL XiaoWei 中文展示衬线 / Cormorant Garamond 拉丁展示衬线 / Space Mono 数据等宽
import '@fontsource/zcool-xiaowei/chinese-simplified-400.css'
import '@fontsource/cormorant-garamond/500.css'
import '@fontsource/cormorant-garamond/600.css'
import '@fontsource/cormorant-garamond/500-italic.css'
import '@fontsource/space-mono/400.css'
import '@fontsource/space-mono/700.css'

createApp(App).mount('#app')
