import { createContext, useContext, useSyncExternalStore } from 'react';
import type { AppState, Store } from './store';

export const StoreContext = createContext<Store | null>(null);

export function useStore(): [AppState, Store] {
  const store = useContext(StoreContext);
  if (!store) throw new Error('StoreContext не задан');
  const st = useSyncExternalStore(store.subscribe, store.get);
  return [st, store];
}
