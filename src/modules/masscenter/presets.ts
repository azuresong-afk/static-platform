/** Готовые задачи: Мещерский §29 (работа и мощность), §35–36 (центр масс, количество движения, давление струи) и §39 (плоское движение колеса). */
import type { JetProblem, MomentumProblem, PowerProblem, WorkLoad } from './model/dynamics';
import { G, type PointsProblem, type ShiftProblem } from './model/system';
import type { WheelProblem } from './model/wheel';

export type McTask =
  | { mode: 'points'; points: PointsProblem }
  | { mode: 'shift'; shift: ShiftProblem }
  | { mode: 'wheel'; wheel: WheelProblem }
  | { mode: 'momentum'; momentum: MomentumProblem }
  | { mode: 'jet'; jet: JetProblem }
  | { mode: 'power'; power: PowerProblem };

export interface McPreset {
  title: string;
  problem: McTask;
  /** Ответ книги (ключи — по режиму, см. тесты). */
  book?: Record<string, number>;
  /** Относительный допуск сверки с книгой (по умолчанию — по числу знаков ответа). */
  relTol?: number;
  note?: string;
}

const pts = (o: Partial<PointsProblem> & Pick<PointsProblem, 'pts'>): McTask => ({ mode: 'points', points: { byWeight: true, g: G, gravity: true, t: 0, t1: 0, t2: 0, ...o } });
const shift = (o: ShiftProblem): McTask => ({ mode: 'shift', shift: o });
const wheel = (o: Partial<WheelProblem>): McTask => ({ mode: 'wheel', wheel: { byWeight: true, m: 500, g: G, r: 0.4, inertia: 'rho', rho: 0.3, alpha: 0, M: 0, F: 0, T: 0, beta: 0, e: 0, f: 0.3, fk: 0, t: 1, ...o } });
const rad = (a: number) => (a * Math.PI) / 180;
const mom = (o: Partial<MomentumProblem> & Pick<MomentumProblem, 'bodies' | 'unknown'>): McTask => ({ mode: 'momentum', momentum: { byWeight: true, g: G, F: 0, ...o } });
const mb = (name: string, m: number, v0: number, v1: number, ref0 = -1, ref1 = -1) => ({ name, m, v0, ref0, v1, ref1 });
const jet = (o: Partial<JetProblem> & Pick<JetProblem, 'streams'>): McTask => ({ mode: 'jet', jet: { byWeight: true, g: G, rho: 1000, W: 0, ...o } });
const js = (name: string, out: boolean, A: number, v: number, ang: number) => ({ name, out, A, v, ang });
const pow = (o: Partial<PowerProblem> & Pick<PowerProblem, 'loads' | 'unknown'>): McTask => ({ mode: 'power', power: { units: 'tech', g: G, eta: 1, driving: false, t: 0, N: 0, Nunit: 'hp', ...o } });
const ld = (o: Partial<WorkLoad>): WorkLoad => ({ name: '', kind: 'force', F: 0, alpha: 0, f: 0, speed: 'v', v: 0, s: 0, k: 1, d: 0, n: 0, ...o });
const area = (d: number) => (Math.PI * d * d) / 4;

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
  m292: {
    title: 'Мещерский 29.2: наименьшая работа подъёма груза по наклонной плоскости',
    problem: pow({ unknown: 'N', loads: [ld({ name: 'груз 2 т', kind: 'weight', F: 2000, alpha: 30, f: 0.5, speed: 'path', s: 10 })] }),
    book: { Al: 18660 },
    note: 'Груз 2 т поднимают на 5 м по плоскости 30° (путь 5/sin 30° = 10 м), f = 0,5; равномерно: A = Ph(1 + f ctg α) = 18 660 кГм.',
  },
  m293: {
    title: 'Мещерский 29.3: время подъёма воды насосом',
    problem: pow({ unknown: 't', N: 2, eta: 0.8, loads: [ld({ name: 'вода 5000 м³', kind: 'weight', F: 5000 * 1000, alpha: 90, speed: 'path', s: 3 })] }),
    book: { t: 34 * 3600 + 43 * 60 + 20 },
    note: '5000 м³ воды на 3 м, двигатель 2 л. с., КПД 0,8: t = 125 000 с = 34 ч 43 мин 20 с.',
  },
  m294: {
    title: 'Мещерский 29.4: мощность машины, поднимающей молот',
    problem: pow({ unknown: 'N', eta: 0.7, t: 60, loads: [ld({ name: 'молот', kind: 'weight', F: 200, alpha: 90, speed: 'path', s: 0.75, k: 84 })] }),
    book: { hp: 4, kW: 2.94 },
    note: '84 подъёма в минуту молота 200 кГ на 0,75 м, КПД 0,7: 4 л. с. = 2,94 кВт.',
  },
  m295: {
    title: 'Мещерский 29.5: мощность трёх водопадов',
    problem: pow({
      unknown: 'N',
      t: 1,
      loads: [12, 12.8, 15].map((h, i) => ld({ name: `водопад ${i + 1}`, kind: 'weight', F: 75.4 * 1000, alpha: 90, speed: 'path', s: h })),
    }),
    book: { hp: 40000, kW: 29400 },
    relTol: 0.002,
    note: 'Расход 75,4 м³/с — вес воды за 1 с 75 400 кГ; высоты 12; 12,8 и 15 м: 40 000 л. с. = 29,4 МВт.',
  },
  m296: {
    title: 'Мещерский 29.6: мощность турбогенераторов трамвайной сети',
    problem: pow({ unknown: 'N', eta: 0.95, loads: [ld({ name: '45 вагонов по 10 т', kind: 'weight', F: 45 * 10000, alpha: 0, f: 0.02, speed: 'v', v: 12 / 3.6 })] }),
    book: { hp: 421, kW: 309 },
    relTol: 0.005,
    note: 'Сопротивление 0,02 веса, скорость 12 км/ч, потери в сети 5 % (КПД 0,95): 421 л. с. = 309 кВт (по расчёту 309,8 кВт).',
  },
  m297: {
    title: 'Мещерский 29.7: мощность мотора, разгружающего баржу',
    problem: pow({ unknown: 'N', t: 12 * 3600, loads: [ld({ name: 'бадья с углём', kind: 'weight', F: 1200, alpha: 90, speed: 'path', s: 10, k: 600 })] }),
    book: { hp: 2.22, kW: 1.63 },
    note: '600 подъёмов бадьи (1 т угля + 200 кГ) на 10 м за 12 ч: 2,22 л. с. = 1,63 кВт.',
  },
  m298: {
    title: 'Мещерский 29.8: работа подъёма груза по наклонной плоскости',
    problem: pow({ unknown: 'N', loads: [ld({ name: 'груз', kind: 'weight', F: 20, alpha: 30, f: 0.01, speed: 'path', s: 6 })] }),
    book: { Al: 61.04 },
    note: 'Груз 20 кГ на 6 м по плоскости 30°, f = 0,01: A = Ps(sin α + f cos α) = 61,04 кГм.',
  },
  m299: {
    title: 'Мещерский 29.9: сила сопротивления воды движению турбохода',
    problem: pow({ unknown: 0, N: 5144, eta: 0.4, loads: [ld({ name: 'сопротивление воды', speed: 'v', v: 15 * 0.5144 })] }),
    book: { answer: 20000 },
    relTol: 0.001,
    note: '15 узлов (1 узел = 0,5144 м/с), 5144 л. с., КПД турбины и винта 0,4: F = 20 т.',
  },
  m2910: {
    title: 'Мещерский 29.10: мощность двигателя внутреннего сгорания',
    problem: pow({ unknown: 'N', eta: 0.9, driving: true, t: 60, loads: [ld({ name: 'давление газов', F: 5 * 300, speed: 'path', s: 0.4, k: 120 })] }),
    book: { hp: 14.4, kW: 10.6 },
    note: 'Давление 5 кГ/см² на поршень 300 см² — сила 1500 кГ, ход 0,4 м, 120 рабочих ходов в минуту, КПД 0,9: 14,4 л. с. = 10,6 кВт.',
  },
  m2911: {
    title: 'Мещерский 29.11: сила прижатия шлифовального камня',
    problem: pow({ units: 'si', unknown: 0, N: 1.6, loads: [ld({ name: 'прижатие детали', kind: 'weight', alpha: 0, f: 0.2, speed: 'rot', d: 0.6, n: 120 })] }),
    book: { answer: 1570 },
    relTol: 0.006,
    note: 'Камень ∅60 см, 120 об/мин, 1,6 л. с., f = 0,2: сила трения fP на ободе, P = N/(f·v). Книга: 1570 Н; по расчёту 1561 Н (1 л. с. = 75g Вт).',
  },
  m2912: {
    title: 'Мещерский 29.12: мощность мотора продольно-строгального станка',
    problem: pow({ unknown: 'N', eta: 0.8, t: 10, loads: [ld({ name: 'сила резания', F: 1200, speed: 'path', s: 2 })] }),
    book: { kW: 2.96 },
    relTol: 0.006,
    note: 'Ход 2 м за 10 с, сила резания 1200 кГ, КПД 0,8: книга — 2,96 кВт; по расчёту 300 кГм/с = 2,94 кВт.',
  },
  m2913: {
    title: 'Мещерский 29.13: сила тяги лошади в топчаке',
    problem: pow({ unknown: 0, N: 1, loads: [ld({ name: 'тяга лошади', speed: 'rot', d: 8, n: 6 })] }),
    book: { answer: 29.9 },
    note: 'Топчак d = 8 м, 6 об/мин, мощность лошади 1 л. с.: F = 29,9 кГ.',
  },
  m2915: {
    title: 'Мещерский 29.15: работа и мощность лыжника',
    problem: pow({
      unknown: 'N',
      t: 5400,
      loads: [
        ld({ name: 'трение лыж', kind: 'weight', F: 80, alpha: 0, f: 0.05, speed: 'path', s: 20000 }),
        ld({ name: 'подъём центра тяжести ×1,4', kind: 'weight', F: 80 * 1.4, alpha: 90, speed: 'path', s: 0.16, k: 5400 / 4 }),
      ],
    }),
    book: { Al: 1.05e5, hp: 0.26 },
    relTol: 0.015,
    note: '20 км за 1 ч 30 мин, вес 80 кГ, f = 0,05; центр тяжести поднимается на 2·8 см за период 4 с (1350 раз), торможение при опускании — 0,4 работы подъёма (вес ×1,4): A = 1,05·10⁵ кГм, N = 0,26 л. с.',
  },
  m2917: {
    title: 'Мещерский 29.17: мощность двигателя по ленточному тормозу',
    problem: pow({ unknown: 'N', loads: [ld({ name: 'разность натяжений 4 − 1', F: 3, speed: 'rot', d: 0.636, n: 120 })] }),
    book: { hp: 0.16 },
    note: 'Шкив ∅63,6 см, 120 об/мин, натяжения ветвей 4 и 1 кГ: 0,16 л. с. = 117,8 Вт.',
  },
  m2918: {
    title: 'Мещерский 29.18: натяжения ветвей ремня',
    problem: pow({ unknown: 0, N: 20, loads: [ld({ name: 'T − t', speed: 'rot', d: 1, n: 150 })] }),
    book: { answer: 191 },
    note: 'Мощность 20 л. с., шкив r = 50 см, 150 об/мин: T − t = 191 кГ; при T = 2t: t = 191 кГ, T = 382 кГ.',
  },
  m368: {
    title: 'Мещерский 36.8: скорость отката ствола орудия',
    problem: mom({ bodies: [mb('ствол', 11000, 0, 0), mb('снаряд', 54, 0, 900)], unknown: { i: 0, when: 1 } }),
    book: { answer: -4.42 },
    note: 'Ствол 11 000 кГ, снаряд 54 кГ, v₀ = 900 м/с: откат 4,42 м/с против движения снаряда.',
  },
  m369: {
    title: 'Мещерский 36.9: разрыв гранаты',
    problem: mom({ bodies: [mb('осколок 8 кГ', 8, 15, 25), mb('осколок 4 кГ', 4, 15, 0)], unknown: { i: 1, when: 1 } }),
    book: { answer: -5 },
    note: 'Граната 12 кГ летела со скоростью 15 м/с; осколок 8 кГ — 25 м/с вперёд. Второй — 5 м/с назад.',
  },
  m3610: {
    title: 'Мещерский 36.10: буксир трогает баржу',
    problem: mom({ bodies: [mb('пароход', 600, 1.5, 0), mb('баржа', 400, 0, 0, -1, 0)], unknown: { i: 0, when: 1 } }),
    book: { answer: 0.9 },
    note: 'Пароход 600 т со скоростью 1,5 м/с, баржа 400 т стоит; после рывка — общая скорость (относительная скорость баржи 0): 0,9 м/с.',
  },
  m3611: {
    title: 'Мещерский 36.11–36.12: тележку на платформе тормозят (пример)',
    problem: mom({ byWeight: false, F: 50, bodies: [mb('платформа M', 900, 2, 0), mb('тележка m', 100, 1, 0, 0, 0)], unknown: { i: 0, when: 1 } }),
    book: { answer: 2 + (100 * 1) / 1000, s: (900 * 100 * 1) / (2 * 50 * 1000), tau: (900 * 100 * 1) / (1000 * 50) },
    note: 'M = 900 кг, m = 100 кг, v₀ = 2 м/с, u₀ = 1 м/с, F = 50 Н. Книга: v = v₀ + mu₀/(M + m); s = Mmu₀²/(2F(M + m)); τ = Mmu₀/(F(M + m)).',
  },
  m3613: {
    title: 'Мещерский 36.13: давление струи на стену',
    problem: jet({ streams: [js('струя', false, 16e-4, 8, 30), js('вдоль стены вверх', true, 12e-4, 8, 90), js('вдоль стены вниз', true, 0, 8, -90)] }),
    book: { Rx: 9.05 },
    note: 'Сечение 16 см², v = 8 м/с под 30° к горизонту; после удара частицы движутся вдоль стены. Давление на стену — горизонтальная составляющая: 9,05 кГ. Струя делится вверх и вниз в долях (1 ± sin 30°)/2 — тогда гладкая стена не получает касательной силы (R_y = 0); на R_x деление не влияет.',
  },
  m3614: {
    title: 'Мещерский 36.14: давление воды на колено трубы',
    problem: jet({ streams: [js('вход', false, area(0.3), 2, 0), js('выход', true, 0, 2, -90)] }),
    book: { Rx: 28.9 },
    relTol: 0.005,
    note: 'Труба ∅300 мм, v = 2 м/с, колено 90°: горизонтальная составляющая N = 28,9 кГ (по расчёту 28,8).',
  },
  m3615: {
    title: 'Мещерский 36.15: реакция воды на стенки канала',
    problem: jet({ streams: [js('вход', false, 0.02, 2, -90), js('выход', true, 0, 4, 30)] }),
    book: { Rx: 14.1 },
    note: 'Вход: v₀ = 2 м/с под 90° к горизонту, сечение 0,02 м²; выход: v₁ = 4 м/с под 30°. Модуль горизонтальной составляющей — 14,1 кГ.',
  },
  m3616: {
    title: 'Мещерский 36.16: давление на опору колена трубы',
    problem: jet({ streams: [js('вход', false, area(0.2), 4, 0), js('выход', true, 0, 4, 60)] }),
    book: { R: 51.2 },
    note: 'Труба ∅20 см в горизонтальной плоскости, v = 4 м/с, скорости на входе и выходе под углом 60°: 51,2 кГ.',
  },
  m3617: {
    title: 'Мещерский 36.17: давление струи на лопатку турбины (пример)',
    problem: jet({ streams: [js('подача', false, 0.05 / 20, 20, 0), js('сход', true, 0, 8, 150)] }),
    book: { Rx: ((1000 * 0.05) / G) * (20 + 8 * Math.cos(rad(30))) },
    note: 'Q = 0,05 м³/с (сечение Q/v₁), v₁ = 20 м/с горизонтально, v₂ = 8 м/с под α = 30° к горизонту назад. Книга: N = γQ(v₁ + v₂ cos α)/g.',
  },
  m3618: {
    title: 'Мещерский 36.18: давление котла на опоры при срыве крышки',
    problem: jet({ rho: 900, W: 10350 + 15000, streams: [js('из патрубка вниз', true, area(0.4), Math.sqrt(2 * G * (100000 / 900 + 1)), -90)] }),
    book: { Ny: 0 },
    note: 'Котёл 10,35 т с водой 15 т, p₀ = 10 ат, H = 1 м, d = 0,4 м, γ = 0,9 т/м³; v = √(2g(p₀/γ + H)) = 46,9 м/с. Реакция струи 25,36 т больше веса 25,35 т — давление на опоры равно нулю.',
  },
} satisfies Record<string, McPreset>;

export type McPresetKey = keyof typeof MC_PRESETS;
