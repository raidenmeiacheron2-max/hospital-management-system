<template>
  <div class="app-page">
    <div class="panel-card">
      <el-form :inline="true" class="search-form" @submit.native.prevent="handleSearch">
        <el-form-item label="患者姓名">
          <el-input v-model.trim="filters.patientName" placeholder="请输入患者姓名" clearable @keyup.enter.native="handleSearch" />
        </el-form-item>
        <el-form-item label="收费状态">
          <el-select v-model="filters.chargeStatus" placeholder="请选择状态" clearable>
            <el-option label="未收费" value="未收费" />
            <el-option label="已收费" value="已收费" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" icon="el-icon-search" @click="handleSearch">搜索</el-button>
          <el-button icon="el-icon-refresh-left" @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <div class="panel-card">
      <el-table v-loading="loading" :data="list" style="width: 100%">
        <el-table-column prop="code" label="接诊编号" min-width="150" />
        <el-table-column prop="regCode" label="挂号编号" min-width="150" />
        <el-table-column prop="patientName" label="患者" min-width="90" />
        <el-table-column prop="departmentName" label="科室" min-width="90" />
        <el-table-column prop="doctorName" label="医生" min-width="90" />
        <el-table-column label="处方金额" min-width="100">
          <template slot-scope="{ row }">¥{{ centsToYuan(row.prescriptionAmountCents) }}</template>
        </el-table-column>
        <el-table-column label="医技金额" min-width="100">
          <template slot-scope="{ row }">¥{{ centsToYuan(row.examAmountCents) }}</template>
        </el-table-column>
        <el-table-column label="应收合计" min-width="110">
          <template slot-scope="{ row }">
            <span class="amount">¥{{ centsToYuan(row.totalAmountCents) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="收费状态" width="100">
          <template slot-scope="{ row }">
            <StatusTag :label="row.chargeStatus" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template slot-scope="{ row }">
            <el-link v-if="row.chargeStatus === '未收费' && row.totalAmountCents > 0" type="primary" @click="chargeRow(row)">收费</el-link>
            <span v-else class="text-muted" style="font-size: 12px">—</span>
          </template>
        </el-table-column>
      </el-table>

      <div class="table-footer">
        <Pagination :total="total" :page="query.page" :size="query.size" @change="handlePageChange" />
      </div>
    </div>

    <!-- 收费小票 -->
    <el-dialog title="收费小票" :visible.sync="receiptVisible" width="420px">
      <div v-if="receipt" class="receipt">
        <div class="r-head">门诊收费小票（演示）</div>
        <div class="r-row"><span>接诊编号</span><span>{{ receipt.code }}</span></div>
        <div class="r-row"><span>患者</span><span>{{ receipt.patientName }}</span></div>
        <div class="r-row"><span>挂号编号</span><span>{{ receipt.regCode }}</span></div>
        <div class="r-sep">项目明细</div>
        <div v-for="(p, i) in receipt.prescriptions || []" :key="'p' + i" class="r-row">
          <span>{{ p.medicineName }} ×{{ p.qty }}</span><span>¥{{ centsToYuan(p.amountCents) }}</span>
        </div>
        <div v-for="(e, i) in receipt.exams || []" :key="'e' + i" class="r-row">
          <span>{{ e.examItemName }} ×{{ e.qty }}</span><span>¥{{ centsToYuan(e.amountCents) }}</span>
        </div>
        <div class="r-total">合计：¥{{ centsToYuan(receipt.totalAmountCents) }}</div>
      </div>
      <div slot="footer">
        <el-button type="primary" @click="receiptVisible = false">确 定</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import listPage from '@/mixins/listPage'
import StatusTag from '@/components/StatusTag.vue'
import Pagination from '@/components/Pagination.vue'
import { apiListVisits, apiChargeVisit } from '@/api'
import { centsToYuan } from '@/utils/money'

export default {
  name: 'ChargeList',
  components: { StatusTag, Pagination },
  mixins: [listPage],
  data() {
    return {
      filters: { patientName: '', chargeStatus: '' },
      receiptVisible: false,
      receipt: null
    }
  },
  created() {
    this.fetchData()
  },
  methods: {
    centsToYuan,
    buildParams() {
      const p = { page: this.query.page, size: this.query.size }
      Object.keys(this.filters).forEach((k) => {
        if (this.filters[k] !== '') p[k] = this.filters[k]
      })
      return p
    },
    async fetchData() {
      this.loading = true
      try {
        const res = await apiListVisits(this.buildParams())
        this.list = res.list.filter((v) => v.totalAmountCents > 0)
        this.total = this.list.length
      } finally {
        this.loading = false
      }
    },
    resetFilters() {
      this.filters = { patientName: '', chargeStatus: '' }
      this.handleSearch()
    },
    chargeRow(row) {
      this.$confirm(`确定对「${row.patientName}」收取费用 ¥${centsToYuan(row.totalAmountCents)} 吗？`, '门诊收费确认', { type: 'info' })
        .then(async () => {
          await apiChargeVisit(row.id)
          this.receipt = row
          this.receiptVisible = true
          this.fetchData()
        })
        .catch(() => {})
    }
  }
}
</script>

<style lang="scss" scoped>
.amount {
  color: $danger;
  font-weight: 600;
}

.receipt {
  .r-head {
    text-align: center;
    font-weight: 600;
    margin-bottom: 10px;
  }

  .r-row {
    display: flex;
    justify-content: space-between;
    font-size: 13px;
    padding: 3px 0;
  }

  .r-sep {
    border-top: 1px dashed $border-color;
    margin: 8px 0 4px;
    padding-top: 8px;
    font-size: 13px;
    font-weight: 600;
  }

  .r-total {
    border-top: 1px dashed $border-color;
    margin-top: 8px;
    padding-top: 8px;
    text-align: right;
    font-weight: 700;
    color: $danger;
  }
}
</style>
