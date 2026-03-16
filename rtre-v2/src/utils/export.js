import { descriptive, freqTable } from './statistics.js'

const NA_VALS=['__NA__','NA','N/A','na','n/a','NULL','null','.','missing']
const _isNA=v=>NA_VALS.includes(String(v).trim())

export function exportDataCSV(project){
  const vars=[...project.variables].sort((a,b)=>(a.order??0)-(b.order??0)).filter(v=>v.type!=='image')
  const{rows,name}=project;if(!rows.length)return
  const h=['#',...vars.map(v=>v.codeName||v.name)];const ls=[h.join(',')]
  rows.forEach((row,i)=>{ls.push([i+1,...vars.map(v=>{const val=row[v.id];if(_isNA(val))return'NA';if(val===undefined||val==='')return'';return String(val).includes(',')?`"${val}"`:val})].join(','))})
  dl(ls.join('\n'),`${name}_data.csv`)
}

export function exportStatsCSV(project){
  const{variables,rows,name}=project
  const numVars=variables.filter(v=>['number','integer','percent','ordinal','binary'].includes(v.type))
  const catVars=variables.filter(v=>v.type==='categorical')
  const ls=[`RTRE Stats — ${name}`,`N: ${rows.length}`,`Date: ${new Date().toLocaleString('vi-VN')}`,'','=== NUMERIC ===','Variable,Code,N,Missing,Mean,SD,Median,Skew,Normal']
  for(const v of numVars){const vals=rows.map(r=>r[v.id]).filter(x=>!_isNA(x));const d=descriptive(vals);if(!d){ls.push(`${v.name},${v.codeName||''},0`);continue};ls.push([v.name,v.codeName||'',d.n,d.missing,d.mean,d.std,d.median,d.skew,d.normal?'Yes':'No'].join(','))}
  ls.push('');if(catVars.length){ls.push('=== CATEGORICAL ===');for(const v of catVars){ls.push(`${v.name} (${v.codeName||''}):`);ls.push('Value,N,%');freqTable(rows.map(r=>r[v.id]).filter(x=>!_isNA(x))).forEach(r=>ls.push(`${r.value},${r.n},${r.pct}`));ls.push('')}}
  dl(ls.join('\n'),`${name}_stats.csv`)
}

function dl(c,f){const b=new Blob(['\uFEFF'+c],{type:'text/csv;charset=utf-8;'});const u=URL.createObjectURL(b);Object.assign(document.createElement('a'),{href:u,download:f}).click();URL.revokeObjectURL(u)}
