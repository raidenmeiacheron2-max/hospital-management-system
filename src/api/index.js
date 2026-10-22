// ===== API 层：按域分组 =====
import request from '@/utils/request'

// ---------- auth ----------
export const apiLogin = (data) => request.post('/auth/login', data)
export const apiLogout = () => request.post('/auth/logout')

// ---------- dashboard ----------
export const apiStats = () => request.get('/dashboard/stats')

// ---------- 基础资料 ----------
export const apiListDepartments = (params) => request.get('/departments', { params })
export const apiCreateDepartment = (data) => request.post('/departments', data)
export const apiUpdateDepartment = (id, data) => request.put(`/departments/${id}`, data)
export const apiDeleteDepartment = (id) => request.delete(`/departments/${id}`)

export const apiListStaff = (params) => request.get('/staff', { params })
export const apiCreateStaff = (data) => request.post('/staff', data)
export const apiUpdateStaff = (id, data) => request.put(`/staff/${id}`, data)
export const apiDeleteStaff = (id) => request.delete(`/staff/${id}`)
export const apiSetStaffEnabled = (id, enabled) => request.put(`/staff/${id}/enabled`, { enabled })
export const apiResetStaffPassword = (id) => request.put(`/staff/${id}/password`)

export const apiListWards = (params) => request.get('/wards', { params })
export const apiCreateWard = (data) => request.post('/wards', data)
export const apiUpdateWard = (id, data) => request.put(`/wards/${id}`, data)
export const apiDeleteWard = (id) => request.delete(`/wards/${id}`)

export const apiListBeds = (params) => request.get('/beds', { params })
export const apiCreateBed = (data) => request.post('/beds', data)
export const apiUpdateBed = (id, data) => request.put(`/beds/${id}`, data)
export const apiDeleteBed = (id) => request.delete(`/beds/${id}`)

export const apiListMedicines = (params) => request.get('/medicines', { params })
export const apiCreateMedicine = (data) => request.post('/medicines', data)
export const apiUpdateMedicine = (id, data) => request.put(`/medicines/${id}`, data)
export const apiDeleteMedicine = (id) => request.delete(`/medicines/${id}`)

export const apiListExamItems = (params) => request.get('/exam-items', { params })
export const apiCreateExamItem = (data) => request.post('/exam-items', data)
export const apiUpdateExamItem = (id, data) => request.put(`/exam-items/${id}`, data)
export const apiDeleteExamItem = (id) => request.delete(`/exam-items/${id}`)

export const apiListFeeItems = (params) => request.get('/fee-items', { params })
export const apiCreateFeeItem = (data) => request.post('/fee-items', data)
export const apiUpdateFeeItem = (id, data) => request.put(`/fee-items/${id}`, data)
export const apiDeleteFeeItem = (id) => request.delete(`/fee-items/${id}`)

export const apiListStocks = (params) => request.get('/stocks', { params })
export const apiCreateStock = (data) => request.post('/stocks', data)
export const apiUpdateStock = (id, data) => request.put(`/stocks/${id}`, data)
export const apiDeleteStock = (id) => request.delete(`/stocks/${id}`)

// ---------- 患者 ----------
export const apiListPatients = (params) => request.get('/patients', { params })
export const apiCreatePatient = (data) => request.post('/patients', data)
export const apiUpdatePatient = (id, data) => request.put(`/patients/${id}`, data)
export const apiDeletePatient = (id) => request.delete(`/patients/${id}`)

// ---------- 门诊 ----------
export const apiListSchedules = (params) => request.get('/schedules', { params })
export const apiCreateSchedule = (data) => request.post('/schedules', data)
export const apiUpdateSchedule = (id, data) => request.put(`/schedules/${id}`, data)
export const apiDeleteSchedule = (id) => request.delete(`/schedules/${id}`)

export const apiListRegistrations = (params) => request.get('/registrations', { params })
export const apiCreateRegistration = (data) => request.post('/registrations', data)
export const apiRefundRegistration = (id) => request.put(`/registrations/${id}/refund`)

export const apiListVisits = (params) => request.get('/visits', { params })
export const apiCreateVisit = (data) => request.post('/visits', data)
export const apiUpdateVisit = (id, data) => request.put(`/visits/${id}`, data)
export const apiChargeVisit = (id) => request.put(`/visits/${id}/charge`)
export const apiDispenseVisit = (id) => request.put(`/visits/${id}/dispense`)
export const apiCreateReport = (id, data) => request.post(`/visits/${id}/report`, data)

export const apiListFeeRecords = (params) => request.get('/fee-records', { params })

// ---------- 住院 ----------
export const apiListAdmissions = (params) => request.get('/admissions', { params })
export const apiCreateAdmission = (data) => request.post('/admissions', data)
export const apiConfirmAdmission = (id) => request.put(`/admissions/${id}/confirm`)
export const apiTransferAdmission = (id, data) => request.put(`/admissions/${id}/transfer`, data)
export const apiCancelAdmission = (id) => request.put(`/admissions/${id}/cancel`)
export const apiRequestDischarge = (id) => request.put(`/admissions/${id}/discharge`)
export const apiSettleAdmission = (id) => request.put(`/admissions/${id}/settle`)
export const apiUpdateDeposit = (id, depositCents) => request.put(`/admissions/${id}/deposit`, { depositCents })

export const apiListOrders = (params) => request.get('/orders', { params })
export const apiCreateOrder = (data) => request.post('/orders', data)
export const apiExecuteOrder = (id) => request.put(`/orders/${id}/execute`)
export const apiCancelOrder = (id) => request.delete(`/orders/${id}`)

// ---------- 系统 ----------
export const apiListLogs = (params) => request.get('/logs', { params })
export const apiClearLogs = () => request.delete('/logs/clear')
export const apiListRoles = () => request.get('/roles')
export const apiCreateRole = (data) => request.post('/roles', data)
export const apiDeleteRole = (id) => request.delete(`/roles/${id}`)
export const apiSaveRoleMenus = (id, menuCodes) => request.put(`/roles/${id}/menus`, { menuCodes })
export const apiListMenus = () => request.get('/menus')
export const apiResetDemo = () => request.post('/system/reset')

// ---------- 选项字典 ----------
export const apiOptions = (name) => request.get(`/options/${name}`)
