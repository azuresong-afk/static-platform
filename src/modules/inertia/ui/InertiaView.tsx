/** Экран «Геометрия масс»: части тела, ось, чертёж, решение по шагам. */
import { useMemo, useSyncExternalStore } from 'react';
import type { Chrome } from '../../../app/module';
import { DocView } from '../../../shared/ui/DocView';
import { Notice } from '../../../shared/ui/Notice';
import { Num } from '../../../shared/ui/Num';
import { RedoIcon, UndoIcon } from '../../frames/ui/icons';
import { renderInertia } from '../draw/inertia';
import { HAS_AXIS, KINDS, KIND_NAME, PARAMS, solveInertia, type PartKind } from '../model/inertia';
import { INERTIA_PRESETS, type InertiaPresetKey } from '../presets';
import { inertiaDoc } from '../text/solution';
import type { InertiaStore } from './store';
import { PresetOptions } from '../../../shared/ui/PresetOptions';
import { taskEntries } from '../../../shared/tasks';

const AX = ['x', 'y', 'z'];

export function InertiaView({ chrome, store }: { chrome: Chrome; store: InertiaStore }) {
  const st = useSyncExternalStore(store.subscribe, store.get);
  const pr = st.problem;
  const r = useMemo(() => solveInertia(pr), [pr]);
  const fig = useMemo(() => renderInertia(pr, r), [pr, r]);
  const doc = useMemo(() => inertiaDoc(pr, r, { explain: st.explain }), [pr, r, st.explain]);

  return (
    <>
      <div className="wrap">
        {chrome.tabs}
        <header className="top">
          <div>
            <h1>Геометрия масс</h1>
            <p className="lede">Моменты инерции составных тел из стержней, колец, дисков, цилиндров, шаров и брусьев: теорема Гюйгенса — Штейнера, радиус инерции, осевые и центробежные моменты, ось под любым углом.</p>
          </div>
          <div className="topright">
            <label className="preset">
              Готовая задача
              <select id="ipreset" value={st.preset} onChange={(e) => store.loadPreset(e.target.value as InertiaPresetKey)}>
                <PresetOptions items={taskEntries(INERTIA_PRESETS)} />
                <option value="custom" hidden>
                  {st.title}
                </option>
              </select>
            </label>
            {chrome.files}
          </div>
        </header>
        <Notice notice={st.notice} onClose={store.closeNotice} />
        <section className="sheet" aria-label="Тело и ось">
          <div className="bar">
            <span className="hint">Положение части — её центр масс; ось части — ось симметрии (у стержня — направление).</span>
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
            <svg id="isvg" className="sketch" viewBox={fig.viewBox} role="img" aria-label="Тело и ось" dangerouslySetInnerHTML={{ __html: fig.svg }} />
          </div>
        </section>
        <div className="cols">
          <section className="panel conv" aria-label="Части">
            <h2>Ось</h2>
            <div className="cgpar cg0">
              {[0, 1, 2].map((a) => (
                <Num key={'A' + a} id={`i-A${a}`} label={`A: ${AX[a]}`} value={pr.A[a]} neg zero onType={(v) => store.typeAxis('A', a, v)} onEnd={() => store.endSession(`a:A:${a}`)} />
              ))}
              {[0, 1, 2].map((a) => (
                <Num key={'u' + a} id={`i-u${a}`} label={`направление ${AX[a]}`} value={pr.axis[a]} neg zero onType={(v) => store.typeAxis('axis', a, v)} onEnd={() => store.endSession(`a:axis:${a}`)} />
              ))}
            </div>
            <h2>Части</h2>
            <label className="toggle">
              <input type="checkbox" id="iweight" checked={pr.byWeight} onChange={(e) => store.setByWeight(e.target.checked)} />
              Заданы веса P (m = P/g, g = 9,81 м/с²)
            </label>
            <div className="asteps" id="iparts">
              {pr.parts.map((q, i) => (
                <div key={i}>
                  <div className="cgrow">
                    <span className="segname">{i + 1}</span>
                    <select aria-label="Вид части" value={q.kind} onChange={(e) => store.setKind(i, e.target.value as PartKind)}>
                      {KINDS.map((k) => (
                        <option key={k} value={k}>
                          {KIND_NAME[k]}
                        </option>
                      ))}
                    </select>
                    <label className="chk" title="Вырез: масса вычитается">
                      <input type="checkbox" data-cut={i} checked={q.s < 0} onChange={(e) => store.setSign(i, e.target.checked)} /> вырез
                    </label>
                    <button type="button" className="del" aria-label="Убрать часть" disabled={pr.parts.length <= 1} onClick={() => store.removePart(i)}>
                      ×
                    </button>
                  </div>
                  <div className="cgpar">
                    <Num id={`i-m${i}`} label={pr.byWeight ? 'вес P' : 'масса m'} value={q.m} onType={(v) => store.typePart(i, 'm', v)} onEnd={() => store.endSession(`p:${i}:m`)} />
                    {PARAMS[q.kind].map(([key, label]) => (
                      <Num key={key} id={`i-${key}${i}`} label={label} value={q.p[key]} zero onType={(v) => store.typePart(i, key, v)} onEnd={() => store.endSession(`p:${i}:${key}`)} />
                    ))}
                    {[0, 1, 2].map((a) => (
                      <Num key={'c' + a} id={`i-c${a}${i}`} label={`C: ${AX[a]}`} value={q.c[a]} neg zero onType={(v) => store.typePart(i, `c${a}`, v)} onEnd={() => store.endSession(`p:${i}:c${a}`)} />
                    ))}
                    {HAS_AXIS[q.kind] &&
                      [0, 1, 2].map((a) => (
                        <Num key={'u' + a} id={`i-u${a}${i}`} label={`ось части ${AX[a]}`} value={q.u[a]} neg zero onType={(v) => store.typePart(i, `u${a}`, v)} onEnd={() => store.endSession(`p:${i}:u${a}`)} />
                      ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="segbtns">
              <button type="button" id="iadd" onClick={store.addPart}>
                + часть
              </button>
            </div>
            <p className="empty">Длины — в метрах. Для выреза указывается масса вырезанной части. Центр масс конуса — на h/4 от основания.</p>
          </section>
          <section className="panel" aria-label="Решение">
            <div className="sol-head">
              <h2>Решение</h2>
              <label className="toggle">
                <input type="checkbox" checked={st.explain} onChange={(e) => store.setExplain(e.target.checked)} />
                Подробные пояснения
              </label>
            </div>
            <div id="isolution">
              <DocView doc={doc} />
            </div>
          </section>
        </div>
      </div>
      <article className="print-report" aria-hidden="true">
        <header className="pr-head">
          <h1>{st.title}</h1>
          <p>Геометрия масс · {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </header>
        <section className="pr-sec pr-figs">
          <figure>
            <svg viewBox={fig.viewBox} dangerouslySetInnerHTML={{ __html: fig.svg }} />
            <figcaption>Тело и ось</figcaption>
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
