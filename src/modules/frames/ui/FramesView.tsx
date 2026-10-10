/** Экран раздела «Балки и рамы»: чертёж, конфигуратор, решение, мастер и история — как в прототипе. */
import { useMemo } from 'react';
import type { Chrome } from '../../../app/module';
import { Notice } from '../../../shared/ui/Notice';
import { analyze } from '../analyze';
import { renderDrawing, type View } from '../draw/drawing';
import { PresetOptions } from '../../../shared/ui/PresetOptions';
import { FRAMES_BOOK, FRAMES_TASKS, YAB_FRAMES } from '../tasks';
import { loadFramesTask } from './loadTask';
import { Canvas } from './Canvas';
import { Configurator } from './Configurator';
import { PrintReport } from './PrintReport';
import { RedoIcon, UndoIcon } from './icons';
import { SolutionPanel } from './SolutionPanel';
import { useStore } from './useStore';
import { Wizard } from './Wizard';

export function FramesView({ chrome }: { chrome: Chrome }) {
  const [st, store] = useStore();
  const nt = useMemo(() => new Set(st.nt), [st.nt]);
  const a = useMemo(() => analyze(st.s, { notTarget: nt, explain: st.explain }), [st.s, nt, st.explain]);
  const drawing = useMemo(() => renderDrawing(st.s, a.model, a.solution, { view: st.view, sel: st.sel }), [st.s, a, st.view, st.sel]);
  // Задача Мещерского загружается как своя схема с названием задачи — список показывает её по названию.
  const presetValue = st.preset !== 'custom' ? st.preset : ([...FRAMES_BOOK, ...YAB_FRAMES].find((t) => t.title === st.title)?.key ?? 'custom');

  return (
    <>
      <div className="wrap">
        {chrome.tabs}
        <header className="top">
          <div>
            <h1>Статика: балки и рамы</h1>
            <p className="lede">Соберите схему, задайте нагрузки и размеры. Уравнения равновесия составляются, решаются и проверяются автоматически.</p>
          </div>
          <div className="topright">
            <label className="preset">
              Готовая задача
              <select id="preset" value={presetValue} onChange={(e) => loadFramesTask(store, e.target.value)}>
                <PresetOptions items={FRAMES_TASKS} />
                <option value="custom" hidden>
                  Своя схема
                </option>
              </select>
            </label>
            {chrome.files}
          </div>
        </header>
        <Notice notice={st.notice} onClose={store.closeNotice} />

        <Wizard model={a.model} sol={a.solution} />

        <section className="sheet" aria-label="Чертёж">
          <div className="bar">
            <div className="seg" role="group" aria-label="Вид">
              {(
                [
                  ['construct', 'Конструкция'],
                  ['schema', 'Расчётная схема'],
                ] as [View, string][]
              ).map(([v, t]) => (
                <button key={v} type="button" data-view={v} aria-pressed={st.view === v ? 'true' : 'false'} onClick={() => store.setView(v)}>
                  {t}
                </button>
              ))}
            </div>
            <span className="hint">Щёлкните по размеру, чтобы изменить длину. Двойной щелчок по участку — новая точка.</span>
            <div className="hist">
              <button type="button" id="undo" title="Отменить (Ctrl+Z)" disabled={!st.canUndo} onClick={store.undo}>
                <UndoIcon />
                Отменить
              </button>
              <button type="button" id="redo" title="Повторить (Ctrl+Shift+Z)" disabled={!st.canRedo} onClick={store.redo}>
                <RedoIcon />
                Повторить
              </button>
            </div>
          </div>
          <Canvas drawing={drawing} g={a.model.g} />
        </section>

        <div className="cols">
          <Configurator model={a.model} />
          <SolutionPanel doc={a.doc} />
        </div>
      </div>
      <PrintReport s={st.s} a={a} notTarget={nt} title={st.title} />
    </>
  );
}
