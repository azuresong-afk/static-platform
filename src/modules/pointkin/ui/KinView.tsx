/** Экран «Кинематика точки»: способ задания движения, формулы, момент t; траектория с векторами, решение по шагам. */
import { useMemo, useSyncExternalStore } from 'react';
import type { Chrome } from '../../../app/module';
import { DocView } from '../../../shared/ui/DocView';
import { LawField } from '../../../shared/ui/LawField';
import { Notice } from '../../../shared/ui/Notice';
import { Num } from '../../../shared/ui/Num';
import { RedoIcon, UndoIcon } from '../../frames/ui/icons';
import { renderKin } from '../draw/kin';
import { solveKin, type KinMode } from '../model/kin';
import { KIN_PRESETS, type KinPresetKey } from '../presets';
import { kinDoc } from '../text/solution';
import type { KinNumKey, KinStore, KinStrKey } from './store';

const MODES: [KinMode, string][] = [
  ['coord', 'координатный: x(t), y(t), z(t)'],
  ['natural', 'естественный: s(t) и радиус кривизны'],
  ['polar', 'полярные координаты: r(t), φ(t)'],
];

export function KinView({ chrome, store }: { chrome: Chrome; store: KinStore }) {
  const st = useSyncExternalStore(store.subscribe, store.get);
  const pr = st.problem;
  const r = useMemo(() => solveKin(pr), [pr]);
  const fig = useMemo(() => renderKin(pr, r), [pr, r]);
  const doc = useMemo(() => kinDoc(pr, r, { explain: st.explain }), [pr, r, st.explain]);
  const L = (k: KinStrKey, label: string) => <LawField key={k} id={`k-${k}`} label={label} value={pr[k]} onType={(s) => store.typeStr(k, s)} onEnd={() => store.endSession(`s:${k}`)} />;
  const N = (k: KinNumKey, label: string, neg = true) => <Num key={k} id={`k-${k}`} label={label} value={pr[k]} neg={neg} zero onType={(v) => store.typeNum(k, v)} onEnd={() => store.endSession(`n:${k}`)} />;

  return (
    <>
      <div className="wrap">
        {chrome.tabs}
        <header className="top">
          <div>
            <h1>Кинематика точки</h1>
            <p className="lede">Скорость и ускорение точки при координатном, естественном и полярном способах задания движения: касательное и нормальное ускорения, радиус кривизны, траектория.</p>
          </div>
          <div className="topright">
            <label className="preset">
              Готовая задача
              <select id="kpreset" value={st.preset} onChange={(e) => store.loadPreset(e.target.value as KinPresetKey)}>
                {(Object.keys(KIN_PRESETS) as KinPresetKey[]).map((k) => (
                  <option key={k} value={k}>
                    {KIN_PRESETS[k].title}
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
        <section className="sheet" aria-label="Траектория">
          <div className="bar">
            <span className="hint">Формулы от t: sin, cos, tg, exp, ln, sqrt, sh, ch, π; десятичная запятая; «2t» — без знака умножения.</span>
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
            <svg id="ksvg" className="sketch" viewBox={fig.viewBox} role="img" aria-label="Траектория, скорость и ускорение" dangerouslySetInnerHTML={{ __html: fig.svg }} />
          </div>
        </section>
        <div className="cols">
          <section className="panel conv" aria-label="Данные">
            <h2>Закон движения</h2>
            <label className="field">
              <span>Способ задания</span>
              <select id="kmode" value={pr.mode} onChange={(e) => store.setMode(e.target.value as KinMode)}>
                {MODES.map(([m, t]) => (
                  <option key={m} value={m}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <div className="cgpar cg0">
              {pr.mode === 'coord' && [L('x', 'x(t)'), L('y', 'y(t)'), L('z', 'z(t) — пусто, если движение плоское')]}
              {pr.mode === 'natural' && [L('s', 's(t) — путь по траектории'), N('rho', 'радиус кривизны ρ (0 — прямая)', false)]}
              {pr.mode === 'polar' && [L('r', 'r(t)'), L('phi', 'φ(t), рад')]}
              {N('t', 'момент t')}
              {N('t1', 'траектория: от t₁')}
              {N('t2', 'до t₂')}
            </div>
            <p className="empty">Единицы длины — любые (как в условии), время — в секундах. Если t₁ ≥ t₂, траектория строится на отрезке [0; max(t, 1)].</p>
          </section>
          <section className="panel" aria-label="Решение">
            <div className="sol-head">
              <h2>Решение</h2>
              <label className="toggle">
                <input type="checkbox" checked={st.explain} onChange={(e) => store.setExplain(e.target.checked)} />
                Подробные пояснения
              </label>
            </div>
            <div id="ksolution">
              <DocView doc={doc} />
            </div>
          </section>
        </div>
      </div>
      <article className="print-report" aria-hidden="true">
        <header className="pr-head">
          <h1>{st.title}</h1>
          <p>Кинематика точки · {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </header>
        <section className="pr-sec pr-figs">
          <figure>
            <svg viewBox={fig.viewBox} dangerouslySetInnerHTML={{ __html: fig.svg }} />
            <figcaption>Траектория</figcaption>
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
