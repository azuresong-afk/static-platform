/**
 * Силовые многоугольники узлов (пункт 26): графическое вырезание узлов для фермы, граф которой не плоский
 * (стержни пересекаются вне узлов, 5.14) — обозначения Боу и диаграмма Кремоны к ней не применимы.
 * Узлы — по очереди, в каждом не больше двух неизвестных усилий. Известные силы узла (нагрузка, реакция,
 * найденные усилия) откладываем одну за другой; многоугольник замыкают прямые, параллельные двум неизвестным
 * стержням, — их пересечение даёт усилия (построение, а не решение системы; решение «Ферм» — для сверки).
 */
import { barDir, barsAt, jointOrder, nodeName, type Truss, type TrussResult } from '../../truss/model/truss';
import type { V2 } from './cremona';

export interface PolyItem {
  label: string;
  v: V2;
  kind: 'load' | 'react' | 'bar' | 'new';
  bar?: number;
}
export interface NodePoly {
  node: number;
  /** Стороны многоугольника по порядку: известные силы, затем два (одно) новых усилия. */
  items: PolyItem[];
  /** Найденные в узле усилия: стержень и значение (растяжение «+»). */
  found: { bar: number; N: number }[];
}
export interface NodePolys {
  ok: boolean;
  polys: NodePoly[];
  error?: string;
  /** Наибольшее расхождение построения с решением «Ферм». */
  maxErr: number;
}

export function nodePolygons(t: Truss, res: TrussResult): NodePolys {
  if (res.status !== 'ok') return { ok: false, polys: [], error: 'Ферма не статически определима.', maxErr: 0 };
  const { steps, rest } = jointOrder(t, []);
  if (rest.length) return { ok: false, polys: [], error: 'Узлов с двумя неизвестными не хватает: часть усилий графически по узлам не находится.', maxErr: 0 };
  const N = new Map<number, number>();
  const polys: NodePoly[] = [];
  let maxErr = 0;
  for (const s of steps) {
    const i = s.node;
    const items: PolyItem[] = [];
    for (const l of t.loads.filter((l) => l.node === i)) {
      const a = (l.angle * Math.PI) / 180;
      items.push({ label: `F_${nodeName(i)}`, v: [l.F * Math.cos(a), l.F * Math.sin(a)], kind: 'load' });
    }
    res.reactions.forEach((r, j) => {
      if (r.node === i) items.push({ label: r.key, v: [res.R[j] * r.ux, res.R[j] * r.uy], kind: 'react' });
    });
    for (const k of barsAt(t, i)) {
      if (!N.has(k)) continue;
      const d = barDir(t, k, i);
      items.push({ label: `N_${k + 1}`, v: [N.get(k)! * d[0], N.get(k)! * d[1]], kind: 'bar', bar: k });
    }
    const c: V2 = [-items.reduce((x, q) => x + q.v[0], 0), -items.reduce((y, q) => y + q.v[1], 0)];
    const found: { bar: number; N: number }[] = [];
    if (s.bars.length === 1) {
      const d = barDir(t, s.bars[0], i);
      found.push({ bar: s.bars[0], N: c[0] * d[0] + c[1] * d[1] });
    } else {
      // c = a·d₁ + b·d₂: пересечение прямых, параллельных стержням, через начало и конец ломаной.
      const d1 = barDir(t, s.bars[0], i),
        d2 = barDir(t, s.bars[1], i);
      const det = d1[0] * d2[1] - d1[1] * d2[0];
      found.push({ bar: s.bars[0], N: (c[0] * d2[1] - c[1] * d2[0]) / det }, { bar: s.bars[1], N: (d1[0] * c[1] - d1[1] * c[0]) / det });
    }
    for (const f of found) {
      const d = barDir(t, f.bar, i);
      N.set(f.bar, f.N);
      items.push({ label: `N_${f.bar + 1}`, v: [f.N * d[0], f.N * d[1]], kind: 'new', bar: f.bar });
      maxErr = Math.max(maxErr, Math.abs(f.N - res.N[f.bar]));
    }
    polys.push({ node: i, items, found });
  }
  return { ok: true, polys, maxErr };
}
