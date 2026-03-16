import { useState, useEffect, useRef } from 'react'
import { RGB } from '../../theme.js'

export const Btn=({onClick,children,color='#00FA9A',outline=false,small=false,style:s={},disabled=false,id,title})=>{const[hov,setHov]=useState(false);const rgb=RGB[color]||'200,200,200';return<button onClick={onClick} disabled={disabled} id={id} title={title} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} style={{background:outline?'transparent':hov?`rgba(${rgb},.18)`:`rgba(${rgb},.07)`,border:`1px solid ${hov?color:color+'70'}`,color,padding:small?'4px 10px':'8px 18px',borderRadius:4,cursor:disabled?'not-allowed':'pointer',fontFamily:"'Orbitron',sans-serif",fontSize:small?9:10,letterSpacing:'1.5px',textTransform:'uppercase',transition:'all .2s',boxShadow:hov?`0 0 14px rgba(${rgb},.3)`:'none',opacity:disabled?.5:1,display:'inline-flex',alignItems:'center',gap:4,whiteSpace:'nowrap',...s}}>{children}</button>}

export const HoloPanel=({children,style={}})=><div style={{background:'linear-gradient(135deg,rgba(0,250,154,.025) 0%,rgba(7,7,15,.98) 100%)',border:'1px solid rgba(0,250,154,.16)',borderRadius:8,position:'relative',overflow:'hidden',...style}}><div style={{position:'absolute',inset:0,pointerEvents:'none',background:'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,250,154,.01) 2px,rgba(0,250,154,.01) 4px)'}}/><div style={{position:'relative'}}>{children}</div></div>

export const Pill=({label,value,color='#00FA9A'})=>{const rgb=RGB[color]||'0,250,154';return<div style={{background:`rgba(${rgb},.05)`,border:`1px solid ${color}18`,borderRadius:4,padding:'5px 8px',textAlign:'center'}}><div style={{fontSize:7,color:`${color}88`,letterSpacing:'2px',marginBottom:2,fontFamily:'Orbitron'}}>{label}</div><div style={{fontSize:12,color,fontFamily:'Orbitron',fontWeight:700}}>{value??'—'}</div></div>}

// ─── Custom Confirm Modal (replaces window.confirm) ─────────────────────────
export function ConfirmModal({ message, onConfirm, onCancel, confirmText='Xác nhận', cancelText='Hủy', color='#FF2D78' }) {
  useEffect(()=>{
    const h=e=>{if(e.key==='Enter'){e.preventDefault();onConfirm()}else if(e.key==='Escape'){e.preventDefault();onCancel()}}
    window.addEventListener('keydown',h);return()=>window.removeEventListener('keydown',h)
  },[onConfirm,onCancel])
  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.82)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:3000}} onClick={onCancel}>
      <div className="fade-in" onClick={e=>e.stopPropagation()} style={{width:380,maxWidth:'90vw'}}>
        <HoloPanel style={{padding:24}}>
          <div style={{fontSize:14,color:'rgba(220,240,220,.8)',marginBottom:20,lineHeight:1.6,whiteSpace:'pre-line'}}>{message}</div>
          <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
            <Btn onClick={onCancel} outline small style={{padding:'8px 16px',fontSize:11}}>
              {cancelText} <span style={{fontSize:9,opacity:.5,marginLeft:4}}>Esc</span>
            </Btn>
            <Btn onClick={onConfirm} color={color} small style={{padding:'8px 16px',fontSize:11}}>
              {confirmText} <span style={{fontSize:9,opacity:.5,marginLeft:4}}>↵</span>
            </Btn>
          </div>
        </HoloPanel>
      </div>
    </div>
  )
}

// ─── Hook for custom confirm ─────────────────────────────────────────────────
export function useConfirm() {
  const [state, setState] = useState(null)
  const confirm = (message, color) => new Promise(resolve => {
    setState({ message, color, resolve })
  })
  const modal = state ? <ConfirmModal message={state.message} color={state.color}
    onConfirm={()=>{state.resolve(true);setState(null)}}
    onCancel={()=>{state.resolve(false);setState(null)}}/> : null
  return [confirm, modal]
}

// ─── Sync Badge ──────────────────────────────────────────────────────────────
export function SyncBadge({ status='synced' }) {
  // status: 'synced' | 'saving' | 'offline'
  const label = status==='synced'?'SYNC':status==='saving'?'SAVING':'OFFLINE'
  return <div className={`sync-badge ${status}`}>
    <span className={`sync-dot ${status}`}/>
    <span>{label}</span>
  </div>
}
