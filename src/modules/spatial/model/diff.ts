/**
 * Коническая дифференциальная (планетарная) передача (Мещерский 25.12–25.14, 25.18–25.23; Яблонский К.8, варианты 21–30).
 *
 * Центральные колёса 1 и 2 (радиусы R₁, R₂) и водило H вращаются вокруг общей оси; сателлит свободно сидит на оси,
 * закреплённой в водиле перпендикулярно главной оси, и зацепляется с колесом 1 венцом r₁, с колесом 2 — венцом r₂.
 * В движении относительно водила все оси неподвижны (метод Виллиса): (ω₁ − ω_H)R₁ = ω_c·r₁ — скорость точки зацепления,
 * (ω₂ − ω_H)R₂ = ∓ω_c·r₂. Знак «−» — колёса стоят навстречу друг другу по разные стороны сателлита (обычный
 * дифференциал): (ω₁ − ω_H)/(ω₂ − ω_H) = −R₂r₁/(R₁r₂); «+» — по одну сторону.
 * Два из ω₁, ω₂, ω_H заданы (колесо может быть неподвижным: ω = 0), третья находится. Сателлит: относительная
 * угловая скорость ω_c = (ω₁ − ω_H)R₁/r₁ вокруг своей оси, абсолютная ω = ω_H + ω_c (векторы перпендикулярны),
 * скорость центра сателлита v = |ω_H|·d.
 * Задний мост автомобиля на повороте: колёса радиуса R_к при скорости v по кривой радиуса ρ (колея l):
 * ω₁ = v(ρ + l/2)/(ρR_к), ω₂ = v(ρ − l/2)/(ρR_к).
 */
export type DiffUnknown = 'H' | '1' | '2';
export interface DiffProblem {
  R1: number;
  r1: number;
  R2: number;
  r2: number;
  /** Колёса по разные стороны сателлита (−) или по одну (+). */
  sign: 'opp' | 'same';
  unknown: DiffUnknown;
  w1: number;
  w2: number;
  wH: number;
  /** Расстояние центра сателлита от главной оси (0 — не задано). */
  d: number;
  car: { on: boolean; v: number; rho: number; l: number; Rw: number };
}
export interface DiffResult {
  ok: true;
  /** Передаточное отношение в движении относительно водила i = (ω₁ − ω_H)/(ω₂ − ω_H). */
  i: number;
  w1: number;
  w2: number;
  wH: number;
  /** Относительная угловая скорость сателлита, абсолютная (модуль), скорость центра. */
  ws: number;
  wAbs: number;
  vC: number | null;
  car: { w1: number; w2: number } | null;
}
export type DiffOut = DiffResult | { ok: false; error: string };

export function solveDiff(pr: DiffProblem): DiffOut {
  if (![pr.R1, pr.r1, pr.R2, pr.r2].every((x) => x > 0)) return { ok: false, error: 'Радиусы колёс и венцов сателлита — положительные.' };
  const i = ((pr.sign === 'opp' ? -1 : 1) * (pr.R2 * pr.r1)) / (pr.R1 * pr.r2);
  let { w1, w2, wH } = pr;
  let car: DiffResult['car'] = null;
  if (pr.car.on) {
    const c = pr.car;
    if (!(c.rho > c.l / 2 && c.Rw > 0 && c.l > 0))
      return { ok: false, error: 'Автомобиль: радиус поворота больше половины колеи, радиус колеса и колея — положительные.' };
    w1 = (c.v * (c.rho + c.l / 2)) / (c.rho * c.Rw);
    w2 = (c.v * (c.rho - c.l / 2)) / (c.rho * c.Rw);
    car = { w1, w2 };
    if (pr.unknown !== 'H')
      return { ok: false, error: 'По скорости автомобиля известны угловые скорости колёс — неизвестна угловая скорость коробки (водила).' };
  }
  // ω₁ − ω_H = i(ω₂ − ω_H).
  if (pr.unknown === 'H') {
    if (Math.abs(1 - i) < 1e-12) return { ok: false, error: 'При i = 1 водило не определяется (колёса вращаются как одно целое).' };
    wH = (w1 - i * w2) / (1 - i);
  } else if (pr.unknown === '1') w1 = wH + i * (w2 - wH);
  else {
    if (Math.abs(i) < 1e-12) return { ok: false, error: 'i = 0 — проверьте радиусы.' };
    w2 = wH + (w1 - wH) / i;
  }
  const ws = ((w1 - wH) * pr.R1) / pr.r1;
  return { ok: true, i, w1, w2, wH, ws, wAbs: Math.hypot(wH, ws), vC: pr.d > 0 ? Math.abs(wH) * pr.d : null, car };
}
