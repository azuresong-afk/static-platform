/**
 * Катящийся без скольжения диск (обруч, колесо) — неголономная связь (Мещерский 55.12–55.14).
 *
 * Тело вращения: масса m, радиус обода a, моменты инерции относительно оси симметрии C и диаметра (через центр) A.
 * Подвижные оси Резаля: i — горизонтальный диаметр (по линии узлов), j — диаметр от точки касания к центру,
 * k — ось диска; θ — отклонение плоскости диска от вертикали, ψ — курс. Угловая скорость осей Ω = θ̇·i + ψ̇·ẑ,
 * ẑ = j cos θ − k sin θ; диска ω = Ω + φ̇·k: ω₁ = θ̇, ω₂ = ψ̇ cos θ, ω₃ = −ψ̇ sin θ + φ̇.
 * Связь (качение без скольжения): v_P = 0 ⇒ v_G = ω × (a·j). Уравнения Ньютона — Эйлера с исключённой реакцией
 * R = m·a_G + m·g·ẑ:  dK_G/dt = (−a·j) × R. Они дают ω̇₁, ω̇₂, ω̇₃ — это и есть уравнения движения неголономной
 * системы (уравнений Лагранжа для независимых скоростей здесь нет).
 *
 * Стационарные движения и их первое приближение (в буквах):
 *   качение по прямой, ω₃ = Ω:  (A + ma²)θ̈ + [C(C + ma²)Ω²/A − mga]θ = 0,  ψ̇ = (C/A)Ωθ;
 *   вращение вокруг вертикального диаметра, ω₂ = ω:  (A + ma²)θ̈ + [(A + ma²)ω² − mga]θ = 0,
 *   ω₃ = ma²ωθ/(C + ma²).
 * Численно: якобиан полных уравнений в стационарном движении (разностный) — корни и вывод, перебор параметра,
 * интегрирование возмущённого движения.
 */
import { add, div, evalSym, mul, normName, parseSym, sub, variable, type Sym, type SymContext } from '../../../shared/sym';
import type { LagParam } from '../../lagrange/model/lagrange';
import { solveFor, type LetCond } from './letters';
import { charPoly, classify, polyRoots, reduceBy, type Cx, type StabVerdict } from './stability';

export type RollMotion = 'line' | 'spin';
export interface RollProblem {
  params: LagParam[];
  m: string;
  a: string;
  A: string;
  C: string;
  motion: RollMotion;
  /** Угловая скорость стационарного движения: вокруг оси диска (качение) или вертикального диаметра. */
  w: string;
  cond: string;
  scan: { from: number; to: number } | null;
  /** Начальное отклонение θ₀ (рад) и время интегрирования. */
  th0: number;
  tEnd: number;
}

export interface RollSolution {
  ok: true;
  ctx: SymContext;
  m: Sym;
  a: Sym;
  A: Sym;
  C: Sym;
  w: Sym;
  /** (A + ma²)θ̈ + K·θ = 0: коэффициенты в буквах, условие K > 0. */
  Meff: Sym;
  K: Sym;
  cond: LetCond;
  /** Второе уравнение линеаризации (ψ̇ или ω₃ через θ). */
  side: Sym;
  values: { m: number; a: number; A: number; C: number; w: number; g: number };
  /** Корни линеаризованных полных уравнений (по θ, ω₁, ω₂, ω₃) и вывод. */
  roots: Cx[];
  verdict: StabVerdict;
  /** Частота колебаний наклона (по линеаризации). */
  freq: number | null;
  sim: { t: number[]; th: number[]; psi: number[]; w3: number[] } | null;
  scan: { param: string; from: number; to: number; stable: [number, number][]; bounds: number[] } | null;
}
export type RollResult = RollSolution | { ok: false; field: string; error: string };

type St = [number, number, number, number, number]; // θ, ψ, ω₁, ω₂, ω₃

/** Правая часть полных уравнений качения. */
export function rollRhs(s: St, p: { m: number; a: number; A: number; C: number; g: number }): St {
  const [th, , w1, w2, w3] = s;
  const { m, a, A, C, g } = p;
  const O: [number, number, number] = [w1, w2, -w2 * Math.tan(th)];
  const H: [number, number, number] = [A * w1, A * w2, C * w3];
  const v: [number, number, number] = [-a * w3, 0, a * w1];
  const cr = (x: number[], y: number[]) => [x[1] * y[2] - x[2] * y[1], x[2] * y[0] - x[0] * y[2], x[0] * y[1] - x[1] * y[0]];
  const OH = cr(O, H),
    Ov = cr(O, v);
  const z = [0, Math.cos(th), -Math.sin(th)];
  const u1 = -(OH[0] + a * m * (Ov[2] + g * z[2])) / (A + m * a * a);
  const u2 = -OH[1] / A;
  const u3 = (-OH[2] + a * m * Ov[0]) / (C + m * a * a);
  return [w1, w2 / Math.cos(th), u1, u2, u3];
}

const steadyOf = (motion: RollMotion, w: number): St => (motion === 'line' ? [0, 0, 0, 0, w] : [0, 0, 0, w, 0]);

function jacobianVerdict(motion: RollMotion, p: { m: number; a: number; A: number; C: number; g: number }, w: number) {
  const s0 = steadyOf(motion, w);
  const idx = [0, 2, 3, 4]; // ψ не входит в правые части
  const J = idx.map(() => idx.map(() => 0));
  idx.forEach((jv, j) => {
    const h = 1e-6 * Math.max(1, Math.abs(s0[jv]));
    const sp = s0.slice() as St,
      sm = s0.slice() as St;
    sp[jv] += h;
    sm[jv] -= h;
    const fp = rollRhs(sp, p),
      fm = rollRhs(sm, p);
    idx.forEach((iv, i) => (J[i][j] = (fp[iv] - fm[iv]) / (2 * h)));
  });
  // Численный шум у нулевых элементов — в нуль.
  const sc = Math.max(1e-300, ...J.flat().map(Math.abs));
  const Jc = J.map((r) => r.map((x) => (Math.abs(x) < 1e-7 * sc ? 0 : x)));
  const roots = polyRoots(charPoly(Jc));
  return { roots, ...classify(roots, Jc) };
}

export function solveRoll(pr: RollProblem): RollResult {
  const params = pr.params.map((p) => ({ ...p, name: normName(p.name.trim()) }));
  const names = params.map((p) => p.name);
  for (const n of names) if (!/^[\p{L}][\p{L}\p{N}_]*$/u.test(n)) return { ok: false, field: 'names', error: `Имя «${n}» — буква, затем буквы или цифры.` };
  const dup = names.find((n, i) => names.indexOf(n) !== i);
  if (dup) return { ok: false, field: 'names', error: `Обозначение «${dup}» встречается дважды.` };
  if (!names.includes('g')) return { ok: false, field: 'names', error: 'Нужен параметр g — ускорение свободного падения.' };
  const ctx: SymContext = { coords: [], params: names };
  const parse = (src: string, field: string): Sym | { ok: false; field: string; error: string } => {
    const r = parseSym(src, ctx);
    if (!r.ok) return { ok: false, field, error: r.error };
    if (!r.s.length) return { ok: false, field, error: 'Задайте формулу.' };
    return r.s;
  };
  const m = parse(pr.m, 'm');
  if (!Array.isArray(m)) return m;
  const a = parse(pr.a, 'a');
  if (!Array.isArray(a)) return a;
  const A = parse(pr.A, 'A');
  if (!Array.isArray(A)) return A;
  const C = parse(pr.C, 'C');
  if (!Array.isArray(C)) return C;
  const w = parse(pr.w, 'w');
  if (!Array.isArray(w)) return w;
  const cnd = normName(pr.cond.trim());
  if (cnd && !names.includes(cnd)) return { ok: false, field: 'cond', error: `Параметр «${cnd}» — добавьте его в параметры.` };
  const pv = new Map(params.map((p) => [p.name, p.value]));
  const ev = (s: Sym, mp = pv) => evalSym(s, (n) => mp.get(n) ?? NaN);
  const vals = (mp = pv) => ({ m: ev(m, mp), a: ev(a, mp), A: ev(A, mp), C: ev(C, mp), w: ev(w, mp), g: mp.get('g') ?? NaN });
  const values = vals();
  if (!Object.values(values).every(Number.isFinite)) return { ok: false, field: 'params', error: 'Величины не вычисляются — проверьте значения параметров.' };
  if (!(values.m > 0 && values.a > 0 && values.A > 0 && values.C > 0))
    return { ok: false, field: 'params', error: 'Масса, радиус и моменты инерции должны быть положительны.' };

  const g = variable('g');
  const ma2 = mul(m, a, a);
  const Meff = add(A, ma2);
  const mga = mul(m, g, a);
  let K: Sym, Dc: Sym, side: Sym;
  if (pr.motion === 'line') {
    // A·K = C(C + ma²)Ω² − mgaA — условие без деления на A > 0.
    Dc = sub(mul(C, add(C, ma2), w, w), mul(mga, A));
    K = sub(div(mul(C, add(C, ma2), w, w), A), mga);
    side = div(mul(C, w), A);
  } else {
    Dc = sub(mul(Meff, w, w), mga);
    K = Dc;
    side = div(mul(ma2, w), add(C, ma2));
  }
  const red = reduceBy(Dc, pv);
  const cond: LetCond = { label: 'K', D: Dc, factor: red.factor, rest: red.rest, value: ev(Dc), solved: cnd ? solveFor(red.rest, cnd, pv) : null };

  const { roots, verdict } = jacobianVerdict(pr.motion, values, values.w);
  const kv = ev(K) / ev(Meff);
  const freq = kv > 0 ? Math.sqrt(kv) : null;

  // Возмущённое движение: θ(0) = θ₀.
  let sim: RollSolution['sim'] = null;
  if (pr.tEnd > 0) {
    const N = 4000,
      h = pr.tEnd / N;
    let s = steadyOf(pr.motion, values.w);
    s = [pr.th0, 0, s[2], s[3], s[4]];
    const t: number[] = [0],
      th: number[] = [s[0]],
      psi: number[] = [s[1]],
      w3: number[] = [s[4]];
    const f = (x: St) => rollRhs(x, values);
    const axpy = (x: St, k: St, c: number) => x.map((v, i) => v + c * k[i]) as St;
    for (let i = 1; i <= N; i++) {
      const k1 = f(s),
        k2 = f(axpy(s, k1, h / 2)),
        k3 = f(axpy(s, k2, h / 2)),
        k4 = f(axpy(s, k3, h));
      s = s.map((v, j) => v + (h / 6) * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j])) as St;
      if (!s.every(Number.isFinite) || Math.abs(s[0]) > 1.5) break;
      if (i % 8 === 0) {
        t.push(i * h);
        th.push(s[0]);
        psi.push(s[1]);
        w3.push(s[4]);
      }
    }
    sim = { t, th, psi, w3 };
  }

  let scan: RollSolution['scan'] = null;
  if (cnd && pr.scan && pr.scan.to > pr.scan.from) {
    const stableAt = (x: number) => {
      const mp = new Map(pv);
      mp.set(cnd, x);
      const v = vals(mp);
      if (!Object.values(v).every(Number.isFinite) || !(v.A > 0 && v.C > 0 && v.m > 0 && v.a > 0)) return false;
      const r = jacobianVerdict(pr.motion, v, v.w);
      return r.verdict === 'linear' || r.verdict === 'asym';
    };
    const Nn = 200,
      { from, to } = pr.scan;
    const xs = Array.from({ length: Nn + 1 }, (_, i) => from + ((to - from) * i) / Nn);
    const st = xs.map(stableAt);
    const bounds: number[] = [];
    const stable: [number, number][] = [];
    let start: number | null = st[0] ? from : null;
    for (let i = 1; i <= Nn; i++) {
      if (st[i] === st[i - 1]) continue;
      let lo = xs[i - 1],
        hi = xs[i];
      for (let k = 0; k < 50; k++) {
        const mid = (lo + hi) / 2;
        if (stableAt(mid) === st[i - 1]) lo = mid;
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
    scan = { param: cnd, from, to, stable, bounds };
  }
  return { ok: true, ctx, m, a, A, C, w, Meff, K, cond, side, values, roots, verdict, freq, sim, scan };
}
