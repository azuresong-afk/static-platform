/**
 * Нелинейные колебания с одной степенью свободы (Мещерский §56): ẍ = f(x, ẋ).
 *
 * Фазовая плоскость: особые точки (ẋ = 0, f(x, 0) = 0) и их тип по линеаризации, фазовые траектории (Рунге — Кутта).
 * Метод усреднения (Крылова — Боголюбова) и гармоническая линеаризация: выделяем линейную часть
 *   ẍ + k²x = Φ(x, ẋ),  Φ = f + k²x,  x = a cos ψ, ẋ = −ak sin ψ;
 *   ȧ = −(1/(2πk)) ∫₀^2π Φ sin ψ dψ — стационарные амплитуды (предельные циклы) — нули ȧ(a); цикл устойчив, если
 *   dȧ/da < 0;  ω²(a) = k² − (1/(πa)) ∫₀^2π Φ cos ψ dψ — частота в зависимости от амплитуды.
 * Для консервативной системы (f = f(x)) — точный период T(a) по численному интегрированию.
 */
import { d, evalSym, neg, normName, parseSym, subst, usesTime, add, mul, variable, hasVel, type Sym, type SymContext } from '../../../shared/sym';
import type { LagParam } from '../../lagrange/model/lagrange';

export interface NonlinProblem {
  /** Координата (x, φ…). */
  name: string;
  params: LagParam[];
  /** Ускорение ẍ = f(x, ẋ). */
  f: string;
  /** Квадрат частоты линейной части; пусто — k² = −∂f/∂x при x = ẋ = 0. */
  k2: string;
  x0: number;
  v0: number;
  tEnd: number;
  /** Дополнительные начальные отклонения для фазового портрета (ẋ₀ = 0). */
  starts: number[];
  /** Наибольшая амплитуда для графиков ȧ(a), ω(a), T(a). */
  aMax: number;
}

export type PointKind = 'center' | 'saddle' | 'focus-s' | 'focus-u' | 'node-s' | 'node-u' | 'degenerate';
export interface Singular {
  x: number;
  /** ∂f/∂x и ∂f/∂ẋ в особой точке. */
  fx: number;
  fv: number;
  kind: PointKind;
}
export interface Cycle {
  a: number;
  stable: boolean;
  omega: number;
}
export interface NonlinSolution {
  ok: true;
  ctx: SymContext;
  f: Sym;
  conservative: boolean;
  singular: Singular[];
  /** Линейная часть и нелинейная добавка Φ. */
  k2: number;
  k2Sym: Sym | null;
  Phi: Sym | null;
  /** Усреднение: график ȧ(a), ω(a), предельные циклы. */
  avg: { a: number[]; da: number[]; w: number[] } | null;
  cycles: Cycle[];
  /** Основное движение. */
  sim: { t: number[]; x: number[]; v: number[] };
  /** Измерено по основному движению: период и размах на последнем полном колебании, последовательные максимумы. */
  measured: { T: number; amp: number; peaks: number[]; a1: number } | null;
  /** Фазовые траектории. */
  portrait: { x: number[]; v: number[] }[];
  /** Точный период по амплитуде (только f = f(x)). */
  periods: { a: number; T: number }[];
}
export type NonlinResult = NonlinSolution | { ok: false; field: string; error: string };

const STEPS = 4000;

export function solveNonlin(pr: NonlinProblem): NonlinResult {
  const name = normName(pr.name.trim());
  const params = pr.params.map((p) => normName(p.name.trim()));
  const all = [name, ...params];
  for (const n of all) if (!/^[\p{L}][\p{L}\p{N}_]*$/u.test(n)) return { ok: false, field: 'names', error: `Имя «${n}» — буква, затем буквы или цифры.` };
  const dup = all.find((n, i) => all.indexOf(n) !== i);
  if (dup) return { ok: false, field: 'names', error: `Обозначение «${dup}» встречается дважды.` };
  if (all.includes('t')) return { ok: false, field: 'names', error: 'Буква t занята под время.' };
  const ctx: SymContext = { coords: [name], params };
  const fr = parseSym(pr.f, ctx);
  if (!fr.ok) return { ok: false, field: 'f', error: fr.error };
  const f = fr.s;
  if (!f.length) return { ok: false, field: 'f', error: 'Задайте ускорение ẍ = f(x, ẋ).' };
  if (usesTime(f)) return { ok: false, field: 'f', error: 'Только автономные системы: время t в f не входит.' };
  if (f.some((t) => t.f.some(([a]) => a.k === 'var' && a.ord === 2))) return { ok: false, field: 'f', error: 'В правую часть ускорение не входит.' };
  const pv = new Map(pr.params.map((p) => [normName(p.name.trim()), p.value]));
  const F = (x: number, v: number) => evalSym(f, (n, o) => (n === name ? (o === 0 ? x : v) : (pv.get(n) ?? NaN)));
  if (!Number.isFinite(F(pr.x0, pr.v0))) return { ok: false, field: 'f', error: 'f не вычисляется в начальном положении — проверьте значения параметров.' };
  const conservative = !hasVel(f);

  // Линейная часть.
  let k2Sym: Sym | null = null;
  let k2 = NaN;
  if (pr.k2.trim()) {
    const kr = parseSym(pr.k2, { coords: [], params });
    if (!kr.ok) return { ok: false, field: 'k2', error: kr.error };
    k2Sym = kr.s;
    k2 = evalSym(k2Sym, (n) => pv.get(n) ?? NaN);
  } else {
    const fx = d(f, { k: 'var', name, ord: 0 });
    const at0 = subst(fx, (a) => (a.name === name ? [] : null));
    k2Sym = neg(at0);
    k2 = evalSym(k2Sym, (n) => pv.get(n) ?? NaN);
    if (!Number.isFinite(k2)) k2Sym = null;
  }
  const Phi = k2Sym ? add(f, mul(k2Sym, variable(name))) : null;
  const PhiAt = (x: number, v: number) => F(x, v) + k2 * x;

  // Особые точки на отрезке ±X.
  const X = Math.max(Math.abs(pr.x0), pr.aMax, ...pr.starts.map(Math.abs), 1e-9) * 1.5;
  const singular: Singular[] = [];
  {
    const N = 600;
    const g = (x: number) => F(x, 0);
    let px = -X,
      pg = g(px);
    const roots: number[] = [];
    for (let i = 1; i <= N; i++) {
      const x = -X + (2 * X * i) / N,
        gx = g(x);
      if (gx === 0) roots.push(x);
      else if (Number.isFinite(gx) && Number.isFinite(pg) && pg * gx < 0) {
        let lo = px,
          hi = x;
        for (let k = 0; k < 80; k++) {
          const m = (lo + hi) / 2;
          if (g(lo) * g(m) <= 0) hi = m;
          else lo = m;
        }
        const r = (lo + hi) / 2;
        // Разрыв (знак) — не корень.
        if (Math.abs(g(r)) < 1e-6 * Math.max(1, Math.abs(g(px)), Math.abs(g(x)))) roots.push(r);
      }
      px = x;
      pg = gx;
    }
    for (const r of roots) {
      const h = 1e-6 * Math.max(1, Math.abs(r));
      const fx = (F(r + h, 0) - F(r - h, 0)) / (2 * h);
      const fv = (F(r, h) - F(r, -h)) / (2 * h);
      singular.push({ x: Math.abs(r) < 1e-12 ? 0 : r, fx, fv, kind: kindOf(fx, fv) });
    }
  }

  const rk = (x0: number, v0: number, tEnd: number, steps: number) => {
    const h = tEnd / steps;
    let x = x0,
      v = v0;
    const xs = [x],
      vs = [v],
      ts = [0];
    for (let s = 1; s <= steps; s++) {
      const a1 = F(x, v),
        x2 = x + (h / 2) * v,
        v2 = v + (h / 2) * a1;
      const a2 = F(x2, v2),
        x3 = x + (h / 2) * v2,
        v3 = v + (h / 2) * a2;
      const a3 = F(x3, v3),
        x4 = x + h * v3,
        v4 = v + h * a3;
      const a4 = F(x4, v4);
      x += (h / 6) * (v + 2 * v2 + 2 * v3 + v4);
      v += (h / 6) * (a1 + 2 * a2 + 2 * a3 + a4);
      if (!Number.isFinite(x) || !Number.isFinite(v) || Math.abs(x) > 1e6 * X) break;
      xs.push(x);
      vs.push(v);
      ts.push(s * h);
    }
    return { t: ts, x: xs, v: vs };
  };
  const tEnd = pr.tEnd > 0 ? pr.tEnd : 10;
  const sim = rk(pr.x0, pr.v0, tEnd, STEPS);

  // Максимумы x (смена знака ẋ с + на −) с уточнением по параболе.
  const maxima = (s: { t: number[]; x: number[]; v: number[] }) => {
    const out: { t: number; x: number }[] = [];
    for (let i = 1; i < s.v.length; i++)
      if (s.v[i - 1] > 0 && s.v[i] <= 0) {
        const w = s.v[i - 1] / (s.v[i - 1] - s.v[i]);
        out.push({ t: s.t[i - 1] + w * (s.t[i] - s.t[i - 1]), x: Math.max(s.x[i - 1], s.x[i]) });
      }
    return out;
  };
  let measured: NonlinSolution['measured'] = null;
  {
    const mx = maxima(sim);
    if (mx.length >= 2) {
      const T = mx[mx.length - 1].t - mx[mx.length - 2].t;
      const i0 = sim.t.findIndex((t) => t >= mx[mx.length - 2].t),
        i1 = sim.t.findIndex((t) => t >= mx[mx.length - 1].t);
      const seg = sim.x.slice(i0, i1 + 1);
      const amp = (Math.max(...seg) - Math.min(...seg)) / 2;
      // Первая гармоника: a₁ = (2/T)∫x cos(ω(t − t₀)) dt за последнее колебание.
      const w = (2 * Math.PI) / T;
      let a1 = 0;
      for (let i = i0; i < i1; i++) {
        const dt = sim.t[i + 1] - sim.t[i];
        const tm = (sim.t[i] + sim.t[i + 1]) / 2 - mx[mx.length - 2].t;
        a1 += ((sim.x[i] + sim.x[i + 1]) / 2) * Math.cos(w * tm) * dt;
      }
      a1 *= 2 / T;
      measured = { T, amp, peaks: mx.map((m) => m.x), a1 };
    }
  }

  // Фазовый портрет.
  const portrait = [...pr.starts.map((x0) => rk(x0, 0, tEnd, 1500)), sim].map((s) => ({ x: s.x, v: s.v }));

  // Усреднение.
  let avg: NonlinSolution['avg'] = null;
  const cycles: Cycle[] = [];
  if (Phi && k2 > 0 && pr.aMax > 0) {
    const k = Math.sqrt(k2);
    const NQ = 720;
    const ints = (a: number) => {
      let s = 0,
        c = 0;
      for (let i = 0; i < NQ; i++) {
        const ps = ((i + 0.5) * 2 * Math.PI) / NQ;
        const ph = PhiAt(a * Math.cos(ps), -a * k * Math.sin(ps));
        s += ph * Math.sin(ps);
        c += ph * Math.cos(ps);
      }
      return { s: (s * 2 * Math.PI) / NQ, c: (c * 2 * Math.PI) / NQ };
    };
    const daOf = (a: number) => -ints(a).s / (2 * Math.PI * k);
    const wOf = (a: number) => Math.sqrt(Math.max(0, k2 - ints(a).c / (Math.PI * a)));
    const N = 200;
    const as = Array.from({ length: N }, (_, i) => (pr.aMax * (i + 1)) / N);
    const das = as.map(daOf);
    const ws = as.map(wOf);
    if (das.every(Number.isFinite)) {
      avg = { a: as, da: das, w: ws };
      const sc = Math.max(1e-300, ...das.map(Math.abs));
      for (let i = 1; i < N; i++) {
        if (das[i - 1] === 0 || das[i - 1] * das[i] < 0) {
          let lo = as[i - 1],
            hi = as[i];
          const s0 = Math.sign(daOf(lo));
          for (let it = 0; it < 80; it++) {
            const m = (lo + hi) / 2;
            if (Math.sign(daOf(m)) === s0) lo = m;
            else hi = m;
          }
          const a = (lo + hi) / 2;
          if (Math.abs(daOf(a)) > 1e-6 * sc) continue;
          cycles.push({ a, stable: das[i - 1] > 0 && das[i] < 0, omega: wOf(a) });
        }
      }
    }
  }

  // Точный период по амплитуде (консервативная система, движение от x = a без начальной скорости).
  const periods: { a: number; T: number }[] = [];
  if (conservative && pr.aMax > 0) {
    const tGuess = Math.max(tEnd, measured ? measured.T * 3 : 0, k2 > 0 ? (6 * Math.PI) / Math.sqrt(k2) : 0);
    for (let i = 1; i <= 12; i++) {
      const a = (pr.aMax * i) / 12;
      if (F(a, 0) >= 0) continue;
      const s = rk(a, 0, tGuess * 2, 8000);
      const mx = maxima(s);
      if (mx.length) periods.push({ a, T: mx[0].t });
    }
  }

  return { ok: true, ctx, f, conservative, singular, k2, k2Sym, Phi, avg, cycles, sim, measured, portrait, periods };
}

function kindOf(fx: number, fv: number): PointKind {
  // Линеаризация: δẍ = fx·δx + fv·δẋ;  λ² − fv·λ − fx = 0.
  const tol = 1e-9 * Math.max(1, Math.abs(fx), Math.abs(fv));
  if (fx > tol) return 'saddle';
  if (Math.abs(fx) <= tol) return 'degenerate';
  if (Math.abs(fv) <= tol) return 'center';
  const D = fv * fv + 4 * fx;
  if (D < 0) return fv < 0 ? 'focus-s' : 'focus-u';
  return fv < 0 ? 'node-s' : 'node-u';
}
