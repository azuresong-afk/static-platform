/** «Дано» для отчёта: точки, участки и элементы конструкции словами. */
import { SIDES, TYPES, loadAngle } from '../model/constants';
import { fmt } from '../../../shared/format';
import { distGeom } from '../model/geometry';
import type { Item } from '../model/types';
import type { Model } from '../solver/model';
import { sym, v, type Inline } from '../../../shared/doc';
import { forceDirText, itemTitle, loadDirText, segText, sizeText } from './labels';

export interface Given {
  size: string;
  points: Inline[][];
  /** Наклонные участки: «A–B: длина 4 м, под углом 60° к горизонту…» — пусто, если их нет. */
  inclined: Inline[][];
  items: Inline[][];
  /** «Внутренние шарниры: D, H» — пусто, если шарниров нет. */
  hinges: Inline[];
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
        return [...head, it.side === 'tilt' ? `, наклонная поверхность, реакция под углом ${it.angleName ? it.angleName + ' = ' : ''}${fmt(it.angle ?? 90, 2)}° к оси x` : `, опорная поверхность ${SIDES[it.side].name}`];
      case 'rod':
        return [...head, `, стержень под углом ${it.angleName ? it.angleName + ' = ' : ''}${fmt(it.angle, 2)}° к оси x`];
      case 'force':
        return [...head, it.unknown ? ': модуль ищем, ' : `: ${fmt(it.F)} кН, `, forceDirText(it)];
      case 'weight':
        return [...head, `: ${fmt(it.G)} кН`];
      case 'moment':
        return [...head, it.unknown ? ': величину ищем' : `: ${fmt(it.M)} кН·м`, it.dir === 'ccw' ? ', против часовой стрелки' : ', по часовой стрелке'];
      case 'dist': {
        const q = it.q1 === it.q2 ? `${fmt(it.q1)} кН/м` : `от ${fmt(it.q1)} до ${fmt(it.q2)} кН/м`;
        const dg = distGeom(g, it);
        return [...head, ' на участке ', v(g.name[it.from] ?? '?'), '–', v(g.name[it.to] ?? '?'), `: ${q}, направлена ${loadDirText(it.dir, loadAngle(it.dir, dg.ok ? dg.ang : 0))}`];
      }
    }
  });
  const hn = m.parts.hinges.map((h) => g.name[h]);
  const hinges: Inline[] = hn.length ? [`Внутренн${hn.length > 1 ? 'ие шарниры' : 'ий шарнир'}: `, ...hn.flatMap((n, i) => (i ? [', ', v(n)] : [v(n)]))] : [];
  const inclined = g.segOrder.filter((q) => q.dir === 'a').map((q): Inline[] => [v(g.name[q.a]), '–', v(g.name[q.b]), `: ${segText(q)}`]);
  return { size: sizeText(m), points, inclined, items: rows, hinges };
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
