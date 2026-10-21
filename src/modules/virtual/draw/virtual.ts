/**
 * Чертёж возможного перемещения: оси стержней (сплошные), их положение после перемещения (штрих, в увеличенном
 * масштабе), центры поворота частей, перемещение в отброшенной связи.
 */
import type { Pt } from '../../frames/model/geometry';
import type { Structure } from '../../frames/model/types';
import type { Model } from '../../frames/solver/model';
import { dispAt, type Release } from '../model/virtual';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const r1 = (v: number) => Math.round(v * 10) / 10;
/** Наибольшие ширина и высота схемы на чертеже, px. */
const MAXW = 640,
  MAXH = 340;

export function renderVirtual(s: Structure, m: Model, r: Release): { svg: string; viewBox: string } {
  const pos = m.g.pos;
  const xs = Object.values(pos).map((p) => p[0]),
    ys = Object.values(pos).map((p) => p[1]);
  const w0 = Math.max(...xs) - Math.min(...xs),
    h0 = Math.max(...ys) - Math.min(...ys);
  const span = Math.max(w0, h0, 1e-9);
  const SC = Math.min(MAXW / Math.max(w0, 1e-9), MAXH / Math.max(h0, 1e-9));
  const X = (x: number) => r1(x * SC),
    Y = (y: number) => r1(-y * SC);
  // Масштаб перемещений: наибольшее перемещение узла — 12% размера.
  const segPart = m.parts.segPart;
  let dmax = 0;
  for (const q of s.segs)
    for (const id of [q.a, q.b]) {
      const d = dispAt(r.motions[segPart[q.id] ?? 0], pos[id][0], pos[id][1]);
      dmax = Math.max(dmax, Math.hypot(d[0], d[1]));
    }
  const k = dmax > 1e-12 ? (0.12 * span) / dmax : 0;
  const moved = (p: number, P: Pt): Pt => {
    const d = dispAt(r.motions[p], P[0], P[1]);
    return [P[0] + d[0] * k, P[1] + d[1] * k];
  };
  const box = [Infinity, Infinity, -Infinity, -Infinity];
  const grow = (x: number, y: number, rx = 0, ry = 0) => {
    box[0] = Math.min(box[0], x - rx);
    box[1] = Math.min(box[1], y - ry);
    box[2] = Math.max(box[2], x + rx);
    box[3] = Math.max(box[3], y + ry);
  };
  const out: string[] = [];
  for (const q of s.segs) {
    const A = pos[q.a],
      B = pos[q.b];
    if (!A || !B) continue;
    const p = segPart[q.id] ?? 0;
    const A2 = moved(p, A),
      B2 = moved(p, B);
    out.push(`<line class="vw-bar" x1="${X(A[0])}" y1="${Y(A[1])}" x2="${X(B[0])}" y2="${Y(B[1])}"/>`);
    out.push(`<line class="vw-moved" x1="${X(A2[0])}" y1="${Y(A2[1])}" x2="${X(B2[0])}" y2="${Y(B2[1])}"/>`);
    for (const P of [A, B, A2, B2]) grow(X(P[0]), Y(P[1]));
  }
  for (const p of m.pts) {
    const hinge = m.parts.hinges.includes(p.id);
    if (hinge) out.push(`<circle class="vw-hinge" cx="${X(p.x)}" cy="${Y(p.y)}" r="4"/>`);
    out.push(`<text class="vw-pt" x="${r1(X(p.x) - 8)}" y="${r1(Y(p.y) - 8)}" text-anchor="end">${esc(p.name)}</text>`);
    grow(X(p.x) - 14, Y(p.y) - 20);
  }
  // Центры поворота.
  r.motions.forEach((mo, p) => {
    if (mo.kind !== 'rot' || !mo.center) return;
    const [cx, cy] = [X(mo.center[0]), Y(mo.center[1])];
    const name = m.parts.count > 1 ? `P${['₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'][p] ?? p + 1}` : 'P';
    out.push(
      `<circle class="vw-center" cx="${cx}" cy="${cy}" r="6"/><line class="vw-center-x" x1="${cx - 4}" y1="${cy - 4}" x2="${cx + 4}" y2="${cy + 4}"/><line class="vw-center-x" x1="${cx - 4}" y1="${cy + 4}" x2="${cx + 4}" y2="${cy - 4}"/>`,
    );
    out.push(`<text class="vw-cname" x="${r1(cx + 9)}" y="${r1(cy + 18)}">${esc(name)}</text>`);
    grow(cx, cy, 30, 24);
  });
  // Отброшенная связь: стрелка перемещения или дуга поворота.
  const u = r.unknown;
  const ux = X(u.x),
    uy = Y(u.y);
  if (u.kind === 'm') {
    out.push(`<path class="vw-delta" d="M${ux + 22} ${uy}A22 22 0 1 0 ${ux} ${uy + 22}"/><path class="vw-delta-head" d="M${ux} ${uy + 22}l9 -6l0 12z"/>`);
    out.push(`<text class="vw-dname" x="${r1(ux + 26)}" y="${r1(uy - 18)}">δφ</text>`);
    grow(ux, uy, 40, 40);
  } else {
    const L = 46;
    const ex = ux + u.dx * L,
      ey = uy - u.dy * L;
    out.push(`<line class="vw-delta" x1="${ux}" y1="${uy}" x2="${r1(ex)}" y2="${r1(ey)}"/>`);
    const hx = -u.dx,
      hy = u.dy;
    out.push(
      `<path class="vw-delta-head" d="M${r1(ex)} ${r1(ey)}L${r1(ex + hx * 11 - hy * 5)} ${r1(ey + hy * 11 + hx * 5)}L${r1(ex + hx * 11 + hy * 5)} ${r1(ey + hy * 11 - hx * 5)}Z"/>`,
    );
    out.push(`<text class="vw-dname" x="${r1(ex + u.dx * 12 + 4)}" y="${r1(ey - u.dy * 12 - 6)}">δs</text>`);
    grow(ex, ey, 30, 20);
  }
  const x0 = box[0] - 16,
    y0 = box[1] - 16,
    w = box[2] - box[0] + 32,
    h = box[3] - box[1] + 46;
  out.push(
    `<text class="ax-note" x="${r1(x0 + 8)}" y="${r1(y0 + h - 8)}">Штрих — после возможного перемещения (в крупном масштабе)</text>`,
  );
  return { svg: out.join(''), viewBox: `${r1(x0)} ${r1(y0)} ${r1(Math.max(w, 420))} ${r1(h)}` };
}
