import { useState, useMemo } from 'react'
import { AreaChart, Area, BarChart, Bar, ScatterChart, Scatter,
         XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Btn, HoloPanel, HoloTooltip, Pill } from '../ui/index.jsx'
import { C, CHART_COLORS, RGB } from '../../theme.js'
import { descriptive, pearsonR, spearmanR, welchTTest, mannWhitneyU,
         linearRegression, logisticRegression, freqTable, isNormal } from '../../utils/statistics.js'
import { suggestModels } from '../../utils/modelAdvisor.js'
import { exportStatsCSV } from '../../utils/export.js'

const SecHead = ({ label, color=C.green }) => (
  <div style={{ fontFamily:'Orbitron,sans-serif', fontSize:11, color, letterSpacing:'2px',
    marginBottom:12, borderBottom:`1px solid ${color}18`, paddingBottom:6 }}>{label}</div>
)

// ─── Variable multi-selector ──────────────────────────────────────────────────
function VarSelector({ vars, selected, onChange, label='Chọn biến', multi=true }) {
  return (
    <div style={{ marginBottom:12 }}>
      <div style={{ fontSize:12, color:'rgba(200,230,200,.5)', marginBottom:6 }}>{label}</div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
        {vars.map(v => {
          const isSel = selected.includes(v.id)
          return (
            <span key={v.id} onClick={() => {
              if (multi) {
                onChange(isSel ? selected.filter(id=>id!==v.id) : [...selected, v.id])
              } else {
                onChange([v.id])
              }
            }} style={{
              padding:'4px 10px', borderRadius:4, cursor:'pointer', fontSize:12,
              background: isSel ? `rgba(${RGB[C.green]||'0,250,154'},.15)` : 'rgba(200,230,200,.04)',
              border: `1px solid ${isSel ? C.green : 'rgba(200,230,200,.12)'}`,
              color: isSel ? C.green : 'rgba(200,230,200,.5)',
              transition:'all .15s', userSelect:'none'
            }}>{v.name}</span>
          )
        })}
      </div>
    </div>
  )
}

// ─── Descriptive ──────────────────────────────────────────────────────────────
function DescriptivePanel({ project }) {
  const numVars = project.variables.filter(v=>['number','ordinal','binary','percent','integer'].includes(v.type))
  const catVars = project.variables.filter(v=>['categorical','string','id','name'].includes(v.type))
  const [selNum, setSelNum] = useState(numVars.map(v=>v.id))
  const [selCat, setSelCat] = useState(catVars.map(v=>v.id))

  const filteredNum = numVars.filter(v=>selNum.includes(v.id))
  const filteredCat = catVars.filter(v=>selCat.includes(v.id))

  return (
    <div>
      <SecHead label="∑ THỐNG KÊ MÔ TẢ" color={C.blue}/>
      {numVars.length > 0 && (
        <VarSelector vars={numVars} selected={selNum} onChange={setSelNum} label="Biến số hiển thị:"/>
      )}
      {filteredNum.map(v => {
        const d = descriptive(project.rows.map(r=>r[v.id]))
        if (!d) return null
        return (
          <div key={v.id} style={{ marginBottom:20 }}>
            <div style={{ fontSize:13, color:C.blue, marginBottom:8, display:'flex', alignItems:'center', gap:10 }}>
              {v.name}
              <span style={{ fontSize:11, color:d.normal?C.green:C.gold, fontFamily:'Orbitron,sans-serif' }}>
                {d.normal?'✓ NORMAL':'⚠ NON-NORMAL'} · n={d.n}
                {d.missing>0&&` · ${d.missing} missing`}
              </span>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(105px,1fr))', gap:7, marginBottom:8 }}>
              {[['Mean',d.mean],['SD',d.std],['Median',d.median],['IQR',d.iqr],
                ['Min',d.min],['Max',d.max],['SEM',d.sem],['CV %',d.cv],
                ['Skew',d.skew],['Kurt',d.kurt]].map(([l,val])=>(
                <Pill key={l} label={l} value={val??'—'} color={C.blue}/>
              ))}
            </div>
            <div style={{ fontSize:12, color:'rgba(200,230,200,.35)' }}>
              95% CI: [{d.ci95[0]}, {d.ci95[1]}]
            </div>
          </div>
        )
      })}
      {catVars.length > 0 && (
        <>
          <VarSelector vars={catVars} selected={selCat} onChange={setSelCat} label="Biến phân loại hiển thị:"/>
          {filteredCat.map(v => {
            const ft = freqTable(project.rows.map(r=>r[v.id]))
            if (!ft.length) return null
            return (
              <div key={v.id} style={{ marginBottom:16 }}>
                <div style={{ fontSize:13, color:C.purple, marginBottom:8 }}>{v.name}</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  {ft.map(r=>(
                    <div key={r.value} style={{ background:'rgba(191,95,255,.06)',
                      border:'1px solid rgba(191,95,255,.18)', borderRadius:4,
                      padding:'5px 10px', fontSize:12 }}>
                      {r.value}: <span style={{color:C.purple}}>{r.n}</span>
                      <span style={{fontSize:11,color:'rgba(200,230,200,.35)',marginLeft:4}}>{r.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </>
      )}
      {numVars.length===0&&catVars.length===0&&(
        <div style={{color:'rgba(200,230,200,.25)',fontSize:13,padding:12}}>Cần ít nhất 1 biến.</div>
      )}
    </div>
  )
}

// ─── Correlation ──────────────────────────────────────────────────────────────
function CorrelationPanel({ project }) {
  const numVars = project.variables.filter(v=>['number','ordinal','percent','integer'].includes(v.type))
  const [selVars, setSelVars] = useState(numVars.map(v=>v.id))
  const filtered = numVars.filter(v=>selVars.includes(v.id))

  if (numVars.length < 2) return (
    <div style={{color:'rgba(200,230,200,.25)',fontSize:13,padding:12}}>Cần ≥ 2 biến số.</div>
  )

  const pairs = []
  for (let i=0;i<filtered.length;i++) for (let j=i+1;j<filtered.length;j++) {
    const x=project.rows.map(r=>r[filtered[i].id])
    const y=project.rows.map(r=>r[filtered[j].id])
    const norm=isNormal(x)&&isNormal(y)
    const res=norm?pearsonR(x,y):spearmanR(x,y)
    pairs.push({v1:filtered[i].name,v2:filtered[j].name,method:norm?'Pearson':'Spearman',...res})
  }

  const rColor = r => isNaN(r)?'rgba(200,230,200,.3)':Math.abs(r)>=.7?C.pink:Math.abs(r)>=.4?C.gold:C.green

  return (
    <div>
      <SecHead label="⊕ TƯƠNG QUAN" color={C.purple}/>
      <VarSelector vars={numVars} selected={selVars} onChange={setSelVars} label="Chọn biến:"/>
      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        {pairs.map((p,i)=>(
          <div key={i} style={{display:'flex',alignItems:'center',gap:12,padding:'8px 12px',
            background:'rgba(191,95,255,.04)',border:'1px solid rgba(191,95,255,.1)',borderRadius:4}}>
            <div style={{flex:1,fontSize:13}}>
              <span style={{color:C.blue}}>{p.v1}</span>
              <span style={{color:'rgba(200,230,200,.3)',margin:'0 8px'}}>×</span>
              <span style={{color:C.blue}}>{p.v2}</span>
              <span style={{marginLeft:8,fontSize:11,color:'rgba(200,230,200,.3)'}}>{p.method}</span>
            </div>
            <div style={{display:'flex',gap:16,alignItems:'center'}}>
              {[['r',isNaN(p.r)?'—':p.r,rColor(p.r),15],
                ['p',isNaN(p.p)?'—':p.p<.001?'<.001':p.p.toFixed(3),p.p<.05?C.pink:'rgba(200,230,200,.5)',12],
                ['n',p.n,'rgba(200,230,200,.5)',12]
               ].map(([l,v,c,s])=>(
                <div key={l} style={{textAlign:'center'}}>
                  <div style={{fontSize:10,color:'rgba(200,230,200,.35)',marginBottom:2}}>{l}</div>
                  <div style={{fontSize:s,color:c,fontFamily:'Orbitron,sans-serif',fontWeight:700}}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {pairs.length===0&&<div style={{color:'rgba(200,230,200,.25)',fontSize:13}}>Chọn ít nhất 2 biến.</div>}
      </div>
    </div>
  )
}

// ─── Model Results ────────────────────────────────────────────────────────────
function ModelResultsPanel({ project }) {
  const [model, setModel] = useState('linear')
  const numVars = project.variables.filter(v=>['number','ordinal','percent','integer'].includes(v.type))
  const binVars = project.variables.filter(v=>v.type==='binary')
  const catVars = project.variables.filter(v=>['categorical'].includes(v.type))
  const [xId,setPredId]=useState(numVars[0]?.id||'')
  const [yId,setYId]=useState(numVars[1]?.id||'')
  const [outId,setOutId]=useState(binVars[0]?.id||'')
  const [catId,setCatId]=useState(catVars[0]?.id||'')
  const [numId,setNumId]=useState(numVars[0]?.id||'')

  const res = useMemo(()=>{
    if (project.rows.length<5) return null
    if (model==='linear') return linearRegression(project.rows.map(r=>r[xId]),project.rows.map(r=>r[yId]))
    if (model==='logistic') return logisticRegression(project.rows.map(r=>r[xId]),project.rows.map(r=>r[outId]))
    if (model==='ttest') {
      const groups=[...new Set(project.rows.map(r=>r[catId]).filter(Boolean))]
      if (groups.length<2) return null
      const g1=project.rows.filter(r=>r[catId]===groups[0]).map(r=>r[numId])
      const g2=project.rows.filter(r=>r[catId]===groups[1]).map(r=>r[numId])
      const norm=isNormal(project.rows.map(r=>r[numId]))
      return norm&&g1.length>=30&&g2.length>=30
        ?{...welchTTest(g1,g2),method:"Welch's t-test",g1label:groups[0],g2label:groups[1]}
        :{...mannWhitneyU(g1,g2),method:'Mann-Whitney U',g1label:groups[0],g2label:groups[1]}
    }
    return null
  },[model,project.rows,xId,yId,outId,catId,numId])

  const Sel=({label,value,onChange,vars})=>(
    <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:6}}>
      <div style={{fontSize:12,color:'rgba(200,230,200,.45)',minWidth:100}}>{label}:</div>
      <select value={value} onChange={e=>onChange(e.target.value)} style={{width:150,padding:'4px 8px',fontSize:12}}>
        {vars.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}
      </select>
    </div>
  )

  return (
    <div>
      <SecHead label="⚙ CHẠY MÔ HÌNH" color={C.orange}/>
      <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap'}}>
        {['linear','logistic','ttest'].map(m=>(
          <Btn key={m} small onClick={()=>setModel(m)} color={model===m?C.orange:'rgba(200,230,200,.28)'}>
            {m==='linear'?'Linear Reg':m==='logistic'?'Logistic Reg':'T-test / MWU'}
          </Btn>
        ))}
      </div>
      {model==='linear'&&<><Sel label="X (predictor)" value={xId} onChange={setPredId} vars={numVars}/><Sel label="Y (outcome)" value={yId} onChange={setYId} vars={numVars}/></>}
      {model==='logistic'&&<><Sel label="Predictor" value={xId} onChange={setPredId} vars={numVars}/><Sel label="Outcome (0/1)" value={outId} onChange={setOutId} vars={binVars}/></>}
      {model==='ttest'&&<><Sel label="Nhóm" value={catId} onChange={setCatId} vars={catVars}/><Sel label="Outcome" value={numId} onChange={setNumId} vars={numVars}/></>}
      {res?(
        <div style={{background:'rgba(255,107,53,.04)',border:'1px solid rgba(255,107,53,.15)',borderRadius:6,padding:'14px 16px',marginTop:10}}>
          {model==='linear'&&(
            <><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(110px,1fr))',gap:8,marginBottom:10}}>
              <Pill label="β" value={res.slope} color={C.orange}/><Pill label="Intercept" value={res.intercept} color={C.orange}/>
              <Pill label="R²" value={res.r2} color={C.gold}/><Pill label="Adj R²" value={res.r2adj} color={C.gold}/>
              <Pill label="RMSE" value={res.rmse} color={C.orange}/><Pill label="t" value={res.t} color={C.orange}/>
            </div><div style={{fontSize:13,color:res.significant?C.green:C.pink}}>{res.interpretation}</div></>
          )}
          {model==='logistic'&&(
            <><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(110px,1fr))',gap:8,marginBottom:10}}>
              <Pill label="OR" value={res.or} color={C.orange}/><Pill label="Accuracy%" value={res.accuracy} color={C.gold}/>
              <Pill label="Sens%" value={res.sensitivity} color={C.green}/><Pill label="Spec%" value={res.specificity} color={C.blue}/>
              <Pill label="PPV%" value={res.ppv} color={C.orange}/><Pill label="McF.R²" value={res.mcFaddenR2} color={C.purple}/>
            </div><div style={{fontSize:12,color:'rgba(200,230,200,.4)'}}>TP={res.tp} TN={res.tn} FP={res.fp} FN={res.fn}</div></>
          )}
          {model==='ttest'&&(
            <><div style={{fontSize:12,color:C.gold,marginBottom:10,fontFamily:'Orbitron,sans-serif'}}>{res.method}</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(110px,1fr))',gap:8,marginBottom:10}}>
              <Pill label={`Mean(${res.g1label||'G1'})`} value={res.mean1??res.U} color={C.blue}/>
              <Pill label={`Mean(${res.g2label||'G2'})`} value={res.mean2??res.z} color={C.pink}/>
              {res.t&&<Pill label="t" value={res.t} color={C.orange}/>}
              {res.df&&<Pill label="df" value={res.df} color={C.orange}/>}
            </div>
            <div style={{fontSize:13,color:res.significant?C.green:C.pink}}>{res.interpretation}</div></>
          )}
        </div>
      ):(
        <div style={{color:'rgba(200,230,200,.25)',fontSize:13,padding:12}}>
          {project.rows.length<5?'Cần ≥ 5 dòng dữ liệu.':'Chọn biến và chạy mô hình.'}
        </div>
      )}
    </div>
  )
}

// ─── Advisor ──────────────────────────────────────────────────────────────────
function AdvisorPanel({ project }) {
  const suggestions = useMemo(()=>suggestModels(project.variables,project.rows),[project.variables,project.rows])
  return (
    <div>
      <SecHead label="◈ MODEL ADVISOR" color={C.green}/>
      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        {suggestions.map((m,i)=>{
          const rgb=RGB[m.color]||'0,250,154'
          return(
            <div key={i} style={{padding:'12px 16px',background:`rgba(${rgb},.04)`,
              border:`1px solid ${m.color}22`,borderLeft:`3px solid ${m.color}`,borderRadius:4}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                <div>
                  <span style={{color:m.color,fontFamily:'Orbitron,sans-serif',fontSize:12,textShadow:`0 0 6px ${m.color}45`}}>{m.name}</span>
                  <span style={{marginLeft:10,fontSize:11,color:'rgba(200,230,200,.35)',background:'rgba(200,230,200,.06)',padding:'1px 6px',borderRadius:2}}>{m.category}</span>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:10,color:'rgba(200,230,200,.35)',marginBottom:2}}>CONFIDENCE</div>
                  <div style={{color:m.color,fontFamily:'Orbitron,sans-serif',fontSize:14,fontWeight:700}}>{m.confidence}%</div>
                </div>
              </div>
              <div style={{fontSize:13,color:'rgba(200,230,200,.55)',marginBottom:8}}>{m.rationale}</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:6}}>
                {m.assumptions?.map((a,j)=>(
                  <span key={j} style={{fontSize:11,padding:'2px 8px',borderRadius:3,
                    background:a.ok?'rgba(0,250,154,.08)':'rgba(255,45,120,.08)',
                    border:`1px solid ${a.ok?'rgba(0,250,154,.22)':'rgba(255,45,120,.22)'}`,
                    color:a.ok?C.green:C.pink}}>{a.ok?'✓':'✕'} {a.text}</span>
                ))}
              </div>
              {m.warns?.map((w,j)=><div key={j} style={{fontSize:12,color:C.gold,marginBottom:2}}>⚠ {w}</div>)}
              {m.outputs&&(
                <div style={{display:'flex',flexWrap:'wrap',gap:5,marginTop:6}}>
                  {m.outputs.map((o,j)=>(
                    <span key={j} style={{fontSize:11,padding:'1px 8px',borderRadius:10,background:`rgba(${rgb},.07)`,color:`${m.color}cc`}}>{o}</span>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Chart section ────────────────────────────────────────────────────────────
function ChartSection({ project }) {
  const numVars = project.variables.filter(v=>['number','ordinal','binary','percent','integer'].includes(v.type))
  const [ct, setCt]   = useState('area')
  const [selVars, setSelVars] = useState(numVars.slice(0,3).map(v=>v.id))
  const [xId, setXId] = useState(numVars[0]?.id||'')
  const [yId, setYId] = useState(numVars[1]?.id||numVars[0]?.id||'')

  const selectedVars = numVars.filter(v=>selVars.includes(v.id))

  const areaData = project.rows.map((r,i)=>{
    const obj={name:`P${i+1}`}
    selectedVars.forEach(v=>{obj[v.name]=Number(r[v.id])||0})
    return obj
  })
  const scatterData=project.rows.map(r=>({x:Number(r[xId])||0,y:Number(r[yId])||0}))

  const ts={fill:'rgba(200,230,200,.38)',fontSize:11}
  const as={stroke:'rgba(0,250,154,.12)'}
  const gs={stroke:'rgba(0,250,154,.07)',strokeDasharray:'3 3'}
  const mg={top:8,right:16,bottom:18,left:0}
  const noData=project.rows.length===0

  return (
    <div>
      <SecHead label="◉ BIỂU ĐỒ" color={C.green}/>
      <div style={{display:'flex',gap:8,marginBottom:10,flexWrap:'wrap',alignItems:'center'}}>
        {['area','bar','scatter'].map(t=>(
          <Btn key={t} small onClick={()=>setCt(t)} color={ct===t?C.green:'rgba(200,230,200,.28)'}>{t}</Btn>
        ))}
      </div>

      {ct!=='scatter'&&numVars.length>0&&(
        <VarSelector vars={numVars} selected={selVars} onChange={setSelVars} label="Biến hiển thị (chọn nhiều):"/>
      )}

      {ct==='scatter'&&numVars.length>=2&&(
        <div style={{display:'flex',gap:10,marginBottom:10,alignItems:'center',flexWrap:'wrap'}}>
          <div style={{fontSize:12,color:'rgba(200,230,200,.45)'}}>X:</div>
          <select value={xId} onChange={e=>setXId(e.target.value)} style={{width:120,padding:'4px 8px',fontSize:12}}>
            {numVars.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
          <div style={{fontSize:12,color:'rgba(200,230,200,.45)'}}>Y:</div>
          <select value={yId} onChange={e=>setYId(e.target.value)} style={{width:120,padding:'4px 8px',fontSize:12}}>
            {numVars.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
      )}

      <HoloPanel style={{padding:'12px 12px 8px'}}>
        {noData?(
          <div style={{height:200,display:'flex',alignItems:'center',justifyContent:'center',color:'rgba(200,230,200,.22)',fontSize:13}}>
            Cần dữ liệu để vẽ biểu đồ
          </div>
        ):ct==='scatter'?(
          <ResponsiveContainer width="100%" height={200}>
            <ScatterChart margin={mg}>
              <CartesianGrid {...gs}/><XAxis dataKey="x" type="number" tick={ts} {...as}/><YAxis dataKey="y" type="number" tick={ts} {...as}/>
              <Tooltip content={<HoloTooltip/>} cursor={{stroke:C.green,strokeDasharray:'3 3'}}/>
              <Scatter data={scatterData} fill={C.green}
                shape={p=><circle cx={p.cx} cy={p.cy} r={5} fill={C.green} style={{filter:`drop-shadow(0 0 5px ${C.green})`}}/>}/>
            </ScatterChart>
          </ResponsiveContainer>
        ):ct==='bar'?(
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={areaData} margin={mg}>
              <CartesianGrid {...gs}/><XAxis dataKey="name" tick={ts} {...as}/><YAxis tick={ts} {...as}/>
              <Tooltip content={<HoloTooltip/>}/><Legend wrapperStyle={{fontSize:11,color:'rgba(200,230,200,.45)'}}/>
              {selectedVars.map((v,i)=><Bar key={v.id} dataKey={v.name} fill={CHART_COLORS[i%CHART_COLORS.length]} opacity={.85}/>)}
            </BarChart>
          </ResponsiveContainer>
        ):(
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={areaData} margin={mg}>
              <defs>{selectedVars.map((v,i)=>(
                <linearGradient key={v.id} id={`ag${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS[i%CHART_COLORS.length]} stopOpacity={.22}/>
                  <stop offset="95%" stopColor={CHART_COLORS[i%CHART_COLORS.length]} stopOpacity={.01}/>
                </linearGradient>
              ))}</defs>
              <CartesianGrid {...gs}/><XAxis dataKey="name" tick={ts} {...as}/><YAxis tick={ts} {...as}/>
              <Tooltip content={<HoloTooltip/>}/><Legend wrapperStyle={{fontSize:11,color:'rgba(200,230,200,.45)'}}/>
              {selectedVars.map((v,i)=>(
                <Area key={v.id} type="monotone" dataKey={v.name} stroke={CHART_COLORS[i%CHART_COLORS.length]} strokeWidth={2}
                  fill={`url(#ag${i})`}
                  dot={{fill:CHART_COLORS[i%CHART_COLORS.length],r:3}}
                  activeDot={{r:5}}/>
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </HoloPanel>
    </div>
  )
}

// ─── Main ChartTab ────────────────────────────────────────────────────────────
export function ChartTab({ project }) {
  const [section, setSection] = useState('chart')
  const tabs = [
    {id:'chart',label:'◉ Chart'},{id:'stats',label:'∑ Stats'},
    {id:'corr',label:'⊕ Corr'},{id:'model',label:'⚙ Model'},{id:'advisor',label:'◈ Advisor'},
  ]
  return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <div style={{display:'flex',gap:0,background:'rgba(0,0,0,.1)',
        borderBottom:'1px solid rgba(0,250,154,.06)',flexShrink:0,flexWrap:'wrap',alignItems:'center',
        padding:'0 10px'}}>
        {tabs.map(t=>(
          <div key={t.id} onClick={()=>setSection(t.id)}
            style={{padding:'7px 12px',cursor:'pointer',fontSize:11,
              color:section===t.id?C.green:'rgba(200,230,200,.35)',
              borderBottom:section===t.id?`2px solid ${C.green}`:'2px solid transparent',
              marginBottom:-1,transition:'color .15s',whiteSpace:'nowrap'}}
            onMouseEnter={e=>{if(section!==t.id)e.currentTarget.style.color='rgba(0,250,154,.55)'}}
            onMouseLeave={e=>{if(section!==t.id)e.currentTarget.style.color='rgba(200,230,200,.35)'}}>
            {t.label}
          </div>
        ))}
        <div style={{flex:1}}/>
        <Btn small onClick={()=>exportStatsCSV(project)} color={C.gold} style={{margin:'4px 0'}}>↓ Stats CSV</Btn>
      </div>
      <div className="fade-in" key={section} style={{flex:1,overflow:'auto',padding:14}}>
        {section==='chart'   && <ChartSection project={project}/>}
        {section==='stats'   && <DescriptivePanel project={project}/>}
        {section==='corr'    && <CorrelationPanel project={project}/>}
        {section==='model'   && <ModelResultsPanel project={project}/>}
        {section==='advisor' && <AdvisorPanel project={project}/>}
      </div>
    </div>
  )
}
