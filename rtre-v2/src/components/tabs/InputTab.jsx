import { useState, useRef } from 'react'
import { ref, push, update, remove } from 'firebase/database'
import { db } from '../../firebase.js'
import { Btn, HoloPanel } from '../ui/index.jsx'
import { C } from '../../theme.js'

export const VAR_TYPES = [
  { value:'number',      label:'Số liên tục' },
  { value:'integer',     label:'Số nguyên' },
  { value:'percent',     label:'Phần trăm (%)' },
  { value:'binary',      label:'Nhị phân 0/1' },
  { value:'ordinal',     label:'Thứ hạng' },
  { value:'categorical', label:'Phân loại' },
  { value:'string',      label:'Văn bản / String' },
  { value:'id',          label:'Mã / ID mẫu' },
  { value:'name',        label:'Tên đối tượng' },
  { value:'date',        label:'Ngày tháng' },
  { value:'image',       label:'Hình ảnh (clipboard)' },
]

export const isNumType = t => ['number','integer','percent','ordinal','binary'].includes(t)

export function InputTab({ project }) {
  const [row, setRow]       = useState({})
  const [popup, setPopup]   = useState(false)
  const [nv, setNv]         = useState({ name:'', codeName:'', type:'number' })
  const [ok, setOk]         = useState(false)
  const [saving, setSaving] = useState(false)
  const [csvErr, setCsvErr] = useState('')
  const dragIdx             = useRef(null)
  const [dragOver, setDragOver] = useState(null)

  const sortedVars = [...project.variables].sort((a,b)=>(a.order??0)-(b.order??0))

  // ─── Drag-drop reorder ────────────────────────────────────────────────────
  const onDragStart = idx => { dragIdx.current = idx }
  const onDragOver  = (e, idx) => { e.preventDefault(); setDragOver(idx) }
  const onDrop      = async (e, idx) => {
    e.preventDefault()
    setDragOver(null)
    const from = dragIdx.current
    if (from === null || from === idx) return
    const reordered = [...sortedVars]
    const [moved] = reordered.splice(from, 1)
    reordered.splice(idx, 0, moved)
    dragIdx.current = null
    const updates = {}
    reordered.forEach((v, i) => { updates[`projects/${project.id}/variables/${v.id}/order`] = i })
    await update(ref(db), updates)
  }

  // ─── CSV Upload ───────────────────────────────────────────────────────────
  const handleCSV = e => {
    const file = e.target.files[0]; if (!file) return
    setCsvErr('Đang xử lý...')
    const reader = new FileReader()
    reader.onload = async evt => {
      try {
        const lines = evt.target.result.split(/\r?\n/).filter(l=>l.trim())
        if (lines.length < 2) return setCsvErr('Cần ít nhất 1 header + 1 dòng data')
        const headers = parseCSV(lines[0])
        const existingNames = sortedVars.map(v=>v.name.toLowerCase())
        const varMap = {}
        sortedVars.forEach(v => { varMap[v.name.toLowerCase()] = v.id })
        let nextOrder = sortedVars.length
        for (const h of headers) {
          if (!existingNames.includes(h.toLowerCase())) {
            const vr = push(ref(db, `projects/${project.id}/variables`), {
              name: h, codeName: h.replace(/\s+/g,'_').toLowerCase(), type:'string', order: nextOrder++
            })
            varMap[h.toLowerCase()] = vr.key
          }
        }
        await new Promise(r=>setTimeout(r,700))
        let pushed = 0
        for (let i=1;i<lines.length;i++) {
          const cells = parseCSV(lines[i])
          if (cells.every(c=>!c.trim())) continue
          const rowObj = { createdAt: Date.now() }
          headers.forEach((h,ci) => { const vid=varMap[h.toLowerCase()]; if(vid) rowObj[vid]=cells[ci]??'' })
          await push(ref(db, `projects/${project.id}/rows`), rowObj)
          pushed++
        }
        setCsvErr(`✓ Import ${pushed} dòng`)
      } catch(err) { setCsvErr('Lỗi: '+err.message) }
    }
    reader.readAsText(file,'UTF-8')
    e.target.value=''
  }

  const parseCSV = line => {
    const res=[]; let cur=''; let inQ=false
    for (let i=0;i<line.length;i++) {
      if(line[i]==='"'){inQ=!inQ}
      else if(line[i]===','&&!inQ){res.push(cur.trim());cur=''}
      else cur+=line[i]
    }
    res.push(cur.trim()); return res
  }

  // ─── Add variable ─────────────────────────────────────────────────────────
  const addVar = async () => {
    if (!nv.name.trim()) return
    const codeName = nv.codeName.trim() || nv.name.trim().replace(/\s+/g,'_').replace(/[^a-zA-Z0-9_]/g,'').toLowerCase()
    await push(ref(db, `projects/${project.id}/variables`), {
      name: nv.name.trim(), codeName, type: nv.type, order: sortedVars.length
    })
    setPopup(false); setNv({ name:'', codeName:'', type:'number' })
  }

  // ─── Submit row ───────────────────────────────────────────────────────────
  const submit = async () => {
    setSaving(true)
    const nr = { createdAt: Date.now() }
    sortedVars.forEach(v => {
      const val = row[v.id]
      if (v.type === 'image') {
        nr[v.id] = val || '' // base64 string
      } else {
        nr[v.id] = isNumType(v.type) && val!==''&&val!==undefined ? Number(val) : (val??'')
      }
    })
    try {
      await push(ref(db, `projects/${project.id}/rows`), nr)
      setRow({}); setOk(true); setTimeout(()=>setOk(false),2000)
    } catch(e) { alert('Lỗi: '+e.message) }
    finally { setSaving(false) }
  }

  // ─── Clipboard paste for image ────────────────────────────────────────────
  const handlePaste = (e, vid) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        const reader = new FileReader()
        reader.onload = ev => {
          setRow(p => ({...p, [vid]: ev.target.result}))
        }
        reader.readAsDataURL(file)
        return
      }
    }
  }

  const renderField = v => {
    const val = row[v.id]
    if (v.type === 'image') return (
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <div
          tabIndex={0}
          onPaste={e => handlePaste(e, v.id)}
          style={{ flex:1, background:'rgba(255,255,255,.04)', border:'1px dashed rgba(255,255,255,.15)',
            borderRadius:5, padding:'6px 10px', fontSize:12, color:'rgba(200,230,200,.4)',
            cursor:'text', minHeight:32, display:'flex', alignItems:'center', gap:6 }}>
          {val ? (
            <>
              <img src={val} alt="" style={{ width:24, height:24, objectFit:'cover', borderRadius:3, border:'1px solid rgba(0,250,154,.3)' }}/>
              <span style={{ color:C.green, fontSize:11 }}>✓ Đã dán</span>
              <span onClick={()=>setRow(p=>({...p,[v.id]:''})) }
                style={{ color:C.pink, cursor:'pointer', fontSize:11, marginLeft:'auto' }}>✕</span>
            </>
          ) : (
            <span>Ctrl+V để dán ảnh từ clipboard</span>
          )}
        </div>
      </div>
    )
    if (v.type==='binary') return (
      <select value={val??''} onChange={e=>setRow(p=>({...p,[v.id]:e.target.value}))}
        style={{fontSize:13}}>
        <option value="">—</option>
        <option value="0">0 — Không</option>
        <option value="1">1 — Có</option>
      </select>
    )
    if (v.type==='date') return (
      <input type="date" value={val||''} onChange={e=>setRow(p=>({...p,[v.id]:e.target.value}))} style={{fontSize:13}}/>
    )
    if (isNumType(v.type)) return (
      <input type="number" value={val||''} onChange={e=>setRow(p=>({...p,[v.id]:e.target.value}))}
        placeholder="0" step={v.type==='integer'?1:0.01} style={{fontSize:13}}/>
    )
    return (
      <input value={val||''} onChange={e=>setRow(p=>({...p,[v.id]:e.target.value}))}
        placeholder={v.type==='id'?'BN001':v.type==='name'?'Nguyễn Văn A':'...'}
        style={{fontSize:13}}/>
    )
  }

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', overflow:'hidden', padding:10 }}>
      {/* Toolbar */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
        marginBottom:8, flexShrink:0 }}>
        <span style={{ fontFamily:'Orbitron,sans-serif', fontSize:10,
          color:C.cyan, letterSpacing:'2px' }}>◈ INPUT</span>
        <div style={{ display:'flex', gap:6 }}>
          <label style={{ cursor:'pointer', margin:0 }}>
            <input type="file" accept=".csv" onChange={handleCSV} style={{display:'none'}}/>
            <span style={{ background:'rgba(255,215,0,.07)', border:`1px solid ${C.gold}60`,
              color:C.gold, padding:'4px 9px', borderRadius:4, fontSize:11,
              fontFamily:'Orbitron,sans-serif', letterSpacing:'1px', cursor:'pointer',
              textTransform:'uppercase', display:'inline-block' }}>↑ CSV</span>
          </label>
          <Btn onClick={()=>setPopup(true)} color={C.cyan} small>+ Biến</Btn>
        </div>
      </div>

      {csvErr && (
        <div style={{ fontSize:12, marginBottom:6, padding:'5px 10px', borderRadius:4, flexShrink:0,
          color:csvErr.startsWith('✓')?C.green:csvErr==='Đang xử lý...'?C.gold:C.pink,
          background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.08)' }}>
          {csvErr}
        </div>
      )}

      {/* Variable list */}
      <div style={{ flex:1, overflow:'auto', minHeight:0 }}>
        {sortedVars.length===0&&(
          <div style={{ color:'rgba(200,230,200,.25)', fontSize:13, padding:20,
            textAlign:'center', border:'1px dashed rgba(255,255,255,.07)', borderRadius:5, lineHeight:2 }}>
            Chưa có biến.<br/>Nhấn "+ Biến" hoặc upload CSV.
          </div>
        )}
        {sortedVars.map((v,idx)=>(
          <div key={v.id}
            draggable
            onDragStart={()=>onDragStart(idx)}
            onDragOver={e=>onDragOver(e,idx)}
            onDrop={e=>onDrop(e,idx)}
            onDragEnd={()=>setDragOver(null)}
            style={{ display:'grid', gridTemplateColumns:'20px 1fr 50px',
              gap:6, alignItems:'center', marginBottom:6, padding:'6px 8px',
              background:dragOver===idx?'rgba(0,229,255,.08)':'rgba(255,255,255,.025)',
              border:`1px solid ${dragOver===idx?C.cyan:'rgba(255,255,255,.06)'}`,
              borderRadius:5, cursor:'grab', transition:'border-color .15s' }}>
            <span style={{ color:'rgba(200,230,200,.2)', fontSize:14, cursor:'grab',
              textAlign:'center', userSelect:'none' }}>⠿</span>
            <div>
              <div style={{ fontSize:12, color:'rgba(200,230,200,.45)', marginBottom:3 }}>
                {v.name}
                {v.codeName && <span style={{ fontSize:10, color:'rgba(200,230,200,.2)', marginLeft:6 }}>({v.codeName})</span>}
              </div>
              {renderField(v)}
            </div>
            <span style={{ fontSize:10, color:'rgba(200,230,200,.25)', textAlign:'right',
              whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
              {v.type === 'image' ? '🖼' : v.type}
            </span>
          </div>
        ))}
      </div>

      {/* Submit */}
      <div style={{ marginTop:8, flexShrink:0 }}>
        <Btn onClick={submit} disabled={sortedVars.length===0||saving}
          color={C.cyan} style={{ width:'100%', justifyContent:'center', padding:'10px', fontSize:13 }}>
          {saving?'◌ Lưu...':'+ Thêm dòng'}
        </Btn>
        <div style={{ marginTop:5, fontSize:11, color:'rgba(200,230,200,.2)',
          display:'flex', justifyContent:'space-between' }}>
          <span>{project.rows.length} dòng · {sortedVars.length} biến</span>
          {ok&&<span style={{color:C.green}}>✓ Đã lưu</span>}
        </div>
      </div>

      {/* Add Variable Popup */}
      {popup&&(
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.8)',
          display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div className="fade-in" style={{ width:380, maxWidth:'90vw' }}>
            <HoloPanel style={{ padding:26 }}>
              <div style={{ display:'flex', justifyContent:'space-between',
                alignItems:'center', marginBottom:22 }}>
                <div style={{ fontFamily:'Orbitron,sans-serif', fontSize:11,
                  color:C.cyan }}>+ THÊM BIẾN</div>
                <span onClick={()=>setPopup(false)}
                  style={{ color:'rgba(200,230,200,.4)', cursor:'pointer', fontSize:20, lineHeight:1 }}>✕</span>
              </div>
              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:13, color:'rgba(200,230,200,.5)', display:'block', marginBottom:5 }}>
                  TÊN BIẾN *
                </label>
                <input value={nv.name} onChange={e=>setNv(p=>({...p,name:e.target.value}))}
                  placeholder="Creatinine, Tuổi, ID mẫu, Tên BN..." autoFocus
                  onKeyDown={e=>e.key==='Enter'&&nv.name.trim()&&addVar()}/>
              </div>
              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:13, color:'rgba(200,230,200,.5)', display:'block', marginBottom:5 }}>
                  TÊN MÃ HÓA <span style={{ fontSize:10, color:'rgba(200,230,200,.25)' }}>(code name, tùy chọn)</span>
                </label>
                <input value={nv.codeName} onChange={e=>setNv(p=>({...p,codeName:e.target.value}))}
                  placeholder={nv.name ? nv.name.replace(/\s+/g,'_').replace(/[^a-zA-Z0-9_]/g,'').toLowerCase() : 'vd: creatinine, age, sample_id'}
                  style={{ fontSize:13 }}/>
              </div>
              <div style={{ marginBottom:22 }}>
                <label style={{ fontSize:13, color:'rgba(200,230,200,.5)', display:'block', marginBottom:5 }}>
                  LOẠI BIẾN
                </label>
                <select value={nv.type} onChange={e=>setNv(p=>({...p,type:e.target.value}))}>
                  {VAR_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                {nv.type === 'image' && (
                  <div style={{ fontSize:11, color:C.gold, marginTop:6, opacity:.7 }}>
                    💡 Dán ảnh từ clipboard (Ctrl+V) khi nhập dữ liệu. Ảnh lưu dạng base64.
                  </div>
                )}
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <Btn onClick={addVar} color={C.cyan} disabled={!nv.name.trim()}
                  style={{ flex:1, justifyContent:'center', padding:'10px', fontSize:13 }}>
                  Thêm biến
                </Btn>
                <Btn onClick={()=>setPopup(false)} color={C.pink} outline
                  style={{ padding:'10px 16px', fontSize:13 }}>Hủy</Btn>
              </div>
            </HoloPanel>
          </div>
        </div>
      )}
    </div>
  )
}
