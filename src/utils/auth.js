// ===== 登录态（仅演示：不保存真实密码）=====
import { getItem, setItem, removeItem } from './storage'

const TOKEN_KEY = 'astra_hospital_token'
const REMEMBER_KEY = 'astra_hospital_remember'

export function getToken() {
  return getItem(TOKEN_KEY) || ''
}

export function setToken(token) {
  setItem(TOKEN_KEY, token)
}

export function clearToken() {
  removeItem(TOKEN_KEY)
}

// 「记住密码」只记住账号与勾选状态
export function getRemembered() {
  try {
    return JSON.parse(getItem(REMEMBER_KEY) || 'null')
  } catch (e) {
    return null
  }
}

export function setRemembered(remember, account) {
  if (remember && account) {
    setItem(REMEMBER_KEY, JSON.stringify({ account }))
  } else {
    removeItem(REMEMBER_KEY)
  }
}
