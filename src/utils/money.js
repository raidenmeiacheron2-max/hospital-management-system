// ===== 金额工具：数据层统一以「整数分」存储与计算，展示层格式化为元 =====

/** 分 -> 元字符串，如 123456 -> "1234.56" */
export function centsToYuan(cents) {
  const n = Math.round(Number(cents) || 0)
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(n)
  const yuan = Math.floor(abs / 100)
  const fen = String(abs % 100).padStart(2, '0')
  return `${sign}${yuan}.${fen}`
}

/** 分 -> 带 ¥ 前缀的展示字符串 */
export function fmtMoney(cents) {
  return `¥${centsToYuan(cents)}`
}

/** 分 -> 千分位元字符串 */
export function fmtMoneyGrouped(cents) {
  const s = centsToYuan(cents)
  const neg = s.startsWith('-')
  const [i, d] = (neg ? s.slice(1) : s).split('.')
  const grouped = i.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${neg ? '-' : ''}¥${grouped}.${d}`
}

/** 元字符串 -> 分（整数），非法输入返回 NaN */
export function yuanToCents(str) {
  if (str === null || str === undefined || str === '') return NaN
  const n = Number(String(str).replace(/[,¥￥\s]/g, ''))
  if (!isFinite(n)) return NaN
  return Math.round(n * 100)
}

/** 校验是否为合法金额（分），>=0 且为整数 */
export function isValidCents(v) {
  return Number.isInteger(v) && v >= 0
}

/** 整数分求和（避免浮点误差） */
export function sumCents(list) {
  return (list || []).reduce((acc, n) => acc + (Number.isInteger(n) ? n : 0), 0)
}
