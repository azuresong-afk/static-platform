/** Экран «Удар»: два тела, точка удара и нормаль, коэффициент восстановления, этапы до и после удара; решение и чертёж. */
import { useMemo, useSyncExternalStore } from 'react';
import type { Chrome } from '../../../app/module';
import { DocView } from '../../../shared/ui/DocView';
import { Notice } from '../../../shared/ui/Notice';
import { Num } from '../../../shared/ui/Num';
import { PresetOptions } from '../../../shared/ui/PresetOptions';
import { taskEntries } from '../../../shared/tasks';
import { RedoIcon, UndoIcon } from '../../frames/ui/icons';
import { renderImpact } from '../draw/impact';
import { solveImpact, type After, type Before, type BodyKind, type ImpBody, type ImpProblem, type Inertia } from '../model/impact';
import { IMP_PRESETS, type ImpPresetKey } from '../presets';
import { impactDoc } from '../text/solution';
import { AFTER_OF, BEFORE_OF, INERTIA_OF, type BodyNumKey, type ImpStore, type TopNumKey } from './store';
import { ExtraScreen } from '../../../shared/ui/ExtraScreen';
import { IMPACT_ASKS } from '../model/extra';
import { IMP_EXTRA_PRESETS, type ImpExtraKey } from '../extraPresets';

const ALL_PRESETS = { ...IMP_PRESETS, ...IMP_EXTRA_PRESETS };

const KIND_T: Record<BodyKind, string> = { free: 'свободное тело', axis: 'тело на неподвижной оси', wall: 'неподвижная преграда' };
const INERTIA_T: Record<Inertia, string> = {
  point: 'материальная точка',
  sphere: 'шар',
  disk: 'диск (цилиндр)',
  ring: 'кольцо (обод)',
  rod: 'стержень',
  rect: 'пластина a × b',
  rhoC: 'радиус инерции ρ_C',
  JC: 'момент инерции J_C',
  rhoO: 'радиус инерции ρ_O',
  JO: 'момент инерции J_O',
};
const BEFORE_T: Record<Before, string> = {
  given: 'скорости заданы',
  fall: 'падает с высоты h',
  thread: 'маятник на нити',
  swing: 'падает, повёрнутое на угол',
};
const AFTER_T: Record<After, string> = {
  none: '—',
  rise: 'подъём (отскок)',
  thread: 'отклонение нити',
  slide: 'скольжение с трением',
  pivot: 'поворот вокруг точки удара',
  swing: 'поворот вокруг оси',
  spring: 'сжатие пружины под телом',
  pile: 'забивка сваи',
};

export function ImpactView({ chrome, store }: { chrome: Chrome; store: ImpStore }) {
  const view = useSyncExternalStore(store.subscribe, () => store.get().view);
  if (view === 'extra')
    return (
      <ExtraScreen
        chrome={chrome}
        host={store.xhost}
        asks={IMPACT_ASKS}
        presets={ALL_PRESETS}
        prefix="im"
        heading="Удар: обратные задачи о соударении шаров"
        lede="Отношение масс, при котором шар после удара останавливается; масса среднего из трёх шаров для наибольшей передачи скорости; углы падения и отражения по отношению скоростей; прицеливание третьего шара."
        mainLabel="соударение тел"
        tabName="Удар"
      />
    );
  return <ImpactViewMain chrome={chrome} store={store} />;
}

function ImpactViewMain({ chrome, store }: { chrome: Chrome; store: ImpStore }) {
  const st = useSyncExternalStore(store.subscribe, store.get);
  const s = st.problem;
  const out = useMemo(() => {
    const r = solveImpact(s);
    return { fig: renderImpact(s, r), doc: impactDoc(s, r, { explain: st.explain }) };
  }, [s, st.explain]);
  const end = (k: string) => () => store.endSession(k);
  const NT = (k: TopNumKey, label: string, neg = true) => (
    <Num key={k} id={`imp-${k}`} label={label} value={s[k]} neg={neg} zero={neg} onType={(v) => store.typeTop(k, v)} onEnd={end(`t:${k}`)} />
  );

  const BodyCard = (i: number, b: ImpBody) => {
    const NB = (k: BodyNumKey, label: string, neg = true) => (
      <Num key={k} id={`imp${i + 1}-${k}`} label={label} value={b[k]} neg={neg} zero={neg} onType={(v) => store.typeBody(i, k, v)} onEnd={end(`b${i}:${k}`)} />
    );
    return (
      <div className="imp-body" id={`imp-b${i + 1}`}>
        <h2>Тело {i + 1}</h2>
        <div className="cgpar cg0">
          <label className="sfield">
            <span>название</span>
            <span className="inp">
              <input type="text" value={b.name} onChange={(e) => store.typeBodyName(i, e.target.value)} onBlur={end(`b${i}:name`)} />
            </span>
          </label>
          <label className="sfield imp-wide">
            <span>вид</span>
            <select id={`imp${i + 1}-kind`} value={b.kind} onChange={(e) => store.setKind(i, e.target.value as BodyKind)}>
              {(Object.keys(KIND_T) as BodyKind[]).map((k) => (
                <option key={k} value={k}>
                  {KIND_T[k]}
                </option>
              ))}
            </select>
          </label>
        </div>
        {b.kind !== 'wall' && (
          <>
            <div className="cgpar cg0">
              {NB('m', s.byWeight ? 'вес' : 'масса', false)}
              <label className="sfield imp-wide">
                <span>инерция</span>
                <select id={`imp${i + 1}-inertia`} value={b.inertia} onChange={(e) => store.setInertia(i, e.target.value as Inertia)}>
                  {INERTIA_OF[b.kind].map((k) => (
                    <option key={k} value={k}>
                      {INERTIA_T[k]}
                    </option>
                  ))}
                </select>
              </label>
              {(b.inertia === 'JC' || b.inertia === 'JO') && NB('J', b.inertia === 'JC' ? 'J_C' : 'J_O', false)}
              {(b.inertia === 'rhoC' || b.inertia === 'rhoO') && NB('rho', 'ρ, м', false)}
              {b.inertia === 'rod' && NB('L', 'длина L, м', false)}
              {(b.inertia === 'disk' || b.inertia === 'ring' || b.inertia === 'sphere') && NB('R', 'радиус R, м', false)}
              {b.inertia === 'rect' && (
                <>
                  {NB('a', 'a, м', false)}
                  {NB('b', 'b, м', false)}
                </>
              )}
              {(b.inertia === 'rod' || b.inertia === 'rect') && NB('th', 'угол оси, °')}
              {NB('cx', 'C: x, м')}
              {NB('cy', 'C: y, м')}
              {b.kind === 'axis' && (
                <>
                  {NB('ox', 'O: x, м')}
                  {NB('oy', 'O: y, м')}
                </>
              )}
            </div>
            <div className="cgpar cg0">
              <label className="sfield imp-wide">
                <span>до удара</span>
                <select id={`imp${i + 1}-before`} value={b.before} onChange={(e) => store.setBefore(i, e.target.value as Before)}>
                  {BEFORE_OF[b.kind].map((k) => (
                    <option key={k} value={k}>
                      {BEFORE_T[k]}
                    </option>
                  ))}
                </select>
              </label>
              {b.before === 'given' && b.kind === 'free' && (
                <>
                  {NB('vx', 'v_x, м/с')}
                  {NB('vy', 'v_y, м/с')}
                  {b.inertia !== 'point' && NB('omega', 'ω, рад/с')}
                </>
              )}
              {b.before === 'given' && b.kind === 'axis' && NB('omega', 'ω, рад/с')}
              {b.before === 'fall' && NB('h', 'h, м', false)}
              {b.before === 'thread' && (
                <>
                  {NB('l', 'нить l, м', false)}
                  {NB('ang', 'угол α₀, °')}
                </>
              )}
              {b.before === 'swing' && NB('ang', 'поворот φ₀, °')}
            </div>
            <div className="cgpar cg0">
              <label className="sfield imp-wide">
                <span>после удара</span>
                <select id={`imp${i + 1}-after`} value={b.after} onChange={(e) => store.setAfter(i, e.target.value as After)}>
                  {AFTER_OF[b.kind].map((k) => (
                    <option key={k} value={k}>
                      {AFTER_T[k]}
                    </option>
                  ))}
                </select>
              </label>
              {b.after === 'thread' && NB('l', 'нить l, м', false)}
              {b.after === 'slide' && NB('f', 'трение f', false)}
              {b.after === 'spring' && NB('c', 'жёсткость c', false)}
              {b.after === 'pile' && NB('delta', 'δ за удар, м', false)}
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="wrap">
        {chrome.tabs}
        <header className="top">
          <div>
            <h1>Удар</h1>
            <p className="lede">
              Соударение двух тел — свободных, на неподвижной оси или о преграду: ударный импульс, скорости после удара, импульсы осей и центр удара, потеря
              энергии (теорема Карно), движение после удара; обратные задачи.
            </p>
          </div>
          <div className="topright">
            <label className="preset">
              Готовая задача
              <select id="imppreset" value={st.preset} onChange={(e) => store.loadPreset(e.target.value as ImpPresetKey | ImpExtraKey)}>
                <PresetOptions items={taskEntries(ALL_PRESETS)} />
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
            <span className="hint">Оси: x вправо, y вверх; нормаль n — от тела 1 к телу 2, угол — от оси x.</span>
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
            <svg id="impsvg" className="sketch" viewBox={out.fig.viewBox} role="img" aria-label="Схема" dangerouslySetInnerHTML={{ __html: out.fig.svg }} />
          </div>
        </section>
        <div className="cols">
          <section className="panel conv" aria-label="Данные">
            <div className="segbtns">
              <button type="button" id="imto-extra" onClick={() => store.xhost.setView('extra')}>
                Обратные задачи о соударении шаров →
              </button>
            </div>
            <h2>Задача</h2>
            <label className="field">
              <span>Что ищем</span>
              <select id="impask" value={s.ask} onChange={(e) => store.setAsk(e.target.value as ImpProblem['ask'])}>
                <option value="after">скорости после удара</option>
                <option value="v1">скорость тела 1 по повороту после удара</option>
                <option value="k">коэффициент k по отскоку</option>
              </select>
            </label>
            {s.ask !== 'after' && (
              <div className="cgpar cg0">
                <label className="sfield imp-wide">
                  <span>по чему</span>
                  <select id="imptarget" value={s.target} onChange={(e) => store.setTarget(e.target.value as ImpProblem['target'])}>
                    {s.ask === 'v1' ? (
                      <>
                        <option value="angle">угол поворота</option>
                        <option value="tip">опрокидывание</option>
                      </>
                    ) : (
                      <>
                        <option value="height">высота отскока</option>
                        <option value="refl">угол отражения</option>
                      </>
                    )}
                  </select>
                </label>
                {!(s.ask === 'v1' && s.target === 'tip') &&
                  NT('tVal', s.target === 'height' ? 'h₂, м' : s.target === 'refl' ? 'β от нормали, °' : 'φ, °', false)}
              </div>
            )}
            <label className="toggle">
              <input type="checkbox" checked={s.byWeight} onChange={(e) => store.setFlag('byWeight', e.target.checked)} />
              Заданы веса (m = P/g)
            </label>
            {BodyCard(0, s.b1)}
            {BodyCard(1, s.b2)}
            <h2>Удар</h2>
            <div className="cgpar cg0">
              {NT('px', 'P: x, м')}
              {NT('py', 'P: y, м')}
              {NT('nAng', 'нормаль n, °')}
              {NT('k', 'k (0…1)')}
              <label className="sfield imp-wide">
                <span>контакт</span>
                <select id="impcontact" value={s.contact} onChange={(e) => store.setContact(e.target.value as ImpProblem['contact'])}>
                  <option value="smooth">гладкий</option>
                  <option value="rough">без проскальзывания</option>
                </select>
              </label>
              {NT('g', 'g, м/с²', false)}
            </div>
            <label className="toggle">
              <input type="checkbox" id="impstick" checked={s.stick} onChange={(e) => store.setFlag('stick', e.target.checked)} />
              Тело 1 остаётся в теле 2 (снаряд в маятнике; k = 0)
            </label>
            <p className="empty">
              P — точка удара; нормаль n направлена от тела 1 к телу 2. Тело на оси «падает, повёрнутое на φ₀»: отпущено без скорости в положении, повёрнутом на
              φ₀ (против часовой — «+») от положения удара.
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
            <div id="impsolution">
              <DocView doc={out.doc} />
            </div>
          </section>
        </div>
      </div>
      <article className="print-report" aria-hidden="true">
        <header className="pr-head">
          <h1>{st.title}</h1>
          <p>Удар · {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
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
