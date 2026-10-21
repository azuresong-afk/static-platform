/** Чертежи задач «сложение скоростей с условием». */
import { fmt } from '../../../shared/format';
import type { CondProblem, CondResult } from '../model/cond';

const r1 = (x: number) => Math.round(x * 10) / 10;
const W = 1000,
  H = 480;
type P2 = [number, number];
const base = () => [`<rect width="${W}" height="${H}" fill="var(--sheet)"/>`];
const done = (out: string[]) => ({ svg: out.join(''), viewBox: `0 0 ${W} ${H}` });
const note = (out: string[], t: string) => out.push(`<text class="tb-note" x="16" y="${H - 14}">${t}</text>`);
const txt = (p: P2, s: string, dx = 8, dy = -8) => `<text class="t cv-t" x="${r1(p[0] + dx)}" y="${r1(p[1] + dy)}">${s}</text>`;
const dot = (p: P2, cls = 'cg-c', r = 5) => `<circle class="${cls}" cx="${r1(p[0])}" cy="${r1(p[1])}" r="${r}"/>`;
const seg = (a: P2, c: P2, cls = 'rt-line', extra = '') =>
  `<line class="${cls}" x1="${r1(a[0])}" y1="${r1(a[1])}" x2="${r1(c[0])}" y2="${r1(c[1])}" ${extra}/>`;
const arrow = (a: P2, c: P2, cls = 'en-v') => {
  const dx = c[0] - a[0],
    dy = c[1] - a[1],
    len = Math.hypot(dx, dy);
  if (len < 2) return '';
  const ux = dx / len,
    uy = dy / len,
    hx = c[0] - ux * 11,
    hy = c[1] - uy * 11;
  return `${seg(a, c, cls, 'stroke-width="2.4"')}<path class="${cls}" fill="currentColor" d="M${r1(c[0])} ${r1(c[1])}L${r1(hx - uy * 5)} ${r1(hy + ux * 5)}L${r1(hx + uy * 5)} ${r1(hy - ux * 5)}Z"/>`;
};
/** Отображение области в прямоугольник чертежа в одном масштабе (y вверх). */
function frame(pts: P2[], x0: number, y0: number, w: number, h: number) {
  const xs = pts.map((p) => p[0]),
    ys = pts.map((p) => p[1]);
  const a = Math.min(...xs),
    b = Math.max(...xs),
    c = Math.min(...ys),
    d = Math.max(...ys);
  const k = Math.min(w / Math.max(b - a, 1e-9), h / Math.max(d - c, 1e-9));
  const ox = x0 + (w - (b - a) * k) / 2,
    oy = y0 + h - (h - (d - c) * k) / 2;
  return { k, S: (p: P2): P2 => [ox + (p[0] - a) * k, oy - (p[1] - c) * k] };
}

export function renderCond(pr: CondProblem, r: CondResult): { svg: string; viewBox: string } {
  const out = base();
  if (!r.ok) {
    out.push(`<text class="tb-note" x="16" y="${H / 2}">Проверьте данные задачи.</text>`);
    return done(out);
  }
  const o = r.out;
  if (r.kind === 'flag') {
    // Самолёт — в начале координат на высоте h; корабль — на уровне моря; вымпел падает по параболе.
    const x1 = Math.max(o.drop, o.l, 1e-9);
    const { S } = frame(
      [
        [0, 0],
        [x1 * 1.15, o.h * 1.1],
        [Math.min(0, o.l) * 1.1, 0],
      ],
      60,
      50,
      880,
      340,
    );
    const plane = S([0, o.h]);
    const ship = S([o.l, 0]);
    const curve: P2[] = Array.from({ length: 61 }, (_, i) => S([(o.drop * i) / 60, o.h * (1 - (i / 60) ** 2)]));
    out.push(seg(S([Math.min(0, o.l) * 1.1, 0]), S([x1 * 1.15, 0]), 'sb-axis'));
    out.push(`<path class="rt-line" fill="none" stroke-dasharray="6 5" d="M${curve.map((q) => `${r1(q[0])} ${r1(q[1])}`).join('L')}"/>`);
    out.push(dot(plane, 'cg-c', 7), txt(plane, 'самолёт', 10, -10), arrow(plane, [plane[0] + 70, plane[1]]), txt([plane[0] + 70, plane[1]], 'v₁', 6, -6));
    const dirS = o.opp === 1 ? -1 : 1;
    out.push(
      `<rect class="en-v" x="${r1(ship[0] - 22)}" y="${r1(ship[1] - 12)}" width="44" height="12" opacity="0.6"/>`,
      txt(ship, 'корабль', -22, 22),
      arrow([ship[0], ship[1] - 20], [ship[0] + dirS * 50, ship[1] - 20], 'cv-r'),
      txt([ship[0] + dirS * 50, ship[1] - 20], 'v', 4, -6),
    );
    out.push(seg(plane, [plane[0], S([0, 0])[1]], 'sb-axis', 'stroke-dasharray="3 4"'));
    out.push(
      `<line class="rt-axis" x1="${r1(plane[0])}" y1="${r1(S([0, 0])[1] + 28)}" x2="${r1(ship[0])}" y2="${r1(S([0, 0])[1] + 28)}"/>`,
      txt([(plane[0] + ship[0]) / 2, S([0, 0])[1] + 28], `l = ${fmt(o.l, 4)}`, -30, 18),
    );
    note(out, `Вымпел падает T = ${fmt(o.T, 4)} с и пролетает по горизонтали ${fmt(o.drop, 4)}; l — расстояние между самолётом и кораблём в момент сброса.`);
  } else if (r.kind === 'meet') {
    const [B, M] = r.pts;
    const A: P2 = [0, 0];
    const { S } = frame([A, B, M, [0, M[1] * 1.1]], 120, 40, 760, 380);
    out.push(seg(S(A), S(B), 'sb-axis', 'stroke-dasharray="6 5"'), seg(S(A), S(M), 'rt-line'), seg(S(B), S(M), 'rt-line'));
    out.push(arrow(S(A), [S(A)[0], S(A)[1] - 60], 'cv-r'), txt([S(A)[0], S(A)[1] - 60], 'v₀', 8, 4));
    out.push(dot(S(A)), txt(S(A), 'A', -18, 18), dot(S(B)), txt(S(B), 'B', 10, -6), dot(S(M), 'en-v', 6), txt(S(M), `M — встреча, T = ${fmt(o.T, 4)}`, 10, -8));
    out.push(txt(S(B), `катер: v₁, β = ${fmt(o.beta, 3)}° к BA`, 10, 22));
    note(out, 'Корабль идёт от A вверх со скоростью v₀; катер выходит из B и встречает корабль в M (треугольник ABM).');
  } else if (r.kind === 'wind') {
    const gmax = Math.max(o.g1, o.g2, o.v + o.V, 1e-9);
    const k = 800 / gmax;
    const bar = (y: number, len: number, label: string, cls: string) => {
      out.push(`<rect class="${cls}" x="100" y="${y}" width="${r1(len * k)}" height="34" opacity="0.55"/>`, txt([100 + len * k, y + 22], label, 10, 0));
    };
    bar(90, o.g1, `по ветру: l/t₁ = v + V = ${fmt(o.g1, 4)}`, 'en-v');
    bar(170, o.g2, `против ветра: l/t₂ = v − V = ${fmt(o.g2, 4)}`, 'cv-r');
    bar(270, o.v, `v = ${fmt(o.v, 4)} (собственная)`, 'cg-c');
    bar(330, o.V, `V = ${fmt(o.V, 4)} (ветер)`, 'sb-axis');
    note(out, 'Путевые скорости по ветру и против него; их полусумма — собственная скорость самолёта, полуразность — скорость ветра.');
  } else if (r.kind === 'poly') {
    const [p1, p2, p3, Wd] = r.pts;
    const M: P2 = [0, 0];
    const rad = o.v;
    const { S, k } = frame([M, p1, p2, p3, [Wd[0] - rad, Wd[1] - rad], [Wd[0] + rad, Wd[1] + rad]], 160, 30, 680, 400);
    out.push(`<circle class="rt-line" fill="none" cx="${r1(S(Wd)[0])}" cy="${r1(S(Wd)[1])}" r="${r1(rad * k)}"/>`);
    const names = ['BC', 'CA', 'AB'];
    [p1, p2, p3].forEach((q, i) => out.push(arrow(S(M), S(q), 'en-v'), dot(S(q), 'cg-c', 4), txt(S(q), `l/t ∥ ${names[i]}`, 8, -8)));
    out.push(
      arrow(S(M), S(Wd), 'cv-r'),
      dot(S(M), 'cg-c', 5),
      txt(S(M), 'M', -16, 16),
      dot(S(Wd), 'cv-r', 4),
      txt(S(Wd), `O: ветер W = ${fmt(o.W, 4)}`, 8, 16),
    );
    note(out, `Вектор MO — скорость ветра, радиус окружности через концы трёх путевых скоростей — собственная скорость самолёта v = ${fmt(o.v, 4)}.`);
  } else if (r.kind === 'river') {
    const top = 120,
      bot = 360;
    out.push(seg([80, top], [920, top], 'sb-axis'), seg([80, bot], [920, bot], 'sb-axis'), txt([90, top - 10], 'берег'), txt([90, bot + 22], 'берег'));
    const A: P2 = [300, bot];
    const k = (bot - top) / o.l;
    const C: P2 = [A[0] + o.v * (o.l / o.u) * k, top];
    const B: P2 = [A[0], top];
    out.push(
      seg(A, C, 'rt-line'),
      seg(A, B, 'sb-axis', 'stroke-dasharray="5 5"'),
      dot(A),
      txt(A, 'A', -18, 20),
      dot(B),
      txt(B, 'B', -6, -10),
      dot(C, 'cv-r', 5),
      txt(C, `C (снос ${fmt(o.v * (o.l / o.u), 3)})`, 8, -8),
    );
    out.push(arrow([A[0] + 380, bot - 20], [A[0] + 380 + 90, bot - 20], 'cv-r'), txt([A[0] + 470, bot - 20], 'течение v', 6, 4));
    out.push(`<text class="tb-note" x="${A[0] + 20}" y="${(top + bot) / 2}">l = ${fmt(o.l, 4)}</text>`);
    note(
      out,
      `Курс перпендикулярно берегам даёт снос; чтобы попасть в B, лодка держит курс под углом ${fmt(o.alpha, 3)}° против течения (u = ${fmt(o.u, 4)}).`,
    );
  } else if (r.kind === 'tape') {
    const x0 = 80,
      w = 840,
      y0 = 240,
      amp = 130;
    const n = 400;
    const pts = Array.from({ length: n + 1 }, (_, i) => `${r1(x0 + (w * i) / n)} ${r1(y0 - amp * Math.sin((2 * Math.PI * 2 * i) / n))}`);
    out.push(seg([x0, y0], [x0 + w, y0], 'sb-axis'), `<path class="rt-line" fill="none" d="M${pts.join('L')}"/>`);
    out.push(
      `<line class="rt-axis" x1="${x0 + w / 4 - w / 4 + 0}" y1="${y0 + amp + 18}" x2="${x0 + w / 2}" y2="${y0 + amp + 18}"/>`,
      txt([x0 + w / 4, y0 + amp + 18], `длина волны λ = ${fmt(o.lam, 4)}`, -70, 18),
    );
    out.push(`<line class="rt-axis" x1="${x0 - 14}" y1="${y0}" x2="${x0 - 14}" y2="${y0 - amp}"/>`, txt([x0 - 14, y0 - amp / 2], `A = ${fmt(o.A, 4)}`, -52, 0));
    note(out, `Лента движется со скоростью v = ${fmt(o.v, 4)}: период T = λ/v = ${fmt(o.T, 4)} с, ω = ${fmt(o.wOverPi, 4)}π с⁻¹.`);
  } else {
    const k = 700 / Math.max(o.h1 + o.h2, 1e-9);
    const row = (y: number, len: number, label: string, cls: string) =>
      out.push(`<rect class="${cls}" x="120" y="${y}" width="${r1(len * k)}" height="34" opacity="0.55"/>`, txt([120 + len * k, y + 22], label, 10, 0));
    row(100, o.h1, `шаг h₁ = ${fmt(o.h1, 4)}`, 'en-v');
    row(170, o.h2, `шаг h₂ = ${fmt(o.h2, 4)}`, 'cv-r');
    row(260, o.per, `${o.opp === 1 ? 'h₁ + h₂' : '|h₁ − h₂|'} = ${fmt(o.per, 4)} — ход указателя за оборот`, 'cg-c');
    note(out, `За 1/n = 1/${fmt(o.n, 4)} оборота указатель перемещается на s = ${fmt(o.s, 5)}.`);
  }
  void pr;
  return done(out);
}
