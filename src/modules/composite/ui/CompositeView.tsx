/** Экран «Составное сечение»: части сечения, чертёж с осями и эпюрой σ, решение по шагам. */
import { useMemo, useSyncExternalStore } from 'react';
import type { Chrome } from '../../../app/module';
import { DocView } from '../../../shared/ui/DocView';
import { Notice } from '../../../shared/ui/Notice';
import { Num } from '../../../shared/ui/Num';
import { RedoIcon, UndoIcon } from '../../frames/ui/icons';
import { PROFILE_NOS, type PartKind } from '../model/profiles';
import { solveSection, type Part } from '../model/section';
import { renderSection } from '../draw/section';
import { COMPOSITE_PRESETS, type CompositePresetKey } from '../presets';
import { compositeDoc } from '../text/solution';
import type { CompositeStore } from './store';

const KINDS: [PartKind, string][] = [
  ['plate', 'лист'],
  ['ibeam', 'двутавр'],
  ['channel', 'швеллер'],
  ['angle', 'уголок'],
];

export function CompositeView({ chrome, store }: { chrome: Chrome; store: CompositeStore }) {
  const st = useSyncExternalStore(store.subscribe, store.get);
  const r = useMemo(() => solveSection(st.parts), [st.parts]);
  const fig = useMemo(() => (r ? renderSection(r, st.M) : null), [r, st.M]);
  const doc = useMemo(() => (r ? compositeDoc(r, { explain: st.explain, M: st.M }) : null), [r, st.explain, st.M]);

  const partRow = (p: Part, i: number) => (
    <div className="cprow" key={i}>
      <span className="segname">{i + 1}</span>
      <select aria-label="Вид" value={p.kind} onChange={(e) => store.setPart(i, { kind: e.target.value as PartKind })}>
        {KINDS.map(([k, t]) => (
          <option key={k} value={k}>
            {t}
          </option>
        ))}
      </select>
      {p.kind === 'plate' ? (
        <span className="cpsize">
          <Num id={`c-w${i}`} label="" unit="мм" value={p.w} onType={(v) => store.typePart(i, 'w', v)} onEnd={() => store.endSession(`part:${i}:w`)} />
          <Num id={`c-h${i}`} label="" unit="мм" value={p.h} onType={(v) => store.typePart(i, 'h', v)} onEnd={() => store.endSession(`part:${i}:h`)} />
        </span>
      ) : (
        <select aria-label="Номер" value={p.no} onChange={(e) => store.setPart(i, { no: e.target.value })}>
          {PROFILE_NOS[p.kind].map((n) => (
            <option key={n} value={n}>
              {p.kind === 'angle' ? n.replace(/x/g, '×') : '№' + n}
            </option>
          ))}
        </select>
      )}
      <select aria-label="Разворот" value={p.rot} onChange={(e) => store.setPart(i, { rot: +e.target.value as Part['rot'] })}>
        {[0, 90, 180, 270].map((a) => (
          <option key={a} value={a}>
            {a}°
          </option>
        ))}
      </select>
      <label className="cpmir" title="Отразить зеркально (до разворота)">
        <input type="checkbox" checked={p.mirror} onChange={(e) => store.setPart(i, { mirror: e.target.checked })} />⇋
      </label>
      <Num id={`c-x${i}`} label="" unit="x" value={p.x} neg onType={(v) => store.typePart(i, 'x', v)} onEnd={() => store.endSession(`part:${i}:x`)} />
      <Num id={`c-y${i}`} label="" unit="y" value={p.y} neg onType={(v) => store.typePart(i, 'y', v)} onEnd={() => store.endSession(`part:${i}:y`)} />
      <button type="button" className="del" aria-label="Убрать часть" disabled={st.parts.length <= 1} onClick={() => store.removePart(i)}>
        ×
      </button>
    </div>
  );

  return (
    <>
      <div className="wrap">
        {chrome.tabs}
        <header className="top">
          <div>
            <h1>Составное сечение</h1>
            <p className="lede">Сечение из листов и прокатных профилей: центр тяжести, главные центральные оси и моменты инерции, моменты сопротивления, нейтральный слой и эпюра нормальных напряжений.</p>
          </div>
          <div className="topright">
            <label className="preset">
              Готовая задача
              <select id="cpreset" value={st.preset} onChange={(e) => store.loadPreset(e.target.value as CompositePresetKey)}>
                {(Object.keys(COMPOSITE_PRESETS) as CompositePresetKey[]).map((k) => (
                  <option key={k} value={k}>
                    {COMPOSITE_PRESETS[k].title}
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

        <section className="sheet" aria-label="Сечение">
          <div className="bar">
            <span className="hint">Профили — ГОСТ 8239, 8240, 8509, 8510; на чертеже без скруглений. Положение части — левый нижний угол её габарита, мм.</span>
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
          {fig && (
            <div className="canvas">
              <svg id="csec" className="sketch" viewBox={fig.viewBox} role="img" aria-label="Сечение" dangerouslySetInnerHTML={{ __html: fig.svg }} />
            </div>
          )}
        </section>

        <div className="cols">
          <section className="panel conv" aria-label="Части сечения">
            <h2>Части сечения</h2>
            <div className="asteps">
              <div className="cprow cphead">
                <span />
                <span>вид</span>
                <span>номер / размеры</span>
                <span>разворот</span>
                <span>⇋</span>
                <span>x, мм</span>
                <span>y, мм</span>
                <span />
              </div>
              {st.parts.map(partRow)}
            </div>
            <div className="segbtns">
              <button type="button" id="cadd" onClick={store.addPart}>
                + часть
              </button>
            </div>
            <div className="sub">Изгибающий момент (необязательно)</div>
            <div className="sgrid">
              <Num id="c-M" label="M, кН·м (0 — напряжения через M)" value={st.M} zero onType={store.typeM} onEnd={() => store.endSession('M')} />
            </div>
            <p className="empty">Базовое положение: двутавр и швеллер «[» стоят стенкой вертикально, уголок «L» — полками влево и вниз; разворот — против часовой стрелки.</p>
          </section>
          <section className="panel" aria-label="Решение">
            <div className="sol-head">
              <h2>Решение</h2>
              <label className="toggle">
                <input type="checkbox" checked={st.explain} onChange={(e) => store.setExplain(e.target.checked)} />
                Подробные пояснения
              </label>
            </div>
            <div id="csolution">{doc ? <DocView doc={doc} /> : <p className="empty">Добавьте хотя бы одну часть.</p>}</div>
          </section>
        </div>
      </div>
      {doc && fig && (
        <article className="print-report" aria-hidden="true">
          <header className="pr-head">
            <h1>{st.title}</h1>
            <p>Составное сечение · {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </header>
          <section className="pr-sec pr-figs">
            <figure>
              <svg viewBox={fig.viewBox} dangerouslySetInnerHTML={{ __html: fig.svg }} />
              <figcaption>Сечение, центральные оси и эпюра нормальных напряжений</figcaption>
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
