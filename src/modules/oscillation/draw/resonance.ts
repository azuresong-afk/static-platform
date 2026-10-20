/**
 * Резонансная кривая: безразмерная амплитуда B/B_ref и сдвиг фазы ε от z = p/k. Кривая задачи — жирная, для
 * сравнения — тонкие кривые при ζ = 0,05…1; точка — текущая частота возмущения, горизонталь на половине высоты
 * резонанса — «половинная ширина» (Мещерский 53.37).
 */
import { fmt } from '../../../shared/format';
import type { Resonance } from '../model/resonance';

const r1 = (v: number) => Math.round(v * 10) / 10;
const W = 1000,
  H = 470;
const FAM = 'fill:none;stroke:var(--ink-3);stroke-width:1;opacity:.55';
const BAR = 'stroke:var(--warn);stroke-width:2';
const TXT = 'font-family:"Golos Text",system-ui,sans-serif;font-size:12px;fill:var(--ink-3)';

export function renderResonance(rs: Resonance): { svg: string; viewBox: string } {
  const out: string[] = [`<rect width="${W}" height="${H}" fill="var(--sheet)"/>`];
  const zMax = rs.curve[rs.curve.length - 1].z;
  // Верхние границы по высоте: не выше 6 (пик при ζ = 0,05 — 10 — обрезается).
  const peak = Math.max(...rs.curve.map((p) => p.eta));
  const yMax = Math.min(6, Math.max(2, Math.ceil(peak * 1.1)));
  const x0 = 70,
    w = 880,
    yA = 40,
    hA = 280,
    yB = 350,
    hB = 70;
  const X = (z: number) => x0 + (z / zMax) * w,
    YA = (e: number) => yA + hA - (Math.min(e, yMax * 1.02) / yMax) * hA,
    YB = (e: number) => yB + hB - (e / Math.PI) * hB;
  const stepY = yMax <= 3 ? 0.5 : 1;
  for (let v = 0; v <= yMax + 1e-9; v += stepY)
    out.push(
      `<line class="rt-grid" x1="${x0}" y1="${r1(YA(v))}" x2="${x0 + w}" y2="${r1(YA(v))}"/><text class="rt-tick" x="${x0 - 8}" y="${r1(YA(v) + 4)}" text-anchor="end">${fmt(v, 1)}</text>`,
    );
  for (let z = 0; z <= zMax + 1e-9; z += 0.5)
    out.push(
      `<line class="rt-grid" x1="${r1(X(z))}" y1="${yA}" x2="${r1(X(z))}" y2="${yB + hB}"/><text class="rt-tick" x="${r1(X(z))}" y="${yB + hB + 18}" text-anchor="middle">${fmt(z, 1)}</text>`,
    );
  out.push(
    `<line class="rt-axis" x1="${x0}" y1="${yA + hA}" x2="${x0 + w}" y2="${yA + hA}"/><line class="rt-axis" x1="${x0}" y1="${yA}" x2="${x0}" y2="${yA + hA}"/>`,
  );
  out.push(
    `<line class="rt-axis" x1="${x0}" y1="${yB + hB}" x2="${x0 + w}" y2="${yB + hB}"/><line class="rt-axis" x1="${x0}" y1="${yB}" x2="${x0}" y2="${yB + hB}"/>`,
  );
  out.push(
    `<text class="rt-title" x="${x0 - 56}" y="${yA - 16}">${rs.rotor ? 'B/(H₀/m)' : 'B/(H/c)'}</text><text class="rt-tick" x="${x0 + w}" y="${yB + hB + 36}" text-anchor="end">z = p/k</text>`,
  );
  out.push(`<text class="rt-title" x="${x0 - 56}" y="${yB - 8}">ε</text>`);
  for (const v of [0, Math.PI / 2, Math.PI])
    out.push(`<text class="rt-tick" x="${x0 - 8}" y="${r1(YB(v) + 4)}" text-anchor="end">${v === 0 ? '0' : v === Math.PI ? 'π' : 'π/2'}</text>`);

  // Семейство.
  for (const fm of rs.family) {
    if (Math.abs(fm.zeta - rs.zeta) < 1e-3) continue;
    const pts = fm.curve.map((p) => `${r1(X(p.z))} ${r1(YA(p.eta))}`);
    out.push(`<path style="${FAM}" d="M${pts.join('L')}"/>`);
    const last = fm.curve.filter((p) => p.eta <= yMax).pop()!;
    const q = fm.curve.reduce((a, p) => (p.eta > a.eta ? p : a));
    const lab = q.eta <= yMax ? q : last;
    out.push(`<text style="${TXT}" x="${r1(X(lab.z) + 4)}" y="${r1(YA(lab.eta) - 4)}">ζ=${fmt(fm.zeta, 2)}</text>`);
  }
  // Кривая задачи.
  if (rs.zeta > 0) {
    out.push(`<path class="rt-line" d="M${rs.curve.map((p) => `${r1(X(p.z))} ${r1(YA(p.eta))}`).join('L')}"/>`);
    out.push(`<path class="rt-line" style="stroke:var(--ink-2);stroke-width:1.6" d="M${rs.curve.map((p) => `${r1(X(p.z))} ${r1(YB(p.eps))}`).join('L')}"/>`);
  } else {
    out.push(`<text class="rt-tick" x="${x0 + 14}" y="${yA + 18}">Без сопротивления амплитуда при z = 1 бесконечна (кривая показана только при ζ > 0).</text>`);
  }
  out.push(
    `<line class="os-dim" x1="${r1(X(1))}" y1="${yA}" x2="${r1(X(1))}" y2="${yB + hB}"/><text class="rt-tick" x="${r1(X(1) + 4)}" y="${yA + 12}">z = 1</text>`,
  );
  // Максимум.
  if (rs.zStar != null && rs.etaMax != null && rs.etaMax <= yMax * 1.02)
    out.push(
      `<circle class="os-max" cx="${r1(X(rs.zStar))}" cy="${r1(YA(rs.etaMax))}" r="4.5"><title>максимум: z* = ${fmt(rs.zStar, 4)}, высота ${fmt(rs.etaMax, 4)}</title></circle><text class="rt-val" x="${r1(X(rs.zStar) + 9)}" y="${r1(YA(rs.etaMax) - 8)}">z* = ${fmt(rs.zStar, 3)}</text>`,
    );
  // Половинная ширина.
  const hf = rs.half;
  if (hf && hf.etaRes / 2 <= yMax) {
    const yy = YA(hf.etaRes / 2);
    out.push(
      `<line style="${BAR}" x1="${r1(X(hf.z1))}" y1="${r1(yy)}" x2="${r1(X(hf.z2))}" y2="${r1(yy)}"/><text class="rt-val" x="${r1((X(hf.z1) + X(hf.z2)) / 2)}" y="${r1(yy - 7)}" text-anchor="middle">Δ = ${fmt(hf.width, 3)}</text>`,
    );
  }
  // Текущая частота.
  if (rs.etaNow != null && rs.z <= zMax) {
    out.push(
      `<line class="os-tline" x1="${r1(X(rs.z))}" y1="${yA}" x2="${r1(X(rs.z))}" y2="${yB + hB}"/><circle class="rt-end" cx="${r1(X(rs.z))}" cy="${r1(YA(rs.etaNow))}" r="5"><title>z = ${fmt(rs.z, 4)}; B/B_ref = ${fmt(rs.etaNow, 4)}</title></circle>`,
    );
    const q = rs.curve.reduce((a, p) => (Math.abs(p.z - rs.z) < Math.abs(a.z - rs.z) ? p : a));
    out.push(`<circle class="rt-end" cx="${r1(X(rs.z))}" cy="${r1(YB(q.eps))}" r="4"/>`);
  }
  out.push(
    `<text class="tb-note" x="${x0}" y="${H - 8}">Жирная кривая — система задачи (ζ = n/k = ${fmt(rs.zeta, 3)}), тонкие — для сравнения; серая — сдвиг фазы ε; точка — частота возмущения${yMax < peak ? '; пик обрезан' : ''}.</text>`,
  );
  return { svg: out.join(''), viewBox: `0 0 ${W} ${H}` };
}
