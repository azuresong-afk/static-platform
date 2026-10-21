/**
 * Чертёж тела в данный момент: очертание (стержень, диск, кольцо, прямоугольник, общий вид по точкам), центр масс C,
 * точки, условные знаки связей, заданные силы и реакции (в масштабе по модулю); справа — a_C и ε.
 */
import { fmt } from '../../../shared/format';
import type { BodyProblem, BodyResult, Constr } from '../model/body';

const r1 = (v: number) => Math.round(v * 10) / 10;
type P2 = [number, number];
const W = 1000,
  H = 480;
const rad = (a: number) => (a * Math.PI) / 180;

function arrow(a: P2, bb: P2, cls: string) {
  const dx = bb[0] - a[0],
    dy = bb[1] - a[1],
    L = Math.hypot(dx, dy) || 1,
    ux = dx / L,
    uy = dy / L;
  return `<line class="${cls}" x1="${r1(a[0])}" y1="${r1(a[1])}" x2="${r1(bb[0] - ux * 8)}" y2="${r1(bb[1] - uy * 8)}"/><path class="${cls}-f" d="M${r1(bb[0])} ${r1(bb[1])}L${r1(bb[0] - ux * 11 - uy * 4.5)} ${r1(bb[1] - uy * 11 + ux * 4.5)}L${r1(bb[0] - ux * 11 + uy * 4.5)} ${r1(bb[1] - uy * 11 - ux * 4.5)}Z"/>`;
}
/** Дуга со стрелкой вокруг точки: ccw — против часовой стрелки (на экране). */
function arc(c: P2, R: number, ccw: boolean, cls: string) {
  const p = (t: number): P2 => [c[0] + R * Math.cos(rad(t)), c[1] - R * Math.sin(rad(t))];
  const [t0, t1] = ccw ? [-60, 180] : [240, 0];
  const a = p(t0),
    e = p(t1);
  const tg: P2 = ccw ? [-Math.sin(rad(t1)), -Math.cos(rad(t1))] : [Math.sin(rad(t1)), Math.cos(rad(t1))];
  return `<path class="${cls}" d="M${r1(a[0])} ${r1(a[1])}A${R} ${R} 0 1 ${ccw ? 0 : 1} ${r1(e[0])} ${r1(e[1])}" fill="none"/>${arrow([e[0] - tg[0] * 2, e[1] - tg[1] * 2], [e[0] + tg[0] * 10, e[1] + tg[1] * 10], cls)}`;
}
/** Подпись с нижним индексом. */
const label = (x: number, y: number, cls: string, L: string, S = '', anchor = 'start') =>
  `<text class="t cv-t ${cls}" x="${r1(x)}" y="${r1(y)}" text-anchor="${anchor}">${L}${S ? `<tspan dy="4" font-size="10">${S}</tspan>` : ''}</text>`;
/** Неподвижная опорная линия длиной len по направлению t через точку p со штриховкой в сторону s. */
function ground(p: P2, t: P2, s: P2, len: number) {
  const out = [
    `<line class="en-ground" x1="${r1(p[0] - (t[0] * len) / 2)}" y1="${r1(p[1] - (t[1] * len) / 2)}" x2="${r1(p[0] + (t[0] * len) / 2)}" y2="${r1(p[1] + (t[1] * len) / 2)}"/>`,
  ];
  for (let q = -len / 2 + 6; q <= len / 2; q += 12) {
    const a: P2 = [p[0] + t[0] * q, p[1] + t[1] * q];
    out.push(`<line class="en-hatch" x1="${r1(a[0])}" y1="${r1(a[1])}" x2="${r1(a[0] + s[0] * 9 - t[0] * 7)}" y2="${r1(a[1] + s[1] * 9 - t[1] * 7)}"/>`);
  }
  return out.join('');
}

/** Выпуклая оболочка (обход Эндрю). */
function hull(ps: P2[]): P2[] {
  const p = [...ps].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cr = (o: P2, a: P2, b: P2) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: P2[] = [],
    up: P2[] = [];
  for (const q of p) {
    while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop();
    lo.push(q);
  }
  for (const q of [...p].reverse()) {
    while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop();
    up.push(q);
  }
  return [...lo.slice(0, -1), ...up.slice(0, -1)];
}

export function renderBody(pr: BodyProblem, r: BodyResult): { svg: string; viewBox: string } {
  const out: string[] = [`<rect width="${W}" height="${H}" fill="var(--sheet)"/>`];
  if (!r.ok) {
    out.push(`<text class="tb-note" x="16" y="${H / 2}">Проверьте данные.</text>`);
    return { svg: out.join(''), viewBox: `0 0 ${W} ${H}` };
  }
  // Очертание тела в координатах от C.
  const pts = [...r.pts.values()];
  let shape: P2[] = [];
  if (pr.shape === 'disk' || pr.shape === 'ring')
    shape = [
      [-pr.R, -pr.R],
      [pr.R, pr.R],
    ];
  if (pr.shape === 'rect')
    shape = [
      [-pr.a / 2, -pr.b / 2],
      [pr.a / 2, pr.b / 2],
    ];
  const scr = (d: P2): P2 => [d[0], -d[1]];
  const unit = (d: P2): P2 => {
    const l = Math.hypot(...d);
    return l > 1e-12 ? [d[0] / l, d[1] / l] : [0, 0];
  };
  // Масштаб сил: длина стрелки на экране по модулю силы.
  const forces = [
    pr.gravity ? r.P : 0,
    ...pr.loads.map((l) => (l.kind === 'force' ? Math.hypot(l.fx, l.fy) : 0)),
    ...r.reactions.map((x) => Math.hypot(...x.F)),
  ];
  const Fmax = Math.max(1e-12, ...forces);
  const L = (v: number) => 30 + 80 * (Math.abs(v) / Fmax);
  const at = (name: string) => r.pts.get(name.trim())!;
  /** Шарнир: знак опоры — с той стороны точки, что дальше от C. */
  const away = (p: P2): P2 => (Math.hypot(...p) > 1e-12 ? scr(unit(p)) : [0, 1]);
  // Что должно поместиться: точки тела (смещение 0) и концы стрелок, знаков связей и подписей (смещение на экране).
  const items: { p: P2; o: P2 }[] = [...pts, ...shape].map((p) => ({ p, o: [0, 0] as P2 }));
  const pad = (p: P2, d: P2, len: number) => items.push({ p, o: [d[0] * len, d[1] * len] });
  if (pr.gravity) pad([0, 0], [0, 1], L(r.P) + 6);
  for (const l of pr.loads) if (l.kind === 'force' && Math.hypot(l.fx, l.fy) > 1e-12) pad(at(l.at), scr(unit([l.fx, l.fy])), L(Math.hypot(l.fx, l.fy)) + 24);
  for (const x of r.reactions) {
    const c = pr.constr[x.i],
      P = at(c.at);
    if (!x.dropped && Math.hypot(...x.F) > 1e-9 * Fmax) pad(P, scr(unit(x.F)), L(Math.hypot(...x.F)) + 24);
    const n = scr([Math.cos(rad(c.ang)), Math.sin(rad(c.ang))]);
    if (c.kind === 'pin') pad(P, away(P), 36);
    if (c.kind === 'roller' || c.kind === 'roll') {
      pad(P, [n[1], -n[0]], 66);
      pad(P, [-n[1], n[0]], 66);
      pad(P, [-n[0], -n[1]], 20);
    }
    if (c.kind === 'unwind') pad(P, n, 130);
    if (c.kind === 'rope') items.push({ p: [c.qx, c.qy], o: [0, 0] }, { p: [c.qx, c.qy], o: scr(unit([c.qx - P[0], c.qy - P[1]])).map((v) => v * 16) as P2 });
  }
  // Наибольший масштаб, при котором всё помещается в поле 30…740 × 30…450.
  const AW = 710,
    AH = 420;
  const box = (k: number) => {
    const xs = items.map((it) => k * it.p[0] + it.o[0]),
      ys = items.map((it) => -k * it.p[1] + it.o[1]);
    return [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  };
  let lo = 1e-6,
    hi = 1e7;
  for (let it = 0; it < 80; it++) {
    const mid = Math.sqrt(lo * hi);
    const [a0, a1, b0, b1] = box(mid);
    if (a1 - a0 <= AW && b1 - b0 <= AH) lo = mid;
    else hi = mid;
  }
  const k = lo;
  const [bx0, bx1, by0, by1] = box(k);
  const ox = 30 + (AW - (bx1 - bx0)) / 2 - bx0,
    oy = 30 + (AH - (by1 - by0)) / 2 - by0;
  const S = (p: P2): P2 => [ox + k * p[0], oy - k * p[1]];
  const C = S([0, 0]);
  // Тело.
  if (pr.shape === 'rod')
    out.push(
      `<line class="mc-bar" x1="${r1(S(r.pts.get('A')!)[0])}" y1="${r1(S(r.pts.get('A')!)[1])}" x2="${r1(S(r.pts.get('B')!)[0])}" y2="${r1(S(r.pts.get('B')!)[1])}"/>`,
    );
  else if (pr.shape === 'disk' || pr.shape === 'ring') {
    out.push(`<circle class="en-wheel" cx="${r1(C[0])}" cy="${r1(C[1])}" r="${r1(pr.R * k)}"/>`);
    if (pr.shape === 'ring') out.push(`<circle class="en-wheel2" cx="${r1(C[0])}" cy="${r1(C[1])}" r="${r1(pr.R * k * 0.88)}"/>`);
  } else if (pr.shape === 'rect') {
    const a = S([-pr.a / 2, pr.b / 2]);
    out.push(`<rect class="mc-plate" x="${r1(a[0])}" y="${r1(a[1])}" width="${r1(pr.a * k)}" height="${r1(pr.b * k)}"/>`);
  } else {
    const h = hull(pts);
    if (h.length >= 3) out.push(`<path class="mc-plate" d="M${h.map((p) => S(p).map(r1).join(' ')).join('L')}Z"/>`);
    else if (h.length === 2) out.push(`<line class="mc-bar" x1="${r1(S(h[0])[0])}" y1="${r1(S(h[0])[1])}" x2="${r1(S(h[1])[0])}" y2="${r1(S(h[1])[1])}"/>`);
    else out.push(`<circle class="mc-plate" cx="${r1(C[0])}" cy="${r1(C[1])}" r="22"/>`);
  }
  // Связи.
  const drawConstr = (c: Constr, i: number, dropped: boolean) => {
    const P = S(r.pts.get(c.at.trim())!);
    const o: string[] = [];
    const n = scr([Math.cos(rad(c.ang)), Math.sin(rad(c.ang))]);
    const t: P2 = [n[1], -n[0]];
    if (c.kind === 'pin') {
      const u = away(r.pts.get(c.at.trim())!),
        v: P2 = [-u[1], u[0]];
      const B: P2 = [P[0] + u[0] * 22, P[1] + u[1] * 22];
      o.push(
        `<path class="sb-tip" d="M${r1(P[0])} ${r1(P[1])}L${r1(B[0] + v[0] * 12)} ${r1(B[1] + v[1] * 12)}L${r1(B[0] - v[0] * 12)} ${r1(B[1] - v[1] * 12)}Z"/>`,
        ground(B, v, u, 40),
        `<circle class="hinge" cx="${r1(P[0])}" cy="${r1(P[1])}" r="4.5"/>`,
      );
    } else if (c.kind === 'roller' || c.kind === 'roll') {
      if (c.kind === 'roller' && !c.one) {
        o.push(ground([P[0] - n[0] * 7, P[1] - n[1] * 7], t, [-n[0], -n[1]], 110), ground([P[0] + n[0] * 7, P[1] + n[1] * 7], t, n, 110));
        o.push(`<circle class="mc-slider" cx="${r1(P[0])}" cy="${r1(P[1])}" r="5"/>`);
      } else o.push(ground(P, t, [-n[0], -n[1]], 130));
    } else if (c.kind === 'rope') {
      const Q = S([c.qx, c.qy]);
      const e: P2 = [Q[0] - P[0], Q[1] - P[1]];
      const le = Math.hypot(...e) || 1;
      o.push(
        `<line class="en-rope" x1="${r1(P[0])}" y1="${r1(P[1])}" x2="${r1(Q[0])}" y2="${r1(Q[1])}"/>`,
        ground(Q, [-e[1] / le, e[0] / le], [e[0] / le, e[1] / le], 36),
      );
    } else {
      const E: P2 = [P[0] + n[0] * 110, P[1] + n[1] * 110];
      o.push(`<line class="en-rope" x1="${r1(P[0])}" y1="${r1(P[1])}" x2="${r1(E[0])}" y2="${r1(E[1])}"/>`, ground(E, t, n, 36));
    }
    o.push(`<circle class="sb-pt" cx="${r1(P[0])}" cy="${r1(P[1])}" r="3"/>`);
    if (dropped) return `<g opacity=".35">${o.join('')}</g>${label(P[0] + 10, P[1] + 28, 'tb-note', `связь ${i + 1} снята`)}`;
    return o.join('');
  };
  r.reactions.forEach((x) => out.push(drawConstr(pr.constr[x.i], x.i, x.dropped)));
  // Центр масс и точки.
  out.push(`<circle class="cg-c" cx="${r1(C[0])}" cy="${r1(C[1])}" r="6"/><text class="cg-ct" x="${r1(C[0] + 10)}" y="${r1(C[1] + 20)}">C</text>`);
  for (const [name, p] of r.pts) {
    if (name === 'C') continue;
    const q = S(p);
    let d = Math.hypot(...p) > 1e-12 ? scr(unit(p)) : ([0.7, -0.7] as P2);
    // У шарнира знак опоры — снаружи: подпись сбоку.
    if (pr.constr.some((c) => c.kind === 'pin' && c.at.trim() === name)) d = -d[1] >= 0 ? [-d[1], d[0]] : [d[1], -d[0]];
    out.push(
      `<circle class="sb-pt" cx="${r1(q[0])}" cy="${r1(q[1])}" r="3"/><text class="t-pt" x="${r1(q[0] + d[0] * 16 - 6)}" y="${r1(q[1] + d[1] * 16 + 6)}">${name}</text>`,
    );
  }
  // Заданные силы.
  if (pr.gravity) out.push(arrow(C, [C[0], C[1] + L(r.P)], 'ld'), label(C[0] - 8, C[1] + L(r.P) * 0.6, 't-ld', 'P', '', 'end'));
  pr.loads.forEach((l, i) => {
    if (l.kind === 'moment') {
      out.push(arc(C, 40, l.m > 0, 'en-mom'), label(C[0] - 46, C[1] - 30, 't-ld', 'M', String(i + 1), 'end'));
      return;
    }
    const F = Math.hypot(l.fx, l.fy);
    if (F < 1e-12) return;
    const P = S(r.pts.get(l.at.trim())!);
    const d = scr([l.fx / F, l.fy / F]);
    const E: P2 = [P[0] + d[0] * L(F), P[1] + d[1] * L(F)];
    out.push(arrow(P, E, 'ld'), label(E[0] + d[0] * 8, E[1] + d[1] * 8 + 4, 't-ld', 'F', String(i + 1), d[0] < -0.3 ? 'end' : 'start'));
  });
  // Реакции.
  for (const x of r.reactions) {
    const F = Math.hypot(...x.F);
    if (x.dropped || F < 1e-9 * Fmax) continue;
    const P = S(r.pts.get(x.at.trim())!);
    const d = scr([x.F[0] / F, x.F[1] / F]);
    const E: P2 = [P[0] + d[0] * L(F), P[1] + d[1] * L(F)];
    const name = x.vals.length > 1 ? 'R' : x.vals[0].name;
    out.push(arrow(P, E, 'rc'), label(E[0] + d[0] * 8, E[1] + d[1] * 8 + 4, 't-rc', name, String(x.i + 1), d[0] < -0.3 ? 'end' : 'start'));
  }
  // Ускорения (справа): стрелка a_C по центру, дуга ε в сторону вращения.
  const lx = 875;
  out.push(`<line class="rt-grid" x1="760" y1="40" x2="760" y2="${H - 40}"/>`);
  const a = Math.hypot(...r.aC);
  out.push(label(lx, 62, 'en-vt', 'a', 'C', 'middle'), `<text class="t cv-t en-vt" x="${lx}" y="86" text-anchor="middle">${fmt(a, 4)} м/с²</text>`);
  if (a > 1e-12) {
    const d = scr([r.aC[0] / a, r.aC[1] / a]);
    out.push(arrow([lx - d[0] * 40, 165 - d[1] * 40], [lx + d[0] * 40, 165 + d[1] * 40], 'en-v'));
  } else out.push(`<circle class="cg-c" cx="${lx}" cy="165" r="4"/>`);
  out.push(
    `<text class="t cv-t en-vt" x="${lx}" y="268" text-anchor="middle">ε</text><text class="t cv-t en-vt" x="${lx}" y="292" text-anchor="middle">${fmt(r.eps, 4)} рад/с²</text>`,
  );
  if (Math.abs(r.eps) > 1e-12) out.push(arc([lx, 360], 30, r.eps > 0, 'en-v'));
  if (pr.omega) out.push(`<text class="t cv-t en-vt" x="${lx}" y="430" text-anchor="middle">ω = ${fmt(pr.omega, 4)} рад/с</text>`);
  out.push(
    `<text class="tb-note" x="16" y="${H - 14}">${pr.mode === 'given' ? 'Движение задано; ' : ''}реакции и силы — в масштабе по модулю; ось x вправо, y вверх.</text>`,
  );
  return { svg: out.join(''), viewBox: `0 0 ${W} ${H}` };
}
