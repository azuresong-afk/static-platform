/**
 * Полный расчёт вкладки «Плоский механизм»: параметр положения φ, кинематика, силы и массы, теорема об изменении
 * кинетической энергии на перемещении φ₀ → φ и график выбранной величины по φ.
 *
 * Обобщённая скорость. При заданном ведущем скорости точек v_g, а производная положения по φ (в радианах) d = ∂X/∂φ
 * находится численно; φ̇_g = v_g·d/|d|² (точка с наибольшим |d|). Работа сил на перемещении: dT/dφ = Q(φ) = N_g/φ̇_g —
 * обобщённая сила (от величины ведущей скорости не зависит); моменты сопротивления берутся против направления движения.
 * T(φ) = T(φ₀) + ∫ Q dφ (формула Симпсона), скорость ведущего: λ = √(2T/J_пр).
 */
import { forcesAt, type Forces } from './forces';
import { buildPositions, kinematics, num, type MechProblem, type MechResult, type V2 } from './mech';

export interface EnergyResult {
  phi0: number;
  phi: number;
  /** Скорость ведущего в начальном положении, приведённые моменты инерции в начальном и конечном положениях. */
  lam0: number;
  J0: number;
  J: number;
  T0: number;
  /** Работа сил (без трения) и работа моментов сопротивления. */
  A: number;
  Afric: number;
  T: number;
  /** Скорость ведущего в конечном положении (null — механизм остановится раньше). */
  lam: number | null;
  /** φ̇ на единицу скорости ведущего в начальном положении (для пояснения: 1 — φ и есть угол ведущего звена). */
  ratio: number;
}
export interface PlotResult {
  key: string;
  label: string;
  xs: number[];
  ys: (number | null)[];
  cur: { x: number; y: number | null };
  max: { x: number; y: number } | null;
  min: { x: number; y: number } | null;
  /** Наибольшее и наименьшее — по точкам графика, без уточнения. */
  approx: boolean;
}
export interface MechSolution extends MechResult {
  /** Значение параметра φ, ° (null — параметр не задан). */
  phi: number | null;
  forces: Forces | null;
  /** Ошибки сил, масс, теоремы об энергии и графика (кинематика при этом решена). */
  extraErrors: string[];
  energy: EnergyResult | null;
  plot: PlotResult | null;
}

/* Числовые поля, в которых можно писать φ. */
const NUMERIC = new Set(['x', 'y', 'L', 'ang', 'L1', 'L2', 't', 'r', 'r1', 'r2', 'w', 'e', 'v', 'a', 'vang', 'aang', 'F', 'M', 'm', 'J']);
const PHI = /φ|phi/g;
const usesPhi = (s: string) => /φ|phi/.test(s);

function mapNumeric<T>(o: T, f: (s: string) => string): T {
  if (Array.isArray(o)) return o.map((x) => mapNumeric(x, f)) as T;
  if (o && typeof o === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o)) out[k] = typeof v === 'string' && NUMERIC.has(k) ? f(v) : v && typeof v === 'object' ? mapNumeric(v, f) : v;
    return out as T;
  }
  return o;
}

/** Подстановка значения параметра φ (в градусах) во все числовые поля. */
export function withParam(pr: MechProblem, phi: number): MechProblem {
  const s = `(${phi})`;
  return {
    ...pr,
    points: mapNumeric(pr.points, (v) => v.replace(PHI, s)),
    cons: mapNumeric(pr.cons, (v) => v.replace(PHI, s)),
    drives: mapNumeric(pr.drives, (v) => v.replace(PHI, s)),
    loads: mapNumeric(pr.loads ?? [], (v) => v.replace(PHI, s)),
    masses: mapNumeric(pr.masses ?? [], (v) => v.replace(PHI, s)),
    g: (pr.g ?? '').replace(PHI, s),
  };
}

/** Величины для графика: ключ и подпись. */
export function plotKeys(pr: MechProblem): [string, string][] {
  const out: [string, string][] = [];
  const inBody = new Set(pr.bodies.flatMap((b) => b.pts));
  const lead = pr.drives[0];
  if (pr.energy && (pr.masses ?? []).length)
    out.push(['W', lead?.k === 'omega' ? `ω ведущего звена ${lead.b} по теореме об энергии` : `скорость ведущей точки по теореме об энергии`]);
  for (const b of pr.bodies) out.push([`w:${b.name}`, `ω звена ${b.name}`]);
  for (const p of pr.points.filter((q) => inBody.has(q.name)))
    out.push(
      [`x:${p.name}`, `x точки ${p.name}`],
      [`y:${p.name}`, `y точки ${p.name}`],
      [`v:${p.name}`, `|v| точки ${p.name}`],
      [`vx:${p.name}`, `vₓ точки ${p.name}`],
      [`vy:${p.name}`, `v_y точки ${p.name}`],
    );
  pr.cons.forEach((c) => {
    if (c.k === 'guide') out.push([`vr:${c.p}`, `относительная скорость камня ${c.p} вдоль ${c.g1}${c.g2}`]);
  });
  if (pr.acc !== false) {
    for (const b of pr.bodies) out.push([`e:${b.name}`, `ε звена ${b.name}`]);
    for (const p of pr.points.filter((q) => inBody.has(q.name)))
      out.push([`a:${p.name}`, `|a| точки ${p.name}`], [`ax:${p.name}`, `aₓ точки ${p.name}`], [`ay:${p.name}`, `a_y точки ${p.name}`]);
    pr.cons.forEach((c) => {
      if (c.k === 'guide') out.push([`ar:${c.p}`, `относительное ускорение камня ${c.p}`]);
    });
  }
  if ((pr.masses ?? []).length) out.push(['T', 'кинетическая энергия T (при заданном ведущем)'], ['J', 'приведённый момент инерции (масса)']);
  const loads = pr.loads ?? [];
  if (loads.some((l) => l.k !== 'hinge' && l.unknown)) out.push(['X', 'неизвестная сила (пара) из условия равновесия']);
  else if (loads.length || (pr.g && (pr.masses ?? []).length)) out.push(['M', 'приведённый момент (сила) нагрузок']);
  return out;
}

type State = { r: MechResult; f: Forces | null; fErr: string[] };
function stateAt(pr: MechProblem, phi: number | null): State {
  const p = phi == null ? pr : withParam(pr, phi);
  const r = kinematics(p);
  if (!r.ok) return { r, f: null, fErr: [] };
  const { f, errors } = forcesAt(p, r);
  return { r, f, fErr: errors };
}

/** Значение величины key в состоянии. */
function valueOf(key: string, s: State): number | null {
  const [k, n] = key.split(':');
  const r = s.r;
  if (!r.ok) return null;
  const P = () => r.points.find((p) => p.name === n);
  const B = () => r.bodies.find((b) => b.name === n);
  const G = () => r.guides.find((g) => g.p === n);
  switch (k) {
    case 'x':
      return P()?.pos[0] ?? null;
    case 'y':
      return P()?.pos[1] ?? null;
    case 'v': {
      const q = P();
      return q ? Math.hypot(...q.v) : null;
    }
    case 'vx':
      return P()?.v[0] ?? null;
    case 'vy':
      return P()?.v[1] ?? null;
    case 'a': {
      const q = P();
      return q ? Math.hypot(...q.a) : null;
    }
    case 'ax':
      return P()?.a[0] ?? null;
    case 'ay':
      return P()?.a[1] ?? null;
    case 'w':
      return B()?.omega ?? null;
    case 'e':
      return B()?.eps ?? null;
    case 'vr':
      return G()?.vr ?? null;
    case 'ar':
      return G()?.ar ?? null;
    case 'T':
      return s.f ? s.f.T : null;
    case 'J':
      return s.f?.Jred ?? null;
    case 'X':
      return s.f?.X ?? null;
    case 'M':
      return s.f ? (s.f.Pknown + s.f.Pfric) / s.f.lead.value : null;
  }
  return null;
}

/**
 * φ̇ (рад/с) при заданном значении ведущей скорости. Производная положения по φ — центральная разность или, на краях
 * промежутка (side = ±1), односторонняя второго порядка: за краем построение может перейти на другую ветвь.
 */
function phiDot(pr: MechProblem, phi: number, r: MechResult, side: -1 | 0 | 1 = 0): { ok: true; v: number } | { ok: false; error: string } {
  const h = 1e-3;
  const at = (x: number) => buildPositions(withParam(pr, x).points).pos;
  const k = 180 / Math.PI / (2 * h);
  const ps = side === 0 ? [at(phi + h), at(phi - h)] : [r.pos, at(phi + side * h), at(phi + 2 * side * h)];
  const deriv = (n: string): V2 | null => {
    if (ps.some((q) => !q[n])) return null;
    if (side === 0) return [(ps[0][n][0] - ps[1][n][0]) * k, (ps[0][n][1] - ps[1][n][1]) * k];
    const f = (i: 0 | 1) => (-3 * ps[0][n][i] + 4 * ps[1][n][i] - ps[2][n][i]) * k * side;
    return [f(0), f(1)];
  };
  let best: { d: V2; v: V2 } | null = null,
    bl = 0;
  for (const q of r.points) {
    const d = q.aux ? null : deriv(q.name);
    if (!d) continue;
    const l = Math.hypot(d[0], d[1]);
    if (l > bl) ((bl = l), (best = { d, v: q.v }));
  }
  const span = Math.max(1, ...r.points.map((q) => Math.hypot(...q.pos)));
  if (!best || bl < 1e-9 * span)
    return { ok: false, error: 'Положение механизма не зависит от φ: используйте φ в построении точек (например, угол кривошипа).' };
  const lam = (best.v[0] * best.d[0] + best.v[1] * best.d[1]) / (bl * bl);
  // Скорости должны быть пропорциональны производным положения по φ (иначе φ — не координата этого механизма).
  for (const q of r.points) {
    const d = q.aux ? null : deriv(q.name);
    if (!d) continue;
    const vm = Math.max(Math.hypot(...q.v), 1e-300);
    const scale = Math.max(...r.points.map((x) => Math.hypot(...x.v)), 1e-300);
    if (Math.hypot(q.v[0] - lam * d[0], q.v[1] - lam * d[1]) > 1e-5 * Math.max(vm, scale))
      return {
        ok: false,
        error: `Скорость точки ${q.name} не согласуется с изменением положения по φ: φ должен задавать положение механизма (обычно — угол ведущего звена).`,
      };
  }
  return { ok: true, v: lam };
}

/** Обобщённая сила Q = dT/dφ (на радиан) в положении phi; dir — направление движения (знак dφ). */
function genForce(
  pr: MechProblem,
  phi: number,
  dir: number,
  side: -1 | 0 | 1 = 0,
): { ok: true; Q: number; Qf: number; J: number; ratio: number } | { ok: false; error: string } {
  const s = stateAt(pr, phi);
  if (!s.r.ok) return { ok: false, error: `При φ = ${+phi.toFixed(4)}° механизм не определён (${s.r.errors[0] ?? ''}).` };
  if (!s.f) return { ok: false, error: s.fErr[0] ?? 'Задайте массы механизма.' };
  const pd = phiDot(pr, phi, s.r, side);
  if (!pd.ok) return pd;
  if (!(Math.abs(pd.v) > 0)) return { ok: false, error: `При φ = ${+phi.toFixed(4)}° φ̇ = 0 — мёртвое положение.` };
  return { ok: true, Q: s.f.Pknown / pd.v, Qf: (s.f.Pfric / Math.abs(pd.v)) * dir, J: s.f.Jred ?? 0, ratio: pd.v / s.f.lead.value };
}

/** Формула Симпсона для двух подынтегральных функций сразу; edge — край промежутка (направление внутрь), 0 — внутри. */
function simpson2(f: (x: number, edge: -1 | 0 | 1) => [number, number] | null, a: number, b: number, n: number): [number, number] | null {
  const h = (b - a) / n,
    sg = b > a ? 1 : -1;
  const s: [number, number] = [0, 0];
  for (let i = 0; i <= n; i++) {
    const y = f(a + i * h, i === 0 ? sg : i === n ? (-sg as -1 | 1) : 0);
    if (y == null) return null;
    const w = i === 0 || i === n ? 1 : i % 2 ? 4 : 2;
    s[0] += y[0] * w;
    s[1] += y[1] * w;
  }
  return [(s[0] * h) / 3, (s[1] * h) / 3];
}

export function solveMech(pr: MechProblem): MechSolution {
  const extraErrors: string[] = [];
  let phi: number | null = null;
  if (pr.param) {
    const v = num(pr.param.val);
    if (v == null || usesPhi(pr.param.val)) {
      const r = kinematics(pr);
      return { ...r, ok: false, errors: [`Параметр φ — не число («${pr.param.val}»).`], phi: null, forces: null, extraErrors, energy: null, plot: null };
    }
    phi = v;
  }
  const s = stateAt(pr, phi);
  if (!s.r.ok) {
    const hint = !pr.param && s.r.errors.some((e) => usesPhi(e)) ? ['Чтобы писать φ в полях, задайте параметр положения φ.'] : [];
    return { ...s.r, errors: [...s.r.errors, ...hint], phi, forces: null, extraErrors, energy: null, plot: null };
  }
  extraErrors.push(...s.fErr);
  let energy: EnergyResult | null = null;
  if (pr.energy && s.f) {
    const e = pr.energy;
    const phi0 = num(e.phi0),
      lam0 = num(e.w0);
    if (!pr.param || phi == null) extraErrors.push('Теорема об энергии: задайте параметр положения φ — от него зависит работа сил.');
    else if (phi0 == null) extraErrors.push(`Теорема об энергии: φ₀ — не число («${e.phi0}»).`);
    else if (lam0 == null) extraErrors.push(`Теорема об энергии: начальная скорость — не число («${e.w0}»).`);
    else if (s.f.unknown != null) extraErrors.push('Теорема об энергии: все силы должны быть известны (уберите отметку «неизвестная»).');
    else if (!(s.f.Jred! > 0)) extraErrors.push('Теорема об энергии: задайте массы механизма.');
    else {
      const dir = phi >= phi0 ? 1 : -1;
      const g0 = genForce(pr, phi0, dir, phi === phi0 ? 0 : (dir as 1 | -1));
      if (!g0.ok) extraErrors.push('Теорема об энергии: ' + g0.error);
      else {
        let err = '';
        // Интеграл по φ в градусах, dφ — в радианах.
        const n = 200 * Math.max(1, Math.ceil(Math.abs(phi - phi0) / 360));
        const I =
          phi === phi0
            ? ([0, 0] as [number, number])
            : simpson2(
                (x, edge) => {
                  const g = genForce(pr, x, dir, edge);
                  if (!g.ok) {
                    err = g.error;
                    return null;
                  }
                  return [g.Q, g.Qf];
                },
                phi0,
                phi,
                n,
              );
        const A = I == null ? null : (I[0] * Math.PI) / 180,
          Af = I == null ? null : (I[1] * Math.PI) / 180;
        if (err || A == null || Af == null) extraErrors.push('Теорема об энергии: ' + (err || 'не удалось вычислить работу.'));
        else {
          const T0 = (g0.J * lam0 * lam0) / 2;
          const T = T0 + A + Af;
          const J = s.f.Jred!;
          energy = { phi0, phi, lam0, J0: g0.J, J, T0, A, Afric: Af, T, lam: T >= 0 ? Math.sqrt((2 * T) / J) : null, ratio: g0.ratio };
        }
      }
    }
  }
  let plot: PlotResult | null = null;
  if (pr.param && pr.plot) {
    const lo = num(pr.param.from),
      hi = num(pr.param.to);
    const label = plotKeys(pr).find((k) => k[0] === pr.plot)?.[1];
    if (lo == null || hi == null || !(hi > lo)) extraErrors.push('График: диапазон φ задан неверно (нужно «от» < «до»).');
    else if (label) plot = makePlot(pr, pr.plot, label, lo, hi, phi!, energy, extraErrors);
  }
  return { ...s.r, phi, forces: s.f, extraErrors, energy, plot };
}

function makePlot(
  pr: MechProblem,
  key: string,
  label: string,
  lo: number,
  hi: number,
  phi: number,
  energy: EnergyResult | null,
  errs: string[],
): PlotResult | null {
  const N = 180;
  if (key === 'W') {
    if (!energy) return null;
    // ω по теореме об энергии — от φ₀ в сторону движения до границы диапазона.
    const end = energy.phi >= energy.phi0 ? Math.max(hi, energy.phi0) : Math.min(lo, energy.phi0);
    if (end === energy.phi0) return null;
    const dir = end > energy.phi0 ? 1 : -1;
    const M = 4 * N;
    const xs: number[] = [],
      ys: (number | null)[] = [];
    let T = energy.T0,
      prevQ: number | null = null,
      stopped = false;
    const rad = Math.PI / 180;
    for (let i = 0; i <= M; i++) {
      const x = energy.phi0 + ((end - energy.phi0) * i) / M;
      const g = genForce(pr, x, dir, i === 0 ? (dir as 1 | -1) : i === M ? (-dir as 1 | -1) : 0);
      if (!g.ok) {
        errs.push('График: ' + g.error);
        break;
      }
      const q = g.Q + g.Qf;
      if (prevQ != null) T += ((prevQ + q) / 2) * ((end - energy.phi0) / M) * rad;
      prevQ = q;
      if (T < 0) stopped = true;
      if (i % 4 === 0) {
        xs.push(x);
        ys.push(stopped ? null : Math.sqrt((2 * Math.max(T, 0)) / g.J));
      }
    }
    if (dir < 0) {
      xs.reverse();
      ys.reverse();
    }
    const ext = extremes(xs, ys);
    return { key, label, xs, ys, cur: { x: energy.phi, y: energy.lam }, ...ext, approx: true };
  }
  const xs: number[] = [],
    ys: (number | null)[] = [];
  const f = (x: number) => valueOf(key, stateAt(pr, x));
  for (let i = 0; i <= N; i++) {
    const x = lo + ((hi - lo) * i) / N;
    xs.push(x);
    ys.push(f(x));
  }
  const ext = extremes(xs, ys);
  const refine = (e: { x: number; y: number } | null, sgn: 1 | -1) => {
    if (!e) return e;
    const i = xs.indexOf(e.x);
    let a = xs[Math.max(0, i - 1)],
      b = xs[Math.min(N, i + 1)];
    const g = (x: number) => {
      const y = f(x);
      return y == null ? -Infinity : sgn * y;
    };
    const gr = (Math.sqrt(5) - 1) / 2;
    let c = b - gr * (b - a),
      d = a + gr * (b - a),
      gc = g(c),
      gd = g(d);
    for (let k = 0; k < 60 && b - a > 1e-10; k++) {
      if (gc > gd) {
        b = d;
        d = c;
        gd = gc;
        c = b - gr * (b - a);
        gc = g(c);
      } else {
        a = c;
        c = d;
        gc = gd;
        d = a + gr * (b - a);
        gd = g(d);
      }
    }
    const x = (a + b) / 2,
      y = f(x);
    return y != null && sgn * y >= sgn * e.y ? { x, y } : e;
  };
  return { key, label, xs, ys, cur: { x: phi, y: f(phi) }, max: refine(ext.max, 1), min: refine(ext.min, -1), approx: false };
}

function extremes(xs: number[], ys: (number | null)[]) {
  let max: { x: number; y: number } | null = null,
    min: { x: number; y: number } | null = null;
  ys.forEach((y, i) => {
    if (y == null) return;
    if (!max || y > max.y) max = { x: xs[i], y };
    if (!min || y < min.y) min = { x: xs[i], y };
  });
  return { max, min } as { max: { x: number; y: number } | null; min: { x: number; y: number } | null };
}
