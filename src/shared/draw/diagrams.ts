/**
 * Эпюры по участкам — общая отрисовка для всех разделов (изгиб: Q и M; растяжение: N, σ, ε, Δ).
 * Каждая эпюра — полоса с базовой линией, участки — многочлены от координаты участка. Штриховка
 * перпендикулярно оси, знаки на участках, значения на концах участков и в экстремумах.
 */
import { fmt } from '../format';
import { polyEval, type Poly } from '../poly';

export interface DiagramPiece {
  /** Координаты концов участка (в единицах чертежа, например м). */
  x0: number;
  x1: number;
  /** Значение как многочлен от расстояния от начала участка. */
  poly: Poly;
  /** Точки внутри участка (от начала), где подписать значение: экстремумы. */
  marks?: number[];
}

export interface DiagramBand {
  /** Название эпюры: буква, индекс и приписка (например, «·10⁴»). */
  name: { L: string; S: string; suffix?: string };
  /** Класс цвета: q, m, n, s, e, u. */
  cls: string;
  pieces: DiagramPiece[];
  /** 1 — «+» вверх, −1 — «+» вниз. */
  up: 1 | -1;
  /** Подпись значения. */
  label?: (v: number) => string;
}

const BAND = 190;
const AMP = 64;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const r1 = (v: number) => Math.round(v * 10) / 10;

/**
 * X — перевод координаты в пиксели по горизонтали (тот же масштаб, что у схемы над эпюрами),
 * width — ширина чертежа в пикселях.
 */
export function renderBands(bands: DiagramBand[], X: (x: number) => number, width: number): { svg: string; viewBox: string } {
  const out: string[] = [];
  const H = bands.length * (BAND + 8);
  const all = bands.flatMap((b) => b.pieces);
  const lo = Math.min(...all.map((p) => p.x0)),
    hi = Math.max(...all.map((p) => p.x1));
  const xs = [...new Set(all.flatMap((p) => [p.x0, p.x1]))];
  for (const x of xs) out.push(`<line class="dg-guide" x1="${X(x)}" y1="0" x2="${X(x)}" y2="${H}"/>`);

  bands.forEach((band, bi) => {
    const top = bi * (BAND + 8);
    const y0 = top + BAND / 2 + 4;
    const scale = Math.max(1e-300, ...band.pieces.flatMap((p) => [0, p.x1 - p.x0, ...(p.marks ?? [])].map((z) => Math.abs(polyEval(p.poly, z)))));
    const Y = (v: number) => r1(y0 - (band.up * v * AMP) / scale);
    const lab = band.label ?? ((v: number) => fmt(v, 2));
    const cls = band.cls;
    out.push(
      `<text class="dg-name" x="${r1(X(lo) - 16)}" y="${y0 + 6}" text-anchor="end">${esc(band.name.L)}${band.name.S ? `<tspan class="dg-sub" dy="5">${esc(band.name.S)}</tspan>` : ''}${band.name.suffix ? `<tspan class="dg-sub" dy="${band.name.S ? -5 : 0}">${esc(band.name.suffix)}</tspan>` : ''}</text>`,
      `<line class="dg-base" x1="${r1(X(lo) - 12)}" y1="${y0}" x2="${r1(X(hi) + 12)}" y2="${y0}"/>`,
    );
    const labels: { x: number; y: number; v: number; anchor: 'start' | 'middle' | 'end'; below: boolean }[] = [];
    for (const pc of band.pieces) {
      const L = pc.x1 - pc.x0;
      const x0 = X(pc.x0),
        x1 = X(pc.x1);
      const n = Math.max(2, Math.ceil((x1 - x0) / 6));
      const pts: [number, number][] = [];
      for (let i = 0; i <= n; i++) {
        const z = (L * i) / n;
        pts.push([X(pc.x0 + z), Y(polyEval(pc.poly, z))]);
      }
      out.push(`<path class="dg-fill dg-${cls}" d="M${x0} ${y0}L${pts.map((q) => q.join(' ')).join('L')}L${x1} ${y0}Z"/>`);
      const step = 9;
      for (let hx = Math.ceil(x0 / step) * step; hx < x1; hx += step) {
        const hy = Y(polyEval(pc.poly, ((hx - x0) / (x1 - x0)) * L));
        if (Math.abs(hy - y0) > 1.5) out.push(`<line class="dg-hatch dg-${cls}" x1="${hx}" y1="${y0}" x2="${hx}" y2="${hy}"/>`);
      }
      out.push(`<polyline class="dg-line dg-${cls}" points="${pts.map((q) => q.join(',')).join(' ')}"/>`);
      const vm = polyEval(pc.poly, L / 2);
      if (Math.abs(vm) > 0.08 * scale && x1 - x0 > 26) out.push(`<text class="dg-sign" x="${r1((x0 + x1) / 2)}" y="${r1((y0 + Y(vm)) / 2 + 5)}">${vm > 0 ? '+' : '−'}</text>`);
      const v0 = polyEval(pc.poly, 0),
        vL = polyEval(pc.poly, L);
      labels.push({ x: x0, y: Y(v0), v: v0, anchor: 'start', below: band.up * v0 < 0 });
      labels.push({ x: x1, y: Y(vL), v: vL, anchor: 'end', below: band.up * vL < 0 });
      for (const ze of pc.marks ?? []) {
        const ve = polyEval(pc.poly, ze),
          xe = X(pc.x0 + ze);
        out.push(`<line class="dg-ext" x1="${xe}" y1="${y0}" x2="${xe}" y2="${Y(ve)}"/>`);
        labels.push({ x: xe, y: Y(ve), v: ve, anchor: 'middle', below: band.up * ve < 0 });
      }
    }
    // Одинаковые значения в общей точке — одной подписью; нули не подписываем.
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
      out.push(`<text class="dg-val" x="${r1(lb.x + dx)}" y="${r1(lb.below ? lb.y + 16 : lb.y - 6)}" text-anchor="${lb.anchor}">${esc(lab(lb.v))}</text>`);
    }
  });
  return { svg: out.join(''), viewBox: `0 0 ${width} ${H}` };
}
