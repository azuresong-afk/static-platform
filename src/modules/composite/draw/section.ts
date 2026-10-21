/** Чертёж составного сечения: части, центр тяжести, центральные оси, нейтральный слой, эпюра σ справа. */
import { fmt } from '../../../shared/format';
import type { SectionResult } from '../model/section';
import { partName } from '../text/solution';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const r1 = (v: number) => Math.round(v * 10) / 10;

export function renderSection(r: SectionResult, M: number): { svg: string; viewBox: string } {
  const W = 1000,
    H = 440;
  const pts = r.parts.flatMap((p) => p.poly);
  const x0 = Math.min(...pts.map((p) => p[0])),
    x1 = Math.max(...pts.map((p) => p[0]));
  const y0 = Math.min(...pts.map((p) => p[1])),
    y1 = Math.max(...pts.map((p) => p[1]));
  const k = Math.min(520 / (x1 - x0), 340 / (y1 - y0));
  const ox = 130 + (520 - (x1 - x0) * k) / 2 - x0 * k;
  const oy = 50 + (340 - (y1 - y0) * k) / 2 + y1 * k;
  const S = (x: number, y: number): [number, number] => [r1(ox + x * k), r1(oy - y * k)];
  const out: string[] = [];
  r.parts.forEach((p, i) => {
    out.push(`<path class="cs-part cs-p${i % 4}" d="M${p.poly.map(([x, y]) => S(x, y).join(' ')).join('L')}Z"/>`);
    const [cx, cy] = S(p.X, p.Y);
    out.push(`<circle class="cs-pc" cx="${cx}" cy="${cy}" r="2.5"/><text class="cs-pl" x="${cx + 5}" y="${cy - 5}">${i + 1}</text>`);
  });
  // Центральные оси и нейтральный слой.
  const [Cx, Cy] = S(r.xc, r.yc);
  const left = S(x0, 0)[0] - 30,
    right = S(x1, 0)[0] + 30,
    top = S(0, y1)[1] - 24,
    bottom = S(0, y0)[1] + 24;
  out.push(`<line class="cs-axis" x1="${Cx}" y1="${top}" x2="${Cx}" y2="${bottom}"/><text class="cs-at" x="${Cx + 6}" y="${top + 4}">Y</text>`);
  const dy = (x: number) => r.neutralSlope * (x - r.xc);
  const nl = S(x0 - 30 / k, r.yc + dy(x0 - 30 / k)),
    nr = S(x1 + 30 / k, r.yc + dy(x1 + 30 / k));
  out.push(`<line class="cs-neutral" x1="${nl[0]}" y1="${nl[1]}" x2="${nr[0]}" y2="${nr[1]}"/><text class="cs-at" x="${right + 4}" y="${nr[1] + 4}">X</text>`);
  out.push(`<text class="cs-nt" x="${left}" y="${nl[1] - 6}">нейтральный слой</text>`);
  if (!r.principalXY) {
    const a = (r.alpha * Math.PI) / 180,
      L = 0.45 * (x1 - x0);
    const u0 = S(r.xc - L * Math.cos(a), r.yc - L * Math.sin(a)),
      u1 = S(r.xc + L * Math.cos(a), r.yc + L * Math.sin(a));
    out.push(`<line class="cs-principal" x1="${u0[0]}" y1="${u0[1]}" x2="${u1[0]}" y2="${u1[1]}"/><text class="cs-at" x="${u1[0] + 4}" y="${u1[1]}">u</text>`);
  }
  out.push(`<circle class="cs-c" cx="${Cx}" cy="${Cy}" r="5"/><text class="cs-ct" x="${Cx + 8}" y="${Cy + 18}">C</text>`);
  // Размеры до крайних волокон.
  const dimX = left - 10;
  const yt = S(0, y1)[1],
    yb = S(0, y0)[1];
  out.push(`<line class="cs-dim" x1="${dimX}" y1="${yt}" x2="${dimX}" y2="${Cy}"/><line class="cs-dim" x1="${dimX}" y1="${Cy}" x2="${dimX}" y2="${yb}"/>`);
  out.push(`<text class="cs-dt" x="${dimX - 6}" y="${r1((yt + Cy) / 2)}" text-anchor="end">${esc(fmt(r.yTop * 10, 1))}</text><text class="cs-dt" x="${dimX - 6}" y="${r1((yb + Cy) / 2)}" text-anchor="end">${esc(fmt(r.yBottom * 10, 1))}</text>`);
  // Эпюра σ (при M > 0 — сжаты верхние волокна).
  const ex = 800,
    amp = 110;
  const sTop = -1 / r.WxTop,
    sBot = 1 / r.WxBottom;
  const smax = Math.max(Math.abs(sTop), Math.abs(sBot));
  const Xs = (s: number) => r1(ex + (s / smax) * amp);
  out.push(`<line class="cs-base" x1="${ex}" y1="${yt - 16}" x2="${ex}" y2="${yb + 16}"/><line class="cs-guide" x1="${right}" y1="${Cy}" x2="${ex}" y2="${Cy}"/>`);
  out.push(`<path class="cs-sig cs-comp" d="M${ex} ${yt}L${Xs(sTop)} ${yt}L${ex} ${Cy}Z"/><path class="cs-sig cs-ten" d="M${ex} ${yb}L${Xs(sBot)} ${yb}L${ex} ${Cy}Z"/>`);
  for (let yy = yt + 6; yy < yb; yy += 8) {
    const s = yy < Cy ? (sTop * (Cy - yy)) / (Cy - yt) : (sBot * (yy - Cy)) / (yb - Cy);
    out.push(`<line class="cs-hatch" x1="${ex}" y1="${yy}" x2="${Xs(s)}" y2="${yy}"/>`);
  }
  const lab = (s: number) => (M ? `${fmt(s * 1e3 * M, 1)} МПа` : `${fmt(s * 1e3, 3)}·M`);
  out.push(`<text class="cs-sv" x="${Xs(sTop) - 4}" y="${yt - 6}" text-anchor="end">${esc(lab(sTop))}</text><text class="cs-sv" x="${Xs(sBot) + 4}" y="${yb + 16}">${esc(lab(sBot))}</text>`);
  out.push(`<text class="cs-sn" x="${ex}" y="${yt - 26}" text-anchor="middle">σ${M ? ', МПа' : ' (M в кН·м)'}</text>`);
  // Наиболее нагруженная точка.
  const [px, py] = S(r.xc + r.critical.x, r.yc + r.critical.y);
  out.push(`<circle class="cs-crit" cx="${px}" cy="${py}" r="7"/><text class="cs-critt" x="${px + 10}" y="${py + (r.critical.y > 0 ? -8 : 18)}">σmax</text>`);
  out.push(`<text class="cs-note" x="12" y="${H - 8}">${esc(r.parts.map((p, i) => `${i + 1} — ${partName(p.part)}`).join('; '))}. Размеры — мм.</text>`);
  return { svg: out.join(''), viewBox: `0 0 ${W} ${H}` };
}
