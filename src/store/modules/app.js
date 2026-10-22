const state = {
  sidebarCollapsed: false,
  device: 'desktop',
  refreshKey: 0
}

const mutations = {
  TOGGLE_SIDEBAR(state) {
    state.sidebarCollapsed = !state.sidebarCollapsed
  },
  SET_SIDEBAR(state, collapsed) {
    state.sidebarCollapsed = !!collapsed
  },
  INCREMENT_REFRESH(state) {
    state.refreshKey += 1
  }
}

export default { namespaced: true, state, mutations }
