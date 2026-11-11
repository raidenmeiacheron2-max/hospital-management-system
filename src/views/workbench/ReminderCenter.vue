<template>
  <div class="app-page reminder-center">
    <div class="panel-card">
      <div class="reminder-head">
        <div>
          <div class="page-title">系统提醒</div>
          <div class="page-sub">由业务规则实时计算生成；问题解决后自动消失，确认/暂缓不代表已解决。</div>
        </div>
        <div class="level-stats">
          <span class="ls lv-high">高 {{ byLevel.high }}</span>
          <span class="ls lv-medium">中 {{ byLevel.medium }}</span>
          <span class="ls lv-low">低 {{ byLevel.low }}</span>
          <span class="ls total">合计 {{ total }}</span>
        </div>
      </div>
      <div class="rules-note">
        <i class="el-icon-info"></i>
        当前规则阈值（模拟）：药品库存低于 <b>{{ rules.LOW_STOCK }}</b> 件；床位占用率高于 <b>{{ rules.BED_OCCUPANCY }}%</b>；批次距有效期不足 <b>{{ rules.STOCK_EXPIRY_DAYS }}</b> 天；以及待报告、待发药、待执行医嘱、未缴费挂号等业务规则。
      </div>
    </div>

    <div class="panel-card">
      <el-form :inline="true" class="search-form">
        <el-form-item label="级别">
          <el-select v-model="filters.level" placeholder="全部" clearable style="width: 110px">
            <el-option label="高" value="high" />
            <el-option label="中" value="medium" />
            <el-option label="低" value="low" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filters.ack" placeholder="全部" clearable style="width: 130px">
            <el-option label="待处理" value="unack" />
            <el-option label="已确认" value="ack" />
          </el-select>
        </el-form-item>
        <el-form-item label="关键字">
          <el-input v-model.trim="filters.keyword" placeholder="提醒/原因" clearable style="width: 160px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" icon="el-icon-refresh" @click="load">刷新</el-button>
        </el-form-item>
      </el-form>
    </div>

    <div class="panel-card">
      <div v-if="error" class="empty-state error">{{ error }}</div>
      <el-table v-else v-loading="loading" :data="filtered" style="width: 100%">
        <el-table-column label="级别" width="80">
          <template slot-scope="{ row }"><span class="lv-tag" :class="'lv-' + row.level">{{ levelText(row.level) }}</span></template>
        </el-table-column>
        <el-table-column prop="title" label="提醒" min-width="150" />
        <el-table-column prop="detail" label="触发原因" min-width="240" show-overflow-tooltip />
        <el-table-column label="当前状态" min-width="170">
          <template slot-scope="{ row }">
            <span v-if="row.snoozeUntil" class="state snoozed">已暂缓至 {{ row.snoozeUntil }}（未解决）</span>
            <span v-else-if="row.acknowledged" class="state acked">已确认（未解决）</span>
            <span v-else class="state pending">待处理</span>
          </template>
        </el-table-column>
        <el-table-column label="关联业务" min-width="140">
          <template slot-scope="{ row }">
            <span>{{ refText(row) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="190" fixed="right">
          <template slot-scope="{ row }">
            <div class="operation-links">
              <el-link v-if="row.link" type="primary" @click="$router.push(row.link)">查看</el-link>
              <el-link type="primary" @click="openExplain(row)">AI 解释</el-link>
              <el-link type="primary" @click="ack(row)">确认</el-link>
              <el-link type="warning" @click="openSnooze(row)">暂缓</el-link>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="!loading && !error && !filtered.length" class="empty-state">暂无符合条件的系统提醒</div>
    </div>

    <el-dialog title="暂缓提醒" :visible.sync="snoozeVisible" width="420px">
      <p class="snooze-tip">暂缓仅用于延后展示，<b>不会改变问题状态</b>；业务问题解决后提醒才会自动消失。</p>
      <el-form label-width="90px">
        <el-form-item label="暂缓至">
          <el-date-picker v-model="snoozeUntil" type="date" placeholder="选择日期" value-format="yyyy-MM-dd" style="width: 100%" />
        </el-form-item>
      </el-form>
      <div slot="footer">
        <el-button @click="snoozeVisible = false">取 消</el-button>
        <el-button type="primary" :loading="submitting" @click="confirmSnooze">确 定</el-button>
      </div>
    </el-dialog>
    <el-dialog title="AI 提醒解释（只读）" :visible.sync="explainVisible" width="640px">
      <div v-loading="explainLoading" class="explain-body">
        <template v-if="explainResult">
          <p class="explain-title">{{ explainResult.data.title || (explainRow && explainRow.title) }}</p>
          <ul class="explain-basis">
            <li v-for="(b, i) in explainResult.data.basis" :key="i">{{ b }}</li>
          </ul>
          <p class="explain-suggestion">处理建议：{{ explainResult.data.suggestion }}</p>
          <div v-if="explainResult.data.links && explainResult.data.links.length" class="explain-links">
            <el-button v-for="l in explainResult.data.links" :key="l.path" size="mini" type="primary" plain @click="$router.push(l.path); explainVisible = false">{{ l.label }}</el-button>
          </div>
          <AiMetaBar :meta="explainResult.meta"></AiMetaBar>
          <AiDisclaimer :disclaimers="explainResult.data.disclaimers"></AiDisclaimer>
        </template>
        <div v-else-if="!explainLoading" class="empty-state">暂无可用解释</div>
      </div>
      <div slot="footer">
        <el-button @click="explainVisible = false">关 闭</el-button>
        <el-button type="primary" :disabled="!explainResult || explainAccepted" @click="acceptExplain">{{ explainAccepted ? '已采纳' : '采纳建议' }}</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import AiDisclaimer from '@/components/AiDisclaimer.vue'
import AiMetaBar from '@/components/AiMetaBar.vue'
import { apiListReminders, apiAckReminder, apiSnoozeReminder, apiAiRun, apiAiAcceptEvent } from '@/api'

export default {
  name: 'ReminderCenter',
  components: { AiDisclaimer, AiMetaBar },
  data() {
    return {
      loading: false,
      error: '',
      items: [],
      total: 0,
      byLevel: { high: 0, medium: 0, low: 0 },
      rules: { LOW_STOCK: 50, BED_OCCUPANCY: 80, STOCK_EXPIRY_DAYS: 30 },
      filters: { level: '', ack: '', keyword: '' },
      snoozeVisible: false,
      snoozeRow: null,
      snoozeUntil: '',
      submitting: false,
      explainVisible: false,
      explainRow: null,
      explainLoading: false,
      explainResult: null,
      explainAccepted: false
    }
  },
  computed: {
    filtered() {
      return this.items.filter((r) => {
        if (this.filters.level && r.level !== this.filters.level) return false
        if (this.filters.ack === 'ack' && !r.acknowledged) return false
        if (this.filters.ack === 'unack' && r.acknowledged) return false
        if (this.filters.keyword && (r.title + r.detail).indexOf(this.filters.keyword) === -1) return false
        return true
      })
    }
  },
  created() {
    this.load()
  },
  methods: {
    async load() {
      this.loading = true
      this.error = ''
      try {
        const res = await apiListReminders()
        this.items = (res && res.items) || []
        this.total = (res && res.total) || 0
        this.byLevel = (res && res.byLevel) || { high: 0, medium: 0, low: 0 }
        if (res && res.rules) this.rules = res.rules
      } catch (e) {
        this.error = e.message || '提醒加载失败'
      } finally {
        this.loading = false
      }
    },
    levelText(l) {
      return l === 'high' ? '高' : l === 'medium' ? '中' : '低'
    },
    refText(r) {
      const typeMap = { medicine: '药品', bed: '床位', visit: '接诊', order: '医嘱', stock: '库存批次', registration: '挂号' }
      const t = typeMap[r.refType] || r.refType || '—'
      if (r.count) return t + '（' + r.count + ' 项）'
      return r.refId ? t + '：' + r.refId : t
    },
    async ack(row) {
      try {
        await apiAckReminder(row.id)
        this.$message.success('已确认（问题仍需在业务中解决）')
        await this.load()
      } catch (e) {
        /* 拦截器已提示 */
      }
    },
    openSnooze(row) {
      this.snoozeRow = row
      this.snoozeUntil = ''
      this.snoozeVisible = true
    },
    async confirmSnooze() {
      if (!this.snoozeUntil) {
        this.$message.warning('请选择暂缓日期')
        return
      }
      this.submitting = true
      try {
        await apiSnoozeReminder(this.snoozeRow.id, this.snoozeUntil)
        this.$message.success('已暂缓（问题仍未解决）')
        this.snoozeVisible = false
        await this.load()
      } catch (e) {
        /* 拦截器已提示 */
      } finally {
        this.submitting = false
      }
    },
    async openExplain(row) {
      this.explainRow = row
      this.explainResult = null
      this.explainAccepted = false
      this.explainVisible = true
      this.explainLoading = true
      try {
        // B4：AI 解释提醒触发依据（只读，不改变提醒状态）
        const r = await apiAiRun('reminder.explain', { reminderId: row.id })
        this.explainResult = r
      } catch (e) {
        this.$message.warning('AI 解释暂不可用（可能已关闭 AI 功能）')
      } finally {
        this.explainLoading = false
      }
    },
    async acceptExplain() {
      if (!this.explainResult || !this.explainResult.meta || !this.explainResult.meta.eventId) return
      try {
        await apiAiAcceptEvent(this.explainResult.meta.eventId)
        this.explainAccepted = true
        this.$message.success('已记录采纳（提醒状态仍由业务规则决定）')
      } catch (e) {
        /* 采纳标记失败不影响业务 */
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.reminder-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.page-title {
  font-size: 17px;
  font-weight: 600;
  color: $text-main;
}

.page-sub {
  font-size: 12px;
  color: $text-secondary;
  margin-top: 4px;
}

.level-stats {
  display: flex;
  gap: 8px;
  align-items: center;
}

.ls {
  font-size: 12px;
  border-radius: 10px;
  padding: 2px 10px;

  &.lv-high {
    background: #fde8e8;
    color: #e05656;
  }

  &.lv-medium {
    background: #fdf3e3;
    color: #d98e2b;
  }

  &.lv-low {
    background: #f0f2f5;
    color: #909399;
  }

  &.total {
    background: #e8f3fe;
    color: $primary-dark;
  }
}

.rules-note {
  margin-top: 12px;
  font-size: 12px;
  color: $text-regular;
  background: #f7fafd;
  border: 1px solid $border-light;
  border-radius: 4px;
  padding: 8px 10px;
  line-height: 1.7;

  i {
    color: $primary;
    margin-right: 4px;
  }
}

.lv-tag {
  font-size: 11px;
  border-radius: 8px;
  padding: 1px 8px;

  &.lv-high {
    background: #fde8e8;
    color: #e05656;
  }

  &.lv-medium {
    background: #fdf3e3;
    color: #d98e2b;
  }

  &.lv-low {
    background: #f0f2f5;
    color: #909399;
  }
}

.state {
  font-size: 12px;

  &.pending {
    color: #d98e2b;
  }

  &.acked {
    color: #3f8fef;
  }

  &.snoozed {
    color: #909399;
  }
}

.snooze-tip {
  font-size: 13px;
  color: $text-regular;
  line-height: 1.7;
  margin: 0 0 12px;
}

.empty-state {
  text-align: center;
  color: $text-secondary;
  font-size: 13px;
  padding: 24px 0;

  &.error {
    color: $danger;
  }
}

.explain-body {
  min-height: 60px;
}

.explain-title {
  font-size: 14px;
  font-weight: 600;
  color: $text-main;
  margin: 0 0 8px;
}

.explain-basis {
  margin: 0 0 10px;
  padding-left: 18px;
  font-size: 13px;
  color: $text-regular;
  line-height: 1.8;
}

.explain-suggestion {
  font-size: 13px;
  color: $text-main;
  background: $primary-lighter;
  border-radius: $radius-sm;
  padding: 8px 10px;
  line-height: 1.7;
  margin: 0;
}

.explain-links {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
