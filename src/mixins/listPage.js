// ===== 列表页通用逻辑：分页、搜索重置、末页删除回退 =====
export default {
  data() {
    return {
      loading: false,
      list: [],
      total: 0,
      query: { page: 1, size: 10 }
    }
  },
  methods: {
    /** 页面覆盖实现 */
    async fetchData() {},
    handleSearch() {
      this.query.page = 1
      this.fetchData()
    },
    handlePageChange(p) {
      this.query.page = p.page
      this.query.size = p.size
      this.fetchData()
    },
    /** 删除后重新加载；若当前页已被删空则回退到上一有效页 */
    afterDelete() {
      const maxPage = Math.max(1, Math.ceil((this.total - 1) / this.query.size))
      if (this.query.page > maxPage) this.query.page = maxPage
      this.fetchData()
    }
  }
}
