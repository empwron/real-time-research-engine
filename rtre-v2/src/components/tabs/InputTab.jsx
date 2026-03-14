import { useState } from 'react'
import { ref, push, update, remove } from 'firebase/database'
import { db } from '../../firebase.js'
import { Btn, HoloPanel } from '../ui/index.jsx'
import { C } from '../../theme.js'

export const VAR_TYPES = [
  { value:'number',      label:'Số liên tục (number)' },
  { value:'binary',      label:'Nhị phân 0/1 (binary)' },
  { value:'categorical', label:'Phân loại (categorical)' },
  { value:'ordinal',     label:'Thứ hạng (ordinal)' },
  { value:'string',      label:'Chuỗi văn bản (string)' },
  { value:'id',          label:'Mã / ID mẫu' },
  { value:'name',        label:'Tên bệnh nhân / đối tượng' },
  { value:'date',        label:'Ngày tháng (date)' },
  { value:'percent',     label:'Phần trăm (%)' },
  { value:'integer',     label:'Số nguyên (integer)' },
]

const isNumericType = t => ['number','ordinal','binary','percent','integer'].includes(t)

export function InputTab({ project }) {
  const [row, setRow]       = useState({})
  const [popup, setPopup]   = useState(false)
  const [nv, setNv]         = useState({ name:'', group:'', type:'number' })
  const [ok, setOk]         = useState(false)
  const [saving, setSaving] = useState(false)
  const [csvErr, setCsvErr] = useState('')

  const groups = [...new Set(project.variables.map(v=>v.group).filter(Boolean))]

  // ─── Reorder variable ─────────────────────────────────────────────────────
  const moveVar = async (idx, dir) => {
    const vars = [...project.variables]
    const swapIdx = idx + dir
    if (swapIdx < 0 || swapIdx >= vars.length) return
    // swap order values
    const aId = vars[idx].id, bId = vars[swapIdx].id
    const aOrd = vars[idx].order ?? idx
    const bOrd = vars[swapIdx].order ?? swapIdx
    await update(ref(db, `projects/${project.id}/variables/${aId}`), { order: bOrd })
    await update(ref(db, `projects/${project.id}/variables/${bId}`), { order: aOrd })
  }

  // Sort variables by order field
  const sortedVars = [...project.variables].sort((a,b) => (a.order??0) - (b.order??0))

  // ─── Submit single row ────────────────────────────────────────────────────
  const submit = async () => {
    setSaving(true)
    const nr = { createdAt: Date.now() }
    sortedVars.forEach(v => {
      const val = row[v.id]
      nr[v.id] = isNumericType(v.type) && val !== '' && val !== undefined
        ? Number(val) : (val ?? '')
    })
    try {
      await push(ref(db, `projects/${project.id}/rows`), nr)
      setRow({}); setOk(true); setTimeout(()=>setOk(false), 2500)
    } catch(e) { alert('Lỗi Firebase: ' + e.message) }
    finally { setSaving(false) }
  }

  // ─── CSV Upload ───────────────────────────────────────────────────────────
  const handleCSV = e => {
    const file = e.target.files[0]; if (!file) return
    setCsvErr('')
    const reader = new FileReader()
    reader.onload = async evt => {
      try {
        const text = evt.target.result
        const lines = text.split(/\r?\n/).filter(l=>l.trim())
        if (lines.length < 2) return setCsvErr('File CSV cần ít nhất 1 dòng header và 1 dòng dữ liệu')

        // Parse header
        const headers = parseCSVLine(lines[0])

        // Create variables if not exist (match by name)
        const existingNames = sortedVars.map(v=>v.name.toLowerCase())
        const varMap = {} // header name → variable id

        // Map existing vars
        sortedVars.forEach(v => { varMap[v.name.toLowerCase()] = v.id })

        // Create new vars for headers not yet defined
        let nextOrder = sortedVars.length
        for (const h of headers) {
          const key = h.toLowerCase()
          if (!existingNames.includes(key)) {
            const newRef = push(ref(db, `projects/${project.id}/variables`), {
              name: h, group: 'CSV Import', type: 'string', order: nextOrder++
            })
            varMap[key] = newRef.key
          }
        }

        // Wait a bit for vars to settle then push rows
        await new Promise(r => setTimeout(r, 800))

        // Re-fetch latest vars from project (use current varMap)
        let pushed = 0
        for (let i = 1; i < lines.length; i++) {
          const cells = parseCSVLine(lines[i])
          if (cells.every(c=>!c.trim())) continue
          const rowObj = { createdAt: Date.now() }
          headers.forEach((h, ci) => {
            const vid = varMap[h.toLowerCase()]
            if (vid) rowObj[vid] = cells[ci] ?? ''
          })
          await push(ref(db, `projects/${project.id}/rows`), rowObj)
          pushed++
        }
        setCsvErr(`✓ Đã import ${pushed} dòng từ CSV`)
      } catch(err) { setCsvErr('Lỗi parse CSV: ' + err.message) }
    }
    reader.readAsText(file, 'UTF-8')
    e.target.value = ''
  }

  const parseCSVLine = line => {
    const result = []; let cur = ''; let inQ = false
    for (let i=0;i<line.length;i++) {
      if (line[i]==='"') { inQ=!inQ }
      else if (line[i]===','&&!inQ) { result.push(cur.trim()); cur='' }
      else cur+=line[i]
    }
    result.push(cur.trim()); return result
  }

  // ─── Add variable ─────────────────────────────────────────────────────────
  const addVar = async () => {
    if (!nv.name.trim()) return
    await push(ref(db, `projects/${project.id}/variables`), {
      name: nv.name.trim(), group: nv.group || 'Chung', type: nv.type,
      order: sortedVars.length
    })
    setPopup(false); setNv({ name:'', group:'', type:'number' })
  }

  const renderField = v => (
    <div key={v.id} style={{ marginBottom:4 }}>
      <label style={{ fontSize:12 }}>{v.name}</label>
      {v.type === 'binary' ? (
        <select value={row[v.id]??''} onChange={e=>setRow(p=>({...p,[v.id]:e.target.value}))}>
          <option value="">—</option>
          <option value="0">0 — Không / Âm</option>
          <option value="1">1 — Có / Dương</option>
        </select>
      ) : isNumericType(v.type) ? (
        <input type="number" value={row[v.id]||''}
          onChange={e=>setRow(p=>({...p,[v.id]:e.target.value}))}
          placeholder={v.type==='percent'?'0–100':v.type==='integer'?'0':'0.0'}
          step={v.type==='integer'?1:0.01}/>
      ) : v.type === 'date' ? (
        <input type="date" value={row[v.id]||''}
          onChange={e=>setRow(p=>({...p,[v.id]:e.target.value}))}/>
      ) : (
        <input value={row[v.id]||''}
          onChange={e=>setRow(p=>({...p,[v.id]:e.target.value}))}
          placeholder={v.type==='id'?'BN001':v.type==='name'?'Nguyễn Văn A':'Nhập...'}/>
      )}
    </div>
  )

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', overflow:'hidden', padding:14 }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12, flexShrink:0 }}>
        <div style={{ fontFamily:'Orbitron,sans-serif', fontSize:11, color:C.green, letterSpacing:'2px' }}>◈ INPUT</div>
        <div style={{ display:'flex', gap:8 }}>
          <label style={{ cursor:'pointer', margin:0 }}>
            <input type="file" accept=".csv" onChange={handleCSV} style={{ display:'none' }}/>
            <span style={{
              background:'rgba(255,215,0,.07)', border:`1px solid ${C.gold}70`,
              color:C.gold, padding:'4px 10px', borderRadius:4,
              fontFamily:'Orbitron,sans-serif', fontSize:9, letterSpacing:'1.5px',
              textTransform:'uppercase', cursor:'pointer', whiteSpace:'nowrap'
            }}>↑ CSV</span>
          </label>
          <Btn onClick={()=>setPopup(true)} color={C.blue} small>+ Thêm biến</Btn>
        </div>
      </div>

      {csvErr && (
        <div style={{ fontSize:12, marginBottom:10, padding:'6px 10px', borderRadius:4, flexShrink:0,
          color:csvErr.startsWith('✓')?C.green:C.pink,
          background:csvErr.startsWith('✓')?'rgba(0,250,154,.07)':'rgba(255,45,120,.07)',
          border:`1px solid ${csvErr.startsWith('✓')?'rgba(0,250,154,.2)':'rgba(255,45,120,.2)'}` }}>
          {csvErr}
        </div>
      )}

      {/* Variable list with reorder + field input */}
      <div style={{ flex:1, overflow:'auto' }}>
        {sortedVars.length === 0 && (
          <div style={{ color:'rgba(200,230,200,.28)', fontSize:13, padding:24, textAlign:'center',
            border:'1px dashed rgba(0,250,154,.12)', borderRadius:6, lineHeight:2 }}>
            Chưa có biến nào.<br/>
            Nhấn "+ Thêm biến" hoặc upload file CSV.
          </div>
        )}

        {sortedVars.map((v, idx) => (
          <div key={v.id} style={{ display:'flex', gap:8, alignItems:'flex-start', marginBottom:10,
            padding:'8px 10px', background:'rgba(0,250,154,.025)',
            border:'1px solid rgba(0,250,154,.08)', borderRadius:5 }}>
            {/* Reorder buttons */}
            <div style={{ display:'flex', flexDirection:'column', gap:2, flexShrink:0, paddingTop:18 }}>
              <span onClick={()=>moveVar(idx,-1)}
                style={{ color:idx===0?'rgba(200,230,200,.15)':C.green, cursor:idx===0?'default':'pointer',
                  fontSize:12, lineHeight:1, userSelect:'none' }}>▲</span>
              <span onClick={()=>moveVar(idx,1)}
                style={{ color:idx===sortedVars.length-1?'rgba(200,230,200,.15)':C.green,
                  cursor:idx===sortedVars.length-1?'default':'pointer',
                  fontSize:12, lineHeight:1, userSelect:'none' }}>▼</span>
            </div>
            {/* Field */}
            <div style={{ flex:1 }}>
              {renderField(v)}
            </div>
            {/* Type badge */}
            <div style={{ flexShrink:0, paddingTop:20, fontSize:10,
              color:'rgba(200,230,200,.3)', whiteSpace:'nowrap' }}>{v.type}</div>
          </div>
        ))}
      </div>

      {/* Submit */}
      <div style={{ marginTop:10, display:'flex', gap:10, alignItems:'center', flexShrink:0 }}>
        <Btn onClick={submit} disabled={sortedVars.length===0||saving}
          style={{ flex:1, justifyContent:'center' }}>
          {saving ? '◌ Đang lưu...' : '+ Thêm dòng'}
        </Btn>
        {ok && <span style={{ color:C.green, fontSize:12 }}>✓ Đã lưu</span>}
      </div>
      <div style={{ marginTop:5, fontSize:11, color:'rgba(200,230,200,.2)', flexShrink:0 }}>
        {project.rows.length} dòng · {sortedVars.length} biến · Realtime ◉
      </div>

      {/* New Variable Popup */}
      {popup && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.8)',
          display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div className="fade-in" style={{ width:400, maxWidth:'90vw' }}>
            <HoloPanel style={{ padding:28 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
                <div style={{ fontFamily:'Orbitron,sans-serif', fontSize:11, color:C.blue }}>◈ THÊM BIẾN MỚI</div>
                <span onClick={()=>setPopup(false)}
                  style={{ color:'rgba(200,230,200,.4)', cursor:'pointer', fontSize:20, lineHeight:1 }}>✕</span>
              </div>
              <div style={{ marginBottom:14 }}>
                <label>TÊN BIẾN *</label>
                <input value={nv.name} onChange={e=>setNv(p=>({...p,name:e.target.value}))}
                  placeholder="Creatinine, Tuổi, Tên BN, ID mẫu..." autoFocus/>
              </div>
              <div style={{ marginBottom:14 }}>
                <label>NHÓM</label>
                <input value={nv.group} onChange={e=>setNv(p=>({...p,group:e.target.value}))}
                  placeholder="Lâm sàng, Biomarker, Hành chính..." list="grp-list"/>
                <datalist id="grp-list">{groups.map(g=><option key={g} value={g}/>)}</datalist>
              </div>
              <div style={{ marginBottom:22 }}>
                <label>LOẠI BIẾN</label>
                <select value={nv.type} onChange={e=>setNv(p=>({...p,type:e.target.value}))}>
                  {VAR_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div style={{ padding:'10px 12px', background:'rgba(0,191,255,.05)',
                border:'1px solid rgba(0,191,255,.18)', borderRadius:4,
                fontSize:12, color:'rgba(200,230,200,.5)', marginBottom:20, lineHeight:1.8 }}>
                ⚠ Xác nhận thêm biến <strong style={{ color:C.blue }}>{nv.name||'...'}</strong>?<br/>
                Các dòng hiện có sẽ để trống tại cột này.
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <Btn onClick={addVar} color={C.blue} disabled={!nv.name.trim()}
                  style={{ flex:1, justifyContent:'center' }}>Xác nhận thêm</Btn>
                <Btn onClick={()=>setPopup(false)} color={C.pink} outline>Hủy</Btn>
              </div>
            </HoloPanel>
          </div>
        </div>
      )}
    </div>
  )
}
