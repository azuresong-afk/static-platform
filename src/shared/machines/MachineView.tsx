/** Экран режима «машины»: тип задачи, числа, схема и решение; переключатель режима для вкладки-хозяина. */
import { useMemo, useSyncExternalStore } from 'react';
import type { Chrome } from '../../app/module';
import { RedoIcon, UndoIcon } from '../../modules/frames/ui/icons';
import { DocView } from '../ui/DocView';
import { Notice } from '../ui/Notice';
import { Num } from '../ui/Num';
import { PresetOptions } from '../ui/PresetOptions';
import { taskEntries } from '../tasks';
import { machineDoc } from './solution';
import type { MachineStore } from './store';
import { defaults } from './types';

/** Переключатель «основной режим вкладки / каталог машин»; ставится в шапку вкладки. */
export function ModeSwitch({ ms, base }: { ms: MachineStore; base: string }) {
  const st = useSyncExternalStore(ms.subscribe, ms.get);
  return (
    <div className="seg mc-mode" role="group" aria-label="Режим вкладки">
      <button type="button" id="mc-mode-base" aria-pressed={!st.active} onClick={() => ms.setActive(false)}>
        {base}
      </button>
      <button type="button" id="mc-mode-machines" aria-pressed={st.active} onClick={() => ms.setActive(true)}>
        {ms.cat.modeName}
      </button>
    </div>
  );
}

export function MachinePage({
  chrome,
  ms,
  base,
  extra,
  loadBase,
}: {
  chrome: Chrome;
  ms: MachineStore;
  base: string;
  extra: { key: string; title: string }[];
  loadBase: (key: string) => void;
}) {
  const st = useSyncExternalStore(ms.subscribe, ms.get);
  const cat = ms.cat;
  const machine = cat.machines.find((m) => m.id === st.id)!;
  const solved = useMemo(() => machine.solve(st.vals), [machine, st.vals]);
  const preset = st.preset !== 'custom' ? cat.presets[st.preset] : undefined;
  const doc = useMemo(() => machineDoc(solved, preset, { explain: st.explain }), [solved, preset, st.explain]);
  const end = (k: string) => () => ms.endSession('v:' + k);
  const items = [...extra, ...taskEntries(cat.presets)];
  return (
    <>
      <div className="wrap">
        {chrome.tabs}
        <header className="top">
          <div>
            <h1>{cat.title}</h1>
            <p className="lede">{cat.lede}</p>
          </div>
          <div className="topright">
            <ModeSwitch ms={ms} base={base} />
            <label className="preset">
              Готовая задача
              <select
                id="mcpreset"
                value={st.preset}
                onChange={(e) => {
                  if (e.target.value in cat.presets) ms.loadPreset(e.target.value);
                  else {
                    ms.setActive(false);
                    loadBase(e.target.value);
                  }
                }}
              >
                <PresetOptions items={items} />
                <option value="custom" hidden>
                  {st.title}
                </option>
              </select>
            </label>
            {chrome.files}
          </div>
        </header>
        <Notice notice={st.notice} onClose={ms.closeNotice} />
        <section className="sheet" aria-label="Схема">
          <div className="bar">
            <label className="sfield mc-kind">
              <span>тип задачи</span>
              <select id="mckind" value={st.id} onChange={(e) => ms.selectMachine(e.target.value)}>
                {cat.machines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="hist">
              <button type="button" title="Отменить (Ctrl+Z)" disabled={!st.canUndo} onClick={ms.undo}>
                <UndoIcon />
                Отменить
              </button>
              <button type="button" title="Повторить (Ctrl+Shift+Z)" disabled={!st.canRedo} onClick={ms.redo}>
                <RedoIcon />
                Повторить
              </button>
            </div>
          </div>
          <div className="canvas">
            {solved.ok ? (
              <svg
                id="mcsvg"
                className="sketch"
                viewBox={solved.fig.viewBox}
                role="img"
                aria-label="Схема машины"
                dangerouslySetInnerHTML={{ __html: solved.fig.svg }}
              />
            ) : (
              <p className="empty">Схема появится, когда данные станут корректными.</p>
            )}
          </div>
        </section>
        <div className="cols">
          <section className="panel conv" aria-label="Данные">
            <h2>Данные</h2>
            <div className="cgpar cg0" id="mcparams">
              {machine.params.map((p) => (
                <Num
                  key={st.id + p.k}
                  id={`mc-${p.k}`}
                  label={p.label}
                  unit={p.unit}
                  value={st.vals[p.k] ?? defaults(machine)[p.k]}
                  zero={p.zero}
                  neg={p.neg}
                  onType={(x) => ms.type(p.k, x)}
                  onEnd={end(p.k)}
                />
              ))}
            </div>
            {preset?.note && <p className="empty">{preset.note}</p>}
          </section>
          <section className="panel" aria-label="Решение">
            <div className="sol-head">
              <h2>Решение</h2>
              <label className="toggle">
                <input type="checkbox" checked={st.explain} onChange={(e) => ms.setExplain(e.target.checked)} />
                Подробные пояснения
              </label>
            </div>
            <div id="mcsolution">
              <DocView doc={doc} />
            </div>
          </section>
        </div>
      </div>
      <article className="print-report" aria-hidden="true">
        <header className="pr-head">
          <h1>{st.title}</h1>
          <p>
            {cat.title} · {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </header>
        {solved.ok && (
          <section className="pr-sec pr-figs">
            <figure>
              <svg viewBox={solved.fig.viewBox} dangerouslySetInnerHTML={{ __html: solved.fig.svg }} />
              <figcaption>{machine.name}</figcaption>
            </figure>
          </section>
        )}
        <section className="pr-sec">
          <h2>Решение</h2>
          <DocView doc={doc} />
        </section>
      </article>
    </>
  );
}
