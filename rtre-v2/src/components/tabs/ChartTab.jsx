import { useState, useMemo, useEffect } from 'react'
import { AreaChart, Area, BarChart, Bar, ScatterChart, Scatter, LineChart, Line,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ComposedChart } from 'recharts'
import { Btn, Pill } from '../ui/index.jsx'
import { C, CHART_COLORS } from '../../theme.js'
import { isNumType } from './InputTab.jsx'
import { descriptive, freqTable, pearsonR, spearmanR, welchTTest, mannWhitneyU,
  linearRegression, logisticRegression, chiSquare, oneWayAnova, clean, isNormal } from '../../utils/statistics.js'
import { suggestModels } from '../../utils/modelAdvisor.js'
import { exportStatsCSV } from '../../utils/export.js'

const CHART_TYPES = [
  { id:'area',label:'AREA',tip:'Biểu đồ vùng — xu hướng thay đổi, nhấn mạnh khối lượng tích lũy'},
  { id:'line',label:'LINE',tip:'Biểu đồ đường — xu hướng liên tục, so sánh nhiều biến'},
  { id:'bar',label:'BAR',tip:'Biểu đồ cột — so sánh giá trị giữa các nhóm'},
  { id:'scatter',label:'SCATTER',tip:'Phân tán — tương quan giữa 2 biến số (X vs Y)'},
  { id:'pie',label:'PIE',tip:'Biểu đồ tròn — tỷ lệ phân bố biến phân loại'},
  { id:'hist',label:'HISTOGRAM',tip:'Phân phối — đánh giá normality của biến số'},
  { id:'box',label:'BOX',tip:'Box plot — median, Q1/Q3, IQR, so sánh phân phối'},
  { id:'heatmap',label:'HEATMAP',tip:'Ma trận tương quan — phát hiện cặp biến correlate mạnh'},
]
const DCOLORS = [...CHART_COLORS]
const TABS = [{id:'chart',label:'Chart',icon:'●',color:C.green},{id:'stats',label:'Stats',icon:'Σ',color:C.blue},{id:'corr',label:'Corr',icon:'◎',color:C.purple},{id:'model',label:'Model',icon:'⊕',color:C.orange},{id:'advisor',label:'Advisor',icon:'◆',color:C.gold}]

export function ChartTab({ project, advisorModel, onAdvisorSelect }) {
  const [tab, setTab] = useState('chart')
  const [chartType, setChartType] = useState('area')
  const [selVars, setSelVars] = useState(new Set())
  const [chartColors, setChartColors] = useState({})
  const [showColorFor, setShowColorFor] = useState(null)
  const [activeAxisVar, setActiveAxisVar] = useState(null)
  const [modelDepVar, setModelDepVar] = useState('')
  const [modelIndVars, setModelIndVars] = useState(new Set())
  const [modelGroupVar, setModelGroupVar] = useState('')

  const sortedVars = useMemo(()=>[...project.variables].sort((a,b)=>(a.order??0)-(b.order??0)),[project.variables])
  const numVars = useMemo(()=>sortedVars.filter(v=>isNumType(v.type)),[sortedVars])
  const catVars = useMemo(()=>sortedVars.filter(v=>v.type==='categorical'),[sortedVars])
  const binVars = useMemo(()=>sortedVars.filter(v=>v.type==='binary'),[sortedVars])
  const chartVars = useMemo(()=>sortedVars.filter(v=>v.type!=='image'),[sortedVars])
  const chartNumVars = useMemo(()=>chartVars.filter(v=>isNumType(v.type)),[chartVars])
  const toggleVar=vid=>setSelVars(p=>{const n=new Set(p);n.has(vid)?n.delete(vid):n.add(vid);return n})
  const getColor=(vid,idx)=>chartColors[vid]||DCOLORS[idx%DCOLORS.length]

  // Advisor → Model connection
  useEffect(()=>{
    if(!advisorModel)return
    setTab('model')
    // Auto-configure based on advisor model name
    const m = advisorModel
    if(/logistic/i.test(m)&&binVars.length>0) { setModelDepVar(binVars[0].id); setModelIndVars(new Set(numVars.slice(0,3).map(v=>v.id))) }
    else if(/linear|ols/i.test(m)&&numVars.length>=2) { setModelDepVar(numVars[0].id); setModelIndVars(new Set(numVars.slice(1,4).map(v=>v.id))) }
    else if(/t-test|mann|welch/i.test(m)&&numVars.length>0&&catVars.length>0) { setModelDepVar(numVars[0].id); setModelGroupVar(catVars[0].id) }
    else if(/anova|kruskal/i.test(m)&&numVars.length>0&&catVars.length>0) { setModelDepVar(numVars[0].id); setModelGroupVar(catVars[0].id) }
    else if(/chi|fisher/i.test(m)&&catVars.length>=2) { setModelDepVar(catVars[0].id) }
    else if(/pearson|spearman|corr/i.test(m)) { setTab('corr') }
    else if(/descriptive/i.test(m)) { setTab('stats') }
    onAdvisorSelect(null) // reset
  },[advisorModel])

  const selectedNumVars = useMemo(()=>chartNumVars.filter(v=>selVars.has(v.id)),[chartNumVars,selVars])
  const varRanges = useMemo(()=>{const r={};selectedNumVars.forEach(v=>{const vals=clean(project.rows.map(rr=>rr[v.id]));if(vals.length)r[v.id]={min:Math.min(...vals),max:Math.max(...vals),range:Math.max(...vals)-Math.min(...vals)}});return r},[selectedNumVars,project.rows])
  const needsIndependentAxes = useMemo(()=>{const rs=Object.values(varRanges);if(rs.length<=1)return false;return Math.max(...rs.map(r=>r.range||1))/Math.max(Math.min(...rs.map(r=>r.range||1)),0.001)>3},[varRanges])
  const chartData = useMemo(()=>project.rows.map((row,idx)=>{const d={_idx:idx+1};chartVars.forEach(v=>{d[v.id]=isNumType(v.type)&&row[v.id]!==undefined&&row[v.id]!==''?Number(row[v.id]):row[v.id]??''});return d}),[project.rows,chartVars])

  // Model result computation
  const allOutcomeVars = useMemo(()=>[...binVars,...numVars],[binVars,numVars])
  const modelDepV = useMemo(()=>allOutcomeVars.find(v=>v.id===modelDepVar),[allOutcomeVars,modelDepVar])
  const modelResult = useMemo(()=>{
    if(!modelDepV||modelIndVars.size===0&&!modelGroupVar)return null
    const indList=chartNumVars.filter(v=>modelIndVars.has(v.id)&&v.id!==modelDepV.id)
    if(modelGroupVar){
      const gv=catVars.find(v=>v.id===modelGroupVar)
      if(gv){const groups=[...new Set(project.rows.map(r=>r[gv.id]).filter(Boolean))]
        if(groups.length===2){const g1=project.rows.filter(r=>r[gv.id]===groups[0]).map(r=>r[modelDepV.id]),g2=project.rows.filter(r=>r[gv.id]===groups[1]).map(r=>r[modelDepV.id]);const norm=isNormal(g1)&&isNormal(g2)&&g1.length>=20&&g2.length>=20;const res=norm?welchTTest(g1,g2):mannWhitneyU(g1,g2);return res?{type:norm?'ttest':'mannwhitney',result:res,groups,groupVar:gv.name}:null}
        if(groups.length>=3){const gd=groups.map(g=>project.rows.filter(r=>r[gv.id]===g).map(r=>r[modelDepV.id]));const res=oneWayAnova(gd);return res?{type:'anova',result:res,groups}:null}}
    }
    if(indList.length===0)return null
    if(modelDepV.type==='binary'){const xv=indList[0];const res=logisticRegression(project.rows.map(r=>r[xv.id]),project.rows.map(r=>r[modelDepV.id]));return res?{type:'logistic',result:res,xName:xv.name}:null}
    const xv=indList[0];const res=linearRegression(project.rows.map(r=>r[xv.id]),project.rows.map(r=>r[modelDepV.id]));return res?{type:'linear',result:res,xName:xv.name}:null
  },[modelDepV,modelIndVars,modelGroupVar,project.rows,chartNumVars,catVars])

  const hx=hex=>{const h=(hex||'00FA9A').replace('#','');return`${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)}`}
  const thS={padding:'5px 8px',textAlign:'left',fontSize:11,borderBottom:'1px solid rgba(191,95,255,.2)',color:'rgba(200,230,200,.5)',fontWeight:400}
  const tdS={padding:'4px 8px',fontSize:12,borderBottom:'1px solid rgba(191,95,255,.05)'}

  // ─── CHART RENDER ─────────────────────────────────────────────────────────
  const renderChart=()=>{
    const sel=[...selVars];if(!sel.length)return<div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:'rgba(200,230,200,.2)',fontSize:13}}>Chọn biến để hiển thị</div>
    const sNV=selectedNumVars,sCat=chartVars.find(v=>selVars.has(v.id)&&v.type==='categorical')
    if(chartType==='pie'){const v=sCat||chartVars.find(v2=>selVars.has(v2.id));if(!v)return<div style={{padding:20,color:'rgba(200,230,200,.3)'}}>Chọn biến phân loại</div>;const ft=freqTable(project.rows.map(r=>r[v.id]));const data=ft.map((f,i)=>({name:f.value,value:f.n,fill:DCOLORS[i%DCOLORS.length]}));return<ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius="65%" label={({name})=>name} stroke="rgba(7,7,15,.8)" strokeWidth={2}>{data.map((d,i)=><Cell key={i} fill={d.fill}/>)}</Pie><Tooltip contentStyle={{background:'rgba(5,5,18,.96)',border:'1px solid rgba(0,250,154,.4)',borderRadius:4,fontSize:11}}/><Legend wrapperStyle={{fontSize:10}}/></PieChart></ResponsiveContainer>}
    if(chartType==='hist'){const v=sNV[0];if(!v)return<div style={{padding:20,color:'rgba(200,230,200,.3)'}}>Chọn biến số</div>;const vals=clean(project.rows.map(r=>r[v.id]));if(vals.length<2)return<div style={{padding:20,color:'rgba(200,230,200,.3)'}}>Cần ≥2 giá trị</div>;const mn=Math.min(...vals),mx=Math.max(...vals),nB=Math.min(Math.ceil(Math.sqrt(vals.length)),20),bW=(mx-mn)/nB||1;const bins=Array.from({length:nB},(_,i)=>({label:`${(mn+i*bW).toFixed(1)}`,count:0}));vals.forEach(v2=>{const idx=Math.min(Math.floor((v2-mn)/bW),nB-1);bins[idx].count++});const vc=getColor(v.id,0);return<ResponsiveContainer width="100%" height="100%"><BarChart data={bins}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)"/><XAxis dataKey="label" tick={{fill:'rgba(200,230,200,.4)',fontSize:9}}/><YAxis tick={{fill:'rgba(200,230,200,.4)',fontSize:9}}/><Tooltip contentStyle={{background:'rgba(5,5,18,.96)',border:'1px solid rgba(0,250,154,.4)',borderRadius:4,fontSize:11}}/><Bar dataKey="count" fill={vc} fillOpacity={.7} stroke={vc}/></BarChart></ResponsiveContainer>}
    if(chartType==='box'){const bd=sNV.map((v,i)=>{const vals=[...clean(project.rows.map(r=>r[v.id]))].sort((a,b)=>a-b);if(vals.length<4)return null;const q1=vals[Math.floor(vals.length*.25)],med=vals[Math.floor(vals.length*.5)],q3=vals[Math.floor(vals.length*.75)],iqr=q3-q1;return{name:v.name,q1,med,q3,wLo:Math.max(vals[0],q1-1.5*iqr),wHi:Math.min(vals[vals.length-1],q3+1.5*iqr),color:getColor(v.id,i)}}).filter(Boolean);if(!bd.length)return<div style={{padding:20,color:'rgba(200,230,200,.3)'}}>Cần ≥4 giá trị</div>;return<div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:20,padding:12}}>{bd.map((b,i)=><div key={i} style={{textAlign:'center'}}><svg width={55} height={180} viewBox="0 0 55 180">{(()=>{const lo=b.wLo,hi=b.wHi,rng=hi-lo||1,y=v=>160-((v-lo)/rng)*140+10;return<g><line x1={27} y1={y(b.wHi)} x2={27} y2={y(b.q3)} stroke={b.color} strokeWidth={1.5}/><line x1={17} y1={y(b.wHi)} x2={37} y2={y(b.wHi)} stroke={b.color} strokeWidth={1.5}/><rect x={12} y={y(b.q3)} width={30} height={y(b.q1)-y(b.q3)} fill={`${b.color}22`} stroke={b.color} strokeWidth={1.5} rx={2}/><line x1={12} y1={y(b.med)} x2={42} y2={y(b.med)} stroke={b.color} strokeWidth={2.5}/><line x1={27} y1={y(b.q1)} x2={27} y2={y(b.wLo)} stroke={b.color} strokeWidth={1.5}/><line x1={17} y1={y(b.wLo)} x2={37} y2={y(b.wLo)} stroke={b.color} strokeWidth={1.5}/></g>})()}</svg><div style={{fontSize:10,color:b.color,marginTop:2}}>{b.name}</div></div>)}</div>}
    if(chartType==='heatmap'){if(sNV.length<2)return<div style={{padding:20,color:'rgba(200,230,200,.3)'}}>Chọn ≥2 biến số</div>;const cm=sNV.map(v1=>sNV.map(v2=>v1.id===v2.id?1:pearsonR(project.rows.map(r=>r[v1.id]),project.rows.map(r=>r[v2.id])).r));const cs=Math.min(42,240/sNV.length);return<div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',overflow:'auto'}}><div><div style={{display:'flex',marginLeft:cs+8}}>{sNV.map((v,i)=><div key={i} style={{width:cs,fontSize:8,color:'rgba(200,230,200,.5)',textAlign:'center',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{v.name}</div>)}</div>{cm.map((row,i)=><div key={i} style={{display:'flex',alignItems:'center'}}><div style={{width:cs+8,fontSize:8,color:'rgba(200,230,200,.5)',textAlign:'right',paddingRight:4,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{sNV[i].name}</div>{row.map((r,j)=>{const abs=Math.abs(r);return<div key={j} style={{width:cs,height:cs,display:'flex',alignItems:'center',justifyContent:'center',background:`hsla(${r>=0?154:340},80%,50%,${abs*.5})`,border:'1px solid rgba(255,255,255,.05)',fontSize:8,color:abs>.4?'#fff':'rgba(200,230,200,.4)'}}>{isNaN(r)?'—':r.toFixed(2)}</div>})}</div>)}</div></div>}
    if(chartType==='scatter'){if(sNV.length<2)return<div style={{padding:20,color:'rgba(200,230,200,.3)'}}>Chọn ≥2 biến số</div>;const xv=sNV[0],yv=sNV[1];const sD=chartData.filter(d=>d[xv.id]!=null&&d[yv.id]!=null).map(d=>({x:d[xv.id],y:d[yv.id]}));return<ResponsiveContainer width="100%" height="100%"><ScatterChart margin={{top:10,right:10,bottom:20,left:10}}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)"/><XAxis dataKey="x" name={xv.name} tick={{fill:'rgba(200,230,200,.4)',fontSize:9}} label={{value:xv.name,position:'bottom',fill:'rgba(200,230,200,.5)',fontSize:9}}/><YAxis dataKey="y" name={yv.name} tick={{fill:'rgba(200,230,200,.4)',fontSize:9}}/><Tooltip contentStyle={{background:'rgba(5,5,18,.96)',border:'1px solid rgba(0,250,154,.4)',borderRadius:4,fontSize:11}}/><Scatter data={sD} fill={getColor(yv.id,1)} fillOpacity={.7} r={4}/></ScatterChart></ResponsiveContainer>}
    // Area/Line/Bar multi-axis
    if(!sNV.length)return<div style={{padding:20,color:'rgba(200,230,200,.3)'}}>Chọn biến số</div>
    const useMA=needsIndependentAxes&&sNV.length>1,actVar=activeAxisVar&&sNV.find(v=>v.id===activeAxisVar)?activeAxisVar:sNV[0]?.id
    return<ResponsiveContainer width="100%" height="100%"><ComposedChart data={chartData} margin={{top:5,right:5,bottom:5,left:5}}>
      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)"/><XAxis dataKey="_idx" tick={{fill:'rgba(200,230,200,.4)',fontSize:9}}/>
      {useMA?sNV.map((v,i)=>{const r=varRanges[v.id];return<YAxis key={v.id} yAxisId={v.id} domain={r?[Math.floor(r.min*.95),Math.ceil(r.max*1.05)]:['auto','auto']} hide={v.id!==actVar} orientation={i%2===0?'left':'right'} tick={{fill:getColor(v.id,i),fontSize:9}} axisLine={{stroke:getColor(v.id,i)}}/>})
      :<YAxis yAxisId="shared" tick={{fill:'rgba(200,230,200,.4)',fontSize:9}}/>}
      <Tooltip contentStyle={{background:'rgba(5,5,18,.96)',border:'1px solid rgba(0,250,154,.4)',borderRadius:4,fontSize:11}} formatter={(val,name)=>[typeof val==='number'?val.toFixed(2):val,name]}/>
      <Legend onClick={e=>{const vid=sNV.find(v=>v.name===e.value)?.id;if(vid)setActiveAxisVar(vid)}} wrapperStyle={{cursor:'pointer',fontSize:10}}/>
      {sNV.map((v,i)=>{const vc=getColor(v.id,i),yId=useMA?v.id:'shared';return chartType==='bar'?<Bar key={v.id} dataKey={v.id} name={v.name} fill={vc} fillOpacity={.7} yAxisId={yId}/>:chartType==='line'?<Line key={v.id} dataKey={v.id} name={v.name} stroke={vc} strokeWidth={2} dot={{r:2,fill:vc}} yAxisId={yId} connectNulls/>:<Area key={v.id} dataKey={v.id} name={v.name} stroke={vc} fill={vc} fillOpacity={.12} strokeWidth={2} dot={{r:2,fill:vc}} yAxisId={yId} connectNulls/>})}
    </ComposedChart></ResponsiveContainer>
  }

  // ─── STATS ────────────────────────────────────────────────────────────────
  const renderStats=()=><div style={{overflow:'auto',flex:1,padding:6}}>
    {numVars.length===0&&<div style={{color:'rgba(200,230,200,.3)',padding:20}}>Chưa có biến số</div>}
    {numVars.map(v=>{const d=descriptive(project.rows.map(r=>r[v.id]));if(!d)return null;return<div key={v.id} style={{marginBottom:12,padding:8,background:'rgba(255,255,255,.02)',border:'1px solid rgba(255,255,255,.06)',borderRadius:5}}>
      <div style={{fontSize:11,color:C.blue,fontWeight:600,marginBottom:6}}>{v.name}{v.codeName&&<span style={{fontSize:9,color:'rgba(200,230,200,.2)',marginLeft:4}}>({v.codeName})</span>}</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(90px,1fr))',gap:4}}><Pill label="N" value={d.n} color={C.blue}/><Pill label="MEAN" value={d.mean} color={C.green}/><Pill label="SD" value={d.std} color={C.cyan}/><Pill label="MEDIAN" value={d.median} color={C.purple}/><Pill label="MIN" value={d.min}/><Pill label="MAX" value={d.max}/><Pill label="SKEW" value={d.skew} color={Math.abs(d.skew)>1?C.pink:C.green}/><Pill label="NORMAL" value={d.normal?'Yes':'No'} color={d.normal?C.green:C.pink}/></div></div>})}
    {catVars.map(v=>{const ft=freqTable(project.rows.map(r=>r[v.id]));return<div key={v.id} style={{marginBottom:12,padding:8,background:'rgba(255,255,255,.02)',border:'1px solid rgba(255,255,255,.06)',borderRadius:5}}><div style={{fontSize:11,color:C.purple,fontWeight:600,marginBottom:6}}>{v.name}</div><div style={{display:'flex',flexWrap:'wrap',gap:4}}>{ft.map(f=><Pill key={f.value} label={f.value} value={`${f.n} (${f.pct}%)`} color={C.purple}/>)}</div></div>})}</div>

  // ─── CORR ─────────────────────────────────────────────────────────────────
  const renderCorr=()=>{if(numVars.length<2)return<div style={{padding:20,color:'rgba(200,230,200,.3)'}}>Cần ≥2 biến số</div>;return<div style={{overflow:'auto',flex:1,padding:6}}>
    <table style={{borderCollapse:'collapse',fontSize:11,width:'100%'}}><thead><tr><th style={thS}></th>{numVars.map(v=><th key={v.id} style={{...thS,color:C.purple}}>{v.name}</th>)}</tr></thead>
    <tbody>{numVars.map(v1=><tr key={v1.id}><td style={{...tdS,color:C.purple,fontWeight:600}}>{v1.name}</td>{numVars.map(v2=>{if(v1.id===v2.id)return<td key={v2.id} style={{...tdS,color:C.green,fontWeight:700}}>1.00</td>;const fn=isNormal(project.rows.map(r=>r[v1.id]))?pearsonR:spearmanR;const res=fn(project.rows.map(r=>r[v1.id]),project.rows.map(r=>r[v2.id]));const abs=Math.abs(res.r);return<td key={v2.id} style={{...tdS,color:abs>.7?C.green:abs>.4?C.gold:'rgba(200,230,200,.5)',fontWeight:abs>.7?700:400}}>{isNaN(res.r)?'—':res.r.toFixed(3)}{res.p<.05&&' *'}</td>})}</tr>)}</tbody></table></div>}

  // ─── MODEL ────────────────────────────────────────────────────────────────
  const renderModel=()=><div style={{overflow:'auto',flex:1,padding:6}}>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10}}>
      <div><label style={{fontSize:9,color:C.orange,fontFamily:'Orbitron',letterSpacing:'1px',display:'block',marginBottom:3}}>BIẾN PHỤ THUỘC (Y)</label><select value={modelDepVar} onChange={e=>setModelDepVar(e.target.value)} style={{fontSize:12}}><option value="">— Chọn —</option>{allOutcomeVars.map(v=><option key={v.id} value={v.id}>{v.name} [{v.type}]</option>)}</select></div>
      <div><label style={{fontSize:9,color:C.orange,fontFamily:'Orbitron',letterSpacing:'1px',display:'block',marginBottom:3}}>BIẾN NHÓM</label><select value={modelGroupVar} onChange={e=>setModelGroupVar(e.target.value)} style={{fontSize:12}}><option value="">— Không —</option>{catVars.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select></div></div>
    <div style={{marginBottom:10}}><label style={{fontSize:9,color:C.orange,fontFamily:'Orbitron',letterSpacing:'1px',display:'block',marginBottom:3}}>BIẾN ĐỘC LẬP (X)</label>
      <div style={{display:'flex',flexWrap:'wrap',gap:4}}>{chartNumVars.filter(v=>v.id!==modelDepVar).map(v=><span key={v.id} onClick={()=>setModelIndVars(p=>{const n=new Set(p);n.has(v.id)?n.delete(v.id):n.add(v.id);return n})} style={{padding:'3px 8px',borderRadius:4,fontSize:10,cursor:'pointer',background:modelIndVars.has(v.id)?'rgba(255,107,53,.18)':'rgba(255,255,255,.04)',border:`1px solid ${modelIndVars.has(v.id)?C.orange:'rgba(255,255,255,.1)'}`,color:modelIndVars.has(v.id)?C.orange:'rgba(200,230,200,.5)'}}>{v.name}</span>)}</div></div>
    {modelResult?<div style={{padding:10,background:'rgba(255,107,53,.04)',border:`1px solid ${C.orange}30`,borderRadius:6}}>
      <div style={{fontFamily:'Orbitron',fontSize:9,color:C.orange,letterSpacing:'2px',marginBottom:8}}>◎ {modelResult.type==='logistic'?'LOGISTIC':modelResult.type==='linear'?'LINEAR':modelResult.type==='ttest'?"WELCH'S T":modelResult.type==='mannwhitney'?'MANN-WHITNEY':modelResult.type==='anova'?'ONE-WAY ANOVA':'RESULT'}</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(100px,1fr))',gap:5}}>
        {modelResult.type==='logistic'&&<><Pill label="OR" value={modelResult.result.or} color={C.orange}/><Pill label="ACC" value={`${modelResult.result.accuracy}%`} color={C.green}/><Pill label="SENS" value={`${modelResult.result.sensitivity}%`} color={C.blue}/><Pill label="SPEC" value={`${modelResult.result.specificity}%`} color={C.purple}/><Pill label="McFadden" value={modelResult.result.mcFaddenR2} color={C.gold}/></>}
        {modelResult.type==='linear'&&<><Pill label="β" value={modelResult.result.slope} color={C.blue}/><Pill label="R²" value={modelResult.result.r2} color={C.green}/><Pill label="RMSE" value={modelResult.result.rmse} color={C.orange}/><Pill label="P" value={modelResult.result.interpretation} color={modelResult.result.significant?C.green:C.pink}/></>}
        {modelResult.type==='ttest'&&<><Pill label="T" value={modelResult.result.t} color={C.pink}/><Pill label="DF" value={modelResult.result.df} color={C.blue}/><Pill label="P" value={modelResult.result.interpretation} color={modelResult.result.significant?C.green:C.pink}/><Pill label="M1" value={modelResult.result.mean1} color={C.cyan}/><Pill label="M2" value={modelResult.result.mean2} color={C.orange}/></>}
        {modelResult.type==='mannwhitney'&&<><Pill label="U" value={modelResult.result.U} color={C.pink}/><Pill label="Z" value={modelResult.result.z} color={C.blue}/><Pill label="P" value={modelResult.result.interpretation} color={modelResult.result.significant?C.green:C.pink}/></>}
        {modelResult.type==='anova'&&<><Pill label="F" value={modelResult.result.F} color={C.orange}/><Pill label="P" value={modelResult.result.interpretation} color={modelResult.result.significant?C.green:C.pink}/><Pill label="η²" value={modelResult.result.eta2} color={C.gold}/></>}
      </div></div>
    :<div style={{padding:16,color:'rgba(200,230,200,.2)',fontSize:12,textAlign:'center'}}>{modelDepVar?'Chọn biến X hoặc nhóm':'Chọn biến Y và X để tự động phân tích'}</div>}</div>

  // ─── ADVISOR ──────────────────────────────────────────────────────────────
  const renderAdvisor=()=>{const adv=suggestModels(sortedVars,project.rows);const models=adv.models||adv;const gw=adv.globalWarns||[];return<div style={{overflow:'auto',flex:1,padding:6}}>
    {gw.length>0&&<div style={{marginBottom:10,padding:8,background:'rgba(255,45,120,.06)',border:`1px solid ${C.pink}30`,borderRadius:5}}><div style={{fontFamily:'Orbitron',fontSize:8,color:C.pink,letterSpacing:'2px',marginBottom:4}}>⚠ CẢNH BÁO</div>{gw.map((w,i)=><div key={i} style={{fontSize:11,color:C.pink,marginBottom:2}}>• {w}</div>)}</div>}
    {(Array.isArray(models)?models:[]).map((m,i)=><div key={i} style={{marginBottom:12,padding:10,background:`rgba(${hx(m.color)},.04)`,border:`1px solid ${m.color}22`,borderRadius:6}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
        <div><span style={{fontFamily:'Orbitron',fontSize:11,color:m.color,fontWeight:700}}>{m.name}</span><span style={{fontSize:9,color:'rgba(200,230,200,.3)',marginLeft:6}}>{m.category}</span></div>
        <div style={{display:'flex',alignItems:'center',gap:4}}><div style={{width:40,height:4,background:'rgba(255,255,255,.08)',borderRadius:3,overflow:'hidden'}}><div style={{width:`${m.confidence}%`,height:'100%',background:m.color,borderRadius:3}}/></div><span style={{fontSize:9,color:m.color,fontFamily:'Orbitron'}}>{m.confidence}%</span></div></div>
      <div style={{fontSize:11,color:'rgba(200,230,200,.55)',marginBottom:6,lineHeight:1.5}}>{m.rationale}</div>
      {m.assumptions?.map((a,j)=><div key={j} style={{fontSize:10,color:a.ok?'rgba(0,250,154,.6)':'rgba(255,45,120,.6)',display:'flex',gap:4,marginBottom:1}}><span>{a.ok?'✓':'✗'}</span><span>{a.text}</span></div>)}
      <div style={{display:'flex',flexWrap:'wrap',gap:3,marginTop:4,marginBottom:4}}>{m.outputs?.map((o,j)=><span key={j} style={{fontSize:9,padding:'1px 6px',borderRadius:3,background:`rgba(${hx(m.color)},.08)`,color:m.color,border:`1px solid ${m.color}20`}}>{o}</span>)}</div>
      {m.warns?.length>0&&m.warns.map((w,j)=><div key={j} style={{fontSize:10,color:C.pink}}>{w}</div>)}
      {m.nextSteps?.length>0&&<div style={{borderTop:'1px solid rgba(255,255,255,.05)',paddingTop:4,marginTop:4}}><div style={{fontSize:8,color:'rgba(200,230,200,.25)',fontFamily:'Orbitron',letterSpacing:'1px',marginBottom:2}}>NEXT STEPS</div>{m.nextSteps.map((s,j)=><div key={j} style={{fontSize:10,color:'rgba(200,230,200,.4)',marginBottom:1}}>→ {s}</div>)}</div>}
      {/* Run this model button */}
      <div style={{marginTop:6}}><span onClick={()=>onAdvisorSelect(m.name)} style={{padding:'3px 10px',borderRadius:4,fontSize:9,cursor:'pointer',fontFamily:'Orbitron',letterSpacing:'1px',background:`rgba(${hx(m.color)},.12)`,border:`1px solid ${m.color}40`,color:m.color}}>▶ Chạy model này</span></div>
    </div>)}</div>}

  // ═══════ MAIN RENDER ═══════
  return<div style={{height:'100%',display:'flex',flexDirection:'column',overflow:'hidden',padding:6}}>
    {/* Sub-tabs */}
    <div style={{display:'flex',gap:3,marginBottom:4,alignItems:'center',flexShrink:0}}>
      {TABS.map(t=><span key={t.id} onClick={()=>setTab(t.id)} style={{padding:'3px 8px',borderRadius:4,fontSize:9,cursor:'pointer',fontFamily:'Orbitron',letterSpacing:'1px',background:tab===t.id?`rgba(${hx(t.color)},.15)`:'transparent',border:`1px solid ${tab===t.id?t.color:'rgba(255,255,255,.06)'}`,color:tab===t.id?t.color:'rgba(200,230,200,.4)'}}>{t.icon} {t.label}</span>)}
      <div style={{flex:1}}/><Btn small onClick={()=>exportStatsCSV(project)} color={C.gold}>↓ CSV</Btn></div>
    {/* Chart controls */}
    {tab==='chart'&&<>
      <div style={{display:'flex',gap:2,marginBottom:3,flexShrink:0,alignItems:'center',flexWrap:'wrap'}}>
        {CHART_TYPES.map(ct=><span key={ct.id} onClick={()=>setChartType(ct.id)} title={ct.tip} style={{padding:'2px 6px',borderRadius:3,fontSize:8,cursor:'pointer',fontFamily:'Orbitron',letterSpacing:'.5px',background:chartType===ct.id?'rgba(0,250,154,.15)':'rgba(255,255,255,.04)',border:`1px solid ${chartType===ct.id?C.green:'rgba(255,255,255,.06)'}`,color:chartType===ct.id?C.green:'rgba(200,230,200,.35)',whiteSpace:'nowrap'}}>{ct.label}</span>)}</div>
      <div style={{display:'flex',flexWrap:'wrap',gap:3,marginBottom:3,flexShrink:0,alignItems:'center'}}>
        {chartVars.filter(v=>v.type!=='image').map((v,vi)=>{const isSel=selVars.has(v.id),vc=getColor(v.id,vi);return<span key={v.id} style={{display:'inline-flex',alignItems:'center',gap:2,position:'relative'}}>
          <span onClick={()=>toggleVar(v.id)} style={{padding:'2px 6px',borderRadius:3,fontSize:9,cursor:'pointer',background:isSel?`${vc}22`:'rgba(255,255,255,.04)',border:`1px solid ${isSel?vc:'rgba(255,255,255,.06)'}`,color:isSel?vc:'rgba(200,230,200,.35)'}}>{v.name}</span>
          {isSel&&<span onClick={()=>setShowColorFor(showColorFor===v.id?null:v.id)} style={{width:10,height:10,borderRadius:'50%',background:vc,cursor:'pointer',flexShrink:0}}/>}
          {showColorFor===v.id&&<div style={{position:'absolute',top:'100%',left:0,zIndex:100,background:'#0D0D1F',border:'1px solid rgba(0,250,154,.3)',borderRadius:4,padding:4,display:'flex',flexWrap:'wrap',gap:3,width:110,marginTop:2}}>{DCOLORS.map(c=><span key={c} onClick={()=>{setChartColors(p=>({...p,[v.id]:c}));setShowColorFor(null)}} style={{width:16,height:16,borderRadius:'50%',background:c,cursor:'pointer',outline:chartColors[v.id]===c?'2px solid #fff':'none'}}/>)}</div>}
        </span>})}</div>
      {needsIndependentAxes&&selectedNumVars.length>1&&<div style={{fontSize:8,color:C.gold,marginBottom:2,flexShrink:0,opacity:.7}}>⚡ Trục Y độc lập — click legend chuyển trục</div>}
    </>}
    <div style={{flex:1,minHeight:0,overflow:'hidden',display:'flex',flexDirection:'column'}}>
      {tab==='chart'&&renderChart()}{tab==='stats'&&renderStats()}{tab==='corr'&&renderCorr()}{tab==='model'&&renderModel()}{tab==='advisor'&&renderAdvisor()}</div>
  </div>
}
