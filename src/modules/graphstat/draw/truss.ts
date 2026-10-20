/**
 * Два чертежа диаграммы Кремоны: ферма с обозначениями Боу (области между внешними силами и панели, линии действия внешних
 * сил) и сама диаграмма (точки областей, отрезки стержней и внешних сил).
 */
import { fmt } from '../../../shared/format';
import { nodeName, type Truss, type TrussResult } from '../../truss/model/truss';
import type { Cremona, V2 } from '../model/cremona';
import { arrow, fit, r1 } from './common';

const barCls = (N: number | null) => (N == null ? 'tb-bar' : Math.abs(N) < 1e-9 ? 'tb-bar tb-zero' : N > 0 ? 'tb-bar tb-ten' : 'tb-bar tb-comp');

export function renderSpace(t: Truss, res: TrussResult, cr: Cremona): { svg: string; viewBox: string } {
  const pos = t.nodes.map((n): V2 => [n.x, n.y]);
  const size = Math.max(...pos.map((p) => p[0]), 1) - Math.min(...pos.map((p) => p[0]), 0);
  const alen = 0.3 * Math.max(size, Math.max(...pos.map((p) => p[1])) - Math.min(...pos.map((p) => p[1])));
  const pts: V2[] = [...pos];
  cr.ext.forEach((e) => {
    const m = Math.hypot(...e.f);
    pts.push([pos[e.node][0] - (e.f[0] / m) * alen * 1.45, pos[e.node][1] - (e.f[1] / m) * alen * 1.45]);
    pts.push([pos[e.node][0] + e.out[0] * alen * 1.6, pos[e.node][1] + e.out[1] * alen * 1.6]);
  });
  cr.faces.forEach((f) => pts.push(f.label));
  const v = fit(pts, 1000, 560, 70);
  const out: string[] = [`<rect width="${v.W}" height="${v.H}" fill="var(--sheet)"/>`];
  const solved = res.status === 'ok';
  // Линии действия внешних сил (граница областей) — пунктиром.
  cr.ext.forEach((e) => {
    const a = v.S(pos[e.node]),
      b = v.S([pos[e.node][0] + e.out[0] * alen * 1.6, pos[e.node][1] + e.out[1] * alen * 1.6]);
    out.push(`<line x1="${r1(a[0])}" y1="${r1(a[1])}" x2="${r1(b[0])}" y2="${r1(b[1])}" class="gs-line"/>`);
  });
  t.bars.forEach((q, i) => {
    const [ax, ay] = v.S(pos[q.a]),
      [bx, by] = v.S(pos[q.b]);
    out.push(`<line x1="${r1(ax)}" y1="${r1(ay)}" x2="${r1(bx)}" y2="${r1(by)}" class="${barCls(solved ? res.N[i] : null)}"/>`);
  });
  t.bars.forEach((q, i) => {
    const [ax, ay] = v.S(pos[q.a]),
      [bx, by] = v.S(pos[q.b]);
    const mx = (ax + bx) / 2,
      my = (ay + by) / 2;
    out.push(
      `<circle cx="${r1(mx)}" cy="${r1(my)}" r="10" class="tb-num"/><text x="${r1(mx)}" y="${r1(my + 4.5)}" text-anchor="middle" class="tb-numt">${i + 1}</text>`,
    );
  });
  for (const s of t.supports) {
    const [px, py] = v.S(pos[s.node]);
    const ang = s.kind === 'pin' ? 90 : s.angle;
    let inner = `<polygon points="${px},${py + 5} ${px - 15},${py + 30} ${px + 15},${py + 30}" class="sup"/>`;
    if (s.kind === 'roller')
      inner += `<circle cx="${px - 7}" cy="${py + 35}" r="4.5" class="hinge"/><circle cx="${px + 7}" cy="${py + 35}" r="4.5" class="hinge"/>`;
    const gy = py + (s.kind === 'roller' ? 40 : 30);
    inner += `<line x1="${px - 24}" y1="${gy}" x2="${px + 24}" y2="${gy}" class="sup"/>`;
    for (let x = px - 18; x <= px + 24; x += 8) inner += `<line x1="${x}" y1="${gy}" x2="${x - 7}" y2="${gy + 8}" class="hatch"/>`;
    out.push(`<g transform="rotate(${r1(90 - ang)} ${r1(px)} ${r1(py)})">${inner}</g>`);
  }
  cr.ext.forEach((e) => {
    const m = Math.hypot(...e.f);
    const [px, py] = v.S(pos[e.node]);
    const ux = e.f[0] / m,
      uy = -e.f[1] / m;
    const len = alen * v.k;
    const cls = e.hasReaction ? 'rc' : 'ld';
    out.push(arrow(px - ux * 8, py - uy * 8, ux, uy, len, cls));
    out.push(
      `<text x="${r1(px - ux * (len + 24))}" y="${r1(py - uy * (len + 24) + 5)}" text-anchor="middle" class="t ${e.hasReaction ? 't-rc' : 't-ld'}">${e.label.replace('_', '')[0]}<tspan dy="5" font-size="12">${e.label.split('_')[1]}</tspan><tspan dy="-5"> = ${fmt(m)}</tspan></text>`,
    );
  });
  const cx = pos.reduce((s, p) => s + p[0], 0) / pos.length,
    cy = pos.reduce((s, p) => s + p[1], 0) / pos.length;
  pos.forEach((p, i) => {
    const [px, py] = v.S(p);
    out.push(`<circle cx="${r1(px)}" cy="${r1(py)}" r="4.5" class="hinge"/>`);
    let dx = p[0] - cx,
      dy = p[1] - cy;
    const L = Math.hypot(dx, dy) || 1;
    dx /= L;
    dy /= L;
    out.push(`<text x="${r1(px + dx * 20 - 4)}" y="${r1(py - dy * 20 + 2)}" text-anchor="middle" class="t-pt">${nodeName(i)}</text>`);
  });
  cr.faces.forEach((f) => {
    const [x, y] = v.S(f.label);
    out.push(`<text x="${r1(x)}" y="${r1(y + 5)}" text-anchor="middle" class="gs-face ${f.outer ? 'gs-out' : 'gs-in'}">${f.name}</text>`);
  });
  out.push(
    `<text x="16" y="${v.H - 12}" class="tb-note">Обозначения Боу: a, b, c … — области вокруг фермы между внешними силами, α, β, γ … — панели. Пунктир — линии действия внешних сил.</text>`,
  );
  return { svg: out.join(''), viewBox: `0 0 ${v.W} ${v.H}` };
}

export function renderCremona(res: TrussResult, cr: Cremona): { svg: string; viewBox: string } {
  const pts: V2[] = cr.faces.map((f) => f.pt).filter((p): p is V2 => !!p);
  const v = fit(pts.length ? pts : [[0, 0]], 1000, 620, 70);
  const out: string[] = [`<rect width="${v.W}" height="${v.H}" fill="var(--sheet)"/>`];
  const solved = res.status === 'ok';
  const zero: number[] = [];
  // Внешние силы: замкнутый многоугольник.
  cr.extVecs.forEach((ev, i) => {
    const a = cr.faces[ev.L].pt,
      b = cr.faces[ev.R].pt;
    if (!a || !b) return;
    const A = v.S(a),
      B = v.S(b);
    const m = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1;
    out.push(arrow(B[0], B[1], (B[0] - A[0]) / m, (B[1] - A[1]) / m, m, cr.ext[i].hasReaction ? 'rc' : 'ld'));
    const lx = (A[0] + B[0]) / 2,
      ly = (A[1] + B[1]) / 2;
    const nx = -(B[1] - A[1]) / m,
      ny = (B[0] - A[0]) / m;
    out.push(`<text x="${r1(lx + nx * 16)}" y="${r1(ly + ny * 16 + 4)}" text-anchor="middle" class="tb-val">${cr.ext[i].label.replace('_', '')}</text>`);
  });
  cr.bars.forEach((bv) => {
    const a = cr.faces[bv.L].pt,
      b = cr.faces[bv.R].pt;
    if (!a || !b) return;
    const A = v.S(a),
      B = v.S(b);
    const m = Math.hypot(B[0] - A[0], B[1] - A[1]);
    const N = solved ? res.N[bv.bar] : bv.N;
    if (m < 1) {
      zero.push(bv.bar + 1);
      return;
    }
    out.push(`<line x1="${r1(A[0])}" y1="${r1(A[1])}" x2="${r1(B[0])}" y2="${r1(B[1])}" class="${barCls(N)}" style="stroke-width:3"/>`);
    const mx = (A[0] + B[0]) / 2,
      my = (A[1] + B[1]) / 2;
    const nx = -(B[1] - A[1]) / m,
      ny = (B[0] - A[0]) / m;
    const sg = ny > 0 || (Math.abs(ny) < 1e-9 && nx > 0) ? 1 : -1;
    out.push(
      `<circle cx="${r1(mx + nx * sg * 14)}" cy="${r1(my + ny * sg * 14)}" r="9" class="tb-num"/><text x="${r1(mx + nx * sg * 14)}" y="${r1(my + ny * sg * 14 + 4)}" text-anchor="middle" class="tb-numt">${bv.bar + 1}</text>`,
    );
  });
  cr.faces.forEach((f) => {
    if (!f.pt) return;
    const [x, y] = v.S(f.pt);
    out.push(
      `<circle cx="${r1(x)}" cy="${r1(y)}" r="3.6" class="gs-pt"/><text x="${r1(x + 8)}" y="${r1(y - 8)}" class="gs-face ${f.outer ? 'gs-out' : 'gs-in'}">${f.name}</text>`,
    );
  });
  const note = `Синий — растяжение, красный — сжатие.${zero.length ? ` Точки совпали — усилие равно нулю: стержни ${zero.join(', ')}.` : ''}`;
  out.push(`<text x="16" y="${v.H - 12}" class="tb-note">${note}</text>`);
  return { svg: out.join(''), viewBox: `0 0 ${v.W} ${v.H}` };
}
