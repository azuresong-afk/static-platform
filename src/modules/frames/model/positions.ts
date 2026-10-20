/**
 * Поиск положения равновесия и трение в шарнирах (пункт 17, Мещерский §2, §4): неизвестен угол или размер, а не
 * нагрузка. Схемы строятся по координатам точек (Scheme из contacts.ts) в найденном положении, а поля, которые
 * зависят от параметра, задаются формулами (Structure.search).
 *
 * Правила перевода:
 * - Единицы книги (кГ, т, н) сохраняются как числа; задачи в общем виде — с конкретными числами, ответ вычислен по
 *   формуле книги.
 * - Шары, кольца, грузы — тела-точки; неподвижные центры, блоки, точки подвеса — тела-точки с шарниром.
 * - Нить, лежащая на гладкой поверхности, заменена нитью через блок в точке пересечения касательных: силы на тело
 *   те же (натяжение вдоль касательной).
 */
import type { IdGen } from '../../../shared/ids';
import { scheme } from './contacts';
import type { Search, SearchBind, SearchUnit, Structure } from './types';

type P = [number, number];

/** Ответ книги для проверки. */
export interface PositionCheck {
  /** Корни (без трения) или границы промежутков (с трением), по возрастанию. */
  points?: number[];
  /** Промежутки, где равновесие возможно (с трением). */
  ranges?: [number, number][];
  /** Устойчивость корней (по порядку): true, false, null — безразлично. */
  stable?: (boolean | null | undefined)[];
  /** Корни, которые не подходят (по порядку): true — не подходит. */
  rejected?: boolean[];
  /** Значения неизвестных в выбранном положении (по умолчанию — первом подходящем). */
  vals?: Record<string, number>;
  /** Номер положения для vals. */
  pick?: number;
}

export interface PositionProblem {
  id: string;
  page: number;
  title: string;
  build: (ids?: IdGen) => Structure;
  answer: string;
  check: PositionCheck;
  /** Относительный допуск сравнения (по умолчанию 1e-3). */
  relTol?: number;
  /** Расхождения с книгой, подтверждённые ручным пересчётом. */
  discrepancy?: Record<string, { computed: number; why: string }>;
}

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const sin = (d: number) => Math.sin(rad(d)),
  cos = (d: number) => Math.cos(rad(d));

const search = (name: string, unit: SearchUnit, min: number, max: number, bind: [string, string, string][]): Search => ({
  name,
  unit,
  min,
  max,
  bind: bind.map(([ref, field, expr]): SearchBind => ({ ref, field, expr })),
});

/** 2.48: φ₂ из tg φ₂ = sin 2/(2 + cos 2), φ₁ = 2 рад − φ₂. */
const PHI2_248 = deg(Math.atan(Math.sin(2) / (2 + Math.cos(2))));
const PHI1_248 = deg(2) - PHI2_248;
/** 4.56: P₁ = 1, P₂ = 2, α = 60°: tg θ = (P₂ + P₁ cos α)/(P₁ sin α). */
const TH_456 = deg(Math.atan((2 + 1 * cos(60)) / (1 * sin(60))));
/** 4.70: a = 1, b = 0,6, f = 0,3: ctg φ = b²(1 + f²)/(a² f) − f. */
const PHI_470 = deg(Math.atan(1 / ((0.36 * 1.09) / 0.3 - 0.3)));
/** 4.77: 150 + 8(9 + h) = 3,5(6 + 1,8h) + 0,18·7h(6 + 0,9h) → 1,134h² + 5,86h − 201 = 0. */
const H_477 = (-5.86 + Math.sqrt(5.86 * 5.86 + 4 * 1.134 * 201)) / (2 * 1.134);
/** 3.28: tg α = √3/5. */
const A_328 = deg(Math.atan(Math.sqrt(3) / 5));
/** 3.29: a = 1, b = 2, p = 0,5, P₁ = 1, P₂ = 3: tg α = (a/b)(P₂ − P₁)/(P₂ + P₁ + p(4a + b)) = 1/7. */
const A_329 = deg(Math.atan(0.5 * (2 / (4 + 0.5 * 6))));
/** 4.72: d = 50, a = 0,5, f = 0,1: лист захватывается, пока tg α ≤ f, cos α = (d/2 + a/2 − b/2)/(d/2). */
const B_472 = 2 * (25.25 - 25 / Math.sqrt(1.01));
/** 2.64: tg α = Σ fᵢGᵢ / ΣGᵢ. */
const A_264 = deg(Math.atan((0.1 * 10 + 0.25 * 30 + 0.5 * 60) / 100));

export const POSITION_PROBLEMS: PositionProblem[] = [
  {
    id: '2.48 (57)',
    page: 21,
    title: 'Два шарика на гладком цилиндре, связанные нитью: углы равновесия',
    build: (ids) =>
      scheme(ids, (b) => {
        // R = 0,1; нить 0,2 = 2 рад дуги. K — пересечение касательных в A и B (блок): нить на цилиндре тянет по касательной.
        const f1 = PHI1_248,
          f2 = PHI2_248,
          L = 0.1 / Math.cos(1),
          be = (f2 - f1) / 2;
        const [O] = b.body([[0, 0]]);
        const [A] = b.body([[-0.1 * sin(f1), 0.1 * cos(f1)]]);
        const [B] = b.body([[0.1 * sin(f2), 0.1 * cos(f2)]]);
        const [K] = b.body([[L * sin(be), L * cos(be)]]);
        b.item({ type: 'pin', at: O, side: 'below' });
        b.item({ type: 'pin', at: K, side: 'below' });
        b.item({ type: 'weight', at: A, G: 1 });
        b.item({ type: 'weight', at: B, G: 2 });
        const cA = b.link({ type: 'contact', a: O, b: A, angle: 90 + f1, f: 0 });
        const cB = b.link({ type: 'contact', a: O, b: B, angle: 90 - f2, f: 0 });
        b.link({ type: 'thread', a: A, b: B, via: [K] });
        b.s.search = search('φ', 'deg', 1, 114, [
          [A, 'dx', '-0,1 sin φ'],
          [A, 'dy', '0,1 cos φ'],
          [B, 'dx', '0,1 sin(360/π − φ)'],
          [B, 'dy', '0,1 cos(360/π − φ)'],
          [K, 'dx', '0,1/cos(180/π) · sin((360/π − 2φ)/2)'],
          [K, 'dy', '0,1/cos(180/π) · cos((360/π − 2φ)/2)'],
          [cA, 'angle', '90 + φ'],
          [cB, 'angle', '90 − (360/π − φ)'],
        ]);
      }),
    answer:
      'Ответ задачника: φ₁ = 2 − φ₂ (рад); tg φ₂ = sin 2/(2 + cos 2); φ₁ = 84°45′; φ₂ = 29°50′; N₁ = cos φ₁ = 0,092 н; N₂ = 2 cos φ₂ = 1,73 н. Параметр φ = φ₁, φ₂ = 360°/π − φ (нить 0,2 м — дуга 2 рад). Точки в приложении: A — ось цилиндра (тело-точка с шарниром), B и C — шарики A и B книги; нить, лежащая на цилиндре, заменена нитью через блок D в точке пересечения касательных в B и C — натяжение на шарики то же, по касательной.',
    check: { points: [PHI1_248], vals: { N_B: Math.cos(rad(PHI1_248)), N_C: 2 * Math.cos(rad(PHI2_248)), T: Math.sin(rad(PHI1_248)) } },
    discrepancy: {
      φ: {
        computed: PHI1_248,
        why: 'По формуле книги φ₁ = 84,731° = 84°43,9′, φ₂ = 29,860° = 29°51,6′; в ответе книги φ₁ = 84°45′, φ₂ = 29°50′ — округление (сумма 114°35′ = 2 рад сохранена).',
      },
    },
  },
  {
    id: '2.49 (58)',
    page: 22,
    title: 'Кольцо на проволочной окружности, верёвка через блок в высшей точке: угол равновесия',
    build: (ids) =>
      scheme(ids, (b) => {
        // R = 1, P = 2, Q = 1: sin(φ/2) = Q/(2P) = 0,25.
        const f = 2 * deg(Math.asin(0.25));
        const [O] = b.body([[0, 0]]);
        const [A] = b.body([[-sin(f), cos(f)]]);
        b.item({ type: 'pin', at: O, side: 'below' });
        const r = b.item({ type: 'roller', at: A, side: 'tilt', angle: 90 + f });
        b.item({ type: 'weight', at: A, G: 2 });
        const q = b.item({ type: 'force', at: A, F: 1, ref: 'right', rot: 'ccw', alpha: f / 2, unknown: false });
        b.s.search = search('φ', 'deg', 0.5, 359.5, [
          [A, 'dx', '−sin φ'],
          [A, 'dy', 'cos φ'],
          [r, 'angle', '90 + φ'],
          [q, 'alpha', 'φ/2'],
        ]);
      }),
    answer:
      'Ответ задачника: sin(φ₁/2) = Q/(2P); φ₂ = π; первое положение возможно при Q < 2P, второе — при любых Q и P. Взяты R = 1, P = 2, Q = 1: φ₁ = 2 arcsin 0,25 = 28,96°. Точки в приложении: A — центр окружности, B — кольцо (тело-точка, каток с реакцией по радиусу — кольцо на проволоке, связь двусторонняя); натяжение верёвки Q направлено от кольца к блоку в высшей точке окружности (угол φ/2 к горизонтали). Третий корень 360° − φ₁ — то же положение, зеркально (кольцо справа от вертикали). Устойчивость приложение определяет само: φ₁ — неустойчиво, φ = 180° — устойчиво.',
    check: { points: [2 * deg(Math.asin(0.25)), 180, 360 - 2 * deg(Math.asin(0.25))], stable: [false, true, false] },
  },
  {
    id: '2.50 (59)',
    page: 22,
    title: 'Кольцо на окружности, упругая нить к высшей точке: угол равновесия',
    build: (ids) =>
      scheme(ids, (b) => {
        // R = 1, l = 1, k = 3, p = 1: cos φ = kl/(2(kR − pl)) = 0,75. Длина нити L = 2R cos φ, T = k(L − l)/l.
        const f = deg(Math.acos(0.75));
        const [A] = b.body([[0, 0]]);
        const [B] = b.body([[2 * cos(f) * sin(f), -2 * cos(f) * cos(f)]]);
        b.item({ type: 'pin', at: A, side: 'below' });
        const r = b.item({ type: 'roller', at: B, side: 'tilt', angle: 2 * f - 90 });
        b.item({ type: 'weight', at: B, G: 1 });
        const t = b.item({ type: 'force', at: B, F: 3 * (2 * cos(f) - 1), ref: 'right', rot: 'ccw', alpha: 90 + f, unknown: false });
        b.s.search = search('φ', 'deg', 0, 59, [
          [B, 'dx', '2 cos φ sin φ'],
          [B, 'dy', '−2 cos φ · cos φ'],
          [r, 'angle', '2φ − 90'],
          [t, 'F', '3(2 cos φ − 1)'],
          [t, 'alpha', '90 + φ'],
        ]);
      }),
    answer:
      'Ответ задачника: cos φ = kl/(2(kR − pl)), если k ≥ 2pl/(2R − l); в противном случае φ = 0. Взяты R = 1, l = 1, k = 3, p = 1: cos φ = 0,75, φ = 41,41°. A — верхняя точка окружности (тело-точка с шарниром), B — кольцо (каток с реакцией по радиусу); натяжение нити — сила по формуле T = k(L − l)/l, L = 2R cos φ, направлена к A. Промежуток поиска — пока нить растянута (L > l, φ < 60°). Корень φ = 0 — нижняя точка окружности: при k ≥ 2pl/(2R − l) оно неустойчиво, при меньших k — единственное.',
    check: { points: [0, deg(Math.acos(0.75))], stable: [false, true] },
  },
  {
    id: '2.54 (63)',
    page: 23,
    title: 'Подпорная стена: толщина по условию неопрокидывания',
    build: (ids) =>
      scheme(ids, (b) => {
        // H = 3 м (на ответ не влияет), давление земли 6 т на высоте H/3 = 1 м, удельный вес 2 т/м³: G = 2·3·a.
        const a = Math.SQRT2;
        const [A, M, K, E] = b.body([
          [0, 0],
          [a / 2, 0],
          [a, 0],
          [a, 1],
        ]);
        const [s1, s2] = b.segsOf([A, M, K, E]);
        b.item({ type: 'pin', at: A, side: 'below' });
        b.item({ type: 'roller', at: K, side: 'below', oneSided: true });
        const g = b.item({ type: 'weight', at: M, G: 6 * a });
        b.item({ type: 'force', at: E, F: 6, ref: 'left', rot: 'ccw', alpha: 0, unknown: false });
        b.s.search = search('a', 'm', 0.2, 4, [
          [s1, 'len', 'a/2'],
          [s2, 'len', 'a/2'],
          [g, 'G', '2 · 3a'],
        ]);
      }),
    answer:
      'Ответ задачника: a ≥ 1,42 м. Высота стены H на ответ не влияет (взята 3 м): вес G = 2·H·a т на метр длины, давление земли 6 т на высоте H/3. Точки в приложении: A — ребро опрокидывания (шарнир, держит и сдвиг), C — другое ребро основания (односторонний каток: может только давить), B — середина основания (вес), D — точка приложения давления земли. Равновесие возможно при a ≥ √2 = 1,414 м.',
    check: { points: [Math.SQRT2], ranges: [[Math.SQRT2, 4]] },
  },
  {
    id: '2.60 (71)',
    page: 24,
    title: 'Тело на шероховатой наклонной плоскости: коэффициент трения по углу наклона',
    build: (ids) =>
      scheme(ids, (b) => {
        // α = 30°: f = tg α = 0,577. Параметр — коэффициент трения.
        const [A] = b.body([[0, 0]]);
        const r = b.item({ type: 'rough', at: A, side: 'tilt', angle: 120, f: Math.tan(rad(30)) });
        b.item({ type: 'weight', at: A, G: 1 });
        b.s.search = search('f', '', 0, 1.5, [[r, 'f', 'f']]);
      }),
    answer:
      'Ответ задачника: f = tg α. Взят угол α = 30°; параметр поиска — коэффициент трения f. Равновесие (покой или равномерное движение) возможно при f ≥ tg 30° = 0,577; на границе тело спускается равномерно.',
    check: { points: [Math.tan(rad(30))], ranges: [[Math.tan(rad(30)), 1.5]] },
  },
  {
    id: '2.61 (72)',
    page: 24,
    title: 'Угол естественного откоса грунта',
    build: (ids) =>
      scheme(ids, (b) => {
        const a = deg(Math.atan(0.8));
        const [A] = b.body([[0, 0]]);
        const r = b.item({ type: 'rough', at: A, side: 'tilt', angle: 90 + a, f: 0.8 });
        b.item({ type: 'weight', at: A, G: 1 });
        b.s.search = search('α', 'deg', 0, 89, [[r, 'angle', '90 + α']]);
      }),
    answer: 'Ответ задачника: 38°40′. Частица грунта — тело-точка на шероховатом откосе (f = 0,8); равновесие возможно при α ≤ arctg 0,8 = 38,66°.',
    check: { points: [deg(Math.atan(0.8))], ranges: [[0, deg(Math.atan(0.8))]] },
  },
  {
    id: '2.64',
    page: 25,
    title: 'Три груза на наклонной плоскости, связанные тросами: угол равномерного движения',
    build: (ids) =>
      scheme(ids, (b) => {
        const a = A_264;
        const [A] = b.body([[0, 0]]);
        const [B] = b.body([[cos(a), sin(a)]]);
        const [C] = b.body([[2 * cos(a), 2 * sin(a)]]);
        const r = [A, B, C].map((n, i) => b.item({ type: 'rough', at: n, side: 'tilt', angle: 90 + a, f: [0.1, 0.25, 0.5][i] }));
        [A, B, C].forEach((n, i) => b.item({ type: 'weight', at: n, G: [10, 30, 60][i] }));
        b.link({ type: 'thread', a: A, b: B });
        b.link({ type: 'thread', a: B, b: C });
        b.s.search = search('α', 'deg', 0, 60, [
          [B, 'dx', 'cos α'],
          [B, 'dy', 'sin α'],
          [C, 'dx', '2 cos α'],
          [C, 'dy', '2 sin α'],
          ...r.map((id): [string, string, string] => [id, 'angle', '90 + α']),
        ]);
      }),
    answer:
      'Ответ задачника: α = arctg 0,38, T_AB = 2,7 кГ, T_BC = 6,5 кГ. Грузы — тела-точки, A внизу, C вверху. Покой возможен при α ≤ arctg 0,385 = 21,06°; на границе все три груза скользят равномерно, и натяжения определяются однозначно.',
    check: { points: [A_264], ranges: [[0, A_264]], vals: { T_AB: 10 * sin(A_264) - 0.1 * 10 * cos(A_264), T_BC: 0.5 * 60 * cos(A_264) - 60 * sin(A_264) } },
    discrepancy: {
      T_BC: {
        computed: 0.5 * 60 * cos(A_264) - 60 * sin(A_264),
        why: 'tg α = (0,1·10 + 0,25·30 + 0,5·60)/100 = 0,385 (в книге округлено до 0,38); при нём T_AB = 2,66 ≈ 2,7 кГ, T_BC = 6,44 кГ — в книге 6,5.',
      },
    },
  },
  {
    id: '2.70',
    page: 27,
    title: 'Цилиндр на двух шероховатых опорах: угол самоторможения',
    build: (ids) =>
      scheme(ids, (b) => {
        // f = 0,3, r = 1. Самоторможение — равновесие при любой касательной силе T: при Q = 0 и T = 1.
        const t = 80;
        const [O, A, B, E] = b.body(
          [
            [0, 0],
            [-sin(t), -cos(t)],
            [sin(t), -cos(t)],
            [1, 0],
          ],
          [
            [0, 1],
            [0, 2],
            [0, 3],
          ],
        );
        const [sA, sB] = b.segsOf([O, A, B, E]);
        const rA = b.item({ type: 'rough', at: A, side: 'tilt', angle: 90 - t, f: 0.3 });
        const rB = b.item({ type: 'rough', at: B, side: 'tilt', angle: 90 + t, f: 0.3 });
        b.item({ type: 'force', at: E, F: 1, ref: 'down', rot: 'ccw', alpha: 0, unknown: false });
        b.s.search = search('θ', 'deg', 1, 89, [
          [sA, 'ang', '270 − θ'],
          [sB, 'ang', '270 + θ'],
          [rA, 'angle', '90 − θ'],
          [rB, 'angle', '90 + θ'],
        ]);
      }),
    answer:
      'Ответ задачника: T = fQ/((1 + f²) cos θ − f); θ ≤ arccos(f/(1 + f²)). Самоторможение — покой при любой касательной силе T; так как вес Q на опорах держится без трения, достаточно проверить Q = 0, T = 1. Взят f = 0,3. Точки в приложении: A — центр цилиндра, B и C — опоры A и B книги под углом θ к вертикали, сила T — касательная в точке D на уровне центра. Приложение находит θ ≥ arcctg f = 73,30° (см. расхождение).',
    check: { points: [deg(Math.atan(1 / 0.3))], ranges: [[deg(Math.atan(1 / 0.3)), 89]] },
    discrepancy: {
      θ: {
        computed: deg(Math.atan(1 / 0.3)),
        why: 'По формуле книги T = fQ/((1 + f²) cos θ − f) сила T неограниченно растёт, когда θ увеличивается до arccos(f/(1 + f²)) = 74,02° (f = 0,3): самоторможение — при θ ≥ 74,02°, а в ответе книги знак неравенства обратный (θ ≤ …). Приложение находит границу ещё ниже — θ = arcctg f = 73,30°: при θ ≥ arcctg f цилиндр может быть заклинен между опорами (давления велики, силы трения на опорах направлены в разные стороны), и такое равновесие статика твёрдых тел тоже допускает. Формула книги считает, что трение на обеих опорах препятствует повороту; тогда граница — 74,02°.',
      },
    },
  },
  {
    id: '3.28 (101)',
    page: 34,
    title: 'Ломаный рычаг на нити: угол наклона стержня',
    build: (ids) =>
      scheme(ids, (b) => {
        // AB = 1, BC = 2, угол ABC = 60°, вес единицы длины 1: веса 1 и 2 — в серединах стержней.
        const a = A_328;
        const at = (p: P, ang: number, l: number): P => [p[0] + l * cos(ang), p[1] + l * sin(ang)];
        const A: P = [0, 0],
          M1 = at(A, 300 + a, 0.5),
          B = at(A, 300 + a, 1),
          M2 = at(B, 180 + a, 1),
          C = at(B, 180 + a, 2);
        const nodes = b.body([A, M1, B, M2, C]);
        const [s1, s2, s3, s4] = b.segsOf(nodes);
        const [nA, nM1, , nM2] = nodes;
        b.item({ type: 'pin', at: nA, side: 'above' });
        b.item({ type: 'weight', at: nM1, G: 1 });
        b.item({ type: 'weight', at: nM2, G: 2 });
        b.s.search = search('α', 'deg', -30, 60, [
          [s1, 'ang', '300 + α'],
          [s2, 'ang', '300 + α'],
          [s3, 'ang', '180 + α'],
          [s4, 'ang', '180 + α'],
        ]);
      }),
    answer:
      'Ответ задачника: tg α = √3/5; α = 19°5′. Взяты AB = 1, BC = 2, вес единицы длины 1 (веса стержней 1 и 2 — в их серединах). Точки в приложении: A — точка подвеса (нить AD в равновесии вертикальна — заменена шарниром A), B и D — середины стержней AB и BC книги, C — вершина B, E — конец C. Положение устойчиво: центр тяжести рычага под точкой подвеса.',
    check: { points: [A_328], stable: [true] },
    discrepancy: {
      α: {
        computed: A_328,
        why: 'По формуле книги tg α = √3/5 = 0,34641, α = 19,107° = 19°6,4′; в ответе книги 19°5′ — неточность округления (tg 19°5′ = 0,34596).',
      },
    },
  },
  {
    id: '3.29 (103)',
    page: 34,
    title: 'Стержни под прямым углом на оси, гири на концах: угол наклона',
    build: (ids) =>
      scheme(ids, (b) => {
        // a = 1, b = OC = 2, вес единицы длины 2p = 1; P₁ = 1, P₂ = 3. Вес OC (2) — в середине, вес AB (2) — в C.
        const al = A_329;
        const at = (p: P, ang: number, l: number): P => [p[0] + l * cos(ang), p[1] + l * sin(ang)];
        const O: P = [0, 0],
          M = at(O, 270 - al, 1),
          C = at(O, 270 - al, 2);
        const [nO, nM, nC, nA, nB] = b.body(
          [O, M, C, at(C, 180 - al, 1), at(C, -al, 1)],
          [
            [0, 1],
            [1, 2],
            [2, 3],
            [2, 4],
          ],
        );
        const [s1, s2, s3, s4] = b.segsOf([nO, nM, nC, nA, nB]);
        b.item({ type: 'pin', at: nO, side: 'above' });
        b.item({ type: 'weight', at: nM, G: 2 });
        b.item({ type: 'weight', at: nC, G: 2 });
        b.item({ type: 'weight', at: nA, G: 1 });
        b.item({ type: 'weight', at: nB, G: 3 });
        b.s.search = search('α', 'deg', -60, 60, [
          [s1, 'ang', '270 − α'],
          [s2, 'ang', '270 − α'],
          [s3, 'ang', '180 − α'],
          [s4, 'ang', '−α'],
        ]);
      }),
    answer:
      'Ответ задачника: tg α = (a/b)·(P₂ − P₁)/(P₂ + P₁ + p(4a + b)). Взяты a = 1, b = 2, 2p = 1, P₁ = 1, P₂ = 3: tg α = 1/7, α = 8,13°. Вес OC (2pb = 2) — в его середине, вес AB (4pa = 2) — в C. Точки в приложении: A — ось O, B — середина OC, C — точка C, D и E — концы A и B стержня AB. Положение устойчиво.',
    check: { points: [A_329], stable: [true] },
  },
  {
    id: '4.3 (115)',
    page: 38,
    title: 'Шар и гиря на верёвках в одной точке: угол прямой OM с вертикалью',
    build: (ids) =>
      scheme(ids, (b) => {
        // a = 0,2, b = 0,5, P = 1, Q = 3: sin φ = (a/b)·P/(P + Q) = 0,1. δ = arcsin(a/b) — угол касательной из O.
        const a = 0.2,
          bb = 0.5,
          d = deg(Math.asin(a / bb)),
          f = deg(Math.asin(0.1));
        const M: P = [bb * sin(f), -bb * cos(f)];
        const [O] = b.body([[0, 0]]);
        const [Mn, T1, K] = b.body(
          [M, [M[0] + a * cos(180 + f - d), M[1] + a * sin(180 + f - d)], [M[0] - a, M[1]]],
          [
            [0, 1],
            [0, 2],
          ],
        );
        const [Pn] = b.body([[M[0] - a, M[1] - 0.4]]);
        const [sT] = b.segsOf([Mn, T1, K]);
        b.item({ type: 'pin', at: O, side: 'below' });
        b.item({ type: 'weight', at: Mn, G: 3 });
        b.item({ type: 'weight', at: Pn, G: 1 });
        b.link({ type: 'thread', a: O, b: Mn });
        b.link({ type: 'thread', a: O, b: Pn, via: [T1, K] });
        b.s.search = search('φ', 'deg', -20, 20, [
          [Mn, 'dx', '0,5 sin φ'],
          [Mn, 'dy', '−0,5 cos φ'],
          [Pn, 'dx', '0,5 sin φ − 0,2'],
          [Pn, 'dy', '−0,5 cos φ − 0,4'],
          [sT, 'ang', `180 + φ − arcsin(0,4)`],
        ]);
      }),
    answer:
      'Ответ задачника: sin φ = (a/b)·P/(P + Q). Взяты a = 0,2, b = OM = 0,5, P = 1, Q = 3: sin φ = 0,1, φ = 5,74°. Точки в приложении: A — точка подвеса O книги (тело-точка с шарниром), B — центр шара M; верёвка шара — по прямой AB, верёвка гири идёт от A по касательной к шару (точка касания C), огибает его и сходит вниз в точке D — заменена нитью через блоки C и D на шаре (силы на шар те же). Гиря — тело-точка E.',
    check: { points: [deg(Math.asin(0.1))] },
  },
  {
    id: '4.6 (118)',
    page: 39,
    title: 'Балка на двух гладких наклонных прямых: угол равновесия и давления',
    build: (ids) =>
      scheme(ids, (b) => {
        // α = 30°, AB = 2, P = 1: θ = 90° − 2α = 30°. Прямые CD и DE взаимно перпендикулярны, D — вершина угла.
        const t = 30,
          s1 = 2 * cos(t + 30);
        const A: P = [-s1 * cos(30), s1 * sin(30)];
        const [D] = b.body([[0, 0]]);
        const [An, M, B] = b.body([A, [A[0] + cos(t), A[1] + sin(t)], [A[0] + 2 * cos(t), A[1] + 2 * sin(t)]]);
        const [q1, q2] = b.segsOf([An, M, B]);
        b.item({ type: 'roller', at: An, side: 'tilt', angle: 60 });
        b.item({ type: 'roller', at: B, side: 'tilt', angle: 150 });
        b.item({ type: 'weight', at: M, G: 1 });
        void D;
        b.s.search = search('θ', 'deg', -29, 59, [
          [An, 'dx', '−2 cos(θ + 30) cos 30'],
          [An, 'dy', '2 cos(θ + 30) sin 30'],
          [q1, 'ang', 'θ'],
          [q2, 'ang', 'θ'],
        ]);
      }),
    answer:
      'Ответ задачника: N_A = P cos α; N_B = P sin α; tg θ = ctg 2α, θ = 90° − 2α при α ≤ 45°. Взяты α = 30°, AB = 2, P = 1: θ = 30°, N_A = 0,866, N_B = 0,5. Точки в приложении: A — вершина угла между прямыми (точка без нагрузок), B и D — концы балки A и B книги (катки с реакциями по нормалям к прямым, 60° и 150° к оси x; N_A книги — R_B, N_B — R_D), C — середина балки. Положение неустойчиво: середина балки движется по окружности с центром A и в равновесии занимает её высшую точку.',
    check: { points: [30], vals: { R_B: cos(30), R_D: sin(30) }, stable: [false] },
  },
  {
    id: '4.52 (164)',
    page: 52,
    title: 'Стержень опирается на стержень с грузом: угол равновесия',
    build: (ids) =>
      scheme(ids, (b) => {
        // l = 1, P = 1, Q = 2P: cos φ = 1/8. AC = 2l cos φ (треугольник AEC равнобедренный: AE = EC = l).
        const f = deg(Math.acos(1 / 8)),
          dir = 270 - f,
          ac = 2 * cos(f);
        const at = (d: number): P => [d * cos(dir), d * sin(dir)];
        const [A, C, M, B] = b.body([[0, 0], at(ac), at(1), at(2)]);
        const [s1, s2, s3] = b.segsOf([A, C, M, B]);
        const E: P = [0, -1];
        const [En, C2, D] = b.body(
          [E, [E[0] + cos(270 - 2 * f), E[1] + sin(270 - 2 * f)], [E[0] + cos(90 - 2 * f), E[1] + sin(90 - 2 * f)]],
          [
            [0, 1],
            [0, 2],
          ],
        );
        const [e1, e2] = b.segsOf([En, C2, D]);
        b.item({ type: 'pin', at: A, side: 'right' });
        b.item({ type: 'pin', at: En, side: 'right' });
        b.item({ type: 'weight', at: M, G: 1 });
        b.item({ type: 'weight', at: D, G: 2 });
        const c = b.link({ type: 'contact', a: C, b: C2, angle: 360 - f, f: 0 });
        b.s.search = search('φ', 'deg', 61, 89, [
          [s1, 'len', '2 cos φ'],
          [s1, 'ang', '270 − φ'],
          [s2, 'len', '1 − 2 cos φ'],
          [s2, 'ang', '270 − φ'],
          [s3, 'ang', '270 − φ'],
          [e1, 'ang', '270 − 2φ'],
          [e2, 'ang', '90 − 2φ'],
          [c, 'angle', '360 − φ'],
        ]);
        void B;
      }),
    answer:
      'Ответ задачника: φ = arccos(1/8) = 82°50′. Взяты l = 1, P = 1, Q = 2. Точки в приложении: стержень AB книги — AD (ось A, вес P — в середине C), стержень CD книги — HK с осью E посередине (вес CD на равновесие не влияет), груз Q — в K; конец H касается стержня AD в точке B (гладко, давление перпендикулярно AD). Промежуток поиска 61°…89°: точка касания B лежит между A и серединой C.',
    check: { points: [deg(Math.acos(1 / 8))] },
    discrepancy: {
      φ: {
        computed: deg(Math.acos(1 / 8)),
        why: 'По формуле книги φ = arccos(1/8) = 82,819° = 82°49,2′; в ответе книги 82°50′ — округление.',
      },
    },
  },
  {
    id: '4.53 (165)',
    page: 52,
    title: 'Два стержня между гладкими стенами под прямым углом: расстояние между стенами',
    build: (ids) =>
      scheme(ids, (b) => {
        // a = 1, b = 2, P₁ = 1, P₂ = 4: tg ψ = √(P₁/P₂), DE = a cos ψ + b sin ψ = (a√P₂ + b√P₁)/√(P₁ + P₂).
        const p = deg(Math.atan(0.5));
        const [A, M1, B] = b.body([
          [0, 0],
          [0.5 * cos(180 - p), 0.5 * sin(180 - p)],
          [cos(180 - p), sin(180 - p)],
        ]);
        const [a1, a2] = b.segsOf([A, M1, B]);
        const [A2, M2, C] = b.body([
          [0, 0],
          [cos(90 - p), sin(90 - p)],
          [2 * cos(90 - p), 2 * sin(90 - p)],
        ]);
        const [c1, c2] = b.segsOf([A2, M2, C]);
        b.item({ type: 'roller', at: A, side: 'below' });
        b.item({ type: 'roller', at: B, side: 'left' });
        b.item({ type: 'roller', at: A2, side: 'below' });
        b.item({ type: 'roller', at: C, side: 'right' });
        b.item({ type: 'weight', at: M1, G: 1 });
        b.item({ type: 'weight', at: M2, G: 4 });
        b.link({ type: 'contact', a: A, b: A2, angle: 0, f: 0 });
        b.s.search = search('ψ', 'deg', 1, 89, [
          [a1, 'ang', '180 − ψ'],
          [a2, 'ang', '180 − ψ'],
          [c1, 'ang', '90 − ψ'],
          [c2, 'ang', '90 − ψ'],
        ]);
      }),
    answer:
      'Ответ задачника: DE = (a√P₂ + b√P₁)/√(P₁ + P₂). Взяты a = AB = 1, b = AC = 2, P₁ = 1, P₂ = 4: DE = 4/√5 = 1,789. Приложение ищет угол ψ наклона AB к горизонту (AC перпендикулярен AB): tg ψ = √(P₁/P₂) = 0,5, ψ = 26,57°; DE = a cos ψ + b sin ψ = 1,789. Точки в приложении: стержень AB книги — AC (середина B), стержень AC книги — DH (середина E), A и D — общая точка стержней на полу. Пол — катки A и D, стены — катки C и H; гладкие вертикальные плоскости в общей точке — касание A–D с горизонтальной нормалью.',
    check: { points: [deg(Math.atan(0.5))] },
  },
  {
    id: '4.56 (168)',
    page: 53,
    title: 'Два шара на верёвках из одной точки: угол верёвки, натяжения и давление',
    build: (ids) =>
      scheme(ids, (b) => {
        // P₁ = 1, P₂ = 2, α = 60°, l₁ + R₁ = l₂ + R₂ = 1: центры шаров на окружности радиуса 1 с центром A.
        const t = TH_456;
        const [A] = b.body([[0, 0]]);
        const [C1] = b.body([[cos(t + 60), -sin(t + 60)]]);
        const [C2] = b.body([[cos(t), -sin(t)]]);
        b.item({ type: 'pin', at: A, side: 'below' });
        b.item({ type: 'weight', at: C1, G: 1 });
        b.item({ type: 'weight', at: C2, G: 2 });
        b.link({ type: 'thread', a: A, b: C1 });
        b.link({ type: 'thread', a: A, b: C2 });
        const c = b.link({ type: 'contact', a: C1, b: C2, angle: 60 - t, f: 0 });
        b.s.search = search('φ', 'deg', 1, 179, [
          [C1, 'dx', 'cos(φ + 60)'],
          [C1, 'dy', '−sin(φ + 60)'],
          [C2, 'dx', 'cos φ'],
          [C2, 'dy', '−sin φ'],
          [c, 'angle', '60 − φ'],
        ]);
      }),
    answer:
      'Ответ задачника: tg θ = −(P₂ + P₁ cos α)/(P₁ sin α); T₁ = P₁ sin(θ − α/2)/cos(α/2); T₂ = P₂ sin(θ − α/2)/cos(α/2); N = P₂ cos θ/cos(α/2). Взяты P₁ = 1, P₂ = 2, α = 60°, AB + R₁ = AD + R₂ = 1: θ = 109,11° (тупой — tg θ < 0), T₁ = 1,134, T₂ = 2,268, N = 0,756. В приложении угол φ отсчитан от горизонтали вниз до верёвки второго шара: φ = 180° − θ = 70,89°. Точки в приложении: A — точка подвеса, B и C — центры шаров P₁ и P₂ (тела-точки; T₁ — T_AB, T₂ — T_AC), давление шаров — по линии центров.',
    check: {
      points: [TH_456],
      // По формулам книги с её углом θ = 180° − θ приложения.
      vals: {
        T_AB: Math.sin(rad(180 - TH_456 - 30)) / cos(30),
        T_AC: (2 * Math.sin(rad(180 - TH_456 - 30))) / cos(30),
        N_C: (-2 * Math.cos(rad(180 - TH_456))) / cos(30),
      },
    },
    discrepancy: {
      θ: {
        computed: TH_456,
        why: 'Угол книги θ = 180° − φ = 109,11°: T₁ и T₂ по формулам книги совпадают с расчётом; N = P₂ cos θ/cos(α/2) по формуле книги получается со знаком «−» (−0,756) — по модулю совпадает с расчётом, давление 0,756.',
      },
    },
  },
  {
    id: '4.60 (172)',
    page: 56,
    title: 'Дверь, отодвигаемая с трением: наибольшая высота ручки',
    build: (ids) =>
      scheme(ids, (b) => {
        // l = 0,8, f = 0,5, G = 1. При движении сила трения fG = 0,5 — по низу двери, сила на ручке P = fG.
        const [A, K, B, H] = b.body(
          [
            [0, 0],
            [0.4, 0],
            [0.8, 0],
            [0, 0.8],
          ],
          [
            [0, 1],
            [1, 2],
            [0, 3],
          ],
        );
        const [, , sH] = b.segsOf([A, K, B, H]);
        b.item({ type: 'roller', at: A, side: 'below', oneSided: true });
        b.item({ type: 'roller', at: B, side: 'below', oneSided: true });
        b.item({ type: 'weight', at: K, G: 1 });
        b.item({ type: 'force', at: K, F: 0.5, ref: 'left', rot: 'ccw', alpha: 0, unknown: false });
        b.item({ type: 'force', at: H, F: 0.5, ref: 'right', rot: 'ccw', alpha: 0, unknown: false });
        b.s.search = search('h', 'm', 0.05, 2, [[sH, 'len', 'h']]);
      }),
    answer:
      'Ответ задачника: h = l/(2f) = 0,8 м. Дверь (G = 1) движется вправо равномерно: сила на ручке P = fG = 0,5, сила трения fG — по нижней кромке (её момент относительно точек кромки равен нулю, поэтому её распределение между A и B не важно). Точки в приложении: A и C — опоры в пазу (односторонние катки: дверь не опрокидывается, пока обе давят), B — середина нижней кромки (вес и сила трения), D — ручка на высоте h. Равновесие возможно при h ≤ 0,8 м.',
    check: { points: [0.8], ranges: [[0.05, 0.8]] },
  },
  {
    id: '4.61 (173)',
    page: 56,
    title: 'Вал с грузом на верёвке: трение в подшипниках, равномерное опускание',
    build: (ids) =>
      scheme(ids, (b) => {
        // R = 1, r = R/2, f = 0,05, P = 1; вес вала Q — искомая сила.
        const [O, E] = b.body([
          [0, 0],
          [1, 0],
        ]);
        b.item({ type: 'pin', at: O, side: 'below', fr: { f: 0.05, r: 0.5, rot: 'cw' } });
        b.item({ type: 'force', at: E, F: 1, ref: 'down', rot: 'ccw', alpha: 0, unknown: false });
        b.item({ type: 'force', at: O, F: 39, ref: 'down', rot: 'ccw', alpha: 0, unknown: true });
      }),
    answer:
      'Ответ задачника: Q/P = 39. Взяты R = 1, P = 1; вес вала Q — искомая сила F_2 в центре, груз P — в точке B. Трение в подшипниках — трение в шарнире A (ось вала): момент трения M_тр = f·r·R_A (ρ = f·r, r = R/2), груз опускается, вал вращается по часовой стрелке. Из P·R = f·r·(P + Q): Q = 39P.',
    check: { vals: { F2: 39, Mтр_A: 1 } },
  },
  {
    id: '4.70 (182)',
    page: 57,
    title: 'Стержень концами на шероховатой окружности: положения равновесия',
    build: (ids) =>
      scheme(ids, (b) => {
        // a = 1, OC = b = 0,6, f = 0,3; полухорда c = 0,8, δ = arctg(c/b). Нормали в концах — к центру O.
        const f = 0,
          c = 0.8,
          d = deg(Math.atan(c / 0.6));
        const [C, A, B] = b.body(
          [
            [0, 0],
            [c * cos(f), c * sin(f)],
            [-c * cos(f), -c * sin(f)],
          ],
          [
            [0, 1],
            [0, 2],
          ],
        );
        const [sA, sB] = b.segsOf([C, A, B]);
        const rA = b.item({ type: 'rough', at: A, side: 'tilt', angle: 90 + f + d, f: 0.3 });
        const rB = b.item({ type: 'rough', at: B, side: 'tilt', angle: 90 + f - d, f: 0.3 });
        b.item({ type: 'weight', at: C, G: 1 });
        b.s.search = search('φ', 'deg', 0, 89, [
          [sA, 'ang', 'φ'],
          [sB, 'ang', 'φ + 180'],
          [rA, 'angle', '90 + φ + arctg(4/3)'],
          [rB, 'angle', '90 + φ − arctg(4/3)'],
        ]);
      }),
    answer:
      'Ответ задачника: ctg φ ≥ b²(1 + f²)/(a²f) − f. Взяты a = 1, b = 0,6, f = 0,3: ctg φ ≥ 1,008, φ ≤ 44,77° (и симметрично φ ≥ −44,77°). Точки в приложении: A — середина стержня C книги, B и C — концы A и B на окружности (опоры с трением, нормаль — к центру окружности).',
    check: { points: [PHI_470], ranges: [[0, PHI_470]] },
  },
  {
    id: '4.72 (184)',
    page: 57,
    title: 'Прокатный стан: толщина листа, который захватывают валы',
    build: (ids) =>
      scheme(ids, (b) => {
        // Размеры в сантиметрах (числа как есть). Лист — тело с точками касания A, B на валах; α — угол между
        // вертикалью и радиусом вала в точке касания. Лист захватывается, если его не выдавить назад: тянем его
        // из валов силой 1 — равновесие возможно, только пока трение удерживает лист (tg α ≤ f, как у клина).
        const t = deg(Math.acos((25.25 - 0.3) / 25));
        const [C, A, B] = b.body(
          [
            [-25 * sin(t), 0],
            [-25 * sin(t), 0.3],
            [-25 * sin(t), -0.3],
          ],
          [
            [0, 1],
            [0, 2],
          ],
        );
        const [sA, sB] = b.segsOf([C, A, B]);
        const rA = b.item({ type: 'rough', at: A, side: 'tilt', angle: 270 - t, f: 0.1 });
        const rB = b.item({ type: 'rough', at: B, side: 'tilt', angle: 90 + t, f: 0.1 });
        b.item({ type: 'force', at: C, F: 1, ref: 'left', rot: 'ccw', alpha: 0, unknown: false });
        b.s.search = search('b', 'm', 0.5, 2, [
          [sA, 'len', 'b/2'],
          [sB, 'len', 'b/2'],
          [rA, 'angle', '270 − arccos((25,25 − b/2)/25)'],
          [rB, 'angle', '90 + arccos((25,25 − b/2)/25)'],
        ]);
      }),
    answer:
      'Ответ задачника: b ≤ 0,75 см. Размеры в сантиметрах введены числами: d = 50, a = 0,5, f = 0,1. Точки в приложении: A — середина листа у входа в валы, B и C — точки касания с верхним и нижним валом (опоры с трением, нормаль — по радиусу вала, cos α = (d/2 + a/2 − b/2)/(d/2)). Лист захватывается, если трение не даёт валам вытолкнуть его назад: к листу приложена сила 1, тянущая его из валов, и равновесие возможно, пока tg α ≤ f, — при b ≤ a + d(1 − 1/√(1 + f²)) = 0,748 см.',
    check: { points: [B_472], ranges: [[0.5, B_472]] },
  },
  {
    id: '4.73 (185)',
    page: 58,
    title: 'Блок на шипах: наименьший груз для равновесия (круг трения)',
    build: (ids) =>
      scheme(ids, (b) => {
        // R = 0,5, r = 0,1, f = 0,2, P = 10, Q = 5: ρ = r·f/√(1 + f²).
        const [O, E, L] = b.body(
          [
            [0, 0],
            [0.5, 0],
            [-0.5, 0],
          ],
          [
            [0, 1],
            [0, 2],
          ],
        );
        b.item({ type: 'pin', at: O, side: 'below', fr: { f: 0.2, r: 0.1, rot: 'cw', circle: true } });
        b.item({ type: 'weight', at: O, G: 5 });
        b.item({ type: 'force', at: E, F: 10, ref: 'down', rot: 'ccw', alpha: 0, unknown: false });
        b.item({ type: 'force', at: L, F: 9, ref: 'down', rot: 'ccw', alpha: 0, unknown: true });
      }),
    answer:
      'Ответ задачника: P₁ = (P(R√(1 + f²) − fr) − frQ)/(R√(1 + f²) + fr). Взяты R = 0,5, r = 0,1, f = 0,2, P = 10, Q = 5: P₁ = 9,056. Шипы на цилиндрических опорах — шарнир A (ось блока) с трением, радиус круга трения ρ = r·f/√(1 + f²) (шип касается опоры по одной линии; в положении равновесия плоскость осей отклонена от вертикали на угол трения). Груз P — в точке B, P₁ — искомая сила F_2 в точке C. При наименьшем P₁ блок готов повернуться по часовой стрелке (P > P₁).',
    check: { vals: { F2: (10 * (0.5 * Math.sqrt(1.04) - 0.02) - 0.02 * 5) / (0.5 * Math.sqrt(1.04) + 0.02) } },
  },
  {
    id: '4.77 (189)',
    page: 59,
    title: 'Опора моста в песке: глубина заложения',
    build: (ids) =>
      scheme(ids, (b) => {
        const h = H_477;
        const [A] = b.body([[0, 0]]);
        const g = b.item({ type: 'weight', at: A, G: 150 + 8 * (9 + h) });
        const up = b.item({ type: 'force', at: A, F: 3.5 * (6 + 1.8 * h) + 0.18 * 7 * h * (6 + 0.9 * h), ref: 'up', rot: 'ccw', alpha: 0, unknown: false });
        b.s.search = search('h', 'm', 0, 30, [
          [g, 'G', '150 + 8(9 + h)'],
          [up, 'F', '3,5(6 + 1,8h) + 0,18 · 7h(6 + 0,9h)'],
        ]);
      }),
    answer:
      'Ответ задачника: h = 11 м. Опора — тело-точка: вниз — нагрузка 150 т и вес опоры 8 т на метр высоты (9 + h); вверх — давление на дно 3,5·(6·1 + 1,8h) (вода 6 м и песок как жидкость) и трение по боковой поверхности 0,18·7h·(6 + 0,9h). Корень h = 10,98 м.',
    check: { points: [H_477] },
  },
];
