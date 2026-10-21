/** Готовые задачи: Мещерский §37. Ответы — по формулам книги при выбранных числах. */
import { G, type KItem, type RotEq, type RotProblem } from './model/rotation';

export interface RotPreset {
  title: string;
  problem: RotProblem;
  /** Ответ книги: w (ω), phi, t, period, w2. */
  book?: Record<string, number>;
  note?: string;
}

const eq = (o: Partial<RotEq>): RotEq => ({
  body: { kind: 'J', m: 0, R: 0, J: 1 },
  loads: [],
  M0: 0,
  at: 0,
  m0: 0,
  p: 0,
  c: 0,
  Pa: 0,
  kv: 0,
  kq: 0,
  Mf: 0,
  phi0: 0,
  omega0: 0,
  ask: 't',
  t: 1,
  omega1: 0,
  ...o,
});
const E = (e: Partial<RotEq>, byWeight = false): RotProblem => ({ mode: 'eq', byWeight, eq: eq(e), K: [] });
const item = (o: Partial<KItem> & Pick<KItem, 'name' | 'kind'>): KItem => ({ J1: 0, J2: 0, m: 0, r1: 0, r2: 0, w1: 0, u1: 0, u2: 0, ...o });
const Kp = (items: KItem[], byWeight = false): RotProblem => ({ mode: 'K', byWeight, eq: eq({}), K: items });

// 37.7: J = 50, D = 1, k = 4, M₂ = 3, ω₀ = 20.
const d7 = { J: 50, D: 1, k: 4, M2: 3, w0: 20 };
// 37.8 и 37.9: J = 2, M = 10, α = 0,5; t = 3.
const d8 = { J: 2, M: 10, a: 0.5, t: 3 };
// 37.10: α = 0,2, ω₀ = 6.
const d10 = { a: 0.2, w0: 6 };
// 37.12–37.14: m = 5 кг, r = 0,1, n = 4, k = 0,02, R = 0,3, J = 0,4; t = 2.
const d12 = { m: 5, r: 0.1, nkR: 4 * 0.02 * 0.3, J: 0.4, t: 2, w0: 30 };
// 37.42: P₁ = 20, P₂ = 10 кГ, r = 0,2, a = 30; t = 2.
const d42 = { P1: 20, P2: 10, r: 0.2, a: 30, t: 2 };
// 37.45: P₁ = 10, P₂ = 5 кГ, r = 0,2, α = 0,5; t = 1,5.
const d45 = { P1: 10, P2: 5, r: 0.2, a: 0.5, t: 1.5 };
// 37.53: масса платформы 4m, R = 2, ω₀ = 1, u = 0,5 (по краю u, на R/2 — 2u).
const d53 = { m: 60, R: 2, w0: 1, u: 0.5 };

export const ROT_PRESETS = {
  m378: {
    title: 'Мещерский 37.8: разгон моментом M при сопротивлении αω²',
    problem: E({ body: { kind: 'J', m: 0, R: 0, J: d8.J }, M0: d8.M, kq: d8.a, t: d8.t }),
    book: { w: Math.sqrt(d8.M / d8.a) * Math.tanh(Math.sqrt(d8.a * d8.M) * d8.t / d8.J) },
    note: 'J = 2 кг·м², M = 10 Н·м, α = 0,5; ω = √(M/α)·(e^{βt} − 1)/(e^{βt} + 1), β = 2√(αM)/J; t = 3 с.',
  },
  m379: {
    title: 'Мещерский 37.9: разгон при сопротивлении αω',
    problem: E({ body: { kind: 'J', m: 0, R: 0, J: d8.J }, M0: d8.M, kv: d8.a, t: d8.t }),
    book: { w: (d8.M / d8.a) * (1 - Math.exp((-d8.a * d8.t) / d8.J)) },
    note: 'ω = (M/α)(1 − e^{−αt/J}).',
  },
  m377: {
    title: 'Мещерский 37.7: электрический тормоз маховика — время остановки',
    problem: E({ body: { kind: 'J', m: 0, R: 0, J: d7.J }, kv: (d7.k * d7.D) / 2, Mf: d7.M2, omega0: d7.w0, ask: 'omega', omega1: 0 }),
    book: { t: ((2 * d7.J) / (d7.k * d7.D)) * Math.log(1 + (d7.k * d7.D * d7.w0) / (2 * d7.M2)) },
    note: 'M₁ = kv = kωD/2 — вязкий момент с коэффициентом kD/2; M₂ — постоянное трение. J = 50, D = 1 м, k = 4, M₂ = 3 Н·м, ω₀ = 20 рад/с.',
  },
  m375: {
    title: 'Мещерский 37.5: маховик останавливается за 10 мин — момент трения 4,8 кГ·м',
    problem: E({ body: { kind: 'rho', m: 500, R: 1.5, J: 0 }, Mf: 4.8, omega0: (240 * Math.PI) / 30, ask: 'omega', omega1: 0 }, true),
    book: { t: 600 },
    note: 'Вес 0,5 т, радиус инерции 1,5 м, n = 240 об/мин. В книге ищется момент трения (4,8 кГ·м) по времени 10 мин; здесь обратная проверка — время остановки при M_тр = 4,8.',
  },
  m3710: {
    title: 'Мещерский 37.10: шарик в жидкости — угловая скорость уменьшилась вдвое',
    problem: E({ body: { kind: 'J', m: 0, R: 0, J: 1 }, kv: d10.a, omega0: d10.w0, ask: 'omega', omega1: d10.w0 / 2 }),
    book: { t: Math.log(2) / d10.a, phi: d10.w0 / (2 * d10.a) },
    note: 'J = ml², момент сопротивления αml²ω: ε = −αω (J = 1, k = α). α = 0,2 1/с, ω₀ = 6 рад/с. Книга: T = ln2/α, n = ω₀/(4πα) оборотов, т. е. φ = ω₀/(2α).',
  },
  m3712: {
    title: 'Мещерский 37.12: вал с гирей и лопастями — квадратичное сопротивление',
    problem: E({ body: { kind: 'J', m: 0, R: 0, J: d12.J }, loads: [{ m: d12.m, r: d12.r, down: true }], kq: d12.nkR, t: d12.t }),
    book: {
      w: (() => {
        const s = Math.sqrt((d12.m * G * d12.r) / d12.nkR),
          a = (2 / (d12.J + d12.m * d12.r ** 2)) * Math.sqrt(d12.m * G * d12.nkR * d12.r);
        return (s * (Math.exp(a * d12.t) - 1)) / (Math.exp(a * d12.t) + 1);
      })(),
    },
    note: 'Гиря m = 5 кг на радиусе r = 0,1 м; n = 4 пластины, k = 0,02, R = 0,3 м — момент сопротивления nkRω²; J = 0,4 кг·м²; t = 2 с.',
  },
  m3713: {
    title: 'Мещерский 37.13: тот же вал без гири с начальной скоростью ω₀',
    problem: E({ body: { kind: 'J', m: 0, R: 0, J: d12.J }, kq: d12.nkR, omega0: d12.w0, t: d12.t }),
    book: { phi: (d12.J / d12.nkR) * Math.log(1 + (d12.nkR * d12.w0 * d12.t) / d12.J) },
    note: 'φ = J/(nkR)·ln(1 + nkRω₀t/J); ω₀ = 30 рад/с.',
  },
  m3714: {
    title: 'Мещерский 37.14: вал с гирей, сопротивление пропорционально ω',
    problem: E({ body: { kind: 'J', m: 0, R: 0, J: d12.J }, loads: [{ m: d12.m, r: d12.r, down: true }], kv: d12.nkR, t: d12.t }),
    book: {
      phi: (() => {
        const sg = (d12.m * G * d12.r) / d12.nkR,
          g = d12.nkR / (d12.J + d12.m * d12.r ** 2);
        return sg * (d12.t + (Math.exp(-g * d12.t) - 1) / g);
      })(),
    },
    note: 'φ = σ[t + (e^{−γt} − 1)/γ], σ = mgr/(nkR), γ = nkR/(J + mr²).',
  },
  m3715: {
    title: 'Мещерский 37.15: крутильные колебания шара на проволоке',
    problem: E({ body: { kind: 'J', m: 0, R: 0, J: (2 / 5) * 2 * 0.1 ** 2 }, c: 0.5, phi0: 0.3, t: 0.7 }),
    book: { phi: 0.3 * Math.cos(Math.sqrt((5 * 0.5) / (2 * 2 * 0.1 ** 2)) * 0.7), period: 2 * Math.PI * Math.sqrt((2 * 2 * 0.1 ** 2) / (5 * 0.5)) },
    note: 'Шар m = 2 кг, r = 0,1 м (J = 2mr²/5); c = 0,5 Н·м/рад; φ₀ = 0,3 рад; φ = φ₀ cos(√(5c/(2mr²))·t).',
  },
  m3716: {
    title: 'Мещерский 37.16: балансир часов',
    problem: E({ body: { kind: 'J', m: 0, R: 0, J: 2e-6 }, c: 5e-4, omega0: 3, t: 0.05 }),
    book: { phi: 3 * Math.sqrt(2e-6 / 5e-4) * Math.sin(Math.sqrt(5e-4 / 2e-6) * 0.05) },
    note: 'J = 2·10⁻⁶ кг·м², c = 5·10⁻⁴ Н·м/рад, ω₀ = 3 рад/с; φ = ω₀√(J/c)·sin(√(c/J)·t).',
  },
  m3740: {
    title: 'Мещерский 37.40: маятник вибрографа — период собственных колебаний',
    problem: E({ body: { kind: 'J', m: 0, R: 0, J: 0.03 }, Pa: 4.5, c: 0.1, phi0: 0.01, t: 0.25 }),
    book: { period: 0.5 },
    note: 'Qh = 4,5 кГ·см, J = 0,03 кГ·см·с², c = 0,1 кГ·см/рад: T = 2π√(J/(Qh + c)) ≈ 0,507 с; в книге 0,5 с.',
  },
  m3742: {
    title: 'Мещерский 37.42: лебёдка, момент пропорционален времени',
    problem: E({ body: { kind: 'disk', m: d42.P2, R: d42.r, J: 0 }, loads: [{ m: d42.P1, r: d42.r, down: false }], at: d42.a, t: d42.t }, true),
    book: { w: ((d42.a * d42.t - 2 * d42.P1 * d42.r) * G * d42.t) / (d42.r ** 2 * (2 * d42.P1 + d42.P2)) },
    note: 'm_вр = at, a = 30 кГ·м/с; груз P₁ = 20 кГ поднимается; барабан — сплошной цилиндр P₂ = 10 кГ, r = 0,2 м; t = 2 с.',
  },
  m3745: {
    title: 'Мещерский 37.45: барабан, груз и сопротивление αω',
    problem: E({ body: { kind: 'disk', m: d45.P1, R: d45.r, J: 0 }, loads: [{ m: d45.P2, r: d45.r, down: true }], kv: d45.a, t: d45.t }, true),
    book: { w: ((d45.P2 * d45.r) / d45.a) * (1 - Math.exp(((-2 * G * d45.a) / (d45.r ** 2 * (d45.P1 + 2 * d45.P2))) * d45.t)) },
    note: 'P₁ = 10, P₂ = 5 кГ, r = 0,2 м, α = 0,5 кГ·м·с; ω = (P₂r/α)(1 − e^{−βt}), β = 2gα/(r²(P₁ + 2P₂)).',
  },
  m3754: {
    title: 'Мещерский 37.54: скамейка Жуковского',
    problem: Kp([item({ name: 'человек и скамейка', kind: 'body', J1: 0.8, J2: 0.12, w1: (15 * Math.PI) / 30 })]),
    book: { n2: 100 },
    note: 'J₁ = 0,8, J₂ = 0,12 кГ·м·с², n₁ = 15 об/мин → n₂ = 100 об/мин.',
  },
  m3755: {
    title: 'Мещерский 37.55: соединение двух вращающихся тел',
    problem: Kp([item({ name: 'тело 1', kind: 'body', J1: 3, J2: 3, w1: 10 }), item({ name: 'тело 2', kind: 'body', J1: 2, J2: 2, w1: -5 })]),
    book: { w2: (3 * 10 + 2 * -5) / 5 },
    note: 'ω = (J₁ω₁ + J₂ω₂)/(J₁ + J₂); J₁ = 3, J₂ = 2, ω₁ = 10, ω₂ = −5 рад/с.',
  },
  m3756: {
    title: 'Мещерский 37.56: шарик вылетает из вращающейся трубки',
    problem: Kp([item({ name: 'трубка', kind: 'body', J1: 0.5, J2: 0.5, w1: 4 }), item({ name: 'шарик', kind: 'point', m: 0.2, r1: 0.3, r2: 1, w1: 4 })]),
    book: { w2: ((0.5 + 0.2 * 0.3 ** 2) / (0.5 + 0.2 * 1)) * 4 },
    note: 'J = 0,5 кг·м², m = 0,2 кг, a = 0,3 м, L = 1 м, ω₀ = 4 рад/с: ω = (J + ma²)/(J + mL²)·ω₀.',
  },
  m3757: {
    title: 'Мещерский 37.57: стержень с шарами на пружинах',
    problem: Kp(
      [item({ name: 'стержень', kind: 'body', J1: ((2 / G) * 0.9 ** 2) / 3, J2: ((2 / G) * 0.9 ** 2) / 3, w1: (64 * Math.PI) / 30 }), ...['M₁', 'M₂'].map((name) => item({ name, kind: 'point', m: 5, r1: 0.36, r2: 0.54, w1: (64 * Math.PI) / 30 }))],
      true,
    ),
    book: { n2: 34 },
    note: 'Стержень 2L = 180 см, Q = 2 н (J = QL²/(3g)); шары P = 5 н на 2l₁ = 72 см → 2l₂ = 108 см; n₁ = 64 об/мин. Ответ книги — 34 об/мин.',
  },
  m3753: {
    title: 'Мещерский 37.53: люди идут по платформе в сторону вращения',
    problem: Kp(
      [
        item({ name: 'платформа', kind: 'body', J1: (4 * d53.m * d53.R ** 2) / 2, J2: (4 * d53.m * d53.R ** 2) / 2, w1: d53.w0 }),
        ...[1, 2].map((k) => item({ name: `на краю ${k}`, kind: 'point', m: d53.m, r1: d53.R, r2: d53.R, w1: d53.w0, u2: d53.u })),
        ...[1, 2].map((k) => item({ name: `на R/2 ${k}`, kind: 'point', m: d53.m, r1: d53.R / 2, r2: d53.R / 2, w1: d53.w0, u2: 2 * d53.u })),
      ],
    ),
    book: { w2: d53.w0 - (8 * d53.u) / (9 * d53.R) },
    note: 'Платформа массой 4m (однородный диск), m = 60 кг, R = 2 м, ω₀ = 1 рад/с; на краю идут со скоростью u = 0,5 м/с, на расстоянии R/2 — 2u (как в 37.52), все в сторону вращения: ω₁ = ω₀ − 8u/(9R).',
  },
  m3751: {
    title: 'Мещерский 37.51: человек идёт по неподвижной платформе',
    problem: Kp([item({ name: 'платформа', kind: 'body', J1: (100 / G) * 2 ** 2 / 2, J2: (100 / G) * 2 ** 2 / 2 }), item({ name: 'человек', kind: 'point', m: 70, r1: 1.5, r2: 1.5, u2: 1 })], true),
    book: { w2: -(2 * 70 * 1.5 * 1) / (100 * 2 ** 2 + 2 * 70 * 1.5 ** 2) },
    note: 'P = 100 кГ, R = 2 м; человек p = 70 кГ на r = 1,5 м идёт со скоростью u = 1 м/с. Книга: ω = 2pru/(PR² + 2pr²) — платформа вращается в сторону, противоположную движению человека (у нас знак «−»).',
  },
} satisfies Record<string, RotPreset>;

export type RotPresetKey = keyof typeof ROT_PRESETS;
