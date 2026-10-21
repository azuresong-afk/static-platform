/** Чертежи: графики v(t), x(t), m(t) тела переменной массы; ступени ракеты — скорость после каждой ступени и веса. */
import { fmt } from '../../../shared/format';
import { plot } from '../../rotation/draw/rotation';
import type { LineResult, StagesProblem, StagesResult, VarLine } from '../model/varmass';

const r1 = (v: number) => Math.round(v * 10) / 10;
const W = 1000,
  H = 480;
const wrap = (out: string[]) => ({ svg: out.join(''), viewBox: `0 0 ${W} ${H}` });

export function renderLine(pr: VarLine, r: LineResult) {
  const out = [`<rect width="${W}" height="${H}" fill="var(--sheet)"/>`];
  if (!r.ok || r.curve.length < 2) {
    out.push(`<text class="tb-note" x="16" y="${H / 2}">${r.ok ? 'Тело не движется.' : 'Проверьте данные.'}</text>`);
    return wrap(out);
  }
  const c = r.curve;
  out.push(
    plot(
      70,
      50,
      250,
      340,
      c.map((p) => [p.t, p.v]),
      'v',
      'м/с',
      'с',
    ),
  );
  out.push(
    plot(
      400,
      50,
      250,
      340,
      c.map((p) => [p.t, p.x]),
      'x',
      'м',
      'с',
    ),
  );
  out.push(
    plot(
      730,
      50,
      230,
      340,
      c.map((p) => [p.t, p.m]),
      'm',
      pr.massMode === 'accel' ? 'отн. ед.' : 'ед.',
      'с',
    ),
  );
  const tail = r.coast ? `; активный участок до t = ${fmt(r.end!.t, 4)} с, затем движение с постоянной массой` : '';
  out.push(`<text class="tb-note" x="16" y="${H - 14}">Ось x — под углом ${fmt(pr.alpha, 4)}° к горизонту${tail}.</text>`);
  return wrap(out);
}

export function renderStages(pr: StagesProblem, r: StagesResult) {
  const out = [`<rect width="${W}" height="${H}" fill="var(--sheet)"/>`];
  if (!r.ok) {
    out.push(`<text class="tb-note" x="16" y="${H / 2}">Проверьте данные.</text>`);
    return wrap(out);
  }
  const n = r.stages.length;
  // Ракета: субракеты — прямоугольники, высота ∝ ln веса (или z), снизу — первая ступень.
  const x0 = 120,
    w = 120,
    top = 50,
    bot = 420;
  const sizes = r.stages.map((s) => (s.G != null ? Math.log(s.G / pr.q) : Math.log(s.z)));
  const tot = sizes.reduce((a, b) => a + b, 0) + (r.G1 != null ? 0.6 : 0);
  const k = (bot - top) / Math.max(tot, 1e-9);
  let y = bot;
  r.stages.forEach((s, i) => {
    const h = sizes[i] * k;
    out.push(`<rect class="mc-plate" x="${x0}" y="${r1(y - h)}" width="${w}" height="${r1(h)}"/>`);
    out.push(`<text class="t cv-t" x="${x0 + w / 2}" y="${r1(y - h / 2 + 6)}" text-anchor="middle">${i + 1}</text>`);
    const lbl = s.G != null ? `G${i + 1} = ${fmt(s.G, 4)}; P = ${fmt(s.P!, 4)}, Q = ${fmt(s.Q!, 4)}` : `z${i + 1} = ${fmt(s.z, 4)}`;
    out.push(`<text class="rt-val cv-t" x="${x0 + w + 14}" y="${r1(y - h / 2 + 5)}">${lbl}</text>`);
    y -= h;
  });
  if (r.G1 != null) {
    const h = 0.6 * k;
    out.push(
      `<path class="cg-mass" d="M${x0} ${r1(y)}L${x0 + w / 2} ${r1(y - h)}L${x0 + w} ${r1(y)}Z"/><text class="rt-val cv-t" x="${x0 + w + 14}" y="${r1(y - h / 2 + 5)}">полезный груз q = ${fmt(pr.q, 4)}</text>`,
    );
  }
  // Скорость после ступеней — столбцы.
  const bx = 640,
    bw = 300;
  const vMax = Math.max(1e-9, r.vEnd);
  const cw = Math.min(70, bw / n - 16);
  r.stages.forEach((s, i) => {
    const h = (s.v / vMax) * (bot - top - 40);
    const x = bx + i * (bw / n) + (bw / n - cw) / 2;
    out.push(`<rect class="cg-fill" x="${r1(x)}" y="${r1(bot - h)}" width="${r1(cw)}" height="${r1(h)}"/>`);
    out.push(`<text class="rt-val cv-t" x="${r1(x + cw / 2)}" y="${r1(bot - h - 8)}" text-anchor="middle">${fmt(s.v, 4)}</text>`);
    out.push(`<text class="rt-tick" x="${r1(x + cw / 2)}" y="${bot + 18}" text-anchor="middle">${i + 1}</text>`);
  });
  out.push(
    `<line class="rt-axis" x1="${bx}" y1="${bot}" x2="${bx + bw}" y2="${bot}"/><text class="rt-title" x="${bx}" y="${top - 14}">скорость после ступени, м/с</text>`,
  );
  out.push(
    `<text class="tb-note" x="16" y="${H - 14}">Высота субракеты на схеме — ${r.G1 != null ? 'ln(G_k/q)' : 'ln z'}; вне поля тяготения и атмосферы.</text>`,
  );
  return wrap(out);
}
