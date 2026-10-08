/**
 * Экран «Уравнения Лагранжа»: координаты, параметры, T, Π, непотенциальные силы; уравнения движения по шагам,
 * графики q(t) и интеграла энергии, малые колебания.
 */
import { useMemo, useState, useSyncExternalStore } from 'react';
import type { Chrome } from '../../../app/module';
import { DocView } from '../../../shared/ui/DocView';
import { Notice } from '../../../shared/ui/Notice';
import { Num } from '../../../shared/ui/Num';
import { parseSym, varName, prettyName, normName, type SymContext } from '../../../shared/sym';
import { RedoIcon, UndoIcon } from '../../frames/ui/icons';
import { solveLagrange } from '../model/lagrange';
import { renderPlots } from '../draw/plots';
import { LAGRANGE_PRESETS, type LagrangePresetKey } from '../presets';
import { lagrangeDoc } from '../text/solution';
import type { LagrangeStore } from './store';
import { PresetOptions } from '../../../shared/ui/PresetOptions';
import { taskEntries } from '../../../shared/tasks';

/** Поле формулы: ошибка разбора подсвечивается, неверная формула не применяется. */
function SymField({ id, label, value, ctx, onType, onEnd, err, wide = true }: { id: string; label: string; value: string; ctx: SymContext; onType: (s: string) => void; onEnd: () => void; err?: string; wide?: boolean }) {
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? value;
  const r = parseSym(shown, ctx);
  const msg = !r.ok ? r.error : err;
  return (
    <label className={wide ? 'sfield lg-formula' : 'sfield'}>
      <span>{label}</span>
      <span className="inp">
        <input
          id={id}
          type="text"
          spellCheck={false}
          className={msg ? 'bad' : undefined}
          title={msg}
          value={shown}
          placeholder={wide ? 'пусто — 0' : '0'}
          onChange={(e) => {
            setText(e.target.value);
            if (parseSym(e.target.value, ctx).ok) onType(e.target.value);
          }}
          onBlur={() => {
            setText(null);
            onEnd();
          }}
        />
      </span>
      {msg && <small className="lg-err">{msg}</small>}
    </label>
  );
}

export function LagrangeView({ chrome, store }: { chrome: Chrome; store: LagrangeStore }) {
  const st = useSyncExternalStore(store.subscribe, store.get);
  const pr = st.problem;
  const r = useMemo(() => solveLagrange(pr), [pr]);
  const ok = r.ok ? r : null;
  const doc = useMemo(() => (ok ? lagrangeDoc(pr, ok, { explain: st.explain }) : null), [pr, ok, st.explain]);
  const plots = useMemo(() => (ok ? renderPlots(ok) : null), [ok]);
  const ctx: SymContext = { coords: pr.coords.map((c) => normName(c.name.trim())), params: pr.params.map((p) => normName(p.name.trim())) };
  const err = (field: string) => (!r.ok && r.field === field ? r.error : undefined);
  const note = st.preset !== 'custom' ? LAGRANGE_PRESETS[st.preset].note : null;
  const dotted = (n: string, o: number) => varName(prettyName(normName(n.trim()) || 'q'), o);

  return (
    <>
      <div className="wrap">
        {chrome.tabs}
        <header className="top">
          <div>
            <h1>Уравнения Лагранжа второго рода</h1>
            <p className="lede">По кинетической и потенциальной энергии системы — уравнения движения в обобщённых координатах: производные по шагам, ускорения, интегрирование движения, частоты малых колебаний (Мещерский, §48).</p>
          </div>
          <div className="topright">
            <label className="preset">
              Готовая задача
              <select id="lgpreset" value={st.preset} onChange={(e) => store.loadPreset(e.target.value as LagrangePresetKey)}>
                <PresetOptions items={taskEntries(LAGRANGE_PRESETS)} />
                <option value="custom" hidden>
                  {st.title}
                </option>
              </select>
            </label>
            {chrome.files}
          </div>
        </header>
        <Notice notice={st.notice} onClose={store.closeNotice} />

        <section className="sheet" aria-label="Движение">
          <div className="bar">
            <span className="hint">{note ?? 'Формулы: скорость — штрихом (x′, φ′), греческие буквы можно писать латиницей (phi, theta), умножение — пробелом или «*».'}</span>
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
          {plots ? (
            <div className="canvas lg-canvas">
              <svg id="lgplot" viewBox={plots.viewBox} role="img" aria-label="Графики" dangerouslySetInnerHTML={{ __html: plots.svg }} />
            </div>
          ) : (
            <div className="dg-empty" role="status">
              <p>{!r.ok ? r.error : 'Задайте время интегрирования, чтобы увидеть графики движения.'}</p>
            </div>
          )}
        </section>

        <div className="cols">
          <section className="panel conv" aria-label="Система">
            <h2>Система</h2>
            <div className="sub">Обобщённые координаты</div>
            <div className="lg-table lg-coords">
              <div className="ahead">
                <span>q</span>
                <span>
                  Q<sup>н</sup> (непотенц.)
                </span>
                <span>
                  q<sub>0</sub>
                </span>
                <span>
                  q̇<sub>0</sub>
                </span>
                <span>q* (равнов.)</span>
                <span />
              </div>
              {pr.coords.map((c, i) => (
                <div className="arow" key={i}>
                  <input id={`lg-cn${i}`} className={err('names') || err('coords') ? 'bad lg-name' : 'lg-name'} value={c.name} spellCheck={false} aria-label={`Координата ${i + 1}`} onChange={(e) => store.typeCoord(i, 'name', e.target.value)} onBlur={() => store.endSession(`coord:${i}:name`)} />
                  <SymField id={`lg-q${i}`} label="" wide={false} value={c.Q} ctx={ctx} err={err('Q' + i)} onType={(v) => store.typeCoord(i, 'Q', v)} onEnd={() => store.endSession(`coord:${i}:Q`)} />
                  <Num id={`lg-q0${i}`} label="" value={c.q0} neg zero onType={(v) => store.typeCoord(i, 'q0', v)} onEnd={() => store.endSession(`coord:${i}:q0`)} />
                  <Num id={`lg-v0${i}`} label="" value={c.v0} neg zero onType={(v) => store.typeCoord(i, 'v0', v)} onEnd={() => store.endSession(`coord:${i}:v0`)} />
                  <Num id={`lg-eq${i}`} label="" value={c.eq} neg zero onType={(v) => store.typeCoord(i, 'eq', v)} onEnd={() => store.endSession(`coord:${i}:eq`)} />
                  <button type="button" className="del" aria-label={`Убрать координату ${c.name}`} disabled={pr.coords.length <= 1} onClick={() => store.removeCoord(i)}>
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="segbtns">
              <button type="button" id="lgaddq" disabled={pr.coords.length >= 3} onClick={store.addCoord}>
                + координата
              </button>
            </div>
            <div className="sub">Энергия</div>
            <div className="sgrid">
              <SymField id="lg-T" label={`T(q, ${pr.coords.map((c) => dotted(c.name, 1)).join(', ')})`} value={pr.T} ctx={ctx} err={err('T')} onType={(v) => store.typeText('T', v)} onEnd={() => store.endSession('T')} />
              <SymField id="lg-P" label="Π(q)" value={pr.P} ctx={ctx} err={err('P')} onType={(v) => store.typeText('P', v)} onEnd={() => store.endSession('P')} />
            </div>
            <div className="sub">Параметры</div>
            <div className="lg-table lg-params">
              {pr.params.map((p, i) => (
                <div className="arow" key={i}>
                  <input id={`lg-pn${i}`} className={err('names') ? 'bad lg-name' : 'lg-name'} value={p.name} spellCheck={false} aria-label={`Параметр ${i + 1}`} onChange={(e) => store.typeParam(i, 'name', e.target.value)} onBlur={() => store.endSession(`param:${i}:name`)} />
                  <span className="lg-eqs">=</span>
                  <Num id={`lg-pv${i}`} label="" value={p.value} neg zero onType={(v) => store.typeParam(i, 'value', v)} onEnd={() => store.endSession(`param:${i}:value`)} />
                  <button type="button" className="del" aria-label={`Убрать параметр ${p.name}`} onClick={() => store.removeParam(i)}>
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="segbtns">
              <button type="button" id="lgaddp" onClick={store.addParam}>
                + параметр
              </button>
            </div>
            <div className="sgrid">
              <Num id="lg-tend" label="Время интегрирования" unit="с" value={pr.tEnd} zero onType={store.typeTime} onEnd={() => store.endSession('tEnd')} />
            </div>
            {err('names') && <p className="lg-err">{err('names')}</p>}
            {err('coords') && <p className="lg-err">{err('coords')}</p>}
            <p className="empty">Параметры остаются в формулах буквами; числа нужны для ускорений, графиков и частот. Единицы — СИ.</p>
          </section>
          <section className="panel" aria-label="Решение">
            <div className="sol-head">
              <h2>Решение</h2>
              <label className="toggle">
                <input type="checkbox" checked={st.explain} onChange={(e) => store.setExplain(e.target.checked)} />
                Подробные пояснения
              </label>
            </div>
            <div id="lgsolution">{doc ? <DocView doc={doc} /> : <p className="empty">{!r.ok ? r.error : ''}</p>}</div>
          </section>
        </div>
      </div>
      {doc && (
        <article className="print-report" aria-hidden="true">
          <header className="pr-head">
            <h1>{st.title}</h1>
            <p>Уравнения Лагранжа второго рода · {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </header>
          {plots && (
            <section className="pr-sec pr-figs">
              <figure>
                <svg viewBox={plots.viewBox} role="img" aria-label="Графики" dangerouslySetInnerHTML={{ __html: plots.svg }} />
                <figcaption>Движение системы</figcaption>
              </figure>
            </section>
          )}
          <section className="pr-sec">
            <h2>Решение</h2>
            <DocView doc={doc} />
          </section>
        </article>
      )}
    </>
  );
}
