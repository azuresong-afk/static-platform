/**
 * Полный расчёт вкладки «Плоский механизм»: параметр положения φ, кинематика, силы и массы, теорема об изменении
 * кинетической энергии на перемещении φ₀ → φ и график выбранной величины по φ.
 *
 * Обобщённая скорость. При заданном ведущем скорости точек v_g, а производная положения по φ (в радианах) d = ∂X/∂φ
 * находится численно; φ̇_g = v_g·d/|d|² (точка с наибольшим |d|). Работа сил на перемещении: dT/dφ = Q(φ) = N_g/φ̇_g —
 * обобщённая сила (от величины ведущей скорости не зависит); моменты сопротивления берутся против направления движения.
 * T(φ) = T(φ₀) + ∫ Q dφ (формула Симпсона), скорость ведущего: λ = √(2T/J_пр).
 *
 * Законы движения по времени (вместо φ): каждый закон — формула от t; в момент t его значение и производные (символьно)
 * подставляются в числовые поля: «φ» — значение (угол — в градусах), «φ'» и «φ''» — производные (угол — в рад/с и рад/с²),
 * «t» — сам момент. Скорости и ускорения точек сверяются с производными их положений по времени (численно): если
 * ведущие условия не согласуются с законами, это сообщается.
 */
import { diff, evalExpr, parseExpr, printExpr, simplify, type Expr } from '../../../shared/expr';
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
  /** Ось графика: параметр φ (°) или время t (с). */
  axis: 'phi' | 't';
}
/** Закон движения в момент t: формулы производных и значения (угол — в радианах). */
export interface LawState {
  name: string;
  kind: 'angle' | 'length';
  f: Expr;
  d1: Expr;
  d2: Expr;
  v: number;
  v1: number;
  v2: number;
}
export interface MechSolution extends MechResult {
  /** Значение параметра φ, ° (null — параметр не задан). */
  phi: number | null;
  forces: Forces | null;
  /** Ошибки сил, масс, теоремы об энергии и графика (кинематика при этом решена). */
  extraErrors: string[];
  energy: EnergyResult | null;
  plot: PlotResult | null;
  /** Законы движения в момент t (null — режим времени не включён). */
  time: { t: number; laws: LawState[] } | null;
  /** Уравнения плоского движения звеньев по времени: x и y полюса (первая точка звена) и угол φ направления «полюс → последняя точка». */
  motion?: MotionTable[];
}
export interface MotionTable {
  body: string;
  pole: string;
  end: string;
  rows: { t: number; x: number; y: number; phi: number }[];
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

/* ---------- законы движения по времени ---------- */

const FN_WORDS = [
  'sin',
  'cos',
  'tg',
  'tan',
  'ctg',
  'cot',
  'arctg',
  'atan',
  'arcsin',
  'asin',
  'arccos',
  'acos',
  'exp',
  'ln',
  'sqrt',
  'abs',
  'sh',
  'sinh',
  'ch',
  'cosh',
  'th',
  'tanh',
  'pi',
];
const LAW_NAME = /^[A-Za-zА-Яа-яΑ-Ωα-ω][A-Za-z0-9А-Яа-яΑ-Ωα-ω]*$/u;
// Имя не должно быть частью слова; π перед именем — множитель («πt» = π·t).
const BEFORE = '(?<![A-Za-zА-Яа-яΑ-Ωα-ορ-ω_])';
const AFTER = "(?![A-Za-zА-Яа-яΑ-Ωα-ω0-9_'′″])";
const escRe = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Законы движения в момент t: разбор, производные, значения; ошибки — понятным текстом. */
export function lawStates(pr: MechProblem, t: number): { laws: LawState[]; errors: string[] } {
  const errors: string[] = [];
  const laws: LawState[] = [];
  const seen = new Set<string>();
  for (const l of pr.time?.laws ?? []) {
    const n = l.name.trim();
    if (!LAW_NAME.test(n)) errors.push(`Закон «${l.name}»: имя — буква, затем буквы и цифры (φ, ψ, xC, s1).`);
    else if (n === 't' || n === 'e' || n === 'π' || FN_WORDS.includes(n.toLowerCase())) errors.push(`Закон «${n}»: это имя занято (t, e, π, имена функций).`);
    else if (seen.has(n)) errors.push(`Закон «${n}» задан дважды.`);
    seen.add(n);
    const p = parseExpr(l.f);
    if (!p.ok) {
      errors.push(`Закон ${n}(t): ${p.error}.`);
      continue;
    }
    const d1 = diff(p.e),
      d2 = diff(d1);
    const v = evalExpr(p.e, t),
      v1 = evalExpr(d1, t),
      v2 = evalExpr(d2, t);
    if (![v, v1, v2].every(Number.isFinite)) errors.push(`Закон ${n}(t): при t = ${t} не определён (деление на нуль, корень из отрицательного числа…).`);
    laws.push({ name: n, kind: l.kind, f: p.e, d1, d2, v, v1, v2 });
  }
  return { laws, errors };
}

/** Подстановка законов (имя, имя', имя'') и момента t в строку числового поля. */
export function substTime(s: string, laws: LawState[], t: number): string {
  let out = s;
  for (const l of [...laws].sort((a, c) => c.name.length - a.name.length))
    out = out.replace(new RegExp(`${BEFORE}${escRe(l.name)}(''|″|′′|'|′)?${AFTER}`, 'gu'), (_m, pr?: string) => {
      const ord = !pr ? 0 : pr === "'" || pr === '′' ? 1 : 2;
      const val = ord === 0 ? (l.kind === 'angle' ? (l.v * 180) / Math.PI : l.v) : ord === 1 ? l.v1 : l.v2;
      return `(${val})`;
    });
  return out.replace(new RegExp(`${BEFORE}t${AFTER}`, 'gu'), `(${t})`);
}

/** Задача с подставленными законами в момент t. */
export function withTime(pr: MechProblem, t: number, laws: LawState[]): MechProblem {
  const f = (v: string) => substTime(v, laws, t);
  return {
    ...pr,
    points: mapNumeric(pr.points, f),
    cons: mapNumeric(pr.cons, f),
    drives: mapNumeric(pr.drives, f),
    loads: mapNumeric(pr.loads ?? [], f),
    masses: mapNumeric(pr.masses ?? [], f),
    g: f(pr.g ?? ''),
  };
}

/** Запись производной закона для текста. */
export const lawText = (e: Expr) => printExpr(simplify(e));

/** Задача в момент t (null — законы не заданы верно). */
function atTime(pr: MechProblem, t: number): MechProblem | null {
  const l = lawStates(pr, t);
  return l.errors.length ? null : withTime(pr, t, l.laws);
}

/**
 * Сверка скоростей и ускорений с законами: численные производные положений точек по времени. Если положение
 * от t не зависит (механизм в одном положении, а t — только в ведущих), сверять не с чем.
 */
function timeConsistency(pr: MechProblem, t: number, r: MechResult): string[] {
  const h = 1e-3;
  const pa = atTime(pr, t + h),
    pb = atTime(pr, t - h);
  if (!pa || !pb) return [];
  const A = buildPositions(pa.points).pos,
    Bp = buildPositions(pb.points).pos;
  const pts = r.points.filter((q) => !q.aux && A[q.name] && Bp[q.name]);
  const span = Math.max(1, ...r.points.map((q) => Math.hypot(...q.pos)));
  if (pts.every((q) => Math.hypot(A[q.name][0] - Bp[q.name][0], A[q.name][1] - Bp[q.name][1]) < 1e-12 * span)) return [];
  const out: string[] = [];
  const vScale = Math.max(
    1e-9,
    ...pts.map((q) => Math.hypot(...q.v)),
    ...pts.map((q) => Math.hypot(A[q.name][0] - Bp[q.name][0], A[q.name][1] - Bp[q.name][1]) / (2 * h)),
  );
  for (const q of pts) {
    const vn: V2 = [(A[q.name][0] - Bp[q.name][0]) / (2 * h), (A[q.name][1] - Bp[q.name][1]) / (2 * h)];
    if (Math.hypot(vn[0] - q.v[0], vn[1] - q.v[1]) > 1e-4 * vScale) {
      out.push(
        `Скорость точки ${q.name} не согласуется с законами движения: по производной положения v = (${+vn[0].toFixed(4)}; ${+vn[1].toFixed(4)}), по ведущим условиям — (${+q.v[0].toFixed(4)}; ${+q.v[1].toFixed(4)}). Проверьте ведущие: например, ω = φ', ε = φ''.`,
      );
      return out;
    }
  }
  if (pr.acc === false) return out;
  const aOf = (q: (typeof pts)[number]): V2 => [
    (A[q.name][0] - 2 * q.pos[0] + Bp[q.name][0]) / (h * h),
    (A[q.name][1] - 2 * q.pos[1] + Bp[q.name][1]) / (h * h),
  ];
  const aScale = Math.max(1e-9, ...pts.map((q) => Math.hypot(...q.a)), ...pts.map((q) => Math.hypot(...aOf(q))));
  for (const q of pts) {
    const an = aOf(q);
    if (Math.hypot(an[0] - q.a[0], an[1] - q.a[1]) > 1e-3 * aScale) {
      out.push(
        `Ускорение точки ${q.name} не согласуется с законами движения: по второй производной положения a = (${+an[0].toFixed(3)}; ${+an[1].toFixed(3)}), по ведущим условиям — (${+q.a[0].toFixed(3)}; ${+q.a[1].toFixed(3)}). Проверьте ускорения в ведущих: например, ε = φ''.`,
      );
      return out;
    }
  }
  return out;
}

/** Угол направления «первая точка → последняя точка» звена, рад (от оси x против часовой, (−π; π]). */
function bodyAngle(r: MechResult, pts: string[]): number | null {
  const a = r.points.find((p) => p.name === pts[0]),
    b = r.points.find((p) => p.name === pts[pts.length - 1]);
  if (!a || !b || pts.length < 2) return null;
  return Math.atan2(b.pos[1] - a.pos[1], b.pos[0] - a.pos[0]);
}

/** Развёртка угла: убирает скачки на ±2π между соседними значениями. */
function unwrap(vals: (number | null)[]): (number | null)[] {
  let off = 0,
    prev: number | null = null;
  return vals.map((v) => {
    if (v == null) return null;
    if (prev != null) {
      const d = v + off - prev;
      if (d > Math.PI) off -= 2 * Math.PI * Math.round(d / (2 * Math.PI));
      else if (d < -Math.PI) off -= 2 * Math.PI * Math.round(d / (2 * Math.PI));
    }
    prev = v + off;
    return prev;
  });
}

/** Значение угла cur, сдвинутое на 2πk к ближайшей точке развёрнутого графика. */
function onBranch(cur: number | null, xs: number[], ys: (number | null)[], x: number): number | null {
  if (cur == null) return null;
  let j = 0;
  for (let i = 1; i < xs.length; i++) if (Math.abs(xs[i] - x) < Math.abs(xs[j] - x)) j = i;
  const y = ys[j];
  return y == null ? cur : cur + 2 * Math.PI * Math.round((y - cur) / (2 * Math.PI));
}

/** Величины для графика: ключ и подпись. */
export function plotKeys(pr: MechProblem): [string, string][] {
  const out: [string, string][] = [];
  const inBody = new Set(pr.bodies.flatMap((b) => b.pts));
  const lead = pr.drives[0];
  if (pr.energy && !pr.time && (pr.masses ?? []).length)
    out.push(['W', lead?.k === 'omega' ? `ω ведущего звена ${lead.b} по теореме об энергии` : `скорость ведущей точки по теореме об энергии`]);
  for (const b of pr.bodies) out.push([`w:${b.name}`, `ω звена ${b.name}`]);
  for (const b of pr.bodies) if (b.pts.length >= 2) out.push([`ang:${b.name}`, `угол φ звена ${b.name} (направление ${b.pts[0]}→${b.pts[b.pts.length - 1]}, рад)`]);
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
function valueOf(key: string, s: State, pr?: MechProblem): number | null {
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
    case 'ang': {
      const b = pr?.bodies.find((q) => q.name === n);
      return b ? bodyAngle(r, b.pts) : null;
    }
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
  if (pr.time) return solveTimed(pr, pr.time);
  const extraErrors: string[] = [];
  let phi: number | null = null;
  if (pr.param) {
    const v = num(pr.param.val);
    if (v == null || usesPhi(pr.param.val)) {
      const r = kinematics(pr);
      return {
        ...r,
        ok: false,
        errors: [`Параметр φ — не число («${pr.param.val}»).`],
        phi: null,
        forces: null,
        extraErrors,
        energy: null,
        plot: null,
        time: null,
      };
    }
    phi = v;
  }
  const s = stateAt(pr, phi);
  if (!s.r.ok) {
    const hint = !pr.param && s.r.errors.some((e) => usesPhi(e)) ? ['Чтобы писать φ в полях, задайте параметр положения φ.'] : [];
    return { ...s.r, errors: [...s.r.errors, ...hint], phi, forces: null, extraErrors, energy: null, plot: null, time: null };
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
  return { ...s.r, phi, forces: s.f, extraErrors, energy, plot, time: null };
}

/** Расчёт в момент t по законам движения; график — по времени. */
function solveTimed(pr: MechProblem, tm: NonNullable<MechProblem['time']>): MechSolution {
  const extraErrors: string[] = [];
  const t = num(tm.t);
  const fail = (errors: string[]): MechSolution => ({
    ...kinematics({ ...pr, time: null }),
    ok: false,
    errors,
    phi: null,
    forces: null,
    extraErrors,
    energy: null,
    plot: null,
    time: null,
  });
  if (t == null || /(^|[^A-Za-zА-Яа-яΑ-Ωα-ω])t($|[^A-Za-zА-Яа-яΑ-Ωα-ω])/u.test(tm.t)) return fail([`Момент времени t — не число («${tm.t}»).`]);
  if (!tm.laws.length) return fail(['Задайте хотя бы один закон движения (например, φ = πt/6).']);
  const ls = lawStates(pr, t);
  if (ls.errors.length) return fail(ls.errors);
  const p = withTime(pr, t, ls.laws);
  const s = stateAt(p, null);
  const time = { t, laws: ls.laws };
  if (!s.r.ok) return { ...s.r, phi: null, forces: null, extraErrors, energy: null, plot: null, time };
  extraErrors.push(...s.fErr, ...timeConsistency(pr, t, s.r));
  if (pr.energy) extraErrors.push('Теорема об энергии считается по параметру положения φ — в режиме законов движения она не используется.');
  let plot: PlotResult | null = null;
  if (pr.plot) {
    const lo = num(tm.from),
      hi = num(tm.to);
    const label = plotKeys(pr).find((k) => k[0] === pr.plot)?.[1];
    if (lo == null || hi == null || !(hi > lo)) extraErrors.push('График: диапазон t задан неверно (нужно «от» < «до»).');
    else if (label) {
      const N = 180;
      const f = (x: number) => {
        const q = atTime(pr, x);
        return q ? valueOf(pr.plot!, stateAt(q, null), q) : null;
      };
      const xs: number[] = [];
      let ys: (number | null)[] = [];
      for (let i = 0; i <= N; i++) {
        const x = lo + ((hi - lo) * i) / N;
        xs.push(x);
        ys.push(f(x));
      }
      let cur = f(t);
      if (pr.plot.startsWith('ang:')) {
        ys = unwrap(ys);
        cur = onBranch(cur, xs, ys, t);
      }
      const ext = extremes(xs, ys);
      plot = { key: pr.plot, label, xs, ys, cur: { x: t, y: cur }, ...ext, approx: true, axis: 't' };
    }
  }
  const m0 = num(tm.from),
    m1 = num(tm.to);
  const motion = motionTables(pr, m0 != null && m1 != null && m1 > m0 ? [m0, m1] : [0, Math.max(t, 1)]);
  return { ...s.r, phi: null, forces: s.f, extraErrors, energy: null, plot, time, motion };
}

/** Уравнения плоского движения звеньев: x, y полюса и угол φ в семи равноотстоящих моментах времени. */
function motionTables(pr: MechProblem, [lo, hi]: [number, number], n = 7): MotionTable[] {
  const inBody = pr.bodies.filter((b) => b.pts.length >= 2);
  if (!inBody.length) return [];
  const states = Array.from({ length: n }, (_, i) => {
    const t = lo + ((hi - lo) * i) / (n - 1);
    const q = atTime(pr, t);
    return { t, r: q ? stateAt(q, null).r : null };
  });
  return inBody.map((b) => {
    const pole = b.pts[0],
      end = b.pts[b.pts.length - 1];
    const raw = states.map((q) => (q.r && q.r.ok ? bodyAngle(q.r, b.pts) : null));
    const ang = unwrap(raw);
    const rows = states.flatMap((q, i) => {
      const P = q.r && q.r.ok ? q.r.points.find((p) => p.name === pole) : null;
      return P && ang[i] != null ? [{ t: q.t, x: P.pos[0], y: P.pos[1], phi: ang[i]! }] : [];
    });
    return { body: b.name, pole, end, rows };
  });
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
    return { key, label, xs, ys, cur: { x: energy.phi, y: energy.lam }, ...ext, approx: true, axis: 'phi' };
  }
  const xs: number[] = [];
  let ys: (number | null)[] = [];
  const f = (x: number) => valueOf(key, stateAt(pr, x), pr);
  for (let i = 0; i <= N; i++) {
    const x = lo + ((hi - lo) * i) / N;
    xs.push(x);
    ys.push(f(x));
  }
  if (key.startsWith('ang:')) ys = unwrap(ys);
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
  const cur = key.startsWith('ang:') ? onBranch(f(phi), xs, ys, phi) : f(phi);
  return { key, label, xs, ys, cur: { x: phi, y: cur }, max: refine(ext.max, 1), min: refine(ext.min, -1), approx: false, axis: 'phi' };
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
