/** Готовые задачи: Мещерский §34. Длины — в метрах, массы — в кг (или веса в кГ, тогда m = P/g). */
import type { IPart, IProblem, V3 } from './model/inertia';

export interface InertiaPreset {
  title: string;
  problem: IProblem;
  /** Ответ книги: J (относительно оси), rho, или компоненты Jx, Jy, Jz, Jxy, Jyz, Jzx. */
  book?: Record<string, number>;
  note?: string;
}

const part = (kind: IPart['kind'], m: number, c: V3, u: V3, p: Record<string, number> = {}, s: 1 | -1 = 1): IPart => ({ kind, m, c, u, p, s });
const Z: V3 = [0, 0, 1];
const O: V3 = [0, 0, 0];
const rad = (a: number) => (a * Math.PI) / 180;

// 34.21–34.22: стержень AB = 4r вдоль y вниз от A, диск радиуса r под концом B; ось O — на r ниже A.
const r21 = 0.1,
  m1 = 2,
  m2 = 3;
const pendulum = (A: V3): IProblem => ({
  parts: [part('rod', m1, [0, -2 * r21, 0], [0, 1, 0], { l: 4 * r21 }), part('disk', m2, [0, -5 * r21, 0], Z, { R: r21, h: 0 })],
  A,
  axis: Z,
  byWeight: false,
});
const al = 30,
  phi = 30,
  a25 = 0.15,
  r25 = 0.2;

export const INERTIA_PRESETS = {
  m3420: {
    title: 'Мещерский 34.20: вал, маховик и шестерня (веса в кГ)',
    problem: {
      parts: [part('disk', 60, O, Z, { R: 0.05, h: 1 }), part('ring', 1000, [0, 0, 0.5], Z, { R: 1 }), part('disk', 10, [0, 0, -0.3], Z, { R: 0.1, h: 0 })],
      A: O,
      axis: Z,
      byWeight: true,
    },
    book: { J: 102 },
    note: 'Вал — сплошной цилиндр, шестерня — диск, масса маховика сосредоточена на ободе. Длина вала и положение колёс на ответ не влияют.',
  },
  m348: {
    title: 'Мещерский 34.8: сплошной вал относительно образующей',
    problem: { parts: [part('disk', 100, O, Z, { R: 0.05, h: 0.5 })], A: [0.05, 0, 0], axis: Z, byWeight: false },
    book: { J: 0.375 },
    note: 'В книге — 3750 кг·см² = 0,375 кг·м².',
  },
  m3410: {
    title: 'Мещерский 34.10: прямоугольная пластина 2a × 2b, оси по сторонам',
    problem: { parts: [part('box', 1, [0.3, 0.2, 0], Z, { a: 0.6, b: 0.4, c: 0 })], A: O, axis: [1, 0, 0], byWeight: false },
    book: { Jx: (4 / 3) * 0.2 ** 2, Jy: (4 / 3) * 0.3 ** 2 },
    note: 'a = 0,3 м, b = 0,2 м, m = 1 кг: J_x = 4mb²/3, J_y = 4ma²/3.',
  },
  m3411: {
    title: 'Мещерский 34.11: прямоугольный параллелепипед',
    problem: { parts: [part('box', 1, [0.15, 0, 0.5], Z, { a: 0.3, b: 0.4, c: 1 })], A: O, axis: Z, byWeight: false },
    book: { Jx: (0.2 ** 2 + 4 * 0.5 ** 2) / 3, Jy: (0.3 ** 2 + 4 * 0.5 ** 2) / 3, Jz: (0.2 ** 2 + 0.3 ** 2) / 3 },
    note: 'По чертежу книги ребро 2a идёт вдоль y, b — вдоль x, 2c — вдоль z; a = 0,2, b = 0,3, c = 0,5 м, m = 1 кг.',
  },
  m3412: {
    title: 'Мещерский 34.12: диск с концентрическим отверстием',
    problem: { parts: [part('tube', 100, O, Z, { R: 0.2, r: 0.1, h: 0 })], A: O, axis: Z, byWeight: true },
    book: { J: (100 / 9.81 / 2) * (0.2 ** 2 + 0.1 ** 2) },
    note: 'P = 100 кГ, R = 0,2 м, r = 0,1 м: J = P(R² + r²)/(2g).',
  },
  m3412cut: {
    title: 'Тот же диск как круг минус вырез',
    problem: {
      parts: [part('disk', 100 * (4 / 3), O, Z, { R: 0.2, h: 0 }), part('disk', 100 / 3, O, Z, { R: 0.1, h: 0 }, -1)],
      A: O,
      axis: Z,
      byWeight: true,
    },
    book: { J: (100 / 9.81 / 2) * (0.2 ** 2 + 0.1 ** 2) },
    note: 'Вес сплошного круга 4P/3, вырезанного — P/3 (пропорционально площадям); ответ тот же, что в 34.12.',
  },
  m3417: {
    title: 'Мещерский 34.17: полый толстостенный шар',
    problem: { parts: [part('hball', 10, O, Z, { R: 0.5, r: 0.4 })], A: O, axis: Z, byWeight: false },
    book: { J: ((2 / 5) * 10 * (0.5 ** 5 - 0.4 ** 5)) / (0.5 ** 3 - 0.4 ** 3) },
  },
  m3419: {
    title: 'Мещерский 34.19: радиус инерции цилиндра относительно поперечной оси',
    problem: { parts: [part('disk', 1, O, [0, 1, 0], { R: 0.04, h: 0.4 })], A: [0, 0.1, 0], axis: Z, byWeight: false },
    book: { rho: 0.154 },
    note: 'R = 4 см, h = 40 см, ось z перпендикулярна оси цилиндра и отстоит от C на 10 см; ρ = 15,4 см.',
  },
  m3421: {
    title: 'Мещерский 34.21: маятник — стержень и диск, ось O',
    problem: pendulum([0, -r21, 0]),
    book: { J: ((14 * m1 + 99 * m2) / 6) * r21 ** 2 },
    note: 'r = 0,1 м, стержень m₁ = 2 кг, диск m₂ = 3 кг: J = (14m₁ + 99m₂) r²/6.',
  },
  m3422: {
    title: 'Мещерский 34.22: тот же маятник, ось через конец A',
    problem: pendulum(O),
    book: { rho: r21 * Math.sqrt((32 * m1 + 153 * m2) / (6 * (m1 + m2))) },
  },
  m3423: {
    title: 'Мещерский 34.23: наклонный стержень, центробежный момент',
    problem: { parts: [part('rod', 1, O, [Math.sin(rad(al)), Math.cos(rad(al)), 0], { l: 1 })], A: O, axis: [0, 1, 0], byWeight: false },
    book: { Jx: (0.25 / 3) * Math.cos(rad(al)) ** 2, Jy: (0.25 / 3) * Math.sin(rad(al)) ** 2, Jxy: (0.25 / 6) * Math.sin(rad(2 * al)) },
    note: 'Стержень длиной 2l = 1 м, m = 1 кг, угол с вертикальной осью y α = 30°.',
  },
  m3427: {
    title: 'Мещерский 34.25, 34.27: эксцентричный диск, наклонная ось',
    problem: {
      parts: [part('disk', 1, [a25, 0, 0], Z, { R: r25, h: 0 })],
      A: O,
      axis: [Math.sin(rad(phi)), 0, Math.cos(rad(phi))],
      byWeight: false,
    },
    book: {
      Jx: r25 ** 2 / 4,
      Jy: r25 ** 2 / 4 + a25 ** 2,
      Jz: r25 ** 2 / 2 + a25 ** 2,
      Jxy: 0,
      Jyz: 0,
      Jzx: 0,
      J: (r25 ** 2 / 4) * Math.sin(rad(phi)) ** 2 + (r25 ** 2 / 2 + a25 ** 2) * Math.cos(rad(phi)) ** 2,
    },
    note: 'Диск в плоскости, перпендикулярной z; OC = a = 0,15 м вдоль x, r = 0,2 м, m = 1 кг; ось z₁ в плоскости xz под углом φ = 30° к z.',
  },
  m3428: {
    title: 'Мещерский 34.28: перекошенный диск на оси',
    problem: { parts: [part('disk', 1, O, [-Math.sin(rad(al)), 0, Math.cos(rad(al))], { R: 0.2, h: 0 })], A: O, axis: Z, byWeight: false },
    book: { Jxy: 0, Jyz: 0, Jzx: (0.2 ** 2 / 8) * Math.sin(rad(2 * al)) },
    note: 'Ось симметрии диска z₁ лежит в плоскости xz под углом α = 30° к оси z; r = 0,2 м, m = 1 кг.',
  },
} satisfies Record<string, InertiaPreset>;

export type InertiaPresetKey = keyof typeof INERTIA_PRESETS;
