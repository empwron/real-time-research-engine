import { useState, useEffect } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { ref, onValue, push } from 'firebase/database'
import { auth, db } from './firebase.js'
import { LoginPage, RegisterPage } from './components/AuthPages.jsx'
import { AdminPage } from './components/AdminPage.jsx'
import { InputTab } from './components/tabs/InputTab.jsx'
import { TableTab } from './components/tabs/TableTab.jsx'
import { ChartTab } from './components/tabs/ChartTab.jsx'
import { Btn } from './components/ui/index.jsx'
import { C } from './theme.js'
import './styles/global.css'

function seedDemo(uid) {
  const vars = [
    { name:'Tuổi',          group:'Nhân khẩu', type:'number' },
    { name:'HA tâm thu',    group:'Lâm sàng',  type:'number' },
    { name:'HA tâm trương', group:'Lâm sàng',  type:'number' },
    { name:'Giới tính',     group:'Nhân khẩu', type:'categorical' },
    { name:'Biến cố',       group:'Kết cục',   type:'binary' },
  ]
  const sample = [
    [45,130,85,'Nam',0],[52,145,92,'Nữ',1],[38,120,78,'Nam',0],
    [61,165,100,'Nữ',1],[47,138,88,'Nam',0],[55,152,95,'Nữ',1],
    [43,128,82,'Nam',0],[58,158,98,'Nữ',1],[49,135,86,'Nam',0],
    [64,170,105,'Nữ',1],
  ]
  push(ref(db, 'projects'), { name:'DEMO • Huyết Áp', ownerUid: uid, createdAt: Date.now() })
    .then(pRef => {
      const varRefs = vars.map(v => {
        const vr = push(ref(db, `projects/${pRef.key}/variables`), v)
        return vr.key
      })
      setTimeout(() => {
        sample.forEach(row => {
          const obj = { createdAt: Date.now() }
          varRefs.forEach((k, i) => { obj[k] = row[i] })
          push(ref(db, `projects/${pRef.key}/rows`), obj)
        })
      }, 600)
    })
}

export default function App() {
  const [authUser,   setAuthUser]   = useState(undefined)
  const [userMeta,   setUserMeta]   = useState(null)
  const [page,       setPage]       = useState('login')
  const [projects,   setProjects]   = useState([])
  const [activePid,  setActivePid]  = useState(null)
  const [tab,        setTab]        = useState('input')
  const [newName,    setNewName]    = useState('')
  const [showNew,    setShowNew]    = useState(false)
  const [creating,   setCreating]   = useState(false)

  useEffect(() => {
    return onAuthStateChanged(auth, async u => {
      setAuthUser(u)
      if (!u) { setPage('login'); setUserMeta(null); return }
      const snap = await new Promise(res => onValue(ref(db, `users/${u.uid}`), res, { onlyOnce: true }))
      const meta = snap.exists() ? snap.val() : { name: u.email, role: 'user' }
      setUserMeta({ uid: u.uid, ...meta })
      setPage(meta.role === 'admin' ? 'admin' : 'app')
    })
  }, [])

  useEffect(() => {
    if (!authUser || page !== 'app') return
    return onValue(ref(db, 'projects'), snap => {
      if (!snap.exists()) { setProjects([]); return }
      const list = Object.entries(snap.val()).map(([id, v]) => ({
        id,
        name:      v.name,
        ownerUid:  v.ownerUid,
        variables: v.variables ? Object.entries(v.variables).map(([vid,vv])=>({id:vid,...vv})) : [],
        rows:      v.rows      ? Object.entries(v.rows).map(([rid,rv])=>({id:rid,...rv}))       : [],
      }))
      setProjects(list)
      setActivePid(p => p || (list[0]?.id ?? null))
    })
  }, [authUser, page])

  const logout = () => signOut(auth)

  const createProject = async () => {
    if (!newName.trim() || !authUser) return
    setCreating(true)
    try {
      const r = await push(ref(db, 'projects'), {
        name: newName.trim(), ownerUid: authUser.uid, createdAt: Date.now()
      })
      setActivePid(r.key); setTab('input')
      setNewName(''); setShowNew(false)
    } catch(e) { alert('Lỗi: ' + e.message) }
    finally { setCreating(false) }
  }

  const activeProject = projects.find(p => p.id === activePid)

  if (authUser === undefined) return (
    <div style={{ minHeight:'100vh', background:'#07070F', display:'flex',
      alignItems:'center', justifyContent:'center', flexDirection:'column', gap:14 }}>
      <div style={{ fontFamily:'Orbitron', fontSize:10, color:C.green, letterSpacing:'4px', opacity:.5 }}>
        INITIALIZING...
      </div>
      <div style={{ width:180, height:2, background:'rgba(0,250,154,.1)', borderRadius:1, overflow:'hidden' }}>
        <div style={{ height:'100%', background:C.green, width:'40%',
          animation:'loadbar 1.4s ease-in-out infinite', borderRadius:1 }}/>
      </div>
    </div>
  )

  if (page === 'login')    return <LoginPage onSwitch={setPage}/>
  if (page === 'register') return <RegisterPage onSwitch={setPage}/>
  if (page === 'admin')    return <AdminPage user={userMeta} onLogout={logout}/>

  return (
    <div style={{ height:'100vh', display:'flex', flexDirection:'column', background:'#07070F', overflow:'hidden' }}>
      {/* Header */}
      <div style={{ height:46, background:'rgba(0,0,0,.55)',
        borderBottom:'1px solid rgba(0,250,154,.1)',
        display:'flex', alignItems:'center', padding:'0 18px',
        flexShrink:0, gap:10 }}>
        <div style={{ fontFamily:'Orbitron', fontSize:13, fontWeight:700, color:C.green,
          letterSpacing:'2px', textShadow:'0 0 16px rgba(0,250,154,.38)' }}>RTRE</div>
        <span style={{ fontFamily:'Orbitron', fontSize:7, color:'rgba(0,250,154,.28)', letterSpacing:'4px' }}>
          RESEARCH ENGINE
        </span>
        <div style={{ flex:1 }}/>
        <span style={{ width:7, height:7, borderRadius:'50%', background:C.green,
          boxShadow:`0 0 8px ${C.green}`, display:'inline-block' }}/>
        <span style={{ fontSize:11, color:'rgba(200,230,200,.45)' }}>
          {userMeta?.name || authUser?.email}
        </span>
        <Btn onClick={logout} color={C.pink} outline small>↩ Exit</Btn>
      </div>

      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>
        {/* Sidebar */}
        <div style={{ width:216, background:'rgba(0,0,0,.32)',
          borderRight:'1px solid rgba(0,250,154,.07)',
          display:'flex', flexDirection:'column', flexShrink:0 }}>
          <div style={{ padding:'12px 14px', display:'flex', justifyContent:'space-between',
            alignItems:'center', borderBottom:'1px solid rgba(0,250,154,.06)' }}>
            <span style={{ fontFamily:'Orbitron', fontSize:8, color:C.green, letterSpacing:'2px', opacity:.5 }}>◈ PROJECTS</span>
            <span onClick={()=>setShowNew(p=>!p)}
              style={{ color:C.green, cursor:'pointer', fontSize:18, opacity:.5, lineHeight:1, transition:'opacity .15s' }}
              onMouseEnter={e=>e.currentTarget.style.opacity='1'}
              onMouseLeave={e=>e.currentTarget.style.opacity='.5'}>+</span>
          </div>

          {showNew && (
            <div style={{ padding:'10px 12px', borderBottom:'1px solid rgba(0,250,154,.06)',
              background:'rgba(0,250,154,.025)' }}>
              <input value={newName} onChange={e=>setNewName(e.target.value)}
                placeholder="Tên project..." autoFocus
                onKeyDown={e=>e.key==='Enter'&&createProject()}
                style={{ marginBottom:7, fontSize:11 }}/>
              <div style={{ display:'flex', gap:6 }}>
                <Btn small onClick={createProject} disabled={!newName.trim()||creating}>
                  {creating?'...':'Tạo'}
                </Btn>
                <Btn small color={C.pink} outline onClick={()=>{setShowNew(false);setNewName('')}}>Hủy</Btn>
              </div>
            </div>
          )}

          <div style={{ flex:1, overflow:'auto', padding:'6px 0' }}>
            {projects.length === 0 && (
              <div style={{ padding:'20px 14px', color:'rgba(200,230,200,.22)', fontSize:10, lineHeight:2 }}>
                Chưa có project.<br/>
                Nhấn "+" để tạo,<br/>hoặc{' '}
                <span onClick={()=>seedDemo(authUser.uid)}
                  style={{ color:C.green, cursor:'pointer', textDecoration:'underline' }}>
                  load demo data
                </span>
              </div>
            )}
            {projects.map(p => (
              <div key={p.id} onClick={()=>{setActivePid(p.id);setTab('input')}}
                style={{ padding:'9px 14px', cursor:'pointer',
                  borderLeft: p.id===activePid?`2px solid ${C.green}`:'2px solid transparent',
                  background: p.id===activePid?'rgba(0,250,154,.07)':'transparent',
                  transition:'all .15s' }}
                onMouseEnter={e=>{if(p.id!==activePid)e.currentTarget.style.background='rgba(0,250,154,.03)'}}
                onMouseLeave={e=>{if(p.id!==activePid)e.currentTarget.style.background='transparent'}}>
                <div style={{ fontSize:11, color:p.id===activePid?C.green:'rgba(200,230,200,.52)',
                  marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {p.name}
                </div>
                <div style={{ fontSize:9, color:'rgba(200,230,200,.2)' }}>
                  {p.rows.length} dòng · {p.variables.length} biến
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 }}>
          {activeProject ? (
            <>
              <div style={{ height:42, borderBottom:'1px solid rgba(0,250,154,.07)',
                display:'flex', alignItems:'flex-end', paddingLeft:18, gap:2,
                flexShrink:0, background:'rgba(0,0,0,.14)' }}>
                {[{id:'input',label:'◈ INPUT'},{id:'table',label:'▦ BẢNG'},{id:'chart',label:'◉ BIỂU ĐỒ & STATS'}].map(t=>(
                  <div key={t.id} onClick={()=>setTab(t.id)}
                    style={{ padding:'8px 14px', cursor:'pointer',
                      fontFamily:'Orbitron', fontSize:9, letterSpacing:'1.5px',
                      color:tab===t.id?C.green:'rgba(200,230,200,.28)',
                      borderBottom:tab===t.id?`2px solid ${C.green}`:'2px solid transparent',
                      marginBottom:-1, transition:'color .15s', whiteSpace:'nowrap' }}
                    onMouseEnter={e=>{if(tab!==t.id)e.currentTarget.style.color='rgba(0,250,154,.5)'}}
                    onMouseLeave={e=>{if(tab!==t.id)e.currentTarget.style.color='rgba(200,230,200,.28)'}}>
                    {t.label}
                  </div>
                ))}
                <div style={{flex:1}}/>
                <span style={{ padding:'0 14px', fontSize:8, color:'rgba(200,230,200,.18)',
                  fontFamily:'Orbitron', letterSpacing:'1px', alignSelf:'center',
                  overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:200 }}>
                  {activeProject.name}
                </span>
              </div>
              <div key={`${activePid}-${tab}`} className="fade-in" style={{ flex:1, overflow:'hidden' }}>
                {tab==='input' && <InputTab project={activeProject}/>}
                {tab==='table' && <TableTab project={activeProject}/>}
                {tab==='chart' && <ChartTab project={activeProject}/>}
              </div>
            </>
          ) : (
            <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center',
              flexDirection:'column', gap:12, color:'rgba(200,230,200,.22)' }}>
              <div style={{ fontFamily:'Orbitron', fontSize:11, letterSpacing:'3px' }}>CHỌN HOẶC TẠO PROJECT</div>
              <div style={{ fontSize:11 }}>← Sidebar bên trái</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
