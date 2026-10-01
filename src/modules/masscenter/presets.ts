/** Готовые задачи: Мещерский §35–36 (центр масс, количество движения) и §39 (плоское движение колеса). */
import { G, type PointsProblem, type ShiftProblem } from './model/system';
import type { WheelProblem } from './model/wheel';

export type McTask = { mode: 'points'; points: PointsProblem } | { mode: 'shift'; shift: ShiftProblem } | { mode: 'wheel'; wheel: WheelProblem };

export interface McPreset {
  title: string;
  problem: McTask;
  /** Ответ книги (ключи — по режиму, см. тесты). */
  book?: Record<string, number>;
  note?: string;
}

const pts = (o: Partial<PointsProblem> & Pick<PointsProblem, 'pts'>): McTask => ({ mode: 'points', points: { byWeight: true, g: G, gravity: true, t: 0, t1: 0, t2: 0, ...o } });
const shift = (o: ShiftProblem): McTask => ({ mode: 'shift', shift: o });
const wheel = (o: Partial<WheelProblem>): McTask => ({ mode: 'wheel', wheel: { byWeight: true, m: 500, g: G, r: 0.4, inertia: 'rho', rho: 0.3, alpha: 0, M: 0, F: 0, T: 0, beta: 0, e: 0, f: 0.3, fk: 0, t: 1, ...o } });
const rad = (a: number) => (a * Math.PI) / 180;

const w394 = { P: 500, r: 0.4, rho: 0.3, f: 0.3, fk: 0.01 };
const d357 = { P1: 100, P2: 10, P3: 20, a: 0.2, w: 10 };
const d363 = { P1: 10, P2: 20, r: 0.1, w: 3 };
const d399 = { P: 100, r: 0.5, f: 0.2, t: 2 };
const d3916 = { P: 200, r: 0.5, rho: 0.35, a: 0.2, b: 30, T: 40, t: 2 };

export const MC_PRESETS = {
  m3511: {
    title: 'Мещерский 39.11: цилиндр скатывается по наклонной плоскости без скольжения',
    problem: wheel({ m: 100, inertia: 'disk', alpha: 30, f: 0.3 }),
    book: { a: (2 / 3) * G * Math.sin(rad(30)), tgLimit: 3 * 0.3 },
    note: 'Однородный цилиндр, α = 30°, f = 0,3: скольжения нет при tg α ≤ 3f; a = (2/3)g sin α.',
  },
  m3914: {
    title: 'Мещерский 39.14: цилиндр скатывается со скольжением',
    problem: wheel({ m: 100, inertia: 'disk', alpha: 50, f: 0.3 }),
    book: { a: G * (Math.sin(rad(50)) - 0.3 * Math.cos(rad(50))) },
    note: 'α = 50° > arctg 3f: a = g(sin α − f cos α).',
  },
  m394: {
    title: 'Мещерский 39.4–39.5: ведущее колесо — наибольший момент без скольжения',
    problem: wheel({ M: 50 }),
    book: { limit: (w394.f * w394.P * (w394.r ** 2 + w394.rho ** 2)) / w394.r },
    note: 'P = 500 кГ, r = 0,4 м, ρ = 0,3 м, f = 0,3: M ≤ fP(r² + ρ²)/r. С трением качения δ (39.5) предел больше на Pδ.',
  },
  m396: {
    title: 'Мещерский 39.6–39.7: ведомое колесо — наибольшая сила без скольжения',
    problem: wheel({ F: 100, fk: w394.fk }),
    book: { limit: (w394.f * w394.P * (w394.r ** 2 + w394.rho ** 2) - w394.P * w394.fk * w394.r) / w394.rho ** 2 },
    note: 'Сила F в центре, δ = 0,01 м: F ≤ [fP(r² + ρ²) − Pδr]/ρ².',
  },
  m399: {
    title: 'Мещерский 39.9: колесо проскальзывает под большим моментом',
    problem: wheel({ m: d399.P, r: d399.r, inertia: 'ring', M: 2.5 * d399.f * d399.P * d399.r, f: d399.f, t: d399.t }),
    book: { slip: (d399.f * G * d399.t) / 2 },
    note: 'Масса на ободе, m_вр = (5/2)fPr, f = 0,2: скорость проскальзывания fgt/2.',
  },
  m3910: {
    title: 'Мещерский 39.10: то же с трением качения δ = fr/4',
    problem: wheel({ m: d399.P, r: d399.r, inertia: 'ring', M: 2.5 * d399.f * d399.P * d399.r, f: d399.f, fk: (d399.f * d399.r) / 4, t: d399.t }),
    book: { slip: (d399.f * G * d399.t) / 4 },
  },
  m3916: {
    title: 'Мещерский 39.16: каток тянут за нить, намотанную на барабан',
    problem: wheel({ m: d3916.P, r: d3916.r, rho: d3916.rho, T: d3916.T, beta: d3916.b, e: -d3916.a, f: 0.8, t: d3916.t }),
    book: { x: ((d3916.T * G * d3916.r * (d3916.r * Math.cos(rad(d3916.b)) - d3916.a)) / (2 * d3916.P * (d3916.rho ** 2 + d3916.r ** 2))) * d3916.t ** 2 },
    note: 'P = 200 кГ, r = 0,5 м, ρ = 0,35 м, барабан a = 0,2 м, T = 40 кГ под углом 30°: нить сходит снизу барабана — плечо e = −a. x = Tgr(r cos α − a)t²/(2P(ρ² + r²)).',
  },
  m356: {
    title: 'Мещерский 35.6: вагон трамвая на рессорах — давление на рельсы',
    problem: pts({ pts: [{ name: 'кузов', m: 10, x: '', y: '0,025 sin(4πt)' }, { name: 'тележка', m: 1, x: '', y: '' }], t: 0, t1: 0, t2: 0.5 }),
    book: { NyMin: 7, NyMax: 15 },
    note: 'Кузов 10 т колеблется с амплитудой 2,5 см и периодом 0,5 с, тележка 1 т: давление от 7 до 15 т.',
  },
  m357: {
    title: 'Мещерский 35.7: насос — давление на грунт',
    problem: pts({
      pts: [
        { name: 'корпус и фундамент', m: d357.P1, x: '', y: '' },
        { name: 'кривошип', m: d357.P2, x: '0,1sin(10t)', y: '−0,1cos(10t)' },
        { name: 'кулиса и поршень', m: d357.P3, x: '', y: '−0,2cos(10t)' },
      ],
    }),
    book: { Ny: d357.P1 + d357.P2 + d357.P3 + ((d357.a * d357.w ** 2) / (2 * G)) * (d357.P2 + 2 * d357.P3) },
    note: 'P₁ = 100, P₂ = 10, P₃ = 20 кГ, OA = a = 0,2 м, ω = 10 рад/с, t = 0: N = P₁ + P₂ + P₃ + (aω²/2g)(P₂ + 2P₃)cos ωt.',
  },
  m363: {
    title: 'Мещерский 36.3: количество движения маятника',
    problem: pts({
      gravity: false,
      pts: [
        { name: 'стержень', m: d363.P1, x: '0,2 sin(3t)', y: '−0,2 cos(3t)' },
        { name: 'диск', m: d363.P2, x: '0,5 sin(3t)', y: '−0,5 cos(3t)' },
      ],
    }),
    book: { Q: ((2 * d363.P1 + 5 * d363.P2) / G) * d363.r * d363.w },
    note: 'Стержень OA = 4r (центр на 2r), диск радиуса r (центр на 5r), r = 0,1 м, ω = 3 рад/с, P₁ = 10, P₂ = 20 кГ: Q = (2P₁ + 5P₂)rω/g.',
  },
  m3517: {
    title: 'Мещерский 35.17: два человека в лодке — лодка остаётся на месте',
    problem: shift({ M0: 200, parts: [{ name: 'первый', m: 50, s: 2, theta: 0 }, { name: 'второй', m: 70, s: 0, theta: 0 }], unknown: 1 }),
    book: { answer: (-50 * 2) / 70 },
    note: 'Первый (50 кГ) переходит со средней скамейки на нос, на 2 м. Второй (70 кГ) должен сместиться на 1,43 м к корме.',
  },
  m3519: {
    title: 'Мещерский 35.19: отливку перекатывают по платформе',
    problem: shift({ M0: 2700, parts: [{ name: 'отливка и рабочие', m: 1800, s: 6, theta: 0 }], unknown: -1 }),
    book: { answer: -2.4 },
    note: 'Платформа 6 м, 2700 кГ; груз с рабочими 1800 кГ переходят с левого конца на правый: платформа сместится влево на 2,4 м.',
  },
  m3520: {
    title: 'Мещерский 35.20: грузы на гранях клина',
    problem: shift({
      M0: 16,
      parts: [
        { name: 'P₁ вниз по грани 30°', m: 4, s: 0.2, theta: 210 },
        { name: 'P₂ вверх по грани 60°', m: 1, s: 0.2, theta: 120 },
      ],
      unknown: -1,
    }),
    book: { answer: 0.0377 },
    note: 'P = 4P₁ = 16P₂; P₁ опускается на h = 10 см (по грани — 20 см), нить тянет P₂ вверх на 20 см: клин сместится вправо на 3,77 см.',
  },
  m3521: {
    title: 'Мещерский 35.21: усечённая пирамида и три груза',
    problem: shift({
      M0: 100,
      parts: [
        { name: 'P₁ вниз', m: 20, s: 1, theta: -90 },
        { name: 'P₂ вправо', m: 15, s: 1, theta: 0 },
        { name: 'P₃ вверх по грани 60°', m: 10, s: 1, theta: 60 },
      ],
      unknown: -1,
    }),
    book: { answer: -0.14 },
    note: 'P = 100 Н, P₁ = 20, P₂ = 15, P₃ = 10 Н; P₁ опускается на 1 м: пирамида сместится влево на 14 см.',
  },
} satisfies Record<string, McPreset>;

export type McPresetKey = keyof typeof MC_PRESETS;
