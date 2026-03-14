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

// ─── Demo seed ────────────────────────────────────────────────────────────────
function seedDemo(uid) {
  const vars = [
    { name:'ID Mẫu',        group:'Hành chính', type:'id',     order:0 },
    { name:'Tên BN',        group:'Hành chính', type:'name',   order:1 },
    { name:'Tuổi',          group:'Nhân khẩu',  type:'number', order:2 },
    { name:'Giới tính',     group:'Nhân khẩu',  type:'categorical', order:3 },
    { name:'HA tâm thu',    group:'Lâm sàng',   type:'number', order:4 },
    { name:'HA tâm trương', group:'Lâm sàng',   type:'number', order:5 },
    { name:'Biến cố',       group:'Kết cục',    type:'binary', order:6 },
  ]
  const sample = [
    ['BN001','Nguyễn Văn A',45,'Nam',130,85,0],
    ['BN002','Trần Thị B',  52,'Nữ', 145,92,1],
    ['BN003','Lê Văn C',    38,'Nam',120,78,0],
    ['BN004','Phạm Thị D',  61,'Nữ', 165,100,1],
    ['BN005','Hoàng Văn E', 47,'Nam',138,88,0],
    ['BN006','Ngô Thị F',   55,'Nữ', 152,95,1],
    ['BN007','Đặng Văn G',  43,'Nam',128,82,0],
    ['BN008','Vũ Thị H',    58,'Nữ', 158,98,1],
  ]
  push(ref(db,'projects'),{name:'DEMO • Huyết Áp',ownerUid:uid,createdAt:Date.now()})
    .then(pRef=>{
      const keys=vars.map(v=>push(ref(db,`projects/${pRef.key}/variables`),v).key)
      setTimeout(()=>{
        sample.forEach(row=>{
          const obj={createdAt:Date.now()}
          keys.forEach((k,i)=>{obj[k]=row[i]})
          push(ref(db,`projects/${pRef.key}/rows`),obj)
        })
      },700)
    })
}

// ─── Panel wrapper ────────────────────────────────────────────────────────────
const Panel = ({ children, style={} }) => (
  <div style={{
    background:'linear-gradient(135deg,rgba(0,250,154,.02) 0%,rgba(7,7,15,.98) 100%)',
    border:'1px solid rgba(0,250,154,.13)', borderRadius:7, overflow:'hidden',
    position:'relative', ...style
  }}>
    <div style={{ position:'absolute', inset:0, pointerEvents:'none',
      background:'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,250,154,.008) 3px,rgba(0,250,154,.008) 6px)' }}/>
    <div style={{ position:'relative', height:'100%' }}>{children}</div>
  </div>
)

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [authUser,  setAuthUser]  = useState(undefined)
  const [userMeta,  setUserMeta]  = useState(null)
  const [page,      setPage]      = useState('login')
  const [projects,  setProjects]  = useState([])
  const [activePid, setActivePid] = useState(null)
  const [newName,   setNewName]   = useState('')
  const [showNew,   setShowNew]   = useState(false)
  const [creating,  setCreating]  = useState(false)

  useEffect(()=>{
    return onAuthStateChanged(auth, async u=>{
      setAuthUser(u)
      if (!u){ setPage('login'); setUserMeta(null); return }
      const snap=await new Promise(res=>onValue(ref(db,`users/${u.uid}`),res,{onlyOnce:true}))
      const meta=snap.exists()?snap.val():{name:u.email,role:'user'}
      setUserMeta({uid:u.uid,...meta})
      setPage(meta.role==='admin'?'admin':'app')
    })
  },[])

  useEffect(()=>{
    if (!authUser||page!=='app') return
    return onValue(ref(db,'projects'),snap=>{
      if (!snap.exists()){ setProjects([]); return }
      const list=Object.entries(snap.val()).map(([id,v])=>({
        id, name:v.name, ownerUid:v.ownerUid,
        variables: v.variables?Object.entries(v.variables).map(([vid,vv])=>({id:vid,...vv})):[],
        rows:      v.rows     ?Object.entries(v.rows).map(([rid,rv])=>({id:rid,...rv}))     :[],
      }))
      setProjects(list)
      setActivePid(p=>p||(list[0]?.id??null))
    })
  },[authUser,page])

  const logout=()=>signOut(auth)

  const createProject=async()=>{
    if (!newName.trim()||!authUser) return
    setCreating(true)
    try {
      const r=await push(ref(db,'projects'),{name:newName.trim(),ownerUid:authUser.uid,createdAt:Date.now()})
      setActivePid(r.key); setNewName(''); setShowNew(false)
    } catch(e){ alert('Lỗi: '+e.message) }
    finally { setCreating(false) }
  }

  const activeProject=projects.find(p=>p.id===activePid)

  // Loading
  if (authUser===undefined) return (
    <div style={{minHeight:'100vh',background:'#07070F',display:'flex',alignItems:'center',
      justifyContent:'center',flexDirection:'column',gap:14}}>
      <div style={{fontFamily:'Orbitron,sans-serif',fontSize:11,color:C.green,letterSpacing:'4px',opacity:.5}}>
        INITIALIZING...
      </div>
      <div style={{width:200,height:2,background:'rgba(0,250,154,.1)',borderRadius:1,overflow:'hidden'}}>
        <div style={{height:'100%',background:C.green,width:'40%',animation:'loadbar 1.4s ease-in-out infinite',borderRadius:1}}/>
      </div>
    </div>
  )

  if (page==='login')    return <LoginPage onSwitch={setPage}/>
  if (page==='register') return <RegisterPage onSwitch={setPage}/>
  if (page==='admin')    return <AdminPage user={userMeta} onLogout={logout}/>

  return (
    <div style={{height:'100vh',display:'flex',flexDirection:'column',background:'#07070F',overflow:'hidden'}}>
      {/* ── Header ── */}
      <div style={{height:48,background:'rgba(0,0,0,.6)',borderBottom:'1px solid rgba(0,250,154,.1)',
        display:'flex',alignItems:'center',padding:'0 18px',flexShrink:0,gap:12}}>
        <div style={{fontFamily:'Orbitron,sans-serif',fontSize:14,fontWeight:700,color:C.green,
          letterSpacing:'2px',textShadow:'0 0 18px rgba(0,250,154,.4)'}}>RTRE</div>
        <span style={{fontFamily:'Orbitron,sans-serif',fontSize:8,color:'rgba(0,250,154,.28)',letterSpacing:'4px'}}>
          RESEARCH ENGINE
        </span>
        <div style={{flex:1}}/>
        <span style={{width:8,height:8,borderRadius:'50%',background:C.green,
          boxShadow:`0 0 10px ${C.green}`,display:'inline-block'}}/>
        <span style={{fontSize:13,color:'rgba(200,230,200,.5)'}}>
          {userMeta?.name||authUser?.email}
        </span>
        <Btn onClick={logout} color={C.pink} outline small>↩ Exit</Btn>
      </div>

      <div style={{flex:1,display:'flex',overflow:'hidden',minHeight:0}}>
        {/* ── Sidebar ── */}
        <div style={{width:220,background:'rgba(0,0,0,.35)',borderRight:'1px solid rgba(0,250,154,.07)',
          display:'flex',flexDirection:'column',flexShrink:0}}>
          <div style={{padding:'12px 14px',display:'flex',justifyContent:'space-between',
            alignItems:'center',borderBottom:'1px solid rgba(0,250,154,.06)'}}>
            <span style={{fontFamily:'Orbitron,sans-serif',fontSize:9,color:C.green,letterSpacing:'2px',opacity:.5}}>
              ◈ PROJECTS
            </span>
            <span onClick={()=>setShowNew(p=>!p)}
              style={{color:C.green,cursor:'pointer',fontSize:20,opacity:.5,lineHeight:1,transition:'opacity .15s'}}
              onMouseEnter={e=>e.currentTarget.style.opacity='1'}
              onMouseLeave={e=>e.currentTarget.style.opacity='.5'}>+</span>
          </div>

          {showNew&&(
            <div style={{padding:'10px 12px',borderBottom:'1px solid rgba(0,250,154,.06)',background:'rgba(0,250,154,.025)'}}>
              <input value={newName} onChange={e=>setNewName(e.target.value)}
                placeholder="Tên project..." autoFocus
                onKeyDown={e=>e.key==='Enter'&&createProject()}
                style={{marginBottom:8,fontSize:13}}/>
              <div style={{display:'flex',gap:6}}>
                <Btn small onClick={createProject} disabled={!newName.trim()||creating}>
                  {creating?'...':'Tạo'}
                </Btn>
                <Btn small color={C.pink} outline onClick={()=>{setShowNew(false);setNewName('')}}>Hủy</Btn>
              </div>
            </div>
          )}

          <div style={{flex:1,overflow:'auto',padding:'6px 0'}}>
            {projects.length===0&&(
              <div style={{padding:'20px 14px',color:'rgba(200,230,200,.22)',fontSize:12,lineHeight:2}}>
                Chưa có project.<br/>Nhấn "+" để tạo,<br/>hoặc{' '}
                <span onClick={()=>seedDemo(authUser.uid)}
                  style={{color:C.green,cursor:'pointer',textDecoration:'underline'}}>
                  load demo data
                </span>
              </div>
            )}
            {projects.map(p=>(
              <div key={p.id} onClick={()=>setActivePid(p.id)}
                style={{padding:'10px 14px',cursor:'pointer',
                  borderLeft:p.id===activePid?`2px solid ${C.green}`:'2px solid transparent',
                  background:p.id===activePid?'rgba(0,250,154,.07)':'transparent',transition:'all .15s'}}
                onMouseEnter={e=>{if(p.id!==activePid)e.currentTarget.style.background='rgba(0,250,154,.03)'}}
                onMouseLeave={e=>{if(p.id!==activePid)e.currentTarget.style.background='transparent'}}>
                <div style={{fontSize:13,color:p.id===activePid?C.green:'rgba(200,230,200,.55)',
                  marginBottom:3,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                  {p.name}
                </div>
                <div style={{fontSize:11,color:'rgba(200,230,200,.22)'}}>
                  {p.rows.length} dòng · {p.variables.length} biến
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── 3-panel main area ── */}
        {activeProject ? (
          <div style={{flex:1,display:'grid',gridTemplateColumns:'1fr 1.6fr',
            gridTemplateRows:'1fr 1fr',gap:10,padding:10,overflow:'hidden',minWidth:0}}>

            {/* Panel 1 — INPUT (left, full height) */}
            <Panel style={{gridRow:'1 / 3'}}>
              <InputTab project={activeProject}/>
            </Panel>

            {/* Panel 2 — TABLE (top right) */}
            <Panel>
              <TableTab project={activeProject}/>
            </Panel>

            {/* Panel 3 — CHART & STATS (bottom right) */}
            <Panel>
              <ChartTab project={activeProject}/>
            </Panel>

          </div>
        ) : (
          <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',
            flexDirection:'column',gap:14,color:'rgba(200,230,200,.22)'}}>
            <div style={{fontFamily:'Orbitron,sans-serif',fontSize:13,letterSpacing:'3px'}}>
              CHỌN HOẶC TẠO PROJECT
            </div>
            <div style={{fontSize:13}}>← Sidebar bên trái</div>
          </div>
        )}
      </div>
    </div>
  )
}
