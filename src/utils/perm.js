// ===== B2：演示级 RBAC 前端辅助 =====
// 依据 staff.menuCodes（来自 db.profileOf / login 返回）判断菜单/域权限。
// 说明：纯前端 Mock 演示，不构成真实后端安全隔离；真正的“后端校验”在 Mock 层。

export function menuCodesOf(staff) {
  return (staff && staff.menuCodes) || []
}

/** 是否拥有某个权限域（basic / patient / outpatient / inpatient / system / home） */
export function hasDomain(staff, domain) {
  const codes = menuCodesOf(staff)
  if (!codes.length) return false
  if (codes.indexOf('*') !== -1) return true
  if (codes.indexOf(domain) !== -1) return true
  return codes.some((c) => c.indexOf(domain + '-') === 0)
}

/** 是否拥有某个菜单码（如 basic-staff / outpatient-charge） */
export function hasMenu(staff, code) {
  const codes = menuCodesOf(staff)
  if (!codes.length) return false
  if (codes.indexOf('*') !== -1) return true
  if (codes.indexOf(code) !== -1) return true
  const group = String(code).split('-')[0]
  return codes.indexOf(group) !== -1
}

/** 按角色过滤菜单树：保留可见的叶子与分组 */
export function filterMenuTree(tree, staff) {
  const codes = menuCodesOf(staff)
  if (!codes.length) return tree // 身份未就绪时回退全部，路由守卫会先复原身份
  if (codes.indexOf('*') !== -1) return tree
  const allow = (code) => codes.indexOf(code) !== -1 || codes.indexOf(String(code).split('-')[0]) !== -1
  const out = []
  tree.forEach((node) => {
    if (!node.children) {
      if (allow(node.code)) out.push(node)
      return
    }
    if (allow(node.code)) {
      out.push(node)
      return
    }
    const kids = node.children.filter((c) => allow(c.code))
    if (kids.length) out.push(Object.assign({}, node, { children: kids }))
  })
  return out
}
