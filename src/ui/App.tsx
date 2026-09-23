/** Приложение: чертёж, конфигуратор, решение, мастер и история — как в прототипе. */
import { useEffect, useMemo, useRef } from 'react';
import { analyze } from '../core';
import { renderDrawing, type View } from '../draw/drawing';
import { PRESET_TITLES, type PresetKey } from '../model/presets';
import { Canvas } from './Canvas';
import { Configurator } from './Configurator';
import { FileBar, Notice, openFile, type FileBarHandle } from './FileBar';
import { PrintReport } from './PrintReport';
import { RedoIcon, UndoIcon } from './icons';
import { SolutionPanel } from './SolutionPanel';
import { useStore } from './useStore';
import { Wizard } from './Wizard';

export function App() {
  const [st, store] = useStore();
  const nt = useMemo(() => new Set(st.nt), [st.nt]);
  const a = useMemo(() => analyze(st.s, { notTarget: nt, explain: st.explain }), [st.s, nt, st.explain]);
  const drawing = useMemo(() => renderDrawing(st.s, a.model, a.solution, { view: st.view, sel: st.sel }), [st.s, a, st.view, st.sel]);

  const files = useRef<FileBarHandle>(null);

  // Ctrl+S — сохранить, Ctrl+O — открыть (работают и в полях ввода).
  // Ctrl+Z — отменить, Ctrl+Shift+Z и Ctrl+Y — повторить. В текстовом поле работает отмена браузера.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.code === 'KeyS' && !e.shiftKey) {
        e.preventDefault();
        files.current?.save();
        return;
      }
      if (e.code === 'KeyO' && !e.shiftKey) {
        e.preventDefault();
        files.current?.open();
        return;
      }
      const el = document.activeElement as HTMLInputElement | null;
      if (el && el.tagName === 'INPUT' && el.type === 'text') return;
      if (e.code === 'KeyZ' && !e.shiftKey) {
        e.preventDefault();
        store.undo();
      } else if ((e.code === 'KeyZ' && e.shiftKey) || e.code === 'KeyY') {
        e.preventDefault();
        store.redo();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [store]);

  // Файл проекта можно перетащить на страницу.
  useEffect(() => {
    const over = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
    };
    const drop = (e: DragEvent) => {
      const f = e.dataTransfer?.files?.[0];
      if (!f) return;
      e.preventDefault();
      void openFile(f, store.importProject);
    };
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragover', over);
      window.removeEventListener('drop', drop);
    };
  }, [store]);

  return (
    <>
      <div className="wrap">
        <header className="top">
          <div>
            <h1>Статика: балки и рамы</h1>
            <p className="lede">Соберите схему, задайте нагрузки и размеры. Уравнения равновесия составляются, решаются и проверяются автоматически.</p>
          </div>
          <div className="topright">
            <label className="preset">
              Готовая задача
              <select id="preset" value={st.preset} onChange={(e) => store.loadPreset(e.target.value as PresetKey)}>
                {(Object.keys(PRESET_TITLES) as PresetKey[]).map((k) => (
                  <option key={k} value={k}>
                    {PRESET_TITLES[k]}
                  </option>
                ))}
                <option value="custom" hidden>
                  Своя схема
                </option>
              </select>
            </label>
            <FileBar ref={files} />
          </div>
        </header>
        <Notice />

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
