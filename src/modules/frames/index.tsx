/** Раздел «Балки и рамы»: плоская рама из горизонтальных и вертикальных участков, внутренние шарниры. */
import type { Chrome, StatikaModule } from '../../app/module';
import { FramesView } from './ui/FramesView';
import { Store } from './ui/store';
import { StoreContext } from './ui/useStore';

const EXPLAIN_KEY = 'statika.explain';

function readExplain(): boolean {
  try {
    const v = localStorage.getItem(EXPLAIN_KEY);
    return v == null ? true : v === '1';
  } catch {
    return true;
  }
}

export function createFramesModule(): StatikaModule & { store: Store } {
  const store = new Store({ explain: readExplain() });
  store.subscribe(() => {
    try {
      localStorage.setItem(EXPLAIN_KEY, store.get().explain ? '1' : '0');
    } catch {
      /* хранилище недоступно — настройка не запомнится */
    }
  });
  function Screen({ chrome }: { chrome: Chrome }) {
    return (
      <StoreContext.Provider value={store}>
        <FramesView chrome={chrome} />
      </StoreContext.Provider>
    );
  }
  return { id: 'frames', tab: 'Балки и рамы', store, Screen };
}
