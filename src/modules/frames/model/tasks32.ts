/**
 * Пункт 32: готовые задачи «Балок и рам» — Мещерский §2–4 (тело на шарнире и стержне, балки и рамы, составные
 * конструкции) и поиск размера по условию неопрокидывания. Схемы строятся по координатам (Scheme из contacts.ts).
 *
 * Правила перевода — как в textbook.ts и contacts.ts:
 * - Единицы книги (кГ, т, н) сохраняются как числа; ответ — в правиле знаков приложения (X вправо, Y вверх, моменты
 *   против часовой стрелки). Ключ «X_A,Y_A» в проверке — модуль полной реакции шарнира.
 * - Точки приложение называет по порядку (A, B, C…); где буквы не совпадают с книгой, соответствие — в пояснении.
 * - Задачи в общем виде — с конкретными числами, ответ вычислен по формуле книги.
 * - Обратные задачи (найти угол или точку крепления) собраны проверкой: положение взято из ответа книги, приложение
 *   подтверждает данные условия.
 */
import type { IdGen } from '../../../shared/ids';
import { scheme, type ContactProblem } from './contacts';
import type { PositionProblem } from './positions';
import type { Search, SearchBind, SearchUnit, Structure } from './types';

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const cos = (d: number) => Math.cos(rad(d)),
  sin = (d: number) => Math.sin(rad(d));
const R2 = Math.SQRT2;

const search = (name: string, unit: SearchUnit, min: number, max: number, bind: [string, string, string][]): Search => ({
  name,
  unit,
  min,
  max,
  bind: bind.map(([ref, field, expr]): SearchBind => ({ ref, field, expr })),
});

const mk = (
  id: string,
  page: number,
  title: string,
  build: (ids?: IdGen) => Structure,
  answer: string,
  vals: Record<string, number>,
  relTol?: number,
): ContactProblem => ({
  id,
  book: 'mesh',
  page,
  title,
  build,
  answer,
  check: { vals },
  ...(relTol ? { relTol } : {}),
});

/** Задачи с ответом — значения неизвестных (тела, шарниры, стержни, катки). */
export const TASKS32: ContactProblem[] = [
  mk(
    '2.26',
    15,
    'Стержень на шарнире у стены, трос под 30° к стержню — реакция шарнира',
    (ids) =>
      scheme(ids, (b) => {
        const [A, B, C] = b.body(
          [
            [0, 0],
            [cos(-30), sin(-30)],
            [0.5 * cos(-30), 0.5 * sin(-30)],
          ],
          [
            [0, 2],
            [2, 1],
          ],
        );
        b.item({ type: 'pin', at: A, side: 'left' });
        b.item({ type: 'weight', at: C, G: 2 });
        b.item({ type: 'rod', at: B, angle: 120 });
      }),
    'Ответ задачника: R = 1 кГ, угол (R, AC) = 60°. Стержень AB длиной 1 м — под 60° к вертикали вниз от стены, трос BC — под 30° к стержню (под 120° к оси x); в приложении B — середина стержня, C — его конец. Реакция шарнира X_A = 0,866, Y_A = 0,5: R = 1 кГ под 30° к горизонту, то есть 60° к вертикали AC.',
    { 'X_A,Y_A': 1 },
  ),
  mk(
    '2.27',
    15,
    'Брус упирается в гладкую стену и держится тросом — натяжение и реакция стены',
    (ids) =>
      scheme(ids, (b) => {
        const [A, B, C] = b.body(
          [
            [0, 0],
            [R2, -R2],
            [R2 / 2, -R2 / 2],
          ],
          [
            [0, 2],
            [2, 1],
          ],
        );
        b.item({ type: 'roller', at: A, side: 'left' });
        b.item({ type: 'weight', at: C, G: 5 });
        b.item({ type: 'rod', at: B, angle: deg(Math.atan2(2 * R2, -R2)) });
      }),
    'Ответ задачника: AC = AD = 1,41 м; T = 5,6 кГ; R = 2,5 кГ. Обратная задача: точку крепления троса находим из того, что три силы сходятся (на вертикали центра тяжести на уровне A), — трос идёт от B к точке стены на 1,41 м выше A; приложение подтверждает T и R. B в приложении — середина бруса, C — его конец B (усилие троса S_C).',
    { S_C: 5.6, R_A: 2.5 },
  ),
  mk(
    '2.28',
    16,
    'Оконная рама на шарнире опирается краем на уступ паза',
    (ids) =>
      scheme(ids, (b) => {
        const [A, B, C] = b.body(
          [
            [0, 0],
            [2 * cos(225), 2 * sin(225)],
            [cos(225), sin(225)],
          ],
          [
            [0, 2],
            [2, 1],
          ],
        );
        b.item({ type: 'pin', at: A, side: 'above' });
        b.item({ type: 'weight', at: C, G: 89 });
        b.item({ type: 'roller', at: B, side: 'tilt', angle: 135 });
      }),
    'Ответ задачника: R_A = 70,4 кГ; R_B = 31,5 кГ. Рама AB — под 45°, вес 89 кГ в середине C; уступ давит на край B перпендикулярно раме. В приложении середина рамы — B, край — C (R_C).',
    { 'X_A,Y_A': 70.4, R_C: 31.5 },
  ),
  mk(
    '2.29',
    16,
    'Балка на шарнире и стержне CD под 45° — реакции',
    (ids) =>
      scheme(ids, (b) => {
        const [A, B, C] = b.body(
          [
            [0, 0],
            [3, 0],
            [2, 0],
          ],
          [
            [0, 2],
            [2, 1],
          ],
        );
        b.item({ type: 'pin', at: A, side: 'below' });
        b.item({ type: 'rod', at: C, angle: 45 });
        b.item({ type: 'force', at: B, F: 5, ref: 'down', rot: 'cw', alpha: 0, unknown: false });
      }),
    'Ответ задачника: R_A = 7,9 т; R_D = 10,6 т В приложении: B — точка C книги (стержень CD, усилие S_B), C — конец B балки.',
    { 'X_A,Y_A': 7.9, S_B: 10.6 },
  ),
  mk(
    '2.30',
    16,
    'Балка на шарнире и катке на наклонной плоскости, сила под 45° в середине',
    (ids) =>
      scheme(ids, (b) => {
        const [A, B, C] = b.body(
          [
            [0, 0],
            [4, 0],
            [2, 0],
          ],
          [
            [0, 2],
            [2, 1],
          ],
        );
        b.item({ type: 'pin', at: A, side: 'below' });
        b.item({ type: 'roller', at: B, side: 'tilt', angle: 135 });
        b.item({ type: 'force', at: C, F: 2, ref: 'left', rot: 'ccw', alpha: 45, unknown: false });
      }),
    'Ответ задачника: а) R_A = 1,58 т, R_B = 0,71 т; б) R_A = 2,24 т, R_B = 1 т. Собран случай б: каток на плоскости под 45° (реакция под 135° к оси x). Случай а — каток на горизонтальной плоскости (смените опору на каток снизу). В приложении середина — B, каток — C.',
    { 'X_A,Y_A': 2.24, R_C: 1 },
  ),
  mk(
    '2.31',
    16,
    'Балка у стены на вертикальном стержне CD, сила F под 60° на конце',
    (ids) =>
      scheme(ids, (b) => {
        const [A, B, C] = b.body(
          [
            [3, 0],
            [0, 0],
            [1, 0],
          ],
          [
            [0, 2],
            [2, 1],
          ],
        );
        b.item({ type: 'pin', at: A, side: 'right' });
        b.item({ type: 'rod', at: C, angle: 90 });
        b.item({ type: 'force', at: B, F: 3, ref: 'down', rot: 'ccw', alpha: 30, unknown: false });
      }),
    'Ответ задачника: а) S = 3,9 т, Q = 1,98 т; б) S = 3,9 т, Q = 1,98 т. Собран чертёж а: стена справа (шарнир A), стержень CD подвешен к потолку в 2 м от стены, сила F = 3 т под 60° к горизонту на конце B в 1 м от C. Давление на стену Q равно реакции шарнира A; в приложении стержень — в точке B (S_B), конец балки — C.',
    { S_B: 3.9, 'X_A,Y_A': 1.98 },
  ),
  mk(
    '2.33',
    17,
    'П-образная рама: горизонтальная сила в верхнем углу',
    (ids) =>
      scheme(ids, (b) => {
        const [A, B, , D] = b.body([
          [0, 0],
          [0, 1],
          [2, 1],
          [2, 0],
        ]);
        b.item({ type: 'pin', at: A, side: 'below' });
        b.item({ type: 'roller', at: D, side: 'below' });
        b.item({ type: 'force', at: B, F: 10, ref: 'right', rot: 'cw', alpha: 0, unknown: false });
      }),
    'Ответ задачника: R_A = P√5/2, R_D = P/2. Взяты P = 10, a = 1 м (пролёт 2a): R_A = 11,18, R_D = 5.',
    { 'X_A,Y_A': 5 * Math.sqrt(5), R_D: 5 },
  ),
  mk(
    '2.40',
    19,
    'Трёхшарнирная рама: горизонтальная сила в верхнем углу',
    (ids) =>
      scheme(ids, (b) => {
        const [A, K, , , B] = b.body(
          [
            [0, 0],
            [0, 1],
            [1, 1],
            [2, 1],
            [2, 0],
          ],
          undefined,
          [2],
        );
        b.item({ type: 'pin', at: A, side: 'below' });
        b.item({ type: 'pin', at: B, side: 'below' });
        b.item({ type: 'force', at: K, F: 10, ref: 'right', rot: 'cw', alpha: 0, unknown: false });
      }),
    'Ответ задачника: R_A = R_B = P√2/2. Взяты P = 10, a = 1 м: R_A = R_B = 7,07. Шарнир C — в середине ригеля, опора B книги — точка E приложения.',
    { 'X_A,Y_A': 5 * R2, 'X_E,Y_E': 5 * R2 },
  ),
  mk(
    '2.47',
    21,
    'Оконная рама открывается шнуром через блок — натяжение при φ = 30°',
    (ids) =>
      scheme(ids, (b) => {
        const [A, B, C] = b.body(
          [
            [0, 0],
            [cos(150), sin(150)],
            [0.5 * cos(150), 0.5 * sin(150)],
          ],
          [
            [0, 2],
            [2, 1],
          ],
        );
        b.item({ type: 'pin', at: A, side: 'below' });
        b.item({ type: 'weight', at: C, G: 100 });
        b.item({ type: 'rod', at: B, angle: 30 });
      }),
    'Ответ задачника: T = 100 sin(45° − φ/2) кГ; T_max = 70,7 кГ при φ = 0, T_min = 0 при φ = 90°. Взят φ = 30°: T = 100 sin 30° = 50 кГ. AB = AC = 1, блок C над A; шнур BC — стержень под 30° к оси x. В приложении B — середина рамы, C — её край (натяжение S_C).',
    { S_C: 50 },
  ),
  mk(
    '2.52',
    22,
    'Пластинка на горизонтальной оси отклонена ветром на 18°',
    (ids) =>
      scheme(ids, (b) => {
        const [A, , C] = b.body(
          [
            [0, 0],
            [cos(-72), sin(-72)],
            [0.5 * cos(-72), 0.5 * sin(-72)],
          ],
          [
            [0, 2],
            [2, 1],
          ],
        );
        b.item({ type: 'pin', at: A, side: 'above' });
        b.item({ type: 'weight', at: C, G: 5 });
        b.item({ type: 'force', at: C, F: 1, ref: 'right', rot: 'ccw', alpha: 18, unknown: true });
      }),
    'Ответ задачника: 5 sin 18° = 1,55 кГ. Пластинка (в разрезе — отрезок AB) отклонена на 18° от вертикали; равнодействующая давления ветра F приложена в середине (B в приложении) перпендикулярно пластинке, её модуль неизвестен.',
    { F: 1.55 },
  ),
];

/** Поиск размера по условию неопрокидывания (как 2.54 в positions.ts). */
export const POSITIONS32: PositionProblem[] = [
  {
    id: '2.53 (62)',
    page: 23,
    title: 'Основание концевой цепи моста: длина по условию неопрокидывания',
    build: (ids) =>
      scheme(ids, (b) => {
        // Сечение 5 × 5 м, удельный вес 2,5 т/м³: вес G = 5·5·a·2,5 = 62,5a т; цепь по диагонали CB, T = 100 т.
        const a = (100 * 5 * Math.SQRT1_2) / (2.5 * 62.5);
        const [C, D, O] = b.body([
          [0, 0],
          [5, 0],
          [2.5, 2.5],
        ]);
        b.item({ type: 'roller', at: C, side: 'below', oneSided: true });
        b.item({ type: 'pin', at: D, side: 'below' });
        const g = b.item({ type: 'weight', at: O, G: 62.5 * a });
        b.item({ type: 'force', at: C, F: 100, ref: 'right', rot: 'ccw', alpha: 45, unknown: false });
        b.s.search = search('a', 'm', 0.5, 5, [[g, 'G', '62,5a']]);
      }),
    answer:
      'Ответ задачника: a ≥ 2,3 м. Сечение ABDC 5 × 5 м, удельный вес кладки 2,5 т/м³: вес G = 62,5a т в центре сечения. Цепь заделана в точке C (A в приложении) и тянет вдоль диагонали CB под 45° с силой 100 т. Опрокидывание — вокруг ребра D (B в приложении: шарнир), ребро C — односторонний каток. Равновесие возможно при a ≥ 2,263 м (в книге округлено до 2,3).',
    check: { points: [(100 * 5 * Math.SQRT1_2) / (2.5 * 62.5)], ranges: [[(100 * 5 * Math.SQRT1_2) / (2.5 * 62.5), 5]] },
  },
  {
    id: '2.55 (64)',
    page: 23,
    title: 'Водонапорная башня: расстояние между опорами по условию неопрокидывания',
    build: (ids) =>
      scheme(ids, (b) => {
        // Ветер: 125 кГ/м² на 6 × 4 м² = 3 т на высоте 17 + 3 = 20 м; вес 8 т.
        const L = 15;
        const [A, M, B, K] = b.body(
          [
            [0, 0],
            [L / 2, 0],
            [L, 0],
            [L / 2, 20],
          ],
          [
            [0, 1],
            [1, 2],
            [1, 3],
          ],
        );
        const [s1, s2] = b.segsOf([A, M, B]);
        b.item({ type: 'roller', at: A, side: 'below', oneSided: true });
        b.item({ type: 'pin', at: B, side: 'below' });
        b.item({ type: 'weight', at: M, G: 8 });
        b.item({ type: 'force', at: K, F: 3, ref: 'right', rot: 'cw', alpha: 0, unknown: false });
        b.s.search = search('l', 'm', 2, 40, [
          [s1, 'len', 'l/2'],
          [s2, 'len', 'l/2'],
        ]);
      }),
    answer:
      'Ответ задачника: AB ≥ 15 м. Давление ветра 125 кГ/м² на проекцию резервуара 6 × 4 м² — 3 т на высоте 17 + 3 = 20 м; вес башни 8 т — посередине между опорами. Опрокидывание — вокруг опоры B (шарнир), опора A — односторонний каток. Столбы и точка приложения веса на ответ не влияют.',
    check: { points: [15], ranges: [[15, 40]] },
  },
];
