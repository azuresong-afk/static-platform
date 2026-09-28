/**
 * Внутренние усилия N, Q, M методом сечений — для любой конструкции-дерева (балка, рама).
 *
 * Участок — отрезок прямой от точки P0 к точке P1 (цепочка участков рамы на одной прямой) с ортом u = (P1 − P0)/L.
 * Сечение на расстоянии s от P0 (0 < s < L) делит конструкцию на две части; «своя» часть — та, где лежит P0.
 * Усилия — от внешних сил своей части (нагрузки и найденные реакции):
 *   N = −Σ F·u            (растяжение — «+»),
 *   Q =  Σ F·n, n = u, повёрнутый на 90° против часовой   (для балки слева направо: сила вверх слева — «+»),
 *   M = −Σ mom_P(F)       (моменты против часовой — «+»; для балки: изгиб выпуклостью вниз — «+»).
 * Для балки, где u направлен слева направо, это правила знаков Антонова и большинства учебников.
 * Каждая нагрузка даёт слагаемое — многочлен от s; сумма — эпюры на участке.
 */
import { polyAdd, type Poly } from '../../../shared/poly';
import type { Pt } from '../../frames/model/geometry';

export interface PointForce {
  kind: 'force';
  id: string;
  r: Pt;
  /** Вектор силы (с найденным значением). */
  F: Pt;
}
export interface Couple {
  kind: 'couple';
  id: string;
  r: Pt;
  /** Момент пары, против часовой — «+». */
  m: number;
}
/** Линейная распределённая нагрузка на отрезке P0–P1: q0, q1 — интенсивность по направлению d (орт). */
export interface LinearLoad {
  kind: 'dist';
  id: string;
  P0: Pt;
  P1: Pt;
  q0: number;
  q1: number;
  d: Pt;
}

/** Вклад нагрузки в усилия на участке. */
export interface Contribution {
  N: Poly;
  Q: Poly;
  M: Poly;
}

const cross = (a: Pt, b: Pt) => a[0] * b[1] - a[1] * b[0];
const dot = (a: Pt, b: Pt) => a[0] * b[0] + a[1] * b[1];
const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];

export interface Frame {
  P0: Pt;
  u: Pt;
  n: Pt;
  L: number;
}

export function frameOf(P0: Pt, P1: Pt): Frame {
  const L = Math.hypot(P1[0] - P0[0], P1[1] - P0[1]);
  const u: Pt = [(P1[0] - P0[0]) / L, (P1[1] - P0[1]) / L];
  return { P0, u, n: [-u[1], u[0]], L };
}

/** Сила F в точке r своей части: вклад в N, Q, M сечения на расстоянии s. */
export function forceContribution(f: Frame, r: Pt, F: Pt): Contribution {
  // mom_P(s)(F) = (r − P0 − s·u) × F = (r − P0) × F − s·(u × F); M = −mom.
  return { N: [-dot(F, f.u)], Q: [dot(F, f.n)], M: [-cross(sub(r, f.P0), F), cross(f.u, F)] };
}

export function coupleContribution(m: number): Contribution {
  return { N: [0], Q: [0], M: [-m] };
}

/**
 * Распределённая нагрузка своей части, целиком за началом участка: заменяется точно
 * равнодействующими равномерной части (q0·l в середине) и треугольной ((q1 − q0)·l/2 на 2/3 длины от P0).
 */
export function distBehindContribution(f: Frame, w: LinearLoad): Contribution {
  const l = Math.hypot(w.P1[0] - w.P0[0], w.P1[1] - w.P0[1]);
  const at = (t: number): Pt => [w.P0[0] + (w.P1[0] - w.P0[0]) * t, w.P0[1] + (w.P1[1] - w.P0[1]) * t];
  const uni = forceContribution(f, at(0.5), [w.d[0] * w.q0 * l, w.d[1] * w.q0 * l]);
  const tri = forceContribution(f, at(2 / 3), [(w.d[0] * (w.q1 - w.q0) * l) / 2, (w.d[1] * (w.q1 - w.q0) * l) / 2]);
  return { N: polyAdd(uni.N, tri.N), Q: polyAdd(uni.Q, tri.Q), M: polyAdd(uni.M, tri.M) };
}

/**
 * Распределённая нагрузка на самом участке: q(t) = qa + k·t от начала участка (t — расстояние от P0).
 * В сечение s входит часть от 0 до s:
 *   ∫ q dt = qa·s + k·s²/2;   ∫ (t − s)·q dt = −qa·s²/2 − k·s³/6.
 */
export function distOwnContribution(f: Frame, qa: number, k: number, d: Pt): Contribution {
  const R: Poly = [0, qa, k / 2];
  const c = cross(f.u, d);
  return {
    N: R.map((x) => -x * dot(d, f.u)),
    Q: R.map((x) => x * dot(d, f.n)),
    M: [0, 0, c * (qa / 2), c * (k / 6)],
  };
}
