/**
 * Эпюры Q и M под балкой. Горизонтальный масштаб — тот же, что у расчётной схемы (Layout из «Балок и рам»),
 * поэтому точки эпюр стоят точно под точками балки. Чистая функция: возвращает разметку SVG.
 */
import { forceNames, type Conventions } from '../../../shared/conventions';
import { fmt } from '../../../shared/format';
import { polyEval, type Poly } from '../../../shared/poly';
import type { Layout } from '../../frames/draw/drawing';
import type { Beam } from '../model/beam';

export interface DiagramsSVG {
  svg: string;
  viewBox: string;
}

const BAND = 190;
const AMP = 64;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const r1 = (v: number) => Math.round(v * 10) / 10;

export function renderDiagrams(beam: Beam, L: Layout, c: Conventions): DiagramsSVG {
  const names = forceNames(c);
  const X = (x: number) => r1(L.OX + x * L.SC);
  const out: string[] = [];
  const H = BAND * 2 + 16;

  // Вертикальные линии через границы участков.
  const xs = [...new Set(beam.spans.flatMap((sp) => [sp.x0, sp.x1]))];
  for (const x of xs) out.push(`<line class="dg-guide" x1="${X(x)}" y1="0" x2="${X(x)}" y2="${H}"/>`);

  const band = (top: number, key: 'Q' | 'M', name: { L: string; S: string }, up: number, scale: number) => {
    const y0 = top + BAND / 2 + 4;
    const Y = (v: number) => r1(y0 - (up * v * AMP) / scale);
    const cls = key === 'Q' ? 'q' : 'm';
    // Название эпюры и ось.
    out.push(
      `<text class="dg-name" x="${r1(X(0) - 44)}" y="${y0 + 6}">${esc(name.L)}${name.S ? `<tspan class="dg-sub" dy="5">${esc(name.S)}</tspan>` : ''}</text>`,
      `<line class="dg-base" x1="${r1(X(0) - 12)}" y1="${y0}" x2="${r1(X(beam.L) + 12)}" y2="${y0}"/>`,
    );
    const labels: { x: number; y: number; v: number; anchor: 'start' | 'middle' | 'end'; below: boolean }[] = [];
    for (const sp of beam.spans) {
      const p: Poly = sp[key];
      const n = Math.max(2, Math.ceil((sp.L * L.SC) / 6));
      const pts: [number, number][] = [];
      for (let i = 0; i <= n; i++) {
        const z = (sp.L * i) / n;
        pts.push([X(sp.x0 + z), Y(polyEval(p, z))]);
      }
      const x0 = X(sp.x0),
        x1 = X(sp.x1);
      out.push(`<path class="dg-fill dg-${cls}" d="M${x0} ${y0}L${pts.map((q) => q.join(' ')).join('L')}L${x1} ${y0}Z"/>`);
      // Штриховка перпендикулярно оси, как в учебнике.
      const step = 9;
      for (let hx = Math.ceil(x0 / step) * step; hx < x1; hx += step) {
        const hv = polyEval(p, (hx - L.OX) / L.SC - sp.x0);
        const hy = Y(hv);
        if (Math.abs(hy - y0) > 1.5) out.push(`<line class="dg-hatch dg-${cls}" x1="${hx}" y1="${y0}" x2="${hx}" y2="${hy}"/>`);
      }
      out.push(`<polyline class="dg-line dg-${cls}" points="${pts.map((q) => q.join(',')).join(' ')}"/>`);
      // Знак на участке.
      const vm = polyEval(p, sp.L / 2);
      if (Math.abs(vm) > 0.08 * scale && x1 - x0 > 26)
        out.push(`<text class="dg-sign" x="${r1((x0 + x1) / 2)}" y="${r1((y0 + Y(vm)) / 2 + 5)}">${vm > 0 ? '+' : '−'}</text>`);
      const v0 = polyEval(p, 0),
        vL = polyEval(p, sp.L);
      labels.push({ x: x0, y: Y(v0), v: v0, anchor: 'start', below: up * v0 < 0 });
      labels.push({ x: x1, y: Y(vL), v: vL, anchor: 'end', below: up * vL < 0 });
      if (key === 'M')
        for (const ze of sp.extrema) {
          const ve = polyEval(p, ze),
            xe = X(sp.x0 + ze);
          out.push(`<line class="dg-ext" x1="${xe}" y1="${y0}" x2="${xe}" y2="${Y(ve)}"/>`);
          labels.push({ x: xe, y: Y(ve), v: ve, anchor: 'middle', below: up * ve < 0 });
        }
    }
    // Подписи значений: одинаковые значения в общей точке — одной подписью; нули не подписываем.
    const tol = 1e-9 * scale;
    const shown: typeof labels = [];
    for (const lb of labels) {
      if (Math.abs(lb.v) < tol) continue;
      const same = shown.find((s) => Math.abs(s.x - lb.x) < 0.5 && Math.abs(s.v - lb.v) < tol);
      if (same) {
        same.anchor = 'middle';
        continue;
      }
      shown.push({ ...lb });
    }
    for (const lb of shown) {
      const dx = lb.anchor === 'start' ? 4 : lb.anchor === 'end' ? -4 : 0;
      out.push(`<text class="dg-val" x="${r1(lb.x + dx)}" y="${r1(lb.below ? lb.y + 16 : lb.y - 6)}" text-anchor="${lb.anchor}">${esc(fmt(lb.v, 2))}</text>`);
    }
  };
  band(0, 'Q', names.Q, 1, beam.scaleQ);
  band(BAND + 8, 'M', names.M, c.mSide === 'compressed' ? 1 : -1, beam.scaleM);
  return { svg: out.join(''), viewBox: `0 0 ${L.W} ${H}` };
}
