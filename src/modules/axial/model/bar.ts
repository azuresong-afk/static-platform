/**
 * Ступенчатый брус при растяжении-сжатии (Антонов, гл. 3; задачи 1.1 и 1.2).
 *
 * Брус горизонтальный, ось z направлена слева направо, начало — левый торец. Брус состоит из ступеней
 * (участков) длиной l_i с площадью A_i = c_i·A; на участке может быть нагрев ΔT_i. Сосредоточенные силы
 * приложены в узлах (границах ступеней и торцах), «+» — вдоль оси z (вправо).
 * Закрепление: заделка слева, справа или с обеих сторон (один раз статически неопределимый брус).
 * Нагрев включается отдельно (heat): при выключенном ΔT участков не учитываются.
 *
 * Подбор площади при нагреве бруса с двумя заделками: N_i = P_i + H·A — часть от сил P_i от A не зависит, температурная
 * H·A пропорциональна A. Напряжения σ_i = a_i/A + b_i, a_i = 10·P_i/c_i, b_i = 10·H/c_i: температурные от A не зависят.
 * Условие |σ_i| ≤ [σ] — линейные неравенства относительно 1/A; наименьшая площадь A_min, иногда и наибольшая A_max
 * (когда сжатие от нагрева само больше [σ] и его частично снимает растяжение от сил); подходящей площади может не быть.
 *
 * Правило знаков: N > 0 — растяжение. Для участка N равна сумме сил по одну сторону от сечения:
 * справа — сила вправо «+», слева — сила влево «+».
 *
 * Единицы: силы — кН, длины — м, площади — см², E и напряжения — МПа, α — 1/К, ΔT — К, перемещения — мм.
 *   σ = N/A: кН/см² = 10 МПа;  Δl = N·l/(E·A) = N·10³·l/(E·10⁶·A·10⁻⁴) м = 10·N·l/(E·A) м.
 */

export interface Step {
  /** Длина, м. */
  l: number;
  /** Площадь в долях A: A_i = c·A. */
  c: number;
  /** Нагрев, К (охлаждение — «−»). */
  dT: number;
}

export interface Bar {
  steps: Step[];
  /** Силы в узлах 0…n (n — число ступеней), кН; «+» — вправо. */
  forces: number[];
  supports: 'left' | 'right' | 'both';
  /** Модуль упругости, МПа. */
  E: number;
  /** Коэффициент линейного расширения, 1/К. */
  alpha: number;
  /** Площадь A: найти из условия прочности или задана. */
  areaMode: 'find' | 'given';
  /** Заданная площадь A, см². */
  A: number;
  /** Допускаемое напряжение, МПа. */
  sigmaAllow: number;
  /** Предел текучести, МПа (для запаса прочности; 0 — не считать). */
  sigmaT: number;
  /** Нагрев учитывается (если не задано — есть, когда хотя бы у одного участка ΔT ≠ 0). */
  heat?: boolean;
}

export interface StepResult {
  /** Координаты начала и конца участка, м. */
  z0: number;
  z1: number;
  /** Продольная сила, кН. */
  N: number;
  /** Площадь, см². */
  A: number;
  /** Нормальное напряжение, МПа. */
  sigma: number;
  /** Деформация от напряжения σ/E и температурная α·ΔT. */
  epsSigma: number;
  epsT: number;
  /** Удлинение участка, мм. */
  dl: number;
  /** Перемещения концов участка, мм («+» — вправо). */
  u0: number;
  u1: number;
}

export type BarError = 'nosupport' | 'nosteps' | 'heatNoArea' | 'heatOnly';

export interface BarSolution {
  ok: true;
  /** Площадь A, см² (найденная или заданная). */
  A: number;
  /** Реакции заделок, кН, «+» — вправо (сила, действующая на брус). */
  RA: number | null;
  RB: number | null;
  steps: StepResult[];
  /** Наибольшее по модулю напряжение и номер участка. */
  sigmaMax: { v: number; i: number };
  /** Наибольшее по модулю перемещение и координата. */
  uMax: { v: number; z: number };
  /** Запас по пределу текучести σт/|σ|max (если задан σт). */
  nT: number | null;
  /** Для статически неопределимого бруса: N от сил при отброшенной правой заделке и податливость. */
  indet: { N0: number[]; flex: number; heat: number } | null;
  /**
   * Подбор площади при нагреве (две заделки): σ_i = a_i/A + b_i, МПа; A_min и, если есть, A_max (см²);
   * участки, задающие границы.
   */
  heatArea: { a: number[]; b: number[]; min: number; max: number | null; iMin: number; iMax: number | null } | null;
}

export type BarResult = BarSolution | { ok: false; why: BarError; thermal?: number[] };

/** Нагрев учитывается? Флаг heat, а без него — по наличию ΔT. */
export const heated = (b: Bar): boolean => b.heat ?? b.steps.some((s) => s.dT !== 0);
/** Брус с учётом флага нагрева: при выключенном нагреве ΔT участков обнуляются. */
export const effectiveBar = (b: Bar): Bar => (heated(b) || !b.steps.some((s) => s.dT !== 0) ? b : { ...b, steps: b.steps.map((s) => ({ ...s, dT: 0 })) });

/**
 * Площадь по условию |a_i/A + b_i| ≤ S для всех участков: наименьшая A_min и наибольшая A_max (null — нет границы).
 * Неравенства линейны относительно u = 1/A: верхняя граница u даёт A_min, нижняя — A_max.
 */
export function heatAreaRange(a: number[], b: number[], S: number): { min: number; max: number | null; iMin: number; iMax: number | null } | 'none' | 'any' {
  let hi = Infinity,
    lo = 0,
    iMin = -1,
    iMax: number | null = null;
  // a_i, равные нулю с точностью округления, вызывающий обнуляет сам (по масштабу сил).
  for (let i = 0; i < a.length; i++) {
    if (a[i] === 0) {
      if (Math.abs(b[i]) > S * (1 + 1e-12)) return 'none';
      continue;
    }
    // −S ≤ a·u + b ≤ S.
    // Верхняя граница 1/A: (S ∓ b)/|a|; если запас S ∓ b исчезающе мал или отрицателен, площади нет.
    const room = a[i] > 0 ? S - b[i] : S + b[i];
    if (room <= S * 1e-12) return 'none';
    const up = room / Math.abs(a[i]);
    if (up < hi) (hi = up), (iMin = i);
    // Нижняя граница 1/A (верхняя для A) — только если напряжение от нагрева больше [σ] (с допуском на округление).
    if (Math.abs(b[i]) > S * (1 + 1e-12) && Math.sign(b[i]) !== Math.sign(a[i])) {
      const down = a[i] > 0 ? (-S - b[i]) / a[i] : (S - b[i]) / a[i];
      if (down > lo) (lo = down), (iMax = i);
    }
  }
  if (!Number.isFinite(hi)) return 'any';
  if (!(hi > 0) || lo > hi * (1 + 1e-12)) return 'none';
  return { min: 1 / hi, max: lo > 0 ? 1 / lo : null, iMin, iMax: lo > 0 ? iMax : null };
}

/** Узел, в котором сила принимается заделкой (в N не входит). */
export const heldBySupport = (b: Bar, node: number): boolean => (node === 0 && b.supports !== 'right') || (node === b.steps.length && b.supports !== 'left');

/** N_i от сил, если реакции заделок нет справа: сумма сил правее участка (с заделкой справа — через левую часть). */
function normalForces(b: Bar, useRight: boolean): number[] {
  const n = b.steps.length;
  return b.steps.map((_, i) => {
    let N = 0;
    if (useRight) for (let j = i + 1; j <= n; j++) N += heldBySupport(b, j) && j === n ? 0 : b.forces[j] ?? 0;
    else for (let j = 0; j <= i; j++) N -= heldBySupport(b, j) && j === 0 ? 0 : b.forces[j] ?? 0;
    return N;
  });
}

export function solveBar(b0: Bar): BarResult {
  const b = effectiveBar(b0);
  const n = b.steps.length;
  if (!n) return { ok: false, why: 'nosteps' };
  const heat = b.steps.some((s) => Math.abs(s.dT) > 0);
  let heatArea: BarSolution['heatArea'] = null;

  // Податливость l/(E·c) — в долях 1/A: удлинение участка 10·N·l/(E·c·A) м.
  const flexOf = (s: Step) => s.l / (b.E * s.c);
  let N: number[];
  let indet: BarSolution['indet'] = null;
  let RA: number | null = null,
    RB: number | null = null;
  let A = b.A;

  if (b.supports === 'both') {
    // Метод сил: отбрасываем правую заделку, её реакция R_B (вправо «+») растягивает все участки: N_i = N0_i + R_B.
    const N0 = normalForces({ ...b, supports: 'left' }, true);
    const flex = b.steps.reduce((acc, s) => acc + flexOf(s), 0);
    // Δ_B = Σ 10·(N0_i + R_B)·l_i/(E·c_i·A) + Σ α·ΔT_i·l_i = 0 (в метрах).
    const force = b.steps.reduce((acc, s, i) => acc + N0[i] * flexOf(s), 0);
    const thermal = b.steps.reduce((acc, s) => acc + b.alpha * s.dT * s.l, 0);
    if (b.areaMode === 'find' && heat) {
      // N_i = P_i + H·A: P_i — от сил, H·A — от нагрева; σ_i = a_i/A + b_i.
      // Сила в узле заделки уходит в заделку: P = 0 с точностью округления — обнуляем по масштабу сил.
      const pScale = Math.max(1, ...N0.map(Math.abs), Math.abs(force / flex));
      const P = N0.map((x) => (Math.abs(x - force / flex) < 1e-12 * pScale ? 0 : x - force / flex));
      const H = -thermal / (10 * flex);
      const a = P.map((x, i) => (10 * x) / b.steps[i].c),
        bb = b.steps.map((s) => (10 * H) / s.c);
      const r = heatAreaRange(a, bb, b.sigmaAllow);
      if (r === 'none') return { ok: false, why: 'heatNoArea', thermal: bb };
      if (r === 'any') return { ok: false, why: 'heatOnly', thermal: bb };
      heatArea = { a, b: bb, ...r };
      A = r.min;
    } else if (b.areaMode === 'find') A = NaN; // найдём ниже: без нагрева N от A не зависит
    const Aeff = b.areaMode === 'find' && !heat ? 1 : A;
    RB = -(force + (thermal * Aeff) / 10) / flex;
    N = N0.map((x) => x + (RB as number));
    indet = { N0, flex, heat: thermal };
  } else N = normalForces(b, b.supports === 'left');

  if (b.areaMode === 'find' && !heatArea) {
    // σ_i = N_i/(c_i·A)·10 ≤ [σ]  ⇒  A ≥ 10·|N_i|/(c_i·[σ]).
    A = Math.max(...N.map((x, i) => (10 * Math.abs(x)) / (b.steps[i].c * b.sigmaAllow)));
    if (!(A > 0)) A = 0;
  }
  // Реакции заделок из равновесия: ΣF = 0.
  const sumP = b.forces.reduce((acc, f, j) => acc + (heldBySupport(b, j) ? 0 : f), 0);
  const held = (j: number) => (heldBySupport(b, j) ? (b.forces[j] ?? 0) : 0);
  if (b.supports === 'left') RA = -sumP - held(0);
  else if (b.supports === 'right') RB = -sumP - held(n);
  else RA = -sumP - (RB as number) - held(0) - held(n);

  const res: StepResult[] = [];
  let z = 0;
  const safeA = A > 0 ? A : NaN;
  for (let i = 0; i < n; i++) {
    const s = b.steps[i];
    const Ai = s.c * safeA;
    const sigma = (10 * N[i]) / Ai;
    const epsSigma = sigma / b.E,
      epsT = b.alpha * s.dT;
    res.push({ z0: z, z1: z + s.l, N: N[i], A: Ai, sigma, epsSigma, epsT, dl: (epsSigma + epsT) * s.l * 1000, u0: 0, u1: 0 });
    z += s.l;
  }
  // Перемещения — от заделки: слева — накоплением удлинений, справа — с конца.
  if (b.supports === 'right') {
    let u = 0;
    for (let i = n - 1; i >= 0; i--) {
      res[i].u1 = u;
      u -= res[i].dl;
      res[i].u0 = u;
    }
  } else {
    let u = 0;
    for (const r of res) {
      r.u0 = u;
      u += r.dl;
      r.u1 = u;
    }
  }
  let sigmaMax = { v: 0, i: 0 },
    uMax = { v: 0, z: 0 };
  res.forEach((r, i) => {
    if (Math.abs(r.sigma) > Math.abs(sigmaMax.v) + 1e-12) sigmaMax = { v: r.sigma, i };
    for (const [u, zz] of [
      [r.u0, r.z0],
      [r.u1, r.z1],
    ])
      if (Math.abs(u) > Math.abs(uMax.v) + 1e-12) uMax = { v: u, z: zz };
  });
  const nT = b.sigmaT > 0 && Math.abs(sigmaMax.v) > 1e-12 ? b.sigmaT / Math.abs(sigmaMax.v) : null;
  return { ok: true, A: safeA, RA, RB, steps: res, sigmaMax, uMax, nT, indet, heatArea };
}
