/** Чертёж: тело (ось вращения), относительная траектория, точка M и векторы скоростей или ускорений в плоскости чертежа. */
import { evalExpr } from '../../../shared/expr';
import { fmt } from '../../../shared/format';
import { norm, num0, PLANE_AXES, type Plane, type RelProblem, type RelResult } from '../model/rel';

const r1 = (v: number) => Math.round(v * 10) / 10;
const W = 1000,
  H = 520;
type P2 = [number, number];
type V3 = [number, number, number];
const AX = ['ξ', 'η', 'ζ'];

function arrow(a: P2, bb: P2, cls: string) {
  const dx = bb[0] - a[0],
    dy = bb[1] - a[1],
    L = Math.hypot(dx, dy) || 1,
    ux = dx / L,
    uy = dy / L;
  return `<line class="${cls}" x1="${r1(a[0])}" y1="${r1(a[1])}" x2="${r1(bb[0] - ux * 8)}" y2="${r1(bb[1] - uy * 8)}"/><path class="${cls}-f" d="M${r1(bb[0])} ${r1(bb[1])}L${r1(bb[0] - ux * 11 - uy * 4.5)} ${r1(bb[1] - uy * 11 + ux * 4.5)}L${r1(bb[0] - ux * 11 + uy * 4.5)} ${r1(bb[1] - uy * 11 - ux * 4.5)}Z"/>`;
}

/** Плоскость чертежа: плоская задача — ξη; иначе плоскость прямой или окружности (для формул — по движению). */
export function viewPlane(pr: RelProblem, r: RelResult): Plane {
  if (pr.path !== 'xyz') return pr.plane;
  const zUsed = r.rho[2].k !== 'num' || Math.abs(r.pos[2]) > 1e-12;
  if (!zUsed) return 'xy';
  const yUsed = r.rho[1].k !== 'num' || Math.abs(r.pos[1]) > 1e-12;
  return yUsed ? 'yz' : 'xz';
}

export function renderRel(pr: RelProblem, r: RelResult, show: 'v' | 'a'): { svg: string; viewBox: string } {
  const out: string[] = [`<rect width="${W}" height="${H}" fill="var(--sheet)"/>`];
  if (!r.ok) {
    out.push(`<text class="tb-note" x="16" y="${H / 2}">Проверьте законы движения.</text>`);
    return { svg: out.join(''), viewBox: `0 0 ${W} ${H}` };
  }
  const pl = viewPlane(pr, r);
  const [i1, i2] = PLANE_AXES[pl];
  const iN = 3 - i1 - i2;
  // По окружности — вся окружность, иначе — участок пути около момента t.
  const path: P2[] = [];
  if (pr.path === 'circle') {
    const c = pr.p0.map(num0);
    const R = Math.hypot(r.pos[i1] - c[i1], r.pos[i2] - c[i2]);
    for (let j = 0; j <= 360; j++) path.push([c[i1] + R * Math.cos((j * Math.PI) / 180), c[i2] + R * Math.sin((j * Math.PI) / 180)]);
  } else {
    const D = Math.max(Math.abs(pr.t) * 0.5, 0.5);
    for (let j = 0; j <= 400; j++) {
      const t = pr.t - D + (2 * D * j) / 400;
      const q = r.rho.map((e) => evalExpr(e, t));
      if (q.every(Number.isFinite)) path.push([q[i1], q[i2]]);
    }
  }
  const M: P2 = [r.pos[i1], r.pos[i2]];
  const pts = [...path, M, [0, 0] as P2];
  const xs = pts.map((p) => p[0]),
    ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs),
    x1 = Math.max(...xs),
    y0 = Math.min(...ys),
    y1 = Math.max(...ys);
  const k = Math.min(560 / Math.max(x1 - x0, 1e-9), 300 / Math.max(y1 - y0, 1e-9));
  const ox = 220 + (560 - (x1 - x0) * k) / 2,
    oy = H - 120 - (300 - (y1 - y0) * k) / 2;
  const S = (p: P2): P2 => [ox + (p[0] - x0) * k, oy - (p[1] - y0) * k];
  const O = S([0, 0]);
  // Оси тела и ось вращения.
  out.push(`<line class="sb-axis" x1="60" y1="${r1(O[1])}" x2="${W - 60}" y2="${r1(O[1])}"/><text class="sb-axt" x="${W - 52}" y="${r1(O[1] + 5)}">${AX[i1]}</text><line class="sb-axis" x1="${r1(O[0])}" y1="${H - 70}" x2="${r1(O[0])}" y2="34"/><text class="sb-axt" x="${r1(O[0] + 6)}" y="30">${AX[i2]}</text>`);
  if (pr.carrier === 'rot') {
    if (iN === 2) {
      // Ось ζ перпендикулярна чертежу: дуга со стрелкой — направление ω.
      const w = r.omega,
        R = 26;
      if (Math.abs(w) > 1e-12) {
        const a0 = w > 0 ? -0.2 : 3.3,
          a1 = w > 0 ? 3.3 : -0.2;
        const P = (a: number): P2 => [O[0] + R * Math.cos(a), O[1] - R * Math.sin(a)];
        const s = P(a0),
          e = P(a1);
        out.push(`<path class="gr-spin" d="M${r1(s[0])} ${r1(s[1])}A${R} ${R} 0 0 ${w > 0 ? 0 : 1} ${r1(e[0])} ${r1(e[1])}"/><text class="t gr-t" x="${r1(O[0] - 40)}" y="${r1(O[1] - 32)}">ω = ${fmt(w, 4)}</text>`);
      }
      out.push(`<circle class="gr-axle" cx="${r1(O[0])}" cy="${r1(O[1])}" r="4"/>`);
    } else {
      out.push(`<line class="rl-axis" x1="${r1(O[0])}" y1="${H - 70}" x2="${r1(O[0])}" y2="34"/><text class="t gr-t" x="${r1(O[0] + 10)}" y="56">ось вращения, ω = ${fmt(r.omega, 4)}</text>`);
    }
  }
  out.push(`<path class="rl-path" d="M${path.map((p) => S(p).map(r1).join(' ')).join('L')}"/>`);
  const Ms = S(M);
  // Векторы: проекции на плоскость чертежа; наибольший — 110 px.
  const list: { w: V3; cls: string; name: string }[] =
    show === 'v'
      ? [
          { w: r.ve, cls: 'rl-e', name: 'vₑ' },
          { w: r.vr, cls: 'rl-r', name: 'vᵣ' },
          { w: r.v, cls: 'en-v', name: 'v' },
        ]
      : [
          { w: r.aet, cls: 'rl-e', name: pr.carrier === 'rot' ? 'aₑτ' : 'aₑ' },
          { w: r.aen, cls: 'rl-e', name: 'aₑⁿ' },
          { w: r.ar, cls: 'rl-r', name: 'aᵣ' },
          { w: r.ac, cls: 'rl-c', name: 'a_c' },
          { w: r.a, cls: 'cv-r', name: 'a' },
        ];
  const mx = Math.max(...list.map((q) => norm(q.w)), 1e-300);
  const offs: string[] = [];
  const placed: [number, number, number][] = [[Ms[0] + 6, Ms[1] + 20, 16]];
  for (const q of list) {
    const m = norm(q.w);
    if (m < 1e-9 * mx) continue;
    const p: P2 = [q.w[i1], q.w[i2]],
      pm = Math.hypot(...p);
    if (pm > 1e-6 * m) {
      const L = Math.max(34, (110 * pm) / mx);
      const B: P2 = [Ms[0] + (p[0] / pm) * L, Ms[1] - (p[1] / pm) * L];
      const text = `${q.name} = ${fmt(m, 4)}`;
      const w = text.length * 7.2;
      let lx = B[0] + (p[0] / pm) * 8,
        ly = B[1] - (p[1] / pm) * 8 + 4;
      if (p[0] / pm < -0.3) lx -= w;
      // Раздвигаем подписи, чтобы не налезали друг на друга.
      for (let g = 0; g < 12 && placed.some((b) => lx < b[0] + b[2] && lx + w > b[0] && Math.abs(ly - b[1]) < 15); g++) ly += 16;
      placed.push([lx, ly, w]);
      out.push(arrow(Ms, B, q.cls), `<text class="t cv-t rl-t ${q.cls}-t" x="${r1(lx)}" y="${r1(ly)}">${text}</text>`);
    }
    if (Math.abs(q.w[iN]) > 1e-6 * m) offs.push(`${q.name}: ${q.w[iN] > 0 ? '⊙ к нам' : '⊗ от нас'} ${fmt(Math.abs(q.w[iN]), 4)}`);
  }
  out.push(`<circle class="cg-c" cx="${r1(Ms[0])}" cy="${r1(Ms[1])}" r="5"/><text class="t mc-t" x="${r1(Ms[0] + 10)}" y="${r1(Ms[1] + 20)}">M</text>`);
  if (offs.length) out.push(`<text class="t rl-t" x="16" y="${H - 52}">Перпендикулярно чертежу (ось ${AX[iN]}): ${offs.join('; ')}</text>`);
  out.push(`<text class="tb-note" x="16" y="${H - 30}">Плоскость ${AX[i1]}${AX[i2]}, t = ${fmt(pr.t, 4)}; пунктир — относительная траектория.</text>`);
  out.push(`<text class="tb-note" x="16" y="${H - 12}">${show === 'v' ? 'Серая — переносная, зелёная — относительная, синяя — абсолютная скорость.' : 'Серые — переносные, зелёное — относительное, коричневое — кориолисово, красное — абсолютное ускорение.'}</text>`);
  return { svg: out.join(''), viewBox: `0 0 ${W} ${H}` };
}
