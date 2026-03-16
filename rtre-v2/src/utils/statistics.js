export const clean = arr => arr.filter(v => v !== null && v !== undefined && v !== '' && !isNaN(Number(v))).map(Number)
export const mean  = arr => { const a = clean(arr); return a.length ? a.reduce((s,v)=>s+v,0)/a.length : NaN }
export const median = arr => {
  const a = [...clean(arr)].sort((x,y)=>x-y)
  if (!a.length) return NaN
  const m = Math.floor(a.length/2)
  return a.length%2 ? a[m] : (a[m-1]+a[m])/2
}
export const variance = arr => {
  const a = clean(arr); if (a.length < 2) return NaN
  const m = mean(a); return a.reduce((s,v)=>s+(v-m)**2,0)/(a.length-1)
}
export const std = arr => Math.sqrt(variance(arr))
export const iqr = arr => {
  const a = [...clean(arr)].sort((x,y)=>x-y)
  if (a.length < 4) return NaN
  return a[Math.floor(a.length*.75)] - a[Math.floor(a.length*.25)]
}
export const skewness = arr => {
  const a = clean(arr); if (a.length < 3) return NaN
  const m = mean(a), s = std(a); if (s === 0) return 0
  return a.reduce((sum,v)=>sum+((v-m)/s)**3,0)/a.length
}
export const kurtosis = arr => {
  const a = clean(arr); if (a.length < 4) return NaN
  const m = mean(a), s = std(a); if (s === 0) return 0
  return a.reduce((sum,v)=>sum+((v-m)/s)**4,0)/a.length - 3
}
export const isNormal = arr => Math.abs(skewness(arr)) < 1.0 && Math.abs(kurtosis(arr)) < 2.0

export const descriptive = arr => {
  const a = clean(arr); const n = a.length; if (!n) return null
  const sorted = [...a].sort((x,y)=>x-y)
  const m = mean(a), s = std(a)
  return {
    n, missing: arr.length - n,
    mean: +m.toFixed(3), median: +median(a).toFixed(3),
    std: +s.toFixed(3), sem: +(s/Math.sqrt(n)).toFixed(3),
    min: +sorted[0].toFixed(3), max: +sorted[sorted.length-1].toFixed(3),
    q1: +sorted[Math.floor(n*.25)].toFixed(3), q3: +sorted[Math.floor(n*.75)].toFixed(3),
    iqr: +iqr(a).toFixed(3), skew: +skewness(a).toFixed(3), kurt: +kurtosis(a).toFixed(3),
    cv: m !== 0 ? +((s/Math.abs(m))*100).toFixed(1) : NaN,
    normal: isNormal(a),
    ci95: [+(m-1.96*s/Math.sqrt(n)).toFixed(3), +(m+1.96*s/Math.sqrt(n)).toFixed(3)],
  }
}

const rank = arr => {
  const indexed = arr.map((v,i)=>({v,i})).sort((a,b)=>a.v-b.v)
  const ranks = new Array(arr.length)
  let i = 0
  while (i < indexed.length) {
    let j = i
    while (j < indexed.length-1 && indexed[j+1].v === indexed[i].v) j++
    const r = (i+j)/2+1
    for (let k=i;k<=j;k++) ranks[indexed[k].i] = r
    i = j+1
  }
  return ranks
}

export const pearsonR = (x, y) => {
  const px=clean(x), py=clean(y), n=Math.min(px.length,py.length)
  if (n < 3) return { r:NaN, p:NaN, n }
  const mx=mean(px.slice(0,n)), my=mean(py.slice(0,n))
  let num=0,dx=0,dy=0
  for (let i=0;i<n;i++){num+=(px[i]-mx)*(py[i]-my);dx+=(px[i]-mx)**2;dy+=(py[i]-my)**2}
  const r = dx*dy>0 ? num/Math.sqrt(dx*dy) : NaN
  const t = r*Math.sqrt(n-2)/Math.sqrt(1-r*r)
  return { r:+r.toFixed(4), p:+tToPValue(t,n-2).toFixed(4), n }
}

export const spearmanR = (x, y) => {
  const px=clean(x),py=clean(y),n=Math.min(px.length,py.length)
  if (n < 3) return { r:NaN, p:NaN, n }
  return pearsonR(rank(px.slice(0,n)), rank(py.slice(0,n)))
}

export const welchTTest = (g1, g2) => {
  const a=clean(g1),b=clean(g2)
  if (a.length<2||b.length<2) return null
  const m1=mean(a),m2=mean(b),s1=variance(a),s2=variance(b),n1=a.length,n2=b.length
  const se=Math.sqrt(s1/n1+s2/n2); if(se===0) return null
  const t=(m1-m2)/se
  const df=(s1/n1+s2/n2)**2/((s1/n1)**2/(n1-1)+(s2/n2)**2/(n2-1))
  const p=tToPValue(t,df)
  return { t:+t.toFixed(4),df:+df.toFixed(1),p:+p.toFixed(4),
    mean1:+m1.toFixed(3),mean2:+m2.toFixed(3),
    sd1:+Math.sqrt(s1).toFixed(3),sd2:+Math.sqrt(s2).toFixed(3),n1,n2,
    significant:p<.05,
    interpretation:p<.001?'p < 0.001 (***)':p<.01?`p = ${p.toFixed(3)} (**)`:p<.05?`p = ${p.toFixed(3)} (*)`:`p = ${p.toFixed(3)} (ns)` }
}

export const mannWhitneyU = (g1, g2) => {
  const a=clean(g1),b=clean(g2)
  if (a.length<2||b.length<2) return null
  const n1=a.length,n2=b.length
  let u1=0; for(const x of a) for(const y of b) u1+=x>y?1:x===y?.5:0
  const U=Math.min(u1,n1*n2-u1)
  const z=(U-n1*n2/2)/Math.sqrt(n1*n2*(n1+n2+1)/12)
  const p=2*(1-normalCDF(Math.abs(z)))
  return { U:+U.toFixed(1),z:+z.toFixed(3),p:+p.toFixed(4),n1,n2,
    significant:p<.05,
    interpretation:p<.001?'p < 0.001 (***)':p<.01?`p = ${p.toFixed(3)} (**)`:p<.05?`p = ${p.toFixed(3)} (*)`:`p = ${p.toFixed(3)} (ns)` }
}

export const linearRegression = (xArr, yArr) => {
  const x=clean(xArr),y=clean(yArr),n=Math.min(x.length,y.length)
  if (n < 3) return null
  const xi=x.slice(0,n),yi=y.slice(0,n),mx=mean(xi),my=mean(yi)
  let sxy=0,sxx=0
  for(let i=0;i<n;i++){sxy+=(xi[i]-mx)*(yi[i]-my);sxx+=(xi[i]-mx)**2}
  const b=sxx>0?sxy/sxx:NaN, a=my-b*mx
  const yHat=xi.map(v=>a+b*v)
  const ss_res=yi.reduce((s,v,i)=>s+(v-yHat[i])**2,0)
  const ss_tot=yi.reduce((s,v)=>s+(v-my)**2,0)
  const r2=ss_tot>0?1-ss_res/ss_tot:NaN
  const mse=ss_res/(n-2), se_b=Math.sqrt(mse/sxx)
  const t_b=b/se_b, p_b=tToPValue(t_b,n-2)
  return { intercept:+a.toFixed(4), slope:+b.toFixed(4), r2:+r2.toFixed(4),
    r2adj:+(1-(1-r2)*(n-1)/(n-2)).toFixed(4), rmse:+Math.sqrt(mse).toFixed(4),
    p:+p_b.toFixed(4), t:+t_b.toFixed(3), n, significant:p_b<.05,
    interpretation:p_b<.001?'p < 0.001 (***)':p_b<.01?`p = ${p_b.toFixed(3)} (**)`:p_b<.05?`p = ${p_b.toFixed(3)} (*)`:`p = ${p_b.toFixed(3)} (ns)` }
}

export const logisticRegression = (xArr, yArr, epochs=2000, lr=0.05) => {
  const x=clean(xArr),y=clean(yArr.map(Number)),n=Math.min(x.length,y.length)
  if (n < 10) return null
  const xi=x.slice(0,n),yi=y.slice(0,n)
  const mx=mean(xi),sx=std(xi)
  const xs=xi.map(v=>sx>0?(v-mx)/sx:0)
  let w=0,b2=0
  for(let e=0;e<epochs;e++){
    let dw=0,db=0
    for(let i=0;i<n;i++){const p=sig(w*xs[i]+b2);dw+=(p-yi[i])*xs[i];db+=(p-yi[i])}
    w-=lr*dw/n; b2-=lr*db/n
  }
  const rW=sx>0?w/sx:w, rB=b2-rW*mx
  const probs=xi.map(v=>sig(rW*v+rB))
  const preds=probs.map(p=>p>=.5?1:0)
  const correct=preds.filter((p,i)=>p===yi[i]).length
  const p_bar=mean(yi)
  const ll0=yi.reduce((s,v)=>s+Math.log(p_bar+1e-10)*v+Math.log(1-p_bar+1e-10)*(1-v),0)
  const ll1=yi.reduce((s,v,i)=>s+Math.log(probs[i]+1e-10)*v+Math.log(1-probs[i]+1e-10)*(1-v),0)
  const tp=preds.filter((p,i)=>p===1&&yi[i]===1).length
  const tn=preds.filter((p,i)=>p===0&&yi[i]===0).length
  const fp=preds.filter((p,i)=>p===1&&yi[i]===0).length
  const fn=preds.filter((p,i)=>p===0&&yi[i]===1).length
  return { intercept:+rB.toFixed(4), coefficient:+rW.toFixed(4),
    or:+Math.exp(rW).toFixed(3), accuracy:+(correct/n*100).toFixed(1),
    sensitivity:+(tp/(tp+fn+1e-10)*100).toFixed(1), specificity:+(tn/(tn+fp+1e-10)*100).toFixed(1),
    ppv:+(tp/(tp+fp+1e-10)*100).toFixed(1), mcFaddenR2:+(ll0!==0?1-ll1/ll0:NaN).toFixed(4),
    n, tp, tn, fp, fn }
}

export const chiSquare = (var1Arr, var2Arr) => {
  const pairs = var1Arr.map((v,i)=>[v, var2Arr[i]]).filter(([a,b])=>a!=null&&a!==''&&b!=null&&b!=='')
  if (pairs.length < 5) return null
  const vals1 = [...new Set(pairs.map(p=>p[0]))]
  const vals2 = [...new Set(pairs.map(p=>p[1]))]
  if (vals1.length < 2 || vals2.length < 2) return null
  
  const observed = {}
  vals1.forEach(v1 => { observed[v1] = {}; vals2.forEach(v2 => { observed[v1][v2] = 0 }) })
  pairs.forEach(([a,b]) => { if(observed[a]) observed[a][b] = (observed[a][b]||0)+1 })
  
  const rowTotals = {}, colTotals = {}, n = pairs.length
  vals1.forEach(v1 => { rowTotals[v1] = vals2.reduce((s,v2)=>s+(observed[v1][v2]||0),0) })
  vals2.forEach(v2 => { colTotals[v2] = vals1.reduce((s,v1)=>s+(observed[v1][v2]||0),0) })
  
  let chi2 = 0
  vals1.forEach(v1 => {
    vals2.forEach(v2 => {
      const exp = rowTotals[v1]*colTotals[v2]/n
      if (exp > 0) chi2 += (observed[v1][v2]-exp)**2/exp
    })
  })
  
  const df = (vals1.length-1)*(vals2.length-1)
  const p = 1 - gammaCDF(chi2/2, df/2)
  const cramersV = Math.sqrt(chi2/(n*Math.min(vals1.length-1,vals2.length-1)))
  
  return { chi2: +chi2.toFixed(4), df, p: +p.toFixed(4), n, cramersV: +cramersV.toFixed(4),
    significant: p < .05,
    interpretation: p<.001?'p < 0.001 (***)':p<.01?`p = ${p.toFixed(3)} (**)`:p<.05?`p = ${p.toFixed(3)} (*)`:`p = ${p.toFixed(3)} (ns)` }
}

export const oneWayAnova = (groups) => {
  const cleaned = groups.map(g => clean(g)).filter(g => g.length >= 2)
  if (cleaned.length < 2) return null
  const allN = cleaned.reduce((s,g)=>s+g.length,0)
  const grandMean = cleaned.flat().reduce((s,v)=>s+v,0)/allN
  
  let ssBetween = 0, ssWithin = 0
  cleaned.forEach(g => {
    const gMean = g.reduce((s,v)=>s+v,0)/g.length
    ssBetween += g.length * (gMean - grandMean)**2
    g.forEach(v => { ssWithin += (v-gMean)**2 })
  })
  
  const dfB = cleaned.length - 1, dfW = allN - cleaned.length
  const msB = ssBetween/dfB, msW = ssWithin/dfW
  const F = msW > 0 ? msB/msW : NaN
  const p = 1 - fCDF(F, dfB, dfW)
  const eta2 = ssBetween/(ssBetween+ssWithin)
  
  return { F: +F.toFixed(4), dfBetween: dfB, dfWithin: dfW, p: +p.toFixed(4),
    eta2: +eta2.toFixed(4), n: allN, nGroups: cleaned.length,
    significant: p < .05,
    interpretation: p<.001?'p < 0.001 (***)':p<.01?`p = ${p.toFixed(3)} (**)`:p<.05?`p = ${p.toFixed(3)} (*)`:`p = ${p.toFixed(3)} (ns)` }
}

export const freqTable = arr => {
  const counts = {}
  arr.forEach(v => { if(v!==''&&v!=null) counts[v]=(counts[v]||0)+1 })
  const total = Object.values(counts).reduce((s,v)=>s+v,0)
  return Object.entries(counts).map(([k,n])=>({value:k,n,pct:+(n/total*100).toFixed(1)})).sort((a,b)=>b.n-a.n)
}

// ─── Math helpers ──────────────────────────────────────────────────────────────
function sig(z){ return 1/(1+Math.exp(-z)) }
function normalCDF(z){ return .5*(1+erf(z/Math.SQRT2)) }
function erf(x){
  const a1=.254829592,a2=-.284496736,a3=1.421413741,a4=-1.453152027,a5=1.061405429,p=.3275911
  const sign=x<0?-1:1; const ax=Math.abs(x); const t=1/(1+p*ax)
  return sign*(1-(((((a5*t+a4)*t)+a3)*t+a2)*t+a1)*t*Math.exp(-ax*ax))
}
function tToPValue(t, df){
  const x=df/(df+t*t)
  return Math.min(1, incompleteBeta(df/2,.5,x))
}
function incompleteBeta(a,b,x){
  if(x<=0) return 0; if(x>=1) return 1
  const lbeta=lgamma(a)+lgamma(b)-lgamma(a+b)
  const front=Math.exp(Math.log(x)*a+Math.log(1-x)*b-lbeta)
  return front*betaCF(a,b,x)/a
}
function betaCF(a,b,x){
  let c=1,d=1-(a+b)*x/(a+1); if(Math.abs(d)<1e-30)d=1e-30; d=1/d; let h=d
  for(let m=1;m<=200;m++){
    let aa=m*(b-m)*x/((a+2*m-1)*(a+2*m))
    d=1+aa*d;if(Math.abs(d)<1e-30)d=1e-30;c=1+aa/c;if(Math.abs(c)<1e-30)c=1e-30;d=1/d;h*=d*c
    aa=-(a+m)*(a+b+m)*x/((a+2*m)*(a+2*m+1))
    d=1+aa*d;if(Math.abs(d)<1e-30)d=1e-30;c=1+aa/c;if(Math.abs(c)<1e-30)c=1e-30;d=1/d
    const delta=d*c;h*=delta;if(Math.abs(delta-1)<3e-7)break
  }
  return h
}
function lgamma(x){
  const c=[76.18009172947146,-86.50532032941677,24.01409824083091,-1.231739572450155,.1208650973866179e-2,-.5395239384953e-5]
  let y=x,tmp=x+5.5;tmp-=(x+.5)*Math.log(tmp);let ser=1.000000000190015
  for(const ci of c) ser+=ci/++y
  return -tmp+Math.log(2.5066282746310005*ser/x)
}

function gammaCDF(x, a) {
  if (x <= 0) return 0
  if (x >= a + 10*Math.sqrt(a) + 50) return 1
  // Series expansion for lower incomplete gamma
  let sum = 1/a, term = 1/a
  for (let n=1; n<200; n++) {
    term *= x/(a+n)
    sum += term
    if (Math.abs(term) < 1e-10) break
  }
  return Math.min(1, sum * Math.exp(-x + a*Math.log(x) - lgamma(a)))
}

function fCDF(f, d1, d2) {
  if (f <= 0) return 0
  const x = d1*f/(d1*f+d2)
  return 1 - incompleteBeta(d2/2, d1/2, 1-x)
}
