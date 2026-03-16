// NA values: treat 'NA','N/A','na','n/a',null,undefined,'' as missing
const NA_VALUES = new Set(['NA','N/A','na','n/a','null','NULL','','undefined','.','__NA__','missing'])
export const isNA = v => v === null || v === undefined || NA_VALUES.has(String(v).trim())
export const clean = arr => arr.filter(v => !isNA(v) && !isNaN(Number(v))).map(Number)
export const mean = arr => { const a=clean(arr); return a.length ? a.reduce((s,v)=>s+v,0)/a.length : NaN }
export const median = arr => { const a=[...clean(arr)].sort((x,y)=>x-y); if(!a.length)return NaN; const m=Math.floor(a.length/2); return a.length%2?a[m]:(a[m-1]+a[m])/2 }
export const variance = arr => { const a=clean(arr); if(a.length<2)return NaN; const m=mean(a); return a.reduce((s,v)=>s+(v-m)**2,0)/(a.length-1) }
export const std = arr => Math.sqrt(variance(arr))
export const iqr = arr => { const a=[...clean(arr)].sort((x,y)=>x-y); if(a.length<4)return NaN; return a[Math.floor(a.length*.75)]-a[Math.floor(a.length*.25)] }
export const skewness = arr => { const a=clean(arr); if(a.length<3)return NaN; const m=mean(a),s=std(a); if(s===0)return 0; return a.reduce((sum,v)=>sum+((v-m)/s)**3,0)/a.length }
export const kurtosis = arr => { const a=clean(arr); if(a.length<4)return NaN; const m=mean(a),s=std(a); if(s===0)return 0; return a.reduce((sum,v)=>sum+((v-m)/s)**4,0)/a.length-3 }
export const isNormal = arr => { const a=clean(arr); if(a.length<8)return false; const sw=shapiroWilk(a); if(sw)return sw.p>0.05; return Math.abs(skewness(arr))<1.0&&Math.abs(kurtosis(arr))<2.0 }

// Shapiro-Wilk approximation (for n<=50, uses simplified algorithm)
export const shapiroWilk = arr => {
  const a=[...clean(arr)].sort((x,y)=>x-y); const n=a.length
  if(n<3||n>5000)return null
  const m=mean(a),ss=a.reduce((s,v)=>s+(v-m)**2,0)
  if(ss===0)return{W:1,p:1}
  // Compute W using order statistics
  const nn=Math.floor(n/2)
  // Approximate coefficients using Blom's formula
  const ai=[]
  for(let i=1;i<=nn;i++){
    const p=(i-0.375)/(n+0.25)
    ai.push(normalQuantile(p))
  }
  const sumA2=ai.reduce((s,v)=>s+v*v,0)
  let num=0
  for(let i=0;i<nn;i++) num+=ai[i]*(a[n-1-i]-a[i])
  const W=num*num/(sumA2*ss)
  // Approximate p-value using normal transform
  const lnW=Math.log(1-W)
  const mu=n<12?-1.26+1.05*Math.log(n):-2.73+0.459*Math.log(n)
  const sigma=n<12?1.04-0.175*Math.log(n):0.94-0.134*Math.log(n)
  const z=(lnW-mu)/sigma
  const p=1-normalCDF(z)
  return{W:+W.toFixed(4),p:+Math.min(1,Math.max(0,p)).toFixed(4)}
}

// Levene's test for equality of variances
export const leveneTest = (groups) => {
  const cleaned=groups.map(g=>clean(g)).filter(g=>g.length>=2)
  if(cleaned.length<2)return null
  const allN=cleaned.reduce((s,g)=>s+g.length,0)
  const k=cleaned.length
  // Use median-based (Brown-Forsythe)
  const groupMedians=cleaned.map(g=>{const s=[...g].sort((a,b)=>a-b);const m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2})
  const zij=cleaned.map((g,gi)=>g.map(v=>Math.abs(v-groupMedians[gi])))
  const groupMeans=zij.map(g=>g.reduce((s,v)=>s+v,0)/g.length)
  const grandMean=zij.flat().reduce((s,v)=>s+v,0)/allN
  let ssB=0,ssW=0
  zij.forEach((g,gi)=>{ssB+=g.length*(groupMeans[gi]-grandMean)**2;g.forEach(v=>{ssW+=(v-groupMeans[gi])**2})})
  const F=ssW>0?(ssB/(k-1))/(ssW/(allN-k)):0
  const p=1-fCDF(F,k-1,allN-k)
  return{F:+F.toFixed(4),df1:k-1,df2:allN-k,p:+p.toFixed(4),equalVariance:p>=0.05}
}

export const descriptive = arr => {
  const a=clean(arr);const n=a.length;if(!n)return null
  const sorted=[...a].sort((x,y)=>x-y),m=mean(a),s=std(a)
  const naCount=arr.filter(v=>isNA(v)).length
  const sw=shapiroWilk(a)
  return{n,missing:arr.length-n,na:naCount,mean:+m.toFixed(3),median:+median(a).toFixed(3),
    std:+s.toFixed(3),sem:+(s/Math.sqrt(n)).toFixed(3),
    min:+sorted[0].toFixed(3),max:+sorted[sorted.length-1].toFixed(3),
    q1:+sorted[Math.floor(n*.25)].toFixed(3),q3:+sorted[Math.floor(n*.75)].toFixed(3),
    iqr:+iqr(a).toFixed(3),skew:+skewness(a).toFixed(3),kurt:+kurtosis(a).toFixed(3),
    cv:m!==0?+((s/Math.abs(m))*100).toFixed(1):NaN,
    shapiroW:sw?.W,shapiroP:sw?.p,normal:isNormal(a),
    ci95:[+(m-1.96*s/Math.sqrt(n)).toFixed(3),+(m+1.96*s/Math.sqrt(n)).toFixed(3)]}
}

const rank=arr=>{const indexed=arr.map((v,i)=>({v,i})).sort((a,b)=>a.v-b.v);const ranks=new Array(arr.length);let i=0;while(i<indexed.length){let j=i;while(j<indexed.length-1&&indexed[j+1].v===indexed[i].v)j++;const r=(i+j)/2+1;for(let k=i;k<=j;k++)ranks[indexed[k].i]=r;i=j+1}return ranks}
export const pearsonR=(x,y)=>{const px=clean(x),py=clean(y),n=Math.min(px.length,py.length);if(n<3)return{r:NaN,p:NaN,n};const mx=mean(px.slice(0,n)),my=mean(py.slice(0,n));let num=0,dx=0,dy=0;for(let i=0;i<n;i++){num+=(px[i]-mx)*(py[i]-my);dx+=(px[i]-mx)**2;dy+=(py[i]-my)**2}const r=dx*dy>0?num/Math.sqrt(dx*dy):NaN;const t=r*Math.sqrt(n-2)/Math.sqrt(1-r*r);return{r:+r.toFixed(4),p:+tToPValue(t,n-2).toFixed(4),n}}
export const spearmanR=(x,y)=>{const px=clean(x),py=clean(y),n=Math.min(px.length,py.length);if(n<3)return{r:NaN,p:NaN,n};return pearsonR(rank(px.slice(0,n)),rank(py.slice(0,n)))}

export const welchTTest=(g1,g2)=>{const a=clean(g1),b=clean(g2);if(a.length<2||b.length<2)return null;const m1=mean(a),m2=mean(b),s1=variance(a),s2=variance(b),n1=a.length,n2=b.length;const se=Math.sqrt(s1/n1+s2/n2);if(se===0)return null;const t=(m1-m2)/se;const df=(s1/n1+s2/n2)**2/((s1/n1)**2/(n1-1)+(s2/n2)**2/(n2-1));const p=tToPValue(t,df);const cohend=Math.abs(m1-m2)/Math.sqrt(((n1-1)*s1+(n2-1)*s2)/(n1+n2-2));return{t:+t.toFixed(4),df:+df.toFixed(1),p:+p.toFixed(4),mean1:+m1.toFixed(3),mean2:+m2.toFixed(3),sd1:+Math.sqrt(s1).toFixed(3),sd2:+Math.sqrt(s2).toFixed(3),n1,n2,cohend:+cohend.toFixed(3),significant:p<.05,interpretation:p<.001?'p < 0.001 (***)':p<.01?`p = ${p.toFixed(3)} (**)`:p<.05?`p = ${p.toFixed(3)} (*)`:`p = ${p.toFixed(3)} (ns)`}}
export const mannWhitneyU=(g1,g2)=>{const a=clean(g1),b=clean(g2);if(a.length<2||b.length<2)return null;const n1=a.length,n2=b.length;let u1=0;for(const x of a)for(const y of b)u1+=x>y?1:x===y?.5:0;const U=Math.min(u1,n1*n2-u1);const z=(U-n1*n2/2)/Math.sqrt(n1*n2*(n1+n2+1)/12);const p=2*(1-normalCDF(Math.abs(z)));const rbc=1-2*U/(n1*n2);return{U:+U.toFixed(1),z:+z.toFixed(3),p:+p.toFixed(4),n1,n2,rbc:+rbc.toFixed(3),significant:p<.05,interpretation:p<.001?'p < 0.001 (***)':p<.01?`p = ${p.toFixed(3)} (**)`:p<.05?`p = ${p.toFixed(3)} (*)`:`p = ${p.toFixed(3)} (ns)`}}
export const linearRegression=(xArr,yArr)=>{const x=clean(xArr),y=clean(yArr),n=Math.min(x.length,y.length);if(n<3)return null;const xi=x.slice(0,n),yi=y.slice(0,n),mx=mean(xi),my=mean(yi);let sxy=0,sxx=0;for(let i=0;i<n;i++){sxy+=(xi[i]-mx)*(yi[i]-my);sxx+=(xi[i]-mx)**2}const b=sxx>0?sxy/sxx:NaN,a=my-b*mx;const yH=xi.map(v=>a+b*v),ssr=yi.reduce((s,v,i)=>s+(v-yH[i])**2,0),sst=yi.reduce((s,v)=>s+(v-my)**2,0);const r2=sst>0?1-ssr/sst:NaN,mse=ssr/(n-2),seb=Math.sqrt(mse/sxx),tb=b/seb,pb=tToPValue(tb,n-2);return{intercept:+a.toFixed(4),slope:+b.toFixed(4),r2:+r2.toFixed(4),r2adj:+(1-(1-r2)*(n-1)/(n-2)).toFixed(4),rmse:+Math.sqrt(mse).toFixed(4),p:+pb.toFixed(4),t:+tb.toFixed(3),n,significant:pb<.05,interpretation:pb<.001?'p < 0.001 (***)':pb<.01?`p = ${pb.toFixed(3)} (**)`:pb<.05?`p = ${pb.toFixed(3)} (*)`:`p = ${pb.toFixed(3)} (ns)`}}
export const logisticRegression=(xArr,yArr,epochs=2000,lr=0.05)=>{const x=clean(xArr),y=clean(yArr.map(Number)),n=Math.min(x.length,y.length);if(n<10)return null;const xi=x.slice(0,n),yi=y.slice(0,n),mx=mean(xi),sx=std(xi);const xs=xi.map(v=>sx>0?(v-mx)/sx:0);let w=0,b2=0;for(let e=0;e<epochs;e++){let dw=0,db=0;for(let i=0;i<n;i++){const p=sig(w*xs[i]+b2);dw+=(p-yi[i])*xs[i];db+=(p-yi[i])}w-=lr*dw/n;b2-=lr*db/n}const rW=sx>0?w/sx:w,rB=b2-rW*mx;const probs=xi.map(v=>sig(rW*v+rB)),preds=probs.map(p=>p>=.5?1:0),correct=preds.filter((p,i)=>p===yi[i]).length;const pb=mean(yi),ll0=yi.reduce((s,v)=>s+Math.log(pb+1e-10)*v+Math.log(1-pb+1e-10)*(1-v),0),ll1=yi.reduce((s,v,i)=>s+Math.log(probs[i]+1e-10)*v+Math.log(1-probs[i]+1e-10)*(1-v),0);const tp=preds.filter((p,i)=>p===1&&yi[i]===1).length,tn=preds.filter((p,i)=>p===0&&yi[i]===0).length,fp=preds.filter((p,i)=>p===1&&yi[i]===0).length,fn=preds.filter((p,i)=>p===0&&yi[i]===1).length;return{intercept:+rB.toFixed(4),coefficient:+rW.toFixed(4),or:+Math.exp(rW).toFixed(3),accuracy:+(correct/n*100).toFixed(1),sensitivity:+(tp/(tp+fn+1e-10)*100).toFixed(1),specificity:+(tn/(tn+fp+1e-10)*100).toFixed(1),ppv:+(tp/(tp+fp+1e-10)*100).toFixed(1),mcFaddenR2:+(ll0!==0?1-ll1/ll0:NaN).toFixed(4),n,tp,tn,fp,fn}}

// Multivariable logistic regression — gradient descent
// xArrays: array of arrays (each predictor), yArr: outcome 0/1
export const multiLogisticRegression=(xArrays,yArr,epochs=3000,lr=0.03)=>{
  const k=xArrays.length; if(k===0)return null
  // Build aligned data matrix — only rows with all values present
  const yClean=yArr.map(Number)
  const validRows=[]
  for(let i=0;i<yClean.length;i++){
    if(isNaN(yClean[i])||(yClean[i]!==0&&yClean[i]!==1))continue
    const xRow=xArrays.map(xa=>{const v=Number(xa[i]);return isNaN(v)?null:v})
    if(xRow.some(v=>v===null))continue
    validRows.push({x:xRow,y:yClean[i]})
  }
  const n=validRows.length; if(n<10)return null
  const X=validRows.map(r=>r.x),Y=validRows.map(r=>r.y)
  // Standardize each predictor
  const means=[],stds=[]
  for(let j=0;j<k;j++){
    const col=X.map(r=>r[j]),m=col.reduce((s,v)=>s+v,0)/n,sd=Math.sqrt(col.reduce((s,v)=>s+(v-m)**2,0)/(n-1))||1
    means.push(m);stds.push(sd)
  }
  const Xs=X.map(row=>row.map((v,j)=>(v-means[j])/stds[j]))
  // Gradient descent
  const w=new Array(k).fill(0); let b=0
  for(let e=0;e<epochs;e++){
    const dw=new Array(k).fill(0); let db=0
    for(let i=0;i<n;i++){
      let z=b; for(let j=0;j<k;j++)z+=w[j]*Xs[i][j]
      const p=sig(z),err=p-Y[i]
      for(let j=0;j<k;j++)dw[j]+=err*Xs[i][j]
      db+=err
    }
    for(let j=0;j<k;j++)w[j]-=lr*dw[j]/n
    b-=lr*db/n
  }
  // Convert back to original scale
  const realW=w.map((wj,j)=>wj/stds[j])
  let realB=b; for(let j=0;j<k;j++)realB-=realW[j]*means[j]
  // Predictions
  const probs=X.map(row=>{let z=realB;for(let j=0;j<k;j++)z+=realW[j]*row[j];return sig(z)})
  const preds=probs.map(p=>p>=.5?1:0)
  const correct=preds.filter((p,i)=>p===Y[i]).length
  const tp=preds.filter((p,i)=>p===1&&Y[i]===1).length
  const tn=preds.filter((p,i)=>p===0&&Y[i]===0).length
  const fp=preds.filter((p,i)=>p===1&&Y[i]===0).length
  const fn2=preds.filter((p,i)=>p===0&&Y[i]===1).length
  const pBar=Y.reduce((s,v)=>s+v,0)/n
  const ll0=Y.reduce((s,v)=>s+Math.log(pBar+1e-10)*v+Math.log(1-pBar+1e-10)*(1-v),0)
  const ll1=Y.reduce((s,v,i)=>s+Math.log(probs[i]+1e-10)*v+Math.log(1-probs[i]+1e-10)*(1-v),0)
  // Per-variable results
  const coefficients=realW.map((wj,j)=>({
    coef:+wj.toFixed(4), or:+Math.exp(wj).toFixed(3),
    orLow:+Math.exp(wj-1.96*Math.abs(wj/2)).toFixed(3), // approx CI
    orHigh:+Math.exp(wj+1.96*Math.abs(wj/2)).toFixed(3),
  }))
  // Predict function for new data
  const predict=(newValues)=>{
    let z=realB; for(let j=0;j<k;j++)z+=realW[j]*(newValues[j]||0)
    return +sig(z).toFixed(4)
  }
  return{
    intercept:+realB.toFixed(4), coefficients, n, k,
    accuracy:+(correct/n*100).toFixed(1),
    sensitivity:+(tp/(tp+fn2+1e-10)*100).toFixed(1),
    specificity:+(tn/(tn+fp+1e-10)*100).toFixed(1),
    ppv:+(tp/(tp+fp+1e-10)*100).toFixed(1),
    npv:+(tn/(tn+fn2+1e-10)*100).toFixed(1),
    mcFaddenR2:+(ll0!==0?1-ll1/ll0:NaN).toFixed(4),
    tp,tn,fp,fn:fn2,predict,realW,realB
  }
}
export const oneWayAnova=(groups)=>{const cl=groups.map(g=>clean(g)).filter(g=>g.length>=2);if(cl.length<2)return null;const allN=cl.reduce((s,g)=>s+g.length,0),gm=cl.flat().reduce((s,v)=>s+v,0)/allN;let ssB=0,ssW=0;cl.forEach(g=>{const gM=g.reduce((s,v)=>s+v,0)/g.length;ssB+=g.length*(gM-gm)**2;g.forEach(v=>{ssW+=(v-gM)**2})});const dfB=cl.length-1,dfW=allN-cl.length,msB=ssB/dfB,msW=ssW/dfW,F=msW>0?msB/msW:NaN,p=1-fCDF(F,dfB,dfW),eta2=ssB/(ssB+ssW);return{F:+F.toFixed(4),dfBetween:dfB,dfWithin:dfW,p:+p.toFixed(4),eta2:+eta2.toFixed(4),n:allN,nGroups:cl.length,significant:p<.05,interpretation:p<.001?'p < 0.001 (***)':p<.01?`p = ${p.toFixed(3)} (**)`:p<.05?`p = ${p.toFixed(3)} (*)`:`p = ${p.toFixed(3)} (ns)`}}
export const freqTable=arr=>{const counts={};arr.forEach(v=>{if(!isNA(v))counts[v]=(counts[v]||0)+1});const total=Object.values(counts).reduce((s,v)=>s+v,0);return Object.entries(counts).map(([k,n])=>({value:k,n,pct:+(n/total*100).toFixed(1)})).sort((a,b)=>b.n-a.n)}

// Math helpers
function sig(z){return 1/(1+Math.exp(-z))}
function normalCDF(z){return .5*(1+erf(z/Math.SQRT2))}
function normalQuantile(p){// Rational approximation
  if(p<=0)return-Infinity;if(p>=1)return Infinity;if(p===0.5)return 0
  const t=p<0.5?Math.sqrt(-2*Math.log(p)):Math.sqrt(-2*Math.log(1-p))
  const c0=2.515517,c1=0.802853,c2=0.010328,d1=1.432788,d2=0.189269,d3=0.001308
  const q=t-(c0+c1*t+c2*t*t)/(1+d1*t+d2*t*t+d3*t*t*t)
  return p<0.5?-q:q
}
function erf(x){const a1=.254829592,a2=-.284496736,a3=1.421413741,a4=-1.453152027,a5=1.061405429,p=.3275911;const sign=x<0?-1:1;const ax=Math.abs(x);const t=1/(1+p*ax);return sign*(1-(((((a5*t+a4)*t)+a3)*t+a2)*t+a1)*t*Math.exp(-ax*ax))}
function tToPValue(t,df){const x=df/(df+t*t);return Math.min(1,incompleteBeta(df/2,.5,x))}
function incompleteBeta(a,b,x){if(x<=0)return 0;if(x>=1)return 1;const lb=lgamma(a)+lgamma(b)-lgamma(a+b);const f=Math.exp(Math.log(x)*a+Math.log(1-x)*b-lb);return f*betaCF(a,b,x)/a}
function betaCF(a,b,x){let c=1,d=1-(a+b)*x/(a+1);if(Math.abs(d)<1e-30)d=1e-30;d=1/d;let h=d;for(let m=1;m<=200;m++){let aa=m*(b-m)*x/((a+2*m-1)*(a+2*m));d=1+aa*d;if(Math.abs(d)<1e-30)d=1e-30;c=1+aa/c;if(Math.abs(c)<1e-30)c=1e-30;d=1/d;h*=d*c;aa=-(a+m)*(a+b+m)*x/((a+2*m)*(a+2*m+1));d=1+aa*d;if(Math.abs(d)<1e-30)d=1e-30;c=1+aa/c;if(Math.abs(c)<1e-30)c=1e-30;d=1/d;const delta=d*c;h*=delta;if(Math.abs(delta-1)<3e-7)break}return h}
function lgamma(x){const c=[76.18009172947146,-86.50532032941677,24.01409824083091,-1.231739572450155,.1208650973866179e-2,-.5395239384953e-5];let y=x,tmp=x+5.5;tmp-=(x+.5)*Math.log(tmp);let ser=1.000000000190015;for(const ci of c)ser+=ci/++y;return-tmp+Math.log(2.5066282746310005*ser/x)}
function fCDF(f,d1,d2){if(f<=0)return 0;const x=d1*f/(d1*f+d2);return 1-incompleteBeta(d2/2,d1/2,1-x)}
