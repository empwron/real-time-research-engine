import React, { useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, ScatterChart, Scatter } from 'recharts'
import { C, CHART_COLORS } from '../../theme.js'

const CHART_TYPES = [
  { id: 'line', name: 'Line Chart', desc: 'Xem xu hướng liên tục (TD: Nhịp tim theo thời gian).' },
  { id: 'bar', name: 'Bar Chart', desc: 'So sánh mức độ giữa các nhóm.' },
  { id: 'scatter', name: 'Scatter Plot', desc: 'Đánh giá độ phân tán và tương quan.' }
];

export function ChartTab({ project }) {
  const [chartType, setChartType] = useState('line')
  const [selectedVars, setSelectedVars] = useState([])
  const [colors, setColors] = useState({})
  const [activeYAxis, setActiveYAxis] = useState(null)
  const [zoom, setZoom] = useState(1)

  const chartableVars = project.variables.filter(v => v.type !== 'image' && v.type !== 'id' && v.type !== 'name')
  const rows = project.rows || []

  // Xử lý bật tắt biến
  const toggleVar = (vid) => {
    setSelectedVars(prev => {
      if(prev.includes(vid)) return prev.filter(id => id !== vid)
      if(!colors[vid]) {
        const rndCol = CHART_COLORS[prev.length % CHART_COLORS.length];
        setColors(c => ({...c, [vid]: rndCol}))
      }
      return [...prev, vid]
    })
  }

  const renderChart = () => {
    if(selectedVars.length === 0) return <div style={{color:'rgba(255,255,255,.3)', textAlign:'center', marginTop: 50}}>Hãy chọn biến để vẽ biểu đồ.</div>
    
    // Multi-YAxis Logic:
    // Nếu activeYAxis có giá trị (người dùng click vào legend/đường), chỉ hiện trục của biến đó
    // Nếu nhiều biến, tạo nhiều YAxis. Nếu chỉ 1 biến, dùng 1.
    return (
      <ResponsiveContainer width="100%" height="100%">
        {chartType === 'line' ? (
          <LineChart data={rows} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.1)" />
            <XAxis dataKey="createdAt" stroke="#ccc" tickFormatter={v=>new Date(v).toLocaleTimeString()} />
            <Tooltip contentStyle={{backgroundColor:'#111', border:`1px solid ${C.green}`}} />
            <Legend onClick={(e)=>setActiveYAxis(e.dataKey === activeYAxis ? null : e.dataKey)} cursor="pointer" />
            
            {selectedVars.map((vid, idx) => (
              (!activeYAxis || activeYAxis === vid) && 
              <YAxis key={`y-${vid}`} yAxisId={vid} orientation={idx % 2 === 0 ? 'left' : 'right'} stroke={colors[vid]} />
            ))}

            {selectedVars.map(vid => (
              <Line key={vid} yAxisId={vid} type="monotone" dataKey={vid} stroke={colors[vid]} activeDot={{ r: 8 }} />
            ))}
          </LineChart>
        ) : chartType === 'bar' ? (
          <BarChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.1)" />
            <XAxis stroke="#ccc" />
            <Tooltip contentStyle={{backgroundColor:'#111', border:`1px solid ${C.green}`}} />
            <Legend onClick={(e)=>setActiveYAxis(e.dataKey === activeYAxis ? null : e.dataKey)} cursor="pointer" />
            {selectedVars.map((vid, idx) => (
              (!activeYAxis || activeYAxis === vid) && 
              <YAxis key={`y-${vid}`} yAxisId={vid} orientation={idx % 2 === 0 ? 'left' : 'right'} stroke={colors[vid]} />
            ))}
            {selectedVars.map(vid => <Bar key={vid} yAxisId={vid} dataKey={vid} fill={colors[vid]} />)}
          </BarChart>
        ) : (
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.1)" />
            <XAxis dataKey={selectedVars[0]} type="number" name={selectedVars[0]} stroke="#ccc" />
            <YAxis dataKey={selectedVars[1] || selectedVars[0]} type="number" name={selectedVars[1]} stroke="#ccc" />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{backgroundColor:'#111', border:`1px solid ${C.green}`}} />
            <Scatter name="Data" data={rows} fill={colors[selectedVars[0]]} />
          </ScatterChart>
        )}
      </ResponsiveContainer>
    )
  }

  return (
    <div style={{ padding: 16, height: '100%', display: 'flex', flexDirection: 'column' }}>
       <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginBottom: '10px' }}>
        <span style={{ color: C.green, fontSize: 12, cursor: 'pointer' }} onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}>Zoom Out -</span>
        <span style={{ color: C.green, fontSize: 12 }}>{(zoom * 100).toFixed(0)}%</span>
        <span style={{ color: C.green, fontSize: 12, cursor: 'pointer' }} onClick={() => setZoom(z => Math.min(2, z + 0.1))}>Zoom In +</span>
      </div>

      <div style={{ zoom: zoom, display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        <select value={chartType} onChange={e=>setChartType(e.target.value)}
          style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', color: '#fff', padding: 8, borderRadius: 4 }}>
          {CHART_TYPES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        
        <div className="group" style={{ position: 'relative', cursor: 'help' }}>
          <span style={{ display:'inline-block', width:20, height:20, borderRadius:'50%', background:'rgba(255,255,255,.1)', textAlign:'center', color:'#ccc', fontSize:12, lineHeight:'20px' }}>?</span>
          <div style={{ position: 'absolute', top: '100%', left: 0, width: 250, background: '#111', padding: 10, border: `1px solid ${C.green}`, borderRadius: 4, color: '#fff', fontSize: 11, display: 'none', zIndex: 100 }} className="group-hover">
             {CHART_TYPES.find(t=>t.id === chartType)?.desc}
             <br/><br/>
             <span style={{color: C.gold}}>Mẹo: Click vào tên biến trên Legend để chỉ xem 1 trục tung (Isolate Y-Axis).</span>
          </div>
        </div>

        {/* Danh sách biến */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginLeft: 20 }}>
          {chartableVars.map(v => (
            <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,.05)', padding: '4px 8px', borderRadius: 4 }}>
              <input type="checkbox" checked={selectedVars.includes(v.id)} onChange={() => toggleVar(v.id)} />
              <span style={{ color: '#fff', fontSize: 12 }}>{v.encodedName || v.name}</span>
              {selectedVars.includes(v.id) && (
                <input type="color" value={colors[v.id]} onChange={e => setColors({...colors, [v.id]: e.target.value})}
                  style={{ width: 20, height: 20, padding: 0, border: 'none', cursor: 'pointer', background: 'transparent' }} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, zoom: zoom }}>
        {renderChart()}
      </div>
    </div>
  )
}