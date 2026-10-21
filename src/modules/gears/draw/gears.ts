/** Чертёж: схема передачи (колёса в масштабе, направление вращения, нить, точка с v и a) и график ω_k(t). */
import { fmt } from '../../../shared/format';
import { plot } from '../../rotation/draw/rotation';
import { omegaCurve, type GearProblem, type GearResult } from '../model/gears';

const r1 = (v: number) => Math.round(v * 10) / 10;
const W = 1000,
  H = 480;
type P2 = [number, number];

function arrow(a: P2, bb: P2, cls: string) {
  const dx = bb[0] - a[0],
    dy = bb[1] - a[1],
    L = Math.hypot(dx, dy) || 1,
    ux = dx / L,
    uy = dy / L;
  return `<line class="${cls}" x1="${r1(a[0])}" y1="${r1(a[1])}" x2="${r1(bb[0] - ux * 8)}" y2="${r1(bb[1] - uy * 8)}"/><path class="${cls}-f" d="M${r1(bb[0])} ${r1(bb[1])}L${r1(bb[0] - ux * 11 - uy * 4.5)} ${r1(bb[1] - uy * 11 + ux * 4.5)}L${r1(bb[0] - ux * 11 + uy * 4.5)} ${r1(bb[1] - uy * 11 - ux * 4.5)}Z"/>`;
}

/** Дуговая стрелка направления вращения (против часовой — ω > 0). */
function spin(c: P2, R: number, ccw: boolean) {
  const a0 = (-150 * Math.PI) / 180,
    a1 = (-30 * Math.PI) / 180;
  const [s, e] = ccw ? [a1, a0] : [a0, a1];
  const P = (a: number): P2 => [c[0] + R * Math.cos(a), c[1] + R * Math.sin(a)];
  const S = P(s),
    E = P(e);
  const tx = ccw ? Math.sin(e) : -Math.sin(e),
    ty = ccw ? -Math.cos(e) : Math.cos(e);
  return `<path class="gr-spin" d="M${r1(S[0])} ${r1(S[1])}A${r1(R)} ${r1(R)} 0 0 ${ccw ? 0 : 1} ${r1(E[0])} ${r1(E[1])}"/><path class="gr-spin-f" d="M${r1(E[0] + tx * 9)} ${r1(E[1] + ty * 9)}L${r1(E[0] - ty * 5)} ${r1(E[1] + tx * 5)}L${r1(E[0] + ty * 5)} ${r1(E[1] - tx * 5)}Z"/>`;
}

/** Размер колеса на чертеже: то, чем считали отношение со соседом (радиус или зубья), иначе радиус. */
function sizes(pr: GearProblem, r: GearResult): number[] {
  const ws = pr.wheels;
  return ws.map((w, j) => {
    const by = r.by[j] ?? r.by[j + 1] ?? null;
    const s = by === 'z' ? w.z : by === 'r' ? w.r : w.r || w.z;
    return s > 0 ? s : 1;
  });
}

export function renderGears(pr: GearProblem, r: GearResult): { svg: string; viewBox: string } {
  const out: string[] = [`<rect width="${W}" height="${H}" fill="var(--sheet)"/>`];
  if (!r.ok) {
    out.push(`<text class="tb-note" x="16" y="${H / 2}">Проверьте данные передачи.</text>`);
    return { svg: out.join(''), viewBox: `0 0 ${W} ${H}` };
  }
  if (r.size) {
    const sz = r.size;
    pr = { ...pr, wheels: pr.wheels.map((w, j) => (j === sz.u ? { ...w, [sz.key]: sz.value } : w)) };
  }
  const ws = pr.wheels,
    s = sizes(pr, r);
  const big = Math.max(...s);
  // Центры колёс в единицах размера.
  const cx: number[] = [0];
  for (let j = 1; j < ws.length; j++) {
    const L = ws[j].link,
      p = cx[j - 1];
    if (L === 'shaft') cx.push(p);
    else if (L === 'int') cx.push(s[j] < s[j - 1] ? p + s[j - 1] - s[j] : p + s[j] - s[j - 1]);
    else if (L === 'belt' || L === 'cross') cx.push(p + s[j - 1] + s[j] + big * 0.8);
    else cx.push(p + s[j - 1] + s[j]);
  }
  const lo = Math.min(...cx.map((c, j) => c - s[j])),
    hi = Math.max(...cx.map((c, j) => c + s[j]));
  const box = 560,
    k = Math.min(box / (hi - lo), 150 / big);
  const ox = 40 + (box - (hi - lo) * k) / 2 - lo * k,
    oy = 220;
  const X = (u: number) => ox + u * k;
  const K = Math.min(Math.max(0, Math.round(pr.k)), ws.length - 1);
  // Ремни — под колёсами.
  for (let j = 1; j < ws.length; j++) {
    const L = ws[j].link;
    if (L !== 'belt' && L !== 'cross') continue;
    const a: P2 = [X(cx[j - 1]), oy],
      bb: P2 = [X(cx[j]), oy],
      ra = Math.max(s[j - 1] * k, 8),
      rb = Math.max(s[j] * k, 8);
    // Касательные: нормаль к ветви n = (c, ±√(1 − c²)), c = (ra ∓ rb)/d; точки касания a + ra·n и b ± rb·n.
    const d = bb[0] - a[0],
      c = Math.max(-1, Math.min(1, (L === 'belt' ? ra - rb : ra + rb) / d)),
      q = Math.sqrt(1 - c * c),
      sb = L === 'belt' ? 1 : -1;
    const seg = (sy: number) => `M${r1(a[0] + ra * c)} ${r1(oy + sy * ra * q)}L${r1(bb[0] + sb * rb * c)} ${r1(oy + sb * sy * rb * q)}`;
    out.push(`<path class="gr-belt" d="${seg(1)}${seg(-1)}"/>`);
  }
  // Колёса: сначала большие, чтобы меньшие на том же валу были видны.
  const order = ws.map((_, j) => j).sort((a, b) => s[b] - s[a]);
  for (const j of order) {
    const R = Math.max(s[j] * k, 8);
    out.push(`<circle class="gr-wheel${j === K ? ' gr-sel' : ''}" cx="${r1(X(cx[j]))}" cy="${oy}" r="${r1(R)}"/>`);
  }
  // Подписи и направления вращения; колёса на одном валу подписываем столбиком.
  const shaftRow = new Map<number, number>();
  for (let j = 0; j < ws.length; j++) {
    const c: P2 = [X(cx[j]), oy],
      R = Math.max(s[j] * k, 8);
    const row = shaftRow.get(cx[j]) ?? 0;
    shaftRow.set(cx[j], row + 1);
    const w = r.wheels[j].omega;
    if (Math.abs(w) > 1e-12 && R >= 14) out.push(spin(c, R * 0.62, w > 0));
    const lab = ws[j].z > 0 && r.by[j] !== 'r' && r.by[j + 1] !== 'r' ? `z=${fmt(ws[j].z, 3)}` : ws[j].r > 0 ? `r=${fmt(ws[j].r, 3)}` : 'тело';
    out.push(`<text class="t gr-t${j === K ? ' gr-tsel' : ''}" x="${r1(c[0])}" y="${r1(oy + Math.max(...s.map((q, i) => (cx[i] === cx[j] ? Math.max(q * k, 8) : 0))) + 22 + row * 18)}" text-anchor="middle">${j + 1}: ${lab}, ω=${fmt(w, 4)}</text>`);
  }
  out.push(`<circle class="gr-axle" cx="${r1(X(cx[0]))}" cy="${oy}" r="3"/>`);
  for (let j = 1; j < ws.length; j++) if (cx[j] !== cx[j - 1]) out.push(`<circle class="gr-axle" cx="${r1(X(cx[j]))}" cy="${oy}" r="3"/>`);
  // Нить на колесе 1.
  if (pr.drive === 'x') {
    const R = Math.max(s[0] * k, 8),
      x = X(cx[0]) - R,
      y = oy + R + Math.max(24, Math.min(70, H - 64 - (oy + R)));
    out.push(`<line class="cv-rope" x1="${r1(x)}" y1="${oy}" x2="${r1(x)}" y2="${r1(y)}"/><rect class="gr-load" x="${r1(x - 13)}" y="${r1(y)}" width="26" height="22"/><text class="t gr-t" x="${r1(x - 18)}" y="${r1(y + 16)}" text-anchor="end">x(t)</text>`);
  }
  // Точка колеса K с векторами v и a.
  if (r.point) {
    const c: P2 = [X(cx[K]), oy],
      Rw = Math.max(s[K] * k, 8),
      usesR = ws[K].r > 0 && s[K] === ws[K].r,
      R = usesR ? Math.min(Math.max(r.point.rho * k, 8), Rw * 1.3) : Rw;
    const M: P2 = [c[0], c[1] - R];
    const w = r.wheels[K].omega,
      ep = r.wheels[K].eps,
      p = r.point;
    if (p.v > 1e-12) out.push(arrow(M, [M[0] + (w > 0 ? -1 : 1) * 70, M[1]], 'en-v'), `<text class="t cv-t en-vt" x="${r1(M[0] + (w > 0 ? -1 : 1) * 78)}" y="${r1(M[1] - 8)}" text-anchor="${w > 0 ? 'end' : 'start'}">v = ${fmt(p.v, 4)}</text>`);
    if (p.a > 1e-12) {
      // a = a_n (к центру, вниз) + a_τ (вдоль касательной: положительное ε — против часовой, т. е. влево).
      const ax = -ep * p.rho,
        ay = p.an;
      const L = Math.hypot(ax, ay);
      out.push(arrow(M, [M[0] + (ax / L) * 60, M[1] + (ay / L) * 60], 'cv-r'), `<text class="t cv-t t-cvr" x="${r1(M[0] + (ax / L) * 60 + 8)}" y="${r1(M[1] + (ay / L) * 60 + 16)}">a = ${fmt(p.a, 4)}</text>`);
    }
    out.push(`<circle class="cg-c" cx="${r1(M[0])}" cy="${r1(M[1])}" r="5"/>`);
  }
  // График ω_k(t).
  const T = pr.tMax > 0 ? pr.tMax : Math.max(r.t, 1);
  const pts = omegaCurve(pr, r, T);
  if (pts.length > 1) out.push(plot(700, 70, 260, 320, pts, `ω${ws.length > 1 ? String(K + 1).replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[+d]) : ''}`, 'рад/с', 'с'));
  out.push(`<text class="tb-note" x="16" y="${H - 14}">Схема в масштабе (зубчатые колёса — по числу зубьев); стрелки — направление вращения, против часовой стрелки ω > 0. Справа — ω(t) на [0; ${fmt(T, 4)}].</text>`);
  return { svg: out.join(''), viewBox: `0 0 ${W} ${H}` };
}
