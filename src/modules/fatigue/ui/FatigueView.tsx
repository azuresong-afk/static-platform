/** Экран «Усталостная прочность»: материал, циклы нормальных и касательных напряжений, коэффициенты детали; диаграмма и решение. */
import { useMemo, useSyncExternalStore } from 'react';
import type { Chrome } from '../../../app/module';
import { DocView } from '../../../shared/ui/DocView';
import { Notice } from '../../../shared/ui/Notice';
import { Num } from '../../../shared/ui/Num';
import { PresetOptions } from '../../../shared/ui/PresetOptions';
import { taskEntries } from '../../../shared/tasks';
import { RedoIcon, UndoIcon } from '../../frames/ui/icons';
import { renderFatigue } from '../draw/fatigue';
import { solveFatigue, type FatigueProblem } from '../model/fatigue';
import { FATIGUE_PRESETS, type FatiguePresetKey } from '../presets';
import { fatigueDoc } from '../text/solution';
import type { CycleKey, CycleNum, FatNumKey, FatigueStore } from './store';

export function FatigueView({ chrome, store }: { chrome: Chrome; store: FatigueStore }) {
  const st = useSyncExternalStore(store.subscribe, store.get);
  const pr = st.problem;
  const r = useMemo(() => solveFatigue(pr), [pr]);
  const fig = useMemo(() => renderFatigue(pr, r), [pr, r]);
  const doc = useMemo(() => fatigueDoc(pr, r, { explain: st.explain }), [pr, r, st.explain]);
  const N = (k: FatNumKey, label: string, zero = false) => (
    <Num key={k} id={`fa-${k}`} label={label} value={pr[k]} zero={zero} onType={(v) => store.typeNum(k, v)} onEnd={() => store.endSession(`n:${k}`)} />
  );
  const C = (c: CycleKey, k: CycleNum, label: string) => (
    <Num
      key={k}
      id={`fa-${c}-${k}`}
      label={label}
      value={pr[c][k]}
      neg
      zero
      onType={(v) => store.typeCycle(c, k, v)}
      onEnd={() => store.endSession(`${c}:${k}`)}
    />
  );
  const cyclePanel = (c: CycleKey, s: string, title: string) => {
    const cy = pr[c];
    return (
      <>
        <label className="toggle">
          <input type="checkbox" id={`fa-${c}-on`} checked={cy.on} onChange={(e) => store.setCycle(c, { on: e.target.checked })} />
          {title}
        </label>
        {cy.on && (
          <div className="cgpar cg0">
            <label className="sfield">
              <span>задать</span>
              <select id={`fa-${c}-mode`} value={cy.mode} onChange={(e) => store.setCycle(c, { mode: e.target.value as FatigueProblem['sigma']['mode'] })}>
                <option value="minmax">max, min</option>
                <option value="ma">m, a</option>
              </select>
            </label>
            {cy.mode === 'minmax' ? [C(c, 'max', `${s}max, МПа`), C(c, 'min', `${s}min, МПа`)] : [C(c, 'm', `${s}m, МПа`), C(c, 'a', `${s}a, МПа`)]}
          </div>
        )}
      </>
    );
  };

  return (
    <>
      <div className="wrap">
        {chrome.tabs}
        <header className="top">
          <div>
            <h1>Усталостная прочность</h1>
            <p className="lede">
              Цикл переменных напряжений, предел выносливости детали с учётом концентрации, размеров, качества поверхности и упрочнения, коэффициенты запаса по
              нормальным и касательным напряжениям и при их совместном действии.
            </p>
          </div>
          <div className="topright">
            <label className="preset">
              Готовая задача
              <select id="fapreset" value={st.preset} onChange={(e) => store.loadPreset(e.target.value as FatiguePresetKey)}>
                <PresetOptions items={taskEntries(FATIGUE_PRESETS)} />
                <option value="custom" hidden>
                  {st.title}
                </option>
              </select>
            </label>
            {chrome.files}
          </div>
        </header>
        <Notice notice={st.notice} onClose={store.closeNotice} />
        <section className="sheet" aria-label="Цикл и диаграмма">
          <div className="bar">
            <span className="hint">
              Напряжения — в МПа; растяжение «+». Запас — во сколько раз можно пропорционально увеличить σ_a и σ_m до предельного цикла.
            </span>
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
              id="fasvg"
              className="sketch"
              viewBox={fig.viewBox}
              role="img"
              aria-label="Цикл напряжений и диаграмма предельных амплитуд"
              dangerouslySetInnerHTML={{ __html: fig.svg }}
            />
          </div>
        </section>
        <div className="cols">
          <section className="panel conv" aria-label="Данные">
            <h2>Материал</h2>
            <div className="cgpar cg0">
              {N('sigB', 'σв, МПа')}
              {N('sigT', 'σт, МПа (0 — нет)', true)}
              {N('sig1', 'σ₋₁, МПа')}
              {N('tau1', 'τ₋₁, МПа')}
              {N('tauB', 'τв, МПа (0 — ψτ = 0,5ψσ)', true)}
            </div>
            <p className="empty">
              σ₋₁, τ₋₁ — пределы выносливости гладкого образца при симметричном цикле. Оценки пособия: σ₋₁ ≈ (0,4…0,5)σв (п. 11.3) или (0,55…0,7)σв (п. 11.7)
              для черных металлов, (0,25…0,5)σв для цветных; τ₋₁ ≈ 0,6σ₋₁ для пластичных и 0,8σ₋₁ для хрупких.
            </p>
            <h2>Циклы напряжений</h2>
            {cyclePanel('sigma', 'σ', 'Нормальные напряжения (изгиб, растяжение)')}
            {cyclePanel('tau', 'τ', 'Касательные напряжения (кручение)')}
            <h2>Коэффициенты детали</h2>
            <label className="field">
              <span>Коэффициент снижения предела выносливости</span>
              <select id="fa-kmode" value={pr.kMode} onChange={(e) => store.setKMode(e.target.value as FatigueProblem['kMode'])}>
                <option value="mult">п. 11.5: K_D = Kσ/(K_F·K_d·β)</option>
                <option value="surf">п. 11.6: K_D = (Kσ/K_d + 1/K_F − 1)/K_v — с упрочнением</option>
              </select>
            </label>
            <div className="cgpar cg0">
              {pr.sigma.on && N('Ks', 'Kσ')}
              {pr.tau.on && N('Kt', 'Kτ')}
              {N('KF', 'K_F — поверхность')}
              {N('Kd', 'K_d — размеры')}
              {pr.kMode === 'mult' ? N('beta', 'β — среда') : N('Kv', 'K_v — упрочнение')}
              {N('nAllow', 'требуемый запас [n]')}
            </div>
            <p className="empty">
              Kσ, Kτ — эффективные коэффициенты концентрации напряжений (≥ 1); K_F, K_d, β ≤ 1 — по справочным данным; K_v = 1,1…2,0 при поверхностном
              упрочнении. Обычно [n] = 1,4…1,7.
            </p>
          </section>
          <section className="panel" aria-label="Решение">
            <div className="sol-head">
              <h2>Решение</h2>
              <label className="toggle">
                <input type="checkbox" checked={st.explain} onChange={(e) => store.setExplain(e.target.checked)} />
                Подробные пояснения
              </label>
            </div>
            <div id="fasolution">
              <DocView doc={doc} />
            </div>
          </section>
        </div>
      </div>
      <article className="print-report" aria-hidden="true">
        <header className="pr-head">
          <h1>{st.title}</h1>
          <p>Усталостная прочность · {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </header>
        <section className="pr-sec pr-figs">
          <figure>
            <svg viewBox={fig.viewBox} dangerouslySetInnerHTML={{ __html: fig.svg }} />
            <figcaption>Цикл напряжений и диаграмма предельных амплитуд</figcaption>
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
