import type { Dir, ForceItem, ItemType, LoadDir, RefDir, Side } from './types';
import type { RefAxis } from './format';

/** Буквы для точек. Пропущены буквы, занятые обозначениями сил и реакций (F, G, M, Q, R, S, X, Y…). */
export const LETTERS = 'ABCDEHKLNOPTUVWZ'.split('');
export const ptName = (i: number): string => LETTERS[i] || 'P' + i;

export const TYPES: Record<ItemType, { name: string; support?: true }> = {
  fixed: { name: 'Жёсткая заделка', support: true },
  pin: { name: 'Шарнирно-неподвижная опора', support: true },
  roller: { name: 'Шарнирно-подвижная опора', support: true },
  rod: { name: 'Опорный стержень', support: true },
  force: { name: 'Сила' },
  weight: { name: 'Груз' },
  moment: { name: 'Пара сил' },
  dist: { name: 'Распределённая нагрузка' },
};

export const DIRV: Record<Dir, [number, number]> = { r: [1, 0], l: [-1, 0], u: [0, 1], d: [0, -1] };
export const OPP: Record<Dir, Dir> = { r: 'l', l: 'r', u: 'd', d: 'u' };
export const DGL: Record<Dir, string> = { r: '→', l: '←', u: '↑', d: '↓' };
export const DNAME: Record<Dir, string> = { r: 'вправо', l: 'влево', u: 'вверх', d: 'вниз' };

/** Опорная поверхность → угол реакции (нормали) к оси x. */
export const SIDES: Record<Side, { ang: number; name: string }> = {
  below: { ang: 90, name: 'снизу' },
  above: { ang: 270, name: 'сверху' },
  left: { ang: 0, name: 'слева' },
  right: { ang: 180, name: 'справа' },
};

export const LOADDIR: Record<LoadDir, { ang: number; name: string }> = {
  down: { ang: 270, name: 'вниз' },
  up: { ang: 90, name: 'вверх' },
  right: { ang: 0, name: 'вправо' },
  left: { ang: 180, name: 'влево' },
};

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
