/** Готовые задачи вкладки «Тяготение и орбиты»: Мещерский §28, 30, 50, 51. Ответы — по книге или по её формулам. */
import type { OrbitProblem, PlanetProblem, RadialProblem } from './model/orbit';

export type OrbMode = 'planet' | 'orbit' | 'radial';
export interface OrbState {
  mode: OrbMode;
  planet: PlanetProblem;
  orbit: OrbitProblem;
  radial: RadialProblem;
}
export interface OrbPreset {
  title: string;
  problem: { mode: 'planet'; planet: PlanetProblem } | { mode: 'orbit'; orbit: OrbitProblem } | { mode: 'radial'; radial: RadialProblem };
  /**
   * Ответ. Небесное тело: mu, g, R, v1, T1 (с), v2, vc, Tc, Hs, A1, A2. Орбита: c, p, h, e, nu (°), a, b, T (с), rp, ra,
   * Hmin, Hmax, vpe, va, Fp, Fa; после импульса — u (модуль импульса), T1, rp1, ra1; v1 — скорость на расстоянии r₁;
   * сила-формула — rEnd, phiEnd (°), rmin, rmax. Прямолинейное движение: xtop, H (= x_top − R), ttop, vinf, v1, t1, v0,
   * x0, H0 (= x₀ − R).
   */
  book?: Record<string, number>;
  relTol?: number;
  absTol?: number;
  note?: string;
}
export const planet = (o: Partial<PlanetProblem>): PlanetProblem => ({ body: 'earth', g: 9.81, R: 6370, mRatio: 1, rRatio: 1, H: 0, Trot: 0, G: 0, ...o });
export const orbit = (o: Partial<OrbitProblem>): OrbitProblem => ({
  unit: 'km',
  force: 'newton',
  muMode: 'planet',
  mu: 398000,
  g: 9.81,
  R: 6370,
  m: 0,
  def: 'state',
  r0: 6670,
  v0: 8,
  th0: 0,
  ph0: 0,
  shape: 'apsides',
  e1: 6670,
  e2: 8000,
  scale: 'mu',
  T: 5400,
  vp: 8,
  man: 'none',
  dvt: 0,
  dvr: 0,
  tgtKind: 'tang',
  tgt: 'apo',
  tgtVal: 42000,
  r1: 0,
  ar: '-1/r^2',
  t1: 10,
  ...o,
});
export const radial = (o: Partial<RadialProblem>): RadialProblem => ({
  unit: 'km',
  muMode: 'planet',
  mu1: 398000,
  g: 9.81,
  R: 6370,
  repel: false,
  two: false,
  k2: 0.0123,
  d: 384000,
  acc: 0,
  fromInf: false,
  vinf: 10,
  x0: 6370,
  v0: 1,
  ask: 'top',
  x1: 0,
  ...o,
});
const P = (o: Partial<PlanetProblem>) => ({ mode: 'planet' as const, planet: planet(o) });
const O = (o: Partial<OrbitProblem>) => ({ mode: 'orbit' as const, orbit: orbit(o) });
const X = (o: Partial<RadialProblem>) => ({ mode: 'radial' as const, radial: radial(o) });
const MIN = 60;
const deg = (a: number) => (a * 180) / Math.PI;

// 28.19: окружность r = 2 cos φ, c = r₀v₀ = 1: t = 2φ + sin 2φ; положение в момент t = 3 с.
let phi19 = 1;
for (let i = 0; i < 50; i++) phi19 -= (2 * phi19 + Math.sin(2 * phi19) - 3) / (2 + 2 * Math.cos(2 * phi19));
// 50.35–50.36: круговая орбита r = 7000 км, T = 5830 с, импульс u = 0,5 км/с.
const s35 = { r: 7000, T: 5830, u: 0.5 };
const q35 = (s35.u * s35.T) / (2 * Math.PI * s35.r);
// 50.37, 50.39: μ = 3,98·10⁵ км³/с².
const MU = 398000;
const s37 = { r: 7000, r1: 6600 };
const s39 = { r1: 6800, r2: 8000, H: 1000 };
// 51.3–51.4: два шара по 1000 кг, f = 6,67·10⁻¹¹ м³/(кг·с²): μ = f(m₁ + m₂).
const mu51 = 6.67e-11 * 2000;
// 51.7: Луна μ = 4900 км³/с², R = 1738 км, v₀ = 1 км/с к центру, торможение T = 3 м/с².
const s7 = { mu: 4900, R: 1738, v0: 1, T: 0.003 };
const B7 = s7.mu / s7.R + s7.T * s7.R + s7.v0 ** 2 / 2;

export const ORB_PRESETS = {
  m501: {
    title: 'Мещерский 50.1, 50.4, 50.11: Земля — μ, первая и вторая космические скорости',
    problem: P({ body: 'earth' }),
    book: { mu: 3.98e5, v1: 7.91, T1: 84.3 * MIN, v2: 11.2 },
    note: 'R = 6370 км, g = 9,81 м/с². Книга: μ = gR² = 3,98·10⁵ км³/с²; v₁ = √(gR) = 7,91 км/с, T = 84,3 мин; v₂ = √2·v₁ = 11,2 км/с.',
  },
  m502: {
    title: 'Мещерский 50.2, 50.4, 50.11: Луна — μ, g и космические скорости',
    problem: P({ body: 'moon' }),
    book: { mu: 4.9e3, g: 1.62, v1: 1.68, T1: 108 * MIN, v2: 2.37 },
    relTol: 0.006,
    note: 'M_Л : M = 0,0123, R_Л : R = 0,273. Книга: μ = 4,90·10³ км³/с², g = 1,62 м/с²; v₁ = 1,68 км/с, T = 108 мин; v₂ = 2,37 км/с.',
  },
  m502v: {
    title: 'Мещерский 50.2, 50.4, 50.11: Венера — μ, g и космические скорости',
    problem: P({ body: 'venus' }),
    book: { mu: 326e3, g: 8.75, v1: 7.3, T1: 87.5 * MIN, v2: 10.3 },
    relTol: 0.01,
    note: 'M : M_З = 0,814, R : R_З = 0,958. Книга: μ = 326·10³ км³/с², g = 8,75 м/с²; v₁ = 7,30 км/с, T = 87,5 мин; v₂ = 10,3 км/с. По данным задачи μ = 0,814·3,98·10⁵ = 324·10³ км³/с² и g = 8,70 м/с² (книжные 326·10³ получаются при μ_З ≈ 4,0·10⁵).',
  },
  m502m: {
    title: 'Мещерский 50.2, 50.4, 50.11: Марс — μ, g и космические скорости',
    problem: P({ body: 'mars' }),
    book: { mu: 42.8e3, g: 3.69, v1: 3.54, T1: 101 * MIN, v2: 5.0 },
    relTol: 0.01,
    note: 'M : M_З = 0,107, R : R_З = 0,535. Книга: μ = 42,8·10³ км³/с², g = 3,69 м/с²; v₁ = 3,54 км/с, T = 101 мин; v₂ = 5,0 км/с. По данным задачи μ = 0,107·3,98·10⁵ = 42,6·10³ км³/с² и g = 3,67 м/с² (книжные значения — при μ_З ≈ 4,0·10⁵).',
  },
  m502j: {
    title: 'Мещерский 50.2, 50.4, 50.11: Юпитер — μ, g и космические скорости',
    problem: P({ body: 'jupiter' }),
    book: { mu: 126e6, g: 26.0, v1: 42.6, T1: 172 * MIN, v2: 60.2 },
    note: 'M : M_З = 317, R : R_З = 10,95. Книга: μ = 126·10⁶ км³/с², g = 26,0 м/с²; v₁ = 42,6 км/с, T = 172 мин; v₂ = 60,2 км/с.',
  },
  m505: {
    title: 'Мещерский 50.5: высота стационарной орбиты',
    problem: P({ body: 'earth', Trot: 86164 }),
    book: { Hs: 35800 },
    note: 'Спутник в плоскости экватора делает оборот за звёздные сутки T = 86 164 с (23 ч 56 мин 4 с): r³ = μT²/(4π²). Книга: H = 35 800 км.',
  },
  m5108: {
    title: 'Мещерский 51.8: работа двигателя на подъём и разгон аппарата',
    problem: P({ body: 'earth', H: 300, G: 5 }),
    book: { A2: 31850, A1: (5 * 6370 * (6370 + 600)) / (2 * 6670) },
    relTol: 1e-9,
    note: 'Вес аппарата G = 5 т, высота H = 300 км. Книга: A₁ = GR(R + 2H)/(2(R + H)) — для круговой скорости, A₂ = GR — для параболической; для Земли A₂ = 31 850 т·км.',
  },
  m2808: {
    title: 'Мещерский 28.8: скорость в наиболее удалённой точке',
    problem: O({ unit: 'cm', def: 'elements', shape: 'apsides', e1: 1, e2: 5, scale: 'vp', vp: 30, R: 0 }),
    book: { va: 6 },
    relTol: 1e-9,
    note: 'r₂ = 5r₁, v₁ = 30 см/с; масштаб r₁ = 1 см не влияет на ответ. По интегралу площадей r₁v₁ = r₂v₂: v₂ = 6 см/с.',
  },
  m2818: {
    title: 'Мещерский 28.18: сила, обратно пропорциональная кубу расстояния',
    problem: O({ unit: 'cm', force: 'formula', ar: '-1/r^3', r0: 2, v0: 0.5, th0: 45, ph0: 0, t1: 10, R: 0 }),
    book: { rEnd: Math.sqrt(4 + Math.SQRT2 * 10), phiEnd: deg(Math.log(Math.sqrt(4 + Math.SQRT2 * 10) / 2)) },
    relTol: 1e-6,
    note: 'm = 1 г, F = 1 дин при r = 1 см: a_r = −1/r³. r₀ = 2 см, v₀ = 0,5 см/с под 45° к радиусу (от центра). Книга: r = 2e^φ, r² = 4 + t√2; момент t = 10 с.',
  },
  m2819: {
    title: 'Мещерский 28.19: сила, обратно пропорциональная пятой степени расстояния',
    problem: O({ unit: 'cm', force: 'formula', ar: '-8/r^5', r0: 2, v0: 0.5, th0: 0, ph0: 0, t1: 3, R: 0 }),
    book: { rmax: 2, rEnd: 2 * Math.cos(phi19), phiEnd: deg(phi19) },
    relTol: 1e-6,
    note: 'm = 1 г, F = 8 дин при r = 1 см: a_r = −8/r⁵. r₀ = 2 см, v₀ = 0,5 см/с перпендикулярно радиусу. Книга: окружность радиуса 1 см (r = 2 cos φ, проходит через центр); при t = π с точка приходит в центр, здесь — положение при t = 3 с.',
  },
  m2820: {
    title: 'Мещерский 28.20: наибольшая и наименьшая сила притяжения на эллипсе',
    problem: O({ unit: 'cm', def: 'elements', shape: 'ab', e1: 10, e2: 8, scale: 'T', T: 50, m: 20, R: 0 }),
    book: { Fp: 19.7, Fa: 1.2 },
    relTol: 0.03,
    note: 'm = 20 г, полуоси 10 и 8 см, период 50 с: μ = 4π²a³/T². Книга: F_max = 19,7 дин, F_min = 1,2 дин (точнее 1,23).',
  },
  m5022: {
    title: 'Мещерский 50.22–50.23: орбита после отделения от последней ступени',
    problem: O({ muMode: 'mu', mu: 398000, R: 6370, r0: 6600, v0: 8, th0: 1.145916, ph0: 0 }),
    book: { c: 52790, p: 7002, h: -56.6, nu: deg(0.335), e: 0.0649, Hmax: 1120, Hmin: 210, T: 98.5 * MIN },
    relTol: 0.012,
    note: 'H = 230 км, v₀ = 8,0 км/с, θ₀ = 0,02 рад (1,1459°), μ = 3,98·10⁵ км³/с². Книга: c = 52 790 км²/с, p = 7002 км, h = −56,6 км²/с²; ε = φ₀ − 0,335 рад; e = 0,0649; H_max = 1120 км, H_min = 210 км; T = 98,5 мин. Расчёт по тем же данным: e = 0,0645, H_max = 1114 км, H_min = 208 км, T = 97,9 мин.',
  },
  m5035: {
    title: 'Мещерский 50.35: период после радиального импульса (пример)',
    problem: O({ def: 'elements', shape: 'apsides', e1: s35.r, e2: s35.r, scale: 'T', T: s35.T, man: 'impulse', dvr: s35.u, R: 0 }),
    book: { T1: s35.T / (1 - q35 ** 2) ** 1.5 },
    relTol: 1e-9,
    note: 'Круговая орбита r = 7000 км, T = 5830 с; радиальный импульс u = 0,5 км/с. Книга: T₁ = T/[1 − (uT/(2πr))²]^(3/2).',
  },
  m5036: {
    title: 'Мещерский 50.36: период после касательного импульса (пример)',
    problem: O({ def: 'elements', shape: 'apsides', e1: s35.r, e2: s35.r, scale: 'T', T: s35.T, man: 'impulse', dvt: s35.u, R: 0 }),
    book: { T1: s35.T / (1 - q35 ** 2 - 2 * q35) ** 1.5 },
    relTol: 1e-9,
    note: 'Круговая орбита r = 7000 км, T = 5830 с; касательный импульс u = 0,5 км/с. Книга: T₁ = T/[1 − (uT/(2πr))² − uT/(πr)]^(3/2).',
  },
  m5037: {
    title: 'Мещерский 50.37: радиальный импульс для заданного перигея (пример)',
    problem: O({ muMode: 'mu', mu: MU, def: 'elements', shape: 'apsides', e1: s37.r, e2: s37.r, man: 'target', tgtKind: 'rad', tgt: 'peri', tgtVal: s37.r1 }),
    book: { u: Math.sqrt(MU / s37.r1) * (Math.sqrt(s37.r / s37.r1) - Math.sqrt(s37.r1 / s37.r)), rp1: s37.r1 },
    relTol: 1e-8,
    note: 'Круговая орбита r = 7000 км, перигей новой орбиты r₁ = 6600 км, μ = 3,98·10⁵ км³/с². Книга: u = √(μ/r₁)·(√(r/r₁) − √(r₁/r)).',
  },
  m5038: {
    title: 'Мещерский 50.38: касательный импульс для перелёта к орбите Марса',
    problem: O({
      unit: 'km',
      muMode: 'mu',
      def: 'elements',
      shape: 'apsides',
      e1: 150e6,
      e2: 150e6,
      scale: 'vp',
      vp: 30,
      man: 'target',
      tgtKind: 'tang',
      tgt: 'apo',
      tgtVal: 228e6,
      R: 0,
    }),
    book: { u: 2.95, ra1: 228e6 },
    note: 'Орбита Земли r₁ = 150·10⁶ км, v = 30 км/с (μ = v²r₁); афелий новой орбиты r₂ = 228·10⁶ км. Книга: u = 2,95 км/с.',
  },
  m5038v: {
    title: 'Мещерский 50.38: касательный импульс для перелёта к орбите Венеры',
    problem: O({
      unit: 'km',
      muMode: 'mu',
      def: 'elements',
      shape: 'apsides',
      e1: 150e6,
      e2: 150e6,
      scale: 'vp',
      vp: 30,
      man: 'target',
      tgtKind: 'tang',
      tgt: 'peri',
      tgtVal: 108e6,
      R: 0,
    }),
    book: { u: 2.55, rp1: 108e6 },
    note: 'Орбита Земли r₁ = 150·10⁶ км, v = 30 км/с; перигелий новой орбиты r₃ = 108·10⁶ км — импульс тормозящий. Книга: u = 2,55 км/с.',
  },
  m5039: {
    title: 'Мещерский 50.39: прирост скорости в перигее для подъёма апогея (пример)',
    problem: O({
      muMode: 'mu',
      mu: MU,
      def: 'elements',
      shape: 'apsides',
      e1: s39.r1,
      e2: s39.r2,
      man: 'target',
      tgtKind: 'tang',
      tgt: 'apo',
      tgtVal: s39.r2 + s39.H,
    }),
    book: {
      u: Math.sqrt((2 * MU) / s39.r1) * (Math.sqrt((s39.r2 + s39.H) / (s39.r1 + s39.r2 + s39.H)) - Math.sqrt(s39.r2 / (s39.r1 + s39.r2))),
      ra1: s39.r2 + s39.H,
    },
    relTol: 1e-8,
    note: 'r₁ = 6800 км, r₂ = 8000 км, апогей поднимается на H = 1000 км; μ = 3,98·10⁵ км³/с². Книга: u = √(2μ/r₁)·(√((r₂ + H)/(r₁ + r₂ + H)) − √(r₂/(r₁ + r₂))).',
  },
  m5106: {
    title: 'Мещерский 51.6: центральная сила −m(μ/r² + ν/r³) (пример)',
    problem: O({ unit: 'm', force: 'formula', ar: '-(1/r^2 + 0,5/r^3)', r0: 1, v0: 1, th0: 0, ph0: 0, t1: 40, R: 0 }),
    book: { rmax: 1, rmin: 1 / 3 },
    relTol: 1e-6,
    note: 'μ = 1, ν = 0,5; r₀ = 1, v₀ = 1 перпендикулярно радиусу: c = 1, ν < c². Книга: r = p/(1 + e cos k(φ − ε)), p = (c² − ν)/μ = 0,5, k² = 1 − ν/c² = 0,5; здесь r = 0,5/(1 − 0,5 cos kφ), r от 1/3 до 1.',
  },
  m3024: {
    title: 'Мещерский 30.24: высота подъёма тела с учётом убывания тяжести',
    problem: X({ x0: 6370, v0: 1, ask: 'top' }),
    book: { H: 51 },
    relTol: 0.01,
    note: 'R = 6370 км, v₀ = 1 км/с вверх. Книга: H = Rv₀²/(2gR − v₀²) = 51 км (точнее 51,4).',
  },
  m3025: {
    title: 'Мещерский 30.25: наибольшая скорость частицы при отталкивании',
    problem: X({ unit: 'cm', muMode: 'mu', mu1: 1000, repel: true, R: 0, x0: 5, v0: 0, ask: 'top' }),
    book: { vinf: 20 },
    relTol: 1e-9,
    note: 'q₁ = 100 ед. CGS, q₂ = 10, m = 1 г: F = q₁q₂/r², «μ» = q₁q₂/m = 1000 см³/с²; r₀ = 5 см, v₀ = 0. Книга: 20 см/с.',
  },
  m3026: {
    title: 'Мещерский 30.26: скорость для подъёма на высоту земного радиуса',
    problem: X({ unit: 'cm', g: 9.8, R: 637e6, x0: 637e6, ask: 'v0', x1: 2 * 637e6 }),
    book: { v0: 7.9e5 },
    note: 'R = 637·10⁶ см, g = 980 см/с². Книга: v₀ = √(gR) = 7,9 км/с.',
  },
  m3027: {
    title: 'Мещерский 30.27: снаряд к точке равного притяжения Земли и Луны',
    problem: X({ g: 9.8, R: 6000, two: true, k2: 1 / 80, d: 360000, x0: 6000, ask: 'v0', x1: 0 }),
    book: { v0: 10.75 },
    note: 'g = 9,8 м/с², m : M = 1 : 80, d = 60R, R = 6000 км. Книга: v₀² = (59/30)·(1 − α)/(1 + α)·gR, α = 1/(59√80), v₀ = 10,75 км/с; по этой же формуле v₀ = 10,73 км/с.',
  },
  m509: {
    title: 'Мещерский 50.9: скорость метеорита у Земли',
    problem: X({ fromInf: true, vinf: 10, ask: 'at', x1: 6370 }),
    book: { v1: 15 },
    note: 'v∞ = 10 км/с; атмосферу считаем у поверхности (r = R = 6370 км). Книга: v ≈ 15 км/с.',
  },
  m5103: {
    title: 'Мещерский 51.3: относительная скорость соударения шаров (пример)',
    problem: X({ unit: 'm', muMode: 'mu', mu1: mu51, R: 0, x0: 10, v0: 0, ask: 'at', x1: 1 }),
    book: { v1: Math.sqrt(2 * mu51 * (1 / 1 - 1 / 10)) },
    relTol: 1e-7,
    note: 'm₁ = m₂ = 1000 кг, μ = f(m₁ + m₂) = 1,334·10⁻⁷ м³/с²; L = 10 м, R₁ + R₂ = 1 м. Книга: v_r = √(2μ(1/(R₁ + R₂) − 1/L)).',
  },
  m5104: {
    title: 'Мещерский 51.4: время до столкновения двух точек (пример)',
    problem: X({ unit: 'm', muMode: 'mu', mu1: mu51, R: 0, x0: 10, v0: 0, ask: 'at', x1: 0 }),
    book: { t1: (Math.PI / 2) * Math.sqrt(10 ** 3 / (2 * mu51)) },
    relTol: 1e-6,
    note: 'm₁ = m₂ = 1000 кг, μ = f(m₁ + m₂) = 1,334·10⁻⁷ м³/с², L = 10 м. Книга: T = (π/2)·√(L³/(2μ)).',
  },
  m5107: {
    title: 'Мещерский 51.7: высота включения тормозного двигателя для мягкой посадки (пример)',
    problem: X({ muMode: 'mu', mu1: s7.mu, R: s7.R, acc: s7.T, v0: -s7.v0, ask: 'x0', x1: s7.R }),
    book: { H0: (B7 + Math.sqrt(B7 ** 2 - 4 * s7.mu * s7.T)) / (2 * s7.T) - s7.R },
    relTol: 1e-7,
    note: 'Луна: μ = 4900 км³/с², R = 1738 км; v₀ = 1 км/с к центру, торможение T = 3 м/с² = 0,003 км/с² (T > μ/R²). Книга: H = (1/2T)·{μ/R + TR + v₀²/2 + √((μ/R + TR + v₀²/2)² − 4μT)} − R.',
  },
} satisfies Record<string, OrbPreset>;
export type OrbPresetKey = keyof typeof ORB_PRESETS;
