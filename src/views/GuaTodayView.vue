<template>
  <div class="gua-view">
    <!-- ===== 每日一卦（进入标签页即自动加载；后端未上线时回退本地演示卦，按日确定） ===== -->
    <section class="glass-card gua-hero" :class="{ refreshing: loading && gua }">
      <div v-if="error" class="g-state">
        <p class="g-state-icon">✧</p>
        <p class="g-state-text">{{ error }}</p>
        <button class="g-btn" @click="load">重新连接</button>
      </div>
      <div v-else-if="loading && !gua" class="g-state">
        <div class="spinner"></div>
        <p class="g-state-text">正在排卦…</p>
      </div>
      <template v-else-if="gua">
        <div class="gua-symbol-wrap">
          <span class="gua-symbol">{{ gua.symbol }}</span>
        </div>
        <div class="gua-panel">
          <p class="eyebrow mono">
            DAILY HEXAGRAM · {{ gua.date || todayStr }}
            <span v-if="demo" class="demo-tag mono">演示数据</span>
          </p>
          <h3 class="gua-name">{{ gua.name }}</h3>
          <!-- 星级：luckLevel 1-5，✦ 实 / 暗 空 -->
          <div class="luck-row">
            <span class="luck-label mono">今日星运</span>
            <span class="luck-stars" aria-label="luckLevel">
              <i v-for="n in 5" :key="n" class="star" :class="{ dim: n > gua.luckLevel }">✦</i>
            </span>
          </div>
          <blockquote class="guaci">{{ gua.guaCi }}</blockquote>
          <div class="block">
            <p class="block-label mono">现代解读 · INTERPRETATION</p>
            <p class="block-text">{{ gua.interpretation }}</p>
          </div>
          <div class="block">
            <p class="block-label mono">今日建议 · ADVICE</p>
            <p class="block-text advice">{{ gua.advice }}</p>
          </div>
        </div>
      </template>
    </section>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { fetchHexagramToday } from '../api'

const todayStr = new Date().toISOString().slice(0, 10)

/* ===== 本地演示卦池（后端 /hexagram/today 未上线前的回退；按日确定，同一天恒定） ===== */
const MOCK_POOL = [
  {
    name: '乾为天', symbol: '䷀', guaCi: '乾：元，亨，利，贞。',
    interpretation: '六阳纯卦，象征刚健中正、自强不息。今天的能量充盈而上扬，适合主动开局，把酝酿已久的计划推出去。',
    advice: '宜主动出击、定下方向；忌犹豫反复。记住：刚健也要守住中正，别把强势变成强硬。',
    luckLevel: 5
  },
  {
    name: '坤为地', symbol: '䷁', guaCi: '坤：元亨，利牝马之贞。',
    interpretation: '六阴纯卦，象征包容承载。今天不必冲在最前，稳扎稳打、配合他人反而成事。',
    advice: '宜倾听、执行与收尾；忌争强出头。把基础打牢，好运自会顺着地势流过来。',
    luckLevel: 4
  },
  {
    name: '水雷屯', symbol: '䷂', guaCi: '屯：元亨，利贞。勿用有攸往，利建侯。',
    interpretation: '万事开头难。眼下的阻滞是新生事物的必经之路，不是坏兆头。',
    advice: '宜小步试探、寻找帮手；忌孤注一掷。先把滩头阵地站稳，再图推进。',
    luckLevel: 3
  },
  {
    name: '地天泰', symbol: '䷊', guaCi: '泰：小往大来，吉亨。',
    interpretation: '天地交而万物通。今天的沟通成本最低，适合谈合作、解心结、把话说开。',
    advice: '宜主动沟通、促成共识；忌闷头单干。顺畅时更要留一分余地。',
    luckLevel: 5
  },
  {
    name: '天地否', symbol: '䷋', guaCi: '否：否之匪人，不利君子贞。',
    interpretation: '天地不交，气场有些堵。今天硬推容易碰壁，守成比开拓划算。',
    advice: '宜内省、整理、储备；忌大额支出与重要谈判。否极泰来，等风来。',
    luckLevel: 2
  },
  {
    name: '火天大有', symbol: '䷍', guaCi: '大有：元亨。',
    interpretation: '火在天上，普照四方。资源与人气都在你这边，是收获与展示的好时机。',
    advice: '宜展示成果、分享所得；忌独享其成。越分享，越富有。',
    luckLevel: 5
  },
  {
    name: '泽山咸', symbol: '䷞', guaCi: '咸：亨，利贞，取女吉。',
    interpretation: '两情相感，柔上刚下。今天的直觉与共情力在线，人际关系有微妙的好进展。',
    advice: '宜约会、谈心、换位思考；忌冷漠敷衍。真诚是今天唯一的技巧。',
    luckLevel: 4
  },
  {
    name: '雷风恒', symbol: '䷟', guaCi: '恒：亨，无咎，利贞。利有攸往。',
    interpretation: '雷风相与，恒久不息。今天适合打理长期事务：习惯、关系、储蓄、锻炼。',
    advice: '宜坚持日常节奏、复盘长期目标；忌三分钟热度。恒就是今天的关键词。',
    luckLevel: 4
  },
  {
    name: '火地晋', symbol: '䷢', guaCi: '晋：康侯用锡马蕃庶，昼日三接。',
    interpretation: '日出地上，步步高升。今天的能见度提升，适合汇报、面试、毛遂自荐。',
    advice: '宜向上沟通、展示能力；忌锋芒太露刺伤同侪。升而不骄，路才走得长。',
    luckLevel: 4
  },
  {
    name: '水泽节', symbol: '䷻', guaCi: '节：亨。苦节不可贞。',
    interpretation: '泽上有水，需有节制。今天在金钱与精力上都要量入为出。',
    advice: '宜做预算、定边界；忌过度克扣自己。节制是尺度，不是苦修。',
    luckLevel: 3
  }
]

function mockGua() {
  const now = new Date()
  const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000)
  const g = MOCK_POOL[dayOfYear % MOCK_POOL.length]
  return { date: todayStr, ...g }
}

/* ===== 加载：先打真实接口，失败回退演示卦 ===== */
const gua = ref(null)
const demo = ref(false)
const loading = ref(false)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    gua.value = await fetchHexagramToday()
    demo.value = false
  } catch (e) {
    // 后端未上线：本地演示卦兜底，页面保持可用
    gua.value = mockGua()
    demo.value = true
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.gua-view {
  display: flex;
  flex-direction: column;
  gap: 22px;
}

/* ===== 每日一卦主卡：左大号卦象字符 + 右信息面板 ===== */
.gua-hero {
  display: flex;
  gap: 40px;
  padding: 34px 36px;
  transition: opacity 0.25s ease;
}
.gua-hero.refreshing {
  opacity: 0.55;
  pointer-events: none;
}
.gua-symbol-wrap {
  flex: none;
  width: 240px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--gold-hairline);
  border-radius: 8px;
  background:
    radial-gradient(circle at 50% 42%, rgba(232, 196, 124, 0.1), transparent 70%),
    rgba(35, 32, 72, 0.4);
}
/* 大号卦象：serif 大字 + 金色辉光（Segoe UI Symbol 等系统符号字体兜底） */
.gua-symbol {
  font-family: "Noto Serif SC", "Songti SC", "Segoe UI Symbol", serif;
  font-size: 150px;
  line-height: 1;
  color: var(--gold);
  text-shadow: 0 0 34px rgba(232, 196, 124, 0.45);
}
.gua-panel {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.demo-tag {
  margin-left: 12px;
  padding: 2px 8px;
  border: 1px solid var(--gold-hairline);
  border-radius: 3px;
  font-size: 11px;
  letter-spacing: 0.16em;
  color: var(--gold-dim);
}
.gua-name {
  font-family: var(--font-display);
  font-size: 38px;
  color: var(--gold);
  letter-spacing: 0.16em;
}

/* 星级行 */
.luck-row {
  display: flex;
  align-items: center;
  gap: 14px;
}
.luck-label {
  font-size: 12px;
  letter-spacing: 0.24em;
  color: var(--ink-dim2);
}
.luck-stars {
  display: inline-flex;
  gap: 6px;
  font-size: 17px;
  font-style: normal;
}
.star {
  font-style: normal;
  color: var(--gold);
  text-shadow: 0 0 10px rgba(232, 196, 124, 0.5);
}
.star.dim {
  color: rgba(169, 164, 204, 0.3);
  text-shadow: none;
}

/* 卦辞引文（金线左框，与八卦页同款） */
.guaci {
  padding: 4px 0 4px 18px;
  border-left: 2px solid var(--gold);
  font-family: var(--font-display);
  font-style: italic;
  font-size: 17px;
  line-height: 1.9;
  color: var(--ink);
}

/* 解读 / 建议 分段 */
.block-label {
  font-size: 12px;
  letter-spacing: 0.22em;
  color: var(--ink-dim2);
  margin-bottom: 8px;
}
.block-text {
  font-size: 15px;
  line-height: 2;
  color: rgba(232, 230, 240, 0.9);
}
.block-text.advice {
  color: var(--gold);
}

/* ===== 状态与错误 ===== */
.g-state {
  width: 100%;
  padding: 40px 0;
  text-align: center;
}
.g-state-icon {
  font-size: 30px;
  color: var(--gold);
  margin-bottom: 12px;
}
.g-state-text {
  margin: 14px 0 18px;
  font-size: 15px;
  letter-spacing: 0.15em;
  color: var(--ink);
}
.g-btn {
  padding: 10px 36px;
  border-radius: 4px;
  border: 1px solid var(--gold);
  background: rgba(232, 196, 124, 0.08);
  color: var(--gold);
  font-size: 14px;
  letter-spacing: 0.25em;
  text-indent: 0.25em;
  cursor: pointer;
  transition: background 0.25s, box-shadow 0.25s;
}
.g-btn:hover {
  background: rgba(232, 196, 124, 0.16);
  box-shadow: 0 0 16px rgba(232, 196, 124, 0.3);
}

/* ===== 移动端 ===== */
@media (max-width: 640px) {
  .gua-hero {
    flex-direction: column;
    align-items: center;
    padding: 24px 18px;
  }
  .gua-symbol-wrap {
    width: 100%;
    padding: 28px 0;
  }
  .gua-symbol {
    font-size: 110px;
  }
  .gua-panel {
    width: 100%;
  }
}
</style>
