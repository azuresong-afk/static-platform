/**
 * Данные конструкции — то, что вводит пользователь и что сохраняется в истории.
 * Производные величины (координаты, углы сил) сюда не входят: их считает resolve().
 */

/** Направление участка по оси: вправо, влево, вверх, вниз. */
export type Dir = 'r' | 'l' | 'u' | 'd';
/** Направление участка: по оси или под углом (a) — тогда угол задаёт поле ang. */
export type SegDir = Dir | 'a';

export interface Node {
  id: string;
  /** Внутренний шарнир: участки, сходящиеся в точке, соединены шарнирно (передают силу, но не момент). */
  hinge?: boolean;
  /**
   * Соединение скользящей заделкой (гладкой втулкой): части могут смещаться друг относительно друга вдоль направляющей,
   * но не поперёк и не поворачиваются — передают силу по нормали к направляющей и момент. Значение — угол нормали
   * (направления взаимной силы R) к оси x, град.
   */
  slide?: number;
}

/** Участок рамы: из узла a в узел b (a — родитель в дереве обхода). */
export interface Seg {
  id: string;
  a: string;
  b: string;
  dir: SegDir;
  /** Длина по оси участка, м. */
  len: number;
  /** Для dir = 'a': угол участка к оси x (от a к b), град, против часовой стрелки, 0…360, не кратен 90°. */
  ang?: number;
}

/** Где лежит опорная поверхность относительно точки. */
export type Side = 'below' | 'above' | 'left' | 'right';
/** Направление, от которого отсчитывается угол силы. */
export type RefDir = 'right' | 'left' | 'up' | 'down';
/** Сторона отсчёта угла / направление момента. */
export type Rot = 'cw' | 'ccw';
/**
 * Направление распределённой нагрузки: по осям или перпендикулярно наклонному участку
 * (nu — в сторону, где выше, nd — в сторону, где ниже).
 */
export type LoadDir = 'down' | 'up' | 'right' | 'left' | 'nu' | 'nd';

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
  /** Односторонняя связь: реакция может только давить (R ≥ 0), каток может оторваться. */
  oneSided?: boolean;
}
/**
 * Опора с трением (шероховатая поверхность): нормальная реакция N ≥ 0 и сила трения |Fтр| ≤ f·N вдоль поверхности;
 * при k > 0 — ещё момент сопротивления качению |Mк| ≤ k·N. Связь всегда односторонняя.
 */
export interface RoughItem extends AtItem {
  type: 'rough';
  side: Side | 'tilt';
  /** Угол нормальной реакции к оси x, град (как у катка). */
  angle?: number;
  angleName?: string;
  /** Коэффициент трения скольжения. */
  f: number;
  /** Коэффициент трения качения, м (0 — не учитывать). */
  k?: number;
}
/**
 * Скользящая заделка (ползун с заделкой, «гладкая втулка»): точка может смещаться вдоль направляющей, но не поперёк неё,
 * и не может поворачиваться — реакция R по нормали к направляющей и реактивный момент M. Направляющая задаётся,
 * как у катка: стороной (below/above — горизонтальная, left/right — вертикальная) или углом реакции (tilt).
 */
export interface SlideItem extends AtItem {
  type: 'slide';
  side: Side | 'tilt';
  /** Угол реакции R к оси x, град. */
  angle?: number;
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

export type SupportItem = FixedItem | PinItem | RollerItem | RodItem | RoughItem | SlideItem;
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
  it.type === 'fixed' || it.type === 'pin' || it.type === 'roller' || it.type === 'rod' || it.type === 'rough' || it.type === 'slide';

/** Omit, применённый к каждому варианту объединения по отдельности. */
export type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
/** Данные элемента без идентификатора. */
export type ItemData = DistributiveOmit<Item, 'id'>;
