/**
 * Чертежи тяготения: небесное тело с круговыми орбитами; орбита — коническое сечение с телом в фокусе, начальной
 * точкой и скоростью, апсидами и орбитой после импульса (или численная траектория для силы-формулы); прямолинейное
 * движение — схема оси с центрами и графики x(t), v(t) или потенциал U(x) с уровнем энергии.
 */
import { plot } from '../../rotation/draw/rotation';
import {
  radialField,
  type Elements,
  type OrbitProblem,
  type OrbitResult,
  type PlanetProblem,
  type PlanetResult,
  type RadialProblem,
  type RadialResult,
} from '../model/orbit';
import { LEN, num } from '../text/solution';

const r1 = (v: number) => Math.round(v * 10) / 10;
type P2 = [number, number];
const W = 1000,
  H = 480;
const rad = (a: number) => (a * Math.PI) / 180;
const wrap = (out: string[]) => ({ svg: out.join(''), viewBox: `0 0 ${W} ${H}` });
const sheet = () => [`<rect width="${W}" height="${H}" fill="var(--sheet)"/>`];
const note = (out: string[], text: string) => out.push(`<text class="tb-note" x="16" y="${H - 14}">${text}</text>`);

function arrow(a: P2, bb: P2, cls: string) {
  const dx = bb[0] - a[0],
    dy = bb[1] - a[1],
    L = Math.hypot(dx, dy) || 1,
    ux = dx / L,
    uy = dy / L;
  return `<line class="${cls}" x1="${r1(a[0])}" y1="${r1(a[1])}" x2="${r1(bb[0] - ux * 8)}" y2="${r1(bb[1] - uy * 8)}"/><path class="${cls}-f" d="M${r1(bb[0])} ${r1(bb[1])}L${r1(bb[0] - ux * 11 - uy * 4.5)} ${r1(bb[1] - uy * 11 + ux * 4.5)}L${r1(bb[0] - ux * 11 + uy * 4.5)} ${r1(bb[1] - uy * 11 - ux * 4.5)}Z"/>`;
}
const label = (x: number, y: number, cls: string, L: string, S = '', anchor = 'start') =>
  `<text class="t cv-t ${cls}" x="${r1(x)}" y="${r1(y)}" text-anchor="${anchor}">${L}${S ? `<tspan dy="4" font-size="11">${S}</tspan>` : ''}</text>`;
/** Список «обозначение — значение» справа от чертежа. */
function legend(out: string[], x: number, rows: [string, string][]) {
  rows.forEach(([k, v], i) => out.push(`<text class="rt-tick" x="${x}" y="${40 + i * 22}"><tspan font-weight="600">${k}</tspan> ${v}</text>`));
}

/** Подбор масштаба: точки задачи → область [x0, x0 + w] × [y0, y0 + h], ось y вверх. */
function fitter(pts: P2[], x0: number, y0: number, w: number, h: number) {
  const xs = pts.map((p) => p[0]),
    ys = pts.map((p) => p[1]);
  const lo: P2 = [Math.min(...xs), Math.min(...ys)],
    hi: P2 = [Math.max(...xs), Math.max(...ys)];
  const s = Math.min(w / (hi[0] - lo[0] || 1), h / (hi[1] - lo[1] || 1));
  const cx = x0 + w / 2 - ((lo[0] + hi[0]) / 2) * s,
    cy = y0 + h / 2 + ((lo[1] + hi[1]) / 2) * s;
  return { s, P: (p: P2): P2 => [cx + p[0] * s, cy - p[1] * s] };
}

/* ---------- небесное тело ---------- */

export function renderPlanet(pr: PlanetProblem, r: PlanetResult) {
  const out = sheet();
  if (!r.ok) {
    out.push(`<text class="tb-note" x="16" y="${H / 2}">Проверьте данные.</text>`);
    return wrap(out);
  }
  const radii = [r.R, r.R + pr.H, r.rs ?? 0];
  const big = Math.max(...radii);
  const s = 190 / big;
  const C: P2 = [330, 235];
  const Rp = Math.max(r.R * s, 3);
  out.push(`<circle class="ob-body" cx="${C[0]}" cy="${C[1]}" r="${r1(Rp)}"/>`, label(C[0], C[1] + Rp + 22, '', r.name, '', 'middle'));
  if (pr.H > 0) {
    const rr = (r.R + pr.H) * s;
    out.push(`<circle class="ob-orb" cx="${C[0]}" cy="${C[1]}" r="${r1(rr)}"/>`);
    const th = rad(-40);
    const P: P2 = [C[0] + rr * Math.cos(th), C[1] + rr * Math.sin(th)];
    out.push(`<circle class="ob-pt" cx="${r1(P[0])}" cy="${r1(P[1])}" r="4"/>`, arrow(P, [P[0] + 46 * Math.sin(th), P[1] - 46 * Math.cos(th)], 'en-v'));
  }
  if (r.rs != null) {
    const rr = r.rs * s;
    out.push(`<circle class="ob-orb2" cx="${C[0]}" cy="${C[1]}" r="${r1(rr)}"/>`, label(C[0] + rr * 0.72, C[1] - rr * 0.72 - 8, 'ob-t2', 'стационарная', ''));
  }
  out.push(`<line class="ob-guide" x1="${C[0]}" y1="${C[1]}" x2="${r1(C[0] + Rp)}" y2="${C[1]}"/>`, label(C[0] + Rp / 2, C[1] - 8, '', 'R', '', 'middle'));
  const rows: [string, string][] = [
    ['μ =', `${num(r.mu, 4)} км³/с²`],
    ['g =', `${num(r.g, 4)} м/с²`],
    ['R =', `${num(r.R)} км`],
    ['v₁ =', `${num(r.v1, 4)} км/с`],
    ['v₂ =', `${num(r.v2, 4)} км/с`],
  ];
  if (pr.H > 0) rows.push(['H =', `${num(pr.H)} км`], ['v_круг =', `${num(r.vc, 4)} км/с`]);
  if (r.Hs != null) rows.push(['H_стац =', `${num(r.Hs)} км`]);
  legend(out, 640, rows);
  note(
    out,
    r.rs != null ? 'Тело, орбита на высоте H и стационарная орбита (штрих) — в одном масштабе.' : 'Тело и круговая орбита на высоте H — в одном масштабе.',
  );
  return wrap(out);
}

/* ---------- орбита ---------- */

/** Точки конического сечения в пределах видимой области. */
function conic(o: Elements, rView: number): P2[][] {
  const parts: P2[][] = [];
  let cur: P2[] = [];
  const N = 720;
  for (let i = 0; i <= N; i++) {
    const f = (2 * Math.PI * i) / N;
    const den = 1 + o.e * Math.cos(f);
    const r = den > 1e-9 ? o.p / den : Infinity;
    if (r <= rView) {
      const ph = rad(o.eps) + f;
      cur.push([r * Math.cos(ph), r * Math.sin(ph)]);
    } else if (cur.length) {
      parts.push(cur);
      cur = [];
    }
  }
  if (cur.length) parts.push(cur);
  // Склейка через φ = 0 (перицентр): последний кусок продолжает первый.
  if (parts.length > 1 && o.e >= 1) {
    const last = parts.pop()!;
    parts[0] = [...last, ...parts[0]];
  }
  return parts;
}
const path = (pts: P2[], P: (p: P2) => P2, closed = false) => `M${pts.map((p) => P(p).map(r1).join(' ')).join('L')}${closed ? 'Z' : ''}`;

export function renderOrbit(pr: OrbitProblem, r: OrbitResult) {
  const out = sheet();
  if (!r.ok) {
    out.push(`<text class="tb-note" x="16" y="${H / 2}">Проверьте данные.</text>`);
    return wrap(out);
  }
  const L = LEN[pr.unit];
  if (pr.force === 'formula') {
    const pts: P2[] = r.path.map((q) => [q.r * Math.cos(rad(q.phi)), q.r * Math.sin(rad(q.phi))]);
    const F = fitter([...pts, [0, 0]], 40, 40, 560, 380);
    const stepN = Math.max(1, Math.floor(pts.length / 1500));
    const sel = pts.filter((_, i) => i % stepN === 0 || i === pts.length - 1);
    out.push(`<path class="ob-orb" d="${path(sel, F.P)}"/>`);
    const O = F.P([0, 0]);
    out.push(`<circle class="cg-c" cx="${r1(O[0])}" cy="${r1(O[1])}" r="5"/>`, label(O[0] - 8, O[1] + 20, '', 'O', '', 'end'));
    const A = F.P(pts[0]),
      B = F.P(pts[pts.length - 1]);
    const u: P2 = [Math.cos(rad(pr.ph0)), Math.sin(rad(pr.ph0))];
    const vr = Math.sin(rad(pr.th0)),
      vt = Math.cos(rad(pr.th0));
    const d: P2 = [vr * u[0] - vt * u[1], vr * u[1] + vt * u[0]];
    out.push(`<circle class="ob-pt" cx="${r1(A[0])}" cy="${r1(A[1])}" r="4.5"/>`, label(A[0] + 8, A[1] + 20, '', 'M', '0'));
    if (pr.v0 > 0) out.push(arrow(A, [A[0] + d[0] * 50, A[1] - d[1] * 50], 'en-v'), label(A[0] + d[0] * 62, A[1] - d[1] * 62 + 5, 'en-v-t', 'v', '0'));
    out.push(`<circle class="rt-end" cx="${r1(B[0])}" cy="${r1(B[1])}" r="5"/>`, label(B[0] + 8, B[1] - 8, '', 'M'));
    const e = r.end!;
    legend(out, 640, [
      ['a(r) =', pr.ar],
      ['t =', `${num(e.t)} с`],
      ['r =', `${num(e.r, 6)} ${L}`],
      ['φ =', `${num(e.phi, 6)}°`],
      ['r_min =', `${num(r.rmin!, 6)} ${L}`],
      ['r_max =', `${num(r.rmax!, 6)} ${L}`],
    ]);
    note(out, 'Траектория до момента t (численное интегрирование); O — силовой центр, M — конечное положение.');
    return wrap(out);
  }
  const o = r.orb!;
  const orbs = [o, ...(r.after ? [r.after] : [])];
  // Видимая область: апсиды, начальная точка, тело; открытые орбиты — до 3 расстояний начальной точки.
  const reach = Math.max(o.r, pr.R, ...orbs.map((q) => (q.ra != null ? q.ra : Math.max(3 * q.rp, 2.5 * o.r))));
  const rView = reach * 1.0001;
  const pts: P2[] = [[0, 0]];
  const curves = orbs.map((q) => (q.type === 'line' ? [] : conic(q, rView)));
  curves.forEach((c) => c.forEach((part) => pts.push(...part)));
  const M0: P2 = [o.r * Math.cos(rad(o.ph)), o.r * Math.sin(rad(o.ph))];
  pts.push(M0);
  if (pr.R > 0) pts.push([-pr.R, -pr.R], [pr.R, pr.R]);
  const F = fitter(pts, 40, 40, 560, 380);
  const O = F.P([0, 0]);
  if (pr.R > 0) out.push(`<circle class="ob-body" cx="${r1(O[0])}" cy="${r1(O[1])}" r="${r1(Math.max(pr.R * F.s, 3))}"/>`);
  else out.push(`<circle class="cg-c" cx="${r1(O[0])}" cy="${r1(O[1])}" r="5"/>`);
  orbs.forEach((q, i) => {
    const cls = i ? 'ob-orb2' : 'ob-orb';
    if (q.type === 'line') {
      const A = F.P(M0);
      out.push(`<line class="${cls}" x1="${r1(O[0])}" y1="${r1(O[1])}" x2="${r1(A[0])}" y2="${r1(A[1])}"/>`);
      return;
    }
    const closed = q.ra != null && q.ra <= rView;
    for (const part of curves[i]) out.push(`<path class="${cls}" d="${path(part, F.P, closed)}"/>`);
    // Апсиды.
    const pe: P2 = [q.rp * Math.cos(rad(q.eps)), q.rp * Math.sin(rad(q.eps))];
    const Pp = F.P(pe);
    const tcls = i ? 'ob-t2' : '';
    if (q.type !== 'circle') {
      out.push(`<line class="ob-guide" x1="${r1(O[0])}" y1="${r1(O[1])}" x2="${r1(Pp[0])}" y2="${r1(Pp[1])}"/>`);
      out.push(`<circle class="${i ? 'ob-pt2' : 'ob-pt'}" cx="${r1(Pp[0])}" cy="${r1(Pp[1])}" r="3.5"/>`, label(Pp[0] + 6, Pp[1] - 6, tcls, i ? 'П′' : 'П'));
      if (q.ra != null) {
        const Pa = F.P([-q.ra * Math.cos(rad(q.eps)), -q.ra * Math.sin(rad(q.eps))]);
        out.push(`<line class="ob-guide" x1="${r1(O[0])}" y1="${r1(O[1])}" x2="${r1(Pa[0])}" y2="${r1(Pa[1])}"/>`);
        out.push(
          `<circle class="${i ? 'ob-pt2' : 'ob-pt'}" cx="${r1(Pa[0])}" cy="${r1(Pa[1])}" r="3.5"/>`,
          label(Pa[0] + 6, Pa[1] - 6, tcls, 'А', i ? '′' : ''),
        );
      }
    }
  });
  // Начальная точка и скорость (до и после импульса).
  const A = F.P(M0);
  out.push(`<circle class="ob-pt" cx="${r1(A[0])}" cy="${r1(A[1])}" r="4.5"/>`, label(A[0] + 8, A[1] + 20, '', 'M', '0'));
  const vdir = (q: Elements): P2 => {
    const u: P2 = [Math.cos(rad(q.ph)), Math.sin(rad(q.ph))];
    const vr = Math.sin(rad(q.th)),
      vt = Math.cos(rad(q.th));
    return [vr * u[0] - vt * u[1], vr * u[1] + vt * u[0]];
  };
  const vmax = Math.max(...orbs.map((q) => q.v), 1e-300);
  orbs.forEach((q, i) => {
    if (!(q.v > 0)) return;
    const d = vdir(q),
      len = 30 + 40 * (q.v / vmax);
    const B: P2 = [A[0] + d[0] * len, A[1] - d[1] * len];
    // Подписи до и после импульса — по разные стороны стрелки.
    const n: P2 = [d[1], d[0]],
      k = i ? 14 : -14;
    out.push(i ? `<g opacity=".9">${arrow(A, B, 'rc')}</g>` : arrow(A, B, 'en-v'));
    out.push(label(B[0] + d[0] * 10 + n[0] * k, B[1] - d[1] * 10 + n[1] * k + 5, i ? 't-rc' : 'en-v-t', i ? 'v′' : 'v', '0', 'middle'));
  });
  const rows: [string, string][] = [
    ['μ =', `${num(r.mu)} ${L}³/с²`],
    ['e =', num(o.e)],
    ['p =', `${num(o.p)} ${L}`],
    ['r_п =', `${num(o.rp)} ${L}`],
  ];
  if (o.ra != null) rows.push(['r_а =', `${num(o.ra)} ${L}`]);
  if (o.T != null) rows.push(['T =', `${num(o.T)} с`]);
  if (o.vinf != null && o.type === 'hyperbola') rows.push(['v∞ =', `${num(o.vinf)} ${L}/с`]);
  if (r.after) {
    const a = r.after;
    rows.push(['после импульса:', ''], ['e′ =', num(a.e)], ['r_п′ =', `${num(a.rp)} ${L}`]);
    if (a.ra != null) rows.push(['r_а′ =', `${num(a.ra)} ${L}`]);
    if (a.T != null) rows.push(['T′ =', `${num(a.T)} с`]);
  }
  legend(out, 640, rows);
  note(
    out,
    r.after
      ? 'Сплошная — орбита до импульса, штрих — после; П — перицентр, А — апоцентр.'
      : 'Тело — в фокусе орбиты; П — перицентр, А — апоцентр; M₀ — начальная точка.',
  );
  return wrap(out);
}

/* ---------- прямолинейное движение ---------- */

export function renderRadial(pr: RadialProblem, r: RadialResult) {
  const out = sheet();
  if (!r.ok) {
    out.push(`<text class="tb-note" x="16" y="${H / 2}">Проверьте данные.</text>`);
    return wrap(out);
  }
  const L = LEN[pr.unit];
  // Схема оси: центр 1, второй центр, отмеченные точки.
  const marks: { x: number; L: string; S: string }[] = [];
  if (!pr.fromInf && pr.ask !== 'x0') marks.push({ x: pr.x0, L: 'x', S: '0' });
  if (r.x0need != null) marks.push({ x: r.x0need, L: 'x', S: '0' });
  if (r.xtop != null) marks.push({ x: r.xtop, L: 'x', S: pr.ask === 'x0' ? '1' : 'ст' });
  if (pr.ask === 'at' && pr.x1 > 0) marks.push({ x: pr.x1, L: 'x', S: '1' });
  if (r.target != null) marks.push({ x: r.target, L: 'x', S: '1' });
  if (r.xeq != null && r.target !== r.xeq) marks.push({ x: r.xeq, L: 'x', S: 'р' });
  const xmax = Math.max(pr.two ? pr.d : 0, ...marks.map((m) => m.x), pr.R) * 1.08 || 1;
  const X = (x: number) => 60 + (x / xmax) * 880;
  const yA = 80;
  out.push(`<line class="rt-axis" x1="40" y1="${yA}" x2="960" y2="${yA}"/>`, label(966, yA + 5, '', 'x'));
  const R1 = pr.R > 0 ? Math.max(4, Math.min(40, (pr.R / xmax) * 880)) : 6;
  out.push(`<circle class="ob-body" cx="${X(0)}" cy="${yA}" r="${r1(R1)}"/>`, label(X(0), yA + R1 + 20, '', pr.repel ? 'q' : 'O', '1', 'middle'));
  if (pr.two) out.push(`<circle class="ob-body" cx="${r1(X(pr.d))}" cy="${yA}" r="8"/>`, label(X(pr.d), yA + 28, '', 'O', '2', 'middle'));
  const used: number[] = [];
  for (const m of marks) {
    const px = X(m.x);
    const dy = used.filter((u) => Math.abs(u - px) < 34).length;
    used.push(px);
    out.push(`<line class="ob-guide" x1="${r1(px)}" y1="${yA - 10}" x2="${r1(px)}" y2="${yA + 10}"/>`, label(px, yA - 18 - dy * 20, '', m.L, m.S, 'middle'));
  }
  if (!pr.fromInf && pr.ask !== 'v0') {
    const x0 = r.x0need ?? pr.x0,
      v0 = pr.v0;
    if (v0) {
      const px = X(x0),
        len = 60 * Math.sign(v0);
      out.push(arrow([px, yA + 34], [px + len, yA + 34], 'en-v'), label(px + len + Math.sign(v0) * 14, yA + 39, 'en-v-t', 'v', '0', v0 > 0 ? 'start' : 'end'));
    }
  }
  if (pr.fromInf) out.push(arrow([950, yA + 34], [880, yA + 34], 'en-v'), label(872, yA + 39, 'en-v-t', 'v', '∞', 'end'));
  // Нижняя часть: графики движения или потенциал.
  if (r.curve.length > 1) {
    out.push(
      plot(
        90,
        180,
        360,
        220,
        r.curve.map((p) => [p.t, p.x]),
        'x',
        L,
        'с',
      ),
      plot(
        570,
        180,
        360,
        220,
        r.curve.map((p) => [p.t, p.v]),
        'v',
        `${L}/с`,
        'с',
      ),
    );
    note(out, 'Ось x — от центра 1 по линии центров; графики x(t) и v(t) до остановки или до точки x₁.');
    return wrap(out);
  }
  const { U } = radialField(pr, r.mu1, r.mu2);
  const xs: number[] = [];
  const lo = pr.R > 0 ? pr.R : Math.max(Math.min(...marks.map((m) => m.x)) * 0.7, xmax * 0.01);
  const hi = pr.two ? pr.d * 0.995 : Math.max(xmax, 3 * lo);
  for (let i = 0; i <= 300; i++) xs.push(lo + ((hi - lo) * i) / 300);
  const us = xs.map(U).filter(Number.isFinite);
  const E = r.E ?? 0;
  let uLo = Math.min(...us, E),
    uHi = Math.max(...us, E);
  if (uHi - uLo < 1e-12) uHi = uLo + 1;
  const pad = (uHi - uLo) * 0.08;
  uLo -= pad;
  uHi += pad;
  const PX = (x: number) => 90 + ((x - lo) / (hi - lo)) * 840,
    PY = (u: number) => 180 + 220 - ((u - uLo) / (uHi - uLo)) * 220;
  out.push(`<line class="rt-axis" x1="90" y1="400" x2="930" y2="400"/><line class="rt-axis" x1="90" y1="180" x2="90" y2="400"/>`);
  out.push(`<text class="rt-title" x="90" y="166">U(x), ${L}²/с² — потенциал; штрих — уровень энергии E</text>`);
  out.push(`<path class="rt-line" d="M${xs.map((x) => `${r1(PX(x))} ${r1(PY(Math.max(uLo, Math.min(uHi, U(x)))))}`).join('L')}"/>`);
  out.push(`<line class="ob-orb2" x1="90" y1="${r1(PY(E))}" x2="930" y2="${r1(PY(E))}"/>`);
  for (const t of [lo, (lo + hi) / 2, hi]) out.push(`<text class="rt-tick" x="${r1(PX(t))}" y="418" text-anchor="middle">${num(t, 4)}</text>`);
  out.push(`<text class="rt-tick" x="82" y="${r1(PY(E) + 4)}" text-anchor="end">E = ${num(E, 4)}</text>`);
  note(out, 'Точка движется там, где U(x) ≤ E; остановка — в пересечении кривой с уровнем E.');
  return wrap(out);
}
