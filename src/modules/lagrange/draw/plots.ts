/** Графики обобщённых координат по времени (по одному на координату), интеграла энергии, реакций и программных сил. */
import { plot } from '../../rotation/draw/rotation';
import { prettyName } from '../../../shared/sym';
import type { LagSolution } from '../model/lagrange';
import type { ReactSolution } from '../model/react';

const isAngle = (n: string) => /^[α-ωΑ-Ω]/.test(n);

export function renderPlots(r: LagSolution, rr?: ReactSolution | null): { svg: string; viewBox: string } | null {
  const series: { title: string; unit: string; pts: [number, number][] }[] = [];
  const P = rr?.program;
  // Программное движение: вместо свободного движения — заданные законы и силы.
  if (r.sim && !P) {
    const { t, q, E } = r.sim;
    series.push(
      ...r.ctx.coords.map((n, i) => ({ title: prettyName(n), unit: isAngle(n) ? 'рад' : 'м', pts: t.map((x, k) => [x, q[i][k]] as [number, number]) })),
    );
    if (r.conservative) series.push({ title: 'H', unit: 'Дж', pts: t.map((x, k) => [x, E[k]] as [number, number]) });
  }
  const B = rr?.body;
  if (B?.series) {
    const s = B.series;
    const [le, ln] = B.beta ? ['e', 'n'] : ['x', 'y'];
    series.push(
      { title: 'R_' + le, unit: 'Н', pts: s.t.map((x, k) => [x, s.e[k]] as [number, number]) },
      { title: 'R_' + ln, unit: 'Н', pts: s.t.map((x, k) => [x, s.n[k]] as [number, number]) },
    );
  }
  if (P?.series) {
    const s = P.series;
    r.ctx.coords.forEach((n, i) =>
      series.push(
        { title: prettyName(n), unit: isAngle(n) ? 'рад' : 'м', pts: s.t.map((x, k) => [x, s.q[i][k]] as [number, number]) },
        { title: 'Q_' + prettyName(n), unit: isAngle(n) ? 'Н·м' : 'Н', pts: s.t.map((x, k) => [x, s.Q[i][k]] as [number, number]) },
      ),
    );
  }
  if (!series.length) return null;
  const cols = 2,
    pw = 380,
    ph = 200;
  const rows = Math.ceil(series.length / cols);
  const out = series.map((s, i) => plot(80 + (i % cols) * (pw + 110), 50 + Math.floor(i / cols) * (ph + 90), pw, ph, s.pts, s.title, s.unit, 'с'));
  return { svg: out.join(''), viewBox: `0 0 ${cols * (pw + 110) + 30} ${rows * (ph + 90) + 20}` };
}
