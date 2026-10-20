import type { V2 } from '../model/cremona';

export const r1 = (v: number) => Math.round(v * 10) / 10;

export function arrow(hx: number, hy: number, ux: number, uy: number, len: number, cls: string): string {
  const tx = hx - ux * len,
    ty = hy - uy * len,
    s = 11,
    w = 4.4,
    bx = hx - ux * s,
    by = hy - uy * s;
  return (
    `<line x1="${r1(tx)}" y1="${r1(ty)}" x2="${r1(bx)}" y2="${r1(by)}" class="${cls}"/>` +
    `<polygon points="${r1(hx)},${r1(hy)} ${r1(bx - uy * w)},${r1(by + ux * w)} ${r1(bx + uy * w)},${r1(by - ux * w)}" class="${cls}-f"/>`
  );
}

export interface Fit {
  S: (p: V2) => [number, number];
  W: number;
  H: number;
  k: number;
}
export function fit(points: V2[], W: number, maxH: number, pad: number): Fit {
  const xs = points.map((p) => p[0]),
    ys = points.map((p) => p[1]);
  const x0 = Math.min(...xs),
    x1 = Math.max(...xs),
    y0 = Math.min(...ys),
    y1 = Math.max(...ys);
  const w = Math.max(x1 - x0, 1e-9),
    h = Math.max(y1 - y0, 1e-9);
  const k = Math.min((W - 2 * pad) / w, (maxH - 2 * pad) / h, 160);
  const H = Math.round(h * k + 2 * pad);
  const ox = pad + (W - 2 * pad - w * k) / 2 - x0 * k,
    oy = pad + h * k + y0 * k;
  return { S: (p) => [ox + p[0] * k, oy - p[1] * k], W, H, k };
}
