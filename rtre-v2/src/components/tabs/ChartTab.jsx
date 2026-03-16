import { useState, useMemo, useEffect } from 'react'
import { AreaChart, Area, BarChart, Bar, ScatterChart, Scatter, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart } from 'recharts'
import { Btn, Pill } from '../ui/index.jsx'
import { C, CHART_COLORS } from '../../theme.js'
import { isNumType } from './InputTab.jsx'
import { descriptive, freqTable, pearsonR, spearmanR, welchTTest, mannWhitneyU, linearRegression, logisticRegression, oneWayAnova, clean, isNormal, shapiroWilk, leveneTest } from '../../utils/statistics.js'
import { suggestModels } from '../../utils/modelAdvisor.js'
import { exportStatsCSV } from '../../utils/export.js'

const CTS=[{id:'area',label:'AREA',tip:'Xu hướng tích lũy / mean theo nhóm'},{id:'line',label:'LINE',tip:'Xu hướng / mean theo nhóm'},{id:'bar',label:'BAR',tip:'Tần số phân loại / mean±SD theo nhóm / giá trị số'},{id:'scatter',label:'SCATTER',tip:'Tương quan X-Y, màu theo nhóm'},{id:'pie',label:'PIE',tip:'Tỷ lệ phân loại/nhị phân'},{id:'hist',label:'HIST',tip:'Phân phối + Normal curve + Shapiro-Wilk'},{id:'box',label:'BOX',tip:'Median, Q1/Q3, IQR / grouped by category'},{id:'heatmap',label:'HEAT',tip:'Ma trận tương quan'}]
const DC=[...CHART_COLORS]
const TABS=[{id:'chart',label:'Chart',icon:'●',color:C.green},{id:'stats',label:'Stats',icon:'Σ',color:C.blue},{id:'corr',label:'Corr',icon:'◎',color:C.purple},{id:'model',label:'Model',icon:'⊕',color:C.orange},{id:'advisor',label:'Advisor',icon:'◆',color:C.gold}]
const hx=hex=>{const h=(hex||'00FA9A').replace('#','');return`${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)}`}
const d1=()=><div style={{padding:16,color:'rgba(200,230,200,.3)',fontSize:11,textAlign:'center'}}>Chọn biến phù hợp</div>
const RC=({children})=><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
const tk={fill:'rgba(200,230,200,.4)',fontSize:9}
const ttS={background:'rgba(5,5,18,.96)',border:'1px solid rgba(0,250,154,.4)',borderRadius:4,fontSize:10}
const catLabel=(v,val)=>v.type==='binary'?(val==='1'||val===1?'Có':'Không'):String(val)

export function ChartTab({project,advisorModel,onAdvisorSelect}){
  const[tab,setTab]=useState('chart');const[ct,setCt]=useState('area');const[selVars,setSV]=useState(new Set());const[cc,setCC]=useState({});const[scf,setSCF]=useState(null);const[aav,setAAV]=useState(null);const[histMode,setHistMode]=useState('density')
  const[mdv,setMdv]=useState('');const[miv,setMiv]=useState(new Set());const[mgv,setMgv]=useState('')
  // Binning/grouping config: {varId: {breaks:[30,60], labels:['<30','30-60','>60']}}
  const[binCfg,setBinCfg]=useState({})
  const[binEditor,setBinEditor]=useState(null) // varId being edited
  const[binInput,setBinInput]=useState('') // text input for breaks
  const[binMode,setBinMode]=useState('custom') // 'custom'|'equal'|'quartile'

  const sv=useMemo(()=>[...project.variables].sort((a,b)=>(a.order??0)-(b.order??0)),[project.variables])
  const nv=useMemo(()=>sv.filter(v=>isNumType(v.type)),[sv]);const cv=useMemo(()=>sv.filter(v=>v.type==='categorical'),[sv]);const bv=useMemo(()=>sv.filter(v=>v.type==='binary'),[sv])
  const chV=useMemo(()=>sv.filter(v=>v.type!=='image'),[sv]);const cnv=useMemo(()=>chV.filter(v=>isNumType(v.type)),[chV])
  const togV=vid=>setSV(p=>{const n=new Set(p);n.has(vid)?n.delete(vid):n.add(vid);return n})
  const gc=(vid,i)=>cc[vid]||DC[i%DC.length]

  // ─── Binning helpers ────
  const binValue=(vid,val)=>{
    const cfg=binCfg[vid]; if(!cfg||!cfg.breaks.length)return null
    const n=Number(val); if(isNaN(n))return null
    const{breaks,labels}=cfg
    for(let i=0;i<breaks.length;i++){if(n<breaks[i])return labels[i]}
    return labels[labels.length-1]
  }
  const hasBin=vid=>binCfg[vid]&&binCfg[vid].breaks.length>0
  const makeBinLabels=(breaks,vals)=>{
    const mn=vals.length?Math.min(...vals):0
    const labels=[`< ${breaks[0]}`]
    for(let i=0;i<breaks.length-1;i++)labels.push(`${breaks[i]}–${breaks[i+1]}`)
    labels.push(`≥ ${breaks[breaks.length-1]}`)
    return labels
  }
  const applyAutoBin=(vid,mode)=>{
    const vals=clean(project.rows.map(r=>r[vid])); if(vals.length<4)return
    let breaks
    if(mode==='equal'){
      const mn=Math.min(...vals),mx=Math.max(...vals),step=(mx-mn)/4
      breaks=[mn+step,mn+2*step,mn+3*step].map(v=>+v.toFixed(1))
    } else { // quartile
      const sorted=[...vals].sort((a,b)=>a-b)
      breaks=[sorted[Math.floor(sorted.length*.25)],sorted[Math.floor(sorted.length*.5)],sorted[Math.floor(sorted.length*.75)]]
      breaks=[...new Set(breaks.map(v=>+v.toFixed(1)))]
    }
    const labels=makeBinLabels(breaks,vals)
    setBinCfg(p=>({...p,[vid]:{breaks,labels}}))
    setBinInput(breaks.join(', '))
  }
  const applyCustomBin=(vid)=>{
    const breaks=binInput.split(/[,;]\s*/).map(Number).filter(v=>!isNaN(v)).sort((a,b)=>a-b)
    if(!breaks.length)return setBinCfg(p=>{const n={...p};delete n[vid];return n}) // clear
    const vals=clean(project.rows.map(r=>r[vid]))
    const labels=makeBinLabels(breaks,vals)
    setBinCfg(p=>({...p,[vid]:{breaks,labels}}))
  }
  const clearBin=vid=>setBinCfg(p=>{const n={...p};delete n[vid];return n})

  // Get binned frequency data for a numeric var
  const binnedFreq=(vid)=>{
    const cfg=binCfg[vid]; if(!cfg)return[]
    const vals=project.rows.map(r=>r[vid]).filter(x=>x!=null&&x!==''&&x!=='__NA__')
    const groups={}; cfg.labels.forEach(l=>{groups[l]=0})
    vals.forEach(v=>{const lbl=binValue(vid,v);if(lbl)groups[lbl]=(groups[lbl]||0)+1})
    const total=vals.length
    return cfg.labels.map((l,i)=>({name:l,count:groups[l]||0,pct:total?+((groups[l]||0)/total*100).toFixed(1):0,fill:DC[i%DC.length]}))
  }

  useEffect(()=>{if(selVars.size===0&&cnv.length>=1)setSV(new Set(cnv.slice(0,Math.min(3,cnv.length)).map(v=>v.id)))},[cnv])

  useEffect(()=>{if(!advisorModel)return;setTab('model');const m=advisorModel;if(/logistic/i.test(m)&&bv.length>0){setMdv(bv[0].id);setMiv(new Set(nv.slice(0,3).map(v=>v.id)))}
    else if(/linear|ols/i.test(m)&&nv.length>=2){setMdv(nv[0].id);setMiv(new Set(nv.slice(1,4).map(v=>v.id)))}
    else if(/t-test|mann|welch/i.test(m)&&nv.length>0&&cv.length>0){setMdv(nv[0].id);setMgv(cv[0].id)}
    else if(/anova|kruskal/i.test(m)&&nv.length>0&&cv.length>0){setMdv(nv[0].id);setMgv(cv[0].id)}
    else if(/pearson|spearman|corr/i.test(m))setTab('corr');else if(/descriptive/i.test(m))setTab('stats')
    onAdvisorSelect(null)},[advisorModel])

  const snv=useMemo(()=>cnv.filter(v=>selVars.has(v.id)),[cnv,selVars])
  const vr=useMemo(()=>{const r={};snv.forEach(v=>{const vals=clean(project.rows.map(rr=>rr[v.id]));if(vals.length)r[v.id]={min:Math.min(...vals),max:Math.max(...vals),range:Math.max(...vals)-Math.min(...vals)}});return r},[snv,project.rows])
  const needMA=useMemo(()=>{const rs=Object.values(vr);if(rs.length<=1)return false;return Math.max(...rs.map(r=>r.range||1))/Math.max(Math.min(...rs.map(r=>r.range||1)),0.001)>3},[vr])
  const cd=useMemo(()=>project.rows.map((row,i)=>{const d={_idx:i+1};chV.forEach(v=>{d[v.id]=isNumType(v.type)&&row[v.id]!=null&&row[v.id]!==''&&row[v.id]!=='NA'&&row[v.id]!=='__NA__'?Number(row[v.id]):row[v.id]??''});return d}),[project.rows,chV])

  // Model computation (unchanged)
  const aov=useMemo(()=>[...bv,...nv],[bv,nv]);const depV=useMemo(()=>aov.find(v=>v.id===mdv),[aov,mdv])
  const mr=useMemo(()=>{if(!depV||(miv.size===0&&!mgv))return null;const il=cnv.filter(v=>miv.has(v.id)&&v.id!==depV.id);if(mgv){const gv=cv.find(v=>v.id===mgv);if(gv){const groups=[...new Set(project.rows.map(r=>r[gv.id]).filter(Boolean))];if(groups.length===2){const g1=project.rows.filter(r=>r[gv.id]===groups[0]).map(r=>r[depV.id]),g2=project.rows.filter(r=>r[gv.id]===groups[1]).map(r=>r[depV.id]);const n2=isNormal(g1)&&isNormal(g2)&&g1.length>=20&&g2.length>=20;const res=n2?welchTTest(g1,g2):mannWhitneyU(g1,g2);return res?{type:n2?'ttest':'mw',result:res,groups}:null}if(groups.length>=3){const gd=groups.map(g=>project.rows.filter(r=>r[gv.id]===g).map(r=>r[depV.id]));const res=oneWayAnova(gd);return res?{type:'anova',result:res}:null}}}if(!il.length)return null;if(depV.type==='binary'){const xv=il[0];const res=logisticRegression(project.rows.map(r=>r[xv.id]),project.rows.map(r=>r[depV.id]));return res?{type:'logistic',result:res}:null}const xv=il[0];const res=linearRegression(project.rows.map(r=>r[xv.id]),project.rows.map(r=>r[depV.id]));return res?{type:'linear',result:res}:null},[depV,miv,mgv,project.rows,cnv,cv])

  // ─── Helpers ────
  const groupedStats=(gv,yv)=>{
    const groups=[...new Set(project.rows.map(r=>r[gv.id]).filter(x=>x!=null&&x!==''&&x!=='__NA__'))]
    return groups.map((g,i)=>{
      const vals=clean(project.rows.filter(r=>r[gv.id]===g).map(r=>r[yv.id]))
      const m=vals.length?vals.reduce((s,v2)=>s+v2,0)/vals.length:0
      const sd=vals.length>1?Math.sqrt(vals.reduce((s,v2)=>s+(v2-m)**2,0)/(vals.length-1)):0
      const sorted=[...vals].sort((a,b2)=>a-b2)
      const q1=sorted[Math.floor(sorted.length*.25)]||0,med=sorted[Math.floor(sorted.length*.5)]||0,q3=sorted[Math.floor(sorted.length*.75)]||0
      const iqr2=q3-q1
      return{group:g,label:catLabel(gv,g),mean:+m.toFixed(2),sd:+sd.toFixed(2),n:vals.length,q1,med,q3,
        wL:Math.max(sorted[0]||0,q1-1.5*iqr2),wH:Math.min(sorted[sorted.length-1]||0,q3+1.5*iqr2),
        vals,color:DC[i%DC.length]}
    })
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CHART RENDERING — smart categorical/binary support per chart type
  // ═══════════════════════════════════════════════════════════════════════
  const renderChart=()=>{
    if(!selVars.size)return<div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:'rgba(200,230,200,.25)',fontSize:12}}>Chọn biến</div>
    const selCats=chV.filter(v=>selVars.has(v.id)&&(v.type==='categorical'||v.type==='binary'))
    const selNums=snv, hasG=selCats.length>0, hasN=selNums.length>0, gv=selCats[0]

    // ═══ PIE ═══
    if(ct==='pie'){
      // Binned numeric → pie
      const binnedNum=selNums.find(v=>hasBin(v.id))
      if(binnedNum){
        const data=binnedFreq(binnedNum.id)
        return<RC><PieChart><Pie data={data} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius="65%" label={({name,pct})=>`${name} ${pct}%`} stroke="rgba(7,7,15,.8)" strokeWidth={2}>{data.map((d,i)=><Cell key={i} fill={d.fill}/>)}</Pie><Tooltip contentStyle={ttS} formatter={(val,_,p)=>[`${val} (${p.payload.pct}%)`,'N']}/><Legend wrapperStyle={{fontSize:9}}/></PieChart></RC>
      }
      const v=selCats[0]||chV.find(v2=>selVars.has(v2.id)); if(!v)return d1()
      const ft=freqTable(project.rows.map(r=>r[v.id]).filter(x=>x!='__NA__'))
      const data=ft.map((f,i)=>({name:catLabel(v,f.value),value:f.n,pct:f.pct,fill:DC[i%DC.length]}))
      return<RC><PieChart><Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius="65%" label={({name,pct})=>`${name} ${pct}%`} stroke="rgba(7,7,15,.8)" strokeWidth={2}>{data.map((d,i)=><Cell key={i} fill={d.fill}/>)}</Pie><Tooltip contentStyle={ttS} formatter={(val,_,p)=>[`${val} (${p.payload.pct}%)`,'N']}/><Legend wrapperStyle={{fontSize:9}}/></PieChart></RC>
    }

    // ═══ HIST ═══
    if(ct==='hist'){
      const v=selNums[0]; if(!v)return d1()
      // Grouped histogram: overlaid density per category
      if(gv){
        const groups=[...new Set(project.rows.map(r=>r[gv.id]).filter(x=>x!=null&&x!==''&&x!=='__NA__'))]
        const allVals=clean(project.rows.map(r=>r[v.id])); if(allVals.length<2)return d1()
        const mn=Math.min(...allVals),mx=Math.max(...allVals),nB=Math.min(Math.ceil(Math.sqrt(allVals.length)),20),bW=(mx-mn)/nB||1
        const bins=Array.from({length:nB},(_,i)=>({label:`${(mn+i*bW).toFixed(1)}`,lo:mn+i*bW}))
        groups.forEach((g,gi)=>{const gV=clean(project.rows.filter(r=>r[gv.id]===g).map(r=>r[v.id]));const N2=gV.length;bins.forEach(b=>{b[`d_${gi}`]=+(gV.filter(x=>x>=b.lo&&x<b.lo+bW).length/(N2*bW||1)).toFixed(6)})})
        return<div style={{flex:1,display:'flex',flexDirection:'column',minHeight:0}}>
          <div style={{fontSize:9,color:'rgba(200,230,200,.4)',marginBottom:2,flexShrink:0}}>Density "{v.name}" theo nhóm "{gv.name}"</div>
          <div style={{flex:1,minHeight:0}}><RC><ComposedChart data={bins}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)"/><XAxis dataKey="label" tick={tk}/><YAxis tick={tk}/><Tooltip contentStyle={ttS}/>{groups.map((g,gi)=><Area key={gi} type="monotone" dataKey={`d_${gi}`} name={catLabel(gv,g)} stroke={DC[gi%DC.length]} fill={DC[gi%DC.length]} fillOpacity={.15} strokeWidth={2}/>)}<Legend wrapperStyle={{fontSize:9}}/></ComposedChart></RC></div></div>
      }
      // Single histogram with normal curve
      const vals=clean(project.rows.map(r=>r[v.id])); if(vals.length<2)return d1()
      const mn=Math.min(...vals),mx=Math.max(...vals),nB=Math.min(Math.ceil(Math.sqrt(vals.length)),20),bW=(mx-mn)/nB||1,N=vals.length
      const bins=Array.from({length:nB},(_,i)=>{const lo2=mn+i*bW;return{label:`${lo2.toFixed(1)}`,lo:lo2,count:0}})
      vals.forEach(v2=>{bins[Math.min(Math.floor((v2-mn)/bW),nB-1)].count++})
      const isD=histMode==='density'; if(isD)bins.forEach(b=>{b.density=+(b.count/(N*bW)).toFixed(6)})
      const mu=vals.reduce((s,v2)=>s+v2,0)/N,sig=Math.sqrt(vals.reduce((s,v2)=>s+(v2-mu)**2,0)/(N-1))
      if(isD&&sig>0)bins.forEach(b=>{const mid=b.lo+bW/2;b.normal=+(1/(sig*Math.sqrt(2*Math.PI))*Math.exp(-0.5*((mid-mu)/sig)**2)).toFixed(6)})
      const sw=shapiroWilk(vals);const dKey=isD?'density':'count';const vc=gc(v.id,0)
      return<div style={{flex:1,display:'flex',flexDirection:'column',minHeight:0}}>
        <div style={{display:'flex',gap:4,alignItems:'center',marginBottom:2,flexShrink:0,flexWrap:'wrap'}}>
          <span onClick={()=>setHistMode('density')} style={{padding:'2px 6px',borderRadius:3,fontSize:8,cursor:'pointer',fontFamily:'Orbitron',background:isD?'rgba(0,250,154,.15)':'rgba(255,255,255,.04)',border:`1px solid ${isD?C.green:'rgba(255,255,255,.06)'}`,color:isD?C.green:'rgba(200,230,200,.3)'}}>DENSITY</span>
          <span onClick={()=>setHistMode('count')} style={{padding:'2px 6px',borderRadius:3,fontSize:8,cursor:'pointer',fontFamily:'Orbitron',background:!isD?'rgba(0,250,154,.15)':'rgba(255,255,255,.04)',border:`1px solid ${!isD?C.green:'rgba(255,255,255,.06)'}`,color:!isD?C.green:'rgba(200,230,200,.3)'}}>COUNT</span>
          <span style={{fontSize:8,color:'rgba(200,230,200,.4)'}}>N={N} μ={mu.toFixed(2)} σ={sig.toFixed(2)}</span>
          {sw&&<span style={{fontSize:8,color:sw.p>.05?C.green:C.pink}}>SW p={sw.p.toFixed(4)} {sw.p>.05?'✓Normal':'✗Non-normal'}</span>}
        </div>
        <div style={{flex:1,minHeight:0}}><RC><ComposedChart data={bins}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)"/><XAxis dataKey="label" tick={tk}/><YAxis tick={tk}/>
          <Tooltip contentStyle={ttS}/><Bar dataKey={dKey} fill={vc} fillOpacity={.6} stroke={vc} name={isD?'Density':'Count'}/>
          {isD&&sig>0&&<Line type="monotone" dataKey="normal" stroke={C.pink} strokeWidth={2} dot={false} name="Normal curve"/>}
        </ComposedChart></RC></div></div>
    }

    // ═══ BOX ═══
    if(ct==='box'){
      let boxData
      // Binned numeric as grouping + another numeric as values
      const binnedNum=selNums.find(v=>hasBin(v.id))
      if(binnedNum&&selNums.length>=2){
        const yv=selNums.find(v=>v.id!==binnedNum.id)||selNums[0]
        const cfg=binCfg[binnedNum.id]
        boxData=cfg.labels.map((lbl,i)=>{
          const rowsInGroup=project.rows.filter(r=>binValue(binnedNum.id,r[binnedNum.id])===lbl)
          const vals=[...clean(rowsInGroup.map(r=>r[yv.id]))].sort((a,b2)=>a-b2)
          if(vals.length<4)return null
          const q1=vals[Math.floor(vals.length*.25)],med=vals[Math.floor(vals.length*.5)],q3=vals[Math.floor(vals.length*.75)],iqr2=q3-q1
          return{name:`${lbl} (n=${vals.length})`,q1,med,q3,wL:Math.max(vals[0],q1-1.5*iqr2),wH:Math.min(vals[vals.length-1],q3+1.5*iqr2),color:DC[i%DC.length],n:vals.length}
        }).filter(Boolean)
      } else if(hasG&&hasN){
        boxData=groupedStats(gv,selNums[0]).filter(g=>g.vals.length>=4).map(g=>({...g,name:`${g.label} (n=${g.n})`}))
      } else {
        boxData=selNums.map((v,i)=>{const vals=[...clean(project.rows.map(r=>r[v.id]))].sort((a,b2)=>a-b2);if(vals.length<4)return null;const q1=vals[Math.floor(vals.length*.25)],med=vals[Math.floor(vals.length*.5)],q3=vals[Math.floor(vals.length*.75)],iqr2=q3-q1;return{name:v.name,q1,med,q3,wL:Math.max(vals[0],q1-1.5*iqr2),wH:Math.min(vals[vals.length-1],q3+1.5*iqr2),color:gc(v.id,i),n:vals.length}}).filter(Boolean)
      }
      if(!boxData||!boxData.length)return d1()
      return<div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:12,padding:6,overflow:'auto',flexWrap:'wrap'}}>
        {boxData.map((b,i)=><div key={i} style={{textAlign:'center'}}>
          <svg width={48} height={140} viewBox="0 0 48 140">{(()=>{const lo=b.wL,hi=b.wH,rng=hi-lo||1,y=v2=>120-((v2-lo)/rng)*100+10,col=b.color||DC[i%DC.length]
            return<g><line x1={24} y1={y(b.wH)} x2={24} y2={y(b.q3)} stroke={col} strokeWidth={1.5}/><line x1={14} y1={y(b.wH)} x2={34} y2={y(b.wH)} stroke={col} strokeWidth={1.5}/><rect x={9} y={y(b.q3)} width={30} height={y(b.q1)-y(b.q3)} fill={`${col}22`} stroke={col} strokeWidth={1.5} rx={2}/><line x1={9} y1={y(b.med)} x2={39} y2={y(b.med)} stroke={col} strokeWidth={2.5}/><line x1={24} y1={y(b.q1)} x2={24} y2={y(b.wL)} stroke={col} strokeWidth={1.5}/><line x1={14} y1={y(b.wL)} x2={34} y2={y(b.wL)} stroke={col} strokeWidth={1.5}/><text x={24} y={7} textAnchor="middle" fill={col} fontSize={7}>{b.med.toFixed(1)}</text></g>})()}</svg>
          <div style={{fontSize:8,color:b.color||DC[i%DC.length],maxWidth:65,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{b.name}</div>
        </div>)}</div>
    }

    // ═══ SCATTER ═══
    if(ct==='scatter'){
      if(selNums.length<2)return<div style={{padding:16,color:'rgba(200,230,200,.3)',fontSize:11,textAlign:'center'}}>Chọn ≥2 biến số</div>
      const xv=selNums[0],yv=selNums[1]
      // Binned numeric → color-coded scatter by bin group
      const binnedNum=selNums.find(v=>hasBin(v.id)&&selNums.filter(v2=>v2.id!==v.id).length>=1)
      if(binnedNum){
        const otherNums=selNums.filter(v=>v.id!==binnedNum.id)
        const x2=otherNums[0]||xv,y2=otherNums[1]||yv
        const cfg=binCfg[binnedNum.id]
        return<RC><ScatterChart margin={{top:8,right:8,bottom:16,left:8}}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)"/>
          <XAxis dataKey="x" name={x2.name} tick={tk} label={{value:x2.name,position:'bottom',fill:'rgba(200,230,200,.5)',fontSize:8}}/><YAxis dataKey="y" name={y2.name} tick={tk}/><Tooltip contentStyle={ttS}/>
          {cfg.labels.map((lbl,gi)=>{const sD=project.rows.filter(r=>binValue(binnedNum.id,r[binnedNum.id])===lbl).map(r=>({x:Number(r[x2.id]),y:Number(r[y2.id])})).filter(d=>!isNaN(d.x)&&!isNaN(d.y))
            return<Scatter key={gi} data={sD} name={lbl} fill={DC[gi%DC.length]} fillOpacity={.7} r={4}/>})}
          <Legend wrapperStyle={{fontSize:9}}/></ScatterChart></RC>
      }
      if(gv){ // Color-coded scatter by group
        const groups=[...new Set(project.rows.map(r=>r[gv.id]).filter(x=>x!=null&&x!==''&&x!=='__NA__'))]
        return<RC><ScatterChart margin={{top:8,right:8,bottom:16,left:8}}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)"/>
          <XAxis dataKey="x" name={xv.name} tick={tk} label={{value:xv.name,position:'bottom',fill:'rgba(200,230,200,.5)',fontSize:8}}/><YAxis dataKey="y" name={yv.name} tick={tk}/><Tooltip contentStyle={ttS}/>
          {groups.map((g,gi)=>{const sD=project.rows.filter(r=>r[gv.id]===g).map(r=>({x:Number(r[xv.id]),y:Number(r[yv.id])})).filter(d=>!isNaN(d.x)&&!isNaN(d.y))
            return<Scatter key={gi} data={sD} name={catLabel(gv,g)} fill={DC[gi%DC.length]} fillOpacity={.7} r={4}/>})}
          <Legend wrapperStyle={{fontSize:9}}/></ScatterChart></RC>
      }
      const sD=cd.filter(d=>d[xv.id]!=null&&d[yv.id]!=null&&typeof d[xv.id]==='number').map(d=>({x:d[xv.id],y:d[yv.id]}))
      return<RC><ScatterChart margin={{top:8,right:8,bottom:16,left:8}}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)"/><XAxis dataKey="x" name={xv.name} tick={tk} label={{value:xv.name,position:'bottom',fill:'rgba(200,230,200,.5)',fontSize:8}}/><YAxis dataKey="y" name={yv.name} tick={tk}/><Tooltip contentStyle={ttS}/><Scatter data={sD} fill={gc(yv.id,1)} fillOpacity={.7} r={4}/></ScatterChart></RC>
    }

    // ═══ HEATMAP ═══ (numeric only)
    if(ct==='heatmap'){if(snv.length<2)return d1();const cm=snv.map(v1=>snv.map(v2=>v1.id===v2.id?1:pearsonR(project.rows.map(r=>r[v1.id]),project.rows.map(r=>r[v2.id])).r));const cs=Math.min(38,220/snv.length);return<div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',overflow:'auto'}}><div><div style={{display:'flex',marginLeft:cs+6}}>{snv.map((v,i)=><div key={i} style={{width:cs,fontSize:7,color:'rgba(200,230,200,.5)',textAlign:'center',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{v.name}</div>)}</div>{cm.map((row,i)=><div key={i} style={{display:'flex',alignItems:'center'}}><div style={{width:cs+6,fontSize:7,color:'rgba(200,230,200,.5)',textAlign:'right',paddingRight:3,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{snv[i].name}</div>{row.map((r,j)=>{const abs=Math.abs(r);return<div key={j} style={{width:cs,height:cs,display:'flex',alignItems:'center',justifyContent:'center',background:`hsla(${r>=0?154:340},80%,50%,${abs*.5})`,border:'1px solid rgba(255,255,255,.05)',fontSize:7,color:abs>.4?'#fff':'rgba(200,230,200,.4)'}}>{isNaN(r)?'—':r.toFixed(2)}</div>})}</div>)}</div></div>}

    // ═══ BAR ═══
    if(ct==='bar'){
      // Binned numeric → frequency bar
      const binnedNum=selNums.find(v=>hasBin(v.id))
      if(binnedNum&&!hasG){
        const data=binnedFreq(binnedNum.id)
        return<RC><BarChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)"/><XAxis dataKey="name" tick={tk}/><YAxis tick={tk}/><Tooltip contentStyle={ttS} formatter={(val,_,p)=>[`${val} (${p.payload.pct}%)`,'N']}/><Bar dataKey="count" name="N" fillOpacity={.7}>{data.map((d,i)=><Cell key={i} fill={d.fill}/>)}</Bar></BarChart></RC>
      }
      // Binned numeric as grouping variable + another numeric as Y
      if(binnedNum&&hasN&&selNums.length>=2){
        const yv=selNums.find(v=>v.id!==binnedNum.id)||selNums[0]
        const cfg=binCfg[binnedNum.id]
        const data=cfg.labels.map((lbl,i)=>{
          const rowsInGroup=project.rows.filter(r=>{const bLbl=binValue(binnedNum.id,r[binnedNum.id]);return bLbl===lbl})
          const vals=clean(rowsInGroup.map(r=>r[yv.id]))
          const m=vals.length?vals.reduce((s,v2)=>s+v2,0)/vals.length:0
          const sd=vals.length>1?Math.sqrt(vals.reduce((s,v2)=>s+(v2-m)**2,0)/(vals.length-1)):0
          return{name:lbl,mean:+m.toFixed(2),sd:+sd.toFixed(2),n:vals.length,fill:DC[i%DC.length]}
        })
        return<RC><BarChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)"/><XAxis dataKey="name" tick={tk}/><YAxis tick={tk}/><Tooltip contentStyle={ttS} formatter={(val,_,p)=>[`${val} ± ${p.payload.sd} (n=${p.payload.n})`,yv.name]}/><Bar dataKey="mean" name={yv.name} fillOpacity={.7}>{data.map((d,i)=><Cell key={i} fill={d.fill}/>)}</Bar></BarChart></RC>
      }
      if(hasG&&!hasN){ // Frequency bar
        const v=selCats[0];const ft=freqTable(project.rows.map(r=>r[v.id]).filter(x=>x!='__NA__'))
        const data=ft.map((f,i)=>({name:catLabel(v,f.value),count:f.n,pct:f.pct,fill:DC[i%DC.length]}))
        return<RC><BarChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)"/><XAxis dataKey="name" tick={tk}/><YAxis tick={tk}/><Tooltip contentStyle={ttS} formatter={(val,_,p)=>[`${val} (${p.payload.pct}%)`,'N']}/><Bar dataKey="count" name="N" fillOpacity={.7}>{data.map((d,i)=><Cell key={i} fill={d.fill}/>)}</Bar></BarChart></RC>
      }
      if(hasG&&hasN){ // Grouped mean±SD bar
        const gs=groupedStats(gv,selNums[0])
        return<RC><BarChart data={gs.map(g=>({name:g.label,mean:g.mean,sd:g.sd,n:g.n,fill:g.color}))}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)"/><XAxis dataKey="name" tick={tk}/><YAxis tick={tk}/><Tooltip contentStyle={ttS} formatter={(val,_,p)=>[`${val} ± ${p.payload.sd} (n=${p.payload.n})`,selNums[0].name]}/><Bar dataKey="mean" name={selNums[0].name} fillOpacity={.7}>{gs.map((g,i)=><Cell key={i} fill={g.color}/>)}</Bar></BarChart></RC>
      }
      if(!hasN)return<div style={{padding:16,color:'rgba(200,230,200,.3)',fontSize:11,textAlign:'center'}}>Chọn biến</div>
      // fall through to standard per-row
    }

    // ═══ LINE / AREA — binned numeric as X-axis ═══
    if((ct==='line'||ct==='area')){
      const binnedNum=selNums.find(v=>hasBin(v.id))
      // Binned numeric as X-axis grouping → mean of other numeric vars per bin
      if(binnedNum&&selNums.length>=2){
        const yVars=selNums.filter(v=>v.id!==binnedNum.id)
        const cfg=binCfg[binnedNum.id]
        const data=cfg.labels.map((lbl,i)=>{
          const rowsInGroup=project.rows.filter(r=>binValue(binnedNum.id,r[binnedNum.id])===lbl)
          const d={name:lbl}
          yVars.forEach(yv=>{const vals=clean(rowsInGroup.map(r=>r[yv.id]));d[yv.id]=vals.length?(vals.reduce((s,v2)=>s+v2,0)/vals.length):null})
          return d
        })
        return<RC><ComposedChart data={data} margin={{top:5,right:5,bottom:5,left:5}}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)"/><XAxis dataKey="name" tick={tk}/><YAxis tick={tk}/><Tooltip contentStyle={ttS}/><Legend wrapperStyle={{fontSize:9}}/>
          {yVars.map((v,i)=>{const vc=gc(v.id,i);return ct==='line'?<Line key={v.id} dataKey={v.id} name={v.name} stroke={vc} strokeWidth={2} dot={{r:3,fill:vc}} connectNulls/>:<Area key={v.id} dataKey={v.id} name={v.name} stroke={vc} fill={vc} fillOpacity={.12} strokeWidth={2} dot={{r:2,fill:vc}} connectNulls/>})}
        </ComposedChart></RC>
      }
      // Binned numeric alone → frequency line/area
      if(binnedNum&&!hasG&&selNums.length===1){
        const data=binnedFreq(binnedNum.id)
        return<RC><ComposedChart data={data} margin={{top:5,right:5,bottom:5,left:5}}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)"/><XAxis dataKey="name" tick={tk}/><YAxis tick={tk}/><Tooltip contentStyle={ttS} formatter={(val,_,p)=>[`${val} (${p.payload.pct}%)`,'N']}/>
          {ct==='line'?<Line dataKey="count" name="N" stroke={C.green} strokeWidth={2} dot={{r:3,fill:C.green}}/>:<Area dataKey="count" name="N" stroke={C.green} fill={C.green} fillOpacity={.12} strokeWidth={2} dot={{r:2,fill:C.green}}/>}
        </ComposedChart></RC>
      }
    }

    // ═══ LINE / AREA with categorical grouping ═══
    if((ct==='line'||ct==='area')&&hasG){
      if(hasN){ // Mean per group
        const groups=[...new Set(project.rows.map(r=>r[gv.id]).filter(x=>x!=null&&x!==''&&x!=='__NA__'))]
        const data=groups.map(g=>{const d={name:catLabel(gv,g)};selNums.forEach(nVar=>{const vals=clean(project.rows.filter(r=>r[gv.id]===g).map(r=>r[nVar.id]));d[nVar.id]=vals.length?(vals.reduce((s,v2)=>s+v2,0)/vals.length):null});return d})
        return<RC><ComposedChart data={data} margin={{top:5,right:5,bottom:5,left:5}}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)"/><XAxis dataKey="name" tick={tk}/><YAxis tick={tk}/><Tooltip contentStyle={ttS}/><Legend wrapperStyle={{fontSize:9}}/>
          {selNums.map((v,i)=>{const vc=gc(v.id,i);return ct==='line'?<Line key={v.id} dataKey={v.id} name={v.name} stroke={vc} strokeWidth={2} dot={{r:3,fill:vc}} connectNulls/>:<Area key={v.id} dataKey={v.id} name={v.name} stroke={vc} fill={vc} fillOpacity={.12} strokeWidth={2} dot={{r:2,fill:vc}} connectNulls/>})}
        </ComposedChart></RC>
      } else { // Frequency line/area for categorical only
        const ft=freqTable(project.rows.map(r=>r[gv.id]).filter(x=>x!='__NA__'))
        const data=ft.map(f=>({name:catLabel(gv,f.value),count:f.n}))
        return<RC><ComposedChart data={data} margin={{top:5,right:5,bottom:5,left:5}}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)"/><XAxis dataKey="name" tick={tk}/><YAxis tick={tk}/><Tooltip contentStyle={ttS}/>
          {ct==='line'?<Line dataKey="count" name="N" stroke={C.green} strokeWidth={2} dot={{r:3,fill:C.green}}/>:<Area dataKey="count" name="N" stroke={C.green} fill={C.green} fillOpacity={.12} strokeWidth={2} dot={{r:2,fill:C.green}}/>}
        </ComposedChart></RC>
      }
    }

    // ═══ Standard AREA / LINE / BAR (numeric per-row) ═══
    if(!snv.length)return d1()
    const useMA=needMA&&snv.length>1,actV=aav&&snv.find(v=>v.id===aav)?aav:snv[0]?.id
    return<RC><ComposedChart data={cd} margin={{top:5,right:5,bottom:5,left:5}}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)"/><XAxis dataKey="_idx" tick={tk}/>
      {useMA?snv.map((v,i)=>{const r=vr[v.id];return<YAxis key={v.id} yAxisId={v.id} domain={r?[Math.floor(r.min*.95),Math.ceil(r.max*1.05)]:['auto','auto']} hide={v.id!==actV} orientation={i%2===0?'left':'right'} tick={{fill:gc(v.id,i),fontSize:9}} axisLine={{stroke:gc(v.id,i)}}/>}):<YAxis yAxisId="s" tick={tk}/>}
      <Tooltip contentStyle={ttS} formatter={(val,name)=>[typeof val==='number'?val.toFixed(2):val,name]}/><Legend onClick={e=>{const vid=snv.find(v=>v.name===e.value)?.id;if(vid)setAAV(vid)}} wrapperStyle={{cursor:'pointer',fontSize:9}}/>
      {snv.map((v,i)=>{const vc=gc(v.id,i),yId=useMA?v.id:'s';return ct==='bar'?<Bar key={v.id} dataKey={v.id} name={v.name} fill={vc} fillOpacity={.7} yAxisId={yId}/>:ct==='line'?<Line key={v.id} dataKey={v.id} name={v.name} stroke={vc} strokeWidth={2} dot={{r:2,fill:vc}} yAxisId={yId} connectNulls/>:<Area key={v.id} dataKey={v.id} name={v.name} stroke={vc} fill={vc} fillOpacity={.12} strokeWidth={2} dot={{r:1.5,fill:vc}} yAxisId={yId} connectNulls/>})}
    </ComposedChart></RC>
  }

  // ─── Stats ────
  const renderStats=()=><div style={{overflow:'auto',flex:1,padding:4}}>{nv.length===0&&<div style={{color:'rgba(200,230,200,.3)',padding:16}}>Chưa có biến số</div>}
    {nv.map(v=>{const d=descriptive(project.rows.map(r=>r[v.id]));if(!d)return null;const sw=shapiroWilk(clean(project.rows.map(r=>r[v.id])));return<div key={v.id} style={{marginBottom:10,padding:6,background:'rgba(255,255,255,.02)',border:'1px solid rgba(255,255,255,.06)',borderRadius:4}}><div style={{fontSize:10,color:C.blue,fontWeight:600,marginBottom:4}}>{v.name}</div><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(80px,1fr))',gap:3}}><Pill label="N" value={d.n} color={C.blue}/><Pill label="MEAN" value={d.mean} color={C.green}/><Pill label="SD" value={d.std} color={C.cyan}/><Pill label="MEDIAN" value={d.median} color={C.purple}/><Pill label="SKEW" value={d.skew} color={Math.abs(d.skew)>1?C.pink:C.green}/>{sw&&<Pill label="SW p" value={sw.p.toFixed(4)} color={sw.p>.05?C.green:C.pink}/>}<Pill label="NORMAL" value={d.normal?'Yes':'No'} color={d.normal?C.green:C.pink}/></div></div>})}
    {cv.map(v=>{const ft=freqTable(project.rows.map(r=>r[v.id]).filter(x=>x!='__NA__'));return<div key={v.id} style={{marginBottom:10,padding:6,background:'rgba(255,255,255,.02)',border:'1px solid rgba(255,255,255,.06)',borderRadius:4}}><div style={{fontSize:10,color:C.purple,fontWeight:600,marginBottom:4}}>{v.name}</div><div style={{display:'flex',flexWrap:'wrap',gap:3}}>{ft.map(f=><Pill key={f.value} label={f.value} value={`${f.n} (${f.pct}%)`} color={C.purple}/>)}</div></div>})}
    {bv.map(v=>{const ft=freqTable(project.rows.map(r=>r[v.id]).filter(x=>x!='__NA__'));return<div key={v.id} style={{marginBottom:10,padding:6,background:'rgba(255,255,255,.02)',border:'1px solid rgba(255,255,255,.06)',borderRadius:4}}><div style={{fontSize:10,color:C.orange,fontWeight:600,marginBottom:4}}>{v.name} (binary)</div><div style={{display:'flex',flexWrap:'wrap',gap:3}}>{ft.map(f=><Pill key={f.value} label={f.value==='1'||f.value===1?'Có':'Không'} value={`${f.n} (${f.pct}%)`} color={C.orange}/>)}</div></div>})}</div>

  // ─── Corr ────
  const renderCorr=()=>{if(nv.length<2)return d1();return<div style={{overflow:'auto',flex:1,padding:4}}><table style={{borderCollapse:'collapse',fontSize:10,width:'100%'}}><thead><tr><th style={{padding:'4px 6px',textAlign:'left',fontSize:9,borderBottom:'1px solid rgba(191,95,255,.2)',color:'rgba(200,230,200,.5)'}}></th>{nv.map(v=><th key={v.id} style={{padding:'4px 6px',textAlign:'left',fontSize:9,borderBottom:'1px solid rgba(191,95,255,.2)',color:C.purple}}>{v.name}</th>)}</tr></thead>
    <tbody>{nv.map(v1=><tr key={v1.id}><td style={{padding:'3px 6px',fontSize:10,borderBottom:'1px solid rgba(191,95,255,.05)',color:C.purple,fontWeight:600}}>{v1.name}</td>{nv.map(v2=>{if(v1.id===v2.id)return<td key={v2.id} style={{padding:'3px 6px',fontSize:10,borderBottom:'1px solid rgba(191,95,255,.05)',color:C.green,fontWeight:700}}>1.00</td>;const fn=isNormal(project.rows.map(r=>r[v1.id]))?pearsonR:spearmanR;const res=fn(project.rows.map(r=>r[v1.id]),project.rows.map(r=>r[v2.id]));const abs=Math.abs(res.r);return<td key={v2.id} style={{padding:'3px 6px',fontSize:10,borderBottom:'1px solid rgba(191,95,255,.05)',color:abs>.7?C.green:abs>.4?C.gold:'rgba(200,230,200,.5)',fontWeight:abs>.7?700:400}}>{isNaN(res.r)?'—':res.r.toFixed(3)}{res.p<.05&&'*'}</td>})}</tr>)}</tbody></table></div>}

  // ─── Model ────
  const renderModel=()=><div style={{overflow:'auto',flex:1,padding:4}}>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom:8}}><div><label style={{fontSize:8,color:C.orange,fontFamily:'Orbitron',display:'block',marginBottom:2}}>Y</label><select value={mdv} onChange={e=>setMdv(e.target.value)} style={{fontSize:11}}><option value="">—</option>{aov.map(v=><option key={v.id} value={v.id}>{v.name} [{v.type}]</option>)}</select></div><div><label style={{fontSize:8,color:C.orange,fontFamily:'Orbitron',display:'block',marginBottom:2}}>Nhóm</label><select value={mgv} onChange={e=>setMgv(e.target.value)} style={{fontSize:11}}><option value="">—</option>{cv.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select></div></div>
    <div style={{marginBottom:8}}><label style={{fontSize:8,color:C.orange,fontFamily:'Orbitron',display:'block',marginBottom:2}}>X</label><div style={{display:'flex',flexWrap:'wrap',gap:3}}>{cnv.filter(v=>v.id!==mdv).map(v=><span key={v.id} onClick={()=>setMiv(p=>{const n=new Set(p);n.has(v.id)?n.delete(v.id):n.add(v.id);return n})} style={{padding:'2px 7px',borderRadius:3,fontSize:9,cursor:'pointer',background:miv.has(v.id)?'rgba(255,107,53,.18)':'rgba(255,255,255,.04)',border:`1px solid ${miv.has(v.id)?C.orange:'rgba(255,255,255,.08)'}`,color:miv.has(v.id)?C.orange:'rgba(200,230,200,.4)'}}>{v.name}</span>)}</div></div>
    {mr?<div style={{padding:8,background:'rgba(255,107,53,.04)',border:`1px solid ${C.orange}30`,borderRadius:5}}><div style={{fontFamily:'Orbitron',fontSize:8,color:C.orange,letterSpacing:'2px',marginBottom:6}}>◎ {mr.type==='logistic'?'LOGISTIC':mr.type==='linear'?'LINEAR':mr.type==='ttest'?"T-TEST":mr.type==='mw'?'MANN-WHITNEY':'ANOVA'}</div><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(90px,1fr))',gap:4}}>
      {mr.type==='logistic'&&<><Pill label="OR" value={mr.result.or} color={C.orange}/><Pill label="ACC" value={`${mr.result.accuracy}%`} color={C.green}/><Pill label="SENS" value={`${mr.result.sensitivity}%`} color={C.blue}/><Pill label="SPEC" value={`${mr.result.specificity}%`} color={C.purple}/></>}
      {mr.type==='linear'&&<><Pill label="β" value={mr.result.slope} color={C.blue}/><Pill label="R²" value={mr.result.r2} color={C.green}/><Pill label="RMSE" value={mr.result.rmse} color={C.orange}/><Pill label="P" value={mr.result.interpretation} color={mr.result.significant?C.green:C.pink}/></>}
      {mr.type==='ttest'&&<><Pill label="T" value={mr.result.t} color={C.pink}/><Pill label="P" value={mr.result.interpretation} color={mr.result.significant?C.green:C.pink}/><Pill label="M1" value={mr.result.mean1}/><Pill label="M2" value={mr.result.mean2}/><Pill label="Cohen d" value={mr.result.cohend} color={C.gold}/></>}
      {mr.type==='mw'&&<><Pill label="U" value={mr.result.U} color={C.pink}/><Pill label="P" value={mr.result.interpretation} color={mr.result.significant?C.green:C.pink}/></>}
      {mr.type==='anova'&&<><Pill label="F" value={mr.result.F} color={C.orange}/><Pill label="P" value={mr.result.interpretation} color={mr.result.significant?C.green:C.pink}/><Pill label="η²" value={mr.result.eta2} color={C.gold}/></>}
    </div></div>:<div style={{padding:14,color:'rgba(200,230,200,.2)',fontSize:11,textAlign:'center'}}>{mdv?'Chọn X':'Chọn Y và X'}</div>}</div>

  // ─── Advisor ────
  const renderAdvisor=()=>{const adv=suggestModels(sv,project.rows);const models=adv.models||adv;const gw=adv.globalWarns||[];return<div style={{overflow:'auto',flex:1,padding:4}}>
    {gw.length>0&&<div style={{marginBottom:8,padding:6,background:'rgba(255,45,120,.06)',border:`1px solid ${C.pink}30`,borderRadius:4}}><div style={{fontFamily:'Orbitron',fontSize:7,color:C.pink,letterSpacing:'2px',marginBottom:3}}>⚠ CẢNH BÁO</div>{gw.map((w,i)=><div key={i} style={{fontSize:10,color:C.pink}}>• {w}</div>)}</div>}
    {(Array.isArray(models)?models:[]).map((m,i)=><div key={i} style={{marginBottom:10,padding:8,background:`rgba(${hx(m.color)},.04)`,border:`1px solid ${m.color}22`,borderRadius:5}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}><span style={{fontFamily:'Orbitron',fontSize:10,color:m.color,fontWeight:700}}>{m.name}</span><div style={{display:'flex',alignItems:'center',gap:3}}><div style={{width:36,height:3,background:'rgba(255,255,255,.08)',borderRadius:2,overflow:'hidden'}}><div style={{width:`${m.confidence}%`,height:'100%',background:m.color}}/></div><span style={{fontSize:8,color:m.color,fontFamily:'Orbitron'}}>{m.confidence}%</span></div></div>
      <div style={{fontSize:10,color:'rgba(200,230,200,.55)',marginBottom:4,lineHeight:1.4}}>{m.rationale}</div>
      {m.assumptions?.map((a,j)=><div key={j} style={{fontSize:9,color:a.ok?'rgba(0,250,154,.6)':'rgba(255,45,120,.6)',display:'flex',gap:3}}><span>{a.ok?'✓':'✗'}</span><span>{a.text}</span></div>)}
      <div style={{display:'flex',flexWrap:'wrap',gap:2,marginTop:3}}>{m.outputs?.map((o,j)=><span key={j} style={{fontSize:8,padding:'1px 5px',borderRadius:2,background:`rgba(${hx(m.color)},.08)`,color:m.color}}>{o}</span>)}</div>
      {m.nextSteps?.length>0&&<div style={{marginTop:3}}>{m.nextSteps.map((s,j)=><div key={j} style={{fontSize:9,color:'rgba(200,230,200,.35)'}}>→ {s}</div>)}</div>}
      <div style={{marginTop:4}}><span onClick={()=>onAdvisorSelect(m.name)} style={{padding:'2px 8px',borderRadius:3,fontSize:8,cursor:'pointer',fontFamily:'Orbitron',background:`rgba(${hx(m.color)},.12)`,border:`1px solid ${m.color}40`,color:m.color}}>▶ Chạy</span></div>
    </div>)}</div>}

  // ═══ MAIN RENDER ═══
  return<div style={{height:'100%',display:'flex',flexDirection:'column',overflow:'hidden',padding:5}}>
    <div style={{display:'flex',gap:3,marginBottom:3,alignItems:'center',flexShrink:0}}>{TABS.map(t=><span key={t.id} onClick={()=>setTab(t.id)} style={{padding:'3px 7px',borderRadius:3,fontSize:8,cursor:'pointer',fontFamily:'Orbitron',letterSpacing:'1px',background:tab===t.id?`rgba(${hx(t.color)},.15)`:'transparent',border:`1px solid ${tab===t.id?t.color:'rgba(255,255,255,.06)'}`,color:tab===t.id?t.color:'rgba(200,230,200,.35)'}}>{t.icon} {t.label}</span>)}<div style={{flex:1}}/><Btn small onClick={()=>exportStatsCSV(project)} color={C.gold}>↓CSV</Btn></div>
    {tab==='chart'&&<><div style={{display:'flex',gap:2,marginBottom:2,flexShrink:0,flexWrap:'wrap'}}>{CTS.map(c2=><span key={c2.id} onClick={()=>setCt(c2.id)} title={c2.tip} style={{padding:'2px 5px',borderRadius:3,fontSize:7,cursor:'pointer',fontFamily:'Orbitron',letterSpacing:'.5px',background:ct===c2.id?'rgba(0,250,154,.15)':'rgba(255,255,255,.04)',border:`1px solid ${ct===c2.id?C.green:'rgba(255,255,255,.06)'}`,color:ct===c2.id?C.green:'rgba(200,230,200,.3)',whiteSpace:'nowrap'}}>{c2.label}</span>)}</div>
      <div style={{display:'flex',flexWrap:'wrap',gap:2,marginBottom:2,flexShrink:0}}>{chV.filter(v=>v.type!=='image').map((v,vi)=>{const is=selVars.has(v.id),vc=gc(v.id,vi),isNum=isNumType(v.type),binned=hasBin(v.id);return<span key={v.id} style={{display:'inline-flex',alignItems:'center',gap:2,position:'relative'}}>
        <span onClick={()=>togV(v.id)} style={{padding:'1px 5px',borderRadius:3,fontSize:9,cursor:'pointer',background:is?`${vc}22`:'rgba(255,255,255,.04)',border:`1px solid ${is?vc:'rgba(255,255,255,.06)'}`,color:is?vc:'rgba(200,230,200,.3)'}}>{v.name}{binned&&<span style={{color:C.gold,marginLeft:2,fontSize:7}}>✂</span>}</span>
        {is&&<span onClick={()=>setSCF(scf===v.id?null:v.id)} style={{width:9,height:9,borderRadius:'50%',background:vc,cursor:'pointer',flexShrink:0}}/>}
        {is&&isNum&&<span onClick={()=>{setBinEditor(binEditor===v.id?null:v.id);setBinInput(binCfg[v.id]?.breaks?.join(', ')||'')}} title="Gộp nhóm giá trị" style={{fontSize:8,cursor:'pointer',color:binned?C.gold:'rgba(200,230,200,.25)',padding:'0 2px'}}>✂</span>}
        {scf===v.id&&<div style={{position:'absolute',top:'100%',left:0,zIndex:100,background:'#0D0D1F',border:'1px solid rgba(0,250,154,.3)',borderRadius:4,padding:3,display:'flex',flexWrap:'wrap',gap:2,width:100,marginTop:1}}>{DC.map(c2=><span key={c2} onClick={()=>{setCC(p=>({...p,[v.id]:c2}));setSCF(null)}} style={{width:14,height:14,borderRadius:'50%',background:c2,cursor:'pointer',outline:cc[v.id]===c2?'2px solid #fff':'none'}}/>)}</div>}
        {/* Bin editor popup */}
        {binEditor===v.id&&<div onClick={e=>e.stopPropagation()} style={{position:'absolute',top:'100%',left:0,zIndex:200,background:'#0D0D1F',border:`1px solid ${C.gold}50`,borderRadius:5,padding:8,width:220,marginTop:2,boxShadow:'0 4px 16px rgba(0,0,0,.5)'}}>
          <div style={{fontSize:9,color:C.gold,fontFamily:'Orbitron',marginBottom:6}}>✂ GỘP NHÓM: {v.name}</div>
          <div style={{display:'flex',gap:3,marginBottom:6}}>
            {['equal','quartile','custom'].map(m=><span key={m} onClick={()=>{setBinMode(m);if(m!=='custom')applyAutoBin(v.id,m)}} style={{padding:'2px 6px',fontSize:8,borderRadius:3,cursor:'pointer',background:binMode===m?'rgba(255,215,0,.15)':'rgba(255,255,255,.04)',border:`1px solid ${binMode===m?C.gold:'rgba(255,255,255,.06)'}`,color:binMode===m?C.gold:'rgba(200,230,200,.3)'}}>
              {m==='equal'?'Đều':m==='quartile'?'Tứ phân':'Tùy chỉnh'}
            </span>)}
          </div>
          <div style={{marginBottom:6}}>
            <input value={binInput} onChange={e=>setBinInput(e.target.value)} placeholder="vd: 30, 60, 90" style={{fontSize:11,padding:'4px 8px'}}
              onKeyDown={e=>{if(e.key==='Enter'){applyCustomBin(v.id);setBinEditor(null)}if(e.key==='Escape')setBinEditor(null)}}/>
            <div style={{fontSize:8,color:'rgba(200,230,200,.25)',marginTop:2}}>Nhập điểm cắt, phân cách bằng dấu phẩy</div>
          </div>
          {binCfg[v.id]&&<div style={{fontSize:8,color:'rgba(200,230,200,.4)',marginBottom:4}}>
            Nhóm: {binCfg[v.id].labels.join(' | ')}
          </div>}
          <div style={{display:'flex',gap:4}}>
            <span onClick={()=>{applyCustomBin(v.id);setBinEditor(null)}} style={{padding:'2px 8px',fontSize:8,borderRadius:3,cursor:'pointer',background:'rgba(255,215,0,.12)',border:`1px solid ${C.gold}50`,color:C.gold}}>Áp dụng ↵</span>
            {binCfg[v.id]&&<span onClick={()=>{clearBin(v.id);setBinEditor(null);setBinInput('')}} style={{padding:'2px 8px',fontSize:8,borderRadius:3,cursor:'pointer',background:'rgba(255,45,120,.08)',border:'1px solid rgba(255,45,120,.3)',color:C.pink}}>Xóa nhóm</span>}
            <span onClick={()=>setBinEditor(null)} style={{padding:'2px 6px',fontSize:8,borderRadius:3,cursor:'pointer',color:'rgba(200,230,200,.3)'}}>Esc</span>
          </div>
        </div>}
      </span>})}</div>
      {needMA&&snv.length>1&&<div style={{fontSize:8,color:C.gold,marginBottom:1,flexShrink:0,opacity:.7}}>⚡ Multi-axis — click legend</div>}</>}
    <div style={{flex:1,minHeight:0,overflow:'hidden',display:'flex',flexDirection:'column'}}>{tab==='chart'&&renderChart()}{tab==='stats'&&renderStats()}{tab==='corr'&&renderCorr()}{tab==='model'&&renderModel()}{tab==='advisor'&&renderAdvisor()}</div>
  </div>
}
