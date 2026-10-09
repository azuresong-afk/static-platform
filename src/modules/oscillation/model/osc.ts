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
export type ForceMode = 'none' | 'H' | 'rotor' | 'base';
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
  };
  exc: {
    mode: ForceMode;
    H: number;
    /** Ротор: неуравновешенная масса (вес, если byWeight) и эксцентриситет. */
    m0: number;
    e: number;
    /** Перемещение точки крепления: амплитуда. */
    a: number;
    p: number;
    /** Начальная фаза, градусы. */
    delta: number;
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
  /** Начальная фаза возмущения, рад. */
  delta: number;
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
export const massUnitKg = (pr: Pick<OscProblem, 'force' | 'len'>) => FORCE_N[pr.force] / LEN_M[pr.len];

const fail = (errors: string[]): OscResult => ({ ok: false, errors, x: () => NaN, v: () => NaN, curve: [] }) as unknown as OscResult;

/** Единственный элемент системы (для массы элемента и напряжений). */
export function singleElem(pr: OscProblem): Elem | null {
  const s = pr.el.stages;
  return pr.el.mode === 'elems' && s.length === 1 && s[0].items.length === 1 ? s[0].items[0] : null;
}

export function solveOsc(pr: OscProblem): OscResult {
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
  if (ex.mode !== 'none') {
    if (!(ex.p > 0)) errors.push('Круговая частота возмущения p — положительное число.');
    if (ex.mode === 'rotor' && !(ex.m0 > 0 && ex.e > 0)) errors.push('Неуравновешенная масса и эксцентриситет — положительные числа.');
  }

  // Начальные условия.
  const ini = pr.init;
  if (ini.mode === 'drop') {
    if (pr.orient !== 'v') errors.push('Падение груза с высоты — только при вертикальных колебаниях.');
    if (!(ini.h >= 0)) errors.push('Высота падения — неотрицательное число.');
  }
  if (![pr.Q, ini.x0, ini.lambda0, ini.Fprev, ini.v0, pr.t, ex.delta, ex.H, ex.a].every(Number.isFinite)) errors.push('Не все поля заполнены числами.');
  if (pr.t < 0) errors.push('Момент времени t — неотрицательное число.');
  if (errors.length || !(c > 0) || !(m > 0)) return fail(errors.length ? errors : ['Проверьте данные.']);

  // Коэффициент затухания. Если период T₁ измерен при сопротивлении: k² = (2π/T₁)² + n².
  const damped = el.mode === 'period' && el.T0damped;
  let n = 0;
  if (d.mode === 'b') n = d.b / (2 * m);
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

  // Возмущение: частное решение xp(t) = Bs·sin(pt + δ − ε) или резонансное.
  let forced: Forced | null = null;
  let xp: (t: number) => number = () => 0;
  let vp: (t: number) => number = () => 0;
  if (ex.mode !== 'none') {
    const p = ex.p,
      dl = rad(ex.delta);
    const H = ex.mode === 'H' ? ex.H : ex.mode === 'rotor' ? toMass(ex.m0) * ex.e * p * p : c * ex.a;
    const h = H / m;
    const z = p / k;
    const resonance = n === 0 && Math.abs(p - k) <= 1e-9 * k;
    let B: number | null = null,
      eps = 0;
    if (resonance) {
      xp = (t) => -(h / (2 * k)) * t * Math.cos(k * t + dl);
      vp = (t) => -(h / (2 * k)) * (Math.cos(k * t + dl) - k * t * Math.sin(k * t + dl));
    } else {
      const D = Math.hypot(k * k - p * p, 2 * n * p);
      B = h / D;
      eps = Math.atan2(2 * n * p, k * k - p * p);
      const Bv = B;
      xp = (t) => Bv * Math.sin(p * t + dl - eps);
      vp = (t) => Bv * p * Math.cos(p * t + dl - eps);
    }
    const eta = B != null && H !== 0 ? B / (H / c) : null;
    let pStar: number | null = null,
      Bmax: number | null = null;
    if (ex.mode !== 'rotor' && n > 0 && n < k / Math.SQRT2) {
      pStar = Math.sqrt(k * k - 2 * n * n);
      Bmax = Math.abs(h) / (2 * n * Math.sqrt(k * k - n * n));
    }
    const Ntr = B != null && ex.mode !== 'base' ? Math.abs(B) * Math.hypot(c, b * p) : null;
    forced = { H, h, p, z, resonance, B, eps, eta, pStar, Bmax, Ntr, delta: dl };
  }

  // Однородное решение.
  const X0 = x0 - xp(0),
    V0 = v0 - vp(0);
  let C1 = 0,
    C2 = 0;
  let xh: (t: number) => number = () => 0,
    vh: (t: number) => number = () => 0;
  let drySol: OscResult['dry'] = null;
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
  } else {
    const N = P * ca;
    drySol = drySwings(x0, v0, k, (d.f * N) / c, ((d.f0 || d.f) * N) / c, N);
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
    x = (t) => xh(t) + xp(t);
    v = (t) => vh(t) + vp(t);
  }

  // Интервал для графика.
  const Tb = forced ? Math.max(TWO_PI / forced.p, T1 ?? T0) : (T1 ?? T0);
  let tEnd = 4 * Tb;
  if (regime === 'under' || regime === 'critical') tEnd = Math.min(Math.max(tEnd, 4 / n), 30 * Tb);
  if (regime === 'over') tEnd = Math.min(Math.max(tEnd, 5 / Math.abs(roots![0])), 60 * T0);
  if (forced && n > 0) tEnd = Math.min(Math.max(tEnd, 3 / n + 3 * Tb), 40 * Tb);
  if (drySol) tEnd = drySol.stop.t + 0.5 * T0;
  if (pr.t > tEnd) tEnd = pr.t * 1.1;

  // Кривая и крайние значения.
  const NS = 2400;
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
  res.check = drySol ? null : numericCheck(res);
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

/** Независимая проверка: интегрирование m ẍ = −c x − b ẋ + H sin(pt + δ) методом Рунге — Кутты. */
function numericCheck(r: OscResult): number | null {
  const f = r.forced;
  const acc = (t: number, x: number, v: number) => -r.k * r.k * x - 2 * r.n * v + (f ? f.h * Math.sin(f.p * t + f.delta) : 0);
  const steps = 20000;
  const hstep = r.tEnd / steps;
  let x = r.x0,
    v = r.v0,
    t = 0,
    dev = 0;
  for (let i = 0; i < steps; i++) {
    const k1x = v,
      k1v = acc(t, x, v);
    const k2x = v + (hstep / 2) * k1v,
      k2v = acc(t + hstep / 2, x + (hstep / 2) * k1x, v + (hstep / 2) * k1v);
    const k3x = v + (hstep / 2) * k2v,
      k3v = acc(t + hstep / 2, x + (hstep / 2) * k2x, v + (hstep / 2) * k2v);
    const k4x = v + hstep * k3v,
      k4v = acc(t + hstep, x + hstep * k3x, v + hstep * k3v);
    x += (hstep / 6) * (k1x + 2 * k2x + 2 * k3x + k4x);
    v += (hstep / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
    t += hstep;
    dev = Math.max(dev, Math.abs(x - r.x(t)));
  }
  const span = Math.max(r.max.x - r.min.x, 1e-300);
  return dev / span;
}
