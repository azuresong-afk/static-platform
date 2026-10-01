/**
 * Плоский механизм в заданном положении (Мещерский §16, 18).
 *
 * Точки задаются построениями (координаты, от точки по длине и углу, пересечение двух окружностей, точка на прямой
 * на заданном расстоянии, точка на отрезке — доля его длины). Звенья — жёсткие тела из точек. Связи: неподвижный шарнир, ползун на прямой направляющей,
 * качение колеса без скольжения по неподвижной прямой, зацепление (качение) двух колёс. Ведущие: угловая скорость
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
 * Положительные ω, ε — против часовой стрелки. Точки, не входящие ни в одно звено, — вспомогательные (для построения),
 * неподвижные.
 */
import { evalExpr, parseExpr } from '../../../shared/expr';

export type PtDef =
  | { k: 'xy'; x: string; y: string }
  | { k: 'polar'; from: string; L: string; ang: string }
  | { k: 'two'; p1: string; L1: string; p2: string; L2: string; side: 1 | -1 }
  | { k: 'line'; from: string; L: string; through: string; ang: string; side: 1 | -1 }
  | { k: 'seg'; p1: string; p2: string; t: string };

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
  | { k: 'gear'; b1: string; c1: string; r1: string; b2: string; c2: string; r2: string; int: boolean };
export type MDrive =
  | { k: 'omega'; b: string; w: string; e: string }
  | { k: 'proj'; p: string; ang: string; v: string; a: string }
  | { k: 'vec'; p: string; v: string; vang: string; a: string; aang: string };

export interface MechProblem {
  points: MPoint[];
  bodies: MBody[];
  cons: MCons[];
  drives: MDrive[];
}

type V2 = [number, number];
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
export interface MechResult {
  ok: boolean;
  errors: string[];
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
      if (F && L != null && a != null) pos[p.name] = [F[0] + L * Math.cos(rad(a)), F[1] + L * Math.sin(rad(a))];
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

export function solveMech(pr: MechProblem): MechResult {
  const { pos, errors } = buildPositions(pr.points);
  const empty = (errs: string[]): MechResult => ({ ok: false, errors: errs, pos, points: [], bodies: [], order: [], pole: {}, wheels: [], dof: null });
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
  if (errors.length) return empty(errors);
  const inBody = new Set(pr.bodies.flatMap((b) => b.pts));
  const auxIdx = pr.points.map((p, i) => (inBody.has(p.name) ? -1 : i)).filter((i) => i >= 0);
  for (const i of auxIdx) {
    const nm = pr.points[i].name;
    const used = pr.drives.some((d) => d.k !== 'omega' && d.p === nm) || pr.cons.some((c) => (c.k === 'fixed' || c.k === 'slider' ? c.p === nm : c.k === 'roll' ? c.c === nm : c.c1 === nm || (c.c2 === nm && c.b2 !== '')));
    if (used) errors.push(`Точка ${nm} участвует в связях или ведущих, но не входит ни в одно звено.`);
  }
  if (errors.length) return empty(errors);

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
      } else {
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
  const sa = dense(rows('a', V));
  const SA = solveRect(sa.A, sa.b);
  if (SA.inconsistent) return { ...empty(['Ускорения не согласуются со связями — проверьте данные ведущих звеньев.']), dof };
  const A = SA.x;
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
  return { ok: true, errors: [], pos, points, bodies, order, pole, wheels, dof };
}
