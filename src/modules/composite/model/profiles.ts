/**
 * Прокатные профили и лист для составных сечений (Антонов, задача 6).
 * Двутавры — ГОСТ 8239-89 (из раздела «Подбор сечения»); швеллеры — ГОСТ 8240-97 (серия У, уклон полок);
 * уголки равнополочные — ГОСТ 8509-93, неравнополочные — ГОСТ 8510-86 (номера со схем задачи 6).
 * Размеры в таблицах — мм, площади — см², моменты инерции — см⁴, координаты центра тяжести — см.
 *
 * Базовое положение профиля (до разворота), габарит [0, w] × [0, h], ось y — вверх:
 *   лист — прямоугольник w × h;
 *   двутавр — стенка вертикальна;
 *   швеллер «[» — стенка слева, полки вправо; центр тяжести на z0 от спинки стенки;
 *   уголок «L» — одна полка вдоль левого края, другая — вдоль нижнего; у неравнополочного длинная полка вертикальна.
 * Свойства — относительно собственных центральных осей, параллельных краям габарита; I_xy = ∫(x − xc)(y − yc)dA.
 * Контур — упрощённый (без уклонов и скруглений), только для чертежа и крайних точек.
 */
import { GOST_8239 } from '../../sections/model/sortament';

export interface Channel {
  no: string;
  h: number;
  b: number;
  s: number;
  t: number;
  A: number;
  Ix: number;
  Wx: number;
  Iy: number;
  z0: number;
}

const ch = (no: string, h: number, b: number, s: number, t: number, A: number, Ix: number, Wx: number, Iy: number, z0: number): Channel => ({ no, h, b, s, t, A, Ix, Wx, Iy, z0 });

export const GOST_8240: Channel[] = [
  ch('10', 100, 46, 4.5, 7.6, 10.9, 174, 34.8, 20.4, 1.44),
  ch('12', 120, 52, 4.8, 7.8, 13.3, 304, 50.6, 31.2, 1.54),
  ch('14', 140, 58, 4.9, 8.1, 15.6, 491, 70.2, 45.4, 1.67),
  ch('16', 160, 64, 5.0, 8.4, 18.1, 747, 93.4, 63.3, 1.8),
  ch('18', 180, 70, 5.1, 8.7, 20.7, 1090, 121, 86.0, 1.94),
  ch('20', 200, 76, 5.2, 9.0, 23.4, 1520, 152, 113, 2.07),
  ch('22', 220, 82, 5.4, 9.5, 26.7, 2110, 192, 151, 2.21),
  ch('24', 240, 90, 5.6, 10.0, 30.6, 2900, 242, 208, 2.42),
  ch('27', 270, 95, 6.0, 10.5, 35.2, 4160, 308, 262, 2.47),
  ch('30', 300, 100, 6.5, 11.0, 40.5, 5810, 387, 327, 2.52),
];

export interface Angle {
  /** «80x8» или «140x90x10». */
  no: string;
  /** Вертикальная (длинная) и горизонтальная полки, толщина, мм. */
  B: number;
  b: number;
  t: number;
  A: number;
  /** Относительно центральных осей, параллельных полкам: Ix — горизонтальной (вдоль короткой полки), Iy — вертикальной. */
  Ix: number;
  Iy: number;
  /** Центр тяжести от спинки вертикальной полки (x0) и от спинки горизонтальной (y0), см. */
  x0: number;
  y0: number;
  /** Минимальный главный момент инерции, см⁴ (по нему находится I_xy). */
  Imin: number;
}

/** Равнополочные ГОСТ 8509-93: b × t, A, Ix, Ix0 (max), Iy0 (min), z0. */
const eq = (b: number, t: number, A: number, Ix: number, Imin: number, z0: number): Angle => ({ no: `${b}x${t}`, B: b, b, t, A, Ix, Iy: Ix, x0: z0, y0: z0, Imin });
/** Неравнополочные ГОСТ 8510-86: B × b × t, A, Ix, Iy, x0, y0, Iu (min). */
const uneq = (B: number, b: number, t: number, A: number, Ix: number, Iy: number, x0: number, y0: number, Imin: number): Angle => ({ no: `${B}x${b}x${t}`, B, b, t, A, Ix, Iy, x0, y0, Imin });

export const ANGLES: Angle[] = [
  eq(50, 5, 4.8, 11.2, 4.63, 1.42),
  eq(70, 7, 9.42, 42.98, 17.77, 1.99),
  eq(80, 8, 12.3, 73.36, 30.32, 2.27),
  eq(90, 8, 13.9, 106.11, 43.8, 2.51),
  uneq(140, 90, 10, 22.2, 444, 146, 2.12, 4.58, 85.5),
  uneq(160, 100, 10, 25.3, 667, 204, 2.28, 5.23, 121),
];

/** |I_xy| уголка из главного минимального момента: Imin = (Ix+Iy)/2 − √(((Ix−Iy)/2)² + Ixy²). */
export const angleIxy = (a: Angle): number => -Math.sqrt(Math.max(0, ((a.Ix + a.Iy) / 2 - a.Imin) ** 2 - ((a.Ix - a.Iy) / 2) ** 2));

export type Pt = [number, number];

/** Фигура в базовом положении: габарит, центр тяжести, центральные моменты, контур (см). */
export interface Shape {
  w: number;
  h: number;
  A: number;
  cx: number;
  cy: number;
  Ix: number;
  Iy: number;
  Ixy: number;
  outline: Pt[];
}

export type PartKind = 'plate' | 'ibeam' | 'channel' | 'angle';

export function plateShape(wMm: number, hMm: number): Shape {
  const w = wMm / 10,
    h = hMm / 10;
  return { w, h, A: w * h, cx: w / 2, cy: h / 2, Ix: (w * h ** 3) / 12, Iy: (h * w ** 3) / 12, Ixy: 0, outline: [[0, 0], [w, 0], [w, h], [0, h]] };
}

export function ibeamShape(no: string): Shape | null {
  const p = GOST_8239.find((x) => x.no === no);
  if (!p) return null;
  const w = p.b / 10,
    h = p.h / 10,
    s = p.s / 10,
    t = p.t / 10;
  const l = (w - s) / 2;
  return {
    w,
    h,
    A: p.A,
    cx: w / 2,
    cy: h / 2,
    Ix: p.Ix,
    Iy: p.Iy,
    Ixy: 0,
    outline: [[0, 0], [w, 0], [w, t], [l + s, t], [l + s, h - t], [w, h - t], [w, h], [0, h], [0, h - t], [l, h - t], [l, t], [0, t]],
  };
}

export function channelShape(no: string): Shape | null {
  const c = GOST_8240.find((x) => x.no === no);
  if (!c) return null;
  const w = c.b / 10,
    h = c.h / 10,
    s = c.s / 10,
    t = c.t / 10;
  return { w, h, A: c.A, cx: c.z0, cy: h / 2, Ix: c.Ix, Iy: c.Iy, Ixy: 0, outline: [[0, 0], [w, 0], [w, t], [s, t], [s, h - t], [w, h - t], [w, h], [0, h]] };
}

export function angleShape(no: string): Shape | null {
  const a = ANGLES.find((x) => x.no === no);
  if (!a) return null;
  const w = a.b / 10,
    h = a.B / 10,
    t = a.t / 10;
  return { w, h, A: a.A, cx: a.x0, cy: a.y0, Ix: a.Ix, Iy: a.Iy, Ixy: angleIxy(a), outline: [[0, 0], [w, 0], [w, t], [t, t], [t, h], [0, h]] };
}

export function shapeOf(kind: PartKind, no: string, w: number, h: number): Shape | null {
  if (kind === 'plate') return w > 0 && h > 0 ? plateShape(w, h) : null;
  if (kind === 'ibeam') return ibeamShape(no);
  if (kind === 'channel') return channelShape(no);
  return angleShape(no);
}

/** Номера профилей для выбора в интерфейсе. */
export const PROFILE_NOS: Record<Exclude<PartKind, 'plate'>, string[]> = {
  ibeam: GOST_8239.map((p) => p.no),
  channel: GOST_8240.map((c) => c.no),
  angle: ANGLES.map((a) => a.no),
};
