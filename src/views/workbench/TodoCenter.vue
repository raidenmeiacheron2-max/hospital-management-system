<template>
  <div class="app-page todo-center">
    <div class="panel-card">
      <div class="stat-strip">
        <div class="stat-item"><span class="num">{{ stats.total }}</span><span class="lbl">全部待办</span></div>
        <div class="stat-item"><span class="num text-warning">{{ stats.pending }}</span><span class="lbl">未完成</span></div>
        <div class="stat-item"><span class="num text-success">{{ stats.done }}</span><span class="lbl">已完成</span></div>
        <div class="stat-item"><span class="num text-danger">{{ stats.highPending }}</span><span class="lbl">高优先级未完成</span></div>
      </div>
    </div>

    <div class="panel-card">
      <el-form :inline="true" class="search-form" @submit.native.prevent>
        <el-form-item label="状态">
          <el-select v-model="filters.status" placeholder="全部" clearable style="width: 110px">
            <el-option label="未完成" value="未完成" />
            <el-option label="已完成" value="已完成" />
          </el-select>
        </el-form-item>
        <el-form-item label="模块">
          <el-select v-model="filters.module" placeholder="全部" clearable style="width: 130px">
            <el-option v-for="m in modules" :key="m" :label="m" :value="m" />
          </el-select>
        </el-form-item>
        <el-form-item label="优先级">
          <el-select v-model="filters.priority" placeholder="全部" clearable style="width: 100px">
            <el-option label="高" value="高" />
            <el-option label="中" value="中" />
            <el-option label="低" value="低" />
          </el-select>
        </el-form-item>
        <el-form-item label="关键字">
          <el-input v-model.trim="filters.keyword" placeholder="标题/描述" clearable style="width: 160px" />
        </el-form-item>
        <el-form-item label="排序">
          <el-select v-model="sortBy" style="width: 120px">
            <el-option label="截止时间" value="dueDate" />
            <el-option label="优先级" value="priority" />
            <el-option label="创建时间" value="createdAt" />
          </el-select>
          <el-button class="sort-order" @click="sortOrder = sortOrder === 'asc' ? 'desc' : 'asc'">
            <i :class="sortOrder === 'asc' ? 'el-icon-sort-up' : 'el-icon-sort-down'"></i>
          </el-button>
        </el-form-item>
      </el-form>
    </div>

    <div class="panel-card">
      <div class="toolbar-row">
        <div class="toolbar-left">
          <el-button type="primary" icon="el-icon-plus" @click="openCreate">新建待办</el-button>
          <el-button icon="el-icon-refresh" @click="load">刷新</el-button>
        </div>
      </div>

      <div v-if="error" class="empty-state error">{{ error }}</div>
      <el-table v-else v-loading="loading" :data="paged" style="width: 100%; margin-top: 12px">
        <el-table-column label="待办事项" min-width="260">
          <template slot-scope="{ row }">
            <div class="todo-title" :class="{ done: row.status === '已完成' }">{{ row.title }}</div>
            <div v-if="row.description" class="todo-desc">{{ row.description }}</div>
          </template>
        </el-table-column>
        <el-table-column label="模块" width="110">
          <template slot-scope="{ row }">{{ row.module || '—' }}</template>
        </el-table-column>
        <el-table-column label="截止时间" width="120">
          <template slot-scope="{ row }">{{ row.dueDate || '—' }}</template>
        </el-table-column>
        <el-table-column label="优先级" width="150">
          <template slot-scope="{ row }">
            <span class="prio" :class="'p-' + (row.priorityConfirmed || row.prioritySuggested)">{{ row.priorityConfirmed || row.prioritySuggested }}</span>
            <span v-if="row.prioritySuggested" class="prio-tip">建议 {{ row.prioritySuggested }}</span>
            <el-tooltip v-if="row.aiReason" :content="row.aiReason" placement="top">
              <i class="el-icon-info reason-icon"></i>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template slot-scope="{ row }"><StatusTag :label="row.status" /></template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template slot-scope="{ row }">
            <div class="operation-links">
              <el-link type="primary" @click="toggle(row)">{{ row.status === '已完成' ? '恢复' : '完成' }}</el-link>
              <el-link type="primary" @click="openEdit(row)">编辑</el-link>
              <el-link type="danger" @click="remove(row)">删除</el-link>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div class="table-footer">
        <Pagination :total="filtered.length" :page="page" :size="size" @change="onPage" />
      </div>
    </div>

    <el-dialog :title="editing ? '编辑待办' : '新建待办'" :visible.sync="dialogVisible" width="560px" :close-on-click-modal="false">
      <el-form ref="form" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="标题" prop="title">
          <el-input v-model.trim="form.title" placeholder="请输入待办标题" maxlength="60" show-word-limit />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="2" placeholder="补充说明（选填）" maxlength="200" show-word-limit />
        </el-form-item>
        <el-form-item label="关联模块">
          <el-select v-model="form.module" placeholder="请选择关联模块" clearable style="width: 100%">
            <el-option v-for="m in modules" :key="m" :label="m" :value="m" />
          </el-select>
        </el-form-item>
        <el-form-item label="截止时间">
          <el-date-picker v-model="form.dueDate" type="date" placeholder="选择截止日期" value-format="yyyy-MM-dd" style="width: 100%" />
        </el-form-item>
        <el-form-item label="优先级">
          <el-radio-group v-model="form.priorityConfirmed">
            <el-radio label="高">高</el-radio>
            <el-radio label="中">中</el-radio>
            <el-radio label="低">低</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="优先级建议">
          <div class="suggest-row">
            <el-button size="small" icon="el-icon-magic-stick" :loading="suggesting" @click="suggest">AI 建议</el-button>
            <template v-if="suggestion">
              <span class="suggest-result">建议：<b>{{ suggestion.priority }}</b>（{{ suggestion.reason }}）</span>
              <el-button size="small" type="text" @click="applySuggestion">采纳</el-button>
              <el-tag v-if="suggestion.eventId" size="mini" type="info">已审计 {{ suggestion.eventId }}</el-tag>
            </template>
            <span v-else class="text-muted">AI 只读建议：结合截止时间与关联模块排序，采纳后仍需你确认保存</span>
          </div>
          <div v-if="suggestion && suggestion.suggestion" class="suggest-extra">{{ suggestion.suggestion }}</div>
        </el-form-item>
      </el-form>
      <div slot="footer">
        <el-button @click="dialogVisible = false">取 消</el-button>
        <el-button type="primary" :loading="submitting" @click="save">确 定</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import StatusTag from '@/components/StatusTag.vue'
import Pagination from '@/components/Pagination.vue'
import { apiListTodos, apiCreateTodo, apiUpdateTodo, apiDeleteTodo, apiSetTodoStatus, apiSuggestTodoPriority, apiAiRun, apiAiAcceptEvent } from '@/api'

const PRIORITY_ORDER = { 高: 3, 中: 2, 低: 1 }

export default {
  name: 'TodoCenter',
  components: { StatusTag, Pagination },
  data() {
    return {
      loading: false,
      error: '',
      list: [],
      filters: { status: '', module: '', priority: '', keyword: '' },
      sortBy: 'dueDate',
      sortOrder: 'asc',
      page: 1,
      size: 10,
      modules: ['门诊管理', '住院管理', '收费', '患者服务', '基础资料', '系统管理'],
      dialogVisible: false,
      submitting: false,
      suggesting: false,
      editing: null,
      suggestion: null,
      form: this.emptyForm(),
      rules: { title: [{ required: true, message: '请输入待办标题', trigger: 'blur' }] }
    }
  },
  computed: {
    filtered() {
      const f = this.filters
      let arr = this.list.filter((t) => {
        if (f.status && t.status !== f.status) return false
        if (f.module && t.module !== f.module) return false
        if (f.priority && (t.priorityConfirmed || t.prioritySuggested) !== f.priority) return false
        if (f.keyword && (t.title + (t.description || '')).indexOf(f.keyword) === -1) return false
        return true
      })
      const dir = this.sortOrder === 'asc' ? 1 : -1
      arr = arr.slice().sort((a, b) => {
        if (this.sortBy === 'priority') {
          return ((PRIORITY_ORDER[a.priorityConfirmed || a.prioritySuggested] || 0) - (PRIORITY_ORDER[b.priorityConfirmed || b.prioritySuggested] || 0)) * dir
        }
        const av = a[this.sortBy] || (this.sortBy === 'dueDate' ? '9999-99-99' : '')
        const bv = b[this.sortBy] || (this.sortBy === 'dueDate' ? '9999-99-99' : '')
        if (av === bv) return 0
        return av < bv ? -dir : dir
      })
      return arr
    },
    paged() {
      const start = (this.page - 1) * this.size
      return this.filtered.slice(start, start + this.size)
    },
    stats() {
      const total = this.list.length
      const done = this.list.filter((t) => t.status === '已完成').length
      const pending = total - done
      const highPending = this.list.filter((t) => t.status !== '已完成' && (t.priorityConfirmed || t.prioritySuggested) === '高').length
      return { total, done, pending, highPending }
    }
  },
  watch: {
    'filters.status'() { this.page = 1 },
    'filters.module'() { this.page = 1 },
    'filters.priority'() { this.page = 1 },
    'filters.keyword'() { this.page = 1 },
    sortBy() { this.page = 1 },
    sortOrder() { this.page = 1 }
  },
  created() {
    this.load()
  },
  methods: {
    emptyForm() {
      return { title: '', description: '', module: '', dueDate: '', priorityConfirmed: '' }
    },
    async load() {
      this.loading = true
      this.error = ''
      try {
        const res = await apiListTodos({ size: 1000 })
        this.list = (res && res.list) || []
      } catch (e) {
        this.error = e.message || '待办加载失败'
      } finally {
        this.loading = false
      }
    },
    onPage(p) {
      this.page = p.page
      this.size = p.size
    },
    openCreate() {
      this.editing = null
      this.form = this.emptyForm()
      this.suggestion = null
      this.dialogVisible = true
      this.$nextTick(() => this.$refs.form && this.$refs.form.clearValidate())
    },
    openEdit(row) {
      this.editing = row
      this.form = { title: row.title, description: row.description || '', module: row.module || '', dueDate: row.dueDate || '', priorityConfirmed: row.priorityConfirmed || row.prioritySuggested || '' }
      this.suggestion = row.aiReason ? { priority: row.prioritySuggested, reason: row.aiReason } : null
      this.dialogVisible = true
      this.$nextTick(() => this.$refs.form && this.$refs.form.clearValidate())
    },
    async suggest() {
      if (!this.form.title) {
        this.$message.warning('请先填写标题')
        return
      }
      this.suggesting = true
      try {
        // B3/B4：走 AI 服务层（只读建议，写入 aiEvents 审计）
        const r = await apiAiRun('todo.priority', {
          title: this.form.title,
          description: this.form.description,
          dueDate: this.form.dueDate,
          module: this.form.module
        })
        this.suggestion = {
          priority: r.data.priority,
          reason: r.data.reason,
          suggestion: r.data.suggestion,
          eventId: (r.meta && r.meta.eventId) || ''
        }
      } catch (e) {
        // AI 关闭/不可用时回退到数据层同一口径规则（不阻塞业务）
        try {
          const rule = await apiSuggestTodoPriority({ title: this.form.title, dueDate: this.form.dueDate, module: this.form.module })
          this.suggestion = { priority: rule.priority, reason: rule.reason, suggestion: '', eventId: '' }
        } catch (e2) {
          /* 拦截器已提示 */
        }
      } finally {
        this.suggesting = false
      }
    },
    async applySuggestion() {
      if (!this.suggestion) return
      this.form.priorityConfirmed = this.suggestion.priority
      if (this.suggestion.eventId) {
        try {
          await apiAiAcceptEvent(this.suggestion.eventId)
        } catch (e) {
          /* 采纳标记失败不影响业务 */
        }
      }
    },
    save() {
      this.$refs.form.validate(async (valid) => {
        if (!valid || this.submitting) return
        this.submitting = true
        try {
          if (this.editing) {
            await apiUpdateTodo(this.editing.id, this.form)
            this.$message.success('待办已更新')
          } else {
            await apiCreateTodo(this.form)
            this.$message.success('待办已创建')
          }
          this.dialogVisible = false
          await this.load()
        } catch (e) {
          /* 拦截器已提示 */
        } finally {
          this.submitting = false
        }
      })
    },
    async toggle(row) {
      try {
        await apiSetTodoStatus(row.id, row.status === '已完成' ? '未完成' : '已完成')
        this.$message.success('状态已更新')
        await this.load()
      } catch (e) {
        /* 拦截器已提示 */
      }
    },
    remove(row) {
      this.$confirm(`确定删除待办「${row.title}」吗？`, '删除确认', { type: 'warning' })
        .then(async () => {
          await apiDeleteTodo(row.id)
          this.$message.success('已删除')
          await this.load()
        })
        .catch(() => {})
    }
  }
}
</script>

<style lang="scss" scoped>
.stat-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 28px;
  padding: 4px 8px;
}

.stat-item {
  display: flex;
  flex-direction: column;

  .num {
    font-size: 22px;
    font-weight: 700;
    color: $text-main;
  }

  .lbl {
    font-size: 12px;
    color: $text-secondary;
    margin-top: 2px;
  }
}

.todo-title {
  font-size: 14px;
  color: $text-main;

  &.done {
    color: $text-secondary;
    text-decoration: line-through;
  }
}

.todo-desc {
  font-size: 12px;
  color: $text-secondary;
  margin-top: 2px;
}

.prio {
  font-size: 11px;
  border-radius: 8px;
  padding: 1px 7px;

  &.p-高 {
    background: #fde8e8;
    color: #e05656;
  }

  &.p-中 {
    background: #fdf3e3;
    color: #d98e2b;
  }

  &.p-低 {
    background: #f0f2f5;
    color: #909399;
  }
}

.prio-tip {
  font-size: 11px;
  color: $text-secondary;
  margin-left: 6px;
}

.reason-icon {
  color: $text-secondary;
  margin-left: 4px;
  cursor: help;
}

.suggest-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.suggest-result {
  font-size: 13px;
  color: $text-regular;
}

.suggest-extra {
  margin-top: 6px;
  font-size: 12px;
  color: $text-secondary;
  background: #f7fafd;
  border-radius: $radius-sm;
  padding: 6px 9px;
  line-height: 1.6;
}

.sort-order {
  margin-left: 6px;
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
</style>
