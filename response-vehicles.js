// Road response vehicles, in metres. Crew identities and reserved seats use the same counts.
// Mounted guns reserve an extra combat slot before their vehicle arrives.
export const RESPONSE_VEHICLES = Object.freeze({
  police: { length: 4.5, height: 1.5, paint: 0xe9ecef, crew: 3 },
  policevan: { length: 6.2, height: 2.6, paint: 0xe9ecef, crew: 6 },
  policebike: { length: 2.4, height: 1.6, paint: 0xe9ecef, crew: 1, pace: 1.65 },
  swat: { length: 6, height: 2.5, paint: 0x1b1e24, crew: 4 },
  armoured: { length: 7.5, height: 2.7, paint: 0x474c54, tough: 3, crew: 0, mounted: true },
  apc: { length: 7.5, height: 2.6, paint: 0x5b6644, tough: 4, crew: 6, mounted: true },
  tank: { length: 9, height: 1.6, paint: 0x515c3c, tough: 5, heavy: true, pace: 0.4, crew: 0, mounted: true },
});
