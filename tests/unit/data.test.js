// Jest 入口：npm run test:unit
const { runAll } = require('../data/suite')

describe('数据层（金额 / 状态机 / 关联规则 / CRUD / 失败不落库）', () => {
  test('完整套件', () => {
    runAll()
  })
})
