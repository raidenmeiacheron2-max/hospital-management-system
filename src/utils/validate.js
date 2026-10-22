// ===== 通用校验 =====
export const PHONE_RE = /^1[3-9]\d{9}$/

export function isValidPhone(v) {
  return PHONE_RE.test(String(v || ''))
}

export function isNonEmpty(v) {
  return v !== null && v !== undefined && String(v).trim() !== ''
}

/** 正整数（数量） */
export function isPositiveInt(v) {
  return Number.isInteger(Number(v)) && Number(v) > 0
}

/** 非负整数 */
export function isNonNegativeInt(v) {
  return Number.isInteger(Number(v)) && Number(v) >= 0
}

/** 登录账号：字母数字下划线，3-20 位 */
export const ACCOUNT_RE = /^[A-Za-z0-9_]{3,20}$/
