// ===== 日期工具 =====
export function pad(n) {
  return String(n).padStart(2, '0')
}

export function fmtDate(d) {
  if (!d) return ''
  const dt = d instanceof Date ? d : new Date(d)
  if (isNaN(dt.getTime())) return String(d)
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
}

export function fmtDateTime(d) {
  if (!d) return ''
  const dt = d instanceof Date ? d : new Date(d)
  if (isNaN(dt.getTime())) return String(d)
  return `${fmtDate(dt)} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}

export function addDays(dateStr, n) {
  const dt = new Date(`${dateStr}T00:00:00`)
  dt.setDate(dt.getDate() + n)
  return fmtDate(dt)
}

export function lastNDays(dateStr, n) {
  const out = []
  for (let i = n - 1; i >= 0; i--) out.push(addDays(dateStr, -i))
  return out
}

export function weekdayCN(dateStr) {
  const dt = new Date(`${dateStr}T00:00:00`)
  return ['日', '一', '二', '三', '四', '五', '六'][dt.getDay()]
}

export function fmtDateCN(d) {
  if (!d) return ''
  const s = fmtDate(d)
  const [y, m, day] = s.split('-')
  return `${y}.${m}.${day}`
}
