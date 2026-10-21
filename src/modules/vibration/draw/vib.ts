/**
 * Чертёж раздела «Колебания систем»: схема (цепочка тел, балка с грузами, гаситель) и под ней формы главных
 * колебаний — смещения тел (для балки — упругая линия), для системы по T и Π — столбики амплитуд; ниже графики
 * qⱼ(t) и амплитудно-частотная характеристика с отметками собственных частот и частоты силы.
 */
import { fmt } from '../../../shared/format';
import { prettyName } from '../../../shared/sym';
import { elasticLine } from '../model/beam';
import type { ChainSys, VibOut, VibProblem, VibResult } from '../model/vibration';

const r1 = (v: number) => Math.round(v * 10) / 10;
const W = 1000;
const SER = ['vb-s0', 'vb-s1', 'vb-s2', 'vb-s3', 'vb-s4', 'vb-s5'];
const SUBD = '₀₁₂₃₄₅₆₇₈₉';
const sb = (i: number) => String(i).replace(/\d/g, (x) => SUBD[+x]);
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const txt = (x: number, y: number, s: string, cls = 'vb-lab', anchor = 'middle') =>
  `<text class="${cls}" x="${r1(x)}" y="${r1(y)}" text-anchor="${anchor}">${esc(s)}</text>`;
const line = (x1: number, y1: number, x2: number, y2: number, cls: string) =>
  `<line class="${cls}" x1="${r1(x1)}" y1="${r1(y1)}" x2="${r1(x2)}" y2="${r1(y2)}"/>`;
const path = (pts: [number, number][], cls: string) => `<path class="${cls}" d="M${pts.map(([x, y]) => `${r1(x)} ${r1(y)}`).join('L')}"/>`;

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

/** Пружина-зигзаг между точками по горизонтали. */
function spring(x1: number, x2: number, y: number): string {
  const n = 8,
    lead = Math.min(10, (x2 - x1) * 0.15),
    a = x1 + lead,
    b = x2 - lead,
    h = 7;
  const pts: [number, number][] = [
    [x1, y],
    [a, y],
  ];
  for (let i = 1; i <= n; i++) pts.push([a + ((b - a) * (i - 0.5)) / n, y + (i % 2 ? -h : h)]);
  pts.push([b, y], [x2, y]);
  return path(pts, 'vb-spring');
}
/** Неподвижная стенка (штриховка) — вертикальная, сторона side = −1 слева, +1 справа. */
function wall(x: number, y: number, side: number, moving = false): string {
  const out = [line(x, y - 22, x, y + 22, 'vb-ground')];
  for (let k = -22; k < 22; k += 7) out.push(line(x, y + k, x + side * 8, y + k + 7, moving ? 'vb-hatch vb-moving' : 'vb-hatch'));
  return out.join('');
}
function arrowV(x: number, y1: number, y2: number, cls: string): string {
  const dir = Math.sign(y2 - y1) || 1;
  return `${line(x, y1, x, y2 - dir * 8, cls)}<path class="${cls}-f" d="M${r1(x)} ${r1(y2)}L${r1(x - 4.5)} ${r1(y2 - dir * 11)}L${r1(x + 4.5)} ${r1(y2 - dir * 11)}Z"/>`;
}

interface Scheme {
  svg: string;
  /** Положения тел по горизонтали и закреплённых концов (для форм). */
  xs: number[];
  ends: { x: number; fixed: boolean }[];
  h: number;
}

/** Цепочка: стенки, пружины (участки вала, нити), тела. */
function chainScheme(ch: ChainSys, forceOn: boolean, forceKind: string, labels?: string[]): Scheme {
  const n = ch.bodies.length;
  const y = 64;
  const leftEnd = ch.left !== 'free',
    rightEnd = ch.right === 'fixed';
  const x0 = 70,
    x1 = W - 70;
  const slots = n + 1;
  const xs = ch.bodies.map((_, i) => x0 + ((x1 - x0) * (i + 1)) / slots);
  const out: string[] = [];
  const m = ch.kind === 'shaft' ? 'J' : 'm';
  const bw = ch.kind === 'string' ? 0 : 22;
  // Звенья.
  const segs: [number, number, number][] = [];
  if (leftEnd) segs.push([x0, xs[0], 0]);
  for (let i = 1; i < n; i++) segs.push([xs[i - 1], xs[i], i]);
  if (rightEnd) segs.push([xs[n - 1], x1, n]);
  for (const [k, [a, b, i]] of segs.entries()) {
    const l = ch.links[i];
    const a2 = a === x0 ? a : a + bw,
      b2 = b === x1 ? b : b - bw;
    if (ch.kind === 'spring') out.push(spring(a2, b2, y));
    else out.push(line(a2, y, b2, y, ch.kind === 'shaft' ? 'vb-shaft' : 'vb-string'));
    const lab = labels?.[i] ?? (ch.kind === 'string' ? `l${sb(k + 1)}` : `c${sb(k + 1)}`);
    out.push(txt((a2 + b2) / 2, y - 16, lab));
    if (l.b > 0) {
      const cx = (a2 + b2) / 2;
      out.push(`<rect class="vb-damper" x="${r1(cx - 10)}" y="${y + 12}" width="20" height="12"/>`, txt(cx, y + 40, `b${sb(k + 1)}`, 'vb-lab'));
    }
  }
  if (leftEnd)
    out.push(
      wall(x0, y, -1, ch.left === 'moving'),
      ch.left === 'moving' ? txt(x0, y + 40, forceKind === 'const' ? 'ξ₀' : forceKind === 'harmcos' ? 'ξ₀ cos pt' : 'ξ₀ sin pt', 'vb-flab') : '',
    );
  if (rightEnd) out.push(wall(x1, y, 1));
  // Тела и пружины к неподвижным точкам.
  ch.bodies.forEach((bd, i) => {
    const x = xs[i];
    if (bd.cg > 0) {
      out.push(line(x, y + 22, x, y + 28, 'vb-rod'));
      const zig: [number, number][] = [[x, y + 28]];
      for (let k = 1; k <= 6; k++) zig.push([x + (k % 2 ? -6 : 6), y + 28 + k * 4]);
      zig.push([x, y + 56]);
      out.push(path(zig, 'vb-spring'), line(x - 14, y + 56, x + 14, y + 56, 'vb-ground'));
    }
    if (ch.kind === 'spring') out.push(`<rect class="vb-mass" x="${r1(x - bw)}" y="${y - 20}" width="${2 * bw}" height="40" rx="3"/>`);
    else if (ch.kind === 'shaft') out.push(`<rect class="vb-mass" x="${r1(x - 6)}" y="${y - 28}" width="12" height="56" rx="3"/>`);
    else out.push(`<circle class="vb-mass" cx="${r1(x)}" cy="${y}" r="8"/>`);
    out.push(txt(x, y + (ch.kind === 'spring' ? 6 : -34), `${m}${sb(i + 1)}`, ch.kind === 'spring' ? 'vb-mlab' : 'vb-lab'));
    if (forceOn && bd.H) out.push(arrowV(x + (ch.kind === 'spring' ? 0 : 0), y - (ch.kind === 'shaft' ? 70 : 62), y - (ch.kind === 'shaft' ? 34 : 26), 'vb-f'));
  });
  return {
    svg: out.join(''),
    xs,
    ends: [
      { x: x0, fixed: leftEnd },
      { x: x1, fixed: rightEnd },
    ],
    h: 120,
  };
}

/** Балка: ось, опоры, грузы. */
function beamScheme(pr: VibProblem, forceOn: boolean): { svg: string; X: (x: number) => number; h: number } {
  const bm = pr.beam;
  const x0 = 80,
    x1 = W - 80;
  // Пластинка со смещённым центром масс занимает вдоль оси отрезок [x, x + 2e].
  const lo = Math.min(0, ...bm.masses.map((m) => m.x + 2 * Math.min(0, m.e))),
    hi = Math.max(bm.L, ...bm.masses.map((m) => m.x + 2 * Math.max(0, m.e)));
  const X = (x: number) => x0 + ((x1 - x0) * (x - lo)) / (hi - lo || 1);
  // Стойки — вверх от балки, высота в масштабе длины (не выше 70 px).
  const hMax = Math.max(0, ...bm.masses.map((m) => m.h ?? 0));
  const hs = hMax > 0 ? Math.min((X(hMax) - X(0)) / hMax, 70 / hMax) : 0;
  const top = 70 + (hMax > 0 ? Math.round(hMax * hs) + 10 : 0);
  const y = top;
  const out: string[] = [line(X(0), y, X(bm.L), y, 'vb-beam')];
  for (const s of bm.supports) {
    const x = X(s.x);
    if (s.kind === 'pin')
      out.push(
        `<path class="vb-supp" d="M${r1(x)} ${y}L${r1(x - 10)} ${y + 18}L${r1(x + 10)} ${y + 18}Z"/>`,
        line(x - 16, y + 18, x + 16, y + 18, 'vb-ground'),
      );
    else {
      const side = s.x <= bm.L / 2 ? -1 : 1;
      out.push(wall(x, y, side));
    }
  }
  bm.masses.forEach((ms, i) => {
    const x = X(ms.x);
    const hc = (ms.h ?? 0) * hs;
    if (hc > 0) {
      out.push(
        line(x, y, x, y - hc, 'vb-beam'),
        `<circle class="vb-mass" cx="${r1(x)}" cy="${r1(y - hc)}" r="10"/>`,
        txt(x + 16, y - hc + 4, `m${sb(i + 1)}`, 'vb-lab', 'start'),
      );
      if (forceOn && ms.H) out.push(arrowV(x + 18, y - hc - 40, y - hc - 4, 'vb-f'));
      return;
    }
    if (ms.J > 0 || ms.e) {
      const xe = X(ms.x + 2 * ms.e);
      out.push(`<rect class="vb-mass" x="${r1(Math.min(x, xe) - 6)}" y="${y - 14}" width="${r1(Math.abs(xe - x) + 12)}" height="28" rx="2"/>`);
    } else out.push(`<circle class="vb-mass" cx="${r1(x)}" cy="${y - 12}" r="10"/>`);
    out.push(txt(x, y - 34, `m${sb(i + 1)}`));
    if (forceOn && ms.H) out.push(arrowV(x + 18, y - 52, y - 16, 'vb-f'));
  });
  out.push(txt(X(0), y + 40, '0', 'vb-tick'), txt(X(bm.L), y + 40, fmt(bm.L, 3), 'vb-tick'));
  return { svg: out.join(''), X, h: y + 50 };
}

/** Формы главных колебаний. */
function modes(pr: VibProblem, r: VibResult, top: number, sch: Scheme | null, beamX: ((x: number) => number) | null): { svg: string; h: number } {
  const out: string[] = [];
  const rowH = 74,
    amp = 26;
  const shown = r.modes.filter((m) => m.kind !== 'unstable');
  out.push(txt(16, top + 4, 'Формы главных колебаний', 'vb-head', 'start'));
  const bars = !sch && !beamX;
  const y0 = top + (bars ? 60 : 44);
  shown.forEach((m, k) => {
    const s = r.modes.indexOf(m);
    const yb = y0 + k * rowH;
    const mx = Math.max(1e-300, ...m.shape.map(Math.abs));
    const sc = amp / mx;
    out.push(txt(16, yb - 22, `${s + 1}) k${sb(s + 1)} = ${m.kind === 'zero' ? '0' : fmt(m.k, 4)}`, 'vb-mode', 'start'));
    if (sch) {
      out.push(line(sch.ends[0].x, yb, sch.ends[1].x, yb, 'vb-base'));
      const pts: [number, number][] = [];
      if (sch.ends[0].fixed) pts.push([sch.ends[0].x, yb]);
      sch.xs.forEach((x, i) => {
        const yy = yb - m.shape[i] * sc;
        pts.push([x, yy]);
        out.push(line(x, yb, x, yy, 'vb-tick-l'), `<circle class="vb-pt" cx="${r1(x)}" cy="${r1(yy)}" r="3.5"/>`);
        out.push(txt(x + 8, yy + (m.shape[i] >= 0 ? -6 : 14), fmt(m.shape[i], 3), 'vb-val', 'start'));
      });
      if (sch.ends[1].fixed) pts.push([sch.ends[1].x, yb]);
      out.push(path(pts, `vb-mode-l ${SER[k % SER.length]}`));
      for (const nd of m.nodes)
        if (nd.at === 'link') {
          const xa = sch.xs[nd.i - 1],
            xb = sch.xs[nd.i];
          out.push(`<circle class="vb-node" cx="${r1(xa + (xb - xa) * nd.t)}" cy="${yb}" r="4"><title>узел</title></circle>`);
        }
    } else if (beamX && r.sys.info.src === 'beam') {
      const md = r.sys.info.model;
      const F = r.sys.A.map((row) => row.reduce((acc, a, j) => acc + a * m.shape[j], 0) * m.lam);
      const u = md.deflect(F);
      // Нормировка упругой линии по наибольшему прогибу на всей балке.
      const pl = elasticLine(md.xs, u);
      const um = Math.max(1e-300, ...pl.map(([, v]) => Math.abs(v)));
      out.push(line(beamX(0), yb, beamX(pr.beam.L), yb, 'vb-base'));
      out.push(
        path(
          pl.map(([x, v]): [number, number] => [beamX(x), yb - (v / um) * amp]),
          `vb-mode-l ${SER[k % SER.length]}`,
        ),
      );
      md.dofs.forEach((d, j) => {
        const x = beamX(pr.beam.masses[d.mass].x);
        // Горизонтальное смещение груза на стойке — подписью слева от узла.
        if (d.kind === 'u') {
          const v = u[2 * md.xs.findIndex((xx) => Math.abs(xx - pr.beam.masses[d.mass].x) <= 1e-9 * pr.beam.L)] / um;
          out.push(txt(x - 10, yb - v * amp + (v >= 0 ? -6 : 14), `${prettyName(r.sys.names[j])} = ${fmt(m.shape[j], 3)} →`, 'vb-val', 'end'));
          return;
        }
        if (d.kind !== 'y') return;
        const v = u[d.g] / um;
        out.push(
          `<circle class="vb-pt" cx="${r1(x)}" cy="${r1(yb - v * amp)}" r="3.5"/>`,
          txt(x + 8, yb - v * amp + (v >= 0 ? -6 : 14), fmt(m.shape[j], 3), 'vb-val', 'start'),
        );
      });
      for (const sp of pr.beam.supports) out.push(`<circle class="vb-node" cx="${r1(beamX(sp.x))}" cy="${yb}" r="3"/>`);
    } else {
      // Столбики амплитуд.
      const n = r.n;
      const x0 = 200,
        step = Math.min(110, (W - x0 - 40) / n);
      out.push(line(x0 - 20, yb, x0 + step * n - 20, yb, 'vb-base'));
      m.shape.forEach((v, j) => {
        const x = x0 + j * step + step / 2 - 20;
        const hgt = v * sc;
        out.push(
          `<rect class="vb-bar ${SER[k % SER.length]}" x="${r1(x - 9)}" y="${r1(Math.min(yb, yb - hgt))}" width="18" height="${r1(Math.max(0.5, Math.abs(hgt)))}"/>`,
        );
        out.push(txt(x, yb + (v >= 0 ? 16 : -hgt + 16), fmt(v, 3), 'vb-val'));
        if (k === 0) out.push(txt(x, top + 24, prettyName(r.sys.names[j]), 'vb-coord'));
      });
    }
  });
  return { svg: out.join(''), h: y0 - top + shown.length * rowH };
}

/** График нескольких кривых. */
function multiPlot(
  x0: number,
  y0: number,
  w: number,
  h: number,
  xs: number[],
  series: { name: string; ys: number[] }[],
  title: string,
  xLabel: string,
  opts: { yMax?: number; marks?: { x: number; label: string; cls: string }[] } = {},
): string {
  const out: string[] = [];
  const all = series.flatMap((s) => s.ys).filter(Number.isFinite);
  let lo = Math.min(0, ...all),
    hi = Math.max(0, ...all);
  if (opts.yMax != null) {
    hi = Math.min(hi, opts.yMax);
    lo = Math.max(lo, -opts.yMax);
  }
  const ty = ticks(lo, hi);
  lo = Math.min(lo, ty[0]);
  hi = Math.max(hi, ty[ty.length - 1]);
  const xMax = Math.max(1e-12, ...xs);
  const tx = ticks(0, xMax);
  const xHi = Math.max(xMax, tx[tx.length - 1]);
  const X = (x: number) => x0 + (x / xHi) * w,
    Y = (v: number) => y0 + h - ((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo || 1)) * h;
  const inside = (v: number) => v >= lo - 1e-12 * (hi - lo) && v <= hi + 1e-12 * (hi - lo);
  const dy = ty.length > 1 ? Math.abs(ty[1] - ty[0]) : 1,
    dig = Math.max(3, Math.ceil(-Math.log10(dy || 1)) + 1);
  for (const v of ty) out.push(line(x0, Y(v), x0 + w, Y(v), 'rt-grid'), txt(x0 - 8, Y(v) + 4, fmt(v, dig), 'rt-tick', 'end'));
  for (const t of tx) out.push(txt(X(t), y0 + h + 18, fmt(t, 3), 'rt-tick'));
  out.push(line(x0, Y(0), x0 + w, Y(0), 'rt-axis'), line(x0, y0, x0, y0 + h, 'rt-axis'));
  out.push(txt(x0, y0 - 14, title, 'rt-title', 'start'), txt(x0 + w, y0 + h + 36, xLabel, 'rt-tick', 'end'));
  for (const mk of opts.marks ?? [])
    if (mk.x <= xHi) out.push(line(X(mk.x), y0, X(mk.x), y0 + h, mk.cls), txt(X(mk.x) + 3, y0 + 12, mk.label, 'vb-mk', 'start'));
  const stepN = Math.max(1, Math.floor(xs.length / 700));
  series.forEach((s, k) => {
    // Разрыв линии там, где значение не определено или выходит за рамку (пик резонанса).
    const segs: [number, number][][] = [[]];
    let prevOut = false;
    xs.forEach((x, i) => {
      const v = s.ys[i];
      const out = !Number.isFinite(v) || !inside(v);
      if (out) {
        if (!prevOut && Number.isFinite(v)) segs[segs.length - 1].push([X(x), Y(v)]);
        if (segs[segs.length - 1].length) segs.push([]);
        prevOut = true;
        return;
      }
      if (prevOut && i > 0 && Number.isFinite(s.ys[i - 1])) segs[segs.length - 1].push([X(xs[i - 1]), Y(s.ys[i - 1])]);
      prevOut = false;
      if (i % stepN && i !== xs.length - 1) return;
      segs[segs.length - 1].push([X(x), Y(v)]);
    });
    for (const sg of segs) if (sg.length > 1) out.push(path(sg, `rt-line ${SER[k % SER.length]}`));
  });
  // Легенда.
  if (series.length > 1)
    series.forEach((s, k) => {
      const lx = x0 + 22 + k * 62;
      out.push(line(lx - 22, y0 + h + 32, lx - 6, y0 + h + 32, `rt-line ${SER[k % SER.length]}`), txt(lx - 2, y0 + h + 36, s.name, 'vb-leg', 'start'));
    });
  return out.join('');
}

export function renderVib(pr: VibProblem, r: VibOut): { svg: string; viewBox: string } {
  const out: string[] = [];
  if (!r.ok) {
    out.push(txt(16, 40, r.error, 'tb-note', 'start'));
    return { svg: out.join(''), viewBox: `0 0 ${W} 80` };
  }
  const forceOn = r.sys.force.kind !== 'none';
  let y = 0;
  let sch: Scheme | null = null;
  let beamX: ((x: number) => number) | null = null;
  if (pr.src === 'chain') {
    sch = chainScheme(pr.chain, forceOn, r.sys.cos ? 'harmcos' : r.sys.force.kind);
    out.push(sch.svg);
    y = sch.h;
  } else if (pr.src === 'absorber' && r.sys.info.src === 'absorber') {
    const a = pr.absorber;
    const ch: ChainSys = {
      kind: 'spring',
      bodies: [
        { m: a.m1, cg: 0, q0: 0, v0: 0, H: a.H },
        { m: r.sys.info.m2, cg: 0, q0: 0, v0: 0, H: 0 },
      ],
      links: [
        { c: r.sys.info.c1, b: 0, len: 1, d: 0 },
        { c: r.sys.info.c2, b: 0, len: 1, d: 0 },
        { c: 0, b: 0, len: 1, d: 0 },
      ],
      left: 'fixed',
      right: 'free',
      G: 0,
      N: 0,
      xi0: 0,
    };
    sch = chainScheme(ch, true, 'harm');
    out.push(sch.svg, txt(sch.xs[1], 110, 'гаситель', 'vb-lab'));
    y = sch.h;
  } else if (pr.src === 'beam') {
    const b = beamScheme(pr, forceOn);
    beamX = b.X;
    out.push(b.svg);
    y = b.h;
  } else y = 10;
  // Формы гироскопической системы комплексные — в тексте решения, на чертеже не показываются.
  const md = r.gyro ? { svg: '', h: 0 } : modes(pr, r, y + 10, sch, beamX);
  out.push(md.svg);
  y += 10 + md.h + 20;
  // Графики.
  const plots: string[] = [];
  const names = r.sys.names.map((n) => prettyName(n));
  const both = !!r.sim && !!r.afc;
  const pw = both ? 360 : 820,
    ph = 220;
  let px = 80;
  if (r.sim) {
    plots.push(
      multiPlot(
        px,
        y + 40,
        pw,
        ph,
        r.sim.t,
        r.sim.q.map((ys, j) => ({ name: names[j], ys })),
        'Движение qⱼ(t)',
        't, с',
      ),
    );
    px += pw + 120;
  }
  if (r.afc) {
    const vals = r.afc.amp
      .flat()
      .filter((v) => Number.isFinite(v))
      .sort((a, b) => a - b);
    const at = r.forced ? Math.max(...r.forced.amp) : 0;
    const yMax = Math.max(3 * at, 3 * (vals[Math.floor(vals.length * 0.6)] ?? 1));
    // При резонансе отметки p и kₛ совпадают — одна подпись «p = kₛ».
    const p = r.sys.force.p;
    const kRes = r.modes.findIndex((m) => m.kind === 'osc' && Math.abs(m.k - p) <= 1e-6 * p);
    const marks = [
      ...r.modes.filter((m, s) => m.kind === 'osc' && s !== kRes).map((m) => ({ x: m.k, label: `k${sb(r.modes.indexOf(m) + 1)}`, cls: 'vb-kmark' })),
      { x: p, label: kRes >= 0 ? `p = k${sb(kRes + 1)}` : 'p', cls: 'vb-pmark' },
    ];
    plots.push(
      multiPlot(
        px,
        y + 40,
        pw,
        ph,
        r.afc.p,
        r.afc.amp.map((ys, j) => ({ name: names[j], ys })),
        'Амплитуды вынужденных колебаний',
        'p, рад/с',
        { yMax, marks },
      ),
    );
  }
  if (plots.length) {
    out.push(...plots);
    y += 40 + ph + 50;
  }
  return { svg: `<rect width="${W}" height="${r1(y)}" fill="var(--sheet)"/>` + out.join(''), viewBox: `0 0 ${W} ${r1(y)}` };
}
