/** Экран «Кручение»: вал (участки, моменты или мощности, заделки, материал), чертёж с эпюрами M_z, τ, φ, решение. */
import { useMemo, useSyncExternalStore } from 'react';
import type { Chrome } from '../../../app/module';
import { roman } from '../../frames/model/geometry';
import { DocView } from '../../../shared/ui/DocView';
import { Notice } from '../../../shared/ui/Notice';
import { Num } from '../../../shared/ui/Num';
import { RedoIcon, UndoIcon } from '../../frames/ui/icons';
import { solveShaft, type Shaft } from '../model/shaft';
import { renderShaft, renderShaftDiagrams } from '../draw/shaft';
import { TORSION_PRESETS, type TorsionPresetKey } from '../presets';
import { pointName, torsionDoc } from '../text/solution';
import type { TorsionNumKey, TorsionStore } from './store';

export function TorsionView({ chrome, store }: { chrome: Chrome; store: TorsionStore }) {
  const st = useSyncExternalStore(store.subscribe, store.get);
  const b = st.shaft;
  const sol = useMemo(() => solveShaft(b), [b]);
  const ok = sol.ok ? sol : null;
  const bar = useMemo(() => renderShaft(b, ok), [b, ok]);
  const dg = useMemo(() => (ok ? renderShaftDiagrams(b, ok) : null), [b, ok]);
  const doc = useMemo(() => (ok ? torsionDoc(b, ok, { explain: st.explain }) : null), [b, ok, st.explain]);
  const why = !sol.ok ? sol.text : null;
  const held = (j: number) => (j === 0 && (b.supports === 'left' || b.supports === 'both')) || (j === b.steps.length && (b.supports === 'right' || b.supports === 'both'));

  const radio = <K extends 'supports' | 'dMode' | 'load'>(key: K, value: Shaft[K], label: string) => (
    <label className="opt">
      <input type="radio" name={'t-' + key} checked={b[key] === value} onChange={() => store.setField(key, value)} />
      <span>{label}</span>
    </label>
  );
  const field = (key: TorsionNumKey, label: string, unit: string, zero = false) => (
    <Num key={key} id={'t-' + key} label={label} unit={unit} value={b[key]} zero={zero} onType={(v) => store.typeField(key, v)} onEnd={() => store.endSession(key)} />
  );
  const loads = b.load === 'power' ? b.powers : b.moments;

  return (
    <>
      <div className="wrap">
        {chrome.tabs}
        <header className="top">
          <div>
            <h1>Кручение вала</h1>
            <p className="lede">Ступенчатый вал (сплошной или полый), моменты или мощности на шкивах, заделки или без них: эпюры крутящих моментов, напряжений и углов закручивания, диаметр по прочности и жёсткости.</p>
          </div>
          <div className="topright">
            <label className="preset">
              Готовая задача
              <select id="torpreset" value={st.preset} onChange={(e) => store.loadPreset(e.target.value as TorsionPresetKey)}>
                {(Object.keys(TORSION_PRESETS) as TorsionPresetKey[]).map((k) => (
                  <option key={k} value={k}>
                    {TORSION_PRESETS[k].title}
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

        <section className="sheet" aria-label="Вал и эпюры">
          <div className="bar">
            <span className="hint">Моменты — в кН·м («+» — вектор вправо), длины — в м, диаметры — в мм, напряжения — в МПа, углы — в градусах.</span>
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
            <svg id="tshaft" viewBox={bar.viewBox} role="img" aria-label="Вал" dangerouslySetInnerHTML={{ __html: bar.svg }} />
            {dg && <svg id="tdg" className="dg" viewBox={dg.viewBox} role="img" aria-label="Эпюры" dangerouslySetInnerHTML={{ __html: dg.svg }} />}
          </div>
          {why && (
            <div className="dg-empty" role="status">
              <p>{why}</p>
            </div>
          )}
        </section>

        <div className="cols">
          <section className="panel conv" aria-label="Вал">
            <h2>Вал</h2>
            <div className="sub">Закрепление</div>
            {radio('supports', 'none', 'без заделок (подшипники, моменты уравновешены)')}
            {radio('supports', 'left', 'заделка слева')}
            {radio('supports', 'right', 'заделка справа')}
            {radio('supports', 'both', 'заделки с обеих сторон (статически неопределимый)')}
            <div className="sub">Участки слева направо</div>
            <div className="asteps">
              <div className="ahead">
                <span />
                <span>длина, м</span>
                <span>D, ×d</span>
                <span>d₀/D (0 — сплошной)</span>
                <span />
              </div>
              {b.steps.map((s, i) => (
                <div className="arow" key={i}>
                  <span className="segname">{roman(i)}</span>
                  <Num id={`t-l${i}`} label="" value={s.l} onType={(v) => store.typeStep(i, 'l', v)} onEnd={() => store.endSession(`step:${i}:l`)} />
                  <Num id={`t-k${i}`} label="" value={s.k} onType={(v) => store.typeStep(i, 'k', v)} onEnd={() => store.endSession(`step:${i}:k`)} />
                  <Num id={`t-c${i}`} label="" value={s.c} zero onType={(v) => store.typeStep(i, 'c', v)} onEnd={() => store.endSession(`step:${i}:c`)} />
                  <button type="button" className="del" aria-label={`Убрать участок ${roman(i)}`} disabled={b.steps.length <= 1} onClick={() => store.removeStep(i)}>
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="segbtns">
              <button type="button" id="tadd" onClick={store.addStep}>
                + участок справа
              </button>
            </div>
            <div className="sub">Нагрузка</div>
            {radio('load', 'moment', 'моменты в точках, кН·м («+» — вектор вправо)')}
            {radio('load', 'power', 'мощности на шкивах, кВт (ведущий «+», ведомые «−»)')}
            {b.load === 'power' && <div className="sgrid">{field('rpm', 'n', 'об/мин')}</div>}
            <div className="sgrid">
              {loads.map((f, j) =>
                held(j) ? (
                  <label className="sfield" key={j}>
                    <span>точка {pointName(j)}</span>
                    <span className="empty">в заделке</span>
                  </label>
                ) : (
                  <Num key={j} id={`t-m${j}`} label={`точка ${pointName(j)}`} unit={b.load === 'power' ? 'кВт' : 'кН·м'} value={f} neg zero onType={(v) => store.typeLoad(j, v)} onEnd={() => store.endSession(`${b.load === 'power' ? 'powers' : 'moments'}:${j}`)} />
                ),
              )}
            </div>
            <div className="sub">Диаметр d</div>
            {radio('dMode', 'find', 'подобрать по прочности и жёсткости')}
            {radio('dMode', 'given', 'задан')}
            <div className="sgrid">
              {b.dMode === 'given' && field('d', 'd', 'мм')}
              {field('tauAllow', '[τ]', 'МПа', true)}
              {field('thetaAllow', '[Θ] (0 — не проверять)', '°/м', true)}
              {field('G', 'G', 'МПа')}
            </div>
            <p className="empty">Для стали G = 8·10⁴ МПа, [τ] = (0,5…0,6)[σ]; [Θ] = (5…22)·10⁻³ рад/м = 0,29…1,26 °/м (Антонов, п. 7.3).</p>
          </section>
          <section className="panel" aria-label="Решение">
            <div className="sol-head">
              <h2>Решение</h2>
              <label className="toggle">
                <input type="checkbox" checked={st.explain} onChange={(e) => store.setExplain(e.target.checked)} />
                Подробные пояснения
              </label>
            </div>
            <div id="torsolution">{doc ? <DocView doc={doc} /> : <p className="empty">{why}</p>}</div>
          </section>
        </div>
      </div>
      {doc && dg && (
        <article className="print-report" aria-hidden="true">
          <header className="pr-head">
            <h1>{st.title}</h1>
            <p>Кручение вала · {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </header>
          <section className="pr-sec pr-figs pr-dg">
            <figure>
              <svg viewBox={bar.viewBox} dangerouslySetInnerHTML={{ __html: bar.svg }} />
              <svg viewBox={dg.viewBox} dangerouslySetInnerHTML={{ __html: dg.svg }} />
              <figcaption>Вал и эпюры M_z, τ, φ</figcaption>
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
