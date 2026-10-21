/** Экран «Тело с неподвижной точкой»: схема в плоскости осей, углы Эйлера, сложение вращений и поступательных движений. */
import { useMemo, useState, useSyncExternalStore } from 'react';
import type { Chrome } from '../../../app/module';
import { DocView } from '../../../shared/ui/DocView';
import { LawField } from '../../../shared/ui/LawField';
import { Notice } from '../../../shared/ui/Notice';
import { Num } from '../../../shared/ui/Num';
import { PresetOptions } from '../../../shared/ui/PresetOptions';
import { taskEntries } from '../../../shared/tasks';
import { RedoIcon, UndoIcon } from '../../frames/ui/icons';
import { renderCalc } from '../draw/calc';
import { renderEuler, renderScheme, renderScrew } from '../draw/fixedpoint';
import { BODY, SEQS, seqOf, solveEuler, type Ax, type Seq } from '../model/euler';
import { LEN, LIMITS, solveScheme, type InputKind, type LenUnit, type PointKind, type RateUnit } from '../model/scheme';
import { CALC_FIELDS, CALC_KINDS, solveCalc, type CalcKind } from '../model/calc';
import { SCREW_LIMITS, solveScrew } from '../model/screw';
import { FP_PRESETS, type FpMode, type FpPresetKey } from '../presets';
import { calcDoc } from '../text/calc';
import { eulerDoc, schemeDoc, screwDoc } from '../text/solution';
import type { FpStore } from './store';

const UNIT_T: Record<LenUnit, string> = { m: 'метры', cm: 'сантиметры', mm: 'миллиметры' };
const PK_T: Record<PointKind, string> = { xy: 'координаты x, y', polar: 'от начала: r, угол', axis: 'от оси звена', cross: 'расстояния до двух осей' };
const IK_T: Record<InputKind, string> = { rel: 'угловая скорость звена', speed: 'скорость точки (по z)', acc: 'модуль ускорения точки' };
const RU_T: Record<RateUnit, string> = { rad: 'с⁻¹', rpm: 'об/мин', period: 'период T, с' };

/** Текстовое поле названия: меняется сразу, история — одной записью до потери фокуса. */
function NameField({ id, label, value, onType, onEnd }: { id: string; label: string; value: string; onType: (s: string) => void; onEnd: () => void }) {
  const [text, setText] = useState<string | null>(null);
  return (
    <label className="sfield">
      <span>{label}</span>
      <span className="inp">
        <input
          id={id}
          type="text"
          spellCheck={false}
          value={text ?? value}
          onChange={(e) => {
            setText(e.target.value);
            onType(e.target.value);
          }}
          onBlur={() => {
            setText(null);
            onEnd();
          }}
        />
      </span>
    </label>
  );
}

export function FixedView({ chrome, store }: { chrome: Chrome; store: FpStore }) {
  const st = useSyncExternalStore(store.subscribe, store.get);
  const s = st.problem;
  const out = useMemo(() => {
    if (s.mode === 'scheme') {
      const r = solveScheme(s.scheme);
      return { fig: renderScheme(s.scheme, r), doc: schemeDoc(s.scheme, r, { explain: st.explain }) };
    }
    if (s.mode === 'euler') {
      const r = solveEuler(s.euler);
      return { fig: renderEuler(s.euler, r), doc: eulerDoc(s.euler, r, { explain: st.explain }) };
    }
    if (s.mode === 'calc') {
      const r = solveCalc(s.calc);
      return { fig: renderCalc(r), doc: calcDoc(s.calc, r, { explain: st.explain }) };
    }
    const r = solveScrew(s.screw);
    return { fig: renderScrew(s.screw, r), doc: screwDoc(s.screw, r, { explain: st.explain }) };
  }, [s, st.explain]);
  const end = (k: string) => () => store.endSession(k);
  const S = s.scheme;
  const L = LEN[S.unit];
  const bodyOpts = (zero?: string) => (
    <>
      {zero && <option value={0}>{zero}</option>}
      {S.bodies.map((b) => (
        <option key={b.id} value={b.id}>
          {b.name}
        </option>
      ))}
    </>
  );
  const ptOpts = (
    <>
      <option value={0}>—</option>
      {S.points.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </>
  );
  const E = s.euler;
  const info = seqOf(E);
  const W = s.screw;
  const hint =
    s.mode === 'scheme'
      ? 'Плоскость осей: x — вправо, y — вверх, z — на нас.'
      : s.mode === 'euler'
        ? 'Оси Oξηζ неподвижны, Oxyz связаны с телом.'
        : s.mode === 'calc'
          ? (CALC_KINDS.find((k) => k.kind === s.calc.kind)?.hint ?? '')
          : 'Вращения и поступательные движения тела в данный момент.';

  return (
    <>
      <div className="wrap">
        {chrome.tabs}
        <header className="top">
          <div>
            <h1>Тело с неподвижной точкой</h1>
            <p className="lede">
              Сложение вращений вокруг пересекающихся осей: катящиеся конусы, бегуны, конические передачи и дифференциалы; мгновенная ось, аксоиды, ω и ε тела,
              скорости и ускорения точек. Углы Эйлера и кинематические формулы Эйлера; сложение вращений и поступательных движений — кинематический винт.
            </p>
          </div>
          <div className="topright">
            <label className="preset">
              Готовая задача
              <select id="fppreset" value={st.preset} onChange={(e) => store.loadPreset(e.target.value as FpPresetKey)}>
                <PresetOptions items={taskEntries(FP_PRESETS)} />
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
            <span className="hint">{hint}</span>
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
            <svg id="fpsvg" className="sketch" viewBox={out.fig.viewBox} role="img" aria-label="Схема" dangerouslySetInnerHTML={{ __html: out.fig.svg }} />
          </div>
        </section>
        <div className="cols">
          <section className="panel conv" aria-label="Данные">
            <h2>Задача</h2>
            <label className="field">
              <span>Что решаем</span>
              <select id="fpmode" value={s.mode} onChange={(e) => store.setMode(e.target.value as FpMode)}>
                <option value="scheme">сложение вращений: схема в плоскости осей</option>
                <option value="euler">углы Эйлера и кинематические формулы Эйлера</option>
                <option value="screw">вращения и поступательные движения — винт</option>
                <option value="calc">задачи по формулам: Земля, гироскоп, Кардан, поворот</option>
              </select>
            </label>
            {s.mode === 'scheme' && (
              <>
                <label className="field">
                  <span>Длины</span>
                  <select id="fpunit" value={S.unit} onChange={(e) => store.setUnit(e.target.value as LenUnit)}>
                    {(Object.keys(UNIT_T) as LenUnit[]).map((u) => (
                      <option key={u} value={u}>
                        {UNIT_T[u]}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="fp-sub">Звенья: ось — точка (x, y) и угол к оси x</p>
                <div className="fp-list" id="fpbodies">
                  {S.bodies.map((b) => (
                    <div key={b.id}>
                      <div className="fp-row">
                        <NameField id={`fp-bn${b.id}`} label="звено" value={b.name} onType={(v) => store.nameBody(b.id, v)} onEnd={end(`b:${b.id}:name`)} />
                        <label className="sfield">
                          <span>вращается относительно</span>
                          <select value={b.parent} onChange={(e) => store.setParent(b.id, +e.target.value)}>
                            <option value={0}>стойки</option>
                            {S.bodies
                              .filter((x) => x.id !== b.id)
                              .map((x) => (
                                <option key={x.id} value={x.id}>
                                  {x.name}
                                </option>
                              ))}
                          </select>
                        </label>
                        <button type="button" className="del" aria-label="Убрать звено" onClick={() => store.removeBody(b.id)}>
                          ×
                        </button>
                      </div>
                      <div className="cgpar">
                        <Num
                          id={`fp-bx${b.id}`}
                          label={`x, ${L}`}
                          value={b.x}
                          neg
                          zero
                          onType={(v) => store.typeBody(b.id, 'x', v)}
                          onEnd={end(`b:${b.id}:x`)}
                        />
                        <Num
                          id={`fp-by${b.id}`}
                          label={`y, ${L}`}
                          value={b.y}
                          neg
                          zero
                          onType={(v) => store.typeBody(b.id, 'y', v)}
                          onEnd={end(`b:${b.id}:y`)}
                        />
                        <Num
                          id={`fp-ba${b.id}`}
                          label="угол оси, °"
                          value={b.ang}
                          neg
                          zero
                          onType={(v) => store.typeBody(b.id, 'ang', v)}
                          onEnd={end(`b:${b.id}:ang`)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="segbtns">
                  <button type="button" id="fp-addbody" disabled={S.bodies.length >= LIMITS.bodies} onClick={store.addBody}>
                    + звено
                  </button>
                </div>
                <p className="fp-sub">Точки: касания и точки звеньев</p>
                <div className="fp-list" id="fppoints">
                  {S.points.map((p) => (
                    <div key={p.id}>
                      <div className="fp-row">
                        <NameField id={`fp-pn${p.id}`} label="точка" value={p.name} onType={(v) => store.namePoint(p.id, v)} onEnd={end(`p:${p.id}:name`)} />
                        <label className="sfield">
                          <span>задана</span>
                          <select value={p.k} onChange={(e) => store.setPoint(p.id, 'k', e.target.value as PointKind)}>
                            {(Object.keys(PK_T) as PointKind[]).map((k) => (
                              <option key={k} value={k}>
                                {PK_T[k]}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button type="button" className="del" aria-label="Убрать точку" onClick={() => store.removePoint(p.id)}>
                          ×
                        </button>
                      </div>
                      <div className="cgpar">
                        {(p.k === 'axis' || p.k === 'cross') && (
                          <label className="sfield">
                            <span>{p.k === 'axis' ? 'ось звена' : 'ось 1'}</span>
                            <select value={p.b1} onChange={(e) => store.setPoint(p.id, 'b1', +e.target.value)}>
                              {bodyOpts('—')}
                            </select>
                          </label>
                        )}
                        <Num
                          id={`fp-pu${p.id}`}
                          label={p.k === 'xy' ? `x, ${L}` : p.k === 'polar' ? `r, ${L}` : p.k === 'axis' ? `вдоль, ${L}` : `до оси 1, ${L}`}
                          value={p.u}
                          neg
                          zero
                          onType={(v) => store.typePoint(p.id, 'u', v)}
                          onEnd={end(`p:${p.id}:u`)}
                        />
                        {p.k === 'cross' && (
                          <label className="sfield">
                            <span>ось 2</span>
                            <select value={p.b2} onChange={(e) => store.setPoint(p.id, 'b2', +e.target.value)}>
                              {bodyOpts('—')}
                            </select>
                          </label>
                        )}
                        <Num
                          id={`fp-pv${p.id}`}
                          label={p.k === 'xy' ? `y, ${L}` : p.k === 'polar' ? 'угол, °' : p.k === 'axis' ? `поперёк, ${L}` : `до оси 2, ${L}`}
                          value={p.v}
                          neg
                          zero
                          onType={(v) => store.typePoint(p.id, 'v', v)}
                          onEnd={end(`p:${p.id}:v`)}
                        />
                        <Num
                          id={`fp-pz${p.id}`}
                          label={`z, ${L}`}
                          value={p.z}
                          neg
                          zero
                          onType={(v) => store.typePoint(p.id, 'z', v)}
                          onEnd={end(`p:${p.id}:z`)}
                        />
                        <label className="sfield">
                          <span>v и a звена</span>
                          <select value={p.body} onChange={(e) => store.setPoint(p.id, 'body', +e.target.value)}>
                            {bodyOpts('не считать')}
                          </select>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="segbtns">
                  <button type="button" id="fp-addpt" disabled={S.points.length >= LIMITS.points} onClick={store.addPoint}>
                    + точка
                  </button>
                </div>
                <p className="fp-sub">Касания: качение без скольжения, зацепление</p>
                <div className="fp-list" id="fpcontacts">
                  {S.contacts.map((c, i) => (
                    <div key={i} className="cgpar cg0 fp-ct">
                      <label className="sfield">
                        <span>звено</span>
                        <select value={c.a} onChange={(e) => store.setContact(i, 'a', +e.target.value)}>
                          {bodyOpts('—')}
                        </select>
                      </label>
                      <label className="sfield">
                        <span>с чем</span>
                        <select value={c.b} onChange={(e) => store.setContact(i, 'b', +e.target.value)}>
                          {bodyOpts('неподвижное')}
                        </select>
                      </label>
                      <label className="sfield">
                        <span>в точке</span>
                        <select value={c.p} onChange={(e) => store.setContact(i, 'p', +e.target.value)}>
                          {ptOpts}
                        </select>
                      </label>
                      <button type="button" className="del" aria-label="Убрать касание" onClick={() => store.removeContact(i)}>
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <div className="segbtns">
                  <button type="button" id="fp-addct" disabled={S.contacts.length >= LIMITS.contacts} onClick={store.addContact}>
                    + касание
                  </button>
                </div>
                <p className="fp-sub">Задано</p>
                <div className="fp-list" id="fpinputs">
                  {S.inputs.map((x, i) => (
                    <div key={i}>
                      <div className="fp-row">
                        <label className="sfield">
                          <span>величина</span>
                          <select value={x.kind} onChange={(e) => store.setInput(i, 'kind', e.target.value as InputKind)}>
                            {(Object.keys(IK_T) as InputKind[]).map((k) => (
                              <option key={k} value={k}>
                                {IK_T[k]}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="sfield">
                          <span>звено</span>
                          <select value={x.body} onChange={(e) => store.setInput(i, 'body', +e.target.value)}>
                            {bodyOpts('—')}
                          </select>
                        </label>
                        <button type="button" className="del" aria-label="Убрать условие" onClick={() => store.removeInput(i)}>
                          ×
                        </button>
                      </div>
                      <div className="cgpar">
                        {x.kind !== 'rel' && (
                          <label className="sfield">
                            <span>точка</span>
                            <select value={x.p} onChange={(e) => store.setInput(i, 'p', +e.target.value)}>
                              {ptOpts}
                            </select>
                          </label>
                        )}
                        <Num
                          id={`fp-iv${i}`}
                          label={x.kind === 'rel' ? 'ω (отн.)' : x.kind === 'speed' ? `v_z, ${L}/с` : `|a|, ${L}/с²`}
                          value={x.val}
                          neg
                          zero
                          onType={(v) => store.typeInput(i, 'val', v)}
                          onEnd={end(`i:${i}:val`)}
                        />
                        {x.kind === 'rel' && (
                          <label className="sfield">
                            <span>единица</span>
                            <select value={x.unit} onChange={(e) => store.setInput(i, 'unit', e.target.value as RateUnit)}>
                              {(Object.keys(RU_T) as RateUnit[]).map((u) => (
                                <option key={u} value={u}>
                                  {RU_T[u]}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}
                        {x.kind !== 'acc' && (
                          <Num
                            id={`fp-id${i}`}
                            label={x.kind === 'rel' ? 'ε, с⁻²' : `dv/dt, ${L}/с²`}
                            value={x.d}
                            neg
                            zero
                            onType={(v) => store.typeInput(i, 'd', v)}
                            onEnd={end(`i:${i}:d`)}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="segbtns">
                  <button type="button" id="fp-addin" disabled={S.inputs.length >= LIMITS.inputs} onClick={store.addInput}>
                    + условие
                  </button>
                </div>
                <p className="empty">
                  Звено вращается относительно своего «родителя» вокруг оси, лежащей в плоскости чертежа: стойка — неподвижна, водило несёт оси сателлитов.
                  Точку касания удобно задавать расстояниями до осей двух звеньев (радиусами колёс, со знаком: плюс — слева от направления оси). Сколько
                  неизвестных угловых скоростей, столько нужно касаний и заданных величин.
                </p>
              </>
            )}
            {s.mode === 'euler' && (
              <>
                <label className="field">
                  <span>Последовательность поворотов</span>
                  <select id="fpseq" value={E.seq} onChange={(e) => store.setSeq(e.target.value as Seq)}>
                    {(Object.keys(SEQS) as Exclude<Seq, 'custom'>[]).map((k) => (
                      <option key={k} value={k}>
                        {SEQS[k].title}
                      </option>
                    ))}
                    <option value="custom">своя: оси трёх поворотов</option>
                  </select>
                </label>
                {E.seq === 'custom' && (
                  <div className="cgpar cg0">
                    {(['a1', 'a2', 'a3'] as const).map((k, i) => (
                      <label key={k} className="sfield">
                        <span>поворот {i + 1}</span>
                        <select value={E[k]} onChange={(e) => store.setAxis(k, +e.target.value as Ax)}>
                          {([1, 2, 3] as Ax[]).map((a) => (
                            <option key={a} value={a}>
                              вокруг {BODY[a - 1]}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                )}
                <div className="cgpar cg0">
                  {(['q1', 'q2', 'q3'] as const).slice(0, info.axes.length).map((k, i) => (
                    <LawField
                      key={k}
                      id={`fp-${k}`}
                      label={`${info.names[i]}(t), рад`}
                      value={E[k]}
                      onType={(v) => store.lawEuler(k, v)}
                      onEnd={end(`e:${k}`)}
                    />
                  ))}
                  <Num id="fp-t1" label="t₁, с" value={E.t1} neg zero onType={(v) => store.typeEuler('t1', v)} onEnd={end('e:t1')} />
                </div>
                <p className="fp-sub">Точка M в осях тела (если нужна её скорость)</p>
                <div className="cgpar cg0">
                  {(['mx', 'my', 'mz'] as const).map((k, i) => (
                    <Num
                      key={k}
                      id={`fp-${k}`}
                      label={`${BODY[i]}, ${LEN[E.unit]}`}
                      value={E[k]}
                      neg
                      zero
                      onType={(v) => store.typeEuler(k, v)}
                      onEnd={end(`e:${k}`)}
                    />
                  ))}
                  <label className="sfield">
                    <span>длины</span>
                    <select value={E.unit} onChange={(e) => store.setEulerUnit(e.target.value as LenUnit)}>
                      {(Object.keys(UNIT_T) as LenUnit[]).map((u) => (
                        <option key={u} value={u}>
                          {LEN[u]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <p className="empty">
                  Углы — формулы от t в радианах (π, sin, cos…): например «π/2 − 2t», «0,1 sin t». Первый поворот — вокруг неподвижной оси, следующие — вокруг
                  повёрнутых осей.
                </p>
              </>
            )}
            {s.mode === 'calc' && (
              <>
                <label className="field">
                  <span>Задача</span>
                  <select id="fpckind" value={s.calc.kind} onChange={(e) => store.setCalcKind(e.target.value as CalcKind)}>
                    {CALC_KINDS.map((k) => (
                      <option key={k.kind} value={k.kind}>
                        {k.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="cgpar" id="fpcalc">
                  {CALC_FIELDS[s.calc.kind].map((fl) => (
                    <Num
                      key={fl.key}
                      id={`fp-c-${fl.key}`}
                      label={fl.unit ? `${fl.label}, ${fl.unit}` : fl.label}
                      value={s.calc.p[fl.key]}
                      neg={fl.neg}
                      zero
                      onType={(v) => store.typeCalc(fl.key, v)}
                      onEnd={end(`c:${fl.key}`)}
                    />
                  ))}
                </div>
              </>
            )}
            {s.mode === 'screw' && (
              <>
                <label className="field">
                  <span>Длины</span>
                  <select id="fpsunit" value={W.unit} onChange={(e) => store.setScrewUnit(e.target.value as LenUnit)}>
                    {(Object.keys(UNIT_T) as LenUnit[]).map((u) => (
                      <option key={u} value={u}>
                        {UNIT_T[u]}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="fp-list" id="fpitems">
                  {W.items.map((it, i) => (
                    <div key={i}>
                      <div className="cvrow cvrow2">
                        <span className="hint">{it.kind === 'rot' ? `вращение ${i + 1}` : `поступательное ${i + 1}`}</span>
                        <span className="hint">{it.kind === 'rot' ? 'вектор ω, с⁻¹, и точка оси' : `скорость, ${LEN[W.unit]}/с`}</span>
                        <button type="button" className="del" aria-label="Убрать движение" onClick={() => store.removeItem(i)}>
                          ×
                        </button>
                      </div>
                      <div className="cgpar">
                        {(['x', 'y', 'z'] as const).map((k) => (
                          <Num
                            key={k}
                            id={`fp-w${k}${i}`}
                            label={`${it.kind === 'rot' ? 'ω' : 'v'}${k}`}
                            value={it[k]}
                            neg
                            zero
                            onType={(v) => store.typeItem(i, k, v)}
                            onEnd={end(`w:${i}:${k}`)}
                          />
                        ))}
                        {it.kind === 'rot' &&
                          (['px', 'py', 'pz'] as const).map((k) => (
                            <Num
                              key={k}
                              id={`fp-w${k}${i}`}
                              label={`A${k[1]}`}
                              value={it[k]}
                              neg
                              zero
                              onType={(v) => store.typeItem(i, k, v)}
                              onEnd={end(`w:${i}:${k}`)}
                            />
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="segbtns">
                  <button type="button" id="fp-addrot" disabled={W.items.length >= SCREW_LIMITS.items} onClick={() => store.addItem('rot')}>
                    + вращение
                  </button>
                  <button type="button" id="fp-addtr" disabled={W.items.length >= SCREW_LIMITS.items} onClick={() => store.addItem('tr')}>
                    + поступательное
                  </button>
                </div>
                <p className="fp-sub">Точки тела</p>
                <div className="fp-list" id="fpspoints">
                  {W.points.map((p, i) => (
                    <div key={i} className="cgpar cg0 fp-ct fp-ct4">
                      <NameField id={`fp-sn${i}`} label="точка" value={p.name} onType={(v) => store.nameScrewPoint(i, v)} onEnd={end(`wp:${i}:name`)} />
                      {(['x', 'y', 'z'] as const).map((k) => (
                        <Num
                          key={k}
                          id={`fp-s${k}${i}`}
                          label={k}
                          value={p[k]}
                          neg
                          zero
                          onType={(v) => store.typeScrewPoint(i, k, v)}
                          onEnd={end(`wp:${i}:${k}`)}
                        />
                      ))}
                      <button type="button" className="del" aria-label="Убрать точку" onClick={() => store.removeScrewPoint(i)}>
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <div className="segbtns">
                  <button type="button" id="fp-addspt" disabled={W.points.length >= SCREW_LIMITS.points} onClick={store.addScrewPoint}>
                    + точка
                  </button>
                </div>
                <p className="empty">
                  Вращение задаётся вектором угловой скорости (ωx, ωy, ωz) и точкой A на его оси. Пара равных противоположных вращений даёт поступательное
                  движение.
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
            <div id="fpsolution">
              <DocView doc={out.doc} />
            </div>
          </section>
        </div>
      </div>
      <article className="print-report" aria-hidden="true">
        <header className="pr-head">
          <h1>{st.title}</h1>
          <p>Тело с неподвижной точкой · {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </header>
        <section className="pr-sec pr-figs">
          <figure>
            <svg viewBox={out.fig.viewBox} dangerouslySetInnerHTML={{ __html: out.fig.svg }} />
            <figcaption>
              {s.mode === 'scheme' ? 'Схема в плоскости осей' : s.mode === 'euler' ? 'Оси в момент t₁' : s.mode === 'calc' ? 'Результат' : 'Движения тела'}
            </figcaption>
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
