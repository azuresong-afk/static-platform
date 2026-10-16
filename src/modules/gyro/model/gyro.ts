/**
 * Приближённая теория гироскопов (Мещерский §40): кинетический момент ротора считается равным H = Jω и направлен
 * по оси собственного вращения; поворот оси с угловой скоростью ω₁ (прецессия) требует момента dH/dt = ω₁ × H.
 * Ротор давит на опоры с гироскопическим моментом M_г = H × ω₁ = −ω₁ × H, |M_г| = Jωω₁ sin β (β — угол между осью
 * ротора и осью прецессии). Правило Жуковского: момент стремится кратчайшим путём совместить ось ротора с осью
 * прецессии.
 *
 * Режимы:
 * - forced — вынужденная прецессия: гироскопический момент, добавочные давления на опоры (ΔN = M_г/l), полные
 *   давления со статическими; бегун или коническое колесо, катящееся по неподвижному основанию, — добавочное давление
 *   на основание (ось бегуна на шарнире на оси прецессии, плечо d: ΔN = M_г/d);
 * - free — прецессия под действием момента: ω_п = M₀/H (момент силы тяжести P·l, силы F·h или заданный),
 *   период полного оборота T = 2π/ω_п;
 * - balance — равновесие оси: пружины гиротахометра (α = Jωω₁/(n·c·a²)) или маятниковый гироскоп на вращающемся
 *   основании (Jω·Ω_о·sin(γ − α) = H_ст·sin α).
 *
 * Единицы: СИ (кг, Н, м) или техническая система (вес — кГ, силы — кГ, J — кГ·м·с²; масса = P/g).
 */
export type GyroMode = 'forced' | 'free' | 'balance';
export type Units = 'si' | 'tech';
export type JMode = 'J' | 'rho' | 'disc' | 'ring' | 'H';
export type SpinMode = 'rate' | 'rpm' | 'roll' | 'runner';
export type PrecMode = 'rate' | 'rpm' | 'degs' | 'turn' | 'pitch';
export type SupMode = 'rotor' | 'prec' | 'roller';
export type StatMode = 'none' | 'split' | 'lever' | 'weight';
export type SrcMode = 'weight' | 'force' | 'moment';
export type BalMode = 'spring' | 'pendulum';

export interface GyroProblem {
  mode: GyroMode;
  units: Units;
  g: number;
  /** Ротор: масса m (СИ) или вес (техн.), момент инерции J, радиус инерции ρ или радиус R диска / обода; H — задан сразу. */
  jMode: JMode;
  m: number;
  J: number;
  rho: number;
  R: number;
  H: number;
  /** Собственное вращение: ω (с⁻¹ или об/мин), качение колеса ω = v/a, бегун ω = ω₁·d/r_к. */
  spin: SpinMode;
  om: number;
  v: number;
  a: number;
  d: number;
  rc: number;
  /** Прецессия: ω₁ (с⁻¹, об/мин, °/с), поворот по закруглению ω₁ = v/R, качка — наибольшая ω₁ = 2πθ₀/T. */
  prec: PrecMode;
  w1: number;
  vp: number;
  Rp: number;
  amp: number;
  T: number;
  /** Угол между осью ротора и осью прецессии, °. */
  beta: number;
  /** Опоры: на оси ротора, на оси прецессии (расстояние l) или бегун на основании (плечо d). */
  sup: SupMode;
  l: number;
  /** Статические давления: нет; вес P делится между опорами (центр на расстоянии c от A); вес с плечом e (боковые P·e/l); вес на основание. */
  stat: StatMode;
  P: number;
  c: number;
  e: number;
  /** Прецессия под действием момента: вес ротора с плечом l₀, сила F с плечом h или момент M₀. */
  src: SrcMode;
  l0: number;
  F: number;
  h: number;
  M0: number;
  /** Равновесие: пружины (жёсткость cs, плечо as, число ns) или маятник (Ω_о, угол γ оси основания с вертикалью, H_ст). */
  bal: BalMode;
  cs: number;
  as: number;
  ns: number;
  Ob: number;
  gam: number;
  Hst: number;
}

export interface GyroResult {
  ok: boolean;
  errors: string[];
  /** Масса (кг или кГ·с²/м), момент инерции, кинетический момент. */
  mass: number;
  J: number;
  H: number;
  om: number;
  w1: number;
  /** Гироскопический момент. */
  M: number;
  /** forced: добавочное давление и давления на опоры A и B (или на основание). */
  dN: number;
  NA: number | null;
  NB: number | null;
  Nst: number | null;
  ratio: number | null;
  /** Знак добавки на опоре A (+1 — давление растёт), по направлениям вращений. */
  sA: number;
  /** free: момент M₀ (M = M₀ sin θ), скорость прецессии и период. */
  M0: number;
  wp: number;
  Tp: number;
  /** balance: угол отклонения, °. */
  alpha: number;
}

const D2R = Math.PI / 180;

export function solveGyro(pr: GyroProblem): GyroResult {
  const errors: string[] = [];
  const res: GyroResult = {
    ok: false,
    errors,
    mass: 0,
    J: 0,
    H: 0,
    om: 0,
    w1: 0,
    M: 0,
    dN: 0,
    NA: null,
    NB: null,
    Nst: null,
    ratio: null,
    sA: 1,
    M0: 0,
    wp: 0,
    Tp: 0,
    alpha: 0,
  };
  const nums = Object.values(pr).filter((v) => typeof v === 'number') as number[];
  if (!nums.every(Number.isFinite)) return (errors.push('Есть незаполненные числа.'), res);
  if (!(pr.g > 0)) errors.push('Ускорение свободного падения должно быть положительным.');
  // Масса: в технической системе задаётся вес, масса = P/g.
  const mass = pr.units === 'tech' ? pr.m / pr.g : pr.m;
  let J = 0,
    H = 0;
  const pos = (v: number, what: string) => {
    if (!(v > 0)) errors.push(`${what} должен быть положительным.`);
  };
  if (pr.jMode === 'H') {
    if (pr.mode !== 'free') errors.push('Кинетический момент сразу задаётся только для прецессии под действием момента.');
    pos(pr.H, 'Кинетический момент H');
    H = pr.H;
  } else {
    if (pr.jMode === 'J') pos(pr.J, 'Момент инерции J');
    else {
      pos(pr.m, pr.units === 'tech' ? 'Вес ротора' : 'Масса ротора');
      pos(pr.jMode === 'rho' ? pr.rho : pr.R, pr.jMode === 'rho' ? 'Радиус инерции' : 'Радиус');
    }
    J = pr.jMode === 'J' ? pr.J : pr.jMode === 'rho' ? mass * pr.rho ** 2 : pr.jMode === 'disc' ? (mass * pr.R ** 2) / 2 : mass * pr.R ** 2;
  }
  // Прецессия (вынужденная или вращение основания для гиротахометра).
  let w1 = 0;
  if (pr.mode === 'forced' || (pr.mode === 'balance' && pr.bal === 'spring')) {
    if (pr.prec === 'rate') w1 = pr.w1;
    else if (pr.prec === 'rpm') w1 = (pr.w1 * Math.PI) / 30;
    else if (pr.prec === 'degs') w1 = pr.w1 * D2R;
    else if (pr.prec === 'turn') {
      pos(pr.Rp, 'Радиус закругления');
      w1 = pr.vp / pr.Rp;
    } else {
      pos(pr.T, 'Период качки');
      w1 = (2 * Math.PI * pr.amp * D2R) / pr.T;
    }
  }
  // Собственное вращение.
  let om = 0;
  if (pr.jMode !== 'H') {
    if (pr.spin === 'rate') om = pr.om;
    else if (pr.spin === 'rpm') om = (pr.om * Math.PI) / 30;
    else if (pr.spin === 'roll') {
      pos(pr.a, 'Радиус колеса');
      om = pr.v / pr.a;
    } else {
      if (pr.mode !== 'forced') errors.push('Вращение бегуна по качению — только для вынужденной прецессии.');
      pos(pr.rc, 'Радиус бегуна в точке касания');
      pos(pr.d, 'Расстояние d от оси прецессии до точки касания');
      om = (w1 * pr.d) / pr.rc;
    }
    H = J * om;
  }
  if (errors.length) return res;
  Object.assign(res, { mass, J, H, om, w1 });
  if (pr.mode === 'forced') {
    const sb = Math.sin(pr.beta * D2R);
    const M = Math.abs(J * om * w1 * sb);
    res.M = M;
    // Знак: опоры на оси ротора A→B, ω вдоль A→B, ω₁ — против часовой стрелки при взгляде с конца оси прецессии;
    // ротор давит на B в сторону e_y·sign(ωω₁ sin β), на A — в обратную. Давление (в сторону −y) на A растёт при s > 0.
    res.sA = Math.sign(om * w1 * sb) || 1;
    if (pr.sup === 'roller') {
      if (pr.spin !== 'runner') pos(pr.d, 'Плечо d');
      if (errors.length) return res;
      res.dN = M / pr.d;
      if (pr.stat === 'weight') {
        res.Nst = pr.P;
        res.NA = pr.P + res.dN;
      }
    } else {
      pos(pr.l, 'Расстояние между опорами l');
      if (errors.length) return res;
      res.dN = M / pr.l;
      if (pr.stat === 'split') {
        const NA0 = (pr.P * (pr.l - pr.c)) / pr.l,
          NB0 = (pr.P * pr.c) / pr.l;
        res.NA = NA0 + res.sA * res.dN;
        res.NB = NB0 - res.sA * res.dN;
        res.Nst = NA0;
      } else if (pr.stat === 'lever') {
        res.Nst = Math.abs((pr.P * pr.e) / pr.l);
        if (res.Nst > 0) res.ratio = res.dN / res.Nst;
      }
    }
  } else if (pr.mode === 'free') {
    if (!(H > 0)) errors.push('Ротор должен вращаться: кинетический момент равен нулю.');
    const weight = pr.units === 'tech' ? pr.m : pr.m * pr.g;
    if (pr.src === 'weight' && pr.jMode === 'H') errors.push('Момент силы тяжести считается по весу ротора — задайте ротор, а не H.');
    const M0 = pr.src === 'weight' ? weight * pr.l0 : pr.src === 'force' ? pr.F * pr.h : pr.M0;
    if (!(M0 > 0)) errors.push('Момент, вызывающий прецессию, должен быть положительным.');
    if (errors.length) return res;
    res.M0 = M0;
    res.wp = M0 / H;
    res.Tp = (2 * Math.PI) / res.wp;
  } else if (pr.bal === 'spring') {
    pos(pr.cs, 'Жёсткость пружины');
    pos(pr.as, 'Плечо пружины');
    pos(pr.ns, 'Число пружин');
    if (errors.length) return res;
    res.M = Math.abs(J * om * w1);
    // Малый угол: момент пружин n·c·a²·α уравновешивает гироскопический Jωω₁ (cos α ≈ 1).
    res.alpha = res.M / (pr.ns * pr.cs * pr.as ** 2) / D2R;
  } else {
    pos(pr.Hst, 'Статический момент');
    if (errors.length) return res;
    // Jω·Ω_о·sin(γ − α) = H_ст·sin α  ⇒  tg α = Jω·Ω_о·sin γ / (H_ст + Jω·Ω_о·cos γ).
    const K = H * pr.Ob;
    res.M = K;
    const g = pr.gam * D2R;
    res.alpha = Math.atan2(K * Math.sin(g), pr.Hst + K * Math.cos(g)) / D2R;
  }
  if (errors.length) return res;
  res.ok = true;
  return res;
}

/** Единицы силы, момента инерции, кинетического момента. */
export function unitsOf(u: Units) {
  return u === 'tech'
    ? { F: 'кГ', J: 'кГ·м·с²', H: 'кГ·м·с', M: 'кГ·м', m: 'кГ·с²/м', P: 'вес P, кГ' }
    : { F: 'Н', J: 'кг·м²', H: 'кг·м²/с', M: 'Н·м', m: 'кг', P: 'масса m, кг' };
}
