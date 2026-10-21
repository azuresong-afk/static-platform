/**
 * Геометрия масс (Мещерский §34; Антонов п. 9.2, 9.5): моменты инерции составного тела.
 *
 * Каждая часть — однородное тело известной формы: масса (или вес P, тогда m = P/g), центр масс C,
 * ось симметрии (у стержня — его направление) и размеры. Центральный тензор инерции части известен
 * по формулам; тензор относительно точки A — по теореме Гюйгенса — Штейнера:
 *   I_A = Σ s_i [ I_Ci + m_i (|d|² E − d dᵀ) ],  d = C_i − A,  s_i = −1 у вырезов.
 * Момент инерции относительно оси, проходящей через A в направлении u: J_u = uᵀ I_A u.
 * Центробежные моменты — в обозначениях Мещерского: J_xy = Σ m x y (в тензоре стоят с минусом).
 */
export type V3 = [number, number, number];
export type PartKind = 'point' | 'rod' | 'ring' | 'disk' | 'tube' | 'cone' | 'sphere' | 'hball' | 'shell' | 'box';

export interface IPart {
  kind: PartKind;
  /** Масса (или вес, если задача задана весами). */
  m: number;
  /** Центр масс части. */
  c: V3;
  /** Ось симметрии части (у стержня — его направление); у бруса не используется. */
  u: V3;
  /** Размеры: l — длина стержня; R, r — радиусы; h — высота; a, b, c — рёбра бруса вдоль x, y, z. */
  p: Record<string, number>;
  /** −1 — вырез (масса вычитается). */
  s: 1 | -1;
}
export interface IProblem {
  parts: IPart[];
  /** Точка оси. */
  A: V3;
  /** Направление оси. */
  axis: V3;
  /** Заданы веса P, массы m = P/g. */
  byWeight: boolean;
}

export const G = 9.81;
export const KINDS: PartKind[] = ['point', 'rod', 'ring', 'disk', 'tube', 'cone', 'sphere', 'hball', 'shell', 'box'];
export const KIND_NAME: Record<PartKind, string> = {
  point: 'точечная масса',
  rod: 'тонкий стержень',
  ring: 'тонкое кольцо (обод)',
  disk: 'диск, сплошной цилиндр',
  tube: 'полый цилиндр, диск с отверстием',
  cone: 'сплошной конус',
  sphere: 'сплошной шар',
  hball: 'полый толстостенный шар',
  shell: 'тонкая сферическая оболочка',
  box: 'брус, прямоугольная пластина',
};
/** Размеры части: ключ и подпись. */
export const PARAMS: Record<PartKind, [string, string][]> = {
  point: [],
  rod: [['l', 'длина l']],
  ring: [['R', 'радиус R']],
  disk: [
    ['R', 'радиус R'],
    ['h', 'высота h'],
  ],
  tube: [
    ['R', 'наружный R'],
    ['r', 'внутренний r'],
    ['h', 'высота h'],
  ],
  cone: [
    ['R', 'радиус основания R'],
    ['h', 'высота h'],
  ],
  sphere: [['R', 'радиус R']],
  hball: [
    ['R', 'наружный R'],
    ['r', 'внутренний r'],
  ],
  shell: [['R', 'радиус R']],
  box: [
    ['a', 'ребро a (вдоль x)'],
    ['b', 'ребро b (вдоль y)'],
    ['c', 'ребро c (вдоль z)'],
  ],
};
/** У каких частей есть ось симметрии. */
export const HAS_AXIS: Record<PartKind, boolean> = { point: false, rod: true, ring: true, disk: true, tube: true, cone: true, sphere: false, hball: false, shell: false, box: false };

const clean = (v: number) => (Math.abs(v) < 1e-12 ? 0 : v);
export const norm = (a: V3) => Math.hypot(a[0], a[1], a[2]);
export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const unit = (a: V3): V3 => {
  const L = norm(a) || 1;
  return [a[0] / L, a[1] / L, a[2] / L];
};
export type M3 = [V3, V3, V3];
const zero3 = (): M3 => [
  [0, 0, 0],
  [0, 0, 0],
  [0, 0, 0],
];

/** Главные центральные моменты: относительно оси симметрии (Ja) и поперечной оси через C (Jt), на единицу массы. */
export function axialMoments(q: IPart): { Ja: number; Jt: number } | null {
  const p = q.p;
  switch (q.kind) {
    case 'point':
      return { Ja: 0, Jt: 0 };
    case 'rod':
      return { Ja: 0, Jt: p.l ** 2 / 12 };
    case 'ring':
      return { Ja: p.R ** 2, Jt: p.R ** 2 / 2 };
    case 'disk':
      return { Ja: p.R ** 2 / 2, Jt: (3 * p.R ** 2 + p.h ** 2) / 12 };
    case 'tube':
      return { Ja: (p.R ** 2 + p.r ** 2) / 2, Jt: (3 * (p.R ** 2 + p.r ** 2) + p.h ** 2) / 12 };
    case 'cone':
      return { Ja: (3 * p.R ** 2) / 10, Jt: (3 * p.R ** 2) / 20 + (3 * p.h ** 2) / 80 };
    case 'sphere':
      return { Ja: (2 * p.R ** 2) / 5, Jt: (2 * p.R ** 2) / 5 };
    case 'hball': {
      const J = p.R > p.r ? ((2 / 5) * (p.R ** 5 - p.r ** 5)) / (p.R ** 3 - p.r ** 3) : (2 / 3) * p.R ** 2;
      return { Ja: J, Jt: J };
    }
    case 'shell':
      return { Ja: (2 * p.R ** 2) / 3, Jt: (2 * p.R ** 2) / 3 };
    default:
      return null;
  }
}

export const massOf = (q: IPart, byWeight: boolean) => (byWeight ? q.m / G : q.m);

/** Центральный тензор инерции части (оси параллельны x, y, z), с массой. */
export function centralTensor(q: IPart, m: number): M3 {
  if (q.kind === 'box') {
    const { a, b, c } = q.p;
    return [
      [(m * (b * b + c * c)) / 12, 0, 0],
      [0, (m * (a * a + c * c)) / 12, 0],
      [0, 0, (m * (a * a + b * b)) / 12],
    ];
  }
  const { Ja, Jt } = axialMoments(q)!;
  const e = unit(q.u);
  const I = zero3();
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) I[i][j] = m * ((i === j ? Jt : 0) + (Ja - Jt) * e[i] * e[j]);
  return I;
}

/** Слагаемое Штейнера: m (|d|² E − d dᵀ). */
export function steinerTensor(m: number, d: V3): M3 {
  const d2 = dot(d, d);
  const I = zero3();
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) I[i][j] = m * ((i === j ? d2 : 0) - d[i] * d[j]);
  return I;
}

const quad = (I: M3, u: V3) => {
  let s = 0;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) s += u[i] * I[i][j] * u[j];
  return s;
};

/** Собственные значения и векторы симметричной матрицы 3×3 (метод Якоби). */
export function eigSym(A: M3): { vals: V3; vecs: M3 } {
  const a = A.map((r) => [...r]) as M3;
  const v: M3 = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  for (let sweep = 0; sweep < 50; sweep++) {
    const off = a[0][1] ** 2 + a[0][2] ** 2 + a[1][2] ** 2;
    if (off < 1e-30 * (1 + a[0][0] ** 2 + a[1][1] ** 2 + a[2][2] ** 2)) break;
    for (const [p, q] of [
      [0, 1],
      [0, 2],
      [1, 2],
    ]) {
      if (Math.abs(a[p][q]) < 1e-300) continue;
      const th = (a[q][q] - a[p][p]) / (2 * a[p][q]);
      const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
      const c = 1 / Math.sqrt(t * t + 1),
        s = t * c;
      for (let k = 0; k < 3; k++) {
        const akp = a[k][p],
          akq = a[k][q];
        a[k][p] = c * akp - s * akq;
        a[k][q] = s * akp + c * akq;
      }
      for (let k = 0; k < 3; k++) {
        const apk = a[p][k],
          aqk = a[q][k];
        a[p][k] = c * apk - s * aqk;
        a[q][k] = s * apk + c * aqk;
      }
      for (let k = 0; k < 3; k++) {
        const vkp = v[k][p],
          vkq = v[k][q];
        v[k][p] = c * vkp - s * vkq;
        v[k][q] = s * vkp + c * vkq;
      }
    }
  }
  return { vals: [a[0][0], a[1][1], a[2][2]], vecs: v };
}

export interface PartResult {
  /** Масса части (со знаком выреза — отдельно, s). */
  m: number;
  /** Центральный момент относительно оси, параллельной заданной. */
  Jc: number;
  /** Расстояние между осями. */
  d: number;
  /** Вклад части: s (Jc + m d²). */
  J: number;
  /** Угол между осью части и заданной осью, градусы (для частей с осью симметрии). */
  theta: number | null;
}
export interface InertiaResult {
  ok: boolean;
  errors: string[];
  parts: PartResult[];
  M: number;
  /** Центр масс системы. */
  C: V3 | null;
  u: V3;
  /** Момент инерции относительно заданной оси. */
  J: number;
  /** Радиус инерции. */
  rho: number | null;
  /** Тензор относительно точки A. */
  IA: M3;
  /** J_x, J_y, J_z относительно осей через A. */
  Jxyz: V3;
  /** Центробежные J_xy, J_yz, J_zx = Σ m x y и т. д. */
  Jprod: V3;
  /** Главные моменты инерции в точке A (по возрастанию) и главные оси. */
  principal: { vals: V3; axes: [V3, V3, V3] };
  /** Центральный момент системы относительно оси, параллельной заданной (через центр масс). */
  Jc: number | null;
}

export function validate(pr: IProblem): string[] {
  const e: string[] = [];
  if (!pr.parts.length) e.push('Нет ни одной части.');
  if (norm(pr.axis) < 1e-12) e.push('Направление оси — нулевой вектор.');
  pr.parts.forEach((q, i) => {
    if (!(q.m > 0)) e.push(`Часть ${i + 1}: масса должна быть положительной.`);
    if (HAS_AXIS[q.kind] && norm(q.u) < 1e-12) e.push(`Часть ${i + 1}: ось части — нулевой вектор.`);
    for (const [k, label] of PARAMS[q.kind]) {
      const v = q.p[k];
      const mayZero = k === 'h' || k === 'r' || q.kind === 'box';
      if (!Number.isFinite(v) || v < 0 || (!mayZero && v === 0)) e.push(`Часть ${i + 1}: ${label} — ${mayZero ? 'неотрицательное' : 'положительное'} число.`);
    }
    if ((q.kind === 'tube' || q.kind === 'hball') && q.p.r >= q.p.R) e.push(`Часть ${i + 1}: внутренний радиус меньше наружного.`);
  });
  return e;
}

export function solveInertia(pr: IProblem): InertiaResult {
  const errors = validate(pr);
  const u = unit(pr.axis);
  const IA = zero3();
  const parts: PartResult[] = [];
  let M = 0;
  const S: V3 = [0, 0, 0];
  if (!errors.length)
    for (const q of pr.parts) {
      const m = massOf(q, pr.byWeight);
      const Ic = centralTensor(q, m);
      const d: V3 = [q.c[0] - pr.A[0], q.c[1] - pr.A[1], q.c[2] - pr.A[2]];
      const St = steinerTensor(m, d);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) IA[i][j] += q.s * (Ic[i][j] + St[i][j]);
      const Jc = quad(Ic, u);
      const dist = norm(cross(d, u));
      const theta = HAS_AXIS[q.kind] && q.kind !== 'point' ? (Math.acos(Math.min(1, Math.abs(dot(unit(q.u), u)))) * 180) / Math.PI : null;
      parts.push({ m, Jc: clean(Jc), d: clean(dist), J: q.s * (Jc + m * dist * dist), theta });
      M += q.s * m;
      for (let i = 0; i < 3; i++) S[i] += q.s * m * q.c[i];
    }
  if (!errors.length && !(M > 1e-12)) errors.push('Масса системы с учётом вырезов должна быть положительной.');
  const ok = !errors.length;
  const J = clean(quad(IA, u));
  const C: V3 | null = ok ? (S.map((x) => clean(x / M)) as V3) : null;
  const eig = eigSym(IA);
  const order = [0, 1, 2].sort((i, j) => eig.vals[i] - eig.vals[j]);
  const principal = { vals: order.map((i) => clean(eig.vals[i])) as V3, axes: order.map((i) => unit([eig.vecs[0][i], eig.vecs[1][i], eig.vecs[2][i]])) as [V3, V3, V3] };
  let Jc: number | null = null;
  if (ok && C) {
    const dc: V3 = [C[0] - pr.A[0], C[1] - pr.A[1], C[2] - pr.A[2]];
    const dd = norm(cross(dc, u));
    Jc = clean(J - M * dd * dd);
  }
  return {
    ok,
    errors,
    parts,
    M,
    C,
    u,
    J,
    rho: ok && J >= 0 ? Math.sqrt(J / M) : null,
    IA,
    Jxyz: [clean(IA[0][0]), clean(IA[1][1]), clean(IA[2][2])],
    Jprod: [clean(-IA[0][1]), clean(-IA[1][2]), clean(-IA[2][0])],
    principal,
    Jc,
  };
}
