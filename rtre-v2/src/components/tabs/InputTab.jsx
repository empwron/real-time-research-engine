import React, { useState } from 'react'
import { ref, push, remove } from 'firebase/database'
import { db } from '../../firebase.js'
import { Btn, HoloPanel } from '../ui/index.jsx'
import { C } from '../../theme.js'

export function InputTab({ project }) {
  const [varName, setVarName] = useState('')
  const [encodedName, setEncodedName] = useState('')
  const [varType, setVarType] = useState('number')
  const [zoom, setZoom] = useState(1)

  const handlePaste = async (e) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        const reader = new FileReader();
        reader.onload = async (event) => {
          const base64Image = event.target.result;
          await push(ref(db, `projects/${project.id}/variables`), {
            name: varName || `Image_${project.variables.length + 1}`,
            encodedName: encodedName || `IMG_${project.variables.length + 1}`,
            type: 'image',
            data: base64Image,
            order: project.variables.length
          });
          setVarName(''); setEncodedName('');
        };
        reader.readAsDataURL(blob);
      }
    }
  };

  const addVar = async () => {
    if(!varName.trim()) return
    await push(ref(db, `projects/${project.id}/variables`), {
      name: varName.trim(),
      encodedName: encodedName.trim(),
      type: varType,
      order: project.variables.length
    })
    setVarName(''); setEncodedName('');
  }

  const removeVar = async (vid) => {
    if(confirm('Xóa biến này?')) {
      await remove(ref(db, `projects/${project.id}/variables/${vid}`))
    }
  }

  return (
    <div style={{ padding: '16px', height: '100%', display: 'flex', flexDirection: 'column', outline: 'none' }} tabIndex="0" onPaste={handlePaste}>
      {/* Zoom control */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginBottom: '10px' }}>
        <span style={{ color: C.green, fontSize: 12, cursor: 'pointer' }} onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}>Zoom Out -</span>
        <span style={{ color: C.green, fontSize: 12 }}>{(zoom * 100).toFixed(0)}%</span>
        <span style={{ color: C.green, fontSize: 12, cursor: 'pointer' }} onClick={() => setZoom(z => Math.min(2, z + 0.1))}>Zoom In +</span>
      </div>

      <div style={{ flex: 1, overflow: 'auto', zoom: zoom }}>
        <HoloPanel style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: C.cyan, marginBottom: 10, fontFamily: 'Orbitron' }}>THÊM BIẾN MỚI</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input value={varName} onChange={e=>setVarName(e.target.value)} placeholder="Tên biến (VD: Tuổi, HA...)" 
              style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', color: '#fff', padding: 8, borderRadius: 4 }} />
            
            <input value={encodedName} onChange={e=>setEncodedName(e.target.value)} placeholder="Tên biến mã hóa (VD: X1, Y...)" 
              style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', color: '#fff', padding: 8, borderRadius: 4 }} />

            <select value={varType} onChange={e=>setVarType(e.target.value)} 
              style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', color: '#fff', padding: 8, borderRadius: 4 }}>
              <option value="number">Số (Numeric)</option>
              <option value="categorical">Phân loại (Categorical)</option>
              <option value="binary">Nhị phân (Binary)</option>
              <option value="image">Hình ảnh (Image)</option>
            </select>
            <Btn onClick={addVar} color={C.cyan}>Thêm</Btn>
          </div>
          <p style={{ fontSize: 11, color: 'rgba(200,230,200,.4)', marginTop: 10 }}>💡 Có thể Ctrl+V để dán ảnh trực tiếp.</p>
        </HoloPanel>

        <div style={{ color: '#fff', fontSize: 13 }}>Danh sách biến ({project.variables.length}):</div>
        {project.variables.map(v => (
          <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', borderBottom: '1px solid rgba(255,255,255,.1)', alignItems: 'center' }}>
            <div>
              <span style={{ color: C.green }}>{v.name}</span>
              {v.encodedName && <span style={{ color: 'rgba(200,230,200,.5)', fontSize: 11, marginLeft: 6 }}>[{v.encodedName}]</span>}
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)' }}>Type: {v.type}</div>
            </div>
            <Btn outline color={C.pink} style={{ padding: '2px 6px', fontSize: 10 }} onClick={() => removeVar(v.id)}>✕</Btn>
          </div>
        ))}
      </div>
    </div>
  )
}