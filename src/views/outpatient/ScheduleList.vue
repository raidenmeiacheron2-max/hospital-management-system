<template>
  <div class="app-page">
    <div class="panel-card">
      <div class="toolbar-row">
        <div class="toolbar-left">
          <el-date-picker
            v-model="range"
            type="daterange"
            value-format="yyyy-MM-dd"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
          />
          <el-button type="primary" plain icon="el-icon-view" @click="viewWeek">查看周次</el-button>
          <el-button icon="el-icon-refresh" @click="fetchData">刷新排班</el-button>
        </div>
      </div>
    </div>

    <el-row :gutter="12" v-loading="loading">
      <el-col v-for="dep in departments" :key="dep.id" :xs="12" :sm="8" :md="6" class="dep-col">
        <div class="dep-card">
          <div class="dep-head">
            <span class="dep-icon"><i class="el-icon-office-building"></i></span>
            <div class="dep-title">
              <div class="dep-name">{{ dep.name }}</div>
              <div class="dep-code">科室编号：{{ dep.code }}</div>
            </div>
          </div>
          <div class="dep-stats">
            <div class="dep-stat">
              <div class="num">{{ scheduleStats[dep.id].total }}</div>
              <div class="label">本周排班</div>
            </div>
            <div class="dep-stat">
              <div class="num">{{ scheduleStats[dep.id].doctors }}</div>
              <div class="label">出诊医生</div>
            </div>
          </div>
          <div class="dep-actions">
            <el-button size="small" @click="openDetail(dep)">查看详情</el-button>
            <el-button size="small" type="primary" plain @click="openSchedule(dep)">排班</el-button>
          </div>
        </div>
      </el-col>
    </el-row>

    <!-- 科室排班详情 -->
    <el-dialog :title="`${detailDep.name} 排班详情（${range[0]} ~ ${range[1]}）`" :visible.sync="detailVisible" width="760px">
      <el-table :data="detailList" size="small" max-height="420">
        <el-table-column prop="date" label="日期" width="120">
          <template slot-scope="{ row }">{{ row.date }} ({{ weekday(row.date) }})</template>
        </el-table-column>
        <el-table-column prop="period" label="时段" width="90" />
        <el-table-column prop="doctorName" label="出诊医生" min-width="120" />
        <el-table-column prop="limit" label="号源上限" width="90" />
        <el-table-column prop="regCount" label="已挂号" width="90" />
        <el-table-column label="操作" width="140">
          <template slot-scope="{ row }">
            <div class="operation-links">
              <el-link type="primary" @click="openSchedule(detailDep, row)">修改</el-link>
              <el-link type="danger" @click="removeSchedule(row)">删除</el-link>
            </div>
          </template>
        </el-table-column>
      </el-table>
      <div slot="footer">
        <el-button type="primary" plain @click="openSchedule(detailDep)">新增排班</el-button>
        <el-button @click="detailVisible = false">关 闭</el-button>
      </div>
    </el-dialog>

    <!-- 排班编辑 -->
    <el-dialog :title="editingSchedule ? '修改排班' : '新增排班'" :visible.sync="scheduleVisible" width="460px" :close-on-click-modal="false">
      <el-form ref="form" :model="form" :rules="formRules" label-width="90px">
        <el-form-item label="科室">
          <el-input :value="currentDep.name" disabled />
        </el-form-item>
        <el-form-item label="出诊医生" prop="doctorId">
          <el-select v-model="form.doctorId" placeholder="请选择医生" style="width: 100%" filterable>
            <el-option v-for="d in depDoctors" :key="d.id" :label="`${d.code} ${d.name}`" :value="d.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="排班日期" prop="date">
          <el-date-picker v-model="form.date" type="date" placeholder="选择日期" value-format="yyyy-MM-dd" style="width: 100%" />
        </el-form-item>
        <el-form-item label="时段" prop="period">
          <el-select v-model="form.period" placeholder="请选择时段" style="width: 100%">
            <el-option label="上午" value="上午" />
            <el-option label="下午" value="下午" />
          </el-select>
        </el-form-item>
        <el-form-item label="号源上限" prop="limit">
          <el-input-number v-model="form.limit" :min="1" :max="200" style="width: 100%" />
        </el-form-item>
      </el-form>
      <div slot="footer">
        <el-button @click="scheduleVisible = false">取 消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitSchedule">确 定</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import { apiListSchedules, apiCreateSchedule, apiUpdateSchedule, apiDeleteSchedule, apiOptions, apiStats } from '@/api'
import { weekdayCN } from '@/utils/date'

export default {
  name: 'ScheduleList',
  data() {
    return {
      loading: false,
      range: ['2026-08-17', '2026-08-21'],
      demoToday: '2026-08-28',
      departments: [],
      doctors: [],
      schedules: [],
      detailVisible: false,
      detailDep: {},
      scheduleVisible: false,
      submitting: false,
      currentDep: {},
      editingSchedule: null,
      form: this.emptyForm(),
      formRules: {
        doctorId: [{ required: true, message: '请选择出诊医生', trigger: 'change' }],
        date: [{ required: true, message: '请选择排班日期', trigger: 'change' }],
        period: [{ required: true, message: '请选择时段', trigger: 'change' }]
      }
    }
  },
  computed: {
    scheduleStats() {
      const map = {}
      this.departments.forEach((d) => {
        map[d.id] = { total: 0, doctors: 0 }
      })
      const docSet = {}
      this.schedules.forEach((s) => {
        if (!map[s.departmentId]) map[s.departmentId] = { total: 0, doctors: 0 }
        map[s.departmentId].total++
        if (!docSet[s.departmentId]) docSet[s.departmentId] = new Set()
        docSet[s.departmentId].add(s.doctorId)
      })
      Object.keys(docSet).forEach((k) => {
        if (map[k]) map[k].doctors = docSet[k].size
      })
      return map
    },
    detailList() {
      if (!this.detailDep.id) return []
      return this.schedules
        .filter((s) => s.departmentId === this.detailDep.id)
        .sort((a, b) => (a.date === b.date ? (a.period === '上午' ? -1 : 1) : a.date < b.date ? -1 : 1))
    },
    depDoctors() {
      return this.doctors.filter((d) => !d.departmentId || d.departmentId === this.currentDep.id)
    }
  },
  watch: {
    range() {
      if (this.range && this.range.length === 2) this.fetchData()
    }
  },
  created() {
    this.loadOptions()
    this.fetchData()
  },
  methods: {
    weekday: weekdayCN,
    emptyForm() {
      return { doctorId: '', date: '', period: '上午', limit: 30 }
    },
    async loadOptions() {
      const [deps, docs, stats] = await Promise.all([apiOptions('departments'), apiOptions('doctors'), apiStats()])
      this.departments = deps
      this.doctors = docs
      this.demoToday = stats.today
    },
    async fetchData() {
      if (!this.range || this.range.length !== 2) return
      this.loading = true
      try {
        const res = await apiListSchedules({ start: this.range[0], end: this.range[1], size: 10000 })
        this.schedules = res.list
      } finally {
        this.loading = false
      }
    },
    viewWeek() {
      const d = new Date(this.demoToday + 'T00:00:00')
      const day = d.getDay() || 7
      const monday = new Date(d)
      monday.setDate(d.getDate() - (day - 1))
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)
      const fmt = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
      this.range = [fmt(monday), fmt(sunday)]
    },
    openDetail(dep) {
      this.detailDep = dep
      this.detailVisible = true
    },
    openSchedule(dep, row) {
      this.currentDep = dep
      this.editingSchedule = row || null
      this.form = row ? { doctorId: row.doctorId, date: row.date, period: row.period, limit: row.limit } : this.emptyForm()
      this.scheduleVisible = true
      this.$nextTick(() => this.$refs.form && this.$refs.form.clearValidate())
    },
    submitSchedule() {
      this.$refs.form.validate(async (valid) => {
        if (!valid || this.submitting) return
        this.submitting = true
        try {
          const payload = { ...this.form, departmentId: this.currentDep.id }
          if (this.editingSchedule) {
            await apiUpdateSchedule(this.editingSchedule.id, payload)
            this.$message.success('排班已更新')
          } else {
            await apiCreateSchedule(payload)
            this.$message.success('排班成功')
          }
          this.scheduleVisible = false
          this.fetchData()
        } catch (e) {
          /* 冲突等错误由拦截器提示 */
        } finally {
          this.submitting = false
        }
      })
    },
    removeSchedule(row) {
      this.$confirm(`确定删除 ${row.date} ${row.period} 「${row.doctorName}」的排班吗？`, '删除确认', { type: 'warning' })
        .then(async () => {
          await apiDeleteSchedule(row.id)
          this.$message.success('删除成功')
          this.fetchData()
        })
        .catch(() => {})
    }
  }
}
</script>

<style lang="scss" scoped>
.dep-col {
  margin-bottom: 12px;
}

.dep-card {
  background: $card-bg;
  border: 1px solid $border-light;
  border-radius: $radius-md;
  box-shadow: $shadow-card;
  padding: 16px;
  transition: box-shadow 0.2s;

  &:hover {
    box-shadow: 0 4px 14px rgba(28, 31, 46, 0.1);
  }
}

.dep-head {
  display: flex;
  align-items: center;
  margin-bottom: 14px;
}

.dep-icon {
  width: 42px;
  height: 42px;
  border-radius: 10px;
  background: $primary-lighter;
  color: $primary;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  margin-right: 10px;
  flex-shrink: 0;
}

.dep-name {
  font-size: 15px;
  font-weight: 600;
  color: $text-main;
}

.dep-code {
  font-size: 12px;
  color: $text-secondary;
  margin-top: 2px;
}

.dep-stats {
  display: flex;
  border-top: 1px solid $border-light;
  border-bottom: 1px solid $border-light;
  padding: 10px 0;
  margin-bottom: 12px;
}

.dep-stat {
  flex: 1;
  text-align: center;

  & + .dep-stat {
    border-left: 1px solid $border-light;
  }

  .num {
    font-size: 20px;
    font-weight: 700;
    color: $primary-dark;
  }

  .label {
    font-size: 12px;
    color: $text-secondary;
    margin-top: 2px;
  }
}

.dep-actions {
  display: flex;
  gap: 8px;
}
</style>
