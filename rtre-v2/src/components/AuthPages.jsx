import { useState } from 'react'
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth'
import { ref, set } from 'firebase/database'
import { auth, db } from '../firebase.js'
import { Btn, HoloPanel } from './ui/index.jsx'
import { C } from '../theme.js'
import { padPw } from '../utils/pwUtils.js'

const toEmail = u => `${u.toLowerCase().replace(/[^a-z0-9_]/g,'_')}@rtre.app`

const Field = ({ label, value, onChange, type='text', placeholder='', hint='' }) => (
  <div style={{ marginBottom:14 }}>
    <label style={{ fontSize:12, color:'rgba(200,230,200,.55)', display:'block', marginBottom:5 }}>
      {label}{hint&&<span style={{fontSize:10,color:'rgba(200,230,200,.3)',marginLeft:6}}>{hint}</span>}
    </label>
    <input type={type} value={value} onChange={e=>onChange(e.target.value)}
      placeholder={placeholder}
      style={{ padding:'7px 12px', fontSize:13 }}
      onKeyDown={e=>e.key==='Enter'&&document.getElementById('auth-btn')?.click()}/>
  </div>
)

function AuthWrap({ children }) {
  return (
    <div style={{ minHeight:'100vh', background:'#07070F', display:'flex',
      alignItems:'center', justifyContent:'center', position:'relative',
      overflow:'auto', padding:'24px 16px' }}>
      <div style={{ position:'fixed', inset:0,
        backgroundImage:'linear-gradient(rgba(0,250,154,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(0,250,154,.035) 1px,transparent 1px)',
        backgroundSize:'60px 60px', pointerEvents:'none' }}/>
      <div style={{ position:'fixed', inset:0,
        background:'radial-gradient(ellipse at 50% 25%,rgba(0,250,154,.08) 0%,transparent 60%)',
        pointerEvents:'none' }}/>
      <div className="fade-in" style={{ width:420, maxWidth:'100%', position:'relative', zIndex:10 }}>
        <div style={{ textAlign:'center', marginBottom:28 }}>
          <div style={{ fontFamily:'Orbitron,sans-serif', fontSize:10,
            color:C.green, letterSpacing:'7px', opacity:.35, marginBottom:8 }}>REALTIME</div>
          <div style={{ fontFamily:'Orbitron,sans-serif', fontSize:24, fontWeight:700,
            color:'#fff', letterSpacing:'3px', textShadow:`0 0 32px ${C.green}38` }}>
            RESEARCH ENGINE
          </div>
          <div style={{ fontFamily:'Orbitron,sans-serif', fontSize:8,
            color:C.green, letterSpacing:'9px', marginTop:8, opacity:.2 }}>v2.5 CLINICAL</div>
        </div>
        {children}
      </div>
    </div>
  )
}

const ErrBox = ({ msg }) => (
  <div style={{ color:C.pink, fontSize:12, marginBottom:12, padding:'8px 12px',
    background:'rgba(255,45,120,.07)', borderRadius:5, border:'1px solid rgba(255,45,120,.22)' }}>{msg}</div>
)

export function LoginPage({ onSwitch }) {
  const [username, setUsername] = useState('')
  const [pw, setPw]             = useState('')
  const [err, setErr]           = useState('')
  const [loading, setLoading]   = useState(false)

  const go = async () => {
    if (!username.trim() || !pw) return setErr('Vui lòng điền tên đăng nhập và mật khẩu')
    setLoading(true); setErr('')
    try {
      await signInWithEmailAndPassword(auth, toEmail(username.trim()), padPw(pw))
    } catch(e) {
      setErr(e.code==='auth/invalid-credential'||e.code==='auth/wrong-password'
        ? 'Tên đăng nhập hoặc mật khẩu không đúng' : 'Lỗi: ' + e.message)
    } finally { setLoading(false) }
  }

  return (
    <AuthWrap>
      <HoloPanel style={{ padding:'28px 30px' }}>
        <div style={{ fontFamily:'Orbitron,sans-serif', fontSize:11,
          color:C.green, letterSpacing:'3px', marginBottom:22 }}>◈ ACCESS TERMINAL</div>
        <Field label="TÊN ĐĂNG NHẬP" value={username} onChange={setUsername} placeholder="drnguyenvana"/>
        <Field label="MẬT KHẨU" value={pw} onChange={setPw} type="password" placeholder="Nhập mật khẩu"/>
        {err && <ErrBox msg={err}/>}
        <Btn id="auth-btn" onClick={go} disabled={loading}
          style={{ width:'100%', justifyContent:'center', padding:'11px', fontSize:13 }}>
          {loading ? '◌ Đang xác thực...' : 'Đăng nhập'}
        </Btn>
        <div style={{ textAlign:'center', marginTop:16, fontSize:13, color:'rgba(200,230,200,.35)' }}>
          Chưa có tài khoản?{' '}
          <span onClick={()=>onSwitch('register')} style={{ color:C.green, cursor:'pointer' }}>Đăng ký</span>
        </div>
      </HoloPanel>
    </AuthWrap>
  )
}

export function RegisterPage({ onSwitch }) {
  const [f, setF]           = useState({ displayName:'', username:'', pw:'', pw2:'' })
  const [err, setErr]       = useState('')
  const [loading, setLoading] = useState(false)
  const upd = k => v => setF(p=>({...p,[k]:v}))

  const go = async () => {
    if (!f.displayName.trim()||!f.username.trim()||!f.pw)
      return setErr('Vui lòng điền đầy đủ')
    if (f.pw !== f.pw2) return setErr('Mật khẩu không khớp')
    if (!/^[a-zA-Z0-9_]+$/.test(f.username)) return setErr('Tên đăng nhập chỉ gồm chữ, số, _')
    setLoading(true); setErr('')
    try {
      const email = toEmail(f.username.trim())
      const cred = await createUserWithEmailAndPassword(auth, email, padPw(f.pw))
      await set(ref(db, `users/${cred.user.uid}`), {
        name: f.displayName.trim(), username: f.username.trim().toLowerCase(),
        email, role:'user', createdAt: Date.now()
      })
    } catch(e) {
      setErr(e.code==='auth/email-already-in-use' ? 'Tên đăng nhập đã tồn tại' : e.message)
    } finally { setLoading(false) }
  }

  return (
    <AuthWrap>
      <HoloPanel style={{ padding:'28px 30px' }}>
        <div style={{ fontFamily:'Orbitron,sans-serif', fontSize:11,
          color:C.blue, letterSpacing:'3px', marginBottom:22 }}>◈ NEW RESEARCHER</div>
        <Field label="HỌ TÊN (hiển thị)" value={f.displayName} onChange={upd('displayName')} placeholder="Dr. Nguyen Van A"/>
        <Field label="TÊN ĐĂNG NHẬP" hint="(không dấu, không khoảng cách)"
          value={f.username} onChange={upd('username')} placeholder="drnguyenvana"/>
        <Field label="MẬT KHẨU" value={f.pw} onChange={upd('pw')} type="password" placeholder="Nhập mật khẩu"/>
        <Field label="XÁC NHẬN MẬT KHẨU" value={f.pw2} onChange={upd('pw2')} type="password" placeholder="Nhập lại mật khẩu"/>
        {err && <ErrBox msg={err}/>}
        <Btn id="auth-btn" onClick={go} color={C.blue} disabled={loading}
          style={{ width:'100%', justifyContent:'center', padding:'11px', fontSize:13, marginTop:4 }}>
          {loading ? '◌ Đang tạo...' : 'Tạo tài khoản'}
        </Btn>
        <div style={{ textAlign:'center', marginTop:14, fontSize:13 }}>
          <span onClick={()=>onSwitch('login')} style={{ color:C.green, cursor:'pointer' }}>← Quay lại</span>
        </div>
      </HoloPanel>
    </AuthWrap>
  )
}
