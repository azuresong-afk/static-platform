/**
 * Аксонометрия пространственного бруса: схема с нагрузками и эпюры Q, M_изг, M_к (ординаты откладываются
 * в пространстве по осям и проецируются). Ось x — вправо, y — вглубь (вверх-вправо), z — вверх.
 */
import { fmt } from '../../../shared/format';
import { polyDeriv, polyEval, rootsInside, type Poly } from '../../../shared/poly';
import { AX, cross, type Axis, type Frame3, type Solution3, type V3 } from '../model/frame3d';

const W = 620;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const r1 = (v: number) => Math.round(v * 10) / 10;
export const ptName = (i: number) => String.fromCharCode(65 + i);

/** Проекция (без масштаба): x → вправо, y → вверх-вправо под 30°, сокращение 0,6; z → вверх. */
const proj = (p: V3): [number, number] => [p[0] + 0.6 * Math.cos(Math.PI / 6) * p[1], -(p[2] + 0.6 * Math.sin(Math.PI / 6) * p[1])];

interface View {
  toS: (p: V3) => [number, number];
  /** Мировая длина, соответствующая 1 px. */
  unit: number;
  H: number;
}

function fit(pts: V3[], pad: number, H: number, extra = 0): View {
  const pr = pts.map(proj);
  const xs = pr.map((p) => p[0]),
    ys = pr.map((p) => p[1]);
  const w = Math.max(1e-6, Math.max(...xs) - Math.min(...xs)),
    h = Math.max(1e-6, Math.max(...ys) - Math.min(...ys));
  const k = Math.min((W - 2 * pad - 2 * extra) / w, (H - 2 * pad - 2 * extra) / h, 220);
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2,
    cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  return { toS: (p) => { const q = proj(p); return [r1(W / 2 + (q[0] - cx) * k), r1(H / 2 + (q[1] - cy) * k)]; }, unit: 1 / k, H };
}

const line = (a: [number, number], b: [number, number], cls: string) => `<line class="${cls}" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/>`;

/** Стрелка силы или вектора момента (двойной наконечник) из точки a в b (экранные координаты). */
function arrow(a: [number, number], b: [number, number], cls: string, dbl = false) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    L = Math.hypot(dx, dy) || 1;
  const ux = dx / L,
    uy = dy / L;
  const head = (tip: [number, number]) => `<path class="${cls}-h" d="M${r1(tip[0])} ${r1(tip[1])}L${r1(tip[0] - ux * 11 - uy * 5)} ${r1(tip[1] - uy * 11 + ux * 5)}L${r1(tip[0] - ux * 11 + uy * 5)} ${r1(tip[1] - uy * 11 - ux * 5)}Z"/>`;
  const second: [number, number] = [b[0] - ux * 9, b[1] - uy * 9];
  return line(a, [r1(b[0] - ux * 8), r1(b[1] - uy * 8)], cls) + head(b) + (dbl ? head(second) : '');
}

const signed = (axis: Axis, v: number) => AX[axis].map((x) => x * Math.sign(v)) as V3;

export function renderScheme(f: Frame3, sol: Solution3): { svg: string; viewBox: string } {
  const H = 400;
  const v = fit(sol.pts, 70, H);
  const out: string[] = [];
  const S = (p: V3) => v.toS(p);
  const len = 60 * v.unit; // длина стрелки в мировых единицах
  // Заделка — параллелограмм, перпендикулярный первому участку.
  const [u1, u2] = (['x', 'y', 'z'] as Axis[]).filter((a) => a !== f.segs[0].axis).map((a) => AX[a]);
  const wsz = 26 * v.unit;
  const corner = (a: number, b: number): V3 => [0, 1, 2].map((k) => a * wsz * u1[k] + b * wsz * u2[k]) as V3;
  const wall = [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)].map(S);
  out.push(`<path class="sp-wall" d="M${wall.map((p) => p.join(' ')).join('L')}Z"/>`);
  // Стержень.
  for (let i = 0; i + 1 < sol.pts.length; i++) out.push(line(S(sol.pts[i]), S(sol.pts[i + 1]), 'sp-bar'));
  sol.pts.forEach((p, i) => {
    const [x, y] = S(p);
    out.push(`<circle class="sp-pt" cx="${x}" cy="${y}" r="3"/><text class="sp-name" x="${x + 8}" y="${y + 18}">${ptName(i)}</text>`);
  });
  // Размеры участков — подписью у середины.
  f.segs.forEach((s, i) => {
    const m = S(sol.pts[i].map((x, k) => (x + sol.pts[i + 1][k]) / 2) as V3);
    out.push(`<text class="sp-len" x="${m[0] - 10}" y="${m[1] - 8}">${esc(fmt(s.l, 2))}</text>`);
  });
  // Нагрузки.
  for (const ld of f.loads) {
    if (ld.kind === 'q') {
      const a = sol.pts[ld.seg],
        b = sol.pts[ld.seg + 1];
      const d = signed(ld.axis, ld.v);
      const n = 7;
      for (let k = 0; k <= n; k++) {
        const p = a.map((x, j) => x + ((b[j] - x) * k) / n) as V3;
        const tail = p.map((x, j) => x - d[j] * len * 0.55) as V3;
        out.push(arrow(S(tail), S(p), 'sp-q'));
      }
      const tl = [a, b].map((p) => S(p.map((x, j) => x - d[j] * len * 0.55) as V3));
      out.push(line(tl[0], tl[1], 'sp-q'));
      out.push(`<text class="sp-qt" x="${r1((tl[0][0] + tl[1][0]) / 2)}" y="${r1((tl[0][1] + tl[1][1]) / 2 - 8)}">q = ${esc(fmt(Math.abs(ld.v), 2))}</text>`);
    } else {
      const p = sol.pts[ld.node];
      const d = signed(ld.axis, ld.v);
      const tip = ld.kind === 'P' ? p : (p.map((x, j) => x + d[j] * len) as V3);
      const tail = ld.kind === 'P' ? (p.map((x, j) => x - d[j] * len) as V3) : p;
      out.push(arrow(S(tail), S(tip), ld.kind === 'P' ? 'sp-f' : 'sp-m', ld.kind === 'M'));
      const lab = S(tail);
      out.push(`<text class="${ld.kind === 'P' ? 'sp-ft' : 'sp-mt'}" x="${lab[0] + 6}" y="${lab[1] - 6}">${ld.kind === 'P' ? 'P' : 'M'} = ${esc(fmt(Math.abs(ld.v), 2))}</text>`);
    }
  }
  // Оси координат в углу.
  const o: [number, number] = [60, H - 50];
  (['x', 'y', 'z'] as Axis[]).forEach((a) => {
    const q = proj(AX[a]);
    const e: [number, number] = [r1(o[0] + q[0] * 40), r1(o[1] + q[1] * 40)];
    out.push(arrow(o, e, 'sp-ax'), `<text class="sp-axt" x="${e[0] + 4}" y="${e[1] - 4}">${a}</text>`);
  });
  out.push(`<text class="sp-note" x="${W - 12}" y="${H - 8}" text-anchor="end">кН, кН·м, кН/м, м; пара — вектор с двойной стрелкой</text>`);
  return { svg: out.join(''), viewBox: `0 0 ${W} ${H}` };
}

export type EpureKind = 'Q' | 'Mb' | 'Mk';

/**
 * Эпюра в аксонометрии. Для Q и M_изг — обе составляющие на одном рисунке, каждая в своей плоскости;
 * M_к — ординаты по одной из поперечных осей. compressed — изгибающий момент на сжатых волокнах.
 */
export function renderEpure(sol: Solution3, kind: EpureKind, compressed: boolean): { svg: string; viewBox: string } {
  const H = 340;
  // Ординаты: для каждой составляющей — направление в пространстве и многочлен.
  type Ord = { seg: number; dir: V3; poly: Poly; cls: string };
  const ords: Ord[] = [];
  for (const sg of sol.segs) {
    if (kind === 'Q') sg.Q.forEach((c, j) => ords.push({ seg: sg.index, dir: AX[c.axis], poly: c.poly, cls: j ? 'b' : 'a' }));
    if (kind === 'Mb')
      sg.Mb.forEach((c, j) => {
        // Сжатые волокна — со стороны −(t × a).
        const side = cross(sg.t, AX[c.axis]).map((x) => (compressed ? -x : x)) as V3;
        ords.push({ seg: sg.index, dir: side, poly: c.poly, cls: j ? 'b' : 'a' });
      });
    if (kind === 'Mk') ords.push({ seg: sg.index, dir: AX[sg.Mb[0].axis], poly: sg.Mk, cls: 'a' });
  }
  const maxV = Math.max(1e-12, ...ords.flatMap((o) => [0, sol.segs[o.seg].L].map((s) => Math.abs(polyEval(o.poly, s)))), ...ords.flatMap((o) => rootsInside(polyDeriv(o.poly), 0, sol.segs[o.seg].L).map((s) => Math.abs(polyEval(o.poly, s)))));
  const v0 = fit(sol.pts, 60, H, 30);
  const k = (55 * v0.unit) / maxV; // мировых единиц на единицу усилия
  const S = v0.toS;
  const out: string[] = [];
  for (let i = 0; i + 1 < sol.pts.length; i++) out.push(line(S(sol.pts[i]), S(sol.pts[i + 1]), 'sp-bar sp-thin'));
  sol.pts.forEach((p, i) => {
    const [x, y] = S(p);
    out.push(`<text class="sp-name sp-small" x="${x + 6}" y="${y + 16}">${ptName(i)}</text>`);
  });
  const tol = 1e-9 * maxV;
  for (const o of ords) {
    const sg = sol.segs[o.seg];
    const at = (s: number): V3 => sg.P0.map((x, j) => x + sg.t[j] * s) as V3;
    const ord = (s: number): V3 => at(s).map((x, j) => x + o.dir[j] * polyEval(o.poly, s) * k) as V3;
    const vals = [0, sg.L].map((s) => polyEval(o.poly, s));
    if (vals.every((x) => Math.abs(x) < tol) && Math.abs(polyEval(o.poly, sg.L / 2)) < tol) continue;
    const n = 24;
    const curve = Array.from({ length: n + 1 }, (_, j) => S(ord((sg.L * j) / n)));
    out.push(`<path class="sp-fill sp-${o.cls}" d="M${S(at(0)).join(' ')}L${curve.map((p) => p.join(' ')).join('L')}L${S(at(sg.L)).join(' ')}Z"/>`);
    for (let j = 1; j < n; j += 2) out.push(line(S(at((sg.L * j) / n)), S(ord((sg.L * j) / n)), `sp-hatch sp-${o.cls}`));
    out.push(`<polyline class="sp-line sp-${o.cls}" points="${curve.map((p) => p.join(',')).join(' ')}"/>`);
    const marks = [0, sg.L, ...rootsInside(polyDeriv(o.poly), 0, sg.L)];
    for (const s of marks) {
      const val = polyEval(o.poly, s);
      if (Math.abs(val) < tol) continue;
      const p = S(ord(s));
      out.push(`<text class="sp-val" x="${p[0] + 4}" y="${p[1] - 4}">${esc(fmt(kind === 'Mk' ? val : Math.abs(val) * (kind === 'Q' ? Math.sign(val) : 1), 2))}</text>`);
    }
  }
  return { svg: out.join(''), viewBox: `0 0 ${W} ${H}` };
}
