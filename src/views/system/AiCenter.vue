<template>
  <div class="ai-center" v-loading="loading">
    <!-- 顶部状态 -->
    <el-row :gutter="12">
      <el-col :xs="24" :sm="12" :md="8">
        <div class="panel-card status-card">
          <div class="status-head">
            <span class="status-icon" :class="enabled ? 'on' : 'off'"><i class="el-icon-cpu"></i></span>
            <div class="status-title">
              <div class="st-name">AI 功能总开关</div>
              <div class="st-sub">关闭后所有 AI 入口无副作用</div>
            </div>
            <el-switch :value="enabled" :disabled="saving" @change="toggleEnabled"></el-switch>
          </div>
          <div class="status-foot">
            <span class="dot" :class="enabled ? 'dot-on' : 'dot-off'"></span>
            {{ enabled ? 'AI 已启用（只读建议）' : 'AI 已关闭' }}
            <span v-if="settings.runtimeOverride" class="tag-mini">运行时覆盖</span>
          </div>
        </div>
      </el-col>

      <el-col :xs="24" :sm="12" :md="8">
        <div class="panel-card status-card">
          <div class="status-head">
            <span class="status-icon on"><i class="el-icon-connection"></i></span>
            <div class="status-title">
              <div class="st-name">{{ settings.providerLabel || '本地确定性规则引擎' }}</div>
              <div class="st-sub">{{ settings.zeroNetwork ? '零外部网络 · 零密钥' : '外部 Provider（骨架）' }}</div>
            </div>
          </div>
          <div class="provider-list">
            <div v-for="p in providers" :key="p.name" class="provider-row">
              <span class="pv-name">{{ p.name }}</span>
              <span class="pv-kind">{{ p.kind === 'local' ? '本地' : '外部' }}</span>
              <span class="pv-state" :class="p.available ? 'ok' : 'no'">{{ p.available ? '可用' : '不可用' }}</span>
            </div>
          </div>
        </div>
      </el-col>

      <el-col :xs="24" :sm="24" :md="8">
        <div class="panel-card status-card">
          <div class="status-head">
            <span class="status-icon on"><i class="el-icon-finished"></i></span>
            <div class="status-title">
              <div class="st-name">AI 调用审计</div>
              <div class="st-sub">每次调用写入 aiEvents（只读集合）</div>
            </div>
          </div>
          <div class="stat-grid">
            <div class="stat-item"><div class="sv">{{ stats.total || 0 }}</div><div class="sl">调用总数</div></div>
            <div class="stat-item"><div class="sv">{{ stats.accepted || 0 }}</div><div class="sl">已采纳</div></div>
            <div class="stat-item"><div class="sv">{{ stats.acceptanceRate || 0 }}%</div><div class="sl">采纳率</div></div>
            <div class="stat-item"><div class="sv">{{ stats.errors || 0 }}</div><div class="sl">异常</div></div>
          </div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="12">
      <!-- Guardrails -->
      <el-col :xs="24" :md="12">
        <div class="panel-card">
          <h3 class="panel-title">安全护栏（Guardrails）</h3>
          <el-table :data="guardrails" size="small" border>
            <el-table-column prop="code" label="编号" width="60"></el-table-column>
            <el-table-column prop="name" label="护栏" width="110"></el-table-column>
            <el-table-column prop="rule" label="规则" show-overflow-tooltip></el-table-column>
            <el-table-column prop="how" label="校验方式" width="150" show-overflow-tooltip></el-table-column>
            <el-table-column label="状态" width="80" align="center">
              <template slot-scope="{ row }">
                <el-tag size="mini" type="success">{{ row.status }}</el-tag>
              </template>
            </el-table-column>
          </el-table>
          <div class="note-line">
            <i class="el-icon-info"></i>
            AI 只读：不调用任何业务写函数、不持有数据层引用、不 persist 业务数据；落地操作必须经用户确认并走原有业务校验。
          </div>
        </div>
      </el-col>

      <!-- 自检 -->
      <el-col :xs="24" :md="12">
        <div class="panel-card">
          <h3 class="panel-title">AI 基础设施自检</h3>
          <div class="selftest-bar">
            <el-button type="primary" size="small" icon="el-icon-video-play" :loading="selftestLoading" @click="runSelftest">
              运行自检
            </el-button>
            <span class="st-hint">自检本身也是一次 AI 调用，会写入 aiEvents</span>
          </div>
          <div v-if="!selftest" class="empty-state">尚未运行自检</div>
          <template v-else>
            <div class="selftest-summary">{{ selftest.data.summary }}</div>
            <AiMetaBar :meta="selftest.meta" :provider-label="settings.providerLabel"></AiMetaBar>
            <el-table :data="selftest.data.checks" size="small" border class="selftest-table">
              <el-table-column prop="name" label="检查项" width="120"></el-table-column>
              <el-table-column prop="detail" label="结果" show-overflow-tooltip></el-table-column>
              <el-table-column label="状态" width="70" align="center">
                <template slot-scope="{ row }">
                  <el-tag size="mini" :type="row.ok ? 'success' : 'danger'">{{ row.ok ? '通过' : '异常' }}</el-tag>
                </template>
              </el-table-column>
            </el-table>
            <AiDisclaimer :disclaimers="selftest.data.disclaimers"></AiDisclaimer>
          </template>
        </div>
      </el-col>
    </el-row>

    <!-- 任务注册表 -->
    <div class="panel-card">
      <h3 class="panel-title">AI 任务注册表</h3>
      <el-table :data="tasks" size="small" border>
        <el-table-column prop="name" label="任务名" width="170"></el-table-column>
        <el-table-column prop="title" label="名称" width="170"></el-table-column>
        <el-table-column prop="batch" label="批次" width="70" align="center"></el-table-column>
        <el-table-column prop="description" label="说明" show-overflow-tooltip></el-table-column>
        <el-table-column label="只读" width="70" align="center">
          <template slot-scope="{ row }">
            <el-tag size="mini" :type="row.readOnly ? 'success' : 'danger'">{{ row.readOnly ? '是' : '否' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="schemaFields" label="输出字段" width="90" align="center"></el-table-column>
        <el-table-column prop="disclaimerCount" label="免责项" width="80" align="center"></el-table-column>
      </el-table>
    </div>

    <!-- AI 审计事件 -->
    <div class="panel-card">
      <h3 class="panel-title">AI 审计事件（aiEvents）</h3>
      <div class="toolbar-row">
        <div class="toolbar-left">
          <el-select v-model="query.task" size="small" clearable placeholder="全部任务" @change="searchEvents">
            <el-option v-for="t in tasks" :key="t.name" :label="t.title" :value="t.name"></el-option>
          </el-select>
          <el-input v-model="query.keyword" size="small" clearable placeholder="输入/输出摘要关键字" @keyup.enter.native="searchEvents" @clear="searchEvents"></el-input>
          <el-button size="small" icon="el-icon-search" @click="searchEvents">查询</el-button>
        </div>
        <div class="toolbar-right">
          <el-button size="small" icon="el-icon-refresh" @click="loadEvents">刷新</el-button>
        </div>
      </div>
      <el-table :data="events" size="small" border class="event-table">
        <el-table-column prop="time" label="时间" width="140"></el-table-column>
        <el-table-column prop="actorName" label="操作人" width="100"></el-table-column>
        <el-table-column prop="task" label="任务" width="150"></el-table-column>
        <el-table-column prop="provider" label="Provider" width="140"></el-table-column>
        <el-table-column prop="inputSummary" label="输入摘要" show-overflow-tooltip></el-table-column>
        <el-table-column prop="outputSummary" label="输出摘要" show-overflow-tooltip></el-table-column>
        <el-table-column label="置信度" width="80" align="center">
          <template slot-scope="{ row }">{{ Math.round((row.confidence || 0) * 100) }}%</template>
        </el-table-column>
        <el-table-column prop="latencyMs" label="耗时" width="80" align="center"></el-table-column>
        <el-table-column label="采纳" width="90" align="center">
          <template slot-scope="{ row }">
            <el-tag v-if="row.accepted" size="mini" type="success">已采纳</el-tag>
            <el-button v-else type="text" size="mini" @click="acceptEvent(row)">标记采纳</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="table-footer">
        <el-pagination
          background
          layout="total, prev, pager, next"
          :total="eventTotal"
          :page-size="query.size"
          :current-page="query.page"
          @current-change="changePage"
        ></el-pagination>
      </div>
    </div>
  </div>
</template>

<script>
import AiDisclaimer from '@/components/AiDisclaimer.vue'
import AiMetaBar from '@/components/AiMetaBar.vue'
import {
  apiAiSettings,
  apiAiSaveSettings,
  apiAiTasks,
  apiAiProviders,
  apiAiStats,
  apiAiRun,
  apiAiEvents,
  apiAiAcceptEvent
} from '@/api'

export default {
  name: 'AiCenter',
  components: { AiDisclaimer, AiMetaBar },
  data() {
    return {
      loading: false,
      saving: false,
      settings: {},
      providers: [],
      tasks: [],
      stats: {},
      events: [],
      eventTotal: 0,
      query: { task: '', keyword: '', page: 1, size: 10 },
      selftest: null,
      selftestLoading: false,
      guardrails: [
        { code: 'G1', name: 'no-write', rule: 'AI 层不调用任何业务写函数', how: '静态扫描 + 单测断言', status: '已实现' },
        { code: 'G2', name: 'schema', rule: '输出结构校验，失败回退"无建议"', how: '运行时校验', status: '已实现' },
        { code: 'G3', name: 'disclaimer', rule: '强制注入免责声明', how: '输出后统一注入', status: '已实现' },
        { code: 'G4', name: '人工确认', rule: '落地写操作须用户确认并走原有校验', how: 'UI 确认 + 原 db 校验', status: '已实现' },
        { code: 'G5', name: '脱敏', rule: '上下文与审计不含密码/token/手机号', how: '递归脱敏', status: '已实现' },
        { code: 'G6', name: '开关', rule: '关闭时无任何副作用', how: '调用前短路 + 单测', status: '已实现' },
        { code: 'G7', name: '零网络', rule: '默认 Provider 不发网络请求', how: '静态断言 + 本地引擎', status: '已实现' }
      ]
    }
  },
  computed: {
    enabled() {
      return !!this.settings.enabled
    }
  },
  created() {
    this.load()
  },
  methods: {
    async load() {
      this.loading = true
      try {
        const [settings, providers, tasks, stats] = await Promise.all([
          apiAiSettings(),
          apiAiProviders(),
          apiAiTasks(),
          apiAiStats()
        ])
        this.settings = settings || {}
        this.providers = providers || []
        this.tasks = tasks || []
        this.stats = stats || {}
        await this.loadEvents()
      } catch (e) {
        /* 拦截器已提示 */
      } finally {
        this.loading = false
      }
    },
    async loadEvents() {
      try {
        const res = await apiAiEvents({
          task: this.query.task,
          keyword: this.query.keyword,
          page: this.query.page,
          size: this.query.size
        })
        this.events = (res && res.list) || []
        this.eventTotal = (res && res.total) || 0
      } catch (e) {
        /* 拦截器已提示 */
      }
    },
    searchEvents() {
      this.query.page = 1
      this.loadEvents()
    },
    changePage(p) {
      this.query.page = p
      this.loadEvents()
    },
    async toggleEnabled(val) {
      this.saving = true
      try {
        const s = await apiAiSaveSettings({ enabled: val })
        this.settings = s || this.settings
        this.$message.success(val ? 'AI 已启用' : 'AI 已关闭（所有 AI 入口无副作用）')
        this.selftest = null
      } catch (e) {
        this.$message.error('AI 开关保存失败')
        await this.load()
      } finally {
        this.saving = false
      }
    },
    async runSelftest() {
      this.selftestLoading = true
      try {
        const r = await apiAiRun('system.selftest', {})
        this.selftest = r
        this.$message.success('自检完成，已写入 AI 审计事件')
        const [stats] = await Promise.all([apiAiStats()])
        this.stats = stats || this.stats
        this.query.page = 1
        await this.loadEvents()
      } catch (e) {
        /* 拦截器已提示（AI 关闭时返回 503） */
      } finally {
        this.selftestLoading = false
      }
    },
    async acceptEvent(row) {
      try {
        await apiAiAcceptEvent(row.id)
        this.$message.success('已标记为采纳')
        const stats = await apiAiStats()
        this.stats = stats || this.stats
        await this.loadEvents()
      } catch (e) {
        /* 拦截器已提示 */
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.ai-center {
  min-height: 100%;
}

.status-card {
  margin-bottom: 12px;
}

.status-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.status-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;

  &.on {
    background: $primary-lighter;
    color: $primary-dark;
  }

  &.off {
    background: $info-bg;
    color: $info;
  }
}

.status-title {
  flex: 1;
  min-width: 0;

  .st-name {
    font-size: 14px;
    font-weight: 600;
    color: $text-main;
  }

  .st-sub {
    font-size: 12px;
    color: $text-secondary;
    margin-top: 2px;
  }
}

.status-foot {
  margin-top: 10px;
  font-size: 12px;
  color: $text-secondary;
  display: flex;
  align-items: center;
  gap: 6px;
}

.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  display: inline-block;

  &.dot-on {
    background: $success;
  }

  &.dot-off {
    background: $info;
  }
}

.tag-mini {
  margin-left: auto;
  background: $warning-bg;
  color: #a86b12;
  border-radius: 9px;
  padding: 1px 8px;
  font-size: 11px;
}

.provider-list {
  margin-top: 10px;
}

.provider-row {
  display: flex;
  align-items: center;
  font-size: 12px;
  color: $text-regular;
  padding: 5px 0;
  border-bottom: 1px dashed $border-light;

  &:last-child {
    border-bottom: none;
  }

  .pv-name {
    flex: 1;
    font-family: Consolas, Monaco, monospace;
  }

  .pv-kind {
    color: $text-secondary;
    margin-right: 10px;
  }

  .pv-state {
    &.ok {
      color: $success;
    }

    &.no {
      color: $info;
    }
  }
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  margin-top: 12px;
}

.stat-item {
  text-align: center;
  background: #f8fafd;
  border-radius: $radius-sm;
  padding: 8px 2px;

  .sv {
    font-size: 18px;
    font-weight: 700;
    color: $text-main;
  }

  .sl {
    font-size: 11px;
    color: $text-secondary;
    margin-top: 2px;
  }
}

.note-line {
  margin-top: 10px;
  font-size: 12px;
  color: $text-secondary;
  background: #f7fafd;
  border-radius: $radius-sm;
  padding: 8px 10px;
  line-height: 1.6;
}

.selftest-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;

  .st-hint {
    font-size: 12px;
    color: $text-secondary;
  }
}

.selftest-summary {
  font-size: 13px;
  color: $text-main;
  line-height: 1.7;
  background: $primary-lighter;
  border-radius: $radius-sm;
  padding: 9px 11px;
}

.selftest-table {
  margin-top: 10px;
}

.empty-state {
  text-align: center;
  color: $text-secondary;
  font-size: 13px;
  padding: 24px 0;
}

.toolbar-row {
  margin-bottom: 10px;

  .el-input {
    width: 220px;
  }
}

.event-table {
  margin-top: 4px;
}

@media (max-width: 900px) {
  .stat-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
