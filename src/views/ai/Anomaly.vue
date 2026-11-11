<template>
  <div class="app-page anomaly-page">
    <div class="panel-card">
      <div class="head-row">
        <div class="head-main">
          <h3 class="panel-title">运营异常分析</h3>
          <p class="sub-text">
            基于库存、床位、报告/医嘱积压、批次临期与未缴费等<strong>演示阈值</strong>识别运营异常并解释；只读分析，不提供自动处理。
          </p>
        </div>
        <el-button icon="el-icon-refresh" :loading="loading" @click="load">刷新</el-button>
      </div>

      <el-row :gutter="12" class="stat-row">
        <el-col :xs="12" :sm="6">
          <div class="stat-card">
            <div class="num">{{ counts.total }}</div>
            <div class="lbl">异常总数</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="6">
          <div class="stat-card high">
            <div class="num">{{ counts.high }}</div>
            <div class="lbl">高优先级</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="6">
          <div class="stat-card medium">
            <div class="num">{{ counts.medium }}</div>
            <div class="lbl">中优先级</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="6">
          <div class="stat-card low">
            <div class="num">{{ counts.low }}</div>
            <div class="lbl">低优先级</div>
          </div>
        </el-col>
      </el-row>

      <div v-if="summary" class="summary-box">
        <i class="el-icon-magic-stick"></i>
        <span>{{ summary }}</span>
      </div>
      <AiMetaBar v-if="result" :meta="result.meta || {}" :provider-label="providerLabel"></AiMetaBar>
    </div>

    <div v-loading="loading" class="panel-card">
      <div class="toolbar-row">
        <div class="toolbar-left">
          <span class="filter-label">级别筛选</span>
          <el-radio-group v-model="level" size="small">
            <el-radio-button label="">全部</el-radio-button>
            <el-radio-button label="high">高</el-radio-button>
            <el-radio-button label="medium">中</el-radio-button>
            <el-radio-button label="low">低</el-radio-button>
          </el-radio-group>
          <span class="filter-hint">当前显示 {{ filtered.length }} 项</span>
        </div>
        <div class="toolbar-right">
          <span class="readonly-tag"><i class="el-icon-lock"></i> 只读分析</span>
        </div>
      </div>

      <div v-if="aiDisabled" class="state-box">
        <i class="el-icon-warning-outline"></i>
        <p>AI 功能已关闭（演示开关），异常分析未执行。请在「AI 治理中心」重新启用后再试。</p>
        <el-button size="small" type="primary" @click="load">重新加载</el-button>
      </div>
      <div v-else-if="loadError" class="state-box error">
        <i class="el-icon-warning-outline"></i>
        <p>异常分析加载失败：{{ loadError }}</p>
        <el-button size="small" type="primary" @click="load">重试</el-button>
      </div>
      <div v-else-if="!result" class="state-box">
        <p>正在分析只读运营数据…</p>
      </div>
      <div v-else-if="!filtered.length" class="state-box">
        <i class="el-icon-success"></i>
        <p>当前阈值规则下未发现{{ level ? levelLabel(level) + '级别' : '' }}异常。</p>
      </div>
      <div v-else class="anomaly-list">
        <div v-for="item in filtered" :key="item.id" class="anomaly-card" :class="'lv-' + item.level">
          <div class="ac-head">
            <el-tag size="mini" effect="dark" :type="tagType(item.level)">{{ levelLabel(item.level) }}</el-tag>
            <span class="ac-title">{{ item.title }}</span>
            <span class="ac-id">{{ item.id }}</span>
          </div>
          <div class="ac-reason">{{ item.reason }}</div>
          <div class="ac-metric">
            <span class="m-label">{{ item.metric.label }}</span>
            <span class="m-value">{{ item.metric.value }}</span>
          </div>
          <div class="ac-suggest"><i class="el-icon-magic-stick"></i>{{ item.suggestion }}</div>
          <div v-if="item.links && item.links.length" class="ac-links">
            <el-button
              v-for="link in item.links"
              :key="link.path"
              size="mini"
              type="primary"
              plain
              @click="$router.push(link.path)"
            >{{ link.label }}</el-button>
          </div>
        </div>
      </div>

      <AiDisclaimer
        v-if="result"
        :disclaimers="(result.data && result.data.disclaimers) || []"
      ></AiDisclaimer>
    </div>
  </div>
</template>

<script>
import AiDisclaimer from '@/components/AiDisclaimer.vue'
import AiMetaBar from '@/components/AiMetaBar.vue'
import { apiAiRun } from '@/api'

const LEVEL_LABELS = { high: '高', medium: '中', low: '低' }
const TAG_TYPES = { high: 'danger', medium: 'warning', low: 'info' }

export default {
  name: 'AiAnomaly',
  components: { AiDisclaimer, AiMetaBar },
  data() {
    return {
      loading: false,
      aiDisabled: false,
      loadError: '',
      result: null,
      level: '',
      providerLabel: '本地确定性引擎'
    }
  },
  computed: {
    counts() {
      const d = this.result && this.result.data
      return d
        ? { total: d.total || 0, high: d.highCount || 0, medium: d.mediumCount || 0, low: d.lowCount || 0 }
        : { total: 0, high: 0, medium: 0, low: 0 }
    },
    items() {
      const d = this.result && this.result.data
      return (d && d.items) || []
    },
    filtered() {
      return this.level
        ? this.items.filter((item) => item.level === this.level)
        : this.items
    },
    summary() {
      const d = this.result && this.result.data
      return d ? d.summary || '' : ''
    }
  },
  created() {
    this.load()
  },
  methods: {
    async load() {
      if (this.loading) return
      this.loading = true
      this.aiDisabled = false
      this.loadError = ''
      try {
        const res = await apiAiRun('anomaly.explain', { scope: 'all' })
        this.result = res || null
        this.providerLabel =
          res && res.provider === 'http-llm' ? '外部 LLM（骨架）' : '本地确定性引擎'
      } catch (e) {
        const message = (e && e.message) || ''
        // 拦截器已对 503 弹出一次提示；此处只做页面内展示，不重复弹错
        if (message.indexOf('AI 功能已关闭') !== -1 || message.indexOf('AI_DISABLED') !== -1) {
          this.aiDisabled = true
        } else {
          this.loadError = message || '未知错误'
        }
      } finally {
        this.loading = false
      }
    },
    levelLabel(level) {
      return LEVEL_LABELS[level] || level
    },
    tagType(level) {
      return TAG_TYPES[level] || 'info'
    }
  }
}
</script>

<style lang="scss" scoped>
.anomaly-page {
  min-height: 100%;
}

.head-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 14px;

  .head-main {
    flex: 1;
    min-width: 0;
  }

  .panel-title {
    margin-bottom: 6px;
  }
}

.sub-text {
  margin: 0;
  font-size: 12px;
  line-height: 1.7;
  color: $text-secondary;

  strong {
    color: $primary-deep;
    font-weight: 600;
  }
}

.stat-row {
  margin-bottom: 4px;
}

.stat-card {
  background: #f8fafd;
  border-radius: $radius-md;
  padding: 12px 10px;
  text-align: center;
  border: 1px solid $border-light;

  .num {
    font-size: 22px;
    font-weight: 700;
    color: $text-main;
    line-height: 1.2;
  }

  .lbl {
    margin-top: 2px;
    font-size: 12px;
    color: $text-secondary;
  }

  &.high {
    background: $danger-bg;
    border-color: #fbd4d4;

    .num {
      color: $danger;
    }
  }

  &.medium {
    background: $warning-bg;
    border-color: #f5e3bd;

    .num {
      color: #d98e2b;
    }
  }

  &.low {
    background: $info-bg;
    border-color: $border-light;

    .num {
      color: $info;
    }
  }
}

.summary-box {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 12px;
  padding: 10px 12px;
  background: $primary-lighter;
  border-radius: $radius-md;
  font-size: 13px;
  line-height: 1.7;
  color: $text-main;

  i {
    color: $primary-deep;
    margin-top: 2px;
    flex-shrink: 0;
  }
}

.filter-label {
  font-size: 12px;
  color: $text-secondary;
}

.filter-hint {
  font-size: 12px;
  color: $text-secondary;
  margin-left: 4px;
}

.readonly-tag {
  font-size: 12px;
  color: $text-secondary;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.anomaly-list {
  margin-top: 12px;
}

.anomaly-card {
  border: 1px solid $border-color;
  border-left: 4px solid $info;
  border-radius: $radius-md;
  padding: 12px 14px;
  background: #fff;

  & + .anomaly-card {
    margin-top: 10px;
  }

  &.lv-high {
    border-left-color: $danger;
    background: #fffafa;
  }

  &.lv-medium {
    border-left-color: $warning;
    background: #fffdf7;
  }

  &.lv-low {
    border-left-color: $info;
  }
}

.ac-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.ac-title {
  font-size: 14px;
  font-weight: 600;
  color: $text-main;
}

.ac-id {
  margin-left: auto;
  font-size: 11px;
  color: $text-secondary;
  font-family: Consolas, Monaco, monospace;
}

.ac-reason {
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.7;
  color: $text-regular;
}

.ac-metric {
  margin-top: 8px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #f5f7fa;
  border-radius: 10px;
  padding: 3px 10px;

  .m-label {
    font-size: 12px;
    color: $text-secondary;
  }

  .m-value {
    font-size: 13px;
    font-weight: 700;
    color: $text-main;
  }
}

.ac-suggest {
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.7;
  color: #8a6d3b;
  background: #fffbf0;
  border-radius: $radius-sm;
  padding: 7px 10px;

  i {
    margin-right: 4px;
  }
}

.ac-links {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.state-box {
  margin-top: 12px;
  padding: 32px 16px;
  text-align: center;
  color: $text-secondary;
  font-size: 13px;
  line-height: 1.7;

  i {
    font-size: 28px;
    color: $primary-light;
    margin-bottom: 6px;
    display: inline-block;
  }

  p {
    margin: 0 0 10px;
  }

  &.error {
    color: $danger;

    i {
      color: $danger;
    }
  }
}

@media (max-width: 900px) {
  .head-row {
    flex-direction: column;
  }

  .ac-id {
    margin-left: 0;
  }
}
</style>
