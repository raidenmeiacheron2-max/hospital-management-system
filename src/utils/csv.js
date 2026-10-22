// ===== CSV 导出（带 BOM，Excel 中文友好）=====
function escapeCell(v) {
  const s = v === null || v === undefined ? '' : String(v)
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function exportCsv(filename, headers, rows) {
  const head = headers.map((h) => (typeof h === 'string' ? h : h.label))
  const keys = headers.map((h) => (typeof h === 'string' ? h : h.key))
  const lines = [head, ...rows.map((row) => keys.map((k) => escapeCell(row[k])))].map((cells) =>
    cells.join(',')
  )
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = /\.csv$/i.test(filename) ? filename : `${filename}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
