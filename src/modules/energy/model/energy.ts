/**
 * Теорема об изменении кинетической энергии системы с одной степенью свободы
 * (Мещерский §38; Антонов п. 9.6–9.9): грузы, блоки (в том числе ступенчатые), катки, нити и ремни.
 *
 * Тело 1 — ведущее: его перемещение s (или угол φ, если тело 1 — блок) — обобщённая координата.
 * Каждое следующее тело связано нитью (ремнём) с одним из предыдущих: скорость нити в точке схода
 * равна скорости нити в точке крепления. Отсюда v_Ci = k_i·v, ω_i = q_i·v; те же коэффициенты связывают
 * перемещения: s_Ci = k_i·s, φ_i = q_i·s. Нити нерастяжимы, проскальзывания нет, массой нитей пренебрегаем.
 *
 * T = ½ m_пр v², m_пр = Σ (m_i k_i² + J_Ci q_i²);  T − T₀ = ΣA(s);  m_пр a = Q(s) = dΣA/ds.
 * Знаки задаёт пользователь: «вверх/вниз» для пути центра, момент и сила «+» — по движению.
 */
export type BodyKind = 'translate' | 'rotate' | 'roll';
export type InertiaKind = 'disk' | 'ring' | 'rho' | 'J';
/**
 * Точка нити на теле: c — сам груз или ось катка; R, r — обод блока радиуса R или r;
 * top — у катка на расстоянии R над осью (скорость ω(r + R)); bottom — на R под осью (ω|r − R|).
 */
export type Attach = 'c' | 'R' | 'r' | 'top' | 'bottom';

export interface Body {
  name: string;
  kind: BodyKind;
  /** Масса (или вес, если задача задана весами). */
  m: number;
  /** Блок: наружный радиус; каток: радиус ступени, на которую намотана нить. */
  R: number;
  /** Блок: радиус второй ступени; каток: радиус качения. */
  r: number;
  /** Момент инерции: сплошной диск, обод, по радиусу инерции ρ или задан J. */
  inertia: InertiaKind;
  /** Радиус инерции ρ или момент инерции J — по виду inertia. */
  I: number;
  /** Угол пути центра к горизонту, градусы (груз и каток). */
  alpha: number;
  /** Центр при движении поднимается. */
  up: boolean;
  /** Коэффициент трения скольжения (груз). */
  f: number;
  /** Коэффициент трения качения δ, м (каток). */
  fk: number;
  /** Момент M(φ) = M₀ + M₁φ + M₂φ², «+» — по движению (блок, каток). */
  M: [number, number, number];
  /** Постоянная сила вдоль пути, «+» — по движению (груз, каток). */
  F: number;
  /** Пружина на центре тела: жёсткость c и начальная деформация λ₀ (λ₀ > 0 — движение увеличивает деформацию). */
  c: number;
  lambda0: number;
  /** Связь с предыдущим телом (у тела 1 — нет). */
  link: { from: number; at: Attach; to: Attach } | null;
}

export type EnergyMode = 'v' | 's' | 'v0';
export interface EnergyProblem {
  bodies: Body[];
  byWeight: boolean;
  /** Что ищем: v после перемещения s; s до скорости v1; начальную скорость v0, чтобы после s скорость стала v1. */
  mode: EnergyMode;
  v0: number;
  s: number;
  v1: number;
}

export const G = 9.81;
const rad = (a: number) => (a * Math.PI) / 180;
const clean = (v: number) => (Math.abs(v) < 1e-12 ? 0 : v);

export const ATTACHES: Record<BodyKind, Attach[]> = { translate: ['c'], rotate: ['R', 'r'], roll: ['c', 'top', 'bottom'] };
export const ATTACH_NAME: Record<Attach, string> = { c: 'центр', R: 'радиус R', r: 'радиус r', top: 'на R над осью', bottom: 'на R под осью' };

/** Скорость точки нити на теле при ω = q, v_C = k. */
export function attachSpeed(b: Body, at: Attach, k: number, q: number): number {
  switch (at) {
    case 'c':
      return k;
    case 'R':
      return q * b.R;
    case 'r':
      return q * b.r;
    case 'top':
      return q * (b.r + b.R);
    case 'bottom':
      return q * Math.abs(b.r - b.R);
  }
}

/** Момент инерции относительно центра масс (на единицу массы — умножается на m). */
export function inertiaPerMass(b: Body): number {
  const rad0 = b.kind === 'roll' ? b.r : b.R;
  switch (b.inertia) {
    case 'disk':
      return rad0 ** 2 / 2;
    case 'ring':
      return rad0 ** 2;
    case 'rho':
      return b.I ** 2;
    case 'J':
      return 0;
  }
}

export interface BodyKin {
  /** v_C / v. */
  k: number;
  /** ω / v. */
  q: number;
  /** Масса тела (m или P/g). */
  mass: number;
  /** Момент инерции относительно центра масс. */
  J: number;
  /** Вклад в приведённую массу: m k² + J q². */
  red: number;
}

/** Слагаемое работы: коэффициенты как функции координаты. */
export interface WorkTerm {
  body: number;
  kind: 'gravity' | 'slide' | 'rolling' | 'force' | 'moment' | 'spring';
  /** Работа при перемещении s. */
  A: (s: number) => number;
  /** Обобщённая сила dA/ds. */
  Q: (s: number) => number;
}

export interface EnergyResult {
  ok: boolean;
  errors: string[];
  /** Ведущее тело — блок: координата φ, скорость ω. */
  angular: boolean;
  kin: BodyKin[];
  mred: number;
  terms: WorkTerm[];
  A: (s: number) => number;
  Q: (s: number) => number;
  /** Ответ. */
  s: number;
  v0: number;
  v: number;
  a: number;
  /** Работа сил на найденном перемещении. */
  Atot: number;
  /** Особые случаи. */
  note: 'ok' | 'stops' | 'never' | 'reverse' | 'impossible';
  /** Если система останавливается раньше — где. */
  sStop: number | null;
  /** Работа линейна по s (ускорение постоянно). */
  linear: boolean;
}

export function validate(pr: EnergyProblem): string[] {
  const e: string[] = [];
  if (!pr.bodies.length) e.push('Нет ни одного тела.');
  pr.bodies.forEach((b, i) => {
    const n = `Тело ${i + 1}`;
    if (!(b.m >= 0)) e.push(`${n}: масса не может быть отрицательной.`);
    if (b.kind === 'rotate' && !(b.R > 0)) e.push(`${n}: радиус R блока — положительное число.`);
    if (b.kind === 'roll' && !(b.r > 0)) e.push(`${n}: радиус качения r — положительное число.`);
    if (b.inertia === 'rho' && !(b.I >= 0)) e.push(`${n}: радиус инерции — неотрицательное число.`);
    if (b.inertia === 'J' && !(b.I >= 0)) e.push(`${n}: момент инерции — неотрицательное число.`);
    if (b.f < 0 || b.fk < 0 || b.c < 0) e.push(`${n}: коэффициенты трения и жёсткость не могут быть отрицательными.`);
    if (i === 0) return;
    const L = b.link;
    if (!L || !(L.from >= 0 && L.from < i)) return void e.push(`${n}: укажите, с каким из предыдущих тел оно связано.`);
    if (!ATTACHES[pr.bodies[L.from].kind].includes(L.at)) e.push(`${n}: точка схода нити не подходит к виду тела ${L.from + 1}.`);
    if (!ATTACHES[b.kind].includes(L.to)) e.push(`${n}: точка крепления нити не подходит к виду тела.`);
    if (b.kind === 'rotate' && L.to === 'r' && !(b.r > 0)) e.push(`${n}: нить на радиусе r, а r = 0.`);
    if (b.kind === 'roll' && L.to === 'bottom' && Math.abs(b.r - b.R) < 1e-12) e.push(`${n}: нить на R под осью при R = r проходит через мгновенный центр скоростей.`);
  });
  return e;
}

/** Кинематика: коэффициенты k_i, q_i через скорость ведущего тела. */
export function kinematics(pr: EnergyProblem): BodyKin[] {
  const out: BodyKin[] = [];
  pr.bodies.forEach((b, i) => {
    let k = 0,
      q = 0;
    if (i === 0) {
      if (b.kind === 'rotate') q = 1;
      else {
        k = 1;
        q = b.kind === 'roll' ? 1 / b.r : 0;
      }
    } else {
      const L = b.link!;
      const src = pr.bodies[L.from];
      const w = attachSpeed(src, L.at, out[L.from].k, out[L.from].q);
      if (b.kind === 'translate') k = w;
      else if (b.kind === 'rotate') q = w / (L.to === 'r' ? b.r : b.R);
      else {
        q = L.to === 'c' ? w / b.r : L.to === 'top' ? w / (b.r + b.R) : w / Math.abs(b.r - b.R);
        k = q * b.r;
      }
    }
    const mass = pr.byWeight ? b.m / G : b.m;
    const J = b.kind === 'translate' ? 0 : b.inertia === 'J' ? b.I : mass * inertiaPerMass(b);
    out.push({ k: clean(k), q: clean(q), mass, J, red: mass * k * k + J * q * q });
  });
  return out;
}

/** Слагаемые работы. Вес тела: P = m g (или задан). */
export function workTerms(pr: EnergyProblem, kin: BodyKin[]): WorkTerm[] {
  const T: WorkTerm[] = [];
  pr.bodies.forEach((b, i) => {
    const { k, q } = kin[i];
    const P = pr.byWeight ? b.m : b.m * G;
    const sa = Math.sin(rad(b.alpha)),
      ca = clean(Math.cos(rad(b.alpha)));
    const lin = (kind: WorkTerm['kind'], c: number) => {
      if (Math.abs(c) > 1e-15) T.push({ body: i, kind, A: (s) => c * s, Q: () => c });
    };
    if (b.kind !== 'rotate' && P > 0 && k !== 0) lin('gravity', (b.up ? -1 : 1) * P * sa * k);
    if (b.kind === 'translate' && b.f > 0) lin('slide', -b.f * P * ca * k);
    if (b.kind === 'roll' && b.fk > 0) lin('rolling', -b.fk * P * ca * q);
    if (b.kind !== 'rotate' && b.F !== 0) lin('force', b.F * k);
    if (b.kind !== 'translate' && b.M.some((x) => x !== 0) && q !== 0) {
      const [M0, M1, M2] = b.M;
      T.push({ body: i, kind: 'moment', A: (s) => M0 * q * s + (M1 * (q * s) ** 2) / 2 + (M2 * (q * s) ** 3) / 3, Q: (s) => (M0 + M1 * q * s + M2 * (q * s) ** 2) * q });
    }
    if (b.kind !== 'rotate' && b.c > 0 && k !== 0) {
      const { c, lambda0: l0 } = b;
      T.push({ body: i, kind: 'spring', A: (s) => (c / 2) * (l0 ** 2 - (l0 + k * s) ** 2), Q: (s) => -c * (l0 + k * s) * k });
    }
  });
  return T;
}

export function solveEnergy(pr: EnergyProblem): EnergyResult {
  const errors = validate(pr);
  const angular = pr.bodies[0]?.kind === 'rotate';
  const fail = (errs: string[]): EnergyResult => ({ ok: false, errors: errs, angular, kin: [], mred: 0, terms: [], A: () => 0, Q: () => 0, s: 0, v0: 0, v: 0, a: 0, Atot: 0, note: 'impossible', sStop: null, linear: true });
  if (errors.length) return fail(errors);
  const kin = kinematics(pr);
  const mred = kin.reduce((s, x) => s + x.red, 0);
  if (!(mred > 1e-15)) return fail(['Приведённая масса равна нулю: у системы нет инерции.']);
  const terms = workTerms(pr, kin);
  const A = (s: number) => terms.reduce((t, w) => t + w.A(s), 0);
  const Q = (s: number) => terms.reduce((t, w) => t + w.Q(s), 0);
  const linear = terms.every((t) => t.kind !== 'spring' && (t.kind !== 'moment' || (pr.bodies[t.body].M[1] === 0 && pr.bodies[t.body].M[2] === 0)));
  const v2 = (v0: number, s: number) => v0 * v0 + (2 * A(s)) / mred;
  /** Первая точка (0, sMax], где v² = 0. */
  const firstStop = (v0: number, sMax: number): number | null => {
    const n = 2000;
    let prev = 0;
    for (let j = 1; j <= n; j++) {
      const x = (sMax * j) / n;
      if (v2(v0, x) < 0) {
        let lo = prev,
          hi = x;
        for (let it = 0; it < 100; it++) {
          const mid = (lo + hi) / 2;
          if (v2(v0, mid) < 0) hi = mid;
          else lo = mid;
        }
        return lo;
      }
      prev = x;
    }
    return null;
  };
  const base = { ok: true, errors: [], angular, kin, mred, terms, A, Q, linear };
  const start = { reverse: pr.v0 === 0 && Q(0) < -1e-12 };
  if (pr.mode === 'v' || pr.mode === 'v0') {
    const s = pr.s;
    if (pr.mode === 'v0') {
      const need = pr.v1 * pr.v1 - (2 * A(s)) / mred;
      if (need < -1e-12) return { ...base, s, v0: 0, v: pr.v1, a: Q(s) / mred, Atot: A(s), note: 'impossible', sStop: null };
      const v0 = Math.sqrt(Math.max(0, need));
      const stop = firstStop(v0, s * (1 - 1e-9));
      return { ...base, s, v0, v: pr.v1, a: Q(s) / mred, Atot: A(s), note: stop != null && stop < s * (1 - 1e-6) ? 'stops' : 'ok', sStop: stop };
    }
    // Из покоя обобщённая сила отрицательна: сама система в заданную сторону не пойдёт. Ответ по теореме — формальный.
    if (start.reverse) return { ...base, s, v0: 0, v: Math.sqrt(Math.max(0, v2(0, s))), a: Q(s) / mred, Atot: A(s), note: 'reverse', sStop: 0 };
    const stop = firstStop(pr.v0, s);
    if (stop != null) return { ...base, s, v0: pr.v0, v: 0, a: Q(stop) / mred, Atot: A(stop), note: 'stops', sStop: stop };
    return { ...base, s, v0: pr.v0, v: Math.sqrt(Math.max(0, v2(pr.v0, s))), a: Q(s) / mred, Atot: A(s), note: 'ok', sStop: null };
  }
  // mode 's': первая координата, где скорость равна v1.
  if (start.reverse && pr.v1 > 0) return { ...base, s: 0, v0: pr.v0, v: 0, a: Q(0) / mred, Atot: 0, note: 'reverse', sStop: 0 };
  const target = pr.v1 * pr.v1;
  const g = (x: number) => v2(pr.v0, x) - target;
  const sign0 = Math.sign(g(0));
  if (sign0 === 0) return { ...base, s: 0, v0: pr.v0, v: pr.v1, a: Q(0) / mred, Atot: 0, note: 'ok', sStop: null };
  let lo = 0,
    hi = 0;
  let found = false;
  for (let x = 1e-6, prev = 0; x < 1e9; prev = x, x *= 1.05) {
    if (Math.sign(g(x)) !== sign0) {
      lo = prev;
      hi = x;
      found = true;
      break;
    }
    if (v2(pr.v0, x) < 0 && target > 0) break;
  }
  if (!found) return { ...base, s: 0, v0: pr.v0, v: pr.v1, a: Q(0) / mred, Atot: 0, note: 'never', sStop: firstStop(pr.v0, 1e6) };
  for (let it = 0; it < 200; it++) {
    const mid = (lo + hi) / 2;
    if (Math.sign(g(mid)) === sign0) lo = mid;
    else hi = mid;
  }
  const s = (lo + hi) / 2;
  const stop = target > 0 ? firstStop(pr.v0, s * (1 - 1e-9)) : null;
  return { ...base, s, v0: pr.v0, v: pr.v1, a: Q(s) / mred, Atot: A(s), note: stop != null ? 'never' : 'ok', sStop: stop };
}
