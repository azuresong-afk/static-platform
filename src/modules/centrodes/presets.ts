/**
 * Готовые задачи: Мещерский §17 (неподвижная и подвижная центроиды). Размеры — параметры, в книге они буквенные.
 * book — уравнения центроид из ответа книги, check — невязка этих уравнений (безразмерная) для точки центроиды.
 * Оси: неподвижные — как на чертеже книги, подвижные — по описанию в ответе (см. docs/sections/centrodes.md).
 */
import type { MBody, MCons, MDrive, MechProblem, MPoint, PtDef } from '../mechanism/model/mech';
import type { Source, Shape } from './model/centrodes';

export interface CentrodeParam {
  key: string;
  label: string;
  value: number;
  /** Пояснение к размеру. */
  hint?: string;
}

export interface CentrodePreset {
  title: string;
  params: CentrodeParam[];
  build: (v: Record<string, number>) => Source;
  book: { fixed: string; moving: string };
  /** Невязка уравнений книги: безразмерная, ≈ 0 на центроидах. Функции получают значения параметров. */
  check?: {
    fixed: (v: Record<string, number>, x: number, y: number) => number;
    moving: (v: Record<string, number>, xi: number, eta: number) => number;
    tol: number;
  };
  note?: string;
}

const n = (x: number) => String(+x.toPrecision(12));
const pt = (name: string, def: PtDef): MPoint => ({ name, def });
const xy = (name: string, x: string, y: string) => pt(name, { k: 'xy', x, y });
const polar = (name: string, from: string, L: string, ang: string) => pt(name, { k: 'polar', from, L, ang });
const toward = (name: string, from: string, L: string, to: string) => pt(name, { k: 'polar', from, L, ang: '0', to });
const onLine = (name: string, from: string, L: string, through: string, ang: string, side: 1 | -1 = 1) => pt(name, { k: 'line', from, L, through, ang, side });
const two = (name: string, p1: string, L1: string, p2: string, L2: string, side: 1 | -1 = 1) => pt(name, { k: 'two', p1, L1, p2, L2, side });
const cross = (name: string, p1: string, q1: string, a1: string, p2: string, q2: string, a2: string) => pt(name, { k: 'cross', p1, q1, a1, p2, q2, a2 });
const body = (name: string, ...pts: string[]): MBody => ({ name, pts });
const fixed = (...ps: string[]): MCons[] => ps.map((p) => ({ k: 'fixed', p }));
const slider = (p: string, ang: string): MCons => ({ k: 'slider', p, ang });
const guide = (p: string, b: string, g1: string, g2: string): MCons => ({ k: 'guide', p, b, g1, g2 });
const omega = (b: string, w: string): MDrive => ({ k: 'omega', b, w, e: '0' });
const proj = (p: string, ang: string, v: string): MDrive => ({ k: 'proj', p, ang, v, a: '0' });

const mech = (problem: MechProblem, bodyName: string, frame: { o: string; to: string; rot?: number }, from: number, to: number): Source => ({
  kind: 'mech',
  parts: [{ problem, from, to }],
  body: bodyName,
  frame: { o: frame.o, to: frame.to, rot: frame.rot ?? 0 },
});
const motion = (x: string, y: string, theta: string, from: number, to: number, shapes: Shape[], frameRot = 0): Source => ({
  kind: 'motion',
  x,
  y,
  theta,
  from,
  to,
  shapes,
  frameRot,
});
const circ = (r: number, c: [number, number] = [0, 0]): Shape => ({ k: 'circle', c, r });

/** Дуга-окружность по неявному уравнению (x−cx)²+(y−cy)²=R² — невязка в долях R. */
const circRes = (x: number, y: number, cx: number, cy: number, R: number) => (Math.hypot(x - cx, y - cy) - R) / R;

export const CENTRODE_PRESETS = {
  m171: {
    title: 'Мещерский 17.1: стержень скользит концами по осям (задача 16.8)',
    params: [{ key: 'L', label: 'AB', value: 1, hint: 'длина стержня' }],
    build: (v) => {
      const l = v.L / 2;
      const problem: MechProblem = {
        points: [xy('O', '0', '0'), polar('C', 'O', n(l), 'φ'), onLine('A', 'C', n(l), 'O', '90'), onLine('B', 'C', n(l), 'O', '0')],
        bodies: [body('OC', 'O', 'C'), body('AB', 'A', 'C', 'B')],
        cons: [...fixed('O'), slider('A', '90'), slider('B', '0')],
        drives: [omega('OC', '1')],
      };
      return mech(problem, 'AB', { o: 'A', to: 'B' }, 0, 90);
    },
    book: {
      fixed: 'x² + y² = AB² — окружность радиуса AB с центром в O',
      moving: '(ξ − AB/2)² + η² = (AB/2)² — окружность на AB как на диаметре (ξ вдоль AB от A)',
    },
    check: {
      fixed: (v, x, y) => circRes(x, y, 0, 0, v.L),
      moving: (v, xi, eta) => circRes(xi, eta, v.L / 2, 0, v.L / 2),
      tol: 1e-6,
    },
    note: 'Книга: AB = 1 м — подвижная окружность радиуса 0,5 м с центром в середине AB, неподвижная — радиуса 1 м с центром в O. φ — угол OC к оси x (OC = AB/2 — вспомогательный кривошип эллипсографа); для φ от 0° до 90° получается четверть окружностей, остальные — по симметрии.',
  },
  m172a: {
    title: 'Мещерский 17.2: блок A полиспаста (центр поднимается, обойма движется поступательно)',
    params: [{ key: 'r', label: 'r_A', value: 1, hint: 'радиус блока' }],
    build: (v) => motion('0', `${n(v.r)}*t*pi/180`, '-t', -60, 60, [circ(v.r)]),
    book: { fixed: 'x = r_A — вертикальная прямая, касательная к блоку справа', moving: 'ξ² + η² = r_A² — окружность блока' },
    check: {
      fixed: (v, x) => (x - v.r) / v.r,
      moving: (v, xi, eta) => circRes(xi, eta, 0, 0, v.r),
      tol: 1e-9,
    },
    note: 'Блок A обвит канатом, один конец которого закреплён: мгновенный центр — на ободе, в точке схода каната, v = ωr_A. Подвижная центроида — сам блок.',
  },
  m172b: {
    title: 'Мещерский 17.2: блок B полиспаста (центроида — окружность радиуса r_B / 3)',
    params: [{ key: 'r', label: 'r_B', value: 3, hint: 'радиус блока' }],
    build: (v) => motion('0', `${n(v.r / 3)}*t*pi/180`, '-t', -60, 60, [circ(v.r)]),
    book: {
      fixed: 'x = r_B / 3 — вертикальная прямая, касательная к подвижной центроиде справа',
      moving: 'ξ² + η² = (r_B / 3)² — окружность радиуса r_B / 3 с центром в центре блока',
    },
    check: {
      fixed: (v, x) => (x - v.r / 3) / (v.r / 3),
      moving: (v, xi, eta) => circRes(xi, eta, 0, 0, v.r / 3),
      tol: 1e-9,
    },
    note: 'Центр блока B поднимается со скоростью v = ωr_B / 3 (по условию задачи — схема полиспаста из книги): мгновенный центр скоростей отстоит от оси блока на v/ω = r_B / 3. Схема канатов взята из ответа книги: на рисунке полиспаста её не проверить.',
  },
  m173: {
    title: 'Мещерский 17.3: кривошипно-шатунный механизм, AB = OA = r',
    params: [{ key: 'r', label: 'r', value: 1, hint: 'OA = AB' }],
    build: (v) => {
      const problem: MechProblem = {
        points: [xy('O', '0', '0'), polar('A', 'O', n(v.r), 'φ'), onLine('B', 'A', n(v.r), 'O', '0')],
        bodies: [body('OA', 'O', 'A'), body('AB', 'A', 'B')],
        cons: [...fixed('O'), slider('B', '0')],
        drives: [omega('OA', '1')],
      };
      return mech(problem, 'AB', { o: 'A', to: 'B' }, -89, 89);
    },
    book: {
      fixed: 'x² + y² = (2r)² — окружность радиуса 2r с центром в O',
      moving: 'ξ² + η² = r² — окружность радиуса r с центром в A (начало подвижных осей — A, ξ вдоль AB)',
    },
    check: {
      fixed: (v, x, y) => circRes(x, y, 0, 0, 2 * v.r),
      moving: (v, xi, eta) => circRes(xi, eta, 0, 0, v.r),
      tol: 1e-6,
    },
    note: 'При AB = OA ползун проходит точку O (φ = ±90°); механизм построен для φ от −89° до 89°, это правая половина окружностей — продолжение движения даёт вторую половину.',
  },
  m174: {
    title: 'Мещерский 17.4: кривошипно-шатунный механизм, AB = 2·OA (построение)',
    params: [
      { key: 'r', label: 'OA', value: 1 },
      { key: 'k', label: 'AB / OA', value: 2 },
    ],
    build: (v) => {
      const problem: MechProblem = {
        points: [xy('O', '0', '0'), polar('A', 'O', n(v.r), 'φ'), onLine('B', 'A', n(v.r * v.k), 'O', '0')],
        bodies: [body('OA', 'O', 'A'), body('AB', 'A', 'B')],
        cons: [...fixed('O'), slider('B', '0')],
        drives: [omega('OA', '1')],
      };
      return mech(problem, 'AB', { o: 'A', to: 'B' }, 0, 360);
    },
    book: {
      fixed: 'x = r cos φ + √(l² − r² sin² φ), y = x·tg φ (мгновенный центр лежит на прямой OA и на вертикали через B)',
      moving: 'в осях ξη с началом в A и осью ξ вдоль AB: ξ = (P − A)·e, η = (P − A)·e⊥ — линия получена построением',
    },
    check: {
      fixed: (v, x, y) => {
        // Принадлежность: P лежит на вертикали через B — x = x_B(φ), y = x·tg φ ⇒ (x − r cosφ)² + r² sin²φ = l².
        const l = v.r * v.k;
        const phi = Math.atan2(y, x);
        const xb = v.r * Math.cos(phi) + Math.sqrt(l * l - v.r * v.r * Math.sin(phi) ** 2);
        const xb2 = v.r * Math.cos(phi + Math.PI) + Math.sqrt(l * l - v.r * v.r * Math.sin(phi + Math.PI) ** 2);
        return Math.min(Math.abs(x - xb), Math.abs(x - xb2)) / l;
      },
      moving: () => 0,
      tol: 1e-6,
    },
    note: 'В книге — «построить графически»: приложение строит обе кривые численно по мгновенному центру в каждом положении. Мгновенный центр уходит в бесконечность при φ = 90°, 270° (шатун движется поступательно) — там линии рвутся.',
  },
  m175: {
    title: 'Мещерский 17.5: точка A на окружности, стержень проходит через точку N той же окружности',
    params: [{ key: 'r', label: 'r', value: 1, hint: 'радиус окружности OA = ON' }],
    build: (v) => {
      const problem: MechProblem = {
        points: [xy('O', '0', '0'), xy('N', n(v.r), '0'), polar('A', 'O', n(v.r), 'φ'), toward('B', 'A', n(3 * v.r), 'N')],
        bodies: [body('OA', 'O', 'A'), body('AB', 'A', 'B')],
        cons: [...fixed('O'), guide('N', 'AB', 'A', 'B')],
        drives: [omega('OA', '1')],
      };
      return mech(problem, 'AB', { o: 'A', to: 'B' }, 5, 355);
    },
    book: { fixed: 'x² + y² = r² — окружность радиуса r с центром в O', moving: 'ξ² + η² = (2r)² — окружность радиуса 2r с центром в A (ξ вдоль AB)' },
    check: {
      fixed: (v, x, y) => circRes(x, y, 0, 0, v.r),
      moving: (v, xi, eta) => circRes(xi, eta, 0, 0, 2 * v.r),
      tol: 1e-6,
    },
    note: 'Точка N — на той же окружности, например в её крайней правой точке; φ = 0 исключено (A совпадает с N, направление стержня не определено).',
  },
  m176: {
    title: 'Мещерский 17.6: антипараллелограмм на большем звене AB — звено CD',
    params: [
      { key: 'a', label: 'AD = BC = a', value: 3 },
      { key: 'b', label: 'AB = CD = b', value: 5, hint: 'a < b' },
    ],
    build: (v) => {
      const mk = (side: 1 | -1): MechProblem => ({
        points: [xy('A', '0', '0'), xy('B', n(v.b), '0'), polar('D', 'A', n(v.a), 'φ'), two('C', 'D', n(v.b), 'B', n(v.a), side)],
        bodies: [body('AD', 'A', 'D'), body('CD', 'C', 'D'), body('BC', 'B', 'C')],
        cons: fixed('A', 'B'),
        drives: [omega('AD', '1')],
      });
      return {
        kind: 'mech',
        parts: [
          { problem: mk(-1), from: 0.5, to: 179.5 },
          { problem: mk(1), from: 180.5, to: 359.5 },
        ],
        body: 'CD',
        frame: { o: 'C', to: 'D', rot: 0 },
      };
    },
    book: {
      fixed: 'гипербола с фокусами A и B, действительная полуось a/2: |PA − PB| = a',
      moving: 'такая же гипербола с фокусами C и D: |PC − PD| = a',
    },
    check: {
      fixed: (v, x, y) => (Math.abs(Math.hypot(x, y) - Math.hypot(x - v.b, y)) - v.a) / v.a,
      moving: (v, xi, eta) => {
        // В осях звена: начало C, ось ξ вдоль C→D, D = (b, 0).
        return (Math.abs(Math.hypot(xi, eta) - Math.hypot(xi - v.b, eta)) - v.a) / v.a;
      },
      tol: 1e-6,
    },
  },
  m177: {
    title: 'Мещерский 17.7: антипараллелограмм на меньшем звене AD — звено BC',
    params: [
      { key: 'a', label: 'AD = BC = a', value: 3 },
      { key: 'b', label: 'AB = CD = b', value: 5, hint: 'a < b' },
    ],
    build: (v) => {
      const mk = (side: 1 | -1): MechProblem => ({
        points: [xy('A', '0', '0'), xy('D', n(v.a), '0'), polar('B', 'A', n(v.b), 'φ'), two('C', 'B', n(v.a), 'D', n(v.b), side)],
        bodies: [body('AB', 'A', 'B'), body('BC', 'B', 'C'), body('CD', 'C', 'D')],
        cons: fixed('A', 'D'),
        drives: [omega('AB', '1')],
      });
      return {
        kind: 'mech',
        parts: [
          { problem: mk(-1), from: 0.5, to: 179.5 },
          { problem: mk(1), from: 180.5, to: 359.5 },
        ],
        body: 'BC',
        frame: { o: 'B', to: 'C', rot: 0 },
      };
    },
    book: {
      fixed: 'эллипс с фокусами A и D, полуоси b/2 и ½·√(b² − a²): PA + PD = b',
      moving: 'такой же эллипс с фокусами B и C: PB + PC = b',
    },
    check: {
      fixed: (v, x, y) => (Math.hypot(x, y) + Math.hypot(x - v.a, y) - v.b) / v.b,
      moving: (v, xi, eta) => (Math.hypot(xi, eta) + Math.hypot(xi - v.a, eta) - v.b) / v.b,
      tol: 1e-6,
    },
  },
  m178: {
    title: 'Мещерский 17.8: два стержня под прямым углом проходят через неподвижные точки K и N',
    params: [{ key: 'a', label: 'a', value: 1, hint: 'KN = 2a' }],
    build: (v) => {
      const a = n(v.a);
      const problem: MechProblem = {
        points: [xy('K', n(-v.a), '0'), xy('N', a, '0'), cross('F', 'K', '', 'φ', 'N', '', 'φ+90'), polar('G', 'F', a, 'φ'), polar('H', 'F', a, 'φ+90')],
        bodies: [body('FGH', 'F', 'G', 'H')],
        cons: [guide('K', 'FGH', 'F', 'G'), guide('N', 'FGH', 'F', 'H')],
        drives: [omega('FGH', '1')],
      };
      return mech(problem, 'FGH', { o: 'F', to: 'G' }, -85, 85);
    },
    book: {
      fixed: 'x² + y² = a² — окружность радиуса a с центром в O',
      moving: 'ξ² + η² = 4a² — окружность радиуса 2a с центром в F (начало — F, ξ вдоль AB, η вдоль DE)',
    },
    check: {
      fixed: (v, x, y) => circRes(x, y, 0, 0, v.a),
      moving: (v, xi, eta) => circRes(xi, eta, 0, 0, 2 * v.a),
      tol: 1e-6,
    },
  },
  m179: {
    title: 'Мещерский 17.9: диск между двумя рейками (скорости v₁, v₂ в противоположные стороны)',
    params: [
      { key: 'a', label: 'a', value: 1, hint: 'радиус диска' },
      { key: 'v1', label: 'v₁', value: 3 },
      { key: 'v2', label: 'v₂', value: 1 },
    ],
    build: (v) => {
      const vc = (v.v1 - v.v2) / 2,
        w = (v.v1 + v.v2) / (2 * v.a);
      return motion(`${n(vc)}*t*pi/180`, '0', `-${n(w)}*t`, -90, 90, [circ(v.a)]);
    },
    book: {
      fixed: 'y_C = a·(v₁ − v₂)/(v₁ + v₂) (ось y вниз) — прямая, параллельная рейкам',
      moving: 'ξ² + η² = a²·((v₁ − v₂)/(v₁ + v₂))² — окружность с центром в центре диска',
    },
    check: {
      fixed: (v, _x, y) => (-y - (v.a * (v.v1 - v.v2)) / (v.v1 + v.v2)) / v.a,
      moving: (v, xi, eta) => circRes(xi, eta, 0, 0, Math.abs((v.a * (v.v1 - v.v2)) / (v.v1 + v.v2))),
      tol: 1e-9,
    },
    note: 'Рейка AB (сверху) движется со скоростью v₁ вправо, DE (снизу) — со скоростью v₂ влево. Скорость центра (v₁ − v₂)/2, ω = (v₁ + v₂)/(2a) по часовой стрелке. В книге ось y направлена вниз, здесь вверх: y_C меняет знак.',
  },
  m1710: {
    title: 'Мещерский 17.10: стержень опирается на окружность, конец A скользит по оси Ox',
    params: [{ key: 'a', label: 'a', value: 1, hint: 'радиус окружности' }],
    build: (v) =>
      motion(
        `${n(v.a)}/sin(t*pi/180)`,
        '0',
        '180-t',
        25,
        155,
        [
          {
            k: 'poly',
            pts: [
              [0, 0],
              [0, 4 * v.a],
            ],
          },
        ],
        -90,
      ),
    book: { fixed: 'x²(x² − a²) − a²y² = 0', moving: 'η² = aξ (η — вдоль стержня от A, ξ — перпендикулярно ему, по часовой стрелке)' },
    check: {
      fixed: (v, x, y) => (x * x * (x * x - v.a * v.a) - v.a * v.a * y * y) / v.a ** 4,
      moving: (v, xi, eta) => (eta * eta - v.a * xi) / v.a ** 2,
      tol: 1e-9,
    },
    note: 'Параметр φ — угол ∠OAB между стержнем и осью x. Подвижные оси: начало — конец A, ось η — вдоль стержня к B, ось ξ — перпендикулярно ему, как в ответе книги.',
  },
  m1711: {
    title: 'Мещерский 17.11: прямой угол ABC, A скользит по оси x, сторона BC проходит через точку D оси y',
    params: [{ key: 'a', label: 'AB = OD', value: 1 }],
    build: (v) => {
      const a = n(v.a);
      const problem: MechProblem = {
        points: [
          xy('O', '0', '0'),
          xy('D', '0', n(-v.a)),
          polar('E', 'O', a, 'φ-90'),
          cross('B', 'D', '', 'φ', 'E', '', '0'),
          polar('A', 'B', a, 'φ+90'),
          polar('C', 'B', a, 'φ'),
        ],
        bodies: [body('ABC', 'A', 'B', 'C')],
        cons: [slider('A', '0'), guide('D', 'ABC', 'B', 'C')],
        drives: [proj('A', '0', '1')],
      };
      return mech(problem, 'ABC', { o: 'B', to: 'C' }, 4, 176);
    },
    book: {
      fixed: 'x² = a(2y − a) — парабола (ось y вниз от O, как в книге; здесь y вверх: y → −y)',
      moving: 'ξ² = a(2η − a) — парабола (начало подвижных осей — B, ξ вдоль BC, η вдоль BA)',
    },
    check: {
      fixed: (v, x, y) => (x * x - v.a * (2 * -y - v.a)) / v.a ** 2,
      moving: (v, xi, eta) => (xi * xi - v.a * (2 * eta - v.a)) / v.a ** 2,
      tol: 1e-6,
    },
    note: 'D — под осью x (в книге ось y направлена вниз, точка D на оси y на расстоянии a от O). φ — угол стороны BC к оси x.',
  },
  m1712: {
    title: 'Мещерский 17.12: кривошипно-шатунный механизм с длинным шатуном (l ≫ r)',
    params: [
      { key: 'r', label: 'r = OA', value: 1 },
      { key: 'l', label: 'l = AB', value: 10, hint: 'l ≫ r' },
    ],
    build: (v) => {
      const problem: MechProblem = {
        points: [xy('O', '0', '0'), polar('A', 'O', n(v.r), 'φ'), onLine('B', 'A', n(v.l), 'O', '0')],
        bodies: [body('OA', 'O', 'A'), body('AB', 'A', 'B')],
        cons: [...fixed('O'), slider('B', '0')],
        drives: [omega('OA', '1')],
      };
      return mech(problem, 'AB', { o: 'B', to: 'A', rot: 180 }, -80, 80);
    },
    book: {
      fixed: '(x − l)²·(x² + y²) = r²·x² (приближённо: sin α ≈ α, cos α ≈ 1)',
      moving: 'l²ξ²(l² + η²) = r²η⁴ (приближённо; начало — B, ξ вдоль шатуна от A к B, η вверх)',
    },
    check: {
      fixed: (v, x, y) => ((x - v.l) ** 2 * (x * x + y * y) - v.r * v.r * x * x) / (v.r * v.r * (x * x + y * y)),
      moving: (v, xi, eta) =>
        eta * eta < 1e-4 * v.l * v.l ? 0 : (v.l * v.l * xi * xi * (v.l * v.l + eta * eta) - v.r * v.r * eta ** 4) / (v.r * v.r * eta ** 4),
      tol: 0.25,
    },
    note: 'Здесь центроиды точные (механизм решается без допущений), а уравнения книги — приближённые, поэтому невязка не нулевая: порядка (r/l)² для неподвижной центроиды. Уравнение подвижной центроиды в книге получено ещё и при x_B ≈ l, его отклонение заметнее и растёт с φ.',
  },
} satisfies Record<string, CentrodePreset>;

export type CentrodePresetKey = keyof typeof CENTRODE_PRESETS;
