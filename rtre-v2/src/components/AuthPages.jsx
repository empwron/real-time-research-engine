import { useState } from 'react'
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth'
import { ref, set, get, query, orderByChild, equalTo } from 'firebase/database'
import { auth, db } from '../firebase.js'
import { Btn, HoloPanel } from './ui/index.jsx'
import { C } from '../theme.js'

// Firebase Auth yêu cầu email — dùng username@rtre.app nội bộ
const toEmail = username => `${username.toLowerCase().replace(/[^a-z0-9_]/g,'_')}@rtre.app`

const Field = ({ label, value, onChange, type='text', placeholder='' }) => (
  <div style={{ marginBottom:16 }}>
    <label>{label}</label>
    <input type={type} value={value} onChange={e=>onChange(e.target.value)}
      placeholder={placeholder}
      onKeyDown={e=>e.key==='Enter'&&document.getElementById('auth-btn')?.click()}/>
  </div>
)

const ErrBox = ({ msg }) => (
  <div style={{ color:C.pink, fontSize:13, marginBottom:14, padding:'8px 12px',
    background:'rgba(255,45,120,.07)', borderRadius:4, border:'1px solid rgba(255,45,120,.2)' }}>
    {msg}
  </div>
)

function AuthWrap({ children }) {
  return (
    <div style={{ minHeight:'100vh', background:'#07070F', display:'flex',
      alignItems:'center', justifyContent:'center', position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', inset:0,
        backgroundImage:'linear-gradient(rgba(0,250,154,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(0,250,154,.04) 1px,transparent 1px)',
        backgroundSize:'60px 60px' }}/>
      <div style={{ position:'absolute', inset:0,
        background:'radial-gradient(ellipse at 50% 30%,rgba(0,250,154,.08) 0%,transparent 65%)' }}/>
      <div className="fade-in" style={{ width:420, position:'relative', zIndex:10 }}>
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ fontFamily:'Orbitron,sans-serif', fontSize:10, color:C.green,
            letterSpacing:'6px', opacity:.4, marginBottom:8 }}>REALTIME</div>
          <div style={{ fontFamily:'Orbitron,sans-serif', fontSize:26, fontWeight:700,
            color:'#fff', letterSpacing:'3px', textShadow:`0 0 30px ${C.green}40` }}>
            RESEARCH ENGINE
          </div>
          <div style={{ fontFamily:'Orbitron,sans-serif', fontSize:8, color:C.green,
            letterSpacing:'8px', marginTop:8, opacity:.22 }}>v2.0 CLINICAL</div>
        </div>
        {children}
      </div>
    </div>
  )
}

export function LoginPage({ onSwitch }) {
  const [username, setUsername] = useState('')
  const [pw, setPw]             = useState('')
  const [err, setErr]           = useState('')
  const [loading, setLoading]   = useState(false)

  const go = async () => {
    if (!username.trim() || !pw) return setErr('Vui lòng điền tên đăng nhập và mật khẩu')
    setLoading(true); setErr('')
    try {
      const email = toEmail(username.trim())
      await signInWithEmailAndPassword(auth, email, pw)
    } catch(e) {
      setErr(e.code==='auth/invalid-credential'||e.code==='auth/wrong-password'
        ? 'Tên đăng nhập hoặc mật khẩu không đúng' : 'Lỗi đăng nhập: ' + e.message)
    } finally { setLoading(false) }
  }

  return (
    <AuthWrap>
      <HoloPanel style={{ padding:32 }}>
        <div style={{ fontFamily:'Orbitron,sans-serif', fontSize:11, color:C.green,
          letterSpacing:'3px', marginBottom:24 }}>◈ ACCESS TERMINAL</div>
        <Field label="TÊN ĐĂNG NHẬP" value={username} onChange={setUsername} placeholder="drnguyenvana"/>
        <Field label="MẬT KHẨU" value={pw} onChange={setPw} type="password" placeholder="••••••••"/>
        {err && <ErrBox msg={err}/>}
        <Btn id="auth-btn" onClick={go} disabled={loading}
          style={{ width:'100%', justifyContent:'center', padding:'12px', fontSize:13 }}>
          {loading ? '◌ Đang xác thực...' : 'Đăng nhập'}
        </Btn>
        <div style={{ textAlign:'center', marginTop:18, fontSize:13, color:'rgba(200,230,200,.35)' }}>
          Chưa có tài khoản?{' '}
          <span onClick={()=>onSwitch('register')} style={{ color:C.green, cursor:'pointer' }}>Đăng ký</span>
        </div>
      </HoloPanel>
    </AuthWrap>
  )
}

export function RegisterPage({ onSwitch }) {
  const [f, setF]             = useState({ displayName:'', username:'', pw:'', pw2:'' })
  const [err, setErr]         = useState('')
  const [loading, setLoading] = useState(false)
  const set2 = k => v => setF(p=>({...p,[k]:v}))

  const go = async () => {
    if (!f.displayName.trim()||!f.username.trim()||!f.pw)
      return setErr('Vui lòng điền đầy đủ thông tin')
    if (f.pw !== f.pw2) return setErr('Mật khẩu không khớp')
    if (!/^[a-zA-Z0-9_]+$/.test(f.username)) return setErr('Tên đăng nhập chỉ gồm chữ, số, dấu _')
    setLoading(true); setErr('')
    try {
      const email = toEmail(f.username.trim())
      const cred = await createUserWithEmailAndPassword(auth, email, f.pw)
      await set(ref(db, `users/${cred.user.uid}`), {
        name: f.displayName.trim(),
        username: f.username.trim().toLowerCase(),
        email, role: 'user', createdAt: Date.now()
      })
    } catch(e) {
      setErr(e.code==='auth/email-already-in-use'
        ? 'Tên đăng nhập đã tồn tại' : e.message)
    } finally { setLoading(false) }
  }

  return (
    <AuthWrap>
      <HoloPanel style={{ padding:32 }}>
        <div style={{ fontFamily:'Orbitron,sans-serif', fontSize:11, color:C.blue,
          letterSpacing:'3px', marginBottom:24 }}>◈ NEW RESEARCHER</div>
        <Field label="HỌ TÊN (hiển thị)" value={f.displayName} onChange={set2('displayName')} placeholder="Dr. Nguyen Van A"/>
        <Field label="TÊN ĐĂNG NHẬP (không dấu, không khoảng cách)" value={f.username} onChange={set2('username')} placeholder="drnguyenvana"/>
        <Field label="MẬT KHẨU" value={f.pw} onChange={set2('pw')} type="password" placeholder="Nhập mật khẩu"/>
        <Field label="XÁC NHẬN MẬT KHẨU" value={f.pw2} onChange={set2('pw2')} type="password" placeholder="Nhập lại mật khẩu"/>
        {err && <ErrBox msg={err}/>}
        <Btn id="auth-btn" onClick={go} color={C.blue} disabled={loading}
          style={{ width:'100%', justifyContent:'center', padding:'12px', fontSize:13 }}>
          {loading ? '◌ Đang tạo...' : 'Tạo tài khoản'}
        </Btn>
        <div style={{ textAlign:'center', marginTop:18, fontSize:13 }}>
          <span onClick={()=>onSwitch('login')} style={{ color:C.green, cursor:'pointer' }}>
            ← Quay lại đăng nhập
          </span>
        </div>
      </HoloPanel>
    </AuthWrap>
  )
}
