/**
 * Составное сечение: части (лист или профиль) с разворотом, отражением и положением; сборка по теореме
 * о параллельном переносе осей, главные центральные оси, моменты сопротивления, нейтральная линия и напряжения
 * при изгибе в вертикальной плоскости (задача 6 Антонова).
 *
 * Координаты — мм во входных данных, см в расчёте; y — вверх. Положение части — левый нижний угол её габарита
 * после разворота. Разворот — на 0/90/180/270° против часовой стрелки, отражение — зеркально относительно
 * вертикальной оси (выполняется до разворота).
 */
import { shapeOf, type PartKind, type Pt, type Shape } from './profiles';

export interface Part {
  kind: PartKind;
  /** Номер профиля (для листа — не используется). */
  no: string;
  /** Размеры листа, мм. */
  w: number;
  h: number;
  rot: 0 | 90 | 180 | 270;
  mirror: boolean;
  /** Левый нижний угол габарита, мм. */
  x: number;
  y: number;
}

/** Отражение относительно вертикальной оси габарита. */
export function mirrorShape(s: Shape): Shape {
  return { ...s, cx: s.w - s.cx, Ixy: -s.Ixy, outline: s.outline.map(([x, y]) => [s.w - x, y] as Pt) };
}

/** Поворот на 90° против часовой стрелки с возвратом габарита в [0, h] × [0, w]: (x, y) → (h − y, x). */
export function rot90(s: Shape): Shape {
  return { w: s.h, h: s.w, A: s.A, cx: s.h - s.cy, cy: s.cx, Ix: s.Iy, Iy: s.Ix, Ixy: -s.Ixy, outline: s.outline.map(([x, y]) => [s.h - y, x] as Pt) };
}

export interface Placed extends Shape {
  index: number;
  part: Part;
  /** Центр тяжести в координатах сечения, см. */
  X: number;
  Y: number;
  /** Контур в координатах сечения, см. */
  poly: Pt[];
}

export function placePart(p: Part, index: number): Placed | null {
  let s = shapeOf(p.kind, p.no, p.w, p.h);
  if (!s) return null;
  if (p.mirror) s = mirrorShape(s);
  for (let k = 0; k < p.rot / 90; k++) s = rot90(s);
  const ox = p.x / 10,
    oy = p.y / 10;
  return { ...s, index, part: p, X: ox + s.cx, Y: oy + s.cy, poly: s.outline.map(([x, y]) => [ox + x, oy + y] as Pt) };
}

export interface SectionResult {
  parts: Placed[];
  A: number;
  /** Центр тяжести, см. */
  xc: number;
  yc: number;
  /** Центральные моменты инерции относительно осей X, Y, параллельных исходным, см⁴. */
  Ix: number;
  Iy: number;
  Ixy: number;
  /** Главные: угол оси u от X против часовой стрелки (град), I_u ≥ I_v. */
  alpha: number;
  Iu: number;
  Iv: number;
  /** Сечение симметрично относительно вертикальной оси (I_xy ≈ 0): главные оси — X и Y. */
  principalXY: boolean;
  /** Расстояния от центральных осей до крайних точек, см. */
  yTop: number;
  yBottom: number;
  xRight: number;
  xLeft: number;
  /** Моменты сопротивления, см³: W_x = I_x/y_max, W_y = I_y/x_max (по главным осям X, Y). */
  Wx: number;
  Wy: number;
  WxTop: number;
  WxBottom: number;
  /** Нейтральная линия при моменте в вертикальной плоскости: y = k·x (k = I_xy/I_y); угол, град. */
  neutralSlope: number;
  neutralAngle: number;
  /** Наиболее нагруженная точка (дальняя от нейтральной линии) и напряжение при M (МПа), если M задан. */
  critical: { x: number; y: number; sigmaPerM: number };
}

export function solveSection(parts: Part[]): SectionResult | null {
  const placed = parts.map(placePart).filter((p): p is Placed => p !== null);
  if (!placed.length) return null;
  const A = placed.reduce((a, p) => a + p.A, 0);
  const xc = placed.reduce((a, p) => a + p.A * p.X, 0) / A;
  const yc = placed.reduce((a, p) => a + p.A * p.Y, 0) / A;
  const Ix = placed.reduce((a, p) => a + p.Ix + p.A * (p.Y - yc) ** 2, 0);
  const Iy = placed.reduce((a, p) => a + p.Iy + p.A * (p.X - xc) ** 2, 0);
  let Ixy = placed.reduce((a, p) => a + p.Ixy + p.A * (p.X - xc) * (p.Y - yc), 0);
  const scale = Math.max(Ix, Iy);
  if (Math.abs(Ixy) < 1e-9 * scale) Ixy = 0;
  const principalXY = Ixy === 0;
  // tg 2α = −2·I_xy/(I_x − I_y); α — угол оси с наибольшим моментом.
  const mean = (Ix + Iy) / 2,
    R = Math.hypot((Ix - Iy) / 2, Ixy);
  let alpha = (0.5 * Math.atan2(-2 * Ixy, Ix - Iy) * 180) / Math.PI;
  if (Math.abs(alpha) < 1e-12) alpha = 0;
  const pts = placed.flatMap((p) => p.poly).map(([x, y]) => [x - xc, y - yc] as Pt);
  const yTop = Math.max(...pts.map((p) => p[1])),
    yBottom = -Math.min(...pts.map((p) => p[1]));
  const xRight = Math.max(...pts.map((p) => p[0])),
    xLeft = -Math.min(...pts.map((p) => p[0]));
  // Изгиб в вертикальной плоскости моментом M, «+» — сжаты верхние волокна (как в «Изгибе»):
  // σ = −M·(I_y·y − I_xy·x)/(I_x·I_y − I_xy²); при I_xy = 0 — σ = −M·y/I_x.
  // Нейтральная линия: I_y·y − I_xy·x = 0. Напряжение на единицу M (кН·м, см → МПа: ×10³).
  const D = Ix * Iy - Ixy * Ixy;
  const sig = ([x, y]: Pt) => (-1e3 * (Iy * y - Ixy * x)) / D;
  let crit = pts[0];
  for (const p of pts) if (Math.abs(sig(p)) > Math.abs(sig(crit)) + 1e-12) crit = p;
  const k = Ixy / Iy;
  return {
    parts: placed,
    A,
    xc,
    yc,
    Ix,
    Iy,
    Ixy,
    alpha,
    Iu: mean + R,
    Iv: mean - R,
    principalXY,
    yTop,
    yBottom,
    xRight,
    xLeft,
    Wx: Ix / Math.max(yTop, yBottom),
    Wy: Iy / Math.max(xRight, xLeft),
    WxTop: Ix / yTop,
    WxBottom: Ix / yBottom,
    neutralSlope: k,
    neutralAngle: (Math.atan(k) * 180) / Math.PI,
    critical: { x: crit[0], y: crit[1], sigmaPerM: sig(crit) },
  };
}
