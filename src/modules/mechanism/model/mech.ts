/**
 * Плоский механизм в заданном положении (Мещерский §16, 18, 22, 23, 38, 46).
 *
 * Точки задаются построениями (координаты, от точки по длине и углу, пересечение двух окружностей, точка на прямой
 * на заданном расстоянии, точка на отрезке — доля его длины, пересечение двух прямых). Звенья — жёсткие тела из точек. Связи: неподвижный шарнир, ползун на прямой направляющей,
 * качение колеса без скольжения по неподвижной прямой, зацепление (качение) двух колёс, кулисный камень (точка скользит
 * вдоль прямой, жёстко связанной с другим звеном), поступательное движение звена. Ведущие: угловая скорость
 * и ускорение звена, проекция скорости и ускорения точки на направление, вектор скорости и ускорения точки.
 *
 * Скорости. Для звена с точками A (полюс) и B: v_B = v_A + ω × AB. Связи и ведущие дают остальные уравнения; система
 * линейная относительно скоростей точек и угловых скоростей звеньев.
 * Ускорения. a_B = a_A + ε × AB − ω²·AB — та же матрица, правая часть из найденных скоростей.
 * Качение по прямой (колесо слева от направления t, n — нормаль к центру): v_C·n = 0, v_C·t + ωr = 0;
 * a_C·n = 0, a_C·t + εr = 0.
 * Зацепление колёс (e — орт C₁→C₂, τ — e, повёрнутый на 90°, d₁ = (P − C₁)·e, d₂ = (P − C₂)·e, P — точка касания):
 * (v₁ − v₂)·e = 0, (v₁ − v₂)·τ + ω₁d₁ − ω₂d₂ = 0;
 * (a₁ − a₂)·e = |v₁ − v₂|²/L, (a₁ − a₂)·τ + ε₁d₁ − ε₂d₂ = −((v₁ − v₂)·τ)((v₁ − v₂)·e)/L.
 * Кулисный камень: точка A скользит вдоль прямой G₁G₂ звена b (u — орт G₁→G₂, n — u, повёрнутый на 90°, r = A − G₁).
 * Относительная скорость v_r = v_A − v_e направлена вдоль u, v_e = v_G₁ + ω_b × r: (v_A − v_G₁)·n − ω_b(r·u) = 0.
 * Ускорения (теорема Кориолиса a_A = a_e + a_r + a_c, a_c = 2ω_b × v_r): (a_A − a_G₁)·n − ε_b(r·u) = 2ω_b v_r − ω_b²(r·n).
 * Положительные ω, ε — против часовой стрелки. Точки, не входящие ни в одно звено, — вспомогательные (для построения),
 * неподвижные; вспомогательная точка может быть неподвижной осью качающейся кулисы (кулисный камень).
 *
 * Силы и массы (механизм с одной степенью свободы). Возможные скорости точек пропорциональны действительным, поэтому
 * условие равновесия (принцип возможных перемещений) — сумма мощностей сил на найденных скоростях равна нулю:
 * Σ F·v + Σ M·ω = 0. Кинетическая энергия T = Σ (m v_C²/2 + J_C ω²/2) = J_пр ω²/2 (J_пр — момент инерции, приведённый
 * к ведущему звену). Параметр положения φ (градусы) можно использовать в любом числовом поле; по нему строится график
 * и интегрируется работа сил в теореме об изменении кинетической энергии: J_пр(φ)ω²/2 − J_пр(φ₀)ω₀²/2 = ∫ M_пр dφ.
 */
import { evalExpr, parseExpr } from '../../../shared/expr';

export type PtDef =
  | { k: 'xy'; x: string; y: string }
  /** От точки from на длину L под углом ang к оси x или (to задана) к направлению from→to. */
  | { k: 'polar'; from: string; L: string; ang: string; to?: string }
  | { k: 'two'; p1: string; L1: string; p2: string; L2: string; side: 1 | -1 }
  | { k: 'line'; from: string; L: string; through: string; ang: string; side: 1 | -1 }
  | { k: 'seg'; p1: string; p2: string; t: string }
  /** Пересечение двух прямых: каждая — через точку и вторую точку (q) или через точку под углом (q = ''). */
  | { k: 'cross'; p1: string; q1: string; a1: string; p2: string; q2: string; a2: string };

export interface MPoint {
  name: string;
  def: PtDef;
}
export interface MBody {
  name: string;
  pts: string[];
}
export type MCons =
  | { k: 'fixed'; p: string }
  | { k: 'slider'; p: string; ang: string }
  | { k: 'roll'; b: string; c: string; r: string; ang: string }
  | { k: 'gear'; b1: string; c1: string; r1: string; b2: string; c2: string; r2: string; int: boolean }
  | { k: 'guide'; p: string; b: string; g1: string; g2: string }
  | { k: 'trans'; b: string };
export type MDrive =
  | { k: 'omega'; b: string; w: string; e: string }
  | { k: 'proj'; p: string; ang: string; v: string; a: string }
  | { k: 'vec'; p: string; v: string; vang: string; a: string; aang: string };

/**
 * Нагрузки: сила в точке (угол — от оси x или от направления отрезка ref→ref2, против часовой стрелки), пара сил на звене
 * (+ против часовой стрелки), момент сопротивления в шарнире между звеньями b1 и b2 (b2 = '' — неподвижная опора).
 * Одна сила или пара может быть неизвестной (unknown) — её находят из условия равновесия.
 */
export type MLoad =
  | { k: 'force'; p: string; F: string; ang: string; ref: string; ref2: string; unknown: boolean }
  | { k: 'couple'; b: string; M: string; unknown: boolean }
  | { k: 'hinge'; b1: string; b2: string; M: string };
/** Массы: точечная (ползун, камень), однородный стержень между двумя точками звена, тело с центром масс c и моментом инерции. */
export type MMass =
  | { k: 'point'; p: string; m: string }
  | { k: 'rod'; p1: string; p2: string; m: string }
  | { k: 'body'; b: string; c: string; m: string; shape: 'disk' | 'ring' | 'J'; r: string; J: string };

export interface MechProblem {
  points: MPoint[];
  bodies: MBody[];
  cons: MCons[];
  drives: MDrive[];
  /** Считать ускорения (для задач статики не нужны). По умолчанию — да. */
  acc?: boolean;
  loads?: MLoad[];
  masses?: MMass[];
  /** Ускорение свободного падения для веса масс (ось y вверх); '' или 0 — механизм в горизонтальной плоскости. */
  g?: string;
  /** Параметр положения φ, °: значение и диапазон графика. */
  param?: { val: string; from: string; to: string } | null;
  /** Теорема об изменении кинетической энергии: начальное положение φ₀ и скорость ведущего в нём. */
  energy?: { phi0: string; w0: string } | null;
  /** Величина на графике по φ (ключ из plotKeys). */
  plot?: string;
}

export type V2 = [number, number];
export interface BodyState {
  name: string;
  omega: number;
  eps: number;
  /** Мгновенный центр скоростей (null — поступательное движение). */
  icr: V2 | null;
  /** Мгновенный центр ускорений (null — ε = ω = 0). */
  ica: V2 | null;
}
export interface PointState {
  name: string;
  /** Вспомогательная точка построения — не входит ни в одно звено (считается неподвижной). */
  aux: boolean;
  pos: V2;
  v: V2;
  a: V2;
}
/** Кулисный камень: относительное, переносное и абсолютное движение точки. */
export interface GuideState {
  p: string;
  b: string;
  g1: string;
  g2: string;
  /** Орт прямой G₁→G₂. */
  u: V2;
  /** Относительная скорость вдоль u (со знаком) и относительное ускорение вдоль u. */
  vr: number;
  ar: number;
  /** Переносные скорость и ускорение (точки звена b, совпадающей с камнем), кориолисово ускорение. */
  ve: V2;
  ae: V2;
  ac: V2;
}
export interface MechResult {
  ok: boolean;
  errors: string[];
  /** Кулисные камни. */
  guides: GuideState[];
  /** Координаты точек (если положение построено). */
  pos: Record<string, V2>;
  points: PointState[];
  bodies: BodyState[];
  /** Порядок звеньев для изложения: от ведущих по цепочке. */
  order: string[];
  /** Для каждого звена — полюс (точка с уже найденным движением) при изложении. */
  pole: Record<string, string>;
  /** Связи-колёса для чертежа: центр и радиус. */
  wheels: { b: string; c: string; r: number }[];
  /** Число степеней свободы (по рангу системы скоростей при отключённых ведущих). */
  dof: number | null;
}

const rad = (deg: number) => (deg * Math.PI) / 180;
const perp = (r: V2): V2 => [-r[1], r[0]];
const dot = (a: V2, b: V2) => a[0] * b[0] + a[1] * b[1];
const sub2 = (a: V2, b: V2): V2 => [a[0] - b[0], a[1] - b[1]];
const len = (a: V2) => Math.hypot(a[0], a[1]);
const clean = (v: number, s = 1) => (Math.abs(v) < 1e-10 * Math.max(1, s) ? 0 : v);

/** Значение числового поля: формула без t (π, sqrt, sin…; углы в градусах — отдельно). */
export function num(s: string): number | null {
  const p = parseExpr(s);
  if (!p.ok) return null;
  const v = evalExpr(p.e, 0);
  return Number.isFinite(v) ? v : null;
}

/** Координаты точек по построениям (по порядку; ссылаться можно только на точки выше). */
export function buildPositions(points: MPoint[]): { pos: Record<string, V2>; errors: string[] } {
  const pos: Record<string, V2> = {};
  const errors: string[] = [];
  const names = new Set<string>();
  for (const p of points) {
    const where = `Точка ${p.name || '(без имени)'}`;
    if (!p.name.trim()) {
      errors.push('У каждой точки должно быть имя.');
      continue;
    }
    if (names.has(p.name)) errors.push(`Имя точки ${p.name} повторяется.`);
    names.add(p.name);
    const d = p.def;
    const N = (s: string, what: string) => {
      const v = num(s);
      if (v == null) errors.push(`${where}: ${what} — не число («${s}»).`);
      return v;
    };
    const P = (n: string) => {
      const v = pos[n];
      if (!v) errors.push(`${where}: опорная точка «${n}» должна быть задана выше.`);
      return v;
    };
    if (d.k === 'xy') {
      const x = N(d.x, 'x'),
        y = N(d.y, 'y');
      if (x != null && y != null) pos[p.name] = [x, y];
    } else if (d.k === 'polar') {
      const F = P(d.from),
        L = N(d.L, 'длина'),
        a = N(d.ang, 'угол');
      const To = d.to ? P(d.to) : null;
      let base = 0;
      if (F && To) {
        if (!(len(sub2(To, F)) > 0)) errors.push(`${where}: направление на ${d.to} не определено — точка совпадает с ${d.from}.`);
        base = Math.atan2(To[1] - F[1], To[0] - F[0]);
      }
      if (F && L != null && a != null && (!d.to || To)) pos[p.name] = [F[0] + L * Math.cos(base + rad(a)), F[1] + L * Math.sin(base + rad(a))];
    } else if (d.k === 'two') {
      const A = P(d.p1),
        B = P(d.p2),
        r1 = N(d.L1, 'длина 1'),
        r2 = N(d.L2, 'длина 2');
      if (A && B && r1 != null && r2 != null) {
        const D = len(sub2(B, A));
        const x = (D * D + r1 * r1 - r2 * r2) / (2 * D);
        const h2 = r1 * r1 - x * x;
        if (!(D > 0) || h2 < -1e-9 * Math.max(1, r1 * r1)) errors.push(`${where}: окружности радиусов ${r1} и ${r2} вокруг ${d.p1} и ${d.p2} не пересекаются.`);
        else {
          const h = Math.sqrt(Math.max(0, h2)),
            e: V2 = [(B[0] - A[0]) / D, (B[1] - A[1]) / D],
            n = perp(e);
          pos[p.name] = [A[0] + x * e[0] + d.side * h * n[0], A[1] + x * e[1] + d.side * h * n[1]];
        }
      }
    } else if (d.k === 'seg') {
      const A = P(d.p1),
        B = P(d.p2),
        t = N(d.t, 'доля');
      if (A && B && t != null) pos[p.name] = [A[0] + t * (B[0] - A[0]), A[1] + t * (B[1] - A[1])];
    } else if (d.k === 'cross') {
      const line = (pp: string, q: string, a: string, which: string): [V2, V2] | null => {
        const A = P(pp);
        if (!A) return null;
        if (q) {
          const B = P(q);
          if (!B) return null;
          const dd = sub2(B, A);
          if (!(len(dd) > 0)) {
            errors.push(`${where}: прямая ${which} — точки ${pp} и ${q} совпадают.`);
            return null;
          }
          return [A, dd];
        }
        const ang = N(a, `угол прямой ${which}`);
        return ang == null ? null : [A, [Math.cos(rad(ang)), Math.sin(rad(ang))]];
      };
      const L1 = line(d.p1, d.q1, d.a1, '1'),
        L2 = line(d.p2, d.q2, d.a2, '2');
      if (L1 && L2) {
        const [A, u] = L1,
          [B, w] = L2;
        const den = u[0] * w[1] - u[1] * w[0];
        if (Math.abs(den) < 1e-12 * len(u) * len(w)) errors.push(`${where}: прямые параллельны — точки пересечения нет.`);
        else {
          const t = ((B[0] - A[0]) * w[1] - (B[1] - A[1]) * w[0]) / den;
          pos[p.name] = [A[0] + t * u[0], A[1] + t * u[1]];
        }
      }
    } else {
      const F = P(d.from),
        Q = P(d.through),
        L = N(d.L, 'длина'),
        a = N(d.ang, 'угол');
      if (F && Q && L != null && a != null) {
        const u: V2 = [Math.cos(rad(a)), Math.sin(rad(a))],
          w = sub2(Q, F);
        const b = dot(u, w),
          c = dot(w, w) - L * L,
          D = b * b - c;
        if (D < -1e-9 * Math.max(1, L * L)) errors.push(`${where}: прямая через ${d.through} не пересекает окружность радиуса ${L} вокруг ${d.from}.`);
        else {
          const s = -b + d.side * Math.sqrt(Math.max(0, D));
          pos[p.name] = [Q[0] + s * u[0], Q[1] + s * u[1]];
        }
      }
    }
  }
  return { pos, errors };
}

/** Решение A·x = b (A — m×n) приведением к ступенчатому виду: решение, свободные неизвестные, противоречия. */
export function solveRect(A0: number[][], b0: number[]): { x: number[]; free: number[]; inconsistent: boolean } {
  const m = A0.length,
    n = A0[0]?.length ?? 0;
  // Нормируем строки — уравнения бывают в разных единицах.
  const A = A0.map((r, i) => {
    const s = Math.max(...r.map(Math.abs), 1e-300);
    return [...r.map((v) => v / s), b0[i] / s];
  });
  const piv: number[] = [];
  let row = 0;
  const tol = 1e-9;
  for (let c = 0; c < n && row < m; c++) {
    let p = -1,
      best = tol;
    for (let r = row; r < m; r++)
      if (Math.abs(A[r][c]) > best) {
        best = Math.abs(A[r][c]);
        p = r;
      }
    if (p < 0) continue;
    [A[row], A[p]] = [A[p], A[row]];
    const d = A[row][c];
    for (let k = c; k <= n; k++) A[row][k] /= d;
    for (let r = 0; r < m; r++) {
      if (r === row) continue;
      const f = A[r][c];
      if (f) for (let k = c; k <= n; k++) A[r][k] -= f * A[row][k];
    }
    piv.push(c);
    row++;
  }
  const x = new Array(n).fill(0);
  piv.forEach((c, i) => (x[c] = A[i][n]));
  let inconsistent = false;
  const bmax = Math.max(1, ...A.map((r) => Math.abs(r[n])));
  for (let r = row; r < m; r++) if (Math.abs(A[r][n]) > 1e-7 * bmax) inconsistent = true;
  const ps = new Set(piv);
  return { x, free: [...Array(n).keys()].filter((c) => !ps.has(c)), inconsistent };
}

interface Row {
  c: Record<number, number>;
  rhs: number;
}

/** Кинематика механизма в одном положении (параметр φ уже подставлен). Полный расчёт — solveMech в solve.ts. */
export function kinematics(pr: MechProblem): MechResult {
  const { pos, errors } = buildPositions(pr.points);
  const empty = (errs: string[]): MechResult => ({ ok: false, errors: errs, guides: [], pos, points: [], bodies: [], order: [], pole: {}, wheels: [], dof: null });
  const pidx = new Map(pr.points.map((p, i) => [p.name, i]));
  const bidx = new Map(pr.bodies.map((b, i) => [b.name, i]));
  const NP = pr.points.length,
    NB = pr.bodies.length,
    n = 2 * NP + NB;
  const bodyNames = new Set<string>();
  for (const b of pr.bodies) {
    if (!b.name.trim()) errors.push('У каждого звена должно быть имя.');
    if (bodyNames.has(b.name)) errors.push(`Имя звена ${b.name} повторяется.`);
    bodyNames.add(b.name);
    if (!b.pts.length) errors.push(`Звено ${b.name}: отметьте его точки.`);
    for (const q of b.pts) if (!pidx.has(q)) errors.push(`Звено ${b.name}: нет точки ${q}.`);
  }
  const NUM = (s: string, what: string) => {
    const v = num(s);
    if (v == null) errors.push(`${what} — не число («${s}»).`);
    return v ?? 0;
  };
  const PT = (q: string, what: string) => {
    if (!pidx.has(q)) errors.push(`${what}: нет точки «${q}».`);
    return pidx.get(q) ?? 0;
  };
  const BD = (q: string, what: string) => {
    if (!bidx.has(q)) errors.push(`${what}: нет звена «${q}».`);
    return bidx.get(q) ?? 0;
  };
  if (!pr.drives.length) errors.push('Задайте ведущее звено (или известную скорость точки).');
  if (errors.length) return empty(errors);
  const X = (i: number) => pos[pr.points[i].name];
  const vx = (i: number) => 2 * i,
    vy = (i: number) => 2 * i + 1,
    wb = (b: number) => 2 * NP + b;

  // Предварительно разбираем связи и ведущие (числа, направления).
  const cons = pr.cons.map((c, ci) => {
    const w = `Связь ${ci + 1}`;
    if (c.k === 'fixed') return { k: c.k, p: PT(c.p, w) };
    if (c.k === 'slider') {
      const a = rad(NUM(c.ang, `${w}: угол направляющей`));
      return { k: c.k, p: PT(c.p, w), n: [-Math.sin(a), Math.cos(a)] as V2 };
    }
    if (c.k === 'roll') {
      const a = rad(NUM(c.ang, `${w}: угол прямой`));
      return { k: c.k, b: BD(c.b, w), c: PT(c.c, w), r: NUM(c.r, `${w}: радиус`), t: [Math.cos(a), Math.sin(a)] as V2, n: [-Math.sin(a), Math.cos(a)] as V2 };
    }
    if (c.k === 'guide') {
      const b = BD(c.b, w),
        g1 = PT(c.g1, w),
        g2 = PT(c.g2, w),
        p = PT(c.p, w);
      const body = pr.bodies.find((q) => q.name === c.b);
      if (body && (!body.pts.includes(c.g1) || !body.pts.includes(c.g2))) errors.push(`${w}: точки ${c.g1} и ${c.g2} прямой должны принадлежать звену ${c.b}.`);
      if (body?.pts.includes(c.p)) errors.push(`${w}: камень ${c.p} не может принадлежать самому звену ${c.b}, по которому скользит.`);
      return { k: c.k, b, g1, g2, p };
    }
    if (c.k === 'trans') return { k: c.k, b: BD(c.b, w) };
    return { k: c.k, b1: BD(c.b1, w), c1: PT(c.c1, w), r1: NUM(c.r1, `${w}: радиус 1`), b2: c.b2 ? BD(c.b2, w) : -1, c2: PT(c.c2, w), r2: NUM(c.r2, `${w}: радиус 2`), int: c.int };
  });
  const drives = pr.drives.map((d, di) => {
    const w = `Ведущее ${di + 1}`;
    if (d.k === 'omega') return { k: d.k, b: BD(d.b, w), w: NUM(d.w, `${w}: ω`), e: NUM(d.e, `${w}: ε`) };
    if (d.k === 'proj') {
      const a = rad(NUM(d.ang, `${w}: угол`));
      return { k: d.k, p: PT(d.p, w), u: [Math.cos(a), Math.sin(a)] as V2, v: NUM(d.v, `${w}: v`), a: NUM(d.a, `${w}: a`) };
    }
    const va = rad(NUM(d.vang, `${w}: угол v`)),
      aa = rad(NUM(d.aang, `${w}: угол a`)),
      V = NUM(d.v, `${w}: v`),
      Ac = NUM(d.a, `${w}: a`);
    return { k: d.k, p: PT(d.p, w), V: [V * Math.cos(va), V * Math.sin(va)] as V2, A: [Ac * Math.cos(aa), Ac * Math.sin(aa)] as V2 };
  });
  for (const c of cons)
    if (c.k === 'roll' && !(c.r! > 0)) errors.push('Радиус колеса — положительное число.');
    else if (c.k === 'gear') {
      const L = len(sub2(X(c.c2!), X(c.c1!)));
      const need = c.int ? Math.abs(c.r1! - c.r2!) : c.r1! + c.r2!;
      if (!(c.r1! > 0) || !(c.r2! > 0)) errors.push('Радиусы колёс — положительные числа.');
      else if (Math.abs(L - need) > 1e-6 * Math.max(1, need)) errors.push(`Зацепление ${pr.points[c.c1!].name}–${pr.points[c.c2!].name}: расстояние между центрами ${+L.toFixed(6)}, а должно быть ${+need.toFixed(6)} (${c.int ? '|r₁ − r₂|' : 'r₁ + r₂'}).`);
    }
  for (const c of cons)
    if (c.k === 'guide') {
      const G1 = X(c.g1!),
        G2 = X(c.g2!);
      if (G1 && G2 && !(len(sub2(G2, G1)) > 1e-12 * Math.max(1, len(G1), len(G2)))) errors.push(`Кулисный камень ${pr.points[c.p!].name}: точки ${pr.points[c.g1!].name} и ${pr.points[c.g2!].name} прямой совпадают.`);
    }
  if (errors.length) return empty(errors);
  const inBody = new Set(pr.bodies.flatMap((b) => b.pts));
  const auxIdx = pr.points.map((p, i) => (inBody.has(p.name) ? -1 : i)).filter((i) => i >= 0);
  for (const i of auxIdx) {
    const nm = pr.points[i].name;
    // Вспомогательная (неподвижная) точка может быть осью качающейся кулисы — камнем, по которому скользит звено.
    const used =
      pr.drives.some((d) => d.k !== 'omega' && d.p === nm) ||
      pr.cons.some((c) =>
        c.k === 'fixed' || c.k === 'slider' ? c.p === nm : c.k === 'roll' ? c.c === nm : c.k === 'gear' ? c.c1 === nm || (c.c2 === nm && c.b2 !== '') : false,
      );
    if (used) errors.push(`Точка ${nm} участвует в связях или ведущих, но не входит ни в одно звено.`);
  }
  if (errors.length) return empty(errors);

  /** Кулисный камень: орт прямой u, нормаль n, r = A − G₁. */
  const guideGeom = (g1: number, g2: number, p: number) => {
    const d = sub2(X(g2), X(g1)),
      L = len(d);
    const u: V2 = [d[0] / L, d[1] / L];
    return { u, n: perp(u), r: sub2(X(p), X(g1)) };
  };
  /** Относительная скорость камня вдоль u: v_r = (v_A − v_G₁ − ω × r)·u. */
  const guideVr = (g1: number, b: number, p: number, G: { u: V2; r: V2 }, vel: (i: number) => V2, om: (b: number) => number) => {
    const d = sub2(vel(p), vel(g1)),
      w = om(b);
    return dot(d, G.u) + w * dot(G.r, perp(G.u));
  };
  /** Строки уравнений: kin = 'v' — скорости, 'a' — ускорения (правая часть зависит от найденных скоростей). */
  const rows = (kin: 'v' | 'a', V: number[] | null, withDrives = true): Row[] => {
    const R: Row[] = [];
    const om = (b: number) => (V ? V[wb(b)] : 0);
    const vel = (i: number): V2 => (V ? [V[vx(i)], V[vy(i)]] : [0, 0]);
    for (let b = 0; b < NB; b++) {
      const ids = pr.bodies[b].pts.map((q) => pidx.get(q)!);
      const ref = ids[0];
      for (const j of ids.slice(1)) {
        const r = sub2(X(j), X(ref)),
          pr2 = perp(r);
        const w2 = om(b) ** 2;
        R.push({ c: { [vx(j)]: 1, [vx(ref)]: -1, [wb(b)]: -pr2[0] }, rhs: kin === 'a' ? -w2 * r[0] : 0 });
        R.push({ c: { [vy(j)]: 1, [vy(ref)]: -1, [wb(b)]: -pr2[1] }, rhs: kin === 'a' ? -w2 * r[1] : 0 });
      }
    }
    for (const i of auxIdx) R.push({ c: { [vx(i)]: 1 }, rhs: 0 }, { c: { [vy(i)]: 1 }, rhs: 0 });
    for (const c of cons) {
      if (c.k === 'fixed') {
        R.push({ c: { [vx(c.p!)]: 1 }, rhs: 0 }, { c: { [vy(c.p!)]: 1 }, rhs: 0 });
      } else if (c.k === 'slider') {
        R.push({ c: { [vx(c.p!)]: c.n![0], [vy(c.p!)]: c.n![1] }, rhs: 0 });
      } else if (c.k === 'roll') {
        R.push({ c: { [vx(c.c!)]: c.n![0], [vy(c.c!)]: c.n![1] }, rhs: 0 });
        R.push({ c: { [vx(c.c!)]: c.t![0], [vy(c.c!)]: c.t![1], [wb(c.b!)]: c.r! }, rhs: 0 });
      } else if (c.k === 'gear') {
        const C1 = X(c.c1!),
          C2 = X(c.c2!),
          L = len(sub2(C2, C1));
        const e: V2 = [(C2[0] - C1[0]) / L, (C2[1] - C1[1]) / L],
          t = perp(e);
        // Точка касания и плечи d₁, d₂ вдоль e.
        let d1: number, d2: number;
        if (!c.int) (d1 = c.r1!), (d2 = -c.r2!);
        else if (c.r2! > c.r1!) (d1 = -c.r1!), (d2 = -c.r2!);
        else (d1 = c.r1!), (d2 = c.r2!);
        const dv = sub2(vel(c.c1!), vel(c.c2!));
        const ce: Record<number, number> = { [vx(c.c1!)]: e[0], [vy(c.c1!)]: e[1], [vx(c.c2!)]: -e[0], [vy(c.c2!)]: -e[1] };
        const ct: Record<number, number> = { [vx(c.c1!)]: t[0], [vy(c.c1!)]: t[1], [vx(c.c2!)]: -t[0], [vy(c.c2!)]: -t[1], [wb(c.b1!)]: d1 };
        if (c.b2! >= 0) ct[wb(c.b2!)] = (ct[wb(c.b2!)] ?? 0) - d2;
        R.push({ c: ce, rhs: kin === 'a' ? dot(dv, dv) / L : 0 });
        R.push({ c: ct, rhs: kin === 'a' ? -(dot(dv, t) * dot(dv, e)) / L : 0 });
      } else if (c.k === 'guide') {
        const G = guideGeom(c.g1!, c.g2!, c.p!);
        const co: Record<number, number> = {};
        const add = (k: number, v: number) => (co[k] = (co[k] ?? 0) + v);
        add(vx(c.p!), G.n[0]);
        add(vy(c.p!), G.n[1]);
        add(vx(c.g1!), -G.n[0]);
        add(vy(c.g1!), -G.n[1]);
        add(wb(c.b!), -dot(G.r, G.u));
        let rhs = 0;
        if (kin === 'a') {
          const w = om(c.b!),
            vr = guideVr(c.g1!, c.b!, c.p!, G, vel, om);
          rhs = 2 * w * vr - w * w * dot(G.r, G.n);
        }
        R.push({ c: co, rhs });
      } else if (c.k === 'trans') {
        R.push({ c: { [wb(c.b!)]: 1 }, rhs: 0 });
      } else {
        throw new Error('неизвестная связь');
      }
    }
    if (withDrives)
      for (const d of drives) {
        if (d.k === 'omega') R.push({ c: { [wb(d.b!)]: 1 }, rhs: kin === 'v' ? d.w! : d.e! });
        else if (d.k === 'proj') R.push({ c: { [vx(d.p!)]: d.u![0], [vy(d.p!)]: d.u![1] }, rhs: kin === 'v' ? d.v! : d.a! });
        else {
          const W = kin === 'v' ? d.V! : d.A!;
          R.push({ c: { [vx(d.p!)]: 1 }, rhs: W[0] }, { c: { [vy(d.p!)]: 1 }, rhs: W[1] });
        }
      }
    return R;
  };
  const dense = (R: Row[]) => {
    const A = R.map((r) => {
      const a = new Array(n).fill(0);
      for (const [k, v] of Object.entries(r.c)) a[+k] += v;
      return a;
    });
    return { A, b: R.map((r) => r.rhs) };
  };
  const unkName = (k: number) => (k >= 2 * NP ? `ω звена ${pr.bodies[k - 2 * NP].name}` : `скорость точки ${pr.points[Math.floor(k / 2)].name}`);
  // Степень подвижности — по системе без ведущих.
  const free0 = dense(rows('v', null, false));
  const dof = free0.A.length ? solveRect(free0.A, free0.b).free.length : n;
  const sv = dense(rows('v', null));
  const S = solveRect(sv.A, sv.b);
  if (S.inconsistent) return { ...empty(['Связи и ведущие звенья противоречат друг другу: проверьте геометрию и данные (возможно, задано лишнее ведущее).']), dof };
  if (S.free.length) {
    const names = [...new Set(S.free.map(unkName))];
    return { ...empty([`Механизм не определён: не хватает связей или ведущих звеньев (подвижность ${dof}, ведущих уравнений ${drives.reduce((s, d) => s + (d.k === 'vec' ? 2 : 1), 0)}). Не найдены: ${names.slice(0, 4).join(', ')}${names.length > 4 ? '…' : ''}.`]), dof };
  }
  const V = S.x;
  let A: number[] = new Array(n).fill(0);
  if (pr.acc !== false) {
    const sa = dense(rows('a', V));
    const SA = solveRect(sa.A, sa.b);
    if (SA.inconsistent) return { ...empty(['Ускорения не согласуются со связями — проверьте данные ведущих звеньев.']), dof };
    A = SA.x;
  }
  const scale = Math.max(1, ...V.map(Math.abs), ...A.map(Math.abs));
  const points: PointState[] = pr.points.map((p, i) => ({ name: p.name, aux: !inBody.has(p.name), pos: X(i), v: [clean(V[vx(i)], scale), clean(V[vy(i)], scale)], a: [clean(A[vx(i)], scale), clean(A[vy(i)], scale)] }));
  const bodies: BodyState[] = pr.bodies.map((b, k) => {
    const w = clean(V[wb(k)], scale),
      e = clean(A[wb(k)], scale);
    const i0 = pidx.get(b.pts[0])!;
    const P = X(i0),
      v0 = points[i0].v,
      a0 = points[i0].a;
    const icr: V2 | null = Math.abs(w) > 1e-12 ? [P[0] - v0[1] / w, P[1] + v0[0] / w] : null;
    let ica: V2 | null = null;
    const det = w ** 4 + e * e;
    if (det > 1e-20) {
      // −ω²dx − εdy = −a_x;  εdx − ω²dy = −a_y.
      const dx = (-a0[0] * -(w * w) - -e * -a0[1]) / det,
        dy = (-(w * w) * -a0[1] - e * -a0[0]) / det;
      ica = [P[0] + dx, P[1] + dy];
    }
    return { name: b.name, omega: w, eps: e, icr, ica };
  });
  // Порядок изложения: от звеньев, движение которых задано или привязано к неподвижным точкам.
  const known = new Set<string>();
  for (const c of pr.cons) if (c.k === 'fixed') known.add(c.p);
  for (const d of pr.drives) if (d.k !== 'omega') known.add(d.p);
  const order: string[] = [],
    pole: Record<string, string> = {};
  const left = new Set(pr.bodies.map((b) => b.name));
  const driven = new Set(pr.drives.filter((d) => d.k === 'omega').map((d) => (d as { b: string }).b));
  while (left.size) {
    let pick: MBody | undefined = pr.bodies.find((b) => left.has(b.name) && driven.has(b.name) && b.pts.some((q) => known.has(q)));
    pick ??= pr.bodies.find((b) => left.has(b.name) && b.pts.some((q) => known.has(q)));
    pick ??= pr.bodies.find((b) => left.has(b.name))!;
    pole[pick.name] = pick.pts.find((q) => known.has(q)) ?? pick.pts[0];
    pick.pts.forEach((q) => known.add(q));
    order.push(pick.name);
    left.delete(pick.name);
  }
  const wheels = pr.cons.flatMap((c) => (c.k === 'roll' ? [{ b: c.b, c: c.c, r: num(c.r) ?? 0 }] : c.k === 'gear' ? [{ b: c.b1, c: c.c1, r: num(c.r1) ?? 0 }, ...(c.b2 ? [{ b: c.b2, c: c.c2, r: num(c.r2) ?? 0 }] : [{ b: '', c: c.c2, r: num(c.r2) ?? 0 }])] : []));
  const guides: GuideState[] = [];
  for (const c of cons) {
    if (c.k !== 'guide') continue;
    const G = guideGeom(c.g1!, c.g2!, c.p!);
    const vel = (i: number): V2 => [V[vx(i)], V[vy(i)]],
      acc = (i: number): V2 => [A[vx(i)], A[vy(i)]];
    const w = V[wb(c.b!)],
      e = A[wb(c.b!)];
    const pr2 = perp(G.r);
    const vr = guideVr(c.g1!, c.b!, c.p!, G, vel, (b) => V[wb(b)]);
    const ve: V2 = [vel(c.g1!)[0] + w * pr2[0], vel(c.g1!)[1] + w * pr2[1]];
    const ae: V2 = [acc(c.g1!)[0] + e * pr2[0] - w * w * G.r[0], acc(c.g1!)[1] + e * pr2[1] - w * w * G.r[1]];
    const ac: V2 = [2 * w * vr * G.n[0], 2 * w * vr * G.n[1]];
    const ar = dot(sub2(sub2(acc(c.p!), ae), ac), G.u);
    const cl = (q: V2): V2 => [clean(q[0], scale), clean(q[1], scale)];
    guides.push({ p: pr.points[c.p!].name, b: pr.bodies[c.b!].name, g1: pr.points[c.g1!].name, g2: pr.points[c.g2!].name, u: G.u, vr: clean(vr, scale), ar: clean(ar, scale), ve: cl(ve), ae: cl(ae), ac: cl(ac) });
  }
  return { ok: true, errors: [], guides, pos, points, bodies, order, pole, wheels, dof };
}
