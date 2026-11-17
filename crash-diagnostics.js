// Local development diagnostics survive a frozen or reloaded game tab.
// No input events, browsing data or external service is recorded.
export function installCrashDiagnostics(scene, env = window) {
  // Development only: the endpoint lives on the dev server (server.js), not on any game host.
  const host = env.location?.hostname;
  if (host && !['localhost', '127.0.0.1', '[::1]'].includes(host)) return;
  const canvas = scene.game.canvas;
  const session = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let lastError = '', lastErrorAt = 0;
  const snapshot = () => ({
    elapsed: scene.elapsed ?? 0,
    active: scene.sys.isActive(),
    visible: !env.document.hidden,
    suspended: !!scene.controlsSuspended,
    heat: scene.director?.score ?? 0,
    chaos: scene.chaos?.score ?? 0,
    displayedHeat: scene.responseHud?.phase?.textContent ?? '',
    displayedChaos: scene.chaosHud?.score?.textContent ?? '',
    enemies: scene.combat?.enemies.length ?? 0,
    cars: scene.cityLife?.cars.length ?? 0,
    aircraft: scene.airLife?.crafts.length ?? 0,
    chunks: scene.destruction?.chunks.length ?? 0,
    textures: Object.keys(scene.textures?.list ?? {}).length,
    heap: env.performance.memory?.usedJSHeapSize ?? null,
    contextLost: scene.game.renderer.gl?.isContextLost() ?? false,
    holding: scene.throwing?.held?.enemy?.kind ?? scene.throwing?.held?.enemy?.enemyType ?? null,
  });
  const record = (type, error) => {
    const message = String(error?.message ?? error ?? '').slice(0, 1000);
    const now = Date.now();
    if (type === 'error' || type === 'rejection') {
      if (message === lastError && now - lastErrorAt < 1000) return;
      lastError = message; lastErrorAt = now;
    }
    // Avoid changing exception handling or producing new unhandled rejections if logging fails.
    try {
      const entry = { session, type, message, stack: String(error?.stack ?? '').slice(0, 3000), state: snapshot() };
      env.fetch('/__diagnostics', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry), keepalive: true }).catch(() => {});
    } catch { /* A stopped development server must not affect the game. */ }
  };
  const error = event => record('error', event.error ?? event.message);
  const rejection = event => record('rejection', event.reason);
  const lost = () => record('context-lost');
  const restored = () => record('context-restored');
  const leaving = () => record('pagehide');
  env.addEventListener('error', error);
  env.addEventListener('unhandledrejection', rejection);
  env.addEventListener('pagehide', leaving);
  canvas.addEventListener('webglcontextlost', lost);
  canvas.addEventListener('webglcontextrestored', restored);
  const timer = env.setInterval(() => record('heartbeat'), 10000);
  record('start');
  scene.events.once('shutdown', () => {
    env.clearInterval(timer);
    env.removeEventListener('error', error);
    env.removeEventListener('unhandledrejection', rejection);
    env.removeEventListener('pagehide', leaving);
    canvas.removeEventListener('webglcontextlost', lost);
    canvas.removeEventListener('webglcontextrestored', restored);
  });
}
