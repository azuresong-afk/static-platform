/**
 * Линейная алгебра для малых колебаний (матрицы до 12×12): разложение Холецкого, симметричная задача на собственные
 * значения методом вращений Якоби, обобщённая задача C·v = λ·A·v, определитель, решение комплексной системы.
 */
export type Mat = number[][];

export const zeros = (n: number, m = n): Mat => Array.from({ length: n }, () => new Array(m).fill(0));
export const eye = (n: number): Mat => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (__, j) => (i === j ? 1 : 0)));
export const matVec = (M: Mat, x: number[]): number[] => M.map((r) => r.reduce((s, a, j) => s + a * x[j], 0));
export const dot = (x: number[], y: number[]): number => x.reduce((s, a, i) => s + a * y[i], 0);
/** xᵀ·M·y. */
export const form = (M: Mat, x: number[], y: number[]): number => dot(x, matVec(M, y));
export const maxAbs = (M: Mat): number => Math.max(0, ...M.flat().map(Math.abs));

/** A = L·Lᵀ; null, если матрица не положительно определена. */
export function cholesky(A: Mat): Mat | null {
  const n = A.length,
    L = zeros(n);
  const scale = Math.max(1e-300, ...A.map((r, i) => Math.abs(r[i])));
  for (let i = 0; i < n; i++)
    for (let j = 0; j <= i; j++) {
      let s = A[i][j];
      for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
      if (i === j) {
        if (!(s > 1e-11 * scale)) return null;
        L[i][i] = Math.sqrt(s);
      } else L[i][j] = s / L[j][j];
    }
  return L;
}

/** Решение L·x = b (L — нижняя треугольная). */
function lowerSolve(L: Mat, b: number[]): number[] {
  const x = b.slice();
  for (let i = 0; i < L.length; i++) {
    for (let k = 0; k < i; k++) x[i] -= L[i][k] * x[k];
    x[i] /= L[i][i];
  }
  return x;
}
/** Решение Lᵀ·x = b. */
function upperTSolve(L: Mat, b: number[]): number[] {
  const n = L.length,
    x = b.slice();
  for (let i = n - 1; i >= 0; i--) {
    for (let k = i + 1; k < n; k++) x[i] -= L[k][i] * x[k];
    x[i] /= L[i][i];
  }
  return x;
}

/** Собственные значения и векторы (столбцы) симметричной матрицы — циклический метод Якоби. */
export function jacobi(S0: Mat): { values: number[]; vectors: Mat } {
  const n = S0.length,
    S = S0.map((r) => r.slice()),
    V = eye(n);
  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += S[i][j] ** 2;
    const diag = Math.max(1e-300, ...S.map((r, i) => Math.abs(r[i])));
    if (off <= (1e-30 * diag) ** 2 || off === 0) break;
    for (let p = 0; p < n; p++)
      for (let q = p + 1; q < n; q++) {
        if (S[p][q] === 0) continue;
        const th = (S[q][q] - S[p][p]) / (2 * S[p][q]);
        const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
        const c = 1 / Math.sqrt(t * t + 1),
          s = t * c;
        for (let k = 0; k < n; k++) {
          const a = S[k][p],
            b = S[k][q];
          S[k][p] = c * a - s * b;
          S[k][q] = s * a + c * b;
        }
        for (let k = 0; k < n; k++) {
          const a = S[p][k],
            b = S[q][k];
          S[p][k] = c * a - s * b;
          S[q][k] = s * a + c * b;
        }
        for (let k = 0; k < n; k++) {
          const a = V[k][p],
            b = V[k][q];
          V[k][p] = c * a - s * b;
          V[k][q] = s * a + c * b;
        }
      }
  }
  return { values: S.map((r, i) => r[i]), vectors: V };
}

/**
 * Обобщённая задача C·v = λ·A·v (A симметрична и положительно определена, C симметрична): λ по возрастанию,
 * векторы нормированы условием vᵀ·A·v = 1. null — если A не положительно определена.
 */
export function eigenSym(C: Mat, A: Mat): { lam: number[]; vec: number[][] } | null {
  const n = A.length;
  const L = cholesky(A);
  if (!L) return null;
  // S = L⁻¹·C·L⁻ᵀ: сначала X = L⁻¹·C (по столбцам), затем S = L⁻¹·Xᵀ (C симметрична).
  const X = zeros(n);
  for (let j = 0; j < n; j++) {
    const col = lowerSolve(
      L,
      C.map((r) => r[j]),
    );
    for (let i = 0; i < n; i++) X[i][j] = col[i];
  }
  const S = zeros(n);
  for (let i = 0; i < n; i++) {
    const col = lowerSolve(L, X[i]);
    for (let j = 0; j < n; j++) S[j][i] = col[j];
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < i; j++) S[i][j] = S[j][i] = (S[i][j] + S[j][i]) / 2;
  const { values, vectors } = jacobi(S);
  const order = values.map((_, i) => i).sort((a, b) => values[a] - values[b]);
  return {
    lam: order.map((i) => values[i]),
    vec: order.map((i) =>
      upperTSolve(
        L,
        vectors.map((r) => r[i]),
      ),
    ),
  };
}

/** Определитель (исключение Гаусса с выбором главного элемента). */
export function det(M0: Mat): number {
  const n = M0.length,
    M = M0.map((r) => r.slice());
  let d = 1;
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (M[p][c] === 0) return 0;
    if (p !== c) {
      [M[c], M[p]] = [M[p], M[c]];
      d = -d;
    }
    d *= M[c][c];
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / M[c][c];
      for (let k = c; k < n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return d;
}

/** Решение вещественной системы; null — если матрица вырождена (относительно её масштаба). */
export function solve(M0: Mat, b0: number[]): number[] | null {
  const n = b0.length,
    M = M0.map((r, i) => [...r, b0[i]]);
  const scale = Math.max(1e-300, maxAbs(M0));
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) <= 1e-13 * scale) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      if (f) for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((r, i) => r[n] / r[i]);
}

/** Комплексная система (R + iI)·(x + iy) = (a + ib) — как вещественная удвоенного порядка. */
export function solveComplex(R: Mat, I: Mat, a: number[], b: number[]): { re: number[]; im: number[] } | null {
  const n = a.length;
  const M = zeros(2 * n);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      M[i][j] = R[i][j];
      M[i][j + n] = -I[i][j];
      M[i + n][j] = I[i][j];
      M[i + n][j + n] = R[i][j];
    }
  const x = solve(M, [...a, ...b]);
  return x ? { re: x.slice(0, n), im: x.slice(n) } : null;
}

/** Обратная матрица (null — вырождена). */
export function inverse(M: Mat): Mat | null {
  const n = M.length,
    out = zeros(n);
  for (let j = 0; j < n; j++) {
    const col = solve(
      M,
      M.map((_, i) => (i === j ? 1 : 0)),
    );
    if (!col) return null;
    for (let i = 0; i < n; i++) out[i][j] = col[i];
  }
  return out;
}

/** Определитель комплексной матрицы R + iI. */
export function cdet(R0: Mat, I0: Mat): { re: number; im: number } {
  const n = R0.length,
    R = R0.map((r) => r.slice()),
    I = I0.map((r) => r.slice());
  let dr = 1,
    di = 0;
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.hypot(R[r][c], I[r][c]) > Math.hypot(R[p][c], I[p][c])) p = r;
    const pr = R[p][c],
      pi = I[p][c];
    if (pr === 0 && pi === 0) return { re: 0, im: 0 };
    if (p !== c) {
      [R[c], R[p]] = [R[p], R[c]];
      [I[c], I[p]] = [I[p], I[c]];
      dr = -dr;
      di = -di;
    }
    [dr, di] = [dr * pr - di * pi, dr * pi + di * pr];
    const q = pr * pr + pi * pi;
    for (let r = c + 1; r < n; r++) {
      // f = M[r][c]/M[c][c]
      const fr = (R[r][c] * pr + I[r][c] * pi) / q,
        fi = (I[r][c] * pr - R[r][c] * pi) / q;
      for (let k = c; k < n; k++) {
        const ar = R[c][k],
          ai = I[c][k];
        R[r][k] -= fr * ar - fi * ai;
        I[r][k] -= fr * ai + fi * ar;
      }
    }
  }
  return { re: dr, im: di };
}

/** Корни многочлена Σ aⱼ zʲ (коэффициенты по возрастанию степени) — метод Дюрана — Кернера. */
export function polyRoots(a: number[]): { re: number; im: number }[] {
  let n = a.length - 1;
  while (n > 0 && a[n] === 0) n--;
  if (n < 1) return [];
  const c = a.slice(0, n + 1).map((x) => x / a[n]);
  const zr = Array.from({ length: n }, (_, k) => Math.cos(0.4 + (2 * Math.PI * k) / n) * (1 + 0.1 * k)),
    zi = Array.from({ length: n }, (_, k) => Math.sin(0.4 + (2 * Math.PI * k) / n) * (1 + 0.1 * k));
  const R = 1 + Math.max(...c.slice(0, n).map(Math.abs));
  for (let k = 0; k < n; k++) {
    zr[k] *= R;
    zi[k] *= R;
  }
  for (let it = 0; it < 2000; it++) {
    let move = 0;
    for (let k = 0; k < n; k++) {
      // p(z) по схеме Горнера.
      let pr = 1,
        pi = 0;
      for (let j = n - 1; j >= 0; j--) [pr, pi] = [pr * zr[k] - pi * zi[k] + c[j], pr * zi[k] + pi * zr[k]];
      let qr = 1,
        qi = 0;
      for (let j = 0; j < n; j++) {
        if (j === k) continue;
        const dr = zr[k] - zr[j],
          di = zi[k] - zi[j];
        [qr, qi] = [qr * dr - qi * di, qr * di + qi * dr];
      }
      const q = qr * qr + qi * qi || 1e-300;
      const wr = (pr * qr + pi * qi) / q,
        wi = (pi * qr - pr * qi) / q;
      zr[k] -= wr;
      zi[k] -= wi;
      move = Math.max(move, Math.hypot(wr, wi) / Math.max(1, Math.hypot(zr[k], zi[k])));
    }
    if (move < 1e-15) break;
  }
  return zr.map((re, k) => ({ re, im: zi[k] }));
}
