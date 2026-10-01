/** Чертежи: траектории точек и центра масс; схема смещения основания; колесо на наклонной опоре с силами. */
import { evalExpr } from '../../../shared/expr';
import { fmt } from '../../../shared/format';
import type { PointsProblem, PointsResult, ShiftProblem, ShiftResult } from '../model/system';
import type { WheelProblem, WheelResult } from '../model/wheel';

const r1 = (v: number) => Math.round(v * 10) / 10;
const W = 1000,
  H = 480;
type P2 = [number, number];
const bg = `<rect width="${W}" height="${H}" fill="var(--sheet)"/>`;
const wrap = (out: string[]) => ({ svg: out.join(''), viewBox: `0 0 ${W} ${H}` });

function arrow(a: P2, bb: P2, cls: string) {
  const dx = bb[0] - a[0],
    dy = bb[1] - a[1],
    L = Math.hypot(dx, dy) || 1,
    ux = dx / L,
    uy = dy / L;
  return `<line class="${cls}" x1="${r1(a[0])}" y1="${r1(a[1])}" x2="${r1(bb[0] - ux * 8)}" y2="${r1(bb[1] - uy * 8)}"/><path class="${cls}-f" d="M${r1(bb[0])} ${r1(bb[1])}L${r1(bb[0] - ux * 11 - uy * 4.5)} ${r1(bb[1] - uy * 11 + ux * 4.5)}L${r1(bb[0] - ux * 11 + uy * 4.5)} ${r1(bb[1] - uy * 11 - ux * 4.5)}Z"/>`;
}

export function renderPoints(pr: PointsProblem, r: PointsResult) {
  const out = [bg];
  if (!r.ok) return wrap([...out, `<text class="tb-note" x="16" y="${H / 2}">Проверьте законы движения.</text>`]);
  const ta = pr.t2 > pr.t1 ? pr.t1 : 0,
    tb = pr.t2 > pr.t1 ? pr.t2 : Math.max(1, pr.t);
  const n = 400;
  const paths = r.ex.map((e) => Array.from({ length: n + 1 }, (_, i) => [evalExpr(e.x, ta + ((tb - ta) * i) / n), evalExpr(e.y, ta + ((tb - ta) * i) / n)] as P2));
  const cpath = Array.from({ length: n + 1 }, (_, i) => {
    const t = ta + ((tb - ta) * i) / n;
    return [r.ex.reduce((s, e, j) => s + r.masses[j] * evalExpr(e.x, t), 0) / r.M, r.ex.reduce((s, e, j) => s + r.masses[j] * evalExpr(e.y, t), 0) / r.M] as P2;
  });
  const all = [...paths.flat(), ...cpath, [0, 0] as P2].filter((p) => p.every(Number.isFinite));
  const xs = all.map((p) => p[0]),
    ys = all.map((p) => p[1]);
  const x0 = Math.min(...xs),
    x1 = Math.max(...xs),
    y0 = Math.min(...ys),
    y1 = Math.max(...ys);
  const k = Math.min((W - 220) / Math.max(x1 - x0, 1e-9), (H - 140) / Math.max(y1 - y0, 1e-9));
  const ox = 110 + (W - 220 - (x1 - x0) * k) / 2,
    oy = H - 70 - (H - 140 - (y1 - y0) * k) / 2;
  const S = (p: P2): P2 => [ox + (p[0] - x0) * k, oy - (p[1] - y0) * k];
  const O = S([0, 0]);
  out.push(`<line class="sb-axis" x1="60" y1="${r1(O[1])}" x2="${W - 60}" y2="${r1(O[1])}"/><text class="sb-axt" x="${W - 50}" y="${r1(O[1] + 5)}">x</text><line class="sb-axis" x1="${r1(O[0])}" y1="${H - 50}" x2="${r1(O[0])}" y2="40"/><text class="sb-axt" x="${r1(O[0] + 6)}" y="36">y</text>`);
  const line = (ps: P2[], cls: string) => `<path class="${cls}" d="M${ps.filter((p) => p.every(Number.isFinite)).map((p) => S(p).map(r1).join(' ')).join('L')}"/>`;
  paths.forEach((ps, i) => {
    out.push(line(ps, 'mc-path'));
    const P = S([evalExpr(r.ex[i].x, pr.t), evalExpr(r.ex[i].y, pr.t)]);
    out.push(`<circle class="cg-mass" cx="${r1(P[0])}" cy="${r1(P[1])}" r="6"/><text class="t cv-t en-vt" x="${r1(P[0] + 9)}" y="${r1(P[1] - 8)}">${i + 1}</text>`);
  });
  out.push(line(cpath, 'rt-line'));
  const C = S(r.C);
  out.push(`<circle class="cg-c" cx="${r1(C[0])}" cy="${r1(C[1])}" r="6"/><text class="cg-ct" x="${r1(C[0] + 10)}" y="${r1(C[1] + 18)}">C</text>`);
  out.push(`<text class="tb-note" x="16" y="${H - 14}">Траектории точек (тонкие) и центра масс C (синяя) на отрезке времени; кружки — положения в момент t.</text>`);
  return wrap(out);
}

export function renderShift(pr: ShiftProblem, r: ShiftResult) {
  const out = [bg];
  if (!r.ok) return wrap(out);
  const n = pr.parts.length;
  const base: P2 = [W / 2 - 300, 300];
  out.push(`<line class="en-ground" x1="60" y1="360" x2="${W - 60}" y2="360"/>`);
  out.push(`<rect class="en-load" x="${base[0]}" y="300" width="600" height="60"/><text class="t cv-t" x="${W / 2}" y="337" text-anchor="middle">основание, m = ${fmt(pr.M0, 4)}</text>`);
  const dxBase = pr.unknown < 0 ? r.answer : 0;
  const maxD = Math.max(1e-9, ...r.dx.map(Math.abs), Math.abs(dxBase));
  const k = 160 / maxD;
  pr.parts.forEach((p, i) => {
    const P: P2 = [base[0] + (600 * (i + 1)) / (n + 1), 250];
    const th = (p.theta * Math.PI) / 180;
    const s = i === pr.unknown ? r.answer : p.s;
    const L = Math.abs(s) * k;
    out.push(`<circle class="cg-mass" cx="${r1(P[0])}" cy="${P[1]}" r="12"/><text class="t cv-t en-vt" x="${r1(P[0])}" y="${P[1] - 22}" text-anchor="middle">${i + 1}: m = ${fmt(p.m, 4)}</text>`);
    if (L > 1) out.push(arrow(P, [P[0] + Math.sign(s) * Math.cos(th) * L, P[1] - Math.sign(s) * Math.sin(th) * L], i === pr.unknown ? 'cv-r' : 'en-v'));
  });
  if (Math.abs(dxBase) > 1e-12) out.push(arrow([W / 2, 400], [W / 2 + Math.sign(dxBase) * Math.abs(dxBase) * k, 400], 'cv-r'), `<text class="t cv-t t-cvr" x="${W / 2}" y="${430}" text-anchor="middle">Δx = ${fmt(dxBase, 4)}</text>`);
  out.push(`<text class="tb-note" x="16" y="${H - 14}">Стрелки у частей — перемещения относительно основания (в масштабе); красная — найденное перемещение.</text>`);
  return wrap(out);
}

export function renderWheel(pr: WheelProblem, r: WheelResult) {
  const out = [bg];
  if (!r.ok) return wrap(out);
  const a = (pr.alpha * Math.PI) / 180;
  const t: P2 = [Math.cos(a), Math.sin(a)]; // вниз по уклону на экране: вправо-вниз
  const n: P2 = [Math.sin(a), -Math.cos(a)]; // от опоры
  const R = 90;
  const Q: P2 = [W / 2, 330]; // точка касания
  const C: P2 = [Q[0] + n[0] * R, Q[1] + n[1] * R];
  out.push(`<line class="en-ground" x1="${r1(Q[0] - t[0] * 420)}" y1="${r1(Q[1] - t[1] * 420)}" x2="${r1(Q[0] + t[0] * 420)}" y2="${r1(Q[1] + t[1] * 420)}"/>`);
  for (let i = -8; i <= 8; i++) {
    const p: P2 = [Q[0] + t[0] * i * 50, Q[1] + t[1] * i * 50];
    out.push(`<line class="en-hatch" x1="${r1(p[0])}" y1="${r1(p[1])}" x2="${r1(p[0] - n[0] * 10 - t[0] * 8)}" y2="${r1(p[1] - n[1] * 10 - t[1] * 8)}"/>`);
  }
  out.push(`<circle class="en-wheel" cx="${r1(C[0])}" cy="${r1(C[1])}" r="${R}"/><circle class="hinge" cx="${r1(C[0])}" cy="${r1(C[1])}" r="4"/>`);
  if (pr.e) out.push(`<circle class="en-wheel2" cx="${r1(C[0])}" cy="${r1(C[1])}" r="${r1((Math.abs(pr.e) / pr.r) * R)}"/>`);
  const Fmax = Math.max(1e-9, r.P, Math.abs(r.N), Math.abs(r.Ftr), Math.abs(pr.F), Math.abs(pr.T));
  const L = (v: number) => 30 + 90 * (Math.abs(v) / Fmax);
  out.push(arrow(C, [C[0], C[1] + L(r.P)], 'ld'), `<text class="t cv-t t-ld" x="${r1(C[0] + 8)}" y="${r1(C[1] + L(r.P) + 4)}">P</text>`);
  out.push(arrow([Q[0] + n[0] * 2, Q[1] + n[1] * 2], [Q[0] + n[0] * L(r.N), Q[1] + n[1] * L(r.N)], 'rc'), `<text class="t cv-t t-rc" x="${r1(Q[0] + n[0] * L(r.N) - 26)}" y="${r1(Q[1] + n[1] * L(r.N))}">N</text>`);
  if (Math.abs(r.Ftr) > 1e-9) {
    const s = Math.sign(r.Ftr);
    out.push(arrow(Q, [Q[0] + t[0] * s * L(r.Ftr), Q[1] + t[1] * s * L(r.Ftr)], 'rc'), `<text class="t cv-t t-rc" x="${r1(Q[0] + t[0] * s * L(r.Ftr))}" y="${r1(Q[1] + t[1] * s * L(r.Ftr) + 20)}" text-anchor="middle">F<tspan dy="4" font-size="10">тр</tspan></text>`);
  }
  if (pr.F) out.push(arrow(C, [C[0] + t[0] * Math.sign(pr.F) * L(pr.F), C[1] + t[1] * Math.sign(pr.F) * L(pr.F)], 'ld'), `<text class="t cv-t t-ld" x="${r1(C[0] + t[0] * L(pr.F) + 6)}" y="${r1(C[1] + t[1] * L(pr.F) - 8)}">F</text>`);
  if (pr.T) {
    const b = (pr.beta * Math.PI) / 180;
    const d: P2 = [t[0] * Math.cos(b) + n[0] * Math.sin(b), t[1] * Math.cos(b) + n[1] * Math.sin(b)];
    const A: P2 = [C[0], C[1] + (pr.e < 0 ? (Math.abs(pr.e) / pr.r) * R : -(Math.abs(pr.e) / pr.r) * R)];
    out.push(arrow(A, [A[0] + d[0] * L(pr.T), A[1] + d[1] * L(pr.T)], 'ld'), `<text class="t cv-t t-ld" x="${r1(A[0] + d[0] * L(pr.T) + 6)}" y="${r1(A[1] + d[1] * L(pr.T))}">T</text>`);
  }
  if (pr.M) out.push(`<path class="en-mom" d="M${r1(C[0] + R + 14)} ${r1(C[1])}A${R + 14} ${R + 14} 0 0 1 ${r1(C[0])} ${r1(C[1] + R + 14)}"/><text class="t cv-t t-ld" x="${r1(C[0] + R + 18)}" y="${r1(C[1] + 30)}">M</text>`);
  if (Math.abs(r.a) > 1e-9) out.push(arrow([C[0] - t[0] * 20, C[1] - t[1] * 20 - 130], [C[0] - t[0] * 20 + t[0] * Math.sign(r.a) * 70, C[1] - t[1] * 20 - 130 + t[1] * Math.sign(r.a) * 70], 'en-v'), `<text class="t cv-t en-vt" x="${r1(C[0] + 60)}" y="${r1(C[1] - 140)}">a<tspan dy="4" font-size="10">C</tspan><tspan dy="-4"> = ${fmt(r.a, 4)}</tspan></text>`);
  out.push(`<text class="tb-note" x="16" y="${H - 14}">${r.rolls ? 'Качение без скольжения: точка касания — мгновенный центр скоростей.' : 'Колесо проскальзывает: трение равно fN.'} Ось x — ${pr.alpha ? 'вниз по наклону' : 'вправо'}.</text>`);
  return wrap(out);
}
