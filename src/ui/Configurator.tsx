/** Конфигуратор: участки, опоры, нагрузки, карточки элементов, «Что найти» — как в прототипе. */
import { useEffect, useState } from 'react';
import { DGL, LOADDIR, REFS, SIDES } from '../model/constants';
import { fmt, parseNum } from '../model/format';
import { distGeom, type Geom } from '../model/geometry';
import type { Dir, Item, ItemType, LoadDir } from '../model/types';
import type { Model } from '../solver/model';
import { forceCalcText, itemTitle, sizeText } from '../text/labels';
import { InlineView } from './DocView';
import { LOAD_ICONS, SUPPORT_ICONS } from './icons';
import { NumField } from './NumField';
import { useStore } from './useStore';

const nodeLabel = (g: Geom, id: string) => `${g.name[id]} (${fmt(g.pos[id][0], 2)}; ${fmt(g.pos[id][1], 2)})`;

/** Секция видна в полном редакторе и на своих шагах мастера (на шаге 5 — все). */
function useStepVisible(steps: number[]) {
  const [st] = useStore();
  return !st.wiz.on || st.wiz.step >= 5 || steps.includes(st.wiz.step);
}

function Segments({ model }: { model: Model }) {
  const [st, store] = useStore();
  const g = model.g;
  const n = st.s.segs.length;
  return (
    <div id="segs">
      {g.segOrder.map((s) => {
        const name = `${g.name[s.a]}–${g.name[s.b]}`;
        return (
          <div className="segrow" key={s.id}>
            <span className="segname">{name}</span>
            <select
              className="dirsel"
              data-segdir={s.id}
              value={s.dir}
              aria-label={`Направление участка ${name}`}
              onChange={(e) => store.setSegDir(s.id, e.target.value as Dir)}
            >
              {(['r', 'l', 'u', 'd'] as Dir[]).map((d) => (
                <option key={d} value={d}>
                  {DGL[d]}
                </option>
              ))}
            </select>
            <NumField
              value={s.len}
              data={{ 'data-seg': s.id }}
              unit="м"
              label={`Длина участка ${name}`}
              onValue={(v) => (isNaN(v) || v <= 0 || v > 1000 ? false : store.typeSegLen(s.id, v))}
              onBlur={() => store.endSession('seg:' + s.id)}
            />
            <button type="button" className="mini" data-split={s.id} title="Поставить новую точку посередине участка" onClick={() => store.splitSeg(s.id, s.len / 2)}>
              Разделить
            </button>
            {n > 1 ? (
              <button type="button" className="del" data-segdel={s.id} aria-label="Убрать участок" title="Убрать участок" onClick={() => store.removeSeg(s.id)}>
                ×
              </button>
            ) : (
              <span />
            )}
          </div>
        );
      })}
    </div>
  );
}

function AddSegment({ g }: { g: Geom }) {
  const [, store] = useStore();
  const last = g.order[g.order.length - 1];
  const [from, setFrom] = useState(last);
  const [dir, setDir] = useState<Dir>('u');
  const [len, setLen] = useState('2');
  const [bad, setBad] = useState(false);
  // Точка пропала (или появилась новая схема) — берём последнюю, как прототип.
  const fromId = g.order.includes(from) ? from : last;
  useEffect(() => {
    if (fromId !== from) setFrom(fromId);
  }, [fromId, from]);
  const occupied = g.adj[fromId] || new Set<Dir>();
  // Выбранное направление занято — берём первое свободное из вверх/вниз/вправо/влево и запоминаем его (как прототип).
  const curDir = occupied.has(dir) ? ((['u', 'd', 'r', 'l'] as Dir[]).find((d) => !occupied.has(d)) ?? dir) : dir;
  if (curDir !== dir) setDir(curDir);
  const DN: Record<Dir, string> = { r: 'вправо', l: 'влево', u: 'вверх', d: 'вниз' };
  return (
    <div className="addseg">
      <div className="asrow">
        <label className="field">
          <span>Новый участок от точки</span>
          <select id="asFrom" value={fromId} onChange={(e) => setFrom(e.target.value)}>
            {g.order.map((id) => (
              <option key={id} value={id}>
                {nodeLabel(g, id)}
              </option>
            ))}
          </select>
        </label>
        <div className="field">
          <span>Направление</span>
          <div className="quick">
            {(['r', 'l', 'u', 'd'] as Dir[]).map((d) => (
              <button
                key={d}
                type="button"
                data-asdir={d}
                aria-label={DN[d]}
                disabled={occupied.has(d)}
                aria-pressed={d === curDir ? 'true' : 'false'}
                onClick={() => setDir(d)}
              >
                {DGL[d]}
              </button>
            ))}
          </div>
        </div>
        <label className="field">
          <span>Длина</span>
          <div className="inp">
            <input id="asLen" type="text" inputMode="decimal" className={bad ? 'bad' : undefined} value={len} onChange={(e) => setLen(e.target.value)} />
            <em>м</em>
          </div>
        </label>
      </div>
      <button
        type="button"
        id="asGo"
        className="addbtn"
        onClick={() => {
          const v = parseNum(len);
          const invalid = isNaN(v) || v <= 0 || v > 1000;
          setBad(invalid);
          store.addSeg(fromId, curDir, v);
        }}
      >
        Добавить участок
      </button>
    </div>
  );
}

function Palette({ items, icons }: { items: [ItemType, string][]; icons: Record<string, React.ReactNode> }) {
  const [, store] = useStore();
  return (
    <div className="palette">
      {items.map(([t, label]) => (
        <button key={t} className="pal" type="button" data-add={t} onClick={() => store.addItem(t)}>
          {icons[t]}
          {label}
        </button>
      ))}
    </div>
  );
}

function NodeSelect({ it, f, label, g }: { it: Item; f: 'at' | 'from' | 'to'; label: string; g: Geom }) {
  const [, store] = useStore();
  return (
    <label className="field">
      <span>{label}</span>
      <select data-id={it.id} data-f={f} value={(it as unknown as Record<string, string>)[f]} onChange={(e) => store.setItemField(it.id, f, e.target.value)}>
        {g.order.map((id) => (
          <option key={id} value={id}>
            {nodeLabel(g, id)}
          </option>
        ))}
      </select>
    </label>
  );
}

function Field({ it, f, label, unit, disabled }: { it: Item; f: string; label: string; unit: string; disabled?: boolean }) {
  const [, store] = useStore();
  const key = 'item:' + it.id + ':' + f;
  return (
    <label className="field">
      <span>{label}</span>
      <NumField
        value={(it as unknown as Record<string, number>)[f]}
        data={{ 'data-id': it.id, 'data-f': f }}
        unit={unit}
        disabled={disabled}
        onValue={(v) => store.typeItemField(it.id, f, v)}
        onBlur={() => store.endSession(key)}
      />
    </label>
  );
}

function Select<T extends string>({ it, f, label, options, wide }: { it: Item; f: string; label: string; options: [T, string][]; wide?: boolean }) {
  const [, store] = useStore();
  return (
    <label className={wide ? 'field wide' : 'field'}>
      <span>{label}</span>
      <select data-id={it.id} data-f={f} value={(it as unknown as Record<string, string>)[f]} onChange={(e) => store.setItemField(it.id, f, e.target.value)}>
        {options.map(([v, t]) => (
          <option key={v} value={v}>
            {t}
          </option>
        ))}
      </select>
    </label>
  );
}

function Check({ it, label }: { it: Item & { unknown: boolean }; label: string }) {
  const [, store] = useStore();
  return (
    <label className="chk">
      <input type="checkbox" data-id={it.id} data-f="unknown" checked={it.unknown} onChange={(e) => store.setItemField(it.id, 'unknown', e.target.checked)} /> {label}
    </label>
  );
}

const sideOptions = (tilt: boolean): [string, string][] => [
  ...Object.entries(SIDES).map(([k, s]) => [k, s.name] as [string, string]),
  ...(tilt ? [['tilt', 'наклонная, задать угол'] as [string, string]] : []),
];

function ItemCard({ it, model }: { it: Item; model: Model }) {
  const [st, store] = useStore();
  const g = model.g;
  let fields: React.ReactNode = null;
  const P = it.type !== 'dist' ? <NodeSelect it={it} f="at" label="Точка" g={g} /> : null;
  switch (it.type) {
    case 'fixed':
    case 'pin':
      fields = (
        <>
          {P}
          <Select it={it} f="side" label="Опорная поверхность" options={sideOptions(false)} />
        </>
      );
      break;
    case 'roller':
      fields = (
        <>
          {P}
          <Select it={it} f="side" label="Опорная поверхность" options={sideOptions(true)} />
          {it.side === 'tilt' && <Field it={it} f="angle" label="Угол реакции к оси x" unit="°" />}
        </>
      );
      break;
    case 'rod':
      fields = (
        <>
          {P}
          <Field it={it} f="angle" label="Угол стержня к оси x" unit="°" />
        </>
      );
      break;
    case 'force':
      fields = (
        <>
          {P}
          <Field it={it} f="F" label="Модуль F" unit="кН" disabled={it.unknown} />
          <Field it={it} f="alpha" label="Угол α" unit="°" />
          <Select it={it} f="ref" label="Отсчёт от направления" options={Object.entries(REFS).map(([k, r]) => [k, r.name] as [string, string])} />
          <Select
            it={it}
            f="rot"
            label="Отсчитывать угол"
            options={[
              ['ccw', 'против часовой'],
              ['cw', 'по часовой'],
            ]}
          />
          <div className="field">
            <span>Без угла</span>
            <div className="quick">
              {(
                [
                  ['down', '↓'],
                  ['up', '↑'],
                  ['right', '→'],
                  ['left', '←'],
                ] as const
              ).map(([k, s]) => (
                <button key={k} type="button" data-dirq={k} data-id={it.id} aria-label={`Сила ${REFS[k].short}`} onClick={() => store.setForceDir(it.id, k)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="calc" data-calc={it.id}>{forceCalcText(it)}</div>
          <Check it={it} label="Модуль неизвестен — найти" />
        </>
      );
      break;
    case 'weight':
      fields = (
        <>
          {P}
          <Field it={it} f="G" label="Вес G" unit="кН" />
        </>
      );
      break;
    case 'moment':
      fields = (
        <>
          {P}
          <Field it={it} f="M" label="Момент M" unit="кН·м" disabled={it.unknown} />
          <Select
            it={it}
            f="dir"
            wide
            label="Направление"
            options={[
              ['ccw', 'против часовой стрелки'],
              ['cw', 'по часовой стрелке'],
            ]}
          />
          <Check it={it} label="Величина неизвестна — найти" />
        </>
      );
      break;
    case 'dist': {
      const dg = distGeom(g, it);
      const dirs: LoadDir[] = !dg.ok ? ['down', 'up', 'right', 'left'] : dg.horiz ? ['down', 'up'] : ['right', 'left'];
      fields = (
        <>
          <NodeSelect it={it} f="from" label="От точки" g={g} />
          <NodeSelect it={it} f="to" label="До точки" g={g} />
          <Field it={it} f="q1" label="q в начале" unit="кН/м" />
          <Field it={it} f="q2" label="q в конце" unit="кН/м" />
          <Select it={it} f="dir" wide label="Нагрузка направлена" options={dirs.map((d) => [d, LOADDIR[d].name] as [string, string])} />
          {!dg.ok && <p className="calc s-bad">Точки должны лежать на одном прямом участке (горизонтальном или вертикальном).</p>}
        </>
      );
      break;
    }
  }
  const sup = it.type === 'fixed' || it.type === 'pin' || it.type === 'roller' || it.type === 'rod';
  return (
    <div className={'item' + (it.id === st.sel ? ' sel' : '')} data-item={it.id} data-kind={sup ? 'sup' : 'load'} onClick={() => store.select(it.id)}>
      <div className="item-head">
        <span data-head={it.id}>{model.labels[it.id] && <InlineView c={itemTitle(model.labels[it.id])} />}</span>
        <button
          type="button"
          className="del"
          data-del={it.id}
          aria-label="Удалить элемент"
          onClick={(e) => {
            e.stopPropagation();
            store.deleteItem(it.id);
          }}
        >
          ×
        </button>
      </div>
      <div className="fields">{fields}</div>
    </div>
  );
}

function Targets({ model }: { model: Model }) {
  const [st, store] = useStore();
  if (!model.unknowns.length) return <div className="targets"><span className="empty">Искомые появятся, когда вы добавите опоры или отметите неизвестную нагрузку.</span></div>;
  return (
    <div className="targets" id="targets">
      {model.unknowns.map((u) => (
        <label className="chip" key={u.key}>
          <input type="checkbox" data-target={u.key} checked={!st.nt.includes(u.key)} onChange={(e) => store.setTarget(u.key, e.target.checked)} />
          <InlineView c={[{ t: 'sym', L: u.L, S: u.S }]} />
        </label>
      ))}
    </div>
  );
}

export function Configurator({ model }: { model: Model }) {
  const [st] = useStore();
  const show1 = useStepVisible([1]),
    show2 = useStepVisible([2]),
    show3 = useStepVisible([3]),
    show23 = useStepVisible([2, 3]),
    show4 = useStepVisible([4]);
  return (
    <section className="panel" aria-label="Конфигуратор">
      <h2>Конфигуратор</h2>
      <div hidden={!show1}>
        <div className="sub">
          Участки конструкции <span className="lentotal">{sizeText(model)}</span>
        </div>
        <Segments model={model} />
        <AddSegment g={model.g} />
        <p className="msg" id="segmsg" role="status" key={st.msg.seq}>
          {st.msg.text}
        </p>
      </div>
      <div hidden={!show2}>
        <div className="sub">Опоры</div>
        <Palette
          icons={SUPPORT_ICONS}
          items={[
            ['fixed', 'Заделка'],
            ['pin', 'Шарнир'],
            ['roller', 'Каток'],
            ['rod', 'Стержень'],
          ]}
        />
      </div>
      <div hidden={!show3}>
        <div className="sub">Нагрузки</div>
        <Palette
          icons={LOAD_ICONS}
          items={[
            ['force', 'Сила'],
            ['weight', 'Груз'],
            ['moment', 'Момент'],
            ['dist', 'Распред.'],
          ]}
        />
      </div>
      <div hidden={!show23}>
        <div className="sub">Элементы на балке</div>
        <div className="items" id="items">
          {st.s.items.length ? (
            st.s.items.map((it) => <ItemCard key={it.id} it={it} model={model} />)
          ) : (
            <p className="empty">На конструкции пока ничего нет. Добавьте опоры и нагрузки кнопками выше.</p>
          )}
        </div>
      </div>
      <div hidden={!show4}>
        <div className="sub">Что найти</div>
        <Targets model={model} />
      </div>
    </section>
  );
}

