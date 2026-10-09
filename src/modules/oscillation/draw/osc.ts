/**
 * Чертёж раздела «Удар и колебания»: слева — схема (опора, упругие элементы по ступеням, демпфер, груз, возмущение,
 * ось x), справа — график x(t) с отметками: состояние в момент t, наибольшее отклонение, недеформированный элемент.
 * Схема строится в «своих» осях u (вдоль движения) и w (поперёк) и поворачивается по ориентации задачи.
 */
import { fmt } from '../../../shared/format';
import type { Elem } from '../model/elastic';
import { LEN_LABEL, type OscProblem, type OscResult } from '../model/osc';

const r1 = (v: number) => Math.round(v * 10) / 10;
const W = 1000,
  H = 480;
type P2 = [number, number];

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

/** Схема системы. */
function scheme(pr: OscProblem, r: OscResult | null): string {
  const out: string[] = [];
  const a = (pr.alpha * Math.PI) / 180;
  // Экранные орты: u — направление оси x, w — поперёк (вверх от плоскости для горизонтали и наклона).
  const eu: P2 = pr.orient === 'h' ? [1, 0] : pr.orient === 'v' ? [0, 1] : [Math.cos(a), Math.sin(a)];
  const ew: P2 = pr.orient === 'h' ? [0, -1] : pr.orient === 'v' ? [1, 0] : [Math.sin(a), -Math.cos(a)];
  const O: P2 = pr.orient === 'h' ? [40, 250] : pr.orient === 'v' ? [170, 70] : [40, 150];
  const T = (u: number, w: number): P2 => [O[0] + eu[0] * u + ew[0] * w, O[1] + eu[1] * u + ew[1] * w];
  const L = (p: P2, q: P2, cls: string, extra = '') => `<line class="${cls}" x1="${r1(p[0])}" y1="${r1(p[1])}" x2="${r1(q[0])}" y2="${r1(q[1])}"${extra}/>`;
  const poly = (pts: P2[], cls: string) => `<path class="${cls}" d="M${pts.map((p) => `${r1(p[0])} ${r1(p[1])}`).join('L')}Z"/>`;
  const txt = (p: P2, s: string, anchor = 'middle', cls = 't cv-t os-lab') =>
    `<text class="${cls}" x="${r1(p[0])}" y="${r1(p[1])}" text-anchor="${anchor}">${s}</text>`;
  const arrow = (p: P2, q: P2, cls: string) => {
    const dx = q[0] - p[0],
      dy = q[1] - p[1],
      l = Math.hypot(dx, dy) || 1,
      ux = dx / l,
      uy = dy / l;
    return `${L(p, [q[0] - ux * 8, q[1] - uy * 8], cls)}<path class="${cls}-f" d="M${r1(q[0])} ${r1(q[1])}L${r1(q[0] - ux * 11 - uy * 4.5)} ${r1(q[1] - uy * 11 + ux * 4.5)}L${r1(q[0] - ux * 11 + uy * 4.5)} ${r1(q[1] - uy * 11 - ux * 4.5)}Z"/>`;
  };

  const drop = pr.init.mode === 'drop';
  const base = pr.exc.mode === 'base';
  const stages: Elem[][] = pr.el.mode === 'elems' ? pr.el.stages.map((s) => s.items) : [[{ kind: 'spring' } as Elem]];
  const Lc = 170,
    mL = 64,
    mW = 56;
  // Порядок по u: опора → элементы → груз; при ударе груз сверху: груз → (зазор h) → элементы → опора.
  const gap = drop ? 46 : 0;
  const uSup = drop ? mL + gap + Lc : 0;
  const uMass0 = drop ? 0 : Lc;
  const span = (items: number) => Math.max(1, items - 1) * 30;

  // Опора.
  const wMax = Math.max(40, ...stages.map((s) => span(s.length) / 2 + 22));
  const hasDamper = pr.damp.mode !== 'none' && pr.damp.mode !== 'dry';
  const wG = hasDamper ? wMax + 30 : wMax;
  const s1 = T(uSup, -wMax),
    s2 = T(uSup, wG);
  out.push(L(s1, s2, 'os-ground'));
  const hatchDir = drop ? 1 : -1;
  for (let w = -wMax; w <= wG + 1e-9; w += 12) out.push(L(T(uSup, w), T(uSup + hatchDir * 10, w - 7), base ? 'os-hatch os-moving' : 'os-hatch'));
  if (base) out.push(arrow(T(uSup - 22, wMax + 14), T(uSup + 22, wMax + 14), 'os-f') + txt(T(uSup, wMax + 34), 'ξ = a sin pt'));

  // Элементы по ступеням.
  const n = stages.length;
  const segL = Lc / n;
  const dir = drop ? -1 : 1; // от опоры к грузу
  let lab = 0;
  stages.forEach((items, i) => {
    const uA = drop ? uSup - i * segL : i * segL;
    const uB = uA + dir * segL;
    const sp = span(items.length);
    items.forEach((e, j) => {
      const w = items.length > 1 ? -sp / 2 + j * (sp / Math.max(1, items.length - 1)) : 0;
      const p = T(uA, w),
        q = T(uB, w);
      lab++;
      const name = pr.el.mode === 'elems' ? (e.kind === 'spring' ? `c${sub(lab)}` : e.kind === 'rod' ? 'EA' : 'EJ') : 'c';
      if (e.kind === 'spring') {
        const N = 7,
          amp = 9;
        const pts: P2[] = [p];
        const ua = uA + dir * 10,
          ub = uB - dir * 10;
        pts.push(T(ua, w));
        for (let k = 0; k < N; k++) pts.push(T(ua + ((ub - ua) * (k + 0.5)) / N, w + (k % 2 ? -amp : amp)));
        pts.push(T(ub, w), q);
        out.push(`<path class="os-spring" d="M${pts.map((z) => `${r1(z[0])} ${r1(z[1])}`).join('L')}"/>`);
      } else if (e.kind === 'rod') {
        out.push(poly([T(uA, w - 4), T(uB, w - 4), T(uB, w + 4), T(uA, w + 4)], 'os-rod'));
      } else {
        // Балка поперёк оси: середина — к грузу, опоры — к опоре системы.
        const um = (uA + uB) / 2;
        out.push(L(T(um + dir * 2, w), T(uB, w), 'os-link'));
        out.push(L(T(um, w - 22), T(um, w + 22), 'os-beam'));
        for (const s of [-1, 1]) {
          out.push(poly([T(um - dir * 2, w + s * 20), T(um - dir * 12, w + s * 20 - 6), T(um - dir * 12, w + s * 20 + 6)], 'os-supp'));
          out.push(L(T(um - dir * 12, w + s * 20), T(uA, w + s * 20), 'os-link'));
        }
        out.push(L(T(uA, w - 24), T(uA, w + 24), 'os-plate'));
      }
      const tp = T((uA + uB) / 2, w + (items.length > 1 ? 0 : 1) * 24);
      out.push(txt([tp[0] + (pr.orient === 'v' ? 4 : 0), tp[1] + (pr.orient === 'v' ? 4 : 0)], name, pr.orient === 'v' ? 'start' : 'middle'));
    });
    // Пластина между ступенями.
    if (i < n - 1 || items.length > 1) {
      const uJ = uB;
      if (items.length > 1 || i < n - 1) out.push(L(T(uJ, -sp / 2 - 6), T(uJ, sp / 2 + 6), 'os-plate'));
    }
    if (items.length > 1 && i === 0) out.push(L(T(uA, -sp / 2 - 6), T(uA, sp / 2 + 6), 'os-plate'));
  });

  // Демпфер — сбоку, от опоры к грузу.
  if (hasDamper) {
    const w = wMax + 18;
    const uFrom = uSup,
      uTo = uMass0 + mL / 2;
    out.push(L(T(uTo, w), T(uTo, mW / 2), 'os-link'));
    const um = (uFrom + uTo) / 2;
    out.push(L(T(uFrom, w), T(um - dir * 10, w), 'os-link'), L(T(um + dir * 4, w), T(uTo, w), 'os-link'));
    out.push(
      `<path class="os-damper" d="M${[T(um - dir * 18, w - 9), T(um + dir * 8, w - 9), T(um + dir * 8, w + 9), T(um - dir * 18, w + 9)].map((z) => `${r1(z[0])} ${r1(z[1])}`).join('L')}"/>`,
    );
    out.push(L(T(um + dir * 4, w - 6), T(um + dir * 4, w + 6), 'os-plate'));
    out.push(txt(T(um, w + 22), 'b'));
  }

  // Груз.
  const m0 = T(uMass0, -mW / 2),
    m1 = T(uMass0 + mL, -mW / 2),
    m2 = T(uMass0 + mL, mW / 2),
    m3 = T(uMass0, mW / 2);
  out.push(poly([m0, m1, m2, m3], 'os-mass'));
  const mc = T(uMass0 + mL / 2, 0);
  out.push(txt([mc[0], mc[1] + 5], 'm', 'middle', 't cv-t os-mlab'));
  if (drop) {
    out.push(L(T(mL, -mW / 2 - 10), T(mL + gap, -mW / 2 - 10), 'os-dim'));
    out.push(txt(T(mL + gap / 2, -mW / 2 - 24), 'h'));
    out.push(arrow(T(mL + 4, mW / 2 + 12), T(mL + gap - 4, mW / 2 + 12), 'os-f'));
  }
  // Плоскость (горизонталь и наклон): поверхность под грузом и элементами.
  if (pr.orient !== 'v') {
    const wp = -mW / 2;
    const pA = T(-10, wp),
      pB = T(Lc + mL + 40, wp);
    out.push(L(pA, pB, 'os-ground'));
    const rough = pr.damp.mode === 'dry';
    for (let u = 0; u <= Lc + mL + 30; u += rough ? 8 : 14) out.push(L(T(u, wp), T(u - 7, wp - 9), rough && u >= Lc - 6 ? 'os-hatch os-rough' : 'os-hatch'));
    if (pr.orient === 'incl') {
      const c0 = T(Lc + mL + 40, wp);
      out.push(`<line class="os-dim" x1="${r1(c0[0] - 70)}" y1="${r1(c0[1])}" x2="${r1(c0[0])}" y2="${r1(c0[1])}"/>`);
      out.push(`<path class="os-dim" d="M${r1(c0[0] - 46)} ${r1(c0[1])}A46 46 0 0 0 ${r1(c0[0] - 46 * Math.cos(a))} ${r1(c0[1] - 46 * Math.sin(a))}"/>`);
      out.push(txt([c0[0] - 58, c0[1] - 8], 'α'));
    }
  }
  // Сила тяжести.
  if (pr.orient !== 'h') out.push(arrow(mc, [mc[0], mc[1] + 52], 'os-g') + txt([mc[0] + 8, mc[1] + 50], 'P', 'start'));
  // Возмущение.
  const far = T(uMass0 + (drop ? 0 : mL), 0);
  if (pr.exc.mode === 'H') {
    const q = drop ? T(-40, 0) : T(uMass0 + mL + 46, 0);
    out.push(
      arrow(far, q, 'os-f') +
        txt([q[0] + (pr.orient === 'v' ? 10 : 0), q[1] + (pr.orient === 'v' ? 4 : -10)], 'H sin pt', pr.orient === 'v' ? 'start' : 'middle'),
    );
  } else if (pr.exc.mode === 'rotor') {
    out.push(
      `<circle class="os-rotor" cx="${r1(mc[0])}" cy="${r1(mc[1])}" r="15"/><circle class="os-dot" cx="${r1(mc[0] + 10)}" cy="${r1(mc[1] - 10)}" r="4"/>`,
    );
    out.push(txt([mc[0] + 38, mc[1] - 22], 'm₀, e', 'start'));
  }
  // Ось x.
  const ax0 = T(uMass0 + mL + (drop ? 18 : 18), -mW / 2 - 26),
    ax1 = T(uMass0 + mL + (drop ? 18 : 18) + 44, -mW / 2 - 26);
  out.push(arrow(ax0, ax1, 'os-ax') + txt([ax1[0] + (pr.orient === 'v' ? -12 : 4), ax1[1] + (pr.orient === 'v' ? 12 : -6)], 'x', 'start', 't cv-t os-axl'));
  if (r?.ok) {
    const u = LEN_LABEL[pr.len];
    out.push(`<text class="rt-tick" x="16" y="${H - 54}">k = ${fmt(r.k, 4)} с⁻¹, T₀ = ${fmt(r.T0, 4)} с</text>`);
    out.push(`<text class="rt-tick" x="16" y="${H - 36}">c = ${fmt(r.c, 4)}; δст = ${fmt(r.dst, 4)} ${u}</text>`);
  }
  return out.join('');
}

const SUB = '₀₁₂₃₄₅₆₇₈₉';
const sub = (n: number) => String(n).replace(/\d/g, (d) => SUB[+d]);

/** График x(t). */
function graph(pr: OscProblem, r: OscResult, x0: number, y0: number, w: number, h: number): string {
  const out: string[] = [];
  const u = LEN_LABEL[pr.len];
  const pts = r.curve;
  const ys = pts.map((p) => p[1]);
  const extra: number[] = [];
  if ((pr.init.mode === 'drop' || pr.el.rope) && r.dst > 0) extra.push(-r.dst);
  if (r.dry) extra.push(r.dry.D0, -r.dry.D0);
  let lo = Math.min(0, ...ys, ...extra),
    hi = Math.max(0, ...ys, ...extra);
  const ty = ticks(lo, hi);
  lo = Math.min(lo, ty[0]);
  hi = Math.max(hi, ty[ty.length - 1]);
  const tx = ticks(0, r.tEnd);
  const tHi = Math.max(r.tEnd, tx[tx.length - 1]);
  const X = (t: number) => x0 + (t / tHi) * w,
    Y = (v: number) => y0 + h - ((v - lo) / (hi - lo || 1)) * h;
  const dy = ty.length > 1 ? Math.abs(ty[1] - ty[0]) : 1;
  const dig = Math.max(2, Math.ceil(-Math.log10(dy || 1)) + 1);
  for (const v of ty)
    out.push(
      `<line class="rt-grid" x1="${x0}" y1="${r1(Y(v))}" x2="${x0 + w}" y2="${r1(Y(v))}"/><text class="rt-tick" x="${x0 - 8}" y="${r1(Y(v) + 4)}" text-anchor="end">${fmt(v, dig)}</text>`,
    );
  for (const t of tx) out.push(`<text class="rt-tick" x="${r1(X(t))}" y="${y0 + h + 18}" text-anchor="middle">${fmt(t, 3)}</text>`);
  out.push(
    `<line class="rt-axis" x1="${x0}" y1="${r1(Y(0))}" x2="${x0 + w}" y2="${r1(Y(0))}"/><line class="rt-axis" x1="${x0}" y1="${y0}" x2="${x0}" y2="${y0 + h}"/>`,
  );
  out.push(
    `<text class="rt-title" x="${x0 - 40}" y="${y0 - 22}">x, ${u}</text><text class="rt-tick" x="${x0 + w}" y="${y0 + h + 36}" text-anchor="end">t, с</text>`,
  );
  if (r.dry)
    out.push(
      `<rect class="os-zone" x="${x0}" y="${r1(Y(r.dry.D0))}" width="${w}" height="${r1(Y(-r.dry.D0) - Y(r.dry.D0))}"/><text class="rt-tick" x="${x0 + w - 4}" y="${r1(Y(r.dry.D0) - 5)}" text-anchor="end">область застоя</text>`,
    );
  if (extra.length && (pr.init.mode === 'drop' || pr.el.rope)) {
    const yy = Y(-r.dst);
    out.push(
      `<line class="os-env" x1="${x0}" y1="${r1(yy)}" x2="${x0 + w}" y2="${r1(yy)}"/><text class="rt-tick" x="${x0 + w - 4}" y="${r1(yy + 15)}" text-anchor="end">элемент не деформирован (x = −δст)</text>`,
    );
  }
  // Огибающая затухающих свободных колебаний.
  if (r.regime === 'under' && !r.forced) {
    const R = Math.hypot(r.C1, r.C2);
    for (const s of [1, -1]) {
      const env = pts.filter((_, i) => i % 8 === 0).map(([t]) => `${r1(X(t))} ${r1(Y(s * R * Math.exp(-r.n * t)))}`);
      out.push(`<path class="os-env" d="M${env.join('L')}"/>`);
    }
  }
  const stepN = Math.max(1, Math.floor(pts.length / 900));
  const sel = pts.filter((_, i) => i % stepN === 0 || i === pts.length - 1);
  // После отрыва груза (удар) или ослабления троса формула неверна — эта часть кривой пунктиром.
  const cut = r.slack != null && r.slack < r.tEnd ? r.slack : Infinity;
  const path = (arr: [number, number][]) => arr.map(([t, v]) => `${r1(X(t))} ${r1(Y(v))}`).join('L');
  const before = sel.filter(([t]) => t <= cut),
    after = sel.filter(([t]) => t >= cut);
  if (before.length > 1) out.push(`<path class="rt-line" d="M${path(before)}"/>`);
  if (after.length > 1) out.push(`<path class="rt-line os-after" d="M${path(after)}"/>`);
  // Наибольшее отклонение и состояние в момент t.
  const mx = r.max;
  const still = r.max.x - r.min.x < 1e-12 * Math.max(1, Math.abs(r.max.x));
  if (still)
    out.push(
      `<text class="rt-tick" x="${x0 + 12}" y="${r1(Y(0) - 12)}">Груз покоится в положении равновесия — задайте x₀ или v₀, чтобы увидеть колебания.</text>`,
    );
  else {
    out.push(
      `<circle class="os-max" cx="${r1(X(mx.t))}" cy="${r1(Y(mx.x))}" r="4.5"><title>x_max = ${fmt(mx.x, 4)} ${u} при t = ${fmt(mx.t, 4)} с</title></circle>`,
    );
    const crowded = Y(mx.x) < y0 + 18 && X(mx.t) < x0 + 70;
    out.push(`<text class="rt-val" x="${r1(X(mx.t) + 9)}" y="${r1(crowded ? Y(mx.x) + 18 : Y(mx.x) - 8)}">x_max = ${fmt(mx.x, 4)}</text>`);
  }
  if (pr.t > 0) {
    const a = r.at;
    out.push(
      `<line class="os-tline" x1="${r1(X(a.t))}" y1="${y0}" x2="${r1(X(a.t))}" y2="${y0 + h}"/><circle class="rt-end" cx="${r1(X(a.t))}" cy="${r1(Y(a.x))}" r="5"><title>t = ${fmt(a.t, 4)} с; x = ${fmt(a.x, 4)} ${u}</title></circle>`,
    );
  }
  if (r.slack != null && r.slack < r.tEnd)
    out.push(
      `<line class="os-slack" x1="${r1(X(r.slack))}" y1="${y0}" x2="${r1(X(r.slack))}" y2="${y0 + h}"/><text class="rt-tick" x="${r1(X(r.slack) + 4)}" y="${y0 + h - 8}">${pr.init.mode === 'drop' ? 'отрыв груза' : 'трос ослаб'}</text>`,
    );
  return out.join('');
}

export function renderOsc(pr: OscProblem, r: OscResult | null): { svg: string; viewBox: string } {
  const out: string[] = [`<rect width="${W}" height="${H}" fill="var(--sheet)"/>`];
  out.push(scheme(pr, r));
  if (r?.ok && r.curve.length > 1) out.push(graph(pr, r, 440, 60, 520, 330));
  else out.push(`<text class="tb-note" x="440" y="${H / 2}">Нет данных для графика — проверьте данные задачи.</text>`);
  out.push(
    `<text class="tb-note" x="440" y="${H - 14}">x отсчитывается от положения статического равновесия; точка — наибольшее отклонение${pr.t > 0 ? ', вертикаль — момент t' : ''}.</text>`,
  );
  return { svg: out.join(''), viewBox: `0 0 ${W} ${H}` };
}
