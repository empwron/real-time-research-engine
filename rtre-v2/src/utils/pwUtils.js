const SUFFIX = '_RTRE_'
export const padPw = pw => pw.length >= 6 ? pw : (pw + SUFFIX).slice(0, 6)
