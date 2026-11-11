import { apiLogin, apiLogout, apiGetProfile } from '@/api'
import { getToken, setToken, clearToken } from '@/utils/auth'

const state = {
  token: getToken(),
  staff: null
}

const getters = {
  isLogin: (state) => !!state.token,
  staff: (state) => state.staff
}

const mutations = {
  SET_TOKEN(state, token) {
    state.token = token
  },
  SET_STAFF(state, staff) {
    state.staff = staff
  }
}

const actions = {
  async login({ commit }, { account, password }) {
    const data = await apiLogin({ account, password })
    setToken(data.token)
    commit('SET_TOKEN', data.token)
    commit('SET_STAFF', data.staff)
    return data.staff
  },
  async logout({ commit }) {
    try {
      await apiLogout()
    } catch (e) {
      /* 演示环境忽略 */
    }
    clearToken()
    commit('SET_TOKEN', '')
    commit('SET_STAFF', null)
  },
  // 刷新后按 token 复原员工/角色（B1：身份持久化）
  async restore({ commit, state }) {
    if (!state.token) return null
    try {
      const staff = await apiGetProfile()
      commit('SET_STAFF', staff)
      return staff
    } catch (e) {
      return null
    }
  }
}

export default { namespaced: true, state, getters, mutations, actions }
