/**
 * Эпюры N, Q, M на схеме рамы: каждая — отдельный чертёж с осями стержней. Ординаты откладываются
 * перпендикулярно оси участка: N и Q — «+» вверх у горизонтальных и наклонных участков, влево у вертикальных
 * (со знаками в кружках); M — со стороны растянутых или сжатых волокон, без знаков.
 */
import type { Conventions } from '../../../shared/conventions';
import { fmt } from '../../../shared/format';
import { polyEval } from '../../../shared/poly';
import type { Pt } from '../../frames/model/geometry';
import { canonical, type Bar, type FrameDiag } from '../model/frame';

export type DiagKey = 'N' | 'Q' | 'M';
const CLS: Record<DiagKey, string> = { N: 'u', Q: 'q', M: 'm' };
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const r1 = (v: number) => Math.round(v * 10) / 10;

/** Направление, в котором откладывается положительная ордината на участке (в координатах схемы). */
export function plotDir(b: Bar, key: DiagKey, c: Conventions): Pt {
  if (key === 'M') return c.mSide === 'tension' ? [-b.n[0], -b.n[1]] : [b.n[0], b.n[1]];
  return canonical(b.P0, b.P1) ? b.n : [-b.n[0], -b.n[1]];
}

/** Ширина рамы на чертеже, px: три эпюры в ряд — или одна под другой, если рама широкая и низкая. */
const SPAN = 300,
  SPAN_WIDE = 720;
const AMP = 46;

interface Raw {
  parts: string[];
  /** Габарит нарисованного, px. */
  box: [number, number, number, number];
}

function drawOne(fr: FrameDiag, key: DiagKey, c: Conventions, SPAN: number): Raw {
  const xs = fr.points.map((p) => p.pos[0]),
    ys = fr.points.map((p) => p.pos[1]);
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 1e-9);
  const SC = SPAN / span;
  const X = (x: number) => r1(x * SC);
  const Y = (y: number) => r1(-y * SC);
  const box: Raw['box'] = [Infinity, Infinity, -Infinity, -Infinity];
  const grow = (x: number, y: number, rx = 0, ry = 0) => {
    box[0] = Math.min(box[0], x - rx);
    box[1] = Math.min(box[1], y - ry);
    box[2] = Math.max(box[2], x + rx);
    box[3] = Math.max(box[3], y + ry);
  };
  const scale = key === 'N' ? fr.scaleN : key === 'Q' ? fr.scaleQ : fr.scaleM;
  const k = AMP / Math.max(scale, 1e-12);
  const tol = 1e-9 * Math.max(1, scale);
  const cls = CLS[key];
  const fills: string[] = [],
    lines: string[] = [],
    signs: string[] = [];
  /** Подпись: конец ординаты, направления «внутрь участка» и «от оси»; at — у самого узла (без сдвига внутрь). */
  const labs: { node: string | null; v: number; d: Pt; x0: number; y0: number; ix: number; iy: number; ox: number; oy: number; text: string; at: boolean }[] = [];
  /** Куда отложены ординаты в узле — чтобы поставить букву с другой стороны. */
  const away: Record<string, [number, number]> = {};
  for (const b of fr.bars) {
    const d = plotDir(b, key, c);
    const val = (z: number) => polyEval(b[key], z);
    const at = (z: number): Pt => [b.P0[0] + b.u[0] * z, b.P0[1] + b.u[1] * z];
    const off = (z: number): [number, number] => {
      const p = at(z),
        v = val(z) * k;
      return [r1(X(p[0]) + d[0] * v), r1(Y(p[1]) - d[1] * v)];
    };
    const n = Math.max(2, Math.ceil((b.L * SC) / 6));
    const pts = Array.from({ length: n + 1 }, (_, i) => off((b.L * i) / n));
    pts.forEach(([x, y]) => grow(x, y));
    const A = at(0),
      B = at(b.L);
    fills.push(`<path class="dg-fill dg-${cls}" d="M${X(A[0])} ${Y(A[1])}L${pts.map((q) => q.join(' ')).join('L')}L${X(B[0])} ${Y(B[1])}Z"/>`);
    for (let px = 9; px < b.L * SC; px += 9) {
      const z = px / SC,
        p = at(z),
        q = off(z);
      if (Math.hypot(q[0] - X(p[0]), q[1] - Y(p[1])) > 1.5) fills.push(`<line class="dg-hatch dg-${cls}" x1="${X(p[0])}" y1="${Y(p[1])}" x2="${q[0]}" y2="${q[1]}"/>`);
    }
    lines.push(`<polyline class="dg-line dg-${cls}" points="${pts.map((q) => q.join(',')).join(' ')}"/>`);
    for (const [id, z] of [
      [b.id0, 0],
      [b.id1, b.L],
    ] as const) {
      const s = Math.sign(val(z));
      if (!s) continue;
      const a = (away[id] ||= [0, 0]);
      a[0] += d[0] * s;
      a[1] -= d[1] * s;
    }
    const marks = [0, b.L, ...(key === 'M' ? b.extrema : [])];
    for (const z of marks) {
      const v = val(z);
      if (Math.abs(v) < tol) continue;
      const q = off(z),
        s = Math.sign(v);
      const inward = z < 1e-9 ? 1 : z > b.L - 1e-9 ? -1 : 0;
      const x0 = q[0] + d[0] * s * 14,
        y0 = q[1] - d[1] * s * 14;
      if (key === 'M' && !inward) {
        const p = at(z);
        lines.push(`<line class="dg-ext" x1="${X(p[0])}" y1="${Y(p[1])}" x2="${q[0]}" y2="${q[1]}"/>`);
      }
      labs.push({ node: inward > 0 ? b.id0 : inward < 0 ? b.id1 : null, v, d, x0, y0, ix: b.u[0] * inward, iy: -b.u[1] * inward, ox: d[0] * s, oy: -d[1] * s, text: fmt(key === 'M' ? Math.abs(v) : v, 2), at: false });
    }
    if (key !== 'M') {
      const zm = b.L / 2,
        vm = val(zm);
      if (Math.abs(vm) > 0.12 * scale && b.L * SC > 30) {
        const p = at(zm),
          h = (vm * k) / 2;
        const sx = X(p[0]) + d[0] * h,
          sy = Y(p[1]) - d[1] * h;
        signs.push(`<circle class="fd-sign" cx="${r1(sx)}" cy="${r1(sy)}" r="8"/><text class="dg-sign" x="${r1(sx)}" y="${r1(sy + 5.5)}">${vm > 0 ? '+' : '−'}</text>`);
      }
    }
  }
  // Одинаковое значение в узле с одной стороны (продолжение стержня) — одной подписью у самого узла.
  const shown: typeof labs = [];
  for (const l of labs) {
    const twin = shown.find((o) => o.node && o.node === l.node && Math.abs(o.v - l.v) < tol && Math.abs(o.d[0] - l.d[0]) < 1e-9 && Math.abs(o.d[1] - l.d[1]) < 1e-9);
    if (twin) {
      twin.at = true;
      continue;
    }
    shown.push({ ...l });
  }
  const bars = fr.bars.map((b) => `<line class="fd-bar" x1="${X(b.P0[0])}" y1="${Y(b.P0[1])}" x2="${X(b.P1[0])}" y2="${Y(b.P1[1])}"/>`);
  const boxes: [number, number, number, number][] = [];
  const pts = fr.points.map((p) => {
    const [x, y] = [X(p.pos[0]), Y(p.pos[1])];
    grow(x, y);
    const a = away[p.id] ?? [0, 0];
    const l = Math.hypot(a[0], a[1]);
    const [ux, uy] = l > 1e-9 ? [-a[0] / l, -a[1] / l] : [-0.7, -0.7];
    const tx = x + ux * 15,
      ty = y + uy * 15;
    grow(tx, ty, 8, 10);
    boxes.push([tx - 7, ty - 9, tx + 7, ty + 9]);
    return `${p.hinge ? `<circle class="fd-hinge" cx="${x}" cy="${y}" r="4"/>` : ''}<text class="fd-pt" x="${r1(tx)}" y="${r1(ty + 5)}" text-anchor="middle">${esc(p.name)}</text>`;
  });
  // Подписи: первое положение, не задевающее букв и уже поставленных подписей (дальше внутрь участка, потом дальше от оси).
  const hit = (b: [number, number, number, number]) => boxes.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]);
  const labels = shown.map((l) => {
    const hw = 3 + 3.9 * l.text.length;
    const box = ([x, y]: [number, number]): [number, number, number, number] => [x - hw, y - 8, x + hw, y + 8];
    const cands: [number, number][] = [];
    for (const out of [0, 16, 32]) for (const t of l.at ? [0] : [18, 34, 50, 66]) cands.push([l.x0 + l.ix * t + l.ox * out, l.y0 + l.iy * t + l.oy * out]);
    const [x, y] = cands.find((c) => !hit(box(c))) ?? cands[0];
    boxes.push(box([x, y]));
    grow(x, y, hw, 10);
    return `<text class="dg-val" x="${r1(x)}" y="${r1(y + 5)}" text-anchor="middle">${esc(l.text)}</text>`;
  });
  return { parts: [...fills, ...bars, ...lines, ...signs, ...pts, ...labels], box };
}

/** Три эпюры в одном масштабе и с одинаковой рамкой (чтобы стояли рядом ровно). */
export function renderFrameDiagrams(
  fr: FrameDiag,
  c: Conventions,
  titles: Record<DiagKey, { L: string; S: string; unit: string }>,
): { wide: boolean; dg: Record<DiagKey, { svg: string; viewBox: string }> } {
  const xs = fr.points.map((p) => p.pos[0]),
    ys = fr.points.map((p) => p.pos[1]);
  const wide = Math.max(...xs) - Math.min(...xs) > 1.6 * (Math.max(...ys) - Math.min(...ys));
  const sp = wide ? SPAN_WIDE : SPAN;
  const raw = { N: drawOne(fr, 'N', c, sp), Q: drawOne(fr, 'Q', c, sp), M: drawOne(fr, 'M', c, sp) };
  const all = Object.values(raw).map((r) => r.box);
  const x0 = Math.min(...all.map((b) => b[0])) - 12,
    y0 = Math.min(...all.map((b) => b[1])) - 44,
    x1 = Math.max(...all.map((b) => b[2])) + 12,
    y1 = Math.max(...all.map((b) => b[3])) + 12;
  const vb = `${r1(x0)} ${r1(y0)} ${r1(x1 - x0)} ${r1(y1 - y0)}`;
  const out = {} as Record<DiagKey, { svg: string; viewBox: string }>;
  for (const key of ['N', 'Q', 'M'] as DiagKey[]) {
    const t = titles[key];
    const head = `<text class="dg-name" x="${r1(x0 + 6)}" y="${r1(y0 + 26)}">${esc(t.L)}${t.S ? `<tspan class="dg-sub" dy="5">${esc(t.S)}</tspan><tspan class="dg-sub" dy="-5">${esc(t.unit)}</tspan>` : `<tspan class="dg-sub">${esc(t.unit)}</tspan>`}</text>`;
    out[key] = { svg: head + raw[key].parts.join(''), viewBox: vb };
  }
  return { wide, dg: out };
}
