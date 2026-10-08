/** Экран «Вращение тела и передачи»: закон ведущего звена, цепочка колёс, точка и искомое; схема, график ω(t), решение по шагам. */
import { useMemo, useSyncExternalStore } from 'react';
import type { Chrome } from '../../../app/module';
import { DocView } from '../../../shared/ui/DocView';
import { LawField } from '../../../shared/ui/LawField';
import { Notice } from '../../../shared/ui/Notice';
import { Num } from '../../../shared/ui/Num';
import { RedoIcon, UndoIcon } from '../../frames/ui/icons';
import { renderEll, renderFr, renderUni } from '../draw/extra';
import { renderGears } from '../draw/gears';
import { solveEllipse } from '../model/ellipse';
import { solveFriction } from '../model/friction';
import { LINKS, solveGears, type FindKind, type GearMode, type Link } from '../model/gears';
import { solveUniform, UNI_KEYS } from '../model/uniform';
import { GEAR_PRESETS, type GearPresetKey } from '../presets';
import { ellDoc, frDoc, uniDoc, UNI_NAMES } from '../text/extra';
import { gearDoc } from '../text/solution';
import { MAX_WHEELS, type GearNumKey, type GearStore } from './store';
import { PresetOptions } from '../../../shared/ui/PresetOptions';
import { taskEntries } from '../../../shared/tasks';

export function GearView({ chrome, store }: { chrome: Chrome; store: GearStore }) {
  const st = useSyncExternalStore(store.subscribe, store.get);
  const pr = st.problem;
  const { fig, doc } = useMemo(() => {
    const o = { explain: st.explain };
    if (pr.mode === 'uniform') {
      const r = solveUniform(pr.uni);
      return { fig: renderUni(r), doc: uniDoc(pr.uni, r, o) };
    }
    if (pr.mode === 'ellipse') {
      const r = solveEllipse(pr.ell);
      return { fig: renderEll(pr.ell, r), doc: ellDoc(pr.ell, r, o) };
    }
    if (pr.mode === 'friction') {
      const r = solveFriction(pr.fr);
      return { fig: renderFr(pr.fr, r), doc: frDoc(pr.fr, r, o) };
    }
    const r = solveGears(pr);
    return { fig: renderGears(pr, r), doc: gearDoc(pr, r, o) };
  }, [pr, st.explain]);
  const N = (k: GearNumKey, label: string, neg = false) => <Num key={k} id={`g-${k}`} label={label} value={pr[k]} neg={neg} zero onType={(v) => store.typeNum(k, v)} onEnd={() => store.endSession(`n:${k}`)} />;
  const end = (key: string) => () => store.endSession(key);

  return (
    <>
      <div className="wrap">
        {chrome.tabs}
        <header className="top">
          <div>
            <h1>Вращение тела и передачи</h1>
            <p className="lede">Вращение тела вокруг неподвижной оси по закону φ(t) или по движению нити; зубчатые, ремённые и конические передачи, эллиптические колёса и фрикционная передача; обратные задачи — момент времени, неизвестный размер колеса, равнопеременное вращение по трём величинам из пяти.</p>
          </div>
          <div className="topright">
            <label className="preset">
              Готовая задача
              <select id="gpreset" value={st.preset} onChange={(e) => store.loadPreset(e.target.value as GearPresetKey)}>
                <PresetOptions items={taskEntries(GEAR_PRESETS)} />
                <option value="custom" hidden>
                  {st.title}
                </option>
              </select>
            </label>
            {chrome.files}
          </div>
        </header>
        <Notice notice={st.notice} onClose={store.closeNotice} />
        <section className="sheet" aria-label="Схема передачи">
          <div className="bar">
            <span className="hint">Закон — формула от t: sin, cos, exp, ln, sqrt, π; десятичная запятая; «2πt» — без знака умножения. Против часовой стрелки ω {">"} 0.</span>
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
            <svg id="gsvg" className="sketch" viewBox={fig.viewBox} role="img" aria-label="Схема передачи и график угловой скорости" dangerouslySetInnerHTML={{ __html: fig.svg }} />
          </div>
        </section>
        <div className="cols">
          <section className="panel conv" aria-label="Данные">
            <label className="field">
              <span>Вид задачи</span>
              <select id="gmode" value={pr.mode} onChange={(e) => store.setMode(e.target.value as GearMode)}>
                {MODES.map(([m, t]) => (
                  <option key={m} value={m}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            {pr.mode === 'uniform' && <UniPanel store={store} />}
            {pr.mode === 'ellipse' && <EllPanel store={store} />}
            {pr.mode === 'friction' && <FrPanel store={store} />}
            {pr.mode === 'chain' && (
              <>
            <h2>Ведущее звено</h2>
            <label className="field">
              <span>Задано</span>
              <select id="gdrive" value={pr.drive} onChange={(e) => store.setDrive(e.target.value as 'phi' | 'x')}>
                <option value="phi">закон поворота колеса 1: φ₁(t), рад</option>
                <option value="x">закон движения нити (рейки) на колесе 1: x(t)</option>
              </select>
            </label>
            <div className="cgpar cg0">
              <LawField id="g-law" label={pr.drive === 'phi' ? 'φ₁(t), рад' : 'x(t) — вдоль нити'} value={pr.law} onType={store.typeLaw} onEnd={end('law')} />
            </div>
            <h2>Колёса</h2>
            <div className="asteps" id="gwheels">
              {pr.wheels.map((w, j) => (
                <div key={j}>
                  <div className="cvrow cvrow2">
                    <span className="hint">колесо {j + 1}</span>
                    {j === 0 ? (
                      <span className="hint">ведущее</span>
                    ) : (
                      <select aria-label={`Связь колеса ${j + 1} с колесом ${j}`} value={w.link} onChange={(e) => store.setLink(j, e.target.value as Link)}>
                        {LINKS.map(([l, t]) => (
                          <option key={l} value={l}>
                            {t}
                          </option>
                        ))}
                      </select>
                    )}
                    <button type="button" className="del" aria-label="Убрать колесо" disabled={pr.wheels.length <= 1} onClick={() => store.removeWheel(j)}>
                      ×
                    </button>
                  </div>
                  <div className="cgpar">
                    <Num id={`g-r${j}`} label={`радиус r${j + 1}`} value={w.r} zero onType={(v) => store.typeWheel(j, 'r', v)} onEnd={end(`w:${j}:r`)} />
                    <Num id={`g-z${j}`} label={`зубьев z${j + 1}`} value={w.z} zero onType={(v) => store.typeWheel(j, 'z', v)} onEnd={end(`w:${j}:z`)} />
                  </div>
                </div>
              ))}
            </div>
            <div className="segbtns">
              <button type="button" id="gaddw" disabled={pr.wheels.length >= MAX_WHEELS} onClick={store.addWheel}>
                + колесо
              </button>
            </div>
            <h2>Что найти</h2>
            <label className="field">
              <span>Колесо для ответа и точки</span>
              <select id="gk" value={pr.k} onChange={(e) => store.setK(+e.target.value)}>
                {pr.wheels.map((_, j) => (
                  <option key={j} value={j}>
                    колесо {j + 1}
                  </option>
                ))}
              </select>
            </label>
            <div className="cgpar cg0">
              {N('rho', 'точка: ρ от оси (0 — обод)')}
              {pr.find !== 'time' && N('t', 'момент t, с', true)}
              {N('tMax', 'график (и поиск) до t, с')}
            </div>
            <label className="field">
              <span>Обратная задача: задана |ω| выбранного колеса</span>
              <select id="gfind" value={pr.find} onChange={(e) => store.setFind(e.target.value as FindKind)}>
                <option value="none">нет — прямая задача</option>
                <option value="time">найти момент, когда ω достигнет значения</option>
                <option value="size">найти неизвестный размер колеса</option>
              </select>
            </label>
            {pr.find === 'size' && (
              <label className="field">
                <span>Неизвестно</span>
                <select id="gu" value={`${pr.u}:${pr.uKey}`} onChange={(e) => store.setU(+e.target.value.split(':')[0], e.target.value.split(':')[1] as 'r' | 'z')}>
                  {pr.wheels.flatMap((_, j) => [
                    <option key={`${j}r`} value={`${j}:r`}>
                      радиус r{j + 1}
                    </option>,
                    <option key={`${j}z`} value={`${j}:z`}>
                      число зубьев z{j + 1}
                    </option>,
                  ])}
                </select>
              </label>
            )}
            {pr.find !== 'none' && (
              <div className="cgpar cg0">
                {N('target', 'заданная |ω|')}
                <label className="field">
                  <span>единицы</span>
                  <select id="gunit" value={pr.unit} onChange={(e) => store.setUnit(e.target.value as 'rad' | 'rpm')}>
                    <option value="rpm">об/мин</option>
                    <option value="rad">рад/с</option>
                  </select>
                </label>
              </div>
            )}
            <p className="empty">Радиусы и зубья: 0 — не задано. Отношение в паре считается по числам зубьев, если они заданы у обоих колёс, иначе по радиусам. Для нити и точки нужен радиус. Единицы длины — как в условии, время — в секундах.{pr.find === 'size' ? ' Неизвестный размер в таблице не учитывается.' : ''}</p>
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
            <div id="gsolution">
              <DocView doc={doc} />
            </div>
          </section>
        </div>
      </div>
      <article className="print-report" aria-hidden="true">
        <header className="pr-head">
          <h1>{st.title}</h1>
          <p>Вращение тела и передачи · {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </header>
        <section className="pr-sec pr-figs">
          <figure>
            <svg viewBox={fig.viewBox} dangerouslySetInnerHTML={{ __html: fig.svg }} />
            <figcaption>Схема передачи</figcaption>
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

const MODES: [GearMode, string][] = [
  ['chain', 'вращение и передачи по закону движения'],
  ['uniform', 'равнопеременное вращение: три величины из пяти'],
  ['ellipse', 'эллиптические (овальные) колёса'],
  ['friction', 'фрикционная передача с переменным плечом'],
];

function UniPanel({ store }: { store: GearStore }) {
  const u = useSyncExternalStore(store.subscribe, store.get).problem.uni;
  const unit = (k: string) => (k === 'w0' || k === 'w' ? (u.wUnit === 'rpm' ? 'об/мин' : 'рад/с') : k === 'phi' ? (u.phiUnit === 'turn' ? 'об.' : 'рад') : k === 't' ? 'с' : 'рад/с²');
  return (
    <>
      <h2>Известные величины</h2>
      <p className="empty">Отметьте ровно три; ε = const. Отрицательное ε — замедление.</p>
      <div className="asteps" id="guni">
        {UNI_KEYS.map((k) => (
          <div className="cvrow cvrow2" key={k}>
            <label className="toggle">
              <input type="checkbox" id={`gu-k-${k}`} checked={u.known.includes(k)} onChange={() => store.toggleKnown(k)} />
              {UNI_NAMES[k]}
            </label>
            {u.known.includes(k) ? <Num id={`gu-${k}`} label={unit(k)} value={u[k]} neg zero onType={(v) => store.typeUni(k, v)} onEnd={() => store.endSession(`u:${k}`)} /> : <span className="hint">найти</span>}
            <span />
          </div>
        ))}
      </div>
      <div className="cgpar cg0">
        <label className="field">
          <span>угловые скорости</span>
          <select id="gu-wunit" value={u.wUnit} onChange={(e) => store.setUniUnit('wUnit', e.target.value)}>
            <option value="rpm">об/мин</option>
            <option value="rad">рад/с</option>
          </select>
        </label>
        <label className="field">
          <span>угол</span>
          <select id="gu-punit" value={u.phiUnit} onChange={(e) => store.setUniUnit('phiUnit', e.target.value)}>
            <option value="turn">обороты</option>
            <option value="rad">радианы</option>
          </select>
        </label>
      </div>
    </>
  );
}

function EllPanel({ store }: { store: GearStore }) {
  const e = useSyncExternalStore(store.subscribe, store.get).problem.ell;
  const N = (k: 'a' | 'b' | 'A' | 'w1' | 'phi', label: string, zero = false, neg = false) => <Num key={k} id={`ge-${k}`} label={label} value={e[k]} zero={zero} neg={neg} onType={(v) => store.typeEll(k, v)} onEnd={() => store.endSession(`e:${k}`)} />;
  return (
    <>
      <h2>Колесо 1 — эллипс</h2>
      <label className="field">
        <span>Ось вращения</span>
        <select id="ge-pivot" value={e.pivot} onChange={(x) => store.setEll({ pivot: x.target.value as 'focus' | 'center' })}>
          <option value="focus">в фокусе эллипса (14.6, 14.7)</option>
          <option value="center">в центре — овальные колёса (14.8)</option>
        </select>
      </label>
      <div className="cgpar cg0">
        {N('a', 'большая полуось a')}
        {N('b', 'малая полуось b')}
        {N('A', 'межосевое O₁O₂ (0 — 2a или a + b)', true)}
        {N('w1', 'ω₁ (постоянна)')}
        <label className="field">
          <span>единицы ω₁</span>
          <select id="ge-unit" value={e.unit} onChange={(x) => store.setEll({ unit: x.target.value as 'rad' | 'rpm' })}>
            <option value="rpm">об/мин</option>
            <option value="rad">рад/с</option>
          </select>
        </label>
        {N('phi', 'положение φ, °', true, true)}
      </div>
      <p className="empty">φ — угол между линией центров и большой осью колеса 1. Колесо 2 — сопряжённое: при оси в фокусе и O₁O₂ = 2a это такой же эллипс.</p>
    </>
  );
}

function FrPanel({ store }: { store: GearStore }) {
  const f = useSyncExternalStore(store.subscribe, store.get).problem.fr;
  const N = (k: 'r' | 'R' | 't' | 'dTarget' | 'tMax', label: string, zero = true, neg = false) => <Num key={k} id={`gf-${k}`} label={label} value={f[k]} zero={zero} neg={neg} onType={(v) => store.typeFr(k, v)} onEnd={() => store.endSession(`f:${k}`)} />;
  return (
    <>
      <h2>Ведущий ролик и диск 2</h2>
      <div className="cgpar cg0">
        <LawField id="gf-law" label="φ₁(t) ролика, рад" value={f.law} onType={(v) => store.typeFrStr('law', v)} onEnd={() => store.endSession('f:law')} />
        {N('r', 'радиус ролика r', false)}
        <LawField id="gf-d" label="плечо d(t) — от оси диска 2" value={f.d} onType={(v) => store.typeFrStr('d', v)} onEnd={() => store.endSession('f:d')} />
        {N('R', 'точка диска 2: R (0 — не нужна)')}
        {!f.find && N('t', 'момент t, с', true, true)}
        {N('tMax', 'график (и поиск) до t, с')}
      </div>
      <label className="toggle">
        <input type="checkbox" id="gf-find" checked={f.find} onChange={(e) => store.setFrFind(e.target.checked)} />
        Найти момент, когда плечо d станет равным
      </label>
      {f.find && <div className="cgpar cg0">{N('dTarget', 'значение d', true, true)}</div>}
    </>
  );
}
