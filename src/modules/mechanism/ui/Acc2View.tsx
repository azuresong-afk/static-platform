/** Экран «ω и ε по ускорениям двух точек» (Мещерский 18.29–18.36): точки тела, два ускорения, решение методом полюса. */
import { useMemo, useSyncExternalStore } from 'react';
import type { Chrome } from '../../../app/module';
import { DocView } from '../../../shared/ui/DocView';
import { LawField } from '../../../shared/ui/LawField';
import { Notice } from '../../../shared/ui/Notice';
import { PresetOptions } from '../../../shared/ui/PresetOptions';
import { taskEntries } from '../../../shared/tasks';
import { RedoIcon, UndoIcon } from '../../frames/ui/icons';
import { renderAcc2 } from '../draw/acc2';
import { solveAcc2 } from '../model/acc2';
import { MECH_PRESETS, type MechPresetKey } from '../presets';
import { acc2Doc } from '../text/acc2';
import { MAX_ACC2_PTS, type MechStore } from './store';

export function Acc2View({ chrome, store }: { chrome: Chrome; store: MechStore }) {
  const st = useSyncExternalStore(store.subscribe, store.get);
  const pr = st.problem.acc2!;
  const r = useMemo(() => solveAcc2(pr), [pr]);
  const fig = useMemo(() => renderAcc2(r), [r]);
  const doc = useMemo(() => acc2Doc(pr, r, { explain: st.explain }), [pr, r, st.explain]);
  const F = (path: (string | number)[], label: string, value: string) => (
    <LawField key={path.join('.')} id={`m2-${path.join('-')}`} label={label} value={value} wide={false} onType={(v) => store.type(path, v)} onEnd={() => store.endSession(path.join('.'))} />
  );
  return (
    <>
      <div className="wrap">
        {chrome.tabs}
        <header className="top">
          <div>
            <h1>Плоский механизм</h1>
            <p className="lede">
              Угловая скорость и угловое ускорение тела по ускорениям двух его точек (метод полюса), ускорения остальных точек и мгновенный центр ускорений.
            </p>
          </div>
          <div className="topright">
            <label className="preset">
              Готовая задача
              <select id="mpreset" value={st.preset} onChange={(e) => store.loadPreset(e.target.value as MechPresetKey)}>
                <PresetOptions items={taskEntries(MECH_PRESETS)} />
                <option value="custom" hidden>
                  {st.title}
                </option>
              </select>
            </label>
            {chrome.files}
          </div>
        </header>
        <Notice notice={st.notice} onClose={store.closeNotice} />
        <section className="sheet" aria-label="Тело и ускорения">
          <div className="bar">
            <button type="button" id="macc2-off" onClick={() => store.setAcc2(false)}>
              ← К механизму
            </button>
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
            <svg id="msvg" className="sketch" viewBox={fig.viewBox} role="img" aria-label="Тело, ускорения точек, мгновенный центр ускорений" dangerouslySetInnerHTML={{ __html: fig.svg }} />
          </div>
        </section>
        <div className="cols">
          <section className="panel conv" aria-label="Данные">
            <h2>Точки тела</h2>
            <p className="empty">Координаты — в плоскости тела (любые единицы). Первые две точки — с заданными ускорениями; остальные — искомые.</p>
            {pr.pts.map((p, i) => (
              <div className="cvrow cvrow2" key={i}>
                <label className="sfield">
                  <span>точка</span>
                  <span className="inp">
                    <input id={`m2-pts-${i}-name`} value={p.name} onChange={(e) => store.type(['acc2', 'pts', i, 'name'], e.target.value.replace(/\s/g, '').slice(0, 6))} onBlur={() => store.endSession(`acc2.pts.${i}.name`)} />
                  </span>
                </label>
                {F(['acc2', 'pts', i, 'x'], 'x', p.x)}
                {F(['acc2', 'pts', i, 'y'], 'y', p.y)}
                {i >= 2 && (
                  <button type="button" className="icon-btn" title="Убрать точку" onClick={() => store.removeAcc2Pt(i)}>
                    ×
                  </button>
                )}
              </div>
            ))}
            <button type="button" id="macc2-add" disabled={pr.pts.length >= MAX_ACC2_PTS} onClick={store.addAcc2Pt}>
              + точка
            </button>
            <h2>Ускорения</h2>
            {[0, 1].map((i) => (
              <div className="cvrow cvrow2" key={i}>
                <span className="hint">a{pr.pts[i]?.name}</span>
                {F(['acc2', 'a', i, 'mag'], 'модуль', pr.a[i]?.mag ?? '0')}
                {F(['acc2', 'a', i, 'ang'], 'угол с осью x, °', pr.a[i]?.ang ?? '0')}
              </div>
            ))}
            <p className="empty">Угол отсчитывается от оси x против часовой стрелки; допускаются формулы («4√2» пишите как 4sqrt(2)).</p>
          </section>
          <section className="panel" aria-label="Решение">
            <div className="sol-head">
              <h2>Решение</h2>
              <label className="toggle">
                <input type="checkbox" checked={st.explain} onChange={(e) => store.setExplain(e.target.checked)} />
                Подробные пояснения
              </label>
            </div>
            <div id="msolution">
              <DocView doc={doc} />
            </div>
          </section>
        </div>
      </div>
      <article className="print-report" aria-hidden="true">
        <header className="pr-head">
          <h1>{st.title}</h1>
          <p>Плоский механизм · {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </header>
        <section className="pr-sec pr-figs">
          <figure>
            <svg viewBox={fig.viewBox} dangerouslySetInnerHTML={{ __html: fig.svg }} />
            <figcaption>Ускорения точек</figcaption>
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
