/** Экран «Центроиды»: чертёж с неподвижной и подвижной центроидами, размеры, положение φ, решение. */
import { useMemo, useSyncExternalStore } from 'react';
import type { Chrome } from '../../../app/module';
import { taskEntries } from '../../../shared/tasks';
import { DocView } from '../../../shared/ui/DocView';
import { Notice } from '../../../shared/ui/Notice';
import { Num } from '../../../shared/ui/Num';
import { PresetOptions } from '../../../shared/ui/PresetOptions';
import { RedoIcon, UndoIcon } from '../../frames/ui/icons';
import { renderFixed, renderMoving } from '../draw/centrodes';
import { centrodes, poseAt, sourceRange } from '../model/centrodes';
import { CENTRODE_PRESETS, type CentrodePreset, type CentrodePresetKey } from '../presets';
import { centrodesDoc } from '../text/solution';
import type { CentrodesStore } from './store';

export function CentrodesView({ chrome, store }: { chrome: Chrome; store: CentrodesStore }) {
  const st = useSyncExternalStore(store.subscribe, store.get);
  const preset: CentrodePreset = CENTRODE_PRESETS[st.preset];
  const src = useMemo(() => preset.build(st.values), [preset, st.values]);
  const cen = useMemo(() => centrodes(src), [src]);
  const pose = useMemo(() => poseAt(src, st.phi), [src, st.phi]);
  const [a, b] = useMemo(() => sourceRange(src), [src]);
  const figF = useMemo(() => renderFixed(cen, pose.ok ? pose : null), [cen, pose]);
  const figM = useMemo(() => renderMoving(cen, pose.ok ? pose : null), [cen, pose]);
  const doc = useMemo(
    () => centrodesDoc({ preset, values: st.values, src, cen, pose, phi: st.phi, explain: st.explain }),
    [preset, st.values, src, cen, pose, st.phi, st.explain],
  );

  return (
    <>
      <div className="wrap">
        {chrome.tabs}
        <header className="top">
          <div>
            <h1>Центроиды</h1>
            <p className="lede">
              Неподвижная и подвижная центроиды плоского движения: линии мгновенного центра скоростей в неподвижной плоскости и в плоскости тела. Мгновенный
              центр находится решением скоростей механизма или из заданного движения тела.
            </p>
          </div>
          <div className="topright">
            <label className="preset">
              Готовая задача
              <select id="cpreset" value={st.preset} onChange={(e) => store.loadPreset(e.target.value as CentrodePresetKey)}>
                <PresetOptions items={taskEntries(CENTRODE_PRESETS)} />
              </select>
            </label>
            {chrome.files}
          </div>
        </header>
        <Notice notice={st.notice} onClose={store.closeNotice} />

        <section className="sheet" aria-label="Центроиды">
          <div className="bar">
            <span className="hint">Ползунок меняет положение: подвижная центроида катится по неподвижной.</span>
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
            <svg
              id="csvg"
              className="sketch"
              viewBox={figF.viewBox}
              role="img"
              aria-label="Неподвижная и подвижная центроиды"
              dangerouslySetInnerHTML={{ __html: figF.svg }}
            />
          </div>
          <div className="canvas">
            <svg
              id="csvg2"
              className="sketch"
              viewBox={figM.viewBox}
              role="img"
              aria-label="Подвижная центроида в подвижных осях"
              dangerouslySetInnerHTML={{ __html: figM.svg }}
            />
          </div>
        </section>

        <div className="cols">
          <section className="panel conv" aria-label="Данные">
            <h2>Движение</h2>
            <label className="field ce-phi">
              <span>
                Положение φ = <b id="cphival">{st.phi.toLocaleString('ru-RU', { maximumFractionDigits: 1 })}°</b>
              </span>
              <input
                id="cphi"
                type="range"
                min={a}
                max={b}
                step={Math.max(0.1, (b - a) / 720)}
                value={st.phi}
                onChange={(e) => store.setPhi(+e.target.value)}
                aria-label="Положение φ"
              />
            </label>
            <div className="sub">Размеры</div>
            <div className="asteps">
              {preset.params.map((p) => (
                <div key={p.key} className="trow" style={{ gridTemplateColumns: '1fr 26px' }}>
                  <Num
                    id={`cv-${p.key}`}
                    label={p.label}
                    value={st.values[p.key]}
                    onType={(x) => store.typeValue(p.key, x)}
                    onEnd={() => store.endSession(`val:${p.key}`)}
                  />
                </div>
              ))}
            </div>
            <p className="empty">
              {preset.params.map((p) => (p.hint ? `${p.label} — ${p.hint}. ` : '')).join('')}
              Размеры безразмерные: единицы выбирает читатель.
            </p>
            {preset.note && <p className="empty">{preset.note}</p>}
          </section>
          <section className="panel" aria-label="Решение">
            <div className="sol-head">
              <h2>Решение</h2>
              <label className="toggle">
                <input type="checkbox" checked={st.explain} onChange={(e) => store.setExplain(e.target.checked)} />
                Подробные пояснения
              </label>
            </div>
            <div id="csolution">
              <DocView doc={doc} />
            </div>
          </section>
        </div>
      </div>
      <article className="print-report" aria-hidden="true">
        <header className="pr-head">
          <h1>{st.title}</h1>
          <p>Центроиды · {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </header>
        <section className="pr-sec pr-figs">
          <figure>
            <svg viewBox={figF.viewBox} dangerouslySetInnerHTML={{ __html: figF.svg }} />
            <figcaption>Неподвижная и подвижная центроиды</figcaption>
          </figure>
          <figure>
            <svg viewBox={figM.viewBox} dangerouslySetInnerHTML={{ __html: figM.svg }} />
            <figcaption>Подвижная центроида в подвижных осях</figcaption>
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
