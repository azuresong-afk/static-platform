/**
 * Сложение вращений вокруг пересекающихся (и параллельных) осей: тело с неподвижной точкой, конические передачи,
 * дифференциалы, бегуны (Мещерский §19, 25; Яблонский К.6, К.8).
 *
 * Схема — в плоскости осей, как на чертежах книги: x — вправо, y — вверх, z — на наблюдателя. Звено вращается
 * относительно своего «родителя» (стойки или другого звена) вокруг оси, лежащей в этой плоскости и неподвижной
 * относительно родителя; ω звена — относительная угловая скорость (правило правого винта вдоль направления оси).
 * Абсолютная угловая скорость — сумма по цепочке: Ω = Ω_родителя + ω·e.
 *
 * Скорость точки P звена: v = Σ ωₖ eₖ × (P − Aₖ) по цепочке (Aₖ — точка оси). Для точки в плоскости все слагаемые
 * перпендикулярны плоскости, и eₖ × (P − Aₖ) = hₖ — расстояние от P до оси со знаком (плюс — слева от направления оси).
 * Качение без скольжения (зацепление) в точке P: скорости точек двух звеньев, совпадающих с P, равны. Заданы
 * относительные ω звеньев, скорости или ускорение точки. Неизвестные ω находятся из линейной системы, угловые
 * ускорения — из той же системы с производными (расположение осей и точек контакта друг относительно друга
 * считается неизменным — зацепление по делительным конусам и цилиндрам).
 *
 * Ускорение точки — по теореме о сложении ускорений на каждом уровне цепочки:
 *   a = a_e + ε·e × r + ω·e × (ω·e × r) + 2Ω_родителя × (ω·e × r);
 * для звена с неподвижной точкой O то же самое даёт формула Ривальса a = ε × r + ω × (ω × r).
 */
import { solveLin } from './linsys';
import { angleDeg, clean, cross, norm, V0, vadd, vmul, vsub, type V3 } from './vec';

export type LenUnit = 'm' | 'cm' | 'mm';
export const LEN: Record<LenUnit, string> = { m: 'м', cm: 'см', mm: 'мм' };

export interface SBody {
  id: number;
  name: string;
  /** 0 — стойка. */
  parent: number;
  /** Точка оси и её направление (угол от оси x против часовой, градусы). */
  x: number;
  y: number;
  ang: number;
}
/**
 * Точка: xy — координаты (u, v); polar — от начала координат: расстояние u, угол v (°);
 * axis — от точки оси звена b1: u вдоль оси, v поперёк (плюс — слева от направления оси);
 * cross — на пересечении прямых, параллельных осям звеньев b1 и b2 на расстояниях u и v (со знаком).
 * z — смещение из плоскости чертежа. body — звено, скорость и ускорение точки которого считать (0 — не считать).
 */
export type PointKind = 'xy' | 'polar' | 'axis' | 'cross';
export interface SPoint {
  id: number;
  name: string;
  k: PointKind;
  u: number;
  v: number;
  b1: number;
  b2: number;
  z: number;
  body: number;
}
/** Качение без скольжения (зацепление) звеньев a и b (0 — стойка) в точке p. */
export interface SContact {
  a: number;
  b: number;
  p: number;
}
/**
 * Условие: rel — относительная угловая скорость звена (val, единица unit; d — угловое ускорение ε, с⁻²);
 * speed — скорость точки p звена body: проекция на ось z (на наблюдателя), d — её производная;
 * acc — модуль ускорения точки p звена body (только при равномерном движении с одной степенью свободы).
 */
export type InputKind = 'rel' | 'speed' | 'acc';
export type RateUnit = 'rad' | 'rpm' | 'period';
export interface SInput {
  kind: InputKind;
  body: number;
  p: number;
  val: number;
  unit: RateUnit;
  d: number;
}
export interface SchemeProblem {
  unit: LenUnit;
  bodies: SBody[];
  points: SPoint[];
  contacts: SContact[];
  inputs: SInput[];
}

export const LIMITS = { bodies: 12, points: 24, contacts: 16, inputs: 12 };

export type BodyKind = 'rest' | 'axis' | 'point' | 'plane' | 'general' | 'trans';
export interface BodyRes {
  id: number;
  name: string;
  parent: number;
  /** Цепочка от корня (звено стойки) до самого звена — индексы в списке звеньев. */
  chain: number[];
  A: V3;
  e: V3;
  /** Относительные угловая скорость и угловое ускорение (вдоль своей оси). */
  w: number;
  eps: number;
  /** Абсолютные угловая скорость, переносная (= Ω родителя) и угловое ускорение. */
  W: V3;
  We: V3;
  E: V3;
  /** Вклад переносного вращения в угловое ускорение: Ω_родителя × ω·e. */
  Erot: V3;
  kind: BodyKind;
  /** Неподвижная точка (kind = point) или точка неподвижной оси (axis). */
  O: V3 | null;
  /** Мгновенная ось (в плоскости чертежа): точка и направление. */
  inst: { p: V3; d: V3 } | null;
  /** Аксоиды при двух равномерных вращениях: острые углы образующей с осью переносного и относительного вращений. */
  aks: { fix: number; mov: number } | null;
}
export interface PointRes {
  id: number;
  name: string;
  body: number;
  r: V3;
  v: V3;
  a: V3;
  /** По уровням цепочки: относительное, кориолисово (для текста решения). */
  levels: { k: number; vr: V3; ar: V3; cor: V3 }[];
  /** Для звена с неподвижной точкой: вращательное ε × r и осестремительное ω × (ω × r) ускорения. */
  rot: V3 | null;
  cen: V3 | null;
}
export interface Row {
  src: { k: 'contact'; i: number; comp: number } | { k: 'input'; i: number };
  coef: number[];
  rhs: number;
  rhsD: number;
}
export interface SchemeResult {
  ok: boolean;
  errors: string[];
  notes: string[];
  pos: Map<number, V3>;
  rows: Row[];
  bodies: BodyRes[];
  points: PointRes[];
  /** Масштаб по модулю ускорения точки (условие acc): при единичном решении |a| = aUnit, множитель k = √(a/aUnit). */
  accScale: { input: number; aUnit: number; k: number } | null;
  rpm: boolean;
  /** Характерный размер схемы. */
  L: number;
}

const rad = (d: number) => (d * Math.PI) / 180;
export const dirV = (ang: number): V3 => {
  const t = rad(ang);
  const c = Math.cos(t),
    s = Math.sin(t);
  return [Math.abs(c) < 1e-15 ? 0 : c, Math.abs(s) < 1e-15 ? 0 : s, 0];
};
/** Левая нормаль к направлению в плоскости. */
const leftN = (e: V3): V3 => [-e[1], e[0], 0];

/** Перевод заданной угловой скорости в рад/с. */
export function rateOf(val: number, unit: RateUnit): number {
  if (unit === 'rpm') return (val * Math.PI) / 30;
  if (unit === 'period') return (2 * Math.PI) / val;
  return val;
}

function fail(errors: string[]): SchemeResult {
  return { ok: false, errors, notes: [], pos: new Map(), rows: [], bodies: [], points: [], accScale: null, rpm: false, L: 1 };
}

export function solveScheme(pr: SchemeProblem): SchemeResult {
  const errors: string[] = [];
  const B = pr.bodies;
  if (!B.length) return fail(['Добавьте хотя бы одно звено.']);
  if (B.length > LIMITS.bodies || pr.points.length > LIMITS.points || pr.contacts.length > LIMITS.contacts || pr.inputs.length > LIMITS.inputs)
    return fail(['Слишком большая схема.']);
  const nums = [...B.flatMap((b) => [b.x, b.y, b.ang]), ...pr.points.flatMap((p) => [p.u, p.v, p.z]), ...pr.inputs.flatMap((i) => [i.val, i.d])];
  if (!nums.every(Number.isFinite)) return fail(['Есть незаполненные числа.']);
  const idx = new Map<number, number>();
  B.forEach((b, i) => {
    if (idx.has(b.id)) errors.push(`Звено ${b.name} повторяется.`);
    idx.set(b.id, i);
  });
  const nameOf = (id: number) => (id === 0 ? 'стойка' : (B[idx.get(id)!]?.name ?? `№${id}`));
  // Цепочки: от корня до звена.
  const chains: number[][] = [];
  for (let i = 0; i < B.length; i++) {
    const ch: number[] = [];
    let j: number | undefined = i;
    const seen = new Set<number>();
    while (j !== undefined) {
      if (seen.has(j)) {
        errors.push(`Звено ${B[i].name}: родители образуют цикл.`);
        break;
      }
      seen.add(j);
      ch.unshift(j);
      const par: number = B[j].parent;
      if (par === 0) break;
      j = idx.get(par);
      if (j === undefined) errors.push(`Звено ${B[i].name}: нет родителя №${par}.`);
    }
    chains.push(ch);
  }
  if (errors.length) return fail(errors);
  const A = B.map((b): V3 => [b.x, b.y, 0]);
  const E = B.map((b) => dirV(b.ang));
  // Точки.
  const pos = new Map<number, V3>();
  const pidx = new Map<number, number>();
  pr.points.forEach((p, i) => {
    if (pidx.has(p.id)) errors.push(`Точка ${p.name} повторяется.`);
    pidx.set(p.id, i);
    const bodyAt = (id: number, what: string) => {
      const k = idx.get(id);
      if (k === undefined) errors.push(`Точка ${p.name}: не выбрано звено ${what}.`);
      return k;
    };
    let q: V3 | null = null;
    if (p.k === 'xy') q = [p.u, p.v, p.z];
    else if (p.k === 'polar') q = [p.u * Math.cos(rad(p.v)), p.u * Math.sin(rad(p.v)), p.z];
    else if (p.k === 'axis') {
      const k = bodyAt(p.b1, '(ось)');
      if (k !== undefined) {
        const t = vadd(vadd(A[k], vmul(E[k], p.u)), vmul(leftN(E[k]), p.v));
        q = [t[0], t[1], p.z];
      }
    } else {
      const k1 = bodyAt(p.b1, '(первая ось)'),
        k2 = bodyAt(p.b2, '(вторая ось)');
      if (k1 !== undefined && k2 !== undefined) {
        const P1 = vadd(A[k1], vmul(leftN(E[k1]), p.u)),
          P2 = vadd(A[k2], vmul(leftN(E[k2]), p.v));
        const det = E[k1][0] * -E[k2][1] - E[k1][1] * -E[k2][0];
        const d = vsub(P2, P1);
        if (Math.abs(det) < 1e-9) {
          // Параллельные оси: прямые должны совпасть.
          const off = Math.abs(cross(E[k1], d)[2]);
          if (off > 1e-6 * Math.max(1, norm(d)))
            errors.push(`Точка ${p.name}: оси ${nameOf(p.b1)} и ${nameOf(p.b2)} параллельны, а расстояния не согласуются — задайте точку координатами.`);
          else q = [P1[0], P1[1], p.z];
        } else {
          const t = (d[0] * -E[k2][1] - d[1] * -E[k2][0]) / det;
          const P = vadd(P1, vmul(E[k1], t));
          q = [P[0], P[1], p.z];
        }
      }
    }
    if (q) pos.set(p.id, clean(q, 1e3));
  });
  if (errors.length) return fail(errors);
  const L = Math.max(1e-9, ...A.map((a) => Math.hypot(a[0], a[1])), ...[...pos.values()].map(norm));
  const ptOf = (id: number, who: string): V3 | null => {
    const q = pos.get(id);
    if (!q) errors.push(`${who}: не выбрана точка.`);
    return q ?? null;
  };
  const n = B.length;
  /** Коэффициенты скорости точки P звена i по неизвестным ωₖ: eₖ × (P − Aₖ). */
  const coefV = (i: number, P: V3): V3[] => {
    const c: V3[] = Array.from({ length: n }, () => [0, 0, 0] as V3);
    if (i < 0) return c;
    for (const k of chains[i]) c[k] = cross(E[k], vsub(P, A[k]));
    return c;
  };
  const rows: Row[] = [];
  pr.contacts.forEach((c, ci) => {
    const a = idx.get(c.a);
    const b = c.b === 0 ? -1 : idx.get(c.b);
    if (a === undefined || b === undefined) return void errors.push(`Контакт ${ci + 1}: не выбраны звенья.`);
    if (a === b) return void errors.push(`Контакт ${ci + 1}: звено касается само себя.`);
    const P = ptOf(c.p, `Контакт ${ci + 1}`);
    if (!P) return;
    const ca = coefV(a, P),
      cb = coefV(b, P);
    let any = false;
    for (let comp = 0; comp < 3; comp++) {
      const coef = ca.map((v, k) => v[comp] - cb[k][comp]);
      if (Math.max(...coef.map(Math.abs)) > 1e-9 * L) {
        rows.push({ src: { k: 'contact', i: ci, comp }, coef, rhs: 0, rhsD: 0 });
        any = true;
      }
    }
    if (!any) errors.push(`Контакт ${ci + 1} (точка ${pr.points[pidx.get(c.p)!].name}): точка лежит на осях обоих звеньев — условие ничего не даёт.`);
  });
  let accInput = -1;
  pr.inputs.forEach((inp, ii) => {
    const k = idx.get(inp.body);
    if (k === undefined) return void errors.push(`Условие ${ii + 1}: не выбрано звено.`);
    if (inp.kind === 'rel') {
      if (inp.unit === 'period' && inp.val === 0) return void errors.push(`Условие ${ii + 1}: период не может быть нулевым.`);
      const coef = Array<number>(n).fill(0);
      coef[k] = 1;
      rows.push({ src: { k: 'input', i: ii }, coef, rhs: rateOf(inp.val, inp.unit), rhsD: inp.d });
    } else if (inp.kind === 'speed') {
      const P = ptOf(inp.p, `Условие ${ii + 1}`);
      if (!P) return;
      const coef = coefV(k, P).map((v) => v[2]);
      if (Math.max(...coef.map(Math.abs)) <= 1e-9 * L)
        return void errors.push(`Условие ${ii + 1}: точка лежит на осях звена ${nameOf(inp.body)} — её скорость не зависит от вращения.`);
      rows.push({ src: { k: 'input', i: ii }, coef, rhs: inp.val, rhsD: inp.d });
    } else {
      if (accInput >= 0) return void errors.push('Модуль ускорения точки можно задать только одним условием.');
      if (!(inp.val > 0)) return void errors.push(`Условие ${ii + 1}: модуль ускорения должен быть положительным.`);
      if (!ptOf(inp.p, `Условие ${ii + 1}`)) return;
      accInput = ii;
    }
  });
  if (errors.length) return fail(errors);
  const rpm = pr.inputs.some((i) => i.kind === 'rel' && i.unit === 'rpm');

  let w: number[], eps: number[];
  let accScale: SchemeResult['accScale'] = null;
  const M = rows.map((r) => r.coef);
  if (accInput >= 0) {
    if (rows.some((r) => r.rhs !== 0 || r.rhsD !== 0) || pr.inputs[accInput].d !== 0)
      return fail(['Модуль ускорения точки как данное — только при равномерном движении: остальные заданные величины должны быть нулевыми.']);
    const s = solveLin(M.length ? M : [Array(n).fill(0)], [M.length ? rows.map(() => 0) : [0]]);
    if (s.nullspace.length !== 1)
      return fail([
        s.nullspace.length === 0
          ? 'Механизм неподвижен: при заданных связях все звенья стоят.'
          : 'По модулю ускорения можно найти движение только механизма с одной степенью свободы: добавьте условия.',
      ]);
    const u = s.nullspace[0];
    const big = u.reduce((m, x) => (Math.abs(x) > Math.abs(m) ? x : m), 0);
    const unitW = u.map((x) => x / big);
    const inp = pr.inputs[accInput];
    const k = idx.get(inp.body)!;
    const kin1 = kinematics(B, chains, E, unitW, Array(n).fill(0));
    const a1 = norm(pointAcc(chains[k], A, E, unitW, Array(n).fill(0), kin1.W, pos.get(inp.p)!).a);
    if (a1 < 1e-12) return fail(['Ускорение этой точки равно нулю при любом движении механизма.']);
    const kk = Math.sqrt(inp.val / a1);
    w = unitW.map((x) => x * kk);
    eps = Array(n).fill(0);
    accScale = { input: accInput, aUnit: a1, k: kk };
  } else {
    if (!rows.length) return fail(['Задайте угловую скорость звена или скорость точки.']);
    const s = solveLin(M, [rows.map((r) => r.rhs), rows.map((r) => r.rhsD)]);
    if (s.inconsistent.length) return fail(['Условия противоречат друг другу: проверьте заданные скорости и точки контакта (лишнее условие?).']);
    const undet = B.filter((_, i) => !s.determined[i]).map((b) => b.name);
    if (undet.length)
      return fail([
        `Не хватает условий: вращение ${undet.length > 1 ? 'звеньев' : 'звена'} ${undet.join(', ')} не определено. Добавьте контакт или заданную угловую скорость.`,
      ]);
    [w, eps] = s.x;
  }
  w = w.map((x) => (Math.abs(x) < 1e-12 ? 0 : x));
  eps = eps.map((x) => (Math.abs(x) < 1e-12 ? 0 : x));
  const kin = kinematics(B, chains, E, w, eps);
  const notes: string[] = [];
  const bodies: BodyRes[] = B.map((b, i) => {
    const ch = chains[i];
    const par = ch.length > 1 ? ch[ch.length - 2] : -1;
    const We = par >= 0 ? kin.W[par] : V0;
    const W = kin.W[i];
    const geo = fixedOf(ch, A, E, L);
    // Мгновенная ось: нули v_z в плоскости.
    const vz = (P: V3) => pointAcc(ch, A, E, w, eps, kin.W, P).v[2];
    const c0 = vz(V0),
      cx = (vz([L, 0, 0]) - c0) / L,
      cy = (vz([0, L, 0]) - c0) / L;
    const g2 = cx * cx + cy * cy;
    const Wn = norm(W);
    let kind: BodyKind = geo.kind;
    let inst: BodyRes['inst'] = null;
    if (Wn < 1e-12) kind = Math.abs(c0) < 1e-12 * L ? 'rest' : 'trans';
    else if (g2 > 0) {
      const p0: V3 = clean([(-c0 * cx) / g2, (-c0 * cy) / g2, 0], L);
      inst = { p: geo.O && kind !== 'general' ? geo.O : p0, d: vmul(W, 1 / Wn) };
    }
    const allUniform = ch.every((k) => eps[k] === 0);
    const aks = kind === 'point' && ch.length === 2 && allUniform && Wn > 0 ? { fix: acute(angleDeg(W, E[ch[0]])), mov: acute(angleDeg(W, E[ch[1]])) } : null;
    return {
      id: b.id,
      name: b.name,
      parent: b.parent,
      chain: ch,
      A: A[i],
      e: E[i],
      w: w[i],
      eps: eps[i],
      W: clean(W, Wn),
      We: clean(We, Wn),
      E: clean(kin.E[i], norm(kin.E[i])),
      Erot: clean(cross(We, vmul(E[i], w[i])), norm(kin.E[i])),
      kind,
      O: geo.O,
      inst,
      aks,
    };
  });
  const points: PointRes[] = [];
  for (const p of pr.points) {
    if (p.body === 0) continue;
    const k = idx.get(p.body);
    if (k === undefined) {
      notes.push(`Точка ${p.name}: звено не найдено — скорость не считается.`);
      continue;
    }
    const P = pos.get(p.id)!;
    const pa = pointAcc(chains[k], A, E, w, eps, kin.W, P);
    const br = bodies[k];
    let rot: V3 | null = null,
      cen: V3 | null = null;
    if ((br.kind === 'point' || br.kind === 'axis') && br.O) {
      const r = vsub(P, br.O);
      rot = cross(br.E, r);
      cen = cross(br.W, cross(br.W, r));
    }
    const sc = Math.max(norm(pa.a), 1e-300);
    points.push({
      id: p.id,
      name: p.name,
      body: p.body,
      r: P,
      v: clean(pa.v, norm(pa.v)),
      a: clean(pa.a, sc),
      levels: pa.levels,
      rot: rot && clean(rot, sc),
      cen: cen && clean(cen, sc),
    });
  }
  return { ok: true, errors: [], notes, pos, rows, bodies, points, accScale, rpm, L };
}

const acute = (a: number) => (a > 90 ? 180 - a : a);

/** Абсолютные угловые скорости и ускорения звеньев: Ω = Ω_р + ω·e, ε = ε_р + ε_отн·e + Ω_р × ω·e. */
function kinematics(B: SBody[], chains: number[][], E: V3[], w: number[], eps: number[]) {
  const W: V3[] = [],
    Ea: V3[] = [];
  B.forEach((_, i) => {
    let Wi: V3 = V0,
      Ei: V3 = V0;
    for (const k of chains[i]) {
      const wk = vmul(E[k], w[k]);
      Ei = vadd(vadd(Ei, vmul(E[k], eps[k])), cross(Wi, wk));
      Wi = vadd(Wi, wk);
    }
    W.push(Wi);
    Ea.push(Ei);
  });
  return { W, E: Ea };
}

/** Скорость и ускорение точки P звена с цепочкой ch: сложение движений по уровням. */
function pointAcc(ch: number[], A: V3[], E: V3[], w: number[], eps: number[], _W: V3[], P: V3) {
  let v: V3 = V0,
    a: V3 = V0,
    Wp: V3 = V0;
  const levels: PointRes['levels'] = [];
  for (const k of ch) {
    const r = vsub(P, A[k]);
    const wk = vmul(E[k], w[k]);
    const vr = cross(wk, r);
    const ar = vadd(cross(vmul(E[k], eps[k]), r), cross(wk, vr));
    const cor = vmul(cross(Wp, vr), 2);
    v = vadd(v, vr);
    a = vadd(vadd(a, ar), cor);
    Wp = vadd(Wp, wk);
    levels.push({ k, vr, ar, cor });
  }
  return { v, a, levels };
}

/** Характер движения звена по расположению осей цепочки: одна ось, оси пересекаются в точке, параллельны. */
function fixedOf(ch: number[], A: V3[], E: V3[], L: number): { kind: BodyKind; O: V3 | null } {
  const onLine = (P: V3, k: number) => Math.abs(cross(E[k], vsub(P, A[k]))[2]) < 1e-9 * L;
  if (ch.length === 1) return { kind: 'axis', O: A[ch[0]] };
  const k0 = ch[0];
  const other = ch.find((k) => Math.abs(cross(E[k0], E[k])[2]) > 1e-9);
  if (other === undefined) {
    // Все оси параллельны: совпадают — вращение вокруг неподвижной оси, иначе — плоское движение.
    return ch.every((k) => onLine(A[k], k0)) ? { kind: 'axis', O: A[k0] } : { kind: 'plane', O: null };
  }
  const det = E[k0][0] * -E[other][1] - E[k0][1] * -E[other][0];
  const d = vsub(A[other], A[k0]);
  const t = (d[0] * -E[other][1] - d[1] * -E[other][0]) / det;
  const O = clean(vadd(A[k0], vmul(E[k0], t)), L);
  if (ch.every((k) => onLine(O, k))) return { kind: 'point', O };
  return { kind: 'general', O: null };
}

/** Проекция на ось z (на наблюдателя) и словесное направление. */
export const towards = (vz: number) => (vz > 0 ? 'к нам' : vz < 0 ? 'от нас' : '');
