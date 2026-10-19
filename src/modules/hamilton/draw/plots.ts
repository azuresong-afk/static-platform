/**
 * Графики вкладки «Устойчивость и нелинейные колебания»: координаты и интегралы по времени (интегрирование
 * канонических уравнений), корни характеристического уравнения на комплексной плоскости и область устойчивости
 * по параметру, фазовый портрет, x(t), скорость изменения амплитуды ȧ(a) и период по амплитуде.
 */
import { fmt } from '../../../shared/format';
import { prettyName, varName } from '../../../shared/sym';
import { plot } from '../../rotation/draw/rotation';
import type { NonlinSolution } from '../model/nonlin';
import type { RouthSolution } from '../model/routh';
import type { StabSolution } from '../model/stability';

const r1 = (v: number) => Math.round(v * 10) / 10;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const SER = ['vb-s0', 'vb-s1', 'vb-s2', 'vb-s3', 'vb-s4', 'vb-s5'];

function ticks(lo: number, hi: number, n = 5): number[] {
  if (hi - lo < 1e-12) {
    const d = Math.abs(lo) > 1e-12 ? Math.abs(lo) * 0.5 : 1;
    lo -= d;
    hi += d;
  }
  const raw = (hi - lo) / n;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const st = [1, 2, 2.5, 5, 10].map((k) => k * p).find((s) => s >= raw) ?? 10 * p;
  const out: number[] = [];
  for (let x = Math.ceil(lo / st - 1e-9) * st; x <= hi + 1e-9 * st; x += st) out.push(Math.abs(x) < st * 1e-9 ? 0 : x);
  return out;
}
const digits = (t: number[]) => (t.length > 1 ? Math.max(0, Math.ceil(-Math.log10(Math.abs(t[1] - t[0]))) + 1) : 2);

interface Frame {
  X: (v: number) => number;
  Y: (v: number) => number;
  svg: string[];
}
/** Оси с сеткой; equal — одинаковый масштаб по осям (комплексная плоскость). */
function frame(x0: number, y0: number, w: number, h: number, xr: [number, number], yr: [number, number], title: string, xl: string, yl: string): Frame {
  const tx = ticks(xr[0], xr[1]),
    ty = ticks(yr[0], yr[1]);
  const xlo = Math.min(xr[0], tx[0]),
    xhi = Math.max(xr[1], tx[tx.length - 1]),
    ylo = Math.min(yr[0], ty[0]),
    yhi = Math.max(yr[1], ty[ty.length - 1]);
  const X = (v: number) => x0 + ((v - xlo) / (xhi - xlo || 1)) * w,
    Y = (v: number) => y0 + h - ((v - ylo) / (yhi - ylo || 1)) * h;
  const svg: string[] = [];
  const dx = digits(tx),
    dy = digits(ty);
  for (const v of ty)
    svg.push(
      `<line class="rt-grid" x1="${x0}" y1="${r1(Y(v))}" x2="${x0 + w}" y2="${r1(Y(v))}"/><text class="rt-tick" x="${x0 - 8}" y="${r1(Y(v) + 4)}" text-anchor="end">${fmt(v, dy)}</text>`,
    );
  for (const v of tx)
    svg.push(
      `<line class="rt-grid" x1="${r1(X(v))}" y1="${y0}" x2="${r1(X(v))}" y2="${y0 + h}"/><text class="rt-tick" x="${r1(X(v))}" y="${y0 + h + 18}" text-anchor="middle">${fmt(v, dx)}</text>`,
    );
  if (ylo <= 0 && yhi >= 0) svg.push(`<line class="rt-axis" x1="${x0}" y1="${r1(Y(0))}" x2="${x0 + w}" y2="${r1(Y(0))}"/>`);
  if (xlo <= 0 && xhi >= 0) svg.push(`<line class="rt-axis" x1="${r1(X(0))}" y1="${y0}" x2="${r1(X(0))}" y2="${y0 + h}"/>`);
  svg.push(
    `<text class="rt-title" x="${x0}" y="${y0 - 14}">${esc(title)}</text><text class="rt-tick" x="${x0 + w}" y="${y0 + h + 36}" text-anchor="end">${esc(xl)}</text><text class="rt-tick" x="${x0 + 4}" y="${y0 + 12}">${esc(yl)}</text>`,
  );
  return { X, Y, svg };
}
function line(f: Frame, pts: [number, number][], cls: string): string {
  const step = Math.max(1, Math.floor(pts.length / 800));
  const sel = pts.filter((p, i) => (i % step === 0 || i === pts.length - 1) && Number.isFinite(p[0]) && Number.isFinite(p[1]));
  return sel.length ? `<path class="${cls}" d="M${sel.map(([x, y]) => `${r1(f.X(x))} ${r1(f.Y(y))}`).join('L')}"/>` : '';
}
const range = (xs: number[], pad = 0.05): [number, number] => {
  const f = xs.filter(Number.isFinite);
  if (!f.length) return [-1, 1];
  const lo = Math.min(...f),
    hi = Math.max(...f);
  const d = (hi - lo || Math.abs(hi) || 1) * pad;
  return [lo - d, hi + d];
};

export function routhPlots(r: RouthSolution): { svg: string; viewBox: string } | null {
  if (!r.sim) return null;
  const { t, q, p, H } = r.sim;
  const isAngle = (n: string) => /^[α-ωΑ-Ω]/.test(n);
  const series: { title: string; unit: string; pts: [number, number][] }[] = r.ctx.coords.map((n, i) => ({
    title: prettyName(n),
    unit: isAngle(n) ? 'рад' : 'м',
    pts: t.map((x, k) => [x, q[i][k]] as [number, number]),
  }));
  for (const i of r.cyclic) series.push({ title: 'p_' + prettyName(r.ctx.coords[i]), unit: 'СИ', pts: t.map((x, k) => [x, p[i][k]] as [number, number]) });
  if (r.energy) series.push({ title: 'H', unit: 'Дж', pts: t.map((x, k) => [x, H[k]] as [number, number]) });
  const cols = 2,
    pw = 380,
    ph = 190;
  const rows = Math.ceil(series.length / cols);
  const out = series.map((s, i) => plot(80 + (i % cols) * (pw + 110), 50 + Math.floor(i / cols) * (ph + 90), pw, ph, s.pts, s.title, s.unit, 'с'));
  return { svg: out.join(''), viewBox: `0 0 ${cols * (pw + 110) + 30} ${rows * (ph + 90) + 20}` };
}

export function stabPlots(r: StabSolution): { svg: string; viewBox: string } {
  const out: string[] = [];
  // Комплексная плоскость: одинаковый масштаб.
  const re = r.roots.map((z) => z[0]),
    im = r.roots.map((z) => z[1]);
  const R = Math.max(1e-6, ...re.map(Math.abs), ...im.map(Math.abs)) * 1.25;
  const W = 380,
    Hh = 300;
  const f = frame(80, 50, W, Hh, [-R * (W / Hh), R * (W / Hh)], [-R, R], 'Корни λ на комплексной плоскости', 'Re λ', 'Im λ');
  out.push(...f.svg);
  // Левая полуплоскость — область устойчивости.
  out.push(`<rect class="sp-cone1" x="80" y="50" width="${r1(f.X(0) - 80)}" height="${Hh}" opacity=".5"/>`);
  for (const z of r.roots)
    out.push(
      `<circle class="${Math.abs(z[0]) <= 1e-7 * Math.max(1, Math.hypot(z[0], z[1])) ? 'vb-node' : 'vb-pt'}" cx="${r1(f.X(z[0]))}" cy="${r1(f.Y(z[1]))}" r="5"><title>λ = ${fmt(z[0], 4)} ${z[1] < 0 ? '−' : '+'} ${fmt(Math.abs(z[1]), 4)}i</title></circle>`,
    );
  let width = 80 + W + 40;
  if (r.scan) {
    const s = r.scan;
    const x0 = width + 60,
      w = 380,
      y0 = 50 + Hh / 2 - 20;
    const tx = ticks(s.from, s.to);
    const X = (v: number) => x0 + ((v - s.from) / (s.to - s.from || 1)) * w;
    const dx = digits(tx);
    out.push(`<text class="rt-title" x="${x0}" y="${y0 - 40}">Устойчивость по ${esc(s.param)}</text>`);
    for (const [lo, hi] of s.stable) out.push(`<rect class="sp-cone1" x="${r1(X(lo))}" y="${y0}" width="${r1(X(hi) - X(lo))}" height="40"/>`);
    out.push(`<rect fill="none" class="rt-axis" x="${x0}" y="${y0}" width="${w}" height="40"/>`);
    for (const v of tx)
      if (v >= s.from - 1e-12 && v <= s.to + 1e-12)
        out.push(
          `<line class="rt-axis" x1="${r1(X(v))}" y1="${y0 + 40}" x2="${r1(X(v))}" y2="${y0 + 46}"/><text class="rt-tick" x="${r1(X(v))}" y="${y0 + 62}" text-anchor="middle">${fmt(v, dx)}</text>`,
        );
    out.push(`<text class="rt-tick" x="${x0 + w}" y="${y0 + 80}" text-anchor="end">${esc(s.param)}</text>`);
    for (const b of s.bounds)
      out.push(
        `<line class="vb-kmark" x1="${r1(X(b))}" y1="${y0 - 10}" x2="${r1(X(b))}" y2="${y0 + 50}"/><text class="vb-mk" x="${r1(X(b))}" y="${y0 - 14}" text-anchor="middle">${esc(s.param)} = ${fmt(b, 4)}</text>`,
      );
    out.push(`<text class="vb-leg" x="${x0}" y="${y0 + 104}">закрашено — устойчиво</text>`);
    width = x0 + w + 40;
  }
  return { svg: out.join(''), viewBox: `0 0 ${width} ${Hh + 100}` };
}

export function nonlinPlots(r: NonlinSolution): { svg: string; viewBox: string } {
  const out: string[] = [];
  const x = prettyName(r.ctx.coords[0]);
  const xd = varName(x, 1);
  const pw = 380,
    ph = 260;
  // Фазовый портрет.
  const all = r.portrait.flatMap((p) => p.x),
    allv = r.portrait.flatMap((p) => p.v);
  const lim = (xs: number[]) => {
    const s = xs
      .filter(Number.isFinite)
      .map(Math.abs)
      .sort((a, b) => a - b);
    return s.length ? s[Math.floor(s.length * 0.995)] || s[s.length - 1] : 1;
  };
  const XR = lim(all) * 1.1 || 1,
    VR = lim(allv) * 1.1 || 1;
  const f = frame(80, 50, pw, ph, [-XR, XR], [-VR, VR], 'Фазовый портрет', x, xd);
  out.push(...f.svg);
  const inside = ([a, b]: [number, number]) => Math.abs(a) <= XR * 1.02 && Math.abs(b) <= VR * 1.02;
  const clip = (pts: [number, number][]) => pts.filter(inside);
  // Траектория с разрывами там, где она выходит за рамку.
  const cut = (pts: [number, number][], cls: string) => {
    const step = Math.max(1, Math.floor(pts.length / 1500));
    let d = '',
      pen = false;
    pts.forEach((pt, k) => {
      if (k % step && k !== pts.length - 1) return;
      if (!inside(pt) || !Number.isFinite(pt[0]) || !Number.isFinite(pt[1])) return void (pen = false);
      d += `${pen ? 'L' : 'M'}${r1(f.X(pt[0]))} ${r1(f.Y(pt[1]))}`;
      pen = true;
    });
    return d ? `<path class="${cls}" d="${d}"/>` : '';
  };
  r.portrait.forEach((p, i) => {
    const main = i === r.portrait.length - 1;
    out.push(
      cut(
        p.x.map((a, k) => [a, p.v[k]]),
        `vb-mode-l ${main ? 'vb-s0' : SER[1 + (i % 5)]}`,
      ),
    );
  });
  for (const s of r.singular)
    if (Math.abs(s.x) <= XR)
      out.push(`<circle class="${s.kind === 'saddle' || s.kind.endsWith('-u') ? 'vb-node' : 'vb-pt'}" cx="${r1(f.X(s.x))}" cy="${r1(f.Y(0))}" r="5"/>`);
  // Предельные циклы по усреднению: эллипсы x = a cos ψ, ẋ = −ak sin ψ.
  if (r.k2 > 0)
    for (const c of r.cycles) {
      const k = Math.sqrt(r.k2);
      const pts: [number, number][] = Array.from({ length: 121 }, (_, i) => [c.a * Math.cos((i * Math.PI) / 60), -c.a * k * Math.sin((i * Math.PI) / 60)]);
      out.push(
        `<path class="vb-kmark" fill="none" d="M${clip(pts)
          .map(([a, b]) => `${r1(f.X(a))} ${r1(f.Y(b))}`)
          .join('L')}"/>`,
      );
    }
  // x(t).
  out.push(
    plot(
      80 + pw + 110,
      50,
      pw,
      ph,
      r.sim.t.map((t, i) => [t, r.sim.x[i]] as [number, number]),
      x,
      '',
      'с',
    ).replace(`${x}, <`, `${x}<`),
  );
  let H = 50 + ph + 70;
  // ȧ(a) и ω(a) или T(a).
  if (r.avg) {
    const g = frame(80, H + 30, pw, 200, [0, r.avg.a[r.avg.a.length - 1]], range(r.avg.da), 'Метод усреднения: ȧ(a)', 'a', 'ȧ');
    out.push(
      ...g.svg,
      line(
        g,
        r.avg.a.map((a, i) => [a, r.avg!.da[i]]),
        'vb-mode-l vb-s0',
      ),
    );
    for (const c of r.cycles)
      out.push(`<circle class="${c.stable ? 'vb-pt' : 'vb-node'}" cx="${r1(g.X(c.a))}" cy="${r1(g.Y(0))}" r="5"><title>a = ${fmt(c.a, 4)}</title></circle>`);
    const h = frame(80 + pw + 110, H + 30, pw, 200, [0, r.avg.a[r.avg.a.length - 1]], range(r.avg.w), 'Частота ω(a), рад/с', 'a', 'ω');
    out.push(
      ...h.svg,
      line(
        h,
        r.avg.a.map((a, i) => [a, r.avg!.w[i]]),
        'vb-mode-l vb-s1',
      ),
    );
    H += 30 + 200 + 50;
  } else if (r.periods.length > 1) {
    const g = frame(80, H + 30, pw, 200, [0, r.periods[r.periods.length - 1].a], range(r.periods.map((p) => p.T)), 'Период T(a), с', 'a', 'T');
    out.push(
      ...g.svg,
      line(
        g,
        r.periods.map((p) => [p.a, p.T]),
        'vb-mode-l vb-s0',
      ),
    );
    for (const p of r.periods) out.push(`<circle class="vb-pt" cx="${r1(g.X(p.a))}" cy="${r1(g.Y(p.T))}" r="3.5"/>`);
    H += 30 + 200 + 50;
  }
  return { svg: out.join(''), viewBox: `0 0 ${2 * (pw + 110) + 30} ${H}` };
}
