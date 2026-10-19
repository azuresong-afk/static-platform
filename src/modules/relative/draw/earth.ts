/** Чертёж: Земля с широтой точки и оси места; векторы в горизонтальной плоскости места (вид сверху). */
import { fmt } from '../../../shared/format';
import { norm, type EarthKin, type EarthKinResult, type V3 } from '../model/earth';
import { sig } from '../text/earth';

const r1 = (v: number) => Math.round(v * 10) / 10;
const W = 1000,
  H = 520;
type P2 = [number, number];

export function arrow(a: P2, bb: P2, cls: string) {
  const dx = bb[0] - a[0],
    dy = bb[1] - a[1],
    L = Math.hypot(dx, dy) || 1,
    ux = dx / L,
    uy = dy / L;
  return `<line class="${cls}" x1="${r1(a[0])}" y1="${r1(a[1])}" x2="${r1(bb[0] - ux * 8)}" y2="${r1(bb[1] - uy * 8)}"/><path class="${cls}-f" d="M${r1(bb[0])} ${r1(bb[1])}L${r1(bb[0] - ux * 11 - uy * 4.5)} ${r1(bb[1] - uy * 11 + ux * 4.5)}L${r1(bb[0] - ux * 11 + uy * 4.5)} ${r1(bb[1] - uy * 11 - ux * 4.5)}Z"/>`;
}

export function renderEarth(p: EarthKin, r: EarthKinResult, show: 'v' | 'a'): { svg: string; viewBox: string } {
  const out: string[] = [`<rect width="${W}" height="${H}" fill="var(--sheet)"/>`];
  if (!r.ok) {
    out.push(`<text class="tb-note" x="16" y="${H / 2}">Проверьте данные.</text>`);
    return { svg: out.join(''), viewBox: `0 0 ${W} ${H}` };
  }
  // Земля в плоскости меридиана: ось — вертикально, точка на широте φ.
  const C: P2 = [200, 240],
    Rp = 150,
    f = (p.lat * Math.PI) / 180;
  const M: P2 = [C[0] + Rp * Math.cos(f), C[1] - Rp * Math.sin(f)];
  out.push(
    `<circle class="rl-path" cx="${C[0]}" cy="${C[1]}" r="${Rp}"/><line class="rl-axis" x1="${C[0]}" y1="${C[1] + Rp + 30}" x2="${C[0]}" y2="${C[1] - Rp - 34}"/>`,
  );
  out.push(arrow([C[0], C[1] - Rp - 4], [C[0], C[1] - Rp - 40], 'rl-e'), `<text class="t gr-t" x="${C[0] + 8}" y="${C[1] - Rp - 26}">ω, на север</text>`);
  out.push(
    `<line class="sb-axis" x1="${C[0] - Rp - 10}" y1="${C[1]}" x2="${C[0] + Rp + 10}" y2="${C[1]}"/><text class="tb-note" x="${C[0] + Rp + 12}" y="${C[1] + 4}">экватор</text>`,
  );
  out.push(
    `<line class="mc-guide" x1="${C[0]}" y1="${C[1]}" x2="${r1(M[0])}" y2="${r1(M[1])}"/><text class="t gr-t" x="${C[0] + 30}" y="${r1(C[1] - 8 - 10 * Math.sign(p.lat || 1))}">φ = ${fmt(p.lat, 3)}°</text>`,
  );
  // Оси места в плоскости меридиана: y (север) — по касательной, z — по радиусу.
  const up: P2 = [Math.cos(f), -Math.sin(f)],
    north: P2 = [-Math.sin(f), -Math.cos(f)];
  out.push(
    arrow(M, [M[0] + 50 * up[0], M[1] + 50 * up[1]], 'sb-axis'),
    `<text class="sb-axt" x="${r1(M[0] + 58 * up[0])}" y="${r1(M[1] + 58 * up[1] + 4)}">z</text>`,
  );
  out.push(
    arrow(M, [M[0] + 50 * north[0], M[1] + 50 * north[1]], 'sb-axis'),
    `<text class="sb-axt" x="${r1(M[0] + 58 * north[0] - 4)}" y="${r1(M[1] + 58 * north[1])}">y</text>`,
  );
  out.push(
    `<circle class="cg-c" cx="${r1(M[0])}" cy="${r1(M[1])}" r="5"/><text class="t mc-t" x="${r1(M[0] + 10)}" y="${r1(M[1] + 18)}">M (x — на восток, к нам)</text>`,
  );
  // Горизонтальная плоскость места, вид сверху: x — восток вправо, y — север вверх.
  const O: P2 = [700, 250];
  out.push(
    `<line class="sb-axis" x1="${O[0] - 220}" y1="${O[1]}" x2="${O[0] + 220}" y2="${O[1]}"/><text class="sb-axt" x="${O[0] + 226}" y="${O[1] + 5}">x, восток</text><line class="sb-axis" x1="${O[0]}" y1="${O[1] + 200}" x2="${O[0]}" y2="${O[1] - 200}"/><text class="sb-axt" x="${O[0] + 6}" y="${O[1] - 204}">y, север</text>`,
  );
  const list: { w: V3; cls: string; name: string }[] =
    show === 'v'
      ? [
          { w: r.ve, cls: 'rl-e', name: 'vₑ' },
          { w: r.vr, cls: 'rl-r', name: 'vᵣ' },
          { w: r.v, cls: 'en-v', name: 'v' },
        ]
      : [
          { w: r.ae, cls: 'rl-e', name: 'aₑ' },
          { w: r.ar, cls: 'rl-r', name: 'aᵣ' },
          { w: r.ac, cls: 'rl-c', name: 'a_c' },
          { w: r.a, cls: 'cv-r', name: 'a' },
        ];
  const mx = Math.max(...list.map((q) => Math.hypot(q.w[0], q.w[1])), 1e-300);
  const placed: [number, number, number][] = [];
  const vert: string[] = [];
  for (const q of list) {
    const m = norm(q.w);
    if (m === 0) continue;
    const pm = Math.hypot(q.w[0], q.w[1]);
    if (pm > 1e-9 * m) {
      // Длина — по логарифму отношения: векторы разного порядка остаются видны.
      const L = 40 + 140 * Math.max(0, 1 + Math.log10(pm / mx) / 4);
      const B: P2 = [O[0] + (q.w[0] / pm) * L, O[1] - (q.w[1] / pm) * L];
      const text = `${q.name}: ${sig(pm, 3)}`;
      const w = text.length * 7.2;
      let lx = B[0] + (q.w[0] / pm) * 8,
        ly = B[1] - (q.w[1] / pm) * 8 + 4;
      if (q.w[0] / pm < -0.3) lx -= w;
      for (let g = 0; g < 12 && placed.some((bb) => lx < bb[0] + bb[2] && lx + w > bb[0] && Math.abs(ly - bb[1]) < 15); g++) ly += 16;
      placed.push([lx, ly, w]);
      out.push(arrow(O, B, q.cls), `<text class="t cv-t rl-t ${q.cls}-t" x="${r1(lx)}" y="${r1(ly)}">${text}</text>`);
    }
    if (Math.abs(q.w[2]) > 1e-9 * m) vert.push(`${q.name}: ${q.w[2] > 0 ? 'вверх' : 'вниз'} ${sig(Math.abs(q.w[2]), 3)}`);
  }
  out.push(`<circle class="cg-c" cx="${O[0]}" cy="${O[1]}" r="4"/>`);
  if (vert.length) out.push(`<text class="t rl-t" x="420" y="${H - 52}">По вертикали: ${vert.join('; ')}</text>`);
  out.push(
    `<text class="tb-note" x="16" y="${H - 30}">Слева — плоскость меридиана; справа — горизонтальная плоскость места, вид сверху (длины стрелок — в логарифмическом масштабе).</text>`,
  );
  out.push(
    `<text class="tb-note" x="16" y="${H - 12}">${show === 'v' ? 'Серая — переносная, зелёная — относительная, синяя — абсолютная скорость.' : 'Серое — переносное, зелёное — относительное, коричневое — кориолисово, красное — абсолютное ускорение.'}</text>`,
  );
  return { svg: out.join(''), viewBox: `0 0 ${W} ${H}` };
}
