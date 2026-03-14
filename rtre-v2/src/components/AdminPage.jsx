import { useEffect, useState } from 'react'
import { ref, onValue } from 'firebase/database'
import { db } from '../firebase.js'
import { Btn, HoloPanel } from './ui/index.jsx'
import { C } from '../theme.js'

export function AdminPage({ user, onLogout }) {
  const [users, setUsers]       = useState([])
  const [projects, setProjects] = useState([])

  useEffect(() => {
    const u1 = onValue(ref(db,'users'), s => {
      if (s.exists()) setUsers(Object.entries(s.val()).map(([id,v])=>({id,...v})))
    })
    const u2 = onValue(ref(db,'projects'), s => {
      if (s.exists()) setProjects(Object.entries(s.val()).map(([id,v])=>({id,...v})))
    })
    return () => { u1(); u2() }
  }, [])

  const totalRows = projects.reduce((s,p)=>s+Object.keys(p.rows||{}).length, 0)

  return (
    <div style={{ minHeight:'100vh', background:'#07070F', padding:28, overflow:'auto' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:32 }}>
        <div>
          <div style={{ fontFamily:'Orbitron', fontSize:16, fontWeight:700, color:'#fff', letterSpacing:'3px' }}>◈ ADMIN PANEL</div>
          <div style={{ fontFamily:'Orbitron', fontSize:7, color:C.green, letterSpacing:'5px', marginTop:3, opacity:.3 }}>REAL TIME RESEARCH ENGINE</div>
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <span style={{ fontSize:11, color:'rgba(200,230,200,.4)' }}>{user?.name}</span>
          <Btn onClick={onLogout} color={C.pink} outline small>↩ Logout</Btn>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24 }}>
        {[['Users',users.length,C.green],['Admins',users.filter(u=>u.role==='admin').length,C.pink],
          ['Projects',projects.length,C.blue],['Total Records',totalRows,C.gold]].map(([l,v,c])=>(
          <HoloPanel key={l} style={{ padding:16, textAlign:'center' }}>
            <div style={{ fontFamily:'Orbitron', fontSize:22, color:c, fontWeight:700 }}>{v}</div>
            <div style={{ fontSize:10, color:'rgba(200,230,200,.38)', marginTop:4 }}>{l}</div>
          </HoloPanel>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
        <HoloPanel style={{ padding:20 }}>
          <div style={{ fontFamily:'Orbitron', fontSize:9, color:C.blue, letterSpacing:'3px', marginBottom:16 }}>USERS</div>
          {users.length===0 && <div style={{ color:'rgba(200,230,200,.25)', fontSize:11 }}>Chưa có user</div>}
          {users.map(u=>(
            <div key={u.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
              padding:'10px 0', borderBottom:'1px solid rgba(0,250,154,.055)' }}>
              <div>
                <div style={{ color:'#e0e0e0', fontSize:12 }}>{u.name}</div>
                <div style={{ color:'rgba(200,230,200,.32)', fontSize:10 }}>{u.email}</div>
              </div>
              <span style={{ color:u.role==='admin'?C.pink:C.green, fontSize:9,
                fontFamily:'Orbitron', letterSpacing:'1px' }}>{(u.role||'user').toUpperCase()}</span>
            </div>
          ))}
        </HoloPanel>
        <HoloPanel style={{ padding:20 }}>
          <div style={{ fontFamily:'Orbitron', fontSize:9, color:C.purple, letterSpacing:'3px', marginBottom:16 }}>PROJECTS</div>
          {projects.length===0 && <div style={{ color:'rgba(200,230,200,.25)', fontSize:11 }}>Chưa có project</div>}
          {projects.map(p=>(
            <div key={p.id} style={{ padding:'10px 0', borderBottom:'1px solid rgba(0,250,154,.055)' }}>
              <div style={{ color:'#e0e0e0', fontSize:12 }}>{p.name}</div>
              <div style={{ color:'rgba(200,230,200,.32)', fontSize:10 }}>
                {Object.keys(p.variables||{}).length} biến · {Object.keys(p.rows||{}).length} dòng
              </div>
            </div>
          ))}
        </HoloPanel>
      </div>
    </div>
  )
}
