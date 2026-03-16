import { useState, useRef, useEffect, useCallback } from 'react'
import { ref, update, remove, push } from 'firebase/database'
import { db } from '../../firebase.js'
import { Btn } from '../ui/index.jsx'
import { C } from '../../theme.js'
import { isNumType } from './InputTab.jsx'
import { isNA } from '../../utils/statistics.js'

const DCOL=['#00FA9A','#00BFFF','#BF5FFF','#FF2D78','#FFD700','#FF6B35','#00E5FF','#FF9500']

export function TableTab({project,pushUndo,setSyncStatus,confirm}){
  const[zoom,setZoom]=useState(1);const[editCell,setEdit]=useState(null);const[editVal,setEVal]=useState('');const[varColors,setVarColors]=useState({});const[showCP,setShowCP]=useState(null);const[imgPopup,setImgPopup]=useState(null);const[showCode,setShowCode]=useState(false);const[search,setSearch]=useState('');const[sortCol,setSortCol]=useState(null);const[sortDir,setSortDir]=useState('asc')
  const dragC=useRef(null);const[dragOC,setDragOC]=useState(null);const editRef=useRef(null)

  const sortedVars=[...project.variables].sort((a,b)=>(a.order??0)-(b.order??0))
  const fs=Math.round(13*zoom),cp=`${Math.round(5*zoom)}px ${Math.round(8*zoom)}px`
  const gc=(v,i)=>varColors[v.id]||DCOL[i%DCOL.length]

  // Filter rows by search
  let filteredRows=project.rows
  if(search.trim()){const s=search.toLowerCase();filteredRows=filteredRows.filter(row=>sortedVars.some(v=>{const val=row[v.id];return val!=null&&String(val).toLowerCase().includes(s)}))}
  // Sort
  if(sortCol){const v=sortedVars.find(vv=>vv.id===sortCol);if(v){filteredRows=[...filteredRows].sort((a,b)=>{const va=a[sortCol]??'',vb=b[sortCol]??'';const na=Number(va),nb=Number(vb);if(!isNaN(na)&&!isNaN(nb))return sortDir==='asc'?na-nb:nb-na;return sortDir==='asc'?String(va).localeCompare(String(vb)):String(vb).localeCompare(String(va))})}}

  const toggleSort=vid=>{if(sortCol===vid)setSortDir(d=>d==='asc'?'desc':'asc');else{setSortCol(vid);setSortDir('asc')}}

  // Inline edit
  const startEdit=(rId,vId,val)=>{setEdit(`${rId}_${vId}`);setEVal(String(val??''))}
  const commitEdit=async(rId,vId)=>{const oldVal=project.rows.find(r=>r.id===rId)?.[vId];pushUndo({type:'editCell',pid:project.id,rid:rId,vid:vId,oldVal:oldVal??'',newVal:editVal});setSyncStatus('saving');try{const v=sortedVars.find(vv=>vv.id===vId);const val=editVal==='NA'?'NA':isNumType(v?.type)&&editVal!==''&&!isNaN(Number(editVal))?Number(editVal):editVal;await update(ref(db,`projects/${project.id}/rows/${rId}`),{[vId]:val})}catch(e){console.error(e)}setEdit(null);setSyncStatus('synced')}

  // Tab navigation within table
  const navigate=(rId,vId,dir)=>{const ri=filteredRows.findIndex(r=>r.id===rId),vi=sortedVars.findIndex(v=>v.id===vId);let nr=ri,nv=vi;if(dir==='right'){nv++;if(nv>=sortedVars.length){nv=0;nr++}}else if(dir==='left'){nv--;if(nv<0){nv=sortedVars.length-1;nr--}}else if(dir==='down')nr++;else if(dir==='up')nr--
    if(nr>=0&&nr<filteredRows.length&&nv>=0&&nv<sortedVars.length){const nRow=filteredRows[nr],nVar=sortedVars[nv];if(nVar.type!=='image'){commitEdit(rId,vId).then(()=>startEdit(nRow.id,nVar.id,nRow[nVar.id]))}}}

  // Add new row from table
  const addRowInline=async()=>{setSyncStatus('saving');const nr={createdAt:Date.now()};sortedVars.forEach(v=>{nr[v.id]=''});const newRef=await push(ref(db,`projects/${project.id}/rows`),nr);setSyncStatus('synced');setTimeout(()=>{if(sortedVars.length)startEdit(newRef.key,sortedVars[0].id,'')},300)}

  const delRow=async rId=>{if(!await confirm('Xóa dòng này?'))return;const rowData={...project.rows.find(r=>r.id===rId)};delete rowData.id;pushUndo({type:'deleteRow',pid:project.id,rid:rId,data:rowData});setSyncStatus('saving');await remove(ref(db,`projects/${project.id}/rows/${rId}`));setSyncStatus('synced')}

  const onCDS=i=>{dragC.current=i};const onCDO=(e,i)=>{e.preventDefault();setDragOC(i)};const onCDr=async(e,i)=>{e.preventDefault();setDragOC(null);const f=dragC.current;if(f===null||f===i)return;const re=[...sortedVars];const[m]=re.splice(f,1);re.splice(i,0,m);dragC.current=null;const up={};re.forEach((v,j)=>{up[`projects/${project.id}/variables/${v.id}/order`]=j});await update(ref(db),up)}

  // CSV export with code names
  const exportCSV=()=>{const ev=sortedVars.filter(v=>v.type!=='image');const hds=['#',...ev.map(v=>v.codeName||v.name)];const lines=[hds.join(',')];project.rows.forEach((row,i)=>{const vals=[i+1,...ev.map(v=>{const val=row[v.id];if(val==null||val==='')return '';return String(val).includes(',')?`"${val}"`:val})];lines.push(vals.join(','))});const blob=new Blob(['\uFEFF'+lines.join('\n')],{type:'text/csv;charset=utf-8;'});const url=URL.createObjectURL(blob);Object.assign(document.createElement('a'),{href:url,download:`${project.name}_data.csv`}).click();URL.revokeObjectURL(url)}

  return<div style={{height:'100%',display:'flex',flexDirection:'column',overflow:'hidden',padding:6}}>
    <div style={{display:'flex',gap:4,marginBottom:4,alignItems:'center',flexWrap:'wrap',flexShrink:0}}>
      <span style={{fontFamily:'Orbitron',fontSize:10,color:C.purple,letterSpacing:'2px'}}>▦ BẢNG</span>
      <Btn small onClick={()=>setZoom(z=>Math.min(z+.15,2))} color={C.purple}>+</Btn>
      <Btn small onClick={()=>setZoom(z=>Math.max(z-.15,.5))} color={C.purple}>−</Btn>
      <span style={{fontSize:9,color:'rgba(200,230,200,.3)'}}>{Math.round(zoom*100)}%</span>
      <span onClick={()=>setShowCode(s=>!s)} title={showCode?'Tên biến':'Tên mã hóa'} style={{padding:'2px 6px',borderRadius:3,fontSize:8,cursor:'pointer',fontFamily:'Orbitron',letterSpacing:'1px',background:showCode?'rgba(191,95,255,.12)':'rgba(255,255,255,.04)',border:`1px solid ${showCode?C.purple:'rgba(255,255,255,.08)'}`,color:showCode?C.purple:'rgba(200,230,200,.3)'}}>{showCode?'CODE':'NAME'}</span>
      {/* Search */}
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Tìm..." style={{width:120,padding:'3px 8px',fontSize:11,background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.08)',borderRadius:4,color:'#d8eed8'}}/>
      <div style={{flex:1}}/>
      <Btn small onClick={addRowInline} color={C.cyan} title="Thêm dòng trực tiếp">+ Row</Btn>
      <Btn small onClick={exportCSV} color={C.gold}>↓ CSV</Btn>
      <span style={{fontSize:11,color:C.purple}}>{filteredRows.length}{search?`/${project.rows.length}`:''}</span>
    </div>
    <div style={{flex:1,overflow:'auto',border:'1px solid rgba(191,95,255,.15)',borderRadius:5}}>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:fs}}>
        <thead><tr style={{background:'rgba(191,95,255,.07)',position:'sticky',top:0,zIndex:5}}>
          <th style={{padding:cp,color:C.purple,fontSize:Math.round(10*zoom),width:28,textAlign:'center',borderBottom:'1px solid rgba(191,95,255,.2)'}}>#</th>
          {sortedVars.map((v,idx)=>{const vc=gc(v,idx);const dn=showCode?(v.codeName||v.name):v.name;return<th key={v.id} draggable onDragStart={()=>onCDS(idx)} onDragOver={e=>onCDO(e,idx)} onDrop={e=>onCDr(e,idx)} onDragEnd={()=>setDragOC(null)} onClick={()=>toggleSort(v.id)}
            style={{padding:cp,textAlign:'left',whiteSpace:'nowrap',userSelect:'none',borderBottom:'1px solid rgba(191,95,255,.2)',cursor:'pointer',background:dragOC===idx?'rgba(191,95,255,.15)':'',position:'relative',borderTop:dragOC===idx?`2px solid ${vc}`:'2px solid transparent'}}>
            <div style={{display:'flex',alignItems:'center',gap:3}}>
              <span style={{color:vc,fontSize:Math.round(11*zoom),fontWeight:600}}>{dn}</span>
              <span style={{color:'rgba(200,230,200,.2)',fontSize:Math.round(8*zoom)}}>[{v.type==='image'?'img':v.type?.slice(0,3)}]</span>
              {sortCol===v.id&&<span style={{color:vc,fontSize:9}}>{sortDir==='asc'?'▲':'▼'}</span>}
              <span onClick={e=>{e.stopPropagation();setShowCP(showCP===v.id?null:v.id)}} style={{width:8,height:8,borderRadius:'50%',background:vc,cursor:'pointer',flexShrink:0}}/>
              {showCP===v.id&&<div onClick={e=>e.stopPropagation()} style={{position:'absolute',top:'100%',left:0,zIndex:100,background:'#0D0D1F',border:'1px solid rgba(191,95,255,.3)',borderRadius:4,padding:4,display:'flex',flexWrap:'wrap',gap:3,width:110}}>{DCOL.map(c=><span key={c} onClick={()=>{setVarColors(p=>({...p,[v.id]:c}));setShowCP(null)}} style={{width:16,height:16,borderRadius:'50%',background:c,cursor:'pointer',outline:varColors[v.id]===c?'2px solid #fff':'none'}}/>)}</div>}
            </div></th>})}
          <th style={{width:22,borderBottom:'1px solid rgba(191,95,255,.2)'}}/>
        </tr></thead>
        <tbody>{filteredRows.map((row,idx)=><tr key={row.id} style={{borderBottom:'1px solid rgba(191,95,255,.05)'}}>
          <td style={{padding:cp,textAlign:'center',color:'rgba(200,230,200,.22)',fontSize:Math.round(10*zoom)}}>{idx+1}</td>
          {sortedVars.map((v,vi)=>{const k=`${row.id}_${v.id}`,val=row[v.id],isEd=editCell===k,vc=gc(v,vi),isNAVal=val==='NA'||val==='N/A'
            return<td key={v.id} style={{padding:cp,cursor:'pointer',maxWidth:v.type==='image'?45:130,color:isNAVal?'rgba(255,45,120,.5)':'rgba(210,235,210,.72)'}}
              onMouseEnter={e=>e.currentTarget.style.background='rgba(191,95,255,.06)'} onMouseLeave={e=>e.currentTarget.style.background=''}
              onClick={()=>{if(v.type==='image'){if(val&&typeof val==='string'&&val.startsWith('data:'))setImgPopup(val);return}startEdit(row.id,v.id,val)}}>
              {isEd&&v.type!=='image'?<input ref={editRef} autoFocus value={editVal} onChange={e=>setEVal(e.target.value)}
                onBlur={()=>commitEdit(row.id,v.id)}
                onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();navigate(row.id,v.id,'down')}if(e.key==='Tab'){e.preventDefault();navigate(row.id,v.id,e.shiftKey?'left':'right')}if(e.key==='Escape')setEdit(null);if(e.key==='ArrowDown'){e.preventDefault();navigate(row.id,v.id,'down')}if(e.key==='ArrowUp'){e.preventDefault();navigate(row.id,v.id,'up')}}}
                style={{width:'100%',padding:'1px 4px',fontSize:fs,background:'rgba(191,95,255,.15)',border:`1px solid ${C.purple}`,color:'#fff',borderRadius:2,outline:'none'}}/>
              :<span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',display:'block'}}>
                {v.type==='image'?(val&&typeof val==='string'&&val.startsWith('data:')?<img src={val} alt="" style={{width:Math.round(18*zoom),height:Math.round(18*zoom),objectFit:'cover',borderRadius:2,border:'1px solid rgba(0,250,154,.3)'}}/>:<span style={{opacity:.2}}>—</span>)
                :isNAVal?<em style={{fontSize:Math.round(11*zoom)}}>NA</em>
                :(val!=null&&val!==''?String(val):<span style={{opacity:.2}}>—</span>)}
              </span>}
            </td>})}
          <td style={{padding:'0 3px',textAlign:'center'}}><span onClick={()=>delRow(row.id)} style={{color:'rgba(255,45,120,.2)',cursor:'pointer',fontSize:11}} onMouseEnter={e=>e.currentTarget.style.color=C.pink} onMouseLeave={e=>e.currentTarget.style.color='rgba(255,45,120,.2)'}>✕</span></td>
        </tr>)}</tbody>
      </table>
      {filteredRows.length===0&&<div style={{textAlign:'center',padding:24,color:'rgba(200,230,200,.2)',fontSize:12}}>{search?'Không tìm thấy':'Chưa có dữ liệu'}</div>}
    </div>
    <div style={{marginTop:3,fontSize:9,color:'rgba(200,230,200,.2)',flexShrink:0}}>Tab→cell kế · Enter→dòng dưới · Ctrl+Z undo · Click header sort · Gõ NA = missing</div>
    {imgPopup&&<div className="img-popup-overlay" onClick={()=>setImgPopup(null)}><img src={imgPopup} alt="" onClick={e=>e.stopPropagation()}/></div>}
  </div>
}
