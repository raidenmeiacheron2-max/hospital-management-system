// ===== 演示种子数据（全部为虚构数据）=====
// 金额一律以「整数分」存储；日期以 'YYYY-MM-DD' 字符串存储。
// demoToday 固定为 2026-08-28，保证首页与截图接近。

const demoToday = '2026-08-28'

function d(offset) {
  const dt = new Date('2026-08-28T00:00:00')
  dt.setDate(dt.getDate() + offset)
  const p = (n) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`
}

function buildSeed() {
  const departments = [
    { id: 'dep1', code: 'D001', name: '内科', phone: '0571-88001001', director: '赵建国', status: 1, createdAt: '2026-01-05 09:00' },
    { id: 'dep2', code: 'D002', name: '外科', phone: '0571-88001002', director: '张静怡', status: 1, createdAt: '2026-01-05 09:10' },
    { id: 'dep3', code: 'D003', name: '儿科', phone: '0571-88001003', director: '郑晓雯', status: 1, createdAt: '2026-01-06 09:00' },
    { id: 'dep4', code: 'D004', name: '急诊科', phone: '0571-88001004', director: '何志强', status: 1, createdAt: '2026-01-06 09:20' },
    { id: 'dep5', code: 'D005', name: '检验科', phone: '0571-88001005', director: '李慕白', status: 1, createdAt: '2026-01-07 09:00' },
    { id: 'dep6', code: 'D006', name: '影像科', phone: '0571-88001006', director: '顾明轩', status: 1, createdAt: '2026-01-07 09:30' },
    { id: 'dep7', code: 'D007', name: '住院处', phone: '0571-88001007', director: '孙志强', status: 1, createdAt: '2026-01-08 09:00' },
    { id: 'dep8', code: 'D008', name: '药剂科', phone: '0571-88001008', director: '钱丽华', status: 1, createdAt: '2026-01-08 09:40' }
  ]

  const wards = [
    { id: 'w1', code: 'W001', name: '内科一病区', departmentId: 'dep1', floor: '3F', headNurse: '王秀兰', status: 1, createdAt: '2026-01-10 09:00' },
    { id: 'w2', code: 'W002', name: '内科二病区', departmentId: 'dep1', floor: '4F', headNurse: '马丽娟', status: 1, createdAt: '2026-01-10 09:10' },
    { id: 'w3', code: 'W003', name: '外科一病区', departmentId: 'dep2', floor: '5F', headNurse: '宋桂芳', status: 1, createdAt: '2026-01-10 09:20' },
    { id: 'w4', code: 'W004', name: '外科二病区', departmentId: 'dep2', floor: '6F', headNurse: '许红梅', status: 1, createdAt: '2026-01-10 09:30' },
    { id: 'w5', code: 'W005', name: '儿科病区', departmentId: 'dep3', floor: '7F', headNurse: '罗春燕', status: 1, createdAt: '2026-01-10 09:40' },
    { id: 'w6', code: 'W006', name: '急诊观察区', departmentId: 'dep4', floor: '1F', headNurse: '韩丽', status: 1, createdAt: '2026-01-10 09:50' }
  ]

  // 床位：共 12 张，占用 3 张（25%，与截图环图一致）
  const beds = [
    { id: 'b1', wardId: 'w1', code: 'A01', type: '普通床', status: '空闲', enabled: 1, remark: '' },
    { id: 'b2', wardId: 'w1', code: 'A02', type: '普通床', status: '占用', enabled: 1, remark: '' },
    { id: 'b3', wardId: 'w1', code: 'A03', type: '普通床', status: '空闲', enabled: 1, remark: '' },
    { id: 'b4', wardId: 'w1', code: 'A04', type: '普通床', status: '空闲', enabled: 1, remark: '' },
    { id: 'b5', wardId: 'w1', code: 'A05', type: '普通床', status: '空闲', enabled: 1, remark: '' },
    { id: 'b6', wardId: 'w1', code: 'A06', type: '加床', status: '空闲', enabled: 1, remark: '临时加床' },
    { id: 'b7', wardId: 'w3', code: 'B01', type: '普通床', status: '占用', enabled: 1, remark: '' },
    { id: 'b8', wardId: 'w3', code: 'B02', type: '普通床', status: '空闲', enabled: 1, remark: '' },
    { id: 'b9', wardId: 'w3', code: 'B03', type: '普通床', status: '空闲', enabled: 1, remark: '' },
    { id: 'b10', wardId: 'w3', code: 'B04', type: '加床', status: '空闲', enabled: 1, remark: '' },
    { id: 'b11', wardId: 'w5', code: 'C01', type: '普通床', status: '占用', enabled: 1, remark: '' },
    { id: 'b12', wardId: 'w5', code: 'C02', type: '普通床', status: '空闲', enabled: 0, remark: '检修中' }
  ]

  const staff = [
    { id: 's0', code: 'S000', name: '周明远', type: '系统管理员', departmentId: 'dep1', phone: '15888888888', loginAccount: 'admin', role: '超级管理员', password: '123456', enabled: true, lastLoginAt: '2026-08-28 08:30', createdAt: '2026-01-01 08:00' },
    { id: 's1', code: 'S001', name: '王雨桐', type: '门诊医生', departmentId: 'dep1', phone: '13900000001', loginAccount: '13900000001', role: '门诊医生', password: '123456', enabled: true, lastLoginAt: '2026-08-23 08:05', createdAt: '2026-01-02 08:00' },
    { id: 's2', code: 'S002', name: '赵建国', type: '门诊医生', departmentId: 'dep1', phone: '13900000002', loginAccount: '13900000002', role: '门诊医生', password: '123456', enabled: true, lastLoginAt: '2026-08-23 08:12', createdAt: '2026-01-02 08:10' },
    { id: 's3', code: 'S003', name: '陈雅婷', type: '门诊医生', departmentId: 'dep2', phone: '13900000003', loginAccount: '13900000003', role: '门诊医生', password: '123456', enabled: true, lastLoginAt: '2026-08-23 08:40', createdAt: '2026-01-02 08:20' },
    { id: 's4', code: 'S004', name: '张静怡', type: '门诊医生', departmentId: 'dep2', phone: '13900000004', loginAccount: '13900000004', role: '门诊医生', password: '123456', enabled: true, lastLoginAt: '2026-08-23 09:02', createdAt: '2026-01-03 08:00' },
    { id: 's5', code: 'S005', name: '郑晓雯', type: '门诊医生', departmentId: 'dep3', phone: '13900000005', loginAccount: '13900000005', role: '门诊医生', password: '123456', enabled: true, lastLoginAt: '2026-08-22 10:00', createdAt: '2026-01-03 08:20' },
    { id: 's6', code: 'S006', name: '何志强', type: '门诊医生', departmentId: 'dep4', phone: '13900000006', loginAccount: '13900000006', role: '门诊医生', password: '123456', enabled: true, lastLoginAt: '2026-08-22 10:30', createdAt: '2026-01-03 08:40' },
    { id: 's7', code: 'S007', name: '李慕白', type: '门诊医生', departmentId: 'dep5', phone: '13900000007', loginAccount: '13900000007', role: '门诊医生', password: '123456', enabled: true, lastLoginAt: '2026-08-21 14:00', createdAt: '2026-01-04 08:00' },
    { id: 's8', code: 'S008', name: '顾明轩', type: '门诊医生', departmentId: 'dep6', phone: '13900000008', loginAccount: '13900000008', role: '门诊医生', password: '123456', enabled: true, lastLoginAt: '2026-08-21 15:20', createdAt: '2026-01-04 08:20' },
    { id: 's9', code: 'S009', name: '孙志强', type: '收费人员', departmentId: 'dep7', phone: '13800001000', loginAccount: '13800001000', role: '挂号收费员', password: '123456', enabled: true, lastLoginAt: '2026-08-23 07:50', createdAt: '2026-01-04 08:40' },
    { id: 's10', code: 'S010', name: '李国强', type: '住院医生', departmentId: 'dep1', phone: '13800001002', loginAccount: '13800001002', role: '住院医生', password: '123456', enabled: true, lastLoginAt: '2026-08-24 09:10', createdAt: '2026-01-05 08:00' },
    { id: 's11', code: 'S011', name: '钱丽华', type: '护士', departmentId: 'dep1', phone: '13800001003', loginAccount: '13800001003', role: '护士长', password: '123456', enabled: true, lastLoginAt: '2026-08-24 09:30', createdAt: '2026-01-05 08:20' }
  ]

  const patients = [
    { id: 'p0', code: 'P00000000001000', name: '林雪梅', gender: '女', phone: '13600000001', birthDate: '1985-03-12', allergy: '', status: '正常', createdAt: '2026-02-01 09:00' },
    { id: 'p1', code: 'P00000000001001', name: '张文博', gender: '男', phone: '13600000002', birthDate: '1990-07-25', allergy: '', status: '正常', createdAt: '2026-02-02 09:00' },
    { id: 'p2', code: 'P00000000001002', name: '黄可欣', gender: '女', phone: '13600000003', birthDate: '1992-11-08', allergy: '', status: '正常', createdAt: '2026-02-03 09:00' },
    { id: 'p3', code: 'P00000000001003', name: '周启航', gender: '男', phone: '13600000004', birthDate: '1978-05-19', allergy: '', status: '正常', createdAt: '2026-02-04 09:00' },
    { id: 'p4', code: 'P00000000001004', name: '郑思怡', gender: '女', phone: '13600000005', birthDate: '1988-09-02', allergy: '青霉素过敏', status: '正常', createdAt: '2026-02-05 09:00' },
    { id: 'p5', code: 'P00000000001005', name: '张强', gender: '男', phone: '15312341234', birthDate: '1975-12-30', allergy: '头孢类药物不耐受', status: '正常', createdAt: '2026-02-06 09:00' },
    { id: 'p6', code: 'P00000000001006', name: '陈志明', gender: '男', phone: '13700000001', birthDate: '1995-02-14', allergy: '', status: '正常', createdAt: '2026-03-01 09:00' },
    { id: 'p7', code: 'P00000000001007', name: '刘晓燕', gender: '女', phone: '13700000002', birthDate: '1998-06-21', allergy: '磺胺类过敏', status: '正常', createdAt: '2026-03-02 09:00' },
    { id: 'p8', code: 'P00000000001008', name: '吴国栋', gender: '男', phone: '13700000003', birthDate: '1968-04-05', allergy: '', status: '正常', createdAt: '2026-03-03 09:00' },
    { id: 'p9', code: 'P00000000001009', name: '冯丽丽', gender: '女', phone: '13700000004', birthDate: '1982-10-17', allergy: '', status: '正常', createdAt: '2026-03-04 09:00' },
    { id: 'p10', code: 'P00000000001010', name: '高俊杰', gender: '男', phone: '13700000005', birthDate: '2000-01-23', allergy: '海鲜过敏', status: '正常', createdAt: '2026-03-05 09:00' },
    { id: 'p11', code: 'P00000000001011', name: '徐梦洁', gender: '女', phone: '13700000006', birthDate: '1993-08-09', allergy: '', status: '正常', createdAt: '2026-03-06 09:00' }
  ]

  const medicines = [
    { id: 'm1', code: 'YP0001', name: '阿莫西林胶囊', spec: '0.25g*24粒', unit: '盒', priceCents: 1250, stock: 480, status: 1, createdAt: '2026-01-10 09:00' },
    { id: 'm2', code: 'YP0002', name: '头孢克肟分散片', spec: '50mg*12片', unit: '盒', priceCents: 2800, stock: 260, status: 1, createdAt: '2026-01-10 09:10' },
    { id: 'm3', code: 'YP0003', name: '布洛芬缓释胶囊', spec: '0.3g*20粒', unit: '盒', priceCents: 1600, stock: 320, status: 1, createdAt: '2026-01-10 09:20' },
    { id: 'm4', code: 'YP0004', name: '感冒灵颗粒', spec: '10g*9袋', unit: '盒', priceCents: 980, stock: 150, status: 1, createdAt: '2026-01-10 09:30' },
    { id: 'm5', code: 'YP0005', name: '维生素C片', spec: '100片', unit: '瓶', priceCents: 650, stock: 200, status: 1, createdAt: '2026-01-11 09:00' },
    { id: 'm6', code: 'YP0006', name: '蒙脱石散', spec: '3g*10袋', unit: '盒', priceCents: 1450, stock: 180, status: 1, createdAt: '2026-01-11 09:10' },
    { id: 'm7', code: 'YP0007', name: '氯化钠注射液', spec: '500ml', unit: '袋', priceCents: 850, stock: 600, status: 1, createdAt: '2026-01-11 09:20' },
    { id: 'm8', code: 'YP0008', name: '葡萄糖注射液', spec: '5%*250ml', unit: '袋', priceCents: 720, stock: 400, status: 1, createdAt: '2026-01-11 09:30' },
    { id: 'm9', code: 'YP0009', name: '阿奇霉素片', spec: '0.25g*6片', unit: '盒', priceCents: 1950, stock: 220, status: 1, createdAt: '2026-01-12 09:00' },
    { id: 'm10', code: 'YP0010', name: '奥美拉唑肠溶胶囊', spec: '20mg*14粒', unit: '盒', priceCents: 2200, stock: 130, status: 1, createdAt: '2026-01-12 09:10' }
  ]

  const examItems = [
    { id: 'e1', code: 'JY0001', name: '血常规', category: '检验', priceCents: 2500, status: 1, createdAt: '2026-01-10 10:00' },
    { id: 'e2', code: 'JY0002', name: '尿常规', category: '检验', priceCents: 1000, status: 1, createdAt: '2026-01-10 10:10' },
    { id: 'e3', code: 'JY0003', name: '肝功能八项', category: '检验', priceCents: 5500, status: 1, createdAt: '2026-01-10 10:20' },
    { id: 'e4', code: 'JC0001', name: '胸部X光', category: '检查', priceCents: 12000, status: 1, createdAt: '2026-01-10 10:30' },
    { id: 'e5', code: 'JC0002', name: '心电图', category: '检查', priceCents: 3000, status: 1, createdAt: '2026-01-10 10:40' },
    { id: 'e6', code: 'JC0003', name: '腹部B超', category: '检查', priceCents: 18000, status: 1, createdAt: '2026-01-10 10:50' },
    { id: 'e7', code: 'JC0004', name: '头部CT平扫', category: '检查', priceCents: 36000, status: 1, createdAt: '2026-01-10 11:00' },
    { id: 'e8', code: 'JY0004', name: '血糖检测', category: '检验', priceCents: 800, status: 1, createdAt: '2026-01-10 11:10' }
  ]

  const feeItems = [
    { id: 'f1', code: 'SF0001', name: '普通挂号费', category: '挂号', priceCents: 1500, status: 1, createdAt: '2026-01-08 09:00' },
    { id: 'f2', code: 'SF0002', name: '专家挂号费', category: '挂号', priceCents: 3000, status: 1, createdAt: '2026-01-08 09:10' },
    { id: 'f3', code: 'SF0003', name: '急诊挂号费', category: '挂号', priceCents: 2000, status: 1, createdAt: '2026-01-08 09:20' },
    { id: 'f4', code: 'SF0004', name: '床位费(日)', category: '住院', priceCents: 6000, status: 1, createdAt: '2026-01-08 09:30' },
    { id: 'f5', code: 'SF0005', name: '一级护理费(日)', category: '住院', priceCents: 4000, status: 1, createdAt: '2026-01-08 09:40' },
    { id: 'f6', code: 'SF0006', name: '静脉输液费', category: '门诊', priceCents: 2000, status: 1, createdAt: '2026-01-08 09:50' }
  ]

  const stocks = [
    { id: 'st1', medicineId: 'm1', batchNo: '20260801', qty: 300, expiry: '2027-07-31', createdAt: '2026-08-01 09:00' },
    { id: 'st2', medicineId: 'm1', batchNo: '20260815', qty: 180, expiry: '2027-08-14', createdAt: '2026-08-15 09:00' },
    { id: 'st3', medicineId: 'm2', batchNo: '20260715', qty: 260, expiry: '2027-06-30', createdAt: '2026-07-15 09:00' },
    { id: 'st4', medicineId: 'm3', batchNo: '20260810', qty: 320, expiry: '2027-08-09', createdAt: '2026-08-10 09:00' },
    { id: 'st5', medicineId: 'm4', batchNo: '20260720', qty: 150, expiry: '2027-07-19', createdAt: '2026-07-20 09:00' },
    { id: 'st6', medicineId: 'm6', batchNo: '20260805', qty: 180, expiry: '2027-08-04', createdAt: '2026-08-05 09:00' },
    { id: 'st7', medicineId: 'm7', batchNo: '20260820', qty: 600, expiry: '2027-08-19', createdAt: '2026-08-20 09:00' },
    { id: 'st8', medicineId: 'm8', batchNo: '20260818', qty: 400, expiry: '2027-08-17', createdAt: '2026-08-18 09:00' },
    { id: 'st9', medicineId: 'm9', batchNo: '20260812', qty: 220, expiry: '2027-08-11', createdAt: '2026-08-12 09:00' },
    { id: 'st10', medicineId: 'm10', batchNo: '20260725', qty: 130, expiry: '2027-07-24', createdAt: '2026-07-25 09:00' }
  ]

  // 排班：08-17 ~ 08-28 覆盖演示周与本周
  const schedules = []
  let scId = 1
  function sched(docId, depId, date, period, limit) {
    schedules.push({ id: 'sc' + scId++, doctorId: docId, departmentId: depId, date, period, limit: limit || 30, createdAt: '2026-08-10 09:00' })
  }
  const week1 = ['2026-08-17', '2026-08-18', '2026-08-19', '2026-08-20', '2026-08-21']
  const week2 = ['2026-08-22', '2026-08-23', '2026-08-24', '2026-08-25', '2026-08-26', '2026-08-27', '2026-08-28']
  week1.forEach((dt) => {
    sched('s0', 'dep1', dt, '上午', 40)
    sched('s1', 'dep1', dt, '上午', 30)
    sched('s2', 'dep1', dt, '下午', 30)
    sched('s3', 'dep2', dt, '上午', 30)
    sched('s4', 'dep2', dt, '下午', 30)
    sched('s5', 'dep3', dt, '上午', 25)
    sched('s5', 'dep3', dt, '下午', 25)
    sched('s6', 'dep4', dt, '上午', 40)
    sched('s6', 'dep4', dt, '下午', 40)
    sched('s7', 'dep5', dt, '上午', 50)
    sched('s8', 'dep6', dt, '上午', 50)
  })
  week2.forEach((dt) => {
    sched('s0', 'dep1', dt, '上午', 40)
    sched('s1', 'dep1', dt, '上午', 30)
    sched('s1', 'dep1', dt, '下午', 30)
    sched('s2', 'dep1', dt, '上午', 30)
    sched('s3', 'dep2', dt, '上午', 30)
    sched('s4', 'dep2', dt, '下午', 30)
    sched('s5', 'dep3', dt, '上午', 25)
    sched('s5', 'dep3', dt, '下午', 25)
    sched('s6', 'dep4', dt, '上午', 40)
    sched('s6', 'dep4', dt, '下午', 40)
    sched('s7', 'dep5', dt, '上午', 50)
    sched('s8', 'dep6', dt, '上午', 50)
    sched('s10', 'dep1', dt, '下午', 20)
    sched('s9', 'dep7', dt, '上午', 60)
  })

  // 挂号记录
  const registrations = [
    { id: 'r0', code: 'REG1787448338041', patientId: 'p1', departmentId: 'dep1', doctorId: 's0', date: '2026-08-23', period: '上午', feeCents: 1500, regStatus: '待分诊', payStatus: '已缴费', visitId: '', createdAt: '2026-08-23 07:58' },
    { id: 'r1', code: 'REG0000000002116', patientId: 'p4', departmentId: 'dep1', doctorId: 's0', date: '2026-08-22', period: '上午', feeCents: 1500, regStatus: '已完成', payStatus: '已缴费', visitId: 'v1', createdAt: '2026-08-22 08:02' },
    { id: 'r2', code: 'REG0000000002117', patientId: 'p3', departmentId: 'dep1', doctorId: 's0', date: '2026-08-22', period: '上午', feeCents: 1500, regStatus: '已完成', payStatus: '已缴费', visitId: 'v2', createdAt: '2026-08-22 08:10' },
    { id: 'r3', code: 'REG0000000002118', patientId: 'p3', departmentId: 'dep1', doctorId: 's0', date: '2026-08-22', period: '上午', feeCents: 1500, regStatus: '已完成', payStatus: '已缴费', visitId: 'v3', createdAt: '2026-08-22 08:15' },
    { id: 'r4', code: 'REG0000000002119', patientId: 'p0', departmentId: 'dep1', doctorId: 's1', date: '2026-08-22', period: '上午', feeCents: 1500, regStatus: '已完成', payStatus: '已缴费', visitId: 'v4', createdAt: '2026-08-22 08:20' },
    { id: 'r5', code: 'REG0000000002120', patientId: 'p5', departmentId: 'dep2', doctorId: 's3', date: '2026-08-22', period: '上午', feeCents: 1500, regStatus: '已完成', payStatus: '已缴费', visitId: 'v5', createdAt: '2026-08-22 08:25' },
    { id: 'r6', code: 'REG0000000002121', patientId: 'p6', departmentId: 'dep3', doctorId: 's5', date: '2026-08-22', period: '上午', feeCents: 1500, regStatus: '已完成', payStatus: '已缴费', visitId: 'v6', createdAt: '2026-08-22 09:01' },
    { id: 'r7', code: 'REG0000000002122', patientId: 'p7', departmentId: 'dep2', doctorId: 's4', date: '2026-08-22', period: '下午', feeCents: 1500, regStatus: '已退号', payStatus: '已退费', visitId: '', createdAt: '2026-08-22 09:10' },
    { id: 'r8', code: 'REG0000000002123', patientId: 'p8', departmentId: 'dep4', doctorId: 's6', date: '2026-08-23', period: '上午', feeCents: 2000, regStatus: '已完成', payStatus: '已缴费', visitId: 'v7', createdAt: '2026-08-23 08:05' },
    { id: 'r9', code: 'REG0000000002124', patientId: 'p9', departmentId: 'dep1', doctorId: 's2', date: '2026-08-23', period: '下午', feeCents: 1500, regStatus: '已完成', payStatus: '已缴费', visitId: 'v8', createdAt: '2026-08-23 13:02' },
    { id: 'r10', code: 'REG0000000002125', patientId: 'p10', departmentId: 'dep5', doctorId: 's7', date: '2026-08-23', period: '上午', feeCents: 1500, regStatus: '已完成', payStatus: '已缴费', visitId: 'v9', createdAt: '2026-08-23 08:40' },
    { id: 'r11', code: 'REG0000000002126', patientId: 'p11', departmentId: 'dep6', doctorId: 's8', date: '2026-08-23', period: '上午', feeCents: 1500, regStatus: '已退号', payStatus: '已退费', visitId: '', createdAt: '2026-08-23 09:30' },
    { id: 'r12', code: 'REG0000000002127', patientId: 'p2', departmentId: 'dep1', doctorId: 's1', date: '2026-08-24', period: '上午', feeCents: 1500, regStatus: '已完成', payStatus: '已缴费', visitId: 'v10', createdAt: '2026-08-24 08:01' },
    { id: 'r13', code: 'REG0000000002128', patientId: 'p6', departmentId: 'dep1', doctorId: 's2', date: '2026-08-24', period: '上午', feeCents: 1500, regStatus: '已完成', payStatus: '已缴费', visitId: 'v11', createdAt: '2026-08-24 08:12' },
    { id: 'r14', code: 'REG0000000002129', patientId: 'p8', departmentId: 'dep2', doctorId: 's3', date: '2026-08-24', period: '上午', feeCents: 1500, regStatus: '已完成', payStatus: '已缴费', visitId: 'v12', createdAt: '2026-08-24 08:20' },
    { id: 'r15', code: 'REG0000000002130', patientId: 'p9', departmentId: 'dep3', doctorId: 's5', date: '2026-08-25', period: '上午', feeCents: 1500, regStatus: '已完成', payStatus: '已缴费', visitId: 'v13', createdAt: '2026-08-25 08:05' },
    { id: 'r16', code: 'REG0000000002131', patientId: 'p10', departmentId: 'dep4', doctorId: 's6', date: '2026-08-25', period: '下午', feeCents: 2000, regStatus: '待分诊', payStatus: '未缴费', visitId: '', createdAt: '2026-08-25 14:30' },
    { id: 'r17', code: 'REG0000000002132', patientId: 'p11', departmentId: 'dep1', doctorId: 's1', date: '2026-08-26', period: '上午', feeCents: 1500, regStatus: '待分诊', payStatus: '已缴费', visitId: '', createdAt: '2026-08-26 08:10' },
    { id: 'r18', code: 'REG0000000002133', patientId: 'p7', departmentId: 'dep2', doctorId: 's4', date: '2026-08-26', period: '下午', feeCents: 1500, regStatus: '待分诊', payStatus: '已缴费', visitId: '', createdAt: '2026-08-26 13:40' },
    { id: 'r19', code: 'REG0000000002134', patientId: 'p5', departmentId: 'dep6', doctorId: 's8', date: '2026-08-27', period: '上午', feeCents: 1500, regStatus: '待分诊', payStatus: '已缴费', visitId: '', createdAt: '2026-08-27 08:00' },
    { id: 'r20', code: 'REG0000000002135', patientId: 'p0', departmentId: 'dep5', doctorId: 's7', date: '2026-08-27', period: '上午', feeCents: 1500, regStatus: '待分诊', payStatus: '已缴费', visitId: '', createdAt: '2026-08-27 08:20' }
  ]

  // 接诊记录（amountCents = qty * priceCents，整数分）
  const visits = [
    { id: 'v1', code: 'VIS000000000001', regId: 'r1', patientId: 'p4', doctorId: 's0', departmentId: 'dep1', date: '2026-08-22', visitStatus: '已完成', needHospital: '否', complaint: '发热、咽痛两天', history: '两天前无明显诱因出现发热，体温最高38.6℃，伴咽痛、乏力。', diagnosis: '急性咽炎', advice: '抗感染治疗，多饮水，注意休息。', prescriptions: [{ medicineId: 'm1', medicineName: '阿莫西林胶囊', usage: '口服', qty: 1, priceCents: 1250, amountCents: 1250 }], exams: [], chargeStatus: '已收费', dispenseStatus: '已发药', reportStatus: '—', reports: [], createdAt: '2026-08-22 09:20' },
    { id: 'v2', code: 'VIS000000000002', regId: 'r2', patientId: 'p3', doctorId: 's0', departmentId: 'dep1', date: '2026-08-22', visitStatus: '就诊中', needHospital: '否', complaint: '咳嗽、咳痰三天', history: '三天前受凉后出现咳嗽、咳痰，痰白质稀，无发热。', diagnosis: '急性支气管炎', advice: '抗感染、止咳化痰治疗，观察病情变化。', prescriptions: [{ medicineId: 'm4', medicineName: '感冒灵颗粒', usage: '口服', qty: 1, priceCents: 980, amountCents: 980 }], exams: [{ examItemId: 'e1', examItemName: '血常规', qty: 1, priceCents: 2500, amountCents: 2500 }], chargeStatus: '未收费', dispenseStatus: '未发药', reportStatus: '待报告', reports: [], createdAt: '2026-08-22 09:40' },
    { id: 'v3', code: 'VIS000000000003', regId: 'r3', patientId: 'p3', doctorId: 's0', departmentId: 'dep1', date: '2026-08-22', visitStatus: '已完成', needHospital: '否', complaint: '腹痛、腹泻一天', history: '一天前进食不洁食物后出现腹痛、腹泻，为水样便。', diagnosis: '急性胃肠炎', advice: '补液、止泻、抗感染，清淡饮食。', prescriptions: [{ medicineId: 'm6', medicineName: '蒙脱石散', usage: '口服', qty: 1, priceCents: 1450, amountCents: 1450 }, { medicineId: 'm1', medicineName: '阿莫西林胶囊', usage: '口服', qty: 1, priceCents: 1250, amountCents: 1250 }], exams: [{ examItemId: 'e2', examItemName: '尿常规', qty: 1, priceCents: 1000, amountCents: 1000 }], chargeStatus: '未收费', dispenseStatus: '未发药', reportStatus: '待报告', reports: [], createdAt: '2026-08-22 09:55' },
    { id: 'v4', code: 'VIS000000000004', regId: 'r4', patientId: 'p0', doctorId: 's1', departmentId: 'dep1', date: '2026-08-22', visitStatus: '已完成', needHospital: '否', complaint: '头晕一周', history: '一周来反复头晕，晨起明显，休息后缓解。', diagnosis: '神经性眩晕', advice: '口服药物，注意休息，必要时复诊。', prescriptions: [{ medicineId: 'm5', medicineName: '维生素C片', usage: '口服', qty: 1, priceCents: 650, amountCents: 650 }], exams: [{ examItemId: 'e5', examItemName: '心电图', qty: 1, priceCents: 3000, amountCents: 3000 }], chargeStatus: '已收费', dispenseStatus: '已发药', reportStatus: '已出报告', reports: [{ examItemId: 'e5', examItemName: '心电图', content: '窦性心律，未见明显 ST-T 改变。', at: '2026-08-22 10:35' }], createdAt: '2026-08-22 10:10' },
    { id: 'v5', code: 'VIS000000000005', regId: 'r5', patientId: 'p5', doctorId: 's3', departmentId: 'dep2', date: '2026-08-22', visitStatus: '已完成', needHospital: '建议住院', complaint: '右上腹疼痛三天', history: '三天前出现右上腹疼痛，进食油腻后加重。', diagnosis: '胆囊结石伴胆囊炎', advice: '建议住院行手术治疗。', prescriptions: [{ medicineId: 'm9', medicineName: '阿奇霉素片', usage: '口服', qty: 1, priceCents: 1950, amountCents: 1950 }], exams: [{ examItemId: 'e6', examItemName: '腹部B超', qty: 1, priceCents: 18000, amountCents: 18000 }], chargeStatus: '已收费', dispenseStatus: '已发药', reportStatus: '已出报告', reports: [{ examItemId: 'e6', examItemName: '腹部B超', content: '胆囊内见多发强回声团伴声影，最大约 1.2cm，胆囊壁毛糙增厚。', at: '2026-08-22 11:05' }], createdAt: '2026-08-22 10:30' },
    { id: 'v6', code: 'VIS000000000006', regId: 'r6', patientId: 'p6', doctorId: 's5', departmentId: 'dep3', date: '2026-08-22', visitStatus: '已完成', needHospital: '否', complaint: '咳嗽一周', history: '一周来咳嗽，夜间加重，无发热。', diagnosis: '支气管炎', advice: '止咳化痰治疗。', prescriptions: [{ medicineId: 'm4', medicineName: '感冒灵颗粒', usage: '口服', qty: 1, priceCents: 980, amountCents: 980 }], exams: [{ examItemId: 'e4', examItemName: '胸部X光', qty: 1, priceCents: 12000, amountCents: 12000 }], chargeStatus: '已收费', dispenseStatus: '已发药', reportStatus: '已出报告', reports: [{ examItemId: 'e4', examItemName: '胸部X光', content: '双肺纹理增粗，未见实变影。', at: '2026-08-22 11:25' }], createdAt: '2026-08-22 11:00' },
    { id: 'v7', code: 'VIS000000000007', regId: 'r8', patientId: 'p8', doctorId: 's6', departmentId: 'dep4', date: '2026-08-23', visitStatus: '已完成', needHospital: '否', complaint: '手部外伤半小时', history: '半小时前不慎被刀具割伤右手，出血较多。', diagnosis: '右手皮肤裂伤', advice: '清创缝合，破伤风抗毒素注射。', prescriptions: [{ medicineId: 'm1', medicineName: '阿莫西林胶囊', usage: '口服', qty: 1, priceCents: 1250, amountCents: 1250 }], exams: [], chargeStatus: '已收费', dispenseStatus: '已发药', reportStatus: '—', reports: [], createdAt: '2026-08-23 09:15' },
    { id: 'v8', code: 'VIS000000000008', regId: 'r9', patientId: 'p9', doctorId: 's2', departmentId: 'dep1', date: '2026-08-23', visitStatus: '已完成', needHospital: '否', complaint: '胃部不适三天', history: '三天来胃部胀满不适，反酸，食欲不振。', diagnosis: '慢性胃炎', advice: '抑酸护胃，规律饮食。', prescriptions: [{ medicineId: 'm10', medicineName: '奥美拉唑肠溶胶囊', usage: '口服', qty: 1, priceCents: 2200, amountCents: 2200 }], exams: [{ examItemId: 'e3', examItemName: '肝功能八项', qty: 1, priceCents: 5500, amountCents: 5500 }], chargeStatus: '已收费', dispenseStatus: '已发药', reportStatus: '已出报告', reports: [{ examItemId: 'e3', examItemName: '肝功能八项', content: '各项指标均在正常范围。', at: '2026-08-23 14:45' }], createdAt: '2026-08-23 14:20' },
    { id: 'v9', code: 'VIS000000000009', regId: 'r10', patientId: 'p10', doctorId: 's7', departmentId: 'dep5', date: '2026-08-23', visitStatus: '已完成', needHospital: '否', complaint: '体检复查', history: '常规体检复查，无特殊不适。', diagnosis: '未见明显异常', advice: '保持良好生活习惯。', prescriptions: [], exams: [{ examItemId: 'e1', examItemName: '血常规', qty: 1, priceCents: 2500, amountCents: 2500 }, { examItemId: 'e8', examItemName: '血糖检测', qty: 1, priceCents: 800, amountCents: 800 }], chargeStatus: '已收费', dispenseStatus: '—', reportStatus: '已出报告', reports: [{ examItemId: 'e1', examItemName: '血常规', content: '白细胞、血红蛋白、血小板计数均在正常范围。', at: '2026-08-23 09:55' }, { examItemId: 'e8', examItemName: '血糖检测', content: '空腹血糖 5.2mmol/L，正常。', at: '2026-08-23 09:58' }], createdAt: '2026-08-23 09:30' },
    { id: 'v10', code: 'VIS000000000010', regId: 'r12', patientId: 'p2', doctorId: 's1', departmentId: 'dep1', date: '2026-08-24', visitStatus: '已完成', needHospital: '否', complaint: '发热一天', history: '一天前发热，体温38.2℃，伴轻微咳嗽。', diagnosis: '上呼吸道感染', advice: '退热、抗感染，多饮水。', prescriptions: [{ medicineId: 'm3', medicineName: '布洛芬缓释胶囊', usage: '口服', qty: 1, priceCents: 1600, amountCents: 1600 }], exams: [{ examItemId: 'e1', examItemName: '血常规', qty: 1, priceCents: 2500, amountCents: 2500 }], chargeStatus: '已收费', dispenseStatus: '已发药', reportStatus: '已出报告', reports: [{ examItemId: 'e1', examItemName: '血常规', content: '白细胞轻度升高，余未见异常。', at: '2026-08-24 09:45' }], createdAt: '2026-08-24 09:10' },
    { id: 'v11', code: 'VIS000000000011', regId: 'r13', patientId: 'p6', doctorId: 's2', departmentId: 'dep1', date: '2026-08-24', visitStatus: '已完成', needHospital: '否', complaint: '复查', history: '支气管炎治疗一周后复查。', diagnosis: '恢复期', advice: '继续巩固治疗。', prescriptions: [{ medicineId: 'm4', medicineName: '感冒灵颗粒', usage: '口服', qty: 1, priceCents: 980, amountCents: 980 }], exams: [], chargeStatus: '已收费', dispenseStatus: '已发药', reportStatus: '—', reports: [], createdAt: '2026-08-24 09:40' },
    { id: 'v12', code: 'VIS000000000012', regId: 'r14', patientId: 'p8', doctorId: 's3', departmentId: 'dep2', date: '2026-08-24', visitStatus: '已完成', needHospital: '否', complaint: '伤口换药', history: '手部外伤术后换药复查。', diagnosis: '伤口愈合良好', advice: '定期换药，注意伤口卫生。', prescriptions: [], exams: [], chargeStatus: '已收费', dispenseStatus: '—', reportStatus: '—', reports: [], createdAt: '2026-08-24 10:00' },
    { id: 'v13', code: 'VIS000000000013', regId: 'r15', patientId: 'p9', doctorId: 's5', departmentId: 'dep3', date: '2026-08-25', visitStatus: '已完成', needHospital: '否', complaint: '腹痛两天', history: '两天来阵发性腹痛，无呕吐腹泻。', diagnosis: '肠痉挛', advice: '解痉止痛，注意饮食。', prescriptions: [{ medicineId: 'm6', medicineName: '蒙脱石散', usage: '口服', qty: 1, priceCents: 1450, amountCents: 1450 }], exams: [{ examItemId: 'e6', examItemName: '腹部B超', qty: 1, priceCents: 18000, amountCents: 18000 }], chargeStatus: '已收费', dispenseStatus: '已发药', reportStatus: '已出报告', reports: [{ examItemId: 'e6', examItemName: '腹部B超', content: '肝胆胰脾肾未见明显异常。', at: '2026-08-25 09:45' }], createdAt: '2026-08-25 09:20' }
  ]

  const feeRecords = [
    { id: 'fr0', code: 'PAY000000000001', type: '挂号费', refId: 'r0', amountCents: 1500, status: '已缴费', paidAt: '2026-08-23 07:58' },
    { id: 'fr1', code: 'PAY000000000002', type: '挂号费', refId: 'r1', amountCents: 1500, status: '已缴费', paidAt: '2026-08-22 08:02' },
    { id: 'fr2', code: 'PAY000000000003', type: '挂号费', refId: 'r2', amountCents: 1500, status: '已缴费', paidAt: '2026-08-22 08:10' },
    { id: 'fr3', code: 'PAY000000000004', type: '挂号费', refId: 'r3', amountCents: 1500, status: '已缴费', paidAt: '2026-08-22 08:15' },
    { id: 'fr4', code: 'PAY000000000005', type: '挂号费', refId: 'r4', amountCents: 1500, status: '已缴费', paidAt: '2026-08-22 08:20' },
    { id: 'fr5', code: 'PAY000000000006', type: '挂号费', refId: 'r5', amountCents: 1500, status: '已缴费', paidAt: '2026-08-22 08:25' },
    { id: 'fr6', code: 'PAY000000000007', type: '挂号费', refId: 'r6', amountCents: 1500, status: '已缴费', paidAt: '2026-08-22 09:01' },
    { id: 'fr7', code: 'PAY000000000008', type: '挂号费', refId: 'r7', amountCents: 1500, status: '已退费', paidAt: '2026-08-22 09:11' },
    { id: 'fr8', code: 'PAY000000000009', type: '挂号费', refId: 'r8', amountCents: 2000, status: '已缴费', paidAt: '2026-08-23 08:05' },
    { id: 'fr9', code: 'PAY000000000010', type: '挂号费', refId: 'r9', amountCents: 1500, status: '已缴费', paidAt: '2026-08-23 13:02' },
    { id: 'fr10', code: 'PAY000000000011', type: '挂号费', refId: 'r10', amountCents: 1500, status: '已缴费', paidAt: '2026-08-23 08:40' },
    { id: 'fr11', code: 'PAY000000000012', type: '挂号费', refId: 'r11', amountCents: 1500, status: '已退费', paidAt: '2026-08-23 09:31' },
    { id: 'fr12', code: 'PAY000000000013', type: '挂号费', refId: 'r12', amountCents: 1500, status: '已缴费', paidAt: '2026-08-24 08:01' },
    { id: 'fr13', code: 'PAY000000000014', type: '挂号费', refId: 'r13', amountCents: 1500, status: '已缴费', paidAt: '2026-08-24 08:12' },
    { id: 'fr14', code: 'PAY000000000015', type: '挂号费', refId: 'r14', amountCents: 1500, status: '已缴费', paidAt: '2026-08-24 08:20' },
    { id: 'fr15', code: 'PAY000000000016', type: '挂号费', refId: 'r15', amountCents: 1500, status: '已缴费', paidAt: '2026-08-25 08:05' },
    { id: 'fr16', code: 'PAY000000000017', type: '挂号费', refId: 'r17', amountCents: 1500, status: '已缴费', paidAt: '2026-08-26 08:10' },
    { id: 'fr17', code: 'PAY000000000018', type: '挂号费', refId: 'r18', amountCents: 1500, status: '已缴费', paidAt: '2026-08-26 13:40' },
    { id: 'fr18', code: 'PAY000000000019', type: '挂号费', refId: 'r19', amountCents: 1500, status: '已缴费', paidAt: '2026-08-27 08:00' },
    { id: 'fr19', code: 'PAY000000000020', type: '挂号费', refId: 'r20', amountCents: 1500, status: '已缴费', paidAt: '2026-08-27 08:20' },
    { id: 'fr20', code: 'PAY000000000021', type: '门诊收费', refId: 'v1', amountCents: 1250, status: '已缴费', paidAt: '2026-08-22 10:05' },
    { id: 'fr21', code: 'PAY000000000022', type: '门诊收费', refId: 'v4', amountCents: 3650, status: '已缴费', paidAt: '2026-08-22 10:40' },
    { id: 'fr22', code: 'PAY000000000023', type: '门诊收费', refId: 'v5', amountCents: 19950, status: '已缴费', paidAt: '2026-08-22 11:10' },
    { id: 'fr23', code: 'PAY000000000024', type: '门诊收费', refId: 'v6', amountCents: 12980, status: '已缴费', paidAt: '2026-08-22 11:30' },
    { id: 'fr24', code: 'PAY000000000025', type: '门诊收费', refId: 'v7', amountCents: 1250, status: '已缴费', paidAt: '2026-08-23 09:40' },
    { id: 'fr25', code: 'PAY000000000026', type: '门诊收费', refId: 'v8', amountCents: 7700, status: '已缴费', paidAt: '2026-08-23 14:50' },
    { id: 'fr26', code: 'PAY000000000027', type: '门诊收费', refId: 'v9', amountCents: 3300, status: '已缴费', paidAt: '2026-08-23 10:00' },
    { id: 'fr27', code: 'PAY000000000028', type: '门诊收费', refId: 'v10', amountCents: 4100, status: '已缴费', paidAt: '2026-08-24 09:50' },
    { id: 'fr28', code: 'PAY000000000029', type: '门诊收费', refId: 'v11', amountCents: 980, status: '已缴费', paidAt: '2026-08-24 10:10' },
    { id: 'fr29', code: 'PAY000000000030', type: '门诊收费', refId: 'v12', amountCents: 0, status: '已缴费', paidAt: '2026-08-24 10:20' },
    { id: 'fr30', code: 'PAY000000000031', type: '门诊收费', refId: 'v13', amountCents: 19450, status: '已缴费', paidAt: '2026-08-25 09:50' }
  ]

  const admissions = [
    { id: 'a1', code: 'ADM1787418085971', patientId: 'p4', departmentId: 'dep1', wardId: 'w1', bedId: 'b1', doctorId: 's10', depositCents: 0, status: '已出院', admitAt: '2026-08-18 10:00', confirmAt: '2026-08-18 11:20', dischargeAt: '2026-08-25 15:00', createdAt: '2026-08-18 09:40' },
    { id: 'a2', code: 'ADM1787418227546', patientId: 'p3', departmentId: 'dep1', wardId: 'w1', bedId: 'b2', doctorId: 's10', depositCents: 10000, status: '待结算', admitAt: '2026-08-24 09:30', confirmAt: '2026-08-24 10:00', dischargeAt: '', createdAt: '2026-08-24 09:10' },
    { id: 'a3', code: 'ADM20260827001', patientId: 'p5', departmentId: 'dep2', wardId: 'w3', bedId: 'b7', doctorId: 's3', depositCents: 200000, status: '在院', admitAt: '2026-08-27 14:00', confirmAt: '2026-08-27 14:30', dischargeAt: '', createdAt: '2026-08-27 13:40' },
    { id: 'a4', code: 'ADM20260828001', patientId: 'p2', departmentId: 'dep3', wardId: 'w5', bedId: 'b11', doctorId: 's5', depositCents: 50000, status: '待入科', admitAt: '2026-08-28 08:40', confirmAt: '', dischargeAt: '', createdAt: '2026-08-28 08:20' }
  ]

  const orders = [
    { id: 'o1', admissionId: 'a1', type: '收费项目', refId: 'f4', name: '床位费(日)', qty: 3, priceCents: 6000, status: '已执行', executedAt: '2026-08-22 09:00', createdAt: '2026-08-19 09:00' },
    { id: 'o2', admissionId: 'a1', type: '药品', refId: 'm7', name: '氯化钠注射液', qty: 2, priceCents: 850, status: '已执行', executedAt: '2026-08-20 09:00', createdAt: '2026-08-19 09:10' },
    { id: 'o3', admissionId: 'a2', type: '收费项目', refId: 'f5', name: '一级护理费(日)', qty: 4, priceCents: 4000, status: '已执行', executedAt: '2026-08-27 09:00', createdAt: '2026-08-24 10:10' },
    { id: 'o4', admissionId: 'a2', type: '医技项目', refId: 'e4', name: '胸部X光', qty: 1, priceCents: 12000, status: '已执行', executedAt: '2026-08-26 10:00', createdAt: '2026-08-25 10:00' },
    { id: 'o5', admissionId: 'a3', type: '药品', refId: 'm8', name: '葡萄糖注射液', qty: 1, priceCents: 720, status: '已执行', executedAt: '2026-08-27 15:00', createdAt: '2026-08-27 14:40' },
    { id: 'o6', admissionId: 'a3', type: '医技项目', refId: 'e6', name: '腹部B超', qty: 1, priceCents: 18000, status: '未执行', executedAt: '', createdAt: '2026-08-28 08:00' }
  ]

  const settlements = [
    {
      id: 'set1', admissionId: 'a1', totalCents: 19700, depositCents: 0, balanceCents: -19700,
      status: '已结算', settledAt: '2026-08-25 15:10', createdAt: '2026-08-25 15:00'
    }
  ]

  const logs = [
    { id: 'lg1', operator: '系统管理员', action: '登录系统', target: '登录', time: '2026-08-28 08:30', ip: '192.168.1.10' },
    { id: 'lg2', operator: '系统管理员', action: '新增', target: '入院登记 ADM20260828001', time: '2026-08-28 08:21', ip: '192.168.1.10' },
    { id: 'lg3', operator: '系统管理员', action: '修改', target: '员工 S010 李国强', time: '2026-08-27 17:02', ip: '192.168.1.10' },
    { id: 'lg4', operator: '系统管理员', action: '删除', target: '收费项目 SF0007', time: '2026-08-27 16:40', ip: '192.168.1.10' },
    { id: 'lg5', operator: '系统管理员', action: '重置密码', target: '员工 S009 孙志强', time: '2026-08-27 15:12', ip: '192.168.1.10' },
    { id: 'lg6', operator: '系统管理员', action: '导出', target: '挂号记录 CSV', time: '2026-08-27 11:05', ip: '192.168.1.10' },
    { id: 'lg7', operator: '系统管理员', action: '退号', target: '挂号 REG0000000002126', time: '2026-08-23 09:31', ip: '192.168.1.10' },
    { id: 'lg8', operator: '系统管理员', action: '登录系统', target: '登录', time: '2026-08-22 08:00', ip: '192.168.1.10' }
  ]

  const roles = [
    { id: 'role1', name: '超级管理员', code: 'SUPER_ADMIN', description: '拥有全部菜单权限', menuCodes: ['*'] },
    { id: 'role2', name: '门诊医生', code: 'DOCTOR', description: '门诊接诊、排班、处方', menuCodes: ['home', 'patient', 'outpatient'] },
    { id: 'role3', name: '挂号收费员', code: 'CASHIER', description: '挂号与收费', menuCodes: ['home', 'patient', 'outpatient-registration', 'outpatient-charge'] },
    { id: 'role4', name: '住院医生', code: 'RESIDENT', description: '住院医嘱与结算', menuCodes: ['home', 'patient', 'inpatient'] },
    { id: 'role5', name: '护士长', code: 'HEAD_NURSE', description: '床位与医嘱执行', menuCodes: ['home', 'basic-bed', 'basic-ward', 'inpatient'] }
  ]

  const menus = [
    { id: 'm-home', code: 'home', name: '首页', type: 'menu', children: [] },
    {
      id: 'm-basic', code: 'basic', name: '基础资料', type: 'group', children: [
        { id: 'm-dept', code: 'basic-dept', name: '科室管理', type: 'menu', children: [] },
        { id: 'm-staff', code: 'basic-staff', name: '员工管理', type: 'menu', children: [] },
        { id: 'm-ward', code: 'basic-ward', name: '病区管理', type: 'menu', children: [] },
        { id: 'm-bed', code: 'basic-bed', name: '床位管理', type: 'menu', children: [] },
        { id: 'm-fee', code: 'basic-fee', name: '收费项目', type: 'menu', children: [] },
        { id: 'm-med', code: 'basic-medicine', name: '药品目录', type: 'menu', children: [] },
        { id: 'm-exam', code: 'basic-exam', name: '检验检查项目', type: 'menu', children: [] },
        { id: 'm-stock', code: 'basic-stock', name: '批次库存', type: 'menu', children: [] }
      ]
    },
    { id: 'm-patient', code: 'patient', name: '患者服务', type: 'group', children: [{ id: 'm-patient-list', code: 'patient-list', name: '患者档案', type: 'menu', children: [] }] },
    {
      id: 'm-out', code: 'outpatient', name: '门诊管理', type: 'group', children: [
        { id: 'm-out-sch', code: 'outpatient-schedule', name: '医生排班', type: 'menu', children: [] },
        { id: 'm-out-reg', code: 'outpatient-registration', name: '门诊挂号', type: 'menu', children: [] },
        { id: 'm-out-visit', code: 'outpatient-visit', name: '门诊接诊', type: 'menu', children: [] },
        { id: 'm-out-rx', code: 'outpatient-prescription', name: '处方查询', type: 'menu', children: [] },
        { id: 'm-out-exam', code: 'outpatient-examapply', name: '医技申请', type: 'menu', children: [] },
        { id: 'm-out-charge', code: 'outpatient-charge', name: '门诊收费', type: 'menu', children: [] },
        { id: 'm-out-disp', code: 'outpatient-dispense', name: '处方发药', type: 'menu', children: [] },
        { id: 'm-out-report', code: 'outpatient-report', name: '医技报告', type: 'menu', children: [] }
      ]
    },
    {
      id: 'm-in', code: 'inpatient', name: '住院管理', type: 'group', children: [
        { id: 'm-in-adm', code: 'inpatient-admission', name: '入院登记', type: 'menu', children: [] },
        { id: 'm-in-order', code: 'inpatient-order', name: '住院医嘱', type: 'menu', children: [] },
        { id: 'm-in-set', code: 'inpatient-settlement', name: '出院结算', type: 'menu', children: [] }
      ]
    },
    {
      id: 'm-sys', code: 'system', name: '系统管理', type: 'group', children: [
        { id: 'm-sys-role', code: 'system-role', name: '用户角色', type: 'menu', children: [] },
        { id: 'm-sys-menu', code: 'system-menu', name: '菜单权限', type: 'menu', children: [] },
        { id: 'm-sys-log', code: 'system-log', name: '操作日志', type: 'menu', children: [] },
        { id: 'm-sys-reset', code: 'system-reset', name: '演示数据重置', type: 'menu', children: [] }
      ]
    }
  ]

  return {
    version: 1,
    demoToday,
    savedAt: '2026-08-28 09:00:00',
    departments,
    wards,
    beds,
    staff,
    patients,
    medicines,
    examItems,
    feeItems,
    stocks,
    schedules,
    registrations,
    visits,
    feeRecords,
    admissions,
    orders,
    settlements,
    logs,
    roles,
    menus,
    counters: {
      patient: 12,
      reg: 2135,
      visit: 13,
      admission: 2,
      feeRecord: 31,
      staff: 12,
      bed: 12,
      medicine: 10,
      exam: 8,
      feeItem: 6,
      stock: 10,
      order: 6,
      // 集合 id 计数器（nextId 使用，必须与种子最大序号一致）
      departments: 8,
      wards: 6,
      beds: 12,
      patients: 12,
      registrations: 21,
      visits: 13,
      feeRecords: 31,
      schedules: 153,
      admissions: 4,
      orders: 6,
      settlements: 1,
      logs: 8,
      roles: 5,
      medicines: 10,
      examItems: 8,
      feeItems: 6,
      stocks: 10
    }
  }
}

module.exports = { buildSeed, demoToday }
