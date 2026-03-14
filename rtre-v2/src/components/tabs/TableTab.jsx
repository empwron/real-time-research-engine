import { useState, useRef } from 'react'
import { ref, update, remove } from 'firebase/database'
import { db } from '../../firebase.js'
import { Btn } from '../ui/index.jsx'
import { exportDataCSV } from '../../utils/export.js'
import { C } from '../../theme.js'

const DEF_COL_COLORS = ['#00FA9A','#00BFFF','#BF5FFF','#FF2D78','#FFD700','#FF6B35','#00E5FF','#FF9500']

export function TableTab({ project }) {
  const [zoom, setZoom]       = useState(1)
  const [hl, setHl]           = useState(new Set())
  const [bolds, setBolds]     = useState(new Set())
  const [itals, setItals]     = useState(new Set())
  const [editCell, setEdit]   = useState(null)
  const [editVal, setEVal]    = useState('')
  const [varColors, setVarColors] = useState({})
  const [showColorPicker, setShowColorPicker] = useState(null)
  const dragColIdx = useRef(null)
  const [dragOverCol, setDragOverCol] = useState(null)

  const sortedVars = [...project.variables].sort((a,b)=>(a.order??0)-(b.order??0))

  const key = (rId,vId)=>`${rId}_${vId}`
  const fs  = Math.round(13*zoom)
  const cp  = `${Math.round(7*zoom)}px ${Math.round(11*zoom)}px`

  const cellClick = (e,rId,vId,curVal) => {
    const k=key(rId,vId)
    if(e.shiftKey) setHl(p=>{const n=new Set(p);n.has(k)?n.delete(k):n.add(k);return n})
    else if(e.altKey) setItals(p=>{const n=new Set(p);n.has(k)?n.delete(k):n.add(k);return n})
    else { setEdit(k); setEVal(String(curVal??'')) }
  }
  const ctxMenu=(e,rId,vId)=>{e.preventDefault();const k=key(rId,vId);setBolds(p=>{const n=new Set(p);n.has(k)?n.delete(k):n.add(k);return n})}
  const commit=async(rId,vId)=>{
    try{await update(ref(db,`projects/${project.id}/rows/${rId}`),{[vId]:editVal})}catch(e){console.error(e)}
    setEdit(null)
  }
  const delRow=rId=>{if(window.confirm('Xóa dòng này?'))remove(ref(db,`projects/${project.id}/rows/${rId}`))}

  // Column drag-drop reorder
  const onColDragStart = idx => { dragColIdx.current = idx }
  const onColDragOver  = (e,idx) => { e.preventDefault(); setDragOverCol(idx) }
  const onColDrop      = async (e,idx) => {
    e.preventDefault(); setDragOverCol(null)
    const from = dragColIdx.current
    if (from===null||from===idx) return
    const reordered = [...sortedVars]
    const [moved] = reordered.splice(from,1)
    reordered.splice(idx,0,moved)
    dragColIdx.current=null
    const updates={}
    reordered.forEach((v,i)=>{updates[`projects/${project.id}/variables/${v.id}/order`]=i})
    await update(ref(db),updates)
  }

  const getVarColor = (v, idx) => varColors[v.id] || DEF_COL_COLORS[idx % DEF_COL_COLORS.length]

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', overflow:'hidden', padding:8 }}>
      {/* Toolbar */}
      <div style={{ display:'flex', gap:6, marginBottom:6, alignItems:'center', flexWrap:'wrap', flexShrink:0 }}>
        <span style={{ fontFamily:'Orbitron,sans-serif', fontSize:10,
          color:C.purple, letterSpacing:'2px' }}>▦ BẢNG</span>
        <Btn small onClick={()=>setZoom(z=>Math.min(z+.15,2))} color={C.purple}>+</Btn>
        <Btn small onClick={()=>setZoom(z=>Math.max(z-.15,.6))} color={C.purple}>−</Btn>
        <span style={{ fontSize:11, color:'rgba(200,230,200,.3)' }}>{Math.round(zoom*100)}%</span>
        <div style={{flex:1}}/>
        <Btn small onClick={()=>exportDataCSV(project)} color={C.gold}>↓ CSV</Btn>
        <span style={{ fontSize:10, color:'rgba(200,230,200,.2)' }}>Shift→HL · RC→bold · Alt→italic</span>
        <span style={{ fontSize:12, color:C.purple }}>{project.rows.length}</span>
      </div>

      {/* Table */}
      <div style={{ flex:1, overflow:'auto', border:'1px solid rgba(191,95,255,.15)', borderRadius:5 }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:fs }}>
          <thead>
            <tr style={{ background:'rgba(191,95,255,.07)', position:'sticky', top:0, zIndex:5 }}>
              <th style={{ padding:cp, color:C.purple, fontSize:Math.round(11*zoom),
                width:34, textAlign:'center', borderBottom:'1px solid rgba(191,95,255,.2)' }}>#</th>
              {sortedVars.map((v,idx)=>{
                const vc = getVarColor(v,idx)
                return (
                  <th key={v.id}
                    draggable onDragStart={()=>onColDragStart(idx)}
                    onDragOver={e=>onColDragOver(e,idx)} onDrop={e=>onColDrop(e,idx)}
                    onDragEnd={()=>setDragOverCol(null)}
                    style={{ padding:cp, textAlign:'left', whiteSpace:'nowrap', userSelect:'none',
                      borderBottom:'1px solid rgba(191,95,255,.2)', cursor:'grab',
                      background:dragOverCol===idx?'rgba(191,95,255,.15)':'',
                      transition:'background .15s', borderTop:dragOverCol===idx?`2px solid ${vc}`:'2px solid transparent' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ color:vc, fontSize:Math.round(12*zoom), fontWeight:600 }}>{v.name}</span>
                      <span style={{ color:'rgba(200,230,200,.25)', fontSize:Math.round(10*zoom) }}>
                        [{v.type?.slice(0,3)}]
                      </span>
                      {/* Color picker toggle */}
                      <span onClick={e=>{e.stopPropagation();setShowColorPicker(showColorPicker===v.id?null:v.id)}}
                        style={{ width:10, height:10, borderRadius:'50%', background:vc,
                          cursor:'pointer', display:'inline-block', flexShrink:0,
                          boxShadow:`0 0 4px ${vc}80` }}/>
                      {showColorPicker===v.id&&(
                        <div style={{ position:'absolute', top:'100%', left:0, zIndex:100,
                          background:'#0D0D1F', border:'1px solid rgba(191,95,255,.3)',
                          borderRadius:5, padding:8, display:'flex', flexWrap:'wrap', gap:5, width:130 }}>
                          {DEF_COL_COLORS.map(c=>(
                            <span key={c} onClick={()=>{setVarColors(p=>({...p,[v.id]:c}));setShowColorPicker(null)}}
                              style={{ width:20, height:20, borderRadius:'50%', background:c,
                                cursor:'pointer', boxShadow:varColors[v.id]===c?`0 0 6px ${c}`:'none',
                                outline:varColors[v.id]===c?`2px solid #fff`:'2px solid transparent' }}/>
                          ))}
                        </div>
                      )}
                    </div>
                  </th>
                )
              })}
              <th style={{ width:26, borderBottom:'1px solid rgba(191,95,255,.2)' }}/>
            </tr>
          </thead>
          <tbody>
            {project.rows.map((row,idx)=>(
              <tr key={row.id} style={{ borderBottom:'1px solid rgba(191,95,255,.05)' }}>
                <td style={{ padding:cp, textAlign:'center',
                  color:'rgba(200,230,200,.22)', fontSize:Math.round(11*zoom) }}>{idx+1}</td>
                {sortedVars.map((v,vi)=>{
                  const k=key(row.id,v.id), val=row[v.id]
                  const isHL=hl.has(k), isBold=bolds.has(k), isItal=itals.has(k), isEdit=editCell===k
                  const vc = getVarColor(v,vi)
                  return (
                    <td key={v.id}
                      style={{ padding:cp, cursor:'pointer', maxWidth:160,
                        background:isHL?`rgba(${vc.replace('#','').match(/../g).map(x=>parseInt(x,16)).join(',')}, .12)`:'',
                        color:isHL?vc:'rgba(210,235,210,.72)',
                        fontWeight:isBold?700:400, fontStyle:isItal?'italic':'normal',
                        transition:'background .1s' }}
                      onMouseEnter={e=>{if(!isHL)e.currentTarget.style.background='rgba(191,95,255,.06)'}}
                      onMouseLeave={e=>{if(!isHL)e.currentTarget.style.background=''}}
                      onClick={e=>cellClick(e,row.id,v.id,val)}
                      onContextMenu={e=>ctxMenu(e,row.id,v.id)}>
                      {isEdit?(
                        <input autoFocus value={editVal}
                          onChange={e=>setEVal(e.target.value)}
                          onBlur={()=>commit(row.id,v.id)}
                          onKeyDown={e=>{if(e.key==='Enter')commit(row.id,v.id);if(e.key==='Escape')setEdit(null)}}
                          style={{ width:'95%', padding:'2px 6px', fontSize:fs,
                            background:'rgba(191,95,255,.15)', border:`1px solid ${C.purple}`,
                            color:'#fff', borderRadius:3, outline:'none' }}/>
                      ):(
                        <span style={{ overflow:'hidden', textOverflow:'ellipsis',
                          whiteSpace:'nowrap', display:'block' }}>
                          {val!==undefined&&val!==''?String(val):<span style={{opacity:.2}}>—</span>}
                        </span>
                      )}
                    </td>
                  )
                })}
                <td style={{ padding:'0 5px', textAlign:'center' }}>
                  <span onClick={()=>delRow(row.id)}
                    style={{ color:'rgba(255,45,120,.3)', cursor:'pointer', fontSize:13 }}
                    onMouseEnter={e=>e.currentTarget.style.color=C.pink}
                    onMouseLeave={e=>e.currentTarget.style.color='rgba(255,45,120,.3)'}>✕</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {project.rows.length===0&&(
          <div style={{ textAlign:'center', padding:30,
            color:'rgba(200,230,200,.2)', fontSize:13 }}>Chưa có dữ liệu.</div>
        )}
      </div>
      <div style={{ marginTop:4, fontSize:11, color:'rgba(200,230,200,.18)', flexShrink:0 }}>
        ⠿ Kéo cột để đổi thứ tự · Click màu ● để đổi màu cột
      </div>
    </div>
  )
}
