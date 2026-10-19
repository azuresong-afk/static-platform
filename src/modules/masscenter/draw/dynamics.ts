/** Чертежи: тела до и после (количество движения), струя через контур, схема мощностей. */
import { fmt } from '../../../shared/format';
import type { JetProblem, JetResult, MomentumProblem, MomentumResult, PowerProblem, PowerResult } from '../model/dynamics';

const r1 = (v: number) => Math.round(v * 10) / 10;
const W = 1000,
  H = 480;
type P2 = [number, number];
const bg = `<rect width="${W}" height="${H}" fill="var(--sheet)"/>`;
const wrap = (out: string[]) => ({ svg: out.join(''), viewBox: `0 0 ${W} ${H}` });
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function arrow(a: P2, bb: P2, cls: string) {
  const dx = bb[0] - a[0],
    dy = bb[1] - a[1],
    L = Math.hypot(dx, dy) || 1,
    ux = dx / L,
    uy = dy / L;
  return `<line class="${cls}" x1="${r1(a[0])}" y1="${r1(a[1])}" x2="${r1(bb[0] - ux * 8)}" y2="${r1(bb[1] - uy * 8)}"/><path class="${cls}-f" d="M${r1(bb[0])} ${r1(bb[1])}L${r1(bb[0] - ux * 11 - uy * 4.5)} ${r1(bb[1] - uy * 11 + ux * 4.5)}L${r1(bb[0] - ux * 11 + uy * 4.5)} ${r1(bb[1] - uy * 11 - ux * 4.5)}Z"/>`;
}

export function renderMomentum(pr: MomentumProblem, r: MomentumResult) {
  const out = [bg];
  if (!r.ok) return wrap(out);
  const n = pr.bodies.length;
  const vmax = Math.max(1e-9, ...r.abs0.map(Math.abs), ...r.abs1.map(Math.abs));
  const k = 70 / vmax;
  const mmax = Math.max(...r.masses);
  for (const [st, y, label] of [
    [0, 150, 'до'],
    [1, 360, 'после'],
  ] as const) {
    out.push(`<line class="en-ground" x1="60" y1="${y + 30}" x2="${W - 60}" y2="${y + 30}"/><text class="t cv-t" x="30" y="${y + 5}">${label}</text>`);
    pr.bodies.forEach((bd, i) => {
      const cx = 80 + ((W - 160) * (i + 0.5)) / n;
      const sz = 18 + 22 * Math.sqrt(r.masses[i] / mmax);
      out.push(
        `<rect class="en-load" x="${r1(cx - sz)}" y="${r1(y + 30 - 2 * sz * 0.75)}" width="${r1(2 * sz)}" height="${r1(1.5 * sz)}"/><text class="t cv-t en-vt" x="${r1(cx)}" y="${r1(y + 30 - 1.5 * sz - 8)}" text-anchor="middle">${i + 1}${bd.name ? ` ${esc(bd.name)}` : ''}</text>`,
      );
      const vv = (st ? r.abs1 : r.abs0)[i];
      const unk = pr.unknown.i === i && pr.unknown.when === st;
      const A: P2 = [cx, y + 30 - 0.75 * sz];
      // Малую скорость рядом с большой показываем стрелкой наименьшей длины.
      if (Math.abs(vv) > 1e-12) out.push(arrow(A, [A[0] + Math.sign(vv) * Math.max(24, Math.abs(vv) * k), A[1]], unk ? 'cv-r' : 'en-v'));
      out.push(`<text class="t cv-t ${unk ? 't-cvr' : 'en-vt'}" x="${r1(cx)}" y="${y + 52}" text-anchor="middle">${st ? 'u' : 'v'} = ${fmt(vv, 4)}</text>`);
    });
  }
  out.push(
    `<text class="tb-note" x="16" y="${H - 14}">Абсолютные скорости вдоль оси x (вправо) до и после взаимодействия; красная — найденная. Q = ${fmt(r.Q, 4)} сохраняется.</text>`,
  );
  return wrap(out);
}

export function renderJet(pr: JetProblem, r: JetResult) {
  const out = [bg];
  if (!r.ok) return wrap(out);
  const C: P2 = [W / 2, H / 2 - 10];
  out.push(`<circle class="en-wheel2" cx="${C[0]}" cy="${C[1]}" r="70"/>`);
  pr.streams.forEach((s, i) => {
    const a = (s.ang * Math.PI) / 180;
    const d: P2 = [Math.cos(a), -Math.sin(a)];
    // Вход приходит к контуру по направлению скорости, выход уходит от него.
    const A: P2 = s.out ? [C[0] + d[0] * 80, C[1] + d[1] * 80] : [C[0] - d[0] * 200, C[1] - d[1] * 200];
    const B: P2 = s.out ? [C[0] + d[0] * 200, C[1] + d[1] * 200] : [C[0] - d[0] * 80, C[1] - d[1] * 80];
    out.push(
      arrow(A, B, 'en-v'),
      `<text class="t cv-t en-vt" x="${r1((s.out ? B : A)[0] + d[0] * (s.out ? 14 : -14))}" y="${r1((s.out ? B : A)[1] + d[1] * (s.out ? 14 : -14) + 5)}" text-anchor="middle">${i + 1}: ${fmt(s.v, 3)} м/с</text>`,
    );
  });
  const Rm = Math.hypot(...r.R);
  if (Rm > 1e-12) {
    const u: P2 = [r.R[0] / Rm, -r.R[1] / Rm];
    out.push(
      arrow(C, [C[0] + u[0] * 130, C[1] + u[1] * 130], 'cv-r'),
      `<text class="t cv-t t-cvr" x="${r1(C[0] + u[0] * 150)}" y="${r1(C[1] + u[1] * 150 + 5)}" text-anchor="middle">R = ${fmt(Rm, 4)}</text>`,
    );
  }
  out.push(
    `<text class="tb-note" x="16" y="${H - 14}">Круг — контур (стенки); синие — скорости жидкости во входных и выходных сечениях (ось y — вверх); красная — сила давления жидкости на стенки.</text>`,
  );
  return wrap(out);
}

export function renderPower(pr: PowerProblem, r: PowerResult) {
  const out = [bg];
  if (!r.ok) return wrap(out);
  const U = pr.units === 'tech' ? 'кГм/с' : 'Вт';
  const n = pr.loads.length;
  const E: P2 = [180, H / 2 - 20];
  const eng = r.N != null ? `N = ${fmt(r.N, 4)} ${U}` : 'N — ?';
  out.push(
    `<rect class="en-load" x="${E[0] - 120}" y="${E[1] - 45}" width="240" height="90"/><text class="t cv-t" x="${E[0]}" y="${E[1] - 12}" text-anchor="middle">двигатель</text><text class="t cv-t en-vt" x="${E[0]}" y="${E[1] + 16}" text-anchor="middle">${eng}</text>`,
  );
  out.push(`<text class="t cv-t" x="${E[0]}" y="${E[1] + 75}" text-anchor="middle">η = ${fmt(pr.eta, 3)}</text>`);
  pr.loads.forEach((l, i) => {
    const y = 70 + ((H - 140) * (i + 0.5)) / n;
    const o = r.loads[i];
    const B: P2 = [700, y];
    const from: P2 = pr.driving ? [B[0] - 160, y] : [E[0] + 120, E[1]];
    const to: P2 = pr.driving ? [E[0] + 120, E[1]] : [B[0] - 160, y];
    out.push(arrow(from, to, pr.unknown === i ? 'cv-r' : 'en-v'));
    out.push(
      `<rect class="en-load" x="${B[0] - 160}" y="${r1(y - 28)}" width="320" height="56"/><text class="t cv-t" x="${B[0]}" y="${r1(y - 6)}" text-anchor="middle">${i + 1}. ${esc(l.name || 'нагрузка')}</text><text class="t cv-t en-vt" x="${B[0]}" y="${r1(y + 18)}" text-anchor="middle">F = ${fmt(o.F, 4)}${o.v != null ? `, v = ${fmt(o.v, 4)}` : ''}</text>`,
    );
  });
  out.push(
    `<text class="tb-note" x="16" y="${H - 14}">${pr.driving ? 'Движущие силы передают мощность двигателю (машине) с потерями 1 − η.' : 'Двигатель развивает N; нагрузкам достаётся ηN.'} Мощность нагрузки — F·v.</text>`,
  );
  return wrap(out);
}
