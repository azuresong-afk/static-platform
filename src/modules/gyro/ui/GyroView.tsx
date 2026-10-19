/** Экран «Гироскоп»: гироскопический момент и давления на опоры, прецессия под действием момента, равновесие оси. */
import { useMemo, useSyncExternalStore } from 'react';
import type { Chrome } from '../../../app/module';
import { DocView } from '../../../shared/ui/DocView';
import { Notice } from '../../../shared/ui/Notice';
import { Num } from '../../../shared/ui/Num';
import { PresetOptions } from '../../../shared/ui/PresetOptions';
import { taskEntries } from '../../../shared/tasks';
import { RedoIcon, UndoIcon } from '../../frames/ui/icons';
import { renderGyro } from '../draw/gyro';
import { solveGyro, unitsOf, type GyroProblem } from '../model/gyro';
import { GYRO_PRESETS, type GyroPresetKey } from '../presets';
import { gyroDoc } from '../text/solution';
import type { GyroNumKey, GyroSel, GyroStore } from './store';

const T: { [K in GyroSel]: Record<GyroProblem[K], string> } = {
  mode: { forced: 'вынужденная прецессия: давления на опоры', free: 'прецессия под действием момента', balance: 'равновесие оси: пружины или маятник' },
  units: { tech: 'техническая (кГ, кГ·м·с²)', si: 'СИ (кг, Н)' },
  jMode: {
    rho: 'масса и радиус инерции ρ',
    disc: 'сплошной диск радиуса R',
    ring: 'масса по ободу радиуса R',
    J: 'момент инерции J',
    H: 'кинетический момент H',
  },
  spin: { rpm: 'ω, об/мин', rate: 'ω, с⁻¹', roll: 'колесо катится: ω = v/a', runner: 'бегун катится по основанию' },
  prec: { rate: 'ω₁, с⁻¹', rpm: 'ω₁, об/мин', degs: 'ω₁, °/с', turn: 'поворот по закруглению: v/R', pitch: 'качка: амплитуда и период' },
  sup: { rotor: 'на оси ротора', prec: 'на оси прецессии', roller: 'бегун давит на основание' },
  stat: { none: 'не учитывать', split: 'вес делится между опорами', lever: 'вес с плечом e (боковые)', weight: 'вес бегуна на основание' },
  src: { weight: 'вес ротора с плечом l', force: 'сила F с плечом h', moment: 'момент M₀' },
  bal: { spring: 'гиротахометр: пружины', pendulum: 'маятниковый гироскоп на вращающемся основании' },
};

export function GyroView({ chrome, store }: { chrome: Chrome; store: GyroStore }) {
  const st = useSyncExternalStore(store.subscribe, store.get);
  const p = st.problem;
  const out = useMemo(() => {
    const r = solveGyro(p);
    return { fig: renderGyro(p, r), doc: gyroDoc(p, r, { explain: st.explain }) };
  }, [p, st.explain]);
  const U = unitsOf(p.units);
  const end = (k: string) => () => store.endSession(`g:${k}`);
  const N = (k: GyroNumKey, label: string, kind: 'any' | 'pos' | 'nonneg' = 'pos') => (
    <Num key={k} id={`gy-${k}`} label={label} value={p[k]} neg={kind === 'any'} zero={kind !== 'pos'} onType={(v) => store.type(k, v)} onEnd={end(k)} />
  );
  const sel = <K extends GyroSel>(k: K, label: string, only?: GyroProblem[K][]) => {
    const opts = (Object.keys(T[k]) as GyroProblem[K][]).filter((o) => !only || only.includes(o));
    return (
      <label className="field">
        <span>{label}</span>
        <select id={`gy-${k}`} value={p[k]} onChange={(e) => store.setSel(k, e.target.value as GyroProblem[K])}>
          {opts.map((o) => (
            <option key={o} value={o}>
              {T[k][o]}
            </option>
          ))}
        </select>
      </label>
    );
  };
  const forced = p.mode === 'forced';
  const precNeeded = forced || (p.mode === 'balance' && p.bal === 'spring');

  return (
    <>
      <div className="wrap">
        {chrome.tabs}
        <header className="top">
          <div>
            <h1>Гироскоп</h1>
            <p className="lede">
              Приближённая теория: кинетический момент H = Jω по оси ротора. Гироскопический момент при повороте оси, давления на подшипники и на основание
              (турбины на судне, колёсный скат, бегуны); прецессия волчка и снаряда; гиротахометр и маятниковый гироскоп.
            </p>
          </div>
          <div className="topright">
            <label className="preset">
              Готовая задача
              <select id="gypreset" value={st.preset} onChange={(e) => store.loadPreset(e.target.value as GyroPresetKey)}>
                <PresetOptions items={taskEntries(GYRO_PRESETS)} />
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
            <span className="hint">Ось ротора, ось прецессии и давления на опоры.</span>
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
            <svg id="gysvg" className="sketch" viewBox={out.fig.viewBox} role="img" aria-label="Схема" dangerouslySetInnerHTML={{ __html: out.fig.svg }} />
          </div>
        </section>
        <div className="cols">
          <section className="panel conv" aria-label="Данные">
            <h2>Задача</h2>
            {sel('mode', 'Что решаем')}
            {sel('units', 'Единицы')}
            <h2>Ротор</h2>
            {sel('jMode', 'Момент инерции', p.mode === 'free' ? undefined : ['rho', 'disc', 'ring', 'J'])}
            <div className="cgpar cg0">
              {p.jMode === 'H' && N('H', `H, ${U.H}`)}
              {p.jMode === 'J' && N('J', `J, ${U.J}`)}
              {p.jMode !== 'H' && p.jMode !== 'J' && N('m', p.units === 'tech' ? 'вес, кГ' : 'масса, кг')}
              {p.jMode === 'J' && p.mode === 'free' && p.src === 'weight' && N('m', p.units === 'tech' ? 'вес, кГ' : 'масса, кг')}
              {p.jMode === 'rho' && N('rho', 'ρ, м')}
              {(p.jMode === 'disc' || p.jMode === 'ring') && N('R', 'R, м')}
              {N('g', 'g, м/с²')}
            </div>
            {p.jMode !== 'H' && (
              <>
                {sel('spin', 'Собственное вращение', forced ? undefined : ['rpm', 'rate', 'roll'])}
                <div className="cgpar cg0">
                  {(p.spin === 'rate' || p.spin === 'rpm') && N('om', p.spin === 'rpm' ? 'n, об/мин' : 'ω, с⁻¹', 'any')}
                  {p.spin === 'roll' && (
                    <>
                      {N('v', 'v, м/с', 'any')}
                      {N('a', 'радиус a, м')}
                    </>
                  )}
                  {p.spin === 'runner' && (
                    <>
                      {N('d', 'd от оси, м')}
                      {N('rc', 'радиус r, м')}
                    </>
                  )}
                </div>
              </>
            )}
            {precNeeded && (
              <>
                <h2>{forced ? 'Прецессия' : 'Вращение основания'}</h2>
                {sel('prec', forced ? 'Угловая скорость оси ω₁' : 'Угловая скорость основания ω₁')}
                <div className="cgpar cg0">
                  {(p.prec === 'rate' || p.prec === 'rpm' || p.prec === 'degs') &&
                    N('w1', p.prec === 'rate' ? 'ω₁, с⁻¹' : p.prec === 'rpm' ? 'n₁, об/мин' : 'ω₁, °/с', 'any')}
                  {p.prec === 'turn' && (
                    <>
                      {N('vp', 'v, м/с', 'any')}
                      {N('Rp', 'R, м')}
                    </>
                  )}
                  {p.prec === 'pitch' && (
                    <>
                      {N('amp', 'θ₀, °')}
                      {N('T', 'T, с')}
                    </>
                  )}
                  {forced && N('beta', 'угол β, °', 'any')}
                </div>
              </>
            )}
            {forced && (
              <>
                <h2>Опоры</h2>
                {sel('sup', 'Опоры')}
                <div className="cgpar cg0">
                  {p.sup !== 'roller' && N('l', 'l, м')}
                  {p.sup === 'roller' && p.spin !== 'runner' && N('d', 'плечо d, м')}
                </div>
                {sel('stat', 'Статические давления', p.sup === 'roller' ? ['none', 'weight'] : p.sup === 'rotor' ? ['none', 'split'] : ['none', 'lever'])}
                <div className="cgpar cg0">
                  {p.stat !== 'none' && N('P', `вес P, ${U.F}`)}
                  {p.stat === 'split' && N('c', 'центр от A, м', 'nonneg')}
                  {p.stat === 'lever' && N('e', 'плечо e, м', 'any')}
                </div>
              </>
            )}
            {p.mode === 'free' && (
              <>
                <h2>Момент</h2>
                {sel('src', 'Что вызывает прецессию')}
                <div className="cgpar cg0">
                  {p.src === 'weight' && N('l0', 'l, м')}
                  {p.src === 'force' && (
                    <>
                      {N('F', `F, ${U.F}`)}
                      {N('h', 'h, м')}
                    </>
                  )}
                  {p.src === 'moment' && N('M0', `M₀, ${U.M}`)}
                </div>
              </>
            )}
            {p.mode === 'balance' && (
              <>
                <h2>Равновесие</h2>
                {sel('bal', 'Что уравновешивает')}
                <div className="cgpar cg0">
                  {p.bal === 'spring' && (
                    <>
                      {N('cs', `c, ${U.F}/м`)}
                      {N('as', 'a, м')}
                      {N('ns', 'пружин')}
                    </>
                  )}
                  {p.bal === 'pendulum' && (
                    <>
                      {N('Ob', 'Ω_о, с⁻¹')}
                      {N('gam', 'угол γ, °', 'any')}
                      {N('Hst', `H_ст, ${U.M}`)}
                    </>
                  )}
                </div>
              </>
            )}
            <p className="empty">
              β — угол между осью ротора и осью прецессии. Направления: ω — от опоры A к B, ω₁ — против часовой стрелки при взгляде с конца оси прецессии;
              отрицательное значение — вращение в обратную сторону. Для Земли Ω_о = 7,29·10⁻⁵ с⁻¹, γ = 90° − широта.
            </p>
          </section>
          <section className="panel" aria-label="Решение">
            <div className="sol-head">
              <h2>Решение</h2>
              <label className="toggle">
                <input type="checkbox" checked={st.explain} onChange={(e) => store.setExplain(e.target.checked)} />
                Подробные пояснения
              </label>
            </div>
            <div id="gysolution">
              <DocView doc={out.doc} />
            </div>
          </section>
        </div>
      </div>
      <article className="print-report" aria-hidden="true">
        <header className="pr-head">
          <h1>{st.title}</h1>
          <p>Гироскоп · {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </header>
        <section className="pr-sec pr-figs">
          <figure>
            <svg viewBox={out.fig.viewBox} dangerouslySetInnerHTML={{ __html: out.fig.svg }} />
            <figcaption>Схема</figcaption>
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
