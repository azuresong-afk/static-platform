/**
 * Принцип Даламбера: динамические реакции тела, вращающегося вокруг неподвижной оси z
 * (Мещерский §41–42; Антонов п. 9.10).
 *
 * Тело — набор частей (как во вкладке «Геометрия масс»): масса, центр масс, ось симметрии, размеры, вырезы.
 * Оси x, y неизменно связаны с телом и взяты в рассматриваемый момент. Ось вращения z закреплена
 * в подпятнике A (воспринимает и осевую силу) и подшипнике B; угловая скорость ω и ускорение ε — заданы.
 *
 * Силы инерции приводятся к центру O (начало координат на оси):
 *   Φ = −M a_C = M(ω²x_C + εy_C, ω²y_C − εx_C, 0),
 *   M^Φ_O = −(I_O ε + ω × I_O ω) = (εJ_xz − ω²J_yz, εJ_yz + ω²J_xz, −εJ_z),  J_xz = Σmxz, J_yz = Σmyz.
 * Уравнения кинетостатики: реакции + силы тяжести + силы инерции = 0, моменты относительно O = 0;
 * уравнение моментов относительно z даёт вращающий момент, необходимый для заданного ε.
 * Реакции делятся на статические (от силы тяжести) и динамические (от сил инерции); давления на опоры — обратны реакциям.
 *
 * Вращение под действием пары с моментом M относительно оси z (Яблонский, Д.17): уравнение моментов относительно z
 * M + M^G_z − εJ_z = 0 даёт ε = (M + M^G_z)/J_z. Оно постоянно, если момент силы тяжести относительно оси не меняется при
 * повороте (вал вертикален, центр масс на оси или сила тяжести не учитывается); тогда ω = ω₀ + ε·τ в момент τ.
 */
import { G, centralTensor, massOf, steinerTensor, validate as validateParts, type IPart, type M3, type V3 } from '../../inertia/model/inertia';

export interface ShaftProblem {
  parts: IPart[];
  byWeight: boolean;
  /** Координаты подпятника A и подшипника B на оси z. */
  zA: number;
  zB: number;
  /** Сила тяжести: вертикальный вал (−z), горизонтальный (−y) или без неё. */
  gravity: 'z' | 'y' | 'none';
  omega: number;
  eps: number;
  /** Вращение под действием пары: момент M относительно z, момент времени τ и начальная угловая скорость ω₀ (тогда omega, eps не используются). */
  drive?: { M: number; t: number; omega0: number };
}

/** Реакции: X_A, Y_A, Z_A, X_B, Y_B. */
export interface Reactions {
  XA: number;
  YA: number;
  ZA: number;
  XB: number;
  YB: number;
}

export interface ShaftResult {
  ok: boolean;
  errors: string[];
  M: number;
  C: V3;
  /** Тензор инерции относительно O. */
  I: M3;
  /** Центробежные моменты Σmxz, Σmyz и осевой J_z. */
  Jxz: number;
  Jyz: number;
  Jz: number;
  /** Главный вектор и главный момент сил инерции (относительно O). */
  Phi: V3;
  MPhi: V3;
  /** Сила тяжести и её момент относительно O. */
  Gv: V3;
  MG: V3;
  stat: Reactions;
  dyn: Reactions;
  total: Reactions;
  /** Вращающий момент относительно оси z, нужный для заданного ε (при вращении под действием пары — заданный M). */
  Mz: number;
  /** Угловая скорость и ускорение в рассматриваемый момент (заданные или найденные по моменту пары). */
  omega: number;
  eps: number;
}

const clean = (v: number) => (Math.abs(v) < 1e-12 ? 0 : v);
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const zero = (): Reactions => ({ XA: 0, YA: 0, ZA: 0, XB: 0, YB: 0 });

/** Реакции от силы F (в O) и момента L (относительно O): ΣF + R = 0, ΣM + r × R = 0. */
function react(F: V3, L: V3, zA: number, zB: number): Reactions {
  // x-моменты: −zA·YA − zB·YB + Lx = 0; силы: YA + YB + Fy = 0.
  // y-моменты:  zA·XA + zB·XB + Ly = 0; силы: XA + XB + Fx = 0.
  const d = zB - zA;
  const ya = (-L[0] - zB * F[1]) / d;
  const yb = -F[1] - ya;
  const xa = (L[1] - zB * F[0]) / d;
  const xb = -F[0] - xa;
  return { XA: clean(xa), YA: clean(ya), ZA: clean(-F[2]), XB: clean(xb), YB: clean(yb) };
}

export function solveShaft(pr: ShaftProblem): ShaftResult {
  const errors = validateParts({ parts: pr.parts, A: [0, 0, 0], axis: [0, 0, 1], byWeight: pr.byWeight });
  if (!(Math.abs(pr.zB - pr.zA) > 1e-12)) errors.push('Подпятник и подшипник должны быть в разных точках оси.');
  const I: M3 = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  let M = 0;
  const S: V3 = [0, 0, 0];
  if (!errors.length)
    for (const q of pr.parts) {
      const m = massOf(q, pr.byWeight);
      const Ic = centralTensor(q, m),
        St = steinerTensor(m, q.c);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) I[i][j] += q.s * (Ic[i][j] + St[i][j]);
      M += q.s * m;
      for (let i = 0; i < 3; i++) S[i] += q.s * m * q.c[i];
    }
  if (!errors.length && !(M > 1e-12)) errors.push('Масса тела с учётом вырезов должна быть положительной.');
  const empty = { M, C: [0, 0, 0] as V3, I, Jxz: 0, Jyz: 0, Jz: 0, Phi: [0, 0, 0] as V3, MPhi: [0, 0, 0] as V3, Gv: [0, 0, 0] as V3, MG: [0, 0, 0] as V3, stat: zero(), dyn: zero(), total: zero(), Mz: 0, omega: 0, eps: 0 };
  if (errors.length) return { ok: false, errors, ...empty };
  const C = S.map((x) => clean(x / M)) as V3;
  const Jxz = clean(-I[0][2]),
    Jyz = clean(-I[1][2]),
    Jz = clean(I[2][2]);
  // Сила тяжести P = Mg (при заданных весах M = ΣP/g, так что P = ΣP).
  const P = M * G;
  const Gv: V3 = pr.gravity === 'z' ? [0, 0, -P] : pr.gravity === 'y' ? [0, -P, 0] : [0, 0, 0];
  const MG = cross(C, Gv).map(clean) as V3;
  let w = pr.omega,
    e = pr.eps;
  if (pr.drive) {
    const dr = pr.drive;
    const err: string[] = [];
    if (!(Jz > 1e-12)) err.push('Момент инерции относительно оси вращения равен нулю — угловое ускорение по моменту пары не определяется.');
    if (pr.gravity === 'y' && Math.hypot(C[0], C[1]) > 1e-9)
      err.push('Вал горизонтален, а центр масс не на оси: момент силы тяжести относительно оси меняется при повороте, ε не постоянно и ω = ω₀ + ετ неприменимо — задайте ω и ε в рассматриваемый момент.');
    if (!(dr.t >= 0)) err.push('Момент времени τ не может быть отрицательным.');
    if (err.length) return { ok: false, errors: err, ...empty };
    e = clean((dr.M + MG[2]) / Jz);
    w = clean(dr.omega0 + e * dr.t);
  }
  const Phi: V3 = [clean(M * (w * w * C[0] + e * C[1])), clean(M * (w * w * C[1] - e * C[0])), 0];
  const MPhi: V3 = [clean(e * Jxz - w * w * Jyz), clean(e * Jyz + w * w * Jxz), clean(-e * Jz)];
  const stat = react(Gv, MG, pr.zA, pr.zB);
  const dyn = react(Phi, MPhi, pr.zA, pr.zB);
  const total: Reactions = { XA: clean(stat.XA + dyn.XA), YA: clean(stat.YA + dyn.YA), ZA: clean(stat.ZA + dyn.ZA), XB: clean(stat.XB + dyn.XB), YB: clean(stat.YB + dyn.YB) };
  const Mz = clean(-(MG[2] + MPhi[2]));
  return { ok: true, errors: [], M, C, I, Jxz, Jyz, Jz, Phi, MPhi, Gv, MG, stat, dyn, total, Mz, omega: w, eps: e };
}
