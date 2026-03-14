import { useState } from 'react'
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth'
import { ref, set } from 'firebase/database'
import { auth, db } from '../firebase.js'
import { Btn, HoloPanel } from './ui/index.jsx'
import { C } from '../theme.js'

const Field = ({ label, value, onChange, type='text', placeholder='' }) => (
  <div style={{ marginBottom:14 }}>
    <div style={{ fontSize:9, color:C.green, opacity:.55, marginBottom:5, letterSpacing:'2px' }}>{label}</div>
    <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
      onKeyDown={e=>e.key==='Enter'&&document.getElementById('auth-submit')?.click()}/>
  </div>
)

const ErrBox = ({ msg }) => (
  <div style={{ color:C.pink, fontSize:11, marginBottom:14, padding:'6px 10px',
    background:'rgba(255,45,120,.07)', borderRadius:3, border:'1px solid rgba(255,45,120,.22)' }}>{msg}</div>
)

function AuthWrap({ children }) {
  return (
    <div style={{ minHeight:'100vh', background:'#07070F', display:'flex',
      alignItems:'center', justifyContent:'center', position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', inset:0,
        backgroundImage:'linear-gradient(rgba(0,250,154,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(0,250,154,.04) 1px,transparent 1px)',
        backgroundSize:'60px 60px' }}/>
      <div style={{ position:'absolute', inset:0,
        background:'radial-gradient(ellipse at 50% 30%,rgba(0,250,154,.07) 0%,transparent 65%)' }}/>
      <div className="fade-in" style={{ width:380, position:'relative', zIndex:10 }}>
        <div style={{ textAlign:'center', marginBottom:30 }}>
          <div style={{ fontFamily:'Orbitron', fontSize:9, color:C.green, letterSpacing:'6px', opacity:.4, marginBottom:6 }}>REALTIME</div>
          <div style={{ fontFamily:'Orbitron', fontSize:22, fontWeight:700, color:'#fff',
            letterSpacing:'3px', textShadow:`0 0 28px ${C.green}45` }}>RESEARCH ENGINE</div>
          <div style={{ fontFamily:'Orbitron', fontSize:7, color:C.green, letterSpacing:'8px', marginTop:6, opacity:.25 }}>v2.0 CLINICAL</div>
        </div>
        {children}
      </div>
    </div>
  )
}

export function LoginPage({ onSwitch }) {
  const [email, setEmail] = useState('')
  const [pw, setPw]       = useState('')
  const [err, setErr]     = useState('')
  const [loading, setLoading] = useState(false)

  const go = async () => {
    if (!email || !pw) return setErr('Vui lòng điền đầy đủ')
    setLoading(true); setErr('')
    try {
      await signInWithEmailAndPassword(auth, email, pw)
    } catch(e) {
      setErr(e.code==='auth/invalid-credential'||e.code==='auth/wrong-password'
        ? 'Email hoặc mật khẩu không đúng' : e.message)
    } finally { setLoading(false) }
  }

  return (
    <AuthWrap>
      <HoloPanel style={{ padding:32 }}>
        <div style={{ fontFamily:'Orbitron', fontSize:10, color:C.green, letterSpacing:'3px', marginBottom:22 }}>◈ ACCESS TERMINAL</div>
        <Field label="EMAIL" value={email} onChange={setEmail} placeholder="researcher@hospital.vn"/>
        <Field label="PASSWORD" value={pw} onChange={setPw} type="password" placeholder="••••••••"/>
        {err && <ErrBox msg={err}/>}
        <Btn id="auth-submit" onClick={go} disabled={loading} style={{ width:'100%', justifyContent:'center' }}>
          {loading ? '◌ Đang xác thực...' : 'Đăng nhập'}
        </Btn>
        <div style={{ textAlign:'center', marginTop:16, fontSize:11, color:'rgba(200,230,200,.35)' }}>
          Chưa có tài khoản?{' '}
          <span onClick={()=>onSwitch('register')} style={{ color:C.green, cursor:'pointer' }}>Đăng ký</span>
        </div>
      </HoloPanel>
    </AuthWrap>
  )
}

export function RegisterPage({ onSwitch }) {
  const [f, setF]   = useState({ name:'', email:'', pw:'', pw2:'' })
  const [err, setErr]     = useState('')
  const [loading, setLoading] = useState(false)
  const set2 = k => v => setF(p=>({...p,[k]:v}))

  const go = async () => {
    if (!f.name||!f.email||!f.pw) return setErr('Vui lòng điền đầy đủ')
    if (f.pw !== f.pw2) return setErr('Mật khẩu không khớp')
    if (f.pw.length < 6) return setErr('Mật khẩu tối thiểu 6 ký tự')
    setLoading(true); setErr('')
    try {
      const cred = await createUserWithEmailAndPassword(auth, f.email, f.pw)
      await set(ref(db, `users/${cred.user.uid}`), {
        name: f.name, email: f.email, role: 'user', createdAt: Date.now()
      })
    } catch(e) {
      setErr(e.code==='auth/email-already-in-use' ? 'Email đã tồn tại' : e.message)
    } finally { setLoading(false) }
  }

  return (
    <AuthWrap>
      <HoloPanel style={{ padding:28 }}>
        <div style={{ fontFamily:'Orbitron', fontSize:10, color:C.blue, letterSpacing:'3px', marginBottom:20 }}>◈ NEW RESEARCHER</div>
        <Field label="HỌ TÊN" value={f.name} onChange={set2('name')} placeholder="Dr. Nguyen Van A"/>
        <Field label="EMAIL" value={f.email} onChange={set2('email')} placeholder="researcher@hospital.vn"/>
        <Field label="MẬT KHẨU (≥ 6 ký tự)" value={f.pw} onChange={set2('pw')} type="password"/>
        <Field label="XÁC NHẬN MẬT KHẨU" value={f.pw2} onChange={set2('pw2')} type="password"/>
        {err && <ErrBox msg={err}/>}
        <Btn id="auth-submit" onClick={go} color={C.blue} disabled={loading}
          style={{ width:'100%', justifyContent:'center' }}>
          {loading ? '◌ Đang tạo...' : 'Tạo tài khoản'}
        </Btn>
        <div style={{ textAlign:'center', marginTop:14, fontSize:11 }}>
          <span onClick={()=>onSwitch('login')} style={{ color:C.green, cursor:'pointer' }}>← Quay lại đăng nhập</span>
        </div>
      </HoloPanel>
    </AuthWrap>
  )
}
