/** Раздел «Принцип Даламбера» (Мещерский §41–42; Антонов п. 9.10): динамические реакции вращающегося тела; файл проекта. */
import type { Chrome, StatikaModule } from '../../app/module';
import { ShaftStore, DALEMBERT_MODULE } from './ui/store';
import { ShaftView } from './ui/ShaftView';
import { taskEntries } from '../../shared/tasks';
import { SHAFT_PRESETS, type ShaftPresetKey } from './presets';
import { useSyncExternalStore } from 'react';
import { MachinePage } from '../../shared/machines/MachineView';
import { MachineStore, modeStore } from '../../shared/machines/store';
import { KINETO_CATALOG, KINETO_PRESETS } from './machines';

const EXPLAIN_KEY = 'statika.explain';

export function createDalembertModule(): StatikaModule {
  let explain = true;
  try {
    const v = localStorage.getItem(EXPLAIN_KEY);
    explain = v == null ? true : v === '1';
  } catch {
    /* по умолчанию */
  }
  const store = new ShaftStore({ explain });
  store.subscribe(() => {
    try {
      localStorage.setItem(EXPLAIN_KEY, store.get().explain ? '1' : '0');
    } catch {
      /* не запомнится */
    }
  });
  const ms = new MachineStore(KINETO_CATALOG, { explain });
  ms.subscribe(() => {
    try {
      localStorage.setItem(EXPLAIN_KEY, ms.get().explain ? '1' : '0');
    } catch {
      /* не запомнится */
    }
  });
  function Screen({ chrome }: { chrome: Chrome }) {
    const active = useSyncExternalStore(ms.subscribe, () => ms.get().active);
    return active ? <MachinePage chrome={chrome} ms={ms} base="Вращающееся тело" extra={taskEntries(SHAFT_PRESETS)} loadBase={(k) => store.loadPreset(k as ShaftPresetKey)} /> : <ShaftView chrome={chrome} store={store} ms={ms} />;
  }
  return {
    id: DALEMBERT_MODULE,
    tab: 'Принцип Даламбера',
    store: modeStore({ undo: store.undo, redo: store.redo, exportProject: store.exportProject, importProject: store.importProject, notify: store.notify, projectTitle: store.projectTitle }, ms),
    Screen,
    tasks: [...taskEntries(SHAFT_PRESETS), ...taskEntries(KINETO_PRESETS)],
    loadTask: (k) => {
      if (k in KINETO_PRESETS) ms.loadPreset(k);
      else {
        ms.setActive(false);
        store.loadPreset(k as ShaftPresetKey);
      }
    },
  };
}
