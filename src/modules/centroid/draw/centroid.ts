/**
 * Чертёж: плоские фигуры и линии — в осях x, y (вырезы — фоном с пунктирным контуром),
 * тела и грузы — в аксонометрии (x — к наблюдателю, y — вправо, z — вверх). Центры частей C₁, C₂… и общий центр C.
 */
import { fmt } from '../../../shared/format';
import type { CPart, CProblem, CentroidResult, V3 } from '../model/centroid';

const r1 = (v: number) => Math.round(v * 10) / 10;
const rad = (a: number) => (a * Math.PI) / 180;
const arcPts = (cx: number, cy: number, r: number, a1: number, a2: number, n = 40): V3[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const t = rad(a1 + ((a2 - a1) * i) / n);
    return [cx + r * Math.cos(t), cy + r * Math.sin(t), 0] as V3;
  });

/** Контуры части: замкнутые (fill) или открытые линии. */
function outline(q: CPart): { pts: V3[]; closed: boolean }[] {
  const p = q.p;
  switch (q.kind) {
    case 'rect':
      return [{ pts: [[p.x, p.y, 0], [p.x + p.w, p.y, 0], [p.x + p.w, p.y + p.h, 0], [p.x, p.y + p.h, 0]], closed: true }];
    case 'tri':
      return [{ pts: [[p.x1, p.y1, 0], [p.x2, p.y2, 0], [p.x3, p.y3, 0]], closed: true }];
    case 'poly':
      return [{ pts: (q.pts ?? []).map(([x, y]) => [x, y, 0] as V3), closed: true }];
    case 'circle':
      return [{ pts: arcPts(p.cx, p.cy, p.r, 0, 360, 64), closed: true }];
    case 'sector':
      return [{ pts: [[p.cx, p.cy, 0], ...arcPts(p.cx, p.cy, p.r, p.a1, p.a2)], closed: true }];
    case 'segment':
      return [{ pts: arcPts(p.cx, p.cy, p.r, p.a1, p.a2), closed: true }];
    case 'arc':
      return [{ pts: arcPts(p.cx, p.cy, p.r, p.a1, p.a2), closed: false }];
    case 'line':
      return [{ pts: [[p.x1, p.y1, p.z1 ?? 0], [p.x2, p.y2, p.z2 ?? 0]], closed: false }];
    case 'point':
      return [];
    case 'box': {
      const c = (i: number, j: number, k: number): V3 => [p.x + i * p.a, p.y + j * p.b, p.z + k * p.c];
      const e: [V3, V3][] = [];
      for (const [a, b] of [
        [0, 1],
        [1, 3],
        [3, 2],
        [2, 0],
      ])
        for (const k of [0, 1]) e.push([c(a >> 1, a & 1, k), c(b >> 1, b & 1, k)]);
      for (const a of [0, 1, 2, 3]) e.push([c(a >> 1, a & 1, 0), c(a >> 1, a & 1, 1)]);
      return e.map((pts) => ({ pts, closed: false }));
    }
    default: {
      // Тела вращения: окружности в плоскостях, перпендикулярных оси.
      const ax = Math.round(p.ax ?? 2),
        dir = (p.dir ?? 1) >= 0 ? 1 : -1;
      const [u, w] = [0, 1, 2].filter((i) => i !== ax);
      const base: V3 = [p.x, p.y, p.z];
      const at = (o: number, rr: number, t: number): V3 => {
        const q3: V3 = [...base] as V3;
        q3[ax] += o;
        q3[u] += rr * Math.cos(t);
        q3[w] += rr * Math.sin(t);
        return q3;
      };
      const ring = (o: number, rr: number) => ({ pts: Array.from({ length: 49 }, (_, i) => at(o, rr, (2 * Math.PI * i) / 48)), closed: false });
      if (q.kind === 'sphere') {
        const C: V3 = [p.x, p.y, p.z];
        return [0, 1, 2].map((a) => {
          const [i, j] = [0, 1, 2].filter((x) => x !== a);
          return { pts: Array.from({ length: 49 }, (_, n) => { const t = (2 * Math.PI * n) / 48; const q3 = [...C] as V3; q3[i] += p.r * Math.cos(t); q3[j] += p.r * Math.sin(t); return q3; }), closed: false };
        });
      }
      if (q.kind === 'cyl') return [ring(0, p.r), ring(dir * p.h, p.r), ...[0, 1, 2, 3].map((k) => ({ pts: [at(0, p.r, (k * Math.PI) / 2), at(dir * p.h, p.r, (k * Math.PI) / 2)], closed: false }))];
      if (q.kind === 'cone') return [ring(0, p.r), ...[0, 1, 2, 3].map((k) => ({ pts: [at(0, p.r, (k * Math.PI) / 2), at(dir * p.h, 0, 0)], closed: false }))];
      // Полушар: основание и две полуокружности-меридиана.
      const merid = (phi: number) => ({
        pts: Array.from({ length: 25 }, (_, n) => {
          const t = (Math.PI * n) / 24;
          return at(dir * p.r * Math.sin(t), p.r * Math.cos(t), phi);
        }),
        closed: false,
      });
      return [ring(0, p.r), merid(0), merid(Math.PI / 2)];
    }
  }
}

export function renderCentroid(pr: CProblem, r: CentroidResult): { svg: string; viewBox: string } {
  const W = 1000,
    H = 480;
  const is3d = r.is3d;
  const proj = (p: V3): [number, number] => (is3d ? [p[1] - 0.5 * Math.SQRT1_2 * p[0], -(p[2] - 0.5 * Math.SQRT1_2 * p[0])] : [p[0], -p[1]]);
  const outs = pr.parts.map(outline);
  const all: V3[] = [[0, 0, 0], ...outs.flat().flatMap((o) => o.pts), ...r.parts.map((p) => p.c)];
  const pr2 = all.map(proj);
  const xs = pr2.map((p) => p[0]),
    ys = pr2.map((p) => p[1]);
  const w = Math.max(1e-6, Math.max(...xs) - Math.min(...xs)),
    h = Math.max(1e-6, Math.max(...ys) - Math.min(...ys));
  const k = Math.min((W - 260) / w, (H - 140) / h);
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2,
    cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  const S = (p: V3): [number, number] => {
    const q = proj(p);
    return [r1(W / 2 + (q[0] - cx) * k), r1(H / 2 + (q[1] - cy) * k)];
  };
  const out: string[] = [`<rect width="${W}" height="${H}" fill="var(--sheet)"/>`];
  // Оси.
  const O = S([0, 0, 0]);
  const axes: [V3, string][] = is3d
    ? [
        [[1, 0, 0], 'x'],
        [[0, 1, 0], 'y'],
        [[0, 0, 1], 'z'],
      ]
    : [
        [[1, 0, 0], 'x'],
        [[0, 1, 0], 'y'],
      ];
  for (const [u, nm] of axes) {
    const q = proj(u);
    const L = Math.hypot(q[0], q[1]);
    const d = [q[0] / L, q[1] / L];
    out.push(`<line class="sb-axis" x1="${O[0]}" y1="${O[1]}" x2="${r1(O[0] + d[0] * 120)}" y2="${r1(O[1] + d[1] * 120)}"/><text class="sb-axt" x="${r1(O[0] + d[0] * 134)}" y="${r1(O[1] + d[1] * 134 + 5)}">${nm}</text>`);
  }
  const path = (pts: V3[], closed: boolean) => `M${pts.map((p) => S(p).join(' ')).join('L')}${closed ? 'Z' : ''}`;
  // Сначала положительные части, затем вырезы — поверх, цветом фона.
  for (const sign of [1, -1])
    pr.parts.forEach((q, i) => {
      if (q.s !== sign) return;
      for (const o of outs[i]) {
        const cls = q.kind === 'line' || q.kind === 'arc' ? 'cg-wire' : o.closed ? (sign > 0 ? 'cg-fill' : 'cg-cut') : sign > 0 ? 'cg-edge' : 'cg-edge cg-dash';
        out.push(`<path class="${cls}" d="${path(o.pts, o.closed)}"/>`);
      }
    });
  // Грузы.
  const wmax = Math.max(1e-9, ...pr.parts.filter((q) => q.kind === 'point').map((q) => Math.abs(q.p.w)));
  pr.parts.forEach((q, i) => {
    if (q.kind !== 'point') return;
    const [px, py] = S(r.parts[i].c);
    out.push(`<circle class="cg-mass" cx="${px}" cy="${py}" r="${r1(5 + 9 * Math.sqrt(Math.abs(q.p.w) / wmax))}"/><text class="cg-mt" x="${px + 14}" y="${py - 10}">${fmt(q.p.w)}</text>`);
  });
  // Центры частей и общий центр.
  r.parts.forEach((p, i) => {
    if (pr.parts[i].kind === 'point') return;
    const [px, py] = S(p.c);
    out.push(`<circle class="cg-ci" cx="${px}" cy="${py}" r="3"/><text class="cg-cit" x="${px + 6}" y="${py - 6}">C<tspan dy="4" font-size="10">${i + 1}</tspan></text>`);
  });
  if (r.c) {
    const [px, py] = S(r.c);
    const coords = (is3d ? [0, 1, 2] : [0, 1]).map((j) => fmt(r.c![j], 3)).join('; ');
    out.push(`<circle class="cg-c" cx="${px}" cy="${py}" r="7"/><path class="cg-cx" d="M${px - 11} ${py}H${px + 11}M${px} ${py - 11}V${py + 11}"/><text class="cg-ct" x="${px + 12}" y="${py + 20}">C (${coords})</text>`);
  }
  out.push(`<text class="tb-note" x="16" y="${H - 14}">Вырезы — пунктиром; C₁, C₂… — центры тяжести частей, C — центр тяжести всей ${pr.mode === 'mass' ? 'системы' : 'фигуры'}.</text>`);
  return { svg: out.join(''), viewBox: `0 0 ${W} ${H}` };
}
