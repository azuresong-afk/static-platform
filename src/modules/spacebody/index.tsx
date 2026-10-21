/** Раздел «Пространственное тело» (Мещерский §8): своя модель, шесть уравнений равновесия, файл проекта. */
import type { Chrome, StatikaModule } from '../../app/module';
import { BodyStore, BODY_MODULE } from './ui/store';
import { BodyView } from './ui/BodyView';
import { taskEntries } from '../../shared/tasks';
import { BODY_PRESETS, type BodyPresetKey } from './presets';

const EXPLAIN_KEY = 'statika.explain';

export function createBodyModule(): StatikaModule {
  let explain = true;
  try {
    const v = localStorage.getItem(EXPLAIN_KEY);
    explain = v == null ? true : v === '1';
  } catch {
    /* по умолчанию */
  }
  const store = new BodyStore({ explain });
  store.subscribe(() => {
    try {
      localStorage.setItem(EXPLAIN_KEY, store.get().explain ? '1' : '0');
    } catch {
      /* не запомнится */
    }
  });
  function Screen({ chrome }: { chrome: Chrome }) {
    return <BodyView chrome={chrome} store={store} />;
  }
  return {
    id: BODY_MODULE,
    tab: 'Пространственное тело',
    store: { undo: store.undo, redo: store.redo, exportProject: store.exportProject, importProject: store.importProject, notify: store.notify, projectTitle: store.projectTitle },
    Screen,
    tasks: taskEntries(BODY_PRESETS),
    loadTask: (k) => store.loadPreset(k as BodyPresetKey),
  };
}
