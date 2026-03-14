import { useState } from 'react'
import { ref, update, remove } from 'firebase/database'
import { db } from '../../firebase.js'
import { Btn } from '../ui/index.jsx'
import { exportDataCSV } from '../../utils/export.js'
import { C } from '../../theme.js'

export function TableTab({ project }) {
  const [zoom, setZoom]     = useState(1)
  const [hl, setHl]         = useState(new Set())
  const [bolds, setBolds]   = useState(new Set())
  const [itals, setItals]   = useState(new Set())
  const [editCell, setEdit] = useState(null)
  const [editVal, setEVal]  = useState('')

  const key  = (rId, vId) => `${rId}_${vId}`
  const fs   = Math.round(12 * zoom)
  const cp   = `${Math.round(7*zoom)}px ${Math.round(11*zoom)}px`
  const hfs  = Math.round(8 * zoom)

  const cellClick = (e, rId, vId, curVal) => {
    const k = key(rId, vId)
    if (e.shiftKey) {
      setHl(p => { const n=new Set(p); n.has(k)?n.delete(k):n.add(k); return n })
    } else if (e.altKey) {
      setItals(p => { const n=new Set(p); n.has(k)?n.delete(k):n.add(k); return n })
    } else {
      setEdit(k); setEVal(String(curVal ?? ''))
    }
  }

  const ctxMenu = (e, rId, vId) => {
    e.preventDefault()
    const k = key(rId, vId)
    setBolds(p => { const n=new Set(p); n.has(k)?n.delete(k):n.add(k); return n })
  }

  const commit = async (rId, vId) => {
    try { await update(ref(db, `projects/${project.id}/rows/${rId}`), { [vId]: editVal }) }
    catch(e) { console.error(e) }
    setEdit(null)
  }

  const delRow = rId => {
    if (window.confirm('Xóa dòng này?'))
      remove(ref(db, `projects/${project.id}/rows/${rId}`))
  }

  return (
    <div style={{ padding:14, height:'100%', display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ display:'flex', gap:8, marginBottom:10, alignItems:'center', flexWrap:'wrap', flexShrink:0 }}>
        <span style={{ fontFamily:'Orbitron', fontSize:10, color:C.green, letterSpacing:'2px' }}>◈ BẢNG DỮ LIỆU</span>
        <Btn small onClick={()=>setZoom(z=>Math.min(z+.15,2.2))} color={C.blue}>+</Btn>
        <Btn small onClick={()=>setZoom(z=>Math.max(z-.15,.5))}  color={C.blue}>−</Btn>
        <span style={{ fontSize:10, color:'rgba(200,230,200,.35)' }}>{Math.round(zoom*100)}%</span>
        <div style={{ flex:1 }}/>
        <Btn small onClick={()=>exportDataCSV(project)} color={C.gold}>↓ Export CSV</Btn>
        <span style={{ fontSize:9, color:'rgba(200,230,200,.22)', letterSpacing:'1px' }}>
          Click→edit · Shift→HL · RClick→bold · Alt→italic
        </span>
        <span style={{ fontSize:10, color:C.green }}>{project.rows.length} dòng</span>
      </div>

      <div style={{ flex:1, overflow:'auto', border:'1px solid rgba(0,250,154,.1)', borderRadius:6 }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:fs, fontFamily:"'Share Tech Mono',monospace" }}>
          <thead>
            <tr style={{ background:'rgba(0,250,154,.05)', position:'sticky', top:0, zIndex:5 }}>
              <th style={{ padding:cp, borderBottom:'1px solid rgba(0,250,154,.15)', color:C.green,
                fontFamily:'Orbitron', fontSize:hfs, letterSpacing:'1px', width:36, textAlign:'center' }}>#</th>
              {project.variables.map(v => (
                <th key={v.id} style={{ padding:cp, borderBottom:'1px solid rgba(0,250,154,.15)',
                  color:C.green, fontFamily:'Orbitron', fontSize:hfs, letterSpacing:'1px',
                  textAlign:'left', whiteSpace:'nowrap' }}>
                  {v.name}
                  <span style={{ color:'rgba(0,250,154,.28)', fontSize:Math.round(7*zoom), marginLeft:4 }}>[{v.type[0]}]</span>
                </th>
              ))}
              <th style={{ width:28, borderBottom:'1px solid rgba(0,250,154,.15)' }}/>
            </tr>
          </thead>
          <tbody>
            {project.rows.map((row, idx) => (
              <tr key={row.id} style={{ borderBottom:'1px solid rgba(0,250,154,.055)' }}>
                <td style={{ padding:cp, textAlign:'center', color:'rgba(200,230,200,.22)', fontSize:Math.round(9*zoom) }}>{idx+1}</td>
                {project.variables.map(v => {
                  const k    = key(row.id, v.id)
                  const isHL = hl.has(k), isBold = bolds.has(k), isItal = itals.has(k), isEdit = editCell===k
                  const val  = row[v.id]
                  return (
                    <td key={v.id}
                      style={{ padding:cp, background:isHL?'rgba(255,215,0,.1)':'',
                        color:isHL?C.gold:'rgba(200,230,200,.72)',
                        fontWeight:isBold?700:400, fontStyle:isItal?'italic':'normal',
                        cursor:'pointer', transition:'background .1s', maxWidth:140 }}
                      onMouseEnter={e=>{ if(!isHL) e.currentTarget.style.background='rgba(0,250,154,.04)' }}
                      onMouseLeave={e=>{ if(!isHL) e.currentTarget.style.background='' }}
                      onClick={e=>cellClick(e, row.id, v.id, val)}
                      onContextMenu={e=>ctxMenu(e, row.id, v.id)}>
                      {isEdit ? (
                        <input autoFocus value={editVal}
                          onChange={e=>setEVal(e.target.value)}
                          onBlur={()=>commit(row.id, v.id)}
                          onKeyDown={e=>{if(e.key==='Enter')commit(row.id,v.id);if(e.key==='Escape')setEdit(null)}}
                          style={{ width:'92%', padding:'2px 4px', fontSize:fs,
                            background:'rgba(0,250,154,.1)', border:'1px solid #00FA9A',
                            color:'#fff', borderRadius:2, outline:'none' }}/>
                      ) : (
                        <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'block' }}>
                          {val!==undefined&&val!=='' ? String(val) : <span style={{opacity:.18}}>—</span>}
                        </span>
                      )}
                    </td>
                  )
                })}
                <td style={{ padding:'0 5px', textAlign:'center' }}>
                  <span onClick={()=>delRow(row.id)}
                    style={{ color:'rgba(255,45,120,.3)', cursor:'pointer', fontSize:12, transition:'color .15s' }}
                    onMouseEnter={e=>e.currentTarget.style.color=C.pink}
                    onMouseLeave={e=>e.currentTarget.style.color='rgba(255,45,120,.3)'}>✕</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {project.rows.length === 0 && (
          <div style={{ textAlign:'center', padding:40, color:'rgba(200,230,200,.22)', fontSize:12 }}>
            Chưa có dữ liệu. Nhập tại tab INPUT.
          </div>
        )}
      </div>
      <div style={{ marginTop:6, fontSize:9, color:'rgba(200,230,200,.2)', flexShrink:0 }}>
        * Highlight/format chỉ local — không ảnh hưởng database gốc
      </div>
    </div>
  )
}
