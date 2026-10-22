<template>
  <div class="app-page">
    <div class="panel-card">
      <h3 class="panel-title">演示数据重置</h3>
      <p class="desc">
        本系统为纯前端演示项目，所有患者与业务数据均为虚构演示数据，变更保存在浏览器 localStorage
        中。点击下方按钮可将全部数据恢复为初始演示状态（版本标记与安全的重新播种逻辑见
        <code>src/mock/db.js</code>）。
      </p>
      <div class="danger-zone">
        <div class="dz-info">
          <div class="dz-title"><i class="el-icon-warning-outline"></i> 危险操作</div>
          <div class="dz-text">重置后所有演示期间的修改（增删改、挂号、接诊、入院等）将不可恢复。</div>
        </div>
        <el-button type="danger" :loading="resetting" @click="doReset">重置演示数据</el-button>
      </div>
      <div class="storage-info">
        <h4>本地存储信息</h4>
        <el-descriptions :column="1" border size="medium">
          <el-descriptions-item label="存储键">{{ storageKey }}</el-descriptions-item>
          <el-descriptions-item label="数据版本">{{ version }}</el-descriptions-item>
          <el-descriptions-item label="当前状态">{{ storageState }}</el-descriptions-item>
        </el-descriptions>
      </div>
    </div>
  </div>
</template>

<script>
import { apiResetDemo } from '@/api'

const STORAGE_KEY = 'astra_hospital_db_v1'

export default {
  name: 'DataReset',
  data() {
    return {
      resetting: false,
      storageKey: STORAGE_KEY,
      version: 1,
      storageState: ''
    }
  },
  created() {
    this.refreshState()
  },
  methods: {
    refreshState() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) {
          this.storageState = '尚未初始化（首次请求时自动播种）'
        } else {
          const parsed = JSON.parse(raw)
          this.storageState = `已初始化 · ${parsed.savedAt || ''}`
        }
      } catch (e) {
        this.storageState = '读取失败'
      }
    },
    doReset() {
      this.$confirm('确定重置全部演示数据吗？当前所有修改将丢失。', '重置确认', { type: 'warning' })
        .then(async () => {
          this.resetting = true
          try {
            await apiResetDemo()
            this.$message.success('演示数据已重置')
            this.refreshState()
            // 刷新当前页面，各页面重新拉取数据
            this.$store.commit('app/INCREMENT_REFRESH')
          } finally {
            this.resetting = false
          }
        })
        .catch(() => {})
    }
  }
}
</script>

<style lang="scss" scoped>
.desc {
  color: $text-regular;
  line-height: 1.8;
  font-size: 14px;
}

.danger-zone {
  margin-top: 16px;
  border: 1px solid #f3c7c7;
  background: #fef3f3;
  border-radius: $radius-md;
  padding: 14px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.dz-title {
  font-weight: 600;
  color: $danger;
}

.dz-text {
  font-size: 13px;
  color: #a35555;
  margin-top: 4px;
}

.storage-info {
  margin-top: 20px;

  h4 {
    margin: 0 0 8px;
    font-size: 14px;
    color: $text-main;
  }
}
</style>
