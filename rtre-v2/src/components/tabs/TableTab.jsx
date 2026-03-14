import React, { useState } from 'react'
import { C } from '../../theme.js'

export function TableTab({ project }) {
  const [selectedImage, setSelectedImage] = useState(null);
  const [zoom, setZoom] = useState(1);
  const vars = project.variables.sort((a,b)=>a.order-b.order)
  const rows = project.rows || []

  return (
    <div style={{ padding: 16, height: '100%', display: 'flex', flexDirection: 'column' }}>
       {/* Zoom control */}
       <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginBottom: '10px' }}>
        <span style={{ color: C.purple, fontSize: 12, cursor: 'pointer' }} onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}>Zoom Out -</span>
        <span style={{ color: C.purple, fontSize: 12 }}>{(zoom * 100).toFixed(0)}%</span>
        <span style={{ color: C.purple, fontSize: 12, cursor: 'pointer' }} onClick={() => setZoom(z => Math.min(2, z + 0.1))}>Zoom In +</span>
      </div>

      <div style={{ flex: 1, overflow: 'auto', zoom: zoom }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', color: '#fff', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'rgba(191,95,255,.1)' }}>
              {vars.map(v => (
                <th key={v.id} style={{ padding: 10, borderBottom: `2px solid ${C.purple}50`, textAlign: 'left' }}>
                  {v.name} {v.encodedName && <span style={{fontSize:10, color:'rgba(255,255,255,.4)'}}>({v.encodedName})</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id || i} style={{ borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                {vars.map(v => (
                  <td key={v.id} style={{ padding: 10 }}>
                    {v.type === 'image' && r[v.id] ? (
                      <span onClick={() => setSelectedImage(r[v.id])} style={{ cursor: 'pointer', fontSize: 20 }} title="Xem ảnh">🖼️</span>
                    ) : (
                      r[v.id] || '-'
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Popup Ảnh */}
      {selectedImage && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.85)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999 }} onClick={() => setSelectedImage(null)}>
          <img src={selectedImage} style={{ maxWidth:'90%', maxHeight:'90%', border:`2px solid ${C.purple}`, borderRadius:8 }} onClick={e => e.stopPropagation()} />
          <span style={{ position:'absolute', top: 20, right: 30, color: '#fff', fontSize: 30, cursor: 'pointer' }}>✕</span>
        </div>
      )}
    </div>
  )
}