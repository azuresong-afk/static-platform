/**
 * Чертёж ступенчатого бруса и эпюры N, σ, ε, Δ под ним в одном горизонтальном масштабе.
 * Чистая функция → SVG. Точки бруса — латинские буквы слева направо (A, B, C…).
 */
import { renderBands } from '../../../shared/draw/diagrams';
import { fmt } from '../../../shared/format';
import type { Bar, BarSolution } from '../model/bar';
import { heldBySupport } from '../model/bar';

export const W = 1000;
const OX = 110;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const r1 = (v: number) => Math.round(v * 10) / 10;

export const pointName = (i: number): string => String.fromCharCode(65 + i);

/** Горизонтальный масштаб: пикселей на метр. */
export function scaleOf(b: Bar): (z: number) => number {
  const L = b.steps.reduce((a, s) => a + s.l, 0) || 1;
  const SC = (W - 2 * OX) / L;
  return (z: number) => r1(OX + z * SC);
}

export function renderBar(b: Bar, sol: BarSolution | null): { svg: string; viewBox: string } {
  const X = scaleOf(b);
  const H = 250,
    y = 120;
  const cmax = Math.max(...b.steps.map((s) => s.c));
  const half = (c: number) => Math.max(10, 44 * Math.sqrt(c / cmax));
  const out: string[] = [];
  const zs: number[] = [0];
  b.steps.forEach((s) => zs.push(zs[zs.length - 1] + s.l));

  // Ось.
  out.push(`<line class="ax-axis" x1="${OX - 40}" y1="${y}" x2="${W - OX + 50}" y2="${y}"/>`);
  out.push(`<text class="ax-z" x="${W - OX + 54}" y="${y + 5}">z</text>`);
  // Ступени.
  b.steps.forEach((s, i) => {
    const x0 = X(zs[i]),
      x1 = X(zs[i + 1]),
      h = half(s.c);
    out.push(`<rect class="ax-step${s.dT ? (s.dT > 0 ? ' ax-hot' : ' ax-cold') : ''}" x="${x0}" y="${r1(y - h)}" width="${r1(x1 - x0)}" height="${r1(2 * h)}"/>`);
    out.push(`<text class="ax-area" x="${r1((x0 + x1) / 2)}" y="${r1(y - h - 8)}">${esc(fmt(s.c, 2) === '1' ? 'A' : fmt(s.c, 2) + 'A')}</text>`);
    if (s.dT) out.push(`<text class="ax-heat" x="${r1((x0 + x1) / 2)}" y="${r1(y + h - 8)}">ΔT = ${s.dT > 0 ? '+' : '−'}${esc(fmt(Math.abs(s.dT), 1))} К</text>`);
    // Размер.
    const yd = 222;
    out.push(`<line class="ax-dim" x1="${x0}" y1="${yd}" x2="${x1}" y2="${yd}"/><line class="ax-dim" x1="${x0}" y1="${yd - 6}" x2="${x0}" y2="${yd + 6}"/><line class="ax-dim" x1="${x1}" y1="${yd - 6}" x2="${x1}" y2="${yd + 6}"/>`);
    out.push(`<text class="ax-len" x="${r1((x0 + x1) / 2)}" y="${yd - 6}">${esc(fmt(s.l, 3))}</text>`);
  });
  // Заделки.
  const wall = (x: number, dir: -1 | 1) => {
    out.push(`<line class="ax-wall" x1="${x}" y1="${y - 62}" x2="${x}" y2="${y + 62}"/>`);
    for (let k = -56; k <= 56; k += 12) out.push(`<line class="ax-hatch" x1="${x}" y1="${y + k}" x2="${x + dir * 10}" y2="${y + k - 10}"/>`);
  };
  if (b.supports !== 'right') wall(X(0), -1);
  if (b.supports !== 'left') wall(X(zs[zs.length - 1]), 1);
  // Точки.
  zs.forEach((z, i) => out.push(`<text class="ax-pt" x="${r1(X(z) + (i === 0 ? -14 : i === zs.length - 1 ? 14 : 0))}" y="${y + 74}">${pointName(i)}</text>`));
  // Силы: стрелка вдоль оси, начало в узле.
  const arrow = (x: number, v: number, cls: string, label: [string, string, string], dy: number) => {
    const dir = v >= 0 ? 1 : -1;
    const len = 46;
    const xs = x,
      xe = x + dir * len;
    out.push(
      `<line class="${cls}" x1="${xs}" y1="${y + dy}" x2="${r1(xe - dir * 8)}" y2="${y + dy}"/>`,
      `<path class="${cls}-head" d="M${r1(xe)} ${y + dy}L${r1(xe - dir * 11)} ${y + dy - 5}L${r1(xe - dir * 11)} ${y + dy + 5}Z"/>`,
      `<text class="${cls}-t" x="${r1((xs + xe) / 2)}" y="${y + dy - 9}">${esc(label[0])}<tspan class="ax-sub" dy="4">${esc(label[1])}</tspan><tspan dy="-4"> = ${esc(label[2])}</tspan></text>`,
    );
  };
  b.forces.forEach((f, j) => {
    if (!f || heldBySupport(b, j)) return;
    arrow(X(zs[j]), f, 'ax-f', ['F', pointName(j), fmt(Math.abs(f), 2)], 0);
  });
  if (sol) {
    const n = b.steps.length;
    // Реакции — над заделками, чтобы не закрывать штриховку.
    if (sol.RA !== null && Math.abs(sol.RA) > 1e-9) arrow(X(0), sol.RA, 'ax-r', ['R', pointName(0), fmt(Math.abs(sol.RA), 2)], -84);
    if (sol.RB !== null && Math.abs(sol.RB) > 1e-9) arrow(X(zs[n]), sol.RB, 'ax-r', ['R', pointName(n), fmt(Math.abs(sol.RB), 2)], -84);
  }
  out.push(`<text class="ax-note" x="12" y="${H - 6}">Силы — кН, длины — м</text>`);
  return { svg: out.join(''), viewBox: `0 0 ${W} ${H}` };
}

/** Эпюры N (кН), σ (МПа), ε (·10⁴), Δ (мм). */
export function renderBarDiagrams(b: Bar, sol: BarSolution): { svg: string; viewBox: string } {
  const X = scaleOf(b);
  const pieces = (f: (s: BarSolution['steps'][number]) => number[]) => sol.steps.map((s) => ({ x0: s.z0, x1: s.z1, poly: f(s) }));
  return renderBands(
    [
      { name: { L: 'N', S: '', suffix: ', кН' }, cls: 'n', up: 1, pieces: pieces((s) => [s.N]) },
      { name: { L: 'σ', S: '', suffix: ', МПа' }, cls: 's', up: 1, pieces: pieces((s) => [s.sigma]) },
      { name: { L: 'ε', S: '', suffix: '·10⁴' }, cls: 'e', up: 1, pieces: pieces((s) => [(s.epsSigma + s.epsT) * 1e4]) },
      { name: { L: 'Δ', S: '', suffix: ', мм' }, cls: 'u', up: 1, pieces: pieces((s) => [s.u0, (s.u1 - s.u0) / (s.z1 - s.z0)]), label: (v) => fmt(v, 4) },
    ],
    X,
    W,
  );
}
