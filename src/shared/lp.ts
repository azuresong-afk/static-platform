/**
 * Линейное программирование для небольших задач: минимум c·x при A·x = b, G·x ≤ h, x — любого знака.
 * Двухфазный симплекс-метод на плотной таблице с правилом Бленда (без зацикливания).
 * Нужен для равновесия с трением и односторонними связями: там реакции ограничены неравенствами.
 */
export type LPResult = { status: 'optimal'; x: number[]; value: number } | { status: 'infeasible' } | { status: 'unbounded' };

const EPS = 1e-9;

export function linprog(c: number[], A: number[][], b: number[], G: number[][] = [], h: number[] = []): LPResult {
  const n = c.length;
  // Переменные: u (n), w (n) — x = u − w; s — дополнения к неравенствам.
  const ns = G.length;
  const rows: number[][] = [],
    rhs: number[] = [];
  A.forEach((r, i) => {
    rows.push([...r, ...r.map((v) => -v), ...new Array(ns).fill(0)]);
    rhs.push(b[i]);
  });
  G.forEach((r, i) => {
    const s = new Array(ns).fill(0);
    s[i] = 1;
    rows.push([...r, ...r.map((v) => -v), ...s]);
    rhs.push(h[i]);
  });
  const m = rows.length,
    nv = 2 * n + ns;
  for (let i = 0; i < m; i++)
    if (rhs[i] < 0) {
      rows[i] = rows[i].map((v) => -v);
      rhs[i] = -rhs[i];
    }
  // Таблица: nv переменных + m искусственных; базис — искусственные.
  const T = rows.map((r, i) => {
    const a = new Array(m).fill(0);
    a[i] = 1;
    return [...r, ...a, rhs[i]];
  });
  const W = nv + m;
  const basis = Array.from({ length: m }, (_, i) => nv + i);

  const pivot = (r: number, col: number) => {
    const p = T[r][col];
    for (let j = 0; j <= W; j++) T[r][j] /= p;
    for (let i = 0; i < m; i++) {
      if (i === r) continue;
      const f = T[i][col];
      if (Math.abs(f) > 0) for (let j = 0; j <= W; j++) T[i][j] -= f * T[r][j];
    }
    basis[r] = col;
  };
  /** Симплекс для стоимости cost (по всем W столбцам); allowed — какие столбцы можно вводить в базис. */
  const run = (cost: number[], allowed: (j: number) => boolean): 'optimal' | 'unbounded' => {
    for (let iter = 0; iter < 5000; iter++) {
      // Приведённые стоимости.
      let enter = -1;
      for (let j = 0; j < W && enter < 0; j++) {
        if (!allowed(j) || basis.includes(j)) continue;
        let d = cost[j];
        for (let i = 0; i < m; i++) d -= cost[basis[i]] * T[i][j];
        if (d < -EPS) enter = j;
      }
      if (enter < 0) return 'optimal';
      let leave = -1,
        best = Infinity;
      for (let i = 0; i < m; i++)
        if (T[i][enter] > EPS) {
          const q = T[i][W] / T[i][enter];
          if (q < best - EPS || (Math.abs(q - best) <= EPS && basis[i] < basis[leave])) {
            best = q;
            leave = i;
          }
        }
      if (leave < 0) return 'unbounded';
      pivot(leave, enter);
    }
    return 'optimal';
  };

  // Фаза 1: минимум суммы искусственных.
  const c1 = new Array(W).fill(0);
  for (let j = nv; j < W; j++) c1[j] = 1;
  run(c1, () => true);
  const infeas = basis.reduce((s, j, i) => s + (j >= nv ? T[i][W] : 0), 0);
  const scale = Math.max(1, ...rhs.map(Math.abs));
  if (infeas > 1e-7 * scale) return { status: 'infeasible' };
  // Выводим оставшиеся в базисе искусственные (с нулевым значением).
  for (let i = 0; i < m; i++)
    if (basis[i] >= nv) {
      const j = Array.from({ length: nv }, (_, k) => k).find((k) => Math.abs(T[i][k]) > EPS && !basis.includes(k));
      if (j != null) pivot(i, j);
    }
  // Фаза 2.
  const c2 = new Array(W).fill(0);
  for (let j = 0; j < n; j++) {
    c2[j] = c[j];
    c2[n + j] = -c[j];
  }
  if (run(c2, (j) => j < nv) === 'unbounded') return { status: 'unbounded' };
  const y = new Array(W).fill(0);
  basis.forEach((j, i) => (y[j] = T[i][W]));
  const x = Array.from({ length: n }, (_, j) => y[j] - y[n + j]);
  return { status: 'optimal', x, value: x.reduce((s, v, j) => s + v * c[j], 0) };
}
