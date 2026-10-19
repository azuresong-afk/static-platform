/**
 * Прямоугольная линейная система M·x = b (несколько правых частей): приведение к ступенчатому виду (Гаусс — Жордан
 * с выбором главного элемента). Сообщает ранг, совместность и какие неизвестные определены однозначно.
 */
export interface LinSol {
  rank: number;
  /** Решение для каждой правой части (свободные неизвестные = 0). */
  x: number[][];
  /** Неизвестная определена однозначно (не зависит от свободных). */
  determined: boolean[];
  /** Номера правых частей, для которых система несовместна. */
  inconsistent: number[];
  /** Базис решений однородной системы (по одному вектору на свободную неизвестную). */
  nullspace: number[][];
}

export function solveLin(M: number[][], rhs: number[][]): LinSol {
  const m = M.length,
    n = m ? M[0].length : 0,
    q = rhs.length;
  const A = M.map((r, i) => [...r, ...rhs.map((b) => b[i])]);
  const big = Math.max(1e-300, ...M.flat().map(Math.abs));
  const tol = 1e-9 * big;
  const piv: number[] = [];
  let row = 0;
  for (let c = 0; c < n && row < m; c++) {
    let p = row;
    for (let r = row + 1; r < m; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    if (Math.abs(A[p][c]) <= tol) continue;
    [A[row], A[p]] = [A[p], A[row]];
    const f0 = A[row][c];
    for (let k = c; k < n + q; k++) A[row][k] /= f0;
    for (let r = 0; r < m; r++) {
      if (r === row) continue;
      const f = A[r][c];
      if (f === 0) continue;
      for (let k = c; k < n + q; k++) A[r][k] -= f * A[row][k];
    }
    piv.push(c);
    row++;
  }
  const rank = piv.length;
  const free = [...Array(n).keys()].filter((c) => !piv.includes(c));
  const determined = Array<boolean>(n).fill(false);
  piv.forEach((c, i) => (determined[c] = free.every((f) => Math.abs(A[i][f]) <= 1e-9)));
  const inconsistent: number[] = [];
  for (let j = 0; j < q; j++) {
    const bigB = Math.max(1, ...rhs[j].map(Math.abs));
    for (let r = rank; r < m; r++)
      if (Math.abs(A[r][n + j]) > 1e-8 * bigB) {
        inconsistent.push(j);
        break;
      }
  }
  const x = rhs.map((_, j) => {
    const s = Array<number>(n).fill(0);
    piv.forEach((c, i) => (s[c] = A[i][n + j]));
    return s;
  });
  const nullspace = free.map((f) => {
    const s = Array<number>(n).fill(0);
    s[f] = 1;
    piv.forEach((c, i) => (s[c] = -A[i][f]));
    return s;
  });
  return { rank, x, determined, inconsistent, nullspace };
}
