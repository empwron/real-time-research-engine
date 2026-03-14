// Firebase Auth requires minimum 6 characters.
// We pad short passwords with a fixed suffix so users can set any length.
const SUFFIX = '_RTRE_'
export const padPw = pw => pw.length >= 6 ? pw : (pw + SUFFIX).slice(0, 6)
