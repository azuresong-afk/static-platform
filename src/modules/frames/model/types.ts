/**
 * Данные конструкции — то, что вводит пользователь и что сохраняется в истории.
 * Производные величины (координаты, углы сил) сюда не входят: их считает resolve().
 */

/** Направление участка: вправо, влево, вверх, вниз. */
export type Dir = 'r' | 'l' | 'u' | 'd';

export interface Node {
  id: string;
  /** Внутренний шарнир: участки, сходящиеся в точке, соединены шарнирно (передают силу, но не момент). */
  hinge?: boolean;
}

/** Участок рамы: из узла a в узел b (a — родитель в дереве обхода). */
export interface Seg {
  id: string;
  a: string;
  b: string;
  dir: Dir;
  len: number;
}

/** Где лежит опорная поверхность относительно точки. */
export type Side = 'below' | 'above' | 'left' | 'right';
/** Направление, от которого отсчитывается угол силы. */
export type RefDir = 'right' | 'left' | 'up' | 'down';
/** Сторона отсчёта угла / направление момента. */
export type Rot = 'cw' | 'ccw';
/** Направление распределённой нагрузки. */
export type LoadDir = 'down' | 'up' | 'right' | 'left';

interface AtItem {
  id: string;
  /** Узел, к которому привязан элемент. */
  at: string;
}

export interface FixedItem extends AtItem {
  type: 'fixed';
  side: Side;
  /** Производное (SIDES[side].ang), прототип хранит его в состоянии. */
  angle?: number;
}
export interface PinItem extends AtItem {
  type: 'pin';
  side: Side;
  angle?: number;
}
export interface RollerItem extends AtItem {
  type: 'roller';
  side: Side | 'tilt';
  /** Угол реакции к оси x, град. Для side ≠ tilt синхронизируется с SIDES[side].ang. */
  angle?: number;
  /** Обозначение угла наклонной поверхности (α, β…) — в решении углы пишутся буквой. */
  angleName?: string;
}
export interface RodItem extends AtItem {
  type: 'rod';
  /** Угол стержня к оси x, град. Положительное S направлено под этим углом. */
  angle: number;
  /** Обозначение угла (α, β…). */
  angleName?: string;
}
export interface ForceItem extends AtItem {
  type: 'force';
  F: number;
  ref: RefDir;
  rot: Rot;
  alpha: number;
  unknown: boolean;
  /** Обозначение угла α (α, β…): в уравнениях пишется буквой, значение — alpha. */
  angleName?: string;
}
export interface WeightItem extends AtItem {
  type: 'weight';
  G: number;
}
export interface MomentItem extends AtItem {
  type: 'moment';
  M: number;
  dir: Rot;
  unknown: boolean;
}
export interface DistItem {
  id: string;
  type: 'dist';
  from: string;
  to: string;
  q1: number;
  q2: number;
  dir: LoadDir;
}

export type SupportItem = FixedItem | PinItem | RollerItem | RodItem;
export type LoadItem = ForceItem | WeightItem | MomentItem | DistItem;
export type Item = SupportItem | LoadItem;
export type ItemType = Item['type'];
export type SupportType = SupportItem['type'];

export interface Structure {
  nodes: Node[];
  segs: Seg[];
  items: Item[];
}

export const isSupport = (it: Item): it is SupportItem =>
  it.type === 'fixed' || it.type === 'pin' || it.type === 'roller' || it.type === 'rod';

/** Omit, применённый к каждому варианту объединения по отдельности. */
export type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
/** Данные элемента без идентификатора. */
export type ItemData = DistributiveOmit<Item, 'id'>;
