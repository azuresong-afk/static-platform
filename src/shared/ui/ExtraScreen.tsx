/** Общий экран «задач-расширений» раздела (пункт 24): вопрос, поля данных, чертёж-график и решение по шагам. */
import { useMemo, useSyncExternalStore, type ReactNode } from 'react';
import type { Chrome } from '../../app/module';
import { RedoIcon, UndoIcon } from '../../modules/frames/ui/icons';
import { findAsk, plotSvg, solveExtra, type AskDef, type ExtraProblem } from '../extra';
import { taskEntries } from '../tasks';
import { DocView } from './DocView';
import { LawField } from './LawField';
import { Notice, type NoticeData } from './Notice';
import { Num } from './Num';
import { PresetOptions } from './PresetOptions';

export interface ExtraHostState {
  extra: ExtraProblem;
  title: string;
  preset: string;
  canUndo: boolean;
  canRedo: boolean;
  notice: NoticeData | null;
  explain: boolean;
}
/** Что экран ждёт от состояния раздела. */
export interface ExtraHost {
  get(): ExtraHostState;
  subscribe(fn: () => void): () => void;
  setXAsk(id: string): void;
  typeNum(k: string, v: number): void;
  typeText(k: string, s: string): void;
  pick(k: string, v: string): void;
  endSession(k: string): void;
  undo(): void;
  redo(): void;
  loadPreset(key: string): void;
  setView(v: 'main' | 'extra'): void;
  closeNotice(): void;
  setExplain(on: boolean): void;
}

export function ExtraScreen({
  chrome,
  host,
  asks,
  presets,
  prefix,
  heading,
  lede,
  mainLabel,
  tabName,
}: {
  chrome: Chrome;
  host: ExtraHost;
  asks: AskDef[];
  presets: Record<string, { title: string }>;
  prefix: string;
  heading: string;
  lede: string;
  mainLabel: string;
  tabName: string;
}) {
  const st = useSyncExternalStore(host.subscribe, host.get);
  const p = st.extra;
  const ask = findAsk(asks, p.ask);
  const out = useMemo(() => solveExtra(asks, p, st.explain), [asks, p, st.explain]);
  const fig = useMemo(() => plotSvg(out.plot, out.ok), [out]);
  const end = (k: string) => () => host.endSession(`x:${k}`);
  const fields: ReactNode[] = [];
  for (const f of ask.fields) {
    if (f.show && !f.show(p)) continue;
    fields.push(
      f.text && f.vars ? (
        <LawField key={f.k} id={`${prefix}x-${f.k}`} label={f.label} value={p.s[f.k] ?? ''} vars={f.vars} onType={(s) => host.typeText(f.k, s)} onEnd={end(f.k)} />
      ) : f.text ? (
        <label className="sfield" key={f.k} style={{ gridColumn: '1 / -1' }}>
          <span>{f.label}</span>
          <span className="inp">
            <input id={`${prefix}x-${f.k}`} type="text" spellCheck={false} value={p.s[f.k] ?? ''} onChange={(e) => host.typeText(f.k, e.target.value)} onBlur={end(f.k)} />
          </span>
        </label>
      ) : (
        <Num key={f.k} id={`${prefix}x-${f.k}`} label={f.label} value={p.n[f.k]} neg={f.neg} zero={f.zero ?? true} onType={(v) => host.typeNum(f.k, v)} onEnd={end(f.k)} />
      ),
    );
  }
  return (
    <>
      <div className="wrap">
        {chrome.tabs}
        <header className="top">
          <div>
            <h1>{heading}</h1>
            <p className="lede">{lede}</p>
          </div>
          <div className="topright">
            <label className="preset">
              Готовая задача
              <select id={`${prefix}preset`} value={st.preset} onChange={(e) => host.loadPreset(e.target.value)}>
                <PresetOptions items={taskEntries(presets)} />
                <option value="custom" hidden>
                  {st.title}
                </option>
              </select>
            </label>
            {chrome.files}
          </div>
        </header>
        <Notice notice={st.notice} onClose={host.closeNotice} />
        <section className="sheet" aria-label="График">
          <div className="bar">
            <span className="hint">{ask.hint}</span>
            <div className="hist">
              <button type="button" title="Отменить (Ctrl+Z)" disabled={!st.canUndo} onClick={host.undo}>
                <UndoIcon />
                Отменить
              </button>
              <button type="button" title="Повторить (Ctrl+Shift+Z)" disabled={!st.canRedo} onClick={host.redo}>
                <RedoIcon />
                Повторить
              </button>
            </div>
          </div>
          <div className="canvas">
            <svg id={`${prefix}xsvg`} className="sketch" viewBox={fig.viewBox} role="img" aria-label="График" dangerouslySetInnerHTML={{ __html: fig.svg }} />
          </div>
        </section>
        <div className="cols">
          <section className="panel conv" aria-label="Данные">
            <div className="segbtns">
              <button type="button" id={`${prefix}to-main`} onClick={() => host.setView('main')}>
                ← {mainLabel}
              </button>
            </div>
            <h2>Задача</h2>
            <label className="field">
              <span>Вопрос</span>
              <select id={`${prefix}xask`} value={ask.id} onChange={(e) => host.setXAsk(e.target.value)}>
                {asks.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title}
                  </option>
                ))}
              </select>
            </label>
            {(ask.selects ?? []).map(
              (s) =>
                (!s.show || s.show(p)) && (
                  <label className="field" key={s.k}>
                    <span>{s.label}</span>
                    <select id={`${prefix}xs-${s.k}`} value={p.s[s.k]} onChange={(e) => host.pick(s.k, e.target.value)}>
                      {s.options.map(([k, t]) => (
                        <option key={k} value={k}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </label>
                ),
            )}
            <div className="cgpar cg0">{fields}</div>
          </section>
          <section className="panel" aria-label="Решение">
            <div className="sol-head">
              <h2>Решение</h2>
              <label className="toggle">
                <input type="checkbox" checked={st.explain} onChange={(e) => host.setExplain(e.target.checked)} />
                Подробные пояснения
              </label>
            </div>
            <div id={`${prefix}xsolution`}>
              <DocView doc={{ steps: out.steps }} />
            </div>
          </section>
        </div>
      </div>
      <article className="print-report" aria-hidden="true">
        <header className="pr-head">
          <h1>{st.title}</h1>
          <p>
            {tabName} · {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </header>
        <section className="pr-sec pr-figs">
          <figure>
            <svg viewBox={fig.viewBox} dangerouslySetInnerHTML={{ __html: fig.svg }} />
            <figcaption>График</figcaption>
          </figure>
        </section>
        <section className="pr-sec">
          <h2>Решение</h2>
          <DocView doc={{ steps: out.steps }} />
        </section>
      </article>
    </>
  );
}
