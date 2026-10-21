/**
 * Чертёж удара: тела (точка, шар, диск, стержень, пластина, тело на оси, преграда), точка удара P и нормаль n,
 * ударный импульс на тело 2 и импульсы осей; скорости центров масс до удара (штрих) и после (сплошные).
 */
import type { ImpBody, ImpProblem, ImpResult } from '../model/impact';

const r1 = (v: number) => Math.round(v * 10) / 10;
type P2 = [number, number];
const W = 1000,
  H = 480;
const rad = (a: number) => (a * Math.PI) / 180;

function arrow(a: P2, bb: P2, cls: string) {
  const dx = bb[0] - a[0],
    dy = bb[1] - a[1],
    L = Math.hypot(dx, dy) || 1,
    ux = dx / L,
    uy = dy / L;
  return `<line class="${cls}" x1="${r1(a[0])}" y1="${r1(a[1])}" x2="${r1(bb[0] - ux * 8)}" y2="${r1(bb[1] - uy * 8)}"/><path class="${cls}-f" d="M${r1(bb[0])} ${r1(bb[1])}L${r1(bb[0] - ux * 11 - uy * 4.5)} ${r1(bb[1] - uy * 11 + ux * 4.5)}L${r1(bb[0] - ux * 11 + uy * 4.5)} ${r1(bb[1] - uy * 11 - ux * 4.5)}Z"/>`;
}
const label = (x: number, y: number, cls: string, L: string, S = '', anchor = 'start') =>
  `<text class="t cv-t ${cls}" x="${r1(x)}" y="${r1(y)}" text-anchor="${anchor}">${L}${S ? `<tspan dy="4" font-size="10">${S}</tspan>` : ''}</text>`;
function ground(p: P2, t: P2, s: P2, len: number) {
  const out = [
    `<line class="en-ground" x1="${r1(p[0] - (t[0] * len) / 2)}" y1="${r1(p[1] - (t[1] * len) / 2)}" x2="${r1(p[0] + (t[0] * len) / 2)}" y2="${r1(p[1] + (t[1] * len) / 2)}"/>`,
  ];
  for (let q = -len / 2 + 6; q <= len / 2; q += 12) {
    const a: P2 = [p[0] + t[0] * q, p[1] + t[1] * q];
    out.push(`<line class="en-hatch" x1="${r1(a[0])}" y1="${r1(a[1])}" x2="${r1(a[0] + s[0] * 9 - t[0] * 7)}" y2="${r1(a[1] + s[1] * 9 - t[1] * 7)}"/>`);
  }
  return out.join('');
}
/** Очертание тела в координатах задачи: точки, по которым подбирается масштаб. */
function outline(bd: ImpBody): P2[] {
  const C: P2 = [bd.cx, bd.cy];
  const pts: P2[] = [C];
  if (bd.kind === 'axis') pts.push([bd.ox, bd.oy]);
  const c = Math.cos(rad(bd.th)),
    s = Math.sin(rad(bd.th));
  if (bd.inertia === 'disk' || bd.inertia === 'ring' || bd.inertia === 'sphere') pts.push([C[0] - bd.R, C[1] - bd.R], [C[0] + bd.R, C[1] + bd.R]);
  if (bd.inertia === 'rod') pts.push([C[0] - (c * bd.L) / 2, C[1] - (s * bd.L) / 2], [C[0] + (c * bd.L) / 2, C[1] + (s * bd.L) / 2]);
  if (bd.inertia === 'rect')
    for (const [u, w] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ])
      pts.push([C[0] + (u * bd.a * c) / 2 - (w * bd.b * s) / 2, C[1] + (u * bd.a * s) / 2 + (w * bd.b * c) / 2]);
  return pts;
}

export function renderImpact(pr: ImpProblem, r: ImpResult): { svg: string; viewBox: string } {
  const out: string[] = [`<rect width="${W}" height="${H}" fill="var(--sheet)"/>`];
  if (!r.ok) {
    out.push(`<text class="tb-note" x="16" y="${H / 2}">Проверьте данные.</text>`);
    return { svg: out.join(''), viewBox: `0 0 ${W} ${H}` };
  }
  const scr = (d: P2): P2 => [d[0], -d[1]];
  const unit = (d: P2): P2 => {
    const l = Math.hypot(...d);
    return l > 1e-15 ? [d[0] / l, d[1] / l] : [0, 0];
  };
  const bodies: [ImpBody, ImpResult['b1']][] = [
    [pr.b1, r.b1],
    [pr.b2, r.b2],
  ];
  const Vmax = Math.max(1e-12, ...bodies.flatMap(([, s]) => [Math.hypot(...s.v), Math.hypot(...s.u)]));
  const LV = (v: number) => 24 + 66 * (v / Vmax);
  const Smax = Math.max(1e-12, Math.hypot(...r.S), ...bodies.map(([, s]) => (s.SO ? Math.hypot(...s.SO) : 0)));
  const LS = (v: number) => 30 + 50 * (v / Smax);
  // Что должно поместиться.
  const items: { p: P2; o: P2 }[] = [];
  const P: P2 = [pr.px, pr.py];
  items.push({ p: P, o: [0, 0] });
  for (const [bd, st] of bodies) {
    if (bd.kind === 'wall') {
      items.push({ p: P, o: [60, 60] }, { p: P, o: [-60, -60] });
      continue;
    }
    for (const q of outline(bd)) items.push({ p: q, o: [0, 0] });
    for (const vv of [st.v, st.u]) {
      const L = Math.hypot(...vv);
      if (L > 1e-12) {
        const d = scr(unit(vv));
        items.push({ p: [bd.cx, bd.cy], o: [d[0] * (LV(L) + 22), d[1] * (LV(L) + 22)] });
      }
    }
    items.push({ p: [bd.cx, bd.cy], o: [26, 26] }, { p: [bd.cx, bd.cy], o: [-26, -26] });
  }
  const SL = Math.hypot(...r.S);
  if (SL > 0) {
    const d = scr(unit(r.S));
    items.push({ p: P, o: [d[0] * (LS(SL) + 20), d[1] * (LS(SL) + 20)] });
  }
  const AW = 710,
    AH = 394;
  const box = (k: number) => {
    const xs = items.map((it) => k * it.p[0] + it.o[0]),
      ys = items.map((it) => -k * it.p[1] + it.o[1]);
    return [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  };
  let lo = 1e-6,
    hi = 1e7;
  for (let it = 0; it < 80; it++) {
    const mid = Math.sqrt(lo * hi);
    const [a0, a1, b0, b1] = box(mid);
    if (a1 - a0 <= AW && b1 - b0 <= AH) lo = mid;
    else hi = mid;
  }
  const k = lo;
  const [bx0, bx1, by0, by1] = box(k);
  const ox = 30 + (AW - (bx1 - bx0)) / 2 - bx0,
    oy = 36 + (AH - (by1 - by0)) / 2 - by0;
  const S = (p: P2): P2 => [ox + k * p[0], oy - k * p[1]];
  const Ps = S(P);
  const n = scr(r.n);
  /** Название тела — от точки удара наружу за центром масс. */
  const nameAt = (C: P2, c: P2, text: string) => {
    let d = scr(unit([c[0] - P[0], c[1] - P[1]]));
    if (!d[0] && !d[1]) d = [-0.7, -0.7];
    const x = C[0] + d[0] * 26,
      y = C[1] + d[1] * 26 + (d[1] < -0.3 ? -4 : 12);
    return label(x, y, 'en-name', text, '', d[0] < -0.3 ? 'end' : d[0] > 0.3 ? 'start' : 'middle');
  };
  // Тела.
  bodies.forEach(([bd, st], i) => {
    if (bd.kind === 'wall') {
      // Подпись преграды — вдоль её линии, в стороне от импульса.
      out.push(
        ground(Ps, [-n[1], n[0]], n, 130),
        label(Ps[0] - n[1] * 72 + n[0] * 14, Ps[1] + n[0] * 72 + n[1] * 14 + 4, 'tb-note', bd.name.trim() || `тело ${i + 1}`, '', 'middle'),
      );
      return;
    }
    const C = S([bd.cx, bd.cy]);
    const c = Math.cos(rad(bd.th)),
      s = Math.sin(rad(bd.th));
    if (bd.kind === 'axis') {
      const O = S([bd.ox, bd.oy]);
      out.push(`<line class="mc-guide" x1="${r1(O[0])}" y1="${r1(O[1])}" x2="${r1(C[0])}" y2="${r1(C[1])}"/>`);
    }
    if (bd.inertia === 'disk' || bd.inertia === 'ring' || bd.inertia === 'sphere') {
      out.push(`<circle class="en-wheel" cx="${r1(C[0])}" cy="${r1(C[1])}" r="${r1(bd.R * k)}"/>`);
      if (bd.inertia === 'ring') out.push(`<circle class="en-wheel2" cx="${r1(C[0])}" cy="${r1(C[1])}" r="${r1(bd.R * k * 0.86)}"/>`);
    } else if (bd.inertia === 'rod') {
      const A = S([bd.cx - (c * bd.L) / 2, bd.cy - (s * bd.L) / 2]),
        B = S([bd.cx + (c * bd.L) / 2, bd.cy + (s * bd.L) / 2]);
      out.push(`<line class="mc-bar" x1="${r1(A[0])}" y1="${r1(A[1])}" x2="${r1(B[0])}" y2="${r1(B[1])}"/>`);
    } else if (bd.inertia === 'rect') {
      const pts = outline(bd).slice(bd.kind === 'axis' ? 2 : 1);
      out.push(`<path class="mc-plate" d="M${pts.map((q) => S(q).map(r1).join(' ')).join('L')}Z"/>`);
    } else if (bd.inertia === 'point') out.push(`<circle class="cg-mass" cx="${r1(C[0])}" cy="${r1(C[1])}" r="9"/>`);
    else out.push(`<circle class="mc-wheel" cx="${r1(C[0])}" cy="${r1(C[1])}" r="18"/>`);
    if (bd.kind === 'axis') {
      const O = S([bd.ox, bd.oy]);
      out.push(
        `<path class="sb-tip" d="M${r1(O[0])} ${r1(O[1])}l-11 -18h22Z"/><circle class="hinge" cx="${r1(O[0])}" cy="${r1(O[1])}" r="4.5"/>`,
        label(O[0] + 12, O[1] - 6, 't-pt', 'O', String(i + 1)),
      );
      if (st.SO && Math.hypot(...st.SO) > 1e-9 * Smax) {
        const d = scr(unit(st.SO)),
          L = LS(Math.hypot(...st.SO));
        out.push(arrow(O, [O[0] + d[0] * L, O[1] + d[1] * L], 'rc'), label(O[0] + d[0] * (L + 10), O[1] + d[1] * (L + 10) + 4, 't-rc', 'S', `O${i + 1}`));
      }
    }
    out.push(`<circle class="cg-c" cx="${r1(C[0])}" cy="${r1(C[1])}" r="4.5"/>`, nameAt(C, [bd.cx, bd.cy], String(i + 1)));
    // Скорости центра масс: до удара — штрихом, после — сплошной.
    const vb = Math.hypot(...st.v),
      va = Math.hypot(...st.u);
    if (vb > 1e-12) {
      const d = scr(unit(st.v));
      out.push(
        `<g stroke-dasharray="6 4" opacity=".55">${arrow(C, [C[0] + d[0] * LV(vb), C[1] + d[1] * LV(vb)], 'en-v')}</g>`,
        label(C[0] + d[0] * (LV(vb) + 12), C[1] + d[1] * (LV(vb) + 12) + 4, 'en-vt', 'v', String(i + 1)),
      );
    }
    if (va > 1e-12) {
      const d = scr(unit(st.u));
      out.push(
        arrow(C, [C[0] + d[0] * LV(va), C[1] + d[1] * LV(va)], 'en-v'),
        label(C[0] + d[0] * (LV(va) + 12), C[1] + d[1] * (LV(va) + 12) + 4, 'en-vt', 'u', String(i + 1)),
      );
    }
  });
  // Точка удара, нормаль и импульс на тело 2.
  out.push(`<circle class="sb-pt" cx="${r1(Ps[0])}" cy="${r1(Ps[1])}" r="3.5"/>`, label(Ps[0] - 8, Ps[1] + 18, 't-pt', 'P', '', 'end'));
  out.push(
    `<line class="mc-guide" x1="${r1(Ps[0] - n[0] * 40)}" y1="${r1(Ps[1] - n[1] * 40)}" x2="${r1(Ps[0] + n[0] * 40)}" y2="${r1(Ps[1] + n[1] * 40)}"/>`,
    label(Ps[0] + n[0] * 44 + n[1] * 12, Ps[1] + n[1] * 44 - n[0] * 12 + 4, 'tb-note', 'n'),
  );
  if (SL > 0) {
    const d = scr(unit(r.S)),
      L = LS(SL);
    out.push(arrow(Ps, [Ps[0] + d[0] * L, Ps[1] + d[1] * L], 'rc'), label(Ps[0] + d[0] * (L + 10), Ps[1] + d[1] * (L + 10) + 4, 't-rc', 'S'));
  }
  // Легенда: номера тел.
  const names = bodies.map(([bd], i) => `${i + 1} — ${bd.name.trim() || (bd.kind === 'wall' ? 'преграда' : `тело ${i + 1}`)}`).join(';  ');
  out.push(`<text class="tb-note" x="16" y="22">${names.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`);
  out.push(
    `<text class="tb-note" x="16" y="${H - 14}">Штрих — скорости центров масс до удара, сплошные — после; S — ударный импульс на тело 2${pr.b1.kind === 'axis' || pr.b2.kind === 'axis' ? ', S_O — импульсы осей' : ''}.</text>`,
  );
  return { svg: out.join(''), viewBox: `0 0 ${W} ${H}` };
}
