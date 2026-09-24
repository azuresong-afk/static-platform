/**
 * Задачи из сборника И. В. Мещерского (изд. 34-е, 1975), которые решаются моделью «одно жёсткое тело»:
 * балки и рамы из горизонтальных и вертикальных участков. Ответы — из книги.
 *
 * Правила перевода:
 * - Единицы книги (кГ, т, н) сохраняются как числа: расчёт линеен, приложение подписывает их кН.
 * - Ответ приводится к правилу знаков приложения (X — вправо, Y — вверх, моменты — против часовой).
 *   Если в книге оси повёрнуты или дано «давление на опору», это указано в note.
 * - Точка приложения пары на ответ не влияет; если на чертеже она не задана размером, пара ставится в удобную точку.
 * - Для задач в общем виде (3.18, 3.19, 4.2) взяты конкретные числа, ответ вычислен по формуле книги.
 */
import type { Preset } from './presets';

export interface TextbookProblem {
  /** Номер задачи в книге (в скобках — номер в старых изданиях). */
  id: string;
  page: number;
  title: string;
  preset: Preset;
  /** Ожидаемые значения в правиле знаков приложения: ключ неизвестного → значение из книги. */
  answer: Record<string, number>;
  note?: string;
  /** Расхождение с книгой, подтверждённое ручным пересчётом: ключ → значение по расчёту. */
  discrepancy?: Record<string, { computed: number; why: string }>;
}

export const TEXTBOOK: TextbookProblem[] = [
  {
    id: '3.7 (81)',
    page: 29,
    title: 'Балка на двух опорах, конец оттянут тросом через блок',
    preset: {
      pts: [[0, 0], [2, 0], [3, 0], [5, 0], [7, 0], [10, 0]],
      items: [
        { type: 'roller', at: 1, side: 'below' },
        { type: 'roller', at: 4, side: 'below' },
        { type: 'force', at: 0, F: 300, ref: 'up', rot: 'cw', alpha: 0, unknown: false },
        { type: 'weight', at: 2, G: 800 },
        { type: 'weight', at: 3, G: 200 },
      ],
    },
    answer: { R_B: 300, R_E: 400 },
    note: 'Опоры C и D книги — точки B и E; натяжение троса Q = 300 — сила вверх в конце A.',
  },
  {
    id: '3.11 (85)',
    page: 29,
    title: 'Балка с шарниром у стены и подпоркой',
    preset: {
      pts: [[0, 0], [1.2, 0], [1.6, 0], [1.8, 0], [2, 0], [4, 0]],
      items: [
        { type: 'pin', at: 0, side: 'left' },
        { type: 'roller', at: 2, side: 'below' },
        { type: 'weight', at: 1, G: 160 },
        { type: 'weight', at: 3, G: 240 },
        { type: 'weight', at: 4, G: 320 },
      ],
    },
    answer: { X_A: 0, Y_A: -70, R_C: 790 },
    note: 'Длины в метрах (в книге — в сантиметрах). Ответ книги: 790 — вверх, 70 — вниз.',
  },
  {
    id: '3.12 (86)',
    page: 30,
    title: 'Балка, заложенная в стену (две опоры)',
    preset: {
      pts: [[0, 0], [2, 0], [3.5, 0], [4, 0]],
      items: [
        { type: 'roller', at: 2, side: 'below' },
        { type: 'roller', at: 3, side: 'above' },
        { type: 'weight', at: 0, G: 4 },
        { type: 'weight', at: 1, G: 0.5 },
      ],
    },
    answer: { R_C: 34, R_D: 29.5 },
    note: 'Точка A книги — C, точка B — D; стена давит в D сверху (опорная поверхность сверху), R_D = 29,5 — вниз.',
  },
  {
    id: '3.13 (87)',
    page: 30,
    title: 'Балка, заделанная в стену, с подшипником вала',
    preset: {
      pts: [[0, 0], [0.75, 0]],
      items: [
        { type: 'fixed', at: 0, side: 'left' },
        { type: 'weight', at: 1, G: 120 },
      ],
    },
    answer: { X_A: 0, Y_A: 120, M_A: 90 },
  },
  {
    id: '3.14 (88)',
    page: 30,
    title: 'Балка балкона: распределённая нагрузка и колонна',
    preset: {
      pts: [[0, 0], [1.5, 0]],
      items: [
        { type: 'fixed', at: 0, side: 'left' },
        { type: 'dist', from: 0, to: 1, q1: 200, q2: 200, dir: 'down' },
        { type: 'weight', at: 1, G: 200 },
      ],
    },
    answer: { X_A: 0, Y_A: 500, M_A: 525 },
  },
  {
    id: '3.15 (89)',
    page: 30,
    title: 'Консольная балка с парой сил',
    preset: {
      pts: [[0, 0], [1.5, 0], [3.5, 0], [4, 0]],
      items: [
        { type: 'pin', at: 0, side: 'below' },
        { type: 'roller', at: 2, side: 'below' },
        { type: 'moment', at: 1, M: 6, dir: 'cw', unknown: false },
        { type: 'weight', at: 3, G: 2 },
      ],
    },
    answer: { X_A: 0, Y_A: -2, R_C: 4 },
    note: 'Опора B книги — точка C. Пара на чертеже — по часовой стрелке.',
  },
  {
    id: '3.16 (90)',
    page: 30,
    title: 'Двухконсольная балка',
    preset: {
      pts: [[0, 0], [0.8, 0], [1.6, 0], [2.4, 0], [3.2, 0]],
      items: [
        { type: 'dist', from: 0, to: 1, q1: 2, q2: 2, dir: 'down' },
        { type: 'pin', at: 1, side: 'below' },
        { type: 'moment', at: 2, M: 0.8, dir: 'ccw', unknown: false },
        { type: 'roller', at: 3, side: 'below' },
        { type: 'weight', at: 4, G: 2 },
      ],
    },
    answer: { X_B: 0, Y_B: 1.5, R_D: 2.1 },
    note: 'Точки C, A, B, D книги — A, B, D, E. Пара (P, P) с плечом a: M = P·a = 0,8, против часовой.',
  },
  {
    id: '3.18',
    page: 31,
    title: 'Балка с нагрузкой q…2q…q',
    preset: {
      pts: [[0, 0], [1, 0], [2, 0], [4, 0]],
      items: [
        { type: 'pin', at: 1, side: 'below' },
        { type: 'roller', at: 3, side: 'below' },
        { type: 'dist', from: 0, to: 2, q1: 1, q2: 2, dir: 'down' },
        { type: 'dist', from: 2, to: 3, q1: 2, q2: 1, dir: 'down' },
      ],
    },
    answer: { X_B: 0, Y_B: 4, R_D: 2 },
    note: 'Взято l = 4, q = 1: R_D = ql = 4, R_B = 0,5ql = 2 (опоры D и B книги — B и D).',
  },
  {
    id: '3.19',
    page: 31,
    title: 'Балка с треугольной и равномерной нагрузкой',
    preset: {
      pts: [[0, 0], [2, 0], [6, 0]],
      items: [
        { type: 'pin', at: 1, side: 'below' },
        { type: 'roller', at: 2, side: 'below' },
        { type: 'dist', from: 0, to: 1, q1: 0, q2: 2, dir: 'down' },
        { type: 'dist', from: 1, to: 2, q1: 2, q2: 2, dir: 'down' },
      ],
    },
    answer: { X_B: 0, Y_B: 19 / 3, R_C: 11 / 3 },
    note: 'Взято q = 2, a = 2, b = 4: R_B = q/6·(3a + 3b + a²/b) = 19/3, R_C = q/6·(3b − a²/b) = 11/3.',
  },
  {
    id: '4.2 (114)',
    page: 38,
    title: 'Балка крана на шарнире и тяге',
    preset: {
      pts: [[0, 0], [1.5, 0], [4, 0]],
      items: [
        { type: 'pin', at: 0, side: 'left' },
        { type: 'rod', at: 2, angle: 330 },
        { type: 'weight', at: 1, G: 10 },
      ],
    },
    answer: { S_C: -7.5 },
    note: 'Взято l = 4, x = 1,5, α = 30°, P = 10: T = Px/(l·sin α) = 7,5. Тяга идёт от B вверх-влево; «+» у стержня — сжатие, поэтому S = −T.',
  },
  {
    id: '4.16 (128)',
    page: 41,
    title: 'Шлюпбалка: подпятник и подшипник',
    preset: {
      pts: [[0, 0], [0, 1.8], [0, 2.8], [2.4, 2.8]],
      items: [
        { type: 'pin', at: 0, side: 'below' },
        { type: 'roller', at: 1, side: 'left' },
        { type: 'weight', at: 3, G: 480 },
      ],
    },
    answer: { X_A: 640, Y_A: 480, R_B: -640 },
    note: 'В книге — давление шлюпбалки на опоры (X_A = −640, Y_A = −480, X_B = 640); реакции противоположны.',
  },
  {
    id: '4.17 (129)',
    page: 41,
    title: 'Литейный кран на вертикальной оси',
    preset: {
      pts: [[0, 0], [0, 5], [2, 5], [5, 5]],
      items: [
        { type: 'pin', at: 0, side: 'below' },
        { type: 'roller', at: 1, side: 'left' },
        { type: 'weight', at: 2, G: 2 },
        { type: 'weight', at: 3, G: 3 },
      ],
    },
    answer: { X_A: 3.8, Y_A: 5, R_B: -3.8 },
    note: 'Подпятник N — точка A, подшипник M — точка B.',
  },
  {
    id: '4.25',
    page: 44,
    title: 'Балка с силой под углом и парой сил',
    preset: {
      pts: [[0, 0], [2, 0], [3, 0], [5, 0]],
      items: [
        { type: 'pin', at: 0, side: 'below' },
        { type: 'roller', at: 2, side: 'below' },
        { type: 'moment', at: 1, M: 6, dir: 'cw', unknown: false },
        { type: 'force', at: 3, F: 4, ref: 'left', rot: 'ccw', alpha: 60, unknown: false },
      ],
    },
    answer: { X_A: 2, Y_A: -4.32, R_C: 7.78 },
    note: 'Опора B книги — точка C.',
  },
  {
    id: '4.26',
    page: 44,
    title: 'Балка с распределённой нагрузкой и двумя силами',
    preset: {
      pts: [[0, 0], [2, 0], [3, 0], [4, 0], [6, 0]],
      items: [
        { type: 'dist', from: 0, to: 1, q1: 3, q2: 3, dir: 'down' },
        { type: 'roller', at: 1, side: 'below' },
        { type: 'weight', at: 2, G: 8 },
        { type: 'force', at: 3, F: 6, ref: 'right', rot: 'cw', alpha: 45, unknown: false },
        { type: 'pin', at: 4, side: 'below' },
      ],
    },
    answer: { X_E: -4.2, Y_E: 2.6, R_B: 15.6 },
    note: 'В книге ось x вертикальна, ось y направлена влево: X книги — наш Y, Y книги = −X. Опора A книги — точка E.',
  },
  {
    id: '4.27',
    page: 45,
    title: 'Консоль: сила под углом и пара',
    preset: {
      pts: [[0, 0], [1.5, 0], [2, 0]],
      items: [
        { type: 'fixed', at: 0, side: 'left' },
        { type: 'moment', at: 1, M: 3, dir: 'ccw', unknown: false },
        { type: 'force', at: 2, F: 2, ref: 'left', rot: 'ccw', alpha: 60, unknown: false },
      ],
    },
    answer: { X_A: 1, Y_A: 1.73, M_A: 0.47 },
  },
  {
    id: '4.28',
    page: 45,
    title: 'Консоль: распределённая нагрузка, сила и пара',
    preset: {
      pts: [[0, 0], [3, 0], [5, 0]],
      items: [
        { type: 'fixed', at: 0, side: 'left' },
        { type: 'dist', from: 0, to: 1, q1: 1.5, q2: 1.5, dir: 'down' },
        { type: 'moment', at: 1, M: 2, dir: 'cw', unknown: false },
        { type: 'force', at: 2, F: 4, ref: 'left', rot: 'cw', alpha: 45, unknown: false },
      ],
    },
    answer: { X_A: 2.8, Y_A: 1.7, M_A: -5.35 },
    discrepancy: {
      M_A: {
        computed: -(4 * Math.SQRT1_2 * 5 - 1.5 * 3 * 1.5 - 2),
        why: 'M_A = 1,5·3·1,5 + 2 − 4·sin45°·5 = −5,39; X и Y совпадают с книгой, значит чертёж прочитан верно. В книге, по-видимому, опечатка или грубое округление.',
      },
    },
  },
  {
    id: '4.29',
    page: 45,
    title: 'Консоль: распределённая нагрузка, сила и две пары',
    preset: {
      pts: [[0, 0], [3, 0], [6, 0], [10, 0]],
      items: [
        { type: 'dist', from: 0, to: 1, q1: 3, q2: 3, dir: 'down' },
        { type: 'moment', at: 0, M: 2, dir: 'ccw', unknown: false },
        { type: 'moment', at: 2, M: 3, dir: 'cw', unknown: false },
        { type: 'force', at: 2, F: 4, ref: 'left', rot: 'ccw', alpha: 45, unknown: false },
        { type: 'fixed', at: 3, side: 'right' },
      ],
    },
    answer: { X_D: 2.8, Y_D: 11.8, M_D: -86.8 },
    note: 'В книге ось x вертикальна, ось y направлена влево: X книги — наш Y, Y книги = −X. Заделка — точка D.',
  },
  {
    id: '4.30',
    page: 45,
    title: 'Вертикальная консоль с треугольной нагрузкой',
    preset: {
      pts: [[0, 0], [0, 12]],
      items: [
        { type: 'fixed', at: 0, side: 'below' },
        { type: 'dist', from: 0, to: 1, q1: 1.5, q2: 0, dir: 'right' },
        { type: 'moment', at: 1, M: 4, dir: 'cw', unknown: false },
      ],
    },
    answer: { X_A: -9, Y_A: 0, M_A: 40 },
  },
  {
    id: '4.31',
    page: 45,
    title: 'Консоль: нагрузка по закону треугольника и трапеции',
    preset: {
      pts: [[0, 0], [0.5, 0], [4.5, 0], [7.5, 0]],
      items: [
        { type: 'force', at: 0, F: 5, ref: 'up', rot: 'cw', alpha: 30, unknown: false },
        { type: 'moment', at: 1, M: 4, dir: 'ccw', unknown: false },
        { type: 'dist', from: 0, to: 2, q1: 0, q2: 4, dir: 'down' },
        { type: 'dist', from: 2, to: 3, q1: 4, q2: 2, dir: 'down' },
        { type: 'fixed', at: 3, side: 'right' },
      ],
    },
    answer: { X_D: -2.5, Y_D: 13.7, M_D: -27 },
    note: 'В книге ось x вертикальна, ось y направлена влево: X книги — наш Y, Y книги = −X. Пик нагрузки 2q = 4 т/м.',
  },
];

/**
 * Составные конструкции с внутренними шарнирами (этап 4). Взаимные реакции в шарнире в книге даны со знаком «±»;
 * здесь — значение для части, к которой шарнир присоединён второй (по порядку обхода), в правиле знаков приложения.
 */
export const TEXTBOOK_COMPOSITE: TextbookProblem[] = [
  {
    id: '4.32',
    page: 46,
    title: 'Составная балка: шарнир D',
    preset: {
      pts: [[0, 0], [8, 0], [10, 0], [15, 0], [20, 0]],
      hinges: [3],
      items: [
        { type: 'pin', at: 0, side: 'below' },
        { type: 'force', at: 1, F: 4, ref: 'right', rot: 'cw', alpha: 45, unknown: false },
        { type: 'roller', at: 2, side: 'below' },
        { type: 'roller', at: 4, side: 'below' },
        { type: 'dist', from: 2, to: 4, q1: 2, q2: 2, dir: 'down' },
      ],
    },
    answer: { X_A: -2.8, Y_A: -4.4, R_C: 22.2, R_E: 5, X_D: 0, Y_D: 5 },
    note: 'Опоры B и C книги — точки C и E. Нагрузка q проходит через шарнир D и делится им на две части.',
  },
  {
    id: '4.33',
    page: 46,
    title: 'Составная балка с консолями: шарнир D',
    preset: {
      pts: [[0, 0], [4, 0], [8, 0], [12, 0], [16, 0], [20, 0], [24, 0]],
      hinges: [4],
      items: [
        { type: 'dist', from: 0, to: 1, q1: 1.75, q2: 1.75, dir: 'down' },
        { type: 'pin', at: 1, side: 'below' },
        { type: 'force', at: 2, F: 6, ref: 'left', rot: 'ccw', alpha: 60, unknown: false },
        { type: 'roller', at: 3, side: 'below' },
        { type: 'roller', at: 5, side: 'below' },
        { type: 'weight', at: 6, G: 5 },
      ],
    },
    answer: { X_B: 3, Y_B: 13.8, R_D: -6.6, R_H: 10, X_E: 0, Y_E: -5 },
    note: 'Опоры A, B, C и шарнир D книги — точки B, D, H и E.',
  },
  {
    id: '4.34 (143)',
    page: 46,
    title: 'Трёхшарнирная арка: мост из двух частей',
    preset: {
      pts: [[0, 0], [0, 4], [1, 4], [4, 4], [5, 4], [9, 4], [10, 4], [10, 0]],
      hinges: [4],
      items: [
        { type: 'pin', at: 0, side: 'below' },
        { type: 'pin', at: 7, side: 'below' },
        { type: 'weight', at: 2, G: 4 },
        { type: 'weight', at: 3, G: 2 },
        { type: 'weight', at: 5, G: 4 },
      ],
    },
    answer: { X_A: 2, Y_A: 5.2, X_L: -2, Y_L: 4.8, X_E: 2, Y_E: -0.8 },
    note: 'Арка заменена ломаной рамой с теми же точками опор, шарнира и нагрузок — для статики это то же самое. Опоры B, C и шарнир A книги — точки A, L и E.',
  },
  {
    id: '4.38 (150)',
    page: 47,
    title: 'Трёхшарнирная арка мастерской с мостовым краном',
    preset: {
      pts: [[0, 0], [0, 5], [0, 12], [1.8, 12], [2, 12], [8, 12], [14, 12], [14.2, 12], [16, 12], [16, 0]],
      hinges: [5],
      items: [
        { type: 'pin', at: 0, side: 'below' },
        { type: 'pin', at: 9, side: 'below' },
        { type: 'force', at: 1, F: 1.2, ref: 'right', rot: 'ccw', alpha: 0, unknown: false },
        { type: 'weight', at: 3, G: 1.2 },
        { type: 'weight', at: 4, G: 6 },
        { type: 'weight', at: 6, G: 6 },
        { type: 'weight', at: 7, G: 0.8 },
      ],
    },
    answer: { X_A: 0.2, Y_A: 6.78, X_O: -1.4, Y_O: 7.22, X_H: 1.4, Y_H: -0.42 },
    note:
      'Давления рельсов на арку найдены из равновесия моста крана: балка 1,2 т посередине пролёта между рельсами, кран 0,8 т на четверти пролёта от левого рельса: слева 0,6 + 0,6 = 1,2 т, справа 0,6 + 0,2 = 0,8 т. Опоры A, B и шарнир C книги — точки A, O и H.',
  },
  {
    id: '3.37 (111)',
    page: 37,
    title: 'Консольный мост: главная ферма и две боковые на шарнирах',
    preset: {
      pts: [[0, 0], [20, 0], [35, 0], [85, 0], [100, 0], [120, 0]],
      hinges: [1, 4],
      items: [
        { type: 'roller', at: 0, side: 'below' },
        { type: 'pin', at: 2, side: 'below' },
        { type: 'roller', at: 3, side: 'below' },
        { type: 'roller', at: 5, side: 'below' },
        { type: 'dist', from: 0, to: 1, q1: 1, q2: 1, dir: 'down' },
        { type: 'dist', from: 1, to: 4, q1: 1.5, q2: 1.5, dir: 'down' },
        { type: 'dist', from: 4, to: 5, q1: 1, q2: 1, dir: 'down' },
        { type: 'dist', from: 3, to: 5, q1: 3, q2: 3, dir: 'down' },
      ],
    },
    answer: { R_A: 10, X_C: 0, Y_C: 54.25, R_D: 160.75, R_H: 40 },
    note: 'Опоры C, E, F, D книги — точки A, C, D, H; шарниры A и B — точки B и E. Поезд (3 т/м на F–D) проходит через шарнир.',
  },
  {
    id: '4.37 (149)',
    page: 47,
    title: 'Мост из двух балок на шарнире и четырёх стержнях',
    preset: {
      pts: [[0, 0], [4, 0], [6, 0], [8, 0], [10, 0], [16, 0]],
      hinges: [3],
      items: [
        { type: 'rod', at: 0, angle: 90 },
        { type: 'rod', at: 2, angle: 60 },
        { type: 'rod', at: 4, angle: 120 },
        { type: 'rod', at: 5, angle: 90 },
        { type: 'weight', at: 1, G: 15 },
      ],
    },
    answer: { S_A: 6.25, S_C: 5.77, S_E: 5.77, S_H: -1.25, X_D: 2.89, Y_D: -3.75 },
    note:
      'В книге «+» у стержня — растяжение (S1 = −6,25; S2 = S3 = −5,77; S4 = 1,25), в приложении «+» — сжатие, поэтому знаки противоположны. Стержни 1–4 — в точках A, C, E, H; шарнир A книги — точка D.',
  },
];
