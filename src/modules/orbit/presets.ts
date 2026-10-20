/** Готовые задачи вкладки «Тяготение и орбиты»: Мещерский §28, 30, 50, 51. Ответы — по книге или по её формулам. */
import type { OrbitProblem, PlanetProblem, RadialProblem } from './model/orbit';
import type { TrajProblem } from './model/traj';

export type OrbMode = 'planet' | 'orbit' | 'radial' | 'traj';
export interface OrbState {
  mode: OrbMode;
  planet: PlanetProblem;
  orbit: OrbitProblem;
  radial: RadialProblem;
  traj: TrajProblem;
}
export interface OrbPreset {
  title: string;
  problem:
    | { mode: 'planet'; planet: PlanetProblem }
    | { mode: 'orbit'; orbit: OrbitProblem }
    | { mode: 'radial'; radial: RadialProblem }
    | { mode: 'traj'; traj: TrajProblem };
  /**
   * Ответ. Небесное тело: mu, g, R, v1, T1 (с), v2, vc, Tc, Hs, A1, A2. Орбита: c, p, h, e, nu (°), a, b, T (с), rp, ra,
   * Hmin, Hmax, vpe, va, Fp, Fa; после импульса — u (модуль импульса), T1, rp1, ra1; v1 — скорость на расстоянии r₁;
   * сила-формула — rEnd, phiEnd (°), rmin, rmax. Прямолинейное движение: xtop, H (= x_top − R), ttop, vinf, v1, t1, v0,
   * x0, H0 (= x₀ − R). Формулы Кеплера и Бине («traj»): ключи — в gotTraj (tests/orbit.test.ts): a, b, e, T, dt, nu, E, M, r, v, vx, vy,
   * gamma, vgeo, gammaMax, meanT, meanPhi, vcrit, thCone, aNeed, ratioInv, mu, beta, shift, n.
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
export const traj = (o: Partial<TrajProblem>): TrajProblem => ({
  kind: 'point',
  unit: 'km',
  muMode: 'mu',
  mu: 398000,
  g: 9.81,
  R: 6370,
  a: 10000,
  e: 0.3,
  anom: 'E',
  x1: 60,
  x2: 150,
  r0: 6670,
  th0: 0,
  v0: 0,
  inv: 'axes',
  p: 7002,
  c: 52790,
  T: 7122,
  Hd: 1600,
  gam: 0.1873,
  a1: 419400,
  T1: 152928,
  a2: 7.62e8,
  T2: 374360000,
  rphi: '7002/(1 + 0.0649 cos(t))',
  cb: 52790,
  phi1: 40,
  H: 500,
  alpha: 60,
  Trot: 86164,
  turns: 4,
  m1: 5.972e24,
  m2: 7.348e22,
  fG: 6.674e-11,
  fw: 'stop',
  Jf: 5,
  J0: 100,
  Om0: 0.1,
  M0: 8,
  kap: 2,
  Tc: 2,
  u0: 1,
  psi: 30,
  ...o,
});
const P = (o: Partial<PlanetProblem>) => ({ mode: 'planet' as const, planet: planet(o) });
const O = (o: Partial<OrbitProblem>) => ({ mode: 'orbit' as const, orbit: orbit(o) });
const X = (o: Partial<RadialProblem>) => ({ mode: 'radial' as const, radial: radial(o) });
const K = (o: Partial<TrajProblem>) => ({ mode: 'traj' as const, traj: traj(o) });
const MIN = 60;
const deg = (a: number) => (a * 180) / Math.PI;
const rad = (a: number) => (a * Math.PI) / 180;

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

// 50.28, 50.30–50.34: эллипс a = 10 000 км, e = 0,3, μ = 3,98·10⁵ км³/с².
const kp = { a: 10000, e: 0.3, n: Math.sqrt(MU / 1e12) };
const kpv = Math.sqrt(MU / kp.a);
const nuE = (Edeg: number) => deg(2 * Math.atan(Math.sqrt((1 + kp.e) / (1 - kp.e)) * Math.tan(rad(Edeg) / 2)));
const Ek = (nudeg: number) => 2 * Math.atan(Math.sqrt((1 - kp.e) / (1 + kp.e)) * Math.tan(rad(nudeg) / 2));
const cosE = (Edeg: number) => Math.cos(rad(Edeg));
const vOfE = (Edeg: number) => kpv * Math.sqrt((1 + kp.e * cosE(Edeg)) / (1 - kp.e * cosE(Edeg)));
// 50.24–50.25: Земля, H = 300 км.
const sf = { R: 6370, H: 300, th: -5 };
const sfr0 = sf.R + sf.H;
const sfv1 = Math.sqrt(MU / sfr0);
// 50.6: Земля, μ = gR², T_вращения = 86 164 с.
const st6 = { R: 6370, H: 500, T: 86164 };
const st6mu = (9.81 * st6.R ** 2) / 1000;
const st6k = ((2 * Math.PI) / st6.T) * Math.sqrt((st6.R + st6.H) ** 3 / st6mu);
const st6beta = (al: number) => deg(Math.atan2(Math.sin(rad(al)), Math.cos(rad(al)) - st6k));
// 50.27: Ио и Юпитер.
const io = { a1: 5.91 * 11.14 * 6370, T1: 1.77 * 86400, a2: 5.2 * 23000 * 6370, T2: (11 * 365.25 + 314.84) * 86400 };
// 51.1, 51.5: Земля — Луна. 51.9–51.12: J = 5, J₀ = 100 кг·м², Ω₀ = 0,1 рад/с; двигатель M₀ = 8 Н·м, κ = 2 Н·м·с; ψ = 30°, T = 2 с, u₀ = 1 рад/с².
const fw = { J: 5, J0: 100, Om0: 0.1, M0: 8, kap: 2, Tc: 2, u0: 1, psi: 30 };
const fwAl = (fw.kap * fw.J0) / (fw.J * (fw.J0 - fw.J));
const fwMin = fwAl * (fw.J0 - fw.J) * fw.Om0;
const fwLn = Math.log(fw.M0 / (fw.M0 - fwMin));
const fwTau = (rad(fw.psi) * fw.J0) / (fw.J * fw.Tc * fw.u0);
const fwW = Math.log(1 + Math.sqrt(1 - Math.exp(-fwTau / fw.Tc)));
// 50.18: R = 6370 км, e = 0,2, a = 9000 км.
const s18 = { R: 6370, e: 0.2, a: 9000 };
const s18gam = (s18.a * (1 - s18.e) - s18.R) / (s18.a * (1 + s18.e) - s18.R);

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
  m5013: {
    title: 'Мещерский 50.12–50.13: формула Бине — сила по траектории r = p/(1 + e cos φ)',
    problem: K({ kind: 'binet', rphi: '7002/(1 + 0.0649 cos(t))', cb: 52790, phi1: 40 }),
    book: { mu: 3.98e5, n: -2 },
    relTol: 0.01,
    note: 'Траектория из задачи 50.22: p = 7002 км, e = 0,0649, c = 52 790 км²/с. Книга: F_φ = 0, F_r = −mμ/r², μ = c²/p = 3,98·10⁵ км³/с².',
  },
  m5015: {
    title: 'Мещерский 50.15: полуоси и период по интегралу площадей (эллипс)',
    problem: K({ kind: 'inverse', inv: 'axes', p: 7002, e: 0.0649, c: 52790 }),
    book: { a: 7002 / (1 - 0.0649 ** 2), b: 7002 / Math.sqrt(1 - 0.0649 ** 2), mu: 3.98e5, T: 98.5 * MIN },
    relTol: 0.012,
    note: 'Те же p = 7002 км, e = 0,0649, c = 52 790 км²/с, что в 50.22–50.23. Книга: a = p/(1 − e²), b = p/√(1 − e²), T = 2πab/c; период 98,5 мин в ответе 50.23 — расчёт даёт 97,9 мин (см. 50.22).',
  },
  m5017: {
    title: 'Мещерский 50.17: эксцентриситет по периоду и разности апогея и перигея (пример)',
    problem: K({ kind: 'inverse', inv: 'ecc', T: 7122, Hd: 1600 }),
    book: { e: 0.1, aNeed: 8000 },
    relTol: 0.001,
    note: 'Спутник Земли: T = 7122 с, апогей выше перигея на H = 1600 км, μ = 3,98·10⁵ км³/с². Книга: e = (H/2)·∛(4π²/(μT²)) = 0,1 (a = 8000 км).',
  },
  m5018: {
    title: 'Мещерский 50.18: большая полуось по e и отношению высот перигея и апогея (пример)',
    problem: K({ kind: 'inverse', inv: 'sma', R: s18.R, e: s18.e, gam: +s18gam.toFixed(6) }),
    book: { aNeed: s18.a, rpNeed: s18.a * (1 - s18.e), raNeed: s18.a * (1 + s18.e) },
    relTol: 1e-4,
    note: 'R = 6370 км, e = 0,2, H_п : H_а = 0,18736 (исходные: a = 9000 км). Книга: a = R(1 − γ)/(1 − e − γ(1 + e)).',
  },
  m5024: {
    title: 'Мещерский 50.24: падение на планету при любой скорости — направление внутри конуса',
    problem: K({ kind: 'fall', R: sf.R, r0: sfr0, th0: -25, v0: 11 }),
    book: { thCone: deg(Math.acos(sf.R / sfr0)), hits: 1 },
    relTol: 1e-9,
    note: 'Земля, H = 300 км. Конус описан вокруг планеты из начальной точки: cos θ_к = R/r₀, θ_к = 17,5°. Направление под горизонтом круче θ_к — падение при любой v₀ (здесь θ₀ = −25°, v₀ = 11 км/с — выше второй космической).',
  },
  m5025: {
    title: 'Мещерский 50.25: граничная скорость, при которой траектория не пересечёт поверхность',
    problem: K({ kind: 'fall', R: sf.R, r0: sfr0, th0: sf.th, v0: 8.5 }),
    book: {
      vcrit: sfv1 * Math.sqrt((2 * sf.R * sf.H) / (sfr0 ** 2 * Math.cos(rad(sf.th)) ** 2 - sf.R ** 2)),
      thCone: deg(Math.acos(sf.R / sfr0)),
      hits: 0,
    },
    relTol: 1e-9,
    note: 'Земля, H = 300 км, θ₀ = −5° (вне конуса), v₀ = 8,5 км/с. Книга: v₀² > v₁²·2RH/((R + H)²cos²θ₀ − R²), v₁ = √(μ/(R + H)).',
  },
  m5027: {
    title: 'Мещерский 50.27: масса Юпитера по движению спутника Ио (третий закон Кеплера)',
    problem: K({ kind: 'inverse', inv: 'mass', a1: io.a1, T1: io.T1, a2: io.a2, T2: io.T2 }),
    book: { ratioInv: 1000 },
    relTol: 0.01,
    note: 'Ио: T = 1,77 сут, a = 5,91 R_Ю; Юпитер: T = 11 лет 314,84 сут, a = 5,20·23 000 R_З; R_Ю = 11,14 R_З. M_Ю : M_С = (a₁/a₂)³(T₂/T₁)² ≈ 1 : 1000 (год — 365,25 сут).',
  },
  m5028: {
    title: 'Мещерский 50.28: среднее значение радиус-вектора по времени (орбита Земли)',
    problem: K({ kind: 'mean', unit: 'km', mu: 1.327e11, a: 149.6e6, e: 0.0167, R: 0 }),
    book: { meanT: 149.6e6 * (1 + 0.0167 ** 2 / 2), meanPhi: 149.6e6 * Math.sqrt(1 - 0.0167 ** 2), meanE: 149.6e6 },
    relTol: 1e-9,
    note: 'Книга: [r] = a(1 + e²/2). Для сравнения — среднее по углу φ равно b = a√(1 − e²), по эксцентрической аномалии E — a. μ Солнца 1,327·10¹¹ км³/с² нужен только для периода.',
  },
  m5030: {
    title: 'Мещерский 50.30: связь истинной и эксцентрической аномалий (E = 60°)',
    problem: K({ kind: 'point', a: kp.a, e: kp.e, anom: 'E', x1: 60 }),
    book: { nu: nuE(60), E: 60 },
    relTol: 1e-9,
    note: 'Эллипс a = 10 000 км, e = 0,3, μ = 3,98·10⁵ км³/с². Книга: tg(φ/2) = √((1 + e)/(1 − e))·tg(E/2).',
  },
  m5030t: {
    title: 'Мещерский 50.30: время полёта от перицентра до точки с ν = 120° (уравнение Кеплера)',
    problem: K({ kind: 'time', a: kp.a, e: kp.e, anom: 'nu', x1: 0, x2: 120 }),
    book: { E: deg(Ek(120)), dt: (Ek(120) - kp.e * Math.sin(Ek(120))) / kp.n, T: (2 * Math.PI) / kp.n },
    relTol: 1e-9,
    note: 'Эллипс a = 10 000 км, e = 0,3. E = 2 arctg(√((1 − e)/(1 + e))·tg(ν/2)), M = E − e sin E = n·t, n = √(μ/a³).',
  },
  m5031: {
    title: 'Мещерский 50.31: скорость через эксцентрическую аномалию (E = 60°)',
    problem: K({ kind: 'point', a: kp.a, e: kp.e, anom: 'E', x1: 60 }),
    book: { v: vOfE(60), r: kp.a * (1 - kp.e * cosE(60)) },
    relTol: 1e-9,
    note: 'Эллипс a = 10 000 км, e = 0,3. Книга: v = √(μ/a)·√((1 + e cos E)/(1 − e cos E)).',
  },
  m5032: {
    title: 'Мещерский 50.32: точки, где скорость — среднее геометрическое скоростей в перигее и апогее',
    problem: K({ kind: 'point', a: kp.a, e: kp.e, anom: 'E', x1: 90 }),
    book: { v: kpv, vgeo: kpv, E: 90 },
    relTol: 1e-9,
    note: 'Эллипс a = 10 000 км, e = 0,3: E = ±90° — концы малой оси, v = √(μ/a) = √(v_п·v_а). Книга: E = ±π/2.',
  },
  m5033: {
    title: 'Мещерский 50.33: вектор скорости в орбитальной и инерциальной системах (E = 75°)',
    problem: K({ kind: 'point', a: kp.a, e: kp.e, anom: 'E', x1: 75 }),
    book: {
      vx: (-kpv * Math.sin(rad(75))) / (1 - kp.e * cosE(75)),
      vy: (kpv * Math.sqrt(1 - kp.e ** 2) * cosE(75)) / (1 - kp.e * cosE(75)),
      vr: Math.sqrt(MU / (kp.a * (1 - kp.e ** 2))) * kp.e * Math.sin(rad(nuE(75))),
    },
    relTol: 1e-9,
    note: 'Эллипс a = 10 000 км, e = 0,3. Книга: v = √(μ/p)·[e_r sin φ + e_φ(1 + e cos φ)] и v = √(μ/a)/(1 − e cos E)·[−e₁ sin E + e₂√(1 − e²) cos E].',
  },
  m5034: {
    title: 'Мещерский 50.34: наибольший угол наклона траектории к горизонту (E = 90°)',
    problem: K({ kind: 'point', a: kp.a, e: kp.e, anom: 'E', x1: 90 }),
    book: { gamma: deg(Math.asin(kp.e)), gammaMax: deg(Math.asin(kp.e)), E: 90 },
    relTol: 1e-9,
    note: 'Эллипс a = 10 000 км, e = 0,3. Книга: E = ±π/2; в этих точках cos φ = −e, sin γ = e.',
  },
  m506: {
    title: 'Мещерский 50.6: трасса спутника на вращающейся Земле (α = 60°)',
    problem: K({ kind: 'track', muMode: 'planet', R: st6.R, H: st6.H, alpha: 60, Trot: st6.T, turns: 4 }),
    book: { beta: st6beta(60), k: st6k },
    relTol: 1e-9,
    note: 'Земля (μ = gR²), H = 500 км, α = 60°. Угол с экватором tg β = sin α/(cos α − Ω√(r³/μ)) для движения в сторону вращения Земли; в книге перед вторым слагаемым «+» — это направление орбиты против вращения (α > 90°).',
  },
  m506r: {
    title: 'Мещерский 50.6: трасса спутника, движущегося против вращения Земли (α = 120°)',
    problem: K({ kind: 'track', muMode: 'planet', R: st6.R, H: st6.H, alpha: 120, Trot: st6.T, turns: 4 }),
    book: { beta: st6beta(120), k: st6k },
    relTol: 1e-9,
    note: 'Земля, H = 500 км, α = 120°: tg β = sin α/(cos α − Ω√(r³/μ)); по модулю совпадает с формулой книги tg β = sin α′/(cos α′ + Ω√(r³/μ)) для α′ = 180° − α.',
  },
  m5101: {
    title: 'Мещерский 51.1, 51.5: Земля и Луна — относительное движение и движение около центра масс',
    problem: K({ kind: 'two', unit: 'm', m1: 5.972e24, m2: 7.348e22, a: 3.844e8, e: 0.0549 }),
    book: {
      mu: 6.674e-11 * (5.972e24 + 7.348e22),
      mu1: (6.674e-11 * 7.348e22 ** 3) / (5.972e24 + 7.348e22) ** 2,
      a1: (3.844e8 * 7.348e22) / (5.972e24 + 7.348e22),
    },
    relTol: 1e-9,
    note: 'Книга: относительное движение — как абсолютное при μ = f(m₁ + m₂) (51.1); движение около центра масс — при μ₁ = f·m₂³/(m₁ + m₂)², μ₂ = f·m₁³/(m₁ + m₂)² (51.5). Центр масс системы Земля — Луна лежит внутри Земли (a₁ = 4,67·10⁶ м).',
  },
  m5102: {
    title: 'Мещерский 51.2: третий закон Кеплера с учётом движения Солнца (Юпитер)',
    problem: K({ kind: 'two', unit: 'm', m1: 1.989e30, m2: 1.898e27, a: 7.785e11, e: 0.0489 }),
    book: { ratio: Math.sqrt(1.989e30 / (1.989e30 + 1.898e27)), mu: 6.674e-11 * (1.989e30 + 1.898e27) },
    relTol: 1e-9,
    note: 'Книга: T₁²/T₂² = (a₁³/a₂³)·(M + m₂)/(M + m₁). Период по μ = f(M + m) короче, чем по μ = fM, в √(M/(M + m)) раз: для Юпитера — на 0,05 %.',
  },
  m5109: {
    title: 'Мещерский 51.9: работа двигателя маховика при остановке вращения аппарата',
    problem: K({ kind: 'flywheel', fw: 'stop', Jf: fw.J, J0: fw.J0, Om0: fw.Om0 }),
    book: { A: (fw.J0 * (fw.J0 - fw.J) * fw.Om0 ** 2) / (2 * fw.J), omF: (fw.J0 * fw.Om0) / fw.J },
    relTol: 1e-9,
    note: 'J = 5 кг·м² (маховик), J₀ = 100 кг·м² (аппарат с маховиком), Ω₀ = 0,1 рад/с. Книга: A = J₀(J₀ − J)Ω₀²/(2J).',
  },
  m5110: {
    title: 'Мещерский 51.10–51.11: торможение вращения мотором с моментом M₀ − κω, время и угол поворота',
    problem: K({ kind: 'flywheel', fw: 'motor', Jf: fw.J, J0: fw.J0, Om0: fw.Om0, M0: fw.M0, kap: fw.kap }),
    book: {
      Mmin: fwMin,
      T: fwLn / fwAl,
      psi: fw.Om0 / fwAl - ((fw.M0 - fwMin) / (fwAl ** 2 * (fw.J0 - fw.J))) * fwLn,
    },
    relTol: 1e-9,
    note: 'J = 5, J₀ = 100 кг·м², Ω₀ = 0,1 рад/с, M₀ = 8 Н·м, κ = 2 Н·м·с. Книга: условие M₀ > α(J₀ − J)Ω₀, T = (1/α) ln(M₀/(M₀ − α(J₀ − J)Ω₀)), α = κJ₀/(J(J₀ − J)); ψ = Ω₀/α − [M₀ − α(J₀ − J)Ω₀]/[α²(J₀ − J)]·ln(M₀/(M₀ − α(J₀ − J)Ω₀)).',
  },
  m5112: {
    title: 'Мещерский 51.12: поворот аппарата электродвигателем-маховиком — разгон и торможение',
    problem: K({ kind: 'flywheel', fw: 'turn', Jf: fw.J, J0: fw.J0, Tc: fw.Tc, u0: fw.u0, psi: fw.psi }),
    book: { tau: fwTau, t1: fwTau + fw.Tc * fwW, t2: fw.Tc * fwW },
    relTol: 1e-9,
    note: 'J = 5, J₀ = 100 кг·м², T = 2 с, u₀ = 1 рад/с², поворот ψ = 30°. Книга: t₁ = τ + T ln(1 + √(1 − e^(−τ/T))), τ = ψJ₀/(JTu₀); торможение — t₂ = T ln(1 + √(1 − e^(−τ/T))) (в книге ответ обрывается на странице).',
  },
} satisfies Record<string, OrbPreset>;
export type OrbPresetKey = keyof typeof ORB_PRESETS;
