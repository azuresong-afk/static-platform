/** Чертёж силовых многоугольников узлов (ферма с перекрещивающимися стержнями): по одному многоугольнику на узел. */
import { fmt } from '../../../shared/format';
import { nodeName } from '../../truss/model/truss';
import type { V2 } from '../model/cremona';
import type { NodePolys } from '../model/nodepoly';
import { arrow, r1 } from './common';

const CLS = { load: 'ld', react: 'rc', bar: 'gs-kn', new: 'gs-nw' } as const;

export function renderNodePolygons(np: NodePolys): { svg: string; viewBox: string } {
  const n = Math.max(1, np.polys.length);
  const cols = Math.min(n, 4),
    rows = Math.ceil(n / cols);
  const CW = 250,
    CH = 250,
    W = cols * CW,
    H = rows * CH + 30;
  const out: string[] = [`<rect width="${W}" height="${H}" fill="var(--sheet)"/>`];
  // Один масштаб для всех многоугольников.
  let span = 1e-9;
  const verts = np.polys.map((p) => {
    const v: V2[] = [[0, 0]];
    for (const q of p.items) v.push([v[v.length - 1][0] + q.v[0], v[v.length - 1][1] + q.v[1]]);
    const xs = v.map((a) => a[0]),
      ys = v.map((a) => a[1]);
    span = Math.max(span, Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    return v;
  });
  const k = (CW - 70) / span;
  np.polys.forEach((p, j) => {
    const v = verts[j];
    const cx = (j % cols) * CW + CW / 2,
      cy = Math.floor(j / cols) * CH + CH / 2 + 12;
    const xs = v.map((a) => a[0]),
      ys = v.map((a) => a[1]);
    const mx = (Math.max(...xs) + Math.min(...xs)) / 2,
      my = (Math.max(...ys) + Math.min(...ys)) / 2;
    const S = (a: V2): [number, number] => [cx + (a[0] - mx) * k, cy - (a[1] - my) * k];
    out.push(`<text class="tb-note" x="${(j % cols) * CW + 10}" y="${Math.floor(j / cols) * CH + 20}">узел ${nodeName(p.node)}</text>`);
    p.items.forEach((q, i) => {
      const a = S(v[i]),
        b = S(v[i + 1]);
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (L < 1e-6) return;
      out.push(arrow(b[0], b[1], (b[0] - a[0]) / L, (b[1] - a[1]) / L, L, CLS[q.kind]));
      out.push(
        `<text class="t gs-t" x="${r1((a[0] + b[0]) / 2 + 6)}" y="${r1((a[1] + b[1]) / 2 - 6)}">${q.label.replace(/_(\w+)/, '<tspan dy="4" font-size="10">$1</tspan><tspan dy="-4"></tspan>')}</text>`,
      );
    });
  });
  out.push(
    `<text class="tb-note" x="10" y="${H - 10}">Нагрузки — красным, реакции — синим, найденные раньше усилия — тонко, новые — жирно; длины — в одном масштабе (${fmt(1 / k, 3)} на пиксель).</text>`,
  );
  return { svg: out.join(''), viewBox: `0 0 ${W} ${H}` };
}
