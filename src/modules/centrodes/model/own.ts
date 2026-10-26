/**
 * Пункт 31: своё движение в «Центроидах» (Мещерский 17.12 и любые другие). Движение тела задаётся формулами от
 * параметра φ (в формулах — t, градусы): начало подвижных осей x(φ), y(φ) и угол θ(φ) оси ξ к оси x. По желанию —
 * уравнения центроид для проверки: G(x, y) = 0 и H(ξ, η) = 0 (в формулах ξ — xi, η — eta).
 * Невязка проверяемого уравнения — расстояние от точки построенной центроиды до линии G = 0 по первому приближению
 * |G|/|∇G|, отнесённое к размеру центроиды: безразмерна и не зависит от того, на что умножено уравнение.
 */
import { evalExpr, parseExpr } from '../../../shared/expr';
import type { CentrodePreset } from '../presets';
import type { Centrodes, Shape, Source } from './centrodes';

export interface OwnMotion {
  x: string;
  y: string;
  theta: string;
  from: number;
  to: number;
  /** Поворот оси ξ относительно направления θ, °. */
  rot: number;
  /** Проверяемые уравнения: неподвижной центроиды G(x, y) и подвижной H(xi, eta); пусто — нет. */
  eqF: string;
  eqM: string;
}

export const OWN_DEFAULT: OwnMotion = {
  x: 't*pi/180',
  y: '1',
  theta: '−t',
  from: 0,
  to: 360,
  rot: 0,
  eqF: 'y',
  eqM: 'xi^2 + eta^2 − 1',
};

export const OWN_VARS_F = ['x', 'y'];
export const OWN_VARS_M = ['xi', 'eta'];

/**
 * Источник движения. Тело на чертеже — крест подвижных осей; его размер задаёт и масштаб, дальше которого мгновенный
 * центр не рисуется: четверть наибольшего из размаха траектории начала осей и расстояния его от начала координат.
 */
export function ownSource(o: OwnMotion): Source {
  const px = parseExpr(o.x),
    py = parseExpr(o.y);
  const pts: [number, number][] = [];
  if (px.ok && py.ok && o.to > o.from)
    for (let i = 0; i <= 48; i++) {
      const t = o.from + ((o.to - o.from) * i) / 48;
      const p: [number, number] = [evalExpr(px.e, t), evalExpr(py.e, t)];
      if (p.every(Number.isFinite)) pts.push(p);
    }
  let s = 1;
  for (const a of pts) {
    s = Math.max(s, Math.hypot(a[0], a[1]));
    for (const b of pts) s = Math.max(s, Math.hypot(a[0] - b[0], a[1] - b[1]));
  }
  const h = s / 4;
  const shapes: Shape[] = [
    {
      k: 'poly',
      pts: [
        [-h / 2, 0],
        [h, 0],
      ],
    },
    {
      k: 'poly',
      pts: [
        [0, -h / 2],
        [0, h],
      ],
    },
  ];
  return { kind: 'motion', x: o.x, y: o.y, theta: o.theta, from: o.from, to: o.to, shapes, frameRot: o.rot };
}

/** Ошибки формул (пусто — всё разбирается). */
export function ownErrors(o: OwnMotion): string[] {
  const out: string[] = [];
  const chk = (src: string, what: string, vars?: string[]) => {
    const r = parseExpr(src, { vars });
    if (!r.ok) out.push(`${what}: ${r.error}`);
  };
  chk(o.x, 'x(φ)');
  chk(o.y, 'y(φ)');
  chk(o.theta, 'θ(φ)');
  if (o.eqF.trim()) chk(o.eqF, 'уравнение неподвижной центроиды', OWN_VARS_F);
  if (o.eqM.trim()) chk(o.eqM, 'уравнение подвижной центроиды', OWN_VARS_M);
  if (!(o.to > o.from)) out.push('Диапазон φ: «до» больше «от».');
  return out;
}

/** Невязка уравнения G(a, b) = 0 вдоль линий (в долях размера линии). */
function residual(src: string, vars: string[], lines: [number, number][][]): number {
  const r = parseExpr(src, { vars });
  if (!r.ok) return NaN;
  const G = (a: number, b: number) => evalExpr(r.e, 0, { [vars[0]]: a, [vars[1]]: b });
  const pts = lines.flat();
  const size = Math.max(1e-12, ...pts.map((p) => Math.hypot(p[0], p[1])));
  let worst = 0;
  for (const [a, b] of pts) {
    const h = 1e-6 * size;
    const g = G(a, b);
    const gx = (G(a + h, b) - G(a - h, b)) / (2 * h),
      gy = (G(a, b + h) - G(a, b - h)) / (2 * h);
    const gn = Math.hypot(gx, gy);
    const d = gn > 0 ? Math.abs(g) / gn : Math.abs(g) > 1e-12 ? Infinity : 0;
    worst = Math.max(worst, d / size);
  }
  return worst;
}

/** «Готовая задача» для текста решения: уравнения пользователя вместо ответа книги. */
export function ownPreset(o: OwnMotion): CentrodePreset {
  const has = !!(o.eqF.trim() || o.eqM.trim());
  return {
    title: 'Своё движение',
    params: [],
    build: () => ownSource(o),
    book: { fixed: o.eqF.trim() ? `${o.eqF} = 0` : '—', moving: o.eqM.trim() ? `${o.eqM} = 0` : '—' },
    ...(has
      ? {
          check: {
            fixed: () => 0,
            moving: () => 0,
            tol: 1e-6,
          },
        }
      : {}),
  };
}

/** Невязки уравнений пользователя по построенным центроидам. */
export function ownResiduals(o: OwnMotion, c: Centrodes): { fixed: number; moving: number } {
  return {
    fixed: o.eqF.trim() ? residual(o.eqF, OWN_VARS_F, c.fixed) : NaN,
    moving: o.eqM.trim() ? residual(o.eqM, OWN_VARS_M, c.moving) : NaN,
  };
}
