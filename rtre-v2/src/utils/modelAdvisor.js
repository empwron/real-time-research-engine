import { clean, isNormal, mean, std, variance, skewness, kurtosis, pearsonR, freqTable } from './statistics.js'
import { C } from '../theme.js'

export function suggestModels(variables, rows) {
  const num = variables.filter(v => ['number','integer','percent','ordinal'].includes(v.type))
  const bin = variables.filter(v => v.type === 'binary')
  const cat = variables.filter(v => v.type === 'categorical')
  const ord = variables.filter(v => v.type === 'ordinal')
  const dateVars = variables.filter(v => v.type === 'date')
  const n = rows.length

  const normalMap = {}
  num.forEach(v => {
    const vals = rows.map(r => r[v.id])
    normalMap[v.id] = isNormal(vals) && clean(vals).length >= 20
  })

  const catGroups = {}
  cat.forEach(v => { catGroups[v.id] = new Set(rows.map(r=>r[v.id]).filter(Boolean)).size })

  const hasSurvival = variables.some(v => /surv|time_to|days_to|os_|pfs_|dfs_|efs_|event/i.test((v.id||'')+(v.name||'')))
  const hasRepeated = variables.some(v => /visit|time_?point|wave|session|lần/i.test((v.name||'')))
  const hasPaired = variables.some(v => /pre|post|before|after|trước|sau/i.test((v.name||'')))

  // Detect multicollinearity among numeric vars
  const collinearPairs = []
  if (num.length >= 2) {
    for (let i = 0; i < num.length; i++) {
      for (let j = i+1; j < num.length; j++) {
        const r = pearsonR(rows.map(r2=>r2[num[i].id]), rows.map(r2=>r2[num[j].id]))
        if (Math.abs(r.r) > 0.8) collinearPairs.push([num[i].name, num[j].name, r.r])
      }
    }
  }

  // Check for outliers
  const outlierVars = []
  num.forEach(v => {
    const vals = clean(rows.map(r=>r[v.id]))
    if (vals.length < 10) return
    const sk = Math.abs(skewness(vals))
    const ku = Math.abs(kurtosis(vals))
    if (sk > 2 || ku > 7) outlierVars.push(v.name)
  })

  // Missing data analysis
  const missingPct = {}
  variables.forEach(v => {
    const missing = rows.filter(r => r[v.id] === undefined || r[v.id] === '' || r[v.id] === null).length
    missingPct[v.id] = +(missing/Math.max(n,1)*100).toFixed(1)
  })
  const highMissing = variables.filter(v => missingPct[v.id] > 20).map(v=>v.name)

  const results = []

  // ═══════════════════════════════════════════════════════════════════════════
  // 1 — Logistic Regression (Binary Outcome)
  // ═══════════════════════════════════════════════════════════════════════════
  if (bin.length > 0 && num.length >= 1) {
    const bv = bin[0]
    const vals = rows.map(r=>Number(r[bv.id])).filter(v=>!isNaN(v))
    const pos = vals.filter(v=>v===1).length
    const neg = vals.length - pos
    const balance = pos > 0 && vals.length > pos ? Math.min(pos,neg)/Math.max(pos,neg) : 0
    const epp = Math.min(pos,neg) / num.length // events per predictor

    const warns = []
    if (n < 30) warns.push('⚠ N < 30 — cỡ mẫu quá nhỏ')
    if (epp < 10) warns.push(`⚠ EPP = ${epp.toFixed(1)} (cần ≥ 10 events/predictor)`)
    if (balance < 0.2) warns.push(`⚠ Mất cân bằng nhóm: ${pos}/${neg} (${(balance*100).toFixed(0)}%)`)
    if (collinearPairs.length) warns.push(`⚠ Đa cộng tuyến: ${collinearPairs.map(p=>`${p[0]}↔${p[1]} (r=${p[2].toFixed(2)})`).join(', ')}`)
    if (highMissing.length) warns.push(`⚠ Missing >20%: ${highMissing.join(', ')}`)

    const conf = epp >= 10 && n >= 100 ? 95 : epp >= 5 && n >= 30 ? 78 : 45
    results.push({
      name: 'Logistic Regression', color: C.green,
      confidence: conf,
      category: 'Phân tích đa biến — Outcome nhị phân',
      rationale: `Outcome nhị phân "${bv.name}" (${pos} có / ${neg} không) + ${num.length} biến dự đoán. Tính OR, AUC, mô hình yếu tố nguy cơ.`,
      assumptions: [
        { ok: n >= 30, text: `N = ${n} (khuyến nghị ≥ 30, tối ưu ≥ 100)` },
        { ok: balance >= 0.2, text: `Cân bằng nhóm: ${pos} vs ${neg} (${(balance*100).toFixed(0)}%)` },
        { ok: epp >= 10, text: `Events per predictor: ${epp.toFixed(1)} (cần ≥ 10)` },
        { ok: collinearPairs.length === 0, text: collinearPairs.length ? `Đa cộng tuyến: ${collinearPairs.length} cặp |r| > 0.8` : 'Không phát hiện đa cộng tuyến nặng' },
      ],
      outputs: ['OR (Odds Ratio) + 95% CI', 'AUC-ROC', 'Sensitivity / Specificity', 'PPV / NPV', 'McFadden R²', 'Hosmer-Lemeshow GoF'],
      warns,
      nextSteps: [
        'Kiểm tra VIF (Variance Inflation Factor) nếu nghi đa cộng tuyến',
        balance < 0.2 ? 'Cân nhắc SMOTE / undersampling do imbalanced' : null,
        'Cross-validation (k-fold) để đánh giá model stability',
        num.length > 3 ? 'Stepwise selection hoặc LASSO để chọn biến' : null,
      ].filter(Boolean),
    })
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2 — Multiple Linear Regression
  // ═══════════════════════════════════════════════════════════════════════════
  if (num.length >= 2) {
    const depCandidates = num.filter(v => !variables.some(v2=>v2.type==='binary'))
    const allNorm = num.every(v => normalMap[v.id])
    const warns = []
    if (!allNorm) warns.push('⚠ Phân phối lệch — kiểm tra residuals, cân nhắc log-transform')
    if (n < 20) warns.push('⚠ N < 20 — kết quả không ổn định')
    if (n < num.length*5) warns.push(`⚠ N/p ratio = ${(n/num.length).toFixed(1)} (khuyến nghị ≥ 10)`)
    if (collinearPairs.length) warns.push(`⚠ Đa cộng tuyến: ${collinearPairs.map(p=>`${p[0]}↔${p[1]}`).join(', ')}`)
    if (outlierVars.length) warns.push(`⚠ Outlier/lệch nặng: ${outlierVars.join(', ')}`)

    results.push({
      name: 'Multiple Linear Regression', color: C.blue,
      confidence: n >= 30 && allNorm ? 90 : n >= 20 ? 72 : 45,
      category: 'Phân tích đa biến — Outcome liên tục',
      rationale: `${num.length} biến số → quantify mối quan hệ tuyến tính, dự đoán outcome liên tục. Tính β, R², kiểm tra từng predictor.`,
      assumptions: [
        { ok: n >= 20, text: `N = ${n} (khuyến nghị ≥ 10 × số biến = ${num.length*10})` },
        { ok: allNorm, text: allNorm ? 'Residuals phân phối chuẩn (ước lượng từ dữ liệu)' : 'Phân phối lệch — cần kiểm tra residuals' },
        { ok: collinearPairs.length === 0, text: 'Không đa cộng tuyến nặng (|r| < 0.8)' },
        { ok: outlierVars.length === 0, text: outlierVars.length ? `Outliers: ${outlierVars.join(', ')}` : 'Không phát hiện outlier nặng' },
      ],
      outputs: ['β coefficients + 95% CI', 'R² / Adjusted R²', 'RMSE', 'F-statistic', 'p-value per predictor', 'Residual plots'],
      warns,
      nextSteps: [
        'Plot residuals vs fitted values kiểm tra homoscedasticity',
        'Q-Q plot kiểm tra normality of residuals',
        collinearPairs.length ? 'VIF > 10 → loại biến hoặc dùng Ridge/LASSO' : null,
        outlierVars.length ? 'Cook\'s distance kiểm tra influential points' : null,
      ].filter(Boolean),
    })
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3 — T-test / Mann-Whitney (2 groups)
  // ═══════════════════════════════════════════════════════════════════════════
  if (cat.length > 0 && num.length >= 1) {
    const cv2 = cat.find(v => catGroups[v.id] === 2)
    const cvMulti = cat.find(v => catGroups[v.id] > 2)
    
    // Two-group comparison
    if (cv2) {
      const nv = num[0]
      const groups = [...new Set(rows.map(r=>r[cv2.id]).filter(Boolean))]
      const g1 = clean(rows.filter(r=>r[cv2.id]===groups[0]).map(r=>r[nv.id]))
      const g2 = clean(rows.filter(r=>r[cv2.id]===groups[1]).map(r=>r[nv.id]))
      const norm1 = g1.length >= 20 && isNormal(g1)
      const norm2 = g2.length >= 20 && isNormal(g2)
      const bothNorm = norm1 && norm2
      const method = bothNorm ? "Welch's t-test" : 'Mann-Whitney U'

      results.push({
        name: method, color: C.pink,
        confidence: n >= 30 ? 90 : n >= 15 ? 75 : 55,
        category: 'So sánh 2 nhóm',
        rationale: `So sánh "${nv.name}" giữa 2 nhóm "${cv2.name}" (${groups.join(' vs ')}). ${bothNorm ? 'Phân phối chuẩn → parametric.' : 'Không chuẩn hoặc N nhỏ → non-parametric.'}`,
        assumptions: [
          { ok: g1.length >= 10 && g2.length >= 10, text: `N nhóm: ${g1.length} vs ${g2.length}` },
          { ok: bothNorm, text: bothNorm ? 'Phân phối chuẩn cả 2 nhóm' : `Phân phối: nhóm 1 ${norm1?'chuẩn':'lệch'}, nhóm 2 ${norm2?'chuẩn':'lệch'}` },
          { ok: true, text: '2 nhóm độc lập' },
        ],
        outputs: bothNorm
          ? ['t-statistic', 'df', 'p-value', 'Mean difference + 95% CI', 'Cohen\'s d (effect size)']
          : ['U statistic', 'z', 'p-value', 'Rank-biserial correlation'],
        warns: [
          g1.length < 10 || g2.length < 10 ? '⚠ Nhóm nhỏ < 10 — thiếu power' : null,
          Math.abs(g1.length - g2.length) > Math.max(g1.length,g2.length)*0.5 ? '⚠ Unequal group sizes' : null,
        ].filter(Boolean),
        nextSteps: [
          'Levene\'s test kiểm tra equal variances',
          !bothNorm ? 'Bootstrap CI nếu cần interval estimate' : null,
          'Effect size (Cohen d hoặc r) để đánh giá ý nghĩa lâm sàng',
        ].filter(Boolean),
      })
    }

    // Multi-group comparison (ANOVA / Kruskal-Wallis)
    if (cvMulti && catGroups[cvMulti.id] >= 3) {
      const nv = num[0]
      const groupNames = [...new Set(rows.map(r=>r[cvMulti.id]).filter(Boolean))]
      const groupData = groupNames.map(g => clean(rows.filter(r=>r[cvMulti.id]===g).map(r=>r[nv.id])))
      const allGroupNorm = groupData.every(g => g.length >= 15 && isNormal(g))
      const method = allGroupNorm ? 'One-way ANOVA' : 'Kruskal-Wallis H'

      results.push({
        name: method, color: C.orange,
        confidence: n >= 30 ? 85 : 65,
        category: 'So sánh nhiều nhóm',
        rationale: `So sánh "${nv.name}" giữa ${groupNames.length} nhóm của "${cvMulti.name}". ${allGroupNorm ? 'Parametric.' : 'Non-parametric.'}`,
        assumptions: [
          { ok: n >= 30, text: `N = ${n}` },
          { ok: allGroupNorm, text: allGroupNorm ? 'Phân phối chuẩn tất cả nhóm' : 'Không chuẩn → Kruskal-Wallis' },
          { ok: groupData.every(g=>g.length>=5), text: `Nhóm nhỏ nhất: ${Math.min(...groupData.map(g=>g.length))} mẫu` },
        ],
        outputs: allGroupNorm
          ? ['F-statistic', 'p-value', 'η² (eta-squared)', 'Post-hoc Tukey HSD']
          : ['H statistic', 'p-value', 'Post-hoc Dunn\'s test'],
        warns: groupData.some(g=>g.length<5) ? ['⚠ Nhóm nhỏ < 5 mẫu'] : [],
        nextSteps: [
          `Post-hoc pairwise: ${allGroupNorm ? 'Tukey HSD hoặc Bonferroni' : 'Dunn\'s test'}`,
          'Levene\'s test kiểm tra homogeneity of variances',
        ],
      })
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 4 — Chi-Square / Fisher's Exact
  // ═══════════════════════════════════════════════════════════════════════════
  if (cat.length >= 2 || (cat.length >= 1 && bin.length >= 1)) {
    const v1 = cat[0] || bin[0]
    const v2 = cat.length >= 2 ? cat[1] : bin[0]
    if (v1.id !== v2.id) {
      const nGroups1 = new Set(rows.map(r=>r[v1.id]).filter(Boolean)).size
      const nGroups2 = new Set(rows.map(r=>r[v2.id]).filter(Boolean)).size
      const minExpected = n / (nGroups1 * nGroups2)
      const method = minExpected < 5 ? "Fisher's Exact Test" : 'Chi-Square (χ²)'

      results.push({
        name: method, color: C.gold,
        confidence: n >= 20 ? 85 : 60,
        category: 'Kiểm định liên quan — 2 biến phân loại',
        rationale: `Kiểm tra mối liên quan giữa "${v1.name}" (${nGroups1} nhóm) và "${v2.name}" (${nGroups2} nhóm).`,
        assumptions: [
          { ok: n >= 20, text: `N = ${n}` },
          { ok: minExpected >= 5, text: minExpected >= 5 ? 'Expected count ≥ 5 mỗi ô' : `Expected count ≈ ${minExpected.toFixed(1)} → Fisher's exact` },
          { ok: nGroups1 >= 2 && nGroups2 >= 2, text: `Bảng ${nGroups1}×${nGroups2}` },
        ],
        outputs: ['χ² statistic', 'df', 'p-value', "Cramér's V (effect size)", 'Contingency table'],
        warns: minExpected < 5 ? ['⚠ Expected count < 5 → dùng Fisher\'s exact'] : [],
        nextSteps: [
          'Standardized residuals để xác định ô nào đóng góp nhiều nhất',
          nGroups1 === 2 && nGroups2 === 2 ? 'Tính OR từ bảng 2×2' : null,
        ].filter(Boolean),
      })
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 5 — Correlation Matrix
  // ═══════════════════════════════════════════════════════════════════════════
  if (num.length >= 2) {
    const allNorm = num.every(v => normalMap[v.id])
    results.push({
      name: allNorm ? 'Pearson Correlation' : 'Spearman Correlation',
      color: C.purple,
      confidence: n >= 20 ? 92 : n >= 10 ? 75 : 55,
      category: 'Tương quan',
      rationale: `${num.length} biến số → ma trận tương quan. ${allNorm ? 'Chuẩn → Pearson (linear).' : 'Không chuẩn → Spearman (monotonic, rank-based).'}`,
      assumptions: [
        { ok: n >= 10, text: `N = ${n} (khuyến nghị ≥ 20)` },
        { ok: num.length >= 2, text: `${num.length} biến liên tục` },
        { ok: allNorm, text: allNorm ? 'Phân phối chuẩn → Pearson' : 'Phân phối lệch → Spearman' },
      ],
      outputs: ['r (correlation coefficient)', 'p-value', 'Ma trận tương quan', '95% CI for r', 'Heatmap'],
      warns: [
        n < 20 ? '⚠ N < 20 — tương quan kém ổn định' : null,
        collinearPairs.length ? `Collinear pairs: ${collinearPairs.map(p=>`${p[0]}↔${p[1]}`).join(', ')}` : null,
      ].filter(Boolean),
      nextSteps: [
        'Scatter plots kiểm tra linearity',
        'Partial correlation kiểm soát confounders',
        num.length >= 4 ? 'Factor analysis / PCA nếu nhiều biến correlate' : null,
      ].filter(Boolean),
    })
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 6 — Paired t-test / Wilcoxon Signed-Rank
  // ═══════════════════════════════════════════════════════════════════════════
  if (hasPaired && num.length >= 2) {
    const preVar = num.find(v => /pre|before|trước|baseline/i.test(v.name))
    const postVar = num.find(v => /post|after|sau|follow/i.test(v.name))
    if (preVar && postVar) {
      const diffs = rows.map(r => {
        const a = Number(r[preVar.id]), b = Number(r[postVar.id])
        return !isNaN(a)&&!isNaN(b) ? b-a : null
      }).filter(v=>v!==null)
      const diffNorm = diffs.length >= 20 && isNormal(diffs)
      const method = diffNorm ? 'Paired t-test' : 'Wilcoxon Signed-Rank'

      results.push({
        name: method, color: '#20B2AA',
        confidence: n >= 15 ? 88 : 65,
        category: 'So sánh cặp (trước-sau)',
        rationale: `So sánh "${preVar.name}" vs "${postVar.name}" trên cùng đối tượng. ${diffNorm ? 'Differences chuẩn → parametric.' : 'Non-parametric.'}`,
        assumptions: [
          { ok: diffs.length >= 10, text: `N cặp = ${diffs.length}` },
          { ok: diffNorm, text: diffNorm ? 'Differences phân phối chuẩn' : 'Differences không chuẩn → Wilcoxon' },
        ],
        outputs: diffNorm ? ['t-statistic', 'df', 'p-value', 'Mean difference ± 95% CI'] : ['V statistic', 'p-value', 'Median difference'],
        warns: diffs.length < 10 ? ['⚠ Cặp < 10 — thiếu power'] : [],
        nextSteps: ['Bland-Altman plot kiểm tra agreement', 'Effect size (Cohen d for paired)'],
      })
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 7 — Survival Analysis hint
  // ═══════════════════════════════════════════════════════════════════════════
  if (hasSurvival) {
    results.push({
      name: 'Kaplan-Meier / Cox Regression', color: C.gold,
      confidence: 75,
      category: 'Phân tích sống còn',
      rationale: 'Phát hiện biến thời gian sống còn (time-to-event). Phù hợp nếu có censored data.',
      assumptions: [
        { ok: true, text: 'Biến time-to-event detected' },
        { ok: bin.length > 0, text: bin.length>0 ? 'Biến event (0/1) có sẵn' : 'Thiếu biến event' },
        { ok: n >= 30, text: `N = ${n}` },
      ],
      outputs: ['Survival curve', 'Median survival time', 'HR (Hazard Ratio)', 'Log-rank p', 'Confidence bands'],
      warns: ['Cần R (survival package) / Python (lifelines) / SPSS cho phân tích đầy đủ'],
      nextSteps: [
        'Kiểm tra proportional hazards assumption (Schoenfeld residuals)',
        'Stratified KM nếu có nhiều nhóm',
        cat.length > 0 ? 'Multivariable Cox regression' : null,
      ].filter(Boolean),
    })
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 8 — Ordinal Logistic Regression
  // ═══════════════════════════════════════════════════════════════════════════
  if (ord.length > 0 && (num.length >= 1 || cat.length >= 1)) {
    results.push({
      name: 'Ordinal Logistic Regression', color: '#7B68EE',
      confidence: n >= 50 ? 80 : 55,
      category: 'Phân tích đa biến — Outcome thứ hạng',
      rationale: `Outcome thứ hạng "${ord[0].name}" → proportional odds model.`,
      assumptions: [
        { ok: n >= 50, text: `N = ${n} (khuyến nghị ≥ 50)` },
        { ok: true, text: 'Proportional odds assumption (cần kiểm tra)' },
      ],
      outputs: ['OR per level', 'p-value', 'Brant test (proportional odds)'],
      warns: n < 50 ? ['⚠ N < 50 — cần cỡ mẫu lớn hơn'] : [],
      nextSteps: ['Brant test kiểm tra proportional odds', 'Multinomial logistic nếu proportional odds bị vi phạm'],
    })
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 9 — Reliability / Cronbach's Alpha hint
  // ═══════════════════════════════════════════════════════════════════════════
  if (num.length >= 3 && ord.length >= 2) {
    results.push({
      name: "Cronbach's Alpha / ICC", color: '#FF9500',
      confidence: n >= 30 ? 80 : 55,
      category: 'Đánh giá độ tin cậy',
      rationale: `${num.length + ord.length} biến thứ hạng/liên tục → đánh giá internal consistency (Cronbach α) hoặc inter-rater reliability (ICC).`,
      assumptions: [
        { ok: n >= 30, text: `N = ${n}` },
        { ok: ord.length >= 2, text: `${ord.length} biến ordinal` },
      ],
      outputs: ["Cronbach's α", 'ICC (1,1) / ICC (2,1)', 'Item-total correlation'],
      warns: [],
      nextSteps: ['α > 0.7 = acceptable, > 0.8 = good', 'Loại item có item-total correlation < 0.3'],
    })
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GLOBAL WARNINGS
  // ═══════════════════════════════════════════════════════════════════════════
  const globalWarns = []
  if (highMissing.length) globalWarns.push(`Missing >20%: ${highMissing.join(', ')} — cân nhắc multiple imputation`)
  if (n < 10) globalWarns.push('N < 10 — hầu hết phương pháp thống kê đều không đáng tin cậy')
  if (outlierVars.length) globalWarns.push(`Outlier nặng: ${outlierVars.join(', ')} — kiểm tra Winsorization / robust methods`)

  // ═══════════════════════════════════════════════════════════════════════════
  // Fallback — Descriptive
  // ═══════════════════════════════════════════════════════════════════════════
  if (results.length === 0) {
    results.push({
      name: 'Descriptive Statistics', color: C.cyan,
      confidence: 100,
      category: 'Mô tả',
      rationale: 'Thống kê mô tả cơ bản: tần số, trung bình, độ lệch chuẩn. Bước đầu tiên trong mọi phân tích.',
      assumptions: [{ ok: true, text: 'Luôn áp dụng được' }],
      outputs: ['Mean ± SD', 'Median [IQR]', 'Frequency table', 'Missing data summary', 'Distribution plots'],
      warns: variables.length === 0 ? ['Thêm biến để bật phân tích nâng cao'] : [],
      nextSteps: ['Thêm biến outcome (nhị phân/liên tục) để gợi ý mô hình phức tạp hơn'],
    })
  }

  // Always add Descriptive as a recommended first step if there are other models
  if (results.length > 0 && !results.some(r=>r.name==='Descriptive Statistics')) {
    results.push({
      name: 'Descriptive Statistics', color: C.cyan,
      confidence: 100,
      category: 'Bước 1 — Mô tả',
      rationale: 'Luôn bắt đầu với thống kê mô tả trước khi chạy inferential tests. Kiểm tra distribution, missing, outlier.',
      assumptions: [{ ok: true, text: 'Luôn áp dụng được' }],
      outputs: ['Mean ± SD', 'Median [IQR]', 'Frequency table', 'Normality assessment', 'Missing data pattern'],
      warns: [],
      nextSteps: ['Tab Stats có sẵn descriptive cho từng biến'],
    })
  }

  return { models: results.sort((a,b) => b.confidence - a.confidence), globalWarns, collinearPairs, outlierVars, highMissing, missingPct }
}
