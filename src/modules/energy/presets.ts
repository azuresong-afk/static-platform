/** Готовые задачи: Мещерский §38. Веса — в кГ (m = P/g), длины — в метрах; ответы — по формулам книги. */
import { G, type Body, type EnergyProblem } from './model/energy';

export interface EnergyPreset {
  title: string;
  problem: EnergyProblem;
  /** Ответ книги: v (или ω), v0, s. */
  book?: Record<string, number>;
  note?: string;
}

const rad = (a: number) => (a * Math.PI) / 180;
const sin = (a: number) => Math.sin(rad(a)),
  cos = (a: number) => Math.cos(rad(a));
const body = (o: Partial<Body> & Pick<Body, 'name' | 'kind' | 'm'>): Body => ({
  R: 0,
  r: 0,
  inertia: 'disk',
  I: 0,
  alpha: 90,
  up: false,
  f: 0,
  fk: 0,
  M: [0, 0, 0],
  F: 0,
  c: 0,
  lambda0: 0,
  link: null,
  ...o,
});
const prob = (bodies: Body[], o: Partial<EnergyProblem>): EnergyProblem => ({ bodies, byWeight: true, mode: 'v', v0: 0, s: 1, v1: 0, ...o });

// 38.41–38.42: барабан r₁ = 0,5, P₁ = 200, M = 200; колесо P₂ = 300, r₂ = 0,3 вверх по наклону α = 30°; n = 2 оборота.
const d41 = { r1: 0.5, P1: 200, P2: 300, r2: 0.3, M: 200, al: 30, n: 2, fk: 0.005 };
const drum41 = (fk: number) =>
  prob(
    [
      body({ name: 'барабан', kind: 'rotate', m: d41.P1, R: d41.r1, M: [d41.M, 0, 0] }),
      body({ name: 'колесо', kind: 'roll', m: d41.P2, r: d41.r2, R: d41.r2, alpha: d41.al, up: true, fk, link: { from: 0, at: 'R', to: 'c' } }),
    ],
    { s: 2 * Math.PI * d41.n },
  );
// 38.43–38.44: колёса A и B и блок C — одинаковые диски P = 10, r = 0,2; α = 45°, β = 30°, s = 2.
const d43 = { P: 10, r: 0.2, al: 45, be: 30, s: 2, fk: 0.002 };
const wheels43 = (fk: number) =>
  prob(
    [
      body({ name: 'колесо A', kind: 'roll', m: d43.P, r: d43.r, R: d43.r, alpha: d43.al, fk }),
      body({ name: 'блок C', kind: 'rotate', m: d43.P, R: d43.r, link: { from: 0, at: 'c', to: 'R' } }),
      body({ name: 'колесо B', kind: 'roll', m: d43.P, r: d43.r, R: d43.r, alpha: d43.be, up: true, fk, link: { from: 1, at: 'R', to: 'c' } }),
    ],
    { s: d43.s },
  );
// 38.45–38.46: груз A P₁ = 20 вниз по наклону α = 60°, блок D P₂ = 10, каток B P₃ = 30 (r = 0,3) вверх по β = 30°, нить на ободе катка.
const d45 = { P1: 20, P2: 10, P3: 30, r: 0.3, al: 60, be: 30, f: 0.1, fk: 0.003, s: 1 };
const load45 = (f: number, fk: number) =>
  prob(
    [
      body({ name: 'груз A', kind: 'translate', m: d45.P1, alpha: d45.al, f }),
      body({ name: 'блок D', kind: 'rotate', m: d45.P2, R: 0.15, link: { from: 0, at: 'c', to: 'R' } }),
      body({ name: 'каток B', kind: 'roll', m: d45.P3, r: d45.r, R: d45.r, alpha: d45.be, up: true, fk, link: { from: 1, at: 'R', to: 'top' } }),
    ],
    { s: d45.s },
  );
// 38.37: P₁ = 10, P₂ = 30, P₃ = 20, P₄ = 100, R = 0,4, r = 0,1, M = 5, h = 1.
const d37 = { P1: 10, P2: 30, P3: 20, P4: 100, R: 0.4, r: 0.1, M: 5, h: 1 };
// 38.13: вал d = 10 см, 0,5 т; маховик D = 2 м, 3 т (масса на ободе); 60 об/мин; f = 0,05 в подшипниках.
const d13 = { Ps: 500, rs: 0.05, Pw: 3000, Rw: 1, f: 0.05 };

export const ENERGY_PRESETS = {
  m3845: {
    title: 'Мещерский 38.45: груз на наклонной плоскости, блок и каток',
    problem: load45(0, 0),
    book: { v: 2 * Math.sqrt((2 * G * d45.s * (2 * d45.P1 * sin(d45.al) - d45.P3 * sin(d45.be))) / (8 * d45.P1 + 4 * d45.P2 + 3 * d45.P3)) },
    note: 'P₁ = 20, P₂ = 10, P₃ = 30 кГ, α = 60°, β = 30°, s = 1 м. Нить намотана на боковую поверхность катка — сходит с его верхней точки.',
  },
  m3846: {
    title: 'Мещерский 38.46: то же с трением скольжения и качения',
    problem: load45(d45.f, d45.fk),
    book: { v: 2 * Math.sqrt((2 * G * d45.s * (2 * d45.P1 * (sin(d45.al) - d45.f * cos(d45.al)) - d45.P3 * (sin(d45.be) + (d45.fk / d45.r) * cos(d45.be)))) / (8 * d45.P1 + 4 * d45.P2 + 3 * d45.P3)) },
    note: 'f = 0,1, δ = 0,003 м, r = 0,3 м.',
  },
  m3843: {
    title: 'Мещерский 38.43: два колеса на наклонных плоскостях и блок',
    problem: wheels43(0),
    book: { v: 2 * Math.sqrt((G * d43.s * (sin(d43.al) - sin(d43.be))) / 7) },
    note: 'Колёса и блок — одинаковые сплошные диски (P = 10 кГ, r = 0,2 м); α = 45°, β = 30°, s = 2 м.',
  },
  m3844: {
    title: 'Мещерский 38.44: то же с трением качения',
    problem: wheels43(d43.fk),
    book: { v: 2 * Math.sqrt((G * d43.s * (sin(d43.al) - sin(d43.be) - (d43.fk / d43.r) * (cos(d43.al) + cos(d43.be)))) / 7) },
    note: 'δ = 0,002 м.',
  },
  m3841: {
    title: 'Мещерский 38.41: ворот поднимает колесо по наклонной плоскости',
    problem: drum41(0),
    book: { v: (2 / d41.r1) * Math.sqrt((2 * Math.PI * d41.n * G * (d41.M - d41.P2 * d41.r1 * sin(d41.al))) / (d41.P1 + 3 * d41.P2)) },
    note: 'Ведущее тело — барабан: ищем угловую скорость после n = 2 оборотов (φ = 4π). r₁ = 0,5 м, P₁ = 200, P₂ = 300 кГ, M = 200 кГ·м, α = 30°.',
  },
  m3842: {
    title: 'Мещерский 38.42: то же с трением качения колеса',
    problem: drum41(d41.fk),
    book: { v: (2 / d41.r1) * Math.sqrt((2 * Math.PI * d41.n * G * (d41.M - d41.r1 * d41.P2 * (sin(d41.al) + (d41.fk / d41.r2) * cos(d41.al)))) / (d41.P1 + 3 * d41.P2)) },
    note: 'δ = 0,005 м, r₂ = 0,3 м; массу троса (есть в книге) не учитываем — p = 0.',
  },
  m3839: {
    title: 'Мещерский 38.39: ворот тянет груз вверх по шероховатой плоскости',
    problem: prob(
      [
        body({ name: 'барабан', kind: 'rotate', m: 40, R: 0.25, M: [60, 0, 0] }),
        body({ name: 'груз', kind: 'translate', m: 50, alpha: 30, up: true, f: 0.2, link: { from: 0, at: 'R', to: 'c' } }),
      ],
      { s: 3 },
    ),
    book: { v: (2 / 0.25) * Math.sqrt((G * (60 - 50 * 0.25 * (sin(30) + 0.2 * cos(30))) * 3) / (40 + 2 * 50)) },
    note: 'r = 0,25 м, P₁ = 40, P₂ = 50 кГ, M = 60 кГ·м, α = 30°, f = 0,2, φ = 3 рад.',
  },
  m3823: {
    title: 'Мещерский 38.23: лебёдка с моментом, пропорциональным углу поворота',
    problem: prob(
      [
        body({ name: 'груз B', kind: 'translate', m: 100, up: true }),
        body({ name: 'барабан A', kind: 'rotate', m: 50, R: 0.2, M: [0, 20, 0], link: { from: 0, at: 'c', to: 'R' } }),
      ],
      { s: 2 },
    ),
    book: { v: (1 / 0.2) * Math.sqrt((2 * G * 2 * (20 * 2 - 2 * 100 * 0.2 ** 2)) / (50 + 2 * 100)) },
    note: 'M = aφ, a = 20 кГ·м/рад; r = 0,2 м, P₁ = 50, P₂ = 100 кГ, h = 2 м.',
  },
  m3824: {
    title: 'Мещерский 38.24: лебёдка, момент M = aφ², барабан-обод и блок',
    problem: prob(
      [
        body({ name: 'груз A', kind: 'translate', m: 10, up: true }),
        body({ name: 'блок C', kind: 'rotate', m: 4, R: 0.1, link: { from: 0, at: 'c', to: 'R' } }),
        body({ name: 'барабан B', kind: 'rotate', m: 20, R: 0.3, inertia: 'ring', M: [0, 0, 5], link: { from: 1, at: 'R', to: 'R' } }),
      ],
      { s: 1 },
    ),
    book: { v: (2 / 0.3) * Math.sqrt((G * 1 * (5 * 1 - 3 * 10 * 0.3 ** 3)) / (3 * 0.3 * (2 * 10 + 2 * 20 + 4))) },
    note: 'a = 5 кГ·м/рад², r = 0,3 м, P₁ = 10, P₂ = 20, P₃ = 4 кГ, h = 1 м. Масса барабана — на ободе, блок — сплошной диск.',
  },
  m3837: {
    title: 'Мещерский 38.37: ворот с ременной передачей',
    problem: prob(
      [
        body({ name: 'груз', kind: 'translate', m: d37.P4, up: true }),
        body({ name: 'вал ворота', kind: 'rotate', m: 0, R: d37.R, r: d37.r, inertia: 'J', I: (d37.P2 * d37.R ** 2 + d37.P3 * d37.r ** 2) / (2 * G), link: { from: 0, at: 'c', to: 'r' } }),
        body({ name: 'шкив I', kind: 'rotate', m: d37.P1, R: d37.r, M: [d37.M, 0, 0], link: { from: 1, at: 'R', to: 'R' } }),
      ],
      { s: d37.h },
    ),
    book: { v: 2 * Math.sqrt((G * d37.h * ((d37.M * d37.R) / d37.r ** 2 - d37.P4)) / (d37.P1 * (d37.R / d37.r) ** 2 + d37.P2 * (d37.R / d37.r) ** 2 + d37.P3 + 2 * d37.P4)) },
    note: 'Шкив II (P₂ = 30, R = 0,4) и барабан (P₃ = 20, r = 0,1) на одном валу: J = (P₂R² + P₃r²)/(2g). Шкив I: P₁ = 10, r = 0,1, M = 5 кГ·м; P₄ = 100 кГ, h = 1 м.',
  },
  m3825: {
    title: 'Мещерский 38.25: начальная скорость колеса, чтобы подняться на высоту h',
    problem: prob([body({ name: 'колесо', kind: 'roll', m: 10, r: 0.4, R: 0.4, alpha: 30, up: true, fk: 0.005 })], { mode: 'v0', s: 1 / sin(30), v1: 0 }),
    book: { v0: (2 / 3) * Math.sqrt(3 * G * 1 * (1 + (0.005 / 0.4) / Math.tan(rad(30)))) },
    note: 'Однородный диск r = 0,4 м, α = 30°, δ = 0,005 м, h = 1 м — путь s = h/sin α = 2 м.',
  },
  m3813: {
    title: 'Мещерский 38.13: маховик останавливается трением в подшипниках',
    problem: prob(
      [body({ name: 'вал с маховиком', kind: 'rotate', m: 0, R: d13.Rw, inertia: 'J', I: (d13.Ps * d13.rs ** 2) / 2 / G + (d13.Pw * d13.Rw ** 2) / G, M: [-d13.f * (d13.Ps + d13.Pw) * d13.rs, 0, 0] })],
      { mode: 's', v0: 2 * Math.PI, v1: 0 },
    ),
    book: { revs: 109.8 },
    note: 'J = P_в r²/(2g) + P_м R²/g; момент трения в подшипниках M = −f(P_в + P_м)r = −8,75 кГ·м; ω₀ = 60 об/мин = 2π рад/с. Ответ книги — 109,8 оборота.',
  },
  spring: {
    title: 'Груз на пружине по наклонной плоскости (проверка численным интегрированием)',
    problem: { ...prob([body({ name: 'груз', kind: 'translate', m: 2, alpha: 30, f: 0.1, c: 200, lambda0: 0 })], { s: 0.05 }), byWeight: false },
    note: 'Масса 2 кг, α = 30°, f = 0,1, c = 200 Н/м, пружина в начале не деформирована. Ускорение переменно.',
  },
} satisfies Record<string, EnergyPreset>;

export type EnergyPresetKey = keyof typeof ENERGY_PRESETS;
