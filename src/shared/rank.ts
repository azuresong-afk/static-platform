/** Ранг матрицы методом Гаусса с выбором главного элемента; допуск относительный. */
export function rankOf(M: number[][]): number {
  const A = M.map((r) => r.slice());
  const rows = A.length,
    cols = rows ? A[0].length : 0;
  let mx = 0;
  A.forEach((r) => r.forEach((v) => (mx = Math.max(mx, Math.abs(v)))));
  const tol = 1e-9 * Math.max(1, mx);
  let rk = 0;
  for (let c = 0; c < cols && rk < rows; c++) {
    let p = -1,
      best = tol;
    for (let r = rk; r < rows; r++)
      if (Math.abs(A[r][c]) > best) {
        best = Math.abs(A[r][c]);
        p = r;
      }
    if (p < 0) continue;
    [A[rk], A[p]] = [A[p], A[rk]];
    for (let r = 0; r < rows; r++) {
      if (r === rk) continue;
      const f = A[r][c] / A[rk][c];
      if (f) for (let k = c; k < cols; k++) A[r][k] -= f * A[rk][k];
    }
    rk++;
  }
  return rk;
}
