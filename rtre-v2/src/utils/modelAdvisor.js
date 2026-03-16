import { clean, isNormal, pearsonR, mean, std, skewness, kurtosis, leveneTest } from './statistics.js'
import { C } from '../theme.js'

const isNA=v=>v==null||v===''||v==='__NA__'||v==='NA'||v==='N/A'

export function suggestModels(variables,rows){
  const num=variables.filter(v=>['number','integer','percent','ordinal'].includes(v.type))
  const bin=variables.filter(v=>v.type==='binary')
  const cat=variables.filter(v=>v.type==='categorical')
  const n=rows.length
  if(n<2)return{models:[],globalWarns:['N < 2 — không đủ dữ liệu'],collinearPairs:[],outlierVars:[],highMissing:[]}

  // Compute group counts for categorical vars (exclude NA)
  const catGroups={}
  cat.forEach(v=>{catGroups[v.id]=[...new Set(rows.map(r=>r[v.id]).filter(x=>!isNA(x)))].length})
  // Binary vars always have exactly 2 groups
  bin.forEach(v=>{catGroups[v.id]=2})

  // All grouping vars (cat + binary)
  const allGroup=[...cat,...bin]
  const has2Group=allGroup.some(v=>catGroups[v.id]===2)
  const has3PlusGroup=cat.some(v=>catGroups[v.id]>=3)

  // Normality map
  const normalMap={};num.forEach(v=>{const vals=clean(rows.map(r=>r[v.id]));normalMap[v.id]=vals.length>=8&&isNormal(vals)})

  // Collinearity
  const collinearPairs=[]
  if(num.length>=2){for(let i=0;i<num.length;i++)for(let j=i+1;j<num.length;j++){const r=pearsonR(rows.map(r2=>r2[num[i].id]),rows.map(r2=>r2[num[j].id]));if(Math.abs(r.r)>0.8)collinearPairs.push([num[i].name,num[j].name,r.r])}}

  // Outliers
  const outlierVars=[]
  num.forEach(v=>{const vals=clean(rows.map(r=>r[v.id]));if(vals.length<10)return;if(Math.abs(skewness(vals))>2||Math.abs(kurtosis(vals))>7)outlierVars.push(v.name)})

  // Missing
  const highMissing=variables.filter(v=>{const miss=rows.filter(r=>isNA(r[v.id])).length;return miss/Math.max(n,1)>0.2}).map(v=>v.name)

  const results=[]

  // ═══ Logistic Regression ═══
  // Cần: ≥1 biến binary (Y) + ≥1 biến số (X) + N ≥ 10
  if(bin.length>0&&num.length>=1&&n>=10){
    const bv=bin[0],vals=rows.map(r=>Number(r[bv.id])).filter(v=>!isNaN(v)&&(v===0||v===1))
    const pos=vals.filter(v=>v===1).length,neg=vals.length-pos
    if(pos>0&&neg>0){ // need both classes
      const bal=Math.min(pos,neg)/Math.max(pos,neg),epp=Math.min(pos,neg)/Math.max(num.length,1)
      results.push({name:'Logistic Regression',color:C.green,confidence:epp>=10&&n>=100?95:epp>=5&&n>=30?78:45,
        category:'Đa biến — Outcome nhị phân',
        rationale:`Y="${bv.name}" (${pos}/${neg}) + ${num.length} predictor${num.length>1?'s':''}`,
        assumptions:[{ok:n>=30,text:`N=${n}`},{ok:bal>=.2,text:`Balance: ${(bal*100).toFixed(0)}%`},{ok:epp>=10,text:`EPP=${epp.toFixed(1)}`}],
        outputs:['OR per variable','Accuracy','Sens/Spec','PPV/NPV','McFadden R²','Prediction'],
        nextSteps:['Bấm ▶ → chọn Y (binary) + X (numeric)','Có prediction calculator'],
        warns:[...(n<30?['⚠ N < 30']:[]),...(epp<10?[`⚠ EPP=${epp.toFixed(1)} (cần ≥10)`]:[]),...(collinearPairs.length?['⚠ Đa cộng tuyến']:[])]})}
  }

  // ═══ Linear Regression ═══
  // Cần: ≥2 biến số + N ≥ 3
  if(num.length>=2&&n>=3){
    const allN=num.every(v=>normalMap[v.id])
    results.push({name:'Linear Regression',color:C.blue,confidence:n>=30&&allN?90:n>=20?72:45,
      category:'Đa biến — Outcome liên tục',rationale:`${num.length} biến số → β, R²`,
      assumptions:[{ok:n>=20,text:`N=${n}`},{ok:allN,text:allN?'Residuals chuẩn':'Cần kiểm tra'}],
      outputs:['β','R²','Adjusted R²','RMSE','p-value'],
      nextSteps:['Bấm ▶ → chọn Y (numeric) + X (numeric)'],
      warns:n<20?['⚠ N < 20']:[]})}

  // ═══ T-test / Mann-Whitney ═══
  // Cần: ≥1 biến số + ≥1 biến nhóm có đúng 2 groups + mỗi group ≥ 2 obs
  if(num.length>=1&&has2Group){
    const gv=allGroup.find(v=>catGroups[v.id]===2)
    if(gv){
      const nv=num[0],groups=[...new Set(rows.map(r=>r[gv.id]).filter(x=>!isNA(x)))]
      if(groups.length===2){
        const g1=clean(rows.filter(r=>r[gv.id]===groups[0]).map(r=>r[nv.id]))
        const g2=clean(rows.filter(r=>r[gv.id]===groups[1]).map(r=>r[nv.id]))
        if(g1.length>=2&&g2.length>=2){
          const bothN=g1.length>=20&&g2.length>=20&&isNormal(g1)&&isNormal(g2)
          const method=bothN?"Welch's t-test":'Mann-Whitney U'
          const lev=leveneTest([g1,g2])
          results.push({name:method,color:C.pink,confidence:n>=30?90:n>=15?75:55,
            category:'So sánh 2 nhóm',
            rationale:`"${nv.name}" giữa "${gv.name}" (${groups.join(' vs ')}, N: ${g1.length} vs ${g2.length})`,
            assumptions:[{ok:g1.length>=10&&g2.length>=10,text:`N: ${g1.length} vs ${g2.length}`},{ok:bothN,text:bothN?'Phân phối chuẩn → Parametric':'Non-parametric'},{ok:lev?.equalVariance!==false,text:lev?`Levene p=${lev.p}`:'—'}],
            outputs:bothN?['t','df','p','Cohen d','95% CI']:['U','z','p','rank-biserial r'],
            nextSteps:['Bấm ▶ → chọn Y (numeric) + Nhóm (2 groups)'],warns:[]})}
      }
    }
  }

  // ═══ ANOVA / Kruskal-Wallis ═══
  // Cần: ≥1 biến số + ≥1 biến phân loại có ≥3 nhóm
  if(num.length>=1&&has3PlusGroup){
    const cvM=cat.find(v=>catGroups[v.id]>=3)
    if(cvM){
      const gCount=catGroups[cvM.id]
      // Check each group has ≥2 obs
      const groups=[...new Set(rows.map(r=>r[cvM.id]).filter(x=>!isNA(x)))]
      const allGroupsOk=groups.every(g=>clean(rows.filter(r=>r[cvM.id]===g).map(r=>r[num[0].id])).length>=2)
      if(allGroupsOk){
        results.push({name:'One-way ANOVA / Kruskal-Wallis',color:C.orange,confidence:n>=30?85:65,
          category:'So sánh nhiều nhóm',rationale:`"${num[0].name}" giữa ${gCount} nhóm "${cvM.name}"`,
          assumptions:[{ok:n>=30,text:`N=${n}`},{ok:gCount>=3,text:`${gCount} nhóm`}],
          outputs:['F / H','p','η²','Post-hoc'],
          nextSteps:['Bấm ▶ → chọn Y (numeric) + Nhóm (≥3 groups)'],warns:[]})
      }
    }
  }

  // ═══ Chi-Square / Fisher ═══
  // Cần: ≥2 biến phân loại/nhị phân + N ≥ 5
  if(allGroup.length>=2&&n>=5){
    results.push({name:'Chi-Square / Fisher',color:C.gold,confidence:n>=20?85:60,
      category:'Liên quan 2 biến phân loại',rationale:`${allGroup.length} biến phân loại/nhị phân có thể kiểm tra`,
      assumptions:[{ok:n>=20,text:`N=${n}`},{ok:allGroup.length>=2,text:`${allGroup.length} biến phân loại/nhị phân`}],
      outputs:['χ²','df','p',"Cramér's V",'Bảng chéo'],
      nextSteps:['Bấm ▶ → chọn 2 biến phân loại/nhị phân'],warns:[]})
  }

  // ═══ Correlation ═══
  // Cần: ≥2 biến số + N ≥ 3
  if(num.length>=2&&n>=3){
    const allN=num.every(v=>normalMap[v.id])
    results.push({name:allN?'Pearson Correlation':'Spearman Correlation',color:C.purple,confidence:n>=20?92:n>=10?75:55,
      category:'Tương quan',rationale:`${num.length} biến số → ma trận r`,
      assumptions:[{ok:n>=10,text:`N=${n}`},{ok:allN,text:allN?'Pearson (chuẩn)':'Spearman (non-parametric)'}],
      outputs:['r','p','R²','Heatmap'],
      nextSteps:['Bấm ▶ → chọn biến số, click ô để xem diễn giải'],
      warns:collinearPairs.length?[`Collinear: ${collinearPairs.map(p=>`${p[0]}↔${p[1]} r=${p[2].toFixed(2)}`).join(', ')}`]:[]})}

  // ═══ Descriptive ═══ (always available if there's data)
  if(n>=1){
    results.push({name:'Descriptive Statistics',color:C.cyan,confidence:100,
      category:'Bước 1 — Mô tả dữ liệu',rationale:'Luôn bắt đầu với mô tả. Shapiro-Wilk, tần số, phân phối.',
      assumptions:[{ok:true,text:'Luôn áp dụng'}],
      outputs:['Mean±SD','Median[IQR]','Shapiro-Wilk','Freq table','Missing analysis'],
      nextSteps:['Bấm ▶ để xem tổng quan'],warns:[]})}

  const globalWarns=[]
  if(highMissing.length)globalWarns.push(`Missing >20%: ${highMissing.join(', ')}`)
  if(n<10)globalWarns.push(`N=${n} — cỡ mẫu rất nhỏ`)
  if(outlierVars.length)globalWarns.push(`Outlier khả nghi: ${outlierVars.join(', ')}`)
  return{models:results.sort((a,b)=>b.confidence-a.confidence),globalWarns,collinearPairs,outlierVars,highMissing}
}
