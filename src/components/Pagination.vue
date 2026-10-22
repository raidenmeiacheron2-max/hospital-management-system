<template>
  <el-pagination
    background
    layout="total, sizes, prev, pager, next, jumper"
    :total="total"
    :current-page.sync="curPage"
    :page-size.sync="curSize"
    :page-sizes="[10, 20, 50, 100]"
    @current-change="(p) => $emit('change', { page: p, size: curSize })"
    @size-change="(s) => $emit('change', { page: 1, size: s })"
  />
</template>

<script>
export default {
  name: 'Pagination',
  props: {
    total: { type: Number, default: 0 },
    page: { type: Number, default: 1 },
    size: { type: Number, default: 10 }
  },
  data() {
    return {
      curPage: this.page,
      curSize: this.size
    }
  },
  watch: {
    page(v) {
      this.curPage = v
    },
    size(v) {
      this.curSize = v
    }
  }
}
</script>
