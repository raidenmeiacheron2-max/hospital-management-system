<template>
  <span class="status-tag" :class="'st-' + color">
    <span class="dot"></span>{{ label }}
  </span>
</template>

<script>
// 截图配色：柔和底色 + 深色文字 + 圆点
export const STATUS_COLOR = {
  空闲: 'green',
  正常: 'green',
  已缴费: 'green',
  已完成: 'green',
  已发药: 'green',
  已出报告: 'green',
  已执行: 'green',
  启用: 'green',
  在院: 'blue',
  就诊中: 'blue',
  待报告: 'blue',
  部分出报告: 'blue',
  占用: 'orange',
  待分诊: 'orange',
  待入科: 'orange',
  待结算: 'orange',
  未缴费: 'orange',
  未收费: 'orange',
  未发药: 'orange',
  未执行: 'orange',
  停用: 'gray',
  已退号: 'gray',
  已退费: 'gray',
  已取消: 'gray',
  已出院: 'gray',
  '—': 'gray'
}

export default {
  name: 'StatusTag',
  props: {
    label: { type: String, default: '' },
    color: { type: String, default: '' }
  },
  computed: {
    resolvedColor() {
      return this.color || STATUS_COLOR[this.label] || 'gray'
    }
  }
}
</script>

<style lang="scss" scoped>
.status-tag {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 8px;
  border-radius: 11px;
  font-size: 12px;
  line-height: 1;
  border: 1px solid transparent;
  white-space: nowrap;

  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    margin-right: 5px;
  }
}

.st-green {
  background: #dbf9e6;
  border-color: #b7ebcb;
  color: #23a56b;

  .dot {
    background: #23a56b;
  }
}

.st-blue {
  background: #e8f3fe;
  border-color: #c4dcfb;
  color: #3f8fef;

  .dot {
    background: #3f8fef;
  }
}

.st-orange {
  background: #fdf3e3;
  border-color: #f5dfb8;
  color: #d98e2b;

  .dot {
    background: #d98e2b;
  }
}

.st-red {
  background: #fde8e8;
  border-color: #f7c5c5;
  color: #e05656;

  .dot {
    background: #e05656;
  }
}

.st-gray {
  background: #f0f2f5;
  border-color: #e0e3e9;
  color: #909399;

  .dot {
    background: #909399;
  }
}
</style>
