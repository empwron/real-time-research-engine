import { descriptive, freqTable } from './statistics.js'

export function exportDataCSV(project) {
  const vars = [...project.variables].sort((a,b)=>(a.order??0)-(b.order??0))
  const { rows, name } = project
  if (!rows.length) return alert('Không có dữ liệu để export')
  // Filter out image variables
  const exportVars = vars.filter(v => v.type !== 'image')
  const headers = ['#', ...exportVars.map(v => v.name)]
  const lines = [headers.join(',')]
  rows.forEach((row, i) => {
    const vals = [i+1, ...exportVars.map(v => {
      const val = row[v.id]
      if (val === undefined || val === '') return ''
      return String(val).includes(',') ? `"${val}"` : val
    })]
    lines.push(vals.join(','))
  })
  dl(lines.join('\n'), `${name}_data.csv`)
}

export function exportStatsCSV(project) {
  const { variables, rows, name } = project
  const numVars = variables.filter(v => ['number','integer','percent','ordinal','binary'].includes(v.type))
  const catVars = variables.filter(v => v.type === 'categorical')
  const lines = []
  lines.push(`REAL TIME RESEARCH ENGINE — Statistical Summary`)
  lines.push(`Project: ${name}`)
  lines.push(`N rows: ${rows.length}`)
  lines.push(`Generated: ${new Date().toLocaleString('vi-VN')}`)
  lines.push('')
  lines.push('=== NUMERIC / BINARY VARIABLES ===')
  lines.push('Variable,N,Missing,Mean,SD,SEM,Median,Q1,Q3,IQR,Min,Max,Skewness,Kurtosis,CV%,CI95_lower,CI95_upper,Normal')
  for (const v of numVars) {
    const d = descriptive(rows.map(r => r[v.id]))
    if (!d) { lines.push(`${v.name},0,${rows.length}`); continue }
    lines.push([v.name,d.n,d.missing,d.mean,d.std,d.sem,d.median,d.q1,d.q3,d.iqr,d.min,d.max,d.skew,d.kurt,d.cv,d.ci95[0],d.ci95[1],d.normal?'Yes':'No'].join(','))
  }
  lines.push('')
  if (catVars.length) {
    lines.push('=== CATEGORICAL VARIABLES ===')
    for (const v of catVars) {
      lines.push(`Variable: ${v.name}`)
      lines.push('Value,N,Percent%')
      freqTable(rows.map(r=>r[v.id])).forEach(r => lines.push(`${r.value},${r.n},${r.pct}`))
      lines.push('')
    }
  }
  dl(lines.join('\n'), `${name}_statistics.csv`)
}

function dl(content, filename) {
  const blob = new Blob(['\uFEFF'+content], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = Object.assign(document.createElement('a'), { href:url, download:filename })
  a.click(); URL.revokeObjectURL(url)
}
