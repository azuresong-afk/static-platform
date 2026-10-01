/**
 * Чертёж: для уравнения вращения — графики ω(t) и φ(t) (два графика, каждый со своей осью);
 * для сохранения кинетического момента — вид сверху «до» и «после»: тела и точки на своих радиусах.
 */
import { fmt } from '../../../shared/format';
import type { EqResult, KItem, KResult } from '../model/rotation';

const r1 = (v: number) => Math.round(v * 10) / 10;
const W = 1000,
  H = 480;

/** «Красивые» деления оси. */
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

function plot(x0: number, y0: number, w: number, h: number, pts: [number, number][], title: string, unit: string, tUnit: string): string {
  const ts = pts.map((p) => p[0]),
    ys = pts.map((p) => p[1]);
  const tMax = Math.max(1e-9, ...ts);
  let yLo = Math.min(0, ...ys),
    yHi = Math.max(0, ...ys);
  const ty = ticks(yLo, yHi);
  yLo = Math.min(yLo, ty[0]);
  yHi = Math.max(yHi, ty[ty.length - 1]);
  const tx = ticks(0, tMax);
  const tHi = Math.max(tMax, tx[tx.length - 1]);
  const X = (t: number) => x0 + (t / tHi) * w,
    Y = (v: number) => y0 + h - ((v - yLo) / (yHi - yLo || 1)) * h;
  const out: string[] = [];
  for (const v of ty) out.push(`<line class="rt-grid" x1="${x0}" y1="${r1(Y(v))}" x2="${x0 + w}" y2="${r1(Y(v))}"/><text class="rt-tick" x="${x0 - 8}" y="${r1(Y(v) + 4)}" text-anchor="end">${fmt(v, 3)}</text>`);
  for (const t of tx) out.push(`<text class="rt-tick" x="${r1(X(t))}" y="${y0 + h + 18}" text-anchor="middle">${fmt(t, 3)}</text>`);
  out.push(`<line class="rt-axis" x1="${x0}" y1="${r1(Y(0))}" x2="${x0 + w}" y2="${r1(Y(0))}"/><line class="rt-axis" x1="${x0}" y1="${y0}" x2="${x0}" y2="${y0 + h}"/>`);
  out.push(`<text class="rt-title" x="${x0}" y="${y0 - 14}">${title}, ${unit}</text><text class="rt-tick" x="${x0 + w}" y="${y0 + h + 36}" text-anchor="end">t, ${tUnit}</text>`);
  // Прореживаем точки до ~600.
  const stepN = Math.max(1, Math.floor(pts.length / 600));
  const sel = pts.filter((_, i) => i % stepN === 0 || i === pts.length - 1);
  out.push(`<path class="rt-line" d="M${sel.map(([t, v]) => `${r1(X(t))} ${r1(Y(v))}`).join('L')}"/>`);
  const [te, ve] = pts[pts.length - 1];
  const ex = X(te),
    ey = Y(ve);
  out.push(`<circle class="rt-end" cx="${r1(ex)}" cy="${r1(ey)}" r="5"><title>t = ${fmt(te, 4)} ${tUnit}; ${title} = ${fmt(ve, 4)} ${unit}</title></circle>`);
  out.push(`<text class="rt-val cv-t" x="${r1(ex - 10)}" y="${r1(ey < y0 + 20 ? ey + 22 : ey - 12)}" text-anchor="end">${fmt(ve, 4)}</text>`);
  return out.join('');
}

export function renderEq(r: EqResult): { svg: string; viewBox: string } {
  const out: string[] = [`<rect width="${W}" height="${H}" fill="var(--sheet)"/>`];
  if (!r.ok || r.curve.length < 2) {
    out.push(`<text class="tb-note" x="16" y="${H / 2}">Нет данных для графиков.</text>`);
    return { svg: out.join(''), viewBox: `0 0 ${W} ${H}` };
  }
  const pw = 380,
    ph = 330;
  out.push(plot(80, 60, pw, ph, r.curve.map((c) => [c.t, c.w]), 'ω', 'рад/с', 'с'));
  out.push(plot(80 + pw + 110, 60, pw, ph, r.curve.map((c) => [c.t, c.phi]), 'φ', 'рад', 'с'));
  out.push(`<text class="tb-note" x="16" y="${H - 14}">Угловая скорость и угол поворота по времени; точка — искомое состояние (наведите, чтобы увидеть значения).</text>`);
  return { svg: out.join(''), viewBox: `0 0 ${W} ${H}` };
}

export function renderK(items: KItem[], r: KResult): { svg: string; viewBox: string } {
  const out: string[] = [`<rect width="${W}" height="${H}" fill="var(--sheet)"/>`];
  const rMax = Math.max(1e-9, ...items.filter((i) => i.kind === 'point').flatMap((i) => [i.r1, i.r2]));
  const R = 150;
  const scene = (cx: number, after: boolean) => {
    const w = after ? r.w2 : null;
    out.push(`<circle class="en-wheel" cx="${cx}" cy="230" r="${R}"/><circle class="hinge" cx="${cx}" cy="230" r="5"/>`);
    const pts = items.map((it, i) => ({ it, i })).filter((x) => x.it.kind === 'point');
    pts.forEach(({ it, i }, k) => {
      const rr = ((after ? it.r2 : it.r1) / rMax) * (R - 14);
      const a = -Math.PI / 2 + (2 * Math.PI * k) / Math.max(1, pts.length);
      const x = cx + rr * Math.cos(a),
        y = 230 + rr * Math.sin(a);
      out.push(`<line class="in-d" x1="${cx}" y1="230" x2="${r1(x)}" y2="${r1(y)}"/><circle class="cg-mass" cx="${r1(x)}" cy="${r1(y)}" r="8"/><text class="t cv-t en-vt" x="${r1(x + 12)}" y="${r1(y - 10)}">${i + 1}</text>`);
      const u = after ? it.u2 : it.u1;
      if (u) {
        const s = Math.sign(u);
        const tx = -Math.sin(a) * s,
          ty = Math.cos(a) * s;
        out.push(`<line class="en-v" x1="${r1(x)}" y1="${r1(y)}" x2="${r1(x + tx * 26)}" y2="${r1(y + ty * 26)}"/><path class="en-v-f" d="M${r1(x + tx * 34)} ${r1(y + ty * 34)}l${r1(-tx * 10 - ty * 4)} ${r1(-ty * 10 + tx * 4)}l${r1(ty * 8)} ${r1(-tx * 8)}Z"/>`);
      }
    });
    const ws = after ? (w ?? 0) : items[0]?.w1 ?? 0;
    const lab = after ? `после: ω = ${fmt(ws, 4)} рад/с` : `до: ${items.map((it) => fmt(it.w1, 3)).filter((x, i, a) => a.indexOf(x) === i).length > 1 ? 'ω у тел разные' : `ω = ${fmt(ws, 4)} рад/с`}`;
    out.push(`<text class="rt-title" x="${cx}" y="${230 + R + 36}" text-anchor="middle">${lab}</text>`);
    if (Math.abs(ws) > 1e-12) {
      const ccw = ws > 0;
      out.push(`<path class="en-mom" d="M${cx + R + 16} 230A${R + 16} ${R + 16} 0 0 ${ccw ? 0 : 1} ${cx} ${230 - (R + 16) * (ccw ? 1 : -1)}"/>`);
    }
  };
  if (r.ok) {
    scene(260, false);
    scene(740, true);
    out.push(`<text class="rt-title" x="500" y="236" text-anchor="middle">K = ${fmt(r.K, 4)}</text><path class="en-v-f" d="M520 250l-12 -6v12Z"/><line class="en-v" x1="470" y1="250" x2="510" y2="250"/>`);
  }
  out.push(`<text class="tb-note" x="16" y="${H - 14}">Вид сверху. Точки — на своих радиусах; стрелки — скорость относительно тела. Положительное вращение — против часовой стрелки.</text>`);
  return { svg: out.join(''), viewBox: `0 0 ${W} ${H}` };
}
