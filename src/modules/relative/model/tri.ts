/**
 * Обратные задачи сложения скоростей (и ускорений) точки в плоскости (Мещерский 22.3, 22.6–22.11, 22.15).
 *
 * Треугольник скоростей v = v_e + v_r (для ускорений a = a_e + a_r + a_c, кориолисово a_c задано). У каждого из трёх
 * векторов — модуль и направление (угол от оси x против часовой стрелки или курс — от севера по часовой); любые
 * два из шести чисел можно сделать неизвестными:
 *   - модуль и направление одного вектора — прямо из векторного равенства;
 *   - модули двух векторов при известных направлениях — система двух линейных уравнений;
 *   - модуль одного и направление другого — квадратное уравнение (до двух решений);
 *   - направления двух векторов при известных модулях — треугольник по трём сторонам (два зеркальных решения).
 * Второе наблюдение (22.6, 22.7) — ещё один треугольник с общим вектором (ветер, течение): неизвестными могут быть
 * только модули с известными направлениями и общий вектор целиком — система четырёх линейных уравнений.
 */
import { gauss } from '../../../shared/gauss';

export type TriVec = 'v' | 'e' | 'r';
export const TRI_VECS: TriVec[] = ['v', 'e', 'r'];
export interface TriItem {
  mod: number;
  dir: number;
  /** Неизвестны модуль, направление. */
  qm: boolean;
  qd: boolean;
}
export interface TriProblem {
  what: 'v' | 'a';
  /** Направления — курсом (от севера по часовой стрелке), а не от оси x против часовой. */
  compass: boolean;
  v: TriItem;
  e: TriItem;
  r: TriItem;
  /** Ускорения: кориолисово ускорение (известно). */
  c: { mod: number; dir: number };
  /** Второе наблюдение: общий вектор и два других вектора второго треугольника. */
  two: boolean;
  shared: TriVec;
  v2: TriItem;
  e2: TriItem;
  r2: TriItem;
}

type P2 = [number, number];
export interface TriSol {
  /** Найденные векторы: модуль, направление (в тех же единицах угла, что и задача). */
  v: { mod: number; dir: number | null };
  e: { mod: number; dir: number | null };
  r: { mod: number; dir: number | null };
  v2?: { mod: number; dir: number | null };
  e2?: { mod: number; dir: number | null };
  r2?: { mod: number; dir: number | null };
}
export interface TriResult {
  ok: boolean;
  errors: string[];
  /** Как решалось: 'vec' | 'lin' | 'quad' | 'sss' | 'lin4'. */
  kind: string;
  unknowns: string[];
  sols: TriSol[];
}

const SIGN: Record<TriVec, number> = { v: 1, e: -1, r: -1 };
const D = Math.PI / 180;
/** Единичный вектор по углу задачи (x — вправо/восток, y — вверх/север). */
export function unit(dir: number, compass: boolean): P2 {
  return compass ? [Math.sin(dir * D), Math.cos(dir * D)] : [Math.cos(dir * D), Math.sin(dir * D)];
}
export function angOf(p: P2, compass: boolean): number {
  const a = compass ? Math.atan2(p[0], p[1]) : Math.atan2(p[1], p[0]);
  const d = a / D;
  return Math.abs(d) < 1e-9 ? 0 : (d + 360) % 360;
}
const vec = (it: { mod: number; dir: number }, cp: boolean): P2 => {
  const u = unit(it.dir, cp);
  return [it.mod * u[0], it.mod * u[1]];
};
const NAME: Record<TriVec, string> = { v: 'абсолютной', e: 'переносной', r: 'относительной' };
export const triUnknownName = (k: TriVec, part: 'm' | 'd', two = false) =>
  `${part === 'm' ? 'модуль' : 'направление'} ${NAME[k]}${two ? ' (второе наблюдение)' : ''}`;

/** Собрать решение из найденных векторов (в осях x, y). */
function sol(p: TriProblem, vs: Record<TriVec, P2>, vs2?: Record<TriVec, P2>): TriSol {
  const one = (q: P2) => {
    const m = Math.hypot(q[0], q[1]);
    return { mod: m, dir: m > 1e-12 ? angOf(q, p.compass) : null };
  };
  const s: TriSol = { v: one(vs.v), e: one(vs.e), r: one(vs.r) };
  if (vs2) {
    s.v2 = one(vs2.v);
    s.e2 = one(vs2.e);
    s.r2 = one(vs2.r);
  }
  return s;
}

export function solveTri(p: TriProblem): TriResult {
  const errors: string[] = [];
  const cp = p.compass;
  const items = [p.v, p.e, p.r, ...(p.two ? [p.v2, p.e2, p.r2] : [])];
  if (!items.every((it) => Number.isFinite(it.mod) && Number.isFinite(it.dir)) || !Number.isFinite(p.c.mod) || !Number.isFinite(p.c.dir))
    errors.push('Все данные — числа.');
  if (items.some((it) => !it.qm && it.mod < 0)) errors.push('Модули векторов — неотрицательные числа.');
  const base: TriResult = { ok: false, errors, kind: '', unknowns: [], sols: [] };
  if (errors.length) return base;
  // Известный «лишний» член: кориолисово ускорение.
  const C: P2 = p.what === 'a' ? vec(p.c, cp) : [0, 0];
  if (p.two) return solveTwo(p, C, base);
  const unk: { k: TriVec; part: 'm' | 'd' }[] = [];
  for (const k of TRI_VECS) {
    if (p[k].qm) unk.push({ k, part: 'm' });
    if (p[k].qd) unk.push({ k, part: 'd' });
  }
  base.unknowns = unk.map((u) => triUnknownName(u.k, u.part));
  if (unk.length !== 2) return { ...base, errors: [`Неизвестных должно быть два, сейчас ${unk.length}: векторное равенство в плоскости — два уравнения.`] };
  // Σ s_i·X_i = C, s_v = +1, s_e = s_r = −1 (v − v_e − v_r = a_c).
  const known = TRI_VECS.filter((k) => !p[k].qm && !p[k].qd);
  const K: P2 = [C[0], C[1]];
  for (const k of known) {
    const q = vec(p[k], cp);
    K[0] -= SIGN[k] * q[0];
    K[1] -= SIGN[k] * q[1];
  }
  // Теперь Σ по неизвестным векторам s_i·X_i = K.
  const full = (vals: Partial<Record<TriVec, P2>>): Record<TriVec, P2> =>
    Object.fromEntries(TRI_VECS.map((k) => [k, vals[k] ?? vec(p[k], cp)])) as Record<TriVec, P2>;
  const [a, b] = unk;
  if (a.k === b.k) {
    const s = SIGN[a.k];
    return { ...base, ok: true, kind: 'vec', sols: [sol(p, full({ [a.k]: [K[0] / s, K[1] / s] }))] };
  }
  const sols: TriSol[] = [];
  if (a.part === 'm' && b.part === 'm') {
    const ua = unit(p[a.k].dir, cp),
      ub = unit(p[b.k].dir, cp);
    const sa = SIGN[a.k],
      sb = SIGN[b.k];
    const det = sa * ua[0] * sb * ub[1] - sa * ua[1] * sb * ub[0];
    if (Math.abs(det) < 1e-12) return { ...base, errors: ['Направления двух векторов с неизвестными модулями параллельны — модули не определяются.'] };
    const ma = (K[0] * sb * ub[1] - K[1] * sb * ub[0]) / det,
      mb = (sa * ua[0] * K[1] - sa * ua[1] * K[0]) / det;
    if (ma < -1e-9 * Math.max(1, Math.abs(mb)) || mb < -1e-9 * Math.max(1, Math.abs(ma)))
      return {
        ...base,
        errors: [`Нет решения при заданных направлениях: получилось ${ma < 0 ? 'm' + a.k : 'm' + b.k} < 0 — вектор направлен противоположно.`],
      };
    sols.push(sol(p, full({ [a.k]: [ma * ua[0], ma * ua[1]], [b.k]: [mb * ub[0], mb * ub[1]] })));
    return { ...base, ok: true, kind: 'lin', sols };
  }
  if (a.part !== b.part) {
    // X — с неизвестным модулем (направление u известно), Y — с неизвестным направлением (модуль известен).
    const X = a.part === 'm' ? a.k : b.k,
      Y = a.part === 'm' ? b.k : a.k;
    const u = unit(p[X].dir, cp),
      sx = SIGN[X],
      sy = SIGN[Y],
      mY = p[Y].mod;
    // |K − sx·m·u| = mY → m² − 2·sx·m·(K·u) + |K|² − mY² = 0.
    const ku = K[0] * u[0] + K[1] * u[1],
      kk = K[0] * K[0] + K[1] * K[1];
    let disc = ku * ku - kk + mY * mY;
    const sc = Math.max(kk, mY * mY, 1e-300);
    if (disc < 0 && disc > -1e-12 * sc) disc = 0;
    if (disc < 0) return { ...base, errors: [`Нет решения: ${triUnknownName(Y, 'm')} слишком мал — треугольник не замыкается.`] };
    const roots = disc === 0 ? [sx * ku] : [sx * ku + Math.sqrt(disc), sx * ku - Math.sqrt(disc)];
    for (const m of roots) {
      if (m < -1e-9 * Math.sqrt(sc)) continue;
      const mm = Math.max(m, 0);
      const Yv: P2 = [(K[0] - sx * mm * u[0]) / sy, (K[1] - sx * mm * u[1]) / sy];
      sols.push(sol(p, full({ [X]: [mm * u[0], mm * u[1]], [Y]: Yv })));
    }
    if (!sols.length) return { ...base, errors: ['Нет решения с неотрицательным модулем.'] };
    return { ...base, ok: true, kind: 'quad', sols };
  }
  // Направления двух векторов: окружности |A| = mA и |K − A| = mB, A = s_a·X_a.
  const mA = p[a.k].mod,
    mB = p[b.k].mod,
    L = Math.hypot(K[0], K[1]);
  if (L < 1e-12) return { ...base, errors: ['Сумма известных векторов равна нулю — направления не определяются.'] };
  const x = (L * L + mA * mA - mB * mB) / (2 * L);
  let h2 = mA * mA - x * x;
  if (h2 < 0 && h2 > -1e-12 * Math.max(mA * mA, L * L)) h2 = 0;
  if (h2 < 0) return { ...base, errors: ['Нет решения: из трёх модулей не составить треугольник.'] };
  const ex: P2 = [K[0] / L, K[1] / L],
    ey: P2 = [-ex[1], ex[0]];
  for (const sg of h2 === 0 ? [1] : [1, -1]) {
    const h = sg * Math.sqrt(h2);
    const A: P2 = [x * ex[0] + h * ey[0], x * ex[1] + h * ey[1]];
    const sa = SIGN[a.k],
      sb = SIGN[b.k];
    sols.push(sol(p, full({ [a.k]: [A[0] / sa, A[1] / sa], [b.k]: [(K[0] - A[0]) / sb, (K[1] - A[1]) / sb] })));
  }
  return { ...base, ok: true, kind: 'sss', sols };
}

/** Два треугольника с общим вектором: линейная система с четырьмя неизвестными. */
function solveTwo(p: TriProblem, C: P2, base: TriResult): TriResult {
  const cp = p.compass;
  const sh = p.shared;
  const tri1: Record<TriVec, TriItem> = { v: p.v, e: p.e, r: p.r };
  const tri2: Record<TriVec, TriItem> = { v: p.v2, e: p.e2, r: p.r2, [sh]: p[sh] } as Record<TriVec, TriItem>;
  // Неизвестные: общий вектор — компоненты (если неизвестны модуль и направление) или модуль; прочие — модули.
  type U = { tri: 0 | 1 | 2; k: TriVec; part: 'xy' | 'm' };
  const unk: U[] = [];
  const names: string[] = [];
  const S = p[sh];
  if (S.qd && !S.qm)
    return { ...base, errors: ['Во втором наблюдении у общего вектора нельзя искать только направление: задайте неизвестными и модуль, или только модуль.'] };
  if (S.qm && S.qd) (unk.push({ tri: 0, k: sh, part: 'xy' }), names.push(`общий вектор (${NAME[sh]} скорости) целиком`));
  else if (S.qm) (unk.push({ tri: 0, k: sh, part: 'm' }), names.push(triUnknownName(sh, 'm')));
  for (const [ti, tri] of [
    [1, tri1],
    [2, tri2],
  ] as const)
    for (const k of TRI_VECS) {
      if (k === sh) continue;
      if (tri[k].qd)
        return { ...base, errors: ['Во втором наблюдении неизвестными могут быть только модули векторов с известными направлениями и общий вектор.'] };
      if (tri[k].qm) (unk.push({ tri: ti, k, part: 'm' }), names.push(triUnknownName(k, 'm', ti === 2)));
    }
  const n = unk.reduce((s, u) => s + (u.part === 'xy' ? 2 : 1), 0);
  base.unknowns = names;
  if (n !== 4) return { ...base, errors: [`Неизвестных должно быть четыре (два векторных равенства), сейчас ${n}.`] };
  // Строки: треугольник 1 — x, y; треугольник 2 — x, y. Столбцы — неизвестные.
  const A: number[][] = [0, 1, 2, 3].map(() => [0, 0, 0, 0]);
  const rhs = [C[0], C[1], C[0], C[1]];
  for (const [ti, tri] of [
    [1, tri1],
    [2, tri2],
  ] as const) {
    const r0 = ti === 1 ? 0 : 2;
    for (const k of TRI_VECS) {
      const it = tri[k];
      const isUnk = k === sh ? S.qm : it.qm;
      if (!isUnk) {
        const q = vec(it, cp);
        rhs[r0] -= SIGN[k] * q[0];
        rhs[r0 + 1] -= SIGN[k] * q[1];
      }
    }
  }
  let col = 0;
  for (const u of unk) {
    if (u.part === 'xy') {
      for (const r0 of [0, 2]) {
        A[r0][col] += SIGN[u.k];
        A[r0 + 1][col + 1] += SIGN[u.k];
      }
      col += 2;
      continue;
    }
    const it = u.tri === 0 ? S : u.tri === 1 ? tri1[u.k] : tri2[u.k];
    const e = unit(it.dir, cp);
    for (const r0 of u.tri === 0 ? [0, 2] : [u.tri === 1 ? 0 : 2]) {
      A[r0][col] += SIGN[u.k] * e[0];
      A[r0 + 1][col] += SIGN[u.k] * e[1];
    }
    col++;
  }
  const x = gauss(A, rhs);
  if (!x.every(Number.isFinite)) return { ...base, errors: ['Система вырождена: направления не позволяют найти неизвестные.'] };
  const got1: Partial<Record<TriVec, P2>> = {},
    got2: Partial<Record<TriVec, P2>> = {};
  col = 0;
  for (const u of unk) {
    if (u.part === 'xy') {
      got1[u.k] = got2[u.k] = [x[col], x[col + 1]];
      col += 2;
      continue;
    }
    const it = u.tri === 0 ? S : u.tri === 1 ? tri1[u.k] : tri2[u.k];
    if (x[col] < -1e-9 * Math.max(1, ...x.map(Math.abs)))
      return { ...base, errors: [`Нет решения при заданных направлениях: ${names[unk.indexOf(u)]} получился отрицательным.`] };
    const e = unit(it.dir, cp);
    const q: P2 = [x[col] * e[0], x[col] * e[1]];
    if (u.tri === 0) got1[u.k] = got2[u.k] = q;
    else (u.tri === 1 ? got1 : got2)[u.k] = q;
    col++;
  }
  const fill = (tri: Record<TriVec, TriItem>, got: Partial<Record<TriVec, P2>>) =>
    Object.fromEntries(TRI_VECS.map((k) => [k, got[k] ?? vec(tri[k], cp)])) as Record<TriVec, P2>;
  return { ...base, ok: true, kind: 'lin4', sols: [sol(p, fill(tri1, got1), fill(tri2, got2))] };
}
