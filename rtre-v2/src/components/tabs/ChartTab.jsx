import { useState, useMemo } from 'react'
import { AreaChart, Area, BarChart, Bar, ScatterChart, Scatter,
         XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Btn, HoloPanel, HoloTooltip, Pill } from '../ui/index.jsx'
import { C, CHART_COLORS, RGB } from '../../theme.js'
import { descriptive, pearsonR, spearmanR, welchTTest, mannWhitneyU,
         linearRegression, logisticRegression, freqTable, isNormal, clean } from '../../utils/statistics.js'
import { suggestModels } from '../../utils/modelAdvisor.js'
import { exportStatsCSV } from '../../utils/export.js'

const SecHead = ({ label, color=C.green }) => (
  <div style={{ fontFamily:'Orbitron', fontSize:10, color, letterSpacing:'2px',
    marginBottom:14, borderBottom:`1px solid ${color}18`, paddingBottom:6 }}>{label}</div>
)

// ─── Descriptive ──────────────────────────────────────────────────────────────
function DescriptivePanel({ project }) {
  const numVars = project.variables.filter(v=>['number','ordinal','binary'].includes(v.type))
  const catVars = project.variables.filter(v=>v.type==='categorical')
  if (!numVars.length && !catVars.length)
    return <div style={{ color:'rgba(200,230,200,.25)', fontSize:11, padding:12 }}>Cần ít nhất 1 biến số.</div>
  return (
    <div>
      <SecHead label="◈ THỐNG KÊ MÔ TẢ" color={C.blue}/>
      {numVars.map(v => {
        const d = descriptive(project.rows.map(r=>r[v.id]))
        if (!d) return null
        return (
          <div key={v.id} style={{ marginBottom:22 }}>
            <div style={{ fontSize:11, color:'rgba(200,230,200,.6)', marginBottom:10 }}>
              <span style={{ color:C.blue }}>{v.name}</span>
              <span style={{ marginLeft:8, fontSize:9,
                color: d.normal ? C.green : C.gold,
                fontFamily:'Orbitron' }}>
                {d.normal ? '✓ NORMAL' : '⚠ NON-NORMAL'} · n={d.n}
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
            <div style={{ fontSize:10, color:'rgba(200,230,200,.3)' }}>
              95% CI: [{d.ci95[0]}, {d.ci95[1]}]
            </div>
          </div>
        )
      })}
      {catVars.map(v => {
        const ft = freqTable(project.rows.map(r=>r[v.id]))
        if (!ft.length) return null
        return (
          <div key={v.id} style={{ marginBottom:20 }}>
            <div style={{ fontSize:11, color:C.purple, marginBottom:8 }}>
              {v.name} <span style={{ fontSize:9, color:'rgba(200,230,200,.3)' }}>categorical</span>
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
              {ft.map(r=>(
                <div key={r.value} style={{ background:'rgba(191,95,255,.06)',
                  border:'1px solid rgba(191,95,255,.18)', borderRadius:4,
                  padding:'5px 10px', fontSize:11, color:'rgba(200,230,200,.7)' }}>
                  {r.value}: <span style={{ color:C.purple }}>{r.n}</span>
                  <span style={{ fontSize:9, color:'rgba(200,230,200,.35)', marginLeft:4 }}>{r.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Correlation ──────────────────────────────────────────────────────────────
function CorrelationPanel({ project }) {
  const numVars = project.variables.filter(v=>['number','ordinal'].includes(v.type))
  if (numVars.length < 2)
    return <div style={{ color:'rgba(200,230,200,.25)', fontSize:11, padding:12 }}>Cần ≥ 2 biến số.</div>

  const pairs = []
  for (let i=0;i<numVars.length;i++) for (let j=i+1;j<numVars.length;j++) {
    const x = project.rows.map(r=>r[numVars[i].id])
    const y = project.rows.map(r=>r[numVars[j].id])
    const norm = isNormal(x) && isNormal(y)
    const res  = norm ? pearsonR(x,y) : spearmanR(x,y)
    pairs.push({ v1:numVars[i].name, v2:numVars[j].name, method:norm?'Pearson':'Spearman', ...res })
  }

  const rColor = r => isNaN(r)?'rgba(200,230,200,.3)':Math.abs(r)>=.7?C.pink:Math.abs(r)>=.4?C.gold:C.green

  return (
    <div>
      <SecHead label="◈ CORRELATION MATRIX" color={C.purple}/>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {pairs.map((p,i)=>(
          <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 12px',
            background:'rgba(191,95,255,.04)', border:'1px solid rgba(191,95,255,.1)', borderRadius:4 }}>
            <div style={{ flex:1, fontSize:11, color:'rgba(200,230,200,.65)' }}>
              <span style={{ color:C.blue }}>{p.v1}</span>
              <span style={{ color:'rgba(200,230,200,.3)', margin:'0 8px' }}>×</span>
              <span style={{ color:C.blue }}>{p.v2}</span>
              <span style={{ marginLeft:8, fontSize:9, color:'rgba(200,230,200,.3)' }}>{p.method}</span>
            </div>
            <div style={{ display:'flex', gap:16, alignItems:'center' }}>
              {[['r', isNaN(p.r)?'—':p.r, rColor(p.r), 15],
                ['p-value', isNaN(p.p)?'—':p.p<.001?'< 0.001':p.p.toFixed(3), p.p<.05?C.pink:'rgba(200,230,200,.5)', 12],
                ['n', p.n, 'rgba(200,230,200,.5)', 12]
               ].map(([l,v,c,fs])=>(
                <div key={l} style={{ textAlign:'center' }}>
                  <div style={{ fontSize:8, color:'rgba(200,230,200,.35)', marginBottom:2 }}>{l}</div>
                  <div style={{ fontSize:fs, color:c, fontFamily:'Orbitron', fontWeight:700 }}>
                    {v}{!isNaN(p.p)&&p.p<.05&&l==='p-value'&&<span style={{fontSize:9}}> *</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Model Results ────────────────────────────────────────────────────────────
function ModelResultsPanel({ project }) {
  const [model, setModel] = useState('linear')
  const numVars = project.variables.filter(v=>['number','ordinal'].includes(v.type))
  const binVars = project.variables.filter(v=>v.type==='binary')
  const catVars = project.variables.filter(v=>v.type==='categorical')
  const [xId,   setXId]   = useState(numVars[0]?.id||'')
  const [yId,   setYId]   = useState(numVars[1]?.id||'')
  const [outId, setOutId] = useState(binVars[0]?.id||'')
  const [predId,setPredId]= useState(numVars[0]?.id||'')
  const [catId, setCatId] = useState(catVars[0]?.id||'')
  const [numId, setNumId] = useState(numVars[0]?.id||'')

  const res = useMemo(() => {
    if (project.rows.length < 5) return null
    if (model==='linear') {
      return linearRegression(project.rows.map(r=>r[xId]), project.rows.map(r=>r[yId]))
    }
    if (model==='logistic') {
      return logisticRegression(project.rows.map(r=>r[predId]), project.rows.map(r=>r[outId]))
    }
    if (model==='ttest') {
      const groups = [...new Set(project.rows.map(r=>r[catId]).filter(Boolean))]
      if (groups.length < 2) return null
      const g1 = project.rows.filter(r=>r[catId]===groups[0]).map(r=>r[numId])
      const g2 = project.rows.filter(r=>r[catId]===groups[1]).map(r=>r[numId])
      const norm = isNormal(project.rows.map(r=>r[numId]))
      const result = norm && g1.length>=30 && g2.length>=30
        ? { ...welchTTest(g1,g2), method:"Welch's t-test" }
        : { ...mannWhitneyU(g1,g2), method:'Mann-Whitney U' }
      return { ...result, g1label:groups[0], g2label:groups[1] }
    }
    return null
  }, [model, project.rows, xId, yId, outId, predId, catId, numId])

  const SelRow = ({ label, value, onChange, vars }) => (
    <div style={{ display:'flex', gap:10, alignItems:'center' }}>
      <div style={{ fontSize:10, color:'rgba(200,230,200,.45)', minWidth:90 }}>{label}:</div>
      <select value={value} onChange={e=>onChange(e.target.value)} style={{ width:150, padding:'4px 8px', fontSize:11 }}>
        {vars.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}
      </select>
    </div>
  )

  return (
    <div>
      <SecHead label="◈ MODEL RESULTS" color={C.orange}/>
      <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
        {['linear','logistic','ttest'].map(m=>(
          <Btn key={m} small onClick={()=>setModel(m)} color={model===m?C.orange:'rgba(200,230,200,.28)'}>
            {m==='linear'?'Linear Reg':m==='logistic'?'Logistic Reg':'T-test / MWU'}
          </Btn>
        ))}
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:14 }}>
        {model==='linear' && numVars.length>=2 && (
          <><SelRow label="X (predictor)" value={xId} onChange={setXId} vars={numVars}/>
            <SelRow label="Y (outcome)"   value={yId} onChange={setYId} vars={numVars}/></>
        )}
        {model==='logistic' && (
          <><SelRow label="Predictor" value={predId} onChange={setPredId} vars={numVars}/>
            <SelRow label="Outcome (0/1)" value={outId} onChange={setOutId} vars={binVars}/></>
        )}
        {model==='ttest' && (
          <><SelRow label="Group var" value={catId} onChange={setCatId} vars={catVars}/>
            <SelRow label="Outcome"   value={numId} onChange={setNumId} vars={numVars}/></>
        )}
      </div>

      {res ? (
        <div style={{ background:'rgba(255,107,53,.04)', border:'1px solid rgba(255,107,53,.15)',
          borderRadius:6, padding:'14px 16px' }}>
          {model==='linear' && (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(110px,1fr))', gap:8, marginBottom:10 }}>
                <Pill label="β slope"   value={res.slope}     color={C.orange}/>
                <Pill label="Intercept" value={res.intercept} color={C.orange}/>
                <Pill label="R²"        value={res.r2}        color={C.gold}/>
                <Pill label="Adj R²"    value={res.r2adj}     color={C.gold}/>
                <Pill label="RMSE"      value={res.rmse}      color={C.orange}/>
                <Pill label="t"         value={res.t}         color={C.orange}/>
              </div>
              <div style={{ fontSize:12, color:res.significant?C.green:C.pink }}>
                {res.interpretation} · y = {res.slope}x + {res.intercept}
              </div>
            </>
          )}
          {model==='logistic' && (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(110px,1fr))', gap:8, marginBottom:10 }}>
                <Pill label="OR"          value={res.or}          color={C.orange}/>
                <Pill label="Accuracy %"  value={res.accuracy}    color={C.gold}/>
                <Pill label="Sens %"      value={res.sensitivity} color={C.green}/>
                <Pill label="Spec %"      value={res.specificity} color={C.blue}/>
                <Pill label="PPV %"       value={res.ppv}         color={C.orange}/>
                <Pill label="McF. R²"     value={res.mcFaddenR2}  color={C.purple}/>
              </div>
              <div style={{ fontSize:11, color:'rgba(200,230,200,.4)' }}>
                TP={res.tp} TN={res.tn} FP={res.fp} FN={res.fn} · n={res.n}
              </div>
            </>
          )}
          {model==='ttest' && (
            <>
              <div style={{ fontSize:10, color:C.gold, marginBottom:10, fontFamily:'Orbitron' }}>{res.method}</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(110px,1fr))', gap:8, marginBottom:10 }}>
                <Pill label={`Mean (${res.g1label||'G1'})`} value={res.mean1??res.U} color={C.blue}/>
                <Pill label={`Mean (${res.g2label||'G2'})`} value={res.mean2??res.z} color={C.pink}/>
                {res.t  && <Pill label="t-stat" value={res.t}  color={C.orange}/>}
                {res.df && <Pill label="df"     value={res.df} color={C.orange}/>}
                {res.z  && !res.t && <Pill label="z" value={res.z} color={C.orange}/>}
              </div>
              <div style={{ fontSize:12, color:res.significant?C.green:C.pink }}>{res.interpretation}</div>
            </>
          )}
        </div>
      ) : (
        <div style={{ color:'rgba(200,230,200,.25)', fontSize:11, padding:12 }}>
          {project.rows.length < 5 ? 'Cần ≥ 5 dòng dữ liệu.' : 'Chọn biến phù hợp để chạy mô hình.'}
        </div>
      )}
    </div>
  )
}

// ─── Model Advisor ────────────────────────────────────────────────────────────
function ModelAdvisorPanel({ project }) {
  const suggestions = useMemo(()=>suggestModels(project.variables,project.rows), [project.variables,project.rows])
  return (
    <div>
      <SecHead label="◈ MODEL ADVISOR — RULE-BASED" color={C.green}/>
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {suggestions.map((m,i)=>{
          const rgb = RGB[m.color]||'0,250,154'
          return (
            <div key={i} style={{ padding:'12px 16px',
              background:`rgba(${rgb},.04)`,
              border:`1px solid ${m.color}22`, borderLeft:`3px solid ${m.color}`,
              borderRadius:4 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
                <div>
                  <span style={{ color:m.color, fontFamily:'Orbitron', fontSize:11,
                    textShadow:`0 0 6px ${m.color}45` }}>{m.name}</span>
                  <span style={{ marginLeft:10, fontSize:9, color:'rgba(200,230,200,.35)',
                    background:'rgba(200,230,200,.06)', padding:'1px 6px', borderRadius:2 }}>{m.category}</span>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:8, color:'rgba(200,230,200,.35)', marginBottom:2 }}>CONFIDENCE</div>
                  <div style={{ color:m.color, fontFamily:'Orbitron', fontSize:13, fontWeight:700 }}>{m.confidence}%</div>
                </div>
              </div>
              <div style={{ fontSize:11, color:'rgba(200,230,200,.55)', marginBottom:8 }}>{m.rationale}</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:6 }}>
                {m.assumptions?.map((a,j)=>(
                  <span key={j} style={{ fontSize:9, padding:'2px 7px', borderRadius:2,
                    background:a.ok?'rgba(0,250,154,.08)':'rgba(255,45,120,.08)',
                    border:`1px solid ${a.ok?'rgba(0,250,154,.22)':'rgba(255,45,120,.22)'}`,
                    color:a.ok?C.green:C.pink }}>{a.ok?'✓':'✕'} {a.text}</span>
                ))}
              </div>
              {m.warns?.length>0 && m.warns.map((w,j)=>(
                <div key={j} style={{ fontSize:10, color:C.gold, marginBottom:3 }}>⚠ {w}</div>
              ))}
              {m.outputs && (
                <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginTop:6 }}>
                  {m.outputs.map((o,j)=>(
                    <span key={j} style={{ fontSize:9, padding:'1px 7px', borderRadius:10,
                      background:`rgba(${rgb},.07)`, color:`${m.color}cc` }}>{o}</span>
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
  const numVars = project.variables.filter(v=>['number','ordinal','binary'].includes(v.type))
  const [ct, setCt] = useState('area')
  const [xId, setXId] = useState(numVars[0]?.id||'')
  const [yId, setYId] = useState(numVars[1]?.id||numVars[0]?.id||'')

  const areaData = project.rows.map((r,i)=>{
    const obj={name:`P${i+1}`}
    numVars.forEach(v=>{obj[v.name]=Number(r[v.id])||0})
    return obj
  })
  const scatterData = project.rows.map((_,i)=>({
    x:Number(project.rows[i][xId])||0, y:Number(project.rows[i][yId])||0
  }))

  const ts={fill:'rgba(200,230,200,.38)',fontSize:10}
  const as={stroke:'rgba(0,250,154,.12)'}
  const gs={stroke:'rgba(0,250,154,.07)',strokeDasharray:'3 3'}
  const mg={top:10,right:20,bottom:20,left:0}
  const noData = project.rows.length===0

  return (
    <div>
      <SecHead label="◈ HOLOGRAPHIC VISUALIZATION" color={C.green}/>
      <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap', alignItems:'center' }}>
        {['area','bar','scatter'].map(t=>(
          <Btn key={t} small onClick={()=>setCt(t)} color={ct===t?C.green:'rgba(200,230,200,.28)'}>{t.toUpperCase()}</Btn>
        ))}
        {ct==='scatter'&&numVars.length>=2&&(
          <div style={{ display:'flex', gap:8, alignItems:'center', marginLeft:8 }}>
            <select value={xId} onChange={e=>setXId(e.target.value)} style={{width:110,padding:'4px 8px',fontSize:11}}>
              {numVars.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
            <span style={{color:C.green,fontSize:11}}>vs</span>
            <select value={yId} onChange={e=>setYId(e.target.value)} style={{width:110,padding:'4px 8px',fontSize:11}}>
              {numVars.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
        )}
      </div>
      <HoloPanel style={{ padding:'14px 14px 10px' }}>
        {noData ? (
          <div style={{ height:220, display:'flex', alignItems:'center', justifyContent:'center',
            color:'rgba(200,230,200,.22)', fontSize:12 }}>Cần dữ liệu để vẽ biểu đồ</div>
        ) : ct==='scatter' ? (
          <ResponsiveContainer width="100%" height={240}>
            <ScatterChart margin={mg}>
              <CartesianGrid {...gs}/><XAxis dataKey="x" type="number" tick={ts} {...as}/><YAxis dataKey="y" type="number" tick={ts} {...as}/>
              <Tooltip content={<HoloTooltip/>} cursor={{stroke:C.green,strokeDasharray:'3 3'}}/>
              <ScatterChart><Scatter data={scatterData} fill={C.green}
                shape={p=><circle cx={p.cx} cy={p.cy} r={5} fill={C.green} style={{filter:`drop-shadow(0 0 5px ${C.green})`}}/>}/></ScatterChart>
            </ScatterChart>
          </ResponsiveContainer>
        ) : ct==='bar' ? (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={areaData} margin={mg}>
              <CartesianGrid {...gs}/><XAxis dataKey="name" tick={ts} {...as}/><YAxis tick={ts} {...as}/>
              <Tooltip content={<HoloTooltip/>}/><Legend wrapperStyle={{fontSize:10,color:'rgba(200,230,200,.45)'}}/>
              {numVars.slice(0,5).map((v,i)=>(
                <Bar key={v.id} dataKey={v.name} fill={CHART_COLORS[i]} opacity={.85}
                  style={{filter:`drop-shadow(0 0 3px ${CHART_COLORS[i]})`}}/>
              ))}
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={areaData} margin={mg}>
              <defs>{numVars.slice(0,5).map((v,i)=>(
                <linearGradient key={v.id} id={`ag${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={CHART_COLORS[i]} stopOpacity={.22}/>
                  <stop offset="95%" stopColor={CHART_COLORS[i]} stopOpacity={.01}/>
                </linearGradient>
              ))}</defs>
              <CartesianGrid {...gs}/><XAxis dataKey="name" tick={ts} {...as}/><YAxis tick={ts} {...as}/>
              <Tooltip content={<HoloTooltip/>}/><Legend wrapperStyle={{fontSize:10,color:'rgba(200,230,200,.45)'}}/>
              {numVars.slice(0,5).map((v,i)=>(
                <Area key={v.id} type="monotone" dataKey={v.name} stroke={CHART_COLORS[i]} strokeWidth={2}
                  fill={`url(#ag${i})`}
                  dot={{fill:CHART_COLORS[i],r:3,style:{filter:`drop-shadow(0 0 3px ${CHART_COLORS[i]})`}}}
                  activeDot={{r:5,style:{filter:`drop-shadow(0 0 7px ${CHART_COLORS[i]})`}}}/>
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
    {id:'chart',   label:'◉ Chart'},
    {id:'stats',   label:'∑ Stats'},
    {id:'corr',    label:'⊕ Corr'},
    {id:'model',   label:'⚙ Model'},
    {id:'advisor', label:'◈ Advisor'},
  ]
  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ display:'flex', gap:2, padding:'0 16px', background:'rgba(0,0,0,.1)',
        borderBottom:'1px solid rgba(0,250,154,.06)', flexShrink:0, flexWrap:'wrap', alignItems:'center' }}>
        {tabs.map(t=>(
          <div key={t.id} onClick={()=>setSection(t.id)}
            style={{ padding:'7px 12px', cursor:'pointer', fontFamily:'Orbitron', fontSize:8,
              letterSpacing:'1px', color:section===t.id?C.green:'rgba(200,230,200,.28)',
              borderBottom:section===t.id?`2px solid ${C.green}`:'2px solid transparent',
              marginBottom:-1, transition:'color .15s', whiteSpace:'nowrap' }}
            onMouseEnter={e=>{if(section!==t.id)e.currentTarget.style.color='rgba(0,250,154,.5)'}}
            onMouseLeave={e=>{if(section!==t.id)e.currentTarget.style.color='rgba(200,230,200,.28)'}}>
            {t.label}
          </div>
        ))}
        <div style={{flex:1}}/>
        <Btn small onClick={()=>exportStatsCSV(project)} color={C.gold} style={{margin:'4px 0'}}>↓ Stats CSV</Btn>
      </div>
      <div className="fade-in" key={section} style={{ flex:1, overflow:'auto', padding:16 }}>
        {section==='chart'   && <ChartSection project={project}/>}
        {section==='stats'   && <DescriptivePanel project={project}/>}
        {section==='corr'    && <CorrelationPanel project={project}/>}
        {section==='model'   && <ModelResultsPanel project={project}/>}
        {section==='advisor' && <ModelAdvisorPanel project={project}/>}
      </div>
    </div>
  )
}
