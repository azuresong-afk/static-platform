/**
 * Чертёж стержневой системы: неподвижные шарниры, стержни (цвет — растяжение или сжатие, подпись — номер и усилие),
 * узел или жёсткий брус, опоры бруса, нагрузки; пунктиром — положение после деформации (перемещения увеличены).
 */
import { fmt } from '../../../shared/format';
import type { RodProblem, RodResult } from '../model/rods';

const r1 = (v: number) => Math.round(v * 10) / 10;
const W = 1000,
  H = 480;
type P2 = [number, number];
const rad = (d: number) => (d * Math.PI) / 180;

export function renderRods(pr: RodProblem, r: RodResult | null): { svg: string; viewBox: string } {
  const out: string[] = [`<rect width="${W}" height="${H}" fill="var(--sheet)"/>`];
  const bar = pr.body === 'bar';
  const P = (i: number): P2 => (bar ? [pr.rods[i].x, 0] : [0, 0]);
  const anchor = (i: number): P2 => {
    const p = P(i),
      rd = pr.rods[i];
    return [p[0] + rd.l * Math.cos(rad(rd.ang)), p[1] + rd.l * Math.sin(rad(rd.ang))];
  };
  // Габарит в метрах.
  const pts: P2[] = [[0, 0]];
  if (bar) pts.push([pr.L, 0]);
  pr.rods.forEach((_, i) => pts.push(anchor(i)));
  const xs = pts.map((p) => p[0]),
    ys = pts.map((p) => p[1]);
  let x0 = Math.min(...xs),
    x1 = Math.max(...xs),
    y0 = Math.min(...ys),
    y1 = Math.max(...ys);
  const span = Math.max(x1 - x0, y1 - y0, bar ? pr.L : 1, 0.5);
  const pad = span * 0.18;
  x0 -= pad;
  x1 += pad;
  y0 -= pad;
  y1 += pad;
  const s = Math.min((W - 80) / (x1 - x0), (H - 110) / (y1 - y0));
  const cx = (W - (x1 - x0) * s) / 2,
    cy = 40;
  const T = (p: P2): P2 => [cx + (p[0] - x0) * s, cy + (y1 - p[1]) * s];
  const L = (a: P2, b: P2, cls: string) => `<line class="${cls}" x1="${r1(a[0])}" y1="${r1(a[1])}" x2="${r1(b[0])}" y2="${r1(b[1])}"/>`;
  const arrow = (a: P2, b: P2, cls: string) => {
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      l = Math.hypot(dx, dy) || 1,
      ux = dx / l,
      uy = dy / l;
    return `${L(a, [b[0] - ux * 8, b[1] - uy * 8], cls)}<path class="${cls}-f" d="M${r1(b[0])} ${r1(b[1])}L${r1(b[0] - ux * 11 - uy * 4.5)} ${r1(b[1] - uy * 11 + ux * 4.5)}L${r1(b[0] - ux * 11 + uy * 4.5)} ${r1(b[1] - uy * 11 - ux * 4.5)}Z"/>`;
  };
  const txt = (p: P2, t: string, cls = 't cv-t rd-lab', anchorTxt = 'middle') =>
    `<text class="${cls}" x="${r1(p[0])}" y="${r1(p[1])}" text-anchor="${anchorTxt}">${t}</text>`;

  // План перемещений: масштаб так, чтобы наибольшее перемещение было ~34 px.
  const base = r?.ok ? r.base : null;
  const disp = (p: P2): P2 => (base ? [base.u, base.v + base.theta * p[0] * 1000] : [0, 0]); // мм
  let dmax = 0;
  if (base) {
    dmax = Math.max(Math.hypot(...disp([0, 0])), bar ? Math.hypot(...disp([pr.L, 0])) : 0);
  }
  const ks = dmax > 1e-12 ? 34 / dmax : 0; // px на мм
  const Td = (p: P2): P2 => {
    const q = T(p),
      d = disp(p);
    return [q[0] + d[0] * ks, q[1] - d[1] * ks];
  };

  // Неподвижные шарниры стержней.
  pr.rods.forEach((rd, i) => {
    const A = T(anchor(i));
    const ux = Math.cos(rad(rd.ang)),
      uy = -Math.sin(rad(rd.ang)); // экранный орт от тела к шарниру
    const nx = -uy,
      ny = ux;
    const g1: P2 = [A[0] + ux * 6 + nx * 16, A[1] + uy * 6 + ny * 16],
      g2: P2 = [A[0] + ux * 6 - nx * 16, A[1] + uy * 6 - ny * 16];
    out.push(L(g1, g2, 'rd-ground'));
    for (let k = -14; k <= 14; k += 7)
      out.push(L([A[0] + ux * 6 + nx * k, A[1] + uy * 6 + ny * k], [A[0] + ux * 13 + nx * (k + 5), A[1] + uy * 13 + ny * (k + 5)], 'rd-hatch'));
  });
  // Деформированное положение (под основным).
  if (base && ks > 0) {
    pr.rods.forEach((_, i) => out.push(L(T(anchor(i)), Td(P(i)), 'rd-def')));
    if (bar) out.push(L(Td([0, 0]), Td([pr.L, 0]), 'rd-def rd-defbar'));
    else out.push(`<circle class="rd-defnode" cx="${r1(Td([0, 0])[0])}" cy="${r1(Td([0, 0])[1])}" r="5"/>`);
  }
  // Стержни.
  pr.rods.forEach((_, i) => {
    const a = T(P(i)),
      b = T(anchor(i));
    const N = base?.rods[i].N ?? 0;
    const cls = !base ? 'rd-rod' : N > 1e-9 ? 'rd-rod rd-ten' : N < -1e-9 ? 'rd-rod rd-com' : 'rd-rod rd-zero';
    out.push(L(a, b, cls));
    out.push(`<circle class="rd-hinge" cx="${r1(b[0])}" cy="${r1(b[1])}" r="4.5"/>`);
    const m: P2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const ux = (b[0] - a[0]) / (Math.hypot(b[0] - a[0], b[1] - a[1]) || 1),
      uy = (b[1] - a[1]) / (Math.hypot(b[0] - a[0], b[1] - a[1]) || 1);
    const off: P2 = [m[0] - uy * 16, m[1] + ux * 16];
    out.push(`<circle class="rd-num" cx="${r1(off[0])}" cy="${r1(off[1])}" r="10"/>${txt([off[0], off[1] + 4.5], String(i + 1), 't cv-t rd-numt')}`);
    if (base) out.push(txt([off[0] + 14, off[1] + 4.5], `N = ${fmt(N, 2)}`, 't cv-t rd-val', 'start'));
  });
  // Тело.
  if (bar) {
    const a = T([0, 0]),
      b = T([pr.L, 0]);
    out.push(`<rect class="rd-bar" x="${r1(a[0])}" y="${r1(a[1] - 6)}" width="${r1(b[0] - a[0])}" height="12" rx="2"/>`);
    pr.rods.forEach((_, i) => {
      const p = T(P(i));
      out.push(`<circle class="rd-hinge" cx="${r1(p[0])}" cy="${r1(p[1])}" r="4.5"/>`);
    });
    // Опоры.
    pr.supports.forEach((sp, j) => {
      const p = T([sp.x, 0]);
      const ang = sp.kind === 'pin' ? 90 : sp.ang;
      const ux = Math.cos(rad(ang)),
        uy = -Math.sin(rad(ang)); // направление реакции на экране (к брусу)
      // Опора с противоположной стороны: вершина у бруса, основание — по направлению −реакции.
      const bx = p[0] - ux * 24,
        by = p[1] - uy * 24;
      const nx = -uy,
        ny = ux;
      out.push(`<path class="rd-sup" d="M${r1(p[0])} ${r1(p[1])}L${r1(bx + nx * 12)} ${r1(by + ny * 12)}L${r1(bx - nx * 12)} ${r1(by - ny * 12)}Z"/>`);
      const gx = sp.kind === 'roller' ? bx - ux * 7 : bx,
        gy = sp.kind === 'roller' ? by - uy * 7 : by;
      if (sp.kind === 'roller') out.push(L([bx + nx * 14, by + ny * 14], [bx - nx * 14, by - ny * 14], 'rd-ground'));
      out.push(L([gx + nx * 18, gy + ny * 18], [gx - nx * 18, gy - ny * 18], 'rd-ground'));
      for (let k = -16; k <= 16; k += 8) out.push(L([gx + nx * k, gy + ny * k], [gx - ux * 7 + nx * (k - 5), gy - uy * 7 + ny * (k - 5)], 'rd-hatch'));
      out.push(`<circle class="rd-hinge" cx="${r1(p[0])}" cy="${r1(p[1])}" r="4.5"/>`);
      out.push(txt([p[0] + 14, p[1] + 22], 'ABCDEFGH'[j] ?? '', 't cv-t rd-supl', 'start'));
    });
  } else {
    const p = T([0, 0]);
    out.push(`<circle class="rd-node" cx="${r1(p[0])}" cy="${r1(p[1])}" r="6"/>`);
  }
  // Нагрузки.
  pr.loads.forEach((ld) => {
    if (!ld.F) return;
    if (ld.kind === 'F') {
      const p = T(bar ? [ld.x, 0] : [0, 0]);
      const d = ld.F < 0 ? ld.ang + 180 : ld.ang;
      const ux = Math.cos(rad(d)),
        uy = -Math.sin(rad(d));
      const tail: P2 = [p[0] - ux * 58, p[1] - uy * 58];
      out.push(arrow(tail, [p[0] - ux * 7, p[1] - uy * 7], 'rd-load'));
      // Подпись — у начала стрелки, сбоку от неё (слева по ходу стрелки).
      const sx = -uy,
        sy = ux;
      out.push(
        txt([tail[0] + sx * 10, tail[1] + sy * 10 + 4], `${fmt(Math.abs(ld.F), 2)} кН`, 't cv-t rd-loadt', sx > 0.3 ? 'start' : sx < -0.3 ? 'end' : 'middle'),
      );
    } else if (ld.kind === 'M' && bar) {
      const p = T([ld.x, 0]);
      const ccw = ld.F > 0;
      out.push(`<path class="rd-load" fill="none" d="M${r1(p[0] + 24)} ${r1(p[1])}A24 24 0 1 ${ccw ? 0 : 1} ${r1(p[0])} ${r1(p[1] - 24)}"/>`);
      out.push(txt([p[0] + 28, p[1] - 22], `${fmt(Math.abs(ld.F), 2)} кН·м`, 't cv-t rd-loadt', 'start'));
    } else if (ld.kind === 'q' && bar) {
      const a = T([ld.x, 0]),
        b = T([ld.x2, 0]);
      const dn = ld.F > 0;
      const top = a[1] - 40;
      out.push(L([a[0], top], [b[0], top], 'rd-load'));
      const nArr = Math.max(2, Math.round((b[0] - a[0]) / 22));
      for (let k = 0; k <= nArr; k++) {
        const x = a[0] + ((b[0] - a[0]) * k) / nArr;
        out.push(dn ? arrow([x, top], [x, a[1] - 7], 'rd-load') : arrow([x, a[1] - 7], [x, top], 'rd-load'));
      }
      out.push(txt([(a[0] + b[0]) / 2, top - 8], `q = ${fmt(Math.abs(ld.F), 2)} кН/м`, 't cv-t rd-loadt'));
    }
  });
  if (base && ks > 0)
    out.push(
      `<text class="tb-note" x="16" y="${H - 34}">Пунктир — положение после деформации; перемещения увеличены в ${fmt(ks * s > 0 ? (ks * 1000) / s : 0, 0)} раз.</text>`,
    );
  out.push(`<text class="tb-note" x="16" y="${H - 14}">Синий — растянутый стержень, красный — сжатый; N в кН.</text>`);
  return { svg: out.join(''), viewBox: `0 0 ${W} ${H}` };
}
