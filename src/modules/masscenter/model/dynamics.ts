/**
 * Теоремы динамики без интегрирования (Мещерский §29, §36).
 *
 * 1. Сохранение количества движения вдоль оси x: внешних сил вдоль x нет (или их импульс пренебрежимо мал),
 *    Σm_i·v_i до = Σm_i·u_i после. Скорость тела задаётся абсолютной или относительно другого тела в том же
 *    состоянии (относительная 0 — тела движутся вместе). Одна неизвестная скорость; изменение кинетической
 *    энергии; для двух тел и постоянной силы взаимодействия F — путь одного тела по другому s = |ΔT|/F и время τ.
 * 2. Давление струи (установившийся поток через неподвижный контур): R = Σ_вход ṁ·v⃗ − Σ_выход ṁ·v⃗ — сила,
 *    с которой жидкость действует на стенки (давлением в сечениях пренебрегаем). ṁ = ρ·A·v; у одного сечения
 *    с A = 0 расход — по неразрывности. Если задан вес сосуда с жидкостью — реакция опор.
 * 3. Работа и мощность при равномерном движении: нагрузка — сила F вдоль движения или вес P на наклоне
 *    (F = P(sin α + f cos α)), скорость — заданная, k раз путь s за время t или окружная π·d·n/60.
 *    N_пол = ΣF·v, мощность двигателя N = N_пол/η (или N = η·N_движ, если заданы движущие силы).
 */

const clean = (v: number) => (Math.abs(v) < 1e-12 ? 0 : v);
const rad = (a: number) => (a * Math.PI) / 180;

/* ---------- сохранение количества движения ---------- */

export interface MomBody {
  name: string;
  /** Масса или вес. */
  m: number;
  /** Скорость до и после (проекция на x); ref — номер тела, относительно которого она задана (−1 — абсолютная). */
  v0: number;
  ref0: number;
  v1: number;
  ref1: number;
}
export interface MomentumProblem {
  byWeight: boolean;
  g: number;
  bodies: MomBody[];
  /** Неизвестная: скорость тела i до (when = 0) или после (when = 1) — в том виде, как задана (абсолютная или относительная). */
  unknown: { i: number; when: 0 | 1 };
  /** Постоянная сила взаимодействия двух тел (торможение); 0 — путь и время не считать. */
  F: number;
}
export interface MomentumResult {
  ok: boolean;
  errors: string[];
  masses: number[];
  /** Абсолютные скорости до и после. */
  abs0: number[];
  abs1: number[];
  /** Количество движения системы (одинаково до и после). */
  Q: number;
  answer: number;
  /** Кинетическая энергия до и после. */
  T0: number;
  T1: number;
  /** Путь тела 2 по телу 1 и время действия силы F (только для двух тел и потери энергии). */
  brake: { s: number; tau: number } | null;
}

type Aff = [number, number]; // a + b·X

export function solveMomentum(pr: MomentumProblem): MomentumResult {
  const errors: string[] = [];
  const n = pr.bodies.length;
  if (!n) errors.push('Нет ни одного тела.');
  if (pr.byWeight && !(pr.g > 0)) errors.push('g — положительное число.');
  pr.bodies.forEach((b, i) => {
    if (!(b.m > 0)) errors.push(`Тело ${i + 1}: масса (вес) — положительное число.`);
    for (const r of [b.ref0, b.ref1])
      if (r === i || r >= n || (r < 0 && r !== -1)) errors.push(`Тело ${i + 1}: скорость задана относительно несуществующего тела.`);
  });
  const { i: ui, when } = pr.unknown;
  if (!(ui >= 0 && ui < n)) errors.push('Не выбрана неизвестная скорость.');
  if (!(pr.F >= 0)) errors.push('Сила торможения F не может быть отрицательной.');
  const masses = pr.bodies.map((b) => (pr.byWeight ? b.m / pr.g : b.m));
  const empty: MomentumResult = { ok: false, errors, masses, abs0: [], abs1: [], Q: 0, answer: 0, T0: 0, T1: 0, brake: null };
  if (errors.length) return empty;
  const absOf = (state: 0 | 1): Aff[] | null => {
    const memo: (Aff | null)[] = Array(n).fill(null);
    const go = (i: number, depth: number): Aff | null => {
      if (depth > n) return null;
      if (memo[i]) return memo[i];
      const b = pr.bodies[i];
      const own: Aff = ui === i && when === state ? [0, 1] : [state ? b.v1 : b.v0, 0];
      const ref = state ? b.ref1 : b.ref0;
      let res: Aff = own;
      if (ref >= 0) {
        const base = go(ref, depth + 1);
        if (!base) return null;
        res = [own[0] + base[0], own[1] + base[1]];
      }
      return (memo[i] = res);
    };
    const out: Aff[] = [];
    for (let i = 0; i < n; i++) {
      const a = go(i, 0);
      if (!a) return null;
      out.push(a);
    }
    return out;
  };
  const a0 = absOf(0),
    a1 = absOf(1);
  if (!a0 || !a1) return { ...empty, errors: ['Скорости заданы относительно друг друга по кругу.'] };
  const q = (a: Aff[]): Aff => a.reduce<Aff>((s, x, i) => [s[0] + masses[i] * x[0], s[1] + masses[i] * x[1]], [0, 0]);
  const [c0, k0] = q(a0),
    [c1, k1] = q(a1);
  // c0 + k0·X = c1 + k1·X
  if (Math.abs(k0 - k1) < 1e-12)
    return { ...empty, errors: ['Неизвестная скорость не входит в закон сохранения: она одинаково меняет количество движения до и после.'] };
  const X = (c1 - c0) / (k0 - k1);
  const ev = (a: Aff[]) => a.map((x) => clean(x[0] + x[1] * X));
  const abs0 = ev(a0),
    abs1 = ev(a1);
  const T = (v: number[]) => v.reduce((s, x, i) => s + (masses[i] * x * x) / 2, 0);
  const T0 = T(abs0),
    T1 = T(abs1);
  let brake: MomentumResult['brake'] = null;
  if (pr.F > 0 && n === 2 && T0 - T1 > 1e-12) brake = { s: (T0 - T1) / pr.F, tau: Math.abs(masses[1] * (abs1[1] - abs0[1])) / pr.F };
  return { ok: true, errors: [], masses, abs0, abs1, Q: clean(c0 + k0 * X), answer: clean(X), T0: clean(T0), T1: clean(T1), brake };
}

/* ---------- давление струи ---------- */

export interface JetStream {
  name: string;
  /** Выходное сечение (иначе — входное). */
  out: boolean;
  /** Площадь сечения, м²; 0 — расход по неразрывности (не больше одного такого сечения). */
  A: number;
  /** Скорость, м/с, и её направление — угол от оси x против часовой стрелки, градусы (ось y — вверх). */
  v: number;
  ang: number;
}
export interface JetProblem {
  /** Задан удельный вес γ (масса γ/g), силы — в единицах веса. */
  byWeight: boolean;
  g: number;
  /** Плотность ρ или удельный вес γ. */
  rho: number;
  streams: JetStream[];
  /** Вес сосуда с жидкостью (0 — реакцию опор не считать). */
  W: number;
}
export interface JetResult {
  ok: boolean;
  errors: string[];
  /** Массовый секундный расход каждого сечения. */
  mdot: number[];
  /** Расход по неразрывности найден для сечения с этим номером (−1 — нет). */
  cont: number;
  /** Сумма притока и оттока, для проверки неразрывности. */
  min: number;
  mout: number;
  /** Сила давления жидкости на стенки. */
  R: [number, number];
  /** Реакция опор (если задан вес). */
  N: [number, number] | null;
}

export function solveJet(pr: JetProblem): JetResult {
  const errors: string[] = [];
  if (!pr.streams.length) errors.push('Нет ни одного сечения.');
  if (!(pr.rho > 0)) errors.push(pr.byWeight ? 'Удельный вес γ — положительное число.' : 'Плотность ρ — положительное число.');
  if (pr.byWeight && !(pr.g > 0)) errors.push('g — положительное число.');
  if (!(pr.W >= 0)) errors.push('Вес сосуда не может быть отрицательным.');
  const zero = pr.streams.map((s, i) => (s.A === 0 ? i : -1)).filter((i) => i >= 0);
  if (zero.length > 1) errors.push('Площадь 0 (расход по неразрывности) можно задать только у одного сечения.');
  pr.streams.forEach((s, i) => {
    if (!(s.A >= 0)) errors.push(`Сечение ${i + 1}: площадь не может быть отрицательной.`);
    if (!(s.v >= 0)) errors.push(`Сечение ${i + 1}: скорость — модуль, не отрицательная.`);
  });
  const rho = pr.byWeight ? pr.rho / pr.g : pr.rho;
  const mdot = pr.streams.map((s) => rho * s.A * s.v);
  const empty: JetResult = { ok: false, errors, mdot, cont: -1, min: 0, mout: 0, R: [0, 0], N: null };
  if (errors.length) return empty;
  const cont = zero.length ? zero[0] : -1;
  if (cont >= 0) {
    const s = pr.streams[cont];
    const rest = pr.streams.reduce((acc, x, i) => (i === cont ? acc : acc + (x.out ? -mdot[i] : mdot[i])), 0);
    const m = s.out ? rest : -rest;
    if (!(m > 0))
      return {
        ...empty,
        errors: [`Сечение ${cont + 1}: по неразрывности расход получается ${m < 0 ? 'отрицательным' : 'нулевым'} — проверьте направления (вход/выход).`],
      };
    mdot[cont] = m;
  }
  const min = pr.streams.reduce((acc, s, i) => (s.out ? acc : acc + mdot[i]), 0),
    mout = pr.streams.reduce((acc, s, i) => (s.out ? acc + mdot[i] : acc), 0);
  const R: [number, number] = [0, 0];
  pr.streams.forEach((s, i) => {
    const sg = s.out ? -1 : 1;
    R[0] += sg * mdot[i] * s.v * Math.cos(rad(s.ang));
    R[1] += sg * mdot[i] * s.v * Math.sin(rad(s.ang));
  });
  const Rc: [number, number] = [clean(R[0]), clean(R[1])];
  return { ok: true, errors: [], mdot, cont, min, mout, R: Rc, N: pr.W > 0 ? [clean(-Rc[0]), clean(pr.W - Rc[1])] : null };
}

/* ---------- работа и мощность ---------- */

export type LoadSpeed = 'v' | 'path' | 'rot';
export interface WorkLoad {
  name: string;
  /** force — сила F вдоль движения; weight — вес P на наклоне α с трением f: F = P(sin α + f cos α). */
  kind: 'force' | 'weight';
  F: number;
  alpha: number;
  f: number;
  /** Скорость: задана v; k раз путь s за время t; окружная скорость π·d·n/60 (n — об/мин). */
  speed: LoadSpeed;
  v: number;
  s: number;
  k: number;
  d: number;
  n: number;
}
export type PowerUnit = 'base' | 'kW' | 'hp';
export interface PowerProblem {
  /** si — Н, Дж, Вт; tech — кГ, кГм, кГм/с (1 л. с. = 75 кГм/с). */
  units: 'si' | 'tech';
  g: number;
  /** КПД. */
  eta: number;
  /** Нагрузки — движущие силы (N = η·N_движ), иначе — полезные сопротивления (N = N_пол/η). */
  driving: boolean;
  /** Время работы, с (0 — не задано). */
  t: number;
  /** Мощность двигателя (когда она известна) и её единица. */
  N: number;
  Nunit: PowerUnit;
  /** Что ищем: мощность, время или величину F (P) нагрузки с этим номером. */
  unknown: 'N' | 't' | number;
  loads: WorkLoad[];
}
export interface LoadOut {
  /** Сила вдоль движения. */
  F: number;
  /** Скорость (null — время не задано, а нагрузка задана путём). */
  v: number | null;
  /** Мощность и работа за время t (работа путевой нагрузки — k·F·s и без t). */
  P: number | null;
  A: number | null;
}
export interface PowerResult {
  ok: boolean;
  errors: string[];
  loads: LoadOut[];
  /** Найденное значение (поле F нагрузки, t или N в базовых единицах). */
  answer: number;
  t: number;
  /** Мощность нагрузок (полезная или движущая) и двигателя, работа нагрузок и двигателя за время t. */
  Nl: number | null;
  N: number | null;
  Al: number | null;
  A: number | null;
  /** Единицы: 1 л. с. и 1 кВт в базовых единицах мощности. */
  hp: number;
  kW: number;
}

export const powerUnits = (pr: Pick<PowerProblem, 'units' | 'g'>) => ({
  hp: pr.units === 'tech' ? 75 : 75 * pr.g,
  kW: pr.units === 'tech' ? 1000 / pr.g : 1000,
});
export const loadFactor = (l: WorkLoad) => (l.kind === 'weight' ? Math.sin(rad(l.alpha)) + l.f * Math.cos(rad(l.alpha)) : 1);

export function solvePower(pr: PowerProblem): PowerResult {
  const errors: string[] = [];
  const { hp, kW } = powerUnits(pr);
  const n = pr.loads.length;
  if (!n) errors.push('Нет ни одной нагрузки.');
  if (!(pr.eta > 0 && pr.eta <= 1)) errors.push('КПД — число от 0 до 1.');
  if (!(pr.g > 0)) errors.push('g — положительное число.');
  if (!(pr.t >= 0)) errors.push('Время не может быть отрицательным.');
  const u = pr.unknown;
  if (typeof u === 'number' && !(u >= 0 && u < n)) errors.push('Нет нагрузки с таким номером.');
  if (u !== 'N' && !(pr.N > 0)) errors.push('Мощность двигателя — положительное число.');
  pr.loads.forEach((l, i) => {
    if (l.speed === 'path' && !(l.k > 0)) errors.push(`Нагрузка ${i + 1}: число повторений k — положительное.`);
    if (l.speed === 'rot' && !(l.d > 0)) errors.push(`Нагрузка ${i + 1}: диаметр — положительный.`);
    if (l.kind === 'weight' && !(l.f >= 0)) errors.push(`Нагрузка ${i + 1}: коэффициент трения не может быть отрицательным.`);
  });
  const hasPath = pr.loads.some((l) => l.speed === 'path');
  if (u === 't' && !hasPath) errors.push('Время можно найти, только если работа задана путём (k раз по s).');
  const empty: PowerResult = { ok: false, errors, loads: [], answer: 0, t: pr.t, Nl: null, N: null, Al: null, A: null, hp, kW };
  if (errors.length) return empty;
  const Ngiven = pr.N * (pr.Nunit === 'hp' ? hp : pr.Nunit === 'kW' ? kW : 1);
  // Мощность нагрузок, отвечающая мощности двигателя.
  const Nl_of = (N: number) => (pr.driving ? N / pr.eta : N * pr.eta);
  const N_of = (Nl: number) => (pr.driving ? Nl * pr.eta : Nl / pr.eta);
  const speed = (l: WorkLoad, t: number) => (l.speed === 'v' ? l.v : l.speed === 'rot' ? (Math.PI * l.d * l.n) / 60 : t > 0 ? (l.k * l.s) / t : null);
  const Fof = (l: WorkLoad) => l.F * loadFactor(l);
  let t = pr.t;
  let answer = 0;
  const loads = pr.loads.map((l) => ({ ...l }));
  if (u === 't') {
    // N_l = P₀ + W/t, где P₀ — мощность нагрузок со скоростью, W — работа путевых нагрузок.
    const P0 = loads.reduce((s, l) => (l.speed === 'path' ? s : s + Fof(l) * (speed(l, 1) as number)), 0);
    const Wp = loads.reduce((s, l) => (l.speed === 'path' ? s + Fof(l) * l.k * l.s : s), 0);
    const rest = Nl_of(Ngiven) - P0;
    if (!(Wp > 0) || !(rest > 0)) return { ...empty, errors: ['Мощности не хватает: время получается бесконечным или отрицательным.'] };
    t = Wp / rest;
    answer = t;
  } else if (typeof u === 'number') {
    const l = loads[u];
    const vu = speed(l, t);
    if (vu == null) return { ...empty, errors: [`Нагрузка ${u + 1} задана путём — нужно время t.`] };
    if (Math.abs(vu * loadFactor(l)) < 1e-12)
      return { ...empty, errors: [`Нагрузка ${u + 1} не совершает работы (скорость или множитель sin α + f cos α равен нулю).`] };
    let other = 0;
    for (let i = 0; i < n; i++) {
      if (i === u) continue;
      const vi = speed(loads[i], t);
      if (vi == null) return { ...empty, errors: [`Нагрузка ${i + 1} задана путём — нужно время t.`] };
      other += Fof(loads[i]) * vi;
    }
    l.F = (Nl_of(Ngiven) - other) / (vu * loadFactor(l));
    answer = l.F;
  }
  const outs: LoadOut[] = loads.map((l) => {
    const F = Fof(l);
    const v = speed(l, t);
    const P = v == null ? null : F * v;
    const A = l.speed === 'path' ? F * l.k * l.s : P != null && t > 0 ? P * t : null;
    return { F: clean(F), v: v == null ? null : clean(v), P: P == null ? null : clean(P), A: A == null ? null : clean(A) };
  });
  const Nl = outs.every((o) => o.P != null) ? outs.reduce((s, o) => s + (o.P as number), 0) : null;
  const N = u === 'N' ? (Nl == null ? null : N_of(Nl)) : Ngiven;
  if (u === 'N') answer = N ?? 0;
  const Al = outs.every((o) => o.A != null) ? outs.reduce((s, o) => s + (o.A as number), 0) : null;
  const A = Al == null ? null : pr.driving ? Al * pr.eta : Al / pr.eta;
  if (u === 'N' && Nl == null && Al == null) return { ...empty, errors: ['Задайте время t: без него нет ни мощности, ни работы.'] };
  return {
    ok: true,
    errors: [],
    loads: outs,
    answer: clean(answer),
    t: clean(t),
    Nl: Nl == null ? null : clean(Nl),
    N: N == null ? null : clean(N),
    Al: Al == null ? null : clean(Al),
    A: A == null ? null : clean(A),
    hp,
    kW,
  };
}
