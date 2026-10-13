/** Чертёж: график цикла напряжений по времени и диаграмма предельных амплитуд (σ_m — σ_a) с рабочей точкой. */
import { fmt } from '../../../shared/format';
import type { CycleResult, FatigueProblem, FatigueResult } from '../model/fatigue';

const r1 = (v: number) => Math.round(v * 10) / 10;
const W = 1000,
  H = 480;

/** Цикл s(t) = s_m + s_a sin 2πt на двух периодах. */
function cyclePlot(x0: number, y0: number, w: number, h: number, c: CycleResult, s: string): string {
  const out: string[] = [];
  const lo = Math.min(0, c.min),
    hi = Math.max(0, c.max);
  const pad = (hi - lo || 1) * 0.12;
  const Y = (v: number) => y0 + h - ((v - (lo - pad)) / (hi - lo + 2 * pad)) * h;
  const X = (t: number) => x0 + (t / 2) * w;
  out.push(
    `<line class="rt-axis" x1="${x0}" y1="${r1(Y(0))}" x2="${x0 + w}" y2="${r1(Y(0))}"/><line class="rt-axis" x1="${x0}" y1="${y0}" x2="${x0}" y2="${y0 + h}"/>`,
  );
  out.push(
    `<text class="rt-title" x="${x0}" y="${y0 - 12}">${s}(t), МПа — ${c.kind.split(' (')[0]}</text><text class="rt-tick" x="${x0 + w}" y="${r1(Y(0) + 16)}" text-anchor="end">t</text>`,
  );
  for (const [v, lab] of [
    [c.max, `${s}_max = ${fmt(c.max, 1)}`],
    [c.min, `${s}_min = ${fmt(c.min, 1)}`],
    [c.m, `${s}_m = ${fmt(c.m, 1)}`],
  ] as const)
    out.push(
      `<line class="rt-grid" x1="${x0}" y1="${r1(Y(v))}" x2="${x0 + w}" y2="${r1(Y(v))}" stroke-dasharray="4 4"/><text class="rt-tick" x="${x0 + w + 6}" y="${r1(Y(v) + 4)}">${lab}</text>`,
    );
  const pts: string[] = [];
  for (let i = 0; i <= 200; i++) {
    const t = (2 * i) / 200;
    pts.push(`${r1(X(t))} ${r1(Y(c.m + c.a * Math.sin(2 * Math.PI * t)))}`);
  }
  out.push(`<path class="rt-line" d="M${pts.join('L')}"/>`);
  return out.join('');
}

/** Диаграмма предельных амплитуд: прямая образца A₀B₀, прямая детали, рабочая точка и предельная на луче из начала. */
function haigh(x0: number, y0: number, w: number, h: number, c: CycleResult, lim: number, ult: number, s: string): string {
  const out: string[] = [];
  const xMax = Math.max(ult, c.m, 1e-9) * 1.08,
    xMin = Math.min(0, c.m) * 1.08;
  const yMax = Math.max(lim, c.a, 1e-9) * 1.12;
  const X = (v: number) => x0 + ((v - xMin) / (xMax - xMin)) * w,
    Y = (v: number) => y0 + h - (v / yMax) * h;
  out.push(
    `<line class="rt-axis" x1="${r1(X(xMin))}" y1="${r1(Y(0))}" x2="${r1(X(xMax))}" y2="${r1(Y(0))}"/><line class="rt-axis" x1="${r1(X(0))}" y1="${y0}" x2="${r1(X(0))}" y2="${y0 + h}"/>`,
  );
  out.push(
    `<text class="rt-title" x="${x0}" y="${y0 - 12}">Диаграмма предельных амплитуд (${s})</text><text class="rt-tick" x="${r1(X(xMax))}" y="${r1(Y(0) + 18)}" text-anchor="end">${s}_m</text><text class="rt-tick" x="${r1(X(0) - 6)}" y="${y0 + 4}" text-anchor="end">${s}_a</text>`,
  );
  out.push(
    `<line class="sb-axis" x1="${r1(X(0))}" y1="${r1(Y(lim))}" x2="${r1(X(ult))}" y2="${r1(Y(0))}"/><text class="rt-tick" x="${r1(X(0) + 6)}" y="${r1(Y(lim) - 6)}">A₀: ${s}₋₁ = ${fmt(lim, 1)}</text><text class="rt-tick" x="${r1(X(ult))}" y="${r1(Y(0) - 6)}" text-anchor="end">B₀</text>`,
  );
  // Подпись прямой детали — над её серединой (у оси σ_a — рабочая точка симметричного цикла).
  const mid = ult * 0.55;
  out.push(
    `<line class="rt-line" x1="${r1(X(0))}" y1="${r1(Y(c.limD))}" x2="${r1(X(ult))}" y2="${r1(Y(0))}"/><text class="rt-tick" x="${r1(X(mid))}" y="${r1(Y(c.limD * (1 - mid / ult)) - 8)}">деталь: ${s}₋₁/K_D = ${fmt(c.limD, 1)}</text>`,
  );
  if (Number.isFinite(c.n) && c.n > 0) {
    const [pm, pa] = [c.m * c.n, c.a * c.n];
    out.push(
      `<line class="mc-guide" x1="${r1(X(0))}" y1="${r1(Y(0))}" x2="${r1(X(pm))}" y2="${r1(Y(pa))}" stroke-dasharray="5 4"/><circle class="rt-end" cx="${r1(X(pm))}" cy="${r1(Y(pa))}" r="4"><title>предельный цикл</title></circle>`,
    );
  }
  // Подпись запаса — справа снизу от рабочей точки (под прямой детали).
  out.push(
    `<circle class="cg-ci" cx="${r1(X(c.m))}" cy="${r1(Y(c.a))}" r="6"/><text class="t-pt" x="${r1(X(c.m) + 12)}" y="${r1(Y(c.a) + 18)}">n = ${Number.isFinite(c.n) ? fmt(c.n, 2) : '∞'}</text>`,
  );
  return out.join('');
}

export function renderFatigue(pr: FatigueProblem, r: FatigueResult): { svg: string; viewBox: string } {
  const out: string[] = [`<rect width="${W}" height="${H}" fill="var(--sheet)"/>`];
  if (!r.ok) {
    out.push(`<text class="tb-note" x="16" y="${H / 2}">Проверьте данные.</text>`);
    return { svg: out.join(''), viewBox: `0 0 ${W} ${H}` };
  }
  const list: [CycleResult, string, number, number][] = [];
  if (r.sigma) list.push([r.sigma, 'σ', pr.sig1, pr.sigB]);
  if (r.tau) list.push([r.tau, 'τ', pr.tau1, r.tau.psi > 0 ? pr.tau1 / r.tau.psi : pr.sigB]);
  const n = list.length;
  const hh = n === 2 ? 150 : 340;
  list.forEach(([c, s, lim, ult], i) => {
    const y = 50 + i * (hh + 70);
    out.push(cyclePlot(50, y, 300, hh, c, s));
    out.push(haigh(560, y, 400, hh, c, lim, ult, s));
  });
  out.push(
    `<text class="tb-note" x="16" y="${H - 10}">A₀B₀ (пунктир) — гладкий образец, синяя прямая — деталь; точка — рабочий цикл, луч из начала — до предельного цикла.</text>`,
  );
  return { svg: out.join(''), viewBox: `0 0 ${W} ${H}` };
}
