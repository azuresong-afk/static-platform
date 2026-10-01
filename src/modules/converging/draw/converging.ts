/**
 * Чертёж: узел со сходящимися силами и система сил с главным вектором.
 * Плоская задача — в осях x, y; пространственная — в аксонометрии (x — к наблюдателю, y — вправо, z — вверх).
 */
import { fmt } from '../../../shared/format';
import { norm, type NodeProblem, type NodeResult, type ReduceProblem, type ReduceResult, type V3 } from '../model/forces';

const r1 = (v: number) => Math.round(v * 10) / 10;
const W = 1000,
  H = 480;
type P2 = [number, number];

const projector = (plane: boolean) => (p: V3): P2 => (plane ? [p[0], -p[1]] : [p[1] - 0.5 * Math.SQRT1_2 * p[0], -(p[2] - 0.5 * Math.SQRT1_2 * p[0])]);

function arrow(a: P2, bb: P2, cls: string, dash = false) {
  const dx = bb[0] - a[0],
    dy = bb[1] - a[1],
    L = Math.hypot(dx, dy) || 1,
    ux = dx / L,
    uy = dy / L;
  return (
    `<line class="${cls}" x1="${r1(a[0])}" y1="${r1(a[1])}" x2="${r1(bb[0] - ux * 9)}" y2="${r1(bb[1] - uy * 9)}"${dash ? ' stroke-dasharray="6 4"' : ''}/>` +
    `<path class="${cls}-f" d="M${r1(bb[0])} ${r1(bb[1])}L${r1(bb[0] - ux * 11 - uy * 4.5)} ${r1(bb[1] - uy * 11 + ux * 4.5)}L${r1(bb[0] - ux * 11 + uy * 4.5)} ${r1(bb[1] - uy * 11 - ux * 4.5)}Z"/>`
  );
}
const label = (name: string, rest: string) => {
  const [L, S] = name.split('_');
  return `${L}${S ? `<tspan dy="5" font-size="12">${S}</tspan><tspan dy="-5">` : '<tspan>'}${rest}</tspan>`;
};
function axes(O: P2, proj: (p: V3) => P2, plane: boolean) {
  return (plane ? ['x', 'y'] : ['x', 'y', 'z'])
    .map((a, i) => {
      const u: V3 = [0, 0, 0];
      u[i] = 1;
      const q = proj(u),
        L0 = Math.hypot(q[0], q[1]),
        d = [q[0] / L0, q[1] / L0],
        L = !plane && i === 0 ? 90 : 130;
      return `<line class="sb-axis" x1="${r1(O[0])}" y1="${r1(O[1])}" x2="${r1(O[0] + d[0] * L)}" y2="${r1(O[1] + d[1] * L)}"/><text class="sb-axt" x="${r1(O[0] + d[0] * (L + 14))}" y="${r1(O[1] + d[1] * (L + 14) + 5)}">${a}</text>`;
    })
    .join('');
}

/** Узел: нити и стержни — линиями к точкам крепления, силы — стрелками из узла (реакции — в действительном направлении). */
export function renderNode(pr: NodeProblem, r: NodeResult): { svg: string; viewBox: string } {
  const proj = projector(r.plane);
  const C: P2 = [W / 2, H / 2 + 10];
  const dir2 = (u: V3): P2 => {
    const q = proj(u),
      L = Math.hypot(q[0], q[1]);
    return L < 1e-9 ? [0, -1] : [q[0] / L, q[1] / L];
  };
  const out: string[] = [`<rect width="${W}" height="${H}" fill="var(--sheet)"/>`, axes([90, H - (r.plane ? 80 : 120)], proj, r.plane)];
  const solved = r.status === 'ok';
  const placed: P2[] = [];
  pr.forces.forEach((F, i) => {
    if (F.kind === 'known') return;
    const d = dir2(r.dirs[i]);
    const E: P2 = [C[0] + d[0] * 170, C[1] + d[1] * 170];
    if (F.kind === 'normal') {
      // Гладкая поверхность — отрезок, перпендикулярный нормали, позади узла.
      const B: P2 = [C[0] - d[0] * 14, C[1] - d[1] * 14];
      out.push(`<line class="sb-edge" x1="${r1(B[0] - d[1] * 60)}" y1="${r1(B[1] + d[0] * 60)}" x2="${r1(B[0] + d[1] * 60)}" y2="${r1(B[1] - d[0] * 60)}"/>`);
    } else out.push(`<line class="${F.kind === 'rope' ? 'cv-rope' : 'sb-rod'}" x1="${r1(C[0])}" y1="${r1(C[1])}" x2="${r1(E[0])}" y2="${r1(E[1])}"/><circle class="hinge" cx="${r1(E[0])}" cy="${r1(E[1])}" r="4.5"/>`);
  });
  pr.forces.forEach((F, i) => {
    const known = F.kind === 'known';
    const val = known ? F.F : solved ? r.vals[i] : null;
    const s = val != null && val < 0 ? -1 : 1;
    const d = dir2(r.dirs[i].map((x) => x * s) as V3);
    const cls = known ? 'ld' : 'rc';
    // Нормальная реакция — к узлу от поверхности; остальные — от узла.
    const [a, bb]: [P2, P2] = !known && F.kind === 'normal' && s > 0 ? [[C[0] - d[0] * 100, C[1] - d[1] * 100], [C[0] - d[0] * 16, C[1] - d[1] * 16]] : [[C[0] + d[0] * 8, C[1] + d[1] * 8], [C[0] + d[0] * 100, C[1] + d[1] * 100]];
    out.push(arrow(a, bb, cls, !known && !solved));
    const tip = !known && F.kind === 'normal' && s > 0 ? a : bb;
    const lab = val != null ? ` = ${fmt(Math.abs(val))}` : ' = ?';
    const sg = tip === a ? -1 : 1;
    let lx = tip[0] + d[0] * 18 * sg,
      ly = tip[1] + d[1] * 18 * sg;
    // Подписи близких стрелок раздвигаем вдоль стрелки.
    for (let n = 0; n < 6 && placed.some(([x, y]) => Math.abs(x - lx) < 95 && Math.abs(y - ly) < 20); n++) {
      lx += d[0] * 22 * sg;
      ly += d[1] * 22 * sg + (Math.abs(d[1]) < 0.3 ? 20 : 0);
    }
    placed.push([lx, ly]);
    out.push(`<text class="t cv-t t-${cls}" x="${r1(lx)}" y="${r1(ly + 5)}" text-anchor="middle">${label(F.name, lab)}</text>`);
  });
  out.push(`<circle class="hinge" cx="${C[0]}" cy="${C[1]}" r="5.5"/>`);
  out.push(`<text class="tb-note" x="16" y="${H - 14}">Длины на чертеже условны. Найденные усилия показаны в действительном направлении.</text>`);
  return { svg: out.join(''), viewBox: `0 0 ${W} ${H}` };
}

/** Система сил: силы в точках, пары, центр O; главный вектор на линии действия (центральной оси). */
export function renderReduce(pr: ReduceProblem, r: ReduceResult): { svg: string; viewBox: string } {
  const proj = projector(r.plane);
  const dir2 = (u: V3): P2 => {
    const q = proj(u),
      L = Math.hypot(q[0], q[1]);
    return L < 1e-9 ? [0, -1] : [q[0] / L, q[1] / L];
  };
  const Fmax = Math.max(1e-9, norm(r.R), ...pr.forces.map((f) => norm(f.F)));
  const len = (F: number) => 40 + 70 * (F / Fmax);
  // Точки и концы стрелок (с подписями): масштаб подбираем так, чтобы всё поместилось в поле.
  const items: { q: P2; o: P2 }[] = [pr.O, [0, 0, 0] as V3].map((p) => ({ q: proj(p), o: [0, 0] as P2 }));
  for (const f of pr.forces) {
    const d = dir2(f.F),
      L = norm(f.F) > 1e-12 ? len(norm(f.F)) + 30 : 0;
    items.push({ q: proj(f.r), o: [0, 0] }, { q: proj(f.r), o: [d[0] * L, d[1] * L] });
  }
  if (r.axisPoint) {
    const d = dir2(r.R),
      L = len(norm(r.R)) + 30;
    items.push({ q: proj(r.axisPoint), o: [0, 0] }, { q: proj(r.axisPoint), o: [d[0] * L, d[1] * L] });
  }
  const span = (k: number, a: 0 | 1) => {
    const v = items.map((it) => it.q[a] * k + it.o[a]);
    return [Math.min(...v), Math.max(...v)];
  };
  const fits = (k: number) => {
    const [x0, x1] = span(k, 0),
      [y0, y1] = span(k, 1);
    return x1 - x0 <= W - 220 && y1 - y0 <= H - 120;
  };
  let lo = 1e-6,
    hi = 1e6;
  for (let n = 0; n < 80; n++) {
    const mid = Math.sqrt(lo * hi);
    if (fits(mid)) lo = mid;
    else hi = mid;
  }
  const k = Math.min(lo, 400);
  const [x0, x1] = span(k, 0),
    [y0, y1] = span(k, 1);
  const S = (p: V3): P2 => {
    const q = proj(p);
    return [W / 2 + q[0] * k - (x0 + x1) / 2, (H - 30) / 2 + q[1] * k - (y0 + y1) / 2];
  };
  const out: string[] = [`<rect width="${W}" height="${H}" fill="var(--sheet)"/>`, axes(S([0, 0, 0]), proj, r.plane)];
  // Центральная ось (линия действия равнодействующей).
  if (r.axisPoint && (r.kind === 'resultant' || r.kind === 'dynamo')) {
    const d = dir2(r.R),
      A = S(r.axisPoint);
    out.push(`<line class="cv-axis" x1="${r1(A[0] - d[0] * 1200)}" y1="${r1(A[1] - d[1] * 1200)}" x2="${r1(A[0] + d[0] * 1200)}" y2="${r1(A[1] + d[1] * 1200)}"/>`);
    out.push(arrow(A, [A[0] + d[0] * len(norm(r.R)), A[1] + d[1] * len(norm(r.R))], 'cv-r'));
    // Подпись R — сбоку от конца стрелки, M* — с другой стороны оси.
    const side: P2 = d[1] > 0 ? [d[1], -d[0]] : [-d[1], d[0]];
    const sideS = side[0] >= 0 ? side : ([-side[0], -side[1]] as P2);
    const Lr = len(norm(r.R));
    out.push(`<text class="t cv-t t-cvr" x="${r1(A[0] + d[0] * Lr * 0.8 + sideS[0] * 14)}" y="${r1(A[1] + d[1] * Lr * 0.8 + sideS[1] * 14 + 5)}" text-anchor="start">R = ${fmt(norm(r.R))}</text>`);
    if (r.kind === 'dynamo') {
      // Пара динамы — дугой вокруг оси посередине стрелки R.
      const n: P2 = [-sideS[0], -sideS[1]],
        m = Lr * 0.45,
        Cm: P2 = [A[0] + d[0] * m, A[1] + d[1] * m];
      out.push(`<path class="cv-pair" d="M${r1(Cm[0] + n[0] * 22)} ${r1(Cm[1] + n[1] * 22)}A22 22 0 1 ${r.Mstar > 0 ? 1 : 0} ${r1(Cm[0] - n[0] * 22)} ${r1(Cm[1] - n[1] * 22)}"/><text class="t cv-t t-cvr" x="${r1(Cm[0] + n[0] * 34)}" y="${r1(Cm[1] + n[1] * 34 + 5)}" text-anchor="${n[0] < -0.3 ? 'end' : n[0] > 0.3 ? 'start' : 'middle'}">M* = ${fmt(Math.abs(r.Mstar))}</text>`);
    }
  }
  pr.forces.forEach((f) => {
    const Fn = norm(f.F);
    if (Fn < 1e-12) return;
    const P = S(f.r),
      d = dir2(f.F),
      L = len(Fn);
    out.push(arrow(P, [P[0] + d[0] * L, P[1] + d[1] * L], 'ld'));
    out.push(`<circle class="sb-pt" cx="${r1(P[0])}" cy="${r1(P[1])}" r="3"/><text class="t cv-t t-ld" x="${r1(P[0] + d[0] * (L + 18))}" y="${r1(P[1] + d[1] * (L + 18) + 5)}" text-anchor="middle">${label(f.name, ` = ${fmt(Fn)}`)}</text>`);
  });
  // Пары — дуговой стрелкой у центра O (на плоскости знак — против часовой стрелки «+»).
  const Os = S(pr.O);
  pr.pairs.forEach((p, i) => {
    const Mn = norm(p.M);
    if (Mn < 1e-12) return;
    const R0 = 30 + 12 * i,
      ccw = r.plane ? p.M[2] > 0 : true;
    const a0 = -0.6,
      a1 = a0 + 4.2;
    const A: P2 = [Os[0] + R0 * Math.cos(a0), Os[1] - R0 * Math.sin(a0)],
      B: P2 = [Os[0] + R0 * Math.cos(a1), Os[1] - R0 * Math.sin(a1)];
    const [from, to] = ccw ? [A, B] : [B, A];
    out.push(`<path class="cv-pairl" d="M${r1(from[0])} ${r1(from[1])}A${R0} ${R0} 0 1 ${ccw ? 0 : 1} ${r1(to[0])} ${r1(to[1])}"/><circle class="ld-f" cx="${r1(to[0])}" cy="${r1(to[1])}" r="4"/>`);
    out.push(`<text class="t cv-t t-ld" x="${r1(Os[0] - R0 - 14)}" y="${r1(Os[1] - R0 + 4)}" text-anchor="end">${label(p.name, ` = ${fmt(r.plane ? p.M[2] : Mn)}`)}</text>`);
  });
  out.push(`<circle class="hinge" cx="${r1(Os[0])}" cy="${r1(Os[1])}" r="4.5"/><text class="t-pt" x="${r1(Os[0] + 9)}" y="${r1(Os[1] + 18)}">O</text>`);
  const tail = r.kind === 'pair' ? 'R = 0 — система приводится к паре.' : r.kind === 'equilibrium' ? 'Система уравновешена.' : r.kind === 'dynamo' ? 'R — на центральной оси, M* — момент динамы.' : 'R — на линии действия равнодействующей.';
  out.push(`<text class="tb-note" x="16" y="${H - 14}">Длины стрелок — в масштабе сил. ${tail}</text>`);
  return { svg: out.join(''), viewBox: `0 0 ${W} ${H}` };
}
