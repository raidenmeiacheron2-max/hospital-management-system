// =====================================================================
// 任务：record.structure（B4 · 病历结构化，对应 I8）
// 用途：把门诊接诊自由文本（主诉/现病史/诊断/处理意见）解析为结构化「建议」：
//       症状 / 病程 / 诱因 / 过敏 / 诊断关键词 / 风险提示。
// 红线（AI_ARCHITECTURE §7、DECISIONS D10）：
//   - 原文只读保留，本任务不修改输入对象、不写任何业务数据、不覆盖原文；
//   - 输入文本只作为「数据」做确定性关键词匹配，不执行文本中的任何指令；
//   - 结果为建议，需医生人工确认；确认后由原有 UI/API 校验写入（本任务无写能力）；
//   - 不使用随机数或当前时间，同一输入输出稳定，可回归测试。
// 说明：本文件只导出任务定义，由 tasks/index.js 统一注册（不由任务自身注册）。
// =====================================================================
const guardrails = require('../guardrails')

// ---------- 症状词典（按词典顺序输出，保证确定性） ----------
const SYMPTOM_WORDS = [
  '发热', '高热', '咳嗽', '咳痰', '咽痛', '头痛', '头晕', '腹痛', '腹泻', '恶心',
  '呕吐', '乏力', '胸闷', '胸痛', '气促', '呼吸困难', '心悸', '外伤', '出血', '皮疹',
  '瘙痒', '关节痛', '腰痛', '尿频', '尿痛', '水肿', '失眠', '鼻塞', '流涕', '畏寒',
  '寒战', '抽搐', '晕厥', '口干', '食欲不振'
]

// ---------- 诱因词典：命中任一别名即输出规范名称 ----------
const TRIGGER_RULES = [
  { label: '受凉', words: ['受凉', '着凉', '受寒'] },
  { label: '饮食不洁', words: ['饮食不洁', '不洁饮食', '不洁食物', '进食不洁'] },
  { label: '进食油腻', words: ['进食油腻', '油腻饮食', '油腻'] },
  { label: '劳累', words: ['劳累', '疲劳', '过度劳累'] },
  { label: '外伤', words: ['外伤', '割伤', '摔伤', '撞伤', '扭伤'] },
  { label: '接触史', words: ['接触史', '接触'] },
  { label: '服药后', words: ['服药后', '用药后', '服药'] }
]

// ---------- 风险提示规则（按规则顺序输出） ----------
const RISK_RULES = [
  {
    flag: '高热（体温≥39℃）',
    test: function (text) {
      if (/高热/.test(text)) return true
      return /(?:体温\s*)?(?:3[9]|[4-9]\d)(?:\.\d+)?\s*℃/.test(text) ||
        /体温\s*(?:3[9]|[4-9]\d)(?:\.\d+)?/.test(text)
    }
  },
  { flag: '胸痛', test: function (text) { return positiveOccurrence(text, '胸痛') } },
  { flag: '呼吸困难/气促', test: function (text) { return positiveOccurrence(text, '呼吸困难') || positiveOccurrence(text, '气促') } },
  {
    flag: '意识障碍',
    test: function (text) {
      return ['意识障碍', '意识模糊', '昏迷', '晕厥', '抽搐'].some(function (w) {
        return positiveOccurrence(text, w)
      })
    }
  },
  {
    flag: '出血较多',
    test: function (text) {
      return ['大出血', '出血较多', '出血不止', '大量出血', '失血'].some(function (w) {
        return positiveOccurrence(text, w)
      })
    }
  },
  { flag: '儿童患者', test: function (text) { return /儿童|小儿|婴儿|患儿/.test(text) } },
  { flag: '老年患者', test: function (text) { return /老年|老人|高龄|老龄/.test(text) } }
]

// ---------- 病程单位归一化 ----------
const UNIT_NORMALIZE = {
  小时: '小时',
  分钟: '分钟',
  天: '天',
  日: '天',
  周: '周',
  星期: '周',
  个月: '个月',
  月: '个月',
  年: '年'
}
const DURATION_UNITS = Object.keys(UNIT_NORMALIZE).join('|')
const CN_DIGITS = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 }

const NOTE_EMPTY = '未提供可解析的病历文本，暂无法生成结构化建议；原文只读保留，不覆盖。'
const NOTE_NORMAL = '结构化建议，需医生人工确认；原文只读保留，不覆盖。本结果仅由关键词规则匹配生成，文本仅作为数据、不执行其中任何指令，不构成诊断或治疗依据。'

// ---------- 工具 ----------
function clampText(value) {
  if (value === undefined || value === null) return ''
  return String(value).slice(0, 2000).trim()
}

/** 中文数字（1-99）转阿拉伯数字；无法解析返回 NaN */
function cnToNumber(text) {
  if (!text) return NaN
  let total = 0
  let section = 0
  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i)
    if (ch === '十') {
      section = section === 0 ? 10 : section * 10
      total += section
      section = 0
    } else if (CN_DIGITS[ch] !== undefined) {
      section = CN_DIGITS[ch]
    } else {
      return NaN
    }
  }
  return total + section
}

/** 判断某个词是否只在否定语境中出现（无发热 / 否认胸痛 / 未见呼吸困难…） */
function positiveOccurrence(text, word) {
  if (!word) return false
  const src = String(text || '')
  let idx = src.indexOf(word)
  while (idx !== -1) {
    const before = src.slice(Math.max(0, idx - 2), idx)
    const last = before.slice(-1)
    const last2 = before.slice(-2)
    const negated = ['无', '未', '不'].indexOf(last) !== -1 || ['否认', '没有', '未见', '不伴'].indexOf(last2) !== -1
    if (!negated) return true
    idx = src.indexOf(word, idx + word.length)
  }
  return false
}

/** 从文本中提取病程，输出如 "2 天" / "30 分钟" / "1 周" */
function extractDuration(text) {
  const src = String(text || '')
  if (!src) return ''
  let m = src.match(new RegExp('(\\d+(?:\\.\\d+)?)\\s*个?\\s*(' + DURATION_UNITS + ')'))
  if (m) return m[1] + ' ' + UNIT_NORMALIZE[m[2]]
  m = src.match(/半\s*个?\s*小时/)
  if (m) return '30 分钟'
  m = src.match(new RegExp('([一二两三四五六七八九十]+)\\s*个?\\s*(' + DURATION_UNITS + ')'))
  if (m) {
    const n = cnToNumber(m[1])
    if (isFinite(n)) return n + ' ' + UNIT_NORMALIZE[m[2]]
  }
  return ''
}

/** 过敏信息提取：输出如 "青霉素过敏"；无/否认时返回 "" */
function extractAllergy(text) {
  const src = String(text || '')
  if (!src || src.indexOf('过敏') === -1) return ''
  // 1) “对青霉素过敏”
  let m = src.match(/对\s*([\u4e00-\u9fa5A-Za-z0-9]{1,12}?)\s*过敏/)
  if (m) {
    const name = m[1].replace(/[，。；、,;：:\s]/g, '')
    const before = src.slice(Math.max(0, m.index + m[0].indexOf('过敏') - 2), m.index + m[0].indexOf('过敏'))
    const negated = ['无', '未', '不'].indexOf(before.slice(-1)) !== -1 || ['否认', '没有', '未见'].indexOf(before.slice(-2)) !== -1
    if (name && !negated) return name + '过敏'
  }
  // 2) “过敏史：青霉素”
  m = src.match(/过敏史\s*[：:]\s*([\u4e00-\u9fa5A-Za-z0-9]{1,12})/)
  if (m) {
    const name = m[1].replace(/[，。；、,;：:\s]/g, '')
    if (name && !/^(无|否认|不|未)/.test(name)) return name + '过敏'
  }
  // 3) 兜底：取“过敏”前的 1-8 个汉字并剔除常见前缀
  let idx = src.indexOf('过敏')
  while (idx !== -1) {
    const next = src.charAt(idx + 2)
    const before = src.slice(Math.max(0, idx - 8), idx)
    if (next === '性') {
      idx = src.indexOf('过敏', idx + 1)
      continue
    }
    const tail = before.match(/[\u4e00-\u9fa5A-Za-z0-9]{1,8}$/)
    if (tail) {
      const raw = tail[0]
      const negated = /^(无|未|不|否认|没有|未见)/.test(raw) ||
        ['无', '未', '不'].indexOf(raw.slice(-1)) !== -1 ||
        ['否认', '没有', '未见'].indexOf(raw.slice(-2)) !== -1
      if (negated) {
        idx = src.indexOf('过敏', idx + 1)
        continue
      }
      const name = raw.replace(/^(患者|本人|既往|曾有|否认|有|对|曾|明确|抗)/, '')
      if (name && name.length <= 8) return name + '过敏'
    }
    idx = src.indexOf('过敏', idx + 1)
  }
  return ''
}

/** 诊断关键词：按标点切分并去空白（不修改原文） */
function extractDiagKeywords(diagnosis) {
  const src = clampText(diagnosis).replace(/^(初步诊断|临床诊断|诊断)\s*[：:]\s*/, '')
  if (!src) return []
  const seen = {}
  const out = []
  src.split(/[，,。；;、\/|｜\s]+/).forEach(function (part) {
    const word = part.replace(/^[：:]+|[：:]+$/g, '').trim()
    if (!word || seen[word]) return
    seen[word] = true
    out.push(word)
  })
  return out
}

function round2(n) {
  return Math.round(n * 100) / 100
}

/** 置信度：0.5 起按命中数量递增，上限 0.9 */
function computeConfidence(hits) {
  const total = (hits.symptoms || 0) + (hits.duration ? 1 : 0) + (hits.triggers || 0) +
    (hits.allergy ? 1 : 0) + (hits.diagKeywords || 0) + (hits.riskFlags || 0)
  return Math.min(0.9, round2(0.5 + total * 0.04))
}

module.exports = {
  name: 'record.structure',
  title: '病历结构化',
  batch: 'B4',
  readOnly: true,
  description: '将主诉/现病史/诊断/处理意见文本解析为症状、病程、诱因、过敏、诊断关键词与风险提示建议（不覆盖原文）',
  disclaimers: [guardrails.DISCLAIMER.DEMO, guardrails.DISCLAIMER.MEDICAL],
  outputSchema: {
    symptoms: 'array<string>',
    duration: 'string',
    triggers: 'array<string>',
    allergy: 'string',
    diagKeywords: 'array<string>',
    riskFlags: 'array<string>',
    confidence: 'number',
    note: 'string',
    disclaimers: 'array'
  },

  // 只读上下文：仅整理四段输入文本（截断控制规模），不读取业务数据
  buildContext: function (sel, input) {
    const src = input || {}
    return {
      fields: {
        complaint: clampText(src.complaint),
        history: clampText(src.history),
        diagnosis: clampText(src.diagnosis),
        advice: clampText(src.advice)
      }
    }
  },

  generate: function (ctx, input) {
    const data = (ctx && ctx.data) || {}
    const fields = data.fields || {}
    const src = input || {}
    const complaint = clampText(fields.complaint !== undefined ? fields.complaint : src.complaint)
    const history = clampText(fields.history !== undefined ? fields.history : src.history)
    const diagnosis = clampText(fields.diagnosis !== undefined ? fields.diagnosis : src.diagnosis)
    const advice = clampText(fields.advice !== undefined ? fields.advice : src.advice)
    const hasText = !!(complaint || history || diagnosis || advice)

    // 文本只作为数据：按固定字段顺序拼接后做关键词匹配（不执行任何指令）
    const symptomText = [complaint, history, diagnosis, advice].join('。')
    const duration = extractDuration([complaint, history, diagnosis, advice].join('。'))
    const allergy = extractAllergy([complaint, history, diagnosis, advice].join('。'))

    const symptoms = SYMPTOM_WORDS.filter(function (word) {
      return positiveOccurrence(symptomText, word)
    })
    const triggers = TRIGGER_RULES.filter(function (rule) {
      return rule.words.some(function (w) { return positiveOccurrence(symptomText, w) })
    }).map(function (rule) {
      return rule.label
    })
    const diagKeywords = extractDiagKeywords(diagnosis)
    const riskFlags = RISK_RULES.filter(function (rule) {
      return rule.test(symptomText)
    }).map(function (rule) {
      return rule.flag
    })

    const confidence = hasText ? computeConfidence({
      symptoms: symptoms.length,
      duration: duration,
      triggers: triggers.length,
      allergy: allergy,
      diagKeywords: diagKeywords.length,
      riskFlags: riskFlags.length
    }) : 0.5
    const note = hasText ? NOTE_NORMAL : NOTE_EMPTY
    const text = hasText
      ? '识别症状 ' + symptoms.length + ' 项、病程「' + (duration || '未识别') + '」、诱因 ' + triggers.length +
        ' 项、诊断关键词 ' + diagKeywords.length + ' 项、风险提示 ' + riskFlags.length + ' 项（结构化建议，需医生人工确认）。'
      : NOTE_EMPTY

    return {
      text: text,
      confidence: confidence,
      basis: [
        { label: '输入字段', value: '主诉/现病史/诊断/处理意见' },
        { label: '匹配方式', value: '本地确定性关键词规则（文本仅作为数据）' },
        { label: '演示基准日', value: (ctx && ctx.demoToday) || '' }
      ],
      data: {
        symptoms: symptoms,
        duration: duration,
        triggers: triggers,
        allergy: allergy,
        diagKeywords: diagKeywords,
        riskFlags: riskFlags,
        confidence: confidence,
        note: note,
        disclaimers: [guardrails.DISCLAIMER.DEMO, guardrails.DISCLAIMER.MEDICAL]
      }
    }
  },

  // G2：结构校验失败时回退为空结构化建议（结构合法、不抛错）
  fallback: function () {
    return {
      symptoms: [],
      duration: '',
      triggers: [],
      allergy: '',
      diagKeywords: [],
      riskFlags: [],
      confidence: 0.5,
      note: '结构化建议生成失败，已回退为“暂无可用建议”；请人工填写，原文只读保留、不覆盖。',
      disclaimers: [guardrails.DISCLAIMER.DEMO, guardrails.DISCLAIMER.MEDICAL]
    }
  }
}
