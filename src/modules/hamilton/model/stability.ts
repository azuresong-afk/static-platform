/**
 * Устойчивость по первому приближению (Мещерский §55): характеристическое уравнение
 *   a₀λⁿ + a₁λⁿ⁻¹ + … + aₙ = 0
 * по готовым коэффициентам, по матрице системы ẋ = A·x или по уравнениям M·q̈ + B·q̇ + C·q = 0;
 * определители Гурвица в буквах, корни, вывод об устойчивости и границы устойчивости по параметру.
 *
 * Корни на мнимой оси — критический случай: для линейной системы она устойчива (не асимптотически), если
 * у каждого такого корня столько собственных векторов, какова его кратность; иначе отклонения растут
 * (вековые члены). Для нелинейной системы первое приближение в критическом случае ответа не даёт.
 */
import {
  add,
  constOf,
  evalSym,
  expand,
  mul,
  neg,
  num,
  parseSym,
  scale,
  sub,
  trigSimplify,
  variable,
  commonFactor,
  type Sym,
  type Term,
} from '../../../shared/sym';
import type { LagParam } from '../../lagrange/model/lagrange';

export type Cx = [number, number];

/* ───────────── Многочлены и корни ───────────── */

const cmul = (a: Cx, b: Cx): Cx => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const cdiv = (a: Cx, b: Cx): Cx => {
  const d = b[0] * b[0] + b[1] * b[1];
  return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d];
};
const csub = (a: Cx, b: Cx): Cx => [a[0] - b[0], a[1] - b[1]];
const cabs = (a: Cx) => Math.hypot(a[0], a[1]);
/** Значение многочлена (коэффициенты по убыванию степеней) и его производной. */
function horner(c: number[], z: Cx): { p: Cx; dp: Cx } {
  let p: Cx = [c[0], 0],
    dp: Cx = [0, 0];
  for (let i = 1; i < c.length; i++) {
    dp = [cmul(dp, z)[0] + p[0], cmul(dp, z)[1] + p[1]];
    const pz = cmul(p, z);
    p = [pz[0] + c[i], pz[1]];
  }
  return { p, dp };
}

/** Корни многочлена (коэффициенты по убыванию степеней) методом Аберта; нулевые корни отделяются точно. */
export function polyRoots(c0: number[]): Cx[] {
  let c = c0.slice();
  while (c.length > 1 && c[0] === 0) c.shift();
  const big = Math.max(...c.map(Math.abs)) || 1;
  const zeros: Cx[] = [];
  while (c.length > 1 && Math.abs(c[c.length - 1]) <= 1e-14 * big) {
    c.pop();
    zeros.push([0, 0]);
  }
  const n = c.length - 1;
  if (n < 1) return zeros;
  c = c.map((x) => x / c[0]);
  if (n === 1) return [[-c[1], 0], ...zeros];
  // Начальные приближения — на окружности радиуса по оценке Коши, со сдвигом по углу.
  const R = 1 + Math.max(...c.slice(1).map(Math.abs));
  const r0 = Math.min(R, Math.pow(Math.abs(c[n]), 1 / n) || 1);
  let z: Cx[] = Array.from({ length: n }, (_, k) => {
    const a = (2 * Math.PI * k) / n + 0.4;
    return [r0 * Math.cos(a), r0 * Math.sin(a)];
  });
  for (let it = 0; it < 500; it++) {
    let moved = 0;
    const nz: Cx[] = z.map((zi, i) => {
      const { p, dp } = horner(c, zi);
      if (cabs(p) === 0) return zi;
      const ratio = cdiv(p, dp);
      let s: Cx = [0, 0];
      z.forEach((zj, j) => {
        if (j !== i) {
          const t = cdiv([1, 0], csub(zi, zj));
          s = [s[0] + t[0], s[1] + t[1]];
        }
      });
      const w = cdiv(ratio, csub([1, 0], cmul(ratio, s)));
      moved = Math.max(moved, cabs(w) / Math.max(1, cabs(zi)));
      return csub(zi, w);
    });
    z = nz;
    if (moved < 1e-15) break;
  }
  // Почти вещественные корни вещественного многочлена — вещественные.
  z = z.map(([re, im]) => [re, Math.abs(im) < 1e-10 * Math.max(1, Math.abs(re)) ? 0 : im]);
  return [...z, ...zeros].sort((a, b) => b[0] - a[0] || b[1] - a[1]);
}

/** Характеристический многочлен det(λI − A) (по убыванию степеней) — метод Леверье — Фаддеева. */
export function charPoly(A: number[][]): number[] {
  const n = A.length;
  const c = [1];
  let Mk: number[][] = A.map((r, i) => r.map((_, j) => (i === j ? 1 : 0)));
  for (let k = 1; k <= n; k++) {
    const AM = A.map((r) => Mk[0].map((_, j) => r.reduce((s, a, l) => s + a * Mk[l][j], 0)));
    const ck = -AM.reduce((s, r, i) => s + r[i], 0) / k;
    c.push(ck);
    Mk = AM.map((r, i) => r.map((x, j) => x + (i === j ? ck : 0)));
  }
  return c;
}

/** Ранг комплексной матрицы с относительным допуском. */
function rankCx(M: Cx[][], tol: number): number {
  const A = M.map((r) => r.map((x) => [x[0], x[1]] as Cx));
  const rows = A.length,
    cols = rows ? A[0].length : 0;
  const mx = Math.max(1e-300, ...A.flat().map(cabs));
  let rk = 0;
  for (let col = 0; col < cols && rk < rows; col++) {
    let p = -1,
      best = tol * mx;
    for (let r = rk; r < rows; r++)
      if (cabs(A[r][col]) > best) {
        best = cabs(A[r][col]);
        p = r;
      }
    if (p < 0) continue;
    [A[rk], A[p]] = [A[p], A[rk]];
    for (let r = 0; r < rows; r++) {
      if (r === rk) continue;
      const f = cdiv(A[r][col], A[rk][col]);
      for (let k = col; k < cols; k++) A[r][k] = csub(A[r][k], cmul(f, A[rk][k]));
    }
    rk++;
  }
  return rk;
}

/* ───────────── Символьные определители ───────────── */

const simp = (s: Sym) => trigSimplify(expand(s));

/** Определитель разложением по первой строке (n ≤ 6). */
export function detSym(M: Sym[][]): Sym {
  const n = M.length;
  if (n === 1) return M[0][0];
  if (n === 2) return simp(sub(mul(M[0][0], M[1][1]), mul(M[0][1], M[1][0])));
  const parts: Sym[] = [];
  for (let j = 0; j < n; j++) {
    if (!M[0][j].length) continue;
    const minor = M.slice(1).map((r) => r.filter((_, k) => k !== j));
    const t = mul(M[0][j], detSym(minor));
    parts.push(j % 2 ? neg(t) : t);
  }
  return simp(add(...parts));
}

/** Матрица Гурвица: Hᵢⱼ = a₂ⱼ₋ᵢ (нумерация с 1), aₖ = 0 вне 0…n. */
export function hurwitzMatrix<T>(a: T[], zero: T): T[][] {
  const n = a.length - 1;
  return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => a[2 * (j + 1) - (i + 1)] ?? zero));
}
function detNum(M: number[][]): number {
  const n = M.length;
  const A = M.map((r) => r.slice());
  let det = 1;
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    if (A[p][c] === 0) return 0;
    if (p !== c) {
      [A[c], A[p]] = [A[p], A[c]];
      det = -det;
    }
    det *= A[c][c];
    for (let r = c + 1; r < n; r++) {
      const f = A[r][c] / A[c][c];
      for (let k = c; k < n; k++) A[r][k] -= f * A[c][k];
    }
  }
  return det;
}
/** Главные миноры Гурвица Δ₁ … Δₙ (числа). */
export function hurwitzNum(a: number[]): number[] {
  const H = hurwitzMatrix(a, 0);
  return H.map((_, k) => detNum(H.slice(0, k + 1).map((r) => r.slice(0, k + 1))));
}

/* ───────────── Задача ───────────── */

export type StabForm = 'poly' | 'first' | 'second';
export interface StabProblem {
  form: StabForm;
  /** Коэффициенты a₀ … aₙ (по убыванию степеней λ). */
  poly: string[];
  /** ẋ = A·x. */
  A: string[][];
  /** M·q̈ + B·q̇ + C·q = 0. */
  M: string[][];
  B: string[][];
  C: string[][];
  params: LagParam[];
  /** Границы устойчивости по параметру. */
  scan: { param: string; from: number; to: number } | null;
}

export type StabVerdict = 'asym' | 'unstable' | 'linear' | 'critical';
export const LAMBDA = 'λ';

export interface HurwitzCond {
  /** Номер минора (1…n) или −1 для условия aₖ > 0. */
  k: number;
  D: Sym;
  /** Общий множитель (знак при заданных параметрах положителен — на него сокращаем). */
  factor: Term;
  rest: Sym;
  value: number;
}

export interface StabSolution {
  ok: true;
  /** Коэффициенты характеристического уравнения в буквах (a₀ … aₙ). */
  coefSym: Sym[];
  /** Сколько коэффициентов в конце тождественно равны нулю — столько нулевых корней. */
  zeroRoots: number;
  /** Многочлен без нулевых корней: коэффициенты в буквах и числа. */
  red: Sym[];
  coef: number[];
  /** Условия: коэффициенты (k = −1, индекс в cond.idx) и миноры Гурвица Δ₂ … Δₘ₋₁. */
  conds: (HurwitzCond & { idx?: number })[];
  hurNum: number[];
  /** Только чётные степени λ (2 или 4): условия вещественности и положительности корней μ = −λ² (a₀ > 0). */
  even: { label: string; D: Sym; factor: Term; rest: Sym; value: number }[] | null;
  roots: Cx[];
  maxRe: number;
  verdict: StabVerdict;
  /** Кратные корни на мнимой оси: кратность и число собственных векторов (если известна матрица). */
  imag: { root: Cx; mult: number; geo: number | null }[];
  /** Матрица системы первого порядка (числа) — для собственных векторов. */
  matrix: number[][] | null;
  scan: { param: string; from: number; to: number; stable: [number, number][]; bounds: number[] } | null;
}
export type StabResult = StabSolution | { ok: false; field: string; error: string };

/** Классификация корней (общая и для «Интегралов движения»). */
export function classify(roots: Cx[], matrix: number[][] | null): { maxRe: number; verdict: StabVerdict; imag: StabSolution['imag'] } {
  const sc = Math.max(1, ...roots.map(cabs));
  const tol = 1e-7 * sc;
  const maxRe = Math.max(...roots.map((r) => r[0]));
  const imag: StabSolution['imag'] = [];
  const onAxis = roots.filter((r) => Math.abs(r[0]) <= tol);
  // Группы близких корней на мнимой оси (кратные корни численно расходятся на ~√ε).
  for (const r of onAxis) {
    const g = imag.find((x) => Math.abs(x.root[1] - r[1]) <= 1e-4 * sc);
    if (g) g.mult++;
    else imag.push({ root: [0, r[1]], mult: 1, geo: null });
  }
  if (matrix) {
    const n = matrix.length;
    for (const g of imag) {
      const Mx: Cx[][] = matrix.map((row, i) => row.map((v, j) => [v - (i === j ? g.root[0] : 0), i === j ? -g.root[1] : 0] as Cx));
      g.geo = n - rankCx(Mx, 1e-6);
    }
  }
  let verdict: StabVerdict;
  if (maxRe > tol) verdict = 'unstable';
  else if (!imag.length) verdict = 'asym';
  else if (imag.every((g) => (g.geo != null ? g.geo >= g.mult : g.mult === 1))) verdict = 'linear';
  else if (imag.some((g) => g.geo != null && g.geo < g.mult)) verdict = 'unstable';
  else verdict = 'critical';
  return { maxRe, verdict, imag };
}

const isStableV = (v: StabVerdict) => v === 'asym' || v === 'linear';

export interface Built {
  coefSym: Sym[];
  /** Числовые коэффициенты и матрица первого порядка при данных значениях параметров. */
  numeric: (pv: Map<string, number>) => { coef: number[]; matrix: number[][] | null };
}

function build(pr: StabProblem): Built | { ok: false; field: string; error: string } {
  const params = pr.params.map((p) => p.name.trim());
  for (const n of params) if (!/^[\p{L}][\p{L}\p{N}_]*$/u.test(n)) return { ok: false, field: 'names', error: `Имя «${n}» — буква, затем буквы или цифры.` };
  const dup = params.find((n, i) => params.indexOf(n) !== i);
  if (dup) return { ok: false, field: 'names', error: `Обозначение «${dup}» встречается дважды.` };
  const ctx = { coords: [], params };
  const parse = (src: string, field: string): Sym | { ok: false; field: string; error: string } => {
    const r = parseSym(src, ctx);
    if (!r.ok) return { ok: false, field, error: r.error };
    if (r.s.some((t) => t.f.some(([a]) => a.k === 't'))) return { ok: false, field, error: 'Коэффициенты постоянны: время t не входит.' };
    return r.s;
  };
  const grid = (G: string[][], key: string): Sym[][] | { ok: false; field: string; error: string } => {
    const out: Sym[][] = [];
    for (const [i, row] of G.entries()) {
      const r: Sym[] = [];
      for (const [j, src] of row.entries()) {
        const s = parse(src, `${key}${i}_${j}`);
        if (!Array.isArray(s)) return s;
        r.push(s);
      }
      out.push(r);
    }
    return out;
  };
  const ev = (s: Sym, pv: Map<string, number>) => evalSym(s, (n) => pv.get(n) ?? NaN);
  if (pr.form === 'poly') {
    if (pr.poly.length < 2 || pr.poly.length > 7) return { ok: false, field: 'poly', error: 'Степень уравнения — от 1 до 6.' };
    const cs: Sym[] = [];
    for (const [i, src] of pr.poly.entries()) {
      const s = parse(src, 'a' + i);
      if (!Array.isArray(s)) return s;
      cs.push(s);
    }
    if (!cs[0].length) return { ok: false, field: 'a0', error: 'Старший коэффициент a₀ не может быть нулём.' };
    return { coefSym: cs, numeric: (pv) => ({ coef: cs.map((s) => ev(s, pv)), matrix: null }) };
  }
  if (pr.form === 'first') {
    const n = pr.A.length;
    if (n < 1 || n > 4) return { ok: false, field: 'A', error: 'Порядок системы — от 1 до 4.' };
    const A = grid(pr.A, 'A');
    if (!Array.isArray(A)) return A;
    // det(λI − A).
    const L = A.map((row, i) => row.map((a, j) => (i === j ? sub(variable(LAMBDA), a) : neg(a))));
    const cs = collect(detSym(L), n);
    return { coefSym: cs, numeric: (pv) => ({ coef: cs.map((s) => ev(s, pv)), matrix: A.map((r) => r.map((s) => ev(s, pv))) }) };
  }
  const n = pr.M.length;
  if (n < 1 || n > 3) return { ok: false, field: 'M', error: 'Число координат — от 1 до 3.' };
  const M = grid(pr.M, 'M'),
    B = grid(pr.B, 'B'),
    C = grid(pr.C, 'C');
  if (!Array.isArray(M)) return M;
  if (!Array.isArray(B)) return B;
  if (!Array.isArray(C)) return C;
  return buildSecond(M, B, C);
}

/** det(Mλ² + Bλ + C) = 0 по матрицам в буквах (общая часть для режима «В буквах»). */
export function buildSecond(M: Sym[][], B: Sym[][], C: Sym[][]): Built | { ok: false; field: string; error: string } {
  const n = M.length;
  const ev = (s: Sym, pv: Map<string, number>) => evalSym(s, (nm) => pv.get(nm) ?? NaN);
  const l = variable(LAMBDA);
  const D = M.map((row, i) => row.map((m, j) => add(mul(m, l, l), mul(B[i][j], l), C[i][j])));
  const cs = collect(detSym(D), 2 * n);
  if (!cs[0].length) return { ok: false, field: 'M', error: 'Матрица M вырождена (det M = 0) — понизьте порядок или задайте систему первого порядка.' };
  return {
    coefSym: cs,
    numeric: (pv) => {
      const Mn = M.map((r) => r.map((s) => ev(s, pv))),
        Bn = B.map((r) => r.map((s) => ev(s, pv))),
        Cn = C.map((r) => r.map((s) => ev(s, pv)));
      return { coef: cs.map((s) => ev(s, pv)), matrix: firstOrder(Mn, Bn, Cn) };
    },
  };
}

/** x = (q, q̇): ẋ = [[0, I], [−M⁻¹C, −M⁻¹B]]·x; null, если M вырождена. */
export function firstOrder(M: number[][], B: number[][], C: number[][]): number[][] | null {
  const n = M.length;
  const inv = invert(M);
  if (!inv) return null;
  const MC = inv.map((r) => C[0].map((_, j) => -r.reduce((s, a, k) => s + a * C[k][j], 0)));
  const MB = inv.map((r) => B[0].map((_, j) => -r.reduce((s, a, k) => s + a * B[k][j], 0)));
  return [
    ...Array.from({ length: n }, (_, i) => [...Array(n).fill(0), ...Array.from({ length: n }, (__, j) => (i === j ? 1 : 0))]),
    ...MC.map((r, i) => [...r, ...MB[i]]),
  ];
}
function invert(M: number[][]): number[][] | null {
  const n = M.length;
  const A = M.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  const mx = Math.max(...M.flat().map(Math.abs)) || 1;
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    if (Math.abs(A[p][c]) < 1e-12 * mx) return null;
    [A[c], A[p]] = [A[p], A[c]];
    const d = A[c][c];
    A[c] = A[c].map((x) => x / d);
    for (let r = 0; r < n; r++) if (r !== c) A[r] = A[r].map((x, k) => x - A[r][c] * A[c][k]);
  }
  return A.map((r) => r.slice(n));
}

/** Коэффициенты при λᵏ (по убыванию степеней) многочлена от λ. */
export function collect(p: Sym, deg: number): Sym[] {
  const by: Term[][] = Array.from({ length: deg + 1 }, () => []);
  for (const t of p) {
    const hit = t.f.find(([a]) => a.k === 'var' && a.name === LAMBDA);
    const k = hit ? hit[1] : 0;
    by[deg - k].push({ c: t.c, f: t.f.filter(([a]) => !(a.k === 'var' && a.name === LAMBDA)) });
  }
  return by.map((ts) => trigSimplify(add(ts)));
}

export function solveStability(pr: StabProblem): StabResult {
  const bt = build(pr);
  if ('ok' in bt) return bt;
  const pv = new Map(pr.params.map((p) => [p.name.trim(), p.value]));
  return analyzeBuilt(bt, pv, pr.scan);
}

/** Условия устойчивости, корни и граница по параметру для уже составленного характеристического уравнения. */
export function analyzeBuilt(bt: Built, pv: Map<string, number>, scanIn: StabProblem['scan']): StabResult {
  const pr = { scan: scanIn };
  // Нулевые корни: последние коэффициенты тождественно равны нулю.
  let zeroRoots = 0;
  while (zeroRoots < bt.coefSym.length - 1 && !bt.coefSym[bt.coefSym.length - 1 - zeroRoots].length) zeroRoots++;
  const red = bt.coefSym.slice(0, bt.coefSym.length - zeroRoots);
  const { coef: full, matrix } = bt.numeric(pv);
  if (!full.every(Number.isFinite) || (matrix && !matrix.flat().every(Number.isFinite)))
    return { ok: false, field: 'params', error: 'Коэффициенты не вычисляются — проверьте значения параметров.' };
  if (Math.abs(full[0]) < 1e-300) return { ok: false, field: 'poly', error: 'Старший коэффициент равен нулю при заданных параметрах.' };
  const coef = full.slice(0, full.length - zeroRoots);
  // Условия: все коэффициенты одного знака с a₀ и миноры Гурвица Δ₂ … Δₘ₋₁ (Δₘ = aₘΔₘ₋₁).
  const s0 = Math.sign(coef[0]);
  const conds: StabSolution['conds'] = [];
  red.forEach((a, i) => {
    if (i === 0) return;
    const { factor, rest } = reduceBy(scale(a, s0), pv);
    conds.push({ k: -1, idx: i, D: scale(a, s0), factor, rest, value: s0 * coef[i] });
  });
  const m = red.length - 1;
  if (m >= 3) {
    const H = hurwitzMatrix(
      red.map((a) => scale(a, s0)),
      [] as Sym,
    );
    for (let k = 2; k <= m - 1; k++) {
      const D = detSym(H.slice(0, k).map((r) => r.slice(0, k)));
      const { factor, rest } = reduceBy(D, pv);
      conds.push({ k, D, factor, rest, value: ev(D, pv) });
    }
  }
  const hurNum = hurwitzNum(coef.map((c) => c * s0));
  // Только чётные степени λ (нет диссипации): λ² = −μ, нужны вещественные положительные простые корни μ.
  let even: StabSolution['even'] = null;
  if (m >= 2 && m % 2 === 0 && red.every((a, i) => i % 2 === 0 || !a.length) && m <= 4) {
    const b0 = scale(red[0], s0),
      b1 = scale(red[2], s0);
    const mk = (label: string, D: Sym) => ({ label, D, ...reduceBy(D, pv), value: ev(D, pv) });
    even = [mk('a₂', b1)];
    if (m === 4) {
      const b2 = scale(red[4], s0);
      even.push(mk('a₄', b2), mk('a₂² − 4a₀a₄', simp(sub(mul(b1, b1), mul(num(4), b0, b2)))));
    }
  }
  const roots = polyRoots(full);
  const { maxRe, verdict, imag } = classify(roots, matrix);
  let scan: StabSolution['scan'] = null;
  if (pr.scan && pv.has(pr.scan.param.trim()) && pr.scan.to > pr.scan.from) {
    const name = pr.scan.param.trim();
    const at = (x: number) => {
      const q = new Map(pv);
      q.set(name, x);
      const nm = bt.numeric(q);
      if (!nm.coef.every(Number.isFinite) || nm.coef[0] === 0) return false;
      return isStableV(classify(polyRoots(nm.coef), nm.matrix).verdict);
    };
    const N = 240,
      { from, to } = pr.scan;
    const xs = Array.from({ length: N + 1 }, (_, i) => from + ((to - from) * i) / N);
    const st = xs.map(at);
    const bounds: number[] = [];
    const stable: [number, number][] = [];
    let start: number | null = st[0] ? from : null;
    for (let i = 1; i <= N; i++) {
      if (st[i] === st[i - 1]) continue;
      let lo = xs[i - 1],
        hi = xs[i];
      for (let k = 0; k < 60; k++) {
        const mid = (lo + hi) / 2;
        if (at(mid) === st[i - 1]) lo = mid;
        else hi = mid;
      }
      const x = (lo + hi) / 2;
      bounds.push(x);
      if (st[i]) start = x;
      else if (start != null) {
        stable.push([start, x]);
        start = null;
      }
    }
    if (start != null) stable.push([start, to]);
    scan = { param: name, from, to, stable, bounds };
  }
  return { ok: true, coefSym: bt.coefSym, zeroRoots, red, coef, conds, hurNum, even, roots, maxRe, verdict, imag, matrix, scan };
}

const ev = (s: Sym, pv: Map<string, number>) => evalSym(s, (n) => pv.get(n) ?? NaN);

/** Сократить условие D > 0 на общий множитель, если он положителен при заданных параметрах. */
export function reduceBy(D: Sym, pv: Map<string, number>): { factor: Term; rest: Sym } {
  if (constOf(D) !== null) return { factor: { c: 1, f: [] }, rest: D };
  const { factor, rest } = commonFactor(D);
  const fv = ev([factor], pv);
  if (fv > 0) return { factor, rest };
  if (fv < 0) return { factor: { c: -factor.c, f: factor.f }, rest: scale(rest, -1) };
  return { factor: { c: 1, f: [] }, rest: D };
}
