/** Раздел «Вращение тела и передачи» (Мещерский §13–14): угловая скорость и ускорение, передаточные отношения, точка колеса; файл проекта. */
import type { Chrome, StatikaModule } from '../../app/module';
import { GearStore, GEAR_MODULE } from './ui/store';
import { GearView } from './ui/GearView';
import { taskEntries } from '../../shared/tasks';
import { GEAR_PRESETS, type GearPresetKey } from './presets';

const EXPLAIN_KEY = 'statika.explain';

export function createGearModule(): StatikaModule {
  let explain = true;
  try {
    const v = localStorage.getItem(EXPLAIN_KEY);
    explain = v == null ? true : v === '1';
  } catch {
    /* по умолчанию */
  }
  const store = new GearStore({ explain });
  store.subscribe(() => {
    try {
      localStorage.setItem(EXPLAIN_KEY, store.get().explain ? '1' : '0');
    } catch {
      /* не запомнится */
    }
  });
  function Screen({ chrome }: { chrome: Chrome }) {
    return <GearView chrome={chrome} store={store} />;
  }
  return {
    id: GEAR_MODULE,
    tab: 'Вращение и передачи',
    store: { undo: store.undo, redo: store.redo, exportProject: store.exportProject, importProject: store.importProject, notify: store.notify, projectTitle: store.projectTitle },
    Screen,
    tasks: taskEntries(GEAR_PRESETS),
    loadTask: (k) => store.loadPreset(k as GearPresetKey),
  };
}
