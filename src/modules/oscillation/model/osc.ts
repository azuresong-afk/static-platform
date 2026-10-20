/**
 * Прямолинейные колебания груза на упругом элементе (Мещерский §32, §53; Антонов, гл. 10).
 *
 * Груз массы m движется по оси x: горизонтально (вправо), вертикально (вниз) или по гладкой наклонной плоскости
 * (вниз по уклону, угол α к горизонту). x отсчитывается от положения статического равновесия, в котором упругий
 * элемент деформирован на δ_ст = (P sin α + Q)/c (Q — постоянная сила вдоль оси). Сила тяжести и Q уравновешены
 * этой деформацией, и уравнение движения
 *   m ẍ = −c x − b ẋ + H sin(pt + δ),  или  ẍ + 2n ẋ + k² x = h sin(pt + δ),
 * k² = c/m, 2n = b/m, h = H/m. Возмущение: сила H sin(pt + δ); неуравновешенный ротор (H = m₀ e p²);
 * перемещение точки крепления упругого элемента ξ = a sin(pt + δ) (H = c·a).
 *
 * Решение — аналитическое: общее решение однородного уравнения (n = 0; n < k; n = k; n > k) плюс частное решение
 * (при n = 0 и p = k — резонансное, с множителем t), постоянные — из начальных условий. Сухое трение (сила fN против
 * скорости) — по полуразмахам: каждый полуразмах — гармоническое колебание около смещённого центра ±fN/c.
 *
 * Удар: груз падает с высоты h на недеформированный элемент и дальше движется вместе с ним (x₀ = −δ_ст,
 * v₀ = √(2gh)). Масса элемента — по Рэлею: удар неупругий, скорость после удара v·M/(M + βm_эл). Наибольшая деформация
 * λ_max = δ_ст + x_max, коэффициент динамичности K_д = λ_max/δ_ст = 1 + √(1 + 2h/(δ_ст(1 + βm_эл/M))).
 *
 * Единицы — согласованные: длина (м, см, мм), сила (Н, кН, кГ, Г, т); масса — в единицах силы·с²/длину
 * (если задан вес P, то m = P/g; если масса в кг — пересчёт). Напряжения — сила/длина².
 */
import { beamUnit, massCoef, stiffness, type Elem, type Stage, type StiffResult } from './elastic';

export type LenUnit = 'm' | 'cm' | 'mm';
export type ForceUnit = 'N' | 'kN' | 'kG' | 'G' | 't';
export const LEN_LABEL: Record<LenUnit, string> = { m: 'м', cm: 'см', mm: 'мм' };
export const FORCE_LABEL: Record<ForceUnit, string> = { N: 'Н', kN: 'кН', kG: 'кГ', G: 'Г', t: 'т' };
/** Сила в ньютонах. */
const FORCE_N: Record<ForceUnit, number> = { N: 1, kN: 1000, kG: 9.81, G: 0.00981, t: 9810 };
/** Длина в метрах. */
const LEN_M: Record<LenUnit, number> = { m: 1, cm: 0.01, mm: 0.001 };

export type Orient = 'h' | 'v' | 'incl';
export type StiffMode = 'c' | 'static' | 'period' | 'elems';
export type DampMode = 'none' | 'b' | 'n' | 'ratio' | 'T1' | 'dry';
export type ForceMode = 'none' | 'H' | 'rotor' | 'base' | 'support' | 'two' | 'ramp' | 'exp' | 'pulse' | 'ramphold' | 'cam';
/** Возмущения с гармонической силой (есть частота p и сдвиг фазы). */
export const HARMONIC: ForceMode[] = ['H', 'rotor', 'base', 'support', 'two'];
export type InitMode = 'eq' | 'lambda' | 'load' | 'drop';

export interface OscProblem {
  len: LenUnit;
  force: ForceUnit;
  /** Ускорение свободного падения, м/с² (в расчёте пересчитывается в единицы длины). */
  gms: number;
  /** Масса задана весом P (в единицах силы); иначе — масса в кг. */
  byWeight: boolean;
  m: number;
  orient: Orient;
  /** Наклон плоскости к горизонту, градусы (для incl). */
  alpha: number;
  /** Постоянная сила вдоль оси x (кроме силы тяжести). */
  Q: number;
  el: {
    mode: StiffMode;
    c: number;
    /** Статическая деформация под нагрузкой P sin α + Q. */
    dst: number;
    /** Измеренный период колебаний. */
    T0: number;
    /** Период измерен при наличии сопротивления (это T₁ затухающих колебаний). */
    T0damped: boolean;
    stages: Stage[];
    /** Элемент работает только на растяжение (трос, нить). */
    rope: boolean;
    /** Масса элемента (вес, если byWeight; 0 — не учитывать). */
    mEl: number;
    /** Момент сопротивления сечения балки для проверки прочности (0 — не проверять). */
    W: number;
    /** Допускаемое напряжение (0 — не проверять). */
    sAllow: number;
  };
  damp: {
    mode: DampMode;
    /** Коэффициент вязкого сопротивления: R = −b·ẋ. */
    b: number;
    n: number;
    /** Амплитуда уменьшилась в q раз за N полных колебаний. */
    q: number;
    N: number;
    /** Период затухающих колебаний. */
    T1: number;
    /** Сухое трение: коэффициенты трения скольжения и покоя. */
    f: number;
    f0: number;
    /** Демпфер на рычаге: плечо демпфера a и плечо груза b (b = 0 — рычага нет); b_пр = b·(a/b)². */
    la: number;
    lb: number;
  };
  exc: {
    mode: ForceMode;
    H: number;
    /** Ротор: неуравновешенная масса (вес, если byWeight) и эксцентриситет. */
    m0: number;
    e: number;
    /** Перемещение точки крепления (base, support, cam): амплитуда. */
    a: number;
    p: number;
    /** Начальная фаза, градусы. */
    delta: number;
    /** support: масса, через которую ускорение основания действует на систему (0 — вся масса m; вес, если byWeight). */
    mc: number;
    /** two: вторая гармоника H₂ sin(p₂t + δ₂). */
    H2: number;
    p2: number;
    delta2: number;
    /** exp: F = H·e^{−βt}. */
    beta: number;
    /** pulse, ramphold: длительность τ. */
    tau: number;
    /** cam: жёсткость пружины, через которую движется кулачок. */
    c1: number;
    /** Длина участка пути между толчками (рельс), для критической скорости; 0 — не нужна. */
    L: number;
  };
  init: {
    mode: InitMode;
    x0: number;
    /** Начальная деформация упругого элемента. */
    lambda0: number;
    /** Нагрузка вдоль оси, при которой система была в равновесии до начала движения. */
    Fprev: number;
    /** Высота падения. */
    h: number;
    v0: number;
  };
  /** Момент времени, в который нужно состояние. */
  t: number;
}

export type Regime = 'free' | 'under' | 'critical' | 'over' | 'dry';

export interface HalfSwing {
  /** Начало и конец полуразмаха (крайние положения), центр колебаний, время начала и длительность. */
  x1: number;
  x2: number;
  center: number;
  t1: number;
  dur: number;
}

export interface Forced {
  /** Амплитуда силы и h = H/m. */
  H: number;
  h: number;
  p: number;
  /** Коэффициент расстройки z = p/k. */
  z: number;
  /** Резонанс без сопротивления. */
  resonance: boolean;
  /** Амплитуда вынужденных колебаний (при резонансе — null). */
  B: number | null;
  /** Сдвиг фазы ε (рад, 0…π). */
  eps: number;
  /** Коэффициент динамичности η = B/(H/c). */
  eta: number | null;
  /** Частота, при которой амплитуда наибольшая, и наибольшая амплитуда (только при постоянной H и n < k/√2). */
  pStar: number | null;
  Bmax: number | null;
  /** Амплитуда силы, передаваемой на основание (через упругий элемент и демпфер). */
  Ntr: number | null;
  /** Движение основания (support): отношение амплитуды относительного движения к амплитуде основания и абсолютного — к ней же. */
  rel: number | null;
  abs: number | null;
  /** Начальная фаза возмущения, рад. */
  delta: number;
}

/** Слагаемое возмущающей силы на отрезке времени, на единицу массы (h = F/m). */
export type Term =
  /** h(t) = h0 + s(t − t0). */
  | { k: 'poly'; h0: number; s: number; t0: number }
  /** h(t) = h0·e^{−βt}. */
  | { k: 'exp'; h0: number; beta: number }
  /** h(t) = h·sin(pt + δ). */
  | { k: 'harm'; h: number; p: number; dl: number };

/** Участок движения: на [t0, t1) действует одна и та же сила; решение — свободные колебания от состояния в t0 плюс частное. */
export interface PieceInfo {
  t0: number;
  t1: number;
  terms: Term[];
  /** Постоянные однородного решения в местном времени τ = t − t0. */
  C1: number;
  C2: number;
  /** Состояние в начале участка. */
  xs: number;
  vs: number;
}

/** Кратковременные и непериодические возмущения: наибольшее смещение в долях статического F/c. */
export interface Trans {
  mode: ForceMode;
  /** Наибольшая сила (F₀) или скорость нарастания (ramp). */
  H: number;
  /** F₀/c — смещение под постоянной силой F₀ (null — у ramp и cam). */
  xst: number | null;
  /** max|x|/xst. */
  ratio: number | null;
  tau: number | null;
}

export interface Extreme {
  x: number;
  t: number;
}

export interface OscResult {
  ok: boolean;
  errors: string[];
  g: number;
  /** Масса груза, приведённая масса элемента, полная масса. */
  mLoad: number;
  beta: number | null;
  mRed: number;
  m: number;
  /** Вес груза (для текста) и проекция на ось. */
  P: number;
  Pax: number;
  stiff: StiffResult | null;
  c: number;
  dst: number;
  k: number;
  T0: number;
  freq: number;
  b: number;
  n: number;
  regime: Regime;
  k1: number | null;
  T1: number | null;
  /** Корни характеристического уравнения при n > k. */
  roots: [number, number] | null;
  forced: Forced | null;
  /** Вторая гармоника (возмущение two). */
  forced2: Forced | null;
  trans: Trans | null;
  pieces: PieceInfo[];
  /** Возмущающая сила на единицу массы h(t) = F(t)/m. */
  fext: (t: number) => number;
  /** Критическая скорость L/T₀ и скорость при данной частоте возмущения L·p/2π (если задана длина участка L). */
  rail: { vCrit: number; v: number } | null;
  /** Начальные условия от положения равновесия; скорость в момент касания (удар) и сразу после него. */
  x0: number;
  v0: number;
  vHit: number | null;
  /** Постоянные однородного решения. */
  C1: number;
  C2: number;
  /** Свободные гармонические колебания: амплитуда и начальная фаза (x = A sin(kt + φ)). */
  A: number | null;
  phase: number | null;
  /** Сухое трение. */
  dry: { D: number; D0: number; N: number; swings: HalfSwing[]; stop: Extreme } | null;
  x: (t: number) => number;
  v: (t: number) => number;
  tEnd: number;
  max: Extreme;
  min: Extreme;
  /** Наибольшая и наименьшая деформации упругого элемента, наибольшая по модулю сила в нём; K_д = λ_max/δ_ст. */
  lamMax: number;
  lamMin: number;
  Fmax: number;
  Kd: number | null;
  /** Элемент только растягивается (трос) или груз только давит (удар): момент, когда сила в элементе обращается в нуль. */
  slack: number | null;
  /** Напряжение в элементе (одиночный стержень или балка). */
  stress: { s1: number; sst: number; smax: number; ok: boolean | null } | null;
  /** Состояние в момент t. */
  at: { t: number; x: number; v: number; a: number; F: number };
  curve: [number, number][];
  /** Наибольшее расхождение с численным интегрированием (доля от размаха), null — не проверялось. */
  check: number | null;
}

const rad = (d: number) => (d * Math.PI) / 180;
const TWO_PI = 2 * Math.PI;

/** Единица массы в кг: сила·с²/длина. */
/** Множитель приведения демпфера на рычаге (a/b)². */
export const damperLever = (d: Pick<OscProblem['damp'], 'la' | 'lb'>) => (d.lb > 0 && d.la > 0 ? (d.la / d.lb) ** 2 : 1);

export const massUnitKg = (pr: Pick<OscProblem, 'force' | 'len'>) => FORCE_N[pr.force] / LEN_M[pr.len];

const fail = (errors: string[]): OscResult => ({ ok: false, errors, x: () => NaN, v: () => NaN, curve: [] }) as unknown as OscResult;

/** Единственный элемент системы (для массы элемента и напряжений). */
export function singleElem(pr: OscProblem): Elem | null {
  const s = pr.el.stages;
  return pr.el.mode === 'elems' && s.length === 1 && s[0].items.length === 1 ? s[0].items[0] : null;
}

/** Номер участка, на котором лежит момент t. */
function pieceAt(plan: { t0: number; t1: number }[], t: number): number {
  for (let i = plan.length - 1; i >= 0; i--) if (t >= plan[i].t0) return i;
  return 0;
}

/**
 * Частное решение ẍ + 2nẋ + k²x = h(t) для суммы слагаемых: многочлен первой степени (x = A + B(t − t₀)),
 * экспонента h₀e^{−βt} (знаменатель β² − 2nβ + k²; при совпадении −β с корнем характеристического уравнения —
 * множитель t, у двукратного корня — t²/2) и гармоника (при n = 0, p = k — резонансное, с множителем t).
 */
export function particular(terms: Term[], k: number, n: number) {
  const k2 = k * k;
  const parts = terms.map((term) => {
    if (term.k === 'poly') {
      const B = term.s / k2,
        A = (term.h0 - 2 * n * B) / k2;
      return {
        x: (t: number) => A + B * (t - term.t0),
        v: () => B,
        h: (t: number) => term.h0 + term.s * (t - term.t0),
      };
    }
    if (term.k === 'exp') {
      const be = term.beta;
      const den = be * be - 2 * n * be + k2;
      const e = (t: number) => Math.exp(-be * t);
      if (Math.abs(den) > 1e-9 * Math.max(k2, be * be)) {
        const cc = term.h0 / den;
        return { x: (t: number) => cc * e(t), v: (t: number) => -be * cc * e(t), h: (t: number) => term.h0 * e(t) };
      }
      const d1 = 2 * n - 2 * be; // p'(−β)
      if (Math.abs(d1) > 1e-9 * (n + be)) {
        const cc = term.h0 / d1;
        return { x: (t: number) => cc * t * e(t), v: (t: number) => cc * (1 - be * t) * e(t), h: (t: number) => term.h0 * e(t) };
      }
      return {
        x: (t: number) => (term.h0 * t * t * e(t)) / 2,
        v: (t: number) => term.h0 * (t - (be * t * t) / 2) * e(t),
        h: (t: number) => term.h0 * e(t),
      };
    }
    const { h, p, dl } = term;
    const resonance = n === 0 && Math.abs(p - k) <= 1e-9 * k;
    if (resonance)
      return {
        x: (t: number) => -(h / (2 * k)) * t * Math.cos(k * t + dl),
        v: (t: number) => -(h / (2 * k)) * (Math.cos(k * t + dl) - k * t * Math.sin(k * t + dl)),
        h: (t: number) => h * Math.sin(p * t + dl),
      };
    const D = Math.hypot(k2 - p * p, 2 * n * p);
    const B = h / D,
      eps = Math.atan2(2 * n * p, k2 - p * p);
    return {
      x: (t: number) => B * Math.sin(p * t + dl - eps),
      v: (t: number) => B * p * Math.cos(p * t + dl - eps),
      h: (t: number) => h * Math.sin(p * t + dl),
    };
  });
  return {
    x: (t: number) => parts.reduce((a, q) => a + q.x(t), 0),
    v: (t: number) => parts.reduce((a, q) => a + q.v(t), 0),
    h: (t: number) => parts.reduce((a, q) => a + q.h(t), 0),
  };
}

/** light — без проверки интегрированием и с редкой кривой (для подбора параметра в обратной задаче). */
export function solveOsc(pr: OscProblem, opts: { light?: boolean } = {}): OscResult {
  const errors: string[] = [];
  if (!(pr.gms > 0)) return fail(['Ускорение свободного падения g — положительное число.']);
  const g = pr.gms / LEN_M[pr.len];
  const toMass = (v: number) => (pr.byWeight ? v / g : v / massUnitKg(pr));
  if (!(pr.m > 0)) errors.push(pr.byWeight ? 'Вес груза — положительное число.' : 'Масса груза — положительное число.');
  const mLoad = toMass(pr.m);
  const P = mLoad * g;
  if (pr.orient === 'incl' && !(pr.alpha > 0 && pr.alpha < 90)) errors.push('Угол наклона плоскости — от 0 до 90° (не включая).');
  const sa = pr.orient === 'h' ? 0 : pr.orient === 'v' ? 1 : Math.sin(rad(pr.alpha));
  const ca = pr.orient === 'h' ? 1 : pr.orient === 'v' ? 0 : Math.cos(rad(pr.alpha));
  const Pax = P * sa;
  const Fst = Pax + pr.Q;

  // Масса упругого элемента.
  const el = pr.el;
  const one = singleElem(pr);
  let beta: number | null = null;
  if (el.mEl < 0) errors.push('Масса упругого элемента не может быть отрицательной.');
  if (el.mEl > 0) {
    if (el.mode === 'period') errors.push('При жёсткости по измеренному периоду масса элемента уже учтена в периоде — уберите её.');
    else if (el.mode === 'elems' && !one) errors.push('Массу упругого элемента можно учесть, только когда элемент один.');
    else {
      beta = one ? massCoef(one) : 1 / 3;
      if (beta == null) errors.push('Для этой схемы балки коэффициент приведения массы не задан — уберите массу балки.');
    }
  }
  const mRed = beta != null ? beta * toMass(el.mEl) : 0;
  const m = mLoad + mRed;

  // Жёсткость.
  let stiff: StiffResult | null = null;
  let c = NaN;
  if (el.mode === 'c') {
    if (!(el.c > 0)) errors.push('Жёсткость c — положительное число.');
    c = el.c;
  } else if (el.mode === 'static') {
    if (!(el.dst > 0)) errors.push('Статическая деформация — положительное число.');
    if (!(Fst > 0))
      errors.push(
        'Статическую деформацию создаёт нагрузка вдоль оси (вес при вертикальных или наклонных колебаниях, сила Q); здесь она равна нулю — задайте жёсткость иначе.',
      );
    c = Fst / el.dst;
  } else if (el.mode === 'period') {
    if (!(el.T0 > 0)) errors.push('Период колебаний — положительное число.');
    if (el.T0damped && !['b', 'n', 'ratio'].includes(pr.damp.mode))
      errors.push('Если период измерен при сопротивлении, задайте сопротивление коэффициентом b, n или затуханием амплитуды.');
    c = m * (TWO_PI / el.T0) ** 2; // при T0damped уточняется ниже, когда известно n
  } else {
    stiff = stiffness(el.stages);
    errors.push(...stiff.errors);
    c = stiff.c;
  }
  if (el.W < 0 || el.sAllow < 0) errors.push('Момент сопротивления и допускаемое напряжение не могут быть отрицательными.');

  // Сопротивление.
  const d = pr.damp;
  if (d.mode === 'b' && !(d.b >= 0)) errors.push('Коэффициент сопротивления b — неотрицательное число.');
  if (d.la < 0 || d.lb < 0 || (d.lb > 0 && !(d.la > 0))) errors.push('Плечи рычага демпфера: a > 0 при b > 0, оба неотрицательные.');
  const dLever = d.lb > 0 && d.la > 0 ? (d.la / d.lb) ** 2 : 1;
  if (d.mode === 'n' && !(d.n >= 0)) errors.push('Коэффициент затухания n — неотрицательное число.');
  if (d.mode === 'ratio' && !(d.q > 1 && d.N > 0)) errors.push('Затухание: амплитуда уменьшается в q > 1 раз за N > 0 колебаний.');
  if (d.mode === 'dry') {
    if (!(d.f > 0) || d.f0 < 0) errors.push('Коэффициент трения f — положительное число, f₀ — неотрицательное.');
    if (pr.orient === 'v') errors.push('Сухое трение — только при движении по горизонтальной или наклонной плоскости.');
    if (pr.exc.mode !== 'none') errors.push('Сухое трение рассматривается только при свободных колебаниях (без возмущающей силы).');
    if (pr.init.mode === 'drop') errors.push('Удар (падение груза) и сухое трение вместе не рассматриваются.');
  }

  // Возмущение.
  const ex = pr.exc;
  const harmonic = HARMONIC.includes(ex.mode);
  if (ex.mode !== 'none') {
    if ((harmonic || ex.mode === 'cam') && !(ex.p > 0))
      errors.push(ex.mode === 'cam' ? 'Угловая скорость кулачка ω — положительное число.' : 'Круговая частота возмущения p — положительное число.');
    if (ex.mode === 'rotor' && !(ex.m0 > 0 && ex.e > 0)) errors.push('Неуравновешенная масса и эксцентриситет — положительные числа.');
    if (ex.mode === 'two' && !(ex.p2 > 0)) errors.push('Частота второй гармоники p₂ — положительное число.');
    if (ex.mode === 'support' && ex.mc < 0) errors.push('Масса, связанная с движением основания, не может быть отрицательной.');
    if (ex.mode === 'exp' && !(ex.beta >= 0)) errors.push('Показатель затухания силы β — неотрицательное число.');
    if ((ex.mode === 'pulse' || ex.mode === 'ramphold') && !(ex.tau > 0)) errors.push('Длительность τ — положительное число.');
    if (ex.mode === 'cam' && !(ex.c1 > 0)) errors.push('Жёсткость пружины кулачка c₁ — положительное число.');
    if (ex.mode === 'cam' && !(ex.c1 <= pr.el.c || pr.el.mode !== 'c')) errors.push('Жёсткость c — полная (включает c₁): c₁ не может быть больше c.');
    if (ex.L < 0) errors.push('Длина участка L — неотрицательное число.');
  }

  // Начальные условия.
  const ini = pr.init;
  if (ini.mode === 'drop') {
    if (pr.orient !== 'v') errors.push('Падение груза с высоты — только при вертикальных колебаниях.');
    if (!(ini.h >= 0)) errors.push('Высота падения — неотрицательное число.');
  }
  if (
    ![pr.Q, ini.x0, ini.lambda0, ini.Fprev, ini.v0, pr.t, ex.delta, ex.H, ex.a, ex.mc, ex.H2, ex.p2, ex.delta2, ex.beta, ex.tau, ex.c1, ex.L].every(
      Number.isFinite,
    )
  )
    errors.push('Не все поля заполнены числами.');
  if (pr.t < 0) errors.push('Момент времени t — неотрицательное число.');
  if (errors.length || !(c > 0) || !(m > 0)) return fail(errors.length ? errors : ['Проверьте данные.']);

  // Коэффициент затухания. Если период T₁ измерен при сопротивлении: k² = (2π/T₁)² + n².
  const damped = el.mode === 'period' && el.T0damped;
  let n = 0;
  if (d.mode === 'b') n = (d.b * dLever) / (2 * m);
  else if (d.mode === 'n') n = d.n;
  else if (d.mode === 'ratio' && damped) n = Math.log(d.q) / d.N / el.T0;
  if (damped) c = m * ((TWO_PI / el.T0) ** 2 + n * n);
  const k = Math.sqrt(c / m);
  const T0 = TWO_PI / k;
  const dst = Fst / c;
  if (d.mode === 'ratio' && !damped) {
    const L = Math.log(d.q) / d.N; // nT₁
    n = (L * k) / Math.sqrt(TWO_PI ** 2 + L * L);
  } else if (d.mode === 'T1') {
    if (!(d.T1 > T0)) return fail([`Период затухающих колебаний должен быть больше периода свободных T₀ = ${T0.toPrecision(4)}.`]);
    n = Math.sqrt(k * k - (TWO_PI / d.T1) ** 2);
  }
  const b = 2 * n * m;
  const dry = d.mode === 'dry';
  const rel = (n - k) / k;
  const regime: Regime = dry ? 'dry' : n === 0 ? 'free' : Math.abs(rel) < 1e-9 ? 'critical' : n < k ? 'under' : 'over';
  const k1 = regime === 'under' ? Math.sqrt(k * k - n * n) : null;
  const T1 = k1 ? TWO_PI / k1 : null;
  const roots: [number, number] | null = regime === 'over' ? [-n + Math.sqrt(n * n - k * k), -n - Math.sqrt(n * n - k * k)] : null;

  // Начальные условия относительно положения равновесия.
  let x0 = ini.x0,
    v0 = ini.v0,
    vHit: number | null = null;
  if (ini.mode === 'lambda') x0 = ini.lambda0 - dst;
  else if (ini.mode === 'load') x0 = ini.Fprev / c - dst;
  else if (ini.mode === 'drop') {
    x0 = -dst;
    vHit = Math.sqrt(ini.v0 * ini.v0 + 2 * g * ini.h);
    v0 = (vHit * mLoad) / m;
  }

  // Возмущение: участки с одной и той же силой; на каждом — частное решение xp.
  let forced: Forced | null = null,
    forced2: Forced | null = null;
  let trans: Trans | null = null;
  const plan: { t0: number; t1: number; terms: Term[] }[] = [{ t0: 0, t1: Infinity, terms: [] }];
  const harmInfo = (H: number, p: number, dlDeg: number, mode: ForceMode): Forced => {
    const dl = rad(dlDeg);
    const h = H / m;
    const z = p / k;
    const resonance = n === 0 && Math.abs(p - k) <= 1e-9 * k;
    let B: number | null = null,
      eps = 0;
    if (!resonance) {
      B = h / Math.hypot(k * k - p * p, 2 * n * p);
      eps = Math.atan2(2 * n * p, k * k - p * p);
    }
    const eta = B != null && H !== 0 ? B / (H / c) : null;
    let pStar: number | null = null,
      Bmax: number | null = null;
    if (mode !== 'rotor' && mode !== 'support' && n > 0 && n < k / Math.SQRT2) {
      pStar = Math.sqrt(k * k - 2 * n * n);
      Bmax = Math.abs(h) / (2 * n * Math.sqrt(k * k - n * n));
    }
    const Ntr = B != null && mode !== 'base' && mode !== 'support' ? Math.abs(B) * Math.hypot(c, b * p) : null;
    // Основание движется по закону ξ = a sin(pt + δ); x — движение груза относительно основания.
    let rel: number | null = null,
      abs: number | null = null;
    if (mode === 'support' && B != null && ex.a !== 0) {
      rel = Math.abs(B) / Math.abs(ex.a);
      if (ex.mc <= 0 || Math.abs(toMass(ex.mc) - m) <= 1e-9 * m) abs = Math.hypot(k * k, 2 * n * p) / Math.hypot(k * k - p * p, 2 * n * p);
    }
    return { H, h, p, z, resonance, B, eps, eta, pStar, Bmax, Ntr, rel, abs, delta: dl };
  };
  if (ex.mode !== 'none') {
    const termH = (f: Forced): Term => ({ k: 'harm', h: f.h, p: f.p, dl: f.delta });
    if (harmonic) {
      const toH = (): number => {
        if (ex.mode === 'H' || ex.mode === 'two') return ex.H;
        if (ex.mode === 'rotor') return toMass(ex.m0) * ex.e * ex.p * ex.p;
        if (ex.mode === 'support') return (ex.mc > 0 ? toMass(ex.mc) : m) * ex.a * ex.p * ex.p;
        return c * ex.a;
      };
      forced = harmInfo(toH(), ex.p, ex.delta, ex.mode);
      plan[0].terms.push(termH(forced));
      if (ex.mode === 'two') {
        forced2 = harmInfo(ex.H2, ex.p2, ex.delta2, 'H');
        plan[0].terms.push(termH(forced2));
      }
    } else {
      const hF = ex.H / m;
      const xst = ex.H / c;
      if (ex.mode === 'ramp') plan[0].terms.push({ k: 'poly', h0: 0, s: hF, t0: 0 });
      else if (ex.mode === 'exp') plan[0].terms.push({ k: 'exp', h0: hF, beta: ex.beta });
      else if (ex.mode === 'pulse') {
        plan[0] = { t0: 0, t1: ex.tau, terms: [{ k: 'poly', h0: hF, s: 0, t0: 0 }] };
        plan.push({ t0: ex.tau, t1: Infinity, terms: [] });
      } else if (ex.mode === 'ramphold') {
        plan[0] = { t0: 0, t1: ex.tau, terms: [{ k: 'poly', h0: 0, s: hF / ex.tau, t0: 0 }] };
        plan.push({ t0: ex.tau, t1: Infinity, terms: [{ k: 'poly', h0: hF, s: 0, t0: ex.tau }] });
      } else if (ex.mode === 'cam') {
        const h1 = (ex.c1 * ex.a) / m,
          Tc = TWO_PI / ex.p;
        plan[0] = {
          t0: 0,
          t1: Tc,
          terms: [
            { k: 'poly', h0: h1, s: 0, t0: 0 },
            { k: 'harm', h: h1, p: ex.p, dl: -Math.PI / 2 },
          ],
        };
        plan.push({ t0: Tc, t1: Infinity, terms: [] });
      }
      trans = {
        mode: ex.mode,
        H: ex.H,
        xst: ex.mode === 'ramp' || ex.mode === 'cam' ? null : xst,
        ratio: null,
        tau: ex.mode === 'pulse' || ex.mode === 'ramphold' ? ex.tau : ex.mode === 'cam' ? TWO_PI / ex.p : null,
      };
    }
  }

  // Однородное решение от состояния (X0, V0) в местном времени τ.
  const homogeneous = (X0: number, V0: number) => {
    let C1 = 0,
      C2 = 0;
    let xh: (t: number) => number = () => 0,
      vh: (t: number) => number = () => 0;
    if (regime === 'free') {
      C1 = X0;
      C2 = V0 / k;
      xh = (t) => C1 * Math.cos(k * t) + C2 * Math.sin(k * t);
      vh = (t) => k * (-C1 * Math.sin(k * t) + C2 * Math.cos(k * t));
    } else if (regime === 'under') {
      const w = k1!;
      C1 = X0;
      C2 = (V0 + n * X0) / w;
      xh = (t) => Math.exp(-n * t) * (C1 * Math.cos(w * t) + C2 * Math.sin(w * t));
      vh = (t) => Math.exp(-n * t) * ((C2 * w - n * C1) * Math.cos(w * t) - (C1 * w + n * C2) * Math.sin(w * t));
    } else if (regime === 'critical') {
      C1 = X0;
      C2 = V0 + n * X0;
      xh = (t) => Math.exp(-n * t) * (C1 + C2 * t);
      vh = (t) => Math.exp(-n * t) * (C2 - n * (C1 + C2 * t));
    } else if (regime === 'over') {
      const [r1, r2] = roots!;
      C1 = (V0 - r2 * X0) / (r1 - r2);
      C2 = X0 - C1;
      xh = (t) => C1 * Math.exp(r1 * t) + C2 * Math.exp(r2 * t);
      vh = (t) => r1 * C1 * Math.exp(r1 * t) + r2 * C2 * Math.exp(r2 * t);
    }
    return { C1, C2, xh, vh };
  };

  let drySol: OscResult['dry'] = null;
  let C1 = 0,
    C2 = 0;
  const pieces: PieceInfo[] = [];
  const solvers: { t0: number; t1: number; x: (t: number) => number; v: (t: number) => number }[] = [];
  let fext: (t: number) => number = () => 0;
  if (regime === 'dry') {
    const N = P * ca;
    drySol = drySwings(x0, v0, k, (d.f * N) / c, ((d.f0 || d.f) * N) / c, N);
  } else {
    let xs = x0,
      vs = v0;
    const hs: ((t: number) => number)[] = [];
    plan.forEach((pc, i) => {
      const part = particular(pc.terms, k, n);
      const hom = homogeneous(xs - part.x(pc.t0), vs - part.v(pc.t0));
      const sx = (t: number) => hom.xh(t - pc.t0) + part.x(t),
        sv = (t: number) => hom.vh(t - pc.t0) + part.v(t);
      pieces.push({ t0: pc.t0, t1: pc.t1, terms: pc.terms, C1: hom.C1, C2: hom.C2, xs, vs });
      solvers.push({ t0: pc.t0, t1: pc.t1, x: sx, v: sv });
      hs.push(part.h);
      if (i === 0) ((C1 = hom.C1), (C2 = hom.C2));
      if (Number.isFinite(pc.t1)) ((xs = sx(pc.t1)), (vs = sv(pc.t1)));
    });
    fext = (t) => {
      const i = pieceAt(plan, t);
      return hs[i](t);
    };
  }

  let x: (t: number) => number, v: (t: number) => number;
  if (drySol) {
    const ds = drySol;
    const piece = (t: number) => {
      // Первый участок может начинаться не из крайнего положения (есть начальная скорость).
      for (const s of ds.swings) if (t <= s.t1 + s.dur) return s;
      return null;
    };
    x = (t) => {
      const s = piece(t);
      if (!s) return ds.stop.x;
      return dryPos(s, t, k, x0, v0, ds.swings[0] === s);
    };
    v = (t) => {
      const s = piece(t);
      if (!s) return 0;
      const hh = 1e-7 * T0;
      return (dryPos(s, t + hh, k, x0, v0, ds.swings[0] === s) - dryPos(s, t - hh, k, x0, v0, ds.swings[0] === s)) / (2 * hh);
    };
  } else {
    x = (t) => solvers[pieceAt(plan, t)].x(t);
    v = (t) => solvers[pieceAt(plan, t)].v(t);
  }

  // Интервал для графика.
  const Tb = forced ? Math.max(TWO_PI / forced.p, T1 ?? T0) : (T1 ?? T0);
  let tEnd = 4 * Tb;
  if (regime === 'under' || regime === 'critical') tEnd = Math.min(Math.max(tEnd, 4 / n), 30 * Tb);
  if (regime === 'over') tEnd = Math.min(Math.max(tEnd, 5 / Math.abs(roots![0])), 60 * T0);
  if (forced && n > 0) tEnd = Math.min(Math.max(tEnd, 3 / n + 3 * Tb), 40 * Tb);
  if (forced2 && forced) tEnd = Math.max(tEnd, 3 * Math.max(TWO_PI / forced.p, TWO_PI / forced2.p));
  if (trans) {
    const last = plan[plan.length - 1].t0;
    tEnd = Math.max(tEnd, last + 3 * (T1 ?? T0));
    if (ex.mode === 'exp' && ex.beta > 0) tEnd = Math.min(Math.max(tEnd, 5 / ex.beta), 40 * (T1 ?? T0));
  }
  if (drySol) tEnd = drySol.stop.t + 0.5 * T0;
  if (pr.t > tEnd) tEnd = pr.t * 1.1;

  // Кривая и крайние значения.
  const NS = opts.light ? 240 : 2400;
  const curve: [number, number][] = [];
  for (let i = 0; i <= NS; i++) {
    const t = (tEnd * i) / NS;
    curve.push([t, x(t)]);
  }
  const refine = (i: number, sgn: 1 | -1): Extreme => {
    let a = curve[Math.max(0, i - 1)][0],
      bb = curve[Math.min(NS, i + 1)][0];
    for (let it = 0; it < 80; it++) {
      const m1 = a + (bb - a) / 3,
        m2 = bb - (bb - a) / 3;
      if (sgn * x(m1) < sgn * x(m2)) a = m1;
      else bb = m2;
    }
    let t = (a + bb) / 2;
    if (t < 1e-9 * tEnd) t = 0;
    return { t, x: x(t) };
  };
  let iMax = 0,
    iMin = 0;
  curve.forEach(([, y], i) => {
    if (y > curve[iMax][1] + 1e-12 * Math.abs(curve[iMax][1])) iMax = i;
    if (y < curve[iMin][1] - 1e-12 * Math.abs(curve[iMin][1])) iMin = i;
  });
  const max = refine(iMax, 1),
    min = refine(iMin, -1);

  if (trans && trans.xst != null && trans.xst !== 0) trans.ratio = Math.max(Math.abs(max.x), Math.abs(min.x)) / Math.abs(trans.xst);

  const lamMax = dst + max.x,
    lamMin = dst + min.x;
  const Fmax = c * Math.max(Math.abs(lamMax), Math.abs(lamMin));
  const Kd = dst > 0 ? lamMax / dst : null;

  // Сила в элементе обращается в нуль: трос ослабевает или груз отрывается от элемента после удара.
  let slack: number | null = null;
  if (el.rope || ini.mode === 'drop') {
    const lam = (t: number) => dst + x(t);
    const start = curve.findIndex(([t]) => lam(t) > 1e-12 * Math.max(1, dst));
    const from = start < 0 ? 0 : start;
    for (let i = from + 1; i <= NS; i++)
      if (lam(curve[i][0]) < -1e-12 * Math.max(1, dst)) {
        let a = curve[i - 1][0],
          bb = curve[i][0];
        for (let it = 0; it < 80; it++) {
          const mm = (a + bb) / 2;
          if (lam(mm) >= 0) a = mm;
          else bb = mm;
        }
        slack = (a + bb) / 2;
        break;
      }
    if (start < 0 && el.rope && dst + x0 < 0) slack = 0;
  }

  // Напряжения в одиночном стержне или балке.
  let stress: OscResult['stress'] = null;
  if (one && (one.kind === 'rod' || (one.kind === 'beam' && el.W > 0))) {
    const s1 = one.kind === 'rod' ? 1 / one.A : beamUnit(one).M / el.W;
    const smax = s1 * Fmax;
    stress = { s1, sst: s1 * c * dst, smax, ok: el.sAllow > 0 ? Math.abs(smax) <= el.sAllow * (1 + 1e-9) : null };
  }

  const tt = pr.t;
  const xt = x(tt),
    vt = v(tt);
  const hh = 1e-6 * T0;
  const at = { t: tt, x: xt, v: vt, a: (v(tt + hh) - v(Math.max(0, tt - hh))) / (tt > hh ? 2 * hh : hh), F: c * (dst + xt) };

  // Свободные гармонические колебания: x = A sin(kt + φ).
  const A = regime === 'free' && !forced ? Math.hypot(x0, v0 / k) : null;
  const phase = A != null ? Math.atan2(x0, v0 / k) : null;

  const res: OscResult = {
    ok: true,
    errors: [],
    g,
    mLoad,
    beta,
    mRed,
    m,
    P,
    Pax,
    stiff,
    c,
    dst,
    k,
    T0,
    freq: k / TWO_PI,
    b,
    n,
    regime,
    k1,
    T1,
    roots,
    forced,
    forced2,
    trans,
    pieces,
    fext,
    rail: ex.L > 0 && !drySol ? { vCrit: ex.L / T0, v: forced ? (ex.L * forced.p) / TWO_PI : NaN } : null,
    x0,
    v0,
    vHit,
    C1,
    C2,
    A,
    phase,
    dry: drySol,
    x,
    v,
    tEnd,
    max,
    min,
    lamMax,
    lamMin,
    Fmax,
    Kd,
    slack,
    stress,
    at,
    curve,
    check: null,
  };
  res.check = drySol || opts.light ? null : numericCheck(res);
  return res;
}

/** Положение на полуразмахе с сухим трением: гармоническое колебание около центра s.center. */
function dryPos(s: HalfSwing, t: number, k: number, x0: number, v0: number, first: boolean): number {
  const tau = t - s.t1;
  if (first && v0 !== 0) {
    const u0 = x0 - s.center;
    return s.center + u0 * Math.cos(k * tau) + (v0 / k) * Math.sin(k * tau);
  }
  return s.center + (s.x1 - s.center) * Math.cos(k * tau);
}

/**
 * Полуразмахи при сухом трении: при движении в сторону dir сила трения −dir·fN смещает центр колебаний в −dir·D,
 * D = fN/c. Груз останавливается в крайнем положении, если |x| ≤ D₀ = f₀N/c (сила упругости не превосходит
 * наибольшую силу трения покоя).
 */
export function drySwings(
  x0: number,
  v0: number,
  k: number,
  D: number,
  D0: number,
  N: number,
): { D: number; D0: number; N: number; swings: HalfSwing[]; stop: Extreme } {
  const swings: HalfSwing[] = [];
  let x = x0,
    v = v0,
    t = 0;
  for (let i = 0; i < 400; i++) {
    let dir: number;
    if (Math.abs(v) > 0) dir = Math.sign(v);
    else if (Math.abs(x) > D0 * (1 + 1e-12)) dir = -Math.sign(x);
    else break;
    const center = -dir * D;
    const u0 = x - center;
    const A = Math.hypot(u0, v / k);
    if (A < 1e-15) break;
    const th = Math.atan2(-v / k, u0); // u = A cos(kτ + th)
    // Крайнее положение в сторону dir: cos(kτ + th) = dir.
    let ph = (dir > 0 ? 0 : Math.PI) - th;
    ph = ((ph % TWO_PI) + TWO_PI) % TWO_PI;
    if (ph < 1e-12) ph = v === 0 ? Math.PI : TWO_PI;
    const dur = ph / k;
    const x2 = center + dir * A;
    swings.push({ x1: x, x2, center, t1: t, dur });
    t += dur;
    x = x2;
    v = 0;
    if (Math.abs(x2) <= D0 * (1 + 1e-12)) break;
  }
  return { D, D0, N, swings, stop: { x, t } };
}

/** Независимая проверка: интегрирование m ẍ = −c x − b ẋ + F(t) методом Рунге — Кутты (по участкам — сила разрывна). */
function numericCheck(r: OscResult): number | null {
  const acc = (t: number, x: number, v: number) => -r.k * r.k * x - 2 * r.n * v + r.fext(t);
  const total = 20000;
  const cuts = [0, ...r.pieces.map((p) => p.t0).filter((t) => t > 0 && t < r.tEnd), r.tEnd];
  let x = r.x0,
    v = r.v0,
    dev = 0;
  for (let s = 0; s + 1 < cuts.length; s++) {
    const a = cuts[s],
      bnd = cuts[s + 1];
    const steps = Math.max(200, Math.ceil((total * (bnd - a)) / r.tEnd));
    const hstep = (bnd - a) / steps;
    // На участке сила считается по его формуле: в точке разрыва берём значение справа.
    const mid = a + hstep * 1e-9;
    let t = a;
    for (let i = 0; i < steps; i++) {
      const k1x = v,
        k1v = acc(i === 0 ? mid : t, x, v);
      const k2x = v + (hstep / 2) * k1v,
        k2v = acc(t + hstep / 2, x + (hstep / 2) * k1x, v + (hstep / 2) * k1v);
      const k3x = v + (hstep / 2) * k2v,
        k3v = acc(t + hstep / 2, x + (hstep / 2) * k2x, v + (hstep / 2) * k2v);
      const k4x = v + hstep * k3v,
        k4v = acc(t + hstep * (1 - 1e-9), x + hstep * k3x, v + hstep * k3v);
      x += (hstep / 6) * (k1x + 2 * k2x + 2 * k3x + k4x);
      v += (hstep / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
      t += hstep;
      dev = Math.max(dev, Math.abs(x - r.x(t)));
    }
  }
  const span = Math.max(r.max.x - r.min.x, 1e-300);
  return dev / span;
}
