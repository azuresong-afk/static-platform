/**
 * Задачи на контакт тел в статике (Мещерский §2–4, Яблонский С.5, С.9): тело опирается на другое тело, клин,
 * нить через блок между телами, замкнутые контуры с односторонними связями. Схемы строятся по координатам точек:
 * первое тело — основное, остальные ставятся от его первой точки (Node.place).
 *
 * Правила перевода:
 * - Единицы книги (кГ, т, н) сохраняются как числа; ответ приводится к правилу знаков приложения.
 * - Тела, которые книга считает материальными точками (бруски, клинья, цилиндры, силы на которые сходятся в центре), —
 *   тела-точки. Их положение на чертеже условно, касание тела-точки может быть в стороне от неё.
 * - Неподвижные блоки и точки крепления нитей — тела-точки с шарнирно-неподвижной опорой.
 * - Задачи в общем виде (2.42, 4.57) — с конкретными числами, ответ вычислен по формуле книги.
 */
import { createIdGen, type IdGen } from '../../../shared/ids';
import { normAng } from './constants';
import type { DistributiveOmit, Item, Link, Seg, Structure } from './types';

type P = [number, number];
type ItemSpec = DistributiveOmit<Item, 'id'>;
type LinkSpec = DistributiveOmit<Link, 'id'>;

/** Построитель схемы из нескольких тел по координатам. */
export class Scheme {
  readonly s: Structure = { nodes: [], segs: [], items: [], links: [] };
  private origin: { id: string; p: P } | null = null;
  constructor(private ids: IdGen) {}

  /**
   * Тело: точки по координатам, участки — пары индексов (по умолчанию ломаная по порядку), шарниры — индексы точек.
   * Первая точка — начало тела; участки должны образовывать дерево от неё (a — ближе к началу).
   */
  body(pts: P[], segs?: [number, number][], hinges: number[] = []): string[] {
    const ids = pts.map(() => this.ids.node());
    ids.forEach((id, i) => {
      const n: Structure['nodes'][number] = { id };
      if (hinges.includes(i)) n.hinge = true;
      if (i === 0 && this.origin) n.place = { from: this.origin.id, dx: pts[0][0] - this.origin.p[0], dy: pts[0][1] - this.origin.p[1] };
      this.s.nodes.push(n);
    });
    if (!this.origin) this.origin = { id: ids[0], p: pts[0] };
    for (const [i, j] of segs ?? pts.slice(1).map((_, k) => [k, k + 1] as [number, number]))
      this.s.segs.push(seg(this.ids.seg(), ids[i], ids[j], pts[i], pts[j]));
    return ids;
  }
  item(it: ItemSpec): string {
    const id = this.ids.item();
    this.s.items.push({ ...it, id } as Item);
    return id;
  }
  link(l: LinkSpec): string {
    const id = this.ids.item();
    this.s.links!.push({ ...l, id } as Link);
    return id;
  }
  /** Участки тела по порядку (для формул поиска положения). */
  segsOf(nodes: string[]): string[] {
    return this.s.segs.filter((q) => nodes.includes(q.a) && nodes.includes(q.b)).map((q) => q.id);
  }
}

function seg(id: string, a: string, b: string, A: P, B: P): Seg {
  const dx = B[0] - A[0],
    dy = B[1] - A[1];
  if (Math.abs(dy) < 1e-12) return { id, a, b, dir: dx > 0 ? 'r' : 'l', len: Math.abs(dx) };
  if (Math.abs(dx) < 1e-12) return { id, a, b, dir: dy > 0 ? 'u' : 'd', len: Math.abs(dy) };
  return { id, a, b, dir: 'a', len: Math.hypot(dx, dy), ang: normAng((Math.atan2(dy, dx) * 180) / Math.PI) };
}

export const scheme = (ids: IdGen | undefined, f: (b: Scheme) => void): Structure => {
  const b = new Scheme((ids ?? createIdGen()) as IdGen);
  f(b);
  return b.s;
};

/** Ответ книги для проверки: значения неизвестных (ключ «X_A,Y_A» — модуль полной реакции) или границы искомой нагрузки. */
export interface ContactCheck {
  /** Ожидаемые значения в правиле знаков приложения. */
  vals?: Record<string, number>;
  /** Границы искомой нагрузки (расчёт с трением). */
  min?: number;
  max?: number;
  /** Без искомой нагрузки при трении: равновесие возможно, значения — при наименьшем натяжении нитей. */
  feasible?: boolean;
  /** Перебор случаев: число испробованных предположений. */
  cases?: number;
  /** Значения в предельных состояниях — на наибольшем и наименьшем значении искомой нагрузки. */
  atMax?: Record<string, number>;
  atMin?: Record<string, number>;
  /** Наименьший коэффициент трения, при котором равновесие возможно. */
  fmin?: number;
}

export interface ContactProblem {
  /** Номер в книге: «2.42» или «С.5а». */
  id: string;
  book: 'mesh' | 'yab';
  page: number;
  title: string;
  build: (ids?: IdGen) => Structure;
  /** Текст ответа книги и пояснения к переводу чертежа. */
  answer: string;
  check: ContactCheck;
  /** Относительный допуск сравнения с книгой (по умолчанию — по числу знаков в ответе книги). */
  relTol?: number;
  /** Расхождения с книгой, подтверждённые ручным пересчётом. */
  discrepancy?: Record<string, { computed: number; why: string }>;
}

const R3 = Math.sqrt(3);
const deg = (r: number) => (r * 180) / Math.PI;

export const CONTACT_PROBLEMS: ContactProblem[] = [
  {
    id: '2.42',
    book: 'mesh',
    page: 19,
    title: 'Наклонная балка серединой опирается на ребро консоли другой балки',
    build: (ids) =>
      scheme(ids, (b) => {
        // AB под 30°, |AB| = 4; середина B₁ опирается на конец консоли; консоль a = 1, пролёт CD = 3a.
        const [A, B1, B] = b.body([
          [0, 0],
          [R3, 1],
          [2 * R3, 2],
        ]);
        const [E, C, D] = b.body([
          [R3, 1],
          [R3 + 1, 1],
          [R3 + 4, 1],
        ]);
        b.item({ type: 'pin', at: A, side: 'below' });
        b.item({ type: 'force', at: B, F: 1, ref: 'down', rot: 'ccw', alpha: 30, unknown: false });
        b.item({ type: 'roller', at: C, side: 'below' });
        b.item({ type: 'pin', at: D, side: 'below' });
        b.link({ type: 'contact', a: E, b: B1, angle: 120, f: 0 });
      }),
    answer:
      'Ответ задачника: R_A = P; R_C = 4P/√3; R_D = 2P/√3 (при P = 1: 1; 2,309; 1,155). P = 1, a = 1 м. Точки: A — опора A, B — середина B₁ балки AB (с ней совпадает D — ребро консоли), C — конец B; E — опора C, H — опора D книги. Давление ребра на балку — перпендикулярно AB.',
    check: { vals: { 'X_A,Y_A': 1, R_E: 4 / R3, 'X_H,Y_H': 2 / R3, N_B: 2 } },
  },
  {
    id: '2.45',
    book: 'mesh',
    page: 20,
    title: 'Блок с грузом скользит по тросу, закреплённому на двух стенах',
    build: (ids) =>
      scheme(ids, (b) => {
        // Стены в 4 м, трос 5 м; положение блока — где обе ветви одинаково наклонены (cos = 4/5), конец B выше на 1 м.
        const [A] = b.body([[0, 0]]);
        const [Bw] = b.body([[4, 1]]);
        const [C] = b.body([[4 / 3, -1]]);
        b.item({ type: 'pin', at: A, side: 'left' });
        b.item({ type: 'pin', at: Bw, side: 'right' });
        b.item({ type: 'weight', at: C, G: 18 });
        b.link({ type: 'thread', a: A, b: Bw, via: [C] });
      }),
    answer:
      'Ответ задачника: натяжение троса 15 н независимо от высоты точек крепления. A, B — концы троса на стенах (тела-точки с шарнирами), C — блок с грузом. Положение блока (обе ветви наклонены одинаково, cos = 4/5) найдено заранее: геометрия в приложении задаётся.',
    check: { vals: { T: 15 } },
  },
  {
    id: '2.46',
    book: 'mesh',
    page: 20,
    title: 'Люлька переправы на тросе: натяжение троса и тянущего каната',
    build: (ids) =>
      scheme(ids, (b) => {
        // AB = 100 м, трос ACB = 102 м, AC = 20 м → CB = 82 м; канат CAD через блок A к вороту D (под A).
        const x = (20 * 20 - 82 * 82 + 100 * 100) / 200,
          y = -Math.sqrt(400 - x * x);
        const [A] = b.body([[0, 0]]);
        const [Bt] = b.body([[100, 0]]);
        const [C] = b.body([[x, y]]);
        const [D] = b.body([[0, -40]]);
        b.item({ type: 'pin', at: A, side: 'below' });
        b.item({ type: 'pin', at: Bt, side: 'below' });
        b.item({ type: 'pin', at: D, side: 'below' });
        b.item({ type: 'weight', at: C, G: 5 });
        b.link({ type: 'thread', a: A, b: Bt, via: [C] });
        b.link({ type: 'thread', a: C, b: D, via: [A] });
      }),
    answer:
      'Ответ задачника: S_CAD = 0,75 т; S_CB = S_CA = 9,56 т. A, B — вершины башен (тела-точки с шарнирами), C — ролик с люлькой, D — ворот (под башней A; его место на ответ не влияет). Трос ACB огибает ролик C (натяжение T_AB), канат CAD — блок A (T_CD).',
    check: { vals: { T_AB: 9.56, T_CD: 0.75 } },
    discrepancy: {
      T_CD: {
        computed: 0.794,
        why: 'Натяжение каната CAD по расчёту 0,794 т, в книге 0,75 т (S = 9,56 т совпадает). Проверка: AC = 20, CB = 82, AB = 100; проекции сил на люльку: S·(cos∠B − cos∠A) = T·cos∠A даёт T = 0,0831·S = 0,794 т.',
      },
    },
  },
  {
    id: '2.65',
    book: 'mesh',
    page: 25,
    title: 'Брус на брусе: сила под углом — сдвинется ли верхний, сдвинется ли нижний',
    build: (ids) =>
      scheme(ids, (b) => {
        const [B] = b.body([[0, 0]]);
        const [A] = b.body([[0, 1]]);
        b.item({ type: 'rough', at: B, side: 'below', f: 0.2 });
        b.item({ type: 'weight', at: B, G: 200 });
        b.item({ type: 'weight', at: A, G: 100 });
        b.item({ type: 'force', at: A, F: 60, ref: 'left', rot: 'ccw', alpha: 30, unknown: false });
        b.link({ type: 'contact', a: B, b: A, angle: 90, f: 0.5 });
      }),
    answer:
      'Ответ задачника: брусья A и B остаются в покое. Брусья — тела-точки: A — нижний брус B книги на шероховатой плоскости (f₂ = 0,2), B — верхний брус A книги (f₁ = 0,5); P = 60 кГ под 30° к горизонту прижимает верхний брус.',
    check: { feasible: true, vals: { N_B: 130, Fтр_B: 51.96, N_A: 330, Fтр_A: 51.96 } },
  },
  {
    id: '2.66',
    book: 'mesh',
    page: 25,
    title: 'Тело на теле на наклонной плоскости: при какой силе обе тела в покое',
    build: (ids) =>
      scheme(ids, (b) => {
        const [B] = b.body([[0, 0]]);
        const [A] = b.body([[-0.5, R3 / 2]]);
        b.item({ type: 'rough', at: B, side: 'tilt', angle: 120, f: 0.2 });
        b.item({ type: 'weight', at: B, G: 200 });
        b.item({ type: 'weight', at: A, G: 100 });
        b.item({ type: 'force', at: A, F: 1, ref: 'right', rot: 'ccw', alpha: 30, unknown: true });
        b.link({ type: 'contact', a: B, b: A, angle: 120, f: 0.6 });
      }),
    answer:
      'Ответ задачника: при P < 98 кГ оба тела движутся вниз; при 98 < P < 102 кГ оба в покое; при P > 102 кГ тело B неподвижно, а A скользит по нему вверх. Тела-точки: A — тело B книги на плоскости под 30° (f₂ = 0,2), B — тело A книги (f₁ = 0,6); P (в решении F) — вдоль плоскости.',
    check: { min: 98, max: 102 },
  },
  {
    id: '2.67',
    book: 'mesh',
    page: 25,
    title: 'Два бруса на наклонной плоскости, связанные тросом: покой, натяжение и силы трения',
    build: (ids) =>
      scheme(ids, (b) => {
        const [A] = b.body([[0, 0]]);
        const [B] = b.body([[2 * R3, 2]]);
        b.item({ type: 'rough', at: A, side: 'tilt', angle: 120, f: 0.5 });
        b.item({ type: 'rough', at: B, side: 'tilt', angle: 120, f: 2 / 3 });
        b.item({ type: 'weight', at: A, G: 200 });
        b.item({ type: 'weight', at: B, G: 400 });
        b.link({ type: 'thread', a: A, b: B });
      }),
    answer:
      'Ответ задачника: система останется в покое; F_A = 86,6 кГ, F_B = 213,4 кГ, T = 13,4 кГ. Брусья — тела-точки на плоскости под 30°: A (200 кГ, f = 0,5) ниже, B (400 кГ, f = 2/3) выше. Силы определяются неоднозначно; как и в книге, берём наименьшее натяжение троса: брус A на пределе, трос его удерживает.',
    check: { feasible: true, vals: { T: 13.4, Fтр_A: 86.6, Fтр_B: 213.4 } },
  },
  {
    id: '2.68',
    book: 'mesh',
    page: 26,
    title: 'Клин между двумя телами на шероховатой плоскости: сила, при которой одно из тел сдвинется',
    build: (ids) =>
      scheme(ids, (b) => {
        const [A] = b.body([[-1, 0]]);
        const [Cw] = b.body([[0, 0.6]]);
        const [B] = b.body([[1, 0]]);
        b.item({ type: 'rough', at: A, side: 'below', f: 0.2 });
        b.item({ type: 'rough', at: B, side: 'below', f: 0.25 });
        b.item({ type: 'weight', at: A, G: 400 });
        b.item({ type: 'weight', at: B, G: 300 });
        b.item({ type: 'force', at: Cw, F: 1, ref: 'down', rot: 'ccw', alpha: 0, unknown: true });
        b.link({ type: 'contact', a: A, b: Cw, angle: 0, f: 0.2 });
        b.link({ type: 'contact', a: B, b: Cw, angle: 180 - deg(Math.atan(1 / 3)), f: 0.25 });
      }),
    answer:
      'Ответ задачника: Q = 70 кГ, начнёт двигаться тело A; сила трения на неподвижное тело B со стороны плоскости 83 кГ. Тела-точки: A — тело A (400 кГ), B — клин C, C — тело B книги (300 кГ). Левая грань клина вертикальна (f = 0,2, как у A о плоскость), правая — под углом arctg 1/3 к вертикали (f = 0,25, как у B). Q в решении — F, сила трения на тело B книги — Fтр_C.',
    check: { max: 70, atMax: { Fтр_C: -83 } },
  },
  {
    id: '3.35 (109)',
    book: 'mesh',
    page: 36,
    title: 'Балка концом опирается на другую балку',
    build: (ids) =>
      scheme(ids, (b) => {
        const [A, K, M, B] = b.body([
          [0, 0],
          [2, 0],
          [3, 0],
          [4, 0],
        ]);
        const [C, E, G, N, D] = b.body([
          [4, 0],
          [5, 0],
          [5.5, 0],
          [6, 0],
          [7, 0],
        ]);
        b.item({ type: 'pin', at: A, side: 'below' });
        b.item({ type: 'weight', at: K, G: 200 });
        b.item({ type: 'weight', at: M, G: 80 });
        b.item({ type: 'roller', at: E, side: 'below' });
        b.item({ type: 'weight', at: G, G: 160 });
        b.item({ type: 'weight', at: N, G: 80 });
        b.item({ type: 'pin', at: D, side: 'right' });
        b.link({ type: 'contact', a: C, b: B, angle: 90, f: 0 });
      }),
    answer:
      'Ответ задачника: R_A = 120 кГ; R_B = 160 кГ; R_E = 400 кГ; R_D = 0. Тело I — балка AB (A — шарнир A, B — её центр тяжести, C — груз M, D — конец B); тело II — балка CD (E — конец C, совпадает с D; H — опора E, K — центр тяжести, L — груз N, N — шарнир D книги). Давление в касании N_D книга называет R_B.',
    check: { vals: { Y_A: 120, N_D: 160, R_H: 400, 'X_N,Y_N': 0 } },
  },
  {
    id: '4.54 (166)',
    book: 'mesh',
    page: 53,
    title: 'Брусок опирается на гладкий цилиндр, который удерживает нить',
    build: (ids) =>
      scheme(ids, (b) => {
        // r = 1: цилиндр на полу, AC = 2r (под 30°), брусок AB = 3r касается цилиндра — под 60° к полу.
        const u: P = [0.5, R3 / 2];
        const [A, M, K] = b.body([
          [0, 0],
          [1.5 * u[0], 1.5 * u[1]],
          [R3 * u[0], R3 * u[1]],
          [3 * u[0], 3 * u[1]],
        ]);
        const [K2, C, L] = b.body([
          [R3 * u[0], R3 * u[1]],
          [R3, 1],
          [R3, 0],
        ]);
        const [Ax] = b.body([[0, 0]]);
        b.item({ type: 'pin', at: A, side: 'below' });
        b.item({ type: 'weight', at: M, G: 16 });
        b.item({ type: 'roller', at: L, side: 'below' });
        b.item({ type: 'pin', at: Ax, side: 'below' });
        b.link({ type: 'contact', a: K2, b: K, angle: 150, f: 0 });
        b.link({ type: 'thread', a: C, b: Ax });
      }),
    answer:
      'Ответ задачника: T = 6,9 кГ; X_A = −6 кГ; Y_A = −12,5 кГ — давление бруска на шарнир; реакция шарнира на брусок — те же числа с обратным знаком. r = 1 м. Тело I — брусок (A — ось A, B — середина, C — точка касания, D — конец B), тело II — цилиндр (E — точка касания, H — центр C книги, K — точка на полу), L — ось A как тело-точка с шарниром: к ней привязана нить от центра цилиндра.',
    check: { vals: { T: 6.9, X_A: 6, Y_A: 12.5 } },
  },
  {
    id: '4.55 (167)',
    book: 'mesh',
    page: 53,
    title: 'Два цилиндра между гладкими наклонными плоскостями',
    build: (ids) =>
      scheme(ids, (b) => {
        const [C1] = b.body([[0, 0]]);
        const [C2] = b.body([[2, 0]]);
        b.item({ type: 'roller', at: C1, side: 'tilt', angle: 30 });
        b.item({ type: 'roller', at: C2, side: 'tilt', angle: 120 });
        b.item({ type: 'weight', at: C1, G: 10 });
        b.item({ type: 'weight', at: C2, G: 30 });
        b.link({ type: 'contact', a: C2, b: C1, angle: 180, f: 0 });
      }),
    answer:
      'Ответ задачника: φ = 0; N₁ = 20 н; N₂ = 34,6 н; N = 17,3 н. Цилиндры — тела-точки (все силы проходят через центры): A — C₁ (10 н) на плоскости OA под 60°, B — C₂ (30 н) на OB под 30°; N₁ = R_A, N₂ = R_B, N = N_A. Угол φ не ищется: линия центров взята горизонтальной (φ = 0), и проверка показывает, что при нём равновесие есть.',
    check: { vals: { R_A: 20, R_B: 34.6, N_A: 17.3 } },
  },
  {
    id: '4.57 (169)',
    book: 'mesh',
    page: 53,
    title: 'Цилиндр на двух цилиндрах, связанных нитью',
    build: (ids) =>
      scheme(ids, (b) => {
        // r = 1, R = 2, P = 1, Q = 4: центры нижних в 2r, верхний на высоте √((R + r)² − r²).
        const h = Math.sqrt(8);
        const [O1] = b.body([[-1, 0]]);
        const [O2] = b.body([[1, 0]]);
        const [O3] = b.body([[0, h]]);
        b.item({ type: 'roller', at: O1, side: 'below' });
        b.item({ type: 'roller', at: O2, side: 'below' });
        b.item({ type: 'weight', at: O1, G: 1 });
        b.item({ type: 'weight', at: O2, G: 1 });
        b.item({ type: 'weight', at: O3, G: 4 });
        b.link({ type: 'contact', a: O1, b: O3, angle: deg(Math.atan2(h, 1)), f: 0 });
        b.link({ type: 'contact', a: O2, b: O3, angle: deg(Math.atan2(h, -1)), f: 0 });
        b.link({ type: 'thread', a: O1, b: O2 });
      }),
    answer:
      'Ответ задачника (в общем виде): давление каждого нижнего цилиндра на плоскость P + Q/2, давление между верхним и нижним Q(R + r)/(2√(R² + 2Rr)), натяжение нити Qr/(2√(R² + 2Rr)). Взято r = 1, R = 2, P = 1, Q = 4: 3; 2,121; 0,707. Цилиндры — тела-точки: A, B — нижние O₁, O₂, C — верхний O₃.',
    check: { vals: { R_A: 3, R_B: 3, N_AC: 3 / Math.sqrt(2), N_BC: 3 / Math.sqrt(2), T: 1 / Math.sqrt(2) } },
  },
  {
    id: '4.58 (170)',
    book: 'mesh',
    page: 54,
    title: 'Три трубы между стенками: давление на землю и на стенки',
    build: (ids) =>
      scheme(ids, (b) => {
        const [O1] = b.body([[0, 0]]);
        const [O2] = b.body([[2, 0]]);
        const [O3] = b.body([[1, R3]]);
        b.item({ type: 'roller', at: O1, side: 'below' });
        b.item({ type: 'roller', at: O1, side: 'left' });
        b.item({ type: 'roller', at: O2, side: 'below' });
        b.item({ type: 'roller', at: O2, side: 'right' });
        for (const O of [O1, O2, O3]) b.item({ type: 'weight', at: O, G: 120 });
        b.link({ type: 'contact', a: O1, b: O3, angle: 60, f: 0 });
        b.link({ type: 'contact', a: O2, b: O3, angle: 120, f: 0 });
        b.link({ type: 'contact', a: O1, b: O2, angle: 0, f: 0 });
      }),
    answer:
      'Ответ задачника: давление на землю 180 кГ, на каждую стенку 34,6 кГ. Трубы — тела-точки: A, B — нижние (R_A, R_B — давление на землю, R_A′, R_B′ — на стенки), C — верхняя. Нижние трубы касаются друг друга, поэтому неизвестных на одно больше, чем уравнений; касание может только давить — перебор случаев показывает, что нижние трубы касаются без давления.',
    check: { vals: { R_A: 180, "R_A'": 34.6, R_B: 180, "R_B'": 34.6, N_AC: 69.28 }, cases: 1 },
  },
  {
    id: '4.59 (171)',
    book: 'mesh',
    page: 54,
    title: 'Тормозное колесо: сила прижатия колодок',
    build: (ids) =>
      scheme(ids, (b) => {
        const [O, L, R] = b.body(
          [
            [0, 0],
            [-0.25, 0],
            [0.25, 0],
          ],
          [
            [0, 1],
            [0, 2],
          ],
        );
        const [SL] = b.body([[-0.45, -0.35]]);
        const [SR] = b.body([[0.45, -0.35]]);
        b.item({ type: 'pin', at: O, side: 'below' });
        b.item({ type: 'moment', at: O, M: 100, dir: 'cw', unknown: false });
        b.item({ type: 'roller', at: SL, side: 'below' });
        b.item({ type: 'roller', at: SR, side: 'below' });
        b.link({ type: 'contact', a: SL, b: L, angle: 0, f: 0.25 });
        b.link({ type: 'contact', a: SR, b: R, angle: 180, f: 0.25 });
        b.link({ type: 'thread', a: SL, b: SR });
      }),
    answer:
      'Ответ задачника: Q = 800 кГ. Колесо r = 0,25 м на валу (A — ось с шарниром, момент M = 100 кГм; B, C — точки обода), колодки D, E — тела-точки на направляющих (реакция поперёк), прижаты стяжкой — нитью между ними: сила прижатия Q равна натяжению T. Ищем наименьшее натяжение, при котором колесо не вращается.',
    check: { feasible: true, vals: { T: 800 } },
  },
  {
    id: '4.76 (188)',
    book: 'mesh',
    page: 59,
    title: 'Два тела на гранях призмы, нить через блок: предельный наклон',
    build: (ids) =>
      scheme(ids, (b) => {
        // f = 0,2; tg α = f — предельное положение по ответу книги. Грань AB наклонена под 45° + α, BC — под 45° − α.
        const a = deg(Math.atan(0.2));
        const t1 = ((45 + a) * Math.PI) / 180,
          t2 = ((45 - a) * Math.PI) / 180;
        const B: P = [0, 0];
        const G: P = [-1.5 * Math.cos(t1), -1.5 * Math.sin(t1)];
        const H: P = [1.5 * Math.cos(t2), -1.5 * Math.sin(t2)];
        const [Bn] = b.body([B]);
        const [Gn] = b.body([G]);
        const [Hn] = b.body([H]);
        b.item({ type: 'pin', at: Bn, side: 'below' });
        b.item({ type: 'rough', at: Gn, side: 'tilt', angle: normAng(45 + a + 90), f: 0.2 });
        b.item({ type: 'rough', at: Hn, side: 'tilt', angle: normAng(90 - (45 - a)), f: 0.2 });
        b.item({ type: 'weight', at: Gn, G: 1 });
        b.item({ type: 'weight', at: Hn, G: 1 });
        b.link({ type: 'thread', a: Gn, b: Hn, via: [Bn] });
      }),
    answer:
      'Ответ задачника: tg α = f. Угол α не ищется: взяты f = 0,2 и α = arctg 0,2; приложение показывает, что наименьший коэффициент трения, при котором равновесие ещё возможно, равен 0,2 — равновесие предельное. B — блок в вершине призмы (тело-точка с шарниром), A — груз G на грани AB, C — груз H на грани BC (тела-точки весом 1).',
    check: { feasible: true, fmin: 0.2 },
  },
  {
    id: 'С.5а',
    book: 'yab',
    page: 38,
    title: 'Колодочный тормоз барабана с грузом на наклонной плоскости (пример, варианты 1–20)',
    build: (ids) =>
      scheme(ids, (b) => {
        // Барабан: R = 0,3, r = 0,2 (R/r = 1,5); колодка внизу под α = 20° от вертикали; шток с направляющими A (a = 0,1) и B (b = 0,2).
        const al = (20 * Math.PI) / 180;
        const S: P = [0.3 * Math.sin(al), -0.3 * Math.cos(al)];
        const along = (k: number): P => [S[0] + k * Math.sin(al), S[1] - k * Math.cos(al)];
        const [O, Top, Sh] = b.body(
          [[0, 0], [0, 0.2], S],
          [
            [0, 1],
            [0, 2],
          ],
        );
        const [S2, GA, GB] = b.body([S, along(0.1), along(0.3)]);
        const [Cb] = b.body([[0.6, 0.2]]);
        const [Q] = b.body([[0.6 + 0.5, 0.2 - 0.5]]);
        b.item({ type: 'pin', at: O, side: 'below' });
        b.item({ type: 'weight', at: O, G: 2 });
        b.item({ type: 'pin', at: Cb, side: 'below' });
        b.item({ type: 'roller', at: Q, side: 'tilt', angle: 45 });
        b.item({ type: 'weight', at: Q, G: 20 });
        b.item({ type: 'roller', at: GA, side: 'tilt', angle: 20 });
        b.item({ type: 'roller', at: GB, side: 'tilt', angle: 20 });
        b.item({ type: 'force', at: GB, F: 1, ref: 'up', rot: 'ccw', alpha: 20, unknown: true });
        b.link({ type: 'contact', a: S2, b: Sh, angle: 110, f: 0.1 });
        b.link({ type: 'thread', a: Top, b: Q, via: [Cb] });
      }),
    answer:
      'Ответ книги: P_min = 94 кН; F_сц = 9,4 кН; N = 94 кН; X_O = 9,2 кН; Y_O = −89,6 кН; R_A = 14,1 кН; R_B = −4,7 кН. Тело I — барабан (A — ось O, B — точка схода нити на радиусе r, C — точка обода под колодкой; G = 2 кН, R/r = 1,5); тело II — шток с колодкой (D совпадает с C; E, H — направляющие A и B книги, реакции поперёк штока); K — блок C книги, L — груз Q = 20 кН на гладкой плоскости под 45°. P в решении — F; f = 0,1, α = 20°, a = 10 см, b = 20 см.',
    relTol: 0.005,
    check: { min: 94, atMin: { X_A: 9.2, Y_A: -89.6, R_E: 14.1, R_H: -4.7, N_C: 94, Fтр_C: 9.4 } },
  },
  {
    id: 'С.5б',
    book: 'yab',
    page: 39,
    title: 'Тело опирается на раму в двух шероховатых точках (пример, варианты 21–30)',
    build: (ids) =>
      scheme(ids, (b) => {
        // a = 6 м, b = 2 м: стойка A высотой a/2, ригель до шарнира B; тело C (G = 1 кН) — на ригеле в точках D, E.
        const [, , D, E] = b.body([
          [0, -3],
          [0, 0],
          [2, 0],
          [4, 0],
          [6, 0],
        ]);
        const [D2, Mc, E2, Pp] = b.body(
          [
            [2, 0],
            [3, 0],
            [4, 0],
            [3, 0.5],
          ],
          [
            [0, 1],
            [1, 2],
            [1, 3],
          ],
        );
        const nodes = b.s.nodes;
        b.item({ type: 'roller', at: nodes[0].id, side: 'below' });
        b.item({ type: 'pin', at: nodes[4].id, side: 'below' });
        b.item({ type: 'weight', at: Mc, G: 1 });
        b.item({ type: 'force', at: Pp, F: 1, ref: 'right', rot: 'ccw', alpha: 0, unknown: true });
        b.link({ type: 'contact', a: D, b: D2, angle: 90, f: 0.4 });
        b.link({ type: 'contact', a: E, b: E2, angle: 90, f: 0.4 });
      }),
    answer:
      'Ответ книги: P_max = 0,4 кН; N_E = 0,6 кН; N_D = 0,4 кН; F_сц(D) = 0,16 кН; F_сц(E) = 0,24 кН; R_A = 0,467 кН; X_B = −0,4 кН; Y_B = 0,533 кН. Тело I — рама (A — опора A, C, D — точки D, E книги на ригеле, E — шарнир B книги), тело II — тело C книги (H, L — те же точки D, E; K — центр тяжести, N — точка приложения P, в решении F), a = 6 м, b = 2 м, f = 0,4. Силы трения на тело C направлены влево — в ответе со знаком «−».',
    check: { max: 0.4, atMax: { R_A: 0.467, X_E: -0.4, Y_E: 0.533, N_H: 0.4, N_L: 0.6, Fтр_H: -0.16, Fтр_L: -0.24 } },
  },
  {
    id: 'С.9',
    book: 'yab',
    page: 61,
    title: 'Составная рама с односторонними связями E и F (пример)',
    build: (ids) =>
      scheme(ids, (b) => {
        // Рис. 57: AC и CD — рама с шарниром C, ED — отдельное тело, соединённое с CD шарниром D;
        // вертикальный стержень ED касается AC в точке E (сверху) и CD в точке F (снизу).
        const [A, E] = b.body(
          [
            [7, 6],
            [2, 6],
            [0, 6],
            [0, 3],
            [0, 0],
            [4, 0],
            [10, 0],
            [10, 2],
          ],
          undefined,
          [3],
        );
        const nodes = () => b.s.nodes;
        const P2pt = nodes()[4].id,
          F = nodes()[5].id,
          D = nodes()[7].id;
        const [D2, B, G, P1pt, E2, F2] = b.body(
          [
            [10, 2],
            [8, 2],
            [4, 2],
            [2, 2],
            [2, 6],
            [4, 0],
          ],
          [
            [0, 1],
            [1, 2],
            [2, 3],
            [3, 4],
            [2, 5],
          ],
        );
        b.item({ type: 'pin', at: A, side: 'right' });
        b.item({ type: 'pin', at: B, side: 'below' });
        b.item({ type: 'moment', at: E, M: 20, dir: 'ccw', unknown: false });
        b.item({ type: 'force', at: P2pt, F: 3, ref: 'up', rot: 'ccw', alpha: 0, unknown: false });
        b.item({ type: 'force', at: P1pt, F: 10, ref: 'left', rot: 'ccw', alpha: 60, unknown: false });
        b.item({ type: 'dist', from: B, to: D2, q1: 1, q2: 1, dir: 'down' });
        void G;
        b.link({ type: 'hinge', a: D, b: D2 });
        b.link({ type: 'contact', a: E, b: E2, angle: 270, f: 0 });
        b.link({ type: 'contact', a: F, b: F2, angle: 90, f: 0 });
      }),
    answer:
      'Ответ книги (табл. 19): R_F = 9,949; X_A = 11,023; Y_A = 1,867; X_B = −6,023; Y_B = 5,793; X_D = 11,023; Y_D = 5,082; X_C = −11,023; Y_C = −1,867 кН. Рама AC–CD с шарниром C (в решении D) — тело из частей I и II; элемент ED — тело III, соединён с CD шарниром D (в решении L и N). Точки E, F книги — B и U, H и V; опора B книги — O. Силы в шарнирах приложение даёт на вторую часть (X_D = −X_C, Y_D = −Y_C книги; X_N = X_D, Y_N = −Y_D книги). Случай 1 (работает E) отбрасывается: давление в E отрицательно; работает F (N_V = R_F).',
    check: { vals: { X_A: 11.023, Y_A: 1.867, X_O: -6.023, Y_O: 5.793, X_D: 11.023, Y_D: 1.867, X_N: 11.023, Y_N: -5.082, N_V: 9.949 }, cases: 2 },
  },
];
