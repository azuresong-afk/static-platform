/** Примитивы схем для каталога машин: строки SVG в стиле остальных чертежей (цвета — переменные темы). */
const r1 = (v: number) => Math.round(v * 10) / 10;
export type P = [number, number];

export const line = (a: P, b: P, cls = 'mc-body') => `<line class="${cls}" x1="${r1(a[0])}" y1="${r1(a[1])}" x2="${r1(b[0])}" y2="${r1(b[1])}"/>`;
export const circle = (c: P, r: number, cls = 'mc-body', fill = false) =>
  `<circle class="${cls}${fill ? ' mc-fill' : ''}" cx="${r1(c[0])}" cy="${r1(c[1])}" r="${r1(r)}"/>`;
export const rect = (x: number, y: number, w: number, h: number, cls = 'mc-body') =>
  `<rect class="${cls}" x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}"/>`;
export const poly = (pts: P[], cls = 'mc-body', close = true) =>
  `<path class="${cls}" d="M${pts.map((p) => `${r1(p[0])} ${r1(p[1])}`).join('L')}${close ? 'Z' : ''}"/>`;
export const text = (p: P, s: string, anchor: 'start' | 'middle' | 'end' = 'middle', cls = 'mc-t') =>
  `<text class="${cls}" x="${r1(p[0])}" y="${r1(p[1])}" text-anchor="${anchor}">${s.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`;
/** Шарнир. */
export const pin = (c: P) => `<circle class="mc-pin" cx="${r1(c[0])}" cy="${r1(c[1])}" r="4.5"/>`;
/** Штриховка основания: линия y от x0 до x1 и косые штрихи вниз. */
export function ground(x0: number, x1: number, y: number): string {
  const o = [line([x0, y], [x1, y], 'mc-ground')];
  for (let x = x0 + 6; x < x1; x += 12) o.push(line([x, y], [x - 8, y + 9], 'mc-hatch'));
  return o.join('');
}
/** Стрелка силы из a в b (наконечник в b). */
export function arrow(a: P, b: P, cls = 'mc-force'): string {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    L = Math.hypot(dx, dy) || 1,
    ux = dx / L,
    uy = dy / L;
  return `<line class="${cls}" x1="${r1(a[0])}" y1="${r1(a[1])}" x2="${r1(b[0] - ux * 7)}" y2="${r1(b[1] - uy * 7)}"/><path class="${cls}-f" d="M${r1(b[0])} ${r1(b[1])}L${r1(b[0] - ux * 11 - uy * 4.5)} ${r1(b[1] - uy * 11 + ux * 4.5)}L${r1(b[0] - ux * 11 + uy * 4.5)} ${r1(b[1] - uy * 11 - ux * 4.5)}Z"/>`;
}
/** Дуга вращения вокруг c радиусом r от угла a0 до a1 (град., против часовой, ось y экрана вниз) со стрелкой. */
export function turn(c: P, r: number, a0: number, a1: number): string {
  const pt = (a: number): P => [c[0] + r * Math.cos((a * Math.PI) / 180), c[1] - r * Math.sin((a * Math.PI) / 180)];
  const s = pt(a0),
    e = pt(a1);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  const sweep = a1 > a0 ? 0 : 1;
  const tan: P = [-Math.sin((a1 * Math.PI) / 180) * (a1 > a0 ? 1 : -1), -Math.cos((a1 * Math.PI) / 180) * (a1 > a0 ? 1 : -1)];
  return `<path class="mc-force" d="M${r1(s[0])} ${r1(s[1])}A${r} ${r} 0 ${large} ${sweep} ${r1(e[0])} ${r1(e[1])}"/>${arrow([e[0] - tan[0] * 2, e[1] - tan[1] * 2], [e[0] + tan[0] * 6, e[1] + tan[1] * 6])}`;
}
export const svgOf = (w: number, h: number, parts: string[]): { svg: string; viewBox: string } => ({
  svg: `<rect width="${w}" height="${h}" fill="var(--sheet)"/>${parts.join('')}`,
  viewBox: `0 0 ${w} ${h}`,
});
