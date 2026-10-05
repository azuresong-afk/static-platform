/**
 * Чертёж ступенчатого вала и эпюры M_z, τ_max, φ под ним в одном горизонтальном масштабе.
 * Моменты — двойные стрелки-векторы вдоль оси (правило правого винта): вправо — «+».
 */
import { renderBands } from '../../../shared/draw/diagrams';
import { fmt } from '../../../shared/format';
import { shaftMoments, type Shaft, type ShaftSolution } from '../model/shaft';
import { pointName } from '../text/solution';

export const W = 1000;
const OX = 110;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const r1 = (v: number) => Math.round(v * 10) / 10;

export function scaleOf(s: Shaft): (z: number) => number {
  const L = s.steps.reduce((a, t) => a + t.l, 0) || 1;
  const SC = (W - 2 * OX) / L;
  return (z: number) => r1(OX + z * SC);
}

export function renderShaft(s: Shaft, sol: ShaftSolution | null): { svg: string; viewBox: string } {
  const X = scaleOf(s);
  const H = 260,
    y = 130;
  const kmax = Math.max(...s.steps.map((t) => t.k));
  const half = (k: number) => Math.max(10, (44 * k) / kmax);
  const out: string[] = [];
  const zs: number[] = [0];
  s.steps.forEach((t) => zs.push(zs[zs.length - 1] + t.l));
  out.push(`<line class="ax-axis" x1="${OX - 40}" y1="${y}" x2="${W - OX + 50}" y2="${y}"/><text class="ax-z" x="${W - OX + 54}" y="${y + 5}">z</text>`);
  s.steps.forEach((t, i) => {
    const x0 = X(zs[i]),
      x1 = X(zs[i + 1]),
      h = half(t.k);
    out.push(`<rect class="ax-step" x="${x0}" y="${r1(y - h)}" width="${r1(x1 - x0)}" height="${r1(2 * h)}"/>`);
    if (t.c > 0) {
      const hi = h * t.c;
      out.push(`<line class="tr-bore" x1="${x0}" y1="${r1(y - hi)}" x2="${x1}" y2="${r1(y - hi)}"/><line class="tr-bore" x1="${x0}" y1="${r1(y + hi)}" x2="${x1}" y2="${r1(y + hi)}"/>`);
    }
    const lab = `${fmt(t.k, 2) === '1' ? 'd' : fmt(t.k, 2) + 'd'}${t.c > 0 ? `, d₀ = ${fmt(t.c, 2)}D` : ''}`;
    out.push(`<text class="ax-area" x="${r1((x0 + x1) / 2)}" y="${r1(y - h - 8)}">${esc(lab)}</text>`);
    const yd = 232;
    out.push(`<line class="ax-dim" x1="${x0}" y1="${yd}" x2="${x1}" y2="${yd}"/><line class="ax-dim" x1="${x0}" y1="${yd - 6}" x2="${x0}" y2="${yd + 6}"/><line class="ax-dim" x1="${x1}" y1="${yd - 6}" x2="${x1}" y2="${yd + 6}"/><text class="ax-len" x="${r1((x0 + x1) / 2)}" y="${yd - 6}">${esc(fmt(t.l, 3))}</text>`);
  });
  const wall = (x: number, dir: -1 | 1) => {
    out.push(`<line class="ax-wall" x1="${x}" y1="${y - 62}" x2="${x}" y2="${y + 62}"/>`);
    for (let k = -56; k <= 56; k += 12) out.push(`<line class="ax-hatch" x1="${x}" y1="${y + k}" x2="${x + dir * 10}" y2="${y + k - 10}"/>`);
  };
  if (s.supports === 'left' || s.supports === 'both') wall(X(0), -1);
  if (s.supports === 'right' || s.supports === 'both') wall(X(zs[zs.length - 1]), 1);
  zs.forEach((z, i) => out.push(`<text class="ax-pt" x="${r1(X(z) + (i === 0 ? -14 : i === zs.length - 1 ? 14 : 0))}" y="${y + 80}">${pointName(i)}</text>`));
  // Вектор момента: двойная стрелка над валом.
  const vec = (x: number, v: number, cls: string, name: string, dy: number) => {
    const dir = v >= 0 ? 1 : -1,
      len = 52,
      xe = x + dir * len,
      yy = y + dy;
    out.push(
      `<line class="${cls}" x1="${x}" y1="${yy}" x2="${r1(xe - dir * 6)}" y2="${yy}"/>`,
      `<path class="${cls}-head" d="M${r1(xe)} ${yy}L${r1(xe - dir * 10)} ${yy - 5}L${r1(xe - dir * 10)} ${yy + 5}Z"/><path class="${cls}-head" d="M${r1(xe - dir * 9)} ${yy}L${r1(xe - dir * 19)} ${yy - 5}L${r1(xe - dir * 19)} ${yy + 5}Z"/>`,
      `<line class="${cls}" x1="${x}" y1="${yy}" x2="${x}" y2="${y}"/>`,
      `<text class="${cls}-t" x="${r1((x + xe) / 2)}" y="${yy - 9}">M<tspan class="ax-sub" dy="4">${esc(name)}</tspan><tspan dy="-4"> = ${esc(fmt(Math.abs(v), 3))}</tspan></text>`,
    );
  };
  const m = shaftMoments(s);
  m.forEach((v, j) => {
    if (!v || !Number.isFinite(v)) return;
    vec(X(zs[j]), v, 'ax-f', pointName(j), -70);
  });
  if (sol) {
    const n = s.steps.length;
    if (sol.RA != null && Math.abs(sol.RA) > 1e-9) vec(X(0), sol.RA, 'ax-r', pointName(0), -100);
    if (sol.RB != null && Math.abs(sol.RB) > 1e-9) vec(X(zs[n]), sol.RB, 'ax-r', pointName(n), -100);
  }
  out.push(`<text class="ax-note" x="12" y="${H - 6}">Моменты — кН·м (двойная стрелка — вектор момента по правилу правого винта), длины — м</text>`);
  return { svg: out.join(''), viewBox: `0 0 ${W} ${H}` };
}

/** Эпюры M_z (кН·м), τ_max (МПа), φ (°). */
export function renderShaftDiagrams(s: Shaft, sol: ShaftSolution): { svg: string; viewBox: string } {
  const X = scaleOf(s);
  const deg = 180 / Math.PI;
  const pieces = (f: (t: ShaftSolution['steps'][number]) => number[]) => sol.steps.map((t) => ({ x0: t.z0, x1: t.z1, poly: f(t) }));
  return renderBands(
    [
      { name: { L: 'M', S: 'z', suffix: ', кН·м' }, cls: 'n', up: 1, pieces: pieces((t) => [t.Mz]) },
      { name: { L: 'τ', S: 'max', suffix: ', МПа' }, cls: 's', up: 1, pieces: pieces((t) => [t.tau]) },
      { name: { L: 'φ', S: '', suffix: ', °' }, cls: 'u', up: 1, pieces: pieces((t) => [t.phi0 * deg, ((t.phi1 - t.phi0) * deg) / (t.z1 - t.z0)]), label: (v) => fmt(v, 4) },
    ],
    X,
    W,
  );
}
