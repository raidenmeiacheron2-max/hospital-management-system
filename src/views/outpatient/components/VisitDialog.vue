<template>
  <el-dialog
    :title="mode === 'create' ? '门诊接诊' : '门诊接诊 · 修改'"
    :visible.sync="visibleProxy"
    width="1060px"
    top="4vh"
    :close-on-click-modal="false"
    append-to-body
    @closed="resetForm"
  >
    <div class="visit-dialog-body">
      <el-form ref="form" :model="form" :rules="formRules" label-width="90px">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="挂号记录" prop="regId">
              <el-select
                v-if="mode === 'create'"
                v-model="form.regId"
                placeholder="请选择待接诊挂号"
                style="width: 100%"
                filterable
                :loading="loadingRegs"
                @change="onRegChange"
              >
                <el-option
                  v-for="r in pendingRegs"
                  :key="r.id"
                  :label="`${r.code} · ${r.patientName} · ${r.departmentName} ${r.doctorName}`"
                  :value="r.id"
                />
              </el-select>
              <el-input v-else :value="regText" disabled />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="接诊状态" prop="visitStatus">
              <el-select v-model="form.visitStatus" placeholder="请选择接诊状态" style="width: 100%">
                <el-option label="就诊中" value="就诊中" />
                <el-option label="已完成" value="已完成" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="是否住院" prop="needHospital">
              <el-radio-group v-model="form.needHospital">
                <el-radio label="否">否</el-radio>
                <el-radio label="建议住院">建议住院</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <div class="visit-meta" v-if="mode === 'edit'">
              患者：{{ patientText }} · 医生：{{ doctorText }}
            </div>
          </el-col>
          <el-col :span="24">
            <el-form-item label="主诉" prop="complaint">
              <el-input v-model="form.complaint" type="textarea" :rows="2" placeholder="请输入主诉" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="现病史" prop="history">
              <el-input v-model="form.history" type="textarea" :rows="3" placeholder="请输入现病史" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="诊断" prop="diagnosis">
              <el-input v-model="form.diagnosis" type="textarea" :rows="2" placeholder="请输入诊断结果" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="处理意见" prop="advice">
              <el-input v-model="form.advice" type="textarea" :rows="2" placeholder="请输入处理意见" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>

      <!-- 处方明细 -->
      <div class="detail-section">
        <div class="section-head">
          <span class="section-title">处方明细</span>
          <el-button type="text" icon="el-icon-plus" @click="addPrescription">添加药品</el-button>
        </div>
        <el-table :data="form.prescriptions" size="small" border>
          <el-table-column label="药品" min-width="200">
            <template slot-scope="{ row }">
              <el-select v-model="row.medicineId" placeholder="请选择药品" filterable style="width: 100%" @change="(v) => onMedicineChange(row, v)">
                <el-option v-for="m in medicines" :key="m.id" :label="`${m.name}（${m.spec}）`" :value="m.id" />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column label="用法" width="110">
            <template slot-scope="{ row }">
              <el-select v-model="row.usage" style="width: 100%">
                <el-option v-for="u in usages" :key="u" :label="u" :value="u" />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column label="数量" width="120">
            <template slot-scope="{ row }">
              <el-input-number v-model="row.qty" :min="1" :max="99" size="small" style="width: 100%" />
            </template>
          </el-table-column>
          <el-table-column label="单价" width="100">
            <template slot-scope="{ row }">
              <span v-if="row.priceCents !== null">¥{{ centsToYuan(row.priceCents) }}</span>
              <span v-else class="text-muted">—</span>
            </template>
          </el-table-column>
          <el-table-column label="金额" width="110">
            <template slot-scope="{ row }">
              <span class="amount">¥{{ centsToYuan(row.qty * (row.priceCents || 0)) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="70">
            <template slot-scope="{ $index }">
              <el-link type="danger" @click="removePrescription($index)">删除</el-link>
            </template>
          </el-table-column>
        </el-table>
        <div class="section-total">处方合计：<span class="amount">¥{{ centsToYuan(prescriptionTotal) }}</span></div>
      </div>

      <!-- 医技申请 -->
      <div class="detail-section">
        <div class="section-head">
          <span class="section-title">医技申请</span>
          <el-button type="text" icon="el-icon-plus" @click="addExam">添加项目</el-button>
        </div>
        <el-table :data="form.exams" size="small" border>
          <el-table-column label="检验检查项目" min-width="240">
            <template slot-scope="{ row }">
              <el-select v-model="row.examItemId" placeholder="请选择项目" filterable style="width: 100%" @change="(v) => onExamChange(row, v)">
                <el-option v-for="e in examItems" :key="e.id" :label="`${e.name}（${e.category}）`" :value="e.id" />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column label="数量" width="120">
            <template slot-scope="{ row }">
              <el-input-number v-model="row.qty" :min="1" :max="99" size="small" style="width: 100%" />
            </template>
          </el-table-column>
          <el-table-column label="单价" width="110">
            <template slot-scope="{ row }">
              <span v-if="row.priceCents !== null">¥{{ centsToYuan(row.priceCents) }}</span>
              <span v-else class="text-muted">—</span>
            </template>
          </el-table-column>
          <el-table-column label="金额" width="110">
            <template slot-scope="{ row }">
              <span class="amount">¥{{ centsToYuan(row.qty * (row.priceCents || 0)) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="70">
            <template slot-scope="{ $index }">
              <el-link type="danger" @click="removeExam($index)">删除</el-link>
            </template>
          </el-table-column>
        </el-table>
        <div class="section-total">医技合计：<span class="amount">¥{{ centsToYuan(examTotal) }}</span></div>
      </div>

      <div class="grand-total">
        费用合计：<span class="amount">¥{{ centsToYuan(prescriptionTotal + examTotal) }}</span>
      </div>
    </div>

    <div slot="footer">
      <el-button @click="close">取 消</el-button>
      <el-button type="primary" :loading="submitting" @click="submit">确 定</el-button>
    </div>
  </el-dialog>
</template>

<script>
import { apiCreateVisit, apiUpdateVisit, apiListRegistrations, apiOptions } from '@/api'
import { centsToYuan } from '@/utils/money'
import { isPositiveInt } from '@/utils/validate'

export default {
  name: 'VisitDialog',
  props: {
    visible: { type: Boolean, default: false },
    mode: { type: String, default: 'create' },
    visit: { type: Object, default: null }
  },
  data() {
    return {
      submitting: false,
      loadingRegs: false,
      pendingRegs: [],
      medicines: [],
      examItems: [],
      usages: ['口服', '外用', '静脉注射', '雾化吸入', '肌内注射'],
      form: this.emptyForm(),
      formRules: {
        regId: [{ required: true, message: '请选择挂号记录', trigger: 'change' }],
        visitStatus: [{ required: true, message: '请选择接诊状态', trigger: 'change' }],
        complaint: [{ required: true, message: '请输入主诉', trigger: 'blur' }],
        history: [{ required: true, message: '请输入现病史', trigger: 'blur' }],
        diagnosis: [{ required: true, message: '请输入诊断结果', trigger: 'blur' }],
        advice: [{ required: true, message: '请输入处理意见', trigger: 'blur' }]
      }
    }
  },
  computed: {
    visibleProxy: {
      get() {
        return this.visible
      },
      set(v) {
        this.$emit('update:visible', v)
      }
    },
    regText() {
      const v = this.visit || {}
      return `${v.regCode || ''} · ${v.patientName || ''}`
    },
    patientText() {
      const v = this.visit || {}
      return `${v.patientName || '—'}（${v.patientGender || ''}）`
    },
    doctorText() {
      const v = this.visit || {}
      return `${v.doctorName || '—'} · ${v.departmentName || ''}`
    },
    prescriptionTotal() {
      return this.form.prescriptions.reduce((a, x) => a + (Number(x.qty) || 0) * (x.priceCents || 0), 0)
    },
    examTotal() {
      return this.form.exams.reduce((a, x) => a + (Number(x.qty) || 0) * (x.priceCents || 0), 0)
    }
  },
  watch: {
    visible(v) {
      if (v) this.init()
    }
  },
  created() {
    this.loadOptions()
  },
  methods: {
    centsToYuan,
    emptyForm() {
      return {
        regId: '',
        visitStatus: '就诊中',
        needHospital: '否',
        complaint: '',
        history: '',
        diagnosis: '',
        advice: '',
        prescriptions: [],
        exams: []
      }
    },
    async loadOptions() {
      const [meds, exams] = await Promise.all([apiOptions('medicines'), apiOptions('exam-items')])
      this.medicines = meds
      this.examItems = exams
    },
    async init() {
      this.submitting = false
      if (this.mode === 'create') {
        this.form = this.emptyForm()
        this.loadPendingRegs()
      } else {
        const v = this.visit || {}
        this.form = {
          regId: v.regId,
          visitStatus: v.visitStatus,
          needHospital: v.needHospital === '建议住院' ? '建议住院' : '否',
          complaint: v.complaint || '',
          history: v.history || '',
          diagnosis: v.diagnosis || '',
          advice: v.advice || '',
          prescriptions: (v.prescriptions || []).map((p) => ({
            medicineId: p.medicineId,
            usage: p.usage,
            qty: p.qty,
            priceCents: p.priceCents
          })),
          exams: (v.exams || []).map((e) => ({ examItemId: e.examItemId, qty: e.qty, priceCents: e.priceCents }))
        }
      }
      this.$nextTick(() => this.$refs.form && this.$refs.form.clearValidate())
    },
    async loadPendingRegs() {
      this.loadingRegs = true
      try {
        const res = await apiListRegistrations({ regStatus: '待分诊', size: 1000 })
        this.pendingRegs = res.list.filter((r) => !r.visitId)
      } finally {
        this.loadingRegs = false
      }
    },
    onRegChange() {
      /* 保持简单：挂号记录只用于建立关联 */
    },
    addPrescription() {
      this.form.prescriptions.push({ medicineId: '', usage: '口服', qty: 1, priceCents: null })
    },
    removePrescription(i) {
      this.form.prescriptions.splice(i, 1)
    },
    onMedicineChange(row, id) {
      const med = this.medicines.find((m) => m.id === id)
      row.priceCents = med ? med.priceCents : null
    },
    addExam() {
      this.form.exams.push({ examItemId: '', qty: 1, priceCents: null })
    },
    removeExam(i) {
      this.form.exams.splice(i, 1)
    },
    onExamChange(row, id) {
      const item = this.examItems.find((e) => e.id === id)
      row.priceCents = item ? item.priceCents : null
    },
    validateItems() {
      for (const p of this.form.prescriptions) {
        if (!p.medicineId) return '请选择处方药品'
        if (!isPositiveInt(p.qty)) return '药品数量须为正整数'
      }
      for (const e of this.form.exams) {
        if (!e.examItemId) return '请选择医技项目'
        if (!isPositiveInt(e.qty)) return '项目数量须为正整数'
      }
      return null
    },
    submit() {
      this.$refs.form.validate(async (valid) => {
        if (!valid || this.submitting) return
        const itemErr = this.validateItems()
        if (itemErr) {
          this.$message.error(itemErr)
          return
        }
        this.submitting = true
        try {
          if (this.mode === 'create') {
            await apiCreateVisit(this.form)
            this.$message.success('接诊保存成功')
          } else {
            await apiUpdateVisit(this.visit.id, this.form)
            this.$message.success('接诊更新成功')
          }
          this.$emit('saved')
          this.close()
        } catch (e) {
          /* 拦截器已提示 */
        } finally {
          this.submitting = false
        }
      })
    },
    close() {
      this.visibleProxy = false
    },
    resetForm() {
      this.form = this.emptyForm()
    }
  }
}
</script>

<style lang="scss" scoped>
.visit-dialog-body {
  max-height: 68vh;
  overflow-y: auto;
  padding-right: 4px;
}

.visit-meta {
  height: 36px;
  line-height: 36px;
  color: $text-secondary;
  font-size: 13px;
}

.detail-section {
  margin-top: 6px;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  padding: 12px;
}

.section-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: $text-main;
}

.section-total {
  text-align: right;
  margin-top: 8px;
  font-size: 13px;
  color: $text-regular;
}

.grand-total {
  text-align: right;
  margin-top: 10px;
  font-size: 15px;
  font-weight: 600;
  color: $text-main;
}

.amount {
  color: $danger;
  font-weight: 600;
}
</style>
