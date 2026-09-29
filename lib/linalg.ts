// Tiny dense linear algebra for the D-error (K ≤ ~30).

export function zeros(rows: number, cols: number): number[][] {
  const m: number[][] = []
  for (let r = 0; r < rows; r++) m.push(new Array(cols).fill(0))
  return m
}

export function dot(a: number[], b: number[]): number {
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i] * b[i]
  return s
}

// log det of a symmetric positive semi-definite matrix via Cholesky. Returns -Infinity
// when the matrix is singular relative to its scale (a pivot below 1e-10 × the largest
// diagonal), so near-singular information matrices never yield a plausible D-error.
export function logDetSPD(M: number[][]): number {
  const n = M.length
  if (n === 0) return 0
  let scale = 0
  for (let i = 0; i < n; i++) scale = Math.max(scale, Math.abs(M[i][i]))
  if (!(scale > 0)) return -Infinity
  const tol = 1e-10 * scale
  const L: number[][] = zeros(n, n)
  let ld = 0
  for (let j = 0; j < n; j++) {
    let d = M[j][j]
    for (let k = 0; k < j; k++) d -= L[j][k] * L[j][k]
    if (!(d > tol)) return -Infinity
    const ljj = Math.sqrt(d)
    L[j][j] = ljj
    ld += 2 * Math.log(ljj)
    for (let i = j + 1; i < n; i++) {
      let s = M[i][j]
      for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k]
      L[i][j] = s / ljj
    }
  }
  return ld
}
