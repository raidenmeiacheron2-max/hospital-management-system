<template>
  <div class="app-page">
    <div class="panel-card">
      <el-form :inline="true" class="search-form" @submit.native.prevent="handleSearch">
        <el-form-item label="所属病区">
          <el-select v-model="filters.wardId" placeholder="请选择病区" clearable filterable>
            <el-option v-for="w in wards" :key="w.id" :label="w.name" :value="w.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="床位号">
          <el-input v-model.trim="filters.code" placeholder="请输入床位号" clearable @keyup.enter.native="handleSearch" />
        </el-form-item>
        <el-form-item label="床位类型">
          <el-select v-model="filters.type" placeholder="请选择床位类型" clearable>
            <el-option label="普通床" value="普通床" />
            <el-option label="加床" value="加床" />
          </el-select>
        </el-form-item>
        <el-form-item label="床位状态">
          <el-select v-model="filters.status" placeholder="请选择床位状态" clearable>
            <el-option label="空闲" value="空闲" />
            <el-option label="占用" value="占用" />
          </el-select>
        </el-form-item>
        <el-form-item label="启用状态">
          <el-select v-model="filters.enabled" placeholder="请选择启用状态" clearable>
            <el-option label="正常" value="1" />
            <el-option label="停用" value="0" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" icon="el-icon-search" @click="handleSearch">搜索</el-button>
          <el-button icon="el-icon-refresh-left" @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <div class="panel-card">
      <div class="toolbar-row">
        <div class="toolbar-left">
          <el-button type="primary" icon="el-icon-plus" @click="openDialog()">新增</el-button>
          <el-button icon="el-icon-delete" :disabled="!selection.length" @click="batchDelete">删除</el-button>
          <el-button icon="el-icon-download" @click="exportCsv">导出</el-button>
        </div>
        <div class="toolbar-right">
          <span v-if="selection.length" class="text-muted">已选 {{ selection.length }} 项</span>
        </div>
      </div>

      <el-table
        v-loading="loading"
        :data="list"
        style="width: 100%; margin-top: 12px"
        @selection-change="(rows) => (selection = rows)"
      >
        <el-table-column type="selection" width="46" />
        <el-table-column prop="wardName" label="所属病区" min-width="120" />
        <el-table-column prop="code" label="床位号" min-width="100" />
        <el-table-column prop="type" label="床位类型" min-width="100" />
        <el-table-column label="床位状态" min-width="100">
          <template slot-scope="{ row }">
            <StatusTag :label="row.status" />
          </template>
        </el-table-column>
        <el-table-column label="启用状态" min-width="100">
          <template slot-scope="{ row }">
            <StatusTag :label="row.enabled ? '正常' : '停用'" />
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="120">
          <template slot-scope="{ row }">{{ row.remark || '—' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template slot-scope="{ row }">
            <div class="operation-links">
              <el-link type="primary" @click="openDialog(row)">修改</el-link>
              <el-link type="danger" @click="removeRow(row)">删除</el-link>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div class="table-footer">
        <Pagination :total="total" :page="query.page" :size="query.size" @change="handlePageChange" />
      </div>
    </div>

    <el-dialog :title="editing ? '修改床位' : '新增床位'" :visible.sync="dialogVisible" width="480px" :close-on-click-modal="false">
      <el-form ref="form" :model="form" :rules="formRules" label-width="90px">
        <el-form-item label="所属病区" prop="wardId">
          <el-select v-model="form.wardId" placeholder="请选择病区" style="width: 100%" filterable @change="form.code = ''">
            <el-option v-for="w in wards" :key="w.id" :label="w.name" :value="w.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="床位号" prop="code">
          <el-input v-model.trim="form.code" placeholder="如 A01" />
        </el-form-item>
        <el-form-item label="床位类型" prop="type">
          <el-select v-model="form.type" style="width: 100%">
            <el-option label="普通床" value="普通床" />
            <el-option label="加床" value="加床" />
          </el-select>
        </el-form-item>
        <el-form-item label="启用状态">
          <el-select v-model="form.enabled" style="width: 100%">
            <el-option label="正常" :value="1" />
            <el-option label="停用" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model.trim="form.remark" type="textarea" :rows="2" placeholder="选填" />
        </el-form-item>
      </el-form>
      <div slot="footer">
        <el-button @click="dialogVisible = false">取 消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitForm">确 定</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import listPage from '@/mixins/listPage'
import StatusTag from '@/components/StatusTag.vue'
import Pagination from '@/components/Pagination.vue'
import { apiListBeds, apiCreateBed, apiUpdateBed, apiDeleteBed, apiOptions } from '@/api'
import { exportCsv } from '@/utils/csv'

export default {
  name: 'BedList',
  components: { StatusTag, Pagination },
  mixins: [listPage],
  data() {
    return {
      filters: { wardId: '', code: '', type: '', status: '', enabled: '' },
      wards: [],
      selection: [],
      dialogVisible: false,
      submitting: false,
      editing: null,
      form: this.emptyForm(),
      formRules: {
        wardId: [{ required: true, message: '请选择所属病区', trigger: 'change' }],
        code: [{ required: true, message: '请输入床位号', trigger: 'blur' }],
        type: [{ required: true, message: '请选择床位类型', trigger: 'change' }]
      }
    }
  },
  created() {
    this.fetchData()
    this.loadOptions()
  },
  methods: {
    emptyForm() {
      return { wardId: '', code: '', type: '普通床', enabled: 1, remark: '' }
    },
    async loadOptions() {
      this.wards = await apiOptions('wards')
    },
    buildParams() {
      const p = { page: this.query.page, size: this.query.size }
      Object.keys(this.filters).forEach((k) => {
        if (this.filters[k] !== '' && this.filters[k] !== null) p[k] = this.filters[k]
      })
      return p
    },
    async fetchData() {
      this.loading = true
      try {
        const res = await apiListBeds(this.buildParams())
        this.list = res.list
        this.total = res.total
      } finally {
        this.loading = false
      }
    },
    resetFilters() {
      this.filters = { wardId: '', code: '', type: '', status: '', enabled: '' }
      this.handleSearch()
    },
    openDialog(row) {
      this.editing = row || null
      this.form = row
        ? { wardId: row.wardId, code: row.code, type: row.type, enabled: row.enabled, remark: row.remark }
        : this.emptyForm()
      this.dialogVisible = true
      this.$nextTick(() => this.$refs.form && this.$refs.form.clearValidate())
    },
    submitForm() {
      this.$refs.form.validate(async (valid) => {
        if (!valid || this.submitting) return
        this.submitting = true
        try {
          if (this.editing) {
            await apiUpdateBed(this.editing.id, this.form)
            this.$message.success('修改成功')
          } else {
            await apiCreateBed(this.form)
            this.$message.success('新增成功')
          }
          this.dialogVisible = false
          this.fetchData()
        } catch (e) {
          /* 拦截器已提示 */
        } finally {
          this.submitting = false
        }
      })
    },
    removeRow(row) {
      this.$confirm(`确定删除床位「${row.wardName} ${row.code}」吗？`, '删除确认', { type: 'warning' })
        .then(async () => {
          await apiDeleteBed(row.id)
          this.$message.success('删除成功')
          this.afterDelete()
        })
        .catch(() => {})
    },
    batchDelete() {
      const codes = this.selection.map((r) => r.code).join('、')
      this.$confirm(`确定删除选中的床位（${codes}）吗？`, '批量删除确认', { type: 'warning' })
        .then(async () => {
          let failCount = 0
          for (const row of this.selection) {
            try {
              await apiDeleteBed(row.id)
            } catch (e) {
              failCount++
            }
          }
          this.$message.success(`删除完成${failCount ? `，${failCount} 条未删除（占用/被引用）` : ''}`)
          this.afterDelete()
        })
        .catch(() => {})
    },
    async exportCsv() {
      const res = await apiListBeds({ ...this.buildParams(), page: 1, size: Math.min(this.total || 1000, 5000) })
      exportCsv(
        `床位列表_${new Date().toISOString().slice(0, 10)}`,
        [
          { label: '所属病区', key: 'wardName' },
          { label: '床位号', key: 'code' },
          { label: '床位类型', key: 'type' },
          { label: '床位状态', key: 'status' },
          { label: '启用状态', key: 'enabledText' },
          { label: '备注', key: 'remark' }
        ],
        res.list.map((r) => ({ ...r, enabledText: r.enabled ? '正常' : '停用' }))
      )
      this.$message.success('已导出当前筛选结果')
    }
  }
}
</script>
