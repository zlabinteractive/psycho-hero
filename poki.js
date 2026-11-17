// Poki SDK v2 (index.html loads it). The game talks to it only through here; every call is a no-op
// when the script did not load (ad blocker, offline) or init failed.
import { sound } from './sound.js';

// A commercial break that has not started within this long is treated as none, so the game never
// waits on it. Poki resolves the break itself when it shows no ad; this only guards a stuck SDK.
const AD_START_TIMEOUT_MS = 3000;

let sdk = null;
let playing = false;
let loaded = false;

const call = fn => {
  if (!sdk) return;
  try { fn(sdk); } catch (error) { console.warn('Poki SDK:', error); }
};

export const poki = {
  // Awaited before the game boots. Poki rejects init under an ad blocker; the game still runs.
  async init() {
    const candidate = globalThis.window?.PokiSDK;
    if (!candidate) return;
    try {
      await candidate.init();
    } catch (error) {
      console.warn('Poki SDK init failed:', error);
    }
    sdk = candidate;
  },

  // Called every frame with whether the player is in play. The first call ends loading (the game
  // is up and interactive) and removes the page loader; after that only changes reach the SDK.
  setPlaying(on) {
    if (!loaded) {
      loaded = true;
      globalThis.document?.getElementById('loader')?.remove();
      call(s => s.gameLoadingFinished());
    }
    if (on === playing) return;
    playing = on;
    call(s => (on ? s.gameplayStart() : s.gameplayStop()));
  },

  // A commercial break at a natural pause (between levels, retry after defeat). `done` runs exactly
  // once, after the break, on any error, or when no ad starts. Audio mutes only while an ad plays.
  midgame(done) {
    if (!sdk) { done(); return; }
    let finished = false;
    const end = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      sound.setAdMuted(false);
      done();
    };
    const timer = setTimeout(end, AD_START_TIMEOUT_MS);
    if (playing) { playing = false; call(s => s.gameplayStop()); }
    try {
      sdk.commercialBreak(() => { clearTimeout(timer); sound.setAdMuted(true); }).then(end, end);
    } catch {
      end();
    }
  },
};
