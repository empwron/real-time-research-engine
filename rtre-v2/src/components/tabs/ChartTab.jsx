import { useState, useMemo, useCallback } from 'react'
import { AreaChart, Area, BarChart, Bar, ScatterChart, Scatter, LineChart, Line,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ComposedChart } from 'recharts'
import { Btn, Pill, InfoTip } from '../ui/index.jsx'
import { C, CHART_COLORS } from '../../theme.js'
import { isNumType } from './InputTab.jsx'
import { descriptive, freqTable, pearsonR, spearmanR, welchTTest, mannWhitneyU,
  linearRegression, logisticRegression, chiSquare, oneWayAnova, clean, isNormal, mean, std } from '../../utils/statistics.js'
import { suggestModels } from '../../utils/modelAdvisor.js'
import { exportStatsCSV } from '../../utils/export.js'

// ─── Chart type definitions ─────────────────────────────────────────────────
const CHART_TYPES = [
  { id:'area',    label:'AREA',      tip:'Biểu đồ vùng — theo dõi xu hướng thay đổi theo thời gian hoặc thứ tự, nhấn mạnh khối lượng tích lũy.' },
  { id:'line',    label:'LINE',      tip:'Biểu đồ đường — theo dõi xu hướng liên tục, so sánh nhiều biến trên cùng trục thời gian.' },
  { id:'bar',     label:'BAR',       tip:'Biểu đồ cột — so sánh giá trị rời rạc giữa các nhóm hoặc category.' },
  { id:'scatter', label:'SCATTER',   tip:'Biểu đồ phân tán — khám phá mối tương quan giữa 2 biến liên tục (X vs Y).' },
  { id:'pie',     label:'PIE',       tip:'Biểu đồ tròn — hiển thị tỷ lệ phân bố của biến phân loại.' },
  { id:'hist',    label:'HISTOGRAM', tip:'Biểu đồ phân phối — xem shape (chuẩn/lệch) của biến số. Dùng đánh giá normality.' },
  { id:'box',     label:'BOX PLOT',  tip:'Box plot — median, Q1/Q3, IQR, outliers. Phù hợp so sánh phân phối giữa các nhóm.' },
  { id:'heatmap', label:'HEATMAP',   tip:'Ma trận tương quan (heatmap) — nhanh chóng phát hiện cặp biến tương quan mạnh.' },
]

const DEFAULT_CHART_COLORS = [...CHART_COLORS]

// ─── Sub-tabs ───────────────────────────────────────────────────────────────
const SUB_TABS = [
  { id:'chart', label:'Chart', icon:'●', color:C.green },
  { id:'stats', label:'Stats', icon:'Σ', color:C.blue },
  { id:'corr',  label:'Corr',  icon:'◎', color:C.purple },
  { id:'model', label:'Model', icon:'⊕', color:C.orange },
  { id:'advisor', label:'Advisor', icon:'◆', color:C.gold },
]

export function ChartTab({ project }) {
  const [tab, setTab] = useState('chart')
  const [chartType, setChartType] = useState('area')
  const [selVars, setSelVars] = useState(new Set())
  const [chartColors, setChartColors] = useState({})
  const [showColorFor, setShowColorFor] = useState(null)
  const [activeAxisVar, setActiveAxisVar] = useState(null)

  // Model tab state
  const [modelDepVar, setModelDepVar] = useState('')
  const [modelIndVars, setModelIndVars] = useState(new Set())
  const [modelGroupVar, setModelGroupVar] = useState('')
  const [_modelTick, _setModelTick] = useState(0) // force re-render

  const sortedVars = useMemo(() =>
    [...project.variables].sort((a,b)=>(a.order??0)-(b.order??0)), [project.variables])

  const numVars = useMemo(() => sortedVars.filter(v=>isNumType(v.type)), [sortedVars])
  const catVars = useMemo(() => sortedVars.filter(v=>v.type==='categorical'), [sortedVars])
  const binVars = useMemo(() => sortedVars.filter(v=>v.type==='binary'), [sortedVars])

  // Chart-eligible vars (exclude image)
  const chartVars = useMemo(() => sortedVars.filter(v=>v.type!=='image'), [sortedVars])
  const chartNumVars = useMemo(() => chartVars.filter(v=>isNumType(v.type)), [chartVars])

  const toggleVar = vid => setSelVars(p => {
    const n = new Set(p); n.has(vid)?n.delete(vid):n.add(vid); return n
  })

  const getColor = (vid, idx) => chartColors[vid] || DEFAULT_CHART_COLORS[idx % DEFAULT_CHART_COLORS.length]

  // ─── Detect if selected vars need independent axes ────────────────────────
  const selectedNumVars = useMemo(() =>
    chartNumVars.filter(v => selVars.has(v.id)), [chartNumVars, selVars])

  const varRanges = useMemo(() => {
    const ranges = {}
    selectedNumVars.forEach(v => {
      const vals = clean(project.rows.map(r => r[v.id]))
      if (vals.length) {
        ranges[v.id] = { min: Math.min(...vals), max: Math.max(...vals), range: Math.max(...vals) - Math.min(...vals) }
      }
    })
    return ranges
  }, [selectedNumVars, project.rows])

  const needsIndependentAxes = useMemo(() => {
    const ranges = Object.values(varRanges)
    if (ranges.length <= 1) return false
    const maxR = Math.max(...ranges.map(r=>r.range || 1))
    const minR = Math.min(...ranges.map(r=>r.range || 1))
    return maxR / Math.max(minR, 0.001) > 3
  }, [varRanges])

  // ─── Prepare chart data ───────────────────────────────────────────────────
  const chartData = useMemo(() => {
    return project.rows.map((row, idx) => {
      const d = { _idx: idx+1, _name: `#${idx+1}` }
      chartVars.forEach(v => {
        if (isNumType(v.type)) d[v.id] = row[v.id] !== undefined && row[v.id] !== '' ? Number(row[v.id]) : null
        else d[v.id] = row[v.id] ?? ''
      })
      return d
    })
  }, [project.rows, chartVars])

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER — CHART TAB
  // ═══════════════════════════════════════════════════════════════════════════
  const renderChart = () => {
    const selected = [...selVars]
    if (selected.length === 0) return (
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center',
        color:'rgba(200,230,200,.2)', fontSize:13 }}>Chọn biến để hiển thị biểu đồ</div>
    )

    const selNumVars = selectedNumVars
    const selCatVar = chartVars.find(v => selVars.has(v.id) && v.type === 'categorical')

    // ─── PIE chart ──────────────────────────────────────────────────────────
    if (chartType === 'pie') {
      const v = selCatVar || chartVars.find(v2 => selVars.has(v2.id))
      if (!v) return <div style={{padding:20,color:'rgba(200,230,200,.3)'}}>Chọn biến phân loại cho Pie chart</div>
      const ft = freqTable(project.rows.map(r=>r[v.id]))
      const data = ft.map((f,i)=>({name:f.value, value:f.n, fill:DEFAULT_CHART_COLORS[i%DEFAULT_CHART_COLORS.length]}))
      return (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius="70%"
              label={({name,pct})=>`${name}`} stroke="rgba(7,7,15,.8)" strokeWidth={2}>
              {data.map((d,i)=><Cell key={i} fill={d.fill}/>)}
            </Pie>
            <Tooltip contentStyle={{background:'rgba(5,5,18,.96)',border:'1px solid rgba(0,250,154,.4)',borderRadius:4,fontSize:12}}/>
            <Legend wrapperStyle={{fontSize:11}}/>
          </PieChart>
        </ResponsiveContainer>
      )
    }

    // ─── HISTOGRAM ──────────────────────────────────────────────────────────
    if (chartType === 'hist') {
      const v = selNumVars[0]
      if (!v) return <div style={{padding:20,color:'rgba(200,230,200,.3)'}}>Chọn biến số cho Histogram</div>
      const vals = clean(project.rows.map(r=>r[v.id]))
      if (vals.length < 2) return <div style={{padding:20,color:'rgba(200,230,200,.3)'}}>Cần ít nhất 2 giá trị</div>
      const mn = Math.min(...vals), mx = Math.max(...vals)
      const nBins = Math.min(Math.ceil(Math.sqrt(vals.length)), 20)
      const binW = (mx - mn) / nBins || 1
      const bins = Array.from({length:nBins},(_,i)=>({
        label: `${(mn+i*binW).toFixed(1)}`, from: mn+i*binW, to: mn+(i+1)*binW, count:0
      }))
      vals.forEach(v2 => { const idx = Math.min(Math.floor((v2-mn)/binW), nBins-1); bins[idx].count++ })
      const vc = getColor(v.id, 0)
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={bins}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)"/>
            <XAxis dataKey="label" tick={{fill:'rgba(200,230,200,.4)',fontSize:10}}/>
            <YAxis tick={{fill:'rgba(200,230,200,.4)',fontSize:10}}/>
            <Tooltip contentStyle={{background:'rgba(5,5,18,.96)',border:'1px solid rgba(0,250,154,.4)',borderRadius:4,fontSize:12}}
              formatter={(v2)=>[v2,'Tần số']}/>
            <Bar dataKey="count" fill={vc} fillOpacity={.7} stroke={vc}/>
          </BarChart>
        </ResponsiveContainer>
      )
    }

    // ─── BOX PLOT (simulated) ───────────────────────────────────────────────
    if (chartType === 'box') {
      const boxData = selNumVars.map((v,i) => {
        const vals = [...clean(project.rows.map(r=>r[v.id]))].sort((a,b)=>a-b)
        if (vals.length < 4) return null
        const q1 = vals[Math.floor(vals.length*.25)]
        const med = vals[Math.floor(vals.length*.5)]
        const q3 = vals[Math.floor(vals.length*.75)]
        const iqr = q3 - q1
        const whiskerLo = Math.max(vals[0], q1 - 1.5*iqr)
        const whiskerHi = Math.min(vals[vals.length-1], q3 + 1.5*iqr)
        return { name:v.name, q1, med, q3, whiskerLo, whiskerHi, min:vals[0], max:vals[vals.length-1],
          color: getColor(v.id, i) }
      }).filter(Boolean)
      if (!boxData.length) return <div style={{padding:20,color:'rgba(200,230,200,.3)'}}>Cần ít nhất 4 giá trị mỗi biến</div>
      return (
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:24, padding:16 }}>
          {boxData.map((b,i)=>(
            <div key={i} style={{ textAlign:'center' }}>
              <svg width={60} height={200} viewBox="0 0 60 200">
                {/* Scale to viewBox */}
                {(()=>{
                  const lo=b.whiskerLo, hi=b.whiskerHi, range=hi-lo||1
                  const y=v=>180-((v-lo)/range)*160+10
                  return (<g>
                    <line x1={30} y1={y(b.whiskerHi)} x2={30} y2={y(b.q3)} stroke={b.color} strokeWidth={1.5}/>
                    <line x1={20} y1={y(b.whiskerHi)} x2={40} y2={y(b.whiskerHi)} stroke={b.color} strokeWidth={1.5}/>
                    <rect x={15} y={y(b.q3)} width={30} height={y(b.q1)-y(b.q3)} fill={`${b.color}22`} stroke={b.color} strokeWidth={1.5} rx={2}/>
                    <line x1={15} y1={y(b.med)} x2={45} y2={y(b.med)} stroke={b.color} strokeWidth={2.5}/>
                    <line x1={30} y1={y(b.q1)} x2={30} y2={y(b.whiskerLo)} stroke={b.color} strokeWidth={1.5}/>
                    <line x1={20} y1={y(b.whiskerLo)} x2={40} y2={y(b.whiskerLo)} stroke={b.color} strokeWidth={1.5}/>
                    <text x={50} y={y(b.med)} fill={b.color} fontSize={8} dominantBaseline="middle">{b.med.toFixed(1)}</text>
                    <text x={50} y={y(b.q3)} fill="rgba(200,230,200,.4)" fontSize={7} dominantBaseline="middle">{b.q3.toFixed(1)}</text>
                    <text x={50} y={y(b.q1)} fill="rgba(200,230,200,.4)" fontSize={7} dominantBaseline="middle">{b.q1.toFixed(1)}</text>
                  </g>)
                })()}
              </svg>
              <div style={{ fontSize:11, color:b.color, marginTop:4 }}>{b.name}</div>
            </div>
          ))}
        </div>
      )
    }

    // ─── HEATMAP (correlation) ──────────────────────────────────────────────
    if (chartType === 'heatmap') {
      if (selNumVars.length < 2) return <div style={{padding:20,color:'rgba(200,230,200,.3)'}}>Chọn ≥ 2 biến số cho Heatmap</div>
      const corrMatrix = selNumVars.map(v1 =>
        selNumVars.map(v2 => {
          if (v1.id === v2.id) return 1
          const r = pearsonR(project.rows.map(r2=>r2[v1.id]), project.rows.map(r2=>r2[v2.id]))
          return r.r
        })
      )
      const cellSize = Math.min(50, 300 / selNumVars.length)
      return (
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', overflow:'auto' }}>
          <div>
            <div style={{ display:'flex', marginLeft:cellSize+10 }}>
              {selNumVars.map((v,i)=>(
                <div key={i} style={{ width:cellSize, fontSize:9, color:'rgba(200,230,200,.5)',
                  textAlign:'center', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{v.name}</div>
              ))}
            </div>
            {corrMatrix.map((row,i)=>(
              <div key={i} style={{ display:'flex', alignItems:'center' }}>
                <div style={{ width:cellSize+10, fontSize:9, color:'rgba(200,230,200,.5)',
                  textAlign:'right', paddingRight:6, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{selNumVars[i].name}</div>
                {row.map((r,j)=>{
                  const abs = Math.abs(r)
                  const hue = r >= 0 ? 154 : 340
                  return (
                    <div key={j} style={{ width:cellSize, height:cellSize, display:'flex',
                      alignItems:'center', justifyContent:'center',
                      background:`hsla(${hue},80%,50%,${abs*.5})`,
                      border:'1px solid rgba(255,255,255,.05)', fontSize:9,
                      color: abs > .4 ? '#fff' : 'rgba(200,230,200,.4)' }}>
                      {isNaN(r) ? '—' : r.toFixed(2)}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )
    }

    // ─── SCATTER ────────────────────────────────────────────────────────────
    if (chartType === 'scatter') {
      if (selNumVars.length < 2) return <div style={{padding:20,color:'rgba(200,230,200,.3)'}}>Chọn ≥ 2 biến số cho Scatter</div>
      const xv = selNumVars[0], yv = selNumVars[1]
      const sData = chartData.filter(d => d[xv.id] != null && d[yv.id] != null)
        .map(d => ({ x: d[xv.id], y: d[yv.id] }))
      return (
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)"/>
            <XAxis dataKey="x" name={xv.name} tick={{fill:'rgba(200,230,200,.4)',fontSize:10}}
              label={{value:xv.name,position:'bottom',fill:'rgba(200,230,200,.5)',fontSize:10}}/>
            <YAxis dataKey="y" name={yv.name} tick={{fill:'rgba(200,230,200,.4)',fontSize:10}}
              label={{value:yv.name,angle:-90,position:'insideLeft',fill:'rgba(200,230,200,.5)',fontSize:10}}/>
            <Tooltip contentStyle={{background:'rgba(5,5,18,.96)',border:'1px solid rgba(0,250,154,.4)',borderRadius:4,fontSize:12}}
              formatter={(v)=>v?.toFixed(2)}/>
            <Scatter data={sData} fill={getColor(yv.id,1)} fillOpacity={.7} r={4}/>
          </ScatterChart>
        </ResponsiveContainer>
      )
    }

    // ─── AREA / LINE / BAR (multi-variable, multi-axis) ─────────────────────
    if (selNumVars.length === 0) return <div style={{padding:20,color:'rgba(200,230,200,.3)'}}>Chọn biến số</div>

    const useMultiAxis = needsIndependentAxes && selNumVars.length > 1
    const activeVar = activeAxisVar && selNumVars.find(v=>v.id===activeAxisVar) ? activeAxisVar : selNumVars[0]?.id

    const ChartComp = chartType === 'bar' ? BarChart : ComposedChart

    return (
      <ResponsiveContainer width="100%" height="100%">
        <ChartComp data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)"/>
          <XAxis dataKey="_idx" tick={{fill:'rgba(200,230,200,.4)',fontSize:10}}/>

          {useMultiAxis ? (
            // Multiple Y-axes — only show the active one
            selNumVars.map((v,i) => {
              const r = varRanges[v.id]
              return (
                <YAxis key={v.id} yAxisId={v.id}
                  domain={r ? [Math.floor(r.min * 0.95), Math.ceil(r.max * 1.05)] : ['auto','auto']}
                  hide={v.id !== activeVar}
                  orientation={i % 2 === 0 ? 'left' : 'right'}
                  tick={{fill: getColor(v.id,i), fontSize:10}}
                  axisLine={{stroke: getColor(v.id,i)}}
                  label={v.id === activeVar ? {value:v.name,angle:-90,position:'insideLeft',fill:getColor(v.id,i),fontSize:10} : undefined}/>
              )
            })
          ) : (
            <YAxis yAxisId="shared" tick={{fill:'rgba(200,230,200,.4)',fontSize:10}}/>
          )}

          <Tooltip contentStyle={{background:'rgba(5,5,18,.96)',border:'1px solid rgba(0,250,154,.4)',borderRadius:4,fontSize:12}}
            formatter={(val,name)=>[typeof val==='number'?val.toFixed(2):val, name]}/>
          <Legend onClick={(e) => {
            const vid = selNumVars.find(v=>v.name===e.value)?.id
            if(vid) setActiveAxisVar(vid)
          }} wrapperStyle={{cursor:'pointer', fontSize:11}}/>

          {selNumVars.map((v,i) => {
            const vc = getColor(v.id, i)
            const yId = useMultiAxis ? v.id : 'shared'
            if (chartType === 'bar') {
              return <Bar key={v.id} dataKey={v.id} name={v.name} fill={vc} fillOpacity={.7}
                yAxisId={yId} onClick={()=>setActiveAxisVar(v.id)} style={{cursor:'pointer'}}/>
            }
            if (chartType === 'line') {
              return <Line key={v.id} dataKey={v.id} name={v.name} stroke={vc} strokeWidth={2}
                dot={{r:3,fill:vc}} yAxisId={yId} connectNulls
                onClick={()=>setActiveAxisVar(v.id)} style={{cursor:'pointer'}}/>
            }
            // area (default)
            return <Area key={v.id} dataKey={v.id} name={v.name} stroke={vc}
              fill={vc} fillOpacity={.12} strokeWidth={2}
              dot={{r:2,fill:vc}} yAxisId={yId} connectNulls
              onClick={()=>setActiveAxisVar(v.id)} style={{cursor:'pointer'}}/>
          })}
        </ChartComp>
      </ResponsiveContainer>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER — STATS TAB
  // ═══════════════════════════════════════════════════════════════════════════
  const renderStats = () => (
    <div style={{ overflow:'auto', flex:1, padding:8 }}>
      {numVars.length === 0 && <div style={{color:'rgba(200,230,200,.3)',padding:20}}>Chưa có biến số</div>}
      {numVars.map(v => {
        const d = descriptive(project.rows.map(r=>r[v.id]))
        if (!d) return null
        return (
          <div key={v.id} style={{ marginBottom:14, padding:10, background:'rgba(255,255,255,.02)',
            border:'1px solid rgba(255,255,255,.06)', borderRadius:5 }}>
            <div style={{ fontSize:12, color:C.blue, fontWeight:600, marginBottom:8 }}>
              {v.name} {v.codeName && <span style={{fontSize:10,color:'rgba(200,230,200,.25)'}}>({v.codeName})</span>}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(100px,1fr))', gap:6 }}>
              <Pill label="N" value={d.n} color={C.blue}/>
              <Pill label="MEAN" value={d.mean} color={C.green}/>
              <Pill label="SD" value={d.std} color={C.cyan}/>
              <Pill label="MEDIAN" value={d.median} color={C.purple}/>
              <Pill label="MIN" value={d.min}/>
              <Pill label="MAX" value={d.max}/>
              <Pill label="Q1" value={d.q1}/>
              <Pill label="Q3" value={d.q3}/>
              <Pill label="SKEW" value={d.skew} color={Math.abs(d.skew)>1?C.pink:C.green}/>
              <Pill label="NORMAL" value={d.normal?'Yes':'No'} color={d.normal?C.green:C.pink}/>
              <Pill label="95%CI" value={`${d.ci95[0]}–${d.ci95[1]}`} color={C.gold}/>
            </div>
          </div>
        )
      })}
      {catVars.map(v => {
        const ft = freqTable(project.rows.map(r=>r[v.id]))
        return (
          <div key={v.id} style={{ marginBottom:14, padding:10, background:'rgba(255,255,255,.02)',
            border:'1px solid rgba(255,255,255,.06)', borderRadius:5 }}>
            <div style={{ fontSize:12, color:C.purple, fontWeight:600, marginBottom:8 }}>{v.name} (Categorical)</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {ft.map(f=><Pill key={f.value} label={f.value} value={`${f.n} (${f.pct}%)`} color={C.purple}/>)}
            </div>
          </div>
        )
      })}
    </div>
  )

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER — CORRELATION TAB
  // ═══════════════════════════════════════════════════════════════════════════
  const renderCorr = () => {
    if (numVars.length < 2) return <div style={{padding:20,color:'rgba(200,230,200,.3)'}}>Cần ≥ 2 biến số</div>
    return (
      <div style={{ overflow:'auto', flex:1, padding:8 }}>
        <div style={{ fontSize:10, color:'rgba(200,230,200,.3)', marginBottom:8 }}>
          {isNormal(project.rows.map(r=>r[numVars[0].id])) ? 'Pearson (parametric)' : 'Spearman (non-parametric)'}
        </div>
        <table style={{ borderCollapse:'collapse', fontSize:12, width:'100%' }}>
          <thead>
            <tr><th style={thS}></th>{numVars.map(v=><th key={v.id} style={{...thS,color:C.purple}}>{v.name}</th>)}</tr>
          </thead>
          <tbody>
            {numVars.map(v1=>(
              <tr key={v1.id}>
                <td style={{...tdS,color:C.purple,fontWeight:600}}>{v1.name}</td>
                {numVars.map(v2=>{
                  if(v1.id===v2.id) return <td key={v2.id} style={{...tdS,color:C.green,fontWeight:700}}>1.00</td>
                  const fn = isNormal(project.rows.map(r=>r[v1.id])) ? pearsonR : spearmanR
                  const res = fn(project.rows.map(r=>r[v1.id]), project.rows.map(r=>r[v2.id]))
                  const abs = Math.abs(res.r)
                  return <td key={v2.id} style={{...tdS,
                    color:abs>.7?C.green:abs>.4?C.gold:'rgba(200,230,200,.5)',
                    fontWeight:abs>.7?700:400}}>
                    {isNaN(res.r)?'—':res.r.toFixed(3)}{res.p<.05&&' *'}
                  </td>
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  // ─── Model auto-compute (at component level) ───────────────────────────
  const allOutcomeVars = useMemo(() => [...binVars, ...numVars], [binVars, numVars])
  const modelDepV = useMemo(() => allOutcomeVars.find(v=>v.id===modelDepVar), [allOutcomeVars, modelDepVar])

  const modelResult = useMemo(() => {
    if (!modelDepV || modelIndVars.size === 0) return null
    const indVarList = chartNumVars.filter(v => modelIndVars.has(v.id) && v.id !== modelDepV.id)
    if (indVarList.length === 0) return null

    // Binary outcome → logistic
    if (modelDepV.type === 'binary') {
      const xv = indVarList[0]
      const res = logisticRegression(project.rows.map(r=>r[xv.id]), project.rows.map(r=>r[modelDepV.id]))
      return res ? { type: 'logistic', result: res, xName: xv.name, yName: modelDepV.name } : null
    }

    // Group comparison
    if (modelGroupVar) {
      const gv = catVars.find(v=>v.id===modelGroupVar)
      if (gv) {
        const groups = [...new Set(project.rows.map(r=>r[gv.id]).filter(Boolean))]
        if (groups.length === 2) {
          const g1 = project.rows.filter(r=>r[gv.id]===groups[0]).map(r=>r[modelDepV.id])
          const g2 = project.rows.filter(r=>r[gv.id]===groups[1]).map(r=>r[modelDepV.id])
          const norm = isNormal(g1) && isNormal(g2) && g1.length >= 20 && g2.length >= 20
          const res = norm ? welchTTest(g1,g2) : mannWhitneyU(g1,g2)
          return res ? { type: norm?'ttest':'mannwhitney', result: res, groups, groupVar: gv.name, yName: modelDepV.name } : null
        }
        if (groups.length >= 3) {
          const groupData = groups.map(g => project.rows.filter(r=>r[gv.id]===g).map(r=>r[modelDepV.id]))
          const res = oneWayAnova(groupData)
          return res ? { type: 'anova', result: res, groups, groupVar: gv.name, yName: modelDepV.name } : null
        }
      }
    }

    // Continuous outcome → linear regression
    const xv = indVarList[0]
    const res = linearRegression(project.rows.map(r=>r[xv.id]), project.rows.map(r=>r[modelDepV.id]))
    return res ? { type: 'linear', result: res, xName: xv.name, yName: modelDepV.name } : null
  }, [modelDepV, modelIndVars, modelGroupVar, project.rows, chartNumVars, catVars])

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER — MODEL TAB (auto-run)
  // ═══════════════════════════════════════════════════════════════════════════
  const renderModel = () => {
    return (
      <div style={{ overflow:'auto', flex:1, padding:8 }}>
        {/* Variable selection */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
          <div>
            <label style={{ fontSize:10, color:C.orange, fontFamily:'Orbitron', letterSpacing:'1px', display:'block', marginBottom:4 }}>
              BIẾN PHỤ THUỘC (Y)
            </label>
            <select value={modelDepVar} onChange={e=>setModelDepVar(e.target.value)} style={{fontSize:12}}>
              <option value="">— Chọn outcome —</option>
              {allOutcomeVars.map(v=><option key={v.id} value={v.id}>{v.name} [{v.type}]</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize:10, color:C.orange, fontFamily:'Orbitron', letterSpacing:'1px', display:'block', marginBottom:4 }}>
              BIẾN NHÓM (tùy chọn)
            </label>
            <select value={modelGroupVar} onChange={e=>setModelGroupVar(e.target.value)} style={{fontSize:12}}>
              <option value="">— Không —</option>
              {catVars.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginBottom:12 }}>
          <label style={{ fontSize:10, color:C.orange, fontFamily:'Orbitron', letterSpacing:'1px', display:'block', marginBottom:4 }}>
            BIẾN ĐỘC LẬP (X) — chọn nhiều
          </label>
          <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
            {chartNumVars.filter(v=>v.id!==modelDepVar).map(v=>(
              <span key={v.id} onClick={()=>setModelIndVars(p=>{const n=new Set(p);n.has(v.id)?n.delete(v.id):n.add(v.id);return n})}
                style={{ padding:'4px 10px', borderRadius:4, fontSize:11, cursor:'pointer',
                  background: modelIndVars.has(v.id) ? `rgba(255,107,53,.18)` : 'rgba(255,255,255,.04)',
                  border: `1px solid ${modelIndVars.has(v.id)?C.orange:'rgba(255,255,255,.1)'}`,
                  color: modelIndVars.has(v.id)?C.orange:'rgba(200,230,200,.5)' }}>
                {v.name}
              </span>
            ))}
          </div>
        </div>

        {/* Auto-run results */}
        {modelResult ? (
          <div style={{ padding:12, background:'rgba(255,107,53,.04)', border:`1px solid ${C.orange}30`,
            borderRadius:6, marginTop:8 }}>
            <div style={{ fontFamily:'Orbitron', fontSize:10, color:C.orange, letterSpacing:'2px', marginBottom:10 }}>
              {modelResult.type === 'logistic' ? '◎ LOGISTIC REGRESSION' :
               modelResult.type === 'linear' ? '◎ LINEAR REGRESSION' :
               modelResult.type === 'ttest' ? "◎ WELCH'S T-TEST" :
               modelResult.type === 'mannwhitney' ? '◎ MANN-WHITNEY U' :
               modelResult.type === 'anova' ? '◎ ONE-WAY ANOVA' : '◎ RESULT'}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(110px,1fr))', gap:6 }}>
              {modelResult.type === 'logistic' && (<>
                <Pill label="OR" value={modelResult.result.or} color={C.orange}/>
                <Pill label="ACCURACY" value={`${modelResult.result.accuracy}%`} color={C.green}/>
                <Pill label="SENS" value={`${modelResult.result.sensitivity}%`} color={C.blue}/>
                <Pill label="SPEC" value={`${modelResult.result.specificity}%`} color={C.purple}/>
                <Pill label="PPV" value={`${modelResult.result.ppv}%`} color={C.cyan}/>
                <Pill label="McFadden R²" value={modelResult.result.mcFaddenR2} color={C.gold}/>
                <Pill label="N" value={modelResult.result.n}/>
                <Pill label="COEF" value={modelResult.result.coefficient} color={C.pink}/>
              </>)}
              {modelResult.type === 'linear' && (<>
                <Pill label="SLOPE (β)" value={modelResult.result.slope} color={C.blue}/>
                <Pill label="R²" value={modelResult.result.r2} color={C.green}/>
                <Pill label="ADJ R²" value={modelResult.result.r2adj} color={C.cyan}/>
                <Pill label="RMSE" value={modelResult.result.rmse} color={C.orange}/>
                <Pill label="P-VALUE" value={modelResult.result.interpretation} color={modelResult.result.significant?C.green:C.pink}/>
                <Pill label="N" value={modelResult.result.n}/>
              </>)}
              {(modelResult.type === 'ttest') && (<>
                <Pill label="T" value={modelResult.result.t} color={C.pink}/>
                <Pill label="DF" value={modelResult.result.df} color={C.blue}/>
                <Pill label="P-VALUE" value={modelResult.result.interpretation} color={modelResult.result.significant?C.green:C.pink}/>
                <Pill label={`MEAN ${modelResult.groups?.[0]||'G1'}`} value={modelResult.result.mean1} color={C.cyan}/>
                <Pill label={`MEAN ${modelResult.groups?.[1]||'G2'}`} value={modelResult.result.mean2} color={C.orange}/>
                <Pill label="N1" value={modelResult.result.n1}/>
                <Pill label="N2" value={modelResult.result.n2}/>
              </>)}
              {modelResult.type === 'mannwhitney' && (<>
                <Pill label="U" value={modelResult.result.U} color={C.pink}/>
                <Pill label="Z" value={modelResult.result.z} color={C.blue}/>
                <Pill label="P-VALUE" value={modelResult.result.interpretation} color={modelResult.result.significant?C.green:C.pink}/>
                <Pill label="N1" value={modelResult.result.n1}/>
                <Pill label="N2" value={modelResult.result.n2}/>
              </>)}
              {modelResult.type === 'anova' && (<>
                <Pill label="F" value={modelResult.result.F} color={C.orange}/>
                <Pill label="DF (B)" value={modelResult.result.dfBetween}/>
                <Pill label="DF (W)" value={modelResult.result.dfWithin}/>
                <Pill label="P-VALUE" value={modelResult.result.interpretation} color={modelResult.result.significant?C.green:C.pink}/>
                <Pill label="η²" value={modelResult.result.eta2} color={C.gold}/>
                <Pill label="N" value={modelResult.result.n}/>
              </>)}
            </div>
          </div>
        ) : (
          <div style={{ padding:20, color:'rgba(200,230,200,.2)', fontSize:12, textAlign:'center' }}>
            {modelDepVar ? 'Chọn biến độc lập để tự động chạy phân tích' : 'Chọn biến phụ thuộc (Y) và biến độc lập (X) để bắt đầu'}
          </div>
        )}
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER — ADVISOR TAB
  // ═══════════════════════════════════════════════════════════════════════════
  const renderAdvisor = () => {
    const advice = suggestModels(sortedVars, project.rows)
    const models = advice.models || advice // backward compat
    const globalWarns = advice.globalWarns || []

    return (
      <div style={{ overflow:'auto', flex:1, padding:8 }}>
        {/* Global warnings */}
        {globalWarns.length > 0 && (
          <div style={{ marginBottom:12, padding:10, background:'rgba(255,45,120,.06)',
            border:`1px solid ${C.pink}30`, borderRadius:5 }}>
            <div style={{ fontFamily:'Orbitron', fontSize:9, color:C.pink, letterSpacing:'2px', marginBottom:6 }}>⚠ CẢNH BÁO CHUNG</div>
            {globalWarns.map((w,i) => <div key={i} style={{ fontSize:12, color:C.pink, marginBottom:3 }}>• {w}</div>)}
          </div>
        )}

        {(Array.isArray(models)?models:[]).map((m,i) => (
          <div key={i} style={{ marginBottom:14, padding:12, background:`rgba(${hexToRgb(m.color)},.04)`,
            border:`1px solid ${m.color}22`, borderRadius:6 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <div>
                <span style={{ fontFamily:'Orbitron', fontSize:12, color:m.color, fontWeight:700 }}>{m.name}</span>
                <span style={{ fontSize:10, color:'rgba(200,230,200,.3)', marginLeft:8 }}>{m.category}</span>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <div style={{ width:50, height:5, background:'rgba(255,255,255,.08)', borderRadius:3, overflow:'hidden' }}>
                  <div style={{ width:`${m.confidence}%`, height:'100%', background:m.color, borderRadius:3 }}/>
                </div>
                <span style={{ fontSize:10, color:m.color, fontFamily:'Orbitron' }}>{m.confidence}%</span>
              </div>
            </div>
            <div style={{ fontSize:12, color:'rgba(200,230,200,.6)', marginBottom:8, lineHeight:1.6 }}>{m.rationale}</div>

            {/* Assumptions */}
            <div style={{ marginBottom:6 }}>
              {m.assumptions?.map((a,j)=>(
                <div key={j} style={{ fontSize:11, color:a.ok?'rgba(0,250,154,.7)':'rgba(255,45,120,.7)', display:'flex', gap:6, marginBottom:2 }}>
                  <span>{a.ok?'✓':'✗'}</span><span>{a.text}</span>
                </div>
              ))}
            </div>

            {/* Outputs */}
            <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:6 }}>
              {m.outputs?.map((o,j)=>(
                <span key={j} style={{ fontSize:10, padding:'2px 8px', borderRadius:3,
                  background:`rgba(${hexToRgb(m.color)},.08)`, color:m.color, border:`1px solid ${m.color}20` }}>{o}</span>
              ))}
            </div>

            {/* Warnings */}
            {m.warns?.length > 0 && (
              <div style={{ marginBottom:6 }}>
                {m.warns.map((w,j)=><div key={j} style={{ fontSize:11, color:C.pink }}>{w}</div>)}
              </div>
            )}

            {/* Next steps */}
            {m.nextSteps?.length > 0 && (
              <div style={{ borderTop:'1px solid rgba(255,255,255,.05)', paddingTop:6, marginTop:4 }}>
                <div style={{ fontSize:9, color:'rgba(200,230,200,.3)', fontFamily:'Orbitron', letterSpacing:'1px', marginBottom:4 }}>NEXT STEPS</div>
                {m.nextSteps.map((s,j)=><div key={j} style={{ fontSize:11, color:'rgba(200,230,200,.45)', marginBottom:2 }}>→ {s}</div>)}
              </div>
            )}
          </div>
        ))}
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', overflow:'hidden', padding:8 }}>
      {/* Sub-tab bar */}
      <div style={{ display:'flex', gap:4, marginBottom:6, alignItems:'center', flexWrap:'wrap', flexShrink:0 }}>
        {SUB_TABS.map(t=>(
          <span key={t.id} onClick={()=>setTab(t.id)}
            style={{ padding:'4px 10px', borderRadius:4, fontSize:10, cursor:'pointer',
              fontFamily:'Orbitron', letterSpacing:'1px',
              background: tab===t.id ? `rgba(${hexToRgb(t.color)},.15)` : 'transparent',
              border: `1px solid ${tab===t.id?t.color:'rgba(255,255,255,.06)'}`,
              color: tab===t.id?t.color:'rgba(200,230,200,.4)' }}>
            {t.icon} {t.label}
          </span>
        ))}
        <div style={{flex:1}}/>
        <Btn small onClick={()=>exportStatsCSV(project)} color={C.gold}>↓ STATS CSV</Btn>
      </div>

      {/* Chart-specific controls */}
      {tab === 'chart' && (
        <>
          {/* Chart type selector with ? tooltips */}
          <div style={{ display:'flex', gap:4, marginBottom:6, flexWrap:'wrap', flexShrink:0, alignItems:'center' }}>
            <span style={{ fontFamily:'Orbitron,sans-serif', fontSize:10, color:C.green, letterSpacing:'2px' }}>● BIỂU ĐỒ</span>
            <div style={{flex:1}}/>
            {CHART_TYPES.map(ct=>(
              <span key={ct.id} style={{ display:'inline-flex', alignItems:'center', gap:3 }}>
                <span onClick={()=>setChartType(ct.id)}
                  style={{ padding:'3px 8px', borderRadius:4, fontSize:9, cursor:'pointer',
                    fontFamily:'Orbitron', letterSpacing:'1px',
                    background: chartType===ct.id ? 'rgba(0,250,154,.15)' : 'rgba(255,255,255,.04)',
                    border: `1px solid ${chartType===ct.id?C.green:'rgba(255,255,255,.08)'}`,
                    color: chartType===ct.id?C.green:'rgba(200,230,200,.4)' }}>
                  {ct.label}
                </span>
                <InfoTip text={ct.tip}/>
              </span>
            ))}
          </div>

          {/* Variable selector with color picker */}
          <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:6, flexShrink:0, alignItems:'center' }}>
            <span style={{ fontSize:11, color:'rgba(200,230,200,.35)' }}>Biến hiển thị (chọn nhiều):</span>
            {chartVars.filter(v=>v.type!=='image').map((v,vi) => {
              const isNum = isNumType(v.type)
              const isSel = selVars.has(v.id)
              const vc = getColor(v.id, vi)
              return (
                <span key={v.id} style={{ display:'inline-flex', alignItems:'center', gap:3, position:'relative' }}>
                  <span onClick={()=>toggleVar(v.id)}
                    style={{ padding:'3px 8px', borderRadius:4, fontSize:11, cursor:'pointer',
                      background: isSel ? `${vc}22` : 'rgba(255,255,255,.04)',
                      border: `1px solid ${isSel?vc:'rgba(255,255,255,.08)'}`,
                      color: isSel?vc:'rgba(200,230,200,.4)' }}>
                    {v.name}
                  </span>
                  {isSel && (
                    <span onClick={()=>setShowColorFor(showColorFor===v.id?null:v.id)}
                      style={{ width:12, height:12, borderRadius:'50%', background:vc, cursor:'pointer',
                        boxShadow:`0 0 4px ${vc}80`, flexShrink:0 }}/>
                  )}
                  {showColorFor===v.id && (
                    <div style={{ position:'absolute', top:'100%', left:0, zIndex:100,
                      background:'#0D0D1F', border:'1px solid rgba(0,250,154,.3)',
                      borderRadius:5, padding:6, display:'flex', flexWrap:'wrap', gap:4, width:120, marginTop:2 }}>
                      {DEFAULT_CHART_COLORS.map(c=>(
                        <span key={c} onClick={()=>{setChartColors(p=>({...p,[v.id]:c}));setShowColorFor(null)}}
                          style={{ width:18, height:18, borderRadius:'50%', background:c, cursor:'pointer',
                            outline: chartColors[v.id]===c?'2px solid #fff':'2px solid transparent' }}/>
                      ))}
                    </div>
                  )}
                </span>
              )
            })}
          </div>

          {/* Multi-axis hint */}
          {needsIndependentAxes && selectedNumVars.length > 1 && (
            <div style={{ fontSize:10, color:C.gold, marginBottom:4, flexShrink:0, opacity:.7 }}>
              ⚡ Trục Y độc lập (phạm vi khác nhau). Click đường/legend để chuyển trục.
            </div>
          )}
        </>
      )}

      {/* Content */}
      <div style={{ flex:1, minHeight:0, overflow:'hidden', display:'flex', flexDirection:'column' }}>
        {tab === 'chart' && renderChart()}
        {tab === 'stats' && renderStats()}
        {tab === 'corr' && renderCorr()}
        {tab === 'model' && renderModel()}
        {tab === 'advisor' && renderAdvisor()}
      </div>
    </div>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const thS = { padding:'6px 10px', textAlign:'left', fontSize:11, borderBottom:'1px solid rgba(191,95,255,.2)',
  color:'rgba(200,230,200,.5)', fontWeight:400 }
const tdS = { padding:'5px 10px', fontSize:12, borderBottom:'1px solid rgba(191,95,255,.05)' }

function hexToRgb(hex) {
  const h = hex?.replace('#','') || '00FA9A'
  return `${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)}`
}
