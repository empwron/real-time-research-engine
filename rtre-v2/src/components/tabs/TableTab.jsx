import { useState, useRef } from 'react'
import { ref, update, remove } from 'firebase/database'
import { db } from '../../firebase.js'
import { Btn } from '../ui/index.jsx'
import { C } from '../../theme.js'

const DEF_COL_COLORS = ['#00FA9A','#00BFFF','#BF5FFF','#FF2D78','#FFD700','#FF6B35','#00E5FF','#FF9500']

export function TableTab({ project }) {
  const [zoom, setZoom] = useState(1)
  const [hl, setHl] = useState(new Set())
  const [bolds, setBolds] = useState(new Set())
  const [editCell, setEdit] = useState(null)
  const [editVal, setEVal] = useState('')
  const [varColors, setVarColors] = useState({})
  const [showColorPicker, setShowColorPicker] = useState(null)
  const [imgPopup, setImgPopup] = useState(null)
  const [showCodeName, setShowCodeName] = useState(false) // toggle
  const dragColIdx = useRef(null)
  const [dragOverCol, setDragOverCol] = useState(null)

  const sortedVars = [...project.variables].sort((a,b)=>(a.order??0)-(b.order??0))
  const key = (rId,vId)=>`${rId}_${vId}`
  const fs = Math.round(13*zoom)
  const cp = `${Math.round(6*zoom)}px ${Math.round(10*zoom)}px`

  const cellClick = (e,rId,vId,curVal,varType) => {
    if (varType==='image') { if(curVal&&typeof curVal==='string'&&curVal.startsWith('data:'))setImgPopup(curVal); return }
    const k=key(rId,vId)
    if(e.shiftKey){setHl(p=>{const n=new Set(p);n.has(k)?n.delete(k):n.add(k);return n})}
    else{setEdit(k);setEVal(String(curVal??''))}
  }
  const commit=async(rId,vId)=>{try{await update(ref(db,`projects/${project.id}/rows/${rId}`),{[vId]:editVal})}catch(e){console.error(e)}setEdit(null)}
  const delRow=rId=>{if(window.confirm('Xóa dòng này?'))remove(ref(db,`projects/${project.id}/rows/${rId}`))}

  const onColDragStart=idx=>{dragColIdx.current=idx}
  const onColDragOver=(e,idx)=>{e.preventDefault();setDragOverCol(idx)}
  const onColDrop=async(e,idx)=>{e.preventDefault();setDragOverCol(null);const from=dragColIdx.current;if(from===null||from===idx)return;const re=[...sortedVars];const[m]=re.splice(from,1);re.splice(idx,0,m);dragColIdx.current=null;const up={};re.forEach((v,i)=>{up[`projects/${project.id}/variables/${v.id}/order`]=i});await update(ref(db),up)}

  const getVarColor=(v,idx)=>varColors[v.id]||DEF_COL_COLORS[idx%DEF_COL_COLORS.length]

  // Export CSV with codeName headers
  const exportCSV = () => {
    const exportVars = sortedVars.filter(v=>v.type!=='image')
    const headers = ['#', ...exportVars.map(v => v.codeName || v.name)]
    const lines = [headers.join(',')]
    project.rows.forEach((row,i) => {
      const vals = [i+1, ...exportVars.map(v => {
        const val = row[v.id]; if(val===undefined||val==='')return ''
        return String(val).includes(',')?`"${val}"`:val
      })]
      lines.push(vals.join(','))
    })
    const blob = new Blob(['\uFEFF'+lines.join('\n')],{type:'text/csv;charset=utf-8;'})
    const url = URL.createObjectURL(blob)
    const a = Object.assign(document.createElement('a'),{href:url,download:`${project.name}_data.csv`})
    a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',overflow:'hidden',padding:8}}>
      <div style={{display:'flex',gap:6,marginBottom:5,alignItems:'center',flexWrap:'wrap',flexShrink:0}}>
        <span style={{fontFamily:'Orbitron',fontSize:10,color:C.purple,letterSpacing:'2px'}}>▦ BẢNG</span>
        <Btn small onClick={()=>setZoom(z=>Math.min(z+.15,2))} color={C.purple}>+</Btn>
        <Btn small onClick={()=>setZoom(z=>Math.max(z-.15,.5))} color={C.purple}>−</Btn>
        <span style={{fontSize:10,color:'rgba(200,230,200,.3)'}}>{Math.round(zoom*100)}%</span>
        <span onClick={()=>setShowCodeName(s=>!s)} title={showCodeName?"Hiển thị tên biến":"Hiển thị tên mã hóa"}
          style={{padding:'2px 7px',borderRadius:3,fontSize:9,cursor:'pointer',fontFamily:'Orbitron',letterSpacing:'1px',
            background:showCodeName?'rgba(191,95,255,.12)':'rgba(255,255,255,.04)',
            border:`1px solid ${showCodeName?C.purple:'rgba(255,255,255,.08)'}`,
            color:showCodeName?C.purple:'rgba(200,230,200,.3)'}}>
          {showCodeName?'CODE':'NAME'}
        </span>
        <div style={{flex:1}}/>
        <Btn small onClick={exportCSV} color={C.gold}>↓ CSV</Btn>
        <span style={{fontSize:12,color:C.purple}}>{project.rows.length}</span>
      </div>
      <div style={{flex:1,overflow:'auto',border:'1px solid rgba(191,95,255,.15)',borderRadius:5}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:fs}}>
          <thead>
            <tr style={{background:'rgba(191,95,255,.07)',position:'sticky',top:0,zIndex:5}}>
              <th style={{padding:cp,color:C.purple,fontSize:Math.round(10*zoom),width:30,textAlign:'center',borderBottom:'1px solid rgba(191,95,255,.2)'}}>#</th>
              {sortedVars.map((v,idx)=>{
                const vc=getVarColor(v,idx)
                const displayName = showCodeName ? (v.codeName||v.name) : v.name
                return <th key={v.id} draggable onDragStart={()=>onColDragStart(idx)} onDragOver={e=>onColDragOver(e,idx)} onDrop={e=>onColDrop(e,idx)} onDragEnd={()=>setDragOverCol(null)}
                  style={{padding:cp,textAlign:'left',whiteSpace:'nowrap',userSelect:'none',borderBottom:'1px solid rgba(191,95,255,.2)',cursor:'grab',
                    background:dragOverCol===idx?'rgba(191,95,255,.15)':'',position:'relative',
                    borderTop:dragOverCol===idx?`2px solid ${vc}`:'2px solid transparent'}}>
                  <div style={{display:'flex',alignItems:'center',gap:4}}>
                    <span style={{color:vc,fontSize:Math.round(11*zoom),fontWeight:600}}>{displayName}</span>
                    <span style={{color:'rgba(200,230,200,.22)',fontSize:Math.round(9*zoom)}}>[{v.type==='image'?'img':v.type?.slice(0,3)}]</span>
                    <span onClick={e=>{e.stopPropagation();setShowColorPicker(showColorPicker===v.id?null:v.id)}}
                      style={{width:9,height:9,borderRadius:'50%',background:vc,cursor:'pointer',flexShrink:0,boxShadow:`0 0 4px ${vc}80`}}/>
                    {showColorPicker===v.id&&<div onClick={e=>e.stopPropagation()} style={{position:'absolute',top:'100%',left:0,zIndex:100,background:'#0D0D1F',border:'1px solid rgba(191,95,255,.3)',borderRadius:5,padding:6,display:'flex',flexWrap:'wrap',gap:4,width:120}}>
                      {DEF_COL_COLORS.map(c=><span key={c} onClick={()=>{setVarColors(p=>({...p,[v.id]:c}));setShowColorPicker(null)}} style={{width:18,height:18,borderRadius:'50%',background:c,cursor:'pointer',outline:varColors[v.id]===c?'2px solid #fff':'2px solid transparent'}}/>)}
                    </div>}
                  </div>
                </th>
              })}
              <th style={{width:24,borderBottom:'1px solid rgba(191,95,255,.2)'}}/>
            </tr>
          </thead>
          <tbody>
            {project.rows.map((row,idx)=>(
              <tr key={row.id} style={{borderBottom:'1px solid rgba(191,95,255,.05)'}}>
                <td style={{padding:cp,textAlign:'center',color:'rgba(200,230,200,.22)',fontSize:Math.round(10*zoom)}}>{idx+1}</td>
                {sortedVars.map((v,vi)=>{
                  const k=key(row.id,v.id),val=row[v.id],isHL=hl.has(k),isEdit=editCell===k,vc=getVarColor(v,vi)
                  return <td key={v.id} style={{padding:cp,cursor:'pointer',maxWidth:v.type==='image'?50:140,
                    background:isHL?`${vc}1E`:'',color:isHL?vc:'rgba(210,235,210,.72)',fontWeight:bolds.has(k)?700:400}}
                    onMouseEnter={e=>{if(!isHL)e.currentTarget.style.background='rgba(191,95,255,.06)'}}
                    onMouseLeave={e=>{if(!isHL)e.currentTarget.style.background=isHL?`${vc}1E`:''}}
                    onClick={e=>cellClick(e,row.id,v.id,val,v.type)}
                    onContextMenu={e=>{e.preventDefault();setBolds(p=>{const n=new Set(p);n.has(k)?n.delete(k):n.add(k);return n})}}>
                    {isEdit&&v.type!=='image'?<input autoFocus value={editVal} onChange={e=>setEVal(e.target.value)} onBlur={()=>commit(row.id,v.id)} onKeyDown={e=>{if(e.key==='Enter')commit(row.id,v.id);if(e.key==='Escape')setEdit(null)}}
                      style={{width:'95%',padding:'2px 5px',fontSize:fs,background:'rgba(191,95,255,.15)',border:`1px solid ${C.purple}`,color:'#fff',borderRadius:3,outline:'none'}}/>
                    :<span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',display:'block'}}>
                      {v.type==='image'?(val&&typeof val==='string'&&val.startsWith('data:')?<img src={val} alt="" style={{width:Math.round(20*zoom),height:Math.round(20*zoom),objectFit:'cover',borderRadius:2,border:'1px solid rgba(0,250,154,.3)',cursor:'pointer'}}/>:<span style={{opacity:.2}}>—</span>)
                      :(val!==undefined&&val!==''?String(val):<span style={{opacity:.2}}>—</span>)}
                    </span>}
                  </td>
                })}
                <td style={{padding:'0 4px',textAlign:'center'}}><span onClick={()=>delRow(row.id)} style={{color:'rgba(255,45,120,.25)',cursor:'pointer',fontSize:12}} onMouseEnter={e=>e.currentTarget.style.color=C.pink} onMouseLeave={e=>e.currentTarget.style.color='rgba(255,45,120,.25)'}>✕</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {project.rows.length===0&&<div style={{textAlign:'center',padding:30,color:'rgba(200,230,200,.2)',fontSize:13}}>Chưa có dữ liệu.</div>}
      </div>
      {imgPopup&&<div className="img-popup-overlay" onClick={()=>setImgPopup(null)}><img src={imgPopup} alt="Preview" onClick={e=>e.stopPropagation()}/></div>}
    </div>
  )
}
