/** Экран «Центр тяжести»: режим, части (вырезы, удельный вес), чертёж, решение по шагам. */
import { useMemo, useState, useSyncExternalStore } from 'react';
import type { Chrome } from '../../../app/module';
import { parseNum } from '../../../shared/format';
import { DocView } from '../../../shared/ui/DocView';
import { Notice } from '../../../shared/ui/Notice';
import { Num } from '../../../shared/ui/Num';
import { RedoIcon, UndoIcon } from '../../frames/ui/icons';
import { renderCentroid } from '../draw/centroid';
import { KINDS, KIND_NAME, PARAMS, solveCentroid, type CPart, type Mode, type PartKind } from '../model/centroid';
import { CENTROID_PRESETS, type CentroidPresetKey } from '../presets';
import { centroidDoc } from '../text/solution';
import type { CentroidStore } from './store';

const MODES: [Mode, string][] = [
  ['area', 'плоская фигура'],
  ['line', 'линия (проволока)'],
  ['volume', 'тело'],
  ['mass', 'система грузов'],
];

/** Вершины многоугольника: «x y; x y; …» (запятая — десятичная). */
function PolyField({ part, onPts }: { part: CPart; onPts: (pts: [number, number][]) => void }) {
  const fmtPts = (pts: [number, number][]) => pts.map(([x, y]) => `${String(x).replace('.', ',')} ${String(y).replace('.', ',')}`).join('; ');
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? fmtPts(part.pts ?? []);
  const parse = (s: string): [number, number][] | null => {
    const pts = s
      .split(';')
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => t.split(/\s+/).map(parseNum));
    return pts.length >= 3 && pts.every((p) => p.length === 2 && p.every(Number.isFinite)) ? (pts as [number, number][]) : null;
  };
  return (
    <label className="sfield" style={{ gridColumn: '1 / -1' }}>
      <span>вершины: x y; x y; …</span>
      <span className="inp">
        <input
          type="text"
          className={parse(shown) ? undefined : 'bad'}
          value={shown}
          onChange={(e) => {
            setText(e.target.value);
            const p = parse(e.target.value);
            if (p) onPts(p);
          }}
          onBlur={() => setText(null)}
        />
      </span>
    </label>
  );
}

export function CentroidView({ chrome, store }: { chrome: Chrome; store: CentroidStore }) {
  const st = useSyncExternalStore(store.subscribe, store.get);
  const pr = st.problem;
  const r = useMemo(() => solveCentroid(pr), [pr]);
  const fig = useMemo(() => renderCentroid(pr, r), [pr, r]);
  const doc = useMemo(() => centroidDoc(pr, r, { explain: st.explain }), [pr, r, st.explain]);

  return (
    <>
      <div className="wrap">
        {chrome.tabs}
        <header className="top">
          <div>
            <h1>Центр тяжести</h1>
            <p className="lede">Составные плоские фигуры с вырезами, линии, тела и системы грузов: части с отрицательной площадью, разный удельный вес, формулы центров секторов, сегментов, дуг, конуса и полушара.</p>
          </div>
          <div className="topright">
            <label className="preset">
              Готовая задача
              <select id="gpreset" value={st.preset} onChange={(e) => store.loadPreset(e.target.value as CentroidPresetKey)}>
                {(Object.keys(CENTROID_PRESETS) as CentroidPresetKey[]).map((k) => (
                  <option key={k} value={k}>
                    {CENTROID_PRESETS[k].title}
                  </option>
                ))}
                <option value="custom" hidden>
                  {st.title}
                </option>
              </select>
            </label>
            {chrome.files}
          </div>
        </header>
        <Notice notice={st.notice} onClose={store.closeNotice} />
        <section className="sheet" aria-label="Фигура">
          <div className="bar">
            <span className="hint">Углы секторов, сегментов и дуг — от оси x против часовой стрелки.</span>
            <div className="hist">
              <button type="button" title="Отменить (Ctrl+Z)" disabled={!st.canUndo} onClick={store.undo}>
                <UndoIcon />
                Отменить
              </button>
              <button type="button" title="Повторить (Ctrl+Shift+Z)" disabled={!st.canRedo} onClick={store.redo}>
                <RedoIcon />
                Повторить
              </button>
            </div>
          </div>
          <div className="canvas">
            <svg id="gsvg" className="sketch" viewBox={fig.viewBox} role="img" aria-label="Фигура и центр тяжести" dangerouslySetInnerHTML={{ __html: fig.svg }} />
          </div>
        </section>
        <div className="cols">
          <section className="panel conv" aria-label="Части">
            <h2>Части</h2>
            <label className="field">
              <span>Что ищем</span>
              <select id="gmode" value={pr.mode} onChange={(e) => store.setMode(e.target.value as Mode)}>
                {MODES.map(([m, t]) => (
                  <option key={m} value={m}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <div className="asteps" id="gparts">
              {pr.parts.map((q, i) => (
                <div key={i}>
                  <div className="cgrow">
                    <span className="segname">{i + 1}</span>
                    <select aria-label="Вид части" value={q.kind} onChange={(e) => store.setKind(i, e.target.value as PartKind)}>
                      {KINDS[pr.mode].map((k) => (
                        <option key={k} value={k}>
                          {KIND_NAME[k]}
                        </option>
                      ))}
                    </select>
                    <label className="chk" title="Вырез: часть вычитается">
                      <input type="checkbox" data-cut={i} checked={q.s < 0} onChange={(e) => store.setSign(i, e.target.checked)} /> вырез
                    </label>
                    <button type="button" className="del" aria-label="Убрать часть" disabled={pr.parts.length <= 1} onClick={() => store.removePart(i)}>
                      ×
                    </button>
                  </div>
                  <div className="cgpar">
                    {q.kind === 'poly' && <PolyField part={q} onPts={(pts) => store.typePts(i, pts)} />}
                    <Num id={`g-k${i}`} label="уд. вес k" value={q.k} onType={(v) => store.typeParam(i, 'k', v)} onEnd={() => store.endSession(`p:${i}:k`)} />
                    {PARAMS[q.kind].map(([key, label]) =>
                      key === 'ax' ? (
                        <label className="sfield" key={key}>
                          <span>{label}</span>
                          <select value={q.p.ax} onChange={(e) => store.setParam(i, 'ax', +e.target.value)}>
                            <option value={0}>x</option>
                            <option value={1}>y</option>
                            <option value={2}>z</option>
                          </select>
                        </label>
                      ) : key === 'dir' ? (
                        <label className="sfield" key={key}>
                          <span>{label}</span>
                          <select value={q.p.dir >= 0 ? 1 : -1} onChange={(e) => store.setParam(i, 'dir', +e.target.value)}>
                            <option value={1}>по оси</option>
                            <option value={-1}>против оси</option>
                          </select>
                        </label>
                      ) : (
                        <Num key={key} id={`g-${key}${i}`} label={label} value={q.p[key]} neg zero onType={(v) => store.typeParam(i, key, v)} onEnd={() => store.endSession(`p:${i}:${key}`)} />
                      ),
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="segbtns">
              <button type="button" id="gadd" onClick={store.addPart}>
                + часть
              </button>
            </div>
            <p className="empty">k — удельный вес (плотность) части; если части однородны, оставьте 1.</p>
          </section>
          <section className="panel" aria-label="Решение">
            <div className="sol-head">
              <h2>Решение</h2>
              <label className="toggle">
                <input type="checkbox" checked={st.explain} onChange={(e) => store.setExplain(e.target.checked)} />
                Подробные пояснения
              </label>
            </div>
            <div id="gsolution">
              <DocView doc={doc} />
            </div>
          </section>
        </div>
      </div>
      <article className="print-report" aria-hidden="true">
        <header className="pr-head">
          <h1>{st.title}</h1>
          <p>Центр тяжести · {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </header>
        <section className="pr-sec pr-figs">
          <figure>
            <svg viewBox={fig.viewBox} dangerouslySetInnerHTML={{ __html: fig.svg }} />
            <figcaption>Части и центр тяжести</figcaption>
          </figure>
        </section>
        <section className="pr-sec">
          <h2>Решение</h2>
          <DocView doc={doc} />
        </section>
      </article>
    </>
  );
}
