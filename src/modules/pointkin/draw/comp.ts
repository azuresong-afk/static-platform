/** Чертежи составных задач («comp») и пересчёта координат («conv»). */
import { fmt } from '../../../shared/format';
import { plot } from '../../rotation/draw/rotation';
import type { CompResult, ConvResult } from '../model/comp';

const r1 = (v: number) => Math.round(v * 10) / 10;
const W = 1000,
  H = 480;
type Fig = { svg: string; viewBox: string };
const base = () => [`<rect width="${W}" height="${H}" fill="var(--sheet)"/>`];
const done = (out: string[]): Fig => ({ svg: out.join(''), viewBox: `0 0 ${W} ${H}` });
const note = (out: string[], text: string) => out.push(`<text class="tb-note" x="16" y="${H - 14}">${text}</text>`);
const empty = (text: string): Fig => {
  const out = base();
  out.push(`<text class="tb-note" x="16" y="${H / 2}">${text}</text>`);
  return done(out);
};
const txt = (x: number, y: number, s: string, anchor = 'start') => `<text class="t cv-t" x="${r1(x)}" y="${r1(y)}" text-anchor="${anchor}">${s}</text>`;

export function renderComp(r: CompResult): Fig {
  if (!r.ok) return empty('Проверьте данные задачи.');
  const out = base();
  const o = r.out;
  if (r.kind === 'drops') {
    // Слева — отрыв и положения капель в момент t; справа — расстояние между каплями от времени.
    const top = 60,
      k = 330 / Math.max(o.s1, 1e-9);
    out.push(`<line class="sb-axis" x1="120" y1="${top - 20}" x2="120" y2="${top + 340}"/>`);
    out.push(`<rect class="cg-c" x="108" y="${top - 30}" width="24" height="10"/>`);
    for (const [s, name] of [[o.s1, '1'] as const, [o.s2, '2'] as const]) {
      const y = top + s * k;
      out.push(`<circle class="en-v" cx="120" cy="${r1(y)}" r="8"/>`, txt(136, y + 4, `${name}: s = ${fmt(s, 4)}`));
    }
    out.push(
      `<line class="rt-axis" x1="230" y1="${r1(top + o.s2 * k)}" x2="230" y2="${r1(top + o.s1 * k)}"/>`,
      txt(240, top + ((o.s1 + o.s2) / 2) * k + 4, `d = ${fmt(o.d, 4)}`),
    );
    out.push(plot(470, 60, 480, 330, r.curves[0].pts, 'd', 'ед. длины', 'с'));
    note(out, `Капли отрываются через τ = ${fmt(o.tau, 4)} с; расстояние между ними d = gτ(t − τ/2) растёт со временем.`);
  } else if (r.kind === 'pow') {
    r.curves.forEach((c, i) => out.push(plot(60 + i * 320, 60, 250, 330, c.pts, c.name, c.unit, 'ед. времени')));
    note(out, `s = c·t^${fmt(o.n, 3)}, c = ${fmt(o.c, 6)}; в момент t = ${fmt(o.t, 4)}: v = ${fmt(o.v, 5)}, a = ${fmt(o.a, 5)}.`);
  } else if (r.kind === 'pile') {
    const k = 800 / o.T;
    const y = 220;
    out.push(
      `<rect class="en-v" x="100" y="${y}" width="${r1(o.tf * k)}" height="40" opacity="0.55"/>`,
      `<rect class="cg-c" x="${r1(100 + o.tf * k)}" y="${y}" width="${r1(o.tu * k)}" height="40" opacity="0.55"/>`,
    );
    out.push(
      txt(100 + (o.tf * k) / 2, y - 10, `падение ${fmt(o.tf, 4)} с`, 'middle'),
      txt(100 + o.tf * k + (o.tu * k) / 2, y - 10, `подъём ${fmt(o.tu, 4)} с`, 'middle'),
    );
    out.push(txt(500, y + 100, `цикл T = ${fmt(o.T, 4)} с;  ударов в минуту N = 60/T = ${fmt(o.perMin, 4)}`, 'middle'));
    note(out, `Свободное падение с высоты h = ${fmt(o.h, 4)}: t = √(2h/g); подъём длится в ${fmt(o.k, 3)} раз дольше.`);
  } else if (r.kind === 'arcs') {
    out.push(plot(80, 60, 860, 330, r.curves[0].pts, 'aₙ', r.curves[0].unit, 'с'));
    note(
      out,
      `Нормальное ускорение aₙ = v²/ρ постоянно на каждой дуге и скачком меняется в точках стыка; v = ${fmt(o.v, 4)} ед./с, время прохождения T = ${fmt(o.T, 4)} с.`,
    );
  } else {
    const c = r.curves[0];
    const pts = c.pts;
    const ys = pts.map((p) => p[1]);
    const lo = Math.min(...ys, ...r.roots.map((x) => x.c)),
      hi = Math.max(...ys, ...r.roots.map((x) => x.c));
    const [a, b] = [o.a, o.b];
    const X = (t: number) => 80 + ((t - a) / (b - a || 1)) * 860,
      Y = (v: number) => 400 - ((v - lo) / (hi - lo || 1)) * 340;
    out.push(`<line class="rt-axis" x1="80" y1="${r1(Y(Math.max(lo, Math.min(0, hi))))}" x2="940" y2="${r1(Y(Math.max(lo, Math.min(0, hi))))}"/>`);
    out.push(`<path class="rt-line" fill="none" d="M${pts.map((p) => `${r1(X(p[0]))} ${r1(Y(p[1]))}`).join('L')}"/>`);
    for (const rt of r.roots) {
      out.push(`<line class="sb-axis" x1="80" y1="${r1(Y(rt.c))}" x2="940" y2="${r1(Y(rt.c))}" stroke-dasharray="5 5"/>`, txt(944, Y(rt.c) + 4, fmt(rt.c, 4)));
      for (const t of rt.ts) out.push(`<circle class="cg-c" cx="${r1(X(t))}" cy="${r1(Y(rt.c))}" r="4"/>`);
    }
    out.push(txt(80, 44, `f(t),  t от ${fmt(a, 3)} до ${fmt(b, 3)}`));
    note(out, 'Точки — моменты, когда f(t) принимает заданные значения (пунктир).');
  }
  return done(out);
}

export function renderConv(r: ConvResult): Fig {
  if (!r.ok) return empty('Проверьте формулы.');
  const out = base();
  const third = r.sys === 'sph' ? ['θ', 'рад'] : ['z', 'ед. длины'];
  out.push(plot(60, 60, 250, 330, r.series.r, 'r', 'ед. длины', 'с от t₁'), plot(380, 60, 250, 330, r.series.phi, 'φ', 'рад', 'с от t₁'));
  if (r.sys !== 'polar') out.push(plot(700, 60, 250, 330, r.series.q, third[0], third[1], 'с от t₁'));
  note(
    out,
    `Координаты ${r.sys === 'polar' ? 'r, φ' : r.sys === 'cyl' ? 'r, φ, z' : 'r, φ, θ'} точки по её декартовым уравнениям движения; φ — непрерывный угол.`,
  );
  return done(out);
}
