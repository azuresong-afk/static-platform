/**
 * Подбор сечения балки из условия прочности по нормальным напряжениям и проверка по касательным.
 *
 * Единицы: M — кН·м, Q — кН (как на чертеже), напряжения — МПа, W — см³, размеры — см (в тексте ещё мм).
 *   σ = M/W:  M·10³ Н·м / (W·10⁻⁶ м³) = M/W·10³ МПа  ⇒  W ≥ M·10³/[σ] см³;
 *   τ = k·Q/A: Q·10³ Н / (A·10⁻⁴ м²) = Q/A·10 МПа;
 *   τ = Q·Sx/(Ix·s): Q·10³·Sx·10⁻⁶ / (Ix·10⁻⁸ · s·10⁻²) = Q·Sx/(Ix·s)·10 МПа (s в см).
 * Прямоугольник h = k·b: W = b·h²/6 = k²·b³/6; τmax = 3/2·Q/A.
 * Круг: W = π·d³/32; τmax = 4/3·Q/A.
 * Двутавр — наименьший номер ГОСТ 8239-89, у которого σ = M/Wx не больше [σ] с допустимым перенапряжением.
 */
import { GOST_8239, type IBeam } from './sortament';

export interface DesignInput {
  /** Наибольший по модулю изгибающий момент, кН·м. */
  M: number;
  /** Наибольшая по модулю поперечная сила, кН. */
  Q: number;
  /** Допускаемое нормальное напряжение, МПа. */
  sigma: number;
  /** Допускаемое касательное напряжение, МПа. */
  tau: number;
  /** Отношение h/b прямоугольника. */
  k: number;
  /** Допустимое перенапряжение для двутавра, % (0 — без перенапряжения). */
  overload: number;
}

export interface Shape {
  /** Площадь, см². */
  A: number;
  /** Момент сопротивления фактического сечения, см³. */
  W: number;
  /** Нормальное напряжение в фактическом сечении, МПа. */
  sigma: number;
  /** Наибольшее касательное напряжение, МПа. */
  tau: number;
  tauOk: boolean;
}

export interface Design {
  /** Требуемый момент сопротивления, см³. */
  Wreq: number;
  rect: Shape & { bCalc: number; b: number; h: number };
  circle: Shape & { dCalc: number; d: number };
  /** null — не подходит ни один двутавр таблицы. */
  ibeam: (Shape & { p: IBeam; /** Меньший номер, который не прошёл. */ prev: IBeam | null }) | null;
  /** Какое сечение легче (наименьшая площадь). */
  best: 'rect' | 'circle' | 'ibeam';
}

/** Округление размера вверх до целого миллиметра (размер в см). */
export const ceilMm = (cm: number): number => Math.ceil(cm * 10 - 1e-9) / 10;

export function design(inp: DesignInput): Design {
  const M = Math.abs(inp.M),
    Q = Math.abs(inp.Q);
  const Wreq = (M * 1e3) / inp.sigma;
  const sigmaOf = (W: number) => (M * 1e3) / W;

  const bCalc = Math.cbrt((6 * Wreq) / (inp.k * inp.k));
  const b = ceilMm(bCalc),
    h = ceilMm(inp.k * b);
  const rA = b * h,
    rW = (b * h * h) / 6,
    rTau = ((1.5 * Q) / rA) * 10;
  const rect = { bCalc, b, h, A: rA, W: rW, sigma: sigmaOf(rW), tau: rTau, tauOk: rTau <= inp.tau + 1e-9 };

  const dCalc = Math.cbrt((32 * Wreq) / Math.PI);
  const d = ceilMm(dCalc);
  const cA = (Math.PI * d * d) / 4,
    cW = (Math.PI * d ** 3) / 32,
    cTau = (((4 / 3) * Q) / cA) * 10;
  const circle = { dCalc, d, A: cA, W: cW, sigma: sigmaOf(cW), tau: cTau, tauOk: cTau <= inp.tau + 1e-9 };

  const limit = inp.sigma * (1 + inp.overload / 100);
  const i = GOST_8239.findIndex((p) => sigmaOf(p.Wx) <= limit + 1e-9);
  let ibeam: Design['ibeam'] = null;
  if (i >= 0) {
    const p = GOST_8239[i];
    const iTau = ((Q * p.Sx) / (p.Ix * (p.s / 10))) * 10;
    ibeam = { p, prev: i > 0 ? GOST_8239[i - 1] : null, A: p.A, W: p.Wx, sigma: sigmaOf(p.Wx), tau: iTau, tauOk: iTau <= inp.tau + 1e-9 };
  }
  const areas: [Design['best'], number][] = [
    ['rect', rect.A],
    ['circle', circle.A],
  ];
  if (ibeam) areas.push(['ibeam', ibeam.A]);
  const best = areas.reduce((a, c) => (c[1] < a[1] ? c : a))[0];
  return { Wreq, rect, circle, ibeam, best };
}
