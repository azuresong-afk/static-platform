/**
 * Центр тяжести составных фигур, линий, тел и систем грузов (Мещерский §9).
 * Каждая часть: вид, параметры, знак (вырез — «−») и удельный вес k (по умолчанию 1).
 * Центр тяжести: x_C = Σ s·k·m·x / Σ s·k·m, где m — площадь, длина, объём или вес части.
 */
export type Mode = 'area' | 'line' | 'volume' | 'mass';
export type PartKind = 'rect' | 'tri' | 'poly' | 'circle' | 'sector' | 'segment' | 'line' | 'arc' | 'point' | 'box' | 'cyl' | 'cone' | 'sphere' | 'hemi';

export interface CPart {
  kind: PartKind;
  /** Числовые параметры по списку PARAMS[kind]. */
  p: Record<string, number>;
  /** Вершины многоугольника. */
  pts?: [number, number][];
  /** −1 — вырез (отрицательная площадь, объём). */
  s: 1 | -1;
  /** Удельный вес (плотность), по умолчанию 1. */
  k: number;
}
export interface CProblem {
  mode: Mode;
  parts: CPart[];
}

export const KINDS: Record<Mode, PartKind[]> = {
  area: ['rect', 'tri', 'poly', 'circle', 'sector', 'segment'],
  line: ['line', 'arc'],
  volume: ['box', 'cyl', 'cone', 'sphere', 'hemi'],
  mass: ['point'],
};
export const KIND_NAME: Record<PartKind, string> = {
  rect: 'прямоугольник',
  tri: 'треугольник',
  poly: 'многоугольник',
  circle: 'круг',
  sector: 'круговой сектор',
  segment: 'круговой сегмент',
  line: 'отрезок',
  arc: 'дуга окружности',
  point: 'груз',
  box: 'параллелепипед',
  cyl: 'цилиндр',
  cone: 'конус',
  sphere: 'шар',
  hemi: 'полушар',
};
/** Параметры: ключ и подпись. Ось тела ax: 0 — x, 1 — y, 2 — z; dir — ±1 (направление от основания). */
export const PARAMS: Record<PartKind, [string, string][]> = {
  rect: [['x', 'x угла'], ['y', 'y угла'], ['w', 'ширина'], ['h', 'высота']],
  tri: [['x1', 'x₁'], ['y1', 'y₁'], ['x2', 'x₂'], ['y2', 'y₂'], ['x3', 'x₃'], ['y3', 'y₃']],
  poly: [],
  circle: [['cx', 'x центра'], ['cy', 'y центра'], ['r', 'радиус']],
  sector: [['cx', 'x центра'], ['cy', 'y центра'], ['r', 'радиус'], ['a1', 'от угла, °'], ['a2', 'до угла, °']],
  segment: [['cx', 'x центра'], ['cy', 'y центра'], ['r', 'радиус'], ['a1', 'от угла, °'], ['a2', 'до угла, °']],
  line: [['x1', 'x₁'], ['y1', 'y₁'], ['z1', 'z₁'], ['x2', 'x₂'], ['y2', 'y₂'], ['z2', 'z₂']],
  arc: [['cx', 'x центра'], ['cy', 'y центра'], ['r', 'радиус'], ['a1', 'от угла, °'], ['a2', 'до угла, °']],
  point: [['x', 'x'], ['y', 'y'], ['z', 'z'], ['w', 'вес']],
  box: [['x', 'x угла'], ['y', 'y угла'], ['z', 'z угла'], ['a', 'вдоль x'], ['b', 'вдоль y'], ['c', 'вдоль z']],
  cyl: [['x', 'x основания'], ['y', 'y основания'], ['z', 'z основания'], ['r', 'радиус'], ['h', 'высота'], ['ax', 'ось'], ['dir', 'направление']],
  cone: [['x', 'x основания'], ['y', 'y основания'], ['z', 'z основания'], ['r', 'радиус'], ['h', 'высота'], ['ax', 'ось'], ['dir', 'направление']],
  sphere: [['x', 'x центра'], ['y', 'y центра'], ['z', 'z центра'], ['r', 'радиус']],
  hemi: [['x', 'x основания'], ['y', 'y основания'], ['z', 'z основания'], ['r', 'радиус'], ['ax', 'ось'], ['dir', 'направление']],
};

export type V3 = [number, number, number];
const rad = (a: number) => (a * Math.PI) / 180;

export interface PartResult {
  /** Площадь, длина, объём или вес части (без знака и удельного веса). */
  m: number;
  c: V3;
  /** Как получены m и c: формула для текста. */
  how: string;
}

const bad = (how: string): PartResult => ({ m: 0, c: [0, 0, 0], how });

/** Площадь (длина, объём) и центр тяжести одной части. */
export function partProps(q: CPart): PartResult {
  const p = q.p;
  switch (q.kind) {
    case 'rect':
      return { m: p.w * p.h, c: [p.x + p.w / 2, p.y + p.h / 2, 0], how: 'A = b·h; центр — пересечение диагоналей' };
    case 'tri': {
      const A = Math.abs((p.x2 - p.x1) * (p.y3 - p.y1) - (p.x3 - p.x1) * (p.y2 - p.y1)) / 2;
      return { m: A, c: [(p.x1 + p.x2 + p.x3) / 3, (p.y1 + p.y2 + p.y3) / 3, 0], how: 'A = ½|(x₂−x₁)(y₃−y₁) − (x₃−x₁)(y₂−y₁)|; центр — пересечение медиан: среднее координат вершин' };
    }
    case 'poly': {
      const v = q.pts ?? [];
      if (v.length < 3) return bad('нужно не меньше трёх вершин');
      let A = 0,
        cx = 0,
        cy = 0;
      v.forEach(([x0, y0], i) => {
        const [x1, y1] = v[(i + 1) % v.length];
        const cr = x0 * y1 - x1 * y0;
        A += cr;
        cx += (x0 + x1) * cr;
        cy += (y0 + y1) * cr;
      });
      A /= 2;
      return { m: Math.abs(A), c: [cx / (6 * A), cy / (6 * A), 0], how: 'по формулам площади и центра многоугольника (через координаты вершин)' };
    }
    case 'circle':
      return { m: Math.PI * p.r * p.r, c: [p.cx, p.cy, 0], how: 'A = πr²; центр — в центре круга' };
    case 'sector':
    case 'segment':
    case 'arc': {
      const al = rad(p.a2 - p.a1) / 2; // половина центрального угла
      if (!(al > 0)) return bad('угол «до» должен быть больше угла «от»');
      const mid = rad((p.a1 + p.a2) / 2);
      let m: number, d: number, how: string;
      if (q.kind === 'sector') {
        m = p.r * p.r * al;
        d = (2 * p.r * Math.sin(al)) / (3 * al);
        how = 'A = r²α; OC = 2r·sin α/(3α), α — половина центрального угла, C — на биссектрисе угла';
      } else if (q.kind === 'segment') {
        m = (p.r * p.r * (2 * al - Math.sin(2 * al))) / 2;
        d = (4 * p.r * Math.sin(al) ** 3) / (3 * (2 * al - Math.sin(2 * al)));
        how = 'A = r²(2α − sin 2α)/2; OC = 4r·sin³α/(3(2α − sin 2α)), α — половина центрального угла';
      } else {
        m = 2 * p.r * al;
        d = (p.r * Math.sin(al)) / al;
        how = 'L = 2rα; OC = r·sin α/α, α — половина центрального угла';
      }
      return { m, c: [p.cx + d * Math.cos(mid), p.cy + d * Math.sin(mid), 0], how };
    }
    case 'line': {
      const L = Math.hypot(p.x2 - p.x1, p.y2 - p.y1, (p.z2 ?? 0) - (p.z1 ?? 0));
      return { m: L, c: [(p.x1 + p.x2) / 2, (p.y1 + p.y2) / 2, ((p.z1 ?? 0) + (p.z2 ?? 0)) / 2], how: 'центр тяжести отрезка — его середина' };
    }
    case 'point':
      return { m: p.w, c: [p.x, p.y, p.z ?? 0], how: 'груз — материальная точка' };
    case 'box':
      return { m: p.a * p.b * p.c, c: [p.x + p.a / 2, p.y + p.b / 2, p.z + p.c / 2], how: 'V = abc; центр — пересечение диагоналей' };
    case 'sphere':
      return { m: (4 / 3) * Math.PI * p.r ** 3, c: [p.x, p.y, p.z], how: 'V = 4πr³/3; центр — центр шара' };
    case 'cyl':
    case 'cone':
    case 'hemi': {
      const ax = Math.round(p.ax ?? 2),
        dir = (p.dir ?? 1) >= 0 ? 1 : -1;
      const c: V3 = [p.x, p.y, p.z];
      let m: number, off: number, how: string;
      if (q.kind === 'cyl') {
        m = Math.PI * p.r * p.r * p.h;
        off = p.h / 2;
        how = 'V = πr²h; центр — на оси, посередине высоты';
      } else if (q.kind === 'cone') {
        m = (Math.PI * p.r * p.r * p.h) / 3;
        off = p.h / 4;
        how = 'V = πr²h/3; центр — на оси, на расстоянии h/4 от основания';
      } else {
        m = (2 / 3) * Math.PI * p.r ** 3;
        off = (3 * p.r) / 8;
        how = 'V = 2πr³/3; центр — на оси, на расстоянии 3r/8 от плоскости основания';
      }
      c[ax] += dir * off;
      return { m, c, how };
    }
  }
}

export interface CentroidResult {
  parts: (PartResult & { w: number })[];
  /** Σ s·k·m. */
  M: number;
  c: V3 | null;
  /** Есть ли координата z (тела, грузы, пространственные отрезки). */
  is3d: boolean;
}

export function solveCentroid(pr: CProblem): CentroidResult {
  const parts = pr.parts.map((q) => {
    const r = partProps(q);
    return { ...r, w: q.s * (q.k || 0) * r.m };
  });
  const M = parts.reduce((s, x) => s + x.w, 0);
  const is3d = pr.mode === 'volume' || pr.mode === 'mass' || parts.some((x) => Math.abs(x.c[2]) > 1e-12);
  if (Math.abs(M) < 1e-12) return { parts, M, c: null, is3d };
  const c = [0, 1, 2].map((i) => parts.reduce((s, x) => s + x.w * x.c[i], 0) / M) as V3;
  return { parts, M, c, is3d };
}
