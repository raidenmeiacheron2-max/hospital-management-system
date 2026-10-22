const state = {
  visitedViews: [],
  cachedViews: []
}

const mutations = {
  ADD_VIEW(state, view) {
    if (state.visitedViews.some((v) => v.path === view.path)) return
    state.visitedViews.push(Object.assign({}, view, { title: view.title || '未命名' }))
  },
  DEL_VIEW(state, view) {
    const i = state.visitedViews.findIndex((v) => v.path === view.path)
    if (i !== -1) state.visitedViews.splice(i, 1)
  },
  DEL_OTHERS(state, view) {
    state.visitedViews = state.visitedViews.filter((v) => v.affix || v.path === view.path)
  },
  DEL_ALL(state) {
    state.visitedViews = state.visitedViews.filter((v) => v.affix)
  }
}

export default { namespaced: true, state, mutations }
