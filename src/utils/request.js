// ===== Axios 封装：统一响应拦截、错误提示 =====
import axios from 'axios'
import { Message } from 'element-ui'
import { getToken, clearToken } from './auth'

const service = axios.create({
  baseURL: process.env.VUE_APP_BASE_API || '/api',
  timeout: 15000
})

service.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers = config.headers || {}
    config.headers['X-Token'] = token
  }
  return config
})

service.interceptors.response.use(
  (response) => {
    const res = response.data
    if (res && typeof res === 'object' && 'code' in res) {
      if (res.code === 200) return res.data
      if (res.code === 401) {
        clearToken()
        if (window.location.hash.indexOf('#/login') === -1) {
          window.location.hash = '#/login'
        }
      }
      Message.error(res.msg || '操作失败')
      return Promise.reject(new Error(res.msg || '操作失败'))
    }
    return res
  },
  (error) => {
    const msg =
      (error.response && error.response.data && error.response.data.msg) ||
      error.message ||
      '网络异常，请稍后重试'
    Message.error(msg)
    return Promise.reject(error)
  }
)

export default service
