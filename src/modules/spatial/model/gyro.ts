/**
 * Приближённая теория гироскопов (Мещерский §40): кинетический момент ротора считается равным Jω и направленным
 * по оси собственного вращения.
 *
 * Вынужденная прецессия: ось ротора поворачивается с угловой скоростью Ω (угол между осью ротора и осью прецессии β);
 * конец вектора Jω движется со скоростью u = Ω × Jω, и по теореме Резаля к ротору приложен момент M = JωΩ sin β
 * со стороны подшипников; на подшипники действует гироскопический момент M_г = −M (правило Жуковского: момент
 * стремится кратчайшим путём совместить ось ротора с осью прецессии). Добавочные давления на опоры, разнесённые на l:
 * ±M_г/l; к ним добавляется статическое давление N₀. Ω задаётся числом, об/мин, градусами в секунду, движением
 * по кривой (Ω = v/R), колебанием (качка θ = θ₀ sin(2πt/T): Ω_max = 2πθ₀/T) или качением (ω = Ωd/R).
 * Регулярная прецессия под моментом M (сила тяжести P на плече a или сила F на плече h): Ω = M/(Jω).
 * Гиротахометр: рамка на пружинах (c, плечо a) поворачивается на угол α = JωΩ/(2ca²).
 */
export type JMode = 'J' | 'Prho' | 'disc' | 'ring';
export type OmMode = 'rad' | 'rpm' | 'deg' | 'curve' | 'pitch';
export interface GyroProblem {
  jMode: JMode;
  J: number;
  /** Вес (или масса при g = 1), радиус инерции, радиус диска или обода. */
  P: number;
  rho: number;
  r: number;
  g: number;
  /** Собственное вращение: рад/с, об/мин или по качению (ω = Ω·dRoll/R). */
  spin: 'rad' | 'rpm' | 'roll';
  w: number;
  dRoll: number;
  Rroll: number;
  task: 'forced' | 'precession' | 'spring';
  omMode: OmMode;
  Om: number;
  v: number;
  Rc: number;
  amp: number;
  T: number;
  /** Угол между осью ротора и осью прецессии, градусы. */
  beta: number;
  /** Расстояние между опорами и статическое давление на каждую. */
  l: number;
  N0: number;
  /** Одна опора воспринимает добавочное давление (бегун: момент уравновешивают дно чаши и шарнир оси). */
  one: boolean;
  /** Момент для регулярной прецессии: сила и плечо. */
  F: number;
  h: number;
  /** Гиротахометр: жёсткость пружин и плечо. */
  c: number;
  a: number;
}
export interface GyroResult {
  ok: true;
  J: number;
  w: number;
  /** Кинетический момент Jω. */
  K: number;
  Om: number;
  M: number;
  /** Добавочное давление на опору, давления с учётом статического. */
  dN: number | null;
  N: [number, number] | null;
  /** Регулярная прецессия: Ω и период оборота оси. */
  prec: { Om: number; T: number } | null;
  /** Гиротахометр: угол поворота рамки, рад. */
  alpha: number | null;
}
export type GyroOut = GyroResult | { ok: false; error: string };

export function rotorJ(pr: GyroProblem): number {
  const m = pr.P / pr.g;
  switch (pr.jMode) {
    case 'J':
      return pr.J;
    case 'Prho':
      return m * pr.rho ** 2;
    case 'disc':
      return (m * pr.r ** 2) / 2;
    case 'ring':
      return m * pr.r ** 2;
  }
}
export function precessionRate(pr: GyroProblem): number {
  switch (pr.omMode) {
    case 'rad':
      return pr.Om;
    case 'rpm':
      return (pr.Om * Math.PI) / 30;
    case 'deg':
      return (pr.Om * Math.PI) / 180;
    case 'curve':
      return pr.v / pr.Rc;
    case 'pitch':
      return (2 * Math.PI * ((pr.amp * Math.PI) / 180)) / pr.T;
  }
}

export function solveGyro(pr: GyroProblem): GyroOut {
  if (pr.jMode !== 'J' && !(pr.g > 0)) return { ok: false, error: 'Ускорение g — положительное (g = 1, если задана масса).' };
  const J = rotorJ(pr);
  if (!(J > 0)) return { ok: false, error: 'Момент инерции ротора — положительный.' };
  const needOm = pr.task !== 'precession' || pr.spin === 'roll';
  const Om = needOm ? precessionRate(pr) : NaN;
  if (needOm && !Number.isFinite(Om)) return { ok: false, error: 'Угловая скорость прецессии не вычисляется — проверьте данные (радиус кривой, период).' };
  const w = pr.spin === 'rad' ? pr.w : pr.spin === 'rpm' ? (pr.w * Math.PI) / 30 : pr.Rroll > 0 ? (Om * pr.dRoll) / pr.Rroll : NaN;
  if (!(Math.abs(w) > 0) || !Number.isFinite(w)) return { ok: false, error: 'Угловая скорость собственного вращения — не нулевая.' };
  const K = J * w;
  const base = { ok: true as const, J, w, K, dN: null, N: null, prec: null, alpha: null };
  if (pr.task === 'precession') {
    const M = pr.F * pr.h;
    const Op = M / K;
    return { ...base, Om: Op, M, prec: { Om: Op, T: Op !== 0 ? (2 * Math.PI) / Math.abs(Op) : Infinity } };
  }
  const M = K * Om * Math.sin((pr.beta * Math.PI) / 180);
  if (pr.task === 'spring') {
    if (!(pr.c > 0 && pr.a > 0)) return { ok: false, error: 'Жёсткость пружин и плечо — положительные.' };
    return { ...base, Om, M, alpha: M / (2 * pr.c * pr.a ** 2) };
  }
  if (pr.l > 0) {
    const dN = M / pr.l;
    return { ...base, Om, M, dN, N: [pr.N0 + dN, pr.N0 - dN] };
  }
  return { ...base, Om, M };
}
