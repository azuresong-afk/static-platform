/**
 * Плоское движение колеса (цилиндра) по прямой (Мещерский §39).
 *
 * Ось x — вдоль опорной прямой, наклонённой под углом α к горизонту (вниз по уклону, при α = 0 — вправо);
 * положительное вращение — качение вперёд. Силы: вес P, вращающий момент M, сила F в центре вдоль x,
 * сила T под углом β к оси x (вверх от опоры) с плечом e относительно центра («+» — помогает качению),
 * нормальная реакция N = P cos α − T sin β, сила трения F_тр (вдоль x), момент сопротивления качению δN.
 *
 *   m·a_C = P sin α + F + T cos β + F_тр,   J_C·ε = M + T·e − F_тр·r − δN.
 * Сначала предполагаем качение без скольжения (a_C = εr); если требуемая |F_тр| > fN — колесо скользит,
 * и F_тр = ±fN (того же знака, что требовалась); тогда a_C и ε независимы.
 */
export const G = 9.81;

export interface WheelProblem {
  byWeight: boolean;
  m: number;
  g: number;
  r: number;
  inertia: 'disk' | 'ring' | 'rho';
  rho: number;
  alpha: number;
  M: number;
  F: number;
  T: number;
  beta: number;
  e: number;
  f: number;
  fk: number;
  /** Момент времени для скорости и пути (из покоя). */
  t: number;
}

export interface WheelResult {
  ok: boolean;
  errors: string[];
  mass: number;
  P: number;
  J: number;
  rhoEff: number;
  N: number;
  /** Сумма сил вдоль x без трения и сумма моментов без трения. */
  Fx: number;
  Mc: number;
  /** Требуемая сила трения при качении без скольжения. */
  FtrRoll: number;
  rolls: boolean;
  /** Итог. */
  Ftr: number;
  a: number;
  eps: number;
  /** Скорость точки касания (скольжение) через t: v − ωr. */
  slip: number;
  /** Наименьший коэффициент трения для качения без скольжения. */
  fMin: number;
  /** Скорость и путь через t (из покоя). */
  v: number;
  x: number;
  w: number;
  /** Предельное значение действующей величины (M, F или tg α) для качения без скольжения. */
  limit: { what: 'M' | 'F' | 'tgα' | 'T'; value: number } | null;
}

const rad = (a: number) => (a * Math.PI) / 180;
const clean = (v: number) => (Math.abs(v) < 1e-12 ? 0 : v);

/** Требуемая сила трения при качении для заданных величин. */
function rolling(pr: WheelProblem, mass: number, J: number, P: number): { a: number; Ftr: number; N: number; Fx: number; Mc: number } {
  const N = P * Math.cos(rad(pr.alpha)) - pr.T * Math.sin(rad(pr.beta));
  const Fx = P * Math.sin(rad(pr.alpha)) + pr.F + pr.T * Math.cos(rad(pr.beta));
  const Mc = pr.M + pr.T * pr.e - pr.fk * N;
  const a = (Fx + Mc / pr.r) / (mass + J / pr.r ** 2);
  return { a, Ftr: mass * a - Fx, N, Fx, Mc };
}

export function solveWheel(pr: WheelProblem): WheelResult {
  const errors: string[] = [];
  if (!(pr.m > 0)) errors.push('Масса (вес) колеса — положительное число.');
  if (!(pr.r > 0)) errors.push('Радиус колеса — положительное число.');
  if (pr.inertia === 'rho' && !(pr.rho >= 0)) errors.push('Радиус инерции — неотрицательное число.');
  if (pr.f < 0 || pr.fk < 0) errors.push('Коэффициенты трения не могут быть отрицательными.');
  if (!(pr.g > 0)) errors.push('g — положительное число.');
  const mass = pr.byWeight ? pr.m / (pr.g || G) : pr.m;
  const P = mass * pr.g;
  const rhoEff = pr.inertia === 'disk' ? pr.r / Math.SQRT2 : pr.inertia === 'ring' ? pr.r : pr.rho;
  const J = mass * rhoEff ** 2;
  const z = { mass, P, J, rhoEff, N: 0, Fx: 0, Mc: 0, FtrRoll: 0, rolls: true, Ftr: 0, a: 0, eps: 0, slip: 0, fMin: 0, v: 0, x: 0, w: 0, limit: null };
  if (errors.length) return { ok: false, errors, ...z };
  const roll = rolling(pr, mass, J, P);
  if (roll.N < 0) return { ok: false, errors: ['Нормальная реакция отрицательна: колесо отрывается от опоры.'], ...z };
  const fMin = roll.N > 0 ? Math.abs(roll.Ftr) / roll.N : Infinity;
  const rolls = Math.abs(roll.Ftr) <= pr.f * roll.N + 1e-12;
  let a = roll.a,
    eps = roll.a / pr.r,
    Ftr = roll.Ftr;
  if (!rolls) {
    Ftr = Math.sign(roll.Ftr) * pr.f * roll.N;
    a = (roll.Fx + Ftr) / mass;
    eps = J > 0 ? (roll.Mc - Ftr * pr.r) / J : 0;
  }
  // Предел для качения без скольжения: требуемая F_тр линейна по действующей величине.
  let limit: WheelResult['limit'] = null;
  const solveFor = (what: 'M' | 'F' | 'T', key: 'M' | 'F' | 'T') => {
    const val = (x: number) => {
      const q = { ...pr, [key]: x };
      const rr = rolling(q, mass, J, P);
      return Math.abs(rr.Ftr) - pr.f * rr.N;
    };
    // Ищем x того же знака, что задано, при котором |F_тр| = fN.
    const sgn = Math.sign(pr[key]) || 1;
    let lo = 0,
      hi = sgn;
    if (val(lo) > 0) return;
    for (let i = 0; i < 200 && val(hi) <= 0; i++) hi *= 2;
    if (val(hi) <= 0) return;
    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2;
      if (val(mid) <= 0) lo = mid;
      else hi = mid;
    }
    limit = { what, value: (lo + hi) / 2 };
  };
  if (pr.M !== 0) solveFor('M', 'M');
  else if (pr.F !== 0) solveFor('F', 'F');
  else if (pr.T !== 0) solveFor('T', 'T');
  else if (pr.alpha !== 0 && pr.fk === 0) {
    // Только сила тяжести: F_тр = −P sin α·ρ²/(r² + ρ²) ⇒ tg α ≤ f(r² + ρ²)/ρ².
    if (rhoEff > 0) limit = { what: 'tgα', value: (pr.f * (pr.r ** 2 + rhoEff ** 2)) / rhoEff ** 2 };
  }
  const t = pr.t;
  return {
    ok: true,
    errors: [],
    mass,
    P,
    J,
    rhoEff,
    N: clean(roll.N),
    Fx: clean(roll.Fx),
    Mc: clean(roll.Mc),
    FtrRoll: clean(roll.Ftr),
    rolls,
    Ftr: clean(Ftr),
    a: clean(a),
    eps: clean(eps),
    slip: clean((a - eps * pr.r) * t),
    fMin,
    v: clean(a * t),
    x: clean((a * t * t) / 2),
    w: clean(eps * t),
    limit,
  };
}
