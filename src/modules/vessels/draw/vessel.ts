/** Чертёж: сосуд в масштабе (жидкость, газ, опоры, пьезометр) и эпюры σ_t, σ_m по высоте при найденной толщине. */
import { fmt } from '../../../shared/format';
import type { MeridianPt, VesselProblem, VesselResult } from '../model/vessel';

const r1 = (v: number) => Math.round(v * 10) / 10;
const W = 1000,
  H = 560;

export function renderVessel(pr: VesselProblem, r: VesselResult): { svg: string; viewBox: string } {
  const out: string[] = [`<rect width="${W}" height="${H}" fill="var(--sheet)"/>`];
  if (!r.ok) {
    out.push(`<text class="tb-note" x="16" y="${H / 2}">Проверьте участки сосуда и нагрузку.</text>`);
    return { svg: out.join(''), viewBox: `0 0 ${W} ${H}` };
  }
  const top = 60,
    bot = H - 70;
  const rMax = Math.max(...r.pts.map((q) => q.r), 1e-9);
  const tz = (pr.tube ?? 0) > 0 ? pr.tube! : pr.rho > 0 && pr.level > r.height + 1e-9 ? pr.level : 0;
  const zTop = Math.max(r.height, pr.level, tz);
  const k = Math.min(300 / (2 * rMax), (bot - top) / Math.max(zTop, 1e-9));
  const cx = 200;
  const Y = (z: number) => bot - z * k;
  const pts = r.pts;
  // Жидкость и газ.
  const below = pts.filter((q) => q.z <= pr.level + 1e-12);
  if (pr.rho > 0 && below.length > 1) {
    const zl = Math.min(pr.level, r.height);
    const right = below.map((q) => `${r1(cx + q.r * k)} ${r1(Y(q.z))}`);
    const left = below
      .slice()
      .reverse()
      .map((q) => `${r1(cx - q.r * k)} ${r1(Y(q.z))}`);
    out.push(`<path class="vs-liq" d="M${right.join('L')}L${left.join('L')}Z"/>`);
    if (pr.level < r.height) {
      const q = pts.reduce((a, c) => (Math.abs(c.z - zl) < Math.abs(a.z - zl) ? c : a));
      out.push(`<line class="vs-level" x1="${r1(cx - q.r * k)}" y1="${r1(Y(zl))}" x2="${r1(cx + q.r * k)}" y2="${r1(Y(zl))}"/>`);
    }
  }
  if (pr.pg > 0) {
    const above = pts.filter((q) => q.z >= Math.min(pr.level, r.height) - 1e-12);
    if (above.length > 1) {
      const right = above.map((q) => `${r1(cx + q.r * k)} ${r1(Y(q.z))}`);
      const left = above
        .slice()
        .reverse()
        .map((q) => `${r1(cx - q.r * k)} ${r1(Y(q.z))}`);
      out.push(`<path class="vs-gas" d="M${right.join('L')}L${left.join('L')}Z"/><text class="t vs-t" x="${cx}" y="${r1(Y((Math.min(pr.level, r.height) + r.height) / 2) + 5)}" text-anchor="middle">p<tspan dy="4" class="mc-sub">г</tspan></text>`);
    }
  }
  // Стенка: по участкам; плоские кольца и днища на стыках/концах — горизонтальные отрезки.
  for (let i = 0; i < pr.segs.length; i++) {
    const ps = pts.filter((q) => q.seg === i);
    for (const s of [1, -1]) out.push(`<path class="vs-wall" d="M${ps.map((q) => `${r1(cx + s * q.r * k)} ${r1(Y(q.z))}`).join('L')}"/>`);
  }
  const ends: { z: number; r: number }[] = [];
  const first = pts[0],
    last = pts[pts.length - 1];
  if (first.r > 1e-6 * rMax) ends.push(first);
  if (last.r > 1e-6 * rMax) ends.push(last);
  for (let i = 1; i < pr.segs.length; i++) {
    const a = pts.filter((q) => q.seg === i - 1).pop()!,
      b = pts.find((q) => q.seg === i)!;
    if (Math.abs(a.r - b.r) > 1e-6 * rMax) out.push(`<line class="vs-wall" x1="${r1(cx + a.r * k)}" y1="${r1(Y(a.z))}" x2="${r1(cx + b.r * k)}" y2="${r1(Y(b.z))}"/><line class="vs-wall" x1="${r1(cx - a.r * k)}" y1="${r1(Y(a.z))}" x2="${r1(cx - b.r * k)}" y2="${r1(Y(b.z))}"/>`);
  }
  for (const e of ends) out.push(`<line class="vs-wall" x1="${r1(cx - e.r * k)}" y1="${r1(Y(e.z))}" x2="${r1(cx + e.r * k)}" y2="${r1(Y(e.z))}"/>`);
  out.push(`<line class="vs-axis" x1="${cx}" y1="${r1(Y(zTop) - 16)}" x2="${cx}" y2="${bot + 16}"/>`);
  // Пьезометр.
  if (tz > 0) {
    // Трубка выходит из стенки у низа сосуда (ниже уровня жидкости) и поднимается до своего уровня.
    const x = cx - rMax * k - 30;
    const zj = Math.min(pr.level, r.height) / 2;
    const qj = pts.reduce((a, c) => (Math.abs(c.z - zj) < Math.abs(a.z - zj) ? c : a));
    out.push(`<path class="vs-wall" d="M${r1(cx - qj.r * k)} ${r1(Y(zj))}H${r1(x)}V${r1(Y(tz) - 12)}"/><line class="vs-tube" x1="${r1(x)}" y1="${r1(Y(zj))}" x2="${r1(x)}" y2="${r1(Y(tz))}"/><line class="vs-level" x1="${r1(x - 7)}" y1="${r1(Y(tz))}" x2="${r1(x + 7)}" y2="${r1(Y(tz))}"/><text class="t vs-t" x="${r1(x - 10)}" y="${r1(Y(tz) - 6)}" text-anchor="end">пьезометр</text>`);
  }
  // Опоры.
  if (pr.support === 'ground') out.push(`<line class="mc-ground" x1="${r1(cx - rMax * k - 30)}" y1="${bot + 2}" x2="${r1(cx + rMax * k + 30)}" y2="${bot + 2}"/>`);
  else {
    const q = pts.reduce((a, c) => (Math.abs(c.z - pr.zs) < Math.abs(a.z - pr.zs) ? c : a));
    for (const s of [1, -1]) {
      const x = cx + s * q.r * k,
        y = Y(pr.zs);
      out.push(`<path class="mc-pivot" d="M${r1(x)} ${r1(y)}L${r1(x + s * 22)} ${r1(y)}L${r1(x + s * 22)} ${r1(y + 10)}Z"/><line class="mc-ground" x1="${r1(x + s * 14)}" y1="${r1(y + 12)}" x2="${r1(x + s * 32)}" y2="${r1(y + 12)}"/>`);
    }
  }
  // Эпюры σ_t и σ_m (МПа при найденной толщине); у каждой своя ось.
  const d = r.delta || 1;
  const panel = (x0: number, w: number, key: 'Nt' | 'Nm', title: string) => {
    const vals = pts.map((q) => q[key] / d);
    const m = Math.max(...vals.map(Math.abs), 1e-12);
    const hasNeg = vals.some((s) => s < -1e-9 * m);
    const ax = hasNeg ? x0 + w / 2 : x0 + 10;
    const kk = (hasNeg ? w / 2 - 10 : w - 20) / m;
    const X = (s: number) => ax + s * kk;
    out.push(`<line class="rt-axis" x1="${r1(ax)}" y1="${r1(Y(r.height) - 10)}" x2="${r1(ax)}" y2="${bot + 10}"/><text class="rt-title" x="${r1(x0)}" y="${top - 26}">${title}, МПа</text>`);
    for (let i = 0; i < pr.segs.length; i++) {
      const ps: MeridianPt[] = pts.filter((q) => q.seg === i);
      const line = ps.map((q) => `${r1(X(q[key] / d))} ${r1(Y(q.z))}`);
      out.push(`<path class="vs-ep" d="M${r1(ax)} ${r1(Y(ps[0].z))}L${line.join('L')}L${r1(ax)} ${r1(Y(ps[ps.length - 1].z))}Z"/>`);
      // Штриховка — горизонтальные линии.
      for (let j = 0; j < ps.length; j += 12) out.push(`<line class="vs-hatch" x1="${r1(ax)}" y1="${r1(Y(ps[j].z))}" x2="${r1(X(ps[j][key] / d))}" y2="${r1(Y(ps[j].z))}"/>`);
    }
    // Подписи: концы участков и экстремумы, без наложений.
    const marks: MeridianPt[] = [];
    for (let i = 0; i < pr.segs.length; i++) {
      const ps = pts.filter((q) => q.seg === i);
      marks.push(ps[0], ps[ps.length - 1], ps.reduce((a, q) => (Math.abs(q[key]) > Math.abs(a[key]) ? q : a)));
    }
    const used: number[] = [];
    for (const q of marks.sort((a, b) => Math.abs(b[key]) - Math.abs(a[key]))) {
      const y = Y(q.z);
      if (Math.abs(q[key] / d) < 1e-6 * m || used.some((u) => Math.abs(u - y) < 14)) continue;
      used.push(y);
      const s = q[key] / d;
      out.push(`<text class="rt-tick vs-val" x="${r1(X(s) + (s >= 0 ? 4 : -4))}" y="${r1(y + 4)}" text-anchor="${s >= 0 ? 'start' : 'end'}">${fmt(s, 3)}</text>`);
    }
  };
  panel(430, 250, 'Nt', 'σ_t');
  panel(720, 250, 'Nm', 'σ_m');
  out.push(`<text class="tb-note" x="16" y="${H - 34}">Сосуд в масштабе; эпюры — при δ = ${fmt(r.delta * 1000, 4)} мм (безмоментная теория, скачки — на стыках участков).</text>`);
  out.push(`<text class="tb-note" x="16" y="${H - 14}">Опасное сечение z = ${fmt(r.crit!.z, 4)} м: σ_экв = [σ] = ${fmt(pr.sigma, 4)} МПа.</text>`);
  return { svg: out.join(''), viewBox: `0 0 ${W} ${H}` };
}
