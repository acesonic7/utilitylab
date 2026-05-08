// Tiny linear algebra: determinant via LU decomposition with partial pivoting.
// Designed for small dense matrices (K ≤ ~30) used in D-error calculation.

export function det(M: number[][]): number {
  const n = M.length
  if (n === 0) return 1
  if (M[0].length !== n) return NaN

  // Copy to mutable work matrix
  const A: number[][] = M.map((row) => [...row])
  let sign = 1
  let result = 1

  for (let i = 0; i < n; i++) {
    // Partial pivot: largest |A[r][i]| for r = i..n-1
    let maxRow = i
    let maxVal = Math.abs(A[i][i])
    for (let r = i + 1; r < n; r++) {
      const v = Math.abs(A[r][i])
      if (v > maxVal) {
        maxVal = v
        maxRow = r
      }
    }
    if (maxVal < 1e-15) return 0 // singular

    if (maxRow !== i) {
      const tmp = A[i]
      A[i] = A[maxRow]
      A[maxRow] = tmp
      sign = -sign
    }

    const pivot = A[i][i]
    result *= pivot

    for (let r = i + 1; r < n; r++) {
      const factor = A[r][i] / pivot
      for (let c = i; c < n; c++) {
        A[r][c] -= factor * A[i][c]
      }
    }
  }
  return sign * result
}

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
