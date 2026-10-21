/**
 * Уравнение Якоби — Гамильтона и принцип Гамильтона — Остроградского (Мещерский 49.15–49.22).
 *
 * Якоби — Гамильтон. По T и Π строится функция Гамильтона H(q, p) (как в режиме «Интегралы, Раус, Гамильтон»),
 * уравнение ∂V/∂t + H(q, ∂V/∂q) = 0 и его полный интеграл разделением переменных:
 *   циклическая координата qₐ (не входит в H): ∂V/∂qₐ = αₐ = const;
 *   остальные — если H распадается на слагаемые Hⱼ(qⱼ, pⱼ) (каждое — от своей пары) и постоянную часть:
 *   Hⱼ = βⱼ (последнее — из H = h), pⱼ = ∂V/∂qⱼ — корень квадратного уравнения Hⱼ(qⱼ, pⱼ) = βⱼ;
 *   V = −h·t + Σ αₐqₐ + Σ ∫pⱼ(qⱼ)dqⱼ. Интеграл берётся в конечном виде, если pⱼ = √(c + k·qⱼ) или pⱼ не зависит от qⱼ.
 * Первые интегралы — ∂V/∂h = β₀, ∂V/∂αₐ = βₐ (Якоби). Проверка: по численному решению уравнений Лагранжа импульсы
 * pⱼ = ∂T/∂q̇ⱼ совпадают с pⱼ(qⱼ) из полного интеграла (с постоянными по начальным условиям).
 *
 * Струна и нить. Линейная плотность ρ(x) и натяжение T(x) (формулы от x), длина l; малые поперечные колебания y(x, t):
 *   S = ∫∫ [ρ·(∂y/∂t)²/2 − T·(∂y/∂x)²/2] dx dt,  δS = 0  ⇒  ρ·∂²y/∂t² = ∂/∂x (T·∂y/∂x);
 *   граничные условия: закреплённый конец y = 0, свободный — T·∂y/∂x = 0 (при T = 0 на конце — ограниченность).
 * Собственные частоты и формы — конечными разностями (N = 400 отрезков; трёхдиагональная задача, бисекция по Штурму).
 */
import {
  add,
  d,
  div,
  evalSym,
  expand,
  mul,
  neg,
  normName,
  num,
  parseSym,
  pow,
  scale,
  sub,
  subst,
  time,
  trigSimplify,
  varsOf,
  variable,
  type Sym,
  type SymContext,
  type Wrt,
} from '../../../shared/sym';
import { solveLagrange, type LagParam, type LagProblem } from '../../lagrange/model/lagrange';
import { solveRouth, type RouthSolution } from './routh';

const S = (s: Sym) => trigSimplify(expand(s));
const shorter = (a: Sym) => {
  const x = S(a);
  return x.length <= a.length ? x : a;
};
const pos = (name: string): Wrt => ({ k: 'var', name, ord: 0 });

/* ───────────── Якоби — Гамильтон ───────────── */

export interface HJPart {
  /** Координата и её импульс. */
  q: string;
  p: string;
  /** Hⱼ(qⱼ, pⱼ) и постоянная разделения (βⱼ или h − …). */
  H: Sym;
  E: Sym;
  /** pⱼ(qⱼ) и интеграл ∫pⱼdqⱼ в конечном виде (null — остаётся интегралом). */
  pq: Sym;
  integral: Sym | null;
}
export interface HJSolution {
  ok: true;
  ctx: SymContext;
  pNames: string[];
  H: Sym;
  /** Циклические координаты: индекс и имя постоянной. */
  cyclic: { i: number; alpha: string }[];
  /** H после подстановки циклических импульсов; разделяется ли. */
  Hred: Sym;
  separable: boolean;
  const0: Sym;
  parts: HJPart[];
  /** Имена постоянных разделения βⱼ (кроме последней) и энергии h. */
  betas: string[];
  V: Sym | null;
  /** Первые интегралы ∂V/∂h и ∂V/∂αₐ, ∂V/∂βⱼ (если V — в конечном виде). */
  first: { wrt: string; expr: Sym }[];
  /** Проверка по численному решению: наибольшее относительное отличие pⱼ(qⱼ) от ∂T/∂q̇ⱼ и разброс первых интегралов. */
  check: { pDev: number; firstDev: number[] } | null;
  values: Map<string, number>;
  /** Та же система в режиме «Интегралы, Раус, Гамильтон» (графики движения). */
  routh: RouthSolution;
}
export type HJResult = HJSolution | { ok: false; field: string; error: string };

/** Степень по переменной x в члене (вне функций и скобок); null — если x внутри функции или скобки. */
function degIn(s: Sym, x: string): Map<number, Sym> | null {
  const out = new Map<number, Sym>();
  for (const t of s) {
    let e = 0;
    const f: typeof t.f = [];
    for (const [a, k] of t.f) {
      if (a.k === 'var' && a.name === x && a.ord === 0) e += k;
      else {
        if ((a.k === 'fn' || a.k === 'grp') && varsOf(a.a).has(x)) return null;
        f.push([a, k]);
      }
    }
    out.set(e, add(out.get(e) ?? [], [{ c: t.c, f }]));
  }
  return out;
}

export function solveHJ(pr: LagProblem): HJResult {
  const rr = solveRouth(pr);
  if (!rr.ok) return rr;
  if (!rr.ham) return { ok: false, field: 'T', error: rr.hamError ?? 'Функция Гамильтона не строится.' };
  if (rr.Q.some((q) => q.length))
    return { ok: false, field: 'Q0', error: 'Уравнение Якоби — Гамильтона — для консервативной системы: уберите непотенциальные силы.' };
  const { ctx } = rr;
  const names = ctx.coords;
  const H = rr.ham.H;
  const pNames = rr.ham.pNames;
  const used = new Set([...names, ...ctx.params]);
  const fresh = (base: string) => {
    let n = base,
      k = 1;
    while (used.has(n)) n = base + ++k;
    used.add(n);
    return n;
  };
  // Циклические по H: координата не входит в H.
  const inH = varsOf(H);
  const cyc = names.map((n, i) => ({ n, i })).filter(({ n }) => !inH.has(n));
  const cyclic = cyc.map(({ i, n }) => ({ i, alpha: fresh('α_' + n) }));
  const Hred = shorter(
    subst(H, (a) =>
      a.ord === 0 && pNames.includes(a.name) && cyc.some(({ i }) => pNames[i] === a.name)
        ? variable(cyclic[cyc.findIndex(({ i }) => pNames[i] === a.name)].alpha)
        : null,
    ),
  );
  const nc = names.map((_, i) => i).filter((i) => !cyc.some((c) => c.i === i));
  // Разбиение на слагаемые по парам (qⱼ, pⱼ).
  const groups = new Map<number, Sym>();
  let const0: Sym = [];
  let separable = true;
  for (const t of Hred) {
    const vs = varsOf([t]);
    const own = nc.filter((i) => vs.has(names[i]) || vs.has(pNames[i]));
    if (own.length > 1) separable = false;
    if (!own.length) const0 = add(const0, [t]);
    else groups.set(own[0], add(groups.get(own[0]) ?? [], [t]));
  }
  const h = fresh('h');
  const betas: string[] = [];
  const parts: HJPart[] = [];
  const pv = new Map<string, number>(pr.params.map((p) => [normName(p.name.trim()), p.value]));
  if (separable) {
    const order = nc.filter((i) => groups.has(i));
    order.forEach((i, k) => {
      const last = k === order.length - 1;
      const beta = last ? '' : fresh('β' + (k + 1));
      if (!last) betas.push(beta);
      const Hj = groups.get(i)!;
      const E = last ? sub(sub(variable(h), const0), add(...betas.map((b) => variable(b)))) : variable(beta);
      // Hⱼ = A₂p² + A₁p + A₀(q) = E.
      const dg = degIn(Hj, pNames[i]);
      let pq: Sym | null = null;
      if (dg && [...dg.keys()].every((e) => e === 0 || e === 1 || e === 2) && dg.has(2)) {
        const A2 = dg.get(2)!,
          A1 = dg.get(1) ?? [],
          A0 = dg.get(0) ?? [];
        if (!A1.length) pq = pow(shorter(div(sub(E, A0), A2)), 0.5);
        else {
          const disc = shorter(sub(mul(A1, A1), mul(num(4), A2, sub(A0, E))));
          pq = shorter(div(add(neg(A1), pow(disc, 0.5)), mul(num(2), A2)));
        }
      }
      if (!pq) {
        separable = false;
        return;
      }
      // ∫pdq в конечном виде: p = √(c + k·q) (под корнем — линейно по q) или p не зависит от q.
      let integral: Sym | null = null;
      const q = names[i];
      if (!varsOf(pq).has(q)) integral = mul(pq, variable(q));
      else if (!(dg!.get(1) ?? []).length) {
        const under = shorter(div(sub(E, dg!.get(0) ?? []), dg!.get(2)!));
        const lin = degIn(S(under), q);
        if (lin && [...lin.keys()].every((e) => e === 0 || e === 1) && lin.has(1)) integral = shorter(mul(div(num(2 / 3), lin.get(1)!), pow(under, 1.5)));
      }
      parts.push({ q, p: pNames[i], H: Hj, E, pq, integral });
    });
  }
  let V: Sym | null = null;
  const first: HJSolution['first'] = [];
  if (separable && parts.every((p) => p.integral)) {
    V = add(scale(mul(variable(h), time()), -1), ...cyclic.map((c) => mul(variable(c.alpha), variable(names[c.i]))), ...parts.map((p) => p.integral!));
    for (const w of [h, ...cyclic.map((c) => c.alpha), ...betas]) first.push({ wrt: w, expr: shorter(d(V, pos(w))) });
  }

  // Проверка по численному решению.
  let check: HJSolution['check'] = null;
  const lag = solveLagrange({ ...pr, tEnd: pr.tEnd > 0 ? pr.tEnd : 3 });
  if (separable && lag.ok && lag.sim && rr.sim) {
    const consts = new Map(pv);
    const q0 = pr.coords.map((c) => c.q0),
      v0 = pr.coords.map((c) => c.v0);
    const at = (qq: number[], vv: number[]) => (name: string, ord: number) => {
      const i = names.indexOf(name);
      if (i >= 0) return ord === 0 ? qq[i] : vv[i];
      return consts.get(name) ?? NaN;
    };
    const p0 = rr.p.map((p) => evalSym(p, at(q0, v0)));
    cyclic.forEach((c) => consts.set(c.alpha, p0[c.i]));
    const valQP = (qq: number[], pp: number[]) => (name: string) => {
      const i = names.indexOf(name);
      if (i >= 0) return qq[i];
      const k = pNames.indexOf(name);
      if (k >= 0) return pp[k];
      return consts.get(name) ?? NaN;
    };
    consts.set(h, evalSym(H, valQP(q0, p0)));
    parts.forEach((pt) => {
      if (pt.E.length === 1 && pt.E[0].f.length === 1 && pt.E[0].f[0][0].k === 'var' && betas.includes(pt.E[0].f[0][0].name))
        consts.set(pt.E[0].f[0][0].name, evalSym(pt.H, valQP(q0, p0)));
    });
    const sim = rr.sim;
    let dev = 0,
      sc = 1e-12;
    const firstVals: number[][] = first.map(() => []);
    for (let k = 0; k < sim.t.length; k++) {
      const qq = sim.q.map((x) => x[k]),
        pp = sim.p.map((x) => x[k]);
      for (const pt of parts) {
        const i = names.indexOf(pt.q);
        const want = Math.abs(pp[i]);
        const got = Math.abs(evalSym(pt.pq, valQP(qq, pp)));
        if (Number.isFinite(got)) dev = Math.max(dev, Math.abs(got - want));
        sc = Math.max(sc, want);
      }
      first.forEach((f, j) => firstVals[j].push(evalSym(f.expr, valQP(qq, pp), sim.t[k])));
    }
    check = {
      pDev: dev / sc,
      firstDev: firstVals.map((vs) => {
        // Первый интеграл постоянен на участках монотонности qⱼ (знак корня один) — берём разброс на первой трети.
        const part = vs.slice(0, Math.max(2, Math.floor(vs.length / 3))).filter(Number.isFinite);
        const m = Math.max(1e-12, ...part.map(Math.abs));
        return part.length ? (Math.max(...part) - Math.min(...part)) / m : NaN;
      }),
    };
  }
  return { ok: true, ctx, pNames, H, cyclic, Hred, separable, const0, parts, betas, V, first, check, values: pv, routh: rr };
}

/* ───────────── Струна и нить ───────────── */

export type StringBC = 'fixed' | 'free';
export interface StringProblem {
  params: LagParam[];
  rho: string;
  T: string;
  l: string;
  /** Правый конец (x = l): закреплён или свободен. Левый (x = 0) всегда закреплён. */
  bc: StringBC;
  modes: number;
}
export interface StringSolution {
  ok: true;
  ctx: SymContext;
  rho: Sym;
  T: Sym;
  dT: Sym;
  l: Sym;
  lv: number;
  /** a² = T/ρ, если T и ρ постоянны. */
  a2: Sym | null;
  /** Натяжение на свободном конце равно нулю (условие ограниченности). */
  zeroEnd: boolean;
  omega: number[];
  shapes: { x: number[]; y: number[][] };
}
export type StringResult = StringSolution | { ok: false; field: string; error: string };

/** Собственные значения симметричной трёхдиагональной матрицы (диагональ a, поддиагональ b) — бисекция по Штурму. */
function tridiagEigen(a: number[], b: number[], k: number): number[] {
  const n = a.length;
  const count = (x: number) => {
    let c = 0,
      q = a[0] - x;
    if (q < 0) c++;
    for (let i = 1; i < n; i++) {
      q = a[i] - x - (b[i - 1] * b[i - 1]) / (q === 0 ? 1e-300 : q);
      if (q < 0) c++;
    }
    return c;
  };
  let lo = Infinity,
    hi = -Infinity;
  for (let i = 0; i < n; i++) {
    const r = Math.abs(b[i - 1] ?? 0) + Math.abs(b[i] ?? 0);
    lo = Math.min(lo, a[i] - r);
    hi = Math.max(hi, a[i] + r);
  }
  const out: number[] = [];
  for (let j = 0; j < Math.min(k, n); j++) {
    let L = lo,
      R = hi;
    for (let it = 0; it < 200; it++) {
      const m = (L + R) / 2;
      if (count(m) > j) R = m;
      else L = m;
      if (R - L < 1e-14 * Math.max(1, Math.abs(m))) break;
    }
    out.push((L + R) / 2);
  }
  return out;
}

export function solveString(pr: StringProblem): StringResult {
  const params = pr.params.map((p) => ({ ...p, name: normName(p.name.trim()) }));
  const names = params.map((p) => p.name);
  for (const n of names) if (!/^[\p{L}][\p{L}\p{N}_]*$/u.test(n)) return { ok: false, field: 'names', error: `Имя «${n}» — буква, затем буквы или цифры.` };
  if (names.includes('x')) return { ok: false, field: 'names', error: 'Буква x занята под координату вдоль струны.' };
  const ctx: SymContext = { coords: ['x'], params: names };
  const parse = (src: string, field: string, c = ctx): Sym | { ok: false; field: string; error: string } => {
    const r = parseSym(src, c);
    if (!r.ok) return { ok: false, field, error: r.error };
    if (!r.s.length) return { ok: false, field, error: 'Задайте формулу.' };
    return r.s;
  };
  const rho = parse(pr.rho, 'rho');
  if (!Array.isArray(rho)) return rho;
  const T = parse(pr.T, 'Tstr');
  if (!Array.isArray(T)) return T;
  const l = parse(pr.l, 'l', { coords: [], params: names });
  if (!Array.isArray(l)) return l;
  const pv = new Map(params.map((p) => [p.name, p.value]));
  const at = (s: Sym, x: number) => evalSym(s, (n) => (n === 'x' ? x : (pv.get(n) ?? NaN)));
  const lv = at(l, 0);
  if (!(lv > 0)) return { ok: false, field: 'l', error: 'Длина должна быть положительной.' };
  const dT = shorter(d(T, pos('x')));
  const constant = !varsOf(rho).has('x') && !varsOf(T).has('x');
  const a2 = constant ? shorter(div(T, rho)) : null;
  const N = 400,
    hx = lv / N;
  const xs = Array.from({ length: N + 1 }, (_, i) => i * hx);
  const rv = xs.map((x) => at(rho, x));
  const Tm = Array.from({ length: N }, (_, i) => at(T, (i + 0.5) * hx));
  if (!rv.every((v) => v > 0) || !Tm.every((v) => Number.isFinite(v) && v >= 0))
    return { ok: false, field: 'Tstr', error: 'Плотность должна быть положительной, натяжение — неотрицательным на всей длине.' };
  const TlEnd = at(T, lv);
  const zeroEnd = pr.bc === 'free' && Math.abs(TlEnd) <= 1e-9 * Math.max(1e-300, ...Tm);
  // Узлы-неизвестные: 1…N−1 (закреплён x = l) или 1…N (свободный конец).
  const last = pr.bc === 'fixed' ? N - 1 : N;
  const n = last;
  const K = Array.from({ length: n }, () => [0, 0]); // диагональ, связь со следующим
  const Mass: number[] = [];
  for (let k = 0; k < n; k++) {
    const i = k + 1;
    const tl = Tm[i - 1],
      tr = i < N ? Tm[i] : 0;
    K[k][0] = (tl + tr) / hx;
    K[k][1] = i < last ? -tr / hx : 0;
    Mass.push(i === N ? (rv[i] * hx) / 2 : rv[i] * hx);
  }
  const s = Mass.map((m) => 1 / Math.sqrt(m));
  const a = K.map((r, k) => r[0] * s[k] * s[k]);
  const b = K.slice(0, n - 1).map((r, k) => r[1] * s[k] * s[k + 1]);
  const lam = tridiagEigen(a, b, Math.max(1, Math.min(6, pr.modes)));
  const omega = lam.map((x) => Math.sqrt(Math.max(0, x)));
  // Формы — обратными итерациями (прогонка).
  const shapes: number[][] = lam.map((L) => {
    let v = Array.from({ length: n }, (_, k) => Math.sin(((k + 1) * Math.PI) / (n + 1)) + 0.01 * ((k * 7919) % 13));
    const shift = L * (1 + 1e-9) + 1e-12;
    for (let it = 0; it < 6; it++) {
      // (A − shift·I)·w = v, A = (a, b)
      const c = b.slice(),
        dd = a.map((x) => x - shift),
        rhs = v.slice();
      for (let k = 1; k < n; k++) {
        const m = c[k - 1] / dd[k - 1];
        dd[k] -= m * c[k - 1];
        rhs[k] -= m * rhs[k - 1];
      }
      const w = new Array(n).fill(0);
      w[n - 1] = rhs[n - 1] / dd[n - 1];
      for (let k = n - 2; k >= 0; k--) w[k] = (rhs[k] - c[k] * w[k + 1]) / dd[k];
      const nr = Math.max(...w.map(Math.abs)) || 1;
      v = w.map((x) => x / nr);
    }
    const y = [0, ...v.map((x, k) => x * s[k])];
    if (pr.bc === 'fixed') y.push(0);
    const mx = y.reduce((m, x) => (Math.abs(x) > Math.abs(m) ? x : m), 0) || 1;
    return y.map((x) => x / mx);
  });
  return { ok: true, ctx, rho, T, dT, l, lv, a2, zeroEnd, omega, shapes: { x: xs, y: shapes } };
}
