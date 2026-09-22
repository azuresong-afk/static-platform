/**
 * Временная страница этапа 1: готовая задача → решение с пояснениями.
 * Чертёж и конфигуратор переносятся на этапе 2.
 */
import { useMemo, useState } from 'react';
import { analyze } from '../core';
import { SIDES } from '../model/constants';
import { fmt } from '../model/format';
import { PRESET_TITLES, loadPreset, type PresetKey } from '../model/presets';
import { STATUS, itemTitle, sizeText } from '../text/labels';
import { DocView, InlineView } from './DocView';

const KEYS = Object.keys(PRESET_TITLES).filter((k) => k !== 'blank') as PresetKey[];

function readBool(key: string, def: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    return v == null ? def : v === '1';
  } catch {
    return def;
  }
}
function writeBool(key: string, v: boolean) {
  try {
    localStorage.setItem(key, v ? '1' : '0');
  } catch {
    /* хранилище недоступно — настройка просто не запомнится */
  }
}

export function App() {
  const [preset, setPreset] = useState<PresetKey>('simple');
  const [explain, setExplain] = useState(() => readBool('statika.explain', true));
  const [notTarget, setNotTarget] = useState<Set<string>>(new Set());

  const structure = useMemo(() => loadPreset(preset), [preset]);
  const a = useMemo(() => analyze(structure, { notTarget, explain }), [structure, notTarget, explain]);
  const { model, solution } = a;
  const st = STATUS[solution.status];

  return (
    <div className="wrap">
      <header className="top">
        <div>
          <h1>Статика: балки и рамы</h1>
          <p className="lede">Уравнения равновесия составляются, решаются и проверяются автоматически, с пояснением каждого шага.</p>
        </div>
        <label className="preset">
          Готовая задача
          <select
            value={preset}
            onChange={(e) => {
              setPreset(e.target.value as PresetKey);
              setNotTarget(new Set());
            }}
          >
            {KEYS.map((k) => (
              <option key={k} value={k}>
                {PRESET_TITLES[k]}
              </option>
            ))}
          </select>
        </label>
      </header>

      <div className="cols">
        <section className="panel" aria-label="Схема">
          <h2>Схема</h2>
          <p className="stage-note">Чертёж и редактор появятся на этапе 2. Пока — описание расчётной схемы.</p>
          <div className="sub">
            Точки <span className="lentotal">{sizeText(model)}</span>
          </div>
          <ul className="plain">
            {model.pts.map((p) => (
              <li key={p.id}>
                <span className="segname">{p.name}</span> ({fmt(p.x, 2)}; {fmt(p.y, 2)})
              </li>
            ))}
          </ul>
          <div className="sub">Элементы</div>
          <ul className="plain">
            {structure.items.map((it) => (
              <li key={it.id}>
                <InlineView c={itemTitle(model.labels[it.id])} />
                <span className="hint">{describe(it)}</span>
              </li>
            ))}
          </ul>
          <div className="sub">Что найти</div>
          <div className="targets">
            {model.unknowns.map((u) => (
              <label className="chip" key={u.key}>
                <input
                  type="checkbox"
                  checked={!notTarget.has(u.key)}
                  onChange={(e) => {
                    const n = new Set(notTarget);
                    if (e.target.checked) n.delete(u.key);
                    else n.add(u.key);
                    setNotTarget(n);
                  }}
                />
                <InlineView c={[{ t: 'sym', L: u.L, S: u.S }]} />
              </label>
            ))}
          </div>
        </section>

        <section className="panel" aria-label="Решение">
          <div className="sol-head">
            <h2>Решение</h2>
            <label className="toggle">
              <input
                type="checkbox"
                checked={explain}
                onChange={(e) => {
                  setExplain(e.target.checked);
                  writeBool('statika.explain', e.target.checked);
                }}
              />
              Подробные пояснения
            </label>
          </div>
          <p className="status">
            Система <span className={st[1].replace('b-', 's-')}>{st[0]}</span>
          </p>
          <DocView doc={a.doc} />
        </section>
      </div>
    </div>
  );
}

function describe(it: (ReturnType<typeof loadPreset>)['items'][number]): string {
  switch (it.type) {
    case 'fixed':
    case 'pin':
      return ` — опорная поверхность ${SIDES[it.side].name}`;
    case 'roller':
      return it.side === 'tilt' ? ` — реакция под углом ${fmt(it.angle ?? 90, 2)}°` : ` — опорная поверхность ${SIDES[it.side].name}`;
    case 'rod':
      return ` — угол ${fmt(it.angle, 2)}° к оси x`;
    case 'force':
      return it.unknown ? ' — модуль ищем' : ` = ${fmt(it.F)} кН`;
    case 'weight':
      return ` = ${fmt(it.G)} кН`;
    case 'moment':
      return (it.unknown ? ' — величину ищем' : ` = ${fmt(it.M)} кН·м`) + (it.dir === 'ccw' ? ', против часовой' : ', по часовой');
    case 'dist':
      return it.q1 === it.q2 ? ` = ${fmt(it.q1)} кН/м` : ` = ${fmt(it.q1)}…${fmt(it.q2)} кН/м`;
  }
}
