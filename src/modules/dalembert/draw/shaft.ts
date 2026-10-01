/**
 * Чертёж в аксонометрии: ось вращения z (вертикально, а у горизонтального вала — горизонтально), подпятник A,
 * подшипник B, части тела; главный вектор сил инерции Φ в центре масс и динамические реакции опор.
 */
import { fmt } from '../../../shared/format';
import { outline } from '../../inertia/draw/inertia';
import type { V3 } from '../../inertia/model/inertia';
import type { ShaftProblem, ShaftResult } from '../model/shaft';

const r1 = (v: number) => Math.round(v * 10) / 10;
type P2 = [number, number];
const W = 1000,
  H = 480;

function arrow(a: P2, bb: P2, cls: string) {
  const dx = bb[0] - a[0],
    dy = bb[1] - a[1],
    L = Math.hypot(dx, dy) || 1,
    ux = dx / L,
    uy = dy / L;
  return `<line class="${cls}" x1="${r1(a[0])}" y1="${r1(a[1])}" x2="${r1(bb[0] - ux * 8)}" y2="${r1(bb[1] - uy * 8)}"/><path class="${cls}-f" d="M${r1(bb[0])} ${r1(bb[1])}L${r1(bb[0] - ux * 11 - uy * 4.5)} ${r1(bb[1] - uy * 11 + ux * 4.5)}L${r1(bb[0] - ux * 11 + uy * 4.5)} ${r1(bb[1] - uy * 11 - ux * 4.5)}Z"/>`;
}

export function renderShaft(pr: ShaftProblem, r: ShaftResult): { svg: string; viewBox: string } {
  const horiz = pr.gravity === 'y';
  const k0 = 0.5 * Math.SQRT1_2;
  const proj = (p: V3): P2 => (horiz ? [-p[2] - k0 * p[0], -(p[1] - k0 * p[0])] : [p[1] - k0 * p[0], -(p[2] - k0 * p[0])]);
  const outs = pr.parts.map(outline);
  const zLo = Math.min(pr.zA, pr.zB),
    zHi = Math.max(pr.zA, pr.zB);
  const span = Math.max(zHi - zLo, 1e-6);
  const ends: V3[] = [
    [0, 0, zLo - 0.15 * span],
    [0, 0, zHi + 0.15 * span],
  ];
  const pts: V3[] = [...ends, ...outs.flat(2), ...pr.parts.map((q) => q.c)];
  const p2 = pts.map(proj);
  const xs = p2.map((p) => p[0]),
    ys = p2.map((p) => p[1]);
  const w = Math.max(1e-6, Math.max(...xs) - Math.min(...xs)),
    h = Math.max(1e-6, Math.max(...ys) - Math.min(...ys));
  const k = Math.min((W - 360) / w, (H - 140) / h);
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2,
    cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  const S = (p: V3): P2 => {
    const q = proj(p);
    return [W / 2 + (q[0] - cx) * k, H / 2 - 10 + (q[1] - cy) * k];
  };
  const out: string[] = [`<rect width="${W}" height="${H}" fill="var(--sheet)"/>`];
  // Ось вращения.
  const E0 = S(ends[0]),
    E1 = S(ends[1]);
  out.push(`<line class="in-axis" x1="${r1(E0[0])}" y1="${r1(E0[1])}" x2="${r1(E1[0])}" y2="${r1(E1[1])}"/><text class="t cv-t in-axt" x="${r1(E1[0] + (horiz ? -6 : 10))}" y="${r1(E1[1] + (horiz ? -10 : 4))}">z</text>`);
  // Опоры: подпятник A — треугольник, подшипник B — прямоугольник.
  const A = S([0, 0, pr.zA]),
    B = S([0, 0, pr.zB]);
  out.push(`<path class="sb-tip" d="M${r1(A[0])} ${r1(A[1])}l-12 20h24Z"/>`);
  out.push(`<rect class="sb-bear" x="${r1(B[0] - 11)}" y="${r1(B[1] - 8)}" width="22" height="16" rx="2"/>`);
  out.push(`<text class="t-pt" x="${r1(A[0] + 14)}" y="${r1(A[1] + 22)}">A</text><text class="t-pt" x="${r1(B[0] + 14)}" y="${r1(B[1] - 10)}">B</text>`);
  // Части.
  pr.parts.forEach((q, i) => {
    const cls = q.kind === 'rod' ? 'in-rod' : 'in-edge';
    for (const o of outs[i]) out.push(`<path class="${cls}" d="M${o.map((p) => S(p).map(r1).join(' ')).join('L')}"/>`);
    const C = S(q.c);
    // Точечная масса — на невесомом стержне, перпендикулярном оси.
    if (q.kind === 'point') {
      const F = S([0, 0, q.c[2]]);
      out.push(`<line class="sb-rod" x1="${r1(F[0])}" y1="${r1(F[1])}" x2="${r1(C[0])}" y2="${r1(C[1])}"/>`);
    }
    out.push(q.kind === 'point' ? `<circle class="cg-mass" cx="${r1(C[0])}" cy="${r1(C[1])}" r="7"/>` : `<circle class="cg-ci" cx="${r1(C[0])}" cy="${r1(C[1])}" r="3"/>`);
  });
  if (r.ok) {
    // Главный вектор сил инерции в центре масс.
    const C = S(r.C);
    const Pn = Math.hypot(r.Phi[0], r.Phi[1]);
    const Rmax = Math.max(1e-12, Pn, ...[r.dyn.XA, r.dyn.YA, r.dyn.XB, r.dyn.YB].map(Math.abs));
    const dir = (v: V3, L: number): P2 => {
      const a = S([0, 0, 0]),
        bb = S(v);
      const dx = bb[0] - a[0],
        dy = bb[1] - a[1],
        n = Math.hypot(dx, dy) || 1;
      return [(dx / n) * L, (dy / n) * L];
    };
    if (Pn > 1e-9) {
      const d = dir([r.Phi[0], r.Phi[1], 0], 40 + 50 * (Pn / Rmax));
      out.push(arrow(C, [C[0] + d[0], C[1] + d[1]], 'cv-r'), `<text class="t cv-t t-cvr" x="${r1(C[0] + d[0] * 1.15 + 6)}" y="${r1(C[1] + d[1] * 1.15)}">Φ = ${fmt(Pn, 4)}</text>`);
    }
    out.push(`<circle class="cg-c" cx="${r1(C[0])}" cy="${r1(C[1])}" r="5"/>`);
    for (const [P, X, Y, nm] of [
      [A, r.dyn.XA, r.dyn.YA, 'A'],
      [B, r.dyn.XB, r.dyn.YB, 'B'],
    ] as [P2, number, number, string][]) {
      const N = Math.hypot(X, Y);
      if (N < 1e-9) continue;
      const d = dir([X, Y, 0], 30 + 50 * (N / Rmax));
      out.push(arrow(P, [P[0] + d[0], P[1] + d[1]], 'rc'), `<text class="t cv-t t-rc" x="${r1(P[0] + d[0] * 1.2 + (d[0] >= 0 ? 6 : -6))}" y="${r1(P[1] + d[1] * 1.2 + 4)}" text-anchor="${d[0] >= 0 ? 'start' : 'end'}">R<tspan dy="4" font-size="10">${nm}</tspan><tspan dy="-4"> = ${fmt(N, 4)}</tspan></text>`);
    }
  }
  out.push(`<text class="tb-note" x="16" y="${H - 14}">${horiz ? 'Горизонтальный вал (сила тяжести — вдоль −y). ' : ''}Φ — главный вектор сил инерции, R — динамические реакции опор (давления — обратны).</text>`);
  return { svg: out.join(''), viewBox: `0 0 ${W} ${H}` };
}
