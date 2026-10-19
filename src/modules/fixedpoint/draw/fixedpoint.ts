/**
 * Чертежи: схема в плоскости осей (оси звеньев, колёса и конусы по точкам касания, неподвижные поверхности,
 * мгновенные оси, скорости точек ⊙/⊗); углы Эйлера и кинематический винт — в аксонометрии.
 */
import { fmt } from '../../../shared/format';
import { BODY, FIXED, type EulerProblem, type EulerResult } from '../model/euler';
import { LEN, type SchemeProblem, type SchemeResult } from '../model/scheme';
import type { ScrewProblem, ScrewResult } from '../model/screw';
import { dot, norm, vadd, vmul, vsub, type V3 } from '../model/vec';

type P2 = [number, number];
const r1 = (v: number) => Math.round(v * 10) / 10;
const W = 1000,
  H = 520;
const wrap = (out: string[]) => ({ svg: out.join(''), viewBox: `0 0 ${W} ${H}` });
const sheet = () => [`<rect width="${W}" height="${H}" fill="var(--sheet)"/>`];
const note = (out: string[], text: string) => out.push(`<text class="tb-note" x="16" y="${H - 14}">${text}</text>`);
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function arrow(a: P2, bb: P2, cls: string) {
  const dx = bb[0] - a[0],
    dy = bb[1] - a[1],
    L = Math.hypot(dx, dy) || 1,
    ux = dx / L,
    uy = dy / L;
  return `<line class="${cls}" x1="${r1(a[0])}" y1="${r1(a[1])}" x2="${r1(bb[0] - ux * 8)}" y2="${r1(bb[1] - uy * 8)}"/><path class="${cls}-f" d="M${r1(bb[0])} ${r1(bb[1])}L${r1(bb[0] - ux * 11 - uy * 4.5)} ${r1(bb[1] - uy * 11 + ux * 4.5)}L${r1(bb[0] - ux * 11 + uy * 4.5)} ${r1(bb[1] - uy * 11 - ux * 4.5)}Z"/>`;
}
const label = (x: number, y: number, cls: string, text: string, anchor = 'start') =>
  `<text class="t cv-t ${cls}" x="${r1(x)}" y="${r1(y)}" text-anchor="${anchor}">${esc(text)}</text>`;
const line = (a: P2, bb: P2, cls: string) => `<line class="${cls}" x1="${r1(a[0])}" y1="${r1(a[1])}" x2="${r1(bb[0])}" y2="${r1(bb[1])}"/>`;

/** Подбор масштаба: точки → область [x0, x0 + w] × [y0, y0 + h], ось y вверх. */
function fitter(pts: P2[], x0: number, y0: number, w: number, h: number) {
  const xs = pts.map((p) => p[0]),
    ys = pts.map((p) => p[1]);
  const lo: P2 = [Math.min(...xs), Math.min(...ys)],
    hi: P2 = [Math.max(...xs), Math.max(...ys)];
  const s = Math.min(w / (hi[0] - lo[0] || 1), h / (hi[1] - lo[1] || 1));
  const cx = x0 + w / 2 - ((lo[0] + hi[0]) / 2) * s,
    cy = y0 + h / 2 + ((lo[1] + hi[1]) / 2) * s;
  return { s, P: (p: P2 | V3): P2 => [cx + p[0] * s, cy - p[1] * s] };
}

/* ---------- схема ---------- */

export function renderScheme(pr: SchemeProblem, r: SchemeResult) {
  const out = sheet();
  if (!r.ok) {
    out.push(`<text class="tb-note" x="16" y="${H / 2}">Проверьте данные: схема не собрана.</text>`);
    return wrap(out);
  }
  const L = r.L;
  const B = r.bodies;
  const idx = new Map(B.map((b, i) => [b.id, i]));
  // Точки «обода» звена: касания и собственные точки вне оси.
  const rims = B.map(() => [] as V3[]);
  const addRim = (i: number | undefined, P: V3) => {
    if (i === undefined || Math.abs(P[2]) > 1e-9) return;
    const bb = B[i];
    const off = Math.abs((bb.e[0] * (P[1] - bb.A[1]) - bb.e[1] * (P[0] - bb.A[0])) as number);
    if (off < 1e-6 * L) return;
    if (!rims[i].some((q) => Math.hypot(q[0] - P[0], q[1] - P[1]) < 1e-6 * L)) rims[i].push(P);
  };
  for (const c of pr.contacts) {
    const P = r.pos.get(c.p);
    if (!P) continue;
    addRim(idx.get(c.a), P);
    if (c.b) addRim(idx.get(c.b), P);
  }
  for (const p of pr.points) if (p.body) addRim(idx.get(p.body), r.pos.get(p.id)!);
  const foot = (i: number, P: V3): V3 => vadd(B[i].A, vmul(B[i].e, dot(vsub(P, B[i].A), B[i].e)));
  // Отрезки осей: от точки оси до проекций связанных точек.
  const axSeg = B.map((bb, i) => {
    const ts = [0, ...rims[i].map((P) => dot(vsub(P, bb.A), bb.e))];
    B.forEach((ch) => {
      if (ch.parent === bb.id) ts.push(dot(vsub(ch.A, bb.A), bb.e));
    });
    for (const p of pr.points) if (p.body === bb.id) ts.push(dot(vsub(r.pos.get(p.id)!, bb.A), bb.e));
    const lo = Math.min(...ts) - 0.15 * L,
      hi = Math.max(...ts, 0.35 * L) + 0.15 * L;
    return [vadd(bb.A, vmul(bb.e, lo)), vadd(bb.A, vmul(bb.e, hi))] as [V3, V3];
  });
  const all: P2[] = [[0, 0], ...axSeg.flat().map((p): P2 => [p[0], p[1]]), ...[...r.pos.values()].map((p): P2 => [p[0], p[1]])];
  for (let i = 0; i < B.length; i++)
    for (const P of rims[i]) {
      const F = foot(i, P);
      all.push([2 * F[0] - P[0], 2 * F[1] - P[1]]);
    }
  for (const bb of B)
    if (bb.chain.length > 1 && bb.inst && (bb.kind === 'point' || bb.kind === 'plane')) {
      const e = vadd(bb.inst.p, vmul(bb.inst.d, 1.1 * L));
      all.push([e[0], e[1]]);
    }
  const fit = fitter(all, 120, 50, 520, H - 130);
  const S = fit.P;
  // Неподвижные поверхности качения.
  for (const c of pr.contacts) {
    if (c.b !== 0) continue;
    const i = idx.get(c.a);
    const P = r.pos.get(c.p);
    if (i === undefined || !P) continue;
    const bb = B[i];
    const F = foot(i, P);
    const inward = vsub(F, P);
    const n = norm(inward) || 1;
    let a: V3, e: V3;
    if (bb.O && bb.kind === 'point') {
      a = bb.O;
      e = vadd(P, vmul(vsub(P, bb.O), 0.3));
    } else {
      const t: V3 = [-inward[1] / n, inward[0] / n, 0];
      a = vsub(P, vmul(t, 0.12 * L));
      e = vadd(P, vmul(t, 0.12 * L));
    }
    const sa = S(a),
      se = S(e);
    out.push(line(sa, se, 'fp-ground'));
    // Штриховка — с внешней стороны (от звена).
    const dx = se[0] - sa[0],
      dy = se[1] - sa[1],
      len = Math.hypot(dx, dy) || 1;
    let nx = -dy / len,
      ny = dx / len;
    const sp = S(P),
      sf = S(F);
    if (nx * (sf[0] - sp[0]) + ny * (sf[1] - sp[1]) > 0) {
      nx = -nx;
      ny = -ny;
    }
    for (let k = 0; k <= len; k += 14) {
      const x = sa[0] + (dx * k) / len,
        y = sa[1] + (dy * k) / len;
      out.push(line([x, y], [x + nx * 8 - (dx / len) * 6, y + ny * 8 - (dy / len) * 6], 'fp-hatch'));
    }
  }
  // Вершина конуса звена: своя неподвижная точка или неподвижная точка звена, с которым оно в зацеплении, если она на его оси.
  const apex = B.map((bb, i): V3 | null => {
    if (bb.kind === 'point' && bb.O) return bb.O;
    for (const c of pr.contacts) {
      const other = c.a === bb.id ? c.b : c.b === bb.id ? c.a : -1;
      const j = other > 0 ? idx.get(other) : undefined;
      if (j === undefined) continue;
      const O = B[j].kind === 'point' ? B[j].O : null;
      if (O && Math.abs(bb.e[0] * (O[1] - bb.A[1]) - bb.e[1] * (O[0] - bb.A[0])) < 1e-6 * L) return O;
    }
    void i;
    return null;
  });
  // Колёса, диски и конусы.
  B.forEach((_, i) => {
    const seen: string[] = [];
    for (const P of rims[i]) {
      const F = foot(i, P);
      const Q = vsub(vmul(F, 2), P);
      const key = `${r1(F[0])}:${r1(F[1])}:${r1(Math.abs(norm(vsub(P, F))))}`;
      if (seen.includes(key)) continue;
      seen.push(key);
      const ap = apex[i];
      if (ap && norm(vsub(F, ap)) > 1e-6 * L) {
        const o = S(ap),
          p = S(P),
          q = S(Q);
        out.push(`<path class="fp-cone" d="M${r1(o[0])} ${r1(o[1])}L${r1(p[0])} ${r1(p[1])}L${r1(q[0])} ${r1(q[1])}Z"/>`);
      }
      out.push(line(S(P), S(Q), 'fp-rim'));
    }
  });
  // Подписи: занятые места, чтобы не накладывались.
  const boxes: [number, number, number, number][] = [];
  // Сводка справа сверху — тоже занятое место.
  boxes.push([680, 20, W, 44 + Math.min(B.length, 9) * 22]);
  const place = (x: number, y: number, text: string, anchor: string): P2 => {
    const w = text.length * 7.2,
      x0 = anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x;
    let yy = y;
    for (let k = 0; k < 12; k++) {
      if (!boxes.some((b) => x0 < b[2] && x0 + w > b[0] && yy - 13 < b[3] && yy + 3 > b[1])) break;
      yy += 17;
    }
    boxes.push([x0, yy - 13, x0 + w, yy + 3]);
    return [x, yy];
  };
  // Оси звеньев.
  B.forEach((bb, i) => {
    const [a, e] = axSeg[i];
    const sa = S(a),
      se = S(e);
    out.push(line(sa, se, 'fp-axis'));
    out.push(arrow([se[0] - bb.e[0] * 26, se[1] + bb.e[1] * 26], se, 'fp-ax'));
    const text = `${bb.name}: ω = ${fmt(bb.w, 3)}`;
    let anchor = bb.e[0] < -0.3 ? 'end' : 'start';
    let x = se[0] + bb.e[0] * 8 + (bb.e[1] > 0.9 ? 6 : 0),
      y = se[1] - bb.e[1] * 8 - 4;
    // Не выходить за края листа: подпись — под концом оси.
    if (anchor === 'end' && x - text.length * 7.2 < 8) [anchor, x, y] = ['start', 8, se[1] + 22];
    if (anchor === 'start' && x + text.length * 7.2 > W - 8) [anchor, x] = ['end', W - 8];
    const [lx, ly] = place(x, y, text, anchor);
    out.push(label(lx, ly, 'fp-name', text, anchor));
  });
  // Мгновенные оси.
  for (const bb of B) {
    if (bb.chain.length < 2 || !bb.inst || (bb.kind !== 'point' && bb.kind !== 'plane')) continue;
    const p = bb.inst.p,
      d = bb.inst.d;
    const a = S(vsub(p, vmul(d, 0.25 * L))),
      e = S(vadd(p, vmul(d, 1.1 * L)));
    out.push(line(a, e, 'fp-inst'));
    const it = `Ω(${bb.name}) = ${fmt(norm(bb.W), 3)}`;
    const [ix, iy] = place(e[0] + 4, e[1] - 4, it, 'start');
    out.push(label(ix, iy, 'fp-inst-t', it));
  }
  // Точки и скорости.
  const resOf = new Map(r.points.map((p) => [p.id, p]));
  for (const p of pr.points) {
    const P = r.pos.get(p.id)!;
    const s = S(P);
    out.push(`<circle class="fp-pt" cx="${r1(s[0])}" cy="${r1(s[1])}" r="3.5"/>`);
    const pn = p.name + (P[2] ? ` (z = ${fmt(P[2], 2)})` : '');
    const [px, py] = place(s[0] + 7, s[1] + 15, pn, 'start');
    out.push(label(px, py, 'fp-ptn', pn));
    const res = resOf.get(p.id);
    if (res && Math.abs(P[2]) < 1e-9 && norm(res.v) > 1e-9 * L) {
      const vz = res.v[2];
      const cx = s[0] - 14,
        cy = s[1] - 12;
      out.push(`<circle class="fp-vel" cx="${r1(cx)}" cy="${r1(cy)}" r="6"/>`);
      out.push(
        vz > 0
          ? `<circle class="fp-vel-f" cx="${r1(cx)}" cy="${r1(cy)}" r="1.8"/>`
          : line([cx - 4, cy - 4], [cx + 4, cy + 4], 'fp-vel') + line([cx - 4, cy + 4], [cx + 4, cy - 4], 'fp-vel'),
      );
      const vt = `v = ${fmt(norm(res.v), 3)}`;
      const [vx, vy] = place(cx + 9, cy - 6, vt, 'start');
      out.push(label(vx, vy, 'fp-vt', vt));
    }
  }
  // Неподвижные точки.
  for (const bb of B)
    if (bb.kind === 'point' && bb.O) {
      const s = S(bb.O);
      out.push(`<circle class="fp-o" cx="${r1(s[0])}" cy="${r1(s[1])}" r="4.5"/>`);
    }
  // Значки осей и сводка.
  out.push(
    arrow([720, 470], [770, 470], 'fp-ax'),
    arrow([720, 470], [720, 420], 'fp-ax'),
    label(774, 474, 'fp-name', 'x'),
    label(716, 416, 'fp-name', 'y', 'end'),
  );
  out.push(`<circle class="fp-vel" cx="700" cy="488" r="6"/><circle class="fp-vel-f" cx="700" cy="488" r="1.8"/>`, label(690, 492, 'fp-name', 'z', 'end'));
  B.slice(0, 9).forEach((bb, i) =>
    out.push(
      `<text class="rt-tick" x="700" y="${44 + i * 22}"><tspan font-weight="600">${esc(bb.name)}</tspan> Ω = ${fmt(norm(bb.W), 4)} с⁻¹${norm(bb.E) > 0 ? `, ε = ${fmt(norm(bb.E), 4)} с⁻²` : ''}</text>`,
    ),
  );
  note(out, `Плоскость осей, ${LEN[pr.unit]}: ⊙ — скорость точки к нам, ⊗ — от нас; штриховой красной — мгновенные оси.`);
  return wrap(out);
}

/* ---------- аксонометрия ---------- */

const AX: [P2, P2, P2] = [
  [-0.55, 0.42],
  [1, 0],
  [0, -1],
];
const axo =
  (C: P2, s: number) =>
  (v: V3): P2 => [C[0] + s * (v[0] * AX[0][0] + v[1] * AX[1][0] + v[2] * AX[2][0]), C[1] + s * (v[0] * AX[0][1] + v[1] * AX[1][1] + v[2] * AX[2][1])];

export function renderEuler(pr: EulerProblem, r: EulerResult) {
  const out = sheet();
  if (!r.ok) {
    out.push(`<text class="tb-note" x="16" y="${H / 2}">Проверьте законы углов.</text>`);
    return wrap(out);
  }
  const P = axo([330, 270], 170);
  const O = P([0, 0, 0]);
  FIXED.forEach((n, i) => {
    const e: V3 = [0, 0, 0];
    e[i] = 1.2;
    const t = P(e);
    out.push(arrow(O, t, 'fp-fix'), label(t[0] + 6, t[1] + 4, 'fp-fix-t', n));
  });
  BODY.forEach((n, i) => {
    const e: V3 = [r.R[0][i], r.R[1][i], r.R[2][i]];
    const t = P(e);
    out.push(arrow(O, t, 'fp-body'), label(t[0] + 6, t[1] - 4, 'fp-body-t', n));
  });
  if (r.w > 0) {
    const t = P(vmul(r.wF, 1.05 / r.w));
    out.push(arrow(O, t, 'fp-w'), label(t[0] + 6, t[1] - 6, 'fp-w-t', 'ω'));
  }
  if (r.e > 0) {
    const t = P(vmul(r.eF, 0.8 / r.e));
    out.push(arrow(O, t, 'fp-e'), label(t[0] + 6, t[1] + 14, 'fp-e-t', 'ε'));
  }
  if (r.point) {
    const m = norm(r.point.rF);
    const s = P(vmul(r.point.rF, 0.9 / m));
    out.push(line(O, s, 'fp-guide'), `<circle class="fp-pt" cx="${r1(s[0])}" cy="${r1(s[1])}" r="4"/>`, label(s[0] + 6, s[1] + 14, 'fp-ptn', 'M'));
    const v = norm(r.point.vF);
    if (v > 0) out.push(arrow(s, P(vadd(vmul(r.point.rF, 0.9 / m), vmul(r.point.vF, 0.5 / v))), 'en-v'));
  }
  const rows: [string, string][] = [
    ...r.info.names.map((n, i): [string, string] => [n, `${fmt(r.q[i], 4)} рад, ${n}̇ = ${fmt(r.qd[i], 4)} с⁻¹`]),
    ['ω', `${fmt(r.w, 4)} с⁻¹`],
    ['ε', `${fmt(r.e, 4)} с⁻²`],
  ];
  rows.forEach(([k, v], i) => out.push(`<text class="rt-tick" x="660" y="${50 + i * 24}"><tspan font-weight="600">${esc(k)}</tspan> ${esc(v)}</text>`));
  note(out, `t₁ = ${fmt(pr.t1, 4)} с. Серые — неподвижные оси ξηζ, синие — оси тела xyz; стрелки ω и ε — направления (длина условная).`);
  return wrap(out);
}

export function renderScrew(pr: ScrewProblem, r: ScrewResult) {
  const out = sheet();
  if (!r.ok) {
    out.push(`<text class="tb-note" x="16" y="${H / 2}">Проверьте данные.</text>`);
    return wrap(out);
  }
  const pts: V3[] = [[0, 0, 0], ...pr.items.filter((i) => i.kind === 'rot').map((i): V3 => [i.px, i.py, i.pz]), ...r.points.map((p) => p.r)];
  if (r.axisP) pts.push(r.axisP);
  const span = Math.max(1e-9, ...pts.map(norm));
  const P = axo([330, 280], 150 / span);
  const O = P([0, 0, 0]);
  ['x', 'y', 'z'].forEach((n, i) => {
    const e: V3 = [0, 0, 0];
    e[i] = span * 1.25;
    const t = P(e);
    out.push(arrow(O, t, 'fp-fix'), label(t[0] + 6, t[1] + 4, 'fp-fix-t', n));
  });
  const wmax = Math.max(1e-12, ...pr.items.map((i) => Math.hypot(i.x, i.y, i.z)));
  pr.items.forEach((it, k) => {
    const w: V3 = [it.x, it.y, it.z];
    const len = (0.55 * span * norm(w)) / wmax;
    if (norm(w) === 0) return;
    const d = vmul(w, len / norm(w));
    if (it.kind === 'rot') {
      const a: V3 = [it.px, it.py, it.pz];
      out.push(
        line(P(vsub(a, vmul(d, 0.6))), P(vadd(a, vmul(d, 1.3))), 'fp-axis'),
        arrow(P(a), P(vadd(a, d)), 'fp-w'),
        label(P(vadd(a, d))[0] + 5, P(vadd(a, d))[1] - 5, 'fp-w-t', `ω${k + 1}`),
      );
    } else out.push(arrow(O, P(d), 'en-v'), label(P(d)[0] + 5, P(d)[1] - 5, 'en-v-t', `v${k + 1}`));
  });
  if (r.axisP && norm(r.Om) > 0) {
    const d = vmul(r.Om, span / norm(r.Om));
    out.push(
      line(P(vsub(r.axisP, d)), P(vadd(r.axisP, d)), 'fp-inst'),
      label(P(vadd(r.axisP, d))[0] + 6, P(vadd(r.axisP, d))[1], 'fp-inst-t', r.kind === 'rot' ? 'ось вращения' : 'винтовая ось'),
    );
  }
  for (const p of r.points) {
    const s = P(p.r);
    out.push(`<circle class="fp-pt" cx="${r1(s[0])}" cy="${r1(s[1])}" r="4"/>`, label(s[0] + 6, s[1] + 14, 'fp-ptn', p.name));
  }
  const rows: [string, string][] = [
    ['Ω', `${fmt(norm(r.Om), 4)} с⁻¹`],
    ['v_O', `${fmt(norm(r.vO), 4)} ${LEN[pr.unit]}/с`],
    ['v*', `${fmt(Math.abs(r.vmin), 4)} ${LEN[pr.unit]}/с`],
  ];
  rows.forEach(([k, v], i) => out.push(`<text class="rt-tick" x="680" y="${50 + i * 24}"><tspan font-weight="600">${esc(k)}</tspan> ${esc(v)}</text>`));
  note(
    out,
    r.kind === 'trans'
      ? 'Результирующее движение — поступательное.'
      : r.kind === 'rot'
        ? 'Результирующее движение — вращение вокруг мгновенной оси.'
        : r.kind === 'screw'
          ? 'Результирующее движение — винтовое.'
          : 'Тело неподвижно.',
  );
  return wrap(out);
}
