import { useState } from 'react'
import { ref, push } from 'firebase/database'
import { db } from '../../firebase.js'
import { Btn, HoloPanel } from '../ui/index.jsx'
import { C } from '../../theme.js'

export function InputTab({ project }) {
  const [row, setRow]     = useState({})
  const [popup, setPopup] = useState(false)
  const [nv, setNv]       = useState({ name:'', group:'', type:'number' })
  const [ok, setOk]       = useState(false)
  const [saving, setSaving] = useState(false)

  const groups = [...new Set(project.variables.map(v=>v.group).filter(Boolean))]
  const ungrouped = project.variables.filter(v => !v.group || !groups.includes(v.group))

  const submit = async () => {
    setSaving(true)
    const nr = { createdAt: Date.now() }
    project.variables.forEach(v => {
      const val = row[v.id]
      nr[v.id] = ['number','ordinal','binary'].includes(v.type) && val !== '' && val !== undefined
        ? Number(val) : (val || '')
    })
    try {
      await push(ref(db, `projects/${project.id}/rows`), nr)
      setRow({}); setOk(true); setTimeout(()=>setOk(false), 2500)
    } catch(e) { alert('Lỗi Firebase: ' + e.message) }
    finally { setSaving(false) }
  }

  const addVar = async () => {
    if (!nv.name.trim()) return
    try {
      await push(ref(db, `projects/${project.id}/variables`), {
        name: nv.name.trim(), group: nv.group || 'Chung', type: nv.type
      })
      setPopup(false); setNv({ name:'', group:'', type:'number' })
    } catch(e) { alert('Lỗi: ' + e.message) }
  }

  const renderField = v => (
    <div key={v.id}>
      <div style={{ fontSize:10, color:'rgba(200,230,200,.5)', marginBottom:5 }}>
        {v.name} <span style={{ color:'rgba(200,230,200,.22)', fontSize:9 }}>({v.type})</span>
      </div>
      {v.type === 'binary' ? (
        <select value={row[v.id]??''} onChange={e=>setRow(p=>({...p,[v.id]:e.target.value}))}>
          <option value="">Chọn...</option>
          <option value="0">0 — Không</option>
          <option value="1">1 — Có</option>
        </select>
      ) : v.type === 'categorical' ? (
        <input value={row[v.id]||''} onChange={e=>setRow(p=>({...p,[v.id]:e.target.value}))} placeholder="Nhập giá trị..."/>
      ) : (
        <input type="number" value={row[v.id]||''} onChange={e=>setRow(p=>({...p,[v.id]:e.target.value}))} placeholder="0"/>
      )}
    </div>
  )

  const GroupSection = ({ g, vars }) => (
    <div style={{ marginBottom:22 }}>
      <div style={{ fontSize:9, color:C.purple, letterSpacing:'3px', marginBottom:10,
        textTransform:'uppercase', borderBottom:'1px solid rgba(191,95,255,.14)', paddingBottom:5 }}>{g}</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:14 }}>
        {vars.map(renderField)}
      </div>
    </div>
  )

  return (
    <div style={{ padding:20, height:'100%', overflow:'auto' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div style={{ fontFamily:'Orbitron', fontSize:11, color:C.green, letterSpacing:'2px' }}>◈ NHẬP DỮ LIỆU MỚI</div>
        <Btn onClick={()=>setPopup(true)} color={C.blue} small>+ Thêm biến</Btn>
      </div>

      {project.variables.length === 0 && (
        <div style={{ color:'rgba(200,230,200,.3)', fontSize:12, padding:32, textAlign:'center',
          border:'1px dashed rgba(0,250,154,.15)', borderRadius:6 }}>
          Chưa có biến nào.<br/>Nhấn "+ Thêm biến" để bắt đầu định nghĩa dataset.
        </div>
      )}

      {groups.map(g => (
        <GroupSection key={g} g={g} vars={project.variables.filter(v=>v.group===g)}/>
      ))}

      {ungrouped.length > 0 && (
        <GroupSection g="CHUNG" vars={ungrouped}/>
      )}

      <div style={{ marginTop:20, display:'flex', gap:12, alignItems:'center' }}>
        <Btn onClick={submit} disabled={project.variables.length===0 || saving}>
          {saving ? '◌ Đang lưu...' : '+ Thêm dòng dữ liệu'}
        </Btn>
        {ok && <span style={{ color:C.green, fontSize:11, animation:'fadeIn .3s' }}>✓ Đã lưu vào Firebase</span>}
      </div>
      <div style={{ marginTop:8, fontSize:9, color:'rgba(200,230,200,.2)' }}>
        Dataset: {project.rows.length} dòng × {project.variables.length} biến · Realtime Sync ◉
      </div>

      {popup && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.8)',
          display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div className="fade-in" style={{ width:380, maxWidth:'90vw' }}>
            <HoloPanel style={{ padding:28 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
                <div style={{ fontFamily:'Orbitron', fontSize:10, color:C.blue, letterSpacing:'2px' }}>◈ THÊM BIẾN MỚI</div>
                <span onClick={()=>setPopup(false)} style={{ color:'rgba(200,230,200,.4)', cursor:'pointer', fontSize:18, lineHeight:1 }}>✕</span>
              </div>
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:9, color:C.green, opacity:.55, marginBottom:5, letterSpacing:'2px' }}>TÊN BIẾN *</div>
                <input value={nv.name} onChange={e=>setNv(p=>({...p,name:e.target.value}))}
                  placeholder="Creatinine, BMI, HbA1c, PVR..." autoFocus/>
              </div>
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:9, color:C.green, opacity:.55, marginBottom:5, letterSpacing:'2px' }}>NHÓM</div>
                <input value={nv.group} onChange={e=>setNv(p=>({...p,group:e.target.value}))}
                  placeholder="Lâm sàng, Biomarker, Nhân khẩu..." list="grp-list"/>
                <datalist id="grp-list">{groups.map(g=><option key={g} value={g}/>)}</datalist>
              </div>
              <div style={{ marginBottom:20 }}>
                <div style={{ fontSize:9, color:C.green, opacity:.55, marginBottom:5, letterSpacing:'2px' }}>LOẠI BIẾN</div>
                <select value={nv.type} onChange={e=>setNv(p=>({...p,type:e.target.value}))}>
                  <option value="number">Số liên tục (number)</option>
                  <option value="binary">Nhị phân 0/1 (binary)</option>
                  <option value="categorical">Phân loại (categorical)</option>
                  <option value="ordinal">Thứ hạng (ordinal)</option>
                </select>
              </div>
              <div style={{ padding:'10px 12px', background:'rgba(0,191,255,.05)',
                border:'1px solid rgba(0,191,255,.2)', borderRadius:4,
                fontSize:11, color:'rgba(200,230,200,.5)', marginBottom:20, lineHeight:1.8 }}>
                ⚠ Xác nhận thêm biến <strong style={{ color:C.blue }}>{nv.name||'(chưa có tên)'}</strong> vào project?
                <br/>Các dòng hiện có sẽ để trống tại cột này.
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <Btn onClick={addVar} color={C.blue} disabled={!nv.name.trim()}>Xác nhận thêm</Btn>
                <Btn onClick={()=>setPopup(false)} color={C.pink} outline>Hủy</Btn>
              </div>
            </HoloPanel>
          </div>
        </div>
      )}
    </div>
  )
}
