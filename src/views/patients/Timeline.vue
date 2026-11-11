<template>
  <div class="app-page timeline-page">
    <div class="panel-card">
      <el-form :inline="true" class="search-form">
        <el-form-item label="患者">
          <el-select v-model="patientId" filterable remote :remote-method="searchPatient" placeholder="搜索并选择患者" style="width: 260px" @change="loadTimeline">
            <el-option v-for="p in patients" :key="p.id" :label="`${p.name}（${p.code}）`" :value="p.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="顺序">
          <el-radio-group v-model="order" size="small">
            <el-radio-button label="asc">时间正序</el-radio-button>
            <el-radio-button label="desc">时间倒序</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="环节">
          <el-select v-model="selectedCategories" multiple collapse-tags placeholder="全部环节" style="width: 220px">
            <el-option v-for="c in categories" :key="c" :label="c" :value="c" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button icon="el-icon-refresh" @click="loadTimeline">刷新</el-button>
        </el-form-item>
      </el-form>
    </div>

    <div v-if="error" class="panel-card empty-state error">{{ error }}</div>

    <template v-else-if="patient">
      <div class="panel-card patient-card">
        <div class="pc-main">
          <span class="pc-avatar">{{ patient.name.slice(0, 1) }}</span>
          <div>
            <div class="pc-name">{{ patient.name }} <span class="pc-gender">{{ patient.gender }}</span></div>
            <div class="pc-meta">{{ patient.code }} · {{ patient.phone }}<span v-if="patient.allergy"> · 过敏史：{{ patient.allergy }}</span></div>
          </div>
        </div>
        <div class="pc-progress">
          <div class="pg-stage">{{ progress.stage }}</div>
          <div class="pg-sub">已完成 {{ progress.done }} / 共 {{ progress.total }} 个环节 · 待处理 {{ progress.pending }}</div>
          <el-progress :percentage="progressPct" :show-text="false" :stroke-width="6" color="#3F9DF9"></el-progress>
        </div>
      </div>

      <div class="panel-card">
        <div class="timeline-head">
          <div class="card-title">诊疗全流程 <span class="count-badge">{{ displayed.length }} 个节点</span></div>
          <div class="readonly-tip"><i class="el-icon-lock"></i> 只读视图，不修改业务数据</div>
        </div>

        <div v-loading="loading" class="timeline">
          <div v-if="!displayed.length" class="empty-state">暂无业务记录（该患者尚未产生诊疗数据）</div>
          <div v-for="(e, i) in displayed" :key="e.id" class="tl-item" :class="'kind-' + e.statusKind">
            <div class="tl-axis">
              <span class="tl-dot"></span>
              <span v-if="i < displayed.length - 1" class="tl-line"></span>
            </div>
            <div class="tl-body" @click="openDetail(e)">
              <div class="tl-top">
                <span class="tl-time">{{ e.time || '时间缺失' }}</span>
                <span class="tl-cat">{{ e.category }}</span>
                <StatusTag v-if="e.status" :label="e.status" />
              </div>
              <div class="tl-title">{{ e.title }}</div>
              <div class="tl-summary">{{ e.summary || '—' }}</div>
              <div class="tl-meta">
                <span v-if="e.departmentName">科室：{{ e.departmentName }}</span>
                <span v-if="e.role">角色：{{ e.role }}</span>
                <span v-if="e.link" class="tl-link">查看原始记录 <i class="el-icon-arrow-right"></i></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <div v-else-if="!loading" class="panel-card empty-state">请选择患者以查看 360° 全流程时间线</div>

    <el-dialog title="节点详情" :visible.sync="detailVisible" width="560px">
      <el-descriptions v-if="detailRow" :column="1" border size="medium">
        <el-descriptions-item label="发生时间">{{ detailRow.time || '时间缺失' }}</el-descriptions-item>
        <el-descriptions-item label="业务环节">{{ detailRow.category }}</el-descriptions-item>
        <el-descriptions-item label="节点标题">{{ detailRow.title }}</el-descriptions-item>
        <el-descriptions-item label="业务摘要">{{ detailRow.summary || '—' }}</el-descriptions-item>
        <el-descriptions-item label="所属科室">{{ detailRow.departmentName || '—' }}</el-descriptions-item>
        <el-descriptions-item label="操作角色">{{ detailRow.role || '—' }}</el-descriptions-item>
        <el-descriptions-item label="当前状态">{{ detailRow.status || '—' }}</el-descriptions-item>
        <el-descriptions-item label="业务对象">{{ detailRow.refType }} / {{ detailRow.refId }}</el-descriptions-item>
      </el-descriptions>
      <div slot="footer">
        <el-button @click="detailVisible = false">关 闭</el-button>
        <el-button v-if="detailRow && detailRow.link" type="primary" @click="goOriginal">前往原始业务记录</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import StatusTag from '@/components/StatusTag.vue'
import { apiOptions, apiPatientTimeline } from '@/api'

export default {
  name: 'PatientTimeline',
  components: { StatusTag },
  data() {
    return {
      loading: false,
      error: '',
      patients: [],
      patientId: '',
      patient: null,
      events: [],
      progress: { stage: '—', total: 0, done: 0, pending: 0 },
      order: 'asc',
      selectedCategories: [],
      detailVisible: false,
      detailRow: null
    }
  },
  computed: {
    categories() {
      const set = {}
      this.events.forEach((e) => { set[e.category] = true })
      return Object.keys(set)
    },
    displayed() {
      let arr = this.events
      if (this.selectedCategories.length) arr = arr.filter((e) => this.selectedCategories.indexOf(e.category) !== -1)
      arr = arr.slice()
      if (this.order === 'desc') arr.reverse()
      return arr
    },
    progressPct() {
      if (!this.progress.total) return 0
      return Math.round((this.progress.done / this.progress.total) * 100)
    }
  },
  created() {
    this.loadPatients()
    const q = this.$route.query.patientId
    if (q) {
      this.patientId = q
      this.loadTimeline()
    }
  },
  methods: {
    async loadPatients() {
      try {
        this.patients = await apiOptions('patients')
      } catch (e) {
        /* 拦截器已提示 */
      }
    },
    searchPatient(kw) {
      if (!kw) { this.loadPatients(); return }
      this.loadPatients()
    },
    async loadTimeline() {
      if (!this.patientId) return
      this.loading = true
      this.error = ''
      try {
        const res = await apiPatientTimeline(this.patientId)
        this.patient = res.patient
        this.events = res.events || []
        this.progress = res.progress || { stage: '—', total: 0, done: 0, pending: 0 }
        this.selectedCategories = []
      } catch (e) {
        this.error = e.message || '时间线加载失败'
      } finally {
        this.loading = false
      }
    },
    openDetail(e) {
      this.detailRow = e
      this.detailVisible = true
    },
    goOriginal() {
      if (this.detailRow && this.detailRow.link) this.$router.push(this.detailRow.link)
    }
  }
}
</script>

<style lang="scss" scoped>
.patient-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
}

.pc-main {
  display: flex;
  align-items: center;
  gap: 12px;
}

.pc-avatar {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: $primary;
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

.pc-name {
  font-size: 17px;
  font-weight: 600;
  color: $text-main;
}

.pc-gender {
  font-size: 12px;
  color: $text-secondary;
  margin-left: 6px;
}

.pc-meta {
  font-size: 12px;
  color: $text-secondary;
  margin-top: 3px;
}

.pc-progress {
  min-width: 260px;

  .pg-stage {
    font-size: 14px;
    font-weight: 600;
    color: $primary-dark;
  }

  .pg-sub {
    font-size: 12px;
    color: $text-secondary;
    margin: 3px 0 6px;
  }
}

.timeline-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.card-title {
  font-size: 15px;
  font-weight: 600;
  color: $text-main;
}

.count-badge {
  display: inline-block;
  margin-left: 6px;
  background: #e8f3fe;
  color: $primary-dark;
  font-size: 12px;
  padding: 0 8px;
  border-radius: 10px;
}

.readonly-tip {
  font-size: 12px;
  color: $text-secondary;
}

.timeline {
  min-height: 120px;
}

.tl-item {
  display: flex;
  gap: 12px;
}

.tl-axis {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 16px;
  flex-shrink: 0;
}

.tl-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #c8d2df;
  margin-top: 6px;
  flex-shrink: 0;
}

.kind-done .tl-dot {
  background: #34b37c;
}

.kind-progress .tl-dot {
  background: #3f9fef;
}

.kind-pending .tl-dot {
  background: #d98e2b;
}

.kind-cancelled .tl-dot {
  background: #c0c4cc;
}

.tl-line {
  flex: 1;
  width: 2px;
  background: $border-color;
  margin: 2px 0;
}

.tl-body {
  flex: 1;
  padding: 4px 10px 16px;
  border-radius: 6px;
  cursor: pointer;

  &:hover {
    background: #f7fafd;
  }
}

.tl-top {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.tl-time {
  font-size: 12px;
  color: $text-secondary;
  min-width: 118px;
}

.tl-cat {
  font-size: 11px;
  background: #eef4fb;
  color: $primary-dark;
  border-radius: 8px;
  padding: 1px 8px;
}

.tl-title {
  font-size: 14px;
  color: $text-main;
  font-weight: 500;
  margin-top: 4px;
}

.tl-summary {
  font-size: 13px;
  color: $text-regular;
  margin-top: 3px;
  line-height: 1.6;
}

.tl-meta {
  font-size: 12px;
  color: $text-secondary;
  margin-top: 4px;
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
}

.tl-link {
  color: $primary;
}

.empty-state {
  text-align: center;
  color: $text-secondary;
  font-size: 13px;
  padding: 30px 0;

  &.error {
    color: $danger;
  }
}
</style>
