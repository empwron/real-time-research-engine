import { useState, useEffect, useRef, useCallback } from 'react'
import { onAuthStateChanged, signOut, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth'
import { ref, onValue, push, update } from 'firebase/database'
import { auth, db } from './firebase.js'
import { LoginPage, RegisterPage } from './components/AuthPages.jsx'
import { AdminPage } from './components/AdminPage.jsx'
import { InputTab } from './components/tabs/InputTab.jsx'
import { TableTab } from './components/tabs/TableTab.jsx'
import { ChartTab } from './components/tabs/ChartTab.jsx'
import { Btn, HoloPanel } from './components/ui/index.jsx'
import { C } from './theme.js'
import { padPw } from './utils/pwUtils.js'
import './styles/global.css'

// ─── Demo seed ────────────────────────────────────────────────────────────────
function seedDemo(uid) {
  const vars = [
    {name:'ID Mẫu',group:'',type:'id',order:0},
    {name:'Tên BN',group:'',type:'name',order:1},
    {name:'Tuổi',group:'',type:'number',order:2},
    {name:'Giới tính',group:'',type:'categorical',order:3},
    {name:'HA tâm thu',group:'',type:'number',order:4},
    {name:'HA tâm trương',group:'',type:'number',order:5},
    {name:'Biến cố',group:'',type:'binary',order:6},
  ]
  const rows=[[`BN001`,'Nguyễn Văn A',45,'Nam',130,85,0],['BN002','Trần Thị B',52,'Nữ',145,92,1],
    ['BN003','Lê Văn C',38,'Nam',120,78,0],['BN004','Phạm Thị D',61,'Nữ',165,100,1],
    ['BN005','Hoàng Văn E',47,'Nam',138,88,0],['BN006','Ngô Thị F',55,'Nữ',152,95,1]]
  push(ref(db,'projects'),{name:'DEMO • Huyết Áp',ownerUid:uid,createdAt:Date.now(),parentId:null})
    .then(pRef=>{
      const keys=vars.map(v=>push(ref(db,`projects/${pRef.key}/variables`),v).key)
      setTimeout(()=>{
        rows.forEach(r=>{
          const obj={createdAt:Date.now()}
          keys.forEach((k,i)=>{obj[k]=r[i]})
          push(ref(db,`projects/${pRef.key}/rows`),obj)
        })
      },700)
    })
}

// ─── Change Password Modal ────────────────────────────────────────────────────
function ChangePwModal({ user, onClose }) {
  const [oldPw, setOldPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [newPw2, setNewPw2] = useState('')
  const [err, setErr]     = useState('')
  const [ok, setOk]       = useState(false)
  const [loading, setLoading] = useState(false)

  const go = async () => {
    if (!oldPw||!newPw) return setErr('Điền đầy đủ thông tin')
    if (newPw!==newPw2) return setErr('Mật khẩu mới không khớp')
    setLoading(true); setErr('')
    try {
      const cred = EmailAuthProvider.credential(user.email, padPw(oldPw))
      await reauthenticateWithCredential(auth.currentUser, cred)
      await updatePassword(auth.currentUser, padPw(newPw))
      setOk(true)
      setTimeout(onClose, 1500)
    } catch(e) {
      setErr(e.code==='auth/wrong-password'?'Mật khẩu hiện tại không đúng':'Lỗi: '+e.message)
    } finally { setLoading(false) }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.82)',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000 }}>
      <div className="fade-in" style={{ width:380, maxWidth:'90vw' }}>
        <HoloPanel style={{ padding:28 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
            <div style={{ fontFamily:'Orbitron,sans-serif', fontSize:11, color:C.gold }}>◈ ĐỔI MẬT KHẨU</div>
            <span onClick={onClose} style={{ color:'rgba(200,230,200,.4)', cursor:'pointer', fontSize:20 }}>✕</span>
          </div>
          {ok?(
            <div style={{ textAlign:'center', padding:20, color:C.green, fontSize:15 }}>✓ Đổi mật khẩu thành công</div>
          ):(
            <>
              {[['MẬT KHẨU HIỆN TẠI',oldPw,setOldPw],['MẬT KHẨU MỚI',newPw,setNewPw],
                ['XÁC NHẬN MẬT KHẨU MỚI',newPw2,setNewPw2]].map(([l,v,s])=>(
                <div key={l} style={{ marginBottom:14 }}>
                  <label style={{ fontSize:13, color:'rgba(200,230,200,.5)', display:'block', marginBottom:5 }}>{l}</label>
                  <input type="password" value={v} onChange={e=>s(e.target.value)}
                    onKeyDown={e=>e.key==='Enter'&&go()}/>
                </div>
              ))}
              {err&&<div style={{ color:C.pink, fontSize:13, marginBottom:14, padding:'7px 12px',
                background:'rgba(255,45,120,.07)', borderRadius:4 }}>{err}</div>}
              <div style={{ display:'flex', gap:10, marginTop:4 }}>
                <Btn onClick={go} color={C.gold} disabled={loading}
                  style={{ flex:1, justifyContent:'center', padding:'10px', fontSize:13 }}>
                  {loading?'◌ Đang đổi...':'Xác nhận'}
                </Btn>
                <Btn onClick={onClose} color={C.pink} outline style={{ padding:'10px 16px', fontSize:13 }}>Hủy</Btn>
              </div>
            </>
          )}
        </HoloPanel>
      </div>
    </div>
  )
}

// ─── Resize divider ───────────────────────────────────────────────────────────
function Divider({ onDrag, vertical=false }) {
  const dragging = useRef(false)
  const start    = useRef(0)

  const onMouseDown = e => {
    dragging.current = true
    start.current = vertical ? e.clientY : e.clientX
    const onMove = ev => {
      if (!dragging.current) return
      const delta = vertical ? ev.clientY - start.current : ev.clientX - start.current
      start.current = vertical ? ev.clientY : ev.clientX
      onDrag(delta)
    }
    const onUp = () => { dragging.current = false; window.removeEventListener('mousemove',onMove); window.removeEventListener('mouseup',onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div onMouseDown={onMouseDown}
      style={{ [vertical?'height':'width']: 6, flexShrink:0, cursor:vertical?'row-resize':'col-resize',
        background:'rgba(255,255,255,.03)', position:'relative',
        display:'flex', alignItems:'center', justifyContent:'center' }}
      onMouseEnter={e=>e.currentTarget.style.background='rgba(0,250,154,.12)'}
      onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,.03)'}>
      <div style={{ [vertical?'width':'height']:30, [vertical?'height':'width']:3,
        background:'rgba(255,255,255,.12)', borderRadius:2 }}/>
    </div>
  )
}

// ─── Panel wrapper ────────────────────────────────────────────────────────────
const PANEL_BORDER = { input: C.cyan, table: C.purple, chart: C.green }
const Panel = ({ children, panelKey, style={} }) => (
  <div style={{ display:'flex', flexDirection:'column', overflow:'hidden',
    background:`linear-gradient(135deg,rgba(${panelKey==='input'?'0,229,255':panelKey==='table'?'191,95,255':'0,250,154'},.015) 0%,rgba(7,7,15,.98) 100%)`,
    border:`1px solid ${PANEL_BORDER[panelKey]}20`, borderRadius:7, ...style }}>
    {children}
  </div>
)

// ─── Sidebar item ─────────────────────────────────────────────────────────────
function SidebarItem({ p, activePid, setActivePid, level=0, children }) {
  const [open, setOpen] = useState(true)
  const hasChildren = children && children.length > 0
  return (
    <div>
      <div onClick={()=>{ setActivePid(p.id) }}
        style={{ padding:`8px ${14+level*12}px`, cursor:'pointer',
          borderLeft: p.id===activePid ? `2px solid ${C.green}` : '2px solid transparent',
          background: p.id===activePid ? 'rgba(0,250,154,.07)' : 'transparent',
          display:'flex', alignItems:'center', gap:6, transition:'all .15s' }}
        onMouseEnter={e=>{ if(p.id!==activePid) e.currentTarget.style.background='rgba(0,250,154,.03)' }}
        onMouseLeave={e=>{ if(p.id!==activePid) e.currentTarget.style.background='transparent' }}>
        {hasChildren&&(
          <span onClick={e=>{e.stopPropagation();setOpen(o=>!o)}}
            style={{ color:'rgba(200,230,200,.35)', fontSize:10, userSelect:'none' }}>
            {open?'▾':'▸'}
          </span>
        )}
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:13, color:p.id===activePid?C.green:'rgba(200,230,200,.55)',
            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {level>0&&<span style={{ color:'rgba(200,230,200,.2)', marginRight:5 }}>└</span>}
            {p.name}
          </div>
          <div style={{ fontSize:11, color:'rgba(200,230,200,.2)' }}>
            {(p.rows||[]).length} dòng · {(p.variables||[]).length} biến
          </div>
        </div>
      </div>
      {open && hasChildren && children.map(sub=>(
        <SidebarItem key={sub.id} p={sub} activePid={activePid} setActivePid={setActivePid} level={level+1} children={[]}/>
      ))}
    </div>
  )
}

// ─── New Project Modal ────────────────────────────────────────────────────────
function NewProjectModal({ projects, uid, onClose }) {
  const [name, setName]   = useState('')
  const [parentId, setParentId] = useState('')
  const [saving, setSaving] = useState(false)

  const topProjects = projects.filter(p=>!p.parentId)

  const go = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      await push(ref(db,'projects'),{
        name:name.trim(), ownerUid:uid, createdAt:Date.now(),
        parentId: parentId||null
      })
      onClose()
    } catch(e){ alert(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.82)',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000 }}>
      <div className="fade-in" style={{ width:380, maxWidth:'90vw' }}>
        <HoloPanel style={{ padding:26 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:22 }}>
            <div style={{ fontFamily:'Orbitron,sans-serif', fontSize:11, color:C.green }}>+ PROJECT MỚI</div>
            <span onClick={onClose} style={{ color:'rgba(200,230,200,.4)', cursor:'pointer', fontSize:20 }}>✕</span>
          </div>
          <div style={{ marginBottom:16 }}>
            <label style={{ fontSize:13, color:'rgba(200,230,200,.5)', display:'block', marginBottom:6 }}>TÊN PROJECT</label>
            <input value={name} onChange={e=>setName(e.target.value)} autoFocus
              placeholder="Nghiên cứu huyết áp 2025..."
              onKeyDown={e=>e.key==='Enter'&&go()}/>
          </div>
          <div style={{ marginBottom:22 }}>
            <label style={{ fontSize:13, color:'rgba(200,230,200,.5)', display:'block', marginBottom:6 }}>
              THUỘC PROJECT LỚN (tùy chọn)
            </label>
            <select value={parentId} onChange={e=>setParentId(e.target.value)}>
              <option value="">— Project độc lập —</option>
              {topProjects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <Btn onClick={go} disabled={!name.trim()||saving}
              style={{ flex:1, justifyContent:'center', padding:'10px', fontSize:13 }}>
              {saving?'◌ Đang tạo...':'Tạo project'}
            </Btn>
            <Btn onClick={onClose} color={C.pink} outline style={{ padding:'10px 16px', fontSize:13 }}>Hủy</Btn>
          </div>
        </HoloPanel>
      </div>
    </div>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [authUser,  setAuthUser]  = useState(undefined)
  const [userMeta,  setUserMeta]  = useState(null)
  const [page,      setPage]      = useState('login')
  const [projects,  setProjects]  = useState([])
  const [activePid, setActivePid] = useState(null)
  const [sidebar,   setSidebar]   = useState(true)
  const [showNewProj, setShowNewProj] = useState(false)
  const [showChangePw, setShowChangePw] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)

  // Bắt sự kiện click ra ngoài để đóng menu user
  const userMenuRef = useRef(null)
  useEffect(() => {
    function handleClickOutside(e) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setShowUserMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Panel sizes in pixels
  const containerRef = useRef(null)
  const [leftW, setLeftW]   = useState(300) // Input panel width
  const [topH,  setTopH]    = useState(0)   // Will init after mount

  useEffect(()=>{
    const h = window.innerHeight - 48
    setTopH(Math.round(h * 0.42))
  },[])

  // Auth
  useEffect(()=>{
    return onAuthStateChanged(auth, async u=>{
      setAuthUser(u)
      if(!u){setPage('login');setUserMeta(null);return}
      const snap=await new Promise(res=>onValue(ref(db,`users/${u.uid}`),res,{onlyOnce:true}))
      const meta=snap.exists()?snap.val():{name:u.email,role:'user'}
      setUserMeta({uid:u.uid,...meta,email:u.email})
      setPage(meta.role==='admin'?'admin':'app')
    })
  },[])

  // Projects
  useEffect(()=>{
    if(!authUser||page!=='app') return
    return onValue(ref(db,'projects'),snap=>{
      if(!snap.exists()){setProjects([]);return}
      const list=Object.entries(snap.val()).map(([id,v])=>({
        id, name:v.name, ownerUid:v.ownerUid, parentId:v.parentId||null,
        variables:v.variables?Object.entries(v.variables).map(([vid,vv])=>({id:vid,...vv})):[],
        rows:v.rows?Object.entries(v.rows).map(([rid,rv])=>({id:rid,...rv})):[],
      }))
      setProjects(list)
      setActivePid(p=>p||(list[0]?.id??null))
    })
  },[authUser,page])

  const logout = () => signOut(auth)
  const activeProject = projects.find(p=>p.id===activePid)

  // Loading
  if(authUser===undefined) return (
    <div style={{minHeight:'100vh',background:'#07070F',display:'flex',alignItems:'center',
      justifyContent:'center',flexDirection:'column',gap:14}}>
      <div style={{fontFamily:'Orbitron,sans-serif',fontSize:11,color:C.green,letterSpacing:'4px',opacity:.5}}>INITIALIZING...</div>
      <div style={{width:200,height:2,background:'rgba(0,250,154,.1)',borderRadius:1,overflow:'hidden'}}>
        <div style={{height:'100%',background:C.green,width:'40%',animation:'loadbar 1.4s ease-in-out infinite',borderRadius:1}}/>
      </div>
    </div>
  )

  if(page==='login')    return <LoginPage onSwitch={setPage}/>
  if(page==='register') return <RegisterPage onSwitch={setPage}/>
  if(page==='admin')    return <AdminPage user={userMeta} onLogout={logout}/>

  // Project tree
  const topProjects = projects.filter(p=>!p.parentId)
  const subOf = pid => projects.filter(p=>p.parentId===pid)

  return (
    <div style={{height:'100vh',display:'flex',flexDirection:'column',background:'#07070F',overflow:'hidden'}}>
      {/* Header */}
      <div style={{height:48,background:'rgba(0,0,0,.65)',borderBottom:'1px solid rgba(255,255,255,.07)',
        display:'flex',alignItems:'center',padding:'0 14px',flexShrink:0,gap:10}}>
        {/* Sidebar toggle */}
        <span onClick={()=>setSidebar(s=>!s)}
          style={{color:C.green,cursor:'pointer',fontSize:16,opacity:.6,userSelect:'none',
            padding:'4px 6px',borderRadius:3,transition:'opacity .15s'}}
          onMouseEnter={e=>e.currentTarget.style.opacity='1'}
          onMouseLeave={e=>e.currentTarget.style.opacity='.6'}>☰</span>
        <div style={{fontFamily:'Orbitron,sans-serif',fontSize:14,fontWeight:700,color:C.green,
          letterSpacing:'2px',textShadow:'0 0 18px rgba(0,250,154,.38)'}}>RTRE</div>
        <span style={{fontFamily:'Orbitron,sans-serif',fontSize:8,color:'rgba(0,250,154,.28)',letterSpacing:'4px'}}>
          RESEARCH ENGINE
        </span>
        <div style={{flex:1}}/>
        {/* User menu */}
        <div style={{position:'relative'}} ref={userMenuRef}>
          <div onClick={()=>setShowUserMenu(s=>!s)}
            style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',
              padding:'5px 10px',borderRadius:5,transition:'background .15s',
              background:showUserMenu?'rgba(255,255,255,.08)':'transparent'}}
            onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.06)'}
            onMouseLeave={e=>e.currentTarget.style.background=showUserMenu?'rgba(255,255,255,.08)':'transparent'}>
            <span style={{width:8,height:8,borderRadius:'50%',background:C.green,
              boxShadow:`0 0 8px ${C.green}`,display:'inline-block'}}/>
            <span style={{fontSize:14,color:'rgba(200,230,200,.6)'}}>{userMeta?.name||authUser?.email}</span>
            <span style={{fontSize:10,color:'rgba(200,230,200,.3)'}}>▾</span>
          </div>
          {showUserMenu&&(
            <div style={{position:'absolute',top:'100%',right:0,zIndex:500,
              background:'#0D0D1F',border:'1px solid rgba(255,255,255,.1)',
              borderRadius:6,overflow:'hidden',minWidth:180,marginTop:4,
              boxShadow:'0 8px 24px rgba(0,0,0,.5)'}}>
              {[['◈ Đổi mật khẩu',()=>{setShowChangePw(true);setShowUserMenu(false)},C.gold],
                ['↩ Đăng xuất',logout,C.pink]].map(([l,fn,c])=>(
                <div key={l} onClick={fn}
                  style={{padding:'12px 16px',cursor:'pointer',fontSize:14,color:c,
                    borderBottom:'1px solid rgba(255,255,255,.05)',transition:'background .15s'}}
                  onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.07)'}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>{l}</div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div ref={containerRef} style={{flex:1,display:'flex',overflow:'hidden',minHeight:0}}>
        {/* Sidebar */}
        {sidebar&&(
          <div style={{width:220,background:'rgba(0,0,0,.38)',
            borderRight:'1px solid rgba(255,255,255,.06)',
            display:'flex',flexDirection:'column',flexShrink:0,transition:'width .2s'}}>
            <div style={{padding:'10px 14px',display:'flex',justifyContent:'space-between',
              alignItems:'center',borderBottom:'1px solid rgba(255,255,255,.05)'}}>
              <span style={{fontFamily:'Orbitron,sans-serif',fontSize:9,
                color:C.green,letterSpacing:'2px',opacity:.5}}>◈ PROJECTS</span>
              <span onClick={()=>setShowNewProj(true)}
                style={{color:C.green,cursor:'pointer',fontSize:20,opacity:.5,lineHeight:1}}
                onMouseEnter={e=>e.currentTarget.style.opacity='1'}
                onMouseLeave={e=>e.currentTarget.style.opacity='.5'}>+</span>
            </div>
            <div style={{flex:1,overflow:'auto',padding:'4px 0'}}>
              {projects.length===0&&(
                <div style={{padding:'18px 14px',color:'rgba(200,230,200,.22)',fontSize:13,lineHeight:2}}>
                  Chưa có project.<br/>
                  <span onClick={()=>seedDemo(authUser.uid)}
                    style={{color:C.green,cursor:'pointer',textDecoration:'underline'}}>Load demo</span>
                </div>
              )}
              {topProjects.map(p=>(
                <SidebarItem key={p.id} p={p} activePid={activePid} setActivePid={setActivePid}
                  children={subOf(p.id)}/>
              ))}
            </div>
          </div>
        )}

        {/* 3-panel layout */}
        {activeProject?(
          <div style={{flex:1,display:'flex',overflow:'hidden',minWidth:0,padding:8,gap:0}}>
            {/* Left: Input */}
            <Panel panelKey="input" style={{width:leftW,flexShrink:0, resize: 'horizontal', overflow: 'auto'}}>
              <InputTab project={activeProject}/>
            </Panel>

            {/* Horizontal divider */}
            <Divider onDrag={delta=>setLeftW(w=>Math.max(180,Math.min(600,w+delta)))}/>

            {/* Right: Table + Chart stacked */}
            <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',minWidth:0,gap:0}}>
              {/* Top: Table */}
              <Panel panelKey="table" style={{height:topH,flexShrink:0, resize: 'vertical', overflow: 'auto'}}>
                <TableTab project={activeProject}/>
              </Panel>

              {/* Vertical divider */}
              <Divider vertical onDrag={delta=>{
                const maxH = (containerRef.current?.clientHeight||600) - 48 - 16
                setTopH(h=>Math.max(120,Math.min(maxH-120,h+delta)))
              }}/>

              {/* Bottom: Chart */}
              <Panel panelKey="chart" style={{flex:1,minHeight:120, resize: 'vertical', overflow: 'auto'}}>
                <ChartTab project={activeProject}/>
              </Panel>
            </div>
          </div>
        ):(
          <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',
            flexDirection:'column',gap:14,color:'rgba(200,230,200,.22)'}}>
            <div style={{fontFamily:'Orbitron,sans-serif',fontSize:13,letterSpacing:'3px'}}>
              CHỌN HOẶC TẠO PROJECT
            </div>
            <Btn onClick={()=>setShowNewProj(true)}>+ Tạo project</Btn>
          </div>
        )}
      </div>

      {/* Modals */}
      {showNewProj && <NewProjectModal projects={projects} uid={authUser?.uid}
        onClose={()=>setShowNewProj(false)}/>}
      {showChangePw && <ChangePwModal user={userMeta} onClose={()=>setShowChangePw(false)}/>}
    </div>
  )
}