import { clean, isNormal } from './statistics.js'
import { C } from '../theme.js'

export function suggestModels(variables, rows) {
  const num = variables.filter(v => ['number','ordinal'].includes(v.type))
  const bin = variables.filter(v => v.type === 'binary')
  const cat = variables.filter(v => v.type === 'categorical')
  const ord = variables.filter(v => v.type === 'ordinal')
  const n   = rows.length

  const normalMap = {}
  num.forEach(v => {
    normalMap[v.id] = isNormal(rows.map(r => r[v.id])) && clean(rows.map(r=>r[v.id])).length >= 30
  })

  const catGroups = {}
  cat.forEach(v => { catGroups[v.id] = new Set(rows.map(r=>r[v.id]).filter(Boolean)).size })

  const hasSurvival = variables.some(v => /surv|time_to|days_to|os|pfs/i.test((v.id||'')+(v.name||'')))

  const results = []

  // 1 — Logistic Regression
  if (bin.length > 0 && num.length >= 1) {
    const bv = bin[0]
    const vals = rows.map(r=>Number(r[bv.id])).filter(v=>!isNaN(v))
    const pos = vals.filter(v=>v===1).length
    const balance = pos > 0 && vals.length > pos ? Math.min(pos, vals.length-pos)/Math.max(pos, vals.length-pos) : 0
    const warns = []
    if (n < 30) warns.push('N < 30 — cỡ mẫu quá nhỏ')
    if (n < num.length*10) warns.push('N < 10× số biến — nguy cơ overfitting')
    if (balance < 0.2) warns.push('Mất cân bằng nhóm (imbalanced classes)')
    results.push({
      name: 'Logistic Regression', color: C.green,
      confidence: n >= 100 ? 95 : n >= 30 ? 80 : 55,
      category: 'Phân tích đa biến',
      rationale: `Outcome nhị phân "${bv.name}" + ${num.length} biến liên tục. Tính OR, AUC, yếu tố nguy cơ.`,
      assumptions: [
        { ok: n >= 30, text: `N = ${n} (khuyến nghị ≥ 30)` },
        { ok: balance >= 0.2, text: `Cân bằng nhóm (${(balance*100).toFixed(0)}%)` },
        { ok: num.length <= n/10, text: `Số biến ≤ N/10` },
      ],
      outputs: ['OR (Odds Ratio)', 'AUC', 'Sensitivity / Specificity', 'McFadden R²'],
      warns,
    })
  }

  // 2 — Linear Regression
  if (num.length >= 2 && bin.length === 0) {
    const allNorm = num.every(v => normalMap[v.id])
    const warns = []
    if (!allNorm) warns.push('Phân phối lệch — kiểm tra residuals')
    if (n < 20) warns.push('N < 20 — kết quả không ổn định')
    results.push({
      name: 'Linear Regression (OLS)', color: C.blue,
      confidence: n >= 20 ? 85 : 50,
      category: 'Phân tích đa biến',
      rationale: `${num.length} biến số → quantify mối quan hệ tuyến tính, tính β và R².`,
      assumptions: [
        { ok: n >= 20, text: `N = ${n} (khuyến nghị ≥ 20)` },
        { ok: allNorm, text: 'Phân phối chuẩn' },
        { ok: num.length < n/5, text: 'Không có multicollinearity nặng' },
      ],
      outputs: ['β coefficient', 'R² / Adjusted R²', 'RMSE', 'p-value'],
      warns,
    })
  }

  // 3 — T-test / Mann-Whitney
  if (cat.length > 0 && num.length >= 1) {
    const cv = cat.find(v => catGroups[v.id] === 2) || cat[0]
    const nv = num[0]
    const norm = isNormal(rows.map(r=>r[nv.id]))
    const isTwo = catGroups[cv.id] === 2
    const method = (norm && n >= 30 && isTwo) ? "Welch's t-test" : isTwo ? 'Mann-Whitney U' : 'Kruskal-Wallis'
    results.push({
      name: method, color: C.pink,
      confidence: n >= 20 ? 88 : 65,
      category: isTwo ? 'So sánh 2 nhóm' : 'So sánh nhiều nhóm',
      rationale: `So sánh "${nv.name}" giữa ${catGroups[cv.id]} nhóm của "${cv.name}". ${norm && n>=30 ? 'Phân phối chuẩn + N đủ.' : 'Non-parametric.'}`,
      assumptions: [
        { ok: n >= 20, text: `N = ${n}` },
        { ok: norm, text: 'Phân phối chuẩn' },
        { ok: catGroups[cv.id] >= 2, text: `${catGroups[cv.id]} nhóm độc lập` },
      ],
      outputs: norm && n>=30 && isTwo ? ['t-statistic','df','p-value','95% CI'] : ['U / H statistic','z','p-value'],
      warns: n < 20 ? ['N < 20 — thiếu statistical power'] : [],
    })
  }

  // 4 — Correlation
  if (num.length >= 2) {
    const allNorm = num.every(v => normalMap[v.id])
    results.push({
      name: allNorm ? 'Pearson Correlation' : 'Spearman Correlation',
      color: C.purple,
      confidence: n >= 10 ? 90 : 60,
      category: 'Tương quan',
      rationale: `${num.length} biến số → ma trận tương quan. ${allNorm ? 'Chuẩn → Pearson' : 'Không chuẩn → Spearman (rank-based)'}.`,
      assumptions: [
        { ok: n >= 10, text: `N = ${n} (khuyến nghị ≥ 10)` },
        { ok: num.length >= 2, text: 'Ít nhất 2 biến liên tục' },
      ],
      outputs: ['r (correlation coefficient)', 'p-value', 'Ma trận tương quan'],
      warns: n < 20 ? ['N < 20 — tương quan kém ổn định'] : [],
    })
  }

  // 5 — Survival hint
  if (hasSurvival) {
    results.push({
      name: 'Kaplan-Meier / Cox Regression', color: C.gold,
      confidence: 75,
      category: 'Phân tích sống còn',
      rationale: 'Phát hiện biến thời gian sống còn. Phù hợp nếu có censored data.',
      assumptions: [
        { ok: true, text: 'Biến time-to-event' },
        { ok: bin.length > 0, text: 'Biến event (0/1)' },
      ],
      outputs: ['Survival curve', 'Median survival', 'HR (Hazard Ratio)', 'Log-rank p'],
      warns: ['Cần R (survival package) hoặc SPSS cho phân tích đầy đủ'],
    })
  }

  // Fallback
  if (results.length === 0) {
    results.push({
      name: 'Descriptive Statistics', color: C.cyan,
      confidence: 100,
      category: 'Mô tả',
      rationale: 'Thống kê mô tả cơ bản: tần số, trung bình, độ lệch chuẩn.',
      assumptions: [{ ok: true, text: 'Luôn áp dụng được' }],
      outputs: ['Mean ± SD', 'Median [IQR]', 'Frequency table', 'Missing data'],
      warns: variables.length === 0 ? ['Thêm biến để bật phân tích nâng cao'] : [],
    })
  }

  return results.sort((a,b) => b.confidence - a.confidence)
}
