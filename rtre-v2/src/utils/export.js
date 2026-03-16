import { descriptive, freqTable } from './statistics.js'

export function exportDataCSV(project) {
  const vars = [...project.variables].sort((a,b)=>(a.order??0)-(b.order??0)).filter(v=>v.type!=='image')
  const { rows, name } = project
  if (!rows.length) return alert('Không có dữ liệu')
  const headers = ['#', ...vars.map(v => v.codeName || v.name)]
  const lines = [headers.join(',')]
  rows.forEach((row, i) => {
    const vals = [i+1, ...vars.map(v => {
      const val = row[v.id]; if(val===undefined||val==='')return ''
      return String(val).includes(',')?`"${val}"`:val
    })]
    lines.push(vals.join(','))
  })
  dl(lines.join('\n'), `${name}_data.csv`)
}

export function exportStatsCSV(project) {
  const { variables, rows, name } = project
  const numVars = variables.filter(v => ['number','integer','percent','ordinal','binary'].includes(v.type))
  const catVars = variables.filter(v => v.type==='categorical')
  const lines = [`RTRE Statistical Summary`,`Project: ${name}`,`N: ${rows.length}`,`Date: ${new Date().toLocaleString('vi-VN')}`,'']
  lines.push('=== NUMERIC ===','Variable,CodeName,N,Missing,Mean,SD,Median,Q1,Q3,Min,Max,Skew,Kurt,Normal')
  for (const v of numVars) {
    const d = descriptive(rows.map(r=>r[v.id]))
    if(!d){lines.push(`${v.name},${v.codeName||''},0,${rows.length}`);continue}
    lines.push([v.name,v.codeName||'',d.n,d.missing,d.mean,d.std,d.median,d.q1,d.q3,d.min,d.max,d.skew,d.kurt,d.normal?'Yes':'No'].join(','))
  }
  lines.push('')
  if(catVars.length){lines.push('=== CATEGORICAL ===');for(const v of catVars){lines.push(`Variable: ${v.name} (${v.codeName||''})`)
    lines.push('Value,N,%');freqTable(rows.map(r=>r[v.id])).forEach(r=>lines.push(`${r.value},${r.n},${r.pct}`));lines.push('')}}
  dl(lines.join('\n'), `${name}_stats.csv`)
}

function dl(content, filename) {
  const blob = new Blob(['\uFEFF'+content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob); const a = Object.assign(document.createElement('a'), { href:url, download:filename }); a.click(); URL.revokeObjectURL(url)
}
