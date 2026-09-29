/** Эскизы подобранных сечений в одном масштабе: прямоугольник, круг, двутавр. Чистая функция → SVG. */
import { fmt } from '../../../shared/format';
import type { Design } from '../model/design';

const r1 = (v: number) => Math.round(v * 10) / 10;
const mm = (cm: number) => fmt(cm * 10, 1);

export function renderSketch(d: Design): { svg: string; viewBox: string } {
  const W = 1000,
    H = 335,
    maxPx = 190,
    top = 40;
  const ib = d.ibeam?.p;
  const tallest = Math.max(d.rect.h, d.circle.d, ib ? ib.h / 10 : 0);
  const k = maxPx / tallest; // пикселей на сантиметр
  const cx = [180, 500, 820];
  const base = top + maxPx; // нижняя линия эскизов
  const out: string[] = [];
  const cls = (key: Design['best']) => `sk-shape${d.best === key ? ' sk-best' : ''}`;
  const caption = (x: number, lines: string[]) => lines.map((t, i) => `<text class="sk-cap${i ? ' sk-cap2' : ''}" x="${x}" y="${base + 30 + i * 20}">${t}</text>`).join('');

  // Прямоугольник.
  {
    const w = d.rect.b * k,
      h = d.rect.h * k,
      x = cx[0] - w / 2,
      y = base - h;
    out.push(`<rect class="${cls('rect')}" x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}"/>`);
    out.push(`<line class="sk-axis" x1="${r1(x - 14)}" y1="${r1(y + h / 2)}" x2="${r1(x + w + 14)}" y2="${r1(y + h / 2)}"/>`);
    out.push(`<text class="sk-dim" x="${r1(x + w + 8)}" y="${r1(y + h / 2 - 8)}">h = ${mm(d.rect.h)}</text>`);
    out.push(`<text class="sk-dim" x="${r1(cx[0])}" y="${r1(y - 8)}" text-anchor="middle">b = ${mm(d.rect.b)}</text>`);
    out.push(caption(cx[0], ['Прямоугольник', `A = ${fmt(d.rect.A, 2)} см²`]));
  }
  // Круг.
  {
    const rr = (d.circle.d * k) / 2,
      y = base - rr;
    out.push(`<circle class="${cls('circle')}" cx="${cx[1]}" cy="${r1(y)}" r="${r1(rr)}"/>`);
    out.push(`<line class="sk-axis" x1="${r1(cx[1] - rr - 14)}" y1="${r1(y)}" x2="${r1(cx[1] + rr + 14)}" y2="${r1(y)}"/>`);
    out.push(`<text class="sk-dim" x="${cx[1]}" y="${r1(y - rr - 8)}" text-anchor="middle">d = ${mm(d.circle.d)}</text>`);
    out.push(caption(cx[1], ['Круг', `A = ${fmt(d.circle.A, 2)} см²`]));
  }
  // Двутавр (без скруглений).
  if (ib) {
    const h = (ib.h / 10) * k,
      b = (ib.b / 10) * k,
      s = Math.max(1.5, (ib.s / 10) * k),
      t = Math.max(1.5, (ib.t / 10) * k);
    const x0 = cx[2] - b / 2,
      y0 = base - h;
    const pts = [
      [x0, y0],
      [x0 + b, y0],
      [x0 + b, y0 + t],
      [cx[2] + s / 2, y0 + t],
      [cx[2] + s / 2, base - t],
      [x0 + b, base - t],
      [x0 + b, base],
      [x0, base],
      [x0, base - t],
      [cx[2] - s / 2, base - t],
      [cx[2] - s / 2, y0 + t],
      [x0, y0 + t],
    ];
    out.push(`<path class="${cls('ibeam')}" d="M${pts.map((p) => `${r1(p[0])} ${r1(p[1])}`).join('L')}Z"/>`);
    out.push(`<line class="sk-axis" x1="${r1(x0 - 14)}" y1="${r1(base - h / 2)}" x2="${r1(x0 + b + 14)}" y2="${r1(base - h / 2)}"/>`);
    out.push(`<text class="sk-dim" x="${r1(x0 + b + 8)}" y="${r1(base - h / 2 - 8)}">h = ${fmt(ib.h, 0)}</text>`);
    out.push(`<text class="sk-dim" x="${cx[2]}" y="${r1(y0 - 8)}" text-anchor="middle">b = ${fmt(ib.b, 0)}</text>`);
    out.push(caption(cx[2], [`Двутавр №${ib.no}`, `A = ${fmt(ib.A, 1)} см²`]));
  } else out.push(`<text class="sk-cap" x="${cx[2]}" y="${base - 80}">Двутавра нет</text>`, caption(cx[2], ['в ГОСТ 8239-89', 'нет подходящего номера']));
  out.push(`<text class="sk-note" x="20" y="${H - 8}">Размеры — мм, в одном масштабе. Выделено самое лёгкое сечение.</text>`);
  return { svg: out.join(''), viewBox: `0 0 ${W} ${H}` };
}
