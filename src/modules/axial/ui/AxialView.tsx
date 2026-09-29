/** Экран «Растяжение-сжатие»: брус (ступени, силы, заделки, материал), чертёж с эпюрами N, σ, ε, Δ, решение. */
import { useMemo, useSyncExternalStore } from 'react';
import type { Chrome } from '../../../app/module';
import { roman } from '../../frames/model/geometry';
import { DocView } from '../../../shared/ui/DocView';
import { Notice } from '../../../shared/ui/Notice';
import { Num } from '../../../shared/ui/Num';
import { RedoIcon, UndoIcon } from '../../frames/ui/icons';
import { heldBySupport, solveBar, type Bar } from '../model/bar';
import { pointName, renderBar, renderBarDiagrams } from '../draw/bar';
import { AXIAL_PRESETS, type AxialPresetKey } from '../presets';
import { axialDoc } from '../text/solution';
import type { AxialStore } from './store';

const WHY = {
  nosteps: 'Добавьте хотя бы одну ступень.',
  nosupport: 'Нужна хотя бы одна заделка.',
  findWithHeat: 'При нагреве бруса с двумя заделками площадь A нужно задать (в задаче 1.2 — из решения задачи 1.1): температурные усилия зависят от A.',
};

export function AxialView({ chrome, store }: { chrome: Chrome; store: AxialStore }) {
  const st = useSyncExternalStore(store.subscribe, store.get);
  const b = st.bar;
  const sol = useMemo(() => solveBar(b), [b]);
  const ok = sol.ok && Number.isFinite(sol.A) && sol.A > 0 ? sol : null;
  const bar = useMemo(() => renderBar(b, ok), [b, ok]);
  const dg = useMemo(() => (ok ? renderBarDiagrams(b, ok) : null), [b, ok]);
  const doc = useMemo(() => (ok ? axialDoc(b, ok, { explain: st.explain }) : null), [b, ok, st.explain]);
  const why = !sol.ok ? WHY[sol.why] : !ok ? 'Нагрузки нет: N = 0 на всех участках, площадь из условия прочности не определяется.' : null;

  const radio = <K extends 'supports' | 'areaMode'>(key: K, value: Bar[K], label: string) => (
    <label className="opt">
      <input type="radio" name={'a-' + key} checked={b[key] === value} onChange={() => store.setField(key, value)} />
      <span>{label}</span>
    </label>
  );
  const field = (key: 'E' | 'sigmaAllow' | 'sigmaT' | 'A', label: string, unit: string, zero = false) => (
    <Num key={key} id={'a-' + key} label={label} unit={unit} value={b[key]} zero={zero} onType={(v) => store.typeField(key, v)} onEnd={() => store.endSession(key)} />
  );

  return (
    <>
      <div className="wrap">
        {chrome.tabs}
        <header className="top">
          <div>
            <h1>Растяжение и сжатие бруса</h1>
            <p className="lede">Ступенчатый брус с одной или двумя заделками, силы и нагрев: продольные силы, напряжения, деформации и перемещения — эпюры и решение по участкам.</p>
          </div>
          <div className="topright">
            <label className="preset">
              Готовая задача
              <select id="apreset" value={st.preset} onChange={(e) => store.loadPreset(e.target.value as AxialPresetKey)}>
                {(Object.keys(AXIAL_PRESETS) as AxialPresetKey[]).map((k) => (
                  <option key={k} value={k}>
                    {AXIAL_PRESETS[k].title}
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

        <section className="sheet" aria-label="Брус и эпюры">
          <div className="bar">
            <span className="hint">Силы — в кН («+» — вправо), длины — в м, площади — в см², напряжения — в МПа, перемещения — в мм.</span>
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
          <div className="canvas dg-canvas">
            <svg id="abar" viewBox={bar.viewBox} role="img" aria-label="Брус" dangerouslySetInnerHTML={{ __html: bar.svg }} />
            {dg && <svg id="adg" className="dg" viewBox={dg.viewBox} role="img" aria-label="Эпюры" dangerouslySetInnerHTML={{ __html: dg.svg }} />}
          </div>
          {why && (
            <div className="dg-empty" role="status">
              <p>{why}</p>
            </div>
          )}
        </section>

        <div className="cols">
          <section className="panel conv" aria-label="Брус">
            <h2>Брус</h2>
            <div className="sub">Закрепление</div>
            {radio('supports', 'left', 'заделка слева')}
            {radio('supports', 'right', 'заделка справа')}
            {radio('supports', 'both', 'заделки с обеих сторон (статически неопределимый)')}
            <div className="sub">Ступени слева направо</div>
            <div className="asteps">
              <div className="ahead">
                <span />
                <span>длина, м</span>
                <span>площадь, ×A</span>
                <span>нагрев, К</span>
                <span />
              </div>
              {b.steps.map((s, i) => (
                <div className="arow" key={i}>
                  <span className="segname">{roman(i)}</span>
                  <Num id={`a-l${i}`} label="" value={s.l} onType={(v) => store.typeStep(i, 'l', v)} onEnd={() => store.endSession(`step:${i}:l`)} />
                  <Num id={`a-c${i}`} label="" value={s.c} onType={(v) => store.typeStep(i, 'c', v)} onEnd={() => store.endSession(`step:${i}:c`)} />
                  <Num id={`a-t${i}`} label="" value={s.dT} neg onType={(v) => store.typeStep(i, 'dT', v)} onEnd={() => store.endSession(`step:${i}:dT`)} />
                  <button type="button" className="del" aria-label={`Убрать ступень ${roman(i)}`} disabled={b.steps.length <= 1} onClick={() => store.removeStep(i)}>
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="segbtns">
              <button type="button" id="aadd" onClick={store.addStep}>
                + ступень справа
              </button>
            </div>
            <div className="sub">Силы в точках, кН («+» — вправо)</div>
            <div className="sgrid">
              {b.forces.map((f, j) =>
                heldBySupport(b, j) ? (
                  <label className="sfield" key={j}>
                    <span>точка {pointName(j)}</span>
                    <span className="empty">в заделке</span>
                  </label>
                ) : (
                  <Num key={j} id={`a-f${j}`} label={`точка ${pointName(j)}`} value={f} neg onType={(v) => store.typeForce(j, v)} onEnd={() => store.endSession(`force:${j}`)} />
                ),
              )}
            </div>
            <div className="sub">Площадь A</div>
            {radio('areaMode', 'find', 'найти из условия прочности')}
            {radio('areaMode', 'given', 'задана')}
            <div className="sgrid">
              {b.areaMode === 'given' && field('A', 'A', 'см²')}
              {field('sigmaAllow', '[σ]', 'МПа')}
              {field('sigmaT', 'σт (0 — не считать запас)', 'МПа', true)}
              {field('E', 'E', 'МПа')}
              <Num
                id="a-alpha"
                label="α, 10⁻⁶ 1/К"
                value={Math.round(b.alpha * 1e6 * 1e6) / 1e6}
                zero
                onType={(v) => store.typeField('alpha', v / 1e6)}
                onEnd={() => store.endSession('alpha')}
              />
            </div>
          </section>
          <section className="panel" aria-label="Решение">
            <div className="sol-head">
              <h2>Решение</h2>
              <label className="toggle">
                <input type="checkbox" checked={st.explain} onChange={(e) => store.setExplain(e.target.checked)} />
                Подробные пояснения
              </label>
            </div>
            <div id="asolution">{doc ? <DocView doc={doc} /> : <p className="empty">{why}</p>}</div>
          </section>
        </div>
      </div>
      {doc && dg && (
        <article className="print-report" aria-hidden="true">
          <header className="pr-head">
            <h1>{st.title}</h1>
            <p>Растяжение и сжатие бруса · {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </header>
          <section className="pr-sec pr-figs pr-dg">
            <figure>
              <svg viewBox={bar.viewBox} dangerouslySetInnerHTML={{ __html: bar.svg }} />
              <svg viewBox={dg.viewBox} dangerouslySetInnerHTML={{ __html: dg.svg }} />
              <figcaption>Брус и эпюры N, σ, ε, Δ</figcaption>
            </figure>
          </section>
          <section className="pr-sec">
            <h2>Решение</h2>
            <DocView doc={doc} />
          </section>
        </article>
      )}
    </>
  );
}
