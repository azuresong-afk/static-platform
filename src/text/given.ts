/** «Дано» для отчёта: точки, участки и элементы конструкции словами. */
import { LOADDIR, SIDES, TYPES } from '../model/constants';
import { fmt } from '../model/format';
import type { Item } from '../model/types';
import type { Model } from '../solver/model';
import { sym, v, type Inline } from './doc';
import { forceDirText, itemTitle, sizeText } from './labels';

export interface Given {
  size: string;
  points: Inline[][];
  items: Inline[][];
}

export function givenData(items: Item[], m: Model): Given {
  const g = m.g;
  const points = m.pts.map((p): Inline[] => [v(p.name), ` (${fmt(p.x, 2)}; ${fmt(p.y, 2)})`]);
  const rows = items.map((it): Inline[] => {
    const l = m.labels[it.id];
    const head: Inline[] = l ? itemTitle(l) : [TYPES[it.type].name];
    switch (it.type) {
      case 'fixed':
      case 'pin':
        return [...head, `, опорная поверхность ${SIDES[it.side].name}`];
      case 'roller':
        return [...head, it.side === 'tilt' ? `, наклонная поверхность, реакция под углом ${fmt(it.angle ?? 90, 2)}° к оси x` : `, опорная поверхность ${SIDES[it.side].name}`];
      case 'rod':
        return [...head, `, стержень под углом ${fmt(it.angle, 2)}° к оси x`];
      case 'force':
        return [...head, it.unknown ? ': модуль ищем, ' : `: ${fmt(it.F)} кН, `, forceDirText(it)];
      case 'weight':
        return [...head, `: ${fmt(it.G)} кН`];
      case 'moment':
        return [...head, it.unknown ? ': величину ищем' : `: ${fmt(it.M)} кН·м`, it.dir === 'ccw' ? ', против часовой стрелки' : ', по часовой стрелке'];
      case 'dist': {
        const q = it.q1 === it.q2 ? `${fmt(it.q1)} кН/м` : `от ${fmt(it.q1)} до ${fmt(it.q2)} кН/м`;
        return [...head, ' на участке ', v(g.name[it.from] ?? '?'), '–', v(g.name[it.to] ?? '?'), `: ${q}, направлена ${LOADDIR[it.dir].name}`];
      }
    }
  });
  return { size: sizeText(m), points, items: rows };
}

/** Искомые величины для отчёта. */
export const targetsInline = (m: Model, notTarget: ReadonlySet<string>): Inline[] => {
  const t = m.unknowns.filter((u) => !notTarget.has(u.key));
  const list = t.length ? t : m.unknowns;
  const r: Inline[] = [];
  list.forEach((u, i) => {
    if (i) r.push(', ');
    r.push(sym(u));
  });
  return r;
};
