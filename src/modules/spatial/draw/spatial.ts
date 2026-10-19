/**
 * Чертёж вкладки «Пространственное движение»: косоугольная проекция (ось x — к зрителю влево вниз, y — вправо,
 * z — вверх). Сложение вращений — неподвижный и подвижный конусы (при качении), оси, векторы ωₑ, ωᵣ, ω, ε, скорости
 * точек; углы Эйлера — неподвижные и повёрнутые оси, ω, ε, точка тела; винт — оси вращений, результирующая ω,
 * винтовая ось и скорость центра приведения; дифференциал — схема колёс, водила и сателлита; гироскоп — ротор,
 * ось прецессии, кинетический момент и гироскопический момент, давления на опоры.
 */
import { fmt } from '../../../shared/format';
import { cross, norm, type V3 } from '../../converging/model/forces';
import { angle } from '../model/compose';
import type { SpOut } from '../model/spatial';
import type { SpState } from '../presets';

const r1 = (v: number) => Math.round(v * 10) / 10;
const W = 1000,
  H = 520;
type P2 = [number, number];
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const unit = (v: V3): V3 => {
  const n = norm(v);
  return n > 0 ? [v[0] / n, v[1] / n, v[2] / n] : [0, 0, 0];
};
const sc3 = (v: V3, k: number): V3 => [v[0] * k, v[1] * k, v[2] * k];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

class Scene {
  out: string[] = [];
  constructor(
    private cx: number,
    private cy: number,
    private s: number,
  ) {}
  P = (v: V3): P2 => [this.cx + this.s * (v[1] - 0.5 * v[0]), this.cy - this.s * (v[2] - 0.32 * v[0])];
  line(a: V3, b: V3, cls: string) {
    const [p, q] = [this.P(a), this.P(b)];
    this.out.push(`<line class="${cls}" x1="${r1(p[0])}" y1="${r1(p[1])}" x2="${r1(q[0])}" y2="${r1(q[1])}"/>`);
  }
  poly(pts: V3[], cls: string, close = false) {
    if (pts.length < 2) return;
    this.out.push(`<path class="${cls}" d="M${pts.map((v) => this.P(v).map(r1).join(' ')).join('L')}${close ? 'Z' : ''}"/>`);
  }
  text(v: V3, s: string, cls = 'sp-lab', dx = 6, dy = -6, anchor = 'start') {
    const p = this.P(v);
    this.out.push(`<text class="${cls}" x="${r1(p[0] + dx)}" y="${r1(p[1] + dy)}" text-anchor="${anchor}">${esc(s)}</text>`);
  }
  /** Стрелка из точки a вдоль вектора d (в мировых единицах). */
  arrow(a: V3, d: V3, cls: string, label?: string) {
    const p = this.P(a),
      q = this.P(add(a, d));
    const dx = q[0] - p[0],
      dy = q[1] - p[1],
      l = Math.hypot(dx, dy);
    if (l < 3) {
      this.out.push(`<circle class="${cls}-f" cx="${r1(q[0])}" cy="${r1(q[1])}" r="3"/>`);
    } else {
      const ux = dx / l,
        uy = dy / l;
      this.out.push(
        `<line class="${cls}" x1="${r1(p[0])}" y1="${r1(p[1])}" x2="${r1(q[0] - ux * 9)}" y2="${r1(q[1] - uy * 9)}"/><path class="${cls}-f" d="M${r1(q[0])} ${r1(q[1])}L${r1(q[0] - ux * 12 - uy * 4.5)} ${r1(q[1] - uy * 12 + ux * 4.5)}L${r1(q[0] - ux * 12 + uy * 4.5)} ${r1(q[1] - uy * 12 - ux * 4.5)}Z"/>`,
      );
    }
    if (label) this.out.push(`<text class="${cls}-t" x="${r1(q[0] + 6)}" y="${r1(q[1] - 6)}">${esc(label)}</text>`);
  }
  /** Окружность в 3D: центр c, нормаль n, радиус R. */
  circle(c: V3, n: V3, R: number, cls: string) {
    const nn = unit(n);
    const a = unit(Math.abs(nn[2]) < 0.9 ? cross(nn, [0, 0, 1]) : cross(nn, [1, 0, 0]));
    const b = cross(nn, a);
    const pts: V3[] = [];
    for (let i = 0; i <= 64; i++) {
      const t = (2 * Math.PI * i) / 64;
      pts.push(add(c, add(sc3(a, R * Math.cos(t)), sc3(b, R * Math.sin(t)))));
    }
    this.poly(pts, cls);
  }
  axes(L: number, names = ['x', 'y', 'z'], cls = 'sp-ax') {
    const E: V3[] = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
    E.forEach((e, i) => {
      this.line([0, 0, 0], sc3(e, L), cls);
      this.text(sc3(e, L), names[i], 'sp-axl', 4, 4);
    });
    this.text([0, 0, 0], 'O', 'sp-axl', -14, 14);
  }
}

/** Конус с вершиной в O: ось e, полуугол a, длина образующей L. */
function cone(S: Scene, e: V3, a: number, L: number, cls: string) {
  const ue = unit(e);
  const h = L * Math.cos(a),
    R = L * Math.sin(a);
  const c = sc3(ue, h);
  S.circle(c, ue, R, cls);
  const side = unit(Math.abs(ue[2]) < 0.9 ? cross(ue, [0, 0, 1]) : cross(ue, [1, 0, 0]));
  for (const k of [1, -1]) S.line([0, 0, 0], add(c, sc3(side, k * R)), cls);
}

function composeScene(out: SpOut, S: Scene) {
  const r = out.compose;
  if (!r || !r.ok) return;
  const pts = r.points.map((p) => p.r);
  const L = Math.max(1, ...pts.map(norm));
  const k = 170 / L;
  // Мировые единицы сцены — длина L ↦ 170 пикселей.
  const w = (v: V3) => sc3(v, k);
  S.axes(200 / 1, ['x', 'y', 'z']);
  if (r.u) {
    cone(S, r.k, angle(r.u, r.k), 190, 'sp-cone0');
    cone(S, r.e, angle(r.u, r.e), 170, 'sp-cone1');
    S.line([0, 0, 0], sc3(r.u, 230), 'sp-inst');
    S.text(sc3(r.u, 230), 'мгн. ось', 'sp-lab');
  }
  S.line([0, 0, 0], sc3(r.e, 220), 'sp-bodyax');
  S.text(sc3(r.e, 220), 'ось тела', 'sp-lab');
  const wm = Math.max(Math.abs(r.we), Math.abs(r.wr), norm(r.w)) || 1;
  const kw = 120 / wm;
  S.arrow([0, 0, 0], sc3(r.k, r.we * kw), 'sp-we', 'ωₑ');
  S.arrow([0, 0, 0], sc3(r.e, r.wr * kw), 'sp-wr', 'ωᵣ');
  S.arrow([0, 0, 0], sc3(r.w, kw), 'sp-w', 'ω');
  if (norm(r.eps) > 0) S.arrow([0, 0, 0], sc3(unit(r.eps), 90), 'sp-eps', 'ε');
  const vm = Math.max(1e-300, ...r.points.map((p) => norm(p.v)));
  for (const p of r.points) {
    const at = w(p.r);
    S.out.push(`<circle class="sp-pt" cx="${r1(S.P(at)[0])}" cy="${r1(S.P(at)[1])}" r="3.5"/>`);
    S.text(at, p.name, 'sp-ptl', -6, 16, 'end');
    if (norm(p.v) > 0) S.arrow(at, sc3(p.v, 70 / vm), 'sp-v', 'v');
  }
}

function eulerScene(out: SpOut, S: Scene) {
  const r = out.euler;
  if (!r || !r.ok) return;
  S.axes(190, ['ξ', 'η', 'ζ'], 'sp-ax');
  const col = (j: number): V3 => [r.R[0][j], r.R[1][j], r.R[2][j]];
  ['x', 'y', 'z'].forEach((n, j) => {
    S.arrow([0, 0, 0], sc3(col(j), 150), 'sp-body', n);
  });
  const wn = norm(r.w);
  if (wn > 0) S.arrow([0, 0, 0], sc3(unit(r.w), 120), 'sp-w', 'ω');
  if (norm(r.eps) > 0) S.arrow([0, 0, 0], sc3(unit(r.eps), 90), 'sp-eps', 'ε');
  if (r.point) {
    const L = norm(r.point.r);
    const at = sc3(r.point.r, 130 / (L || 1));
    S.line([0, 0, 0], at, 'sp-rad');
    S.out.push(`<circle class="sp-pt" cx="${r1(S.P(at)[0])}" cy="${r1(S.P(at)[1])}" r="3.5"/>`);
    S.text(at, 'M', 'sp-ptl', -6, 16, 'end');
    if (norm(r.point.v) > 0) S.arrow(at, sc3(unit(r.point.v), 70), 'sp-v', 'v');
  }
}

function screwScene(st: SpState, out: SpOut, S: Scene) {
  const r = out.screw;
  if (!r || !r.ok) return;
  const pr = st.screw;
  const all: V3[] = [...pr.rots.map((q) => q.p), ...r.points.map((p) => p.r), pr.O, ...(r.red.axisPoint ? [r.red.axisPoint] : [])];
  const L = Math.max(1, ...all.map(norm));
  const k = 150 / L;
  S.axes(190);
  const wm = Math.max(1e-300, ...r.ws.map(norm), norm(r.red.R));
  pr.rots.forEach((q, i) => {
    const p = sc3(q.p, k),
      u = unit(q.d);
    S.line(add(p, sc3(u, -60)), add(p, sc3(u, 80)), 'sp-rotax');
    S.arrow(p, sc3(r.ws[i], 70 / wm), 'sp-wr', q.name);
  });
  const O = sc3(pr.O, k);
  if (norm(r.red.R) > 0) {
    S.arrow(O, sc3(r.red.R, 100 / wm), 'sp-w', 'ω');
    if (r.red.axisPoint) {
      const a = sc3(r.red.axisPoint, k),
        u = unit(r.red.R);
      S.line(add(a, sc3(u, -160)), add(a, sc3(u, 160)), 'sp-inst');
      S.text(add(a, sc3(u, 160)), r.red.kind === 'dynamo' ? 'винтовая ось' : 'мгн. ось', 'sp-lab');
    }
  }
  const vm = Math.max(1e-300, norm(r.red.M), ...r.points.map((p) => norm(p.v)));
  if (norm(r.red.M) > 0) S.arrow(O, sc3(r.red.M, 90 / vm), 'sp-v', 'v_O');
  for (const p of r.points) {
    const at = sc3(p.r, k);
    S.out.push(`<circle class="sp-pt" cx="${r1(S.P(at)[0])}" cy="${r1(S.P(at)[1])}" r="3.5"/>`);
    S.text(at, p.name, 'sp-ptl', -6, 16, 'end');
    if (norm(p.v) > 0) S.arrow(at, sc3(p.v, 70 / vm), 'sp-v', 'v');
  }
}

/** Схема дифференциала в плоскости чертежа. */
function diffSvg(st: SpState, out: SpOut): string {
  const r = out.diff;
  const o: string[] = [];
  const y0 = 300,
    xc = 500;
  const L = (x1: number, y1: number, x2: number, y2: number, cls: string) => o.push(`<line class="${cls}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`);
  const T = (x: number, y: number, s: string, cls = 'sp-lab', a = 'middle') =>
    o.push(`<text class="${cls}" x="${x}" y="${y}" text-anchor="${a}">${esc(s)}</text>`);
  const d = st.diff;
  const R1 = 60 + 40 * Math.min(1, d.R1 / Math.max(d.R1, d.R2)),
    R2 = 60 + 40 * Math.min(1, d.R2 / Math.max(d.R1, d.R2));
  L(120, y0, 880, y0, 'sp-shaft');
  T(890, y0 + 4, 'главная ось', 'sp-lab', 'start');
  // Центральные колёса — конические венцы.
  o.push(`<path class="sp-gear" d="M${xc - 150} ${y0 - 14}L${xc - 150} ${y0 - R1}L${xc - 110} ${y0 - R1 - 30}L${xc - 110} ${y0 - 14}Z"/>`);
  o.push(`<path class="sp-gear" d="M${xc + 150} ${y0 - 14}L${xc + 150} ${y0 - R2}L${xc + 110} ${y0 - R2 - 30}L${xc + 110} ${y0 - 14}Z"/>`);
  T(xc - 150, y0 + 40, `1: R₁ = ${fmt(d.R1, 3)}`);
  T(xc + 150, y0 + 40, `2: R₂ = ${fmt(d.R2, 3)}`);
  // Сателлит на оси водила.
  const ys = y0 - Math.max(R1, R2) - 40;
  o.push(`<path class="sp-sat" d="M${xc - 100} ${ys + 30}L${xc - 60} ${ys - 30}L${xc + 60} ${ys - 30}L${xc + 100} ${ys + 30}Z"/>`);
  L(xc, y0, xc, ys - 60, 'sp-carrier');
  T(xc + 8, ys - 64, 'ось сателлита', 'sp-lab', 'start');
  T(xc, ys - 8, `r₁ = ${fmt(d.r1, 3)}, r₂ = ${fmt(d.r2, 3)}`);
  L(xc - 10, y0 + 70, xc + 10, y0 + 70, 'sp-carrier');
  L(xc, y0, xc, y0 + 70, 'sp-carrier');
  T(xc, y0 + 92, 'водило H');
  if (r && r.ok) {
    T(xc - 150, y0 + 62, `ω₁ = ${fmt(r.w1, 4)}`, 'sp-wr-t');
    T(xc + 150, y0 + 62, `ω₂ = ${fmt(r.w2, 4)}`, 'sp-wr-t');
    T(xc, y0 + 114, `ω_H = ${fmt(r.wH, 4)}`, 'sp-we-t');
    T(xc, ys - 84, `ω_c = ${fmt(r.ws, 4)} (относительно водила)`, 'sp-w-t');
  }
  return o.join('');
}

function gyroScene(st: SpState, out: SpOut, S: Scene) {
  const r = out.gyro;
  if (!r || !r.ok) return;
  const pr = st.gyro;
  const b = (pr.task === 'precession' ? 60 : pr.beta) * (Math.PI / 180);
  // Ось прецессии — Oz, ось ротора — в плоскости Oyz под углом β.
  const e: V3 = [0, Math.sin(b), Math.cos(b)];
  S.line([0, 0, -150], [0, 0, 200], 'sp-ax');
  S.text([0, 0, 200], 'ось прецессии', 'sp-axl', 6, 0);
  S.line(sc3(e, -150), sc3(e, 190), 'sp-bodyax');
  S.circle(sc3(e, 40), e, 70, 'sp-rotor');
  S.circle(sc3(e, 46), e, 70, 'sp-rotor');
  S.arrow(sc3(e, 0), sc3(e, 120), 'sp-wr', 'K = Jω');
  S.arrow([0, 0, 0], [0, 0, 110], 'sp-we', 'Ω');
  const Mdir = unit(cross([0, 0, 1], e));
  if (norm(Mdir) > 0) S.arrow([0, 0, 0], sc3(Mdir, -100), 'sp-eps', 'M_г');
  if (pr.task === 'forced' && pr.l > 0) {
    for (const s of [1, -1]) {
      const p = sc3(e, s * 140);
      S.out.push(`<circle class="sp-pt" cx="${r1(S.P(p)[0])}" cy="${r1(S.P(p)[1])}" r="5"/>`);
      if (norm(Mdir) > 0) S.arrow(p, sc3(cross(Mdir, e), s * 60), 'sp-v', s > 0 ? 'ΔN' : '');
    }
  }
}

export function renderSpatial(st: SpState, out: SpOut): { svg: string; viewBox: string } {
  const head = `<rect width="${W}" height="${H}" fill="var(--sheet)"/>`;
  const err = Object.values(out).find((x) => x && !x.ok) as { ok: false; error: string } | undefined;
  if (err) return { svg: head + `<text class="tb-note" x="16" y="40">${esc(err.error)}</text>`, viewBox: `0 0 ${W} ${H}` };
  if (st.mode === 'diff') return { svg: head + diffSvg(st, out), viewBox: `0 0 ${W} ${H}` };
  const S = new Scene(470, 290, 1.25);
  if (st.mode === 'compose') composeScene(out, S);
  else if (st.mode === 'euler') eulerScene(out, S);
  else if (st.mode === 'screw') screwScene(st, out, S);
  else gyroScene(st, out, S);
  return { svg: head + S.out.join(''), viewBox: `0 0 ${W} ${H}` };
}
