/** Подписи для интерфейса: статусы, заголовки карточек, описание направления силы. */
import { REFS, TYPES, forceAngle } from '../model/constants';
import { fmt } from '../model/format';
import type { ForceItem } from '../model/types';
import type { ItemLabel, Model } from '../solver/model';
import type { Status } from '../solver/solve';
import { inlineHTML, sym, v, type Inline } from './doc';

/** Статус: подпись, класс бейджа, класс для штампа на чертеже. */
export const STATUS: Record<Status, [string, 'b-ok' | 'b-warn' | 'b-bad', 'st-ok' | 'st-warn' | 'st-bad']> = {
  ok: ['статически определима', 'b-ok', 'st-ok'],
  indeterminate: ['статически неопределима', 'b-warn', 'st-warn'],
  mechanism: ['геометрически изменяема', 'b-bad', 'st-bad'],
  noequilibrium: ['равновесие невозможно', 'b-bad', 'st-bad'],
  nosupport: ['нет опор', 'b-bad', 'st-bad'],
};

export const STATUS_TONE: Record<Status, 'ok' | 'warn' | 'bad'> = {
  ok: 'ok',
  indeterminate: 'warn',
  mechanism: 'bad',
  noequilibrium: 'bad',
  nosupport: 'bad',
};

export function forceDirText(it: Pick<ForceItem, 'alpha' | 'ref' | 'rot'> & { angleName?: string }): string {
  const a = +it.alpha || 0,
    r = REFS[it.ref] || REFS.down;
  return Math.abs(a % 360) < 1e-9
    ? `направлена ${r.short}`
    : `под углом ${it.angleName ? it.angleName + ' = ' : ''}${fmt(a, 2)}° к направлению «${r.short}», отсчёт ${it.rot === 'ccw' ? 'против часовой стрелки' : 'по часовой стрелке'}`;
}

/** Подсказка под полями силы: «Сила … (к оси x: 240°)». */
export const forceCalcText = (it: Pick<ForceItem, 'alpha' | 'ref' | 'rot'>): string =>
  'Сила ' + forceDirText(it) + ' (к оси x: ' + fmt(forceAngle(it), 2) + '°)';

/** Заголовок карточки элемента. */
export function itemTitle(l: ItemLabel): Inline[] {
  const at = (P: string | undefined): Inline[] => [' в точке ', v(P || '')];
  switch (l.type) {
    case 'fixed':
    case 'pin':
    case 'roller':
    case 'rod':
      return [TYPES[l.type].name + ' ', v(l.P || '')];
    case 'force':
      return ['Сила ', sym({ L: 'F', S: l.S }), ...at(l.P)];
    case 'weight':
      return ['Груз ', sym({ L: 'G', S: l.S }), ...at(l.P)];
    case 'moment':
      return ['Пара сил ', sym({ L: 'M', S: l.S }), ...at(l.P)];
    case 'dist':
      return ['Распределённая нагрузка ', sym({ L: 'q', S: l.S })];
  }
}

export const itemTitleHTML = (l: ItemLabel | undefined): string => (l ? inlineHTML(itemTitle(l)) : '');

/** «габарит 6 × 4 м» или «общая длина 6 м». */
export const sizeText = (m: Pick<Model, 'w' | 'h'>): string =>
  m.h > 1e-9 ? 'габарит ' + fmt(m.w, 2) + ' × ' + fmt(m.h, 2) + ' м' : 'общая длина ' + fmt(m.w, 2) + ' м';
