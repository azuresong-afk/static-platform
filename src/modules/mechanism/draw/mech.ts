/**
 * Чертёж механизма в масштабе: звенья, опоры, ползуны, колёса, кулисные камни; векторы скоростей (и МЦС) или ускорений
 * (и МЦУ); нагрузки — силы и пары. Отдельно — график величины по параметру положения φ.
 */
import { fmt } from '../../../shared/format';
import { num, type MechProblem, type MechResult } from '../model/mech';
import type { MechSolution, PlotResult } from '../model/solve';

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

export function renderMech(pr: MechProblem, r: MechResult | MechSolution, show: 'v' | 'a'): { svg: string; viewBox: string } {
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
  // Кулисы: прорезь вдоль прямой G₁G₂ (продолжена за камень) и камень.
  for (const c of pr.cons) {
    if (c.k !== 'guide' || !pos[c.p] || !pos[c.g1] || !pos[c.g2]) continue;
    const A = S(pos[c.g1]),
      B = S(pos[c.g2]),
      Pp = S(pos[c.p]);
    const L = Math.hypot(B[0] - A[0], B[1] - A[1]);
    if (!(L > 0)) continue;
    const u: P2 = [(B[0] - A[0]) / L, (B[1] - A[1]) / L],
      n: P2 = [-u[1], u[0]];
    const t = (Pp[0] - A[0]) * u[0] + (Pp[1] - A[1]) * u[1];
    const t0 = Math.min(0, t - 30),
      t1 = Math.max(L, t + 30);
    for (const sgn of [1, -1])
      out.push(`<line class="mc-slot" x1="${r1(A[0] + u[0] * t0 + n[0] * 5 * sgn)}" y1="${r1(A[1] + u[1] * t0 + n[1] * 5 * sgn)}" x2="${r1(A[0] + u[0] * t1 + n[0] * 5 * sgn)}" y2="${r1(A[1] + u[1] * t1 + n[1] * 5 * sgn)}"/>`);
    const deg = (Math.atan2(u[1], u[0]) * 180) / Math.PI;
    out.push(`<rect class="mc-slider mc-stone" x="${r1(Pp[0] - 11)}" y="${r1(Pp[1] - 7)}" width="22" height="14" transform="rotate(${r1(deg)} ${r1(Pp[0])} ${r1(Pp[1])})"/>`);
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
  // Нагрузки: силы — стрелки к точке приложения, пары — дуги со стрелкой.
  const X = 'forces' in r ? r.forces?.X : null;
  for (const l of pr.loads ?? []) {
    if (l.k === 'force' && pos[l.p]) {
      let base = 0;
      if (l.ref && pos[l.ref] && pos[l.ref2]) base = Math.atan2(pos[l.ref2][1] - pos[l.ref][1], pos[l.ref2][0] - pos[l.ref][0]);
      const th = base + ((num(l.ang) ?? 0) * Math.PI) / 180;
      const val = l.unknown ? X : num(l.F);
      const sg = val != null && val < 0 ? -1 : 1;
      const d: P2 = [Math.cos(th) * sg, -Math.sin(th) * sg];
      const T = S(pos[l.p]);
      // Стрелка — к точке приложения; если с той стороны вектор скорости (ускорения) точки — от точки.
      const ps = r.ok ? r.points.find((q) => q.name === l.p) : undefined;
      const w = ps ? (show === 'v' ? ps.v : ps.a) : null;
      const wm = w ? Math.hypot(w[0], w[1]) : 0;
      const clash = !!w && wm > 0 && (-d[0] * w[0] + d[1] * w[1]) / wm > Math.cos((25 * Math.PI) / 180);
      const tail: P2 = clash ? [T[0] + d[0] * 6, T[1] + d[1] * 6] : [T[0] - d[0] * 62, T[1] - d[1] * 62];
      const head: P2 = clash ? [T[0] + d[0] * 62, T[1] + d[1] * 62] : [T[0] - d[0] * 6, T[1] - d[1] * 6];
      out.push(arrow(tail, head, l.unknown ? 'mc-unk' : 'mc-load'));
      const lp: P2 = clash ? [head[0] + d[0] * 8, head[1] + d[1] * 8] : [tail[0] - d[0] * 6, tail[1] - d[1] * 6];
      const dd = clash ? [-d[0], -d[1]] : d;
      out.push(`<text class="t mc-lt${l.unknown ? ' mc-unkt' : ''}" x="${r1(lp[0] + (dd[1] > 0 ? 6 : -6))}" y="${r1(lp[1] + 4)}" text-anchor="${dd[0] > 0.3 ? 'end' : dd[0] < -0.3 ? 'start' : 'middle'}">${l.unknown ? (val != null ? `X = ${fmt(Math.abs(val), 3)}` : 'X') : `F = ${fmt(Math.abs(val ?? 0), 3)}`}</text>`);
    } else if (l.k === 'couple') {
      const bp = pr.bodies.find((q) => q.name === l.b);
      const ps = (bp?.pts ?? []).filter((q) => pos[q]);
      if (!ps.length) continue;
      const c = S([ps.reduce((s2, q) => s2 + pos[q][0], 0) / ps.length, ps.reduce((s2, q) => s2 + pos[q][1], 0) / ps.length]);
      const val = l.unknown ? X : num(l.M);
      const ccw = (val ?? 1) >= 0;
      const R = 22;
      // Дуга на 270°: против часовой — от 0° к 270° (на экране y вниз).
      const a0 = ccw ? 0 : 270,
        a1 = ccw ? 270 : 0;
      const pnt = (a: number): P2 => [c[0] + R * Math.cos((a * Math.PI) / 180), c[1] - R * Math.sin((a * Math.PI) / 180)];
      const p0 = pnt(a0),
        p1 = pnt(a1);
      const cls = l.unknown ? 'mc-unk' : 'mc-load';
      out.push(`<path class="${cls}" fill="none" d="M${r1(p0[0])} ${r1(p0[1])}A${R} ${R} 0 1 ${ccw ? 0 : 1} ${r1(p1[0])} ${r1(p1[1])}"/>`);
      const tg: P2 = ccw ? [Math.sin((a1 * Math.PI) / 180), Math.cos((a1 * Math.PI) / 180)] : [-Math.sin((a1 * Math.PI) / 180), -Math.cos((a1 * Math.PI) / 180)];
      out.push(`<path class="${cls}-f" d="M${r1(p1[0] + tg[0] * 6)} ${r1(p1[1] + tg[1] * 6)}L${r1(p1[0] - tg[0] * 5 - tg[1] * 4.5)} ${r1(p1[1] - tg[1] * 5 + tg[0] * 4.5)}L${r1(p1[0] - tg[0] * 5 + tg[1] * 4.5)} ${r1(p1[1] - tg[1] * 5 - tg[0] * 4.5)}Z"/>`);
      out.push(`<text class="t mc-lt${l.unknown ? ' mc-unkt' : ''}" x="${r1(c[0] + R + 6)}" y="${r1(c[1] - R)}">${l.unknown ? (val != null ? `X = ${fmt(Math.abs(val), 3)}` : 'X') : `M = ${fmt(Math.abs(val ?? 0), 3)}`}</text>`);
    }
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
  const phi = 'phi' in r && r.phi != null ? ` φ = ${fmt(r.phi, 2)}°.` : '';
  out.push(`<text class="tb-note" x="16" y="${H - 14}">${show === 'v' ? 'Скорости точек (в одном масштабе) и мгновенные центры скоростей P звеньев.' : 'Ускорения точек (в одном масштабе) и мгновенные центры ускорений Q звеньев.'} Положение — в масштабе.${phi}</text>`);
  return { svg: out.join(''), viewBox: `0 0 ${W} ${H}` };
}

function ticks(lo: number, hi: number, n = 5): number[] {
  if (hi - lo < 1e-12) {
    const d = Math.abs(lo) > 1e-12 ? Math.abs(lo) * 0.5 : 1;
    lo -= d;
    hi += d;
  }
  const raw = (hi - lo) / n;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const st = [1, 2, 2.5, 5, 10].map((k) => k * p).find((q) => q >= raw) ?? 10 * p;
  const out: number[] = [];
  for (let x = Math.ceil(lo / st - 1e-9) * st; x <= hi + 1e-9 * st; x += st) out.push(Math.abs(x) < st * 1e-9 ? 0 : x);
  return out;
}

/** График величины по параметру φ: кривая, текущее положение, наибольшее и наименьшее значения. */
export function renderPlot(pl: PlotResult): { svg: string; viewBox: string } {
  const Wp = 1000,
    Hp = 360;
  const x0 = 90,
    y0 = 40,
    w = Wp - 130,
    h = Hp - 100;
  const out: string[] = [`<rect width="${Wp}" height="${Hp}" fill="var(--sheet)"/>`];
  const ys = pl.ys.filter((y): y is number => y != null);
  if (!ys.length) {
    out.push(`<text class="tb-note" x="16" y="${Hp / 2}">Во всём диапазоне механизм не собирается — проверьте построение и диапазон φ.</text>`);
    return { svg: out.join(''), viewBox: `0 0 ${Wp} ${Hp}` };
  }
  let lo = Math.min(...ys),
    hi = Math.max(...ys);
  const ty = ticks(lo, hi);
  lo = Math.min(lo, ty[0]);
  hi = Math.max(hi, ty[ty.length - 1]);
  const xa = pl.xs[0],
    xb = pl.xs[pl.xs.length - 1];
  const tx = ticks(xa, xb, 8);
  const X = (x: number) => x0 + ((x - xa) / (xb - xa || 1)) * w,
    Y = (v: number) => y0 + h - ((v - lo) / (hi - lo || 1)) * h;
  const dy = ty.length > 1 ? Math.abs(ty[1] - ty[0]) : 1;
  const dig = Math.max(0, Math.ceil(-Math.log10(dy || 1)) + 1);
  for (const v of ty) out.push(`<line class="rt-grid" x1="${x0}" y1="${r1(Y(v))}" x2="${x0 + w}" y2="${r1(Y(v))}"/><text class="rt-tick" x="${x0 - 8}" y="${r1(Y(v) + 4)}" text-anchor="end">${fmt(v, dig)}</text>`);
  for (const t of tx) if (t >= xa - 1e-9 && t <= xb + 1e-9) out.push(`<line class="rt-grid" x1="${r1(X(t))}" y1="${y0}" x2="${r1(X(t))}" y2="${y0 + h}"/><text class="rt-tick" x="${r1(X(t))}" y="${y0 + h + 18}" text-anchor="middle">${fmt(t, 1)}</text>`);
  if (lo < 0 && hi > 0) out.push(`<line class="rt-axis" x1="${x0}" y1="${r1(Y(0))}" x2="${x0 + w}" y2="${r1(Y(0))}"/>`);
  out.push(`<line class="rt-axis" x1="${x0}" y1="${y0}" x2="${x0}" y2="${y0 + h}"/><line class="rt-axis" x1="${x0}" y1="${y0 + h}" x2="${x0 + w}" y2="${y0 + h}"/>`);
  out.push(`<text class="rt-title" x="${x0}" y="${y0 - 16}">${esc(pl.label)}</text><text class="rt-tick" x="${x0 + w}" y="${y0 + h + 38}" text-anchor="end">φ, °</text>`);
  // Кривая с разрывами там, где механизм не собирается.
  let seg: string[] = [];
  const segs: string[][] = [];
  pl.ys.forEach((y, i) => {
    if (y == null) {
      if (seg.length > 1) segs.push(seg);
      seg = [];
    } else seg.push(`${r1(X(pl.xs[i]))} ${r1(Y(y))}`);
  });
  if (seg.length > 1) segs.push(seg);
  for (const sg of segs) out.push(`<path class="rt-line" d="M${sg.join('L')}"/>`);
  const mark = (p: { x: number; y: number } | null, cls: string, txt: string, below: boolean) => {
    if (!p) return;
    out.push(`<circle class="${cls}" cx="${r1(X(p.x))}" cy="${r1(Y(p.y))}" r="4.5"/><text class="rt-val" x="${r1(Math.min(X(p.x) + 8, x0 + w - 150))}" y="${r1(below ? Y(p.y) + 18 : Y(p.y) - 8)}">${txt}</text>`);
  };
  if (pl.max && pl.min && pl.max.y - pl.min.y > 1e-12 * Math.max(1, Math.abs(pl.max.y))) {
    mark(pl.max, 'os-max', `max ${fmt(pl.max.y, 4)} (φ ${pl.approx ? '≈' : '='} ${fmt(pl.max.x, 1)}°)`, Y(pl.max.y) < y0 + 20);
    mark(pl.min, 'os-max', `min ${fmt(pl.min.y, 4)} (φ ${pl.approx ? '≈' : '='} ${fmt(pl.min.x, 1)}°)`, Y(pl.min.y) < y0 + h - 20);
  }
  if (pl.cur.y != null && pl.cur.x >= xa - 1e-9 && pl.cur.x <= xb + 1e-9)
    out.push(`<line class="os-tline" x1="${r1(X(pl.cur.x))}" y1="${y0}" x2="${r1(X(pl.cur.x))}" y2="${y0 + h}"/><circle class="rt-end" cx="${r1(X(pl.cur.x))}" cy="${r1(Y(pl.cur.y))}" r="5"><title>φ = ${fmt(pl.cur.x, 2)}°: ${fmt(pl.cur.y, 4)}</title></circle>`);
  return { svg: out.join(''), viewBox: `0 0 ${Wp} ${Hp}` };
}
