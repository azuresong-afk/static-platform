/**
 * Экран «Возможные перемещения»: схема из «Балок и рам», выбор неизвестной, чертёж её возможного перемещения,
 * решение принципом возможных перемещений для всех неизвестных со сравнением с уравнениями равновесия.
 */
import { useMemo, useState, useSyncExternalStore } from 'react';
import type { Chrome } from '../../../app/module';
import { DocView } from '../../../shared/ui/DocView';
import { Notice } from '../../../shared/ui/Notice';
import { analyze } from '../../frames/analyze';
import { renderDrawing } from '../../frames/draw/drawing';
import type { Store as FramesStore } from '../../frames/ui/store';
import { RedoIcon, UndoIcon } from '../../frames/ui/icons';
import { virtualWork, type VirtualResult } from '../model/virtual';
import { renderVirtual } from '../draw/virtual';
import { VIRTUAL_PRESETS, type VirtualPresetKey } from '../presets';
import { virtualDoc } from '../text/solution';

const WHY: Record<Exclude<VirtualResult, { ok: true }>['why'], string> = {
  empty: 'Схема пуста — соберите конструкцию во вкладке «Балки и рамы».',
  status:
    'Нужна статически определимая схема, где реакции находятся из уравнений равновесия: тогда, отбросив одну связь, получаем механизм с одной степенью свободы.',
  baddist: 'Распределённая нагрузка задана между точками не на одной прямой — исправьте её в «Балках и рамах».',
  friction: 'Связи с трением и односторонние связи дают условия равновесия в виде неравенств — здесь их нет; используйте «Балки и рамы».',
};

const noGrid = (svg: string) => svg.replace(/<defs>.*?<\/defs>/, '').replace(/<rect width="\d+" height="\d+" fill="url\(#cm\)"\/>/, '');

export function VirtualView({ chrome, frames }: { chrome: Chrome; frames: FramesStore }) {
  const st = useSyncExternalStore(frames.subscribe, frames.get);
  const nt = useMemo(() => new Set(st.nt), [st.nt]);
  const a = useMemo(() => analyze(st.s, { notTarget: nt }), [st.s, nt]);
  const r = useMemo(() => virtualWork(st.s, a), [st.s, a]);
  const schema = useMemo(() => renderDrawing(st.s, a.model, a.solution, { view: 'schema', sel: null }), [st.s, a]);
  const [pick, setPick] = useState<string>('');
  // По умолчанию — первая неизвестная, для которой нагрузки совершают работу (самое наглядное перемещение).
  const cur = r.ok
    ? (r.releases.find((x) => x.unknown.key === pick) ?? r.releases.find((x) => x.terms.some((t) => Math.abs(t.work) > 1e-9)) ?? r.releases[0])
    : undefined;
  const fig = useMemo(() => (cur ? renderVirtual(st.s, a.model, cur) : null), [st.s, a, cur]);
  const doc = useMemo(() => (r.ok ? virtualDoc(a.model, r.releases, { explain: st.explain }) : null), [r, a, st.explain]);
  const presetKey = (Object.keys(VIRTUAL_PRESETS) as VirtualPresetKey[]).find((k) => VIRTUAL_PRESETS[k].title === st.title) ?? 'custom';
  const load = (k: VirtualPresetKey) => {
    const p = VIRTUAL_PRESETS[k];
    frames.loadStructure(p.build(frames.ids), p.title);
  };
  const name = (u: { L: string; S: string }) => u.L + (u.S ? '_' + u.S : '');

  return (
    <>
      <div className="wrap">
        {chrome.tabs}
        <header className="top">
          <div>
            <h1>Возможные перемещения</h1>
            <p className="lede">
              Реакции опор и неизвестные нагрузки принципом возможных перемещений (Мещерский, §46): отбрасываем одну связь, находим перемещения частей и
              приравниваем нулю сумму работ. Второй, независимый способ проверить «Балки и рамы».
            </p>
          </div>
          <div className="topright">
            <label className="preset">
              Готовая задача
              <select id="vwpreset" value={presetKey} onChange={(e) => load(e.target.value as VirtualPresetKey)}>
                {(Object.keys(VIRTUAL_PRESETS) as VirtualPresetKey[]).map((k) => (
                  <option key={k} value={k}>
                    {VIRTUAL_PRESETS[k].title}
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
        <Notice notice={st.notice} onClose={frames.closeNotice} />

        <section className="sheet" aria-label="Возможное перемещение">
          <div className="bar">
            <span className="hint">«{st.title}». Изменить схему, опоры и нагрузки можно во вкладке «Балки и рамы».</span>
            <div className="hist">
              <button type="button" id="vwedit" onClick={() => chrome.goto('frames')}>
                Изменить схему
              </button>
              <button type="button" title="Отменить (Ctrl+Z)" disabled={!st.canUndo} onClick={frames.undo}>
                <UndoIcon />
                Отменить
              </button>
              <button type="button" title="Повторить (Ctrl+Shift+Z)" disabled={!st.canRedo} onClick={frames.redo}>
                <RedoIcon />
                Повторить
              </button>
            </div>
          </div>
          {r.ok && cur && fig ? (
            <div className="canvas vw-canvas">
              <svg id="vwschema" viewBox={schema.viewBox} role="img" aria-label="Расчётная схема" dangerouslySetInnerHTML={{ __html: schema.svg }} />
              <div className="vw-pick" role="group" aria-label="Неизвестная">
                <span>Возможное перемещение для</span>
                {r.releases.map((x) => (
                  <label key={x.unknown.key} className="opt">
                    <input type="radio" name="vw-pick" checked={x === cur} onChange={() => setPick(x.unknown.key)} />
                    <span>{name(x.unknown)}</span>
                  </label>
                ))}
              </div>
              <div className="vw-figwrap">
                <svg
                  id="vwfig"
                  className="vw-fig"
                  viewBox={fig.viewBox}
                  style={{ maxWidth: Math.round(+fig.viewBox.split(' ')[2] * 1.2) }}
                  role="img"
                  aria-label="Возможное перемещение"
                  dangerouslySetInnerHTML={{ __html: fig.svg }}
                />
              </div>
            </div>
          ) : (
            <div className="dg-empty" role="status">
              <p>{WHY[r.ok ? 'status' : r.why]}</p>
              <button type="button" onClick={() => chrome.goto('frames')}>
                Открыть «Балки и рамы»
              </button>
            </div>
          )}
        </section>

        <section className="panel" aria-label="Решение">
          <div className="sol-head">
            <h2>Решение</h2>
            <label className="toggle">
              <input type="checkbox" checked={st.explain} onChange={(e) => frames.setExplain(e.target.checked)} />
              Подробные пояснения
            </label>
          </div>
          <div id="vwsolution">{doc ? <DocView doc={doc} /> : <p className="empty">Решение появится, когда схема станет статически определимой.</p>}</div>
        </section>
      </div>
      {r.ok && doc && fig && (
        <article className="print-report" aria-hidden="true">
          <header className="pr-head">
            <h1>{st.title}</h1>
            <p>Принцип возможных перемещений · {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </header>
          <section className="pr-sec pr-figs">
            <figure>
              <svg viewBox={schema.viewBox} role="img" aria-label="Расчётная схема" dangerouslySetInnerHTML={{ __html: noGrid(schema.svg) }} />
              <svg viewBox={fig.viewBox} role="img" aria-label="Возможное перемещение" dangerouslySetInnerHTML={{ __html: fig.svg }} />
              <figcaption>Расчётная схема и возможное перемещение для {cur ? name(cur.unknown) : ''}</figcaption>
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
