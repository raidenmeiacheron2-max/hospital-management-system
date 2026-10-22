// ===== 工具库：localStorage 安全读写 =====
const memStore = {}

function hasLS() {
  try {
    const k = '__astra_probe__'
    window.localStorage.setItem(k, '1')
    window.localStorage.removeItem(k)
    return true
  } catch (e) {
    return false
  }
}

const ls = typeof window !== 'undefined' && hasLS()

export function getItem(key) {
  if (ls) {
    try {
      return window.localStorage.getItem(key)
    } catch (e) {
      return null
    }
  }
  return Object.prototype.hasOwnProperty.call(memStore, key) ? memStore[key] : null
}

export function setItem(key, value) {
  if (ls) {
    try {
      window.localStorage.setItem(key, value)
      return true
    } catch (e) {
      return false
    }
  }
  memStore[key] = value
  return true
}

export function removeItem(key) {
  if (ls) {
    try {
      window.localStorage.removeItem(key)
    } catch (e) {
      /* noop */
    }
  }
  delete memStore[key]
}
