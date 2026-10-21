/** Чертежи верёвочного многоугольника: схема с балкой (или цепью) и силовой многоугольник с полюсом. */
import { fmt } from '../../../shared/format';
import type { V2 } from '../model/cremona';
import { unit, type BeamLoad, type ChainResult, type FunicularInput, type FunicularResult } from '../model/funicular';
import { arrow, fit, r1 } from './common';

const poly = (v: { S: (p: V2) => [number, number] }, pts: V2[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${r1(v.S(p)[0])} ${r1(v.S(p)[1])}`).join('');

function supportPin(p: [number, number], roller: boolean, ang = 90): string {
  const [px, py] = p;
  let inner = `<polygon points="${r1(px)},${r1(py + 4)} ${r1(px - 13)},${r1(py + 26)} ${r1(px + 13)},${r1(py + 26)}" class="sup"/>`;
  if (roller)
    inner += `<circle cx="${r1(px - 6)}" cy="${r1(py + 31)}" r="4" class="hinge"/><circle cx="${r1(px + 6)}" cy="${r1(py + 31)}" r="4" class="hinge"/>`;
  const gy = py + (roller ? 36 : 26);
  inner += `<line x1="${r1(px - 22)}" y1="${r1(gy)}" x2="${r1(px + 22)}" y2="${r1(gy)}" class="sup"/>`;
  return `<g transform="rotate(${r1(90 - ang)} ${r1(px)} ${r1(py)})">${inner}</g>`;
}

export function renderBeamSpace(inp: FunicularInput, res: FunicularResult): { svg: string; viewBox: string } {
  const loads = inp.loads.filter((l) => Math.abs(l.F) > 1e-12);
  const xs = [inp.xA, inp.xB, ...loads.map((l) => l.x)];
  const x0 = Math.min(...xs),
    x1 = Math.max(...xs);
  const span = Math.max(x1 - x0, 1e-9);
  const alen = 0.18 * span;
  const pts: V2[] = [
    [x0 - 0.04 * span, 0],
    [x1 + 0.04 * span, 0],
  ];
  loads.forEach((l) => {
    const u = unit(l.angle);
    pts.push([l.x - u[0] * alen * 1.5, -u[1] * alen * 1.5]);
  });
  if (res.ok) pts.push(...res.V);
  const v = fit(pts, 1000, 540, 70);
  const out: string[] = [`<rect width="${v.W}" height="${v.H}" fill="var(--sheet)"/>`];
  // Линии действия сил — через весь многоугольник.
  const reach = res.ok ? Math.max(...res.V.map((p) => Math.abs(p[1])), alen) * 1.1 : alen;
  loads.forEach((l) => {
    const u = unit(l.angle);
    const t = Math.abs(u[1]) > 1e-9 ? reach / Math.abs(u[1]) : span;
    const a = v.S([l.x - u[0] * t * 0.3, -u[1] * t * 0.3]),
      b = v.S([l.x + u[0] * t, u[1] * t]);
    out.push(`<line x1="${r1(a[0])}" y1="${r1(a[1])}" x2="${r1(b[0])}" y2="${r1(b[1])}" class="gs-line"/>`);
  });
  const A = v.S([x0 - 0.04 * span, 0]),
    B = v.S([x1 + 0.04 * span, 0]);
  out.push(`<line x1="${r1(A[0])}" y1="${r1(A[1])}" x2="${r1(B[0])}" y2="${r1(B[1])}" class="tb-bar"/>`);
  out.push(supportPin(v.S([inp.xA, 0]), false), supportPin(v.S([inp.xB, 0]), true, inp.angleB));
  if (res.ok) {
    out.push(`<path d="${poly(v, res.V)}" class="gs-fun"/>`);
    const a = v.S(res.V[0]),
      k = v.S(res.V[res.V.length - 1]);
    out.push(`<line x1="${r1(a[0])}" y1="${r1(a[1])}" x2="${r1(k[0])}" y2="${r1(k[1])}" class="gs-close"/>`);
    res.V.forEach((p, i) => {
      const q = v.S(p);
      const name = i === 0 ? 'A' : i === res.V.length - 1 ? 'K' : String(i);
      out.push(
        `<circle cx="${r1(q[0])}" cy="${r1(q[1])}" r="3.8" class="gs-pt"/><text x="${r1(q[0] + 8)}" y="${r1(q[1] + 18)}" class="t-pt" font-size="15">${name}</text>`,
      );
    });
  }
  loads.forEach((l, i) => {
    const u = unit(l.angle);
    const [px, py] = v.S([l.x, 0]);
    const sx = u[0],
      sy = -u[1];
    const len = alen * v.k;
    out.push(arrow(px - sx * 6, py - sy * 6, sx, sy, len, 'ld'));
    out.push(
      `<text x="${r1(px - sx * (len + 18))}" y="${r1(py - sy * (len + 18) + 5)}" text-anchor="middle" class="t t-ld">F<tspan dy="5" font-size="12">${i + 1}</tspan><tspan dy="-5"> = ${fmt(Math.abs(l.F))}</tspan></text>`,
    );
  });
  if (res.ok) {
    const react = (vec: V2, at: number, name: string) => {
      const m = Math.hypot(...vec);
      if (m < 1e-9) return;
      const [px, py] = v.S([at, 0]);
      const sx = vec[0] / m,
        sy = -vec[1] / m;
      out.push(arrow(px - sx * 6, py - sy * 6, sx, sy, 56, 'rc'));
      out.push(
        `<text x="${r1(px - sx * 82)}" y="${r1(py - sy * 82 + 5)}" text-anchor="middle" class="t t-rc">R<tspan dy="5" font-size="12">${name}</tspan><tspan dy="-5"> = ${fmt(m)}</tspan></text>`,
      );
    };
    react(res.RA, inp.xA, 'A');
    react(res.RB, inp.xB, 'B');
  }
  out.push(
    `<text x="16" y="${v.H - 12}" class="tb-note">Верёвочный многоугольник A–1–2–…–K (синий), замыкающая AK — пунктир; пунктир тонкий — линии действия сил.</text>`,
  );
  return { svg: out.join(''), viewBox: `0 0 ${v.W} ${v.H}` };
}

export function renderForcePolygon(loads: BeamLoad[], res: FunicularResult): { svg: string; viewBox: string } {
  if (!res.ok) return { svg: '', viewBox: '0 0 10 10' };
  const pts: V2[] = [...res.P, res.O, res.Q];
  const v = fit(pts, 1000, 540, 60);
  const out: string[] = [`<rect width="${v.W}" height="${v.H}" fill="var(--sheet)"/>`];
  const n = res.P.length;
  // Лучи из полюса.
  res.P.forEach((p, i) => {
    const a = v.S(res.O),
      b = v.S(p);
    out.push(`<line x1="${r1(a[0])}" y1="${r1(a[1])}" x2="${r1(b[0])}" y2="${r1(b[1])}" class="gs-ray"/>`);
    out.push(`<text x="${r1((a[0] + b[0]) / 2)}" y="${r1((a[1] + b[1]) / 2 - 6)}" class="tb-val">${i}</text>`);
  });
  const a = v.S(res.O),
    q = v.S(res.Q);
  out.push(`<line x1="${r1(a[0])}" y1="${r1(a[1])}" x2="${r1(q[0])}" y2="${r1(q[1])}" class="gs-close"/>`);
  // Силы: P₀→P₁→…→Pₙ.
  for (let i = 1; i < n; i++) {
    const A = v.S(res.P[i - 1]),
      B = v.S(res.P[i]);
    const m = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1;
    out.push(arrow(B[0], B[1], (B[0] - A[0]) / m, (B[1] - A[1]) / m, m, 'ld'));
    out.push(
      `<text x="${r1((A[0] + B[0]) / 2 + 14)}" y="${r1((A[1] + B[1]) / 2 + 4)}" class="tb-val">F${i}${loads[i - 1] ? ' = ' + fmt(Math.abs(loads[i - 1].F)) : ''}</text>`,
    );
  }
  // Реакции: Pₙ→Q (R_B), Q→P₀ (R_A).
  const dr = (from: V2, to: V2, name: string) => {
    const A = v.S(from),
      B = v.S(to);
    const m = Math.hypot(B[0] - A[0], B[1] - A[1]);
    if (m < 2) return;
    out.push(arrow(B[0], B[1], (B[0] - A[0]) / m, (B[1] - A[1]) / m, m, 'rc'));
    out.push(`<text x="${r1((A[0] + B[0]) / 2 - 8)}" y="${r1((A[1] + B[1]) / 2 - 6)}" text-anchor="end" class="tb-val">${name}</text>`);
  };
  dr(res.P[n - 1], res.Q, `R_B = ${fmt(Math.hypot(...res.RB))}`);
  dr(res.Q, res.P[0], `R_A = ${fmt(Math.hypot(...res.RA))}`);
  res.P.forEach((p, i) => {
    const [x, y] = v.S(p);
    out.push(`<circle cx="${r1(x)}" cy="${r1(y)}" r="3.6" class="gs-pt"/><text x="${r1(x + 7)}" y="${r1(y - 7)}" class="gs-face gs-out">${i}</text>`);
  });
  out.push(`<circle cx="${r1(a[0])}" cy="${r1(a[1])}" r="4.5" class="gs-pole"/><text x="${r1(a[0] - 18)}" y="${r1(a[1] + 5)}" class="t-pt">O</text>`);
  out.push(
    `<circle cx="${r1(q[0])}" cy="${r1(q[1])}" r="3.6" class="gs-pt"/><text x="${r1(q[0] + 7)}" y="${r1(q[1] + 16)}" class="t-pt" font-size="15">Q</text>`,
  );
  out.push(
    `<text x="16" y="${v.H - 12}" class="tb-note">Силовой многоугольник: красные — нагрузки, синие — реакции; лучи из полюса O параллельны сторонам верёвочного многоугольника.</text>`,
  );
  return { svg: out.join(''), viewBox: `0 0 ${v.W} ${v.H}` };
}

export function renderChainSpace(res: ChainResult, L: number, f: number): { svg: string; viewBox: string } {
  if (!res.ok) return { svg: '', viewBox: '0 0 10 10' };
  const alen = 0.14 * L;
  const pts: V2[] = [
    [0, alen * 0.6],
    [L, alen * 0.6],
    [0, -f * 1.15],
    [L, 0],
  ];
  const v = fit(pts, 1000, 460, 70);
  const out: string[] = [`<rect width="${v.W}" height="${v.H}" fill="var(--sheet)"/>`];
  // Парабола — для сравнения.
  const par: V2[] = Array.from({ length: 81 }, (_, i) => {
    const x = (L * i) / 80;
    return [x, (-4 * f * x * (L - x)) / (L * L)] as V2;
  });
  out.push(`<path d="${poly(v, par)}" class="gs-parab"/>`);
  // Хорда AB — тонко; нагрузка передаётся на цепь подвесками в вершинах.
  const A = v.S([0, 0]),
    B = v.S([L, 0]);
  out.push(`<line x1="${r1(A[0])}" y1="${r1(A[1])}" x2="${r1(B[0])}" y2="${r1(B[1])}" class="gs-line"/>`);
  res.xs.forEach((_, i) => {
    const [px, py] = v.S(res.V[i + 1]);
    out.push(arrow(px, py - 4, 0, 1, alen * v.k, 'ld'));
  });
  out.push(`<path d="${poly(v, res.V)}" class="gs-fun"/>`);
  res.V.forEach((p, i) => {
    const q = v.S(p);
    const name = i === 0 ? 'A' : i === res.V.length - 1 ? 'B' : '';
    out.push(
      `<circle cx="${r1(q[0])}" cy="${r1(q[1])}" r="3.4" class="gs-pt"/>${name ? `<text x="${r1(q[0] + (i ? 10 : -22))}" y="${r1(q[1] - 10)}" class="t-pt">${name}</text>` : ''}`,
    );
  });
  const C = v.S([L / 2, 0]),
    C2 = v.S([L / 2, -f]);
  out.push(`<line x1="${r1(C[0])}" y1="${r1(C[1])}" x2="${r1(C2[0])}" y2="${r1(C2[1])}" class="gs-close"/>`);
  out.push(`<text x="${r1(C[0] + 10)}" y="${r1((C[1] + C2[1]) / 2)}" class="tb-val">f = ${fmt(f)}</text>`);
  out.push(`<text x="${r1(C2[0] + 8)}" y="${r1(C2[1] + 20)}" class="t-pt">C</text>`);
  out.push(
    `<text x="16" y="${v.H - 12}" class="tb-note">Цепь — верёвочный многоугольник нагрузки (n равных сил, приложенных в вершинах); пунктир — парабола y = −4fx(L−x)/L².</text>`,
  );
  return { svg: out.join(''), viewBox: `0 0 ${v.W} ${v.H}` };
}

export function renderChainForce(res: ChainResult): { svg: string; viewBox: string } {
  if (!res.ok) return { svg: '', viewBox: '0 0 10 10' };
  const pts: V2[] = [...res.P, res.O];
  const v = fit(pts, 1000, 420, 60);
  const out: string[] = [`<rect width="${v.W}" height="${v.H}" fill="var(--sheet)"/>`];
  const a = v.S(res.O);
  res.P.forEach((p, i) => {
    const b = v.S(p);
    out.push(`<line x1="${r1(a[0])}" y1="${r1(a[1])}" x2="${r1(b[0])}" y2="${r1(b[1])}" class="gs-ray"/>`);
    if (i === 0 || i === res.P.length - 1 || i === res.P.length / 2) out.push(`<circle cx="${r1(b[0])}" cy="${r1(b[1])}" r="3.4" class="gs-pt"/>`);
  });
  const top = v.S(res.P[0]),
    bot = v.S(res.P[res.P.length - 1]);
  out.push(`<line x1="${r1(top[0])}" y1="${r1(top[1])}" x2="${r1(bot[0])}" y2="${r1(bot[1])}" class="ld" style="stroke-width:3"/>`);
  out.push(`<circle cx="${r1(a[0])}" cy="${r1(a[1])}" r="4.5" class="gs-pole"/><text x="${r1(a[0] - 20)}" y="${r1(a[1] + 5)}" class="t-pt">O</text>`);
  const mid = v.S([0, res.O[1]]);
  out.push(
    `<line x1="${r1(a[0])}" y1="${r1(a[1])}" x2="${r1(mid[0])}" y2="${r1(mid[1])}" class="gs-close"/><text x="${r1((a[0] + mid[0]) / 2)}" y="${r1(a[1] - 8)}" text-anchor="middle" class="tb-val">H = ${fmt(res.H)}</text>`,
  );
  out.push(`<text x="${r1(top[0] + 12)}" y="${r1((top[1] + bot[1]) / 2)}" class="tb-val">qL/k = ${fmt(2 * res.Vsup)}</text>`);
  out.push(
    `<text x="16" y="${v.H - 12}" class="tb-note">Силовой многоугольник одной цепи: вертикаль — суммарная нагрузка, полюсное расстояние H — горизонтальное усилие в цепи.</text>`,
  );
  return { svg: out.join(''), viewBox: `0 0 ${v.W} ${v.H}` };
}
