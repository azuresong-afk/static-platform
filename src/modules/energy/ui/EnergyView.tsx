/** Экран «Кинетическая энергия»: тела и связи, что ищем, схема, решение по шагам. */
import { useMemo, useSyncExternalStore } from 'react';
import type { Chrome } from '../../../app/module';
import { DocView } from '../../../shared/ui/DocView';
import { Notice } from '../../../shared/ui/Notice';
import { Num } from '../../../shared/ui/Num';
import { RedoIcon, UndoIcon } from '../../frames/ui/icons';
import { renderEnergy } from '../draw/energy';
import { ATTACHES, ATTACH_NAME, solveEnergy, type BodyKind, type EnergyMode, type InertiaKind } from '../model/energy';
import { ENERGY_PRESETS, type EnergyPresetKey } from '../presets';
import { energyDoc } from '../text/solution';
import type { EnergyStore } from './store';
import { PresetOptions } from '../../../shared/ui/PresetOptions';
import { taskEntries } from '../../../shared/tasks';

const KIND: [BodyKind, string][] = [
  ['translate', 'груз'],
  ['rotate', 'блок, барабан'],
  ['roll', 'каток, колесо'],
];
const INERTIA: [InertiaKind, string][] = [
  ['disk', 'сплошной диск'],
  ['ring', 'масса на ободе'],
  ['rho', 'радиус инерции ρ'],
  ['J', 'задан J'],
];
const MODES: [EnergyMode, string][] = [
  ['v', 'скорость после перемещения'],
  ['s', 'перемещение до заданной скорости'],
  ['v0', 'начальную скорость'],
];

export function EnergyView({ chrome, store }: { chrome: Chrome; store: EnergyStore }) {
  const st = useSyncExternalStore(store.subscribe, store.get);
  const pr = st.problem;
  const r = useMemo(() => solveEnergy(pr), [pr]);
  const fig = useMemo(() => renderEnergy(pr, r), [pr, r]);
  const doc = useMemo(() => energyDoc(pr, r, { explain: st.explain }), [pr, r, st.explain]);
  const ang = pr.bodies[0]?.kind === 'rotate';
  const V = ang ? 'ω' : 'v',
    S = ang ? 'φ' : 's';
  const end = (k: string) => () => store.endSession(k);

  return (
    <>
      <div className="wrap">
        {chrome.tabs}
        <header className="top">
          <div>
            <h1>Кинетическая энергия</h1>
            <p className="lede">Теорема об изменении кинетической энергии для системы грузов, блоков и катков на нитях и ремнях: приведённая масса, работа сил тяжести, трения, моментов и пружин, скорость и ускорение.</p>
          </div>
          <div className="topright">
            <label className="preset">
              Готовая задача
              <select id="epreset" value={st.preset} onChange={(e) => store.loadPreset(e.target.value as EnergyPresetKey)}>
                <PresetOptions items={taskEntries(ENERGY_PRESETS)} />
                <option value="custom" hidden>
                  {st.title}
                </option>
              </select>
            </label>
            {chrome.files}
          </div>
        </header>
        <Notice notice={st.notice} onClose={store.closeNotice} />
        <section className="sheet" aria-label="Схема">
          <div className="bar">
            <span className="hint">Тело 1 — ведущее; каждое следующее связано нитью (ремнём) с одним из предыдущих.</span>
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
            <svg id="esvg" className="sketch" viewBox={fig.viewBox} role="img" aria-label="Схема системы" dangerouslySetInnerHTML={{ __html: fig.svg }} />
          </div>
        </section>
        <div className="cols">
          <section className="panel conv" aria-label="Система">
            <h2>Что ищем</h2>
            <label className="field">
              <span>Найти</span>
              <select id="emode" value={pr.mode} onChange={(e) => store.setMode(e.target.value as EnergyMode)}>
                {MODES.map(([m, t]) => (
                  <option key={m} value={m}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <div className="cgpar cg0">
              {pr.mode !== 'v0' && <Num id="e-v0" label={`${V}₀, ${ang ? 'рад/с' : 'м/с'}`} value={pr.v0} zero onType={(v) => store.typeTop('v0', v)} onEnd={end('t:v0')} />}
              {pr.mode !== 's' && <Num id="e-s" label={`${S}, ${ang ? 'рад' : 'м'}`} value={pr.s} onType={(v) => store.typeTop('s', v)} onEnd={end('t:s')} />}
              {pr.mode !== 'v' && <Num id="e-v1" label={`${V} в конце`} value={pr.v1} zero onType={(v) => store.typeTop('v1', v)} onEnd={end('t:v1')} />}
            </div>
            <h2>Тела</h2>
            <label className="toggle">
              <input type="checkbox" id="eweight" checked={pr.byWeight} onChange={(e) => store.setByWeight(e.target.checked)} />
              Заданы веса P (m = P/g, g = 9,81 м/с²)
            </label>
            <div className="asteps" id="ebodies">
              {pr.bodies.map((b, i) => {
                const k = `b:${i}:`;
                const N = (key: string, label: string, val: number, o: { neg?: boolean; zero?: boolean } = { zero: true }) => (
                  <Num key={key} id={`e-${key}${i}`} label={label} value={val} neg={o.neg} zero={o.zero} onType={(v) => store.typeBody(i, key, v)} onEnd={end(k + key)} />
                );
                return (
                  <div key={i}>
                    <div className="cgrow">
                      <span className="segname">{i + 1}</span>
                      <select aria-label="Вид тела" value={b.kind} onChange={(e) => store.setKind(i, e.target.value as BodyKind)}>
                        {KIND.map(([kk, t]) => (
                          <option key={kk} value={kk}>
                            {t}
                          </option>
                        ))}
                      </select>
                      <span className="inp cv-name">
                        <input type="text" aria-label="Название" placeholder="название" value={b.name} onChange={(e) => store.typeName(i, e.target.value)} onBlur={end(k + 'name')} />
                      </span>
                      <button type="button" className="del" aria-label="Убрать тело" disabled={pr.bodies.length <= 1} onClick={() => store.removeBody(i)}>
                        ×
                      </button>
                    </div>
                    {b.link && (
                      <div className="cgpar en-link">
                        <label className="sfield">
                          <span>нить от тела</span>
                          <select data-link-from={i} value={b.link.from} onChange={(e) => store.setLink(i, 'from', e.target.value)}>
                            {pr.bodies.slice(0, i).map((_, j) => (
                              <option key={j} value={j}>
                                {j + 1}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="sfield">
                          <span>сходит с</span>
                          <select value={b.link.at} onChange={(e) => store.setLink(i, 'at', e.target.value)}>
                            {ATTACHES[pr.bodies[b.link.from].kind].map((a) => (
                              <option key={a} value={a}>
                                {ATTACH_NAME[a]}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="sfield">
                          <span>крепится к</span>
                          <select value={b.link.to} onChange={(e) => store.setLink(i, 'to', e.target.value)}>
                            {ATTACHES[b.kind].map((a) => (
                              <option key={a} value={a}>
                                {ATTACH_NAME[a]}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    )}
                    <div className="cgpar">
                      {N('m', pr.byWeight ? 'вес P' : 'масса m', b.m)}
                      {b.kind === 'rotate' && [N('R', 'радиус R', b.R, {}), N('r', 'радиус r', b.r)]}
                      {b.kind === 'roll' && [N('r', 'радиус качения r', b.r, {}), N('R', 'радиус R (нить)', b.R)]}
                      {b.kind !== 'translate' && (
                        <label className="sfield">
                          <span>момент инерции</span>
                          <select value={b.inertia} onChange={(e) => store.setInertia(i, e.target.value as InertiaKind)}>
                            {INERTIA.map(([kk, t]) => (
                              <option key={kk} value={kk}>
                                {t}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      {b.kind !== 'translate' && (b.inertia === 'rho' || b.inertia === 'J') && N('I', b.inertia === 'rho' ? 'ρ, м' : 'J', b.I)}
                      {b.kind !== 'rotate' && [
                        N('alpha', 'угол α, °', b.alpha),
                        <label className="sfield" key="up">
                          <span>центр</span>
                          <select value={b.up ? 'up' : 'down'} onChange={(e) => store.setUp(i, e.target.value === 'up')}>
                            <option value="down">опускается</option>
                            <option value="up">поднимается</option>
                          </select>
                        </label>,
                      ]}
                      {b.kind === 'translate' && N('f', 'трение f', b.f)}
                      {b.kind === 'roll' && N('fk', 'качение δ, м', b.fk)}
                      {b.kind !== 'translate' && [N('M0', 'момент M₀', b.M[0], { neg: true }), N('M1', 'M₁ (·φ)', b.M[1], { neg: true }), N('M2', 'M₂ (·φ²)', b.M[2], { neg: true })]}
                      {b.kind !== 'rotate' && [N('F', 'сила F', b.F, { neg: true }), N('c', 'пружина c', b.c), N('lambda0', 'λ₀, м', b.lambda0, { neg: true })]}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="segbtns">
              <button type="button" id="eadd" onClick={store.addBody}>
                + тело
              </button>
            </div>
            <p className="empty">Угол α — наклон пути центра к горизонту (90° — груз висит на нити). Момент M = M₀ + M₁φ + M₂φ² и сила F положительны, если направлены по движению. λ₀ &gt; 0 — движение увеличивает деформацию пружины.</p>
          </section>
          <section className="panel" aria-label="Решение">
            <div className="sol-head">
              <h2>Решение</h2>
              <label className="toggle">
                <input type="checkbox" checked={st.explain} onChange={(e) => store.setExplain(e.target.checked)} />
                Подробные пояснения
              </label>
            </div>
            <div id="esolution">
              <DocView doc={doc} />
            </div>
          </section>
        </div>
      </div>
      <article className="print-report" aria-hidden="true">
        <header className="pr-head">
          <h1>{st.title}</h1>
          <p>Кинетическая энергия · {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </header>
        <section className="pr-sec pr-figs">
          <figure>
            <svg viewBox={fig.viewBox} dangerouslySetInnerHTML={{ __html: fig.svg }} />
            <figcaption>Схема системы</figcaption>
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
