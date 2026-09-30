/**
 * Аксонометрия тела: оси, грани и рёбра, опоры, силы; после решения — реакции со значениями.
 * x — к наблюдателю (влево-вниз), y — вправо, z — вверх (как на чертежах Мещерского).
 */
import { fmt } from '../../../shared/format';
import { P3, type Body, type BodyModel, type BodySolution, type V3 } from '../model/body';

const r1 = (v: number) => Math.round(v * 10) / 10;
/** Проекция: y — вправо, z — вверх, x — влево-вниз под 45° с сокращением 0,5. */
const proj = (p: V3): [number, number] => [p[1] - 0.5 * Math.SQRT1_2 * p[0], -(p[2] - 0.5 * Math.SQRT1_2 * p[0])];

function arrowLine(a: [number, number], bb: [number, number], cls: string, dash = false) {
  const dx = bb[0] - a[0],
    dy = bb[1] - a[1],
    L = Math.hypot(dx, dy) || 1,
    ux = dx / L,
    uy = dy / L;
  return (
    `<line class="${cls}" x1="${r1(a[0])}" y1="${r1(a[1])}" x2="${r1(bb[0] - ux * 9)}" y2="${r1(bb[1] - uy * 9)}"${dash ? ' stroke-dasharray="6 4"' : ''}/>` +
    `<path class="${cls}-f" d="M${r1(bb[0])} ${r1(bb[1])}L${r1(bb[0] - ux * 11 - uy * 4.5)} ${r1(bb[1] - uy * 11 + ux * 4.5)}L${r1(bb[0] - ux * 11 + uy * 4.5)} ${r1(bb[1] - uy * 11 - ux * 4.5)}Z"/>`
  );
}

const label = (L: string, S: string, rest: string) => `${L}${S ? `<tspan dy="5" font-size="12">${S}</tspan><tspan dy="-5">` : '<tspan>'}${rest}</tspan>`;

export function renderBody(body: Body, m: BodyModel, sol: BodySolution | null): { svg: string; viewBox: string } {
  const W = 1000,
    H = 520;
  const pts = body.points.map((_, i) => P3(body, i));
  const pr = [...pts, [0, 0, 0] as V3].map(proj);
  const xs = pr.map((p) => p[0]),
    ys = pr.map((p) => p[1]);
  const w = Math.max(1e-6, Math.max(...xs) - Math.min(...xs)),
    h = Math.max(1e-6, Math.max(...ys) - Math.min(...ys));
  const k = Math.min((W - 360) / w, (H - 220) / h);
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2,
    cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  const S = (p: V3): [number, number] => {
    const q = proj(p);
    return [W / 2 + (q[0] - cx) * k, H / 2 + (q[1] - cy) * k];
  };
  const dirS = (u: V3): [number, number] => {
    const bb = proj(u);
    const L = Math.hypot(bb[0], bb[1]);
    return L < 1e-9 ? [0, -1] : [bb[0] / L, bb[1] / L];
  };
  const out: string[] = [`<rect width="${W}" height="${H}" fill="var(--sheet)"/>`];
  const O = S([0, 0, 0]);
  (['x', 'y', 'z'] as const).forEach((a, i) => {
    const u: V3 = [0, 0, 0];
    u[i] = 1;
    const d = dirS(u),
      L = i === 0 ? 90 : 130;
    out.push(`<line class="sb-axis" x1="${r1(O[0])}" y1="${r1(O[1])}" x2="${r1(O[0] + d[0] * L)}" y2="${r1(O[1] + d[1] * L)}"/><text class="sb-axt" x="${r1(O[0] + d[0] * (L + 14))}" y="${r1(O[1] + d[1] * (L + 14) + 5)}">${a}</text>`);
  });
  for (const f of body.faces) out.push(`<path class="sb-face" d="M${f.map((i) => S(pts[i]).map(r1).join(' ')).join('L')}Z"/>`);
  for (const [a, bb] of body.edges) {
    const A = S(pts[a]),
      B = S(pts[bb]);
    out.push(`<line class="sb-edge" x1="${r1(A[0])}" y1="${r1(A[1])}" x2="${r1(B[0])}" y2="${r1(B[1])}"/>`);
  }
  for (const s of body.supports) {
    const [px, py] = S(pts[s.at]);
    if (s.kind === 'ball' || s.kind === 'thrust') out.push(`<circle class="sb-ball" cx="${r1(px)}" cy="${r1(py)}" r="7"/>`);
    else if (s.kind === 'bearing') out.push(`<rect class="sb-bear" x="${r1(px - 10)}" y="${r1(py - 7)}" width="20" height="14" rx="2"/>`);
    else if (s.kind === 'rod') {
      const T = S(pts[s.to ?? 0]);
      out.push(`<line class="sb-rod" x1="${r1(px)}" y1="${r1(py)}" x2="${r1(T[0])}" y2="${r1(T[1])}"/><circle class="hinge" cx="${r1(T[0])}" cy="${r1(T[1])}" r="4.5"/>`);
    } else {
      const d = dirS(s.n ?? [0, 0, 1]);
      const bx = px - d[0] * 22,
        by = py - d[1] * 22;
      out.push(`<path class="sb-tip" d="M${r1(px)} ${r1(py)}L${r1(bx - d[1] * 9)} ${r1(by + d[0] * 9)}L${r1(bx + d[1] * 9)} ${r1(by - d[0] * 9)}Z"/>`);
    }
  }
  for (const f of m.knowns.filter((x) => x.kind === 'f')) {
    const P = S(f.r),
      d = dirS(f.u);
    out.push(arrowLine([P[0] - d[0] * 70, P[1] - d[1] * 70], P, 'ld'));
    out.push(`<text class="t t-ld" x="${r1(P[0] - d[0] * 86)}" y="${r1(P[1] - d[1] * 86 + 5)}" text-anchor="middle">${label(f.L, f.S, ` = ${fmt(f.val)}`)}</text>`);
  }
  const solved = sol?.status === 'ok';
  for (const u of m.unknowns) {
    const P = S(u.r),
      val = solved ? sol!.vals[u.key] : null;
    const d = dirS(u.u.map((x) => x * (val != null && val < 0 ? -1 : 1)) as V3);
    const isLoad = u.sup == null;
    const cls = isLoad && !solved ? 'ld' : 'rc';
    out.push(arrowLine([P[0] - d[0] * 56, P[1] - d[1] * 56], [P[0] - d[0] * 6, P[1] - d[1] * 6], cls, isLoad && !solved));
    const lab = val != null ? ` = ${fmt(Math.abs(val))}` : isLoad ? ' = ?' : '';
    out.push(`<text class="t t-${cls}" x="${r1(P[0] - d[0] * 72)}" y="${r1(P[1] - d[1] * 72 + 5)}" text-anchor="middle">${label(u.L, u.S, lab)}</text>`);
  }
  pts.forEach((p, i) => {
    const [px, py] = S(p);
    out.push(`<circle class="sb-pt" cx="${r1(px)}" cy="${r1(py)}" r="3"/><text class="t-pt" x="${r1(px + 9)}" y="${r1(py - 8)}">${body.points[i].name}</text>`);
  });
  out.push(`<text class="tb-note" x="16" y="${H - 14}">Силы — кН, длины — м. Реакции показаны в действительном направлении.</text>`);
  return { svg: out.join(''), viewBox: `0 0 ${W} ${H}` };
}
