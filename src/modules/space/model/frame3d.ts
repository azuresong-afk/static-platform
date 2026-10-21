/**
 * Пространственный ломаный брус-консоль (Антонов, задача 3): участки вдоль осей x, y, z от заделки к свободному концу,
 * сосредоточенные силы и пары в точках, равномерная нагрузка на участках. Сечение — круг или кольцо.
 *
 * Оси: x — вправо, y — «вглубь» (от зрителя), z — вверх. Точка 0 — заделка, точки 1…n — концы участков.
 * Внутренние усилия в сечении — от нагрузок свободной части (от сечения до свободного конца), приведённые к центру
 * сечения: F (главный вектор) и M (главный момент). Для участка с ортом t (от заделки к свободному концу):
 *   N = F·t (растяжение «+»);  M_к = M·t (крутящий момент; «+» — против часовой стрелки, если смотреть на сечение
 *   со стороны внешней нормали);  изгибающие моменты — проекции M на две другие оси; поперечные силы — проекции F.
 * Изгиб: момент, направленный по оси a, сжимает волокна со стороны −(t × a) — туда откладывается ордината эпюры
 * (строительная механика — наоборот, на растянутых волокнах).
 * Прочность по третьей гипотезе: M_экв = √(M₁² + M₂² + M_к²); по четвёртой — √(M₁² + M₂² + 0,75·M_к²).
 * Единицы: кН, кН·м, кН/м, м; напряжения — МПа; W — см³; размеры — см (в тексте — мм).
 */
import { polyAdd, polyDeriv, polyEval, type Poly } from '../../../shared/poly';

export type Axis = 'x' | 'y' | 'z';
export type V3 = [number, number, number];

export interface Seg3 {
  axis: Axis;
  /** +1 — по оси, −1 — против. */
  sign: 1 | -1;
  /** Длина, м. */
  l: number;
}

export type Load3 =
  /** Сила в точке node вдоль оси, значение со знаком (кН). */
  | { kind: 'P'; node: number; axis: Axis; v: number }
  /** Пара в точке node: вектор момента вдоль оси, «+» — против часовой, если смотреть с конца оси (кН·м). */
  | { kind: 'M'; node: number; axis: Axis; v: number }
  /** Равномерная нагрузка на участке seg (номер от 0), направление — ось со знаком (кН/м). */
  | { kind: 'q'; seg: number; axis: Axis; v: number };

export interface Frame3 {
  segs: Seg3[];
  loads: Load3[];
  section: 'circle' | 'ring';
  /** d/D кольца. */
  c: number;
  /** Допускаемое напряжение, МПа. */
  sigma: number;
  /** Гипотеза прочности: третья (наибольших касательных) или четвёртая (энергетическая). */
  hyp: 3 | 4;
}

export const AX: Record<Axis, V3> = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** Координаты точек 0…n. */
export function points(f: Frame3): V3[] {
  const p: V3[] = [[0, 0, 0]];
  for (const s of f.segs) p.push(add(p[p.length - 1], mul(AX[s.axis], s.sign * s.l)));
  return p;
}

/** Векторный многочлен от s: [c0, c1, c2] для каждой компоненты. */
type VPoly = [Poly, Poly, Poly];
const vConst = (v: V3): VPoly => [[v[0]], [v[1]], [v[2]]];
const vAdd = (a: VPoly, b: VPoly): VPoly => [polyAdd(a[0], b[0]), polyAdd(a[1], b[1]), polyAdd(a[2], b[2])];
const vDot = (a: VPoly, u: V3): Poly => polyAdd(polyAdd(a[0].map((c) => c * u[0]), a[1].map((c) => c * u[1])), a[2].map((c) => c * u[2]));

export interface Component {
  /** Глобальная ось, по которой направлен вектор усилия (для Q — сила, для M — момент). */
  axis: Axis;
  poly: Poly;
}

export interface SegResult {
  index: number;
  /** Орт участка (от заделки к свободному концу) и его ось. */
  t: V3;
  axis: Axis;
  sign: 1 | -1;
  L: number;
  P0: V3;
  N: Poly;
  /** Поперечные силы по двум другим осям. */
  Q: Component[];
  /** Изгибающие моменты по двум другим осям. */
  Mb: Component[];
  Mk: Poly;
  /** Эквивалентный момент в характерных сечениях: s → M_экв. */
  eq: { s: number; v: number }[];
}

export interface Solution3 {
  pts: V3[];
  segs: SegResult[];
  /** Реакции заделки: сила и момент, действующие на брус. */
  R: V3;
  MR: V3;
  /** Опасное сечение. */
  danger: { seg: number; s: number; M1: number; M2: number; Mk: number; Meq: number };
  /** Требуемый момент сопротивления, см³. */
  Wreq: number;
  /** Круг: d; кольцо: D и d = c·D (см), расчётные и принятые (округление вверх до мм). */
  size: { calc: number; D: number; d: number };
  /** Момент сопротивления принятого сечения, см³, и напряжение в нём, МПа. */
  W: number;
  sigmaEq: number;
}

/** Все внешние нагрузки как силы в точках и пары (распределённая — точно, интегралом по своему участку). */
function freeResultant(f: Frame3, pts: V3[], i: number): { F: VPoly; M: VPoly } {
  const seg = f.segs[i];
  const t = mul(AX[seg.axis], seg.sign);
  const P0 = pts[i];
  const L = seg.l;
  let F: VPoly = vConst([0, 0, 0]);
  let M: VPoly = vConst([0, 0, 0]);
  // Точка сечения P(s) = P0 + s·t. Момент силы F в точке r: (r − P0 − s·t) × F = (r − P0)×F − s·(t × F).
  const pointForce = (r: V3, Fv: V3) => {
    F = vAdd(F, vConst(Fv));
    const c0 = cross(sub(r, P0), Fv),
      c1 = mul(cross(t, Fv), -1);
    M = vAdd(M, [
      [c0[0], c1[0]],
      [c0[1], c1[1]],
      [c0[2], c1[2]],
    ]);
  };
  for (const ld of f.loads) {
    if (ld.kind === 'P' && ld.node > i) pointForce(pts[ld.node], mul(AX[ld.axis], ld.v));
    if (ld.kind === 'M' && ld.node > i) M = vAdd(M, vConst(mul(AX[ld.axis], ld.v)));
    if (ld.kind === 'q' && ld.seg > i) {
      // Участок целиком в свободной части: равнодействующая q·l в середине.
      const s2 = f.segs[ld.seg];
      pointForce(mul(add(pts[ld.seg], pts[ld.seg + 1]), 0.5), mul(AX[ld.axis], ld.v * s2.l));
    }
    if (ld.kind === 'q' && ld.seg === i) {
      // Своя часть участка от s до L: сила q·(L − s)·d в точке P(s) + (L − s)/2·t;
      // момент относительно P(s): ((L − s)/2·t) × (q·(L − s)·d) = q·(L − s)²/2·(t × d).
      const d = mul(AX[ld.axis], ld.v);
      const R: Poly = [L, -1]; // L − s
      F = vAdd(F, [R.map((c) => c * d[0]), R.map((c) => c * d[1]), R.map((c) => c * d[2])]);
      const td = cross(t, d);
      const sq: Poly = [(L * L) / 2, -L, 0.5]; // (L − s)²/2
      M = vAdd(M, [sq.map((c) => c * td[0]), sq.map((c) => c * td[1]), sq.map((c) => c * td[2])]);
    }
  }
  return { F, M };
}

const others = (a: Axis): Axis[] => (['x', 'y', 'z'] as Axis[]).filter((x) => x !== a);

/** M_экв по гипотезе. */
export const meq = (M1: number, M2: number, Mk: number, hyp: 3 | 4) => Math.sqrt(M1 * M1 + M2 * M2 + (hyp === 3 ? 1 : 0.75) * Mk * Mk);

/** Округление размера (см) вверх до миллиметра. */
const ceilMm = (cm: number) => Math.ceil(cm * 10 - 1e-9) / 10;

export function solveFrame3(f: Frame3): Solution3 {
  const pts = points(f);
  const segs: SegResult[] = f.segs.map((sg, i) => {
    const t = mul(AX[sg.axis], sg.sign);
    const { F, M } = freeResultant(f, pts, i);
    const [a1, a2] = others(sg.axis);
    const comp = (V: VPoly, ax: Axis): Component => ({ axis: ax, poly: vDot(V, AX[ax]) });
    const Mb = [comp(M, a1), comp(M, a2)];
    const Mk = vDot(M, t);
    // Характерные сечения: концы и экстремумы M_экв² (многочлен до 4-й степени) — по корням производной.
    const sq = (p: Poly) => p.flatMap((c, k) => p.map((d, j) => ({ k: k + j, v: c * d }))).reduce<Poly>((acc, { k, v }) => ((acc[k] = (acc[k] ?? 0) + v), acc), []);
    const w = f.hyp === 3 ? 1 : 0.75;
    const E2 = polyAdd(polyAdd(sq(Mb[0].poly), sq(Mb[1].poly)), sq(Mk).map((c) => c * w));
    const dE = polyDeriv(E2);
    const cand = new Set<number>([0, sg.l]);
    // Корни производной (степень ≤ 3) — перебором знака на сетке и делением отрезка пополам.
    const n = 400;
    let prev = polyEval(dE, 0);
    for (let k = 1; k <= n; k++) {
      const s = (sg.l * k) / n,
        cur = polyEval(dE, s);
      // Корень ровно в узле сетки — сразу кандидат (иначе произведение соседей равно нулю и корень теряется).
      if (cur === 0) cand.add(s);
      else if (prev * cur < 0) {
        let lo = (sg.l * (k - 1)) / n,
          hi = s;
        for (let it = 0; it < 80; it++) {
          const mid = (lo + hi) / 2;
          if (polyEval(dE, lo) * polyEval(dE, mid) <= 0) hi = mid;
          else lo = mid;
        }
        cand.add((lo + hi) / 2);
      }
      prev = cur;
    }
    const eq = [...cand].sort((x, y) => x - y).map((s) => ({ s, v: Math.sqrt(Math.max(0, polyEval(E2, s))) }));
    return { index: i, t, axis: sg.axis, sign: sg.sign, L: sg.l, P0: pts[i], N: vDot(F, t), Q: [comp(F, a1), comp(F, a2)], Mb, Mk, eq };
  });
  // Реакции заделки: равновесие всего бруса (свободная часть участка 0 при s = 0).
  const { F: F0, M: M0 } = freeResultant(f, pts, 0);
  const R = mul(F0.map((p) => polyEval(p, 0)) as V3, -1);
  const MR = mul(M0.map((p) => polyEval(p, 0)) as V3, -1);

  let danger = { seg: 0, s: 0, M1: 0, M2: 0, Mk: 0, Meq: -1 };
  for (const sg of segs)
    for (const e of sg.eq)
      if (e.v > danger.Meq + 1e-12) {
        danger = { seg: sg.index, s: e.s, M1: polyEval(sg.Mb[0].poly, e.s), M2: polyEval(sg.Mb[1].poly, e.s), Mk: polyEval(sg.Mk, e.s), Meq: e.v };
      }
  const Wreq = (danger.Meq * 1e3) / f.sigma;
  const k = f.section === 'ring' ? 1 - f.c ** 4 : 1;
  const calc = Math.cbrt((32 * Wreq) / (Math.PI * k));
  const D = ceilMm(calc);
  const d = f.section === 'ring' ? Math.floor(f.c * D * 10 + 1e-9) / 10 : 0;
  const W = f.section === 'ring' ? (Math.PI * (D ** 4 - d ** 4)) / (32 * D) : (Math.PI * D ** 3) / 32;
  return { pts, segs, R, MR, danger, Wreq, size: { calc, D, d }, W, sigmaEq: (danger.Meq * 1e3) / W };
}
