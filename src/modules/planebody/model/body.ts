/**
 * Плоское движение твёрдого тела со связями в данный момент (Мещерский 39.17–39.21, 41.3–41.16, 43.5–43.10).
 *
 * Координаты — от центра масс C в данный момент (ось x вправо, y вверх), углы — от оси x против часовой стрелки.
 * Уравнения движения: m·a_C = ΣF + ΣR, J_C·ε = ΣM_C(F) + ΣM_C(R). Ускорение точки тела P (r = P − C):
 *   a_P = a_C + ε k×r − ω² r,  k×r = (−r_y, r_x).
 * Связи (условия на ускорения):
 *   шарнир — a_P = 0, реакция (R_x, R_y);
 *   ролик (опора по прямой с нормалью n) — a_P·n = 0, реакция N·n (односторонняя: N ≥ 0); трение скольжения
 *     F = −f·N·sign(скольжения) вдоль опоры; если трение удерживает точку — прилипание (a_P·t = 0, |F| ≤ fN);
 *   нить к неподвижной точке Q (длина L, e = (Q − P)/L) — a_P·e = v_P²/L, натяжение T·e (T ≥ 0);
 *   разматывающаяся нить (направление d от точки схода P к закреплённому концу) — a_P·d = 0, T·d (T ≥ 0);
 *   качение без скольжения (контакт P, нормаль n в тело) — a_C·n = 0 и a_P·t = 0, реакции N·n, F·t (N ≥ 0).
 * Нарушенная односторонняя связь (N < 0, T < 0) снимается — тело отрывается, нить ослабевает, — и задача решается
 * заново. Режим «движение задано»: a_C и ε известны, реакции — из трёх уравнений кинетостатики (метод Даламбера:
 * Φ = −m·a_C в центре масс, M^Φ = −J_C·ε).
 */
import { fmt } from '../../../shared/format';

export type Shape = 'rod' | 'disk' | 'ring' | 'rect' | 'rho' | 'J';
export interface BodyPoint {
  name: string;
  x: number;
  y: number;
}
export type ConstrKind = 'pin' | 'roller' | 'rope' | 'unwind' | 'roll';
export interface Constr {
  kind: ConstrKind;
  /** Точка тела. */
  at: string;
  /** Угол нормали (ролик, качение) или направления нити (разматывание), °. */
  ang: number;
  /** Ролик: односторонняя опора; коэффициент трения скольжения. */
  one: boolean;
  f: number;
  /** Нить: неподвижная точка Q (от C). */
  qx: number;
  qy: number;
}
export interface Load {
  kind: 'force' | 'moment';
  at: string;
  fx: number;
  fy: number;
  m: number;
}
export interface BodyProblem {
  byWeight: boolean;
  m: number;
  g: number;
  gravity: boolean;
  shape: Shape;
  /** Размеры: стержень — длина L и угол оси θ; диск, кольцо — радиус R; прямоугольник — a × b; ρ или J_C. */
  L: number;
  theta: number;
  R: number;
  a: number;
  b: number;
  rho: number;
  J: number;
  points: BodyPoint[];
  constr: Constr[];
  loads: Load[];
  /** Скорости в данный момент: ω (против часовой «+»), v_C. */
  omega: number;
  vx: number;
  vy: number;
  mode: 'dyn' | 'given';
  /** Режим «движение задано»: ускорение центра масс и угловое ускорение. */
  ax: number;
  ay: number;
  eps: number;
}
export interface Reaction {
  /** Номер связи. */
  i: number;
  kind: ConstrKind;
  at: string;
  /** Составляющие: шарнир — X, Y; ролик — N (и трение F); нить — T; качение — N, F. */
  vals: { name: string; v: number }[];
  /** Точка связи от C; направления неизвестных составляющих; условия на ускорения k·(a_Cx, a_Cy, ε) = rhs. */
  r: [number, number];
  dirs: { name: string; d: [number, number] }[];
  rows: { k: [number, number, number]; rhs: number }[];
  /** Сила в осях x, y. */
  F: [number, number];
  /** Связь снята (отрыв, ослабление нити) или трение удерживает точку (прилипание). */
  dropped: boolean;
  note: string | null;
}
export interface BodyResult {
  ok: boolean;
  errors: string[];
  mass: number;
  P: number;
  J: number;
  /** Точки тела (с концами стержня). */
  pts: Map<string, [number, number]>;
  aC: [number, number];
  eps: number;
  reactions: Reaction[];
  /** Силы инерции: Φ = −m·a_C, M^Φ = −J_C·ε. */
  Phi: [number, number];
  MPhi: number;
  /** Главный вектор и главный момент относительно C заданных сил (с силой тяжести). */
  Fe: [number, number];
  Me: number;
  /** Кинетическая энергия m v_C²/2 + J_C ω²/2. */
  T: number;
  /** Невязка кинетостатики (режим «движение задано», если реакций меньше трёх). */
  resid: number;
  notes: string[];
}

const rad = (a: number) => (a * Math.PI) / 180;
const dir = (a: number): [number, number] => [Math.cos(rad(a)), Math.sin(rad(a))];
const cross = (r: [number, number], F: [number, number]) => r[0] * F[1] - r[1] * F[0];

/** Момент инерции относительно центра масс. */
export function jC(pr: BodyProblem, mass: number): number {
  switch (pr.shape) {
    case 'rod':
      return (mass * pr.L * pr.L) / 12;
    case 'disk':
      return (mass * pr.R * pr.R) / 2;
    case 'ring':
      return mass * pr.R * pr.R;
    case 'rect':
      return (mass * (pr.a * pr.a + pr.b * pr.b)) / 12;
    case 'rho':
      return mass * pr.rho * pr.rho;
    default:
      return pr.J;
  }
}

/** Точки тела: у стержня — концы A и B, затем заданные. */
export function bodyPoints(pr: BodyProblem): Map<string, [number, number]> {
  const m = new Map<string, [number, number]>([['C', [0, 0]]]);
  if (pr.shape === 'rod') {
    const [c, s] = dir(pr.theta);
    m.set('A', [(-pr.L / 2) * c, (-pr.L / 2) * s]);
    m.set('B', [(pr.L / 2) * c, (pr.L / 2) * s]);
  }
  for (const p of pr.points) if (p.name.trim()) m.set(p.name.trim(), [p.x, p.y]);
  return m;
}

/** Решение линейной системы (Гаусс с выбором главного элемента); null — вырождена. */
function solveLin(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((r, i) => [...r, b[i]]);
  const sc = Math.max(1e-300, ...A.flat().map(Math.abs));
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12 * sc) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const k = M[r][c] / M[c][c];
      for (let q = c; q <= n; q++) M[r][q] -= k * M[c][q];
    }
  }
  return M.map((r, i) => r[n] / r[i]);
}

interface Active {
  i: number;
  c: Constr;
  /** Ролик: знак скольжения для трения (0 — без трения), прилипание. */
  slip: number;
  stick: boolean;
}

export function solveBody(pr: BodyProblem): BodyResult {
  const errors: string[] = [];
  if (!(pr.m > 0)) errors.push('Масса (вес) тела — положительное число.');
  if (!(pr.g > 0)) errors.push('Ускорение свободного падения g — положительное число.');
  const mass = pr.byWeight ? pr.m / pr.g : pr.m;
  const J = jC(pr, mass);
  if (!(J > 0)) errors.push('Момент инерции J_C — положительное число (проверьте размеры тела).');
  const pts = bodyPoints(pr);
  const at = (name: string): [number, number] | null => pts.get(name.trim()) ?? null;
  pr.constr.forEach((c, i) => {
    if (!at(c.at)) errors.push(`Связь ${i + 1}: нет точки «${c.at}».`);
    if (c.kind === 'rope' && at(c.at) && Math.hypot(c.qx - at(c.at)![0], c.qy - at(c.at)![1]) < 1e-12) errors.push(`Связь ${i + 1}: нить нулевой длины.`);
    if (c.f < 0) errors.push(`Связь ${i + 1}: коэффициент трения не может быть отрицательным.`);
  });
  pr.loads.forEach((l, i) => {
    if (l.kind === 'force' && !at(l.at)) errors.push(`Нагрузка ${i + 1}: нет точки «${l.at}».`);
  });
  const base: BodyResult = {
    ok: false,
    errors,
    mass,
    P: mass * pr.g,
    J,
    pts,
    aC: [0, 0],
    eps: 0,
    reactions: [],
    Phi: [0, 0],
    MPhi: 0,
    Fe: [0, 0],
    Me: 0,
    T: 0,
    resid: 0,
    notes: [],
  };
  if (errors.length) return base;
  // Внешние силы: главный вектор и момент относительно C.
  let Fx = 0,
    Fy = 0,
    Mc = 0;
  if (pr.gravity) Fy -= mass * pr.g;
  for (const l of pr.loads) {
    if (l.kind === 'moment') Mc += l.m;
    else {
      Fx += l.fx;
      Fy += l.fy;
      Mc += cross(at(l.at)!, [l.fx, l.fy]);
    }
  }
  const w = pr.omega;
  const vP = (r: [number, number]): [number, number] => [pr.vx - w * r[1], pr.vy + w * r[0]];
  const kr = (r: [number, number]): [number, number] => [-r[1], r[0]];
  const T = (mass * (pr.vx ** 2 + pr.vy ** 2)) / 2 + (J * w * w) / 2;
  /** Направления реакций (единичные «столбцы») и кинематические строки связи. */
  const parts = (a: Active) => {
    const c = a.c,
      r = at(c.at)!;
    const cols: { name: string; d: [number, number] }[] = [];
    const rows: { k: [number, number, number]; rhs: number }[] = [];
    // Строка a_P·d = ω² r·d + extra.
    const rowP = (d: [number, number], extra = 0) =>
      rows.push({ k: [d[0], d[1], kr(r)[0] * d[0] + kr(r)[1] * d[1]], rhs: w * w * (r[0] * d[0] + r[1] * d[1]) + extra });
    if (c.kind === 'pin') {
      cols.push({ name: 'X', d: [1, 0] }, { name: 'Y', d: [0, 1] });
      rowP([1, 0]);
      rowP([0, 1]);
    } else if (c.kind === 'roller') {
      const n = dir(c.ang),
        t: [number, number] = [n[1], -n[0]];
      if (a.stick) {
        cols.push({ name: 'N', d: n }, { name: 'F', d: t });
        rowP(n);
        rowP(t);
      } else {
        // Трение −σ·f·N вдоль опоры: реакция N·(n − σf·t).
        const s = a.slip * c.f;
        cols.push({ name: 'N', d: [n[0] - s * t[0], n[1] - s * t[1]] });
        rowP(n);
      }
    } else if (c.kind === 'rope') {
      const L = Math.hypot(c.qx - r[0], c.qy - r[1]);
      const e: [number, number] = [(c.qx - r[0]) / L, (c.qy - r[1]) / L];
      const v = vP(r);
      cols.push({ name: 'T', d: e });
      rowP(e, (v[0] ** 2 + v[1] ** 2) / L);
    } else if (c.kind === 'unwind') {
      const d = dir(c.ang);
      cols.push({ name: 'T', d });
      rowP(d);
    } else {
      const n = dir(c.ang),
        t: [number, number] = [n[1], -n[0]];
      cols.push({ name: 'N', d: n }, { name: 'F', d: t });
      rows.push({ k: [n[0], n[1], 0], rhs: 0 });
      rowP(t);
    }
    return { r, cols, rows };
  };
  // Трение у роликов: направление скольжения — по скорости точки вдоль опоры, при покое — по тенденции.
  const tangential = (c: Constr, aC: [number, number], eps: number) => {
    const r = at(c.at)!,
      n = dir(c.ang),
      t: [number, number] = [n[1], -n[0]];
    const v = vP(r);
    const vt = v[0] * t[0] + v[1] * t[1];
    const ap: [number, number] = [aC[0] - eps * r[1] - w * w * r[0], aC[1] + eps * r[0] - w * w * r[1]];
    return { vt, at: ap[0] * t[0] + ap[1] * t[1] };
  };
  /** Направление трения у ролика с f > 0: скольжение (по скорости, при покое — по тенденции) или прилипание. */
  const slipOf = (c: Constr, aC: [number, number], eps: number): number => {
    const { vt, at: atg } = tangential(c, aC, eps);
    const sc = Math.max(1e-12, Math.abs(vt) + Math.abs(atg));
    return Math.abs(vt) > 1e-9 * sc ? Math.sign(vt) : Math.abs(atg) > 1e-12 ? Math.sign(atg) : 0;
  };
  /** Реакция связи по найденным составляющим; трение скольжения и условия для трения — в примечании. */
  const react = (a: Active, u: number[]): Reaction => {
    const { r, cols, rows } = parts(a);
    const vals = cols.map((col, q) => ({ name: col.name, v: u[q] }));
    const F: [number, number] = [0, 0];
    cols.forEach((col, q) => {
      F[0] += vals[q].v * col.d[0];
      F[1] += vals[q].v * col.d[1];
    });
    let note: string | null = null;
    if (a.c.kind === 'roller' && a.slip !== 0) {
      vals.push({ name: 'F', v: -a.slip * a.c.f * vals[0].v });
      note = `трение скольжения |F| = f·N = ${fmt(a.c.f * vals[0].v, 4)} направлено против скольжения`;
    }
    if (a.c.kind === 'roller' && a.stick) {
      const N = vals[0].v,
        Ft = vals[1].v;
      note =
        Math.abs(Ft) <= a.c.f * Math.abs(N) + 1e-12
          ? 'трение удерживает точку от скольжения (прилипание): |F| ≤ fN'
          : 'трения не хватает для прилипания — проверьте данные';
    }
    if (a.c.kind === 'roll') {
      const N = vals[0].v,
        Ft = vals[1].v;
      note = Math.abs(N) > 1e-12 ? `для качения без скольжения нужен коэффициент трения f ≥ |F|/N = ${fmt(Math.abs(Ft) / Math.abs(N), 4)}` : null;
    }
    return { i: a.i, kind: a.c.kind, at: a.c.at, vals, r, dirs: cols, rows, F, dropped: false, note };
  };
  const reactions: Reaction[] = [];
  const notes: string[] = [];
  if (pr.mode === 'given') {
    // Кинетостатика: реакции из трёх уравнений при известных a_C, ε.
    const act: Active[] = pr.constr.map((c, i) => {
      if (c.kind !== 'roller' || !(c.f > 0)) return { i, c, slip: 0, stick: false };
      const slip = slipOf(c, [pr.ax, pr.ay], pr.eps);
      return { i, c, slip, stick: slip === 0 };
    });
    const P = act.map(parts);
    const cols = P.flatMap((p) => p.cols.map((col) => ({ ...col, r: p.r })));
    const rhs = [mass * pr.ax - Fx, mass * pr.ay - Fy, J * pr.eps - Mc];
    const A = [cols.map((c) => c.d[0]), cols.map((c) => c.d[1]), cols.map((c) => cross(c.r, c.d))];
    const n = cols.length;
    if (n > 3) return { ...base, errors: [`Неизвестных реакций ${n} — больше трёх уравнений кинетостатики (задача статически неопределима).`] };
    let u: number[] | null;
    if (n === 3) u = solveLin(A, rhs);
    else {
      // Меньше трёх неизвестных — наименьшие квадраты, затем невязка (совместно ли движение со связями).
      const AtA = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (__, j) => A.reduce((s, row) => s + row[i] * row[j], 0)));
      const Atb = Array.from({ length: n }, (_, i) => A.reduce((s, row, k) => s + row[i] * rhs[k], 0));
      u = n ? solveLin(AtA, Atb) : [];
    }
    if (!u) return { ...base, errors: ['Реакции не определяются однозначно: проверьте расположение связей.'] };
    const res = A.map((row, k) => row.reduce((s, a, j) => s + a * u![j], 0) - rhs[k]);
    const scale = Math.max(1e-9, Math.abs(Fx), Math.abs(Fy), mass * pr.g, Math.abs(mass * pr.ax), Math.abs(mass * pr.ay));
    const resid = Math.hypot(res[0], res[1], res[2] / Math.max(1, Math.sqrt(J / mass)));
    if (n > 0 && resid > 1e-9 * scale)
      notes.push('Заданное движение не согласуется со связями и силами: уравнения кинетостатики не выполняются точно (невязка показана).');
    let k = 0;
    for (const p of act) {
      const nc = parts(p).cols.length;
      reactions.push(react(p, u.slice(k, k + nc)));
      k += nc;
    }
    return {
      ...base,
      ok: true,
      errors: [],
      aC: [pr.ax, pr.ay],
      eps: pr.eps,
      reactions,
      Phi: [-mass * pr.ax, -mass * pr.ay],
      MPhi: -J * pr.eps,
      Fe: [Fx, Fy],
      Me: Mc,
      T,
      resid,
      notes,
    };
  }
  // Динамика: неизвестные a_Cx, a_Cy, ε и реакции.
  let act: Active[] = pr.constr.map((c, i) => ({ i, c, slip: 0, stick: false }));
  const dropped = new Map<number, string>();
  const solve = (list: Active[]) => {
    const P = list.map(parts);
    const cols = P.flatMap((p) => p.cols.map((col) => ({ ...col, r: p.r })));
    const rows = P.flatMap((p) => p.rows);
    const n = 3 + cols.length;
    if (rows.length !== cols.length) return null;
    const A: number[][] = [],
      b: number[] = [];
    A.push([mass, 0, 0, ...cols.map((c) => -c.d[0])]);
    b.push(Fx);
    A.push([0, mass, 0, ...cols.map((c) => -c.d[1])]);
    b.push(Fy);
    A.push([0, 0, J, ...cols.map((c) => -cross(c.r, c.d))]);
    b.push(Mc);
    for (const row of rows) {
      A.push([...row.k, ...Array(cols.length).fill(0)]);
      b.push(row.rhs);
    }
    const u = solveLin(A, b);
    return u && u.length === n ? { u, P } : null;
  };
  let sol = null as ReturnType<typeof solve>;
  let settled = false;
  for (let iter = 0; iter < 2 * pr.constr.length + 4; iter++) {
    sol = solve(act);
    if (!sol) break;
    const aC: [number, number] = [sol.u[0], sol.u[1]],
      eps = sol.u[2];
    // Трение: задать направление там, где оно ещё не задано.
    let changed = false;
    for (const a of act) {
      if (a.c.kind !== 'roller' || !(a.c.f > 0) || a.stick || a.slip !== 0) continue;
      const s = slipOf(a.c, aC, eps);
      if (s !== 0) {
        a.slip = s;
        changed = true;
      }
    }
    if (changed) continue;
    // Покой точки и трение её останавливает (касательное ускорение сменило знак) — прилипание.
    for (const a of act) {
      if (a.c.kind !== 'roller' || a.stick || a.slip === 0) continue;
      const { vt, at: atg } = tangential(a.c, aC, eps);
      if (Math.abs(vt) < 1e-12 && atg * a.slip < 0) {
        a.stick = true;
        a.slip = 0;
        changed = true;
      }
    }
    if (changed) continue;
    // Односторонние связи с «тянущей» реакцией — снять самую нарушенную.
    let worst: { a: Active; v: number } | null = null;
    let k = 3;
    for (const p of sol.P) {
      const a = act[sol.P.indexOf(p)];
      const first = sol.u[k];
      const one = (a.c.kind === 'roller' && a.c.one) || a.c.kind === 'rope' || a.c.kind === 'unwind' || a.c.kind === 'roll';
      if (one && first < -1e-9 * Math.max(1, mass * pr.g) && (!worst || first < worst.v)) worst = { a, v: first };
      k += p.cols.length;
    }
    if (worst) {
      dropped.set(
        worst.a.i,
        worst.a.c.kind === 'rope' || worst.a.c.kind === 'unwind'
          ? 'нить ослабевает (T < 0) — связь снята'
          : 'опора не удерживает (N < 0): тело отрывается — связь снята',
      );
      act = act.filter((a) => a !== worst!.a);
      continue;
    }
    settled = true;
    break;
  }
  // Итерации исчерпаны после смены набора связей — решение по последнему набору.
  if (sol && !settled) {
    sol = solve(act);
    notes.push('Набор действующих связей не установился за отведённое число шагов — проверьте трение и односторонние связи.');
  }
  if (!sol) return { ...base, errors: ['Система уравнений вырождена: связи лишние (тело закреплено неподвижно или статически неопределимо) или несовместны.'] };
  const aC: [number, number] = [sol.u[0], sol.u[1]],
    eps = sol.u[2];
  let k = 3;
  const byI = new Map<number, Reaction>();
  sol.P.forEach((p, j) => {
    byI.set(act[j].i, react(act[j], sol!.u.slice(k, k + p.cols.length)));
    k += p.cols.length;
  });
  pr.constr.forEach((c, i) => {
    reactions.push(
      byI.get(i) ?? { i, kind: c.kind, at: c.at, vals: [], r: at(c.at)!, dirs: [], rows: [], F: [0, 0], dropped: true, note: dropped.get(i) ?? 'связь снята' },
    );
  });
  return { ...base, ok: true, errors: [], aC, eps, reactions, Phi: [-mass * aC[0], -mass * aC[1]], MPhi: -J * eps, Fe: [Fx, Fy], Me: Mc, T, resid: 0, notes };
}

/** Ускорение точки тела по найденным a_C, ε. */
export function accOf(r: [number, number], aC: [number, number], eps: number, omega: number): [number, number] {
  return [aC[0] - eps * r[1] - omega * omega * r[0], aC[1] + eps * r[0] - omega * omega * r[1]];
}
