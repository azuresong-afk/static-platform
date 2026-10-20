/**
 * Экран «Кинематика точки»: способ задания движения, формулы, момент t; траектория с векторами и её уравнение,
 * равнопеременное движение (три величины из пяти); решение по шагам.
 */
import { useMemo, useSyncExternalStore } from 'react';
import type { Chrome } from '../../../app/module';
import { DocView } from '../../../shared/ui/DocView';
import { LawField } from '../../../shared/ui/LawField';
import { Notice } from '../../../shared/ui/Notice';
import { Num } from '../../../shared/ui/Num';
import { RedoIcon, UndoIcon } from '../../frames/ui/icons';
import { ExtFields } from './ExtFields';
import type { KinMode } from '../model/kin';
import { DEF_UNI, LIN_KEYS } from '../model/uniform';
import { solveAny } from './solve';
import { KIN_PRESETS, type KinPresetKey } from '../presets';
import type { KinNumKey, KinStore, KinStrKey } from './store';
import { PresetOptions } from '../../../shared/ui/PresetOptions';
import { taskEntries } from '../../../shared/tasks';

const LIN_SHORT = { v0: 'v₀', v: 'v', a: 'a', t: 't', s: 's' } as const;
const LIN_WHAT = { v0: 'начальная скорость', v: 'конечная скорость', a: 'ускорение', t: 'время', s: 'путь' } as const;
const MODES: [KinMode, string][] = [
  ['coord', 'координатный: x(t), y(t), z(t)'],
  ['natural', 'естественный: s(t) и радиус кривизны'],
  ['polar', 'полярные координаты: r(t), φ(t)'],
  ['cyl', 'цилиндрические координаты: r(t), φ(t), z(t)'],
  ['sph', 'сферические координаты: r(t), φ(t), θ(t)'],
  ['tor', 'тороидальные координаты: r(t), ψ(t), φ(t)'],
  ['uni', 'равнопеременное движение: три величины из пяти'],
  ['path', 'путь и закон движения по траектории s(t)'],
  ['integ', 'закон движения по заданному ускорению'],
  ['harm', 'гармонические колебания: центр, амплитуда, частота, фаза'],
  ['shot', 'бросок под углом к горизонту'],
  ['cam', 'кулачки: контур и закон движения толкателя'],
];
const EXT: KinMode[] = ['path', 'integ', 'harm', 'shot', 'cam'];

export function KinView({ chrome, store }: { chrome: Chrome; store: KinStore }) {
  const st = useSyncExternalStore(store.subscribe, store.get);
  const pr = st.problem;
  const u = pr.uni ?? DEF_UNI;
  const { fig, doc } = useMemo(() => solveAny(pr, st.explain), [pr, st.explain]);
  const L = (k: KinStrKey, label: string) => <LawField key={k} id={`k-${k}`} label={label} value={pr[k] ?? ''} onType={(s) => store.typeStr(k, s)} onEnd={() => store.endSession(`s:${k}`)} />;
  const N = (k: KinNumKey, label: string, neg = true) => <Num key={k} id={`k-${k}`} label={label} value={pr[k]} neg={neg} zero onType={(v) => store.typeNum(k, v)} onEnd={() => store.endSession(`n:${k}`)} />;

  return (
    <>
      <div className="wrap">
        {chrome.tabs}
        <header className="top">
          <div>
            <h1>Кинематика точки</h1>
            <p className="lede">Скорость и ускорение точки при координатном, естественном способах и в полярных, цилиндрических, сферических и тороидальных координатах: касательное и нормальное ускорения, радиус кривизны, траектория и её уравнение; равнопеременное движение; путь и закон движения по траектории, интегрирование ускорения, гармонические колебания, бросок под углом к горизонту, кулачки.</p>
          </div>
          <div className="topright">
            <label className="preset">
              Готовая задача
              <select id="kpreset" value={st.preset} onChange={(e) => store.loadPreset(e.target.value as KinPresetKey)}>
                <PresetOptions items={taskEntries(KIN_PRESETS)} />
                <option value="custom" hidden>
                  {st.title}
                </option>
              </select>
            </label>
            {chrome.files}
          </div>
        </header>
        <Notice notice={st.notice} onClose={store.closeNotice} />
        <section className="sheet" aria-label="Траектория">
          <div className="bar">
            <span className="hint">Формулы от t: sin, cos, tg, exp, ln, sqrt, sh, ch, π; десятичная запятая; «2t» — без знака умножения.</span>
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
            <svg id="ksvg" className="sketch" viewBox={fig.viewBox} role="img" aria-label="Траектория, скорость и ускорение, графики" dangerouslySetInnerHTML={{ __html: fig.svg }} />
          </div>
        </section>
        <div className="cols">
          <section className="panel conv" aria-label="Данные">
            <h2>Закон движения</h2>
            <label className="field">
              <span>Способ задания</span>
              <select id="kmode" value={pr.mode} onChange={(e) => store.setMode(e.target.value as KinMode)}>
                {MODES.map(([m, t]) => (
                  <option key={m} value={m}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            {pr.mode === 'uni' ? (
              <>
                <h2>Известные величины</h2>
                <p className="empty">Отметьте ровно три; a = const (касательное ускорение). Отрицательное a — замедление.</p>
                <div className="asteps" id="kuni">
                  {LIN_KEYS.map((k) => (
                    <div className="cvrow cvrow2" key={k}>
                      <label className="toggle">
                        <input type="checkbox" id={`ku-k-${k}`} checked={u.known.includes(k)} onChange={() => store.toggleKnown(k)} />
                        {LIN_SHORT[k]}
                      </label>
                      {u.known.includes(k) ? (
                        <Num id={`ku-${k}`} label={`${LIN_WHAT[k]}, ${k === 'v0' || k === 'v' ? (u.kmh ? 'км/ч' : 'м/с') : k === 'a' ? 'м/с²' : k === 't' ? 'с' : 'м'}`} value={u[k]} neg zero onType={(x) => store.typeUni(k, x)} onEnd={() => store.endSession(`u:${k}`)} />
                      ) : (
                        <span className="hint">найти: {LIN_WHAT[k]}</span>
                      )}
                      <span />
                    </div>
                  ))}
                </div>
                <label className="toggle">
                  <input type="checkbox" id="ku-kmh" checked={u.kmh} onChange={(e) => store.setKmh(e.target.checked)} />
                  Скорости в км/ч
                </label>
                <div className="cgpar cg0">
                  <Num id="ku-rho" label="радиус закругления ρ, м (0 — прямая)" value={u.rho} zero onType={(x) => store.typeUni('rho', x)} onEnd={() => store.endSession('u:rho')} />
                  <Num id="ku-tq" label="ещё состояние в момент t′, с (0 — нет)" value={u.tq} zero onType={(x) => store.typeUni('tq', x)} onEnd={() => store.endSession('u:tq')} />
                </div>
              </>
            ) : EXT.includes(pr.mode) || pr.mode === 'tor' ? (
              <ExtFields pr={pr} store={store} />
            ) : (
              <>
                <div className="cgpar cg0">
                  {pr.mode === 'coord' && [L('x', 'x(t)'), L('y', 'y(t)'), L('z', 'z(t) — пусто, если движение плоское')]}
                  {pr.mode === 'natural' && [L('s', 's(t) — путь по траектории'), N('rho', 'радиус кривизны ρ (0 — прямая)', false)]}
                  {pr.mode === 'polar' && [L('r', 'r(t)'), L('phi', 'φ(t), рад')]}
                  {pr.mode === 'cyl' && [L('r', 'r(t)'), L('phi', 'φ(t), рад'), L('z', 'z(t)')]}
                  {pr.mode === 'sph' && [L('r', 'r(t)'), L('phi', 'долгота φ(t), рад'), L('th', 'широта θ(t), рад')]}
                  {N('t', 'момент t')}
                  {N('t1', 'траектория: от t₁')}
                  {N('t2', 'до t₂')}
                </div>
                <p className="empty">
                  Единицы длины — любые (как в условии), время — в секундах. Если t₁ ≥ t₂, траектория строится на отрезке [0; max(t, 1)].{pr.mode === 'sph' ? ' Широта θ — угол радиуса-вектора с плоскостью xy: x = r cos θ cos φ, y = r cos θ sin φ, z = r sin θ.' : ''}
                </p>
              </>
            )}
          </section>
          <section className="panel" aria-label="Решение">
            <div className="sol-head">
              <h2>Решение</h2>
              <label className="toggle">
                <input type="checkbox" checked={st.explain} onChange={(e) => store.setExplain(e.target.checked)} />
                Подробные пояснения
              </label>
            </div>
            <div id="ksolution">
              <DocView doc={doc} />
            </div>
          </section>
        </div>
      </div>
      <article className="print-report" aria-hidden="true">
        <header className="pr-head">
          <h1>{st.title}</h1>
          <p>Кинематика точки · {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </header>
        <section className="pr-sec pr-figs">
          <figure>
            <svg viewBox={fig.viewBox} dangerouslySetInnerHTML={{ __html: fig.svg }} />
            <figcaption>{pr.mode === 'uni' ? 'Путь и скорость' : EXT.includes(pr.mode) ? 'График' : 'Траектория'}</figcaption>
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
