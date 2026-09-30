/**
 * Чертёж фермы: стержни с номерами (после решения — растянутые синим, сжатые красным, нулевые пунктиром),
 * узлы, опоры, силы и реакции; для проверки Риттера — рассечённые стержни и точка K.
 */
import { fmt } from '../../../shared/format';
import { nodeName, ritterCut, unitOf, type Truss, type TrussResult } from '../model/truss';

const r1 = (v: number) => Math.round(v * 10) / 10;

function arrow(hx: number, hy: number, ux: number, uy: number, len: number, cls: string): string {
  // Остриё в (hx, hy), направление (ux, uy) в экранных координатах.
  const tx = hx - ux * len,
    ty = hy - uy * len,
    s = 11,
    w = 4.4,
    bx = hx - ux * s,
    by = hy - uy * s;
  return (
    `<line x1="${r1(tx)}" y1="${r1(ty)}" x2="${r1(bx)}" y2="${r1(by)}" class="${cls}"/>` +
    `<polygon points="${r1(hx)},${r1(hy)} ${r1(bx - uy * w)},${r1(by + ux * w)} ${r1(bx + uy * w)},${r1(by - ux * w)}" class="${cls}-f"/>`
  );
}

export function renderTruss(t: Truss, res: TrussResult | null, opts: { ritter?: number | null } = {}): { svg: string; viewBox: string } {
  const W = 1000;
  const xs = t.nodes.map((n) => n.x),
    ys = t.nodes.map((n) => n.y);
  const x0 = Math.min(...xs, 0),
    x1 = Math.max(...xs, 1e-9),
    y0 = Math.min(...ys, 0),
    y1 = Math.max(...ys, 1e-9);
  const w = Math.max(x1 - x0, 1e-9),
    h = Math.max(y1 - y0, 1e-9);
  const aw = W - 240,
    ah = 360;
  const k = Math.min(aw / w, h > 1e-9 ? ah / h : Infinity, 160);
  const H = Math.round(h * k + 250);
  const ox = 120 + (aw - w * k) / 2 - x0 * k,
    oy = 120 + y1 * k;
  const S = (x: number, y: number): [number, number] => [ox + x * k, oy - y * k];
  const solved = res?.status === 'ok';
  const out: string[] = [];
  out.push(`<rect width="${W}" height="${H}" fill="var(--sheet)"/>`);
  const cut = solved && opts.ritter != null ? ritterCut(t, opts.ritter) : null;
  const cutSet = new Set(cut ? [cut.bar, ...cut.others] : []);

  // Стержни.
  t.bars.forEach((q, i) => {
    const [ax, ay] = S(t.nodes[q.a].x, t.nodes[q.a].y),
      [bx, by] = S(t.nodes[q.b].x, t.nodes[q.b].y);
    const N = solved ? res!.N[i] : null;
    const cls = N == null ? 'tb-bar' : Math.abs(N) < 1e-9 ? 'tb-bar tb-zero' : N > 0 ? 'tb-bar tb-ten' : 'tb-bar tb-comp';
    if (cutSet.has(i)) out.push(`<line x1="${r1(ax)}" y1="${r1(ay)}" x2="${r1(bx)}" y2="${r1(by)}" class="tb-cut"/>`);
    out.push(`<line x1="${r1(ax)}" y1="${r1(ay)}" x2="${r1(bx)}" y2="${r1(by)}" class="${cls}" data-bar="${i}"><title>Стержень ${i + 1}</title></line>`);
  });
  // Номера стержней и усилия — у середины, чуть в стороне.
  t.bars.forEach((q, i) => {
    const [ax, ay] = S(t.nodes[q.a].x, t.nodes[q.a].y),
      [bx, by] = S(t.nodes[q.b].x, t.nodes[q.b].y);
    const L = Math.hypot(bx - ax, by - ay) || 1;
    const t0 = 0.5 + (i % 3 === 1 ? 0.12 : i % 3 === 2 ? -0.12 : 0);
    const mx = ax + (bx - ax) * t0,
      my = ay + (by - ay) * t0;
    out.push(`<circle cx="${r1(mx)}" cy="${r1(my)}" r="10" class="tb-num"/><text x="${r1(mx)}" y="${r1(my + 4.5)}" text-anchor="middle" class="tb-numt">${i + 1}</text>`);
    if (solved) {
      const N = res!.N[i];
      const nx = -(by - ay) / L,
        ny = (bx - ax) / L;
      const sg = ny > 0 || (Math.abs(ny) < 1e-9 && nx > 0) ? 1 : -1;
      out.push(`<text x="${r1(mx + nx * sg * 22)}" y="${r1(my + ny * sg * 22 + 4)}" text-anchor="middle" class="tb-val">${fmt(N, 2)}</text>`);
    }
  });
  // Опоры.
  for (const s of t.supports) {
    const [px, py] = S(t.nodes[s.node].x, t.nodes[s.node].y);
    const ang = s.kind === 'pin' ? 90 : s.angle;
    let inner = `<polygon points="${px},${py + 5} ${px - 15},${py + 30} ${px + 15},${py + 30}" class="sup"/>`;
    if (s.kind === 'roller') inner += `<circle cx="${px - 7}" cy="${py + 35}" r="4.5" class="hinge"/><circle cx="${px + 7}" cy="${py + 35}" r="4.5" class="hinge"/>`;
    const gy = py + (s.kind === 'roller' ? 40 : 30);
    inner += `<line x1="${px - 24}" y1="${gy}" x2="${px + 24}" y2="${gy}" class="sup"/>`;
    for (let x = px - 18; x <= px + 24; x += 8) inner += `<line x1="${x}" y1="${gy}" x2="${x - 7}" y2="${gy + 8}" class="hatch"/>`;
    out.push(`<g transform="rotate(${r1(90 - ang)} ${r1(px)} ${r1(py)})">${inner}</g>`);
  }
  // Силы: стрелка приходит в узел.
  for (const l of t.loads) {
    if (Math.abs(l.F) < 1e-12) continue;
    const [px, py] = S(t.nodes[l.node].x, t.nodes[l.node].y);
    const [ux, uy] = unitOf(l.angle + (l.F < 0 ? 180 : 0));
    const sx = ux,
      sy = -uy;
    out.push(arrow(px - sx * 8, py - sy * 8, sx, sy, 62, 'ld'));
    out.push(`<text x="${r1(px - sx * 84)}" y="${r1(py - sy * 84 + 5)}" text-anchor="middle" class="t t-ld">${fmt(Math.abs(l.F))}</text>`);
  }
  // Реакции после решения.
  if (solved)
    res!.reactions.forEach((r, j) => {
      const v = res!.R[j];
      if (Math.abs(v) < 1e-12) return;
      const [px, py] = S(t.nodes[r.node].x, t.nodes[r.node].y);
      const sx = (v > 0 ? 1 : -1) * r.ux,
        sy = -(v > 0 ? 1 : -1) * r.uy;
      out.push(arrow(px - sx * 8, py - sy * 8, sx, sy, 56, 'rc'));
      out.push(`<text x="${r1(px - sx * 78)}" y="${r1(py - sy * 78 + 5)}" text-anchor="middle" class="t t-rc">${r.L}<tspan dy="5" font-size="12">${r.S}</tspan><tspan dy="-5"> = ${fmt(Math.abs(v))}</tspan></text>`);
    });
  // Узлы и их имена.
  const cx = t.nodes.reduce((s, n) => s + n.x, 0) / t.nodes.length,
    cy = t.nodes.reduce((s, n) => s + n.y, 0) / t.nodes.length;
  t.nodes.forEach((n, i) => {
    const [px, py] = S(n.x, n.y);
    out.push(`<circle cx="${r1(px)}" cy="${r1(py)}" r="4.5" class="hinge"/>`);
    let dx = n.x - cx,
      dy = n.y - cy;
    const L = Math.hypot(dx, dy) || 1;
    dx /= L;
    dy /= L;
    out.push(`<text x="${r1(px + dx * 20 - 4)}" y="${r1(py - dy * 20 + 2)}" text-anchor="middle" class="t-pt">${nodeName(i)}</text>`);
  });
  // Точка Риттера.
  if (cut?.point) {
    const [kx, ky] = S(cut.point[0], cut.point[1]);
    if (kx > 20 && kx < W - 20 && ky > 20 && ky < H - 20)
      out.push(`<circle cx="${r1(kx)}" cy="${r1(ky)}" r="6" class="tb-k"/><text x="${r1(kx + 10)}" y="${r1(ky - 8)}" class="tb-kt">K<tspan dy="5" font-size="12">р</tspan></text>`);
  }
  const note = solved ? 'Синий — растянут, красный — сжат, пунктир — не нагружен. Силы — кН, длины — м.' : 'Силы — кН, длины — м.';
  out.push(`<text x="16" y="${H - 14}" class="tb-note">${note}</text>`);
  return { svg: out.join(''), viewBox: `0 0 ${W} ${H}` };
}
