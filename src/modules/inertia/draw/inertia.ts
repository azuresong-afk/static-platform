/**
 * Чертёж в аксонометрии (x — к наблюдателю, y — вправо, z — вверх): части тела (вырезы — пунктиром),
 * их центры масс, заданная ось и расстояния d_i от центров до оси. Если всё лежит в плоскости xy,
 * а ось перпендикулярна ей, — вид сверху, ось показана точкой.
 */
import { fmt } from '../../../shared/format';
import { cross, dot, norm, unit, type IPart, type IProblem, type InertiaResult, type V3 } from '../model/inertia';

const r1 = (v: number) => Math.round(v * 10) / 10;
type P2 = [number, number];
const add = (a: V3, b: V3, k = 1): V3 => [a[0] + k * b[0], a[1] + k * b[1], a[2] + k * b[2]];

function basis(u: V3): [V3, V3] {
  const e = unit(u);
  const t: V3 = Math.abs(e[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const e1 = unit(cross(e, t));
  return [e1, cross(e, e1)];
}
const circle = (c: V3, u: V3, R: number, n = 48): V3[] => {
  const [e1, e2] = basis(u);
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = (2 * Math.PI * i) / n;
    return add(add(c, e1, R * Math.cos(t)), e2, R * Math.sin(t));
  });
};

/** Контуры части (ломаные). */
function outline(q: IPart): V3[][] {
  const p = q.p,
    c = q.c,
    e = unit(q.u);
  switch (q.kind) {
    case 'point':
      return [];
    case 'rod':
      return [[add(c, e, -p.l / 2), add(c, e, p.l / 2)]];
    case 'ring':
      return [circle(c, e, p.R)];
    case 'disk':
    case 'tube': {
      const h = p.h ?? 0;
      const rings = [p.R, ...(q.kind === 'tube' && p.r > 0 ? [p.r] : [])];
      if (h < 1e-12) return rings.map((R) => circle(c, e, R));
      const out = rings.flatMap((R) => [circle(add(c, e, -h / 2), e, R), circle(add(c, e, h / 2), e, R)]);
      const [e1, e2] = basis(e);
      for (const g of [e1, e2, [-e1[0], -e1[1], -e1[2]] as V3, [-e2[0], -e2[1], -e2[2]] as V3]) out.push([add(add(c, e, -h / 2), g, p.R), add(add(c, e, h / 2), g, p.R)]);
      return out;
    }
    case 'cone': {
      const base = add(c, e, -p.h / 4),
        apex = add(c, e, (3 * p.h) / 4);
      const [e1, e2] = basis(e);
      return [circle(base, e, p.R), ...[e1, e2, [-e1[0], -e1[1], -e1[2]] as V3, [-e2[0], -e2[1], -e2[2]] as V3].map((g) => [add(base, g, p.R), apex])];
    }
    case 'sphere':
    case 'hball':
    case 'shell': {
      const out = ([[1, 0, 0], [0, 1, 0], [0, 0, 1]] as V3[]).map((a) => circle(c, a, p.R));
      if (q.kind === 'hball' && p.r > 0) out.push(circle(c, [0, 0, 1], p.r));
      return out;
    }
    case 'box': {
      const { a, b, c: cc } = p;
      const v = (i: number, j: number, k: number): V3 => [c[0] + (i - 0.5) * a, c[1] + (j - 0.5) * b, c[2] + (k - 0.5) * cc];
      const E: V3[][] = [];
      for (const [i, j] of [
        [0, 0],
        [0, 1],
        [1, 1],
        [1, 0],
      ])
        E.push([v(i, j, 0), v(i, j, 1)]);
      for (const k of [0, 1]) E.push([v(0, 0, k), v(1, 0, k), v(1, 1, k), v(0, 1, k), v(0, 0, k)]);
      return E;
    }
  }
}

export function renderInertia(pr: IProblem, r: InertiaResult): { svg: string; viewBox: string } {
  const W = 1000,
    H = 480;
  const u = unit(pr.axis);
  const top = Math.abs(Math.abs(u[2]) - 1) < 1e-12 && pr.parts.every((q) => Math.abs(q.c[2] - pr.A[2]) < 1e-12 && (q.kind !== 'rod' || Math.abs(q.u[2]) < 1e-12));
  const proj = (p: V3): P2 => (top ? [p[0], -p[1]] : [p[1] - 0.5 * Math.SQRT1_2 * p[0], -(p[2] - 0.5 * Math.SQRT1_2 * p[0])]);
  const outs = pr.parts.map(outline);
  const pts: V3[] = [pr.A, ...outs.flat(2), ...pr.parts.map((q) => q.c)];
  const ext = Math.max(1e-6, ...pts.map((p) => norm([p[0] - pr.A[0], p[1] - pr.A[1], p[2] - pr.A[2]])));
  const axA = add(pr.A, u, -ext * 1.15),
    axB = add(pr.A, u, ext * 1.15);
  if (!top) pts.push(axA, axB);
  const p2 = pts.map(proj);
  const xs = p2.map((p) => p[0]),
    ys = p2.map((p) => p[1]);
  const w = Math.max(1e-6, Math.max(...xs) - Math.min(...xs)),
    h = Math.max(1e-6, Math.max(...ys) - Math.min(...ys));
  const k = Math.min((W - 300) / w, (H - 130) / h);
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2,
    cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  const S = (p: V3): P2 => {
    const q = proj(p);
    return [r1(W / 2 + (q[0] - cx) * k), r1(H / 2 - 10 + (q[1] - cy) * k)];
  };
  const out: string[] = [`<rect width="${W}" height="${H}" fill="var(--sheet)"/>`];
  // Координатные оси от начала координат.
  const O = S([0, 0, 0]);
  (top ? ['x', 'y'] : ['x', 'y', 'z']).forEach((a, i) => {
    const e: V3 = [0, 0, 0];
    e[i] = 1;
    const q = proj(e),
      L0 = Math.hypot(q[0], q[1]),
      d = [q[0] / L0, q[1] / L0],
      room = Math.min(d[0] > 1e-9 ? (W - 30 - O[0]) / d[0] : d[0] < -1e-9 ? (O[0] - 30) / -d[0] : 1e9, d[1] > 1e-9 ? (H - 40 - O[1]) / d[1] : d[1] < -1e-9 ? (O[1] - 24) / -d[1] : 1e9),
      L = Math.max(30, Math.min(!top && i === 0 ? 80 : 110, room - 14));
    out.push(`<line class="sb-axis" x1="${O[0]}" y1="${O[1]}" x2="${r1(O[0] + d[0] * L)}" y2="${r1(O[1] + d[1] * L)}"/><text class="sb-axt" x="${r1(O[0] + d[0] * (L + 13))}" y="${r1(O[1] + d[1] * (L + 13) + 5)}">${a}</text>`);
  });
  const path = (ps: V3[]) => `M${ps.map((p) => S(p).join(' ')).join('L')}`;
  pr.parts.forEach((q, i) => {
    const cls = q.kind === 'rod' ? 'in-rod' : 'in-edge';
    for (const o of outs[i]) out.push(`<path class="${cls}${q.s < 0 ? ' cg-dash' : ''}" d="${path(o)}"/>`);
  });
  // Ось.
  const Ap = S(pr.A);
  if (top) out.push(`<circle class="in-axis-dot" cx="${Ap[0]}" cy="${Ap[1]}" r="8"/><circle class="in-axis-c" cx="${Ap[0]}" cy="${Ap[1]}" r="2.5"/>`);
  else {
    const a = S(axA),
      bb = S(axB);
    const dx = bb[0] - a[0],
      dy = bb[1] - a[1],
      L = Math.hypot(dx, dy) || 1;
    out.push(`<line class="in-axis" x1="${a[0]}" y1="${a[1]}" x2="${bb[0]}" y2="${bb[1]}"/><path class="in-axis-f" d="M${bb[0]} ${bb[1]}l${r1((-dx / L) * 12 - (dy / L) * 5)} ${r1((-dy / L) * 12 + (dx / L) * 5)}l${r1((dy / L) * 10)} ${r1((-dx / L) * 10)}Z"/>`);
    out.push(`<text class="t cv-t in-axt" x="${r1(bb[0] + (dx / L) * 14)}" y="${r1(bb[1] + (dy / L) * 14 + 5)}" text-anchor="middle">ось</text>`);
  }
  out.push(`<text class="t-pt" x="${Ap[0] + 10}" y="${Ap[1] + 18}">A</text>`);
  // Центры частей и расстояния до оси.
  pr.parts.forEach((q, i) => {
    const C = S(q.c);
    const dC: V3 = [q.c[0] - pr.A[0], q.c[1] - pr.A[1], q.c[2] - pr.A[2]];
    const foot = add(pr.A, u, dot(dC, u));
    if (r.ok && r.parts[i].d > 1e-9) {
      const F = S(foot);
      // Подпись — сбоку от отрезка d, со стороны, противоположной подписи центра.
      const L = Math.hypot(F[0] - C[0], F[1] - C[1]) || 1;
      let n: P2 = [-(F[1] - C[1]) / L, (F[0] - C[0]) / L];
      if (n[0] > 0) n = [-n[0], -n[1]];
      const mx = (C[0] + F[0]) / 2 + n[0] * 12,
        my = (C[1] + F[1]) / 2 + n[1] * 12;
      out.push(`<line class="in-d" x1="${C[0]}" y1="${C[1]}" x2="${F[0]}" y2="${F[1]}"/><text class="t cv-t in-dt" x="${r1(mx)}" y="${r1(my + 4)}" text-anchor="${n[0] < -0.3 ? 'end' : 'middle'}">d<tspan dy="4" font-size="10">${i + 1}</tspan><tspan dy="-4"> = ${fmt(r.parts[i].d, 3)}</tspan></text>`);
    }
    out.push(q.kind === 'point' ? `<circle class="cg-mass" cx="${C[0]}" cy="${C[1]}" r="7"/>` : `<circle class="cg-ci" cx="${C[0]}" cy="${C[1]}" r="3"/>`);
    out.push(`<text class="cg-cit cv-t" x="${C[0] + 7}" y="${C[1] - 7}">C<tspan dy="4" font-size="10">${i + 1}</tspan></text>`);
  });
  out.push(`<text class="tb-note" x="16" y="${H - 14}">${top ? 'Вид сверху: ось перпендикулярна плоскости чертежа (точка A). ' : ''}Вырезы — пунктиром; d — расстояния от центров масс частей до оси.</text>`);
  return { svg: out.join(''), viewBox: `0 0 ${W} ${H}` };
}
