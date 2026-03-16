import { useState } from 'react'
import { RGB } from '../../theme.js'

export const Btn = ({ onClick, children, color='#00FA9A', outline=false, small=false, style:s={}, disabled=false, id, title }) => {
  const [hov, setHov] = useState(false)
  const rgb = RGB[color] || '200,200,200'
  return (
    <button onClick={onClick} disabled={disabled} id={id} title={title}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        background: outline ? 'transparent' : hov ? `rgba(${rgb},.18)` : `rgba(${rgb},.07)`,
        border: `1px solid ${hov ? color : color + '70'}`, color,
        padding: small ? '4px 10px' : '8px 18px', borderRadius: 4,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: "'Orbitron',sans-serif", fontSize: small ? 9 : 10,
        letterSpacing: '1.5px', textTransform: 'uppercase', transition: 'all .2s',
        boxShadow: hov ? `0 0 14px rgba(${rgb},.3)` : 'none',
        opacity: disabled ? .5 : 1, display: 'inline-flex', alignItems: 'center', gap: 4,
        whiteSpace: 'nowrap', ...s
      }}>
      {children}
    </button>
  )
}

export const HoloPanel = ({ children, style = {} }) => (
  <div style={{
    background: 'linear-gradient(135deg,rgba(0,250,154,.025) 0%,rgba(7,7,15,.98) 100%)',
    border: '1px solid rgba(0,250,154,.16)', borderRadius: 8,
    position: 'relative', overflow: 'hidden', ...style
  }}>
    <div style={{ position:'absolute', inset:0, pointerEvents:'none',
      background:'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,250,154,.01) 2px,rgba(0,250,154,.01) 4px)' }}/>
    <div style={{ position: 'relative' }}>{children}</div>
  </div>
)

export const HoloTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'rgba(5,5,18,.96)', border:'1px solid rgba(0,250,154,.4)',
      borderRadius:4, padding:'8px 12px', fontSize:11, boxShadow:'0 0 18px rgba(0,250,154,.12)' }}>
      <p style={{ color:'#00FA9A', fontFamily:'Orbitron', fontSize:10, marginBottom:4 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || '#00FA9A' }}>
          {p.name}: <span style={{ color:'#fff' }}>
            {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}
          </span>
        </p>
      ))}
    </div>
  )
}

export const Pill = ({ label, value, color = '#00FA9A' }) => {
  const rgb = RGB[color] || '0,250,154'
  return (
    <div style={{ background:`rgba(${rgb},.05)`, border:`1px solid ${color}18`, borderRadius:4, padding:'6px 10px', textAlign:'center' }}>
      <div style={{ fontSize:8, color:`${color}88`, letterSpacing:'2px', marginBottom:3, fontFamily:'Orbitron' }}>{label}</div>
      <div style={{ fontSize:13, color, fontFamily:'Orbitron', fontWeight:700 }}>{value ?? '—'}</div>
    </div>
  )
}

export const InfoTip = ({ text, color='rgba(200,230,200,.4)' }) => {
  const [show, setShow] = useState(false)
  return (
    <span style={{ position:'relative', display:'inline-block' }}
      onMouseEnter={()=>setShow(true)} onMouseLeave={()=>setShow(false)}>
      <span style={{ cursor:'help', fontSize:12, color, fontWeight:700,
        width:16, height:16, borderRadius:'50%', border:`1px solid ${color}`,
        display:'inline-flex', alignItems:'center', justifyContent:'center', lineHeight:1 }}>?</span>
      {show && (
        <div style={{ position:'absolute', bottom:'calc(100% + 6px)', left:'50%', transform:'translateX(-50%)',
          background:'rgba(5,5,18,.96)', border:'1px solid rgba(0,250,154,.3)', borderRadius:5,
          padding:'8px 12px', fontSize:12, color:'rgba(200,230,200,.75)', whiteSpace:'normal',
          width:260, zIndex:999, boxShadow:'0 4px 16px rgba(0,0,0,.5)', lineHeight:1.5,
          pointerEvents:'none' }}>
          {text}
        </div>
      )}
    </span>
  )
}
