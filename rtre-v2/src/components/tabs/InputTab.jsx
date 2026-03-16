import { useState, useRef } from 'react'
import { ref, push, update, remove } from 'firebase/database'
import { db } from '../../firebase.js'
import { Btn, HoloPanel } from '../ui/index.jsx'
import { C } from '../../theme.js'

export const VAR_TYPES = [
  { value:'number',label:'Số liên tục' },{ value:'integer',label:'Số nguyên' },
  { value:'percent',label:'Phần trăm (%)' },{ value:'binary',label:'Nhị phân 0/1' },
  { value:'ordinal',label:'Thứ hạng' },{ value:'categorical',label:'Phân loại' },
  { value:'string',label:'Văn bản' },{ value:'id',label:'Mã / ID' },
  { value:'name',label:'Tên đối tượng' },{ value:'date',label:'Ngày tháng' },
  { value:'image',label:'Hình ảnh (clipboard)' },
]
export const isNumType = t => ['number','integer','percent','ordinal','binary'].includes(t)

export function InputTab({ project }) {
  const [row, setRow] = useState({})
  const [popup, setPopup] = useState(false)
  const [nv, setNv] = useState({ name:'', codeName:'', type:'number' })
  const [ok, setOk] = useState(false)
  const [saving, setSaving] = useState(false)
  const [csvErr, setCsvErr] = useState('')
  const dragIdx = useRef(null)
  const [dragOver, setDragOver] = useState(null)

  const sortedVars = [...project.variables].sort((a,b)=>(a.order??0)-(b.order??0))

  const onDragStart=idx=>{dragIdx.current=idx}
  const onDragOver=(e,idx)=>{e.preventDefault();setDragOver(idx)}
  const onDrop=async(e,idx)=>{e.preventDefault();setDragOver(null);const from=dragIdx.current;if(from===null||from===idx)return;const re=[...sortedVars];const[m]=re.splice(from,1);re.splice(idx,0,m);dragIdx.current=null;const up={};re.forEach((v,i)=>{up[`projects/${project.id}/variables/${v.id}/order`]=i});await update(ref(db),up)}

  // CSV Upload — auto-detect number types
  const handleCSV = e => {
    const file = e.target.files[0]; if (!file) return
    setCsvErr('Đang xử lý...')
    const reader = new FileReader()
    reader.onload = async evt => {
      try {
        const lines = evt.target.result.split(/\r?\n/).filter(l=>l.trim())
        if (lines.length < 2) return setCsvErr('Cần ít nhất 1 header + 1 dòng')
        const headers = parseCSV(lines[0])
        // Detect types from data
        const dataLines = lines.slice(1).map(l => parseCSV(l)).filter(cells => cells.some(c=>c.trim()))
        const existingNames = sortedVars.map(v => v.name.toLowerCase())
        const varMap = {}
        sortedVars.forEach(v => { varMap[v.name.toLowerCase()] = v.id })
        let nextOrder = sortedVars.length
        for (let hi = 0; hi < headers.length; hi++) {
          const h = headers[hi]
          if (!existingNames.includes(h.toLowerCase())) {
            // Auto-detect type
            const colVals = dataLines.map(r => r[hi]?.trim()).filter(Boolean)
            let type = 'string'
            if (colVals.length > 0) {
              const allNum = colVals.every(v => !isNaN(Number(v)))
              if (allNum) {
                const nums = colVals.map(Number)
                const allBin = nums.every(v => v === 0 || v === 1)
                const allInt = nums.every(v => Number.isInteger(v))
                type = allBin ? 'binary' : allInt ? 'integer' : 'number'
              }
            }
            const codeName = h.replace(/\s+/g,'_').replace(/[^a-zA-Z0-9_]/g,'').toLowerCase()
            const vr = push(ref(db, `projects/${project.id}/variables`), { name: h, codeName, type, order: nextOrder++ })
            varMap[h.toLowerCase()] = vr.key
          }
        }
        await new Promise(r=>setTimeout(r,700))
        let pushed = 0
        for (const cells of dataLines) {
          if (cells.every(c=>!c.trim())) continue
          const rowObj = { createdAt: Date.now() }
          headers.forEach((h,ci) => {
            const vid = varMap[h.toLowerCase()]
            if (!vid) return
            const val = cells[ci] ?? ''
            // Try to store as number if numeric
            const num = Number(val)
            rowObj[vid] = val !== '' && !isNaN(num) ? num : val
          })
          await push(ref(db, `projects/${project.id}/rows`), rowObj)
          pushed++
        }
        setCsvErr(`✓ Import ${pushed} dòng, ${headers.length} cột`)
      } catch(err) { setCsvErr('Lỗi: '+err.message) }
    }
    reader.readAsText(file,'UTF-8')
    e.target.value=''
  }

  const parseCSV = line => { const res=[]; let cur='',inQ=false; for(let i=0;i<line.length;i++){if(line[i]==='"')inQ=!inQ;else if(line[i]===','&&!inQ){res.push(cur.trim());cur=''}else cur+=line[i]} res.push(cur.trim()); return res }

  const addVar = async () => {
    if (!nv.name.trim()) return
    const codeName = nv.codeName.trim() || nv.name.trim().replace(/\s+/g,'_').replace(/[^a-zA-Z0-9_]/g,'').toLowerCase()
    await push(ref(db, `projects/${project.id}/variables`), { name: nv.name.trim(), codeName, type: nv.type, order: sortedVars.length })
    setPopup(false); setNv({ name:'', codeName:'', type:'number' })
  }

  const deleteVar = (vid, vname) => {
    if (!window.confirm(`Xóa biến "${vname}"?`)) return
    remove(ref(db, `projects/${project.id}/variables/${vid}`))
  }

  const clearAllRows = () => {
    if (!window.confirm(`Xóa toàn bộ ${project.rows.length} dòng?`)) return
    remove(ref(db, `projects/${project.id}/rows`))
  }

  const submit = async () => {
    setSaving(true)
    const nr = { createdAt: Date.now() }
    sortedVars.forEach(v => { const val = row[v.id]; nr[v.id] = v.type==='image' ? (val||'') : isNumType(v.type) && val!==''&&val!==undefined ? Number(val) : (val??'') })
    try { await push(ref(db, `projects/${project.id}/rows`), nr); setRow({}); setOk(true); setTimeout(()=>setOk(false),2000) }
    catch(e) { alert('Lỗi: '+e.message) } finally { setSaving(false) }
  }

  const handlePaste = (e, vid) => { const items = e.clipboardData?.items; if(!items)return; for(const item of items){if(item.type.startsWith('image/')){e.preventDefault();const f=item.getAsFile();const r=new FileReader();r.onload=ev=>setRow(p=>({...p,[vid]:ev.target.result}));r.readAsDataURL(f);return}} }

  const renderField = v => {
    const val = row[v.id]
    if (v.type==='image') return <div tabIndex={0} onPaste={e=>handlePaste(e,v.id)} style={{background:'rgba(255,255,255,.04)',border:'1px dashed rgba(255,255,255,.15)',borderRadius:5,padding:'6px 10px',fontSize:12,color:'rgba(200,230,200,.4)',cursor:'text',minHeight:32,display:'flex',alignItems:'center',gap:6}}>
      {val?<><img src={val} alt="" style={{width:24,height:24,objectFit:'cover',borderRadius:3,border:'1px solid rgba(0,250,154,.3)'}}/><span style={{color:C.green,fontSize:11}}>✓</span><span onClick={()=>setRow(p=>({...p,[v.id]:''})) } style={{color:C.pink,cursor:'pointer',fontSize:11,marginLeft:'auto'}}>✕</span></>:<span>Ctrl+V dán ảnh</span>}</div>
    if (v.type==='binary') return <select value={val??''} onChange={e=>setRow(p=>({...p,[v.id]:e.target.value}))} style={{fontSize:13}}><option value="">—</option><option value="0">0 — Không</option><option value="1">1 — Có</option></select>
    if (v.type==='date') return <input type="date" value={val||''} onChange={e=>setRow(p=>({...p,[v.id]:e.target.value}))} style={{fontSize:13}}/>
    if (isNumType(v.type)) return <input type="number" value={val||''} onChange={e=>setRow(p=>({...p,[v.id]:e.target.value}))} placeholder="0" step={v.type==='integer'?1:0.01} style={{fontSize:13}}/>
    return <input value={val||''} onChange={e=>setRow(p=>({...p,[v.id]:e.target.value}))} placeholder={v.type==='id'?'BN001':v.type==='name'?'Nguyễn Văn A':'...'} style={{fontSize:13}}/>
  }

  return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',overflow:'hidden',padding:10}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8,flexShrink:0}}>
        <span style={{fontFamily:'Orbitron',fontSize:10,color:C.cyan,letterSpacing:'2px'}}>◈ INPUT</span>
        <div style={{display:'flex',gap:6}}>
          <label style={{cursor:'pointer',margin:0}}><input type="file" accept=".csv" onChange={handleCSV} style={{display:'none'}}/><span style={{background:'rgba(255,215,0,.07)',border:`1px solid ${C.gold}60`,color:C.gold,padding:'4px 9px',borderRadius:4,fontSize:11,fontFamily:'Orbitron',letterSpacing:'1px',cursor:'pointer',textTransform:'uppercase',display:'inline-block'}}>↑ CSV</span></label>
          <Btn onClick={()=>setPopup(true)} color={C.cyan} small>+ Biến</Btn>
        </div>
      </div>
      {csvErr&&<div style={{fontSize:12,marginBottom:6,padding:'5px 10px',borderRadius:4,flexShrink:0,color:csvErr.startsWith('✓')?C.green:csvErr==='Đang xử lý...'?C.gold:C.pink,background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.08)'}}>{csvErr}</div>}
      <div style={{flex:1,overflow:'auto',minHeight:0}}>
        {sortedVars.length===0&&<div style={{color:'rgba(200,230,200,.25)',fontSize:13,padding:20,textAlign:'center',border:'1px dashed rgba(255,255,255,.07)',borderRadius:5,lineHeight:2}}>Chưa có biến. Nhấn "+ Biến" hoặc upload CSV.</div>}
        {sortedVars.map((v,idx)=>(
          <div key={v.id} draggable onDragStart={()=>onDragStart(idx)} onDragOver={e=>onDragOver(e,idx)} onDrop={e=>onDrop(e,idx)} onDragEnd={()=>setDragOver(null)}
            style={{display:'grid',gridTemplateColumns:'18px 1fr 44px 16px',gap:4,alignItems:'center',marginBottom:5,padding:'5px 7px',
              background:dragOver===idx?'rgba(0,229,255,.08)':'rgba(255,255,255,.025)',border:`1px solid ${dragOver===idx?C.cyan:'rgba(255,255,255,.06)'}`,borderRadius:5,cursor:'grab'}}>
            <span style={{color:'rgba(200,230,200,.2)',fontSize:14,cursor:'grab',textAlign:'center',userSelect:'none'}}>⠿</span>
            <div>
              <div style={{fontSize:11,color:'rgba(200,230,200,.45)',marginBottom:2}}>{v.name}{v.codeName&&<span style={{fontSize:9,color:'rgba(200,230,200,.18)',marginLeft:4}}>({v.codeName})</span>}</div>
              {renderField(v)}
            </div>
            <span style={{fontSize:9,color:'rgba(200,230,200,.22)',textAlign:'right',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{v.type==='image'?'🖼':v.type}</span>
            <span onClick={e=>{e.stopPropagation();deleteVar(v.id,v.name)}} style={{color:'rgba(255,45,120,.2)',cursor:'pointer',fontSize:11,textAlign:'center'}} onMouseEnter={e=>e.currentTarget.style.color=C.pink} onMouseLeave={e=>e.currentTarget.style.color='rgba(255,45,120,.2)'}>✕</span>
          </div>
        ))}
      </div>
      <div style={{marginTop:8,flexShrink:0}}>
        <div style={{display:'flex',gap:6}}>
          <Btn onClick={submit} disabled={sortedVars.length===0||saving} color={C.cyan} style={{flex:1,justifyContent:'center',padding:'10px',fontSize:13}}>{saving?'◌ ...':'+ Thêm dòng'}</Btn>
          {project.rows.length>0&&<Btn onClick={clearAllRows} color={C.pink} outline small style={{padding:'10px 8px',fontSize:9}} title="Xóa toàn bộ dữ liệu">🗑</Btn>}
        </div>
        <div style={{marginTop:5,fontSize:11,color:'rgba(200,230,200,.2)',display:'flex',justifyContent:'space-between'}}><span>{project.rows.length} dòng · {sortedVars.length} biến</span>{ok&&<span style={{color:C.green}}>✓ Đã lưu</span>}</div>
      </div>
      {popup&&<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.8)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}}><div className="fade-in" style={{width:380,maxWidth:'90vw'}}><HoloPanel style={{padding:26}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:22}}><div style={{fontFamily:'Orbitron',fontSize:11,color:C.cyan}}>+ THÊM BIẾN</div><span onClick={()=>setPopup(false)} style={{color:'rgba(200,230,200,.4)',cursor:'pointer',fontSize:20}}>✕</span></div>
        <div style={{marginBottom:14}}><label style={{fontSize:13,color:'rgba(200,230,200,.5)',display:'block',marginBottom:5}}>TÊN BIẾN *</label><input value={nv.name} onChange={e=>setNv(p=>({...p,name:e.target.value}))} placeholder="Creatinine, Tuổi..." autoFocus onKeyDown={e=>e.key==='Enter'&&nv.name.trim()&&addVar()}/></div>
        <div style={{marginBottom:14}}><label style={{fontSize:13,color:'rgba(200,230,200,.5)',display:'block',marginBottom:5}}>TÊN MÃ HÓA <span style={{fontSize:10,color:'rgba(200,230,200,.25)'}}>( code name )</span></label><input value={nv.codeName} onChange={e=>setNv(p=>({...p,codeName:e.target.value}))} placeholder={nv.name?nv.name.replace(/\s+/g,'_').replace(/[^a-zA-Z0-9_]/g,'').toLowerCase():'vd: creatinine'} style={{fontSize:13}}/></div>
        <div style={{marginBottom:22}}><label style={{fontSize:13,color:'rgba(200,230,200,.5)',display:'block',marginBottom:5}}>LOẠI BIẾN</label><select value={nv.type} onChange={e=>setNv(p=>({...p,type:e.target.value}))}>{VAR_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}</select>{nv.type==='image'&&<div style={{fontSize:11,color:C.gold,marginTop:6,opacity:.7}}>💡 Ctrl+V dán ảnh khi nhập dữ liệu</div>}</div>
        <div style={{display:'flex',gap:10}}><Btn onClick={addVar} color={C.cyan} disabled={!nv.name.trim()} style={{flex:1,justifyContent:'center',padding:'10px',fontSize:13}}>Thêm biến</Btn><Btn onClick={()=>setPopup(false)} color={C.pink} outline style={{padding:'10px 16px',fontSize:13}}>Hủy</Btn></div>
      </HoloPanel></div></div>}
    </div>
  )
}
