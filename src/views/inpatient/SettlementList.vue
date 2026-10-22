<template>
  <div class="app-page">
    <div class="panel-card">
      <el-form :inline="true" class="search-form" @submit.native.prevent="handleSearch">
        <el-form-item label="患者姓名">
          <el-input v-model.trim="filters.patientName" placeholder="请输入患者姓名" clearable @keyup.enter.native="handleSearch" />
        </el-form-item>
        <el-form-item label="住院状态">
          <el-select v-model="filters.status" placeholder="请选择状态" clearable>
            <el-option label="在院" value="在院" />
            <el-option label="待结算" value="待结算" />
            <el-option label="已出院" value="已出院" />
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
        <el-table-column prop="code" label="住院号" min-width="140" />
        <el-table-column prop="patientName" label="患者" min-width="90" />
        <el-table-column prop="departmentName" label="科室" min-width="90" />
        <el-table-column prop="wardName" label="病区" min-width="110" />
        <el-table-column prop="bedCode" label="床位" width="80" />
        <el-table-column label="预交金额" min-width="100">
          <template slot-scope="{ row }">¥{{ row.depositYuan }}</template>
        </el-table-column>
        <el-table-column label="住院状态" width="100">
          <template slot-scope="{ row }">
            <StatusTag :label="row.status" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template slot-scope="{ row }">
            <div class="operation-links">
              <el-link type="primary" @click="openDetail(row)">明细</el-link>
              <el-link v-if="row.status === '在院'" type="warning" @click="requestDischarge(row)">出院申请</el-link>
              <el-link v-if="row.status === '待结算'" type="danger" @click="settleRow(row)">结算</el-link>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div class="table-footer">
        <Pagination :total="total" :page="query.page" :size="query.size" @change="handlePageChange" />
      </div>
    </div>

    <!-- 结算明细 -->
    <el-dialog title="出院结算" :visible.sync="detailVisible" width="640px" append-to-body>
      <div v-if="detailRow" class="settle-body">
        <el-descriptions :column="2" border size="medium">
          <el-descriptions-item label="住院号">{{ detailRow.code }}</el-descriptions-item>
          <el-descriptions-item label="患者">{{ detailRow.patientName }}</el-descriptions-item>
          <el-descriptions-item label="病区/床位">{{ detailRow.wardName }} {{ detailRow.bedCode }}</el-descriptions-item>
          <el-descriptions-item label="状态"><StatusTag :label="detailRow.status" /></el-descriptions-item>
        </el-descriptions>

        <h4 class="detail-h">费用明细（已执行医嘱）</h4>
        <el-table :data="detailOrders" size="small" border>
          <el-table-column prop="type" label="类型" width="90" />
          <el-table-column prop="name" label="项目" min-width="140" />
          <el-table-column prop="qty" label="数量" width="70" />
          <el-table-column label="金额" width="110">
            <template slot-scope="{ row }">¥{{ centsToYuan(row.amountCents) }}</template>
          </el-table-column>
        </el-table>
        <el-empty v-if="!detailOrders.length" description="暂无已执行医嘱" :image-size="50" />

        <div class="settle-summary">
          <div class="s-row"><span>费用合计</span><span>¥{{ centsToYuan(detailTotalCents) }}</span></div>
          <div class="s-row"><span>预交金额</span><span>¥{{ detailRow.depositYuan }}</span></div>
          <div class="s-row">
            <span>结算差额</span>
            <span :class="detailBalanceCents >= 0 ? 'text-primary' : 'text-danger'">
              {{ detailBalanceCents >= 0 ? '应退' : '应补' }} ¥{{ centsToYuan(Math.abs(detailBalanceCents)) }}
            </span>
          </div>
        </div>
      </div>
      <div slot="footer">
        <el-button @click="detailVisible = false">关 闭</el-button>
        <el-button v-if="detailRow && detailRow.status === '待结算'" type="primary" :loading="settling" @click="doSettle">
          确认结算
        </el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import listPage from '@/mixins/listPage'
import StatusTag from '@/components/StatusTag.vue'
import Pagination from '@/components/Pagination.vue'
import { apiListAdmissions, apiRequestDischarge, apiSettleAdmission, apiListOrders } from '@/api'
import { centsToYuan } from '@/utils/money'

export default {
  name: 'SettlementList',
  components: { StatusTag, Pagination },
  mixins: [listPage],
  data() {
    return {
      filters: { patientName: '', status: '' },
      detailVisible: false,
      detailRow: null,
      detailOrders: [],
      settling: false
    }
  },
  computed: {
    detailTotalCents() {
      return this.detailOrders.reduce((a, o) => a + o.amountCents, 0)
    },
    detailBalanceCents() {
      if (!this.detailRow) return 0
      return Math.round(Number(this.detailRow.depositYuan) * 100) - this.detailTotalCents
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
        const res = await apiListAdmissions(this.buildParams())
        this.list = res.list
        this.total = res.total
      } finally {
        this.loading = false
      }
    },
    resetFilters() {
      this.filters = { patientName: '', status: '' }
      this.handleSearch()
    },
    async openDetail(row) {
      this.detailRow = row
      this.detailVisible = true
      const res = await apiListOrders({ admissionId: row.id, status: '已执行', size: 1000 })
      this.detailOrders = res.list
    },
    requestDischarge(row) {
      this.$confirm(`确认为「${row.patientName}」办理出院申请吗？`, '出院申请', { type: 'warning' })
        .then(async () => {
          await apiRequestDischarge(row.id)
          this.$message.success('已提交出院申请，可进行结算')
          this.fetchData()
        })
        .catch(() => {})
    },
    settleRow(row) {
      this.openDetail(row)
    },
    doSettle() {
      if (!this.detailRow || this.settling) return
      this.settling = true
      apiSettleAdmission(this.detailRow.id)
        .then(() => {
          this.$message.success('结算完成，床位已释放')
          this.detailVisible = false
          this.fetchData()
        })
        .catch(() => {})
        .finally(() => {
          this.settling = false
        })
    }
  }
}
</script>

<style lang="scss" scoped>
.settle-body {
  max-height: 66vh;
  overflow-y: auto;
}

.detail-h {
  margin: 14px 0 8px;
  font-size: 14px;
  color: $text-main;
}

.settle-summary {
  margin-top: 12px;
  border-top: 1px dashed $border-color;
  padding-top: 8px;

  .s-row {
    display: flex;
    justify-content: space-between;
    padding: 4px 0;
    font-size: 14px;

    span:last-child {
      font-weight: 600;
    }
  }
}
</style>
