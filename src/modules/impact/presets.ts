/** Готовые задачи вкладки «Удар»: Мещерский §44, Яблонский Д.13. Ответы — по книге или по её формулам. */
import { G } from '../rotation/model/rotation';
import type { ImpBody, ImpProblem } from './model/impact';

export interface ImpPreset {
  title: string;
  problem: ImpProblem;
  /**
   * Ответ: u1, u2 — модули скоростей после удара; u1x, u1y, u2x, … — составляющие; w1, w2 — угловые скорости;
   * S — модуль импульса; SOx, SOy — импульс оси тела 2; dT, T1, eta — потеря энергии, энергия после, ΔT/T;
   * rise, total, alpha, slide, phi, spring, R — движение после удара (у тела 2, если не указано «1.»); perc — центр удара;
   * v1, k — обратные задачи.
   */
  book?: Record<string, number>;
  relTol?: number;
  /** Допуск для ответа «0». */
  absTol?: number;
  note?: string;
}
const rad = (a: number) => (a * Math.PI) / 180;
export const ibody = (o: Partial<ImpBody>): ImpBody => ({
  kind: 'free',
  name: '',
  m: 1,
  inertia: 'point',
  J: 1,
  rho: 0.5,
  L: 1,
  R: 0.1,
  a: 1,
  b: 1,
  th: 0,
  cx: 0,
  cy: 0,
  ox: 0,
  oy: 0,
  before: 'given',
  vx: 0,
  vy: 0,
  omega: 0,
  h: 1,
  l: 1,
  ang: 30,
  after: 'none',
  f: 0.2,
  c: 1000,
  delta: 0.01,
  ...o,
});
export const imp = (o: Partial<ImpProblem>): ImpProblem => ({
  byWeight: false,
  g: G,
  b1: ibody({ name: 'тело 1' }),
  b2: ibody({ name: 'тело 2' }),
  px: 0,
  py: 0,
  nAng: 0,
  contact: 'smooth',
  k: 1,
  stick: false,
  ask: 'after',
  target: 'angle',
  tVal: 30,
  ...o,
});
const wall = (name: string) => ibody({ kind: 'wall', name });
// 44.2: P = 10 кГ, p = 20 кГ, h = 0,5 м, c = 1000 кГ/м.
const s2 = { P: 10, p: 20, h: 0.5, c: 1000 };
// 44.10: m₁ = 2, m₂ = 3, v₁ = 4 м/с под углом 30° к линии центров, k = 0,5.
const s10 = { m1: 2, m2: 3, v: 4, al: 30, k: 0.5 };
// 44.17: m₁ = 1, m₂ = 2, l₁ = 1, l₂ = 0,5, α₁ = 60°, k = 0,5.
const s17 = { m1: 1, m2: 2, l1: 1, l2: 0.5, a1: 60, k: 0.5 };
// 44.18: стальной стержень Ø2 см длиной 90 см и диск R = 10 см толщиной 5 см (центр — 100 см от оси), ρ = 7,8 г/см³.
const rhoSt = 7.8e-3;
const m18 = { rod: rhoSt * Math.PI * 1 * 90, disk: rhoSt * Math.PI * 100 * 5 };
const J18 = m18.rod * (0.9 ** 2 / 3 + 0.01 ** 2 / 4) + m18.disk * (0.1 ** 2 / 2 + 1);
const M18 = m18.rod + m18.disk;
const h18 = (m18.rod * 0.45 + m18.disk * 1) / M18;
const l18 = J18 / (M18 * h18);
// 44.22: M = 10 кг, OC = h = 0,8 м, ρ = 0,9 м, a = ρ²/h, m = 10 г, α = 20°.
const s22 = { M: 10, h: 0.8, rho: 0.9, m: 0.01, al: 20 };
const a22 = s22.rho ** 2 / s22.h;
// 44.23: M = 2 кг, l = 1 м, m = 1 кг, f = 0,2.
const s23 = { M: 2, l: 1, m: 1, f: 0.2 };
// Яблонский Д.13, пример: цилиндр m = 500 кг, r = 0,5 м, ступенька h = 0,1 м, скорость платформы 3,68 м/с.
const yd = { m: 500, r: 0.5, h: 0.1, v: 3.68 };
const yx = Math.sqrt(yd.r ** 2 - (yd.r - yd.h) ** 2);

export const IMP_PRESETS = {
  m441: {
    title: 'Мещерский 44.1: баба копра падает на наковальню на пружине',
    problem: imp({
      byWeight: true,
      b1: ibody({ name: 'баба', m: 10, cy: 0.1, before: 'fall', h: 4.905 }),
      b2: ibody({ name: 'наковальня', m: 5 }),
      nAng: -90,
      k: 0,
      stick: true,
    }),
    book: { u2: 6.54 },
    relTol: 0.001,
    note: 'Вес бабы 10 кГ, наковальни 5 кГ, высота 4,905 м; баба после удара движется вместе с наковальней. Пружина при ударе импульса не даёт.',
  },
  m442: {
    title: 'Мещерский 44.2: груз падает на плиту на пружине — наибольшее сжатие',
    problem: imp({
      byWeight: true,
      b1: ibody({ name: 'груз', m: s2.P, cy: 0.1, before: 'fall', h: s2.h }),
      b2: ibody({ name: 'плита', m: s2.p, after: 'spring', c: s2.c }),
      nAng: -90,
      k: 0,
      stick: true,
    }),
    book: { spring: s2.P / s2.c + Math.sqrt((s2.P / s2.c) ** 2 + (2 * s2.P ** 2 * s2.h) / (s2.c * (s2.P + s2.p))) },
    relTol: 1e-9,
    note: 'P = 10 кГ, p = 20 кГ, h = 0,5 м, c = 1000 кГ/м; удар неупругий. Книга: s = P/c + √(P²/c² + 2P²h/(c(P + p))) — от положения равновесия плиты.',
  },
  m443: {
    title: 'Мещерский 44.3: коэффициент восстановления по высоте отскока',
    problem: imp({
      b1: ibody({ name: 'шарик', m: 0.01, cy: 0.01, before: 'fall', h: 0.5, after: 'rise' }),
      b2: wall('пластинка'),
      nAng: -90,
      ask: 'k',
      target: 'height',
      tVal: 0.45,
    }),
    book: { k: Math.sqrt(0.45 / 0.5) },
    relTol: 1e-9,
    note: 'h₁ = 50 см, h₂ = 45 см. Книга: k = √(h₂/h₁) = 0,95.',
  },
  m444: {
    title: 'Мещерский 44.4: путь шарика, подпрыгивающего на плите, до остановки',
    problem: imp({ b1: ibody({ name: 'шарик', m: 0.01, cy: 0.01, before: 'fall', h: 1, after: 'rise' }), b2: wall('плита'), nAng: -90, k: 0.5 }),
    book: { '1.total': (1 * (1 + 0.25)) / (1 - 0.25), '1.rise': 0.25 },
    relTol: 1e-9,
    note: 'h = 1 м, k = 0,5. Книга: s = (1 + k²)h/(1 − k²); после первого отскока шарик поднимается на k²h.',
  },
  m445: {
    title: 'Мещерский 44.5: паровой молот — работа на деформацию и КПД',
    problem: imp({
      byWeight: true,
      b1: ibody({ name: 'молот', m: 12000, cy: 0.1, vy: -5 }),
      b2: ibody({ name: 'наковальня с деталью', m: 250000 }),
      nAng: -90,
      k: 0,
      stick: true,
    }),
    book: { dT: 14600, T1: 700, eta: 0.95 },
    relTol: 0.01,
    note: 'Молот 12 т, скорость 5 м/с; наковальня с деталью 250 т; удар неупругий. Работа, поглощаемая деталью, — потеря энергии при ударе; потерянная на сотрясение фундамента — энергия после удара.',
  },
  m446: {
    title: 'Мещерский 44.6: абсолютно упругий удар одинаковых шаров — обмен скоростями',
    problem: imp({ b1: ibody({ name: 'шар 1', vx: 3 }), b2: ibody({ name: 'шар 2', cx: 0.2, vx: -2 }), px: 0.1, k: 1 }),
    book: { u1x: -2, u2x: 3 },
    relTol: 1e-9,
    note: 'v₁ = 3 м/с, v₂ = −2 м/с (навстречу). Книга: шары обмениваются скоростями.',
  },
  m447: {
    title: 'Мещерский 44.7: при v_A/v_B = (1 + k)/(1 − k) шар A после удара останавливается',
    problem: imp({ b1: ibody({ name: 'шар A', vx: 3 }), b2: ibody({ name: 'шар B', cx: 0.2, vx: -1 }), px: 0.1, k: 0.5 }),
    book: { u1x: 0 },
    note: 'k = 0,5: (1 + k)/(1 − k) = 3, v_A = 3 м/с, v_B = 1 м/с навстречу.',
  },
  m4410: {
    title: 'Мещерский 44.10: косой удар шаров',
    problem: imp({
      b1: ibody({ name: 'шар 1', m: s10.m1, vx: s10.v * Math.cos(rad(s10.al)), vy: s10.v * Math.sin(rad(s10.al)) }),
      b2: ibody({ name: 'шар 2', m: s10.m2, cx: 0.2 }),
      px: 0.1,
      k: s10.k,
    }),
    book: {
      u1: s10.v * Math.sqrt(Math.sin(rad(s10.al)) ** 2 + ((s10.m1 - s10.k * s10.m2) / (s10.m1 + s10.m2)) ** 2 * Math.cos(rad(s10.al)) ** 2),
      u2: (s10.v * s10.m1 * (1 + s10.k) * Math.cos(rad(s10.al))) / (s10.m1 + s10.m2),
    },
    relTol: 1e-9,
    note: 'm₁ = 2, m₂ = 3, v₁ = 4 м/с под углом α = 30° к линии центров, k = 0,5. Книга: u₁ = v₁√(sin²α + ((m₁ − km₂)/(m₁ + m₂))² cos²α), u₂ = v₁m₁(1 + k)cos α/(m₁ + m₂).',
  },
  m4412: {
    title: 'Мещерский 44.12: коэффициент восстановления по углам падения и отражения',
    problem: imp({
      b1: ibody({ name: 'шарик', vx: Math.sin(rad(45)), vy: -Math.cos(rad(45)) }),
      b2: wall('плита'),
      nAng: -90,
      ask: 'k',
      target: 'refl',
      tVal: 60,
    }),
    book: { k: Math.tan(rad(45)) / Math.tan(rad(60)) },
    relTol: 1e-9,
    note: 'Шарик падает под углом 45° к вертикали и отскакивает под углом 60°. Книга: k = 0,58 (= tg 45°/tg 60°).',
  },
  m4414: {
    title: 'Мещерский 44.14: косой удар одинаковых упругих шаров',
    problem: imp({
      b1: ibody({ name: 'левый шар', vx: 2 }),
      b2: ibody({ name: 'правый шар', cx: 0.2, vx: -2 * Math.cos(rad(60)), vy: 2 * Math.sin(rad(60)) }),
      px: 0.1,
      k: 1,
    }),
    book: { u1x: -2 * Math.cos(rad(60)), u1y: 0, u2x: 2, u2y: 2 * Math.sin(rad(60)) },
    relTol: 1e-9,
    note: 'v = 2 м/с; скорость правого шара — под углом α = 60° к линии центров. Книга: u₁ₙ = −v cos α, u₁τ = 0, u₂ₙ = v, u₂τ = v sin α.',
  },
  m4416: {
    title: 'Мещерский 44.16: сопротивление грунта при забивке сваи',
    problem: imp({
      byWeight: true,
      b1: ibody({ name: 'боёк', m: 450, cy: 0.1, before: 'fall', h: 2 }),
      b2: ibody({ name: 'свая', m: 50, after: 'pile', delta: 0.05 }),
      nAng: -90,
      k: 0,
      stick: true,
    }),
    book: { pileT: 16200 },
    relTol: 0.005,
    note: 'Боёк 450 кГ падает с 2 м на сваю 50 кГ; удар неупругий; свая углубляется на δ = 5 см за удар (так получен ответ книги). Книга: S = 16,2 т = T′/δ — без работы веса бойка и сваи; с ней R = (P + P₁) + T′/δ.',
  },
  m4417: {
    title: 'Мещерский 44.17: шары на нитях — угол отклонения второго шара',
    problem: imp({
      b1: ibody({ name: 'шар 1', m: s17.m1, before: 'thread', l: s17.l1, ang: s17.a1 }),
      b2: ibody({ name: 'шар 2', m: s17.m2, cx: 0.2, after: 'thread', l: s17.l2 }),
      px: 0.1,
      k: s17.k,
    }),
    book: { alpha: (2 * (Math.asin(((s17.m1 * (1 + s17.k)) / (s17.m1 + s17.m2)) * Math.sqrt(s17.l1 / s17.l2) * Math.sin(rad(s17.a1 / 2))) * 180)) / Math.PI },
    relTol: 1e-9,
    note: 'm₁ = 1, m₂ = 2, l₁ = 1 м, l₂ = 0,5 м, α₁ = 60°, k = 0,5. Книга: sin(α₂/2) = m₁(1 + k)/(m₁ + m₂)·√(l₁/l₂)·sin(α₁/2).',
  },
  m4418: {
    title: 'Мещерский 44.18: маятник ударной машины — центр удара',
    problem: imp({
      b1: ibody({ kind: 'axis', name: 'маятник', m: M18, inertia: 'JO', J: J18, cx: 0, cy: -h18, before: 'swing', ang: -90 }),
      b2: wall('брусок'),
      px: 0,
      py: -Math.round(l18 * 1e6) / 1e6,
      k: 0,
    }),
    book: { '1.perc': 0.975, '1.SOx': 0, '1.SOy': 0 },
    absTol: 1e-4,
    relTol: 0.001,
    note: `Стальной стержень Ø2 см длиной 90 см и диск R = 10 см толщиной 5 см (центр диска — 100 см от оси); маятник падает из горизонтального положения и ударяет закреплённый брусок в центре удара — ось удара не испытывает: M = ${M18.toFixed(3).replace('.', ',')} кг, OC = ${h18.toFixed(4).replace('.', ',')} м, J_O = ${J18.toFixed(4).replace('.', ',')} кг·м² — из «Геометрии масс». Книга: l = 97,5 см.`,
  },
  m4419: {
    title: 'Мещерский 44.19: центр удара прямоугольной мишени',
    problem: imp({
      b1: ibody({ name: 'пуля', m: 0.01, cx: -0.1, cy: -0.6, vx: 300 }),
      b2: ibody({ kind: 'axis', name: 'мишень', m: 5, inertia: 'rod', L: 1.2, th: 90, cy: -0.6 }),
      px: 0,
      py: -0.6,
      k: 0,
    }),
    book: { perc: (2 / 3) * 1.2 },
    relTol: 1e-9,
    note: 'Мишень высотой h = 1,2 м подвешена за верхний край — в профиль это стержень длиной h. Книга: s = 2h/3.',
  },
  m4420: {
    title: 'Мещерский 44.20: центр удара треугольной мишени',
    problem: imp({
      b1: ibody({ name: 'пуля', m: 0.01, cx: -0.1, cy: -0.3, vx: 300 }),
      b2: ibody({ kind: 'axis', name: 'мишень', m: 5, inertia: 'rhoO', rho: 0.9 / Math.sqrt(6), cy: -0.3 }),
      px: 0,
      py: -0.3,
      k: 0,
    }),
    book: { perc: 0.45 },
    relTol: 1e-9,
    note: 'Треугольник высотой h = 0,9 м подвешен за основание: J_O = Mh²/6 (ρ_O = h/√6), центр масс на h/3. Книга: s = h/2.',
  },
  m4422: {
    title: 'Мещерский 44.22: баллистический маятник — скорость снаряда',
    problem: imp({
      b1: ibody({ name: 'снаряд', m: s22.m, cx: -0.1, cy: -a22, vx: 1 }),
      b2: ibody({ kind: 'axis', name: 'маятник', m: s22.M, inertia: 'rhoO', rho: s22.rho, cy: -s22.h, after: 'swing' }),
      px: 0,
      py: -a22,
      k: 0,
      stick: true,
      ask: 'v1',
      target: 'angle',
      tVal: s22.al,
    }),
    book: { v1: ((2 * (s22.M * s22.h + s22.m * a22)) / s22.m) * Math.sqrt(G / a22) * Math.sin(rad(s22.al / 2)), SOx: 0 },
    relTol: 1e-9,
    note: 'M = 10 кг, OC = h = 0,8 м, ρ = 0,9 м, снаряд m = 10 г попадает на расстоянии a = ρ²/h (ось не испытывает удара), α = 20°. Книга: v = 2(Mh + ma)/m·√(g/a)·sin(α/2).',
  },
  m4423: {
    title: 'Мещерский 44.23: падающий стержень ударяет груз — путь груза',
    problem: imp({
      b1: ibody({ kind: 'axis', name: 'стержень', m: s23.M, inertia: 'rod', L: s23.l, th: 90, cy: -s23.l / 2, before: 'swing', ang: 90 }),
      b2: ibody({ name: 'груз', m: s23.m, cx: -0.05, cy: -s23.l, after: 'slide', f: s23.f }),
      px: 0,
      py: -s23.l,
      nAng: 180,
      k: 0,
    }),
    book: { slide: ((3 * s23.l) / (2 * s23.f)) * (s23.M ** 2 / (s23.M + 3 * s23.m) ** 2) },
    relTol: 1e-9,
    note: 'M = 2 кг, l = 1 м, m = 1 кг, f = 0,2; стержень падает из горизонтального положения, удар неупругий. Книга: s = (3l/2f)·M²/(M + 3m)².',
  },
  m4424: {
    title: 'Мещерский 44.24: наименьшая скорость шара, при которой призма опрокинется',
    problem: imp({
      b1: ibody({ name: 'шар', m: 1, cx: -1.1, cy: 1.5, vx: 1 }),
      b2: ibody({ kind: 'axis', name: 'призма', m: 3, inertia: 'rect', a: 1, b: 3, cx: -0.5, cy: 1.5, after: 'swing' }),
      px: -1,
      py: 1.5,
      k: 0,
      stick: true,
      ask: 'v1',
      target: 'tip',
    }),
    book: { v1: Math.sqrt(53 * G * 1) / 3 },
    relTol: 1e-6,
    note: 'a = 1 м, высота 3a, масса призмы 3m, шар m; ось — ребро AB (начало координат), удар в середину C противоположной грани; шар остаётся в C. Книга: v = (1/3)√(53ga).',
  },
  m4425: {
    title: 'Мещерский 44.25: груз на платформе при её мгновенной остановке',
    problem: imp({ b1: ibody({ name: 'груз', m: 1, inertia: 'rect', a: 4, b: 3, cx: -2, cy: 1.5, vx: 5 }), b2: wall('выступ'), contact: 'rough', k: 0 }),
    book: { w1: (-1.5 * 5) / (4 ** 2 / 12 + 3 ** 2 / 12 + 2.5 ** 2) },
    relTol: 1e-9,
    note: 'Груз 4 × 3 м упирается ребром B в выступ (начало координат), v = 5 м/с. Книга: ω = hv/ρ² (h = 1,5 м — высота центра тяжести, ρ — радиус инерции относительно ребра B); знак «−» — вращение по часовой стрелке.',
  },
  m4426: {
    title: 'Мещерский 44.26: скорость платформы, при которой груз опрокинется',
    problem: imp({
      b1: ibody({ name: 'груз', m: 1, inertia: 'rect', a: 4, b: 3, cx: -2, cy: 1.5, vx: 1, after: 'pivot' }),
      b2: wall('выступ'),
      contact: 'rough',
      k: 0,
      ask: 'v1',
      target: 'tip',
    }),
    book: { v1: 30.7 / 3.6 },
    relTol: 0.002,
    note: 'Однородный параллелепипед: вдоль платформы 4 м, высота 3 м. Книга: v = 30,7 км/ч (8,53 м/с).',
  },
  yd13: {
    title: 'Яблонский, Д.13: цилиндр при остановке платформы ударяется о ребро ступеньки (пример)',
    problem: imp({
      b1: ibody({ name: 'цилиндр', m: yd.m, inertia: 'disk', R: yd.r, cx: 0, cy: yd.r, vx: yd.v, after: 'pivot' }),
      b2: wall('ступенька'),
      px: yx,
      py: yd.h,
      nAng: (Math.atan2(yd.h - yd.r, yx) * 180) / Math.PI,
      contact: 'rough',
      k: 0,
    }),
    book: { S: 1208, S1x: -1055, S1y: 589, w1: (-2 * yd.v * (yd.r - yd.h)) / (3 * yd.r ** 2) },
    relTol: 0.002,
    note: 'm = 500 кг, r = 0,5 м, высота ступеньки 0,1 м, скорость платформы до остановки 3,68 м/с (ответ примера). Книга: ω = 2v(r − h)/(3r²), ударный импульс 1208 Н·с (1055 и 589 Н·с).',
  },
} satisfies Record<string, ImpPreset>;
export type ImpPresetKey = keyof typeof IMP_PRESETS;
