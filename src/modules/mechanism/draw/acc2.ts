/** Чертёж: точки тела, векторы ускорений и мгновенный центр ускорений. */
import { fmt } from '../../../shared/format';
import type { Acc2Result } from '../model/acc2';

const r1 = (x: number) => Math.round(x * 10) / 10;
const W = 1000,
  H = 520;

export function renderAcc2(r: Acc2Result): { svg: string; viewBox: string } {
  const out = [`<rect width="${W}" height="${H}" fill="var(--sheet)"/>`];
  if (!r.ok) {
    out.push(`<text class="tb-note" x="16" y="${H / 2}">Проверьте координаты точек и ускорения.</text>`);
    return { svg: out.join(''), viewBox: `0 0 ${W} ${H}` };
  }
  const pts = r.pts.map((p) => p.pos);
  const xs = [...pts.map((p) => p[0]), ...(r.ica ? [r.ica[0]] : [])],
    ys = [...pts.map((p) => p[1]), ...(r.ica ? [r.ica[1]] : [])];
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 1e-9);
  const amax = Math.max(...r.pts.map((p) => p.mag), 1e-12);
  // Векторы ускорений — длиной до четверти поля, в одном масштабе.
  const ka = (0.24 * span) / amax;
  const all: [number, number][] = [...pts, ...r.pts.map((p): [number, number] => [p.pos[0] + p.acc[0] * ka, p.pos[1] + p.acc[1] * ka])];
  if (r.ica) all.push(r.ica);
  const ax = all.map((p) => p[0]),
    ay = all.map((p) => p[1]);
  const x0 = Math.min(...ax),
    x1 = Math.max(...ax),
    y0 = Math.min(...ay),
    y1 = Math.max(...ay);
  const k = Math.min((W - 220) / Math.max(x1 - x0, 1e-9), (H - 150) / Math.max(y1 - y0, 1e-9));
  const ox = (W - (x1 - x0) * k) / 2,
    oy = (H + (y1 - y0) * k) / 2 - 10;
  const S = (p: [number, number]): [number, number] => [ox + (p[0] - x0) * k, oy - (p[1] - y0) * k];
  // Тело: ломаная по точкам (замкнутая при трёх и более).
  const body = pts.map(S);
  out.push(`<path class="rt-line" fill="${pts.length > 2 ? 'var(--accent-soft, rgba(80,120,200,0.08))' : 'none'}" d="M${body.map((p) => `${r1(p[0])} ${r1(p[1])}`).join('L')}${pts.length > 2 ? 'Z' : ''}"/>`);
  const arrow = (from: [number, number], to: [number, number], cls: string) => {
    const [a, c] = [S(from), S(to)];
    const dx = c[0] - a[0],
      dy = c[1] - a[1];
    const len = Math.hypot(dx, dy);
    if (len < 1) return '';
    const ux = dx / len,
      uy = dy / len;
    const hx = c[0] - ux * 11,
      hy = c[1] - uy * 11;
    return `<line class="${cls}" x1="${r1(a[0])}" y1="${r1(a[1])}" x2="${r1(c[0])}" y2="${r1(c[1])}" stroke-width="2.4"/><path class="${cls}" fill="currentColor" d="M${r1(c[0])} ${r1(c[1])}L${r1(hx - uy * 5)} ${r1(hy + ux * 5)}L${r1(hx + uy * 5)} ${r1(hy - ux * 5)}Z"/>`;
  };
  for (const p of r.pts) {
    const q = S(p.pos);
    out.push(arrow(p.pos, [p.pos[0] + p.acc[0] * ka, p.pos[1] + p.acc[1] * ka], p.given ? 'en-v' : 'cv-r'));
    out.push(`<circle class="cg-c" cx="${r1(q[0])}" cy="${r1(q[1])}" r="5"/><text class="t cv-t" x="${r1(q[0] - 14)}" y="${r1(q[1] + 18)}">${p.name}</text>`);
    const e = S([p.pos[0] + p.acc[0] * ka, p.pos[1] + p.acc[1] * ka]);
    if (p.mag > 1e-12) out.push(`<text class="t cv-t" x="${r1(e[0] + 8)}" y="${r1(e[1] - 6)}">a${p.name} = ${fmt(p.mag, 4)}</text>`);
  }
  if (r.ica) {
    const q = S(r.ica);
    out.push(`<circle class="en-v" cx="${r1(q[0])}" cy="${r1(q[1])}" r="6" fill="none"/><text class="t cv-t" x="${r1(q[0] + 10)}" y="${r1(q[1] + 18)}">Q (МЦУ)</text>`);
  }
  out.push(`<text class="tb-note" x="16" y="${H - 14}">Синие стрелки — заданные ускорения, красные — найденные (в одном масштабе); ω = ${fmt(r.w, 4)} с⁻¹, ε = ${fmt(r.eps, 4)} с⁻².</text>`);
  return { svg: out.join(''), viewBox: `0 0 ${W} ${H}` };
}
