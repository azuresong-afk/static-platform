/** Раздел «Вращение тела» (Мещерский §37; Антонов п. 9.2–9.5): уравнение вращения и сохранение кинетического момента; файл проекта. */
import type { Chrome, StatikaModule } from '../../app/module';
import { RotStore, ROT_MODULE } from './ui/store';
import { RotView } from './ui/RotView';

const EXPLAIN_KEY = 'statika.explain';

export function createRotationModule(): StatikaModule {
  let explain = true;
  try {
    const v = localStorage.getItem(EXPLAIN_KEY);
    explain = v == null ? true : v === '1';
  } catch {
    /* по умолчанию */
  }
  const store = new RotStore({ explain });
  store.subscribe(() => {
    try {
      localStorage.setItem(EXPLAIN_KEY, store.get().explain ? '1' : '0');
    } catch {
      /* не запомнится */
    }
  });
  function Screen({ chrome }: { chrome: Chrome }) {
    return <RotView chrome={chrome} store={store} />;
  }
  return {
    id: ROT_MODULE,
    tab: 'Вращение тела',
    store: { undo: store.undo, redo: store.redo, exportProject: store.exportProject, importProject: store.importProject, notify: store.notify, projectTitle: store.projectTitle },
    Screen,
  };
}
