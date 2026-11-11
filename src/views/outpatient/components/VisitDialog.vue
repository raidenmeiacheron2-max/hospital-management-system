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

      <!-- AI 病历结构化建议（B4）：仅建议，不覆盖原文，不直接写库 -->
      <div class="ai-structure-panel">
        <div class="section-head">
          <span class="section-title"><i class="el-icon-magic-stick"></i> AI 病历结构化建议</span>
          <el-button type="primary" plain size="small" icon="el-icon-cpu" :loading="aiLoading" @click="runStructure">
            解析当前文本
          </el-button>
        </div>
        <div class="ai-hint">
          基于本地确定性规则引擎，将主诉/现病史/诊断/处理意见解析为结构化建议；原文只读保留、不覆盖，保存仍需点击下方“确定”并走原有业务校验。
        </div>

        <el-alert v-if="aiError" type="warning" :closable="false" :title="aiError" show-icon class="ai-alert"></el-alert>

        <template v-if="aiResult">
          <div class="ai-chips">
            <div class="chip-row">
              <span class="chip-label">症状</span>
              <template v-if="(aiResult.symptoms || []).length">
                <el-tag v-for="(s, i) in aiResult.symptoms" :key="'s' + i" size="mini" class="chip">{{ s }}</el-tag>
              </template>
              <span v-else class="chip-empty">未识别</span>
            </div>
            <div class="chip-row">
              <span class="chip-label">病程</span>
              <el-tag v-if="aiResult.duration" size="mini" class="chip">{{ aiResult.duration }}</el-tag>
              <span v-else class="chip-empty">未识别</span>
            </div>
            <div class="chip-row">
              <span class="chip-label">诱因</span>
              <template v-if="(aiResult.triggers || []).length">
                <el-tag v-for="(s, i) in aiResult.triggers" :key="'t' + i" size="mini" class="chip">{{ s }}</el-tag>
              </template>
              <span v-else class="chip-empty">未识别</span>
            </div>
            <div class="chip-row">
              <span class="chip-label">过敏</span>
              <el-tag v-if="aiResult.allergy" size="mini" type="danger" class="chip">{{ aiResult.allergy }}</el-tag>
              <span v-else class="chip-empty">未识别</span>
            </div>
            <div class="chip-row">
              <span class="chip-label">诊断关键词</span>
              <template v-if="(aiResult.diagKeywords || []).length">
                <el-tag v-for="(s, i) in aiResult.diagKeywords" :key="'d' + i" size="mini" type="success" class="chip">{{ s }}</el-tag>
              </template>
              <span v-else class="chip-empty">未识别</span>
            </div>
            <div class="chip-row">
              <span class="chip-label">风险提示</span>
              <template v-if="(aiResult.riskFlags || []).length">
                <el-tag v-for="(s, i) in aiResult.riskFlags" :key="'r' + i" size="mini" type="danger" class="chip">{{ s }}</el-tag>
              </template>
              <span v-else class="chip-empty">未识别</span>
            </div>
          </div>

          <div class="ai-note">{{ aiResult.note }}</div>
          <AiMetaBar :meta="aiMeta"></AiMetaBar>
          <div class="ai-actions">
            <el-button type="primary" size="mini" icon="el-icon-check" @click="applyStructure">
              应用建议（仅追加诊断关键词）
            </el-button>
            <el-button size="mini" :disabled="aiAccepted" icon="el-icon-collection-tag" @click="acceptStructure">
              {{ aiAccepted ? '已标记采纳' : '标记采纳' }}
            </el-button>
            <span class="ai-actions-hint">应用后仍需点击下方“确定”保存，AI 不直接写库。</span>
          </div>
          <el-alert v-if="aiApplyHint" :type="aiApplyHintType" :closable="false" :title="aiApplyHint" show-icon class="ai-alert"></el-alert>
          <AiDisclaimer :disclaimers="aiResult.disclaimers || []"></AiDisclaimer>
        </template>
        <div v-else-if="!aiLoading && !aiError" class="ai-empty">
          尚未解析。点击“解析当前文本”生成结构化建议（演示用途，非诊疗结论）。
        </div>
      </div>
    </div>

    <div slot="footer">
      <el-button @click="close">取 消</el-button>
      <el-button type="primary" :loading="submitting" @click="submit">确 定</el-button>
    </div>
  </el-dialog>
</template>

<script>
import { MessageBox } from 'element-ui'
import AiDisclaimer from '@/components/AiDisclaimer.vue'
import AiMetaBar from '@/components/AiMetaBar.vue'
import { apiCreateVisit, apiUpdateVisit, apiListRegistrations, apiOptions, apiAiRun, apiAiAcceptEvent } from '@/api'
import { centsToYuan } from '@/utils/money'
import { isPositiveInt } from '@/utils/validate'

export default {
  name: 'VisitDialog',
  components: { AiDisclaimer, AiMetaBar },
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
      // AI 病历结构化建议（B4）：仅建议，不覆盖原文、不直接写库
      aiLoading: false,
      aiResult: null,
      aiMeta: {},
      aiError: '',
      aiAccepted: false,
      aiApplyHint: '',
      aiApplyHintType: 'info',
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
      this.resetAi()
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
    resetAi() {
      this.aiLoading = false
      this.aiResult = null
      this.aiMeta = {}
      this.aiError = ''
      this.aiAccepted = false
      this.aiApplyHint = ''
      this.aiApplyHintType = 'info'
    },
    async runStructure() {
      this.aiLoading = true
      this.aiError = ''
      this.aiResult = null
      this.aiMeta = {}
      this.aiAccepted = false
      this.aiApplyHint = ''
      this.aiApplyHintType = 'info'
      try {
        const res = await apiAiRun('record.structure', {
          complaint: this.form.complaint,
          history: this.form.history,
          diagnosis: this.form.diagnosis,
          advice: this.form.advice
        })
        if (res && res.data) {
          this.aiResult = res.data
          this.aiMeta = res.meta || {}
        } else {
          this.aiError = '未获得结构化建议，请稍后重试（不影响原有保存流程）。'
        }
      } catch (e) {
        // 解析失败不阻塞原有创建/编辑/提交流程
        this.aiError = (e && e.message) || '解析失败，请稍后重试（不影响原有保存流程）。'
      } finally {
        this.aiLoading = false
      }
    },
    async applyStructure() {
      const result = this.aiResult || {}
      const keywords = (result.diagKeywords || []).filter((k) => typeof k === 'string' && k)
      if (!keywords.length) {
        this.aiApplyHintType = 'warning'
        this.aiApplyHint = '本次解析未识别到诊断关键词，未做修改。可先完善主诉/现病史/诊断文本后重新解析。'
        this.$message.warning('本次解析未识别到诊断关键词，未做修改。')
        return
      }
      const current = String(this.form.diagnosis || '')
      const missing = keywords.filter((k) => current.indexOf(k) === -1)
      if (!missing.length) {
        // 诊断关键词由诊断原文提取，正常流程下通常已全部包含：给出明确、持久的反馈，避免“点击无变化”
        this.aiApplyHintType = 'info'
        this.aiApplyHint =
          '诊断中已包含全部 ' + keywords.length + ' 个关键词（' + keywords.join('、') + '），无需追加，原文保持不变。' +
          '如需调整诊断，请直接编辑诊断文本后点击“确定”保存（走原有校验）。'
        this.$message.info('诊断中已包含全部关键词，无需追加。')
        return
      }
      try {
        await MessageBox.confirm(
          '将把 ' + missing.length + ' 个诊断关键词追加到“诊断”字段末尾（使用“；”分隔）：' +
            missing.join('；') +
            '。仅追加、不覆盖原文；保存仍需点击原有“确定”按钮并走原业务校验。',
          '应用 AI 结构化建议',
          { confirmButtonText: '确认追加', cancelButtonText: '取消', type: 'warning' }
        )
      } catch (e) {
        this.aiApplyHintType = 'info'
        this.aiApplyHint = '已取消追加，原文保持不变。'
        return
      }
      this.form.diagnosis = current ? current + '；' + missing.join('；') : missing.join('；')
      this.aiApplyHintType = 'success'
      this.aiApplyHint =
        '已追加 ' + missing.length + ' 个诊断关键词到“诊断”表单（' + missing.join('、') + '），尚未保存；请核对后点击“确定”保存，保存仍走原有业务校验。'
      this.$message.success('已追加到诊断（尚未保存），请核对后点击“确定”保存')
    },
    async acceptStructure() {
      const eventId = (this.aiMeta && this.aiMeta.eventId) || ''
      if (!eventId) {
        this.aiApplyHintType = 'warning'
        this.aiApplyHint = '未找到可标记的 AI 审计事件，未记录采纳。'
        this.$message.warning('未找到可标记的 AI 审计事件')
        return
      }
      try {
        await apiAiAcceptEvent(eventId)
        this.aiAccepted = true
        this.aiApplyHintType = 'success'
        this.aiApplyHint = '已标记采纳（仅记录 AI 审计，不修改任何业务数据）；病历保存仍需点击“确定”并走原有校验。'
        this.$message.success('已标记采纳（仅记录审计，不改动业务数据）')
      } catch (e) {
        this.aiApplyHintType = 'warning'
        this.aiApplyHint = '采纳标记失败，不影响病历内容与原有保存流程。'
        this.$message.warning('采纳标记失败，不影响病历内容与原有保存流程')
      }
    },
    resetForm() {
      this.form = this.emptyForm()
      this.resetAi()
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

// ---------- AI 病历结构化建议面板（B4） ----------
.ai-structure-panel {
  margin-top: 12px;
  border: 1px dashed lighten($primary, 16%);
  background: #f8fbff;
  border-radius: $radius-md;
  padding: 12px;

  .section-title i {
    color: $primary;
    margin-right: 4px;
  }
}

.ai-hint {
  font-size: 12px;
  color: $text-secondary;
  line-height: 1.7;
  margin-bottom: 8px;
}

.ai-alert {
  margin-bottom: 8px;
}

.ai-chips {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.chip-row {
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 12px;
}

.chip-label {
  width: 72px;
  flex-shrink: 0;
  color: $text-secondary;
  line-height: 24px;
}

.chip {
  margin: 0;
}

.chip-empty {
  color: $text-secondary;
  line-height: 24px;
}

.ai-note {
  margin-top: 8px;
  font-size: 12px;
  color: $text-secondary;
  line-height: 1.7;
  background: #fff;
  border-radius: $radius-sm;
  padding: 7px 9px;
}

.ai-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.ai-actions-hint {
  font-size: 12px;
  color: $text-secondary;
}

.ai-empty {
  font-size: 12px;
  color: $text-secondary;
  padding: 6px 0;
}
</style>
