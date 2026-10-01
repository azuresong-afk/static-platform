/** Чертежи: равнопеременное вращение (ω(t), φ(t)), эллиптические колёса (положение и ω₂(φ)), фрикционная передача. */
import { evalExpr } from '../../../shared/expr';
import { fmt } from '../../../shared/format';
import { plot } from '../../rotation/draw/rotation';
import { conjugate, ellR, type EllProblem, type EllResult } from '../model/ellipse';
import type { FrProblem, FrResult } from '../model/friction';
import type { UniResult } from '../model/uniform';

const r1 = (v: number) => Math.round(v * 10) / 10;
const W = 1000,
  H = 480;
const VB = `0 0 ${W} ${H}`;
const empty = (msg: string) => ({ svg: `<rect width="${W}" height="${H}" fill="var(--sheet)"/><text class="tb-note" x="16" y="${H / 2}">${msg}</text>`, viewBox: VB });

export function renderUni(r: UniResult): { svg: string; viewBox: string } {
  if (!r.ok) return empty('Отметьте три известные величины и проверьте значения.');
  const Wp: [number, number][] = [],
    Fp: [number, number][] = [];
  for (let i = 0; i <= 200; i++) {
    const t = (r.t * i) / 200;
    Wp.push([t, r.w0 + r.eps * t]);
    Fp.push([t, r.w0 * t + (r.eps * t * t) / 2]);
  }
  return {
    svg: `<rect width="${W}" height="${H}" fill="var(--sheet)"/>${plot(80, 60, 380, 330, Wp, 'ω', 'рад/с', 'с')}${plot(570, 60, 380, 330, Fp, 'φ', 'рад', 'с')}<text class="tb-note" x="16" y="${H - 14}">Равнопеременное вращение: ω линейна по времени, φ — квадратична; точка — конец отрезка [0; t].</text>`,
    viewBox: VB,
  };
}

export function renderEll(pr: EllProblem, r: EllResult): { svg: string; viewBox: string } {
  if (!r.ok) return empty('Проверьте полуоси, межосевое расстояние и угловую скорость.');
  const out: string[] = [`<rect width="${W}" height="${H}" fill="var(--sheet)"/>`];
  const A = r.A,
    rMax = r.max.r1,
    r2Max = A - r.min.r1;
  const k = Math.min(560 / (rMax + A + r2Max), 380 / (2 * Math.max(rMax, r2Max)));
  const O1: [number, number] = [40 + rMax * k + (560 - (rMax + A + r2Max) * k) / 2, 230],
    O2: [number, number] = [O1[0] + A * k, 230];
  const phi = (pr.phi * Math.PI) / 180;
  // Колесо 1: точка тела под углом θ к большой оси — на мировом угле θ + φ.
  const p1: string[] = [];
  for (let i = 0; i <= 360; i++) {
    const th = (i * Math.PI) / 180,
      rr = ellR(pr, th);
    p1.push(`${r1(O1[0] + rr * k * Math.cos(th + phi))} ${r1(O1[1] - rr * k * Math.sin(th + phi))}`);
  }
  out.push(`<path class="gr-wheel" d="M${p1.join('L')}Z"/>`);
  // Колесо 2: при оси в фокусе — сопряжённый профиль (тот же эллипс при A = 2a), повёрнутый на −ψ₂(φ);
  // при оси в центре сопряжённый профиль не замкнут — рисуем такой же овал, касающийся колеса 1 в точке M.
  let p2: string[];
  if (pr.pivot === 'focus') {
    const { pts, psi } = conjugate(pr, A);
    const ps = psi(((phi % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI));
    const c = Math.cos(-ps),
      s = Math.sin(-ps);
    p2 = pts.map(([x, y]) => `${r1(O2[0] + (x * c - y * s) * k)} ${r1(O2[1] - (x * s + y * c) * k)}`);
  } else {
    const { a, b } = pr,
      r2 = A - r.r1;
    const c2 = Math.min(1, Math.max(0, ((a * a * b * b) / (r2 * r2) - a * a) / (b * b - a * a)));
    const th = (Math.sign(Math.sin(2 * phi)) || 1) * Math.acos(Math.sqrt(c2));
    const rot = Math.PI - th;
    p2 = [];
    for (let i = 0; i <= 360; i++) {
      const t = (i * Math.PI) / 180,
        rr = ellR(pr, t);
      p2.push(`${r1(O2[0] + rr * k * Math.cos(t + rot))} ${r1(O2[1] - rr * k * Math.sin(t + rot))}`);
    }
  }
  out.push(`<path class="gr-wheel gr-sel" d="M${p2.join('L')}Z"/>`);
  // Большая ось колеса 1 и линия центров.
  const ax = (L: number): [number, number] => [O1[0] + L * k * Math.cos(phi), O1[1] - L * k * Math.sin(phi)];
  const a0 = ax(pr.pivot === 'focus' ? -(pr.a - r.c) : -pr.a),
    a1 = ax(pr.pivot === 'focus' ? pr.a + r.c : pr.a);
  out.push(`<line class="sb-axis" x1="${r1(a0[0])}" y1="${r1(a0[1])}" x2="${r1(a1[0])}" y2="${r1(a1[1])}"/><line class="sb-axis" x1="${r1(O1[0])}" y1="230" x2="${r1(O2[0])}" y2="230" stroke-dasharray="6 4"/>`);
  const M = O1[0] + r.r1 * k;
  out.push(`<circle class="gr-axle" cx="${r1(O1[0])}" cy="230" r="3.5"/><circle class="gr-axle" cx="${r1(O2[0])}" cy="230" r="3.5"/><circle class="cg-c" cx="${r1(M)}" cy="230" r="5"/>`);
  out.push(`<text class="t gr-t" x="${r1(O1[0])}" y="252" text-anchor="middle">O₁</text><text class="t gr-t" x="${r1(O2[0])}" y="252" text-anchor="middle">O₂</text><text class="t gr-t" x="${r1(M)}" y="216" text-anchor="middle">M</text>`);
  out.push(`<text class="t gr-t" x="${r1(O1[0])}" y="${r1(230 + rMax * k + 26)}" text-anchor="middle">1: ω₁ = ${fmt(r.w1, 4)}</text><text class="t gr-t gr-tsel" x="${r1(O2[0])}" y="${r1(230 + r2Max * k + 26)}" text-anchor="middle">2: ω₂ = ${fmt(r.w2, 4)}</text>`);
  const pts2: [number, number][] = [];
  for (let i = 0; i <= 360; i++) {
    const rr = ellR(pr, (i * Math.PI) / 180);
    pts2.push([i, (r.w1 * rr) / (A - rr)]);
  }
  out.push(plot(720, 70, 240, 320, pts2, 'ω₂', 'рад/с', '° (φ)'));
  out.push(`<text class="tb-note" x="16" y="${H - 14}">Колёса в масштабе при φ = ${fmt(pr.phi, 4)}°${pr.pivot === 'center' ? ' (колесо 2 — условно такой же овал)' : ''}; M — точка касания. Справа — ω₂ по углу поворота колеса 1.</text>`);
  return { svg: out.join(''), viewBox: VB };
}

export function renderFr(pr: FrProblem, r: FrResult): { svg: string; viewBox: string } {
  if (!r.ok) return empty('Проверьте закон вращения ролика, плечо d(t) и радиусы.');
  const out: string[] = [`<rect width="${W}" height="${H}" fill="var(--sheet)"/>`];
  // Вид сверху: диск 2 — окружность радиуса max(R, |d|), ролик — прямоугольник (ребро) на расстоянии d.
  const T = pr.tMax > 0 ? pr.tMax : Math.max(r.t, 1);
  let dMax = Math.abs(r.vals.d);
  for (let i = 0; i <= 100; i++) {
    const d = Math.abs(evalExpr(r.dE, (T * i) / 100));
    if (Number.isFinite(d)) dMax = Math.max(dMax, d);
  }
  const Rd = Math.max(pr.R, dMax, pr.r) * 1.08;
  const k = 190 / Rd,
    C: [number, number] = [300, 230];
  out.push(`<circle class="gr-wheel gr-sel" cx="${C[0]}" cy="${C[1]}" r="${r1(Rd * k)}"/><circle class="gr-axle" cx="${C[0]}" cy="${C[1]}" r="3.5"/>`);
  const x = C[0] + r.vals.d * k;
  out.push(`<rect class="gr-load" x="${r1(x - 7)}" y="${r1(C[1] - pr.r * k)}" width="14" height="${r1(2 * pr.r * k)}"/><line class="sb-axis" x1="${r1(x)}" y1="${r1(C[1] - pr.r * k - 30)}" x2="${r1(x)}" y2="${r1(C[1] + pr.r * k + 30)}"/>`);
  out.push(`<line class="sb-axis" x1="${C[0]}" y1="${C[1] + 30}" x2="${r1(x)}" y2="${C[1] + 30}"/><text class="t gr-t" x="${r1((C[0] + x) / 2)}" y="${C[1] + 50}" text-anchor="middle">d = ${fmt(r.vals.d, 4)}</text>`);
  out.push(`<text class="t gr-t" x="${r1(x + 12)}" y="${r1(C[1] - pr.r * k - 12)}">ролик r = ${fmt(pr.r, 4)}</text><text class="t gr-t gr-tsel" x="${C[0]}" y="${r1(C[1] + Rd * k + 24)}" text-anchor="middle">диск 2: ω₂ = ${fmt(r.vals.w2, 4)}</text>`);
  if (r.point) out.push(`<circle class="cg-c" cx="${C[0]}" cy="${r1(C[1] - r.point.R * k)}" r="5"/><text class="t cv-t t-cvr" x="${C[0] + 10}" y="${r1(C[1] - r.point.R * k + 24)}">a = ${fmt(r.point.a, 4)}</text>`);
  const pts: [number, number][] = [];
  for (let i = 0; i <= 400; i++) {
    const t = (T * i) / 400,
      w = evalExpr(r.w2, t);
    if (Number.isFinite(w) && Math.abs(w) < 1e6) pts.push([t, w]);
  }
  if (pts.length > 1) out.push(plot(700, 70, 260, 320, pts, 'ω₂', 'рад/с', 'с'));
  out.push(`<text class="tb-note" x="16" y="${H - 14}">Вид на диск 2 сверху: ролик касается его на расстоянии d от оси. Справа — ω₂(t) на [0; ${fmt(T, 4)}].</text>`);
  return { svg: out.join(''), viewBox: VB };
}
