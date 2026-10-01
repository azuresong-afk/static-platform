/** Чертёж механизма в масштабе: звенья, опоры, ползуны, колёса; векторы скоростей (и МЦС) или ускорений (и МЦУ). */
import { fmt } from '../../../shared/format';
import { num, type MechProblem, type MechResult } from '../model/mech';

const r1 = (v: number) => Math.round(v * 10) / 10;
const W = 1000,
  H = 520;
type P2 = [number, number];
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function arrow(a: P2, bb: P2, cls: string) {
  const dx = bb[0] - a[0],
    dy = bb[1] - a[1],
    L = Math.hypot(dx, dy) || 1,
    ux = dx / L,
    uy = dy / L;
  return `<line class="${cls}" x1="${r1(a[0])}" y1="${r1(a[1])}" x2="${r1(bb[0] - ux * 8)}" y2="${r1(bb[1] - uy * 8)}"/><path class="${cls}-f" d="M${r1(bb[0])} ${r1(bb[1])}L${r1(bb[0] - ux * 11 - uy * 4.5)} ${r1(bb[1] - uy * 11 + ux * 4.5)}L${r1(bb[0] - ux * 11 + uy * 4.5)} ${r1(bb[1] - uy * 11 - ux * 4.5)}Z"/>`;
}

export function renderMech(pr: MechProblem, r: MechResult, show: 'v' | 'a'): { svg: string; viewBox: string } {
  const out: string[] = [`<rect width="${W}" height="${H}" fill="var(--sheet)"/>`];
  const pos = r.pos;
  const names = Object.keys(pos);
  if (!names.length) {
    out.push(`<text class="tb-note" x="16" y="${H / 2}">Задайте точки механизма.</text>`);
    return { svg: out.join(''), viewBox: `0 0 ${W} ${H}` };
  }
  // Масштаб — по точкам и колёсам; мгновенные центры — если недалеко.
  const pts: P2[] = names.map((n) => pos[n]);
  const wheelR = r.ok ? r.wheels : pr.cons.flatMap((c) => (c.k === 'roll' ? [{ b: c.b, c: c.c, r: num(c.r) ?? 0 }] : []));
  for (const w of wheelR) {
    const c = pos[w.c];
    if (c && w.r > 0) pts.push([c[0] - w.r, c[1] - w.r], [c[0] + w.r, c[1] + w.r]);
  }
  const xs0 = pts.map((p) => p[0]),
    ys0 = pts.map((p) => p[1]);
  const span = Math.max(Math.max(...xs0) - Math.min(...xs0), Math.max(...ys0) - Math.min(...ys0), 1e-9);
  const cx0 = (Math.max(...xs0) + Math.min(...xs0)) / 2,
    cy0 = (Math.max(...ys0) + Math.min(...ys0)) / 2;
  // Центр, совпадающий с неподвижным шарниром (вращение вокруг оси), не отмечаем — он очевиден.
  const fixedPts = pr.cons.flatMap((c) => (c.k === 'fixed' && pos[c.p] ? [pos[c.p]] : []));
  const centers: { p: P2; body: string }[] = [];
  if (r.ok)
    for (const b of r.bodies) {
      const c = show === 'v' ? b.icr : b.ica;
      if (!c || Math.hypot(c[0] - cx0, c[1] - cy0) > 2.5 * span) continue;
      if (fixedPts.some((f) => Math.hypot(f[0] - c[0], f[1] - c[1]) < 1e-9 * Math.max(1, span))) continue;
      centers.push({ p: c, body: b.name });
    }
  const all = [...pts, ...centers.map((c) => c.p)];
  const xs = all.map((p) => p[0]),
    ys = all.map((p) => p[1]);
  const x0 = Math.min(...xs),
    x1 = Math.max(...xs),
    y0 = Math.min(...ys),
    y1 = Math.max(...ys);
  // Поля — под векторы (до 90 px) и подписи.
  const k = Math.min((W - 280) / Math.max(x1 - x0, 1e-9), (H - 230) / Math.max(y1 - y0, 1e-9));
  const ox = 140 + (W - 280 - (x1 - x0) * k) / 2,
    oy = H - 110 - (H - 230 - (y1 - y0) * k) / 2;
  const S = (p: P2): P2 => [ox + (p[0] - x0) * k, oy - (p[1] - y0) * k];
  // Направляющие ползунов и прямые качения.
  for (const c of pr.cons) {
    if (c.k === 'slider' && pos[c.p]) {
      const a = ((num(c.ang) ?? 0) * Math.PI) / 180,
        P = S(pos[c.p]);
      const u: P2 = [Math.cos(a), -Math.sin(a)];
      out.push(`<line class="mc-guide" x1="${r1(P[0] - u[0] * 70)}" y1="${r1(P[1] - u[1] * 70)}" x2="${r1(P[0] + u[0] * 70)}" y2="${r1(P[1] + u[1] * 70)}"/>`);
      const deg = (Math.atan2(u[1], u[0]) * 180) / Math.PI;
      out.push(`<rect class="mc-slider" x="${r1(P[0] - 14)}" y="${r1(P[1] - 9)}" width="28" height="18" transform="rotate(${r1(deg)} ${r1(P[0])} ${r1(P[1])})"/>`);
    } else if (c.k === 'roll' && pos[c.c]) {
      const a = ((num(c.ang) ?? 0) * Math.PI) / 180,
        R = num(c.r) ?? 0;
      const n: P2 = [-Math.sin(a), Math.cos(a)],
        Pc = pos[c.c];
      const T = S([Pc[0] - R * n[0], Pc[1] - R * n[1]]);
      const u: P2 = [Math.cos(a), -Math.sin(a)];
      out.push(`<line class="mc-ground" x1="${r1(T[0] - u[0] * 200)}" y1="${r1(T[1] - u[1] * 200)}" x2="${r1(T[0] + u[0] * 200)}" y2="${r1(T[1] + u[1] * 200)}"/>`);
    }
  }
  // Колёса.
  const wheelBodies = new Set(wheelR.map((w) => w.b));
  for (const w of wheelR)
    if (pos[w.c] && w.r > 0) {
      const C = S(pos[w.c]);
      out.push(`<circle class="${w.b ? 'mc-wheel' : 'mc-wheel0'}" cx="${r1(C[0])}" cy="${r1(C[1])}" r="${r1(w.r * k)}"/>`);
    }
  // Звенья.
  for (const b of pr.bodies) {
    const ps = b.pts.filter((q) => pos[q]).map((q) => S(pos[q]));
    if (ps.length < 2) continue;
    if (wheelBodies.has(b.name)) {
      // Точки в пределах колеса — спицы, дальше — сплошное звено (как шатун, наглухо связанный с колесом).
      const wr = wheelR.find((w) => w.b === b.name)!;
      const C = pos[wr.c] ? S(pos[wr.c]) : ps[0];
      for (const p of ps) {
        const d = Math.hypot(p[0] - C[0], p[1] - C[1]);
        if (d > 1e-6) out.push(`<line class="${d <= wr.r * k * 1.01 ? 'mc-spoke' : 'mc-bar'}" x1="${r1(C[0])}" y1="${r1(C[1])}" x2="${r1(p[0])}" y2="${r1(p[1])}"/>`);
      }
    } else if (ps.length === 2) out.push(`<line class="mc-bar" x1="${r1(ps[0][0])}" y1="${r1(ps[0][1])}" x2="${r1(ps[1][0])}" y2="${r1(ps[1][1])}"/>`);
    else out.push(`<path class="mc-plate" d="M${ps.map((p) => p.map(r1).join(' ')).join('L')}Z"/>`);
  }
  // Неподвижные шарниры.
  for (const c of pr.cons)
    if (c.k === 'fixed' && pos[c.p]) {
      const [x, y] = S(pos[c.p]);
      out.push(`<path class="mc-pivot" d="M${r1(x)} ${r1(y)}L${r1(x - 11)} ${r1(y + 18)}L${r1(x + 11)} ${r1(y + 18)}Z"/><line class="mc-ground" x1="${r1(x - 17)}" y1="${r1(y + 18)}" x2="${r1(x + 17)}" y2="${r1(y + 18)}"/>`);
    }
  // Точки и подписи.
  for (const n of names) {
    const [x, y] = S(pos[n]);
    const aux = r.ok ? r.points.find((p) => p.name === n)?.aux : false;
    out.push(`<circle class="${aux ? 'mc-aux' : 'mc-joint'}" cx="${r1(x)}" cy="${r1(y)}" r="${aux ? 3 : 4.5}"/><text class="t mc-t" x="${r1(x + 9)}" y="${r1(y - 9)}">${esc(n)}</text>`);
  }
  if (r.ok) {
    // Векторы: длина пропорциональна модулю, наибольший — 90 px.
    const vs = r.points.filter((p) => !p.aux).map((p) => ({ p, w: show === 'v' ? p.v : p.a }));
    const mx = Math.max(...vs.map((q) => Math.hypot(...q.w)), 1e-300);
    for (const { p, w } of vs) {
      const m = Math.hypot(...w);
      if (m < 1e-9 * mx) continue;
      const L = Math.max(18, (90 * m) / mx);
      const A = S(p.pos),
        Bp: P2 = [A[0] + (w[0] / m) * L, A[1] - (w[1] / m) * L];
      out.push(arrow(A, Bp, show === 'v' ? 'en-v' : 'cv-r'));
      out.push(`<text class="t cv-t ${show === 'v' ? 'en-vt' : 't-cvr'} mc-vt" x="${r1(Bp[0] + (w[0] / m) * 8)}" y="${r1(Bp[1] - (w[1] / m) * 8 + 4)}">${show === 'v' ? 'v' : 'a'}${esc(p.name)}=${fmt(m, 4)}</text>`);
    }
    for (const c of centers) {
      const [x, y] = S(c.p);
      const bp = pr.bodies.find((b) => b.name === c.body)!;
      for (const q of bp.pts) {
        const Q = S(pos[q]);
        out.push(`<line class="mc-ray" x1="${r1(x)}" y1="${r1(y)}" x2="${r1(Q[0])}" y2="${r1(Q[1])}"/>`);
      }
      out.push(`<circle class="mc-icr" cx="${r1(x)}" cy="${r1(y)}" r="5"/><text class="t mc-t mc-ct" x="${r1(x + 8)}" y="${r1(y + 18)}">${show === 'v' ? 'P' : 'Q'}<tspan class="mc-sub" dy="4">${esc(c.body)}</tspan></text>`);
    }
  }
  out.push(`<text class="tb-note" x="16" y="${H - 14}">${show === 'v' ? 'Скорости точек (в одном масштабе) и мгновенные центры скоростей P звеньев.' : 'Ускорения точек (в одном масштабе) и мгновенные центры ускорений Q звеньев.'} Положение — в масштабе.</text>`);
  return { svg: out.join(''), viewBox: `0 0 ${W} ${H}` };
}
