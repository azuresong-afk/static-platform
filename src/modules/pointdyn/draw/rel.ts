/** Чертёж относительного движения в трубке: схема (ось вращения, трубка, начальное и искомое положения) и графики x(t), N(t). */
import { plot } from '../../rotation/draw/rotation';
import type { RelProblem, RelResult } from '../model/rel';

const r1 = (v: number) => Math.round(v * 10) / 10;
const W = 1000,
  H = 480;
const rad = (a: number) => (a * Math.PI) / 180;

export function renderRel(pr: RelProblem, r: RelResult): { svg: string; viewBox: string } {
  const out: string[] = [`<rect width="${W}" height="${H}" fill="var(--sheet)"/>`];
  if (!r.ok || !r.end) {
    out.push(`<text class="tb-note" x="16" y="${H / 2}">Проверьте данные.</text>`);
    return { svg: out.join(''), viewBox: `0 0 ${W} ${H}` };
  }
  // Схема в плоскости чертежа: координаты (по горизонтали, по вертикали), м.
  const th = rad(pr.theta);
  const u: [number, number] = [Math.cos(th), Math.sin(th)];
  // Начало O: vert — на расстоянии r от оси (ось — x = 0); horz — основание перпендикуляра длиной h из оси (0; 0); trans — (0; 0).
  const O: [number, number] = pr.frame === 'vert' ? [pr.r, 0] : pr.frame === 'horz' ? [-pr.h * u[1], pr.h * u[0]] : [0, 0];
  const xs = [0, pr.x0, r.end.x, ...(pr.ask === 'x' ? [pr.x1] : [])];
  const xa = Math.min(...xs),
    xb = Math.max(...xs);
  const span = Math.max(xb - xa, 1e-9);
  const ends = [xa - 0.15 * span, xb + 0.15 * span];
  const P = (x: number): [number, number] => [O[0] + x * u[0], O[1] + x * u[1]];
  const pts = [P(ends[0]), P(ends[1]), [0, 0] as [number, number], O];
  const minX = Math.min(...pts.map((p) => p[0])),
    maxX = Math.max(...pts.map((p) => p[0])),
    minY = Math.min(...pts.map((p) => p[1])),
    maxY = Math.max(...pts.map((p) => p[1]));
  const bx = 60,
    by = 70,
    bw = 380,
    bh = 320;
  const k = Math.min(bw / Math.max(maxX - minX, 1e-9), bh / Math.max(maxY - minY, 1e-9));
  const ox = bx + (bw - (maxX - minX) * k) / 2,
    oy = by + bh - (bh - (maxY - minY) * k) / 2;
  const S = (p: [number, number]): [number, number] => [ox + (p[0] - minX) * k, oy - (p[1] - minY) * k];
  const [ax, ay] = S([0, 0]);
  if (pr.frame === 'vert') {
    out.push(`<line class="mc-guide" x1="${r1(ax)}" y1="${by - 30}" x2="${r1(ax)}" y2="${by + bh + 20}"/>`);
    out.push(
      `<path class="ld" d="M${r1(ax - 18)} ${by - 12}a18 6 0 1 0 36 0" fill="none" marker-end="url(#rar)"/><text class="t-ld" x="${r1(ax + 24)}" y="${by - 10}">ω</text>`,
    );
  } else if (pr.frame === 'horz') {
    out.push(
      `<circle class="mc-pivot" cx="${r1(ax)}" cy="${r1(ay)}" r="6"/><path class="ld" d="M${r1(ax + 22)} ${r1(ay)}a22 22 0 0 0 -22 -22" fill="none" marker-end="url(#rar)"/><text class="t-ld" x="${r1(ax + 20)}" y="${r1(ay - 22)}">ω</text>`,
    );
  }
  const [e0x, e0y] = S(P(ends[0])),
    [e1x, e1y] = S(P(ends[1]));
  out.push(`<line class="mc-bar" x1="${r1(e0x)}" y1="${r1(e0y)}" x2="${r1(e1x)}" y2="${r1(e1y)}"/>`);
  out.push(`<text class="t-pt" x="${r1(e1x + 8)}" y="${r1(e1y - 8)}">x</text>`);
  const [Ox, Oy] = S(O);
  out.push(`<circle class="hinge" cx="${r1(Ox)}" cy="${r1(Oy)}" r="4"/><text class="t-pt" x="${r1(Ox - 18)}" y="${r1(Oy + 18)}">O</text>`);
  if (pr.ask === 'x') {
    const [qx, qy] = S(P(pr.x1));
    out.push(`<line class="mc-guide" x1="${r1(qx - 10 * u[1])}" y1="${r1(qy - 10 * u[0])}" x2="${r1(qx + 10 * u[1])}" y2="${r1(qy + 10 * u[0])}"/>`);
  }
  const [mx, my] = S(P(pr.x0));
  // Подписи M₀ и M₁ — по разные стороны трубки (по нормали к ней на экране), чтобы не налезали при близких положениях.
  const nrm: [number, number] = [Math.sin(th), Math.cos(th)];
  const lab = (px: number, py: number, side: number, text: string) =>
    `<text class="t-pt" x="${r1(px + side * 18 * nrm[0])}" y="${r1(py + side * 18 * nrm[1] + 5)}" text-anchor="${side * nrm[0] >= 0 ? 'start' : 'end'}">${text}</text>`;
  out.push(`<circle class="cg-ci" cx="${r1(mx)}" cy="${r1(my)}" r="7"/>${lab(mx, my, 1, 'M₀')}`);
  const [nx, ny] = S(P(r.end.x));
  out.push(`<circle class="rt-end" cx="${r1(nx)}" cy="${r1(ny)}" r="6"/>${lab(nx, ny, -1, 'M₁')}`);
  out.push(
    `<defs><marker id="rar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="currentColor"/></marker></defs>`,
  );
  const cap =
    pr.frame === 'vert'
      ? 'вращение вокруг вертикальной оси'
      : pr.frame === 'horz'
        ? 'ось вращения перпендикулярна чертежу, положение при t = 0'
        : 'тело движется поступательно';
  out.push(`<text class="tb-note" x="40" y="${H - 46}">${cap};</text><text class="tb-note" x="40" y="${H - 26}">M₀ — начальное положение, M₁ — искомое</text>`);
  // Графики x(t) и N(t).
  if (r.curve.length > 1) {
    out.push(
      plot(
        580,
        50,
        380,
        140,
        r.curve.map((c) => [c.t, c.x]),
        'x',
        'м',
        'с',
      ),
    );
    out.push(
      plot(
        580,
        285,
        380,
        140,
        r.curve.map((c) => [c.t, c.N]),
        'N',
        pr.byWeight ? 'кГ' : 'Н',
        'с',
      ),
    );
  }
  return { svg: out.join(''), viewBox: `0 0 ${W} ${H}` };
}
