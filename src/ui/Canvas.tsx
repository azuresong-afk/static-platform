/**
 * Чертёж с взаимодействием, как в прототипе:
 * - перетаскивание опор и нагрузок с прилипанием к ближайшей точке;
 * - щелчок по распределённой нагрузке выделяет её, щелчок мимо снимает выделение;
 * - щелчок по размеру открывает поле длины (Enter — применить, Esc — отменить, потеря фокуса — применить);
 * - двойной щелчок по участку ставит новую точку.
 */
import { useEffect, useRef, useState } from 'react';
import { nearestNode, type Drawing } from '../draw/drawing';
import { fmtIn, parseNum, r1 } from '../model/format';
import type { Geom } from '../model/geometry';
import { useStore } from './useStore';

export function Canvas({ drawing, g }: { drawing: Drawing; g: Geom }) {
  const [st, store] = useStore();
  const svgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; moved: boolean } | null>(null);
  const [dim, setDim] = useState<{ seg: string; text: string; left: number; top: number } | null>(null);
  const dimRef = useRef<HTMLInputElement>(null);
  // Актуальные раскладка и геометрия для обработчиков окна.
  const live = useRef({ drawing, g });
  live.current = { drawing, g };

  const svgPt = (ev: { clientX: number; clientY: number }): [number, number] => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = ev.clientX;
    pt.y = ev.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return [p.x, p.y];
  };

  useEffect(() => {
    const move = (ev: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const { drawing, g } = live.current;
      const id = nearestNode(drawing.layout, g, svgPt(ev));
      if (store.moveItem(d.id, id, !d.moved)) d.moved = true;
    };
    const up = () => (drag.current = null);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [store]);

  useEffect(() => {
    if (dim && dimRef.current && document.activeElement !== dimRef.current) {
      dimRef.current.focus();
      dimRef.current.select();
    }
  }, [dim]);

  const onPointerDown = (ev: React.PointerEvent) => {
    const t = ev.target as Element;
    if (t.closest('[data-dim]')) return;
    const pk = t.closest('[data-pick]') as HTMLElement | null;
    if (pk) {
      store.select(pk.dataset.pick!);
      return;
    }
    const gEl = t.closest('[data-drag]') as HTMLElement | null;
    if (!gEl) {
      if (st.sel && !t.closest('[data-segid]')) store.select(null);
      return;
    }
    ev.preventDefault();
    drag.current = { id: gEl.dataset.drag!, moved: false };
    store.select(gEl.dataset.drag!);
  };

  const openDim = (segId: string) => {
    const s = st.s.segs.find((q) => q.id === segId),
      p = drawing.layout.dimPos[segId];
    if (!s || !p) return;
    const cv = canvasRef.current!,
      cr = cv.getBoundingClientRect(),
      sr = svgRef.current!.getBoundingClientRect(),
      k = sr.width / drawing.layout.W;
    setDim({ seg: segId, text: fmtIn(s.len), left: sr.left - cr.left + cv.scrollLeft + p[0] * k - 42, top: sr.top - cr.top + p[1] * k - 17 });
  };
  const closeDim = (save: boolean) => {
    if (!dim) return;
    const { seg, text } = dim;
    setDim(null);
    if (!save) return;
    const v = parseNum(text);
    if (isNaN(v)) return;
    store.commitSegLen(seg, v);
  };

  const onDoubleClick = (ev: React.MouseEvent) => {
    const h = (ev.target as Element).closest('[data-segid]') as SVGElement | null;
    if (!h) return;
    const s = st.s.segs.find((q) => q.id === h.dataset.segid);
    if (!s) return;
    const L = drawing.layout;
    const ax = L.OX + g.pos[s.a][0] * L.SC,
      ay = L.OY + (L.MAXY - g.pos[s.a][1]) * L.SC;
    const [px, py] = svgPt(ev);
    const t = r1({ r: px - ax, l: ax - px, u: ay - py, d: py - ay }[s.dir] / L.SC);
    if (t < 0.05 || t > s.len - 0.05) return;
    store.splitSeg(s.id, t);
  };

  return (
    <div className="canvas" id="canvas" ref={canvasRef}>
      <svg
        id="svg"
        ref={svgRef}
        viewBox={drawing.viewBox}
        role="img"
        aria-label="Чертёж конструкции"
        onPointerDown={onPointerDown}
        onClick={(ev) => {
          const d = (ev.target as Element).closest('[data-dim]') as SVGElement | null;
          if (d) openDim(d.dataset.dim!);
        }}
        onDoubleClick={onDoubleClick}
        dangerouslySetInnerHTML={{ __html: drawing.svg }}
      />
      {dim && (
        <input
          id="dimedit"
          ref={dimRef}
          type="text"
          inputMode="decimal"
          aria-label="Длина участка, м"
          style={{ left: dim.left + 'px', top: dim.top + 'px' }}
          value={dim.text}
          onChange={(e) => setDim({ ...dim, text: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              closeDim(true);
            } else if (e.key === 'Escape') {
              e.preventDefault();
              closeDim(false);
            }
          }}
          onBlur={() => closeDim(true)}
        />
      )}
    </div>
  );
}
