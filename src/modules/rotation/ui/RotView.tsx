/** Экран «Вращение тела»: уравнение вращения (моменты, грузы, начальные условия) или сохранение кинетического момента. */
import { useMemo, useSyncExternalStore } from 'react';
import type { Chrome } from '../../../app/module';
import { DocView } from '../../../shared/ui/DocView';
import { Notice } from '../../../shared/ui/Notice';
import { Num } from '../../../shared/ui/Num';
import { RedoIcon, UndoIcon } from '../../frames/ui/icons';
import { renderEq, renderK } from '../draw/rotation';
import { solveEq, solveK, type InertiaKind } from '../model/rotation';
import { ROT_PRESETS, type RotPresetKey } from '../presets';
import { eqDoc, kDoc } from '../text/solution';
import type { EqNumKey, KNumKey, RotStore } from './store';
import { PresetOptions } from '../../../shared/ui/PresetOptions';
import { taskEntries } from '../../../shared/tasks';

const BODY: [InertiaKind, string][] = [
  ['J', 'момент инерции J задан'],
  ['disk', 'сплошной диск (цилиндр)'],
  ['ring', 'масса на ободе'],
  ['rho', 'по радиусу инерции ρ'],
];
const TERMS: [EqNumKey, string][] = [
  ['M0', 'момент M₀'],
  ['at', 'a в моменте a·t'],
  ['m0', 'm₀ в m₀ sin pt'],
  ['p', 'p в m₀ sin pt'],
  ['c', 'c в −cφ'],
  ['Pa', 'Pa в −Pa sin φ'],
  ['kv', 'k в −kω'],
  ['kq', 'k в −kω|ω|'],
  ['Mf', 'трение M_тр'],
];

export function RotView({ chrome, store }: { chrome: Chrome; store: RotStore }) {
  const st = useSyncExternalStore(store.subscribe, store.get);
  const pr = st.problem;
  const out = useMemo(() => {
    if (pr.mode === 'eq') {
      const r = solveEq(pr.eq, pr.byWeight);
      return { fig: renderEq(r), doc: eqDoc(pr.eq, pr.byWeight, r, { explain: st.explain }) };
    }
    const r = solveK(pr.K, pr.byWeight);
    return { fig: renderK(pr.K, r), doc: kDoc(pr.K, pr.byWeight, r, { explain: st.explain }) };
  }, [pr, st.explain]);
  const end = (k: string) => () => store.endSession(k);
  const e = pr.eq;

  return (
    <>
      <div className="wrap">
        {chrome.tabs}
        <header className="top">
          <div>
            <h1>Вращение тела</h1>
            <p className="lede">Дифференциальное уравнение вращения вокруг неподвижной оси с моментами, зависящими от времени, угла и скорости; грузы на барабанах; сохранение кинетического момента.</p>
          </div>
          <div className="topright">
            <label className="preset">
              Готовая задача
              <select id="rpreset" value={st.preset} onChange={(ev) => store.loadPreset(ev.target.value as RotPresetKey)}>
                <PresetOptions items={taskEntries(ROT_PRESETS)} />
                <option value="custom" hidden>
                  {st.title}
                </option>
              </select>
            </label>
            {chrome.files}
          </div>
        </header>
        <Notice notice={st.notice} onClose={store.closeNotice} />
        <section className="sheet" aria-label="Графики">
          <div className="bar">
            <span className="hint">{pr.mode === 'eq' ? 'Положительное направление вращения — направление отсчёта φ; моменты «+» — в эту сторону.' : 'Все тела после взаимодействия вращаются вместе с одной угловой скоростью.'}</span>
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
            <svg id="rsvg" className="sketch" viewBox={out.fig.viewBox} role="img" aria-label={pr.mode === 'eq' ? 'Графики ω(t) и φ(t)' : 'Тела до и после'} dangerouslySetInnerHTML={{ __html: out.fig.svg }} />
          </div>
        </section>
        <div className="cols">
          <section className="panel conv" aria-label="Данные">
            <h2>Задача</h2>
            <label className="field">
              <span>Раздел</span>
              <select id="rmode" value={pr.mode} onChange={(ev) => store.setMode(ev.target.value as 'eq' | 'K')}>
                <option value="eq">уравнение вращения</option>
                <option value="K">сохранение кинетического момента</option>
              </select>
            </label>
            <label className="toggle">
              <input type="checkbox" id="rweight" checked={pr.byWeight} onChange={(ev) => store.setByWeight(ev.target.checked)} />
              Заданы веса P (m = P/g, g = 9,81 м/с²)
            </label>
            {pr.mode === 'eq' ? (
              <>
                <h2>Тело</h2>
                <label className="field">
                  <span>Момент инерции</span>
                  <select id="rbody" value={e.body.kind} onChange={(ev) => store.setBodyKind(ev.target.value as InertiaKind)}>
                    {BODY.map(([k, t]) => (
                      <option key={k} value={k}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="cgpar cg0">
                  {e.body.kind === 'J' ? (
                    <Num id="r-J" label="J" value={e.body.J} zero onType={(v) => store.typeBody('J', v)} onEnd={end('body:J')} />
                  ) : (
                    <>
                      <Num id="r-bm" label={pr.byWeight ? 'вес P' : 'масса m'} value={e.body.m} zero onType={(v) => store.typeBody('m', v)} onEnd={end('body:m')} />
                      <Num id="r-bR" label={e.body.kind === 'rho' ? 'ρ, м' : 'R, м'} value={e.body.R} zero onType={(v) => store.typeBody('R', v)} onEnd={end('body:R')} />
                    </>
                  )}
                </div>
                <div className="asteps" id="rloads">
                  {e.loads.map((l, i) => (
                    <div key={i} className="cgpar cg0">
                      <Num id={`r-lm${i}`} label={`груз ${i + 1}: ${pr.byWeight ? 'вес' : 'масса'}`} value={l.m} zero onType={(v) => store.typeLoad(i, 'm', v)} onEnd={end(`load:${i}:m`)} />
                      <Num id={`r-lr${i}`} label="радиус барабана" value={l.r} onType={(v) => store.typeLoad(i, 'r', v)} onEnd={end(`load:${i}:r`)} />
                      <label className="sfield">
                        <span>груз идёт</span>
                        <select value={l.down ? 'down' : 'up'} onChange={(ev) => store.setLoadDown(i, ev.target.value === 'down')}>
                          <option value="down">вниз</option>
                          <option value="up">вверх</option>
                        </select>
                      </label>
                      <button type="button" className="del" aria-label="Убрать груз" onClick={() => store.removeLoad(i)}>
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <div className="segbtns">
                  <button type="button" id="raddload" onClick={store.addLoad}>
                    + груз на барабане
                  </button>
                </div>
                <h2>Моменты</h2>
                <div className="cgpar cg0">
                  {TERMS.map(([k, label]) => (
                    <Num key={k} id={`r-${k}`} label={label} value={e[k]} neg={!['kv', 'kq', 'Mf'].includes(k)} zero onType={(v) => store.typeEq(k, v)} onEnd={end(`eq:${k}`)} />
                  ))}
                </div>
                <h2>Начальные условия и вопрос</h2>
                <div className="cgpar cg0">
                  <Num id="r-phi0" label="φ₀, рад" value={e.phi0} neg zero onType={(v) => store.typeEq('phi0', v)} onEnd={end('eq:phi0')} />
                  <Num id="r-omega0" label="ω₀, рад/с" value={e.omega0} neg zero onType={(v) => store.typeEq('omega0', v)} onEnd={end('eq:omega0')} />
                  <label className="sfield">
                    <span>найти</span>
                    <select id="rask" value={e.ask} onChange={(ev) => store.setAsk(ev.target.value as 't' | 'omega')}>
                      <option value="t">состояние в момент t</option>
                      <option value="omega">когда ω станет равной</option>
                    </select>
                  </label>
                  {e.ask === 't' ? (
                    <Num id="r-t" label="t, с" value={e.t} onType={(v) => store.typeEq('t', v)} onEnd={end('eq:t')} />
                  ) : (
                    <Num id="r-omega1" label="ω, рад/с" value={e.omega1} neg zero onType={(v) => store.typeEq('omega1', v)} onEnd={end('eq:omega1')} />
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="asteps" id="ritems">
                  {pr.K.map((it, i) => {
                    const N = (k: KNumKey, label: string, neg = false) => <Num key={k} id={`r-${k}${i}`} label={label} value={it[k]} neg={neg} zero onType={(v) => store.typeItem(i, k, v)} onEnd={end(`k:${i}:${k}`)} />;
                    return (
                      <div key={i}>
                        <div className="cvrow cvrow2">
                          <span className="inp cv-name">
                            <input type="text" aria-label="Название" placeholder={it.kind === 'body' ? 'тело' : 'точка'} value={it.name} onChange={(ev) => store.typeItemName(i, ev.target.value)} onBlur={end(`k:${i}:name`)} />
                          </span>
                          <span className="hint">{it.kind === 'body' ? 'тело' : 'точечная масса'}</span>
                          <button type="button" className="del" aria-label="Убрать" disabled={pr.K.length <= 1} onClick={() => store.removeItem(i)}>
                            ×
                          </button>
                        </div>
                        <div className="cgpar">
                          {it.kind === 'body' ? [N('J1', 'J до'), N('J2', 'J после')] : [N('m', pr.byWeight ? 'вес P' : 'масса m'), N('r1', 'r до'), N('r2', 'r после'), N('u1', 'u до', true), N('u2', 'u после', true)]}
                          {N('w1', 'ω до', true)}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="segbtns">
                  <button type="button" id="raddbody" onClick={() => store.addItem('body')}>
                    + тело
                  </button>
                  <button type="button" id="raddpoint" onClick={() => store.addItem('point')}>
                    + точка
                  </button>
                </div>
                <p className="empty">u — скорость точки относительно несущего тела по окружности, «+» — в сторону положительного вращения.</p>
              </>
            )}
          </section>
          <section className="panel" aria-label="Решение">
            <div className="sol-head">
              <h2>Решение</h2>
              <label className="toggle">
                <input type="checkbox" checked={st.explain} onChange={(ev) => store.setExplain(ev.target.checked)} />
                Подробные пояснения
              </label>
            </div>
            <div id="rsolution">
              <DocView doc={out.doc} />
            </div>
          </section>
        </div>
      </div>
      <article className="print-report" aria-hidden="true">
        <header className="pr-head">
          <h1>{st.title}</h1>
          <p>Вращение тела · {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </header>
        <section className="pr-sec pr-figs">
          <figure>
            <svg viewBox={out.fig.viewBox} dangerouslySetInnerHTML={{ __html: out.fig.svg }} />
            <figcaption>{pr.mode === 'eq' ? 'Графики ω(t) и φ(t)' : 'До и после'}</figcaption>
          </figure>
        </section>
        <section className="pr-sec">
          <h2>Решение</h2>
          <DocView doc={out.doc} />
        </section>
      </article>
    </>
  );
}
