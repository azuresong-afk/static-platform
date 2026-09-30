import type { Dir, ForceItem, ItemType, LoadDir, RefDir, Seg, Side } from './types';
import type { RefAxis } from '../../../shared/format';

/** Буквы для точек. Пропущены буквы, занятые обозначениями сил и реакций (F, G, M, Q, R, S, X, Y…). */
export const LETTERS = 'ABCDEHKLNOPTUVWZ'.split('');
export const ptName = (i: number): string => LETTERS[i] || 'P' + i;

export const TYPES: Record<ItemType, { name: string; support?: true }> = {
  fixed: { name: 'Жёсткая заделка', support: true },
  pin: { name: 'Шарнирно-неподвижная опора', support: true },
  roller: { name: 'Шарнирно-подвижная опора', support: true },
  rod: { name: 'Опорный стержень', support: true },
  rough: { name: 'Опора с трением', support: true },
  force: { name: 'Сила' },
  weight: { name: 'Груз' },
  moment: { name: 'Пара сил' },
  dist: { name: 'Распределённая нагрузка' },
};

export const DIRV: Record<Dir, [number, number]> = { r: [1, 0], l: [-1, 0], u: [0, 1], d: [0, -1] };
export const OPP: Record<Dir, Dir> = { r: 'l', l: 'r', u: 'd', d: 'u' };
export const DGL: Record<Dir, string> = { r: '→', l: '←', u: '↑', d: '↓' };
export const DNAME: Record<Dir, string> = { r: 'вправо', l: 'влево', u: 'вверх', d: 'вниз' };

/** Угол направления по оси к оси x, град. */
export const AXANG: Record<Dir, number> = { r: 0, u: 90, l: 180, d: 270 };
/** Угол к оси x, приведённый к 0…360°. */
export const normAng = (a: number): number => ((a % 360) + 360) % 360;
/** Направление по оси для угла, кратного 90° (с точностью 1e-9°), иначе null. */
export function axisDir(ang: number): Dir | null {
  const a = normAng(ang);
  for (const d of ['r', 'u', 'l', 'd'] as Dir[]) if (Math.abs(a - AXANG[d]) < 1e-9 || (d === 'r' && Math.abs(a - 360) < 1e-9)) return d;
  return null;
}
/** Угол участка к оси x (от начала к концу), град. */
export const segAngle = (q: Pick<Seg, 'dir' | 'ang'>): number => (q.dir === 'a' ? normAng(q.ang ?? 0) : AXANG[q.dir]);
/** Единичный вектор участка (от начала к концу). У участков по осям — точно ±1 и 0. */
export function segVec(q: Pick<Seg, 'dir' | 'ang'>): [number, number] {
  if (q.dir !== 'a') return DIRV[q.dir];
  const t = (segAngle(q) * Math.PI) / 180;
  return [Math.cos(t), Math.sin(t)];
}
/**
 * Наклонный участок в интерфейсе: четверть (стрелка) и острый угол к горизонту.
 * ↗ — угол α, ↖ — 180° − α, ↙ — 180° + α, ↘ — 360° − α.
 */
export type Quad = 'ur' | 'ul' | 'dl' | 'dr';
export const QUADS: Record<Quad, { glyph: string; name: string; ang: (alpha: number) => number }> = {
  ur: { glyph: '↗', name: 'вправо и вверх', ang: (a) => a },
  ul: { glyph: '↖', name: 'влево и вверх', ang: (a) => 180 - a },
  dl: { glyph: '↙', name: 'влево и вниз', ang: (a) => 180 + a },
  dr: { glyph: '↘', name: 'вправо и вниз', ang: (a) => 360 - a },
};
/** Четверть и острый угол к горизонту для угла участка (не кратного 90°). */
export function quadOf(ang: number): { quad: Quad; alpha: number } {
  const a = normAng(ang);
  if (a < 90) return { quad: 'ur', alpha: a };
  if (a < 180) return { quad: 'ul', alpha: 180 - a };
  if (a < 270) return { quad: 'dl', alpha: a - 180 };
  return { quad: 'dr', alpha: 360 - a };
}

/** Опорная поверхность → угол реакции (нормали) к оси x. */
export const SIDES: Record<Side, { ang: number; name: string }> = {
  below: { ang: 90, name: 'снизу' },
  above: { ang: 270, name: 'сверху' },
  left: { ang: 0, name: 'слева' },
  right: { ang: 180, name: 'справа' },
};

/** Направления распределённой нагрузки; у nu и nd угол указан для горизонтального участка (см. loadAngle). */
export const LOADDIR: Record<LoadDir, { ang: number; name: string }> = {
  down: { ang: 270, name: 'вниз' },
  up: { ang: 90, name: 'вверх' },
  right: { ang: 0, name: 'вправо' },
  left: { ang: 180, name: 'влево' },
  nu: { ang: 90, name: 'перпендикулярно участку, вверх' },
  nd: { ang: 270, name: 'перпендикулярно участку, вниз' },
};
/** Противоположное направление нагрузки. */
export const OPPLOAD: Record<LoadDir, LoadDir> = { down: 'up', up: 'down', left: 'right', right: 'left', nu: 'nd', nd: 'nu' };
/**
 * Угол нагрузки к оси x, град. lineAng — угол прямой участка к оси x в пределах (−90°; 90°]:
 * нормаль nu повёрнута от неё на +90°, nd — на −90°. Для направлений по осям угол от участка не зависит.
 */
export const loadAngle = (dir: LoadDir, lineAng: number): number => (dir === 'nu' || dir === 'nd' ? normAng(LOADDIR[dir].ang + lineAng) : LOADDIR[dir].ang);

export const REFS: Record<RefDir, { base: number; axis: RefAxis; name: string; short: string; back: Dir }> = {
  right: { base: 0, axis: 'h', name: 'вправо (+x)', short: 'вправо', back: 'l' },
  left: { base: 180, axis: 'h', name: 'влево (−x)', short: 'влево', back: 'r' },
  up: { base: 90, axis: 'v', name: 'вверх (+y)', short: 'вверх', back: 'd' },
  down: { base: 270, axis: 'v', name: 'вниз (−y)', short: 'вниз', back: 'u' },
};

/** Угол силы к оси x (против часовой), 0…360°. */
export const forceAngle = (it: Pick<ForceItem, 'ref' | 'rot' | 'alpha'>): number => {
  const r = REFS[it.ref] || REFS.down;
  return (((r.base + (it.rot === 'ccw' ? 1 : -1) * (+it.alpha || 0)) % 360) + 360) % 360;
};
