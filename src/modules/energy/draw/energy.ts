/**
 * Схема системы (условная, без масштаба): блоки — на неподвижных осях вверху, подвешенные грузы — под ними,
 * грузы и катки на наклонных плоскостях — внизу. Нити — от точки схода к точке крепления, у блоков — по касательной.
 * У каждого тела — скорость через скорость ведущего тела.
 */
import { fmt } from '../../../shared/format';
import type { Attach, EnergyProblem, EnergyResult } from '../model/energy';

const r1 = (v: number) => Math.round(v * 10) / 10;
type P2 = [number, number];
const W = 1000,
  H = 480;

interface Place {
  /** Центр. */
  c: P2;
  /** Радиусы на схеме (блок, каток). */
  R: number;
  r: number;
  /** Направление движения при «+» (единичный вектор) — у груза и катка. */
  dir: P2;
  /** Нормаль от плоскости (у тел на наклоне). */
  n: P2;
}

function arrow(a: P2, bb: P2, cls: string) {
  const dx = bb[0] - a[0],
    dy = bb[1] - a[1],
    L = Math.hypot(dx, dy) || 1,
    ux = dx / L,
    uy = dy / L;
  return `<line class="${cls}" x1="${r1(a[0])}" y1="${r1(a[1])}" x2="${r1(bb[0] - ux * 8)}" y2="${r1(bb[1] - uy * 8)}"/><path class="${cls}-f" d="M${r1(bb[0])} ${r1(bb[1])}L${r1(bb[0] - ux * 10 - uy * 4)} ${r1(bb[1] - uy * 10 + ux * 4)}L${r1(bb[0] - ux * 10 + uy * 4)} ${r1(bb[1] - uy * 10 - ux * 4)}Z"/>`;
}

/** Точка касания прямой из P к окружности (C, ρ) — верхняя из двух. */
function tangent(P: P2, C: P2, rho: number): P2 {
  const dx = P[0] - C[0],
    dy = P[1] - C[1],
    d = Math.hypot(dx, dy);
  if (d <= rho + 1e-6) return [C[0], C[1] - rho];
  const base = Math.atan2(dy, dx),
    off = Math.acos(rho / d);
  const t1: P2 = [C[0] + rho * Math.cos(base + off), C[1] + rho * Math.sin(base + off)];
  const t2: P2 = [C[0] + rho * Math.cos(base - off), C[1] + rho * Math.sin(base - off)];
  return t1[1] < t2[1] ? t1 : t2;
}

export function renderEnergy(pr: EnergyProblem, r: EnergyResult): { svg: string; viewBox: string } {
  const n = pr.bodies.length;
  const slot = (i: number) => (n === 1 ? W / 2 : 150 + (i * (W - 300)) / (n - 1));
  const Rmax = Math.max(1e-9, ...pr.bodies.filter((b) => b.kind !== 'translate').map((b) => Math.max(b.R, b.r)));
  const px = (x: number) => 18 + (34 * x) / Rmax;
  const places: Place[] = pr.bodies.map((b, i) => ({ c: [slot(i), 150] as P2, R: b.kind === 'translate' ? 0 : px(b.R || b.r), r: b.kind === 'translate' ? 0 : px(b.r || 0), dir: [0, 1] as P2, n: [0, -1] as P2 }));
  // Блок-сосед для груза или катка: по нити в любую сторону.
  const neighbour = (i: number): number | null => {
    const L = pr.bodies[i].link;
    if (L && pr.bodies[L.from].kind === 'rotate') return L.from;
    const j = pr.bodies.findIndex((b) => b.link?.from === i && b.kind === 'rotate');
    return j >= 0 ? j : null;
  };
  pr.bodies.forEach((b, i) => {
    if (b.kind === 'rotate') return;
    const P = places[i];
    const nb = neighbour(i);
    const vertical = b.kind === 'translate' && Math.abs(b.alpha - 90) < 1e-9;
    if (vertical) {
      const C = nb != null ? places[nb] : null;
      const side = nb != null && slot(i) < slot(nb) ? -1 : 1;
      // Ступень блока, с которой сходит нить к грузу.
      const L = b.link;
      const viaR = nb == null ? true : L && L.from === nb ? L.at !== 'r' : pr.bodies[nb].link?.to !== 'r';
      P.c = C ? [C.c[0] + side * (viaR ? C.R : C.r), 340] : [slot(i), 340];
      P.dir = [0, b.up ? -1 : 1];
      return;
    }
    // Наклонная (или горизонтальная) плоскость поднимается к соседнему блоку.
    const toward = nb != null ? Math.sign(slot(nb) - slot(i)) || 1 : 1;
    const a = (b.alpha * Math.PI) / 180;
    const up: P2 = [toward * Math.cos(a), -Math.sin(a)];
    P.n = [Math.sin(a) * toward, -Math.cos(a)];
    const h = b.kind === 'roll' ? P.r : 14;
    const base: P2 = [slot(i), 360];
    P.c = [base[0] + P.n[0] * h, base[1] + P.n[1] * h];
    P.dir = b.up ? up : [-up[0], -up[1]];
  });
  const out: string[] = [`<rect width="${W}" height="${H}" fill="var(--sheet)"/>`];
  // Плоскости.
  pr.bodies.forEach((b, i) => {
    if (b.kind === 'rotate' || (b.kind === 'translate' && Math.abs(b.alpha - 90) < 1e-9)) return;
    const P = places[i];
    const t: P2 = [-P.n[1], P.n[0]];
    const base: P2 = [slot(i), 360];
    const A: P2 = [base[0] - t[0] * 110, base[1] - t[1] * 110],
      B: P2 = [base[0] + t[0] * 110, base[1] + t[1] * 110];
    out.push(`<line class="en-ground" x1="${r1(A[0])}" y1="${r1(A[1])}" x2="${r1(B[0])}" y2="${r1(B[1])}"/>`);
    for (let k = 0; k <= 10; k++) {
      const q: P2 = [A[0] + ((B[0] - A[0]) * k) / 10, A[1] + ((B[1] - A[1]) * k) / 10];
      out.push(`<line class="en-hatch" x1="${r1(q[0])}" y1="${r1(q[1])}" x2="${r1(q[0] - P.n[0] * 8 - t[0] * 6)}" y2="${r1(q[1] - P.n[1] * 8 - t[1] * 6)}"/>`);
    }
    if (b.alpha > 0.5) out.push(`<text class="t-pt" x="${r1(Math.min(A[0], B[0]) + 30)}" y="${r1(Math.max(A[1], B[1]) - 6)}">${fmt(b.alpha)}°</text>`);
  });
  // Точки нити.
  const point = (i: number, at: Attach, toward: P2): P2 => {
    const b = pr.bodies[i],
      P = places[i];
    if (b.kind === 'rotate') return tangent(toward, P.c, at === 'r' ? P.r : P.R);
    if (b.kind === 'roll') return at === 'top' ? [P.c[0] + P.n[0] * P.R, P.c[1] + P.n[1] * P.R] : at === 'bottom' ? [P.c[0] - P.n[0] * Math.abs(P.r - P.R) * 0.5, P.c[1] - P.n[1] * Math.abs(P.r - P.R) * 0.5] : P.c;
    return P.c;
  };
  pr.bodies.forEach((b, i) => {
    const L = b.link;
    if (!L) return;
    const j = L.from;
    if (b.kind === 'rotate' && pr.bodies[j].kind === 'rotate') {
      // Ремень (или нить между блоками) — по верхним и нижним касательным.
      const A = places[j],
        B = places[i];
      const ra = L.at === 'r' ? A.r : A.R,
        rb = L.to === 'r' ? B.r : B.R;
      out.push(`<path class="en-rope" d="M${r1(A.c[0])} ${r1(A.c[1] - ra)}L${r1(B.c[0])} ${r1(B.c[1] - rb)}M${r1(A.c[0])} ${r1(A.c[1] + ra)}L${r1(B.c[0])} ${r1(B.c[1] + rb)}"/>`);
      return;
    }
    let pi: P2, pj: P2;
    if (b.kind === 'rotate') {
      pj = point(j, L.at, places[i].c);
      pi = tangent(pj, places[i].c, L.to === 'r' ? places[i].r : places[i].R);
    } else if (pr.bodies[j].kind === 'rotate') {
      pi = point(i, L.to, places[j].c);
      pj = tangent(pi, places[j].c, L.at === 'r' ? places[j].r : places[j].R);
    } else {
      pi = point(i, L.to, places[j].c);
      pj = point(j, L.at, pi);
    }
    const pi2 = pi;
    out.push(`<line class="en-rope" x1="${r1(pj[0])}" y1="${r1(pj[1])}" x2="${r1(pi2[0])}" y2="${r1(pi2[1])}"/>`);
  });
  // Тела.
  pr.bodies.forEach((b, i) => {
    const P = places[i],
      k = r.ok ? r.kin[i] : null;
    const V = r.angular ? 'ω' : 'v';
    const coef = (x: number) => (Math.abs(x - 1) < 1e-9 ? V : `${fmt(x, 3)}${V}`);
    if (b.kind === 'rotate') {
      out.push(`<path class="en-sup" d="M${r1(P.c[0])} ${r1(P.c[1])}L${r1(P.c[0] - 12)} ${r1(P.c[1] - P.R - 30)}H${r1(P.c[0] + 12)}Z"/><line class="en-ground" x1="${r1(P.c[0] - 22)}" y1="${r1(P.c[1] - P.R - 30)}" x2="${r1(P.c[0] + 22)}" y2="${r1(P.c[1] - P.R - 30)}"/>`);
      out.push(`<circle class="en-wheel" cx="${r1(P.c[0])}" cy="${r1(P.c[1])}" r="${r1(P.R)}"/>`);
      if (b.r > 0 && Math.abs(b.r - b.R) > 1e-12) out.push(`<circle class="en-wheel2" cx="${r1(P.c[0])}" cy="${r1(P.c[1])}" r="${r1(P.r)}"/>`);
      out.push(`<circle class="hinge" cx="${r1(P.c[0])}" cy="${r1(P.c[1])}" r="4"/>`);
      if (b.M.some((x) => x !== 0)) out.push(`<path class="en-mom" d="M${r1(P.c[0] + P.R + 10)} ${r1(P.c[1])}A${r1(P.R + 10)} ${r1(P.R + 10)} 0 0 0 ${r1(P.c[0])} ${r1(P.c[1] - P.R - 10)}"/><text class="t cv-t t-ld" x="${r1(P.c[0] + P.R + 14)}" y="${r1(P.c[1] - P.R + 4)}">M</text>`);
      if (k) out.push(`<text class="t cv-t en-vt" x="${r1(P.c[0])}" y="${r1(P.c[1] + P.R + 22)}" text-anchor="middle">ω<tspan dy="4" font-size="10">${i + 1}</tspan><tspan dy="-4"> = ${coef(k.q)}</tspan></text>`);
    } else if (b.kind === 'roll') {
      out.push(`<circle class="en-wheel" cx="${r1(P.c[0])}" cy="${r1(P.c[1])}" r="${r1(P.r)}"/>`);
      if (Math.abs(b.R - b.r) > 1e-12 && b.R > 0) out.push(`<circle class="en-wheel2" cx="${r1(P.c[0])}" cy="${r1(P.c[1])}" r="${r1(P.R)}"/>`);
      out.push(`<circle class="hinge" cx="${r1(P.c[0])}" cy="${r1(P.c[1])}" r="3.5"/>`);
    } else {
      const t: P2 = [-P.n[1], P.n[0]];
      const vertical = Math.abs(b.alpha - 90) < 1e-9;
      const hw = 22,
        hh = 14;
      const [ux, uy] = vertical ? [1, 0] : t,
        [nx, ny] = vertical ? [0, -1] : P.n;
      const c = P.c;
      const pts = [
        [c[0] - ux * hw - nx * hh, c[1] - uy * hw - ny * hh],
        [c[0] + ux * hw - nx * hh, c[1] + uy * hw - ny * hh],
        [c[0] + ux * hw + nx * hh, c[1] + uy * hw + ny * hh],
        [c[0] - ux * hw + nx * hh, c[1] - uy * hw + ny * hh],
      ];
      out.push(`<path class="en-load" d="M${pts.map((p) => p.map(r1).join(' ')).join('L')}Z"/>`);
    }
    if (b.kind !== 'rotate') {
      const vertical = b.kind === 'translate' && Math.abs(b.alpha - 90) < 1e-9;
      const off = vertical ? 36 : b.kind === 'roll' ? P.r + 16 : 30;
      const side: P2 = vertical ? [1, 0] : P.n;
      const s: P2 = [P.c[0] + side[0] * off - P.dir[0] * 17, P.c[1] + side[1] * off - P.dir[1] * 17],
        a: P2 = [s[0] + P.dir[0] * 34, s[1] + P.dir[1] * 34];
      out.push(arrow(s, a, 'en-v'));
      if (k) out.push(`<text class="t cv-t en-vt" x="${r1(a[0] + 8)}" y="${r1(a[1] + 4)}">v<tspan dy="4" font-size="10">${b.kind === 'roll' ? 'C' : ''}${i + 1}</tspan><tspan dy="-4"> = ${coef(k.k)}</tspan></text>`);
    }
    out.push(`<text class="t cv-t en-name" x="${r1(P.c[0] - (b.kind === 'rotate' ? P.R + 10 : 30))}" y="${r1(P.c[1] - (b.kind === 'rotate' ? P.R : 18))}" text-anchor="end">${i + 1}</text>`);
  });
  out.push(`<text class="tb-note" x="16" y="${H - 14}">Схема условная. Стрелки — направление движения тел; скорости выражены через скорость ведущего тела 1.</text>`);
  return { svg: out.join(''), viewBox: `0 0 ${W} ${H}` };
}
