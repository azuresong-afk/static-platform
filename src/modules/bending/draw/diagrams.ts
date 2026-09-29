/**
 * Эпюры Q и M под балкой. Горизонтальный масштаб — тот же, что у расчётной схемы (Layout из «Балок и рам»),
 * поэтому точки эпюр стоят точно под точками балки. Отрисовка — общая (src/shared/draw/diagrams.ts).
 */
import { forceNames, type Conventions } from '../../../shared/conventions';
import { renderBands } from '../../../shared/draw/diagrams';
import type { Layout } from '../../frames/draw/drawing';
import type { Beam } from '../model/beam';

export interface DiagramsSVG {
  svg: string;
  viewBox: string;
}

export function renderDiagrams(beam: Beam, L: Layout, c: Conventions): DiagramsSVG {
  const names = forceNames(c);
  const X = (x: number) => Math.round((L.OX + x * L.SC) * 10) / 10;
  return renderBands(
    [
      { name: names.Q, cls: 'q', up: 1, pieces: beam.spans.map((sp) => ({ x0: sp.x0, x1: sp.x1, poly: sp.Q })) },
      { name: names.M, cls: 'm', up: c.mSide === 'compressed' ? 1 : -1, pieces: beam.spans.map((sp) => ({ x0: sp.x0, x1: sp.x1, poly: sp.M, marks: sp.extrema })) },
    ],
    X,
    L.W,
  );
}
