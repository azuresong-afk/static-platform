/**
 * Уравнения Лагранжа второго рода (Мещерский §48):
 *   d/dt (∂T/∂q̇ⱼ) − ∂T/∂qⱼ = Qⱼ,   Qⱼ = −∂Π/∂qⱼ + Qⱼ^н.
 * Пользователь задаёт обобщённые координаты (1–3), параметры, кинетическую энергию T(q, q̇, t), потенциальную
 * энергию Π(q, t) и непотенциальные обобщённые силы Qⱼ^н (могут зависеть от скоростей — сопротивление).
 *
 * Результат: производные по шагам, уравнения движения (с сокращением на общий множитель), разрешённые
 * относительно ускорений (уравнения линейны по q̈: A·q̈ + b = 0), численное интегрирование (Рунге — Кутта 4-го
 * порядка) с проверкой сохранения энергии и частоты малых колебаний около положения равновесия.
 */
import { gauss } from '../../../shared/gauss';
import {
  add,
  commonFactor,
  d,
  div,
  evalSym,
  expand,
  hasVel,
  mul,
  neg,
  normName,
  parseSym,

  sub,
  subst,
  trigSimplify,
  usesTime,
  varsOf,
  variable,
  type Sym,
  type SymContext,
  type Term,
  type Wrt,
} from '../../../shared/sym';

export interface LagCoord {
  name: string;
  /** Начальные значение и скорость. */
  q0: number;
  v0: number;
  /** Положение равновесия для малых колебаний. */
  eq: number;
  /** Непотенциальная обобщённая сила по этой координате (формула). */
  Q: string;
}
export interface LagParam {
  name: string;
  value: number;
}
export interface LagProblem {
  coords: LagCoord[];
  params: LagParam[];
  T: string;
  P: string;
  /** Время интегрирования, с. */
  tEnd: number;
}

export interface CoordDerivation {
  name: string;
  /** ∂T/∂q̇, d/dt(∂T/∂q̇), ∂T/∂q, −∂Π/∂q, Q^н. */
  p: Sym;
  dp: Sym;
  tq: Sym;
  qPot: Sym;
  qNp: Sym;
  /** Левая часть уравнения E = 0 (до и после сокращения на общий множитель). */
  E: Sym;
  factor: Term;
  Ered: Sym;
}

export interface LagSolution {
  ok: true;
  ctx: SymContext;
  T: Sym;
  P: Sym;
  rows: CoordDerivation[];
  /** A·q̈ + b = 0 (по уравнениям после сокращения). */
  A: Sym[][];
  b: Sym[];
  /** Для одной координаты: q̈ = f(q, q̇, t) (если коэффициент при q̈ — одночлен), иначе q̈ = −b/A. */
  acc1: Sym | null;
  /** Обобщённый интеграл энергии (Якоби) H = Σ q̇ ∂T/∂q̇ − T + Π; при T, квадратичной по скоростям, H = T + Π. */
  H: Sym;
  /** Ускорения в начальный момент. */
  acc0: number[];
  sim: { t: number[]; q: number[][]; E: number[] } | null;
  /** Энергия сохраняется (нет непотенциальных сил и явной зависимости от t). */
  conservative: boolean;
  energyDrift: number | null;
  small: SmallOsc | null;
}

export interface SmallOsc {
  /** Положение равновесия и невязка (q̈ при q = q*, q̇ = 0). */
  eq: number[];
  residual: number;
  /** Матрицы инерции и жёсткости линеаризованной системы: M·δq̈ + K·δq = 0. */
  M: number[][];
  K: number[][];
  /** Квадраты частот (ω²): отрицательный — положение неустойчиво, нуль — безразличное направление. */
  w2: number[];
}

export type LagResult = LagSolution | { ok: false; field: string; error: string };

const DT_STEPS = 2000;

/** Собственные значения M⁻¹K для 1–3 координат (характеристический многочлен det(K − λM) = 0). */
export function eigenGeneral(M: number[][], K: number[][]): number[] {
  const n = M.length;
  if (n === 1) return [K[0][0] / M[0][0]];
  const det = (X: number[][]): number =>
    X.length === 2 ? X[0][0] * X[1][1] - X[0][1] * X[1][0] : X[0][0] * (X[1][1] * X[2][2] - X[1][2] * X[2][1]) - X[0][1] * (X[1][0] * X[2][2] - X[1][2] * X[2][0]) + X[0][2] * (X[1][0] * X[2][1] - X[1][1] * X[2][0]);
  // Многочлен p(λ) = det(K − λM) по значениям в n + 1 точках (интерполяция Лагранжа в коэффициенты).
  const xs = Array.from({ length: n + 1 }, (_, i) => i);
  const ys = xs.map((l) => det(K.map((r, i) => r.map((k, j) => k - l * M[i][j]))));
  // Коэффициенты через решение системы Вандермонда.
  const V = xs.map((x) => xs.map((_, j) => Math.pow(x, j)));
  const c = gauss(V, ys);
  if (n === 2) {
    const [c0, c1, c2] = c;
    const D = c1 * c1 - 4 * c2 * c0;
    if (D < 0) return [NaN, NaN];
    const s = Math.sqrt(D);
    return [(-c1 - s) / (2 * c2), (-c1 + s) / (2 * c2)].sort((a, b) => a - b);
  }
  // Кубическое: корни Ньютоном с понижением степени, начальное приближение — по следу.
  const roots: number[] = [];
  let poly = c.slice();
  for (let k = 0; k < 3; k++) {
    const deg = poly.length - 1;
    const f = (x: number) => poly.reduceRight((a, q) => a * x + q, 0);
    const df = (x: number) => poly.slice(1).reduceRight((a, q, i) => a * x + q * (i + 1), 0);
    let x = 0;
    const tr = Math.abs(poly[deg - 1] / poly[deg]) || 1;
    for (const start of [0, tr, -tr, 2 * tr]) {
      x = start;
      for (let i = 0; i < 200; i++) {
        const dx = f(x) / (df(x) || 1e-30);
        x -= dx;
        if (Math.abs(dx) < 1e-14 * Math.max(1, Math.abs(x))) break;
      }
      if (Math.abs(f(x)) < 1e-8 * Math.max(1, ...poly.map(Math.abs))) break;
    }
    roots.push(x);
    // Деление на (λ − x).
    const q: number[] = new Array(deg).fill(0);
    let r = poly[deg];
    for (let i = deg - 1; i >= 0; i--) {
      q[i] = r;
      r = poly[i] + r * x;
    }
    poly = q;
  }
  return roots.sort((a, b) => a - b);
}

export function solveLagrange(pr: LagProblem): LagResult {
  const coords = pr.coords.map((c) => ({ ...c, name: normName(c.name.trim()) }));
  const params = pr.params.map((p) => ({ ...p, name: normName(p.name.trim()) }));
  if (!coords.length) return { ok: false, field: 'coords', error: 'Нужна хотя бы одна обобщённая координата.' };
  if (coords.length > 3) return { ok: false, field: 'coords', error: 'Не больше трёх обобщённых координат.' };
  const names = [...coords.map((c) => c.name), ...params.map((p) => p.name)];
  for (const n of names) if (!/^[\p{L}][\p{L}\p{N}_]*$/u.test(n)) return { ok: false, field: 'names', error: `Имя «${n}» — буква, затем буквы или цифры.` };
  const dup = names.find((n, i) => names.indexOf(n) !== i);
  if (dup) return { ok: false, field: 'names', error: `Обозначение «${dup}» встречается дважды.` };
  if (names.includes('t')) return { ok: false, field: 'names', error: 'Буква t занята под время.' };
  const ctx: SymContext = { coords: coords.map((c) => c.name), params: params.map((p) => p.name) };
  const parse = (src: string, field: string): Sym | { ok: false; field: string; error: string } => {
    const r = parseSym(src, ctx);
    return r.ok ? r.s : { ok: false, field, error: r.error };
  };
  const T0 = parse(pr.T, 'T');
  if (!Array.isArray(T0)) return T0;
  const P0 = parse(pr.P, 'P');
  if (!Array.isArray(P0)) return P0;
  if (!T0.length) return { ok: false, field: 'T', error: 'Задайте кинетическую энергию T.' };
  if ([...varsOf(T0).values()].some((v) => v.ord > 1)) return { ok: false, field: 'T', error: 'В кинетическую энергию входят только координаты и скорости.' };
  if (hasVel(P0)) return { ok: false, field: 'P', error: 'Потенциальная энергия не зависит от скоростей.' };
  const Qs: Sym[] = [];
  for (const [j, c] of coords.entries()) {
    const q = parse(c.Q, 'Q' + j);
    if (!Array.isArray(q)) return q;
    if ([...varsOf(q).values()].some((v) => v.ord > 1)) return { ok: false, field: 'Q' + j, error: 'Обобщённая сила не зависит от ускорений.' };
    Qs.push(q);
  }
  const T = trigSimplify(T0);
  const P = P0;
  const isCoord = (n: string) => ctx.coords.includes(n);
  const time: Wrt = { k: 'time', isCoord };

  const rows: CoordDerivation[] = coords.map((c, j) => {
    const p = trigSimplify(d(T, { k: 'var', name: c.name, ord: 1 }));
    const dp = trigSimplify(d(p, time));
    const tq = trigSimplify(d(T, { k: 'var', name: c.name, ord: 0 }));
    const qPot = neg(d(P, { k: 'var', name: c.name, ord: 0 }));
    const qNp = Qs[j];
    let E = trigSimplify(sub(sub(dp, tq), add(qPot, qNp)));
    // Если раскрытие скобок даёт короче (или нуль) — берём его.
    const Ex = trigSimplify(expand(E));
    if (Ex.length < E.length) E = Ex;
    const { factor, rest } = commonFactor(E);
    return { name: c.name, p, dp, tq, qPot, qNp, E, factor, Ered: rest };
  });

  // A·q̈ + b = 0.
  const A = rows.map((r) => coords.map((c) => d(r.Ered, { k: 'var', name: c.name, ord: 2 })));
  const b = rows.map((r) => subst(r.Ered, (a) => (a.ord === 2 ? [] : null)));
  if (A.some((row) => row.some((x) => [...varsOf(x).values()].some((v) => v.ord === 2)))) return { ok: false, field: 'T', error: 'Уравнения нелинейны по ускорениям — проверьте T.' };
  let acc1: Sym | null = null;
  if (coords.length === 1) {
    const a = A[0][0];
    acc1 = a.length === 1 ? trigSimplify(neg(div(b[0], a))) : null;
  }

  const pv = new Map(params.map((p) => [p.name, p.value]));
  const accAt = (q: number[], v: number[], t: number): number[] => {
    const val = (name: string, ord: number) => {
      const i = ctx.coords.indexOf(name);
      if (i >= 0) return ord === 0 ? q[i] : v[i];
      return pv.get(name) ?? NaN;
    };
    const M = A.map((row) => row.map((x) => evalSym(x, val, t)));
    const rhs = b.map((x) => -evalSym(x, val, t));
    return coords.length === 1 ? [rhs[0] / M[0][0]] : gauss(M, rhs);
  };
  const q0 = coords.map((c) => c.q0),
    v0 = coords.map((c) => c.v0);
  const acc0 = accAt(q0, v0, 0);
  if (!acc0.every(Number.isFinite)) return { ok: false, field: 'T', error: 'Ускорения в начальный момент не определены: проверьте T (матрица инерции вырождена) и значения параметров.' };

  const conservative = Qs.every((q) => !q.length) && !usesTime(T) && !usesTime(P);
  const H = trigSimplify(add(...rows.map((r) => mul(variable(r.name, 1), r.p)), neg(T), P));
  const energy = (q: number[], v: number[], t: number) => {
    const val = (name: string, ord: number) => {
      const i = ctx.coords.indexOf(name);
      if (i >= 0) return ord === 0 ? q[i] : v[i];
      return pv.get(name) ?? NaN;
    };
    return evalSym(H, val, t);
  };

  // Рунге — Кутта 4-го порядка.
  let sim: LagSolution['sim'] = null;
  let energyDrift: number | null = null;
  if (pr.tEnd > 0) {
    const n = coords.length,
      h = pr.tEnd / DT_STEPS;
    let q = q0.slice(),
      v = v0.slice(),
      t = 0;
    const ts = [0],
      qs = q0.map((x) => [x]),
      Es = [energy(q, v, 0)];
    const f = (qq: number[], vv: number[], tt: number) => ({ dq: vv, dv: accAt(qq, vv, tt) });
    const every = 4;
    for (let s = 1; s <= DT_STEPS; s++) {
      const k1 = f(q, v, t);
      const k2 = f(
        q.map((x, i) => x + (h / 2) * k1.dq[i]),
        v.map((x, i) => x + (h / 2) * k1.dv[i]),
        t + h / 2,
      );
      const k3 = f(
        q.map((x, i) => x + (h / 2) * k2.dq[i]),
        v.map((x, i) => x + (h / 2) * k2.dv[i]),
        t + h / 2,
      );
      const k4 = f(
        q.map((x, i) => x + h * k3.dq[i]),
        v.map((x, i) => x + h * k3.dv[i]),
        t + h,
      );
      q = q.map((x, i) => x + (h / 6) * (k1.dq[i] + 2 * k2.dq[i] + 2 * k3.dq[i] + k4.dq[i]));
      v = v.map((x, i) => x + (h / 6) * (k1.dv[i] + 2 * k2.dv[i] + 2 * k3.dv[i] + k4.dv[i]));
      t = s * h;
      if (!q.every(Number.isFinite) || !v.every(Number.isFinite)) break;
      if (s % every === 0 || s === DT_STEPS) {
        ts.push(t);
        for (let i = 0; i < n; i++) qs[i].push(q[i]);
        Es.push(energy(q, v, t));
      }
    }
    sim = { t: ts, q: qs, E: Es };
    if (conservative) {
      const E0 = Es[0];
      energyDrift = Math.max(...Es.map((e) => Math.abs(e - E0))) / Math.max(1e-12, Math.abs(E0), ...Es.map(Math.abs));
    }
  }

  // Малые колебания около q* (q̇ = 0): M = A(q*), K_ij = ∂b_i/∂q_j (q*). Только без явной зависимости от t.
  let small: SmallOsc | null = null;
  if (!usesTime(T) && !usesTime(P) && !Qs.some(usesTime)) {
    const eq = coords.map((c) => c.eq);
    const zero = coords.map(() => 0);
    const val = (name: string, ord: number) => {
      const i = ctx.coords.indexOf(name);
      if (i >= 0) return ord === 0 ? eq[i] : 0;
      return pv.get(name) ?? NaN;
    };
    const M = A.map((row) => row.map((x) => evalSym(x, val)));
    const K = b.map((bi) => coords.map((c) => evalSym(d(bi, { k: 'var', name: c.name, ord: 0 }), val)));
    const res = accAt(eq, zero, 0);
    const residual = Math.max(...res.map(Math.abs));
    const w2 = eigenGeneral(M, K);
    if (M.flat().every(Number.isFinite) && K.flat().every(Number.isFinite)) small = { eq, residual, M, K, w2 };
  }
  return { ok: true, ctx, T, P, rows, A, b, acc1, H, acc0, sim, conservative, energyDrift, small };
}
