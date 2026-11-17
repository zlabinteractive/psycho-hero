// Where saves go: the browser's localStorage, unless a store is swapped in (tests). Both have
// getItem/setItem/clear.
let data = null;
export const useSaveData = store => { data = store; };
export const save = () => data ?? globalThis.localStorage;

// Dev panel: erase every save (portal data, localStorage, sessionStorage), then swap in a store that
// keeps nothing, so a commit on the way out (records bank on visibilitychange) can't write it back.
export function wipeSave() {
  for (const store of [data, globalThis.localStorage, globalThis.sessionStorage]) {
    try { store?.clear(); } catch { /* blocked storage: nothing to wipe */ }
  }
  data = { getItem: () => null, setItem() {}, removeItem() {}, clear() {} };
}
