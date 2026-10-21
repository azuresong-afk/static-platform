/** Графики обобщённых координат по времени (по одному на координату) и интеграла энергии. */
import { plot } from '../../rotation/draw/rotation';
import { prettyName } from '../../../shared/sym';
import type { LagSolution } from '../model/lagrange';

const isAngle = (n: string) => /^[α-ωΑ-Ω]/.test(n);

export function renderPlots(r: LagSolution): { svg: string; viewBox: string } | null {
  if (!r.sim) return null;
  const { t, q, E } = r.sim;
  const series: { title: string; unit: string; pts: [number, number][] }[] = r.ctx.coords.map((n, i) => ({ title: prettyName(n), unit: isAngle(n) ? 'рад' : 'м', pts: t.map((x, k) => [x, q[i][k]] as [number, number]) }));
  if (r.conservative) series.push({ title: 'H', unit: 'Дж', pts: t.map((x, k) => [x, E[k]] as [number, number]) });
  const cols = 2,
    pw = 380,
    ph = 200;
  const rows = Math.ceil(series.length / cols);
  const out = series.map((s, i) => plot(80 + (i % cols) * (pw + 110), 50 + Math.floor(i / cols) * (ph + 90), pw, ph, s.pts, s.title, s.unit, 'с'));
  return { svg: out.join(''), viewBox: `0 0 ${cols * (pw + 110) + 30} ${rows * (ph + 90) + 20}` };
}
