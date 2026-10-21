/**
 * Независимый расчёт Q и M в сечении балки по ПРАВОЙ части (метод сечений с другой стороны).
 * Силы — из независимого wrenches() (свои таблицы направлений), распределённая нагрузка правее сечения
 * интегрируется по Симпсону на своём отрезке (точно для линейной q), а не заменяется равнодействующей.
 * Правила знаков Антонова: Q = −ΣFy справа (сила вниз справа — «+»), M = Σ моментов правых сил против часовой.
 */
import type { Structure } from '../../src/modules/frames/model/types';
import { wrenches, type UnknownRef } from './equilibrium';

const LOAD_ANG: Record<string, number> = { down: 270, up: 90, right: 0, left: 180 };

export function cutRight(s: Structure, vals: Record<string, number>, unknowns: UnknownRef[], x: number): { Q: number; M: number } {
  // Координаты точек балки: обход от корня (все участки горизонтальны).
  const incoming = new Set(s.segs.map((q) => q.b));
  const root = s.nodes.find((n) => !incoming.has(n.id))!.id;
  const px: Record<string, number> = { [root]: 0 };
  const queue = [root];
  while (queue.length) {
    const id = queue.shift()!;
    for (const q of s.segs) if (q.a === id) (px[q.b] = px[id] + (q.dir === 'r' ? 1 : -1) * q.len), queue.push(q.b);
  }
  const shift = -Math.min(...Object.values(px));
  let Q = 0,
    M = 0;
  const point = s.items.filter((it) => it.type !== 'dist');
  for (const w of wrenches({ ...s, items: point }, vals, unknowns, new Set())) {
    const wx = w.x; // wrenches отсчитывает координаты от того же корня
    if (wx + shift <= x) continue;
    Q -= w.fy;
    M += (wx + shift - x) * w.fy + w.m;
  }
  for (const it of s.items) {
    if (it.type !== 'dist') continue;
    const xa = px[it.from] + shift,
      xb = px[it.to] + shift;
    const lo = Math.max(Math.min(xa, xb), x),
      hi = Math.max(xa, xb);
    if (hi <= lo) continue;
    const ang = (LOAD_ANG[it.dir] * Math.PI) / 180;
    const fy = Math.round(Math.sin(ang));
    const q = (t: number) => it.q1 + ((it.q2 - it.q1) * (t - xa)) / (xb - xa);
    const n = 8,
      h = (hi - lo) / n;
    for (let i = 0; i <= n; i++) {
      const t = lo + i * h,
        wgt = ((i === 0 || i === n ? 1 : i % 2 ? 4 : 2) * h) / 3;
      const f = q(t) * fy * wgt;
      Q -= f;
      M += (t - x) * f;
    }
  }
  return { Q, M };
}
