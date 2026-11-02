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

/** §2: задачи с ответом — значения неизвестных (тела, шарниры, стержни, катки). */
const T2: ContactProblem[] = [
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

/** §2: поиск размера по условию неопрокидывания (как 2.54 в positions.ts). */
const P2: PositionProblem[] = [
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

/** §3: параллельные силы. */
const T3: ContactProblem[] = [
  mk(
    '3.1',
    27,
    'Балка на двух опорах под равномерной нагрузкой',
    (ids) =>
      scheme(ids, (b) => {
        const [A, B] = b.body([
          [0, 0],
          [4, 0],
        ]);
        b.item({ type: 'pin', at: A, side: 'below' });
        b.item({ type: 'roller', at: B, side: 'below' });
        b.item({ type: 'dist', from: A, to: B, q1: 2, q2: 2, dir: 'down' });
      }),
    'Ответ задачника: R₁ = R₂ = pl/2. Взяты p = 2 н/м, l = 4 м: R₁ = R₂ = 4 н.',
    { Y_A: 4, R_B: 4 },
  ),
  mk(
    '3.2',
    27,
    'Груз на балке пролёта l — реакции опор',
    (ids) =>
      scheme(ids, (b) => {
        const [A, K, B] = b.body([
          [0, 0],
          [2, 0],
          [5, 0],
        ]);
        b.item({ type: 'pin', at: A, side: 'below' });
        b.item({ type: 'roller', at: B, side: 'below' });
        b.item({ type: 'weight', at: K, G: 10 });
      }),
    'Ответ задачника: R₁ = P(l − x)/l, R₂ = Px/l. Взяты P = 10, l = 5 м, x = 2 м: R₁ = 6, R₂ = 4.',
    { Y_A: 6, R_C: 4 },
  ),
  mk(
    '3.3',
    28,
    'Стержень на двух параллельных верёвках с грузом',
    (ids) =>
      scheme(ids, (b) => {
        const [A, E, M, B] = b.body([
          [0, 0],
          [0.25, 0],
          [0.5, 0],
          [1, 0],
        ]);
        b.item({ type: 'rod', at: A, angle: 90 });
        b.item({ type: 'rod', at: B, angle: 90 });
        b.item({ type: 'weight', at: E, G: 12 });
        b.item({ type: 'weight', at: M, G: 2 });
      }),
    'Ответ задачника: T_C = 10 кГ; T_D = 4 кГ. AB = 1 м, вес 2 кГ в середине C, груз P = 12 кГ в точке B (AE = 1/4 м книги); верёвки — стержни S_A и S_D.',
    { S_A: 10, S_D: 4 },
  ),
  mk(
    '3.4',
    28,
    'Два груза на балке: реакция A вдвое больше B (проверка x)',
    (ids) =>
      scheme(ids, (b) => {
        const [A, C, D, B] = b.body([
          [0, 0],
          [1, 0],
          [2, 0],
          [4, 0],
        ]);
        b.item({ type: 'pin', at: A, side: 'below' });
        b.item({ type: 'roller', at: B, side: 'below' });
        b.item({ type: 'weight', at: C, G: 200 });
        b.item({ type: 'weight', at: D, G: 100 });
      }),
    'Ответ задачника: x = 1 м. Обратная задача: грузы поставлены по ответу (C — 200 кГ в 1 м от A, D — 100 кГ ещё через 1 м); приложение подтверждает R_A = 200 = 2R_B. Свой вариант: передвиньте грузы и сравните реакции.',
    { Y_A: 200, R_D: 100 },
  ),
  mk(
    '3.5',
    28,
    'Трансмиссионный вал с тремя шкивами: равные реакции подшипников (проверка x)',
    (ids) =>
      scheme(ids, (b) => {
        const [A, P1, P2, P3, B] = b.body([
          [0, 0],
          [95, 0],
          [161, 0],
          [205, 0],
          [300, 0],
        ]);
        b.item({ type: 'pin', at: A, side: 'below' });
        b.item({ type: 'roller', at: B, side: 'below' });
        b.item({ type: 'weight', at: P1, G: 300 });
        b.item({ type: 'weight', at: P2, G: 500 });
        b.item({ type: 'weight', at: P3, G: 200 });
      }),
    'Ответ задачника: x = 139 см. AB = 300 см, P₁ = 300 кГ в 95 см от A, P₃ = 200 кГ в 95 см от B; P₂ = 500 кГ поставлен по ответу — в 139 см от B. Приложение подтверждает R_A = R_B = 500 кГ (размеры — в см).',
    { Y_A: 500, R_E: 500 },
  ),
  mk(
    '3.6',
    28,
    'Мостовой кран: давления на рельсы при положении тележки n = 1/4',
    (ids) =>
      scheme(ids, (b) => {
        const [A, C, M, B] = b.body([
          [0, 0],
          [2.5, 0],
          [5, 0],
          [10, 0],
        ]);
        b.item({ type: 'pin', at: A, side: 'below' });
        b.item({ type: 'roller', at: B, side: 'below' });
        b.item({ type: 'weight', at: C, G: 4 });
        b.item({ type: 'weight', at: M, G: 6 });
      }),
    'Ответ задачника: F_A = (7 − 4n) т, F_B = (3 + 4n) т, n = AC/AB. Взяты пролёт 10 м и n = 1/4 (тележка с грузом 4 т в 2,5 м от A, мост 6 т — в середине): F_A = 6 т, F_B = 4 т.',
    { Y_A: 6, R_D: 4 },
  ),
  mk(
    '3.17',
    31,
    'Подъёмный кран на балке: реакции опор',
    (ids) =>
      scheme(ids, (b) => {
        const [A, C, M, L, B] = b.body([
          [0, 0],
          [3, 0],
          [5, 0],
          [7, 0],
          [10, 0],
        ]);
        b.item({ type: 'pin', at: A, side: 'below' });
        b.item({ type: 'roller', at: B, side: 'below' });
        b.item({ type: 'weight', at: C, G: 5 });
        b.item({ type: 'weight', at: M, G: 3 });
        b.item({ type: 'weight', at: L, G: 1 });
      }),
    'Ответ задачника: R_A = 5,3 т; R_B = 3,7 т. Кран (5 т) — на оси CD в 3 м от A, груз 1 т — на вылете 4 м к B, балка 3 т — в середине. На балку на двух опорах передаются только вес крана и груза (точки D, E приложения — середина балки и вертикаль груза).',
    { Y_A: 5.3, R_E: 3.7 },
  ),
  mk(
    '3.21',
    32,
    'Предохранительный клапан: груз на рычаге',
    (ids) =>
      scheme(ids, (b) => {
        const [C, B, M, D] = b.body([
          [0, 0],
          [7, 0],
          [25, 0],
          [50, 0],
        ]);
        b.item({ type: 'pin', at: C, side: 'below' });
        b.item({ type: 'force', at: B, F: 11 * Math.PI * 9, ref: 'up', rot: 'cw', alpha: 0, unknown: false });
        b.item({ type: 'weight', at: M, G: 1 });
        b.item({ type: 'force', at: D, F: 1, ref: 'down', rot: 'cw', alpha: 0, unknown: true });
      }),
    'Ответ задачника: Q = 43 кГ. Давление на клапан диаметром 6 см при 11 кГ/см²: 11·π·3² = 311 кГ вверх в B (BC = 7 см); рычаг CD = 50 см, вес 1 кГ в середине; Q — неизвестная сила F2 в D.',
    { F2: 43 },
  ),
  mk(
    '3.24',
    32,
    'Рельсовый кран с противовесом: проверка Q и x в предельном положении',
    (ids) =>
      scheme(ids, (b) => {
        const Q = 100 / 3;
        const [K, B, A, C, L] = b.body([
          [-6.75, 0],
          [0, 0],
          [3, 0],
          [4.5, 0],
          [13, 0],
        ]);
        b.item({ type: 'roller', at: B, side: 'below' });
        b.item({ type: 'pin', at: A, side: 'below' });
        b.item({ type: 'weight', at: K, G: Q });
        b.item({ type: 'weight', at: C, G: 50 });
        b.item({ type: 'weight', at: L, G: 25 });
      }),
    'Ответ задачника: Q = 33,3 т; x = 6,75 м. Обратная задача с двумя условиями: с грузом кран не опрокидывается вокруг правого рельса A: Q(x + 3) ≥ 50·1,5 + 25·10; без груза — вокруг левого B: Qx ≤ 50·4,5. Отсюда 3Q = 100. Ответ книги получается, если центр тяжести C — в 1,5 м от правого рельса в сторону стрелы. Собрано предельное положение с грузом: противовес 33,3 т в 6,75 м за левым рельсом — давление на левый рельс B равно нулю, всё давление (108,3 т) — на правый.',
    { R_B: 0, Y_C: 100 / 3 + 75 },
  ),
  mk(
    '3.27',
    34,
    'Магнитная стрелка на проволоке: момент пары и угол закрутки',
    (ids) =>
      scheme(ids, (b) => {
        const [N, O, S] = b.body([
          [5 * cos(30), 5 * sin(30)],
          [0, 0],
          [-5 * cos(30), -5 * sin(30)],
        ]);
        b.item({ type: 'pin', at: O, side: 'below' });
        b.item({ type: 'moment', at: O, M: 1, dir: 'ccw', unknown: true });
        b.item({ type: 'force', at: N, F: 2, ref: 'right', rot: 'cw', alpha: 0, unknown: false });
        b.item({ type: 'force', at: S, F: 2, ref: 'left', rot: 'cw', alpha: 0, unknown: false });
      }),
    'Ответ задачника: 32°. Стрелка 10 см повёрнута на 30° от меридиана (ось x), на полюсы действуют силы по 2 мГ вдоль меридиана в противоположные стороны. Момент проволоки M = 2·10·sin 30° = 10 мГ·см — закрутка на 10/5 = 2° сверх поворота стрелки: 30° + 2° = 32°.',
    { 'M*': 10 },
  ),
  mk(
    '3.36',
    36,
    'Консольный мост из трёх частей: давления на опоры A и B',
    (ids) =>
      scheme(ids, (b) => {
        const [A, B, , , E, F] = b.body(
          [
            [0, 0],
            [50, 0],
            [70, 0],
            [90, 0],
            [110, 0],
            [160, 0],
          ],
          undefined,
          [2, 3],
        );
        b.item({ type: 'pin', at: A, side: 'below' });
        b.item({ type: 'roller', at: B, side: 'below' });
        b.item({ type: 'roller', at: E, side: 'below' });
        b.item({ type: 'roller', at: F, side: 'below' });
        b.item({ type: 'dist', from: A, to: F, q1: 6, q2: 6, dir: 'down' });
      }),
    'Ответ задачника: N_A = 102 т; N_B = 378 т. AC = DF = 70 м, CD = 20 м, AB = EF = 50 м, погонная нагрузка 6 т/м; C и D — шарниры. Точка F книги в приложении — H.',
    { Y_A: 102, R_B: 378 },
  ),
  mk(
    '3.38',
    37,
    'Разрезная балка с заделкой и краном: реакции',
    (ids) =>
      scheme(ids, (b) => {
        const [A, W1, , W2, B] = b.body(
          [
            [0, 0],
            [3, 0],
            [4, 0],
            [5, 0],
            [12, 0],
          ],
          undefined,
          [2],
        );
        const [K1, D, K2, L] = b.body([
          [3, 0],
          [4, 0],
          [5, 0],
          [8, 0],
        ]);
        b.item({ type: 'fixed', at: A, side: 'left' });
        b.item({ type: 'roller', at: B, side: 'below' });
        b.item({ type: 'weight', at: D, G: 5 });
        b.item({ type: 'weight', at: L, G: 1 });
        b.link({ type: 'contact', a: W1, b: K1, angle: 90, f: 0 });
        b.link({ type: 'contact', a: W2, b: K2, angle: 90, f: 0 });
      }),
    'Ответ задачника: R_A = 5,375 т; R_B = 0,625 т; M_A = 20,5 т·м. AC = 4 м, CB = 8 м, C — шарнир; кран (5 т на оси CD) стоит колёсами в 1 м по обе стороны от C, груз 1 т — на вылете 4 м к B. Кран — отдельное тело, колёса давят на балку (N_B = 1 т, N_D = 5 т). Опора B книги — точка E приложения.',
    { Y_A: 5.375, R_E: 0.625, M_A: 20.5 },
  ),
];

/** §3: обратные задачи — поиск размера или положения опоры. */
const P3: PositionProblem[] = [
  {
    id: '3.8 (82)',
    page: 29,
    title: 'Стержень на шарнире, конец оттянут нитью через блок — длина стержня',
    build: (ids) =>
      scheme(ids, (b) => {
        const x = 0.25;
        const [A, M, K, B] = b.body(
          [
            [0, 0],
            [x / 2, 0],
            [x - 0.2, 0],
            [x, 0],
          ],
          [
            [0, 1],
            [0, 2],
            [0, 3],
          ],
        );
        b.item({ type: 'pin', at: A, side: 'below' });
        b.item({ type: 'weight', at: M, G: 100 });
        b.item({ type: 'weight', at: K, G: 500 });
        b.item({ type: 'force', at: B, F: 150, ref: 'up', rot: 'cw', alpha: 0, unknown: false });
        const [s1, s2, s3] = b.s.segs.map((q) => q.id);
        b.s.search = search('x', 'm', 0.21, 1, [
          [s1, 'len', 'x/2'],
          [s2, 'len', 'x − 0,2'],
          [s3, 'len', 'x'],
        ]);
      }),
    answer:
      'Ответ задачника: x = 25 см. Параметр — длина стержня x: вес 100 н в середине, груз Q = 500 н в 20 см от конца B, нить тянет B вверх с силой P = 150 н. Участки отложены от шарнира A.',
    check: { points: [0.25] },
  },
  {
    id: '3.9 (83)',
    page: 29,
    title: 'Стержень с грузами, концы оттянуты вверх — где подпереть',
    build: (ids) =>
      scheme(ids, (b) => {
        const [A, C, D, M, E, F, B, O] = b.body(
          [
            [0, 0],
            [1, 0],
            [2, 0],
            [2.5, 0],
            [3, 0],
            [4, 0],
            [5, 0],
            [2.5, 0],
          ],
          [
            [0, 1],
            [1, 2],
            [2, 3],
            [3, 4],
            [4, 5],
            [5, 6],
            [0, 7],
          ],
        );
        b.item({ type: 'roller', at: O, side: 'below' });
        b.item({ type: 'force', at: A, F: 10, ref: 'up', rot: 'cw', alpha: 0, unknown: false });
        b.item({ type: 'force', at: B, F: 20, ref: 'up', rot: 'cw', alpha: 0, unknown: false });
        b.item({ type: 'weight', at: M, G: 20 });
        b.item({ type: 'weight', at: C, G: 5 });
        b.item({ type: 'weight', at: D, G: 10 });
        b.item({ type: 'weight', at: E, G: 15 });
        b.item({ type: 'weight', at: F, G: 20 });
        const s = b.s.segs.at(-1)!.id;
        b.s.search = search('s', 'm', 0.1, 4.9, [[s, 'len', 's']]);
      }),
    answer:
      'Ответ задачника: в середине. Параметр s — расстояние опоры от конца A: стержень 5 м весом 20 кГ, концы тянут вверх 10 и 20 кГ, грузы 5, 10, 15, 20 кГ через 1 м. Равновесие — при s = 2,5 м.',
    check: { points: [2.5] },
  },
  {
    id: '3.10 (84)',
    page: 29,
    title: 'Стержень с четырьмя грузами — точка подвеса',
    build: (ids) =>
      scheme(ids, (b) => {
        const [L, P1, M, P2, R, O] = b.body(
          [
            [0, 0],
            [1, 0],
            [1.5, 0],
            [2, 0],
            [3, 0],
            [1.75, 0],
          ],
          [
            [0, 1],
            [1, 2],
            [2, 3],
            [3, 4],
            [0, 5],
          ],
        );
        b.item({ type: 'rod', at: O, angle: 90 });
        b.item({ type: 'weight', at: L, G: 2 });
        b.item({ type: 'weight', at: P1, G: 3 });
        b.item({ type: 'weight', at: M, G: 6 });
        b.item({ type: 'weight', at: P2, G: 4 });
        b.item({ type: 'weight', at: R, G: 5 });
        const s = b.s.segs.at(-1)!.id;
        b.s.search = search('x', 'm', 0.1, 2.9, [[s, 'len', 'x']]);
      }),
    answer:
      'Ответ задачника: x = 1,75 м. Стержень 3 м весом 6 н, грузы 2, 3, 4, 5 н через 1 м (крайние — на концах); подвес — вертикальная нить на расстоянии x от левого конца.',
    check: { points: [1.75] },
  },
  {
    id: '3.26 (97)',
    page: 33,
    title: 'Кран на фундаменте: наименьшая глубина по условию неопрокидывания',
    build: (ids) =>
      scheme(ids, (b) => {
        const h = 8.5 / 8;
        const [E, O, A, F, C] = b.body([
          [-1, 0],
          [0, 0],
          [0.8, 0],
          [1, 0],
          [4, 0],
        ]);
        b.item({ type: 'roller', at: E, side: 'below', oneSided: true });
        b.item({ type: 'pin', at: F, side: 'below' });
        const g = b.item({ type: 'weight', at: O, G: 8 * h });
        b.item({ type: 'weight', at: A, G: 2.5 });
        b.item({ type: 'weight', at: C, G: 3 });
        b.s.search = search('h', 'm', 0.2, 3, [[g, 'G', '8h']]);
      }),
    answer:
      'Ответ задачника: 1,1 м. Основание 2 × 2 м, удельный вес 2 т/м³: вес фундамента 8h т на оси крана; кран 2,5 т в 0,8 м от оси, груз 3 т на вылете 4 м, опрокидывание вокруг ребра F (шарнир в 1 м от оси), ребро E — односторонний каток. Ответ книги получается, если центр тяжести крана A — со стороны груза: h ≥ 8,5/8 = 1,06 м (с другой стороны было бы 0,56 м).',
    check: { points: [8.5 / 8], ranges: [[8.5 / 8, 3]] },
  },
];

export const TASKS32: ContactProblem[] = [...T2, ...T3];
export const POSITIONS32: PositionProblem[] = [...P2, ...P3];
