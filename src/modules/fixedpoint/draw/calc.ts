/** Чертёж задач по формулам: столбики значений результата; для шарнира Кардана — график ω₂/ω₁ за оборот. */
import { fmt } from '../../../shared/format';
import type { CalcResult } from '../model/calc';

const W = 1000,
  H = 520;
const r1 = (v: number) => Math.round(v * 10) / 10;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function renderCalc(r: CalcResult) {
  const out = [`<rect width="${W}" height="${H}" fill="var(--sheet)"/>`];
  const wrap = () => ({ svg: out.join(''), viewBox: `0 0 ${W} ${H}` });
  if (!r.ok) {
    out.push(`<text class="tb-note" x="16" y="${H / 2}">Проверьте данные.</text>`);
    return wrap();
  }
  if (r.curve) {
    const { x, y } = r.curve;
    const lo = Math.min(...y, 1) * 0.98,
      hi = Math.max(...y, 1) * 1.02;
    const px = (v: number) => 70 + (v / 360) * 880;
    const py = (v: number) => 440 - ((v - lo) / (hi - lo || 1)) * 380;
    out.push(`<line class="cv-axis" x1="70" y1="440" x2="950" y2="440"/><line class="cv-axis" x1="70" y1="60" x2="70" y2="440"/>`);
    out.push(`<polyline class="cv-curve" fill="none" points="${x.map((v, i) => `${r1(px(v))},${r1(py(y[i]))}`).join(' ')}"/>`);
    for (const d of [0, 90, 180, 270, 360]) out.push(`<text class="t cv-t" x="${r1(px(d))}" y="462" text-anchor="middle">${d}°</text>`);
    for (const v of [lo, 1, hi]) out.push(`<text class="t cv-t" x="62" y="${r1(py(v) + 4)}" text-anchor="end">${fmt(v, 3)}</text>`);
    out.push(`<text class="tb-note" x="16" y="${H - 14}">ω₂/ω₁ в зависимости от угла φ вилки ведущего вала</text>`);
    return wrap();
  }
  const rows = r.rows.slice(0, 12);
  const m = Math.max(1e-300, ...rows.map((q) => Math.abs(q.value)));
  const step = Math.min(40, 440 / rows.length);
  rows.forEach((q, i) => {
    const y = 40 + i * step;
    const w = (Math.abs(q.value) / m) * 380;
    out.push(
      `<text class="t cv-t" x="16" y="${r1(y + 14)}">${esc(q.label.length > 34 ? q.label.slice(0, 33) + '…' : q.label)}</text>`,
      `<rect class="fp-w-f" x="400" y="${r1(y)}" width="${r1(Math.max(1, w))}" height="${r1(step * 0.6)}" opacity="0.55"/>`,
      `<text class="t cv-t" x="${r1(404 + w)}" y="${r1(y + 14)}">${fmt(q.value, 4)} ${esc(q.unit)}</text>`,
    );
  });
  return wrap();
}
